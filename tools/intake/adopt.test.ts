// The adopt bot and library-gates on the local store (PLAN.md WP-9.1a's Done-when), in a scratch checkout (the library
// copied under the OS's temp directory): the owner's adoptions committed in a dry run (the clip, its catalog row and
// provenance written through the writer, the pull request printed, merged when the gates pass; an improvement a new
// version of its clip, its lineage kept), an adoption already in the library not committed twice; an adoption not
// recorded by the owner's identity refused; a new clip named with a name its set hasn't, never over a clip it holds; a
// pull request whose gates fail closed, its files restored and its submission returned to review; an adoption that
// fails on the way returned to review, the next going on; GitHub's pull requests (a local remote and a stand-in gh:
// nothing hosted is called) gated on their own tree and each made on the main the last one merged into; and
// library-gates failing a planted bad clip, one a pull request adds outside the intake too, and a forged adoption; and
// passing a clip that never moves only where library/baselines/qa.json answers it and it came outside the intake (F.13).
// Submissions are put in review by hand: the checker's own suite (check.test.ts) proves how they get there. The derived
// files' regeneration is stubbed here (a library-only checkout; adopt.full.test.ts runs the repository's commands in a
// whole one, under M3A_FULL), its worse distributions named in the pull request; and an improved migrated set stays as
// npm run migrate writes it, the adopted clip kept byte for byte and a review carried while its motion hash matches. An
// improvement of a CC BY clip, sent as `m3a library submit --improves` sends it (no provenance.orig), is adopted with
// its license and credit.
import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { format, parseClip, procedural, serialize, type Clip } from "@m3a/core";
import { DedupIndex } from "@m3a/library";
import { contentHash, localStore, motionHash, type IntakeStore, type Submission } from "../../packages/tools/src/intake/index.ts";
import { intakeFiles } from "../../packages/tools/src/node/intake.ts";
import { libraryClips } from "../qa/qa.ts";
import { ROOT } from "../run/cli.ts";
import { migrate } from "../migrate/migrate.ts";
import { adopt, adoptedClip, dryRun, github, type PullRequests, type Regenerated } from "./adopt.ts";
import { bindRigs, type Rig } from "./check.ts";
import { BARE_SET, fixtures } from "./fixtures.ts";
import { clipsOf, plantedGates, runGates, type Changed } from "./gates.ts";
import { LOCAL_OWNER, libraryAt } from "./host.ts";
import { scratchCheckout, writeClip, type Written } from "./write.ts";

// T1 runs the bot's cheap cases; T2's full step (M3A_FULL=1) the ones that write, gate and regenerate a set too
const FULL = process.env.M3A_FULL === "1", TODAY = "2026-10-19", today = () => TODAY;
let D: string, rigs: Rig[], near: DedupIndex;
const printed: string[] = [], prs = dryRun((t) => void printed.push(t)), sent = new Map<string, string>();
const store = (role: "contributor" | "checker" | "owner", id?: string): IntakeStore => localStore({ files: intakeFiles(join(D, ".cache/intake")), role, ...(id ? { id } : {}), today });
const file = (p: string) => readFileSync(join(D, p), "utf8");
const regenerate = async (): Promise<Regenerated> => ({ steps: [], files: ["docs/LIBRARY.md"], worse: ["p95 of a metric 1.2 → 1.4 (the test's)"], restore: () => {} });
// the library's near-duplicate index built once for the suite (the bot's default builds it each run)
const gates = (root: string, changed: readonly Changed[]) => runGates(root, changed, rigs, { by: "bot", near });
const bot = () => adopt({ store: store("checker"), owner: LOCAL_OWNER, checkout: D, prs, today, rigs, regenerate, gates });
/** Sends `text` and puts it in review (the checker's moves), returning its id. */
async function inReview(name: string, text: string, improves: string | null = null): Promise<string> {
  const s = await store("contributor", "fixtures").submit({ kind: "clip", text, improves });
  await store("checker").advance(s.id, "checking");
  await store("checker").advance(s.id, "awaiting review", { report: { gates: [{ gate: "schema", ok: true }] } });
  sent.set(name, s.id);
  return s.id;
}
const decide = async (id: string, by = LOCAL_OWNER, note = "") => store("owner", by).decide(id, { as: "adopt", hash: (await store("checker").get(id))!.content, note, date: TODAY });

