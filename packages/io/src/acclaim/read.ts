// The Acclaim skeleton and motion formats the CMU motion capture database uses (PLAN.md WP-5.2; carried from my-3d2dge
// tools/asf-amc.mjs, bit for bit: conformance tier 1b). An .asf gives a subject's bones (a rest direction and length in
// world space, an axis frame C: Euler angles, X then Y then Z about fixed axes); an .amc a take, each bone's angles
// frame by frame. A frame's angles R turn a bone as M = M_parent · C · R · C⁻¹, and its end sits at the parent's end +
// length · M · direction. `readCmu` turns picked stretches of takes into the 36 body points the glTF reader measures,
// in the rig's frame (forward, right, up; mm, the root on the ground): a loop cut at its best cycle and closed exactly,
// the rest pose stood on the floor the takes stand on. Text in, nothing read from disk; portable math throughout.
// Bone names key maps with no prototype (a bone may be called "constructor"), and a subject's takes together are held
// to a budget of frames times bones.
import { format, math } from "@m3a/core";
import { checkText, IoError, LIMITS, spend } from "../bytes.ts";
import type { Capture } from "../gltf/read.ts";
import { cutPicks, restCapture, type Pick } from "../takes.ts";

const { PORTABLE } = math;
type V3 = number[];
type M3 = number[];

/* ---- 3x3 matrices, row major (the original's order of operations) ---- */
const mm = (a: M3, b: M3): M3 => {
  const o = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  return o;
};
const mv = (m: M3, v: V3): V3 => [m[0]! * v[0]! + m[1]! * v[1]! + m[2]! * v[2]!, m[3]! * v[0]! + m[4]! * v[1]! + m[5]! * v[2]!, m[6]! * v[0]! + m[7]! * v[1]! + m[8]! * v[2]!];
const tr = (m: M3): M3 => [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!];
/** Rotation by x, then y, then z (degrees, or radians when `unit` is 1) about the fixed axes: Rz · Ry · Rx. */
const euler = (x: number, y: number, z: number, unit = Math.PI / 180): M3 => {
  const [cx, sx, cy, sy, cz, sz] = [PORTABLE.cos(x * unit), PORTABLE.sin(x * unit), PORTABLE.cos(y * unit), PORTABLE.sin(y * unit), PORTABLE.cos(z * unit), PORTABLE.sin(z * unit)];
  return mm(mm([cz, -sz, 0, sz, cz, 0, 0, 0, 1], [cy, 0, sy, 0, 1, 0, -sy, 0, cy]), [1, 0, 0, 0, cx, -sx, 0, sx, cx]);
};
const add = (a: V3, b: V3): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const sub = (a: V3, b: V3): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const mul = (a: V3, k: number): V3 => [a[0]! * k, a[1]! * k, a[2]! * k];
const norm = (a: V3): V3 => mul(a, 1 / (PORTABLE.hypot(...a) || 1));
const dot = (a: V3, b: V3) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** One bone: its rest direction (unit, world), length (file units), axis frame and its inverse, and its channels. */
export interface AsfBone {
  dir: V3;
  len: number;
  C: M3;
  Ci: M3;
  dof: string[];
}
/** A skeleton: metres per file unit, the bones, their order (parents first) and parents, and the root's frame. */
export interface Asf {
  scale: number;
  bones: Record<string, AsfBone>;
  parent: Record<string, string>;
  order: string[];
  root: { C: M3; Ci: M3 };
  /** Radians per angle unit (degrees unless `:units angle rad`). */
  unit: number;
}

const num = (s: string | undefined, what: string, line: number, file?: string): number => {
  const v = Number(s);
  if (s === undefined || !Number.isFinite(v)) throw new IoError("E_FORMAT", `line ${line}: ${what} isn't a number ("${s ?? ""}")`, { file });
  return v;
};
/** A map keyed by names from the file, with no prototype to collide with. */
const named = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

