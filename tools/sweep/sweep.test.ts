// The sweep (WP-4.5's Done-when): eight sampled library clips and a deliberately broken one (a walk with one key's
// pelvis not a number) played on two generated test characters, gen-0 (a chibi) and gen-7. It checks that there is one
// row for each clip on each skeleton, that every failing row gives at least one reason, and that the broken clip fails
// on both with its "nan: " reason first; that a skeleton missing from the cache is named with how to fetch it; and that
// `npm run sweep` writes the clip-by-skeleton results to check-output/sweep/results.json. How many clips pass is not
// checked here: that is gate G4's bar (95% over its six skeletons and the whole library, PLAN.md §9.3).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Clip, Key } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { libraryClips, sample } from "../qa/qa.ts";
import { rigOf, sweepOne, type SweepRow } from "./sweep.ts";

const RIGS = ["gen-0", "gen-7"];

describe("the sweep", () => {
  it("plays each clip on each skeleton, and lists a broken clip as a failure with its reason", async () => {
    const clips = sample(libraryClips(), 8), rows: SweepRow[] = [];
    // a walk with one key's pelvis not a number
    const walk = libraryClips().find((c) => c.clip.id === "QUATERNIUS_3D2DGE/Walk_Loop")!;
    const broken = { ...walk.clip, id: "BROKEN/Walk_Loop", keys: walk.clip.keys.map((k, i) => (i === 2 ? { ...k, hips: [Number.NaN, 0, 0] } : k)) as Key[] } as Clip;
    for (const rig of RIGS) {
      const b = await rigOf(rig);
      for (const c of clips) rows.push(sweepOne(c.clip, c.rest, b, rig));
      rows.push(sweepOne(broken, walk.rest, b, rig));
    }
    // one row for each clip on each skeleton, in order
    expect(rows.map((r) => `${r.rig} ${r.clip}`)).toEqual(RIGS.flatMap((rig) => [...clips.map((c) => `${rig} ${c.clip.id}`), `${rig} BROKEN/Walk_Loop`]));
    // a row fails exactly when it gives a reason, and every reason says something
    for (const r of rows) {
      expect(r.ok, `${r.rig} ${r.clip}: ${r.why.join("; ")}`).toBe(r.why.length === 0);
      for (const w of r.why) expect(w.trim(), `${r.rig} ${r.clip}`).not.toBe("");
    }
    // the broken clip fails on both skeletons, its non-number named first
    const broke = rows.filter((x) => x.clip === "BROKEN/Walk_Loop");
    expect(broke.map((r) => r.rig)).toEqual(RIGS);
    for (const r of broke) {
      expect(r.ok).toBe(false);
      expect(r.why[0], r.why.join("; ")).toMatch(/^nan: /);
    }
  }, 120_000);
  it("names a skeleton it can't find, and how to fetch it", async () => {
    await expect(rigOf("no-such-rig")).rejects.toThrow(/^sweep: no rig "no-such-rig" in the cache: npm run fixtures -- fetch/);
  });
  it("npm run sweep writes the clip-by-skeleton results", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), ...RIGS, "--sample", "4"], { cwd: ROOT, encoding: "utf8" });
    expect(out).toMatch(/^sweep: (PASS|FAIL), \d+ of 8 clip-skeleton pairs pass/m);
    const res = JSON.parse(readFileSync(join(ROOT, "check-output/sweep/results.json"), "utf8")) as { rigs: string[]; clips: number; rows: SweepRow[] };
    expect([res.rigs, res.clips, res.rows.length]).toEqual([RIGS, 4, 8]);
    for (const r of res.rows) expect(Object.keys(r).sort()).toEqual(["clip", "ok", "own", "played", "reach", "rig", "why"]);
  }, 120_000);
});
