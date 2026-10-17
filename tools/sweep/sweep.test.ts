// The sweep (WP-4.5's Done-when): eight sampled library clips and a deliberately broken one (a walk with one key's
// pelvis not a number) played on two generated test characters, gen-0 (a chibi) and gen-7. It checks that there is one
// row for each clip on each skeleton, that every failing row gives at least one reason, and that the broken clip fails
// on both with its "nan: " reason first; that a skeleton missing from the cache is named with how to fetch it; and that
// `npm run sweep` writes the clip-by-skeleton results to check-output/sweep/results.json; a walk's travel is not read as
// its loop's seam, and the clip's own slide is read over the stretches the played body stands on (D51); clips play
// with their library's shares, and four that failed before D55 pass; a pair fails on a fail finding the skeleton adds,
// and one it adds a warn to passes with the warn listed (D80); a gate's record, derived from the raw results by
// `npm run sweep -- --record`, lists every failing pair with its reasons and the warns the skeleton added, and every
// passing pair it warned (D88); and a fixed sample's rows are 1bf5252's byte for byte, its judge still its own (WP-7.2b
// moved it to @m3a/tools). How many clips pass is not checked here: that is gate G4's bar (95% over its six skeletons
// and the whole library, PLAN.md §9.3).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, type Clip, type Key, type Rest } from "@m3a/core";
import { ROOT } from "../run/cli.ts";
import { libraryClips, sample } from "../qa/qa.ts";
import { sweepRecord, type SweepResults } from "./record.ts";
import { heldout, likeFor, rigOf, sweepOne, type SweepRow } from "./sweep.ts";

const RIGS = ["gen-0", "gen-7"];
/**
 * The pinned rows' clips, fixed ids (not sample(), so a library growing elsewhere doesn't move them): a pass, a fail on
 * one skeleton, a fail on both past the clip's own level, a warn only gen-0 adds, a side run and a 0.17 s aim.
 */
