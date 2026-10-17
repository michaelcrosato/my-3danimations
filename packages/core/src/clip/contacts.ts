// Contacts (PLAN.md WP-2.2; spec/MOTION.md §7.1): which ends are planted at time t, from a clip's labelled or detected
// intervals, and detection with hysteresis from the decoded motion. An end is planted while its lowest point stays near
// the floor (z = 0): it plants when it comes within `enter` of it and lifts when it moves past `exit` (fractions of
// H0; above or below), so a foot that skims the ground doesn't flicker. Contacts shorter than `minTime` are dropped and
// gaps up to `mergeTime` closed; a loop's contact that runs through the seam becomes one interval past dur (§7.1).
import { PORTABLE } from "../math/portable.ts";
import { IDX, P, type Rest } from "../format/body.ts";
import { decodeLegs, decodePose } from "../format/pose.ts";
import { keyAt } from "../format/sample.ts";
import { CONTACT_ENDS, type Contacts } from "../format/types.ts";
import { sample, type Playable } from "./sample.ts";

/** An end that can plant: a foot or a hand. */
export type End = (typeof CONTACT_ENDS)[number];

/** The body points whose lowest marks where an end touches the ground. */
export const END_POINTS: Readonly<Record<End, readonly string[]>> = {
  footL: ["ankleL", "ballL", "toeL"],
  footR: ["ankleR", "ballR", "toeR"],
  handL: ["wristL", "knuckL", "fistL"],
  handR: ["wristR", "knuckR", "fistR"],
};

/** Whether each end is planted at time t (a loop wraps; an interval past dur continues from 0). */
export function contactsAt(clip: Playable & { contacts?: Contacts }, t: number): Record<End, boolean> {
  const out = { footL: false, footR: false, handL: false, handR: false };
  const c = clip.contacts;
  if (!c) return out;
  const dur = clip.dur;
  const u = clip.loop && dur > 0 ? ((t % dur) + dur) % dur : Math.min(Math.max(0, t), dur);
  for (const end of CONTACT_ENDS) out[end] = (c[end] ?? []).some(([a, b]) => (u >= a && u <= b) || (clip.loop && b > dur && u <= b - dur));
  return out;
}

/** How contact detection reads the motion. */
export interface DetectOptions {
  /** Samples per second (60). */
  fps?: number;
  /** An end plants within this height of the ground, as a fraction of H0 (0.04). */
  enter?: number;
  /** And lifts past this one (0.07). */
  exit?: number;
  /** The shortest contact kept, in seconds (0.05). */
  minTime?: number;
  /** The longest gap closed, in seconds (0.1: a foot rolling off its heel onto its toes is one contact). */
  mergeTime?: number;
  /** A planted end moves slower than this in the world, as a fraction of H0 per second (0.3, and at most half the body's
   *  speed); it lifts past twice it. */
  still?: number;
}

/** The poses a measurement reads: n + 1 samples over [0, dur], time step dt. */
export interface Sampled {
  frames: Float32Array[];
  dt: number;
}

/** The clip sampled at about `fps` over its whole duration, both ends included. */
export function sampleAll(clip: Playable, R: Rest, fps = 60): Sampled {
  return sampledBy(clip, fps, (t) => sample(clip, t, R, new Float32Array(P * 3)));
}
/** sampleAll's samples with the pelvis's and the legs' points alone (decodeLegs: as decodePose puts them; the others 0),
 *  for a reader of the feet alone (contactRoot). */
export function sampleLegs(clip: Playable, R: Rest, fps = 60): Sampled {
  return sampledBy(clip, fps, (t) => decodeLegs(R, keyAt(clip, t), new Float32Array(P * 3)) as Float32Array);
}
/** sampleAll's and sampleLegs's grid at about `fps` over `dur`: n + 1 sample times, dt apart (n at least 1; NaN for
 *  a NaN duration: no samples). */
