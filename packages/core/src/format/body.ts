// The format's body: the 36 body points a key decodes to (spec/MOTION.md §3.1), the rest body measured per library
// (§3.2), and the two-bone limb helpers the encoder and decoder share, ported from my-3d2dge's readable.js:19-23 and
// :88-125 operation for operation.
import { add, cross, dot, DG, len, mul, norm, sub, wld, type Frame, type V3 } from "./math.ts";
import { PORTABLE as PM } from "../math/portable.ts";

/** The body points a key decodes to, in the rig frame (mm), in this order. */
export const POINTS: readonly string[] = [
  "pelvis", "spine1", "spine2", "chest", "neck", "head", "headTop", "faceF", "chestF", "pelvisF",
  ...["L", "R"].flatMap((s) => ["clav", "sh", "elbow", "wrist", "index", "knuck", "pinky", "fist", "hip", "knee", "ankle", "ball", "toe"].map((p) => p + s)),
];
/** Each body point's index in POINTS. */
export const IDX: Readonly<Record<string, number>> = Object.fromEntries(POINTS.map((p, i) => [p, i]));
/** The number of body points (36). */
export const P = POINTS.length;

/** A side, and its sign: L −1, R +1. */
export type Side = "L" | "R";
/** The sign of a side. */
export const SG: Readonly<Record<Side, number>> = { L: -1, R: 1 };

/** A rest body as a library's `measure` writes it (mm and degrees; spec/MOTION.md §3.2). */
export interface Rest {
  H0: number;
  hipZ: number;
  ankleZ: number;
  Pr: Frame;
  Cr: Frame;
  Hr: Frame;
  hip: Record<Side, V3>;
  spine: [V3, V3, V3, V3];
  neckSeg: V3;
  clav: Record<Side, V3>;
  cv: Record<Side, V3>;
  topH: V3;
  faceH: V3;
  up: number;
  fore: number;
  knuck: number;
  fist: number;
  thigh: number;
  shin: number;
  ab: number;
  bt: number;
  abPitch: number;
  btPitch: number;
  spineW: number[];
  neckW: number;
}

const DERIVED = new WeakMap<Rest, { lower: number; arm: number; leg: number }>();
/** Lengths derived from a rest: the forearm-plus-hand, the whole arm and the whole leg (cached per rest). */
export function derived(R: Rest): { lower: number; arm: number; leg: number } {
  let d = DERIVED.get(R);
  if (!d) {
    d = { lower: R.fore + R.fist, arm: R.up + R.fore + R.fist, leg: R.thigh + R.shin };
    DERIVED.set(R, d);
  }
  return d;
}

/** Point `n` of a body-point array. */
export const pt = (X: ArrayLike<number>, n: string): V3 => {
  const i = IDX[n]! * 3;
  return [X[i]!, X[i + 1]!, X[i + 2]!];
};

/** Two-bone IK in 3D: the joint and the end, with `hint` choosing the side the joint bends toward. */
export function ik3(a: V3, b: V3, L1: number, L2: number, hint: V3): [V3, V3] {
  let d = sub(b, a);
  let dist = len(d);
  const max = L1 + L2 - 0.01;
  if (dist > max) {
    d = mul(d, max / dist);
    b = add(a, d);
    dist = max;
  }
  dist = Math.max(dist, 0.01);
  const n = mul(d, 1 / dist);
  let h = sub(hint, mul(n, dot(hint, n)));
  const hl = len(h);
  h = hl < 1e-4 ? [n[1], -n[0], 0] : mul(h, 1 / hl);
  const x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const y = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  return [add(add(a, mul(n, x)), mul(h, y)), b];
}
/** The middle joint's bend (degrees, 0 straight) for a root-to-end distance. */
export const bendOf = (dist: number, L1: number, L2: number): number => 180 - PM.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2)))) / DG;
/** The root-to-end distance for a bend (degrees). */
export const reachOf = (bend: number, L1: number, L2: number): number => Math.sqrt(Math.max(0, L1 * L1 + L2 * L2 + 2 * L1 * L2 * PM.cos(bend * DG)));
/** v taken within 180 of prev (angles continue from the key before). */
export const unwrap = (v: number, prev: number | undefined): number => (prev === undefined ? v : v + 360 * Math.round((prev - v) / 360));

// A twist is measured round the limb from the way its middle joint naturally bends, carried from one rest direction to
// the limb's actual direction by the shortest turn (readable.js:106-123).
const REST = { arm: (s: number): V3 => [0.5, s * 0.5, -0.7], leg: (_s: number): V3 => [0.3, 0, -1] };
const BEND = { arm: (s: number): V3 => [-1, s * 0.5, -0.3], leg: (s: number): V3 => [1, s * 0.1, 0] };
const across = (h: V3, d: V3): V3 => norm(sub(h, mul(d, dot(h, d))));
/** The twist reference for a limb pointing `dLocal` (in frame M), in M's parent coordinates. */
export function hintFor(limb: "arm" | "leg", s: number, M: Frame, dLocal: V3): V3 {
  const d = norm(dLocal);
  const r = norm(REST[limb](s));
  const n0 = across(norm(BEND[limb](s)), r);
  const ax = cross(r, d);
  const sn = len(ax);
  const cs = dot(r, d);
  let n = n0;
  if (sn > 1e-9) {
    const k = mul(ax, 1 / sn);
    const a = PM.atan2(sn, cs);
    const c = PM.cos(a);
    const si = PM.sin(a);
    n = add(add(mul(n0, c), mul(cross(k, n0), si)), mul(k, dot(k, n0) * (1 - c)));
  }
  return wld(M, across(n, d));
}
/** The signed angle (degrees) round axis d from hint h to the bend direction b. */
export const poleOf = (d: V3, h: V3, b: V3): number => {
  const hn = norm(sub(h, mul(d, dot(h, d))));
  const bn = norm(sub(b, mul(d, dot(b, d))));
  return PM.atan2(dot(cross(hn, bn), d), dot(hn, bn)) / DG;
};
/** The hint turned `deg` degrees round axis d. */
export const poleHint = (d: V3, h: V3, deg: number): V3 => {
  const hn = norm(sub(h, mul(d, dot(h, d))));
  const a = deg * DG;
  return add(mul(hn, PM.cos(a)), mul(cross(d, hn), PM.sin(a)));
};
/** The end of a limb: from `root`, direction v (side-mirrored) in frame M, at length `len`. */
export const limbEnd = (root: V3, M: Frame, v: readonly number[], s: Side, length: number): V3 => add(root, wld(M, [v[0]! * length, v[1]! * SG[s] * length, v[2]! * length]));
