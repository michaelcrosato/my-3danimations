// Ship (PLAN.md WP-7.2a): license.check on every surface, then its failing inputs: a tier not opted in to, a clip or set
// that isn't there, local content shipped, and a workshop copy, clip file or clip JSON checked as the clip it came from.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { SHIP } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";

const AKIMBO = "STYLE100/Akimbo_Walk", text = (id: string) => readFileSync(join(ROOT, `library/sets/${id}.json`), "utf8");
const found = (r: Reply) => [r.status, (r.data as { findings: { where: string; message: string }[] } | null)?.findings.map((f) => `${f.where}: ${f.message}`)];

describe("ship", () => {
  runExamples(SHIP);

  it("fails a clip, a set or game.json the tiers don't cover, a clip that isn't there and local content shipped", async () => {
    const { cwd, rm } = exampleCwd(false), reg = new Registry(SHIP), host = nodeHost(cwd), call = (args: object) => reg.call("license.check", args, { host });
    try {
      expect(found(await call({ clips: [AKIMBO, "QUATERNIUS_3D2DGE/Walk_Lop"] }))).toEqual(["findings", [`${AKIMBO}: STYLE100 is a cc-by set and this game opts into cc0: opt in, or use a clip from those tiers`, 'QUATERNIUS_3D2DGE/Walk_Lop: no clip "QUATERNIUS_3D2DGE/Walk_Lop" in the library; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']]);
      expect(found(await call({ set: "STYLE100" }))).toEqual(["findings", ["STYLE100: a cc-by set and this game opts into cc0: opt in, or use another set"]]);
      expect(found(await call({ clips: ["QUATERNIUS_3D2DGE/Walk_Loop"], tiers: ["cc0", "local"] }))).toEqual(["findings", ["tiers: a shipped game opts into local: local content never ships (D10)"]]);
      expect((await call({ clips: ["QUATERNIUS_3D2DGE/Walk_Loop"], tiers: ["cc0", "local"], ships: false })).status).toBe("ok");
      expect((await call({ tiers: ["cc0", "gpl"] })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^tiers\[1\] is "gpl", not one of cc0, cc-by, cmu, local/) });
      expect((await call({ set: "QUATERNIUS_3D2DE" })).error).toMatchObject({ code: "E_ARGS", message: expect.stringMatching(/^no set "QUATERNIUS_3D2DE"; did you mean "QUATERNIUS_3D2DGE"\?/) });
      expect((await call({ set: "library" })).data).toMatchObject({ ok: true, credits: { length: 8 } });
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers: ["cc0", "cc-by"], clips: [AKIMBO] }));
      expect(await call({})).toMatchObject({ status: "ok", verdict: "license.check game.json's 1 clip (tiers cc0, cc-by): PASS, 1 set to credit" });
      writeFileSync(join(cwd, "game.json"), JSON.stringify({ clips: AKIMBO }));
      expect((await call({})).error).toMatchObject({ code: "E_GAME", message: expect.stringMatching(/"clips" lists clip ids/) });
    } finally {
      rm();
    }
  });

  it("checks a workshop copy, a clip file or a clip's JSON as the library clip it came from", async () => {
    const { cwd, rm } = exampleCwd(false), reg = new Registry(SHIP), host = nodeHost(cwd), call = (args: object) => reg.call("license.check", args, { host });
    try {
      for (const d of ["workshop", ".m3a/history"]) mkdirSync(join(cwd, d), { recursive: true });
      writeFileSync(join(cwd, "workshop/Proud.json"), JSON.stringify({ ...JSON.parse(text(AKIMBO)), id: "WORKSHOP/Proud", name: "Proud" }));
      writeFileSync(join(cwd, ".m3a/history/Proud.json"), JSON.stringify({ from: AKIMBO }));
      writeFileSync(join(cwd, "akimbo.json"), text(AKIMBO));
      const mine = JSON.stringify({ ...JSON.parse(text("QUATERNIUS_3D2DGE/A_TPose")), id: "MINE/Pose" });
      expect(found(await call({ clips: ["WORKSHOP/Proud", "akimbo.json", mine] }))).toEqual(["findings", [
        "MINE/Pose: from no library set (license CC0-1.0): check its terms yourself",
        `WORKSHOP/Proud (from ${AKIMBO}): STYLE100 is a cc-by set and this game opts into cc0: opt in, or use a clip from those tiers`,
        `akimbo.json (from ${AKIMBO}): STYLE100 is a cc-by set and this game opts into cc0: opt in, or use a clip from those tiers`,
      ]]);
      expect(await call({ clips: ["WORKSHOP/Proud", mine], tiers: ["cc0", "cc-by"] })).toMatchObject({ status: "ok", verdict: "license.check 2 clips (tiers cc0, cc-by): PASS, 1 set to credit, 1 open question" });
    } finally {
      rm();
    }
  });
});
