// The fix operators (PLAN.md WP-3.5): each takes a clip, its rest and its metrics report, and returns the clip with one
// kind of defect repaired in its keys, and a line for every change it made. They edit keys only: `dur`, the events and
// the contacts stay as they are (fix.ts checks, and reports any that moved). Every key an operator adds or edits leaves
// it as the format keeps it (spec/MOTION.md §6.2): its time to the millisecond, its numbers whole and within their
// ranges (`tidy`), so a fixed clip validates.
// Carried from my-3d2dge's tools/asf-amc.mjs: a loop closes by spreading what its last pose still differs from its
// first over the cycle, a little a frame.
import { clip as clipNs, contact, format, math, type Clip, type Key, type Rest } from "@m3a/core";
import { jitter as jitterCheck, pops as popCheck, type Finding } from "../metrics/checks.ts";
import { at, motionOf, sole, STANCE, type Motion } from "../metrics/motion.ts";
import type { Report } from "../metrics/report.ts";
import { THRESHOLDS } from "../metrics/thresholds.ts";

const { PORTABLE } = math;

/** The operators, in the order `fix` applies them: a flip's swing first, then shakes, the floor, feet, the seam, keys. */
export const FIXES = ["twistFlips", "jitter", "penetration", "footLocks", "seam", "refit"] as const;
/** An operator's name. */
export type FixName = (typeof FIXES)[number];
/** How the operators run: re-fit's budget, and whether foot locks hold every contact or only those that slide. */
export interface FixOptions {
  /** Re-fit: the most keys the clip keeps. */
  maxKeys?: number;
  /** Re-fit: the most a pose may move where keys are dropped, in mm (5 by default). */
  tolerance?: number;
  /** Foot locks: hold every contact still, not only those the metrics find sliding. */
  allContacts?: boolean;
}
/** What an operator returns: the clip and its changes, one line each. */
export interface OpResult {
  clip: Clip;
  changes: string[];
}
/** An operator: a clip, its rest, its report, the options, to the clip repaired. */
export type Operator = (clip: Clip, R: Rest, report: Report, opts: FixOptions) => OpResult;

type K = Key & Record<string, unknown>;
const fmt = (t: number) => t.toFixed(2);
const ms = (t: number) => Math.round(t * 1000) / 1000;
const copy = (c: Clip): Clip => structuredClone(c);
const sorted = (c: Clip) => c.keys.sort((a, b) => a.t - b.t);
/**
 * Key k as the format keeps it (spec/MOTION.md §6.2): its time to the millisecond, every number whole and within its
 * range. A limb's direction an edit took past ±100 is scaled back first, so it points the same way.
 */
export function tidy(k: K): K {
  k.t = ms(k.t);
  for (const [f, spec] of Object.entries(format.KEY_FIELDS)) {
    const v = k[f] as number[] | undefined;
    if (!Array.isArray(v)) continue;
    const big = spec.direction ? Math.max(...v.slice(0, 3).map((x) => Math.abs(x))) : 0, scale = big > 100 ? 100 / big : 1;
    const out = v.map((x, j) => (Number.isFinite(x) ? Math.min(spec.ranges[j]![1], Math.max(spec.ranges[j]![0], Math.round(j < 3 ? x * scale : x))) : x));
    // a direction rounded to nothing keeps its largest part
    if (spec.direction && out[0] === 0 && out[1] === 0 && out[2] === 0) {
      const j = [0, 1, 2].reduce((a, b) => (Math.abs(v[b]!) > Math.abs(v[a]!) ? b : a));
      out[j] = v[j]! < 0 ? -1 : 1;
    }
    k[f] = out;
  }
  if (typeof k.yaw === "number" && Number.isFinite(k.yaw)) k.yaw = Math.round(k.yaw);
  return k;
}
/** The clip's in-betweened key at t, as the format keeps it (a loop's end is its last pose, not its first again). */
function keyNear(c: Clip, t: number): K {
  const tt = c.loop && t >= c.dur ? c.dur * (1 - 1e-12) : t;
  return tidy({ ...(format.keyAt(c, tt) as K), t: ms(t) });
}
/** An operator whose new and edited keys are tidied (a key it left as it was stays exactly as it was). */
const tidied = (op: Operator): Operator => (clip, R, report, opts) => {
  const out = op(clip, R, report, opts), was = new Set(clip.keys.map((k) => JSON.stringify(k)));
  for (const k of out.clip.keys) if (!was.has(JSON.stringify(k))) tidy(k as K);
  return out;
};
/** The key at t (to the millisecond), added in-betweened unless one is within 5 ms (two keys that close read as a snap). */
function keyAt(c: Clip, t: number): K {
  const tt = ms(t), near = c.keys.filter((k) => Math.abs(k.t - tt) < 0.005 + 1e-9).sort((a, b) => Math.abs(a.t - tt) - Math.abs(b.t - tt));
  if (near.length) return near[0] as K;
  const k = keyNear(c, tt);
  c.keys.push(k);
  sorted(c);
  return k;
}
/**
 * How densely an edit is keyed: every 0.1 s, the clip's own keys between edited too. An added key is in-betweened and
 * rounded to whole numbers; keyed every 1/30 s, a slow field's rounding steps read as a shake (jitter's bends).
 */
