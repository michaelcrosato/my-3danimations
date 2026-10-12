// `npm run qa [-- --sample N] [--set S] [--clip ID] [--dist] [--strict] [--fix]` (PLAN.md WP-3.3): the sensors over
// the migrated library, each clip on its own rest. It prints the verdicts' counts and the metrics that fail most; --dist
// also prints each metric's distribution in real capture and in all (p50 / p90 / p95 / p99 / max of each clip's worst
// value), which the thresholds are read from, and writes every set's. Writes check-output/qa/clips.json: every clip's
// verdict and its text, values, and findings with their times and repairs (--json writes the run's own report.json
// beside it). --baseline writes the committed baseline (packages/sensors/fixtures/baseline.json: every clip's verdict,
// values and finding counts, numbers only); --check fails on any clip that differs from it, naming each difference
// (a baseline changes only in a commit that says why). --fix runs lint and fix (WP-3.5) on every clip lint flags and
// fails on any that comes out worse or invalid, writing each clip's result to check-output/qa/fix.json. Exit 0 when
// every clip was measured within the T2 budget; --strict exits 1 when any clip fails. `npm run qa -- library` (WP-5.8)
// measures the whole library and checks it as a whole (library.ts): every clip's recorded verdict, the reasons whose
// finding is gone, G5's unique motions and category floors, and the distributions against
// library/baselines/distributions.json (--baseline records them); it writes docs/LIBRARY.md, which --check compares
// instead, along with the committed baseline.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { census } from "./census.ts";
import { againstRecord, checkFloats, checkVerdicts, DISTRIBUTIONS, floorsMissed, LIBRARY_DOC, libraryDoc, readRecord, recordOf, recordText, setInfo } from "./library.ts";
import { BASELINE, baselineOf, compare, distributions, fixAll, libraryClips, qa, sample, worse, type BaselineRow } from "./qa.ts";

