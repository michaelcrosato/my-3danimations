// A glTF library on any rig (PLAN.md WP-5.2): each animation sampled at a fixed rate into its joints' transforms
// relative to their parents, read with the BVH reader's bone maps (`bvh/read.ts`: MotionBuilder's names for Mixamo
// exports, Unreal's, Rigify's, 100STYLE's, Bandai Namco's, VRM's), and cut into clips as captures are (`takes.ts`).
// The two rigs `readGltf` reads bit for bit stay there; this is the path for the rest, and for VRM animations, whose
// nodes take the humanoid bone each plays as their name. A frame is posed when it is asked for, so memory stays with
// the tracks; the file's frames and joint transforms together are held to a budget. An animation whose `extras` say it
// loops (three's bake, a VRMA written here) is read as a loop.
import { math } from "@m3a/core";
import { IoError, LIMITS, spend } from "../bytes.ts";
import { bvhPoints, bvhPose, rigBvh, type Bvh, type RiggedBvh } from "../bvh/read.ts";
import { cutPicks, restCapture, type Pick, type V3 } from "../takes.ts";
import { plainOnly, type GltfDoc } from "./container.ts";
import { accessor, hierarchy, restOf, segment, slerp, type Capture } from "./read.ts";

const { PORTABLE } = math;
type M3 = number[];
/** A unit quaternion (x, y, z, w) as a row-major rotation matrix. */
const qm = (q: number[]): M3 => {
  const l = PORTABLE.hypot(q[0]!, q[1]!, q[2]!, q[3]!) || 1, [x, y, z, w] = q.map((v) => v / l) as [number, number, number, number];
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
};

/**
 * Animation `an` of a glTF document as joints posed frame by frame (the BVH reader's form): the nodes in parent-first
 * order, named by `name(i)` (their own names by default), sampled every 1/`fps` s with linear in-betweens (rotations
 * slerped). Scale is ignored.
 */
export function posedOf(doc: GltfDoc, an: number, fps: number, name: (i: number) => string = (i) => doc.json.nodes?.[i]?.name ?? `node${i}`): Bvh {
  const G = doc.json, nodes = G.nodes ?? [], file = doc.bin?.file, anim = G.animations?.[an];
  if (!anim) throw new IoError("E_FORMAT", `no animation ${an}`, { file });
  plainOnly(G, file);
  const { parent, order } = hierarchy(nodes, file), at = new Map(order.map((n, k) => [n, k])), rest = nodes.map(restOf);
  const tracks = anim.channels.flatMap((c) => {
    const s = anim.samplers[c.sampler];
    if (!s) throw new IoError("E_FORMAT", `animation ${an} names sampler ${c.sampler}, which it doesn't have`, { file });
    if (s.interpolation === "CUBICSPLINE") throw new IoError("E_FORMAT", "CUBICSPLINE in-betweens aren't read (bake it LINEAR)", { file });
    if (c.target.node !== undefined && c.target.node >= nodes.length) throw new IoError("E_FORMAT", `animation ${an} targets node ${c.target.node}, which doesn't exist`, { file });
    const path = c.target.path, node = c.target.node;
    if (node === undefined || (path !== "rotation" && path !== "translation")) return [];
    const t = accessor(G, doc.bin, s.input, "SCALAR") as number[], v = accessor(G, doc.bin, s.output, path === "rotation" ? "VEC4" : "VEC3") as number[][];
    if (!t.length || v.length < t.length) throw new IoError("E_FORMAT", `a track has ${t.length} times and ${v.length} values`, { file });
    return [{ node, path, t, v, interp: s.interpolation }];
  });
  if (!anim.channels.length) throw new IoError("E_FORMAT", `animation ${an} has no tracks`, { file });
  let dur = 0;
  for (const k of tracks) dur = Math.max(dur, k.t[k.t.length - 1]!);
  const n = Math.max(1, Math.round(dur * fps) + 1);
  spend(n, LIMITS.frames, `${n} frames`, file);
  spend(n * nodes.length, LIMITS.work, `${n} frames of ${nodes.length} nodes`, file);
  /** Frame f's joints, relative to their parents: the tracks sampled, the rest where a node has none. */
  const frame = (f: number): [M3, V3][] => {
    const time = Math.min(dur, f / fps), trs = rest.map((r) => ({ t: r.t, r: r.r }));
    for (const k of tracks) {
      const j = segment(k.t, time);
      const u = k.t.length < 2 || k.interp === "STEP" ? 0 : Math.max(0, Math.min(1, (time - k.t[j]!) / (k.t[j + 1]! - k.t[j]! || 1)));
      const a = k.v[j]!, b = k.v[Math.min(j + 1, k.v.length - 1)]!;
      trs[k.node] = { ...trs[k.node]!, [k.path === "rotation" ? "r" : "t"]: k.path === "rotation" ? slerp(a, b, u) : a.map((x, i) => x + (b[i]! - x) * u) };
    }
    return order.map((i): [M3, V3] => [qm(trs[i]!.r), [...trs[i]!.t]]);
  };
  return {
    names: order.map(name),
    parent: order.map((i) => (parent[i]! >= 0 ? at.get(parent[i]!)! : null)),
    offset: order.map((i) => [...rest[i]!.t]),
    chans: order.map(() => []),
    first: order.map(() => 0),
    end: order.map(() => null),
    frameTime: 1 / fps,
    width: 0,
    values: new Float64Array(0),
    poses: { bind: order.map((i): [M3, V3] => [qm(rest[i]!.r), [...rest[i]!.t]]), count: n, at: frame },
  };
}