const STEP = 0.1;
/** The times every 0.1 s within [a, b], and b itself, to the millisecond. */
const grid = (a: number, b: number) => {
  const out: number[] = [];
  for (let j = Math.ceil(a / STEP - 1e-6); j * STEP <= b + 1e-6; j++) out.push(ms(j * STEP));
  if (b - (out.at(-1) ?? -1) > 0.005) out.push(ms(b));
  return out;
};
/** Of times `ts`, those no key of the clip's is within 0.05 s of (that key is edited instead: two keys close together
 * make a small difference a fast move). */
const sparse = (c: Clip, ts: readonly number[]) => ts.filter((t) => !c.keys.some((k) => Math.abs(k.t - t) < STEP / 2 - 1e-9));
/** Keys every 0.1 s over [a, b], within the clip, where it has none within 0.05 s. */
function dense(c: Clip, a: number, b: number): void {
  for (const t of sparse(c, grid(Math.max(0, a), Math.min(b, c.dur)))) keyAt(c, t);
}
const round = (v: number[]) => v.map((x) => Math.round(x));
/** The findings of one metric (and its folded ones) in a report. */
const of = (r: Report, ...names: string[]) => [...r.findings, ...r.folded].filter((f) => names.includes(f.metric));

// ---- twist flips -------------------------------------------------------------------------------------------------

const TWISTS: readonly [string, number, string][] = [["armL", 4, "twist"], ["armR", 4, "twist"], ["legL", 4, "twist"], ["legR", 4, "twist"], ["handL", 2, "roll"], ["handR", 2, "roll"], ["footL", 1, "heading"], ["footR", 1, "heading"]];
/** Whether field f's reference is undefined in key k (a straight limb; a foot pointing straight down), as the metric reads it. */
function singular(f: string, k: K, R: Rest): boolean {
  const s = f.slice(-1);
  if (!f.startsWith("foot")) return ((k[f.startsWith("hand") ? "arm" + s : f] as number[] | undefined)?.[3] ?? 0) < 20;
  const X = format.decodePose(R, k as never, new Float32Array(format.P * 3)), a = at(X, "ankle" + s), b = at(X, "ball" + s), d = PORTABLE.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return d > 1e-6 && Math.abs(b[2] - a[2]) / d > PORTABLE.cos((20 * Math.PI) / 180);
}

/**
 * Repair twist flips: for each jump the metric finds, whole turns are taken out first (a turn of 360° moves nothing);
 * then, where the reference is undefined around it (a straight limb, a foot pointing down), the change is spread over
 * the keys of that stretch, so the bone turns where nothing shows it; elsewhere the jump is undone from that key on (a
 * knee flipped mid-bend points back the way it pointed). In a loop the undoing keeps the cycle closed: it stops where
 * the twist jumps back (a later flip the other way), and where it never does, it eases out over the rest of the cycle
 * (or in over its start, if that is longer), so the last key still meets the first. It changes the twist only.
 */
export const twistFlips: Operator = tidied((clip, R, report) => {
  const c = copy(clip), changes: string[] = [];
  sorted(c);
  const K = c.keys as K[];
  for (const f of of(report, "twistFlip")) {
    const spec = TWISTS.find(([n]) => n === f.where);
    if (!spec) continue;
    const [field, idx, what] = spec, k = K.findIndex((x) => Math.abs(x.t - f.t0) < 1e-6);
    if (k < 0 || k + 1 >= K.length || !(K[k]![field] as number[] | undefined) || !(K[k + 1]![field] as number[] | undefined)) continue;
    const v = (i: number) => (K[i]![field] as number[])[idx]!, set = (i: number, x: number) => ((K[i]![field] as number[])[idx] = Math.round(x));
    const jump = v(k + 1) - v(k), turns = Math.round(jump / 360);
    if (turns) {
      for (let i = k + 1; i < K.length; i++) set(i, v(i) - 360 * turns);
      changes.push(`${field}: ${what} ${fmt(f.t0)}–${fmt(f.t1)} s, ${turns > 0 ? "−" : "+"}${Math.abs(turns) * 360}° from ${fmt(K[k + 1]!.t)} s on (whole turns)`);
    }
    const left = v(k + 1) - v(k);
    if (Math.abs(left) < THRESHOLDS.twistFlip.warn) continue;
    // the stretch where the reference is undefined, around the jump
    let s0 = k, s1 = k + 1;
    const free = singular(field, K[k]!, R) || singular(field, K[k + 1]!, R);
    if (free) {
      while (s0 > 0 && singular(field, K[s0 - 1]!, R)) s0--;
      while (s1 + 1 < K.length && singular(field, K[s1 + 1]!, R)) s1++;
    }
    const a = Math.max(0, s0 - 1), b = Math.min(K.length - 1, s1 + 1);
    if (free && b - a >= 3) {
      // spread: the keys between the defined ones either side take the change in step with time
      const va = v(a), vb = v(b), ta = K[a]!.t, tb = K[b]!.t;
      for (let i = a + 1; i < b; i++) set(i, va + ((vb - va) * (K[i]!.t - ta)) / (tb - ta));
      changes.push(`${field}: ${what} ${fmt(f.t0)}–${fmt(f.t1)} s spread over ${fmt(ta)}–${fmt(tb)} s, where ${field.startsWith("foot") ? "the foot points down" : "the limb is straight"}`);
    } else if (!c.loop) {
      for (let i = k + 1; i < K.length; i++) set(i, v(i) - left);
      changes.push(`${field}: ${what}'s ${Math.round(Math.abs(left))}° jump at ${fmt(f.t0)}–${fmt(f.t1)} s undone from ${fmt(K[k + 1]!.t)} s on`);
    } else {
      // a loop: undone as far as a later flip the other way, else eased back out over the cycle's rest (or in over its
      // start), so the last key still meets the first
      const back = of(report, "twistFlip").find((g) => g.where === f.where && g.t0 > f.t0 + 1e-6);
      const j = back ? K.findIndex((x) => Math.abs(x.t - back.t0) < 1e-6) : -1;
      const opposite = j > k && j + 1 < K.length && Math.sign(v(j + 1) - v(j)) === -Math.sign(left);
      const end = K.findLastIndex((x) => x.t <= c.dur + 1e-9), t0 = K[0]!.t, tk = K[k]!.t, tk1 = K[k + 1]!.t, tEnd = K[end]!.t;
      if (opposite) {
        for (let i = k + 1; i <= j; i++) set(i, v(i) - left);
        changes.push(`${field}: ${what}'s ${Math.round(Math.abs(left))}° jump at ${fmt(f.t0)}–${fmt(f.t1)} s undone until it jumps back at ${fmt(K[j]!.t)} s`);
      } else if (tEnd - tk1 >= tk - t0 && tEnd > tk1) {
        for (let i = k + 1; i <= end; i++) set(i, v(i) - left * (1 - (K[i]!.t - tk1) / (tEnd - tk1)));
        changes.push(`${field}: ${what}'s ${Math.round(Math.abs(left))}° jump at ${fmt(f.t0)}–${fmt(f.t1)} s undone at ${fmt(tk1)} s and eased back out by the cycle's end (${fmt(tEnd)} s)`);
      } else if (tk > t0) {
        for (let i = 0; i <= k; i++) set(i, v(i) + (left * (K[i]!.t - t0)) / (tk - t0));
        changes.push(`${field}: ${what}'s ${Math.round(Math.abs(left))}° jump at ${fmt(f.t0)}–${fmt(f.t1)} s eased in from the cycle's start (${fmt(t0)} s) to ${fmt(tk)} s`);
      }
    }
  }
  return { clip: c, changes };
});

