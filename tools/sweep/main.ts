// `npm run sweep -- <rig ids> [--manifest <file>] [--heldout <gate>] [--sample N] [--clip ID] [--min P] [--min-total P]`
// (PLAN.md WP-4.5): every migrated clip on each given skeleton (gen-<seed> for a generated test character; a real rig's
// id from the fixtures manifest, or from --manifest), the sensors run on what it plays. Prints each skeleton's pass rate
// and its failures with their reasons; writes the clip-by-skeleton results to check-output/sweep/results.json. --min P
// fails a skeleton that passes under P%; --min-total P fails when the skeletons together pass under P% (G4 asks 95).
// --heldout G4 adds the rigs of the gate's latest held-out run (bench/results/heldout/G4/run-<n>/rig.json, a fixtures
// manifest), reported apart: they count toward neither bar.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { libraryClips, sample } from "../qa/qa.ts";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { heldout, rigOf, sweepOne, type SweepRow } from "./sweep.ts";

if (import.meta.main) {
  const specs = [
    { name: "manifest", takesValue: true, help: "a manifest of rigs beyond tools/fixtures/rigs.json (a held-out rig)" },
    { name: "sample", takesValue: true, help: "N clips spread over the library" },
    { name: "clip", takesValue: true, help: "only this clip (SET/Name)" },
    { name: "min", takesValue: true, help: "fail a skeleton that passes under this percentage" },
    { name: "min-total", takesValue: true, help: "fail when all the skeletons together pass under this percentage" },
    { name: "heldout", takesValue: true, help: "add the rigs of a gate's latest held-out run (G4), reported apart" },
  ];
  let parsed, held: ReturnType<typeof heldout> | null = null;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    if (!parsed.positionals.length) throw new Error("name the skeletons: gen-<seed> or a rig id (npm run sweep -- gen-0 quaternius-mannequin-m)");
    if (typeof parsed.flags.heldout === "string") held = heldout(parsed.flags.heldout);
  } catch (err) {
    usage("sweep", err, specs);
  }
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
    const pass = mine.filter((r) => r.ok).length, pct = (100 * pass) / Math.max(1, mine.length);
    steps.push({ name: apart ? `${rig} (held out, ${held!.run})` : rig, ok: apart || pct >= min, ms: performance.now() - s0, summary: `${pass} of ${mine.length} clips pass (${pct.toFixed(1)}%), bound ${b.report.method === "table" ? `by name (${b.report.table})` : "by topology"} at ${b.report.confidence.toFixed(2)}`, detail: mine.filter((r) => !r.ok).map((r) => `${r.clip}: ${r.why.join("; ")}`) });
  }
  if (typeof f["min-total"] === "string") {
    const counted = rows.filter((r) => !held?.rigs.includes(r.rig)), pass = counted.filter((r) => r.ok).length, pct = (100 * pass) / Math.max(1, counted.length), bar = Number(f["min-total"]);
    steps.push({ name: "together", ok: pct >= bar, ms: 0, summary: `${pass} of ${counted.length} clip-skeleton pairs pass (${pct.toFixed(1)}%; the bar ${bar}%)` });
  }
  const out = join(ROOT, "check-output/sweep");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "results.json"), JSON.stringify({ about: "npm run sweep: each clip on each skeleton; ok when the skeleton adds nothing wrong (tools/sweep/sweep.ts)", rigs, ...(held ? { heldout: held } : {}), clips: clips.length, rows }, null, 1));
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok), passed = rows.filter((r) => r.ok).length;
  const report: Report = { tool: "sweep", ok, verdict: `sweep: ${ok ? "PASS" : "FAIL"}, ${passed} of ${rows.length} clip-skeleton pairs pass in ${fmtMs(ms)}`, steps, warnings: [], ms, next: "read check-output/sweep/results.json for every clip on every skeleton" };
  finish(report, parsed);
}
