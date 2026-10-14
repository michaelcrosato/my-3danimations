// `npm run sweep -- <rig ids> [--manifest <file>] [--heldout <gate>] [--sample N] [--clip ID] [--min P] [--min-total P]
// [--out <file>]` (PLAN.md WP-4.5): every library clip on each given skeleton (gen-<seed> for a generated test
// character; a real rig's id from the fixtures manifest, or from --manifest), the sensors run on what it plays. Prints
// each skeleton's pass rate (a pair fails on a fail finding the skeleton adds, D80), its failures with their reasons
// and the warns it added, and how many pairs it added a warn to; writes the clip-by-skeleton results, every added warn
// listed, to check-output/sweep/results.json (or --out). --min P
// fails a skeleton that passes under P%; --min-total P fails when the skeletons together pass under P% (G4 asks 95).
// --heldout G4 adds the rigs of the gate's latest held-out run (bench/results/heldout/G4/run-<n>/rig.json, a fixtures
// manifest), reported apart: they count toward neither bar.
// `npm run sweep -- --record <results.json> --commit <sha> [--name <text>] [--out <file>]` sweeps nothing: it derives a
// gate's record from raw results already written (tools/sweep/record.ts: every failing pair with its reasons and the
// warns the skeleton added, every passing pair it warned) to check-output/sweep/record.json (or --out), e.g.
// `--record check-output/sweep/results.json --commit <the gate's commit> --name "G4 run 2's sweep step" --out
// bench/results/gates/G4-run-2/sweep.json`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { libraryClips, sample } from "../qa/qa.ts";
import { finish, fmtMs, parseArgs, ROOT, usage, type Parsed, type Report, type Step } from "../run/cli.ts";
import { sweepRecord, type SweepResults } from "./record.ts";
import { heldout, rigOf, sweepOne, type SweepRow } from "./sweep.ts";