// ---- jitter and pops ---------------------------------------------------------------------------------------------

/** The key fields that move a body part's points. */
function fieldsOf(point: string): string[] {
  const s = point.slice(-1);
  if (/^(clav|sh|elbow|wrist|index|knuck|pinky|fist)[LR]$/.test(point)) return ["arm" + s, "hand" + s, "fingers" + s, "sh" + s];
  if (/^(hip|knee|ankle|ball|toe)[LR]$/.test(point)) return ["leg" + s, "foot" + s];
  return /^(neck|head|headTop|faceF)$/.test(point) ? ["head"] : ["hips", "body", "chest", "spine"];
}
const TORSO = ["hips", "body", "chest", "spine"];
const POSE_FIELDS = ["hips", "body", "chest", "head", "shL", "shR", "armL", "armR", "legL", "legR", "footL", "footR", "handL", "handR", "fingersL", "fingersR", "spine", "blade"];
/**
 * One smoothing pass over the keys [i0, i1] of `fields`, by time (keys needn't be evenly spaced): a value far outside
 * its neighbours (a key out of place: further from their in-between than twice their own difference) takes that
 * in-between at its time; for a shake, every value then moves halfway to
 * its neighbours' in-between (1-2-1 where keys are evenly spaced). Returns how many keys changed.
 */
function smooth(K: K[], i0: number, i1: number, fields: readonly string[], shake: boolean): number {
  const lo = Math.max(1, i0), hi = Math.min(K.length - 2, i1);
  if (hi < lo) return 0;
  let changed = 0;
  for (const f of fields) {
    const vals = K.map((k) => k[f] as number[] | undefined);
    if (vals.slice(lo - 1, hi + 2).some((x) => !x)) continue;
    const between = (i: number, j: number) => vals[i - 1]![j]! + ((vals[i + 1]![j]! - vals[i - 1]![j]!) * (K[i]!.t - K[i - 1]!.t)) / (K[i + 1]!.t - K[i - 1]!.t);
    const out = new Map<number, number[]>();
    for (let i = lo; i <= hi; i++) {
      out.set(i, vals[i]!.map((v, j) => {
        const a = vals[i - 1]![j]!, b = vals[i + 1]![j]!, m = between(i, j);
        // out of place: beyond both neighbours, and further from their in-between than they are from each other (a
        // neighbour of a key out of place is beyond it too, but by less than that key leaps)
        const outlier = (v > Math.max(a, b) + 0.5 || v < Math.min(a, b) - 0.5) && Math.abs(v - m) > 2 * Math.abs(b - a) + 0.5;
        return outlier ? m : shake ? (v + m) / 2 : v;
      }));
    }
    for (const [i, next] of out) {
      const r = round(next);
      if (r.some((x, j) => x !== vals[i]![j])) changed++;
      K[i]![f] = r;
    }
  }
  return changed;
}
/** The keys a finding spans, two either side. */
const span = (K: K[], f: Finding) => [Math.max(0, K.findIndex((k) => k.t >= f.t0 - 1e-6) - 2), K.findLastIndex((k) => k.t <= f.t1 + 1e-6) + 2] as const;