/** An .asf skeleton. */
export function readAsf(text: string, file?: string): Asf {
  checkText(text, file);
  const lines = text.split(/\r?\n/), bones = named<AsfBone>(), parent = named<string>(), order: string[] = [];
  let count = 0;
  let scale = 0.0254 / 0.45, unit = Math.PI / 180, section = "", rootAxis = [0, 0, 0];
  let cur: { name?: string; dir?: number[]; len?: number; axis?: number[]; dof: string[]; line: number } | null = null;
  const fail = (line: number, message: string) => new IoError("E_FORMAT", `line ${line}: ${message}`, { file });
  lines.forEach((raw, k) => {
    const n = k + 1, line = raw.replace(/#.*/, "").trim();
    if (!line) return;
    if (line.startsWith(":")) {
      section = line.split(/\s+/)[0]!;
      return;
    }
    const w = line.split(/\s+/);
    if (section === ":units" && w[0] === "length") scale = 0.0254 / num(w[1], "the length unit", n, file);
    else if (section === ":units" && w[0] === "angle") unit = /^rad/i.test(w[1] ?? "") ? 1 : Math.PI / 180;
    else if (section === ":root" && w[0] === "orientation") rootAxis = [1, 2, 3].map((i) => num(w[i], "the root's orientation", n, file));
    else if (section === ":bonedata") {
      if (w[0] === "begin") cur = { dof: [], line: n };
      else if (w[0] === "end") {
        if (!cur) throw fail(n, "an end with no begin");
        const c = cur as NonNullable<typeof cur>;
        if (!c.name || !c.dir || c.len === undefined || !c.axis) throw fail(c.line, `a bone without its ${["name", "direction", "length", "axis"].filter((f) => !(f === "name" ? c.name : f === "direction" ? c.dir : f === "length" ? c.len !== undefined : c.axis)).join(", ")}`);
        if (count >= LIMITS.nodes) throw fail(n, "too many bones");
        const C = euler(c.axis[0]!, c.axis[1]!, c.axis[2]!, unit);
        if (!(c.name in bones)) count++;
        bones[c.name] = { dir: norm(c.dir), len: c.len, C, Ci: tr(C), dof: c.dof };
        cur = null;
      } else if (cur && w[0] === "name") cur.name = w[1];
      else if (cur && w[0] === "direction") cur.dir = [1, 2, 3].map((i) => num(w[i], "a direction", n, file));
      else if (cur && w[0] === "length") cur.len = num(w[1], "a length", n, file);
      else if (cur && w[0] === "axis") cur.axis = [1, 2, 3].map((i) => num(w[i], "an axis", n, file));
      else if (cur && w[0] === "dof") cur.dof = w.slice(1).map((d) => d.toLowerCase());
    } else if (section === ":hierarchy" && w[0] !== "begin" && w[0] !== "end") for (const c of w.slice(1)) parent[c] = w[0]!;
  });
  for (const [c, p] of Object.entries(parent)) {
    if (!bones[c]) throw new IoError("E_FORMAT", `the hierarchy names bone "${c}", which :bonedata doesn't define`, { file });
    if (p !== "root" && !bones[p]) throw new IoError("E_FORMAT", `the hierarchy gives "${c}" the parent "${p}", which :bonedata doesn't define`, { file });
  }
  // each bone after its parents: walk up to a placed bone (or the root), then place the chain top down
  const placed = new Set<string>();
  for (const b of Object.keys(bones)) {
    const chain: string[] = [];
    for (let k: string | undefined = b; k && k !== "root" && !placed.has(k); k = parent[k]) {
      if (chain.length > count) throw new IoError("E_FORMAT", `bone "${b}"'s parents form a cycle`, { file });
      chain.push(k);
    }
    for (let c = chain.length - 1; c >= 0; c--) {
      placed.add(chain[c]!);
      order.push(chain[c]!);
    }
  }
  const rC = euler(rootAxis[0]!, rootAxis[1]!, rootAxis[2]!, unit);
  return { scale, bones, parent, order, root: { C: rC, Ci: tr(rC) }, unit };
}

/** An .amc take: one `{ bone: values }` per frame. */
export function readAmc(text: string, file?: string): Record<string, number[]>[] {
  checkText(text, file);
  const frames: Record<string, number[]>[] = [];
  let cur: Record<string, number[]> | null = null;
  text.split(/\r?\n/).forEach((raw, k) => {
    const line = raw.trim();
    if (!line || line[0] === "#" || line[0] === ":") return;
    if (/^\d+$/.test(line)) {
      if (frames.length >= LIMITS.frames) throw new IoError("E_LIMIT", `over ${LIMITS.frames} frames`, { file });
      cur = named<number[]>();
      frames.push(cur);
      return;
    }
    if (!cur) throw new IoError("E_FORMAT", `line ${k + 1}: a bone's values before the first frame number`, { file });
    const w = line.split(/\s+/), v = w.slice(1).map(Number);
    if (v.some((x) => !Number.isFinite(x))) throw new IoError("E_FORMAT", `line ${k + 1}: ${w[0]}'s values aren't all numbers`, { file });
    cur[w[0]!] = v;
  });
  return frames;
}

/** Every bone's world rotation and end point (metres) for one frame (null: the rest pose, the root at the origin). */
export function pose(sk: Asf, frame: Record<string, number[]> | null): { M: Record<string, M3>; end: Record<string, V3>; start: (n: string) => V3 } {
  const M = named<M3>(), end = named<V3>(), r = (frame && frame.root) || [0, 0, 0, 0, 0, 0];
  M.root = mm(mm(sk.root.C, euler(r[3] ?? 0, r[4] ?? 0, r[5] ?? 0, sk.unit)), sk.root.Ci);
  end.root = mul(r.slice(0, 3), sk.scale);
  const AX: Record<string, number> = { rx: 0, ry: 1, rz: 2 };
  for (const n of sk.order) {
    const b = sk.bones[n]!, v = (frame && frame[n]) || [], a = [0, 0, 0];
    b.dof.forEach((d, i) => {
      if (v[i] !== undefined && AX[d] !== undefined) a[AX[d]!] = v[i]!;
    });
    M[n] = mm(mm(mm(M[sk.parent[n] || "root"]!, b.C), euler(a[0]!, a[1]!, a[2]!, sk.unit)), b.Ci);
    end[n] = add(end[sk.parent[n] || "root"]!, mul(mv(M[n]!, b.dir), b.len * sk.scale));
  }
  return { M, end, start: (n) => end[sk.parent[n] || "root"]! };
}

/** A stretch of a CMU take to import (`takes.ts`'s pick). */
export type CmuPick = Pick;
/** A CMU subject read: its picks as body points, `_rest` (its T-pose on the floor its takes stand on), and its notes. */
export interface CmuLibrary {
  rig: "cmu";
  clips: Record<string, Capture>;
  body: null;
  log: string[];
}

const NEED = ["lowerback", "upperback", "thorax", "upperneck", "head", ...["l", "r"].flatMap((s) => ["hipjoint", "femur", "tibia", "foot", "toes", "clavicle", "humerus", "radius", "hand", "fingers", "thumb"].map((b) => s + b))];

/**
 * One subject's picked stretches as clips, plus `_rest`. `amc(take)` gives a take's text. Each clip starts at the origin,
 * facing forward; a loop is cut at its best cycle (poses and speeds matching at its ends, half a second to 2.5 s long),
 * faces the way it travels, its root following the straight line through the cycle, and what its last frame still
 * differs from its first is spread over the cycle so it closes exactly. `floorEach`: each take stood on its own floor,
 * and the rest, on the ground (a subject's takes can stand centimetres apart, or on a mat); off, the origin's one floor
 * a subject, where its takes stand together (not always the ground).
 */
export function readCmu(asfText: string, amc: (take: string) => string, picks: readonly CmuPick[], FPS = 30, file?: string, opts: { floorEach?: boolean } = {}): CmuLibrary {
  const sk = readAsf(asfText, file), B = sk.bones, rest = pose(sk, null), POINTS = format.POINTS;
  const missing = NEED.filter((n) => !B[n]);
  if (missing.length) throw new IoError("E_RIG", `it lacks bones: ${missing.join(", ")}`, { file });
  // the rig's frame from the rest pose: up is +y; forward from the heel toward the toes; right toward the right hip
  const fwd0 = norm([rest.end.ltoes![0]! - rest.end.ltibia![0]!, 0, rest.end.ltoes![2]! - rest.end.ltibia![2]!]);
  let RIGHT: V3 = [fwd0[2]!, 0, -fwd0[0]!];
  if (dot(sub(rest.end.rhipjoint!, rest.end.lhipjoint!), RIGHT) < 0) RIGHT = mul(RIGHT, -1);
  // points fixed on a bone: [bone, along (0 = its start, 1 = its end), offset at rest (metres, world)]
  type On = [string, number, V3];
  const on = (b: string, t: number, off: V3 = [0, 0, 0]): On => [b, t, off], F12 = mul(fwd0, 0.12);
  const across = (s: string): V3 => {
    const h = B[s + "hand"]!.dir, th = B[s + "thumb"]!.dir, v = sub(th, mul(h, dot(th, h)));
    return norm(v);
  };
  const Pt: Record<string, On> = {
    pelvis: on("root", 1), spine1: on("lowerback", 1), spine2: on("upperback", 1), chest: on("thorax", 0.5), neck: on("thorax", 1), head: on("upperneck", 1),
    headTop: on("head", 1), faceF: on("head", 0, F12), chestF: on("thorax", 0.5, F12), pelvisF: on("root", 1, F12),
  };
  for (const [S, s] of [["L", "l"], ["R", "r"]] as const) Object.assign(Pt, {
    ["clav" + S]: on(s + "clavicle", 0.15), ["sh" + S]: on(s + "clavicle", 1), ["elbow" + S]: on(s + "humerus", 1), ["wrist" + S]: on(s + "radius", 1),
    ["knuck" + S]: on(s + "hand", 1), ["index" + S]: on(s + "hand", 1, mul(across(s), 0.035)), ["pinky" + S]: on(s + "hand", 1, mul(across(s), -0.035)), ["fist" + S]: on(s + "fingers", 0.5),
    ["hip" + S]: on(s + "hipjoint", 1), ["knee" + S]: on(s + "femur", 1), ["ankle" + S]: on(s + "tibia", 1), ["ball" + S]: on(s + "foot", 1), ["toe" + S]: on(s + "toes", 1),
  });
  type Posed = ReturnType<typeof pose>;
  const at = (ps: Posed, [b, t, off]: On): V3 => (b === "root" ? add(ps.end.root!, mv(ps.M.root!, off)) : add(add(ps.start(b), mul(mv(ps.M[b]!, B[b]!.dir), B[b]!.len * sk.scale * t)), mv(ps.M[b]!, off)));
  const pts = (ps: Posed): V3[] => POINTS.map((n) => at(ps, Pt[n]!));
  const facing = { fwd: fwd0, right: RIGHT }, cache = new Map<string, Record<string, number[]>[]>();
  let work = 0;
  const takeOf = (take: string) => {
    let frames = cache.get(take);
    if (!frames) {
      frames = readAmc(amc(take), `${take}.amc`);
      // the takes together: frames posed times the skeleton's bones
      work += frames.length * sk.order.length;
      spend(work, LIMITS.work, `the takes come to ${work} bone transforms`, `${take}.amc`);
    }
    cache.set(take, frames);
    return { frames: frames.length, points: (k: number) => pts(pose(sk, frames[k]!)) };
  };
  const { clips, lows, log } = cutPicks(takeOf, facing, picks, FPS, file, { floorEach: !!opts.floorEach });
  clips._rest = restCapture(pts(rest), opts.floorEach ? [] : lows, facing, FPS);
  return { rig: "cmu", clips, body: null, log };
}
