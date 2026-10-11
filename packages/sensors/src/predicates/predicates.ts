// Predicates (PLAN.md WP-3.3): a small assertion language for expected motion, which tests, graders and agents write,
// and whose failures read as repair instructions (MoVer: verifier feedback of this kind lifted correct motion graphics
// from 58.8% to 93.6%). One predicate a line (or `;`-separated); seconds are written `0.33–0.60 s` or `0.33-0.60 s`:
//   footL planted 0.33–0.60 s, slide < 10 mm     an end planted throughout, optionally sliding less than that
//   footR free 0.20–0.40 s                       an end not planted anywhere in the interval
//   hit within 1 frame of strike                 an event within frames (1/30 s) or seconds of another, or of a strike
//   pelvis below 50% 0.40–0.55 s                 a body point's height in mm or % of hip height, at a time or over one
//   jitter < 5 mm                                any metric's worst value, or `speed` (m/s) and `travel` (hip heights),
//                                                in its unit or one that converts (mm, cm, m; mm/s, cm/s, m/s, km/h)
//   no pop                                       a metric with no finding (those folded into a twist flip included)
// An end is planted where the metrics measure it standing: its lowest point on the floor (not where the clip's contact
// labels say). Intervals run forward: `0.6–0.3 s` doesn't parse.
import { math, measureFacts, type Clip, type Rest } from "@m3a/core";
import { measure, type Report } from "../metrics/report.ts";
import { at, endPoints, lowest, motionOf, planted, STANCE, world, type End, type MetricClip, type Motion } from "../metrics/motion.ts";
import { METRICS, type MetricName } from "../metrics/thresholds.ts";

const { PORTABLE } = math;

/** A parsed predicate: its kind, its text, and its arguments. */
export type Predicate =
  | { kind: "planted"; text: string; end: End; t0: number; t1: number; slide?: number }
  | { kind: "free"; text: string; end: End; t0: number; t1: number }
  | { kind: "within"; text: string; event: string; of: string; tol: number; unit: "frame" | "s" }
  | { kind: "height"; text: string; point: string; above: boolean; value: number; unit: "mm" | "%"; t0: number; t1: number }
  | { kind: "compare"; text: string; metric: string; op: Op; value: number; unit: string }
  | { kind: "none"; text: string; metric: MetricName };
type Op = "<" | "<=" | ">" | ">=" | "=";

/** A predicate that doesn't parse: what was written, and the forms that would. */
export class PredicateError extends Error {
  readonly text: string;
  constructor(text: string, why: string) {
    super(`can't read "${text}": ${why}. Write one of: "footL planted 0.33–0.60 s, slide < 10 mm", "footR free 0.2–0.4 s", "hit within 1 frame of strike", "pelvis below 50% 0.4–0.55 s", "jitter < 5 mm", "no pop"`);
    this.name = "PredicateError";
    this.text = text;
  }
}

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const SPAN = String.raw`${NUM}\s*(?:s\s*)?(?:[–—-]|to)\s*${NUM}\s*s`;
const ENDS = ["footL", "footR", "handL", "handR"];
const POINT_NAMES = ["pelvis", "spine1", "spine2", "chest", "neck", "head", "headTop", "faceF", "chestF", "pelvisF", ...["L", "R"].flatMap((s) => ["clav", "sh", "elbow", "wrist", "index", "knuck", "pinky", "fist", "hip", "knee", "ankle", "ball", "toe"].map((p) => p + s))];
/** A time or an interval: "0.5 s" or "0.4–0.55 s". */
function times(s: string): [number, number] | null {
  const span = new RegExp(`^${SPAN}$`, "i").exec(s.trim());
  if (span) return [Number(span[1]), Number(span[2])];
  const one = new RegExp(`^(?:at\\s+)?${NUM}\\s*s$`, "i").exec(s.trim());
  return one ? [Number(one[1]), Number(one[1])] : null;
}

