// `metrics(clip, R)` (PLAN.md WP-3.3): every metric over a clip, with its profile's checks turned off, as a report
// (`report.json`: the values, the findings with their times) and a verdict a model reads in at most 20 lines.
import type { Rest } from "@m3a/core";
import * as check from "./checks.ts";
import { motionOf, type MetricClip, type Motion } from "./motion.ts";
import { METRICS, PROFILES, type MetricName } from "./thresholds.ts";

/** A clip's measurements: its values, its findings (worst first), its verdict and the verdict's text. */
export interface Report {
  clip: string;
  dur: number;
  loop: boolean;
  /** Samples per second the metrics read. */
  rate: number;
  /** The tag profiles that apply, and the checks they turn off. */
  profiles: string[];
  off: MetricName[];
  /** Each metric's worst value over the clip (in its threshold's unit); and skateMean, the mean skate over every contact's time (cm/s). */
  values: Record<MetricName, number> & { skateMean: number };
  /** The findings, worst first; a twist flip's swing folded into it (see `folded`). */
  findings: check.Finding[];
  /** The jitter and pops a twist flip caused, folded into its finding (each still a finding of its metric). */
  folded: check.Finding[];
  verdict: "pass" | "warn" | "fail";
  /** The verdict and its findings, at most 20 lines, each finding with its times and how to repair it. */
  text: string;
}

/** The profiles a clip's tags (or name) put it in. */
export function profilesOf(tags: readonly string[], id = ""): string[] {
  return Object.entries(PROFILES).filter(([, p]) => p.tags.some((t) => tags.includes(t)) || (p.names?.test(id) ?? false)).map(([name]) => name);
}

/** How to measure: another clip to check symmetry against (its mirror), profiles to add or take, and the rate. */
export interface MetricsOptions {
  /** The clip this one should mirror (a left jab for a right). */
  mirrorOf?: MetricClip;
  /** Profiles instead of the tags' ones. */
  profiles?: readonly string[];
  /** Samples per second (60). */
  rate?: number;
}

/** Every metric over clip `clip` on rest R: its report. */
export function metrics(clip: MetricClip, R: Rest, opts: MetricsOptions = {}): Report {
  return measure(motionOf(clip, R, opts.rate ?? 60), opts.mirrorOf ? motionOf(opts.mirrorOf, R, opts.rate ?? 60) : undefined, opts.profiles);
}

/** Every metric over a sampled motion (a clip's, or captured frames'), against an optional mirrored pair. */
export function measure(m: Motion, mirror?: Motion, profiles?: readonly string[]): Report {
  const prof = profiles ? [...profiles] : profilesOf(m.tags, m.id), off = [...new Set(prof.flatMap((p) => PROFILES[p]?.off ?? []))];
  const s = check.slide(m), p = check.penetration(m), sm = check.seam(m);
  const all: Record<MetricName, check.Measured> = {
    slide: s, skate: s.skate, penetration: p.soles, bodyPenetration: p.body, intersection: check.intersection(m), jitter: check.jitter(m), pop: check.pops(m),
    twistFlip: check.twistFlips(m), jointLimit: check.jointLimits(m), stretch: check.stretch(m), seam: sm.pose, seamVelocity: sm.velocity,
    fit: check.fit(m), nan: check.nan(m), events: check.events(m), symmetry: mirror ? check.symmetry(m, mirror) : { value: 0, findings: [] },
  };
  const values = Object.fromEntries(METRICS.map((k) => [k, round(all[k].value)])) as Record<MetricName, number> & { skateMean: number };
  values.skateMean = round(s.skateMean);
  const { findings, folded } = consequences(m, METRICS.filter((k) => !off.includes(k)).flatMap((k) => all[k].findings));
  findings.sort((a, b) => (a.level === b.level ? 0 : a.level === "fail" ? -1 : 1) || a.t0 - b.t0);
  const verdict = findings.some((f) => f.level === "fail") ? "fail" : findings.length ? "warn" : "pass";
  return { clip: m.id, dur: m.dur, loop: m.loop, rate: m.rate, profiles: prof, off, values, findings, folded, verdict, text: verdictText(m, verdict, findings, prof) };
}
const round = (x: number) => Math.round(x * 1000) / 1000;

/**
 * The points a twist flip swings: a foot's heading moves its ball and toes; a limb's twist swings its middle joint and
 * what hangs off it (not the end it aims at: the ankle or the fist stays); a hand's roll its knuckles and fingers.
 */
const SWUNG: Readonly<Record<string, readonly string[]>> = {
  footL: ["ballL", "toeL"], footR: ["ballR", "toeR"],
  legL: ["kneeL", "ballL", "toeL"], legR: ["kneeR", "ballR", "toeR"],
  armL: ["elbowL", "wristL", "knuckL", "indexL", "pinkyL"], armR: ["elbowR", "wristR", "knuckR", "indexR", "pinkyR"],
  handL: ["knuckL", "fistL", "indexL", "pinkyL"], handR: ["knuckR", "fistR", "indexR", "pinkyR"],
};
/**
 * Jitter and pops that a twist flip causes fold into the flip's finding, so the report names the cause once ("repair
 * the flip", not "smooth the toes"): those on the points it swings, within its key interval (one sample's slack). A
 * straight limb's twist swings nothing it can show, so nothing folds into it. The flip takes the worst level it folds.
 */
function consequences(m: Motion, all: check.Finding[]): { findings: check.Finding[]; folded: check.Finding[] } {
  const flips = all.filter((f) => f.metric === "twistFlip" && !/where the limb is straight/.test(f.message)), slack = m.dt + 1e-9;
  const folded: check.Finding[] = [], by = new Map<check.Finding, check.Finding>();
  for (const f of all) {
    if (f.metric !== "jitter" && f.metric !== "pop") continue;
    const x = flips.find((x) => (SWUNG[x.where ?? ""] ?? []).includes(f.where ?? "") && f.t0 >= x.t0 - slack && f.t1 <= x.t1 + slack);
    if (x) {
      folded.push(f);
      by.set(f, x);
    }
  }
  const findings = all.filter((f) => !by.has(f)).map((f) => {
    const mine = folded.filter((y) => by.get(y) === f);
    if (!mine.length) return f;
    const level = f.level === "fail" || mine.some((y) => y.level === "fail") ? "fail" : "warn";
    const swung = [...new Set(mine.map((y) => `${y.where}'s ${y.metric} (${y.level})`))].join(", ");
    return { ...f, level, message: `${f.message}; it swings ${swung}${level !== f.level ? ", so it fails" : ""}` } as check.Finding;
  });
  return { findings, folded };
}

/** The verdict in at most 20 lines: the clip and its verdict, then the findings worst first, then how many more. */
function verdictText(m: Motion, verdict: Report["verdict"], findings: check.Finding[], profiles: string[]): string {
  const fails = findings.filter((f) => f.level === "fail").length;
  const head = `${m.id}: ${verdict.toUpperCase()}${findings.length ? ` (${fails} fail, ${findings.length - fails} warn)` : ""}, ${m.dur.toFixed(2)} s${m.loop ? " loop" : ""}${profiles.length ? `, profile ${profiles.join(", ")}` : ""}`;
  const lines = findings.slice(0, 18).map((f) => `${f.level.toUpperCase()} ${f.metric}: ${f.message}`);
  if (findings.length > 18) lines.push(`... ${findings.length - 18} more in report.json`);
  return [head, ...lines].join("\n");
}
