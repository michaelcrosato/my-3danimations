// VRM Animation (.vrma; PLAN.md WP-5.2): a binary glTF whose nodes are a humanoid skeleton at rest, whose one animation
// turns them, and whose `VRMC_vrm_animation` extension says which node plays each VRM 1.0 humanoid bone. `vrmaOf` plays
// a clip on a bound skeleton (core's Animator: feet planted, the root's travel and turn) and keeps what a VRM player
// plays, the humanoid bones alone: each bone's rotation relative to its parent as the player sees the parent (a
// non-humanoid node stays at rest), and the hips' place with the root's travel and turn in it, so every bone lands
// where the Animator put it. The clip's id, loop, length, events, contacts and facts ride in the animation's `extras`,
// as three's bake writes them. `encodeVrma` writes it, `decodeVrma` reads it back to the same structure, so a file
// written, read and written again is byte for byte the same.
import { Animator, math, solver, VERSION, type AnimClip, type Bound } from "@m3a/core";
import { IoError, LIMITS } from "../bytes.ts";
import { packGlb, parseGlb, plainOnly, type GltfJson } from "../gltf/container.ts";
import { accessor, hierarchy } from "../gltf/read.ts";

const { quat, PORTABLE } = math;
type V3 = [number, number, number];
type Q = [number, number, number, number];

/** A node: its name, its parent's index (−1: a root), and its rest transform relative to the parent. */
export interface VrmaNode {
  name: string;
  parent: number;
  translation: number[];
  rotation: number[];
}
/** One track: a node's rotation (x, y, z, w) or translation at every sample time. */
export interface VrmaTrack {
  node: number;
  path: "rotation" | "translation";
  values: Float32Array;
}
/** What a clip carries that glTF has no place for (the animation's `extras`, as three's bake writes them). */
export interface VrmaExtras {
  id?: string;
  loop: boolean;
  dur: number;
  events: unknown[];
  contacts: unknown;
  facts: unknown;
}
/** A VRM animation: the skeleton, which node plays each humanoid bone, the sample times and tracks, and the extras. */
export interface Vrma {
  generator: string;
  name: string;
  nodes: VrmaNode[];
  humanBones: Record<string, number>;
  times: Float32Array;
  tracks: VrmaTrack[];
  extras: VrmaExtras;
}

const EXT = "VRMC_vrm_animation";
const q = (a: ArrayLike<number>): Q => [a[0]!, a[1]!, a[2]!, a[3]!];
const conj = (a: readonly number[]): Q => q(quat.conjugate([0, 0, 0, 1], q(a)));
const qmul = (a: readonly number[], b: readonly number[]): Q => q(quat.multiply([0, 0, 0, 1], q(a), q(b)));
const rotate = (a: ArrayLike<number>, v: ArrayLike<number>): V3 => {
  const r = quat.rotate([0, 0, 0], q(a), [v[0]!, v[1]!, v[2]!]);
  return [r[0]!, r[1]!, r[2]!];
};
const plus = (a: ArrayLike<number>, b: ArrayLike<number>): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const minus = (a: ArrayLike<number>, b: ArrayLike<number>): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];

/** The humanoid bones a VRMA's extension names, each its node, checked against the nodes there are. */
export function humanBonesOf(json: GltfJson, file?: string): Record<string, number> {
  const ext = json.extensions?.[EXT] as { humanoid?: { humanBones?: unknown } } | undefined, hb = ext?.humanoid?.humanBones;
  if (!hb || typeof hb !== "object" || Array.isArray(hb)) throw new IoError("E_FORMAT", `not a VRM animation: no ${EXT} humanoid`, { file });
  const out: Record<string, number> = {}, nodes = (json.nodes ?? []).length;
  for (const [k, v] of Object.entries(hb as Record<string, unknown>)) {
    const node = v && typeof v === "object" ? (v as { node?: unknown }).node : v;
    if (!Number.isInteger(node) || (node as number) < 0 || (node as number) >= nodes) throw new IoError("E_FORMAT", `humanoid bone ${k} names node ${String(node)}, which doesn't exist`, { file });
    out[k] = node as number;
  }
  return out;
}

