// Ship (PLAN.md WP-7.2a): license.check on every surface, then its failing inputs: a tier not opted in to, a clip or set
// that isn't there, local content shipped, a wrong call, and a workshop copy, clip file or clip JSON checked as each
// library clip it names and by its own license, its credit owed.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { credited, tierOf, TIERS } from "@m3a/library";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { libraryAccess } from "../src/node/library.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { SHIP } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";
import { workshopClip } from "./helpers/workshop.ts";

const AKIMBO = "STYLE100/Akimbo_Walk", text = (id: string) => readFileSync(join(ROOT, `library/sets/${id}.json`), "utf8");
const clipOf = (id: string) => JSON.parse(text(id)) as { provenance: object };
const found = (r: Reply) => [r.status, (r.data as { findings: { where: string; message: string }[] } | null)?.findings.map((f) => `${f.where}: ${f.message}`)];
const NOT_CC0 = "this game opts into cc0: opt in, or use a clip from those tiers", STYLE = "100STYLE, Mason, Starke and Komura (CC BY 4.0)";

/** Runs `body` with license.check called in a fresh working directory (unseeded), deleted after. */
async function inCwd(body: (call: (args: object) => Promise<Reply>, cwd: string) => Promise<void>): Promise<void> {
  const { cwd, rm } = exampleCwd(false), reg = new Registry(SHIP), host = nodeHost(cwd);
  try {
    await body((args) => reg.call("license.check", args, { host }), cwd);
  } finally {
    rm();
  }
}

