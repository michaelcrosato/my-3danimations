// Ship (PLAN.md WP-7.2a): license.check on every surface, then its failing inputs: a tier not opted in to, a clip or set
// that isn't there, local content shipped, a wrong call, and a workshop copy, clip file or clip JSON checked as each
// library clip it names and by its own license, its credit owed.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { SHIP } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";

const AKIMBO = "STYLE100/Akimbo_Walk", text = (id: string) => readFileSync(join(ROOT, `library/sets/${id}.json`), "utf8");
const clipOf = (id: string) => JSON.parse(text(id)) as { provenance: object };
const found = (r: Reply) => [r.status, (r.data as { findings: { where: string; message: string }[] } | null)?.findings.map((f) => `${f.where}: ${f.message}`)];
const NOT_CC0 = "this game opts into cc0: opt in, or use a clip from those tiers";

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
      expect((await call({ set: "library" })).data).toMatchObject({ ok: true, credits: { length: 8 } });
      expect((await call({})).verdict).toBe("license.check every set (tiers cc0): PASS, 0 credits owed");
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "cc-by"], clips: [AKIMBO] }));
      expect(await call({})).toMatchObject({ status: "ok", verdict: "license.check game.json's 1 clip (tiers cc0, cc-by): PASS, 1 credit owed" });
      for (const ships of [false, undefined]) {
        writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "local"], ships }));
        expect((await call({})).status).toBe(ships === false ? "ok" : "findings"); // game.json's ships: false is honoured
      }
      for (const game of [{ clips: AKIMBO }, { ships: "no" }]) {
        writeFileSync(join(cwd, "game.json"), JSON.stringify(game));
        expect((await call({})).error).toMatchObject({ code: "E_GAME", message: expect.stringMatching(/"clips" lists clip ids/) });
      }
    }));

  it("checks a workshop copy, a clip file or a clip's JSON as each library clip it names and by its own license", () =>
    inCwd(async (call, cwd) => {
      for (const d of ["workshop", ".m3a/history"]) mkdirSync(join(cwd, d), { recursive: true });
      for (const name of ["Proud", "Lost"]) writeFileSync(join(cwd, `workshop/${name}.json`), JSON.stringify({ ...clipOf(AKIMBO), id: `WORKSHOP/${name}`, name }));
      writeFileSync(join(cwd, ".m3a/history/Proud.json"), JSON.stringify({ from: AKIMBO }));
      writeFileSync(join(cwd, ".m3a/history/Lost.json"), "{"); // unreadable: its own provenance decides
      writeFileSync(join(cwd, "akimbo.json"), text(AKIMBO));
      // a composed clip whose first input (its orig) is cc0 and second cc-by; and a cc0 set's clip carrying a CC-BY license
      const walk = clipOf("MESH2MOTION/Walk"), inputs = { "MESH2MOTION/Walk": "0".repeat(64), "STYLE100/Neutral_Walk": "1".repeat(64) };
      writeFileSync(join(cwd, "mixed.json"), JSON.stringify({ ...walk, id: "MESH2MOTION/Mixed", provenance: { ...walk.provenance, orig: "MESH2MOTION/Walk", license: "CC-BY-4.0", credit: "100STYLE (CC BY 4.0)", recipe: { sha256: "2".repeat(64), inputs } } }));
      const loop = clipOf("QUATERNIUS_3D2DGE/Walk_Loop");
      writeFileSync(join(cwd, "ccby.json"), JSON.stringify({ ...loop, provenance: { ...loop.provenance, license: "CC-BY-4.0", credit: "Somebody (CC BY 4.0)" } }));
      const mine = JSON.stringify({ ...clipOf("QUATERNIUS_3D2DGE/A_TPose"), id: "MINE/Pose" }), clips = ["WORKSHOP/Proud", "workshop/Lost.json", "akimbo.json", mine, "mixed.json", "ccby.json"];
      expect(found(await call({ clips }))).toEqual(["findings", [
        `WORKSHOP/Proud (from ${AKIMBO}): STYLE100 is a cc-by set and ${NOT_CC0}`,
        `workshop/Lost.json: its license CC-BY-4.0 needs the cc-by tier and ${NOT_CC0}`,
        `akimbo.json (from ${AKIMBO}): STYLE100 is a cc-by set and ${NOT_CC0}`,
        "MINE/Pose: from no library clip (license CC0-1.0): check its terms yourself",
        `mixed.json (from STYLE100/Neutral_Walk): STYLE100 is a cc-by set and ${NOT_CC0}`,
        `ccby.json: its license CC-BY-4.0 needs the cc-by tier and ${NOT_CC0}`,
      ]]);
      const ok = await call({ clips, tiers: ["cc0", "cc-by"] }); // credited: the set, and each clip's own credit where no set answers for it
      expect([ok.status, ok.verdict, (ok.data as { block: string }).block.split("\n").slice(2)]).toEqual(["ok", "license.check 6 clips (tiers cc0, cc-by): PASS, 3 credits owed, 2 open questions", ["- Lost (CC-BY-4.0): 100STYLE, Mason, Starke and Komura (CC BY 4.0)", "- Walk_Loop (CC-BY-4.0): Somebody (CC BY 4.0)"]]);
    }));
});
