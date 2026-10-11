// The codec's vector, frame and rotation math, ported operation for operation from my-3d2dge's
// src/mocap/readable.js:40-87 so results match the reference bit for bit (spec/MOTION.md §12): the same f64 operations
// in the same order, PM.hypot for lengths, and the same branch choices. Change nothing here without the tier-1a and
// tier-2 conformance tests.
import { PORTABLE as PM } from "../math/portable.ts";

/** A 3-vector, [f, r, z] in the rig frame. */
export type V3 = [number, number, number];
/** A frame: its forward, right and up axes written in the parent's coordinates. */
export type Frame = [V3, V3, V3];
/** A quaternion [x, y, z, w]. */
export type Quat = [number, number, number, number];

/** a − b. */
export const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
/** a + b. */
export const add = (a: readonly number[], b: readonly number[]): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
/** a · k. */
export const mul = (a: readonly number[], k: number): V3 => [a[0]! * k, a[1]! * k, a[2]! * k];
/** The dot product. */
export const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
/** The length (PM.hypot, as V8 computes it). */
export const len = (a: readonly number[]): number => PM.hypot(a[0]!, a[1]!, a[2]!);
/** The cross product. */
export const cross = (a: readonly number[], b: readonly number[]): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
/** a scaled to length 1 (a zero vector stays zero). */
export const norm = (a: readonly number[]): V3 => {
  const l = PM.hypot(a[0]!, a[1]!, a[2]!) || 1;
  return [a[0]! / l, a[1]! / l, a[2]! / l];
};

/** A frame from a right axis and a forward hint (right exact, forward made perpendicular). */
export const frameFR = (right: readonly number[], fwd: readonly number[]): Frame => {
  const R = norm(right);
  const F = norm(sub(fwd, mul(R, dot(fwd, R))));
  return [F, R, cross(F, R)];
};
/** A frame from an up axis and a forward hint (up exact, forward made perpendicular). */
export const frameUF = (up: readonly number[], fwd: readonly number[]): Frame => {
  const U = norm(up);
  const F = norm(sub(fwd, mul(U, dot(fwd, U))));
  return [F, cross(U, F), U];
};
/** v written in frame M's coordinates. */
export const loc = (M: Frame, v: readonly number[]): V3 => [dot(v, M[0]), dot(v, M[1]), dot(v, M[2])];
/** Frame-local l written in the parent's coordinates. */
export const wld = (M: Frame, l: readonly number[]): V3 => [
  M[0][0] * l[0]! + M[1][0] * l[1]! + M[2][0] * l[2]!,
  M[0][1] * l[0]! + M[1][1] * l[1]! + M[2][1] * l[2]!,
  M[0][2] * l[0]! + M[1][2] * l[1]! + M[2][2] * l[2]!,
];
/** Child frame C in parent frame P's coordinates. */
export const rel = (P: Frame, C: Frame): Frame => [loc(P, C[0]), loc(P, C[1]), loc(P, C[2])];
/** Parent P then relative R: the child in the grandparent's coordinates. */
export const compose = (P: Frame, R: Frame): Frame => [wld(P, R[0]), wld(P, R[1]), wld(P, R[2])];
/** Degrees to radians, as the reference writes it. */
export const DG = Math.PI / 180;

/** A frame [F, R, U] (columns) as a unit quaternion. */
export const quatOf = (M: Frame): Quat => {
  const [m00, m10, m20] = M[0];
  const [m01, m11, m21] = M[1];
  const [m02, m12, m22] = M[2];
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
  }
  const l = PM.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
/** Quaternion product a · b. */
export const qmul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
/** The conjugate. */
export const qconj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
/** v rotated by q. */
export const qrot = (q: Quat, v: readonly number[]): V3 => {
  const p = qmul(qmul(q, [v[0]!, v[1]!, v[2]!, 0]), qconj(q));
  return [p[0], p[1], p[2]];
};
/** Spherical interpolation, the reference's (linear and renormalized when nearly parallel). */
export const qslerp = (a: Quat, b: Quat, t: number): Quat => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (d > 0.9995) {
    const o: Quat = [a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t];
    const l = PM.hypot(o[0], o[1], o[2], o[3]);
    return [o[0] / l, o[1] / l, o[2] / l, o[3] / l];
  }
  const th = PM.acos(d);
  const k0 = PM.sin((1 - t) * th) / PM.sin(th);
  const k1 = PM.sin(t * th) / PM.sin(th);
  return [a[0] * k0 + bb[0] * k1, a[1] * k0 + bb[1] * k1, a[2] * k0 + bb[2] * k1, a[3] * k0 + bb[3] * k1];
};
/** The rotation that takes rest frame A to frame B, as a quaternion. */
export const qFromTo = (A: Frame, B: Frame): Quat => qmul(quatOf(B), qconj(quatOf(A)));

/** Degrees [turn, lean, tilt] of a frame: yaw about up, then pitch about right (+ forward), then roll (+ right). */
export function euler(M: Frame): V3 {
  const [F, , U] = M;
  const yaw = PM.atan2(F[1], F[0]);
  const pitch = PM.asin(Math.max(-1, Math.min(1, -F[2])));
  const cy = PM.cos(yaw);
  const sy = PM.sin(yaw);
  const u1 = [U[0] * cy + U[1] * sy, -U[0] * sy + U[1] * cy, U[2]] as V3;
  const cp = PM.cos(pitch);
  const sp = PM.sin(pitch);
  const u2 = [u1[0] * cp - u1[2] * sp, u1[1], u1[0] * sp + u1[2] * cp] as V3;
  return [yaw / DG, pitch / DG, -PM.atan2(-u2[1], u2[2]) / DG];
}
/** The frame of degrees [turn, lean, tilt]. */
export function fromEuler(a: readonly number[]): Frame {
  const y = a[0]! * DG;
  const p = a[1]! * DG;
  const r = -a[2]! * DG;
  const cy = PM.cos(y);
  const sy = PM.sin(y);
  const cp = PM.cos(p);
  const sp = PM.sin(p);
  const cr = PM.cos(r);
  const sr = PM.sin(r);
  const rot = (v: V3): V3 => {
    let [x, yy, z] = v;
    [yy, z] = [yy * cr - z * sr, yy * sr + z * cr];
    [x, z] = [x * cp + z * sp, -x * sp + z * cp];
    return [x * cy - yy * sy, x * sy + yy * cy, z];
  };
  return [rot([1, 0, 0]), rot([0, 1, 0]), rot([0, 0, 1])];
}