/**
 * A clip played on bound skeleton `b` as a VRM animation: every bone of the skeleton a node at rest, sampled every
 * 1/`fps` s or so (whole steps over the clip; a loop's last sample its cycle's end), feet planted.
 */
export function vrmaOf(clip: AnimClip, b: Bound, opts: { fps?: number } = {}): Vrma {
  const fps = opts.fps ?? 30, n = Math.max(1, Math.ceil(clip.dur * fps)), h = clip.dur / n;
  if (n + 1 > LIMITS.frames) throw new IoError("E_LIMIT", `${n + 1} samples, over the limit`);
  const order = b.order, index = new Map(order.map((o, i) => [o.name, i])), restW = (name: string) => q(b.restWorld[name] ?? [0, 0, 0, 1]);
  const nodes: VrmaNode[] = order.map((o) => {
    if (o.parent < 0) return { name: o.name, parent: -1, translation: [...o.head], rotation: [...restW(o.name)] };
    const p = order[o.parent]!;
    return { name: o.name, parent: o.parent, translation: rotate(conj(restW(p.name)), [o.head[0] - p.head[0], o.head[1] - p.head[1], o.head[2] - p.head[2]]), rotation: qmul(conj(restW(p.name)), restW(o.name)) };
  });
  const humanBones: Record<string, number> = {};
  for (const [vrm, src] of Object.entries(b.bones)) if (index.has(src)) humanBones[vrm] = index.get(src)!;
  const hips = b.bones.hips!, hipsAt = index.get(hips)!;
  // the root's turn about the skeleton's up, the right way round: forward turning toward right for a positive yaw
  const { forward: F, right: R, up: U } = b.frame, sign = Math.sign((F[1] * R[2] - F[2] * R[1]) * U[0] + (F[2] * R[0] - F[0] * R[2]) * U[1] + (F[0] * R[1] - F[1] * R[0]) * U[2]) || 1;
  const yawOf = (deg: number): Q => {
    const a = ((deg * Math.PI) / 180) * sign, s = PORTABLE.sin(a / 2);
    return [U[0] * s, U[1] * s, U[2] * s, PORTABLE.cos(a / 2)];
  };
  const placeOf = (root: { forward: number; right: number; yaw: number }, p: readonly number[]): V3 => {
    const o = b.origin, y = yawOf(root.yaw), d = rotate(y, [p[0]! - o[0], p[1]! - o[1], p[2]! - o[2]]), t = solver.dirToSkeleton(b, [root.forward * b.scale, root.right * b.scale, 0]);
    return [o[0] + t[0] + d[0], o[1] + t[1] + d[1], o[2] + t[2] + d[2]];
  };
  const roots = order.map((o, i) => (o.parent < 0 ? i : -1)).filter((i) => i >= 0), moves = [...new Set([...roots, hipsAt])];
  const rot = order.map(() => new Float32Array((n + 1) * 4)), pos = new Map(moves.map((i) => [i, new Float32Array((n + 1) * 3)]));
  const times = new Float32Array(n + 1), a = new Animator(b, { step: h }).layer("clip", { clip });
  for (let i = 0; i <= n; i++) {
    let p = a.pose();
    if (i === n && clip.loop && n > 0) {
      const end = new Animator(b, { step: h });
      end.layer("clip", { clip, time: clip.dur * (1 - 1e-12) });
      p = { ...end.pose(), root: a.root };
    }
    times[i] = i * h;
    order.forEach((o, k) => {
      const turned = o.parent < 0 ? qmul(yawOf(p.root.yaw), p.world[o.name] ?? restW(o.name)) : q(p.local[o.name] ?? nodes[k]!.rotation);
      rot[k]!.set(turned, i * 4);
    });
    for (const k of moves) {
      const o = order[k]!, at = o.name === hips ? p.hips : o.head;
      const v = o.parent < 0 ? placeOf(p.root, at) : rotate(conj(restW(order[o.parent]!.name)), [at[0] - order[o.parent]!.head[0], at[1] - order[o.parent]!.head[1], at[2] - order[o.parent]!.head[2]]);
      pos.get(k)!.set(v, i * 3);
    }
    if (i < n) a.step(h);
  }
  // what a player plays: each humanoid bone against its parent as the player sees it (a non-humanoid node at rest), the
  // hips' place with the root's travel and turn in it
  const human = new Set(Object.values(humanBones)), hRot = new Map([...human].map((k) => [k, new Float32Array((n + 1) * 4)])), hipsPos = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const Wr: Q[] = [], Wp: V3[] = [], Er: Q[] = [], Ep: V3[] = [];
    order.forEach((o, k) => {
      const r = q(rot[k]!.subarray(i * 4, i * 4 + 4)), t = pos.has(k) ? pos.get(k)!.subarray(i * 3, i * 3 + 3) : nodes[k]!.translation, P = o.parent;
      Wr[k] = P < 0 ? r : qmul(Wr[P]!, r);
      Wp[k] = P < 0 ? [t[0]!, t[1]!, t[2]!] : plus(Wp[P]!, rotate(Wr[P]!, t));
      const pr: Q = P < 0 ? [0, 0, 0, 1] : Er[P]!, pp: V3 = P < 0 ? [0, 0, 0] : Ep[P]!;
      if (human.has(k)) {
        hRot.get(k)!.set(qmul(conj(pr), Wr[k]!), i * 4);
        Er[k] = Wr[k]!;
        if (k === hipsAt) hipsPos.set(rotate(conj(pr), minus(Wp[k]!, pp)), i * 3);
        Ep[k] = k === hipsAt ? Wp[k]! : plus(pp, rotate(pr, nodes[k]!.translation));
      } else {
        Er[k] = qmul(pr, nodes[k]!.rotation);
        Ep[k] = plus(pp, rotate(pr, nodes[k]!.translation));
      }
    });
  }
  const tracks: VrmaTrack[] = [...[...human].sort((x, y) => x - y).map((k): VrmaTrack => ({ node: k, path: "rotation", values: hRot.get(k)! })), { node: hipsAt, path: "translation", values: hipsPos }];
  const extras: VrmaExtras = { ...(clip.id ? { id: clip.id } : {}), loop: clip.loop, dur: clip.dur, events: clip.events ?? [], contacts: clip.contacts ?? null, facts: (clip as { facts?: unknown }).facts ?? null };
  return { generator: `@m3a/io ${VERSION}`, name: clip.id ?? "clip", nodes, humanBones, times, tracks, extras };
}

