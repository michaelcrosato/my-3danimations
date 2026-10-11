// Quaternions (PLAN.md WP-2.1): [x, y, z, w], unit for rotations, Hamilton's product (a·b turns by b, then a), each
// function writing into `out`. The functions that need sin, cos or atan2 take a MathLike, portable by default, so a
// hashed path gives the same bits in every engine; presentation may pass NATIVE.
import { PORTABLE, type MathLike } from "./portable.ts";
import type { Vec3 } from "./vec3.ts";

/** A quaternion [x, y, z, w]. */
export type Quat = [number, number, number, number];

/** The identity rotation. */
export const identity = (): Quat => [0, 0, 0, 1];

/** out set to [x, y, z, w]. */
export function set(out: Quat, x: number, y: number, z: number, w: number): Quat {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}

/** out set to q. */
export function copy(out: Quat, q: Readonly<Quat>): Quat {
  return set(out, q[0], q[1], q[2], q[3]);
}

/** A turn of `angle` radians about the unit vector `axis`. */
export function fromAxisAngle(out: Quat, axis: Readonly<Vec3>, angle: number, M: MathLike = PORTABLE): Quat {
  const s = M.sin(angle / 2);
  return set(out, axis[0] * s, axis[1] * s, axis[2] * s, M.cos(angle / 2));
}

/** a·b: the rotation b, then a. */
export function multiply(out: Quat, a: Readonly<Quat>, b: Readonly<Quat>): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return set(out, aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz);
}

/** The inverse of a unit quaternion. */
export function conjugate(out: Quat, q: Readonly<Quat>): Quat {
  return set(out, -q[0], -q[1], -q[2], q[3]);
}

/** The 4D dot product: cos of half the angle between two unit rotations. */
export const dot = (a: Readonly<Quat>, b: Readonly<Quat>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

/** q scaled to length 1; a zero quaternion becomes the identity. */
export function normalize(out: Quat, q: Readonly<Quat>): Quat {
  const l = Math.sqrt(dot(q, q));
  return l > 0 ? set(out, q[0] / l, q[1] / l, q[2] / l, q[3] / l) : set(out, 0, 0, 0, 1);
}

/** v turned by the unit quaternion q (v + 2w(u × v) + 2u × (u × v)). */
export function rotate(out: Vec3, q: Readonly<Quat>, v: Readonly<Vec3>): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  out[0] = v[0] + w * tx + (y * tz - z * ty);
  out[1] = v[1] + w * ty + (z * tx - x * tz);
  out[2] = v[2] + w * tz + (x * ty - y * tx);
  return out;
}

/** The shortest rotation turning the unit vector a onto the unit vector b (half-way vector; no trig). */
export function fromUnitVectors(out: Quat, a: Readonly<Vec3>, b: Readonly<Vec3>): Quat {
  const r = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + 1;
  if (r < 1e-12) {
    // opposite: half a turn about any axis perpendicular to a
    return Math.abs(a[0]) > Math.abs(a[2]) ? normalize(out, [-a[1], a[0], 0, 0]) : normalize(out, [0, -a[2], a[1], 0]);
  }
  return normalize(out, [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], r]);
}

/** The rotation t of the way from a to b, the short way round, at constant speed; near-equal ends blend linearly. */
export function slerp(out: Quat, a: Readonly<Quat>, b: Readonly<Quat>, t: number, M: MathLike = PORTABLE): Quat {
  let c = dot(a, b), bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (c < 0) {
    c = -c;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let ka = 1 - t, kb = t;
  if (c < 0.9995) {
    const th = M.acos(c), s = M.sin(th);
    ka = M.sin((1 - t) * th) / s;
    kb = M.sin(t * th) / s;
  }
  return normalize(out, [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb]);
}

/** The angle of a unit quaternion's rotation, radians in [0, π]. */
export function angle(q: Readonly<Quat>, M: MathLike = PORTABLE): number {
  return 2 * M.atan2(Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]), Math.abs(q[3]));
}

/**
 * Splits the unit rotation q into a twist about the unit vector `axis` and a swing about an axis perpendicular to it,
 * q = swing·twist (the twist first): a joint's roll and its bend. Returns the twist angle in (−π, π]; when q turns
 * `axis` half a turn the twist is undefined and taken as none.
 */
export function swingTwist(q: Readonly<Quat>, axis: Readonly<Vec3>, swing: Quat, twist: Quat, M: MathLike = PORTABLE): number {
  const d = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2];
  set(twist, axis[0] * d, axis[1] * d, axis[2] * d, q[3]);
  if (dot(twist, twist) < 1e-24) set(twist, 0, 0, 0, 1);
  else normalize(twist, twist);
  multiply(swing, q, [-twist[0], -twist[1], -twist[2], twist[3]]);
  const a = 2 * M.atan2(twist[0] * axis[0] + twist[1] * axis[1] + twist[2] * axis[2], twist[3]);
  return a > Math.PI ? a - 2 * Math.PI : a <= -Math.PI ? a + 2 * Math.PI : a;
}
