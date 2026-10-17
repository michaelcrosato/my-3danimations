// Sampling (spec/MOTION.md §6.1): the key pose at time t by straight-line in-betweening (loops wrap, one-shots hold),
// body points at time t, root travel, and sampling a captured clip. Ported from my-3d2dge's readable.js:128-132 and
// :262-275 operation for operation.
import { P, type Rest } from "./body.ts";
import { decodePose, type KeyLike } from "./pose.ts";
import type { Key } from "./types.ts";

/** A clip as sampling needs it: duration, whether it loops, and keys with times (a format-2 Clip is one). */
export interface Timed {
  dur: number;
  loop?: boolean;
  keys: readonly (Key | KeyLike)[];
}

/** A captured clip: n frames of the 36 body points (f, r, z mm, float32) at fps, and root travel per frame or null. */
export interface Capture {
  name: string;
  n: number;
  dur: number;
  loop: boolean;
  fps: number;
  data: Float32Array;
  move: Float32Array | null;
  take?: string;
}

/** The array key fields in-betweening carries, format 1's first, in the reference's order. */
export const FIELDS = ["hips", "body", "chest", "head", "shL", "shR", "armL", "armR", "legL", "legR", "footL", "footR", "blade", "root", "handL", "handR", "fingersL", "fingersR", "spine"] as const;

/** The key pose at time t: every number in-betweened linearly from the keys either side. */
export function keyAt(clip: Timed, t: number): KeyLike {
  const K = clip.keys as readonly KeyLike[];
  const dur = clip.dur || (K[K.length - 1]!.t as number);
  const tt = clip.loop && dur > 0 ? ((t % dur) + dur) % dur : Math.min(Math.max(0, t), dur);
  let i = 0;
  while (i < K.length - 2 && (K[i + 1]!.t as number) <= tt) i++;
  const a = K[i]!;
  const b = K[Math.min(i + 1, K.length - 1)]!;
  const at = a.t as number;
  const bt = b.t as number;
  const u = bt > at ? Math.min(1, Math.max(0, (tt - at) / (bt - at))) : 0;
  const k: KeyLike = {};
  for (const f of FIELDS) {
    const av = a[f] as number[] | undefined;
    if (av) {
      const bv = (b[f] as number[] | undefined) || av;
      if (!Array.isArray(av)) k[f] = (av as number[]).map((v, j) => v + (bv[j]! - v) * u);
      else {
        // v + (bv − v) u for each number, as the map above gives it, in a loop (no closure per field)
        const v: number[] = [];
        for (let j = 0; j < av.length; j++) v.push(av[j]! + (bv[j]! - av[j]!) * u);
        k[f] = v;
      }
    }
  }
  if (typeof a.yaw === "number") k.yaw = a.yaw + ((typeof b.yaw === "number" ? b.yaw : a.yaw) - a.yaw) * u;
  return k;
}

/** Every body point at time t (mm, rig frame) on rest R, into `out`. */
export function pose(R: Rest, clip: Timed, t: number, out: Float32Array = new Float32Array(P * 3)): Float32Array {
  return decodePose(R, keyAt(clip, t), out) as Float32Array;
}

/** How far a travelling clip has carried the body at time t, [forward, right] mm, or null when it doesn't travel. */
export function moveAt(R: Rest, clip: Timed, t: number): [number, number] | null {
  if (!(clip.keys[0] as KeyLike).root) return null;
  const k = keyAt(clip, t);
  const root = k.root as number[];
  return [(root[0]! * R.H0) / 100, (root[1]! * R.H0) / 100];
}

/** A captured clip's body points at time t (frames in-betweened; a loop wraps over its n − 1 intervals). */
export function capSample(c: Capture, t: number, out: Float32Array = new Float32Array(P * 3)): Float32Array {
  const n = c.n;
  const u = Math.max(0, t) * c.fps;
  const f = c.loop ? u % Math.max(1, n - 1) : Math.min(u, n - 1);
  const i0 = Math.floor(f);
  const k = f - i0;
  const a = i0 * P * 3;
  const b = Math.min(n - 1, i0 + 1) * P * 3;
  const D = c.data;
  for (let i = 0; i < P * 3; i++) out[i] = D[a + i]! + (D[b + i]! - D[a + i]!) * k;
  return out;
}
