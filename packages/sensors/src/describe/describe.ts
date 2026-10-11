// Describe (PLAN.md WP-3.4): a clip as a short text timeline in the format's own words, built from its contacts, its
// heights, its extremes, its events and its travel: "0.00–0.40 s crouches (hips 52%); 0.40–0.55 s in the air; lands on
// the left foot at 0.58 s; travels 1.2 hip heights forward". Phases come from a fixed vocabulary (stand, walk, run,
// crouch, sit, lie, air) by rule, so the same clip always reads the same: at most 150 tokens by default, more with
// `detail`.
import { math, measureFacts, type Clip, type Rest } from "@m3a/core";
import { at, motionOf, stance, type MetricClip, type Motion } from "../metrics/motion.ts";
import { capsules } from "../raster/mannequin.ts";

const { PORTABLE } = math;

/** The phases a timeline names. */
export const PHASES = ["stand", "walk", "run", "crouch", "sit", "lie", "air"] as const;
/** A phase's name. */
export type PhaseName = (typeof PHASES)[number];

/** One phase: its name, its span, and what it is like (the hips' height, which way a body lies, steps taken). */
export interface Phase {
  name: PhaseName;
  t0: number;
  t1: number;
  detail: string;
}
/** One moment: a landing, a strike, a turn or an event of the clip's. */
export interface Moment {
  name: string;
  t: number;
  text: string;
}
/** A clip's description: its phases in order, its moments, its travel, and the text. */
export interface Description {
  clip: string;
  phases: Phase[];
  moments: Moment[];
  /** Hip heights travelled (forward, right) over the clip, or per cycle for a loop. */
  travel: [number, number];
  text: string;
}

/** How a description reads: `detail` adds every moment and each phase's particulars. */
export interface DescribeOptions {
  detail?: boolean;
}

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** Each sample's posture by rule, and what the rule read. */
interface Sample {
  posture: PhaseName;
  /** The pelvis's height against its rest height. */
  hips: number;
  /** The pelvis's vertical speed, in hip heights per second. */
  rise: number;
  /** Each foot's lowest sole point's height (mm). */
  feet: [number, number];
  /** Which way the chest faces up (+1 on the back, −1 on the front), when lying. */
  chestUp: number;
}

/**
 * The posture at one sample, by the vocabulary's definitions (describe-truth.json):
 * - air: no part of the body (the mannequin's surface) within 6% of hip height of the floor;
 * - lie: the trunk (pelvis to neck) more than 60° from upright and low: the pelvis under 60% of its rest height, the
 *   neck under 45% of hip height (a three-point landing leans as far, its neck well up);
 * - sit: the trunk upright, and either the pelvis on the floor (under 45%) or seated back on a chair (under 80%, behind
 *   both ankles by over 28% of hip height, the thighs level within 20%);
 * - crouch: the pelvis under 80% of its rest height;
 * - stand: otherwise.
 */
function posture(X: ArrayLike<number>, R: Rest): Omit<Sample, "rise"> {
  const P = (n: string) => at(X, n) as V, pelvis = P("pelvis"), neck = P("neck"), d = sub(neck, pelvis);
  const tilt = (PORTABLE.acos(Math.max(-1, Math.min(1, d[2] / (Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1)))) * 180) / Math.PI;
  const hips = pelvis[2] / R.hipZ, H = R.H0;
  const foot = (s: string) => Math.min(P("ankle" + s)[2] - R.ankleZ, P("ball" + s)[2], P("toe" + s)[2]);
  const feet: [number, number] = [foot("L"), foot("R")];
  // the body's lowest surface: its points are inside it, so a back on the floor leaves them a torso's depth up
  let low = Infinity;
  for (const c of capsules(X)) low = Math.min(low, c.a[2] - c.ra, c.b[2] - c.rb);
  const chestUp = Math.sign(P("chestF")[2] - P("chest")[2]);
  if (Math.min(low, ...feet) > 0.06 * H) return { posture: "air", hips, feet, chestUp };
  if (tilt > 60 && hips < 0.6 && neck[2] < 0.45 * H) return { posture: "lie", hips, feet, chestUp };
  // the body's forward on the floor, from the pelvis's front point
  const f = sub(P("pelvisF"), pelvis), fl = Math.hypot(f[0], f[1]) || 1, ahead = (p: V) => ((p[0] - pelvis[0]) * f[0] + (p[1] - pelvis[1]) * f[1]) / fl;
  const seated = hips < 0.8 && Math.min(ahead(P("ankleL")), ahead(P("ankleR"))) > 0.28 * H && Math.abs((P("kneeL")[2] + P("kneeR")[2]) / 2 - (P("hipL")[2] + P("hipR")[2]) / 2) < 0.2 * H;
  if (tilt < 50 && (hips < 0.45 || seated)) return { posture: "sit", hips, feet, chestUp };
  return { posture: hips < 0.8 ? "crouch" : "stand", hips, feet, chestUp };
}

