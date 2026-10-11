// 3-vectors (PLAN.md WP-2.1): [x, y, z] as plain arrays, each function writing into `out` and returning it, so hot
// paths allocate nothing. Only `+ - * /` and `sqrt`, so every result is the same in every engine; nothing here needs a
// MathLike.

/** A 3-vector. */
export type Vec3 = [number, number, number];

/** A new vector. */
export const create = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];

/** out set to [x, y, z]. */
export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** out set to a. */
export function copy(out: Vec3, a: Readonly<Vec3>): Vec3 {
  return set(out, a[0], a[1], a[2]);
}

/** a + b. */
export function add(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return set(out, a[0] + b[0], a[1] + b[1], a[2] + b[2]);
}

/** a − b. */
export function sub(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return set(out, a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** a·s. */
export function scale(out: Vec3, a: Readonly<Vec3>, s: number): Vec3 {
  return set(out, a[0] * s, a[1] * s, a[2] * s);
}

/** a + b·s. */
export function addScaled(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>, s: number): Vec3 {
  return set(out, a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s);
}

/** a · b. */
export const dot = (a: Readonly<Vec3>, b: Readonly<Vec3>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** a × b. */
export function cross(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return set(out, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
}

/** |a|², exact. */
export const lengthSq = (a: Readonly<Vec3>): number => dot(a, a);

/** |a|, as sqrt(a · a): exact in every engine (unlike Math.hypot's scaling). */
export const length = (a: Readonly<Vec3>): number => Math.sqrt(dot(a, a));

/** |a − b|. */
export function distance(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return Math.sqrt(x * x + y * y + z * z);
}

/** a scaled to length 1; a zero vector stays zero. */
export function normalize(out: Vec3, a: Readonly<Vec3>): Vec3 {
  const l = length(a);
  return l > 0 ? scale(out, a, 1 / l) : set(out, 0, 0, 0);
}

/** The point t of the way from a to b. */
export function lerp(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>, t: number): Vec3 {
  return set(out, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/** a with its component along the unit vector n removed. */
export function reject(out: Vec3, a: Readonly<Vec3>, n: Readonly<Vec3>): Vec3 {
  return addScaled(out, a, n, -dot(a, n));
}