if (import.meta.main) {
  const specs = [
    { name: "manifest", takesValue: true, help: "a manifest of rigs beyond tools/fixtures/rigs.json (a held-out rig)" },
    { name: "sample", takesValue: true, help: "N clips spread over the library" },
    { name: "clip", takesValue: true, help: "only this clip (SET/Name)" },
    { name: "min", takesValue: true, help: "fail a skeleton that passes under this percentage" },
    { name: "min-total", takesValue: true, help: "fail when all the skeletons together pass under this percentage" },
    { name: "heldout", takesValue: true, help: "add the rigs of a gate's latest held-out run (G4), reported apart" },
    { name: "out", takesValue: true, help: "the results file (check-output/sweep/results.json), or with --record the record (check-output/sweep/record.json)" },
    { name: "record", takesValue: true, help: "sweep nothing: derive a gate's record from these raw results (tools/sweep/record.ts)" },
    { name: "commit", takesValue: true, help: "with --record: the commit the raw results were written at" },
    { name: "name", takesValue: true, help: "with --record: what the record is of, opening its about text (\"G4 run 2's sweep step\")" },
  ];
  let parsed, held: ReturnType<typeof heldout> | null = null;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    if (typeof parsed.flags.record === "string") {
      if (typeof parsed.flags.commit !== "string" || !/^[0-9a-f]{7,40}$/.test(parsed.flags.commit)) throw new Error("--record needs --commit <sha>: the commit the raw results were written at");
      if (parsed.positionals.length) throw new Error("--record sweeps nothing: name no skeletons");
    } else if (!parsed.positionals.length) throw new Error("name the skeletons: gen-<seed> or a rig id (npm run sweep -- gen-0 quaternius-mannequin-m)");
    if (typeof parsed.flags.heldout === "string") held = heldout(parsed.flags.heldout);
  } catch (err) {
    usage("sweep", err, specs);
  }
  if (typeof parsed.flags.record === "string") record(parsed.flags.record, parsed);
  const f = parsed.flags, t0 = performance.now(), manifest = typeof f.manifest === "string" ? resolve(f.manifest) : undefined;
  let clips = libraryClips();
  if (typeof f.clip === "string") clips = clips.filter((c) => c.clip.id === f.clip);
  if (typeof f.sample === "string") clips = sample(clips, Math.max(1, Number(f.sample)));
  const rows: SweepRow[] = [], steps: Step[] = [], min = typeof f.min === "string" ? Number(f.min) : 0;
  const rigs = [...parsed.positionals, ...(held?.rigs ?? [])];
  for (const rig of rigs) {
    const s0 = performance.now(), apart = held?.rigs.includes(rig) ?? false;
    let b;
    try {
      b = await rigOf(rig, apart ? held!.manifest : manifest);
    } catch (err) {
      steps.push({ name: rig, ok: false, ms: 0, summary: "not bound", detail: [String((err as Error).message)] });
      continue;
    }
    const mine = clips.map((c) => sweepOne(c.clip, c.rest, b, rig));
    rows.push(...mine);
    const pass = mine.filter((r) => r.ok).length, pct = (100 * pass) / Math.max(1, mine.length), warned = mine.filter((r) => r.ok && r.warns.length).length;
    const failWarned = mine.filter((r) => !r.ok && r.warns.length).length;
    // a failing pair's added warns listed with its reasons, as a passing pair's are (D80)
    steps.push({ name: apart ? `${rig} (held out, ${held!.run})` : rig, ok: apart || pct >= min, ms: performance.now() - s0, summary: `${pass} of ${mine.length} clips pass (${pct.toFixed(1)}%; ${warned} passing and ${failWarned} failing with a warn it added, listed), bound ${b.report.method === "table" ? `by name (${b.report.table})` : "by topology"} at ${b.report.confidence.toFixed(2)}`, detail: mine.filter((r) => !r.ok).map((r) => `${r.clip}: ${r.why.join("; ")}${r.warns.length ? `; warns: ${r.warns.join("; ")}` : ""}`) });
  }
  if (typeof f["min-total"] === "string") {
    const counted = rows.filter((r) => !held?.rigs.includes(r.rig)), pass = counted.filter((r) => r.ok).length, pct = (100 * pass) / Math.max(1, counted.length), bar = Number(f["min-total"]);
    steps.push({ name: "together", ok: pct >= bar, ms: 0, summary: `${pass} of ${counted.length} clip-skeleton pairs pass (${pct.toFixed(1)}%; the bar ${bar}%)` });
  }
  const out = typeof f.out === "string" ? resolve(f.out) : join(ROOT, "check-output/sweep/results.json");
  mkdirSync(dirname(out), { recursive: true });
  // every pair that passes with a warn the skeleton added, listed apart for the gate's report (D80)
  const warned = rows.filter((r) => r.ok && r.warns.length).map((r) => ({ clip: r.clip, rig: r.rig, warns: r.warns }));
  const results: SweepResults = { about: "npm run sweep: each clip on each skeleton; ok when the skeleton adds no fail finding, every warn it adds listed (tools/sweep/sweep.ts, D80)", rigs, ...(held ? { heldout: held } : {}), clips: clips.length, warned, rows };
  writeFileSync(out, JSON.stringify(results, null, 1));
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok), passed = rows.filter((r) => r.ok).length;
  const report: Report = { tool: "sweep", ok, verdict: `sweep: ${ok ? "PASS" : "FAIL"}, ${passed} of ${rows.length} clip-skeleton pairs pass in ${fmtMs(ms)}`, steps, warnings: [], ms, next: `read ${relative(ROOT, out)} for every clip on every skeleton, and its warned list` };
  finish(report, parsed);
}

/** --record: the record of raw results already written (tools/sweep/record.ts), to --out or check-output/sweep/record.json. */
function record(from: string, parsed: Parsed): never {
  const t0 = performance.now(), f = parsed.flags, res = JSON.parse(readFileSync(resolve(from), "utf8")) as SweepResults;
  const rec = sweepRecord(res, f.commit as string, typeof f.name === "string" ? f.name : undefined);
  const out = typeof f.out === "string" ? resolve(f.out) : join(ROOT, "check-output/sweep/record.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(rec, null, 1));
  const added = rec.failures.filter((x) => x.warns.length).length, ms = performance.now() - t0;
  const summary = `${rec.failures.length} failing pairs (${added} with a warn the skeleton added, listed with their reasons), ${rec.warned.length} passing with one; ${rec.together.pass} of ${rec.together.of} together`;
  finish({ tool: "sweep", ok: true, verdict: `sweep: record of ${relative(ROOT, resolve(from))} at ${rec.commit.slice(0, 7)} written to ${relative(ROOT, out)}: ${summary}`, steps: [{ name: "record", ok: true, ms, summary }], warnings: [], ms, next: `read ${relative(ROOT, out)}: failures (with their warns) and warned` }, parsed);
}