export function sampleGrid(dur: number, fps: number): { n: number; dt: number } {
  const n = Math.max(1, Math.ceil(dur * fps));
  return { n, dt: dur / n };
}
/** The clip's sample times at about `fps` over its whole duration, both ends included, each posed by `pose`. */
function sampledBy(clip: Playable, fps: number, pose: (t: number) => Float32Array): Sampled {
  const { n, dt } = sampleGrid(clip.dur, fps);
  const frames: Float32Array[] = [];
  // a loop's last sample is its cycle's end (the last key held or in-between), not the wrap back to its start
  const at = (i: number) => (clip.loop && i === n ? clip.dur * (1 - 1e-12) : i * dt);
  for (let i = 0; i <= n; i++) frames.push(pose(at(i)));
  return { frames, dt };
}

/** The lowest height of an end's points in a pose. */
export function endLow(pose: Float32Array, end: End): number {
  let z = Infinity;
  for (const p of END_POINTS[end]) z = Math.min(z, pose[IDX[p]! * 3 + 2]!);
  return z;
}

const restFoot = new WeakMap<Rest, { f: [number, number, number]; heel: [number, number, number] }>();
/** The rest's standing foot: the ankle-to-ball direction, and the heel's sole point from the ankle (ankleZ straight down). */
function standingFoot(R: Rest) {
  let s = restFoot.get(R);
  if (!s) {
    const key = { t: 0, hips: [0, 0, 100], body: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 0, -100, 0, 0], armR: [0, 0, -100, 0, 0], legL: [0, 0, -100, 0, 0], legR: [0, 0, -100, 0, 0] };
    const X = decodePose(R, key as never, new Float32Array(P * 3) as unknown as number[]), a = pt3(X, "ankleL"), b = pt3(X, "ballL");
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n = PORTABLE.hypot(d[0]!, d[1]!, d[2]!);
    restFoot.set(R, (s = { f: [d[0]! / n, d[1]! / n, d[2]! / n], heel: [0, 0, -R.ankleZ] }));
  }
  return s;
}
const pt3 = (X: ArrayLike<number>, n: string): [number, number, number] => {
  const i = IDX[n]! * 3;
  return [X[i]!, X[i + 1]!, X[i + 2]!];
};
/** v turned by the rotation that takes unit a to unit b (about their common perpendicular). */
function turn(v: readonly number[], a: readonly number[], b: readonly number[]): [number, number, number] {
  const ax = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!], s = PORTABLE.hypot(ax[0]!, ax[1]!, ax[2]!), c = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  // a and b opposite: half a turn about the side axis (the rest foot's direction lies in the forward-up plane)
  if (s < 1e-9) return c > 0 ? [v[0]!, v[1]!, v[2]!] : [-v[0]!, v[1]!, -v[2]!];
  const k = ax.map((x) => x / s), kv = k[0]! * v[0]! + k[1]! * v[1]! + k[2]! * v[2]!, kx = [k[1]! * v[2]! - k[2]! * v[1]!, k[2]! * v[0]! - k[0]! * v[2]!, k[0]! * v[1]! - k[1]! * v[0]!];
  return [0, 1, 2].map((i) => v[i]! * c + kx[i]! * s + k[i]! * kv * (1 - c)) as [number, number, number];
}
/**
 * A foot's sole points in a pose on rest R: the heel (the standing rest's sole under the ankle, turned with the foot:
 * the ankle-to-ball direction's turn from standing, so a foot pointing up when lying on the back has its heel behind
 * the ankle, not under it), the ball and the toe. The sensors read a foot by them.
 */
export function sole(R: Rest, X: ArrayLike<number>, s: "L" | "R"): { name: string; p: [number, number, number] }[] {
  const ank = pt3(X, "ankle" + s), ball = pt3(X, "ball" + s), toe = pt3(X, "toe" + s), rest = standingFoot(R);
  const d = [ball[0] - ank[0], ball[1] - ank[1], ball[2] - ank[2]], n = PORTABLE.hypot(d[0]!, d[1]!, d[2]!);
  const h = n > 1e-6 ? turn(rest.heel, rest.f, d.map((x) => x / n)) : rest.heel;
  return [{ name: "heel", p: [ank[0] + h[0], ank[1] + h[1], ank[2] + h[2]] }, { name: "ball", p: ball }, { name: "toe", p: toe }];
}