/** A VRM animation as a .vrma (binary glTF): one time accessor, one per track, the bones' map in the extension. */
export function encodeVrma(v: Vrma): Uint8Array {
  const chunks: Float32Array[] = [], accessors: unknown[] = [], views: unknown[] = [];
  let offset = 0;
  const put = (values: Float32Array, type: string, count: number, minmax = false) => {
    views.push({ buffer: 0, byteOffset: offset, byteLength: values.byteLength });
    const acc: Record<string, unknown> = { bufferView: views.length - 1, componentType: 5126, count, type };
    if (minmax) {
      let lo = count ? Infinity : 0, hi = count ? -Infinity : 0;
      for (const x of values) {
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      Object.assign(acc, { min: [lo], max: [hi] });
    }
    accessors.push(acc);
    chunks.push(values);
    offset += values.byteLength;
    return accessors.length - 1;
  };
  const input = put(v.times, "SCALAR", v.times.length, true), channels: unknown[] = [], samplers: unknown[] = [];
  for (const t of v.tracks) {
    const size = t.path === "rotation" ? 4 : 3;
    if (t.values.length !== v.times.length * size) throw new IoError("E_FORMAT", `node ${t.node}'s ${t.path} track has ${t.values.length} values for ${v.times.length} times`);
    samplers.push({ input, output: put(t.values, size === 4 ? "VEC4" : "VEC3", v.times.length), interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: t.node, path: t.path } });
  }
  const bin = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) {
    bin.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), at);
    at += c.byteLength;
  }
  const kids = v.nodes.map(() => [] as number[]);
  v.nodes.forEach((nd, i) => nd.parent >= 0 && kids[nd.parent]!.push(i));
  const json = {
    asset: { version: "2.0", generator: v.generator },
    extensionsUsed: [EXT],
    extensions: { [EXT]: { specVersion: "1.0", humanoid: { humanBones: Object.fromEntries(Object.entries(v.humanBones).map(([k, i]) => [k, { node: i }])) } } },
    scene: 0,
    scenes: [{ nodes: v.nodes.map((nd, i) => (nd.parent < 0 ? i : -1)).filter((i) => i >= 0) }],
    nodes: v.nodes.map((nd, i) => ({ name: nd.name, translation: nd.translation, rotation: nd.rotation, ...(kids[i]!.length ? { children: kids[i] } : {}) })),
    animations: [{ name: v.name, channels, samplers, extras: v.extras }],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  return packGlb(json, bin);
}