/** A stretch of samples with one label. */
interface Run {
  name: PhaseName;
  i0: number;
  i1: number;
}
/** Consecutive equal labels as runs. */
function runsOf(labels: readonly PhaseName[]): Run[] {
  const out: Run[] = [];
  labels.forEach((name, i) => {
    const last = out[out.length - 1];
    if (last && last.name === name) last.i1 = i;
    else out.push({ name, i0: i, i1: i });
  });
  return out;
}

/** The phases of a motion: postures by sample, gaits over them, transitions merged into the phases they join. */
function phasesOf(m: Motion): { phases: Run[]; samples: Sample[] } {
  const R = m.rest, n = m.frames.length;
  const base = m.frames.map((X) => posture(X, R));
  const samples: Sample[] = base.map((s, i) => {
    const a = base[Math.max(0, i - 2)]!, b = base[Math.min(n - 1, i + 2)]!, dt = (Math.min(n - 1, i + 2) - Math.max(0, i - 2)) * m.dt;
    return { ...s, rise: dt > 0 ? ((b.hips - a.hips) * R.hipZ) / R.H0 / dt : 0 };
  });
  const labels: PhaseName[] = samples.map((s) => s.posture);
  // gaits: steps, each foot landing in its turn (a foot landing again before the other counts once; feet landing
  // within 0.15 s of each other are one landing, as from a jump), three or more, each within 1.5 s of the one before.
  // A foot lands where it comes down to the floor and stays 0.08 s, the body upright (not lying, seated or in the air).
  // Where it comes down is read two ways and both count: where it stands (the metrics' stance: on the floor and slow,
  // which sees a low sneaking step's swing) and where it is down by height alone (an in-place loop without a treadmill
  // slides its planted foot back under the body faster than a stance). A foot down from the clip's start, or the whole
  // of a loop, hasn't landed
  const down = stance(m, true), all: { t: number; s: "L" | "R" }[] = [];
  for (const s of ["L", "R"] as const) {
    for (const [a, b] of [...(m.contacts[`foot${s}`] ?? []), ...(down[`foot${s}`] ?? [])]) {
      if (b - a < 0.08 - 1e-9 || (!m.loop && a < m.dt / 2) || (m.loop && a < m.dt / 2 && b > m.dur - m.dt / 2)) continue;
      const lab = labels[Math.min(n - 1, Math.round(a / m.dt))]!;
      if (lab === "lie" || lab === "sit" || lab === "air") continue;
      all.push({ t: a, s });
      if (m.loop) all.push({ t: a - m.dur, s }, { t: a + m.dur, s }, { t: a + 2 * m.dur, s });
    }
  }
  all.sort((a, b) => a.t - b.t);
  const landings: { t: number; s: "L" | "R" }[] = [];
  for (const x of all) {
    const last = landings[landings.length - 1];
    if (last && (last.s === x.s || x.t - last.t < 0.15)) continue;
    landings.push(x);
  }
  const spans: [number, number][] = [];
  let start = 0;
  for (let k = 1; k <= landings.length; k++) {
    if (k < landings.length && landings[k]!.t - landings[k - 1]!.t <= 1.5) continue;
    if (k - start >= 3) spans.push([landings[start]!.t, landings[k - 1]!.t]);
    start = k;
  }
  for (const [a, b] of spans) {
    // within a gait a flight under 0.4 s is a running stride (a jog in place floats 0.27 s); a longer one stays in the
    // air (a leap)
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (m.times[i]! >= a - 0.3 && m.times[i]! <= b + 0.3) idx.push(i);
    const flights = runsOf(idx.map((i) => labels[i]!)).filter((r) => r.name === "air");
    const running = flights.some((r) => (r.i1 - r.i0 + 1) * m.dt >= 0.05 && (r.i1 - r.i0 + 1) * m.dt < 0.4);
    const long = new Set(flights.filter((r) => (r.i1 - r.i0 + 1) * m.dt >= 0.4).flatMap((r) => Array.from({ length: r.i1 - r.i0 + 1 }, (_, j) => idx[r.i0 + j]!)));
    for (const i of idx) if (!long.has(i) && labels[i] !== "lie" && labels[i] !== "sit") labels[i] = running ? "run" : "walk";
  }
  // a phase lasts 0.15 s; a stand, crouch or sit is one only where the pelvis holds (rises or falls slower than 0.4
  // hip heights a second) for 0.2 s, or, for a crouch, where it bottoms out: it comes down into it and goes up out of
  // it (a landing's crouch; on the way into or out of a seat the pelvis only falls, or only rises). A pose at the
  // clip's start or end is one when it lasts 0.1 s: the clip begins or ends in it (in the air, 0.05 s: a clip that
  // opens falling). Anything else is a transition, and joins the phase it leads into (at the clip's end, the one
  // before)
  let runs = runsOf(labels);
  const holds = (r: Run) => {
    const len = (r.i1 - r.i0 + 1) * m.dt;
    if (r.i0 === 0 || r.i1 === n - 1) return len >= (r.name === "air" ? 0.05 : 0.1) - 1e-9;
    if (r.name !== "stand" && r.name !== "crouch" && r.name !== "sit") return len >= 0.15;
    if (r.name === "crouch" && len >= 0.15) {
      const span = samples.slice(r.i0, r.i1 + 1), fall = span.findIndex((x) => x.rise < -0.4);
      if (fall >= 0 && span.slice(fall).some((x) => x.rise > 0.4)) return true;
    }
    let best = 0, cur = 0;
    for (let i = r.i0; i <= r.i1; i++) [cur, best] = Math.abs(samples[i]!.rise) < 0.4 ? [cur + 1, Math.max(best, cur + 1)] : [0, best];
    return best * m.dt >= 0.2;
  };
  for (let guard = 0; guard < 200 && runs.length > 1; guard++) {
    const weak = runs.map((r, k) => ({ r, k })).filter(({ r }) => !holds(r)).sort((a, b) => a.r.i1 - a.r.i0 - (b.r.i1 - b.r.i0) || a.r.i0 - b.r.i0)[0];
    if (!weak) break;
    const { r, k } = weak, into = runs[k + 1] ?? runs[k - 1]!;
    for (let i = r.i0; i <= r.i1; i++) labels[i] = into.name;
    runs = runsOf(labels);
  }
  return { phases: runs, samples };
}

