// Lint and fix (PLAN.md WP-3.5): `lint(clip, R)` lists what `fix` would change and why (the metrics' findings each
// operator answers); `fix(clip, R)` applies the operators in order, each with the metrics before and after it and a
// line for every change. A step the metrics read as worse is not applied, and says why: one that would push a metric
// past a level (warn or fail) it was under, raise one already at warn or past it by more than 5%, add findings, or
// (an operator that answers metrics) lower none of the metrics it answers that were found. No clip changes silently:
// after every operator its `dur`, events and contacts are compared with what they were, and any that moved is reported
// with the operator's own changes; when anything changed, a clip's stored facts are measured again at the end, and
// what they say differently is reported too.
import { measureFacts, type Clip, type Rest } from "@m3a/core";
import { levels, type Finding } from "../metrics/checks.ts";
import { motionOf, type Motion } from "../metrics/motion.ts";
import { metrics, type Report } from "../metrics/report.ts";
import { METRICS } from "../metrics/thresholds.ts";
import { FIXES, OPERATORS, type FixName, type FixOptions, type Operator } from "./ops.ts";

/** One thing lint found to fix: the operator, and the findings (or the reason) it answers. */
export interface LintItem {
  op: FixName;
  why: string[];
}
/** A clip's lint: what to fix, in the order `fix` applies it, and the text (at most 20 lines). */
export interface Lint {
  clip: string;
  items: LintItem[];
  text: string;
}
/** One operator's run: what it changed, and the metrics' values and findings before and after. */
export interface FixStep {
  op: string;
  changes: string[];
  /** When the operator didn't run: why. */
  skipped?: string;
  /** When the step was not applied: what it would have made worse. */
  rejected?: string[];
  before: Report["values"];
  after: Report["values"];
  /** The findings before and after, by metric. */
  findings: { before: Record<string, number>; after: Record<string, number> };
}
/** A fix: the clip repaired, each operator's step, the reports before and after, and the text. */
export interface FixReport {
  clip: Clip;
  steps: FixStep[];
  before: Report;
  after: Report;
  text: string;
}

/** Which metrics' findings each operator answers. */
export const ANSWERS: Readonly<Record<FixName, readonly string[]>> = {
  twistFlips: ["twistFlip"], jitter: ["jitter", "pop"], penetration: ["penetration"], footLocks: ["slide", "skate"], seam: ["seam", "seamVelocity"], refit: [],
};
/** Keys a second past which re-fitting is suggested: the library's 30 fps grid. */
const DENSE = 30;

/** What `fix` would change in clip `clip` on rest R, and why. */
export function lint(clip: Clip, R: Rest, report: Report = metrics(clip, R)): Lint {
  const items: LintItem[] = [];
  for (const op of FIXES) {
    const why = report.findings.filter((f) => ANSWERS[op].includes(f.metric)).map((f) => `${f.metric}: ${f.message}`);
    if (op === "refit" && clip.dur > 0 && clip.keys.length / clip.dur > DENSE + 0.5) why.push(`${clip.keys.length} keys in ${clip.dur.toFixed(2)} s, more than ${DENSE} a second`);
    if (why.length) items.push({ op, why });
  }
  const lines = items.flatMap((i) => [`${i.op} (${i.why.length}):`, ...i.why.slice(0, 3).map((w) => `  ${w}`), ...(i.why.length > 3 ? [`  ... ${i.why.length - 3} more`] : [])]);
  const text = [`${clip.id}: ${items.length ? `fix ${items.map((i) => i.op).join(", ")}` : "nothing to fix"}`, ...lines].slice(0, 20).join("\n");
  return { clip: clip.id, items, text };
}

const count = (fs: readonly Finding[]) => fs.reduce<Record<string, number>>((a, f) => ((a[f.metric] = (a[f.metric] ?? 0) + 1), a), {});
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** What an operator moved that it must not move silently: `dur`, the events, the contacts. */
function moved(a: Clip, b: Clip): string[] {
  const out: string[] = [];
  if (a.dur !== b.dur) out.push(`dur ${a.dur} → ${b.dur} s`);
  if (!same(a.events, b.events)) out.push(`events ${JSON.stringify(a.events ?? [])} → ${JSON.stringify(b.events ?? [])}`);
  if (!same(a.contacts, b.contacts)) out.push(`contacts ${JSON.stringify(a.contacts ?? null)} → ${JSON.stringify(b.contacts ?? null)}`);
  return out;
}

/** Edit distance, for "did you mean". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) [prev, row[j]] = [row[j]!, Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))];
  }
  return row[b.length]!;
}
/** A metric's level at value v: 0 under its warn level, 1 at warn, 2 at fail. */
const level = (m: Motion, k: (typeof METRICS)[number], v: number) => (v >= levels(m, k).fail ? 2 : v >= levels(m, k).warn ? 1 : 0);
const num = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1));
/** How much a metric already at its warn level or past it may rise in a step: 5%. */
const RISE = 1.05;
/**
 * What a step makes worse, one line each: a metric pushed past a level it was under, a metric already at warn or past
 * it raised more than 5%, more findings than before, or (for an operator that answers metrics) none of those it answers
 * lowered.
 */