/** The lowest point of an end in a pose: its name and height. */
function lowest(pose: Float32Array, end: End): string {
  let best = END_POINTS[end][0]!, z = Infinity;
  for (const p of END_POINTS[end]) if (pose[IDX[p]! * 3 + 2]! < z) [best, z] = [p, pose[IDX[p]! * 3 + 2]!];
  return best;
}

/**
 * Contact intervals detected from the motion, with hysteresis. An end is planted while its lowest point stays near the
 * floor; given the root's velocity (mm/s in the pose's frame, per sample), also only while that point is still in the
 * world: an in-place walk's planted foot slides back at the body's speed, a swinging one skims forward. Feet are
 * searched always, hands when they reach the ground.
 */
export function detectContacts(clip: Playable, R: Rest, opts: DetectOptions = {}, sampled: Sampled = sampleAll(clip, R, opts.fps ?? 60), rootVelocity?: (i: number) => [number, number]): Contacts {
  const { frames, dt } = sampled;
  const enter = (opts.enter ?? 0.04) * R.H0, exit = (opts.exit ?? 0.07) * R.H0;
  const minF = Math.max(1, Math.round((opts.minTime ?? 0.05) / dt)), mergeF = Math.round((opts.mergeTime ?? 0.1) / dt);
  // still: slower than the given fraction of H0 per second, and than half the body's own speed (a shuffle's sliding
  // foot moves with the body), but never asked to be slower than 0.05 H0/s (an idle's noise)
  let still = (opts.still ?? 0.3) * R.H0;
  if (rootVelocity) {
    let sum = 0;
    for (let i = 0; i < frames.length; i++) sum += PORTABLE.hypot(...rootVelocity(i));
    still = Math.max(0.05 * R.H0, Math.min(still, 0.5 * (sum / frames.length)));
  }
  /** The world speed of an end's lowest point at sample i (mm/s), or 0 without a root velocity. */
  const speed = (end: End, i: number) => {
    if (!rootVelocity) return 0;
    const n = frames.length - 1, p = lowest(frames[i]!, end), i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1);
    const a = frames[i0]!, b = frames[i1]!, j = IDX[p]! * 3, v = rootVelocity(i);
    return PORTABLE.hypot((b[j]! - a[j]!) / ((i1 - i0) * dt) + v[0], (b[j + 1]! - a[j + 1]!) / ((i1 - i0) * dt) + v[1]);
  };
  const n = frames.length - 1;
  // the format's floor is z = 0 (spec/MOTION.md §2); a toe that dips through it mid-swing must not move it
  const ground = 0;
  const out: Contacts = { by: "detected" };
  const ms = (x: number) => Math.round(x * 1000) / 1000;
  for (const end of CONTACT_ENDS) {
    const on: boolean[] = [];
    let planted = false;
    for (let i = 0; i <= n; i++) {
      // within the band about the floor: an end far under it (a swim, a dive) isn't standing on it
      const h = Math.abs(endLow(frames[i]!, end) - ground);
      planted = planted ? h <= exit && speed(end, i) <= 2 * still : h <= enter && speed(end, i) <= still;
      on.push(planted);
    }
    // runs of planted samples, gaps closed, short runs dropped
    let runs: [number, number][] = [];
    for (let i = 0; i <= n; i++) if (on[i] && (i === 0 || !on[i - 1])) runs.push([i, i]);
    else if (on[i]) runs[runs.length - 1]![1] = i;
    const merged: [number, number][] = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] - 1 <= mergeF) last[1] = r[1];
      else merged.push([...r]);
    }
    runs = merged.filter(([a, b]) => b - a + 1 >= minF);
    if (!runs.length) continue;
    let iv: [number, number][] = runs.map(([a, b]) => [ms(a * dt), ms(b * dt)]);
    // a loop's contact through the seam: the last interval runs on past dur into the first
    if (clip.loop && iv.length > 1 && runs[0]![0] === 0 && runs[runs.length - 1]![1] === n) {
      const first = iv.shift()!;
      iv[iv.length - 1] = [iv[iv.length - 1]![0], ms(clip.dur + first[1])];
    }
    iv = iv.filter(([a, b]) => b > a);
    if (iv.length) out[end] = iv;
  }
  return out;
}