const VERB: Readonly<Record<PhaseName, string>> = { stand: "stands", walk: "walks", run: "runs", crouch: "crouches", sit: "sits", lie: "lies", air: "in the air" };
const fmt = (t: number) => t.toFixed(2);
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Describes a clip on rest R: its phases in order, its moments, its travel, and the text (at most 150 tokens). */
export function describe(clip: MetricClip, R: Rest, opts: DescribeOptions = {}): Description {
  const m = motionOf(clip, R), { phases: runs, samples } = phasesOf(m), down = stance(m, true);
  const phases: Phase[] = runs.map((r) => {
    const span = samples.slice(r.i0, r.i1 + 1), hips = span.reduce((a, s) => a + s.hips, 0) / span.length;
    const steps = (["L", "R"] as const).reduce((a, s) => a + (down[`foot${s}`] ?? []).filter(([t]) => t >= m.times[r.i0]! && t <= m.times[r.i1]!).length, 0);
    const detail = r.name === "crouch" || r.name === "sit" ? `hips ${pct(hips)}` : r.name === "lie" ? (span.filter((s) => s.chestUp > 0).length * 2 >= span.length ? "on the back" : "on the front") : r.name === "walk" || r.name === "run" ? `${steps} steps` : r.name === "air" ? `hips ${pct(Math.max(...span.map((s) => s.hips)))}` : "";
    return { name: r.name, t0: m.times[r.i0]!, t1: m.times[r.i1]!, detail };
  });
  const moments: Moment[] = [];
  // landings: what comes down first after the air (the lower foot, or the back or front for a fall onto the floor)
  phases.forEach((p, k) => {
    const next = phases[k + 1];
    if (p.name !== "air" || !next) return;
    const i = Math.min(m.frames.length - 1, Math.round(next.t0 / m.dt)), f = samples[i]!.feet;
    const what = next.name === "lie" ? `on the ${next.detail.replace(/^on the /, "")}` : next.name === "sit" ? "seated" : `on the ${f[0] <= f[1] ? "left" : "right"} foot`;
    moments.push({ name: "land", t: next.t0, text: `lands ${what} at ${fmt(next.t0)} s` });
  });
  // strikes: the fastest end at each strike the facts measured
  const facts = measureFacts(clip as Clip, R);
  for (const t of facts.strike ?? []) {
    const i = Math.max(1, Math.min(m.frames.length - 1, Math.round(t / m.dt)));
    let best = "", speed = 0;
    for (const e of ["fistL", "fistR", "toeL", "toeR"]) {
      const a = at(m.frames[i - 1]!, e), b = at(m.frames[i]!, e), pa = at(m.frames[i - 1]!, "pelvis"), pb = at(m.frames[i]!, "pelvis");
      const v = Math.hypot(b[0] - a[0] - (pb[0] - pa[0]), b[1] - a[1] - (pb[1] - pa[1]), b[2] - a[2] - (pb[2] - pa[2])) / m.dt;
      if (v > speed) [best, speed] = [e, v];
    }
    const limb = best.startsWith("fist") ? `${best.endsWith("L") ? "left" : "right"} fist` : `${best.endsWith("L") ? "left" : "right"} foot`;
    moments.push({ name: "strike", t, text: `strikes with the ${limb} at ${fmt(t)} s` });
  }
  for (const e of m.events) moments.push({ name: e.name, t: e.t, text: `"${e.name}" at ${fmt(e.t)} s` });
  moments.sort((a, b) => a.t - b.t);
  const tr = facts.travel ?? [0, 0], travel: [number, number] = [tr[0] / 100, tr[1] / 100];
  return { clip: m.id, phases, moments, travel, text: textOf(m, phases, moments, travel, opts.detail === true) };
}

