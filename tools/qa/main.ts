// `npm run qa [-- --sample N] [--set S] [--clip ID] [--dist] [--strict]` (PLAN.md WP-3.3): the sensors over the
// migrated library, each clip on its own rest. It prints the verdicts' counts, the metrics that fail most and the
// worst clips; --dist adds each metric's distribution (overall and per set), which the thresholds are read from.
// Writes check-output/qa/report.json (every clip's values and findings). Exit 0 when every clip was measured within the
// T2 budget; --strict exits 1 when any clip fails.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { distributions, libraryClips, qa, sample } from "./qa.ts";

if (import.meta.main) {
  const specs = [
    { name: "sample", takesValue: true, help: "measure N clips spread over the library" },
    { name: "set", takesValue: true, help: "only this set" },
    { name: "clip", takesValue: true, help: "only this clip (SET/Name)" },
    { name: "dist", help: "print each metric's distribution" },
    { name: "strict", help: "exit 1 when any clip fails" },
  ];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
  } catch (err) {
    usage("qa", err, specs);
  }
  const t0 = performance.now(), f = parsed.flags;
  let clips = libraryClips();
  if (typeof f.set === "string") clips = clips.filter((c) => c.set === f.set);
  if (typeof f.clip === "string") clips = clips.filter((c) => c.clip.id === f.clip);
  if (typeof f.sample === "string") clips = sample(clips, Math.max(1, Number(f.sample)));
  const rows = qa(clips), ms = performance.now() - t0, budget = 8 * 60_000;
  const count = (v: string) => rows.filter((r) => r.verdict === v).length;
  const byMetric: Record<string, number> = {};
  for (const r of rows) for (const k of Object.keys(r.findings)) if (k.endsWith(":fail")) byMetric[k.split(":")[0]!] = (byMetric[k.split(":")[0]!] ?? 0) + 1;
  const steps: Step[] = [
    { name: "measured", ok: rows.length > 0 && ms <= budget, ms, summary: `${rows.length} clips in ${fmtMs(ms)} (${fmtMs(ms / Math.max(1, rows.length))} each; T2 budget ${fmtMs(budget)})` },
    { name: "verdicts", ok: !f.strict || count("fail") === 0, ms: 0, summary: `${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail`, detail: Object.entries(byMetric).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}: fails ${n} clips`) },
  ];
  if (f.dist) {
    const d = distributions(rows);
    steps.push({ name: "distributions", ok: true, ms: 0, summary: "per metric: p50 / p90 / p95 / p99 / max of each clip's worst", detail: Object.entries(d).flatMap(([set, ms2]) => Object.entries(ms2).map(([m, p]) => `${set} ${m}: ${[p.p50, p.p90, p.p95, p.p99, p.max].map((x) => +x.toFixed(2)).join(" / ")} (n ${p.n})`)) });
  }
  const out = join(ROOT, "check-output/qa");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "report.json"), JSON.stringify({ rows, ...(f.dist ? { distributions: distributions(rows) } : {}) }, null, 1));
  const ok = steps.every((s) => s.ok);
  const report: Report = { tool: "qa", ok, verdict: `qa: ${ok ? "PASS" : "FAIL"}, ${rows.length} clips measured: ${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail`, steps, warnings: [], ms, next: ok ? "read check-output/qa/report.json for each clip's findings" : "see the failing clips in check-output/qa/report.json" };
  finish(report, parsed);
}
