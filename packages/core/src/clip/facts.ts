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
// - contacts: the clip's own when labelled, else detected with hysteresis (contacts.ts), then refined by the world:
//   a planted foot is still. Where that finds nothing on a loop no tag puts off its feet (OFF_FEET), three fallbacks
//   read it again (D104, narrowed by D108, and D122): by the whole sole, the heel too, when no foot plants at all (a
//   body on its heels, toes raised); in place, with "still" at half the body's speed when the refinement erased every
//   contact, or left one foot alone down under a fifth of the loop after a height pass that held both feet down
//   throughout (`reread`, D127), kept only when both feet plant for a fifth of the loop (`stands`) and, in D127's case,
//   the planter holds them (`holds`); and in place, when those leave none, by the whole sole again, refined (`bySole`:
//   a run on its heels), kept only when it stands, the travel read from it. A one-shot, a clip with a root of its own
//   (its velocity is exact) and a loop whose feet never hold still keep the strict reading: none, which plays still,
//   where a looser one gives contacts the planter can't hold. Named readings (`readContacts`, CONTACT_READINGS, D129):
//   the six these take, and six more of the same parts the chain never takes (a quarter of the body's speed as "still",
//   or the lower foot's velocity under the refinement's own "still": D122 weighed them), for a writer that records
//   which one a loop's contacts are.
import { IDX, type Rest } from "../format/body.ts";
import { decodePose } from "../format/pose.ts";
import { keyAt } from "../format/sample.ts";
import { CONTACT_ENDS, type Clip, type Contacts } from "../format/types.ts";
import { plant, type Motion } from "../contact/plant.ts";
import { contactRoot } from "../contact/root.ts";
import { PORTABLE } from "../math/portable.ts";
import { VERSION } from "../version.ts";
import { contactsAt, detectContacts, endLow as endLowOf, END_POINTS, sampleAll, sampleGrid, type DetectOptions, type End, type Sampled } from "./contacts.ts";
import { rootAt, type Playable } from "./sample.ts";

/** Tags that put a clip off its feet (in the air, in water, on a wall, lying or sitting): its detected contacts are
 *  what the strict reading finds, none when its feet never stand (measureFacts' fallbacks skip it, as they skip a
 *  one-shot). */
