// Facts measured from the motion (PLAN.md WP-2.2; spec/MOTION.md §7.3): duration and loop seam, travel and speed,
// the hips' height range, strike times and contacts. Facts are never typed by hand: a tool measures them, and QA checks
// a recomputable fact against the motion.
// - seam: a loop's worst body-point distance between its last and first pose (index and pinky left out, as fit does).
// - travel: a clip with root carries its own (the root's place at the end, % of H0, in the start frame). An in-place
//   loop travels as captured: while a foot is planted it slides back under the body at the body's speed, so the body's
//   velocity is the planted feet's contact point's, reversed (the median over every planted sample).
// - speed: a loop's travel per second (% of H0).
// - height: [min, max] of the hips' up over the keys (% of H0); in-betweening is linear, so the keys hold the extremes.
// - strike: for a clip tagged attack (or kick), when the end that moves fastest relative to the pelvis peaks: the fists,
//   a blade's tip when the key holds one (along the knuckle line, one H0 long), and the toes for a kick.
// - contacts: the clip's own when labelled, else detected with hysteresis (contacts.ts).
import { IDX, type Rest } from "../format/body.ts";
import type { Clip, Contacts } from "../format/types.ts";
import { PORTABLE } from "../math/portable.ts";
import { VERSION } from "../version.ts";
import { detectContacts, END_POINTS, sampleAll, type DetectOptions, type End } from "./contacts.ts";
import { rootAt, type Playable } from "./sample.ts";

/** What measureFacts returns: every fact it could measure, and which tool measured them. */
export interface Facts {
  by: string;
  dur: number;
  seam?: number;
  travel?: [number, number];
  speed?: number;
  height: [number, number];
  strike?: number[];
  contacts: Contacts;
}

/** A clip as measureFacts reads it. */
export type Measurable = Playable & Partial<Pick<Clip, "tags" | "contacts">>;

const SEAM_SKIP = new Set(["indexL", "pinkyL", "indexR", "pinkyR"].map((p) => IDX[p]!));
/** x rounded to 1 or 3 decimals. */
const round = (x: number, d: 1 | 3) => (d === 1 ? Math.round(x * 10) / 10 : Math.round(x * 1000) / 1000);
const pt = (o: Float32Array, name: string): [number, number, number] => {
  const i = IDX[name]! * 3;
  return [o[i]!, o[i + 1]!, o[i + 2]!];
};

/**
 * Every fact of `clip` on rest R. Contacts a source labelled are taken as given; contacts a tool detected (a library
 * clip carries them, WP-5.4) are detected again, so the facts read from them are the same with or without them.
 */
export function measureFacts(clip: Measurable, R: Rest, opts: DetectOptions = {}): Facts {
  if (clip.contacts && clip.contacts.by !== "labelled") clip = { ...clip, contacts: undefined };
  const sampled = sampleAll(clip, R, opts.fps ?? 60);
  const { frames, dt } = sampled;
  const n = frames.length - 1;
  const facts: Facts = { by: `m3a-core@${VERSION}`, dur: clip.dur, height: [0, 0], contacts: clip.contacts ?? detectContacts(clip, R, opts, sampled) };
  // detected contacts, refined: a planted foot is still in the world. The root's velocity is the clip's own (root
  // travel) or, in place, the body's as its planted feet show it; detect again with it, and read the speed again.
  const hasRoot = (clip.keys[0] as { root?: unknown }).root !== undefined;
  const firstPass = facts.contacts;
  if (!clip.contacts) {
    const v = hasRoot ? null : plantedVelocity(clip, sampled, facts.contacts);
    const rootV = hasRoot
      ? (i: number): [number, number] => {
          const a = rootAt(clip, Math.max(0, i - 1) * dt), b = rootAt(clip, Math.min(frames.length - 1, i + 1) * dt), k = (R.H0 / 100) / ((Math.min(frames.length - 1, i + 1) - Math.max(0, i - 1)) * dt);
          return [(b.forward - a.forward) * k, (b.right - a.right) * k];
        }
      : v
        ? (): [number, number] => [-v[0], -v[1]]
        : undefined;
    if (rootV) facts.contacts = detectContacts(clip, R, opts, sampled, rootV);
  }
  // the hips' height range
  const ups = clip.keys.map((k) => k.hips[2]!);
  facts.height = [Math.min(...ups), Math.max(...ups)];
  // a loop's seam: its jump from its last pose to its first
  if (clip.loop) {
    let worst = 0;
    const a = frames[n]!, b = frames[0]!;
    for (let i = 0; i < a.length / 3; i++) if (!SEAM_SKIP.has(i)) worst = Math.max(worst, PORTABLE.hypot(a[i * 3]! - b[i * 3]!, a[i * 3 + 1]! - b[i * 3 + 1]!, a[i * 3 + 2]! - b[i * 3 + 2]!));
    facts.seam = round(worst, 1);
  }
  // travel and speed
  if (hasRoot) {
    const r = rootAt(clip, clip.dur);
    facts.travel = [round(r.forward, 1), round(r.right, 1)];
  } else if (clip.loop) {
    // the speed from the first pass's contacts: height alone, the planted foot nearest under the pelvis (D34)
    const v = plantedVelocity(clip, sampled, firstPass);
    if (v) facts.travel = [round((-v[0] * clip.dur * 100) / R.H0, 1), round((-v[1] * clip.dur * 100) / R.H0, 1)];
  }
  if (clip.loop && facts.travel && clip.dur > 0) facts.speed = round(PORTABLE.hypot(facts.travel[0], facts.travel[1]) / clip.dur, 1);
  // strike
  const tags = clip.tags ?? [];
  if (tags.includes("attack") || tags.includes("kick")) facts.strike = [round(strikeTime(clip, R, sampled, tags.includes("kick")), 3)];
  return facts;
}

