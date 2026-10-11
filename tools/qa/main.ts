// `npm run qa [-- --sample N] [--set S] [--clip ID] [--dist] [--strict]` (PLAN.md WP-3.3): the sensors over the
// migrated library, each clip on its own rest. It prints the verdicts' counts and the metrics that fail most; --dist
// also prints each metric's distribution in real capture and in all (p50 / p90 / p95 / p99 / max of each clip's worst
// value), which the thresholds are read from, and writes every set's. Writes check-output/qa/clips.json: every clip's
// verdict and its text, values, and findings with their times and repairs (--json writes the run's own report.json
// beside it). Exit 0 when every clip was measured within the T2 budget; --strict exits 1 when any clip fails.
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
  for (const r of rows) for (const k of Object.keys(r.counts)) if (k.endsWith(":fail")) byMetric[k.split(":")[0]!] = (byMetric[k.split(":")[0]!] ?? 0) + 1;
  const steps: Step[] = [
    { name: "measured", ok: rows.length > 0 && ms <= budget, ms, summary: `${rows.length} clips in ${fmtMs(ms)} (${fmtMs(ms / Math.max(1, rows.length))} each; T2 budget ${fmtMs(budget)})` },
    { name: "verdicts", ok: !f.strict || count("fail") === 0, ms: 0, summary: `${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail`, detail: Object.entries(byMetric).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}: fails ${n} clips`) },
  ];
  const out = join(ROOT, "check-output/qa"), dist = f.dist ? distributions(rows) : null;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "clips.json"), JSON.stringify({ rows, ...(dist ? { distributions: dist } : {}) }, null, 1));
  if (dist) {
    const line = (p: { p50: number; p90: number; p95: number; p99: number; max: number; n: number }) => `${[p.p50, p.p90, p.p95, p.p99, p.max].map((x) => +x.toFixed(2)).join(" / ")} (n ${p.n})`;
    const table = Object.keys(dist.all).map((m) => `  ${m}: capture ${line(dist.capture![m as never])}; all ${line(dist.all[m as never])}`);
    process.stdout.write(["distributions, p50 / p90 / p95 / p99 / max of each clip's worst value (every set's in clips.json):", ...table].join("\n") + "\n");
  }
  const ok = steps.every((s) => s.ok);
  const report: Report = { tool: "qa", ok, verdict: `qa: ${ok ? "PASS" : "FAIL"}, ${rows.length} clips measured: ${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail`, steps, warnings: [], ms, next: ok ? "read check-output/qa/clips.json for each clip's findings" : "see the failing clips in check-output/qa/clips.json" };
  finish(report, parsed);
}