/** An interval that runs forward, or a PredicateError. */
function forward(text: string, t0: number, t1: number): [number, number] {
  if (!(t1 >= t0)) throw new PredicateError(text, `the interval ${t0}–${t1} s runs backwards: write the earlier time first`);
  return [t0, t1];
}
/** Each metric's unit (what its value is in) and the units a predicate may write it in, as factors to that unit. */
const LENGTH = { mm: 1, cm: 10, m: 1000 }, SPEED_MM = { "mm/s": 1, "cm/s": 10, "m/s": 1000 };
const UNITS: Readonly<Record<string, { unit: string; accept: Readonly<Record<string, number>> }>> = {
  slide: { unit: "mm", accept: LENGTH }, penetration: { unit: "mm", accept: LENGTH }, bodyPenetration: { unit: "mm", accept: LENGTH },
  jitter: { unit: "mm", accept: LENGTH }, seam: { unit: "mm", accept: LENGTH }, fit: { unit: "mm", accept: LENGTH }, symmetry: { unit: "mm", accept: LENGTH },
  pop: { unit: "mm/s", accept: SPEED_MM }, seamVelocity: { unit: "mm/s", accept: SPEED_MM },
  skate: { unit: "cm/s", accept: { "cm/s": 1, "mm/s": 0.1, "m/s": 100 } },
  speed: { unit: "m/s", accept: { "m/s": 1, "cm/s": 0.01, "mm/s": 0.001, "km/h": 1 / 3.6 } },
  twistFlip: { unit: "°", accept: { "°": 1, deg: 1, degrees: 1 } }, jointLimit: { unit: "°", accept: { "°": 1, deg: 1, degrees: 1 } },
  stretch: { unit: "%", accept: { "%": 1 } }, intersection: { unit: "of a width", accept: { "%": 0.01 } },
  travel: { unit: "hip heights", accept: {} }, nan: { unit: "values", accept: { values: 1 } }, events: { unit: "events", accept: { events: 1 } },
};

/** Parses predicates, one per line or `;`. Throws a PredicateError naming the one it can't read. */
export function parse(source: string): Predicate[] {
  return source.split(/[\n;]/).map((x) => x.trim()).filter((x) => x && !x.startsWith("#")).map(parseOne);
}
function parseOne(text: string): Predicate {
  let m = new RegExp(`^(\\w+)\\s+planted\\s+${SPAN}(?:\\s*,\\s*slide\\s*<\\s*${NUM}\\s*mm)?$`, "i").exec(text);
  if (m) {
    if (!ENDS.includes(m[1]!)) throw new PredicateError(text, `"${m[1]}" isn't an end (footL, footR, handL, handR)`);
    const [t0, t1] = forward(text, Number(m[2]), Number(m[3]));
    return { kind: "planted", text, end: m[1] as End, t0, t1, ...(m[4] ? { slide: Number(m[4]) } : {}) };
  }
  m = new RegExp(`^(\\w+)\\s+free\\s+${SPAN}$`, "i").exec(text);
  if (m) {
    if (!ENDS.includes(m[1]!)) throw new PredicateError(text, `"${m[1]}" isn't an end (footL, footR, handL, handR)`);
    const [t0, t1] = forward(text, Number(m[2]), Number(m[3]));
    return { kind: "free", text, end: m[1] as End, t0, t1 };
  }
  m = new RegExp(`^([\\w-]+)\\s+within\\s+${NUM}\\s*(frames?|s)\\s+of\\s+([\\w-]+)$`, "i").exec(text);
  if (m) return { kind: "within", text, event: m[1]!, tol: Number(m[2]), unit: m[3]!.startsWith("f") ? "frame" : "s", of: m[4]! };
  m = new RegExp(`^(\\w+)\\s+(above|below)\\s+${NUM}\\s*(mm|%)\\s*(.*)$`, "i").exec(text);
  if (m) {
    if (!POINT_NAMES.includes(m[1]!)) throw new PredicateError(text, `"${m[1]}" isn't a body point (pelvis, head, fistR, toeL, ...)`);
    const span = m[5]!.trim() ? times(m[5]!) : null;
    if (m[5]!.trim() && !span) throw new PredicateError(text, `"${m[5]}" isn't a time ("at 0.5 s") or an interval ("0.4–0.55 s")`);
    if (span) forward(text, span[0], span[1]);
    return { kind: "height", text, point: m[1]!, above: m[2]!.toLowerCase() === "above", value: Number(m[3]), unit: m[4] as "mm" | "%", t0: span?.[0] ?? 0, t1: span?.[1] ?? Infinity };
  }
  m = new RegExp(`^(\\w+)\\s*(<=|>=|<|>|=)\\s*${NUM}\\s*([\\w/%°]*)$`, "i").exec(text);
  if (m) {
    if (![...METRICS, "speed", "travel"].includes(m[1]!)) throw new PredicateError(text, `"${m[1]}" isn't a metric (${METRICS.join(", ")}, speed, travel)`);
    // the value in the metric's own unit: written in it, without one, or in one that converts
    const u = UNITS[m[1]!]!, w = m[4] ?? "", factor = !w || w === u.unit ? 1 : u.accept[w];
    if (factor === undefined) throw new PredicateError(text, `"${w}" isn't a unit ${m[1]} is measured in (${[u.unit, ...Object.keys(u.accept).filter((x) => x !== u.unit)].join(", ")})`);
    return { kind: "compare", text, metric: m[1]!, op: m[2] as Op, value: Number(m[3]) * factor, unit: u.unit };
  }
  m = /^no\s+(\w+)$/i.exec(text);
  if (m) {
    if (!(METRICS as readonly string[]).includes(m[1]!)) throw new PredicateError(text, `"${m[1]}" isn't a metric (${METRICS.join(", ")})`);
    return { kind: "none", text, metric: m[1] as MetricName };
  }
  throw new PredicateError(text, "it matches no form");
}

