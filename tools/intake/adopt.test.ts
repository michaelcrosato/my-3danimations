// The adopt bot and library-gates on the local store (PLAN.md WP-9.1a's Done-when), in a scratch checkout (the library
// copied under the OS's temp directory): the owner's adoptions committed in a dry run (the clip, its catalog row and
// provenance written through the writer, the pull request printed, merged when the gates pass; an improvement a new
// version of its clip, its lineage kept), an adoption already in the library not committed twice; an adoption not
// recorded by the owner's identity refused; a pull request whose gates fail closed, its files restored and its
// submission returned to review; and library-gates failing a planted bad clip. Submissions are put in review by hand:
// the checker's own suite (check.test.ts) proves how they get there.
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { procedural, serialize, type Clip } from "@m3a/core";
import { contentHash, localStore, motionHash, type IntakeStore } from "../../packages/tools/src/intake/index.ts";
import { intakeFiles } from "../../packages/tools/src/node/intake.ts";
import { adopt, dryRun } from "./adopt.ts";
import { bindRigs, type Rig } from "./check.ts";
import { fixtures } from "./fixtures.ts";
import { plantedGates } from "./gates.ts";
import { LOCAL_OWNER, libraryAt } from "./host.ts";
import { scratchCheckout } from "./write.ts";

const TODAY = "2026-10-19", today = () => TODAY;
let D: string, rigs: Rig[];
const printed: string[] = [], prs = dryRun((t) => void printed.push(t)), sent = new Map<string, string>();
const store = (role: "contributor" | "checker" | "owner", id?: string): IntakeStore => localStore({ files: intakeFiles(join(D, ".cache/intake")), role, ...(id ? { id } : {}), today });
const file = (p: string) => readFileSync(join(D, p), "utf8");
const bot = () => adopt({ store: store("checker"), owner: LOCAL_OWNER, checkout: D, prs, today, rigs });
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
  const lib = libraryAt(join(D, "library/sets"));
  for (const f of fixtures(lib).filter((x) => x.expect === "awaiting review")) await inReview(f.name, f.text, f.improves);
  const rest = lib.library.about("QUATERNIUS_3D2DGE").sources.UAL1!.rest, g = procedural.gaitClip(procedural.GAITS[1]!, rest, { restSrc: "UAL1", id: "FIXTURES/Brisk" });
  await inReview("brisk", serialize({ ...g, provenance: { ...g.provenance, intake: { by: "a test of tools/intake (michaelcrosato)" } } as Clip["provenance"] }));
}, 60_000);
afterAll(() => rmSync(D, { recursive: true, force: true }));

describe("the adopt bot, in a dry run against a scratch checkout", () => {
  it("writes each owner's adoption into its set with its catalog row and provenance, prints the pull request, and merges it on the gates", async () => {
    await decide(sent.get("clean")!, LOCAL_OWNER, "reads well");
    await decide(sent.get("improvement")!);
    const was = file("library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json"), out = await bot();
    expect(out.map((o) => [o.outcome, o.clip])).toEqual(expect.arrayContaining([["merged", "INTAKE_CC0/Stroll"], ["merged", "QUATERNIUS_3D2DGE/Walk_Loop"]]));
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
    expect(printed.join("\n")).toMatch(/^would open pull request #1 against main from intake\/s-[0-9a-f]{16}: Adopt [A-Za-z0-9_/]+ from the intake queue \(s-[0-9a-f]{16}\)\n {2}Adopts s-[^]*\n {2}files: library\/sets[^]*\nwould merge #1: the library gates pass\n/);
    // committed once: the library records what was adopted, so the next run leaves both alone
    expect(await bot()).toEqual([]);
  }, 60_000);
  it("refuses an adoption not recorded by the owner's identity: nothing written, the submission back in review", async () => {
    await decide(sent.get("brisk")!, "mallory");
    const [o] = await bot();
    expect([o!.outcome, o!.why, o!.pr]).toEqual(["refused", expect.stringMatching(/recorded by "mallory", not by the owner's identity/), null]);
    expect([existsSync(join(D, "library/sets/INTAKE_CC0/Brisk.json")), (await store("checker").get(sent.get("brisk")!))!.state]).toEqual([false, "awaiting review"]);
  });
  it("closes the pull request when the library gates fail on it, restores what it wrote, and returns the submission to review", async () => {
    const catalog = file("library/sets/INTAKE_CC0/catalog.tsv"), other = join(D, "library/sets/STYLE100_IDLE/Angry_Idle.json"), kept = readFileSync(other, "utf8");
    await decide(sent.get("brisk")!);
    appendFileSync(other, " "); // a file changed outside the writer: the library no longer loads as locked
    try {
      const [o] = await bot();
      expect([o!.outcome, o!.why]).toEqual(["closed", expect.stringMatching(/^its pull request #3 failed the library gates: the library loads, every file as locked: STYLE100_IDLE doesn't match its lock/)]);
      expect(printed.at(-1)).toMatch(/^would close #3: its pull request #3 failed the library gates/);
      expect([existsSync(join(D, "library/sets/INTAKE_CC0/Brisk.json")), file("library/sets/INTAKE_CC0/catalog.tsv")]).toEqual([false, catalog]);
      expect(await store("checker").get(sent.get("brisk")!)).toMatchObject({ state: "awaiting review", reason: o!.why });
    } finally {
      writeFileSync(other, kept);
    }
  }, 60_000);
});

describe("library-gates on a pull request with a planted bad clip", () => {
  it("fails the planted near-duplicate with its reason (npm run gate -- library-pr --fixture all plants each)", async () => {
    const r = await plantedGates("duplicate", undefined, rigs);
    expect(r.steps.map((s) => [s.name, s.ok, s.summary])).toEqual([["duplicate (INTAKE_CC0/My_Walk)", true, expect.stringMatching(/^failed as it must: dedup: a near-duplicate of QUATERNIUS_3D2DGE\/Walk_Loop/)]]);
  }, 60_000);
});