export const OFF_FEET = ["air", "fly", "swim", "climb", "lie", "sit"] as const;
/** Whether any end has a contact. */
const anyContact = (c: Contacts) => CONTACT_ENDS.some((e) => (c[e]?.length ?? 0) > 0);

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
 * Every fact of `clip` on rest R. Labelled contacts (a person's or a source's, or a named reading's, `readContacts`:
 * spec/MOTION.md §7.1) are taken as given; contacts a tool detected (a library clip carries them, WP-5.4) are detected
 * again, so the facts read from them are the same with or without them.
 * `sampled` is for a caller that sampled the clip already (the sensors' motionOf): it must be `sampleAll(clip, R,
 * opts.fps ?? 60)`, this clip on this rest, and is read as given. Only its count and step are checked (an error names
 * sampleAll's); samples with the same count and step of another rest or clip, or sampleLegs's, give wrong facts
 * without an error.
 */
export function measureFacts(clip: Measurable, R: Rest, opts: DetectOptions = {}, sampled?: Sampled): Facts {
  const fps = opts.fps ?? 60;
  if (sampled) {
    // sampleAll's count and step (its grid's, a NaN duration none), two numbers compared, not the samples
    const { n: m, dt: step } = sampleGrid(clip.dur, fps), got = sampled.frames.length;
    if (got !== (m > 0 ? m + 1 : 0) || !Object.is(sampled.dt, step)) throw new Error(`measureFacts: ${got} samples ${+sampled.dt.toFixed(4)} s apart, not sampleAll(clip, R, ${fps})'s ${m + 1} samples ${+step.toFixed(4)} s apart for this clip: pass sampleAll(clip, R, opts.fps) of this clip on this rest, or leave sampled out`);
  } else sampled = sampleAll(clip, R, fps);
  if (clip.contacts && clip.contacts.by !== "labelled") clip = { ...clip, contacts: undefined };
  const { frames, dt } = sampled;
  const n = frames.length - 1;
  const facts: Facts = { by: `m3a-core@${VERSION}`, dur: clip.dur, height: [0, 0], contacts: clip.contacts ?? detectContacts(clip, R, opts, sampled) };
  const hasRoot = (clip.keys[0] as { root?: unknown }).root !== undefined;
  let firstPass = facts.contacts;
  if (!clip.contacts) {
    // the fallbacks read a loop on its feet only: a one-shot with no contact plays still (D108)
    const standing = clip.loop && !(clip.tags ?? []).some((t) => (OFF_FEET as readonly string[]).includes(t));
    // nothing planted by ankle, ball and toe: read the feet by their whole sole
    if (standing && !anyContact(firstPass)) {
      const bySole = detectContacts(clip, R, { ...opts, sole: true }, sampled);
      if (anyContact(bySole)) [opts, firstPass, facts.contacts] = [{ ...opts, sole: true }, bySole, bySole];
    }
    // detected contacts, refined: a planted foot is still in the world. The root's velocity is the clip's own (root
    // travel) or, in place, the body's as its planted feet show it; detect again with it, and read the speed again.
    const v = hasRoot ? null : plantedVelocity(clip, sampled, firstPass);
    const rootV = hasRoot
      ? (i: number): [number, number] => {
          const a = rootAt(clip, Math.max(0, i - 1) * dt), b = rootAt(clip, Math.min(frames.length - 1, i + 1) * dt), k = (R.H0 / 100) / ((Math.min(frames.length - 1, i + 1) - Math.max(0, i - 1)) * dt);
          return [(b.forward - a.forward) * k, (b.right - a.right) * k];
        }
      : v
        ? (): [number, number] => [-v[0], -v[1]]
        : undefined;
    if (rootV) {
      const refined = detectContacts(clip, R, opts, sampled, rootV);
      // in place, a refinement that leaves nothing to stand on is read again (D104, D127): a reading that replaces the
      // refinement's own (D127) only where the planter holds it; a root of its own is exact, and its feet slide
      const again = standing && !hasRoot && weak(clip, refined, firstPass, sampled) ? reread(clip, R, opts, sampled, rootV) : null;
      facts.contacts = again && (!anyContact(refined) || holds(clip, R, again)) ? again : refined;
    }
    // in place, nothing left: the whole sole again, refined, kept with its travel when it stands (D122)
    if (standing && !hasRoot && !anyContact(facts.contacts)) {
      const again = bySole(clip, R, opts, sampled);
      if (again) [firstPass, facts.contacts] = again;
    }
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
 * Twelve named readings of an in-place clip's contacts (D129), each a height pass refined by the world, by three
 * choices: which points read a foot (`sole-`: the heel too; else ankle, ball and toe), which velocity the refinement
 * takes for the body's (`planted`: the planted feet's in that height pass; `lower`: the lower foot's), and how slow a
 * planted foot is (the refinement's own, 0.3 H0/s and at most half the body's speed; `-half`: half the body's speed;
 * `-quarter`: a quarter). Six are readings measureFacts and its fallbacks take: `planted` (the default refinement),
 * `planted-half` and `lower-half` (`reread`'s two tries), `sole-planted` (D104's sole pass refined, and `bySole`),
 * `sole-planted-half` and `sole-lower-half` (`reread` after the sole pass). The other six, `-quarter` and `lower` and
 * `sole-lower` with the refinement's own "still", the chain never takes: readings D122 weighed, new to core here.
 */
export const CONTACT_READINGS = ["planted", "planted-half", "planted-quarter", "lower", "lower-half", "lower-quarter", "sole-planted", "sole-planted-half", "sole-planted-quarter", "sole-lower", "sole-lower-half", "sole-lower-quarter"] as const;
/** A contact reading's name (CONTACT_READINGS). */
export type ContactReading = (typeof CONTACT_READINGS)[number];

/**
 * An in-place clip's contacts by one named reading (CONTACT_READINGS): its height pass by those points, refined by the
 * world with that velocity and that "still", the way measureFacts' refinement, `reread` and `bySole` refine; no
 * contact when the velocity can't be read (too little contact, or too few samples). A clip with a root of its own is refused: its
 * velocity is exact, and measureFacts reads it so. The import spec of a loop's set names the reading its contacts are
 * written by, chosen by D108's bar and its captured speed (tools/facts/readings.ts).
 */
export function readContacts(clip: Playable, R: Rest, reading: ContactReading, opts: DetectOptions = {}, sampled: Sampled = sampleAll(clip, R, opts.fps ?? 60)): Contacts {
  if (!(CONTACT_READINGS as readonly string[]).includes(reading)) throw new Error(`readContacts: no reading "${reading}" (${CONTACT_READINGS.join(", ")})`);
  if ((clip.keys[0] as { root?: unknown }).root !== undefined) throw new Error(`readContacts: the clip has a root of its own, which measureFacts reads exactly; a named reading reads an in-place clip`);
  const [, sole, by, still] = /^(sole-)?(planted|lower)(?:-(half|quarter))?$/.exec(reading)!, o: DetectOptions = sole ? { ...opts, sole: true } : opts;
  const v = by === "planted" ? plantedVelocity(clip, sampled, detectContacts(clip, R, o, sampled)) : lowerFootVelocity(sampled);
  if (!v) return { by: "detected" };
  const share = still === "half" ? 0.5 : still === "quarter" ? 0.25 : 0;
  return detectContacts(clip, R, share ? { ...o, still: (share * PORTABLE.hypot(v[0], v[1])) / R.H0 } : o, sampled, () => [-v[0], -v[1]]);
}

/**
 * An in-place loop's refinement read again, when it erased every contact the height pass found or left one foot alone a
 * moment a cycle (`weak`): a keyed take's planted foot drifts, so "still" means slower than half the body's speed (at
 * least 0.05 H0/s, as detectContacts bounds it), with the body's velocity the planted feet give, then the one the lower
 * foot gives (a run whose swinging foot never lifts past the height band shows both feet planted throughout, their
 * median velocity near 0). The first reading that stands; null when none does.
 */
function reread(clip: Playable, R: Rest, opts: DetectOptions, sampled: Sampled, rootV: (i: number) => [number, number]): Contacts | null {
  const n = sampled.frames.length, base = opts.still ?? 0.3, w = lowerFootVelocity(sampled);
  const tries: [(i: number) => [number, number], boolean][] = [[rootV, false]];
  if (w) tries.push([(): [number, number] => [-w[0], -w[1]], true]);
  for (const [v, fresh] of tries) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += PORTABLE.hypot(...v(i));
    const half = (0.5 * sum) / n / R.H0;
    // at or under the default, the planted feet's velocity gives the refinement's own reading again
    if (!fresh && half <= base) continue;
    const c = detectContacts(clip, R, { ...opts, still: half }, sampled, v);
    if (stands(clip, c, sampled)) return c;
  }
  return null;
}

