// `npm run plant [-- --check]` (PLAN.md WP-3.6): plants the ten defects in turn into 100 clean library clips (those
// the sensors pass, every other one of the sorted library first): each defect takes the first clean clip left that
// can show it (a slide needs a stance that starts and ends within the clip), so each is planted about ten times, and
// writes the runs with the times each defect must be found at to
// packages/sensors/fixtures/planted/runs.json. The runs are G3's, chosen from the library as it was then; the library
// has grown since (WP-5.3, D63), so --check doesn't rebuild them: it fails on a run whose clip is gone, no longer
// clean or no longer able to show its defect. `npm test -- planted` plants them and runs the sensors.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { metrics } from "@m3a/sensors";
import { libraryClips } from "../qa/qa.ts";
import { finish, parseArgs, ROOT, usage, type Report } from "../run/cli.ts";
import { DEFECTS, fits, plant, type Defect } from "./plant.ts";

/** Where the runs are written. */
export const RUNS = join(ROOT, "packages/sensors/fixtures/planted/runs.json");
/** One planted run: the clip, the defect, its seed, and where it must be found. */
export interface Run {
  clip: string;
  defect: Defect;
  seed: number;
  metric: string;
  t0: number;
  t1: number;
  where?: string;
}

/** The 100 runs: clean clips, the defects in turn. */
export function runs(): Run[] {
  const lib = libraryClips(), clean = lib.filter((c) => metrics(c.clip, c.rest).verdict === "pass");
  // every other clean clip first, then the ones between, until 100 have taken a defect
  const order = [...clean.filter((_, i) => i % 2 === 0), ...clean.filter((_, i) => i % 2 === 1)];
  const kinds = Object.keys(DEFECTS) as Defect[], out: Run[] = [], pool = [...order];
  // the defects in turn, each taking the first clip left it fits; stop when 100 are planted or none fits any clip left
  for (let i = 0, idle = 0; out.length < 100 && idle < kinds.length; i++) {
    const defect = kinds[i % kinds.length]!, j = pool.findIndex((c) => fits(defect, c.clip, c.rest));
    if (j < 0) {
      idle++;
      continue;
    }
    idle = 0;
    const c = pool.splice(j, 1)[0]!, seed = out.length + 1, p = plant(defect, c.clip, c.rest, seed);
    out.push({ clip: c.clip.id, defect, seed, metric: p.metric, t0: round(p.t0), t1: round(p.t1), ...(p.where ? { where: p.where } : {}) });
  }
  return out;
}
const round = (x: number) => Math.round(x * 1e6) / 1e6;

/** What would make a committed run say nothing: its clip gone from the library, no longer clean (the sensors no longer
 *  pass it, so a finding could be the clip's own), or no longer able to show its defect. */
export function checkRuns(file = RUNS): string[] {
  const committed = (JSON.parse(readFileSync(file, "utf8")) as { runs: Run[] }).runs, lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
  const problems: string[] = [];
  for (const r of committed) {
    const c = lib.get(r.clip);
    if (!c) problems.push(`${r.clip} is gone`);
    else if (metrics(c.clip, c.rest).verdict !== "pass") problems.push(`${r.clip} is no longer clean`);
    else if (!fits(r.defect, c.clip, c.rest)) problems.push(`${r.clip} can no longer show a ${r.defect}`);
  }
  return problems;
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), [{ name: "check", help: "fail on a run whose clip is gone, no longer clean or no longer able to show its defect" }]);
  } catch (err) {
    usage("plant", err, []);
  }
  const t0 = performance.now();
  let ok = true, verdict: string;
  if (parsed.flags.check) {
    const problems = checkRuns();
    ok = problems.length === 0;
    verdict = `plant --check: ${ok ? "PASS" : "FAIL"}, ${ok ? "every run's clip is in the library, clean and able to show its defect" : problems.join("; ")}`;
  } else {
    const text = JSON.stringify({ about: "WP-3.6's planted defects: 100 clean library clips (the sensors pass them), each given one defect in turn, with the metric and the times it must be found at. Written by node tools/plant/main.ts.", runs: runs() }, null, 1) + "\n";
    mkdirSync(dirname(RUNS), { recursive: true });
    writeFileSync(RUNS, text);
    verdict = `plant: wrote ${JSON.parse(text).runs.length} runs to packages/sensors/fixtures/planted/runs.json`;
  }
  const report: Report = { tool: "plant", ok, verdict, steps: [], warnings: [], ms: performance.now() - t0, next: ok ? "npm test -- planted" : "a clip the library changed under a run: plant again (node tools/plant/main.ts) and review every run, or restore the clip" };
  finish(report, parsed);
}
