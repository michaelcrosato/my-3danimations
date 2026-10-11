// 4×4 matrices (PLAN.md WP-2.1): column-major, as glTF and three.js store them (element [c·4 + r]), each function
// writing into `out`. Only `+ - * /`, so the same in every engine. A transform is translation · rotation · scale.
import type { Quat } from "./quat.ts";
import type { Vec3 } from "./vec3.ts";

/** A 4×4 matrix, 16 numbers column by column. */
export type Mat4 = number[];

/** The identity matrix. */
export const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** a·b: b's transform, then a's. */
export function multiply(out: Mat4, a: Readonly<Mat4>, b: Readonly<Mat4>): Mat4 {
  const r = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < 4; i++) r[c * 4 + i] = a[i]! * b[c * 4]! + a[4 + i]! * b[c * 4 + 1]! + a[8 + i]! * b[c * 4 + 2]! + a[12 + i]! * b[c * 4 + 3]!;
  }
  for (let i = 0; i < 16; i++) out[i] = r[i]!;
  return out;
}

/** The transform that scales by s, turns by the unit quaternion q, then moves by t. */
export function compose(out: Mat4, t: Readonly<Vec3>, q: Readonly<Quat>, s: Readonly<Vec3> = [1, 1, 1]): Mat4 {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  const v = [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
  for (let i = 0; i < 16; i++) out[i] = v[i]!;
  return out;
}

/** The inverse of m, or null when m is singular. */
export function invert(out: Mat4, m: Readonly<Mat4>): Mat4 | null {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m as number[] as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const k = 1 / det;
  const v = [
    (a11 * b11 - a12 * b10 + a13 * b09) * k, (a02 * b10 - a01 * b11 - a03 * b09) * k, (a31 * b05 - a32 * b04 + a33 * b03) * k, (a22 * b04 - a21 * b05 - a23 * b03) * k,
    (a12 * b08 - a10 * b11 - a13 * b07) * k, (a00 * b11 - a02 * b08 + a03 * b07) * k, (a32 * b02 - a30 * b05 - a33 * b01) * k, (a20 * b05 - a22 * b02 + a23 * b01) * k,
    (a10 * b10 - a11 * b08 + a13 * b06) * k, (a01 * b08 - a00 * b10 - a03 * b06) * k, (a30 * b04 - a31 * b02 + a33 * b00) * k, (a21 * b02 - a20 * b04 - a23 * b00) * k,
    (a11 * b07 - a10 * b09 - a12 * b06) * k, (a00 * b09 - a01 * b07 + a02 * b06) * k, (a31 * b01 - a30 * b03 - a32 * b00) * k, (a20 * b03 - a21 * b01 + a22 * b00) * k,
  ];
  for (let i = 0; i < 16; i++) out[i] = v[i]!;
  return out;
}

/** The point p transformed by m (w taken as 1). */
export function transformPoint(out: Vec3, m: Readonly<Mat4>, p: Readonly<Vec3>): Vec3 {
  const [x, y, z] = p;
  out[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  out[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  out[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  return out;
}

/** The direction d transformed by m (w taken as 0: no translation). */
export function transformDirection(out: Vec3, m: Readonly<Mat4>, d: Readonly<Vec3>): Vec3 {
  const [x, y, z] = d;
  out[0] = m[0]! * x + m[4]! * y + m[8]! * z;
  out[1] = m[1]! * x + m[5]! * y + m[9]! * z;
  out[2] = m[2]! * x + m[6]! * y + m[10]! * z;
  return out;
}