/**
 * The planted feet's velocity in the pose's frame (mm/s, forward and right): at each sample with a foot down, the
 * lowest point of the planted foot nearest under the pelvis (the one bearing weight; its heel at strike, its toes at
 * push-off), the median
 * over every such sample, so frames where a lifting foot is still low don't count. Null with too little contact.
 */
function plantedVelocity(clip: Playable, { frames, dt }: { frames: Float32Array[]; dt: number }, contacts: Contacts): [number, number] | null {
  const n = frames.length - 1;
  const vf: number[] = [], vr: number[] = [];
  const planted = (end: End, t: number) => (contacts[end] ?? []).some(([a, b]) => (t >= a && t <= b) || (clip.loop && b > clip.dur && t <= b - clip.dur));
  const lowest = (o: Float32Array, end: End): [string, number] => {
    let low = END_POINTS[end][0]!, z = Infinity;
    for (const p of END_POINTS[end]) if (o[IDX[p]! * 3 + 2]! < z) [low, z] = [p, o[IDX[p]! * 3 + 2]!];
    return [low, z];
  };
  for (let i = 1; i < n; i++) {
    const t = i * dt;
    // the weight-bearing foot: of the planted ones, the one nearest under the pelvis (a dragged or reaching foot is off
    // to the side or ahead)
    let best: string | null = null, bd = Infinity;
    const pel = pt(frames[i]!, "pelvis");
    for (const end of ["footL", "footR"] as End[]) {
      if (!planted(end, t)) continue;
      const [p] = lowest(frames[i]!, end), q = pt(frames[i]!, p), d = PORTABLE.hypot(q[0] - pel[0], q[1] - pel[1]);
      if (d < bd) [best, bd] = [p, d];
    }
    if (!best) continue;
    const a = pt(frames[i - 1]!, best), b = pt(frames[i + 1]!, best);
    vf.push((b[0] - a[0]) / (2 * dt));
    vr.push((b[1] - a[1]) / (2 * dt));
  }
  return vf.length >= 0.2 * n ? [median(vf), median(vr)] : null;
}

/** The median of a non-empty list. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** When the attacking end moves fastest relative to the pelvis (seconds). */
function strikeTime(clip: Playable, R: Rest, { frames, dt }: { frames: Float32Array[]; dt: number }, kick: boolean): number {
  const n = frames.length - 1;
  const blade = (clip.keys[0] as { blade?: unknown }).blade !== undefined;
  const end = (o: Float32Array, which: string): [number, number, number] => {
    const p = pt(o, which);
    if (blade && which === "fistR") {
      const d = [o[IDX.indexR! * 3]! - o[IDX.pinkyR! * 3]!, o[IDX.indexR! * 3 + 1]! - o[IDX.pinkyR! * 3 + 1]!, o[IDX.indexR! * 3 + 2]! - o[IDX.pinkyR! * 3 + 2]!];
      const l = PORTABLE.hypot(d[0]!, d[1]!, d[2]!) || 1;
      return [p[0] + (d[0]! / l) * R.H0, p[1] + (d[1]! / l) * R.H0, p[2] + (d[2]! / l) * R.H0];
    }
    return p;
  };
  const rel = (i: number, which: string) => {
    const e = end(frames[i]!, which), pel = pt(frames[i]!, "pelvis");
    return [e[0] - pel[0], e[1] - pel[1], e[2] - pel[2]];
  };
  let best = -1, at = 0;
  for (const which of kick ? ["fistL", "fistR", "toeL", "toeR"] : ["fistL", "fistR"]) {
    for (let i = 0; i <= n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1), a = rel(i0, which), b = rel(i1, which);
      const v = PORTABLE.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!) / ((i1 - i0) * dt);
      if (v > best) {
        best = v;
        at = i * dt;
      }
    }
  }
  return at;
}