describe("ship", () => {
  runExamples(SHIP);

  it("takes D10's tier rule from the library: every set's sources fit its tier by it, as checkSets holds them", () => {
    const lib = libraryAccess(ROOT, TIERS), sets = lib.source.sets();
    for (const set of sets) {
      const { tier, sources } = lib.library.about(set);
      for (const s of Object.values(sources)) if (tier !== "local") expect(tierOf(s.license), `${set}: ${s.license}`).toBe(tier);
    }
    expect([...new Set(sets.map((s) => lib.library.about(s).tier))].sort()).toEqual(["cc-by", "cc0", "cmu"]); // a set of each shipped tier
    expect(["CC0-1.0", "CC-BY-3.0", "LicenseRef-CMU-Mocap", "CC-BY-SA-4.0", "MIT"].map(tierOf)).toEqual(["cc0", "cc-by", "cmu", "local", "local"]);
    expect(TIERS.map(credited)).toEqual([false, true, true, false]);
  });

  it("fails a clip, a set or game.json the tiers don't cover, a clip that isn't there and local content shipped, and refuses a wrong call", () =>
    inCwd(async (call, cwd) => {
      expect((await call({ clips: [AKIMBO], tiers: ["cc0", "cc-by"] })).lines).toEqual(["Motion credits:", "- 100STYLE walks (CC-BY-4.0): 100STYLE by Ian Mason, Sebastian Starke and Taku Komura, CC BY 4.0."]);
      expect(found(await call({ clips: [AKIMBO, "QUATERNIUS_3D2DGE/Walk_Lop"] }))).toEqual(["findings", [`${AKIMBO}: STYLE100 is a cc-by set and ${NOT_CC0}`, 'QUATERNIUS_3D2DGE/Walk_Lop: no clip "QUATERNIUS_3D2DGE/Walk_Lop" in the library; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']]);
      const many = await call({ clips: readdirSync(join(ROOT, "library/sets/STYLE100")).filter((f) => !f.startsWith("_")).slice(0, 21).map((f) => `STYLE100/${f.slice(0, -5)}`) });
      expect([many.verdict, (many.data as { findings: object[] }).findings.length, many.data, many.lines[20]]).toEqual(["license.check 21 clips (tiers cc0): FAIL, 21 failing", 20, expect.objectContaining({ more: 1 }), "more: 1"]);
      expect(found(await call({ set: "STYLE100" }))).toEqual(["findings", ["STYLE100: a cc-by set and this game opts into cc0: opt in, or use another set"]]);
      expect(found(await call({ clips: ["QUATERNIUS_3D2DGE/Walk_Loop"], tiers: ["cc0", "local"] }))).toEqual(["findings", ["tiers: a shipped game opts into local: local content never ships (D10)"]]);
      expect((await call({ clips: ["QUATERNIUS_3D2DGE/Walk_Loop"], tiers: ["cc0", "local"], ships: false })).status).toBe("ok");
      expect((await call({ tiers: ["cc0", "gpl"] })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^tiers\[1\] is "gpl", not one of cc0, cc-by, cmu, local/) });
      expect((await call({ tiers: [] })).error).toMatchObject({ code: "E_ARGS", message: 'tiers lists at least one tier, as ["cc0"]' });
      expect((await call({ set: "QUATERNIUS_3D2DGE", clips: [AKIMBO] })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^give clips or set, not both/) });
      expect((await call({ set: "QUATERNIUS_3D2DE" })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^no set "QUATERNIUS_3D2DE"; did you mean "QUATERNIUS_3D2DGE"\?/) });
      expect(found(await call({ set: "QUATERNIUS_3D2DGE", tiers: ["cc0", "local"] }))).toEqual(["findings", ["tiers: a shipped game opts into local: local content never ships (D10)"]]);
      expect((await call({ set: "QUATERNIUS_3D2DGE", tiers: ["cc0", "local"], ships: false })).status).toBe("ok");
      expect(await call({ set: "library" })).toMatchObject({ verdict: "license.check the library (every tier): PASS, 8 credits owed", data: { ok: true, credits: { length: 8 } } });
      for (const args of [{ tiers: ["cc0"] }, { ships: true }]) expect((await call({ set: "library", ...args })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^set "library" audits every set with no tier gate/) });
      expect((await call({ clips: ["../x.json"] })).error).toMatchObject({ code: "E_PATH" }); // a path out of the working directory is still refused
      for (const clips of [[], [" "]]) expect((await call({ clips })).error).toMatchObject({ code: "E_ARGS", message: 'clips lists one clip or more, as ["SET/Name"], none blank' });
      expect((await call({})).verdict).toBe("license.check every set (tiers cc0): PASS, 0 credits owed");
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "cc-by"], clips: [AKIMBO] }));
      expect(await call({})).toMatchObject({ status: "ok", verdict: "license.check game.json's 1 clip (tiers cc0, cc-by): PASS, 1 credit owed" });
      for (const ships of [false, undefined]) {
        writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "local"], ships }));
        expect((await call({})).status).toBe(ships === false ? "ok" : "findings"); // game.json's ships: false is honoured
      }
      writeFileSync(join(cwd, "bad.json"), "{}"); // one that won't load is a finding too, an absolute path named as the clip file
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ clips: ["WORKSHOP/Gone", "nope.json", join(cwd, "bad.json"), "QUATERNIUS_3D2DGE/Walk_Lop"] }));
      expect(found(await call({}))).toEqual(["findings", [expect.stringMatching(/^WORKSHOP\/Gone: no workshop clip "WORKSHOP\/Gone"/), "nope.json: no such file: give a path under the working directory, or a clip id", expect.stringMatching(/^the clip file: it is not a valid clip/), expect.stringMatching(/^QUATERNIUS_3D2DGE\/Walk_Lop: no clip .*; did you mean/)]]);
      for (const game of [{ clips: AKIMBO }, { ships: "no" }, { clips: [] }]) {
        writeFileSync(join(cwd, "game.json"), JSON.stringify(game));
        expect((await call({})).error).toMatchObject({ code: "E_GAME", message: expect.stringMatching(/"clips" lists one clip id or more/) });
      }
    }));

  it("checks a workshop copy, a clip file or a clip's JSON as each library clip it names and by its own license", () =>
    inCwd(async (call, cwd) => {
      const copy = (name: string) => JSON.stringify({ ...clipOf(AKIMBO), id: `WORKSHOP/${name}`, name });
      workshopClip(cwd, "Proud", copy("Proud"), AKIMBO);
      workshopClip(cwd, "Lost", copy("Lost"), AKIMBO);
      writeFileSync(join(cwd, ".m3a/history/Lost.json"), "{"); // unreadable: its own provenance decides
      workshopClip(cwd, "Odd", copy("Odd"), "STYLE100/Gone_Walk"); // a set's clip no longer in it
      writeFileSync(join(cwd, "akimbo.json"), text(AKIMBO));
      // composed clips as compile writes them: one whose first input (its orig) is cc0 and second cc-by, one with an input
      // from no library clip whose credit it carries; and a cc0 set's clip carrying a CC-BY license
      const walk = clipOf("MESH2MOTION/Walk"), neutral = clipOf("STYLE100/Neutral_Walk"), recipe = (inputs: string[]) => ({ sha256: "2".repeat(64), inputs: Object.fromEntries(inputs.map((id) => [id, "0".repeat(64)])) });
      writeFileSync(join(cwd, "mixed.json"), JSON.stringify({ ...walk, id: "MESH2MOTION/Mixed", provenance: { ...walk.provenance, orig: "MESH2MOTION/Walk", license: "CC-BY-4.0", credit: STYLE, recipe: recipe(["MESH2MOTION/Walk", "STYLE100/Neutral_Walk"]) } }));
      writeFileSync(join(cwd, "blend.json"), JSON.stringify({ ...neutral, id: "WORKSHOP/Blend", name: "Blend", provenance: { ...neutral.provenance, orig: "STYLE100/Neutral_Walk", credit: `${STYLE}; Jane Doe, My Walk (CC BY 4.0)`, recipe: recipe(["STYLE100/Neutral_Walk", "WORKSHOP/Mine"]) } }));
      const loop = clipOf("QUATERNIUS_3D2DGE/Walk_Loop"), pose = clipOf("QUATERNIUS_3D2DGE/A_TPose"), somebody = { license: "CC-BY-4.0", credit: "Somebody (CC BY 4.0)" };
      writeFileSync(join(cwd, "ccby.json"), JSON.stringify({ ...loop, provenance: { ...loop.provenance, ...somebody } }));
      const mine = JSON.stringify({ ...pose, id: "MINE/Pose" }), clips = ["WORKSHOP/Proud", "workshop/Lost.json", "akimbo.json", mine, "mixed.json", "ccby.json", "blend.json"];
      expect(found(await call({ clips }))).toEqual(["findings", [
        `WORKSHOP/Proud (from ${AKIMBO}): STYLE100 is a cc-by set and ${NOT_CC0}`,
        `workshop/Lost.json: its license CC-BY-4.0 needs the cc-by tier and ${NOT_CC0}`,
        `akimbo.json (from ${AKIMBO}): STYLE100 is a cc-by set and ${NOT_CC0}`,
        "MINE/Pose: from no library clip (license CC0-1.0): check its terms yourself",
        `mixed.json (from STYLE100/Neutral_Walk): STYLE100 is a cc-by set and ${NOT_CC0}`,
        `ccby.json: its license CC-BY-4.0 needs the cc-by tier and ${NOT_CC0}`,
        `blend.json (from STYLE100/Neutral_Walk): STYLE100 is a cc-by set and ${NOT_CC0}`,
      ]]);
      const ok = await call({ clips, tiers: ["cc0", "cc-by"] }); // credited: the set, and each clip's own credit where no set answers for it
      expect([ok.status, ok.verdict, (ok.data as { block: string }).block.split("\n").slice(2)]).toEqual(["ok", "license.check 7 clips (tiers cc0, cc-by): PASS, 4 credits owed, 2 open questions", [`- Lost (CC-BY-4.0): ${STYLE}`, "- Walk_Loop (CC-BY-4.0): Somebody (CC BY 4.0)", "- Blend (CC-BY-4.0): Jane Doe, My Walk (CC BY 4.0)"]]);
      const twice = await call({ clips: ["ccby.json", JSON.stringify({ ...pose, provenance: { ...pose.provenance, ...somebody, license: "CC-BY-3.0" } })], tiers: ["cc0", "cc-by"] }); // one credit line, one entry
      expect((twice.data as { credits: object[] }).credits).toEqual([expect.objectContaining({ title: "Walk_Loop, A_TPose", credit: "Somebody (CC BY 4.0)", licenses: ["CC-BY-3.0", "CC-BY-4.0"], clips: 2 })]);
      // a file renamed into a cc-by set, one named only by its orig, one on a rest no set has, one whose license only
      // local holds, and an absolute path (named by its id)
      writeFileSync(join(cwd, "renamed.json"), JSON.stringify({ ...neutral, id: "STYLE100/My_Walk", provenance: { ...neutral.provenance, license: "CC0-1.0", credit: undefined } }));
      writeFileSync(join(cwd, "orig.json"), JSON.stringify({ ...loop, id: "MINE/Orig", provenance: { ...loop.provenance, orig: "STYLE100/Neutral_Walk" } }));
      writeFileSync(join(cwd, "ownrest.json"), JSON.stringify({ ...loop, id: "MINE/Walk", restSrc: "MYRIG" }));
      const mit = JSON.stringify({ ...loop, id: "MINE/Mit", provenance: { ...loop.provenance, license: "MIT" } });
      const yours = JSON.stringify({ ...neutral, id: "STYLE100/Your_Walk" }); // its set and its license: one cause, one finding
      expect(found(await call({ clips: ["renamed.json", yours, "WORKSHOP/Odd", "orig.json", "ownrest.json", mit, join(cwd, "akimbo.json")] }))).toEqual(["findings", [
        `renamed.json: STYLE100 is a cc-by set and ${NOT_CC0}`,
        `STYLE100/Your_Walk: STYLE100 is a cc-by set and ${NOT_CC0}`,
        `WORKSHOP/Odd: STYLE100 is a cc-by set and ${NOT_CC0}`,
        `orig.json (from STYLE100/Neutral_Walk): STYLE100 is a cc-by set and ${NOT_CC0}`,
        "ownrest.json: from no library clip (license CC0-1.0): check its terms yourself",
        "MINE/Mit: its license MIT fits no tier a shipped game may opt into (D10): replace the clip, or set ships: false",
        `${AKIMBO}: STYLE100 is a cc-by set and ${NOT_CC0}`,
      ]]);
      expect((await call({ clips: [mit, "ccby.json"], tiers: ["cc0", "local"], ships: false })).verdict).toBe("license.check 2 clips (tiers cc0, local): PASS, 1 credit owed, 1 open question"); // local holds any license
      expect((await call({ clips: ["ownrest.json"] })).lines.at(-1)).toBe("Motion: CC0 clips; no credit is owed.");
      expect((await call({ clips: [mit], tiers: ["cc0", "local"], ships: false })).lines.at(-1)).toBe("Motion: no credit is owed."); // not "CC0 clips"
      // D10's tiers: a CC-BY-SA clip fits only local, a CMU clip's own credit is owed, and a credited part with no credit fails
      const own = (id: string, provenance: object) => JSON.stringify({ ...loop, id: `MINE/${id}`, name: id, provenance: { ...loop.provenance, ...provenance } });
      const sa = own("Sa", { license: "CC-BY-SA-4.0", credit: "Sam (CC BY-SA 4.0)" }), cmu = own("Cmu", { license: "LicenseRef-CMU-Mocap", credit: "CMU Graphics Lab Motion Capture Database" });
      const bare = own("Bare", { orig: "QUATERNIUS_3D2DGE/Walk_Loop", license: "CC0-1.0 AND CC-BY-4.0", credit: " " }); // escapes core's credit check (M2-E018)
      expect(found(await call({ clips: [sa, bare], tiers: ["cc0", "cc-by"] }))).toEqual(["findings", ["MINE/Sa: its license CC-BY-SA-4.0 fits no tier a shipped game may opt into (D10): replace the clip, or set ships: false", "MINE/Bare: its license CC-BY-4.0 needs a credit line (provenance.credit): add the attribution"]]);
      expect((await call({ clips: [cmu], tiers: ["cc0", "cmu"] })).lines.slice(1)).toEqual(["Motion credits:", "- Cmu (LicenseRef-CMU-Mocap): CMU Graphics Lab Motion Capture Database"]);
    }));
});
