// Scalar helpers (PLAN.md WP-2.1): clamping, interpolation, angles, a critically damped spring, easing curves and
// lattice noise. Each is my-3d2dge's formula (engine/my-3d2dge.js:74-92), so it gives the reference's bits: the
// frozen vectors in spec/vectors/frozen/core.json (my-3dge tests/baselines/port/core.json) check every one. Easing
// takes its `pow` from a MathLike, portable by default (a hashed path never sees the host's last bit).
import { PORTABLE, type MathLike } from "./portable.ts";

/** A full turn, 2π. */
export const TAU = Math.PI * 2;

/** v held to [a, b]. */
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** The number t of the way from a to b. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** a moved toward b by at most `step` (≥ 0), never past it. */
export const approach = (a: number, b: number, step: number): number => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));

/** The signed angle from a to b the short way round, in [−π, π). */
export const angDiff = (a: number, b: number): number => ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** The angle t of the way from a to b, the short way round. */
export const lerpAng = (a: number, b: number, t: number): number => a + angDiff(a, b) * t;

/** The angle a turned toward b by at most `step` (≥ 0) the short way round; exactly b once within reach. */
export function approachAng(a: number, b: number, step: number): number {
  const d = angDiff(a, b);
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}

/**
 * A critically damped spring toward `target` (Game Programming Gems 4's, as Unity's SmoothDamp): it arrives in about
 * `smoothTime` seconds without overshoot. Returns [value, velocity]; pass the velocity back in on the next step.
 */
export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number): [number, number] {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

/** An easing curve over u in [0, 1]: 0 at 0, 1 at 1. */
export type Ease = (u: number) => number;
/** The easing curves by name. */
export interface Eases {
  outCubic: Ease;
  outQuad: Ease;
  inQuad: Ease;
  inOut: Ease;
  outBack: Ease;
}

/**
 * The easing curves with `M.pow`: `outCubic`, `outQuad`, `inQuad`, `inOut` (quadratic in and out) and `outBack`, which
 * overshoots to about 1.12 near u = 0.55 (c1 = 1.9; easings.net's easeOutBack uses 1.70158).
 */
export function easesWith(M: MathLike): Eases {
  return {
    outCubic: (u) => 1 - M.pow(1 - u, 3),
    outQuad: (u) => 1 - (1 - u) * (1 - u),
    inQuad: (u) => u * u,
    inOut: (u) => (u < 0.5 ? 2 * u * u : 1 - M.pow(-2 * u + 2, 2) / 2),
    outBack: (u) => {
      const c1 = 1.9, c3 = c1 + 1;
      return 1 + c3 * M.pow(u - 1, 3) + c1 * M.pow(u - 1, 2);
    },
  };
}

/** The easing curves, portable. */
export const ease: Eases = easesWith(PORTABLE);

/** An integer hash of a lattice point, in [0, 1); coordinates are taken as int32s. */
export function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Value noise in [0, 1]: `hash2` at the lattice points around (x, y), blended with smoothstep. */
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