const PINNED = ["CMU_CURATED/Backflip", "CMU_CURATED/Run_Jump_Over", "MESH2MOTION/Slide_Exit", "QUATERNIUS_3D2DGE/Hit_Knockback", "QUATERNIUS_SHARDFALL/Pistol_Aim_Up", "STYLE100_SIDERUN/BentForward_SideRunLeft"];
/** A library clip by id, on its source's rest. */
function load(id: string): { clip: Clip; rest: Rest } {
  const [set, name] = id.split("/") as [string, string], dir = join(ROOT, "library/sets", set), clip = parseClip(readFileSync(join(dir, `${name}.json`), "utf8"));
  return { clip, rest: (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[clip.restSrc]!.rest };
}

/**
 * Raw results by hand: on gen-0 a pair failing with a warn added, one failing without and one passing with one; on the
 * held-out rig one passing clean, one passing with two warns and one failing with a warn.
 */
function rawResults(): SweepResults {
  const row = (clip: string, rig: string, why: string[], warns: string[]): SweepRow => ({ clip, rig, ok: !why.length, why, warns, own: "pass", played: why.length ? "fail" : "pass", reach: 0.1, worse: [] });
  const fail = (k: string) => `${k} 1.0 on its own body → 9.0 played on this one, past its fail level`, warn = (k: string) => `${k} 1.0 on its own body → 5.0 played on this one, past its warn level`;
  const rows = [row("S/A", "gen-0", [fail("skate")], [warn("slide")]), row("S/B", "gen-0", [fail("pop")], []), row("S/C", "gen-0", [], [warn("jitter")])];
  rows.push(row("S/A", "held", [], []), row("S/B", "held", [], [warn("pop"), warn("seam")]), row("S/C", "held", [fail("jitter")], [warn("skate")]));
  return { about: "by hand", rigs: ["gen-0", "held"], heldout: { run: "run-1", manifest: "rig.json", rigs: ["held"] }, clips: 3, warned: rows.filter((r) => r.ok && r.warns.length).map((r) => ({ clip: r.clip, rig: r.rig, warns: r.warns })), rows };
}

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
  it("fails a pair on a fail finding the skeleton adds, and passes one with a warn it adds, listed (D80)", async () => {
    // on gen-0, a running jump's landing pops past its warn level (none on its own body) and a backflip's past its fail
    const b = await rigOf("gen-0"), lib = libraryClips(), row = (id: string) => {
      const c = lib.find((x) => x.clip.id === id)!;
      return sweepOne(c.clip, c.rest, b, "gen-0");
    };
    const jump = row("CMU_CURATED/Run_Jump_Over"), flip = row("CMU_CURATED/Backflip");
    expect([jump.ok, jump.why, jump.worse.map((w) => [w.metric, w.level])]).toEqual([true, [], [["pop", "warn"]]]);
    expect(jump.warns).toEqual([expect.stringMatching(/^pop 0\.0 on its own body → \d+ played on this one, past its warn level$/)]);
    expect([flip.ok, flip.warns, flip.worse.map((w) => [w.metric, w.level])]).toEqual([false, [], [["pop", "fail"]]]);
    expect(flip.why).toEqual([expect.stringMatching(/^pop \d+ on its own body → \d+ played on this one, past its fail level$/)]);
  }, 120_000);
  it("finds a gate's latest held-out run, and says so when there is none", () => {
    const base = mkdtempSync(join(tmpdir(), "m3a-heldout-"));
    expect(() => heldout("G4", base)).toThrow(/no held-out run for G4 yet/);
    for (const [run, id] of [["run-1", "old-rig"], ["run-2", "new-rig"]]) {
      mkdirSync(join(base, "G4", run), { recursive: true });
      writeFileSync(join(base, "G4", run, "rig.json"), JSON.stringify({ rigs: [{ id }] }));
    }
    expect(heldout("G4", base)).toMatchObject({ run: "run-2", rigs: ["new-rig"] });
  });
  it("names a skeleton it can't find, and how to fetch it", async () => {
    await expect(rigOf("no-such-rig")).rejects.toThrow(/^sweep: no rig "no-such-rig" in the cache: npm run fixtures -- fetch/);
  });
  it("records every failing pair with its reasons and the warns the skeleton added, and every passing pair it warned (D80, D88)", () => {
    const res = rawResults(), rec = sweepRecord(res, "adf77ee", "G4 run 9's sweep step");
    expect(Object.keys(rec)).toEqual(["about", "commit", "rigs", "heldout", "clips", "together", "perRig", "failures", "warned"]);
    expect([rec.commit, rec.rigs, rec.heldout, rec.clips]).toEqual(["adf77ee", res.rigs, res.heldout, 3]);
    expect(rec.about).toMatch(/^G4 run 9's sweep step \(npm run sweep, D80\).* every failing pair is listed in failures with its reasons \(why\) and every warn the skeleton added \(warns, \[\] when none\)/);
    // a failing pair carries its warns, [] when the skeleton added none; warned stays the passing pairs'
    const at = (clip: string, rig: string) => res.rows.find((r) => r.clip === clip && r.rig === rig)!;
    expect(rec.failures).toEqual([["S/A", "gen-0"], ["S/B", "gen-0"], ["S/C", "held"]].map(([c, g]) => ({ clip: c, rig: g, why: at(c!, g!).why, warns: at(c!, g!).warns })));
    expect(rec.failures.map((f) => f.warns.length)).toEqual([1, 0, 1]);
    expect(rec.warned).toEqual(res.warned);
    // every warn any row carries is in the record, once
    expect([...rec.failures, ...rec.warned].flatMap((x) => x.warns.map((w) => `${x.rig} ${x.clip} ${w}`)).sort()).toEqual(res.rows.flatMap((r) => r.warns.map((w) => `${r.rig} ${r.clip} ${w}`)).sort());
    // per skeleton, and the counted ones together: the held-out rig in neither
    expect(rec.perRig).toEqual({ "gen-0": { pass: 1, of: 3, warned: 1, heldOut: false, pct: 33.3 }, held: { pass: 2, of: 3, warned: 1, heldOut: true, pct: 66.7 } });
    expect(rec.together).toEqual({ pass: 1, of: 3, pct: 33.33 });
  });
  it("npm run sweep -- --record re-derives a record from raw results, sweeping nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "m3a-sweep-record-")), from = join(dir, "results.json"), to = join(dir, "sweep.json"), res = rawResults();
    writeFileSync(from, JSON.stringify(res, null, 1));
    const out = execFileSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), "--record", from, "--commit", "adf77ee", "--name", "G4 run 9's sweep step", "--out", to], { cwd: ROOT, encoding: "utf8" });
    expect(out).toMatch(/^sweep: record of .* at adf77ee written to .*: 3 failing pairs \(2 with a warn the skeleton added, listed with their reasons\), 2 passing with one; 1 of 3 together$/m);
    expect(readFileSync(to, "utf8")).toBe(JSON.stringify(sweepRecord(res, "adf77ee", "G4 run 9's sweep step"), null, 1));
    // the commit the results were written at is not in them: a record without it is a usage error
    const bad = spawnSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), "--record", from], { cwd: ROOT, encoding: "utf8" });
    expect([bad.status, bad.stdout]).toEqual([2, expect.stringContaining("--record needs --commit <sha>")]);
  });
  it("npm run sweep writes the clip-by-skeleton results", () => {
    const out = execFileSync(process.execPath, [join(ROOT, "tools/sweep/main.ts"), ...RIGS, "--sample", "4"], { cwd: ROOT, encoding: "utf8" });
    expect(out).toMatch(/^sweep: (PASS|FAIL), \d+ of 8 clip-skeleton pairs pass/m);
    const res = JSON.parse(readFileSync(join(ROOT, "check-output/sweep/results.json"), "utf8")) as { rigs: string[]; clips: number; warned: unknown[]; rows: SweepRow[] };
    expect([res.rigs, res.clips, res.rows.length]).toEqual([RIGS, 4, 8]);
    expect(res.warned).toEqual(res.rows.filter((r) => r.ok && r.warns.length).map((r) => ({ clip: r.clip, rig: r.rig, warns: r.warns })));
    for (const r of res.rows) expect(Object.keys(r).sort()).toEqual(["clip", "ok", "own", "played", "reach", "rig", "warns", "why", "worse"]);
  }, 120_000);
  it("gives 1bf5252's rows, byte for byte, on a fixed sample (the judge moved to @m3a/tools)", async () => {
    // a deliberate change to the rows re-pins the hash, saying why
    const walk = load("QUATERNIUS_3D2DGE/Walk_Loop");
    const clips = [...PINNED.map(load), { clip: { ...walk.clip, id: "BROKEN/Walk_Loop", keys: walk.clip.keys.map((k, i) => (i === 2 ? { ...k, hips: [Number.NaN, 0, 0] } : k)) as Key[] } as Clip, rest: walk.rest }];
    const rows: SweepRow[] = [];
    for (const rig of RIGS) {
      const b = await rigOf(rig);
      for (const c of clips) rows.push(sweepOne(c.clip, c.rest, b, rig));
    }
    // the verdicts, readable (a pair: pass or fail, its reasons and warns counted), then every byte
    expect(rows.map((r) => `${r.rig} ${r.clip.split("/")[1]} ${r.ok ? "pass" : "fail"} ${r.why.length} ${r.warns.length}`).join(", ")).toBe(
      "gen-0 Backflip fail 1 0, gen-0 Run_Jump_Over pass 0 1, gen-0 Slide_Exit pass 0 0, gen-0 Hit_Knockback fail 1 0, gen-0 Pistol_Aim_Up pass 0 0, gen-0 BentForward_SideRunLeft pass 0 0, gen-0 Walk_Loop fail 1 0, " +
        "gen-7 Backflip fail 1 0, gen-7 Run_Jump_Over pass 0 0, gen-7 Slide_Exit pass 0 0, gen-7 Hit_Knockback pass 0 0, gen-7 Pistol_Aim_Up pass 0 0, gen-7 BentForward_SideRunLeft pass 0 0, gen-7 Walk_Loop fail 1 0",
    );
    expect(createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16), JSON.stringify(rows)).toBe("b4f51cf5d8276a36");
  }, 60_000);
});
