// Compose and wire (PLAN.md WP-7.2b): recipe.compile, graph.validate and graph.sim on every surface; then each one's
// failing input with its code and fix. A recipe: a misspelt operation or clip (R-E002, R-E008 with did you mean, no file
// written), a missing file (E_PATH), a clip of a tier the game hasn't opted in to (E_TIER through the library's resolver,
// naming the game.json line) and, opted in, the credit it owes. A graph: a misspelt clip and state (G-E009 with did you
// mean, G-E003), a cc-by clip (the game.json line), a recipe state (the file to pass), which checks once its compiled
// file is given. A script: the example trace matched byte for byte, a hit window from a clip's own event on a character
// file, a trace that differs, an unknown trigger (S-E003, not run), an unknown character (E_ARGS); and writes only under
// check-output/recipe.compile/ and check-output/graph.sim/.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recipe } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { COMPOSE } from "../src/tools/index.ts";
import { exampleCwd, hintedCalls, ROOT, runExamples } from "./helpers/surfaces.ts";

type Row = Record<string, unknown>;
const L = "spec/graphs/Locomotion.json", Q = "QUATERNIUS_3D2DGE/", text = (f: string) => readFileSync(join(ROOT, f), "utf8");
/** Locomotion as JSON to change, and a short script: a jab thrown at 0.1 s, no filmstrip. */
const loco = () => JSON.parse(text(L)) as { states: Record<string, Row>; transitions: Row[]; layers: { states: Record<string, Row> }[] };
const SHORT = JSON.stringify({ format: "2.0", id: "SIMS/Short", dur: 0.6, film: 0, input: [{ t: 0.1, trigger: "punch" }] });

/** Runs `body` with the compose tools called in one fresh seeded working directory (game.json's tiers when given). */
async function inCwd(body: (call: (tool: string, args: object) => Promise<Reply<Row>>, cwd: string) => Promise<void>, tiers?: string[]): Promise<void> {
  const { cwd, rm } = exampleCwd(), reg = new Registry(COMPOSE), host = nodeHost(cwd);
  try {
    if (tiers) writeFileSync(join(cwd, "game.json"), JSON.stringify({ tiers }));
    await body((tool, args) => reg.call(tool, args, { host }) as Promise<Reply<Row>>, cwd);
  } finally {
    rm();
  }
}
/** Each issue a reply gives: its code, where and fix. */
const issues = (r: Reply<Row>) => (r.data!.issues as Row[]).map((i) => `${i.code} ${i.step ?? ""}${i.field}: ${i.fix}`);