/**
 * Filter jitter: where the metrics find a shake or a pop, the keys of the part it is on (an arm's, a leg's, the head's,
 * the torso's) are smoothed, two keys either side and by time: a key out of place takes its neighbours' in-between,
 * and for a shake every key moves halfway to it. If the part's keys don't carry it, the torso's are smoothed too, then
 * every pose field.
 */
export const jitter: Operator = tidied((clip, R, report) => {
  let c = copy(clip);
  const changes: string[] = [];
  sorted(c);
  for (const f of of(report, "jitter", "pop")) {
    if (report.folded.includes(f)) continue;
    const tiers = [fieldsOf(f.where ?? ""), [...fieldsOf(f.where ?? ""), ...TORSO], POSE_FIELDS];
    for (const fields of tiers) {
      const K = c.keys as K[], [i0, i1] = span(K, f), n = smooth(K, i0, i1, fields, f.metric === "jitter");
      if (n) changes.push(`${f.metric} on ${f.where} at ${fmt(f.t0)}–${fmt(f.t1)} s: ${[...new Set(fields)].filter((x) => K[0]![x] !== undefined).join(", ")} smoothed over ${fmt(K[Math.max(0, i0)]!.t)}–${fmt(K[Math.min(K.length - 1, i1)]!.t)} s`);
      const still = motionOf(c, R), again = f.metric === "jitter" ? jitterAt(still, f) : popAt(still, f);
      if (!again) break;
      c = copy(c);
    }
  }
  return { clip: c, changes };
});
// whether the shake or pop is still found where it was
const overlaps = (a: Finding, b: Finding) => fieldsOf(a.where ?? "")[0] === fieldsOf(b.where ?? "")[0] && a.t0 <= b.t1 + 1e-6 && a.t1 >= b.t0 - 1e-6;
const jitterAt = (m: Motion, f: Finding) => jitterCheck(m).findings.some((x) => overlaps(x, f));
const popAt = (m: Motion, f: Finding) => popCheck(m).findings.some((x) => overlaps(x, f));

// ---- penetration ----------------------------------------------------------------------------------------------------

/** The ease from 0 to 1 over [0, 1]. */
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** A clip as core's planting reads it: its keys, points, measured contacts, and its root's place (no turn: D41). */
function plantable(c: Clip, R: Rest, m: Motion, contacts: Clip["contacts"]): contact.Motion {
  const own = (c.keys[0] as K).root !== undefined, belt = !own && m.dur > 0 ? [m.root.at(-1)!.forward / m.dur, m.root.at(-1)!.right / m.dur] : [0, 0];
  return {
    rest: R, dur: c.dur, loop: c.loop, contacts: contacts ?? { by: "detected" },
    key: (t) => format.keyAt(c, t),
    points: (t) => Float64Array.from(format.pose(R, c, c.loop && t >= c.dur && t < c.dur * 1.000001 ? c.dur * (1 - 1e-12) : t)),
    root: (t) => {
      if (!own) return { forward: belt[0]! * t, right: belt[1]! * t, yaw: 0 };
      const r = clipNs.rootAt(c, t);
      return { forward: (r.forward * R.H0) / 100, right: (r.right * R.H0) / 100, yaw: 0 };
    },
  };
}
/** Key k's legs and feet (and the pelvis's height, where planting lowered it) from planted body points X. */
function legsFrom(k: K, X: ArrayLike<number>, R: Rest, before: ArrayLike<number>): void {
  const e = format.encodePose(R, X, k as never, { round: false }) as K;
  // a leg aimed and bent at its planted ankle keeps its own twist (re-read from the knee, a near-straight leg's twist
  // jumps); a foot field is written only where the clip has one (an optional field is in every key or none)
  for (const s of ["L", "R"]) k["leg" + s] = aimed(k["leg" + s] as number[], e["leg" + s] as number[]);
  for (const f of ["footL", "footR"]) if (k[f] !== undefined) k[f] = round(e[f] as number[]);
  const dz = at(X, "pelvis")[2] - at(before, "pelvis")[2];
  if (Math.abs(dz) > 0.5) k.hips = [k.hips[0]!, k.hips[1]!, Math.round(k.hips[2]! + (dz * 100) / R.H0)];
}

/** A limb's new direction and bend (whole numbers), its own twist kept. */
const aimed = (own: number[], to: number[]) => [...round(to.slice(0, 4)), own[4] ?? 0];
/** Body points a and b mixed, w of the way to b. */
const mix = (a: ArrayLike<number>, b: ArrayLike<number>, w: number) => Float64Array.from(a, (x, i) => x + (b[i]! - x) * w);

/** A foot's lowest sole point's height (mm) and world speed (H0 a second, up and down too) at sample i. */
function footAt(m: Motion, i: number, s: "L" | "R"): { z: number; v: number } {
  const n = m.frames.length - 1, low = (j: number) => sole(m, m.frames[j]!, s).reduce((a, b) => (b.p[2] < a.p[2] ? b : a));
  const p = low(i), i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1), q0 = sole(m, m.frames[i0]!, s).find((x) => x.name === p.name)!.p, q1 = sole(m, m.frames[i1]!, s).find((x) => x.name === p.name)!.p;
  const r0 = m.root[i0]!, r1 = m.root[i1]!;
  // in every direction: a foot lifting straight up onto a step isn't standing
  return { z: p.p[2], v: i1 > i0 ? PORTABLE.hypot(q1[0] + r1.forward - q0[0] - r0.forward, q1[1] + r1.right - q0[1] - r0.right, q1[2] - q0[2]) / ((i1 - i0) * m.dt) / m.rest.H0 : 0 };
}