if (import.meta.main) {
  const specs = [
    { name: "sample", takesValue: true, help: "measure N clips spread over the library" },
    { name: "set", takesValue: true, help: "only this set" },
    { name: "clip", takesValue: true, help: "only this clip (SET/Name)" },
    { name: "dist", help: "print each metric's distribution" },
    { name: "strict", help: "exit 1 when any clip fails" },
    { name: "baseline", help: "write the committed baseline from this run (the whole library)" },
    { name: "check", help: "fail on any clip that differs from the committed baseline" },
    { name: "fix", help: "lint and fix every clip lint flags; fail on any that comes out worse or invalid" },
  ];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const mode = parsed.positionals[0];
    if (mode !== undefined && mode !== "library") throw new Error(`no mode "${mode}": the one mode is library (or none, for the clips one by one)`);
    if (mode === "library" && ["sample", "set", "clip"].some((k) => parsed!.flags[k] !== undefined)) throw new Error("library measures the whole library: drop --sample, --set and --clip");
  } catch (err) {
    usage("qa", err, specs);
  }
  const t0 = performance.now(), f = parsed.flags, asLibrary = parsed.positionals[0] === "library";
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
    { name: "verdicts", ok: !f.strict || count("fail") === 0, ms: 0, summary: `${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail${count("fail") ? `; failing most: ${Object.entries(byMetric).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, n]) => `${m} ${n}`).join(", ")}` : ""}`, detail: Object.entries(byMetric).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}: fails ${n} clips`) },
  ];
  const whole = clips.length === libraryClips().length, path = join(ROOT, BASELINE);
  if (f.baseline) {
    if (!whole) usage("qa", new Error("--baseline measures the whole library: drop --sample, --set and --clip"), specs);
    // one line a clip, so a change reads as the clips it moved
    const about = "The sensors' readings of every library clip (npm run qa -- --baseline): verdict, each metric's worst value to three significant digits, and finding counts by metric and level. npm run qa -- --check fails on any difference; a change lands in a commit that says why (PLAN.md §6).";
    const lines = Object.entries(baselineOf(rows)).map(([id, b]) => `  ${JSON.stringify(id)}: ${JSON.stringify(b)}`);
    writeFileSync(path, `{\n "about": ${JSON.stringify(about)},\n "clips": {\n${lines.join(",\n")}\n }\n}\n`);
    steps.push({ name: "baseline", ok: true, ms: 0, summary: `wrote ${BASELINE} (${rows.length} clips)` });
  }
  if (f.check) {
    const base = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { clips: Record<string, BaselineRow> }).clips : {}, diff = compare(base, rows, whole);
    steps.push({ name: "baseline", ok: diff.length === 0, ms: 0, summary: diff.length ? `${diff.length} differences from ${BASELINE}` : `${rows.length} clips as ${BASELINE} says`, detail: diff });
  }
  if (asLibrary) {
    // the library as a whole: verdicts, reasons, census and floors, distributions, the summary
    const lib = clips, v = checkVerdicts(lib, rows), sets = setInfo(), cc0 = new Set(Object.entries(sets).filter(([, x]) => x.tier === "cc0").map(([k]) => k));
    const c = census(lib, cc0), short = floorsMissed(c), now = recordOf(rows), was = readRecord(), vs = was ? againstRecord(was, now) : { worse: ["nothing recorded yet: npm run qa -- library --baseline"], better: [] };
    steps.push({ name: "verdicts", ok: v.problems.length === 0 && v.gone.length === 0, ms: 0, summary: v.problems.length || v.gone.length ? `${v.problems.length} clips' recorded verdicts aren't the sensors' (npm run import, npm run migrate); ${v.gone.length} reasons whose finding is gone` : `${lib.length} clips carry the sensors' verdict, each flagged one baselined with its reason`, detail: [...v.problems, ...v.gone.map((g) => `library/baselines/qa.json: ${g}${g.endsWith(")") ? "" : " is no longer past its level"}`)] });
    const fl = checkFloats(lib);
    steps.push({ name: "floats", ok: fl.problems.length === 0 && fl.gone.length === 0, ms: 0, summary: fl.problems.length || fl.gone.length ? `${fl.problems.length} clips stand off the floor with no answer; ${fl.gone.length} answers whose clip floats no longer` : "no clip stands off the floor but the ones library/baselines/qa.json answers", detail: [...fl.problems, ...fl.gone.map((g) => `library/baselines/qa.json floats: ${g}`)] });
    steps.push({ name: "census", ok: short.length === 0, ms: 0, summary: `${c.unique} unique motions of ${c.clips} clips (CC0 pack ${c.cc0}); ${short.length ? `short: ${short.join("; ")}` : "every G5 floor met"}`, detail: Object.entries(c.categories).map(([k, x]) => `${k}: ${x.unique} unique of ${x.clips} clips (floor ${x.floor}), ${x.cc0} with a CC0 clip`) });
    if (f.baseline) {
      writeFileSync(DISTRIBUTIONS, recordText(now));
      steps.push({ name: "distributions", ok: true, ms: 0, summary: `recorded in library/baselines/distributions.json` });
    } else steps.push({ name: "distributions", ok: vs.worse.length === 0, ms: 0, summary: vs.worse.length ? `${vs.worse.length} worse than recorded` : `none worse than recorded${vs.better.length ? `; ${vs.better.length} better: record them with --baseline` : ""}`, detail: [...vs.worse, ...vs.better.map((b) => `better: ${b}`)] });
    const doc = libraryDoc(lib, rows, c, sets);
    if (f.check) steps.push({ name: "docs/LIBRARY.md", ok: existsSync(LIBRARY_DOC) && readFileSync(LIBRARY_DOC, "utf8") === doc, ms: 0, summary: existsSync(LIBRARY_DOC) && readFileSync(LIBRARY_DOC, "utf8") === doc ? "as generated" : "differs from what npm run qa -- library writes" });
    else {
      writeFileSync(LIBRARY_DOC, doc);
      steps.push({ name: "docs/LIBRARY.md", ok: true, ms: 0, summary: "written" });
    }
  }
  const out = join(ROOT, "check-output/qa"), dist = f.dist ? distributions(rows) : null;
  mkdirSync(out, { recursive: true });
  let fixSummary = "";
  if (f.fix) {
    const s0 = performance.now(), fixed = fixAll(clips), bad = fixed.filter((r) => worse(r) || r.errors.length);
    const better = fixed.filter((r) => r.after.verdict !== r.before.verdict && !worse(r)).length, held = fixed.reduce((a, r) => a + r.rejected.length, 0);
    writeFileSync(join(out, "fix.json"), JSON.stringify({ rows: fixed }, null, 1));
    const fewer = fixed.filter((r) => !bad.includes(r) && r.after.verdict === r.before.verdict && r.after.findings < r.before.findings).length;
    fixSummary = `${fixed.length} clips linted: ${better} with a better verdict, ${fewer} with fewer findings, ${fixed.length - better - fewer - bad.length} as they were, ${bad.length} worse (a verdict or more findings) or invalid; ${held} steps not applied (they would make a clip worse)`;
    steps.push({ name: "fix", ok: bad.length === 0, ms: performance.now() - s0, summary: fixSummary, detail: bad.map((r) => `${r.clip}: ${r.before.verdict} → ${r.after.verdict}, ${r.before.findings} → ${r.after.findings} findings${r.errors.length ? `, ${r.errors.length} errors: ${r.errors[0]}` : ""}`) });
  }
  writeFileSync(join(out, "clips.json"), JSON.stringify({ rows, ...(dist ? { distributions: dist } : {}) }, null, 1));
  if (dist) {
    const line = (p: { p50: number; p90: number; p95: number; p99: number; max: number; n: number }) => `${[p.p50, p.p90, p.p95, p.p99, p.max].map((x) => +x.toFixed(2)).join(" / ")} (n ${p.n})`;
    const table = Object.keys(dist.all).map((m) => `  ${m}: capture ${line(dist.capture![m as never])}; all ${line(dist.all[m as never])}`);
    process.stdout.write(["distributions, p50 / p90 / p95 / p99 / max of each clip's worst value (every set's in clips.json):", ...table].join("\n") + "\n");
  }
  const ok = steps.every((s) => s.ok);
  const report: Report = { tool: "qa", ok, verdict: `qa: ${ok ? "PASS" : "FAIL"}, ${rows.length} clips measured: ${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail${fixSummary ? `; fix: ${fixSummary}` : ""}`, steps, warnings: [], ms, next: ok ? "read check-output/qa/clips.json for each clip's findings" : "see the failing clips in check-output/qa/clips.json" };
  finish(report, parsed);
}