/**
 * An in-place loop read again by its whole sole when every contact ankle, ball and toe gave was erased: a run on its
 * heels (STYLE100's `OnHeels_Run`) stands on each heel with its toes 5 to 6% of H0 up, so those points catch a foot's
 * toes only about its push-off and into its swing, and the planted feet's velocity they give is a third of the body's.
 * Its height pass by the sole, refined by the planted feet's velocity that gives: the pass and the contacts when they
 * stand, else null (D122).
 */
function bySole(clip: Playable, R: Rest, opts: DetectOptions, sampled: Sampled): [Contacts, Contacts] | null {
  const s = { ...opts, sole: true }, first = detectContacts(clip, R, s, sampled), v = plantedVelocity(clip, sampled, first);
  const c = v && detectContacts(clip, R, s, sampled, () => [-v[0], -v[1]]);
  return c && stands(clip, c, sampled) ? [first, c] : null;
}

/**
 * Whether a reread's contacts hold a loop up: both feet plant, and one foot or the other is down for at least a fifth
 * of the samples (plantedVelocity's bar). One foot's contacts alone, or a moment's, make contactRoot stretch that
 * foot's velocity over the loop: a ground speed and a drift the motion doesn't have (D108).
 */
function stands(clip: Playable, contacts: Contacts, sampled: Sampled): boolean {
  return Boolean(contacts.footL?.length && contacts.footR?.length) && downs(clip, contacts, sampled) >= 0.2 * sampled.frames.length;
}

