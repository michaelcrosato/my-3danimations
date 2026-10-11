// Lint and fix (PLAN.md WP-3.5): `lint(clip, R)` lists what `fix` would change and why (the metrics' findings each
// operator answers); `fix(clip, R)` applies the operators in order, each with the metrics before and after it and a
// line for every change. No clip changes silently: after every operator its `dur`, events and contacts are compared
// with what they were, and any that moved is reported with the operator's own changes; when anything changed, a
// clip's stored facts are measured again at the end, and what they say differently is reported too.
import { measureFacts, type Clip, type Rest } from "@m3a/core";
import type { Finding } from "../metrics/checks.ts";
import { metrics, type Report } from "../metrics/report.ts";
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
const ANSWERS: Readonly<Record<FixName, readonly string[]>> = {
  twistFlips: ["twistFlip"], jitter: ["jitter", "pop"], penetration: ["penetration"], footLocks: ["slide", "skate"], seam: ["seam"], refit: [],
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

/**
 * Fixes clip `clip` on rest R: the operators lint names (or `ops`: names, in `FIXES`'s order, then operators of your
 * own, in theirs), each run on the clip the one before left and measured before and after.
 */
export function fix(clip: Clip, R: Rest, opts: FixOptions & { ops?: readonly (FixName | Operator)[] } = {}): FixReport {
  const first = metrics(clip, R);
  const named = opts.ops ?? lint(clip, R, first).items.map((i) => i.op);
  const ops = [...FIXES.filter((n) => named.includes(n)), ...named.filter((x): x is Operator => typeof x !== "string")];
  let c = clip, report = first;
  const steps: FixStep[] = [];
  for (const op of ops) {
    const run = typeof op === "string" ? OPERATORS[op] : op, name = typeof op === "string" ? op : op.name || "custom";
    const out = run(c, R, report, opts), next = metrics(out.clip, R);
    steps.push({ op: name, changes: [...out.changes, ...moved(c, out.clip)], before: report.values, after: next.values, findings: { before: count(report.findings), after: count(next.findings) } });
    [c, report] = [out.clip, next];
  }
  // stored facts are the motion's: measured again, and reported where they differ
  if (c.facts && steps.some((s) => s.changes.length)) {
    const fresh = measureFacts(c, R) as unknown as Record<string, unknown>, old = c.facts, diff = Object.keys(fresh).filter((k) => k in old && !same(old[k], fresh[k]));
    if (diff.length) {
      c = { ...c, facts: { ...old, ...Object.fromEntries(diff.map((k) => [k, fresh[k]])) } };
      steps.push({ op: "facts", changes: diff.map((k) => `facts.${k} ${JSON.stringify(old[k])} → ${JSON.stringify(fresh[k])}`), before: report.values, after: report.values, findings: { before: count(report.findings), after: count(report.findings) } });
    }
  }
  const text = [`${clip.id}: ${first.verdict.toUpperCase()} → ${report.verdict.toUpperCase()} (${first.findings.length} → ${report.findings.length} findings)`, ...steps.flatMap((s) => [`${s.op}:`, ...s.changes.slice(0, 4).map((x) => `  ${x}`), ...(s.changes.length > 4 ? [`  ... ${s.changes.length - 4} more`] : [])])].slice(0, 20).join("\n");
  return { clip: c, steps, before: first, after: report, text };
}