/** How deep each foot's lowest sole point is under the floor in key k's own pose (mm, negative above it). */
function depthOf(m: Motion, k: K, R: Rest): [number, number] {
  const X = format.decodePose(R, k as never, new Float32Array(format.P * 3));
  return (["L", "R"] as const).map((s) => -Math.min(...sole(m, X, s).map((p) => p.p[2]))) as [number, number];
}
/** The shift foot s takes at the key nearest key n that has one. */
function nearest(K: K[], shift: number[][], n: number, s: number): number {
  let best = 0, gap = Infinity;
  shift.forEach((d, i) => {
    if (d[s] !== 0 && Math.abs(K[i]!.t - K[n]!.t) < gap) [best, gap] = [d[s]!, Math.abs(K[i]!.t - K[n]!.t)];
  });
  return best;
}
/** Key k with each foot moved straight up by dz (mm; down when negative), its leg re-aimed at it. */
function footsTo(k: K, R: Rest, dz: readonly [number, number]): void {
  const X = format.decodePose(R, k as never, new Float32Array(format.P * 3));
  (["L", "R"] as const).forEach((s, i) => {
    if (!dz[i]) return;
    for (const p of ["ankle", "ball", "toe"]) X[format.IDX[p + s]! * 3 + 2] = X[format.IDX[p + s]! * 3 + 2]! + dz[i]!;
  });
  const e = format.encodePose(R, X, k as never, { round: false }) as K;
  (["L", "R"] as const).forEach((s, i) => {
    if (!dz[i]) return;
    k["leg" + s] = aimed(k["leg" + s] as number[], e["leg" + s] as number[]);
    if (k["foot" + s] !== undefined) k["foot" + s] = round(e["foot" + s] as number[]);
  });
}

/**
 * Lift penetration: where a sole goes under the floor, the body is raised by the deepest sole's depth, key by key on
 * every 0.1 s over the span and 0.2 s either side, along the lowest curve over it that changes by at most 0.75 H0 a
 * second: it never jumps, and a foot stepping up out of a sunk floor rises with the body rather than sliding along it.
 * A foot standing still (under 0.2 H0 a second: a landing foot slows less) that the lift took more than 15 mm off the
 * floor, or one still under it, is moved straight onto it by its leg, eased in and out over 0.1 s.
 */
export const penetration: Operator = tidied((clip, R, report) => {
  const c = copy(clip), changes: string[] = [], RAMP = 0.2, EASE = 0.1, HOVER = 15, RATE = 0.75, STILL = 0.2;
  for (const f of of(report, "penetration")) {
    // the span, 0.2 s either side, and the 0.1 s a foot's shift takes to ease in and out
    const from = f.t0 - RAMP - EASE, to = f.t1 + RAMP + EASE;
    dense(c, from, to);
    const m = motionOf(c, R), K = (sorted(c) as K[]).filter((k) => k.t >= from - 1e-6 && k.t <= to + 1e-6);
    const feet = K.map((k) => (["L", "R"] as const).map((s) => footAt(m, Math.min(m.frames.length - 1, Math.round(Math.min(k.t, m.dur) / m.dt)), s)));
    // the lift: the lowest curve over the deepest sole's depth that changes by at most 0.75 H0 a second (forward, then
    // back), so it follows a sink as it was eased in and out, leads a fast one by just enough, and never jumps; a foot
    // stepping up out of the sunk floor rises with the body instead of being held at the floor's level
    // (each key's depth read from its own pose: keys a few ms apart read at the nearest frame can differ by a lot)
    const lift = K.map((k) => Math.max(0, ...depthOf(m, k, R)));
    for (let n = 1; n < K.length; n++) lift[n] = Math.max(lift[n]!, lift[n - 1]! - RATE * R.H0 * (K[n]!.t - K[n - 1]!.t));
    for (let n = K.length - 2; n >= 0; n--) lift[n] = Math.max(lift[n]!, lift[n + 1]! - RATE * R.H0 * (K[n + 1]!.t - K[n]!.t));
    // its corners rounded (never below it): a ramp's start and end a key apart read as a shake
    for (let pass = 0; pass < 2; pass++) {
      const was = [...lift];
      for (let n = 1; n + 1 < K.length; n++) lift[n] = Math.max(was[n]!, (was[n - 1]! + 2 * was[n]! + was[n + 1]!) / 4);
    }
    let most = 0;
    K.forEach((k, n) => {
      const up = Math.ceil((lift[n]! * 100) / R.H0);
      if (up > 0) [k.hips, most] = [[k.hips[0]!, k.hips[1]!, k.hips[2]! + up], Math.max(most, (up * R.H0) / 100)];
    });
    if (most > 0) changes.push(`body raised up to ${Math.round(most)} mm over ${fmt(K[0]!.t)}–${fmt(K[K.length - 1]!.t)} s (a sole ${Math.round(f.value)} mm under the floor at ${fmt(f.t0)}–${fmt(f.t1)} s)`);
    // a standing foot the lift left off the floor, or one still under it: moved straight onto it by its leg (the leg
    // aims at the moved ankle, its knee keeps its side), eased in and out over 0.1 s
    const m2 = motionOf(c, R), after = K.map((k) => (["L", "R"] as const).map((s) => footAt(m2, Math.min(m2.frames.length - 1, Math.round(Math.min(k.t, m2.dur) / m2.dt)), s)));
    const shift = K.map((_, n) => after[n]!.map((x, s) => (feet[n]![s]!.v <= STILL && ((feet[n]![s]!.z <= STANCE.enter * R.H0 && x.z > HOVER) || x.z < -1) ? -x.z : 0)));
    const need = shift.map((d) => d.some((x) => x !== 0));
    if (!need.some(Boolean)) continue;
    const ts = K.filter((_, n) => need[n]).map((k) => k.t), a = ts[0]!, b = ts[ts.length - 1]!;
    K.forEach((k, n) => {
      // each foot's shift, eased in and out over 0.1 s around the keys that need one
      const d = [0, 1].map((s) => Math.max(0, ...K.map((j, i) => (shift[i]![s] !== 0 ? ease(1 - Math.abs(k.t - j.t) / EASE) : 0))) * (shift[n]![s] || nearest(K, shift, n, s)));
      if (d.some((x) => Math.abs(x) > 0.5)) footsTo(k, R, d as [number, number]);
    });
    changes.push(`feet set on the floor by their legs at ${fmt(a)}–${fmt(b)} s`);
  }
  return { clip: c, changes };
});