beforeAll(async () => {
  D = scratchCheckout();
  rigs = await bindRigs();
  near = DedupIndex.of(libraryClips(join(D, "library/sets")));
  const lib = libraryAt(join(D, "library/sets"));
  for (const f of fixtures(lib).filter((x) => x.expect === "awaiting review")) await inReview(f.name, f.text, f.improves);
  const rest = lib.library.about("QUATERNIUS_3D2DGE").sources.UAL1!.rest, g = procedural.gaitClip(procedural.GAITS[1]!, rest, { restSrc: "UAL1", id: "FIXTURES/Brisk" });
  await inReview("brisk", serialize({ ...g, provenance: { ...g.provenance, intake: { by: "a test of tools/intake (michaelcrosato)" } } as Clip["provenance"] }));
}, 60_000);
afterAll(() => rmSync(D, { recursive: true, force: true }));

describe("the adopt bot, in a dry run against a scratch checkout", () => {
  it.runIf(FULL)("writes each owner's adoption into its set with its catalog row and provenance, prints the pull request, and merges it on the gates", async () => {
    await decide(sent.get("clean")!, LOCAL_OWNER, "reads well");
    await decide(sent.get("improvement")!);
    await decide(sent.get("improvement-cc-by")!);
    const was = file("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json"), credit = libraryAt(join(D, "library/sets")).library.clip("STYLE100/Neutral_Walk").clip.provenance.credit, out = await bot();
    expect(out.map((o) => [o.outcome, o.clip, o.why])).toEqual(expect.arrayContaining([["merged", "INTAKE_CC0/Stroll", null], ["merged", "QUATERNIUS_3D2DGE/Walk_Loop", null], ["merged", "STYLE100/Neutral_Walk", null]]));
    // a CC BY clip's improvement keeps its set's license and credit, though it names no orig (the tool sets none)
    const style = JSON.parse(file("library/sets/STYLE100/Neutral_Walk.json")) as Clip;
    expect([style.provenance.orig, style.provenance.license, style.provenance.credit, style.review?.state]).toEqual([undefined, "CC-BY-4.0", credit, "approved"]);
    const clip = JSON.parse(file("library/sets/INTAKE_CC0/Stroll.json")) as Clip & { provenance: { intake: Record<string, unknown> } };
    expect(clip.review).toEqual({ state: "approved", by: LOCAL_OWNER, date: TODAY, motion: motionHash(clip), note: `adopted from ${sent.get("clean")}@${(await store("checker").get(sent.get("clean")!))!.content.slice(0, 12)}: reads well` });
    expect([clip.provenance.intake.by, clip.provenance.intake.submission, clip.provenance.intake.report, clip.quality.qa, clip.facts?.by]).toEqual([expect.stringMatching(/^tools\/intake\/fixtures\.ts/), expect.stringMatching(new RegExp(`^${sent.get("clean")}@[0-9a-f]{64}$`)), undefined, "pass", "m3a-facts@1"]);
    expect(file("library/sets/INTAKE_CC0/catalog.tsv")).toMatch(/^INTAKE_CC0\/Stroll\t1\.2\tloop\t/);
    expect(JSON.parse(file("library/sets/INTAKE_CC0/_set.json")) as object).toMatchObject({ set: "INTAKE_CC0", tier: "cc0", sources: { UAL1: { license: "CC0-1.0" } } });
    expect(Object.keys((JSON.parse(file("library/sets.lock.json")) as { sets: object }).sets)).toContain("INTAKE_CC0");
    // the improvement: a new version of the clip it improves, in its set, the version it improved named by its hash
    const now = JSON.parse(file("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json")) as Clip & { provenance: { intake: { improves: { sha256: string } } } };
    expect([now.provenance.intake.improves.sha256, now.review?.state, now.desc, file("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json") === was]).toEqual([contentHash(was), "approved", "Walks at an easy pace, looking a little to the right", false]);
    expect(() => libraryAt(join(D, "library/sets")).library.verify()).not.toThrow();
    expect(printed.join("\n")).toMatch(/^would open pull request #1 against main from intake\/s-[0-9a-f]{16}: Adopt [A-Za-z0-9_/]+ from the intake queue \(s-[0-9a-f]{16}\)\n {2}Adopts s-[^]*\n {2}- worse than recorded, recorded with this adoption [^\n]*: p95 of a metric 1\.2 → 1\.4 \(the test's\)\n[^]*\n {2}files: docs\/LIBRARY\.md, library\/sets[^]*\nwould merge #1: the library gates pass\n/);
    // committed once: the library records what was adopted, so the next run leaves both alone
    expect(await bot()).toEqual([]);
  }, 60_000);
  it.runIf(FULL)("leaves an improved migrated set as npm run migrate writes it: the adopted clip kept, a review carried while its motion hash matches", () => {
    const sets = join(D, "library/sets"), set = "QUATERNIUS_3D2DGE", run = () => migrate(ROOT, { sets: [set], disk: { dir: sets, sets: [set] } });
    const differ = (m: ReturnType<typeof run>) => [...m.files].filter(([p, t]) => t !== file(`library/sets/${p}`)).map(([p]) => p), m = run();
    expect([m.report.sets[0]!.adopted.map((a) => a.id), differ(m)]).toEqual([[`${set}/Walk_Loop`], []]);
    const idle = parseClip(file(`library/sets/${set}/Idle_Loop.json`)), roll = parseClip(file(`library/sets/${set}/Roll.json`));
    writeClip(D, { ...idle, review: { state: "approved", by: LOCAL_OWNER, date: TODAY, motion: motionHash(idle) } });
    writeClip(D, { ...roll, review: { state: "flagged", by: LOCAL_OWNER, date: TODAY, motion: "0".repeat(64), note: "on another motion" } });
    const again = run();
    expect([parseClip(again.files.get(`${set}/Idle_Loop.json`)!).review?.state, parseClip(again.files.get(`${set}/Roll.json`)!).review, differ(again)]).toEqual(["approved", undefined, [`${set}/Roll.json`, `${set}/_set.json`]]);
    writeClip(D, roll);
  }, 30_000);
  it("refuses an adoption not recorded by the owner's identity: nothing written, the submission back in review", async () => {
    await decide(sent.get("brisk")!, "mallory");
    const [o] = await bot();
    expect([o!.outcome, o!.why, o!.pr]).toEqual(["refused", expect.stringMatching(/recorded by "mallory", not by the owner's identity/), null]);
    expect([existsSync(join(D, "library/sets/INTAKE_CC0/Brisk.json")), (await store("checker").get(sent.get("brisk")!))!.state]).toEqual([false, "awaiting review"]);
  });
  it("names a new clip with a name its set hasn't (the submission's six hex digits, then _2, _3 ...), never over a clip the set holds", () => {
    const text = fixtures(libraryAt(join(D, "library/sets")), "clean")[0]!.text, clip = parseClip(text), name = format.slug(clip.id.split("/")[1]!), ids: string[] = [], taken: Written[] = [];
    const s: Submission = { id: "s-0123456789abcdef", contributor: "fixtures", kind: "clip", text, improves: null, content: contentHash(text), motion: null, state: "adopted", reason: null, report: null, decision: { as: "adopt", hash: contentHash(text), note: "", by: LOCAL_OWNER, date: TODAY }, date: TODAY };
    try {
      for (const n of [name, `${name}_012345`, `${name}_012345_2`]) {
        taken.push(writeClip(D, { ...clip, id: `INTAKE_CC0/${n}` }));
        ids.push(adoptedClip(s, LOCAL_OWNER, D).id);
      }
    } finally {
      for (const w of taken.reverse()) w.restore();
    }
    expect(ids).toEqual([`INTAKE_CC0/${name}_012345`, `INTAKE_CC0/${name}_012345_2`, `INTAKE_CC0/${name}_012345_3`]);
  });
  it.runIf(FULL)("closes the pull request when the library gates fail on it, restores what it wrote, and returns the submission to review", async () => {
    const catalog = file("library/sets/INTAKE_CC0/catalog.tsv"), other = join(D, "library/sets/STYLE100_IDLE/Angry_Idle.json"), kept = readFileSync(other, "utf8");
    await decide(sent.get("brisk")!);
    appendFileSync(other, " "); // a file changed outside the writer: the library no longer loads as locked
    try {
      const [o] = await bot();
      expect([o!.outcome, o!.why]).toEqual(["closed", expect.stringMatching(/^its pull request #4 failed the library gates: the library loads, every file as locked: STYLE100_IDLE doesn't match its lock/)]);
      expect(printed.at(-1)).toMatch(/^would close #4: its pull request #4 failed the library gates/);
      expect([existsSync(join(D, "library/sets/INTAKE_CC0/Brisk.json")), file("library/sets/INTAKE_CC0/catalog.tsv")]).toEqual([false, catalog]);
      expect(await store("checker").get(sent.get("brisk")!)).toMatchObject({ state: "awaiting review", reason: o!.why });
    } finally {
      writeFileSync(other, kept);
    }
  }, 60_000);
  it("returns an adoption that fails on the way to review, its files restored, and goes on to the next", async () => {
    await decide(sent.get("brisk")!);
    await decide(sent.get("improvement-of-a-twin")!);
    const dodge = file("library/sets/MESH2MOTION/Dodge_left.json"), failing: PullRequests = { ...prs, open: async () => Promise.reject(new Error("gh pr create failed: HTTP 502")) };
    const out = await adopt({ store: store("checker"), owner: LOCAL_OWNER, checkout: D, prs: failing, today, rigs, regenerate, gates });
    expect(out.map((o) => [o.id, o.outcome, o.why]).sort()).toEqual([sent.get("brisk")!, sent.get("improvement-of-a-twin")!].sort().map((id) => [id, "returned", "the adopt bot failed on it: gh pr create failed: HTTP 502"]));
    expect([existsSync(join(D, "library/sets/INTAKE_CC0/Brisk.json")), file("library/sets/MESH2MOTION/Dodge_left.json") === dodge, (await store("checker").get(sent.get("brisk")!))!.state]).toEqual([false, true, "awaiting review"]);
  });
});

describe("GitHub's pull requests (a local remote and a stand-in gh)", () => {
  it("leave the checkout on the pull request's tree for the gates, then on the main it merged into", async () => {
    const T = mkdtempSync(join(tmpdir(), "m3a-gh-")), work = join(T, "work"), log = join(T, "gh.log");
    const git = (...args: string[]) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: work, encoding: "utf8" }).stdout.trim();
    try {
      spawnSync("git", ["init", "--bare", "-b", "main", join(T, "origin.git")]);
      spawnSync("git", ["clone", "-q", join(T, "origin.git"), work]);
      writeFileSync(join(work, "a.txt"), "base\n");
      git("add", "a.txt");
      git("commit", "-qm", "base");
      git("push", "-q", "origin", "HEAD:main");
      // gh: a pull request's merge fast-forwards main to its branch (as a squash would leave its tree), a close drops it
      mkdirSync(join(T, "bin"));
      writeFileSync(join(T, "bin/gh"), ['#!/bin/sh', 'echo "$*" >> "$GH_LOG"', 'b=$(git rev-parse --abbrev-ref HEAD)', 'case "$1 $2" in', '"pr create") case "$*" in *broken*) echo "HTTP 502" >&2; exit 1;; esac; echo "https://github.com/o/r/pull/$(wc -l < "$GH_LOG" | tr -d " ")";;', '"pr merge") git push -q origin "$b:main" && git push -q origin --delete "$b";;', '"pr close") git push -q origin --delete "$b";;', 'esac', ''].join("\n"));
      chmodSync(join(T, "bin/gh"), 0o755);
      const gh = github(work, { ...process.env, PATH: `${join(T, "bin")}:${process.env.PATH}`, GH_LOG: log }), draft = (n: number, files: string[], title = `Adopt ${n}`) => ({ branch: `intake/s-${n}`, base: "main", title, body: "the body", files });
      writeFileSync(join(work, "a.txt"), "first\n");
      mkdirSync(join(work, "library"));
      writeFileSync(join(work, "library/New_Clip.json"), "{}\n");
      const one = await gh.open(draft(1, ["a.txt", "library/New_Clip.json"]));
      // the gates read the pull request's own tree: its branch, its files
      expect([one.number, git("rev-parse", "--abbrev-ref", "HEAD"), existsSync(join(work, "library/New_Clip.json")), readFileSync(join(work, "a.txt"), "utf8")]).toEqual([1, "intake/s-1", true, "first\n"]);
      await gh.merge(one.number);
      expect([git("rev-parse", "--abbrev-ref", "HEAD"), git("status", "--porcelain"), readFileSync(join(work, "a.txt"), "utf8"), git("rev-parse", "HEAD") === git("rev-parse", "origin/main")]).toEqual(["main", "", "first\n", true]);
      // the next is made on the main that one merged into; closed, the checkout is that main again
      writeFileSync(join(work, "a.txt"), "second\n");
      writeFileSync(join(work, "library/Other.json"), "{}\n");
      const two = await gh.open(draft(2, ["a.txt", "library/Other.json"]));
      expect(git("log", "--format=%s", "-3")).toBe("Adopt 2\nAdopt 1\nbase");
      await gh.close(two.number, "the gates failed");
      expect([git("rev-parse", "--abbrev-ref", "HEAD"), readFileSync(join(work, "a.txt"), "utf8"), existsSync(join(work, "library/Other.json")), git("ls-remote", "--heads", "origin").includes("intake/")]).toEqual(["main", "first\n", false, false]);
      // one gh can't open: nothing of it kept, the checkout back on main
      writeFileSync(join(work, "a.txt"), "third\n");
      await expect(gh.open(draft(3, ["a.txt"], "Adopt broken"))).rejects.toThrow(/gh pr failed: HTTP 502/);
      expect([git("rev-parse", "--abbrev-ref", "HEAD"), git("status", "--porcelain"), readFileSync(join(work, "a.txt"), "utf8")]).toEqual(["main", "", "first\n"]);
    } finally {
      rmSync(T, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("library-gates on a pull request", () => {
  it("reads the clips a pull request adds or changes, not a set's manifest, catalog or baselines", () => {
    const diff = ["A\tlibrary/sets/INTAKE_CC0/Stroll.json", "M\tlibrary/sets/STYLE100/Neutral_Walk.json", "M\tlibrary/sets/STYLE100/_set.json", "A\tlibrary/sets/INTAKE_CC0/_baseline.json", "M\tlibrary/sets/STYLE100/catalog.tsv", "D\tlibrary/sets/STYLE100/Old_Walk.json", ""].join("\n");
    expect(clipsOf(diff)).toEqual([{ id: "INTAKE_CC0/Stroll", added: true }, { id: "STYLE100/Neutral_Walk", added: false }]);
  });
  it("passes a library clip its own tools wrote with the library's baselines: its captured speed, its recorded QA reason", async () => {
    const steps = await runGates(D, [{ id: "STYLE100_BACKRUN/Waving_RunBack", added: false }, { id: "MESH2MOTION/Run_Female", added: false }], rigs);
    expect(steps.map((s) => [s.name, s.ok])).toEqual([["the library loads, every file as locked", true], ["licenses: the sets it touches", true], ["STYLE100_BACKRUN/Waving_RunBack", true], ["MESH2MOTION/Run_Female", true]]);
  });

  it.runIf(FULL)("fails the planted near-duplicate with its reason, in an intake set and outside the intake (npm run gate -- library-pr --fixture all plants each)", async () => {
    const r = await plantedGates("duplicate", undefined, rigs, near);
    expect(r.steps.map((s) => [s.name, s.ok, s.summary])).toEqual([
      ["duplicate (INTAKE_CC0/My_Walk)", true, expect.stringMatching(/^failed as it must: dedup: a near-duplicate of QUATERNIUS_3D2DGE\/Walk_Loop/)],
      [`duplicate, outside the intake (${BARE_SET}/My_Walk)`, true, expect.stringMatching(/^failed as it must: dedup: a near-duplicate of QUATERNIUS_3D2DGE\/Walk_Loop/)],
    ]);
  }, 60_000);
  it.runIf(FULL)("fails each bad clip a pull request adds to an existing set outside the intake, and a forged adoption; passes a clean one", async () => {
    const lib = libraryAt(join(D, "library/sets")), fx = fixtures(lib), bare = (name: string) => JSON.parse(fx.find((f) => f.name === name)!.bare!) as Clip;
    const rest = lib.library.about(BARE_SET).sources.UAL1!.rest, lope = procedural.gaitClip({ name: "lope", about: "a lope, long and easy", speed: 200, cycle: 0.9, stance: 0.45, swing: 30 }, rest, { restSrc: "UAL1", id: `${BARE_SET}/Planted_Lope` });
    const plants: [Clip, string | null][] = [
      [lope, null],
      [{ ...bare("generator-no-manifest"), id: `${BARE_SET}/Planted_Generated` }, "provenance: a generator (a learned motion model) needs its training-data manifest"],
      [{ ...bare("defect"), id: `${BARE_SET}/Planted_Sunk` }, "sensors: the sensors fail it: penetration"],
      [{ ...bare("forged-review"), id: `${BARE_SET}/Planted_Reviewed` }, "provenance: a clip added outside the intake carries a review"],
      [{ ...(JSON.parse(fx.find((f) => f.name === "forged-adoption")!.text) as Clip), id: "INTAKE_CC0/Planted_Adopted" }, "provenance: it records an adoption from the intake queue (provenance.intake.submission) that main hasn't"],
    ];
    const written = plants.map(([c]) => writeClip(D, c));
    try {
      const steps = await runGates(D, plants.map(([c]) => ({ id: c.id, added: true })), rigs, { near });
      expect(steps.slice(2).map((s) => [s.name, s.ok, s.ok ? null : s.summary!.slice(0, plants.find(([c]) => c.id === s.name)![1]!.length)])).toEqual(plants.map(([c, why]) => [c.id, why === null, why]));
    } finally {
      for (const w of written.reverse()) w.restore();
    }
  }, 60_000);
  it("passes a clip that never moves added outside the intake where library/baselines/qa.json answers it, never one through the intake (F.13)", async () => {
    // the frozen idle outside the intake, and the moving idle frozen at its middle key (another motion) through it, both
    // answered (npm run gate -- library-pr --fixture all fails each unanswered)
    const lib = libraryAt(join(D, "library/sets")), bare = JSON.parse(fixtures(lib, "frozen-idle")[0]!.bare!) as Clip, idle = JSON.parse(fixtures(lib, "idle")[0]!.text) as Clip;
    const intake: Clip = { ...idle, id: "INTAKE_CC0/Sway", keys: idle.keys.map((k) => ({ ...idle.keys[idle.keys.length >> 1]!, t: k.t })) };
    const qa = join(D, "library/baselines/qa.json"), was = readFileSync(qa, "utf8"), r = JSON.parse(was) as { still?: Record<string, string> }, written = [bare, intake].map((c) => writeClip(D, c));
    try {
      writeFileSync(qa, JSON.stringify({ ...r, still: { ...r.still, [bare.id]: "held so in its source", [intake.id]: "held so in its source" } }));
      const steps = await runGates(D, [bare, intake].map((c) => ({ id: c.id, added: true })), rigs, { near });
      expect(steps.slice(2).map((s) => [s.name, s.summary])).toEqual([[bare.id, "every gate green (added)"], [intake.id, expect.stringMatching(/^lint: it never moves: every body point stays within 3 mm of where it starts/)]]);
    } finally {
      writeFileSync(qa, was);
      for (const w of written.reverse()) w.restore();
    }
  }, 30_000);
  it("fails a clip the library hasn't as its own step, not the run", async () => {
    const steps = await runGates(D, [{ id: "QUATERNIUS_3D2DGE/Not_On_This_Branch", added: true }], rigs, { near });
    expect([steps[0]!.ok, steps.at(-1)!.name, steps.at(-1)!.ok, steps.at(-1)!.summary]).toEqual([true, "QUATERNIUS_3D2DGE/Not_On_This_Branch", false, expect.stringMatching(/^library: no clip/)]);
  });
});
