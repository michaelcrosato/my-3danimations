// The sweep (WP-4.5's Done-when): eight sampled library clips and a deliberately broken one (a walk with one key's
// pelvis not a number) played on two generated test characters, gen-0 (a chibi) and gen-7. It checks that there is one
// row for each clip on each skeleton, that every failing row gives at least one reason, and that the broken clip fails
// on both with its "nan: " reason first; that a skeleton missing from the cache is named with how to fetch it; and that
// `npm run sweep` writes the clip-by-skeleton results to check-output/sweep/results.json; a walk's travel is not read as
// its loop's seam, and the clip's own slide is read over the stretches the played body stands on (D51); clips play
// with their library's shares, and four that failed before D55 pass. How many clips
// pass is not checked here: that is gate G4's bar (95% over its six skeletons and the whole library, PLAN.md §9.3).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Clip, Key } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { libraryClips, sample } from "../qa/qa.ts";
import { likeFor, rigOf, sweepOne, type SweepRow } from "./sweep.ts";

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
  it("reads a loop's seam on the body and its feet in the world: a walk's travel is no seam (D51)", async () => {
    const b = await rigOf("gen-7"), lib = libraryClips();
    for (const id of ["QUATERNIUS_3D2DGE/Walk_Loop", "MESH2MOTION/Walk_Large", "STYLE100/Neutral_Walk"]) {
      const c = lib.find((x) => x.clip.id === id)!, r = sweepOne(c.clip, c.rest, b, "gen-7");
      expect(r.why.filter((w) => /^seam /.test(w)), id).toEqual([]);
      for (const w of r.worse) expect(w.played / w.playedLevels[0], `${id} ${w.metric}`).toBeGreaterThanOrEqual(1);
    }
  }, 120_000);
  it("reads the clip's own slide over the stretches the played body stands on, where its own foot is down too", () => {
    const played = { by: "detected" as const, footL: [[0, 1], [2, 3]] as [number, number][], footR: [[0.5, 2.5]] as [number, number][] };
    const down = { by: "detected" as const, footL: [[0.5, 2.2]] as [number, number][], handL: [[0, 1]] as [number, number][] };
    expect(likeFor(played, down, { by: "detected", handL: [[0.2, 0.4]] })).toEqual({ by: "detected", footL: [[0.5, 1], [2, 2.2]], handL: [[0.2, 0.4]] });
  });
  it("plays clips with their library's shares and their soles settled smoothly: four that failed before D55 pass", async () => {
    // a sprint's toe dipping between keys bobbed the hips (pops); a hurt walk's and a dive roll's torsos lost their
    // library's lean, and the arms went into the hips (D55)
    const rigs: Record<string, Awaited<ReturnType<typeof rigOf>>> = {}, lib = libraryClips();
    for (const [id, rig] of [["MESH2MOTION/Sprint", "gen-0"], ["CMU_CURATED/Wounded_Walk_Loop", "gen-3"], ["MESH2MOTION/Zombie_Yell", "gen-3"], ["CMU_CURATED/Dive_Roll", "gen-0"]] as const) {
      const c = lib.find((x) => x.clip.id === id)!, r = sweepOne(c.clip, c.rest, (rigs[rig] ??= await rigOf(rig)), rig);
      expect(r.why, `${id} on ${rig}`).toEqual([]);
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
    for (const r of res.rows) expect(Object.keys(r).sort()).toEqual(["clip", "ok", "own", "played", "reach", "rig", "why", "worse"]);
  }, 120_000);
});