// ---- foot locks ---------------------------------------------------------------------------------------------------

/**
 * Bake foot locks into keys: each contact the metrics find sliding (or every contact, with `allContacts`) is held
 * still where it landed, its sole on the floor, by core's planting (the leg solved again, the pelvis lowered where a
 * leg can't reach), and written into keys every 0.1 s (and the clip's own keys) over the contact and the 0.3 s
 * it takes to let go: the foot stays planted through that release and eases back to the clip's own pose, so letting
 * go isn't a snap. Times are read on the contact's own clock, so a loop's contact runs through its seam and the keys
 * past the end hold as the cycle's end.
 */
export const footLocks: Operator = tidied((clip, R, report, opts) => {
  const c = copy(clip), m = motionOf(c, R), changes: string[] = [], hits = of(report, "slide", "skate"), BLEND = 0.3;
  const locks: { end: "footL" | "footR"; a: number; b: number }[] = [];
  for (const end of ["footL", "footR"] as const) {
    for (const [a, b] of m.contacts[end] ?? []) if (opts.allContacts || hits.some((f) => f.where === end && f.t0 <= b + 1e-6 && f.t1 >= a - 1e-6)) locks.push({ end, a, b });
  }
  if (!locks.length) return { clip: c, changes };
  // planted through the release: the contacts run on 0.3 s, and the release is eased here
  const held: NonNullable<Clip["contacts"]> = { by: "detected" };
  for (const l of locks) (held[l.end] ??= []).push([l.a, l.b + BLEND]);
  const pm = plantable(structuredClone(clip), R, m, held);
  /** A time t of the clip's on lock l's clock (t, a cycle on, or a cycle back: the one within the lock), or null. */
  // (a key at the end is the cycle's end; one past it is the next cycle's start: it holds as that does)
  const clock = (l: (typeof locks)[number], t: number) => (c.loop ? (t > c.dur + 1e-9 ? [t - c.dur, t, t + c.dur] : [t, t + c.dur]) : [t]).find((x) => x >= l.a - 1e-9 && x <= l.b + BLEND + 1e-9) ?? null;
  const span = (l: (typeof locks)[number]): [number, number][] => (c.loop && l.b + BLEND > c.dur ? [[l.a, c.dur], [0, l.b + BLEND - c.dur]] : [[l.a, Math.min(c.dur, l.b + BLEND)]]);
  const times = new Set<number>();
  for (const l of locks) {
    for (const [p, q] of span(l)) for (const t of sparse(c, grid(p, q))) times.add(t);
    changes.push(`${l.end} held still where it landed, ${fmt(l.a)}–${fmt(Math.min(l.b, l.a + c.dur))} s`);
  }
  for (const k of c.keys) if (locks.some((l) => clock(l, k.t) !== null)) times.add(k.t);
  // every key added before any is edited, so each new one is in-betweened from the clip as it was (a time within 5 ms
  // of a clip's key is that key)
  const keys = [...new Set([...times].sort((x, y) => x - y).map((t) => keyAt(c, t)))];
  const original = (t: number) => format.pose(R, clip, c.loop && t >= c.dur - 1e-9 && t <= c.dur + 1e-9 ? c.dur * (1 - 1e-12) : t);
  const out = keys.map((k) => {
    const X0 = original(k.t);
    let X: Float64Array = Float64Array.from(X0);
    for (const l of locks) {
      const tau = clock(l, k.t);
      if (tau === null) continue;
      const w = tau <= l.b ? 1 : 1 - ease((tau - l.b) / BLEND);
      // the end of a loop's cycle is read just before it (at the end, core starts the next cycle's contact)
      const at = c.loop && Math.abs(tau - c.dur) < 1e-9 ? c.dur - 1e-6 : tau;
      X = mix(X, contact.plant(pm, at, { blend: 0 }), w);
    }
    return [X0, X] as const;
  });
  keys.forEach((k, n) => legsFrom(k, out[n]![1], R, out[n]![0]));
  return { clip: c, changes };
});