/** The timeline: phases and moments in time order, then the travel; capped at 150 tokens (about 600 characters). */
function textOf(m: Motion, phases: Phase[], moments: Moment[], travel: [number, number], detail: boolean): string {
  const items: { t: number; s: string }[] = [
    ...phases.map((p) => ({ t: p.t0, s: `${fmt(p.t0)}–${fmt(p.t1)} s ${VERB[p.name]}${p.detail && (detail || p.name === "crouch" || p.name === "lie") ? ` (${p.detail})` : ""}` })),
    ...moments.filter((x) => detail || x.name === "land" || x.name === "strike").map((x) => ({ t: x.t, s: x.text })),
  ].sort((a, b) => a.t - b.t);
  const far = Math.hypot(travel[0], travel[1]);
  const way = Math.abs(travel[0]) >= Math.abs(travel[1]) ? (travel[0] >= 0 ? "forward" : "back") : travel[1] >= 0 ? "to the right" : "to the left";
  const tail = far >= 0.1 ? [`travels ${far.toFixed(1)} hip heights ${way}${m.loop ? " a cycle" : ""}`] : [];
  const head = m.loop ? [`a ${fmt(m.dur)} s loop`] : [];
  let parts = [...head, ...items.map((x) => x.s), ...tail];
  if (!detail) while (parts.join("; ").length > 600 && parts.length > 2) parts = [...parts.slice(0, -2), parts[parts.length - 1]!];
  return parts.join("; ");
}
