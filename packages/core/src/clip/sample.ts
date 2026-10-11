// Sampling a clip (PLAN.md WP-2.2; spec/MOTION.md §6.1): body points at time t on a rest body, the key numbers at time
// t, and the root's travel and heading, loop-aware. Every number in-betweens linearly between the keys either side;
// a loop wraps, a one-shot holds its ends. Stored angles unwrap (§6.3), so linear in-betweening is continuous: a turn
// through ±180 never jumps. Root motion composes over loop cycles, so a turning walk keeps turning and `rootDelta`
// across a seam carries both the travel and the turn.
import { pose } from "../format/sample.ts";
import { P, type Rest } from "../format/body.ts";
import type { KeyLike } from "../format/pose.ts";
import type { Clip } from "../format/types.ts";
import { PORTABLE } from "../math/portable.ts";

/** A clip as sampling reads it: the format-2 fields it needs. */
export type Playable = Pick<Clip, "dur" | "loop" | "keys">;

/** Every body point at time t (mm, rig frame: forward, right, up) on rest R, into `out`. */
export function sample(clip: Playable, t: number, R: Rest, out: Float32Array = new Float32Array(P * 3)): Float32Array {
  return pose(R, clip, t, out);
}

/** The value of one array field at clip time u in [0, dur], in-betweened, without wrapping (the end of a loop's cycle). */
function fieldAt(clip: Playable, name: string, u: number): number[] | null {
  const K = clip.keys as unknown as KeyLike[];
  const at = (k: KeyLike) => k[name] as number[] | number | undefined;
  if (at(K[0]!) === undefined) return null;
  let i = 0;
  while (i < K.length - 2 && (K[i + 1]!.t as number) <= u) i++;
  const a = K[i]!, b = K[Math.min(i + 1, K.length - 1)]!;
  const ta = a.t as number, tb = b.t as number;
  const w = tb > ta ? Math.min(1, Math.max(0, (u - ta) / (tb - ta))) : 0;
  const va = at(a)!, vb = at(b) ?? va;
  if (typeof va === "number") return [va + ((vb as number) - va) * w];
  return va.map((v, j) => v + ((vb as number[])[j]! - v) * w);
}

/** The root's place and heading: forward and right in % of H0 and the heading in degrees (+ toward the right). */
export interface RootPose {
  forward: number;
  right: number;
  yaw: number;
}

const DEG = Math.PI / 180;
/** a then b: b's travel turned by a's heading, headings added (the format's frame: turning right takes forward toward right). */
function compose(a: RootPose, b: RootPose): RootPose {
  const c = PORTABLE.cos(a.yaw * DEG), s = PORTABLE.sin(a.yaw * DEG);
  return { forward: a.forward + b.forward * c - b.right * s, right: a.right + b.forward * s + b.right * c, yaw: a.yaw + b.yaw };
}
/** The inverse of a root pose. */
function invert(a: RootPose): RootPose {
  const c = PORTABLE.cos(a.yaw * DEG), s = PORTABLE.sin(a.yaw * DEG);
  return { forward: -(a.forward * c + a.right * s), right: -(-a.forward * s + a.right * c), yaw: -a.yaw };
}
/** The root at clip time u in [0, dur], relative to where it was at the clip's start. */
function rootRel(clip: Playable, u: number): RootPose {
  const r0 = fieldAt(clip, "root", 0), y0 = fieldAt(clip, "yaw", 0);
  const r = fieldAt(clip, "root", u), y = fieldAt(clip, "yaw", u);
  // root is already in the start frame; yaw too: subtract the start values
  const start: RootPose = { forward: r0?.[0] ?? 0, right: r0?.[1] ?? 0, yaw: y0?.[0] ?? 0 };
  const now: RootPose = { forward: r?.[0] ?? 0, right: r?.[1] ?? 0, yaw: y?.[0] ?? 0 };
  const d = { forward: now.forward - start.forward, right: now.right - start.right };
  // express the travel since the start in the start heading's frame
  const c = PORTABLE.cos(start.yaw * DEG), s = PORTABLE.sin(start.yaw * DEG);
  return { forward: d.forward * c + d.right * s, right: -d.forward * s + d.right * c, yaw: now.yaw - start.yaw };
}

/**
 * The root at time t relative to the clip's start: a one-shot holds its ends; a loop repeats its cycle, each cycle
 * starting where and facing how the last one ended, so t may run past dur (or below 0) for as long as the clip plays.
 */
export function rootAt(clip: Playable, t: number): RootPose {
  const dur = clip.dur;
  if (!clip.loop || !(dur > 0)) return rootRel(clip, Math.min(Math.max(0, t), dur));
  const k = Math.floor(t / dur), u = t - k * dur;
  const cycle = rootRel(clip, dur);
  let acc: RootPose = { forward: 0, right: 0, yaw: 0 };
  const step = k >= 0 ? cycle : invert(cycle);
  for (let i = 0; i < Math.abs(k); i++) acc = compose(acc, step);
  return compose(acc, rootRel(clip, u));
}

/**
 * How the root moves from time t0 to t1, in the frame the root has at t0: forward and right in % of H0 (× H0 / 100
 * for millimetres) and the turn in degrees. Across a loop's seam it carries the cycle's travel and turn on.
 */
export function rootDelta(clip: Playable, t0: number, t1: number): RootPose {
  return compose(invert(rootAt(clip, t0)), rootAt(clip, t1));
}