// ---- loop seam ----------------------------------------------------------------------------------------------------

/** The components of each field that are angles (their difference reads within ±180°). */
const ANGLES: Readonly<Record<string, readonly number[]>> = {
  body: [0, 1, 2], chest: [0, 1, 2], head: [0, 1, 2], armL: [4], armR: [4], legL: [4], legR: [4], handL: [0, 1, 2], handR: [0, 1, 2],
  footL: [0, 1, 2], footR: [0, 1, 2], shL: [0, 1], shR: [0, 1],
};
const wrap = (x: number) => x - 360 * Math.round(x / 360);
/** The median change of speed at a clip's own keys within it, of component j of field f (units a second). */
function corner(K: K[], f: string, j: number, dur: number): number {
  const v = K.filter((k) => k.t <= dur + 1e-9 && Array.isArray(k[f])), out: number[] = [];
  for (let i = 1; i + 1 < v.length; i++) {
    const x = (n: number) => (v[n]![f] as number[])[j]!;
    out.push(Math.abs((x(i + 1) - x(i)) / (v[i + 1]!.t - v[i]!.t) - (x(i) - x(i - 1)) / (v[i]!.t - v[i - 1]!.t)));
  }
  return out.length ? out.sort((a, b) => a - b)[out.length >> 1]! : 0;
}
/**
 * Close a loop seam: what the loop's last pose still differs from its first, field by field (angles by the shorter
 * way, so a spin keeps its whole turns), and how that field's speeds differ there, are spread over the cycle's ends: half
 * taken off the keys before the seam and half added to those after it, along Hermite curves over a quarter of the cycle
 * (at most 0.5 s) either side, so the last pose meets the first at the same speed, and the middle of the cycle is left
 * as it is (spread over the whole cycle, a drift at the end tilts every key: an arm raised at the end swung into the
 * chest mid-cycle). A speed change at the seam is matched where it stands out from the clip's own (more than 3 times
 * the median change at its keys: a sparsely keyed clip turns a corner at every key, and the seam's is one more); where
 * the metrics find the seam's speeds change, a field whose poses meet but whose speeds don't has its speeds matched
 * too. The root and its yaw
 * (the cycle's travel) stay. The differences are read before any key is added: a seam that already closes gets no keys.
 */
export const seam: Operator = tidied((clip, _R, report) => {
  const c = copy(clip), changes: string[] = [], speeds = of(report, "seamVelocity").length > 0;
  if (!c.loop || c.keys.length < 2) return { clip: c, changes };
  sorted(c);
  const first0 = c.keys[0] as K, past = c.keys.some((k) => k.t > c.dur + 1e-9);
  const lastIn = (c.keys as K[]).filter((k) => k.t <= c.dur + 1e-9).at(-1)!, T = past ? c.dur : lastIn.t, W = Math.min(0.5, (T - first0.t) / 4);
  if (!(W > 1 / 30)) return { clip: c, changes };
  // the ends keyed every 0.1 s, and at the seam itself, so the curves are in-betweened smoothly: added to a copy, read
  // there, and kept only if a field changes
  const d = copy(c);
  dense(d, first0.t, first0.t + W);
  dense(d, T - W, T);
  const end = keyAt(d, T), K = sorted(d) as K[], e = K.indexOf(end), before = K[e - 1]!, after = K[1]!, first = K[0]!;
  const h00 = (u: number) => 2 * u ** 3 - 3 * u ** 2 + 1, h10 = (u: number) => u ** 3 - 2 * u ** 2 + u, h01 = (u: number) => -2 * u ** 3 + 3 * u ** 2, h11 = (u: number) => u ** 3 - u ** 2;
  // the most a speed difference moves a value (half of it, at the Hermite tangent's peak of 4/27 of W)
  const reach = (dv: number) => 0.5 * (4 / 27) * W * Math.abs(dv);
  for (const f of POSE_FIELDS) {
    const a = first[f] as number[] | undefined, b = end[f] as number[] | undefined;
    if (!a || !b) continue;
    const dp = b.map((v, j) => ((ANGLES[f] ?? []).includes(j) ? wrap(v - a[j]!) : v - a[j]!));
    // the speed change at the seam, matched only where it stands out from the change at the clip's own keys (a clip
    // keyed sparsely turns a corner at every key: the seam's is one more), more than 3 times their median
    const dv = b.map((v, j) => {
      const x = (v - (before[f] as number[])[j]!) / (end.t - before.t) - ((after[f] as number[])[j]! - a[j]!) / (after.t - first.t);
      return Math.abs(x) > 3 * corner(clip.keys as K[], f, j, c.dur) ? x : 0;
    });
    // a field whose poses meet and whose speeds differ by less than a whole unit's change is left as it is
    const pose = dp.some((x) => Math.abs(x) >= 0.5), speed = speeds && dv.some((x) => reach(x) >= 0.5);
    if (!pose && !speed) continue;
    const P = pose ? dp : dp.map(() => 0);
    for (const k of K) {
      const v = k[f] as number[] | undefined;
      if (!v) continue;
      let w: (j: number) => number;
      if (k.t >= T - W - 1e-9 && k.t <= T + 1e-9) {
        const u = (k.t - (T - W)) / W;
        w = (j) => -0.5 * (h01(u) * P[j]! + h11(u) * W * dv[j]!);
      } else if (k.t > T) w = (j) => -0.5 * (P[j]! + dv[j]! * (k.t - T));
      else if (k.t <= first.t + W + 1e-9) {
        const u = (k.t - first.t) / W;
        w = (j) => 0.5 * (h00(u) * P[j]! + h10(u) * W * dv[j]!);
      } else continue;
      k[f] = v.map((x, j) => Math.round(x + w(j)));
    }
    changes.push(pose ? `${f}: the last pose's ${dp.map((x) => Math.round(x)).join(", ")} from the first, and its speed's, spread over the cycle's ends (${fmt(W)} s either side)` : `${f}: the poses meet, its speeds (${dv.map((x) => Math.round(x)).join(", ")} a second apart) matched over the cycle's ends (${fmt(W)} s either side)`);
  }
  if (!changes.length) return { clip: c, changes };
  if (d.keys.length !== c.keys.length) changes.push(`keys ${c.keys.length} → ${d.keys.length}: the cycle's ends keyed every ${STEP} s`);
  return { clip: d, changes };
});