/** A predicate's outcome: whether it holds, what was found, and (when it doesn't) how to repair the motion. */
export interface Outcome {
  predicate: Predicate;
  ok: boolean;
  /** What the motion shows, in the predicate's terms. */
  got: string;
  /** Empty when it holds; else what is wrong and what to change. */
  repair: string;
}

const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
/** The samples within [t0, t1] (at least the nearest one). */
function samples(m: Motion, t0: number, t1: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < m.times.length; i++) if (m.times[i]! >= t0 - 1e-9 && m.times[i]! <= Math.min(t1, m.dur) + 1e-9) out.push(i);
  if (!out.length) out.push(Math.max(0, Math.min(m.times.length - 1, Math.round(t0 / m.dt))));
  return out;
}

/**
 * Checks predicates (text or parsed) against a clip on rest R. Each outcome says what the motion shows and, when it
 * fails, how to repair it. Throws a PredicateError for an interval that starts after the clip ends.
 */
export function check(predicates: string | readonly Predicate[], clip: MetricClip, R: Rest, report?: Report): Outcome[] {
  const preds = typeof predicates === "string" ? parse(predicates) : predicates, m = motionOf(clip, R);
  for (const p of preds) {
    const t0 = (p as { t0?: number }).t0;
    if (t0 !== undefined && t0 > m.dur + 1e-6) throw new PredicateError(p.text, `the interval starts at ${t0} s, after the clip ends at ${fmt(m.dur)} s${m.loop ? " (a loop's times are within its cycle)" : ""}`);
  }
  const rep = report ?? measure(m);
  return preds.map((p) => one(p, m, clip, R, rep));
}

