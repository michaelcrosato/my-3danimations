// Find and read (PLAN.md WP-7.2a): search, show and describe on every surface, then their failing inputs, show's pages
// and legend, and a file clip flagged when the game hasn't opted in to its set's tier.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, render, type Reply } from "../src/registry/index.ts";
import { FIND } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";

/** Runs `body` with a call into a fresh working directory (unseeded), deleted after. */
async function inCwd(body: (call: (tool: string, args: object) => Promise<Reply>, cwd: string) => Promise<void>): Promise<void> {
  const { cwd, rm } = exampleCwd(false), reg = new Registry(FIND), host = nodeHost(cwd);
  try {
    await body((tool, args) => reg.call(tool, args, { host }), cwd);
  } finally {
    rm();
  }
}
const refused = (r: Reply) => [r.status, r.error?.code, r.error?.message];
const clipText = (id: string) => readFileSync(join(ROOT, `library/sets/${id}.json`), "utf8");

describe("find and read", () => {
  runExamples(FIND);

  it("search refuses a wrong call, says what's near when nothing matches, and points at game.json for another tier", () =>
    inCwd(async (call, cwd) => {
      expect(refused(await call("search", { query: "walk", limit: 41 }))).toEqual(["usage", "E_ARGS", "limit is 41, above its maximum 40"]);
      expect(refused(await call("search", { q: "walk" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^unknown argument "q"; did you mean "query"\?/)]);
      expect(await call("search", { query: "wlak" })).toMatchObject({ status: "ok", data: { total: 0, rows: [] }, next: expect.stringMatching(/nearest tags: walk.*; search again$/) });
      const proud = await call("search", { query: "walks proudly", limit: 2 });
      expect([proud.data, proud.next]).toEqual([expect.objectContaining({ tiers: ["cc0"], total: 26, more: 24 }), expect.stringMatching(/^describe MESH2MOTION\/\S+ or show .*STYLE100\/Proud_Walk .*; add "cc-by" to "tiers" in game.json; 24 more/)]);
      expect(((await call("search", { query: "" })).data as { rows: { core?: true }[] }).rows.every((r) => r.core)).toBe(true); // "" lists the core clips first
      writeFileSync(join(cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      expect((await call("search", { query: "walks proudly", limit: 1 })).data).toMatchObject({ tiers: ["cc0", "cc-by"], rows: [{ id: "STYLE100/Proud_Walk", tier: "cc-by" }] });
    }));

  it("show pages a clip's keys so each surface shows the page whole, explains the numbers, and refuses a wrong clip", () =>
    inCwd(async (call) => {
      const page = await call("show", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 0.4 });
      expect([page.data, page.next]).toEqual([expect.objectContaining({ first: 12, keys: 32, credit: null, legend: null }), expect.stringMatching(/^show QUATERNIUS_3D2DGE\/Sword_Attack from: 0.733 continues \(keys 17-32 of 32\)/)]);
      expect((page.data as { text: string }).text.match(/"t":/g)).toHaveLength(5);
      expect(render(page, { report: "check-output/show/report.json" })).toMatch(/"t":0\.633,[^\n]*\n[^\n]*\n "legL"[^\n]*"footR":\[2,34,1\]\}\n/); // the fifth key whole, with a report line too
      expect((await call("show", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 0.733 })).data).toMatchObject({ first: 17 });
      const legend = await call("show", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", legend: true });
      expect([legend.lines.length, (legend.data as { legend: { text: string[] } }).legend.text.length, render(legend, { report: "r" })]).toEqual([17, 26, expect.not.stringMatching(/more lines?:/)]);
      expect(legend.next).toBe("show QUATERNIUS_3D2DGE/Walk_Loop from: 0 for the keys");
      expect(refused(await call("show", { clip: "QUATERNIUS_3D2DGE/Walk" }))).toEqual(["usage", "E_NO_CLIP", 'no clip "QUATERNIUS_3D2DGE/Walk"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']);
      expect(refused(await call("show", { clip: "../x.json" }))).toEqual(["usage", "E_PATH", expect.stringMatching(/^"..\/x.json" is outside/)]);
      expect(refused(await call("show", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 2 }))).toEqual(["usage", "E_ARGS", "from is 2, past the last key (1.533 s)"]);
    }));

  it("show flags a file clip from a tier the game hasn't opted in to, or from no library set", () =>
    inCwd(async (call, cwd) => {
      writeFileSync(join(cwd, "akimbo.json"), clipText("STYLE100/Akimbo_Walk"));
      const flagged = await call("show", { clip: "akimbo.json" });
      expect([flagged.data, flagged.lines[1]]).toEqual([expect.objectContaining({ tier: "cc-by", credit: "100STYLE, Mason, Starke and Komura (CC BY 4.0)" }), 'warning: STYLE100 is a cc-by set: add "cc-by" to "tiers" in game.json before shipping it']);
      expect(flagged.next).toMatch(/^show akimbo.json from: /);
      const mine = JSON.stringify({ ...JSON.parse(clipText("QUATERNIUS_3D2DGE/A_TPose")), id: "MINE/Pose" });
      expect((await call("show", { clip: mine })).lines[1]).toBe('warning: "MINE/Pose" is from no library set: its license (CC0-1.0) is for you to check');
      writeFileSync(join(cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      expect((await call("show", { clip: "akimbo.json" })).lines[1]).toMatch(/^\{"t":0,/);
    }));

  it("describe gives each phase and moment with detail, and refuses a tier not opted in to or a clip file that isn't valid", () =>
    inCwd(async (call, cwd) => {
      const sword = await call("describe", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", detail: true });
      expect([sword.lines, sword.next]).toEqual([expect.arrayContaining(["0.350-0.933 s crouch: hips 63%", "strikes with the right fist at 0.42 s"]), expect.stringMatching(/^show QUATERNIUS_3D2DGE\/Sword_Attack from: 0.4 reads the keys at its strike;/)]);
      expect(refused(await call("describe", { clip: "CMU_CURATED/Drink_Soda" }))).toEqual(["usage", "E_TIER", expect.stringMatching(/a cmu set, and this game sees only cc0: add "cmu" to "tiers" in game.json/)]);
      writeFileSync(join(cwd, "bad.json"), '{"format":"2.0","id":"DEMO/Bad","dur":0}');
      expect(refused(await call("describe", { clip: "bad.json" }))).toEqual(["error", "E_CLIP", expect.stringMatching(/^"bad.json" is not a valid clip/)]);
    }));
});