export function worse(m: Motion, before: Report, after: Report, answers: readonly string[] = []): string[] {
  const out = METRICS.filter((k) => !before.off.includes(k)).flatMap((k) => {
    const a = level(m, k, before.values[k]), b = level(m, k, after.values[k]);
    if (b > a) return [`${k} ${num(before.values[k])} → ${num(after.values[k])}, past its ${b === 2 ? "fail" : "warn"} level`];
    return a >= 1 && after.values[k] > before.values[k] * RISE ? [`${k} ${num(before.values[k])} → ${num(after.values[k])}, past its warn level already and up more than 5%`] : [];
  });
  if (after.findings.length > before.findings.length) out.push(`findings ${before.findings.length} → ${after.findings.length}`);
  const asked = answers.filter((k) => before.findings.some((f) => f.metric === k));
  if (asked.length && !asked.some((k) => after.values[k as keyof Report["values"]] < before.values[k as keyof Report["values"]])) out.push(`${asked.join(" and ")} not lowered`);
  return out;
}

/**
 * Fixes clip `clip` on rest R: the operators lint names (or `ops`: names, in `FIXES`'s order, then operators of your
 * own, in theirs), each run on the clip the one before left and measured before and after. A step that would make the
 * clip worse is not applied (`rejected` says how: see `worse`). Throws for a name that isn't an operator.
 */
export function fix(clip: Clip, R: Rest, opts: FixOptions & { ops?: readonly (FixName | Operator)[] } = {}): FixReport {
  for (const x of opts.ops ?? []) {
    if (typeof x === "string" && !(FIXES as readonly string[]).includes(x)) {
      const near = [...FIXES].sort((a, b) => distance(x.toLowerCase(), a.toLowerCase()) - distance(x.toLowerCase(), b.toLowerCase()))[0]!;
      throw new Error(`fix: no operator "${x}"; did you mean "${near}"? The operators are ${FIXES.join(", ")}`);
    }
  }
  const first = metrics(clip, R), m = motionOf(clip, R);
  const named = opts.ops ?? lint(clip, R, first).items.map((i) => i.op);
  const ops = [...FIXES.filter((n) => named.includes(n)), ...named.filter((x): x is Operator => typeof x !== "string")];
  let c = clip, report = first;
  const steps: FixStep[] = [];
  for (const op of ops) {
    const run = typeof op === "string" ? OPERATORS[op] : op, name = typeof op === "string" ? op : op.name || "custom";
    const out = run(c, R, report, opts), next = metrics(out.clip, R), pushed = out.changes.length || moved(c, out.clip).length ? worse(m, report, next, typeof op === "string" ? ANSWERS[op] : []) : [];
    if (out.skipped) {
      steps.push({ op: name, changes: [], skipped: out.skipped, before: report.values, after: report.values, findings: { before: count(report.findings), after: count(report.findings) } });
      continue;
    }
    if (pushed.length) {
      steps.push({ op: name, changes: [], rejected: pushed, before: report.values, after: report.values, findings: { before: count(report.findings), after: count(report.findings) } });
      continue;
    }
    steps.push({ op: name, changes: [...out.changes, ...moved(c, out.clip)], before: report.values, after: next.values, findings: { before: count(report.findings), after: count(next.findings) } });
    [c, report] = [out.clip, next];
  }
  // stored facts are the motion's: measured again, and reported where they differ (the ones its source gave, which
  // `captured` names, kept)
  if (c.facts && steps.some((s) => s.changes.length)) {
    const fresh = measureFacts(c, R) as unknown as Record<string, unknown>, old = c.facts, given = new Set(Array.isArray(old.captured) ? (old.captured as string[]) : []);
    const diff = Object.keys(fresh).filter((k) => k in old && !given.has(k) && !same(old[k], fresh[k]));
    if (diff.length) {
      c = { ...c, facts: { ...old, ...Object.fromEntries(diff.map((k) => [k, fresh[k]])) } };
      steps.push({ op: "facts", changes: diff.map((k) => `facts.${k} ${JSON.stringify(old[k])} → ${JSON.stringify(fresh[k])}`), before: report.values, after: report.values, findings: { before: count(report.findings), after: count(report.findings) } });
    }
  }
  const text = [`${clip.id}: ${first.verdict.toUpperCase()} → ${report.verdict.toUpperCase()} (${first.findings.length} → ${report.findings.length} findings)`, ...steps.flatMap((s) => (s.skipped ? [`${s.op}: not run, ${s.skipped}`] : s.rejected ? [`${s.op}: not applied, it would make worse: ${s.rejected.join("; ")}`] : [`${s.op}:`, ...s.changes.slice(0, 4).map((x) => `  ${x}`), ...(s.changes.length > 4 ? [`  ... ${s.changes.length - 4} more`] : [])]))].slice(0, 20).join("\n");
  return { clip: c, steps, before: first, after: report, text };
}