/**
 * Whether a refinement leaves a loop nothing to stand on, so it is read again: no contact at all (D104); or one foot's
 * alone, down for under a fifth of the samples (neither half of `stands`), after a height pass that held both feet down
 * throughout (D127). Such a pass, the swinging foot never lifting past the band (D104's case), gives the planted feet's
 * velocity a fraction of the body's, and the refinement with it keeps a moment of the stance: STYLE100's `Swimming_Run`
 * kept its left foot 50 ms of its 1,267, no foot held for 95% of the cycle. A pass of alternating steps (MESH2MOTION's
 * `Sprint`) gives the body's velocity, and what the refinement takes from it moves; a pass that lifts a foot past the
 * band a moment (STYLE100's `StartStop_Walk`, both feet down 95% of it) is left too, as its reading again moves its
 * retarget judge's fail to another body. Both feet down briefly (a run, its flight between) and one foot down longer
 * (a hop) are readings, and stay.
 */
function weak(clip: Playable, contacts: Contacts, heights: Contacts, sampled: Sampled): boolean {
  if (!anyContact(contacts)) return true;
  const n = sampled.frames.length;
  return !contacts.footL?.length !== !contacts.footR?.length && downs(clip, contacts, sampled) < 0.2 * n && downs(clip, heights, sampled, true) === n;
}

/** How many of the samples have a foot down by `contacts` (both feet, with `both`). */
function downs(clip: Playable, contacts: Contacts, { frames, dt }: Sampled, both = false): number {
  const c = { ...clip, contacts };
  let down = 0;
  for (let i = 0; i < frames.length; i++) {
    const at = contactsAt(c, i * dt);
    if (both ? at.footL && at.footR : at.footL || at.footR) down++;
  }
  return down;
}

/**
 * Whether the planter holds a loop's `contacts` (D127): planted over two cycles, 60 samples a second, under the root
 * contactRoot reads from them, neither ankle pulled 10% of H0 or more from where the motion has it (D108's bar). A
 * reading that replaces the refinement's must hold its feet, at any speed a game retimes the loop to (`playable`
 * measures a retimed loop again): read again, STYLE100_SIDERUN's `Followed_SideRunRight` at twice its speed pulls 10.1%
 * of H0, and keeps the refinement's.
 */
function holds(clip: Playable, R: Rest, contacts: Contacts): boolean {
  const memo = new Map<number, Float64Array>(), ankles = [IDX.ankleL! * 3, IDX.ankleR! * 3];
  const points = (t: number) => {
    let X = memo.get(t);
    if (!X) memo.set(t, (X = Float64Array.from(decodePose(R, keyAt(clip, t), new Array<number>(108)))));
    return X;
  };
  const m: Motion = { rest: R, dur: clip.dur, loop: clip.loop, contacts, key: (t) => keyAt(clip, t), points, root: contactRoot(clip, R, contacts).root };
  for (let i = 0; i <= 120 * clip.dur; i++) {
    const t = i / 60, X = plant(m, t), Y = points(t);
    for (const a of ankles) if (PORTABLE.hypot(X[a]! - Y[a]!, X[a + 1]! - Y[a + 1]!, X[a + 2]! - Y[a + 2]!) >= 0.1 * R.H0) return false;
  }
  return true;
}

/** The lower foot's velocity in the pose frame (mm/s, forward and right): at each sample its lowest point's, the
 *  median over the samples; null with fewer than three samples. */
function lowerFootVelocity({ frames, dt }: Sampled): [number, number] | null {
  const n = frames.length - 1, vf: number[] = [], vr: number[] = [];
  for (let i = 1; i < n; i++) {
    const X = frames[i]!, end: End = endLowOf(X, "footL") <= endLowOf(X, "footR") ? "footL" : "footR";
    let low = END_POINTS[end][0]!, z = Infinity;
    for (const p of END_POINTS[end]) if (X[IDX[p]! * 3 + 2]! < z) [low, z] = [p, X[IDX[p]! * 3 + 2]!];
    const a = pt(frames[i - 1]!, low), b = pt(frames[i + 1]!, low);
    vf.push((b[0] - a[0]) / (2 * dt));
    vr.push((b[1] - a[1]) / (2 * dt));
  }
  return vf.length ? [median(vf), median(vr)] : null;
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