/** A .vrma read back: its skeleton, humanoid map, times, tracks and extras (one animation, one time accessor). */
export function decodeVrma(bytes: Uint8Array, file?: string): Vrma {
  const doc = parseGlb(bytes, file), G = doc.json;
  const humanBones = humanBonesOf(G, file);
  plainOnly(G, file);
  const nodes = G.nodes ?? [], { parent } = hierarchy(nodes, file);
  const an = (G.animations ?? [])[0];
  if (!an) throw new IoError("E_FORMAT", "no animation", { file });
  const inputs = new Set(an.samplers.map((s) => s.input));
  if (inputs.size > 1) throw new IoError("E_FORMAT", "its tracks keep different times (one time accessor is read)", { file });
  const flat = (i: number, want: string) => {
    const out: number[] = [];
    for (const x of accessor(G, doc.bin, i, want) as (number | number[])[]) if (typeof x === "number") out.push(x);
    else for (const y of x) out.push(y);
    return Float32Array.from(out);
  };
  const times = an.samplers.length ? flat(an.samplers[0]!.input, "SCALAR") : new Float32Array(0);
  const tracks = an.channels.map((c): VrmaTrack => {
    if (c.target.path !== "rotation" && c.target.path !== "translation") throw new IoError("E_FORMAT", `a ${c.target.path} track isn't read`, { file });
    if (c.target.node === undefined || c.target.node >= nodes.length) throw new IoError("E_FORMAT", `a track targets node ${c.target.node}, which doesn't exist`, { file });
    const s = an.samplers[c.sampler];
    if (!s) throw new IoError("E_FORMAT", `a track names sampler ${c.sampler}, which the animation doesn't have`, { file });
    const values = flat(s.output, c.target.path === "rotation" ? "VEC4" : "VEC3");
    if (values.length !== times.length * (c.target.path === "rotation" ? 4 : 3)) throw new IoError("E_FORMAT", `node ${c.target.node}'s ${c.target.path} track has ${values.length} values for ${times.length} times`, { file });
    return { node: c.target.node, path: c.target.path, values };
  });
  const ex = (an as { extras?: Partial<VrmaExtras> }).extras ?? {}, extras: VrmaExtras = { ...(typeof ex.id === "string" ? { id: ex.id } : {}), loop: ex.loop === true, dur: typeof ex.dur === "number" ? ex.dur : times.length ? times[times.length - 1]! : 0, events: Array.isArray(ex.events) ? ex.events : [], contacts: ex.contacts ?? null, facts: ex.facts ?? null };
  return {
    generator: G.asset?.version ? ((G.asset as { generator?: string }).generator ?? "") : "",
    name: an.name ?? "",
    nodes: nodes.map((nd, i) => ({ name: nd.name ?? `node${i}`, parent: parent[i]!, translation: nd.translation ?? [0, 0, 0], rotation: nd.rotation ?? [0, 0, 0, 1] })),
    humanBones,
    times,
    tracks,
    extras,
  };
}

/** A clip as a .vrma on bound skeleton `b` (`vrmaOf`, then `encodeVrma`). */
export function writeVrma(clip: AnimClip, b: Bound, opts: { fps?: number } = {}): Uint8Array {
  return encodeVrma(vrmaOf(clip, b, opts));
}
