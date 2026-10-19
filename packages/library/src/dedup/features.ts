// A clip's motion as dedup reads it (PLAN.md WP-9.3): its 36 body points (spec/MOTION.md §3.1) decoded on the clip's
// own rest at RATE samples a second, each pose centred on the pelvis over the floor and scaled to a body HIP mm at the
// hips (H0), so clips on two rests compare in one unit; and the poses of the clip mirrored (core's `format.mirror` of
// its keys, decoded on the same rest), so a mirrored copy reads as its original even on a rest whose sides differ (a
// capture's shoulders seldom match). The index's prefilter reads the poses' mean and how far they move about it, both
// over time and along the path they trace (the same however the clip is timed: an eased copy dwells at its ends, but a
// capture's jitter lengthens the path where it holds still, so neither alone bounds the distance).
import { format, type Clip, type Rest } from "@m3a/core";

/** Poses sampled a second. */
export const RATE = 15;
/** The fewest and most poses sampled over a clip (a 0.2 s clip still has a shape; a 12 s one stays cheap). */
export const FRAMES: readonly [number, number] = [16, 160];
/** The hip height (mm) every clip is scaled to, as the census's (tools/qa/census.ts). */
export const HIP = 950;
/** The numbers in a pose: 36 points, x (forward) y (right) z (up). */
export const N = format.P * 3;

/** A clip's motion as dedup compares it. */
export interface MotionFeatures {
  id: string;
  skeleton: string;
  dur: number;
  loop: boolean;
  /** The poses sampled (a loop's over one cycle, its seam not repeated; a once clip's from its start to its end). */
  n: number;
  /** n poses of N numbers, mm on a HIP mm body. */
  frames: Float32Array;
  /** The poses of the clip mirrored. */
  mirror: Float32Array;
  /** The poses' mean over time, and the mirrored clip's. */
  mean: Float32Array;
  meanMirror: Float32Array;
  /** How far the poses lie from their mean over time, mm a point on average: how much the clip moves. */
  spread: number;
  /** The poses' mean along the path they trace (their mean over time when they hold still), and the mirrored clip's. */
  centre: Float32Array;
  centreMirror: Float32Array;
  /** How far the poses lie from that mean along their path, mm a point on average. */
  pathSpread: number;
}

/** The mean distance between two poses (mm a point): pose `i` of `a` and pose `j` of `b`. */
export function poseDistance(a: Float32Array, i: number, b: Float32Array, j: number): number {
  let s = 0;
  for (let o = i * N, q = j * N, e = o + N; o < e; o += 3, q += 3) {
    const dx = a[o]! - b[q]!, dy = a[o + 1]! - b[q + 1]!, dz = a[o + 2]! - b[q + 2]!;
    s += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return s / format.P;
}

/** How many poses a clip of `dur` seconds is sampled at. */
export const framesFor = (dur: number): number => Math.min(FRAMES[1], Math.max(FRAMES[0], Math.round(dur * RATE) + 1));

const PELVIS = format.IDX.pelvis! * 3;
/** A clip's poses at n times into `out`, centred on the pelvis and scaled. */
function sample(rest: Rest, clip: format.Timed, n: number, out: Float32Array): void {
  const Y = new Float32Array(N), k = HIP / rest.H0, dur = clip.dur as number;
  for (let i = 0; i < n; i++) {
    format.pose(rest, clip, clip.loop ? (dur * i) / n : (dur * i) / Math.max(1, n - 1), Y);
    const x0 = Y[PELVIS]!, y0 = Y[PELVIS + 1]!;
    for (let p = 0; p < N; p += 3) {
      out[i * N + p] = (Y[p]! - x0) * k;
      out[i * N + p + 1] = (Y[p + 1]! - y0) * k;
      out[i * N + p + 2] = Y[p + 2]! * k;
    }
  }
}

/** The poses' mean and how far they lie from it, each pose weighed alike (`path` false) or along the path they trace
 *  (each weighs half of each step it ends, a step by its length, a loop's seam a step too; alike when they hold still). */
function centreOf(f: Float32Array, n: number, loop: boolean, path: boolean): { centre: Float32Array; spread: number } {
  const steps = loop ? n : n - 1, len = new Float64Array(steps), w = new Float64Array(n).fill(1 / n), sum = new Float64Array(N);
  let total = 0;
  for (let i = 0; i < steps; i++) total += len[i] = poseDistance(f, i, f, (i + 1) % n);
  if (path && total > 1e-6) {
    w.fill(0);
    for (let i = 0; i < steps; i++) {
      w[i]! += len[i]! / total / 2;
      w[(i + 1) % n]! += len[i]! / total / 2;
    }
  }
  for (let i = 0; i < n; i++) for (let o = 0; o < N; o++) sum[o]! += w[i]! * f[i * N + o]!;
  const centre = Float32Array.from(sum);
  let spread = 0;
  for (let i = 0; i < n; i++) spread += w[i]! * poseDistance(f, i, centre, 0);
  return { centre, spread };
}

/** A clip's motion features, decoded on its rest `rest` (the rest of its set's source its `restSrc` names). */
export function motionFeatures(clip: Pick<Clip, "id" | "skeleton" | "dur" | "loop" | "keys">, rest: Rest): MotionFeatures {
  const n = framesFor(clip.dur), frames = new Float32Array(n * N), mirror = new Float32Array(n * N);
  const timed = { dur: clip.dur, loop: clip.loop, keys: clip.keys as format.KeyLike[] };
  sample(rest, timed, n, frames);
  sample(rest, { ...timed, keys: format.mirror({ keys: timed.keys }).keys }, n, mirror);
  const t = centreOf(frames, n, clip.loop, false), p = centreOf(frames, n, clip.loop, true);
  const mean = { id: clip.id, skeleton: clip.skeleton, dur: clip.dur, loop: clip.loop, n, frames, mirror, mean: t.centre, meanMirror: centreOf(mirror, n, clip.loop, false).centre, spread: t.spread };
  return { ...mean, centre: p.centre, centreMirror: centreOf(mirror, n, clip.loop, true).centre, pathSpread: p.spread };
}
