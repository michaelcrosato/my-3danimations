// Contacts (PLAN.md WP-2.2; spec/MOTION.md §7.1): which ends are planted at time t, from a clip's labelled or detected
// intervals, and detection with hysteresis from the decoded motion. An end is planted while its lowest point stays near
// the floor (z = 0): it plants when it comes within `enter` of it and lifts when it moves past `exit` (fractions of
// H0; above or below), so a foot that skims the ground doesn't flicker. Contacts shorter than `minFrames` are dropped and gaps shorter
// than `mergeFrames` closed; a loop's contact that runs through the seam becomes one interval past dur (§7.1).
import { IDX, P, type Rest } from "../format/body.ts";
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
  /** The shortest contact kept, in samples (3). */
  minFrames?: number;
  /** The longest gap closed, in samples (2). */
  mergeFrames?: number;
}

/** The poses a measurement reads: n + 1 samples over [0, dur], time step dt. */
export interface Sampled {
  frames: Float32Array[];
  dt: number;
}

/** The clip sampled at about `fps` over its whole duration, both ends included. */
export function sampleAll(clip: Playable, R: Rest, fps = 60): Sampled {
  const n = Math.max(1, Math.ceil(clip.dur * fps)), dt = clip.dur / n;
  const frames: Float32Array[] = [];
  // a loop's last sample is its cycle's end (the last key held or in-between), not the wrap back to its start
  const at = (i: number) => (clip.loop && i === n ? clip.dur * (1 - 1e-12) : i * dt);
  for (let i = 0; i <= n; i++) frames.push(sample(clip, at(i), R, new Float32Array(P * 3)));
  return { frames, dt };
}

/** The lowest height of an end's points in a pose. */
export function endLow(pose: Float32Array, end: End): number {
  let z = Infinity;
  for (const p of END_POINTS[end]) z = Math.min(z, pose[IDX[p]! * 3 + 2]!);
  return z;
}

/** Contact intervals detected from the motion, with hysteresis. Feet are searched always, hands when they reach the ground. */
export function detectContacts(clip: Playable, R: Rest, opts: DetectOptions = {}, sampled: Sampled = sampleAll(clip, R, opts.fps ?? 60)): Contacts {
  const { frames, dt } = sampled;
  const enter = (opts.enter ?? 0.04) * R.H0, exit = (opts.exit ?? 0.07) * R.H0, minF = opts.minFrames ?? 3, mergeF = opts.mergeFrames ?? 2;
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
      planted = planted ? h <= exit : h <= enter;
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