describe("compose and wire", () => {
  runExamples(COMPOSE);

  it("recipe.compile: a clip file with its facts; a misspelt op or clip as findings, no file; a missing file; a clip out of the game's tiers refused, and opted in, its credit owed", () =>
    inCwd(async (call, cwd) => {
      const jab = await call("recipe.compile", { recipe: "spec/recipes/Jab_Left.json" }), file = readFileSync(join(cwd, "check-output/recipe.compile/Jab_Left.json"), "utf8");
      expect(jab.data).toMatchObject({ id: "RECIPES/Jab_Left", keys: 12, fit: [1, 23], license: "CC0-1.0", sources: ["MESH2MOTION/Fighting_Right_Jab"], sha256: recipe.sha256(file), verdict: "pass" });
      expect(JSON.parse(file).facts).toMatchObject({ by: "m3a-facts@1", strike: [expect.any(Number)] }); // the strike graph.sim looks for a hit at
      const bad = (steps: object[]) => call("recipe.compile", { recipe: JSON.stringify({ format: "2.0", id: "RECIPES/Bad", steps }) });
      const op = await bad([{ op: "clip", id: "MESH2MOTION/Fighting_Right_Jab" }, { op: "mirorr", in: "s1" }]);
      expect([op.status, op.data!.path, issues(op), op.next]).toEqual(["findings", null, ['R-E002 2op: did you mean "mirror"?'], "fix each issue as its fix says, then `recipe.compile <the recipe's JSON>` again"]);
      expect((await bad([{ op: "clip", id: "MESH2MOTION/Fighting_Right_Jabb" }])).lines).toEqual(["R-E008 step 1 id: no clip MESH2MOTION/Fighting_Right_Jabb in the library; fix: did you mean MESH2MOTION/Fighting_Right_Jab?"]);
      expect(readdirSync(join(cwd, "check-output/recipe.compile"))).toEqual(["Jab_Left.json"]);
      expect((await call("recipe.compile", { recipe: "spec/recipes/Nope.json" })).error).toEqual({ code: "E_PATH", message: 'can\'t read "spec/recipes/Nope.json" (ENOENT); paths are relative to the working directory' });
      // a library clip of a tier the game hasn't opted in to is refused naming the opt-in, not compile's "no clip" (L3)
      const walk = { recipe: "spec/recipes/Walk_Into_Run.json" };
      expect(await call("recipe.compile", walk)).toMatchObject({ status: "usage", error: { code: "E_TIER", message: expect.stringMatching(/^"STYLE100\/Neutral_Walk" is in STYLE100, a cc-by set, and this game sees only cc0: add "cc-by" to "tiers" in game.json/) } });
      writeFileSync(join(cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      const run = await call("recipe.compile", walk);
      expect([run.status, run.data!.license, run.data!.credit, run.lines[1]]).toEqual(["ok", "CC-BY-4.0", "100STYLE, Mason, Starke and Komura (CC BY 4.0)", expect.stringMatching(/^credit owed \(CC-BY-4.0\): 100STYLE.*`license.check --clips/)]);
      expect(hintedCalls(run.lines[1]!)).toEqual([{ call: expect.any(String), tool: "license.check", args: { clips: ["check-output/recipe.compile/Walk_Into_Run.json"] } }]);
    }));

  it("graph.validate: a misspelt clip and state, a cc-by clip and a recipe state each with the fix that finds it; with the recipe's file given, it checks", () =>
    inCwd(async (call) => {
      const g = loco();
      [g.states.idle!.clip, g.states.land!.clip, g.transitions[1]!.to, g.layers[0]!.states.jab] = [`${Q}Idle_Lop`, "STYLE100/Neutral_Walk", "mov", { recipe: "RECIPES/Jab_Left" }];
      const r = await call("graph.validate", { graph: JSON.stringify(g) });
      expect([r.status, r.verdict, r.data!.layers, r.next]).toEqual(["findings", "graph.validate GRAPHS/Locomotion (the graph's JSON): FAIL, 4 issues", [], "fix each issue as its fix says, then `graph.validate <the graph's JSON>` again"]);
      expect(issues(r)).toEqual([
        `G-E009 states.idle: did you mean "${Q}Idle_Loop"? or pass its clip file in clips`,
        `G-E009 states.land: "STYLE100/Neutral_Walk" is in STYLE100, a cc-by set, and this game sees only cc0: add "...`,
        "G-E003 transitions.1.to: one of idle, move, jump, air, land",
        "G-E009 layers.0.states.jab: pass its clip file in clips (recipe.compile writes a recipe's)",
      ]);
      const ok = loco(), path = (await call("recipe.compile", { recipe: "spec/recipes/Jab_Left.json" })).data!.path as string;
      ok.layers[0]!.states.jab = { recipe: "RECIPES/Jab_Left" };
      expect(await call("graph.validate", { graph: JSON.stringify(ok), clips: [path] })).toMatchObject({ status: "ok", data: { ok: true, clips: 8, licenses: { "CC0-1.0": 8 } }, next: `\`graph.sim <the graph's JSON> --script <script> --clips '["${path}"]'\` runs it as a game would (spec/SIM.md)` });
      expect((await call("graph.validate", { graph: "{nope" })).error).toMatchObject({ code: "E_JSON", message: expect.stringMatching(/^the graph is not JSON/) });
      expect((await call("graph.validate", { graph: L, clips: Array(65).fill("a.json") })).error).toEqual({ code: "E_ARGS", message: "clips takes at most 64 clips, not 65" });
    }));

  it("graph.sim: the example script's trace matched byte for byte, its strike without a hit event named first, a filmstrip", () =>
    inCwd(async (call, cwd) => {
      const r = await call("graph.sim", { graph: L, script: "spec/sims/Walk_Run_Jump.json", expect: "spec/sims/Walk_Run_Jump.trace.json" });
      expect([r.status, r.data!.matches, r.data!.steps, (r.data!.states as Row[]).map((s) => `${s.layer}:${s.state}`), r.lines[0], r.images.map((i) => [i.width, i.height, i.path])]).toEqual([
        "findings", true, 510, ["base:move", "base:jump", "base:air", "base:land", "base:move", "upper:jab", "upper:none", "base:idle"],
        `${Q}Punch_Jab plays (jab) with a measured strike at 0.147 s and no hit event, so no hit window opens: add one (a recipe's events step)`, [[1294, 200, "check-output/graph.sim/Walk_Run_Jump.png"]],
      ]);
      expect(readFileSync(join(cwd, r.data!.trace as string), "utf8")).toBe(text("spec/sims/Walk_Run_Jump.trace.json"));
      expect(hintedCalls(r.next).filter((h) => h.problem)).toEqual([]);
    }));

  it("graph.sim: a hit window from a clip's own event, on a character file; a trace that differs; an unknown trigger not run; an unknown character refused; writes only its own", () =>
    inCwd(async (call, cwd) => {
      const g = loco(), mine = { ...JSON.parse(text(`library/sets/${Q}Punch_Jab.json`)), id: "MINE/Jab", events: [{ t: 0.147, name: "hit", dur: 0.1 }] };
      g.layers[0]!.states.jab!.clip = "MINE/Jab";
      const r = await call("graph.sim", { graph: JSON.stringify(g), script: SHORT, clips: [JSON.stringify(mine)], character: "spec/vectors/tier1b/rigify.gltf", expect: "spec/sims/Walk_Run_Jump.trace.json" });
      expect(r).toMatchObject({ status: "findings", data: { character: "spec/vectors/tier1b/rigify.gltf", steps: 36, matches: false, diff: 'script: expected "SIMS/Walk_Run_Jump", got "SIMS/Short"', warnings: [], hits: [{ t0: 0.216667, t1: 0.3, layer: "upper", state: "jab", clip: "MINE/Jab" }] }, images: [] });
      expect([r.lines[0], r.next]).toEqual([`trace differs: ${r.data!.diff}`, "the first difference is above: fix the graph or the script, or keep check-output/graph.sim/Short.trace.json as the expected trace"]);
      const typo = await call("graph.sim", { graph: L, script: JSON.stringify({ format: "2.0", id: "SIMS/Bad", dur: 2, input: [{ t: 0.5, trigger: "jumpp" }] }) });
      expect([typo.status, typo.verdict, issues(typo), typo.data!.trace]).toEqual(["findings", "graph.sim SIMS/Bad (the script's JSON) on tiny: FAIL, 1 issue; not run", ["S-E003 input.0.trigger: jump, punch"], null]);
      expect((await call("graph.sim", { graph: L, script: SHORT, character: "gen-x" })).error).toEqual({ code: "E_ARGS", message: '"gen-x" is not a character: give a .glb, .gltf or .vrm file, or "tiny"' });
      for (const bad of ["[1]", '{"script":"SIMS/Short","states":[]}']) expect((await call("graph.sim", { graph: L, script: SHORT, expect: bad })).error).toEqual({ code: "E_JSON", message: "the expected trace is not one: give a trace.json graph.sim wrote (spec/SIM.md §2)" });
      expect([readdirSync(join(cwd, "check-output")), readdirSync(join(cwd, "check-output/graph.sim"))]).toEqual([["graph.sim"], ["Short.trace.json"]]);
    }));
});