function one(p: Predicate, m: Motion, clip: MetricClip, R: Rest, rep: Report): Outcome {
  const res = (ok: boolean, got: string, repair: string): Outcome => ({ predicate: p, ok, got, repair: ok ? "" : repair });
  switch (p.kind) {
    case "planted": {
      const idx = samples(m, p.t0, p.t1), off = idx.filter((i) => !planted(m, p.end, m.times[i]!));
      const up = Math.max(0, ...off.map((i) => lowest(m, i, p.end).p[2]));
      const ivs = (m.contacts[p.end] ?? []).map(([a, b]) => `${fmt(a)}–${fmt(b)} s`).join(", ") || "never";
      const why = up > STANCE.exit * m.rest.H0 ? `it is ${fmt(up, 0)} mm up): lower it to the floor there` : "it is on the floor but moves as fast as a swing): hold it still there";
      if (off.length) return res(false, `${p.end} is planted ${ivs}`, `${p.end} is not planted at ${fmt(m.times[off[0]!]!)}–${fmt(m.times[off[off.length - 1]!]!)} s (${why}${ivs !== "never" ? `, or expect it planted ${ivs}` : ""}`);
      if (p.slide !== undefined) {
        let path = 0;
        for (let k = 0; k + 1 < idx.length; k++) {
          const i = idx[k]!, low = lowest(m, i, p.end), nxt = endPoints(m, m.frames[i + 1]!, p.end).find((x) => x.name === low.name)!;
          const w0 = world(m, i, low.p), w1 = world(m, i + 1, nxt.p);
          path += PORTABLE.hypot(w1[0] - w0[0], w1[1] - w0[1]);
        }
        if (!(path < p.slide)) return res(false, `${p.end} slides ${fmt(path, 0)} mm`, `${p.end} slides ${fmt(path, 0)} mm over ${fmt(p.t0)}–${fmt(p.t1)} s (want under ${p.slide}): hold it still while planted (fix: bake foot locks)`);
        return res(true, `${p.end} planted ${fmt(p.t0)}–${fmt(p.t1)} s, slides ${fmt(path, 0)} mm`, "");
      }
      return res(true, `${p.end} planted ${ivs}`, "");
    }
    case "free": {
      const on = samples(m, p.t0, p.t1).filter((i) => planted(m, p.end, m.times[i]!));
      return on.length ? res(false, `${p.end} is planted at ${fmt(m.times[on[0]!]!)} s`, `${p.end} is planted at ${fmt(m.times[on[0]!]!)}–${fmt(m.times[on[on.length - 1]!]!)} s: lift it off the floor there`) : res(true, `${p.end} free`, "");
    }
    case "within": {
      const frame = 1 / ((clip as Partial<Clip>).fps ?? 30), tol = p.unit === "frame" ? p.tol * frame : p.tol;
      const ev = m.events.filter((e) => e.name === p.event);
      if (!ev.length) return res(false, `no event "${p.event}"`, `add an event "${p.event}"${p.of === "strike" ? " at the strike" : ""}`);
      const targets = p.of === "strike" ? (measureFacts(clip as Clip, R).strike ?? []) : m.events.filter((e) => e.name === p.of).map((e) => e.t);
      if (!targets.length) return res(false, `no ${p.of === "strike" ? "strike" : `event "${p.of}"`}`, p.of === "strike" ? "the clip has no strike to time it by" : `add an event "${p.of}"`);
      const best = ev.flatMap((e) => targets.map((t) => ({ e: e.t, t, d: e.t - t }))).reduce((a, b) => (Math.abs(b.d) < Math.abs(a.d) ? b : a));
      const ok = Math.abs(best.d) <= tol + 1e-9, frames = best.d / frame;
      return res(ok, `${p.event} at ${fmt(best.e)} s, ${fmt(Math.abs(frames), 1)} frames ${best.d >= 0 ? "after" : "before"} ${p.of} (${fmt(best.t)} s)`, `move "${p.event}" to ${fmt(best.t)} s: it is ${fmt(Math.abs(frames), 1)} frames ${best.d >= 0 ? "after" : "before"} ${p.of === "strike" ? "the strike" : `"${p.of}"`}`);
    }
    case "height": {
      const k = p.unit === "%" ? 100 / R.H0 : 1, idx = samples(m, p.t0, p.t1);
      const z = idx.map((i) => at(m.frames[i]!, p.point)[2] * k), bad = idx.filter((_, j) => (p.above ? !(z[j]! > p.value) : !(z[j]! < p.value)));
      const worst = p.above ? Math.min(...z) : Math.max(...z), u = p.unit === "%" ? "% of hip height" : " mm";
      return bad.length ? res(false, `${p.point} at ${fmt(worst, 0)}${u}`, `${p.point} is ${p.above ? "down" : "up"} at ${fmt(worst, 0)}${u} at ${fmt(m.times[bad[0]!]!)}–${fmt(m.times[bad[bad.length - 1]!]!)} s (want ${p.above ? "above" : "below"} ${p.value}${p.unit}): ${p.above ? "raise" : "lower"} it there`) : res(true, `${p.point} ${p.above ? "above" : "below"} ${p.value}${p.unit}`, "");
    }
    case "compare": {
      let got: number;
      const unit = UNITS[p.metric]!.unit;
      if (p.metric === "speed" || p.metric === "travel") {
        const f = measureFacts(clip as Clip, R), tr = f.travel ?? [0, 0];
        got = p.metric === "speed" ? ((f.speed ?? 0) * R.H0) / 100 / 1000 : PORTABLE.hypot(tr[0], tr[1]) / 100;
      } else got = rep.values[p.metric as MetricName];
      const ok = p.op === "<" ? got < p.value : p.op === "<=" ? got <= p.value : p.op === ">" ? got > p.value : p.op === ">=" ? got >= p.value : Math.abs(got - p.value) < 1e-6;
      return res(ok, `${p.metric} is ${fmt(got, 2)} ${unit}`, `${p.metric} is ${fmt(got, 2)} ${unit} (want ${p.op} ${+p.value.toPrecision(6)} ${unit})${HINT[p.metric] ? ": " + HINT[p.metric] : ""}`);
    }
    case "none": {
      const fs = [...rep.findings, ...rep.folded].filter((f) => f.metric === p.metric);
      return fs.length ? res(false, `${fs.length} ${p.metric} finding(s)`, fs.slice(0, 3).map((f) => f.message).join("; ")) : res(true, `no ${p.metric}`, "");
    }
  }
}
/** How to repair what a metric measures. */
const HINT: Readonly<Record<string, string>> = {
  slide: "hold planted feet still (fix: bake foot locks)", skate: "hold planted feet still (fix: bake foot locks), or match the root's speed to the stride", penetration: "lift the soles onto the floor (fix: lift penetration)", jitter: "smooth it (fix: filter jitter)",
  pop: "ease into the poses that jump", seam: "close the loop's seam (fix: close a loop seam)", seamVelocity: "match the loop's end velocities (fix: close a loop seam)",
  twistFlip: "unwrap the twists (fix: repair twist flips)", speed: "retime the clip (ops.retime) or change its stride", travel: "change how far the root goes",
};