// ---- re-fit -------------------------------------------------------------------------------------------------------

/** A pose's worst point distance from another (mm), over every body point. */
function apart(A: ArrayLike<number>, B: ArrayLike<number>): number {
  let w = 0;
  for (let i = 0; i < A.length; i += 3) w = Math.max(w, PORTABLE.hypot(A[i]! - B[i]!, A[i + 1]! - B[i + 1]!, A[i + 2]! - B[i + 2]!));
  return w;
}
/** Keys a and b in-betweened at u, as the format does (every field linearly, from a's own where b lacks it). */
function lerp(a: K, b: K, u: number): K {
  const out: Record<string, unknown> = { t: a.t + (b.t - a.t) * u };
  for (const [f, v] of Object.entries(a)) {
    if (f === "t") continue;
    const w = b[f];
    out[f] = Array.isArray(v) ? v.map((x: number, j: number) => (Array.isArray(w) ? x + ((w[j] as number) - x) * u : x)) : typeof v === "number" && typeof w === "number" ? v + (w - v) * u : v;
  }
  return out as K;
}
/**
 * Key k's body points where the key puts them: turned by its yaw and carried by its root (forward and right, % of H0),
 * so dropping a key that bends the clip's travel or turn counts as much as one that bends a limb.
 */
function placed(R: Rest, k: K, out: Float32Array): Float32Array {
  format.decodePose(R, k as never, out);
  const root = k.root as number[] | undefined, yaw = typeof k.yaw === "number" ? (k.yaw * Math.PI) / 180 : 0;
  if (!root && !yaw) return out;
  const cy = PORTABLE.cos(yaw), sy = PORTABLE.sin(yaw), f = ((root?.[0] ?? 0) * R.H0) / 100, r = ((root?.[1] ?? 0) * R.H0) / 100;
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i]!, y = out[i + 1]!;
    out[i] = cy * x - sy * y + f;
    out[i + 1] = sy * x + cy * y + r;
  }
  return out;
}
/**
 * The keys to keep within `tol` mm: Ramer–Douglas–Peucker over the placed poses (the root's travel and yaw included),
 * in-betweened as the format does.
 */
function keep(K: K[], R: Rest, tol: number): number[] {
  const X = K.map((k) => placed(R, k, new Float32Array(format.P * 3)));
  const out = new Set([0, K.length - 1]), tmp = new Float32Array(format.P * 3);
  const split = (a: number, b: number) => {
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const e = apart(placed(R, lerp(K[a]!, K[b]!, (K[i]!.t - K[a]!.t) / (K[b]!.t - K[a]!.t)), tmp), X[i]!);
      if (e > worst) [worst, at] = [e, i];
    }
    if (at >= 0 && worst > tol) {
      out.add(at);
      split(a, at);
      split(at, b);
    }
  };
  split(0, K.length - 1);
  return [...out].sort((a, b) => a - b);
}
/**
 * Re-fit keys to a budget: the fewest keys whose in-betweens stay within the tolerance (5 mm) of every key dropped, the
 * root's travel and turn counted with the pose;
 * with `maxKeys`, the tolerance grows until the clip keeps at most that many. The first and last keys (and any past
 * the end) stay.
 */
export const refit: Operator = tidied((clip, R, _report, opts) => {
  const c = copy(clip), K = sorted(c) as K[], n = K.length;
  if (n <= 2) return { clip: c, changes: [] };
  let tol = opts.tolerance ?? 5, kept = keep(K, R, tol);
  if (opts.maxKeys !== undefined) for (let g = 0; g < 40 && kept.length > Math.max(2, opts.maxKeys); g++) kept = keep(K, R, (tol *= 1.25));
  const past = K.map((k, i) => (k.t > c.dur + 1e-9 ? i : -1)).filter((i) => i >= 0);
  const idx = [...new Set([...kept, ...past])].sort((a, b) => a - b);
  if (idx.length === n) return { clip: c, changes: [] };
  c.keys = idx.map((i) => K[i]!);
  return { clip: c, changes: [`keys ${n} → ${idx.length}, each dropped pose within ${tol < 10 ? tol.toFixed(1) : Math.round(tol)} mm`] };
});

/** Every operator by name. */
export const OPERATORS: Readonly<Record<FixName, Operator>> = { twistFlips, jitter, penetration, footLocks, seam, refit };
