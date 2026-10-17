// Find and read (PLAN.md WP-7.2a): search, show and describe on every surface, then their failing inputs, show's pages
// and legend, and a file, JSON or workshop clip flagged when the game hasn't opted in to its set's or license's tier.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, render, type Reply } from "../src/registry/index.ts";
import { FIND } from "../src/tools/index.ts";
import { exampleCwd, ROOT, runExamples } from "./helpers/surfaces.ts";
import { workshopClip } from "./helpers/workshop.ts";

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
const clipText = (id: string) => readFileSync(join(ROOT, `library/sets/${id}.json`), "utf8"), clipOf = (id: string) => JSON.parse(clipText(id)) as { provenance: object; keys: { t: number }[] };
const keysIn = (text: string) => text.match(/\{"t":/g)?.length;

describe("find and read", () => {
  runExamples(FIND);

  it("search refuses a wrong call, says what's near when nothing matches, and points at game.json for another tier", () =>
    inCwd(async (call, cwd) => {
      expect(refused(await call("search", { query: "walk", limit: 41 }))).toEqual(["usage", "E_ARGS", "limit is 41, above its maximum 40"]);
      expect(refused(await call("search", { q: "walk" }))).toEqual(["usage", "E_ARGS", expect.stringMatching(/^unknown argument "q"; did you mean "query"\?/)]);
      expect(await call("search", { query: "wlak" })).toMatchObject({ status: "ok", data: { total: 0, rows: [] }, next: expect.stringMatching(/nearest tags: walk.*; search again$/) });
      const proud = await call("search", { query: "walks proudly", limit: 2 });
      expect([proud.verdict, proud.data, proud.next]).toEqual(['search "walks proudly": 2 of 26 clips (tiers cc0)', expect.objectContaining({ tiers: ["cc0"], total: 26, more: 24 }), expect.stringMatching(/^`describe MESH2MOTION\/\S+` or `show .*STYLE100\/Proud_Walk .*; add "cc-by" to "tiers" in game.json; 24 more: `search 'walks proudly' --limit 26` lists them all,/)]);
      const core = (await call("search", { query: "" })).data as { rows: { core?: true }[] };
      expect([core.rows.length, core.rows.every((r) => r.core)]).toEqual([10, true]); // "" lists the core clips first
      writeFileSync(join(cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      expect((await call("search", { query: "walks proudly", limit: 1 })).data).toMatchObject({ tiers: ["cc0", "cc-by"], rows: [{ id: "STYLE100/Proud_Walk", tier: "cc-by" }] });
    }));

  it("show pages a clip's keys so each surface shows the page whole, explains the numbers, and refuses a wrong clip", () =>
    inCwd(async (call) => {
      const page = await call("show", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 0.4 });
      expect([page.verdict, page.data, page.next]).toEqual([expect.stringMatching(/keys 12-16 of 32 from 0.400 s$/), expect.objectContaining({ clip: "QUATERNIUS_3D2DGE/Sword_Attack", first: 12, keys: 32, credit: null, legend: null }), expect.stringMatching(/^`show QUATERNIUS_3D2DGE\/Sword_Attack --from 0.733` continues \(keys 17-32 of 32\)/)]);
      expect([keysIn((page.data as { text: string }).text), page.lines.length, page.lines[0]]).toEqual([5, 16, expect.stringMatching(/; UAL1 \(.*\), keyed, CC0-1.0, no credit owed$/)]); // the page alone, not the keys after it
      expect(render(page, { report: "check-output/show/report.json" })).toMatch(/"t":0\.633,[^\n]*\n[^\n]*\n "legL"[^\n]*"footR":\[2,34,1\]\}\n/); // the fifth key whole, with a report line too
      expect((await call("show", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 0.733 })).data).toMatchObject({ first: 17 });
      const legend = await call("show", { clip: "QUATERNIUS_3D2DGE/Walk_Loop", legend: true });
      expect([legend.lines.length, (legend.data as { legend: { text: string[] } }).legend.text.length, render(legend, { report: "r" })]).toEqual([16, 26, expect.not.stringMatching(/more lines?:/)]);
      expect([legend.verdict, (legend.data as { text: null }).text, legend.next]).toEqual(["show QUATERNIUS_3D2DGE/Walk_Loop: the legend of its keys' numbers", null, "`show QUATERNIUS_3D2DGE/Walk_Loop --from 0` for the keys"]);
      expect(refused(await call("show", { clip: "QUATERNIUS_3D2DGE/Walk" }))).toEqual(["usage", "E_NO_CLIP", 'no clip "QUATERNIUS_3D2DGE/Walk"; did you mean "QUATERNIUS_3D2DGE/Walk_Loop"?']);
      expect(refused(await call("show", { clip: "../x.json" }))).toEqual(["usage", "E_PATH", expect.stringMatching(/^..\/x.json is outside/)]);
      expect(refused(await call("show", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", from: 2 }))).toEqual(["usage", "E_ARGS", "from is 2, past the last key (1.533 s)"]);
    }));

  it("show flags a file, workshop or JSON clip whose set or license needs a tier the game hasn't opted in to, or from no library set", () =>
    inCwd(async (call, cwd) => {
      writeFileSync(join(cwd, "akimbo.json"), clipText("STYLE100/Akimbo_Walk"));
      workshopClip(cwd, "Proud", JSON.stringify({ ...clipOf("STYLE100/Akimbo_Walk"), id: "WORKSHOP/Proud" }), "STYLE100/Akimbo_Walk");
      const flagged = await call("show", { clip: "akimbo.json" }), akimbo = (title: string) => `warning: add "cc-by" to "tiers" in game.json before shipping ${title}: STYLE100 is a cc-by set, its license is CC-BY-4.0`;
      expect([flagged.data, flagged.lines[0], flagged.lines[1], flagged.next]).toEqual([expect.objectContaining({ tier: "cc-by", credit: "100STYLE, Mason, Starke and Komura (CC BY 4.0)" }), akimbo("akimbo.json"), expect.stringMatching(/, CC-BY-4.0, credit owed: 100STYLE, Mason, Starke and Komura \(CC BY 4.0\)$/), expect.stringMatching(/^`show akimbo.json --from /)]);
      const text = render(flagged, { report: "check-output/show/report.json" }); // the warning costs no key: 5, whole, in 20 lines
      expect([keysIn(text), text.split("\n").length, text]).toEqual([5, 20, expect.not.stringMatching(/more lines?:/)]);
      for (const clip of ["WORKSHOP/Proud", "workshop/Proud.json"]) expect([(await call("show", { clip })).lines[0], (await call("describe", { clip })).next]).toEqual([akimbo("WORKSHOP/Proud"), expect.stringMatching(/^`show WORKSHOP\/Proud` reads/)]);
      // a composed clip: its set and each part of its license need a tier, and it owes the credit it carries (not its rest's source's)
      const mixed = clipOf("STYLE100/Neutral_Walk"), credit = "100STYLE (CC BY 4.0); CMU Graphics Lab Motion Capture Database", license = "CC-BY-4.0 AND LicenseRef-CMU-Mocap";
      const both = await call("show", { clip: JSON.stringify({ ...mixed, id: "STYLE100/Mixed", provenance: { ...mixed.provenance, license, credit } }) });
      expect([both.lines[0], both.lines[1], both.next]).toEqual([`warning: add "cc-by" and "cmu" to "tiers" in game.json before shipping STYLE100/Mixed (the clip's JSON): STYLE100 is a cc-by set, its license is ${license}`, expect.stringContaining(`credit owed: ${credit}`), expect.stringMatching(/^`show <the clip's JSON> --from /)]);
      const pose = clipOf("QUATERNIUS_3D2DGE/A_TPose"), mine = await call("show", { clip: JSON.stringify({ ...pose, id: "MINE/Pose", provenance: { ...pose.provenance, credit: "Someone" } }) });
      expect(mine.lines.slice(0, 2)).toEqual([expect.stringMatching(/, CC0-1.0, no credit owed$/), 'warning: "MINE/Pose" is from no library set: its license (CC0-1.0) is for you to check']); // a CC0 clip owes none
      const mit = JSON.stringify({ ...pose, id: "MINE/Mit", provenance: { ...pose.provenance, license: "MIT" } });
      expect((await call("show", { clip: mit })).lines.slice(0, 3)).toEqual(["warning: MINE/Mit (the clip's JSON): its license (MIT) fits no tier a shipped game opts in to (D10)", expect.stringMatching(/, MIT, no credit owed$/), expect.stringMatching(/^\{"t":0,/)]);
      expect((await call("show", { clip: join(cwd, "akimbo.json") })).next).toMatch(/^`show <the clip's file> --from /); // never an absolute path
      // credit owed by a CMU clip's own line, or owed with none given; a clip named by its orig needs its set's tier, as license.check says
      const own = (provenance: object) => JSON.stringify({ ...pose, id: "MINE/Pose", provenance: { ...pose.provenance, ...provenance } });
      expect((await call("show", { clip: own({ license: "LicenseRef-CMU-Mocap", credit: "CMU Graphics Lab" }) })).lines[1]).toMatch(/, LicenseRef-CMU-Mocap, credit owed: CMU Graphics Lab$/); // after its tier's warning
      expect((await call("show", { clip: own({ license: "CC0-1.0 AND CC-BY-4.0" }) })).lines[1]).toMatch(/, CC0-1.0 AND CC-BY-4.0, credit owed, none given$/);
      writeFileSync(join(cwd, "my orig.json"), own({ orig: "STYLE100/Neutral_Walk" }));
      const orig = await call("show", { clip: "my orig.json" });
      expect([orig.lines[0], orig.next]).toEqual(['warning: add "cc-by" to "tiers" in game.json before shipping \'my orig.json\': STYLE100 is a cc-by set, its license is CC0-1.0', expect.stringMatching(/^`describe 'my orig.json'` for its timeline/)]);
      expect(refused(await call("show", { clip: JSON.stringify({ ...pose, restSrc: "MYRIG" }) }))).toEqual(["usage", "E_REST", expect.stringMatching(/^the clip's JSON names rest "MYRIG", which no set's manifest has/)]);
      writeFileSync(join(cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      for (const clip of ["akimbo.json", "my orig.json"]) expect((await call("show", { clip })).lines[1]).toMatch(/^\{"t":0,/); // no warning once opted in
      expect((await call("show", { clip: "STYLE100/Akimbo_Walk" })).lines[0]).toMatch(/credit owed: 100STYLE by Ian Mason, Sebastian Starke and Taku Komura, CC BY 4.0\.$/); // the set's line, as license.check's block
    }));

  it("describe gives each phase and moment with detail, and refuses a tier not opted in to or a clip file that isn't valid", () =>
    inCwd(async (call, cwd) => {
      const sword = await call("describe", { clip: "QUATERNIUS_3D2DGE/Sword_Attack", detail: true });
      expect([sword.lines, sword.next]).toEqual([["0.000-0.333 s stand", "0.350-0.933 s crouch: hips 63%", "0.950-1.533 s stand", "0.417 s strikes with the right fist"], expect.stringMatching(/^`show QUATERNIUS_3D2DGE\/Sword_Attack --from 0.4` reads the keys at its strike;/)]);
      expect((await call("describe", { clip: "MESH2MOTION/Roll" })).next).toMatch(/^`show MESH2MOTION\/Roll --from 0.533` reads the keys at its land;/);
      const ticks = Array.from({ length: 21 }, (_, i) => ({ t: i * 0.05, name: "tick" })), many = await call("describe", { clip: JSON.stringify({ ...clipOf("QUATERNIUS_3D2DGE/Sword_Attack"), events: ticks }), detail: true });
      expect([(many.data as { moments: object[] }).moments.length, many.data, many.lines.at(-1)]).toEqual([20, expect.objectContaining({ more: 2 }), "more: 2 phases and moments"]); // 21 events and a strike
      const kneel = clipOf("CMU_CURATED/Get_Up_Sit_Kneel"), keys = [0, 1, 2, 3, 4].flatMap((j) => kneel.keys.map((k) => ({ ...k, t: Math.round((k.t + j * 9.4) * 1000) / 1000 })));
      const long = await call("describe", { clip: JSON.stringify({ ...kneel, dur: 46.9, keys, events: [], facts: undefined }), detail: true }); // its 6 phases 5 times
      expect([(long.data as { phases: object[] }).phases.length, long.lines.at(-1)]).toEqual([20, "more: 2 phases and moments"]);
      expect(refused(await call("describe", { clip: "CMU_CURATED/Drink_Soda" }))).toEqual(["usage", "E_TIER", expect.stringMatching(/a cmu set, and this game sees only cc0: add "cmu" to "tiers" in game.json/)]);
      writeFileSync(join(cwd, "bad.json"), '{"format":"2.0","id":"DEMO/Bad","dur":0}');
      expect(refused(await call("describe", { clip: "bad.json" }))).toEqual(["error", "E_CLIP", expect.stringMatching(/^bad.json is not a valid clip/)]);
    }));
});
