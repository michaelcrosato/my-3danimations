// `node tools/plant/main.ts [--check]` (PLAN.md WP-3.6): picks 100 clean library clips (those the sensors pass, every
// other one of the sorted library first) and gives each a defect to plant, the ten in turn (a clip that can't take
// one gets the next it can; one that can take none is passed over), and writes the runs with the times each defect must be found at to
// packages/sensors/fixtures/planted/runs.json. --check rebuilds them and fails on any difference. `npm test -- planted`
// plants them and runs the sensors.
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
  const kinds = Object.keys(DEFECTS) as Defect[], out: Run[] = [];
  for (const c of order) {
    if (out.length >= 100) break;
    const i = out.length;
    for (let k = 0; k < kinds.length; k++) {
      const defect = kinds[(i + k) % kinds.length]!;
      if (!fits(defect, c.clip, c.rest)) continue;
      const p = plant(defect, c.clip, c.rest, i + 1);
      out.push({ clip: c.clip.id, defect, seed: i + 1, metric: p.metric, t0: round(p.t0), t1: round(p.t1), ...(p.where ? { where: p.where } : {}) });
      break;
    }
  }
  return out;
}
const round = (x: number) => Math.round(x * 1e6) / 1e6;

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), [{ name: "check", help: "rebuild the runs and fail on any difference" }]);
  } catch (err) {
    usage("plant", err, []);
  }
  const t0 = performance.now(), text = JSON.stringify({ about: "WP-3.6's planted defects: 100 clean library clips (the sensors pass them), each given one defect in turn, with the metric and the times it must be found at. Written by node tools/plant/main.ts.", runs: runs() }, null, 1) + "\n";
  let ok = true, verdict: string;
  if (parsed.flags.check) {
    let old = "";
    try {
      old = readFileSync(RUNS, "utf8");
    } catch {
      /* missing */
    }
    ok = old === text;
    verdict = `plant --check: ${ok ? "PASS" : "FAIL"}, the runs ${ok ? "rebuild byte for byte" : "differ from the file"}`;
  } else {
    mkdirSync(dirname(RUNS), { recursive: true });
    writeFileSync(RUNS, text);
    verdict = `plant: wrote ${JSON.parse(text).runs.length} runs to packages/sensors/fixtures/planted/runs.json`;
  }
  const report: Report = { tool: "plant", ok, verdict, steps: [], warnings: [], ms: performance.now() - t0, next: ok ? "npm test -- planted" : "node tools/plant/main.ts, then review the change" };
  finish(report, parsed);
}