/** A glTF library read on any rig: each animation a take (or the picks of them), `_rest`, the map it used, and notes. */
export interface PosedLibrary {
  rig: string;
  clips: Record<string, Capture>;
  body: null;
  log: string[];
  rigged: RiggedBvh;
}

/**
 * Reads every animation of a glTF document (or `picks` of them, by animation name) as clips on the bone map its nodes
 * match, in metres unless `units` says otherwise. `name(i)` renames nodes (a VRMA's humanoid bones).
 */
export function readGltfPosed(doc: GltfDoc, opts: { fps?: number; picks?: Pick[]; units?: number; name?: (i: number) => string } = {}): PosedLibrary {
  const fps = opts.fps ?? 30, anims = doc.json.animations ?? [], file = doc.bin?.file, nodes = (doc.json.nodes ?? []).length;
  if (!anims.length) throw new IoError("E_MISSING", "no animations", { file });
  const byName = new Map(anims.map((a, i) => [a.name ?? `animation${i}`, i]));
  let frames = 0;
  const taken = new Map<string, Bvh>(), takeBvh = (take: string) => {
    let b = taken.get(take);
    if (!b) {
      const i = byName.get(take);
      if (i === undefined) throw new IoError("E_MISSING", `no animation "${take}"`, { file });
      b = posedOf(doc, i, fps, opts.name);
      // the file's animations together, as they are read
      frames += b.poses!.count;
      spend(frames, LIMITS.frames, `the animations come to ${frames} frames`, file);
      spend(frames * nodes, LIMITS.work, `${frames} frames of ${nodes} nodes`, file);
      taken.set(take, b);
    }
    return b;
  };
  const first = takeBvh([...byName.keys()][0]!), rigged = rigBvh(first, { units: opts.units ?? 1, ...(file ? { file } : {}) });
  const picks: Pick[] = opts.picks ?? [...byName.keys()].map((take) => ({ name: take, take, loop: false }));
  const { clips, lows, log } = cutPicks((take) => {
    const b = takeBvh(take), r = { ...rigged, bvh: b };
    return { frames: b.poses!.count, points: (k: number) => bvhPoints(r, bvhPose(b, k)) };
  }, rigged.facing, picks.map((p) => ({ ...p, fps: p.fps ?? fps })), fps, file);
  // a whole animation that says it loops (its extras: three's bake, a VRMA written here) is read as a loop
  if (!opts.picks) for (const [take, i] of byName) if ((anims[i] as { extras?: { loop?: unknown } }).extras?.loop === true && clips[take]) clips[take]!.loop = true;
  clips._rest = restCapture(rigged.rest, lows, rigged.facing, fps);
  return { rig: `gltf:${rigged.map}`, clips, body: null, log, rigged };
}
