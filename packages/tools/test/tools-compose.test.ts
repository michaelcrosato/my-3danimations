// Compose and wire (PLAN.md WP-7.2b): recipe.compile, graph.validate and graph.sim on every surface; then each one's
// failing input with its code and fix. A recipe: a misspelt operation or clip (R-E002, R-E008 with did you mean, no file
// written), a missing file (E_PATH), one too long to build (E_ARGS, at once), a clip of a tier the game hasn't opted in
// to (E_TIER through the library's resolver, naming the game.json line) and, opted in, the credit it owes. A graph: a
// misspelt clip and state (G-E009 with did you mean, G-E003), a cc-by clip (the game.json line), a recipe state (the
// file to pass), which checks once its compiled file is given, named in hints as given (a path) or as `<the clip's
// JSON>`; a WORKSHOP copy found, a missing one the copy to make; 64 clips taken, 65 refused. A script: the example trace
// matched byte for byte, a strike with no hit event alone making findings, a hit window from a clip's own event on a
// character file, a trace that differs with hints that run it again as given (a script, character and clip file whose
// names the shell would split passed as given), an unknown trigger (S-E003, not run), an unknown character (E_ARGS), a
// character file's absolute path never echoed, nor a script's that is no JSON (E_JSON), a run too long refused; and
// writes only under check-output/recipe.compile/ and check-output/graph.sim/.
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

  it("recipe.compile: a clip file with its facts; a misspelt op or clip as findings, no file; a missing file; one too long refused at once; a clip out of the game's tiers refused, and opted in, its credit owed", () =>
    inCwd(async (call, cwd) => {
      const jab = await call("recipe.compile", { recipe: "spec/recipes/Jab_Left.json" }), file = readFileSync(join(cwd, "check-output/recipe.compile/Jab_Left.clip.json"), "utf8");
      expect(jab.data).toMatchObject({ id: "RECIPES/Jab_Left", line: "RECIPES/Jab_Left: MESH2MOTION/Fighting_Right_Jab; jab mirrored", keys: 12, fit: [1, 23], license: "CC0-1.0", sources: ["MESH2MOTION/Fighting_Right_Jab"], sha256: recipe.sha256(file), metrics: { verdict: "pass" } });
      expect(JSON.parse(file).facts).toMatchObject({ by: "m3a-facts@1", strike: [expect.any(Number)] }); // the strike graph.sim looks for a hit at
      const bad = (steps: object[]) => call("recipe.compile", { recipe: JSON.stringify({ format: "2.0", id: "RECIPES/Bad", steps }) });
      const op = await bad([{ op: "clip", id: "MESH2MOTION/Fighting_Right_Jab" }, { op: "mirorr", in: "s1" }]);
      expect([op.status, op.data!.path, issues(op), op.next]).toEqual(["findings", null, ['R-E002 2op: did you mean "mirror"?'], "fix each issue as its fix says, then `recipe.compile <the recipe's JSON>` again"]);
      expect((await bad([{ op: "clip", id: "MESH2MOTION/Fighting_Right_Jabb" }])).lines).toEqual(["R-E008 step 1 id: no clip MESH2MOTION/Fighting_Right_Jabb in the library; fix: did you mean MESH2MOTION/Fighting_Right_Jab?"]);
      expect(readdirSync(join(cwd, "check-output/recipe.compile"))).toEqual(["Jab_Left.clip.json"]);
      // slow retimes in a row, or a long sequence, refused before compile builds them (each step's length bounded)
      const slow = [1, 2, 3].map((k) => ({ op: "retime", in: `s${k}`, speed: 0.05 })), long = [{ op: "retime", in: "s1", dur: 300 }, { op: "sequence", items: ["s2", "s2", "s2"] }];
      for (const [steps, at] of [[slow, "step 4: retime makes the clip 7336 s long"], [long, "step 3: sequence makes the clip 900 s long"]] as const) {
        const t = performance.now(), r = await bad([{ op: "clip", id: "MESH2MOTION/Fighting_Right_Jab" }, ...steps]);
        expect([r.status, r.error!.code, r.error!.message.split(",")[0], performance.now() - t < 500]).toEqual(["usage", "E_ARGS", `${at}`, true]);
      }
      expect((await call("recipe.compile", { recipe: "spec/recipes/Nope.json" })).error).toEqual({ code: "E_PATH", message: 'can\'t read "spec/recipes/Nope.json" (ENOENT); paths are relative to the working directory' });
      // a library clip of a tier the game hasn't opted in to is refused naming the opt-in, not compile's "no clip" (L3)
      const walk = { recipe: "spec/recipes/Walk_Into_Run.json" };
      expect(await call("recipe.compile", walk)).toMatchObject({ status: "usage", error: { code: "E_TIER", message: expect.stringMatching(/^"STYLE100\/Neutral_Walk" is in STYLE100, a cc-by set, and this game sees only cc0: add "cc-by" to "tiers" in game.json/) } });
      writeFileSync(join(cwd, "game.json"), '{"tiers": ["cc0", "cc-by"]}');
      const run = await call("recipe.compile", walk);
      expect([run.status, run.data!.license, run.data!.credit, run.lines[1]]).toEqual(["ok", "CC-BY-4.0", "100STYLE, Mason, Starke and Komura (CC BY 4.0)", expect.stringMatching(/^credit owed \(CC-BY-4.0\): 100STYLE.*`license.check --clips/)]);
      expect(hintedCalls(run.lines[1]!)).toEqual([{ call: expect.any(String), tool: "license.check", args: { clips: ["check-output/recipe.compile/Walk_Into_Run.clip.json"] } }]);
    }));

  it("graph.validate: a misspelt clip and state, a cc-by clip, a recipe state and a missing copy each with the fix that finds it; with the recipe's file given, or a WORKSHOP copy named, it checks", () =>
    inCwd(async (call, cwd) => {
      const g = loco();
      [g.states.idle!.clip, g.states.land!.clip, g.states.air!.clip, g.transitions[1]!.to, g.layers[0]!.states.jab] = [`${Q}Idle_Lop`, "STYLE100/Neutral_Walk", "WORKSHOP/Nope", "mov", { recipe: "RECIPES/Jab_Left" }];
      const r = await call("graph.validate", { graph: JSON.stringify(g) });
      expect([r.status, r.verdict, r.data!.layers, r.next]).toEqual(["findings", "graph.validate GRAPHS/Locomotion (the graph's JSON): FAIL, 5 issues", [], "fix each issue as its fix says, then `graph.validate <the graph's JSON>` again"]);
      expect(issues(r)).toEqual([
        `G-E009 states.idle: did you mean "${Q}Idle_Loop"? or pass its clip file in clips`,
        "G-E009 states.air: no such copy: fix or edit a clip with --save_as WORKSHOP/Nope to make it",
        'G-E009 states.land: add "cc-by" to "tiers" in game.json (STYLE100 is a cc-by set; this game sees cc0)',
        "G-E003 transitions.1.to: one of idle, move, jump, air, land",
        "G-E009 layers.0.states.jab: pass its clip file in clips (recipe.compile writes a recipe's)",
      ]);
      // the compiled recipe's file in clips, named in hints as given; the same clip as JSON, as <the clip's JSON>
      const ok = loco(), path = (await call("recipe.compile", { recipe: "spec/recipes/Jab_Left.json" })).data!.path as string, sim = (clips: string[]) => [{ graph: "ok.json", script: "<script>", clips }];
      ok.layers[0]!.states.jab = { recipe: "RECIPES/Jab_Left" };
      writeFileSync(join(cwd, "ok.json"), JSON.stringify(ok));
      for (const [clip, named] of [[path, path], [readFileSync(join(cwd, path), "utf8"), "<the clip's JSON>"]]) {
        const v = await call("graph.validate", { graph: "ok.json", clips: [clip] });
        expect([v.status, v.data, hintedCalls(v.next).map((h) => h.args)]).toEqual(["ok", expect.objectContaining({ ok: true, clips: 8, licenses: { "CC0-1.0": 8 } }), sim([named])]);
      }
      // a WORKSHOP copy the graph names is read from the workshop, as recipe.compile reads one
      mkdirSync(join(cwd, "workshop"));
      writeFileSync(join(cwd, "workshop/Mine.json"), JSON.stringify({ ...JSON.parse(text(`library/sets/${Q}Idle_Loop.json`)), id: "WORKSHOP/Mine" }));
      ok.states.idle!.clip = "WORKSHOP/Mine";
      expect((await call("graph.validate", { graph: JSON.stringify(ok), clips: [path] })).verdict).toMatch(/: PASS, 2 layers, 7 states, 10 transitions, 8 clips/);
      expect((await call("graph.validate", { graph: "{nope" })).error).toMatchObject({ code: "E_JSON", message: expect.stringMatching(/^the graph is not JSON/) });
      expect((await call("graph.validate", { graph: L, clips: Array(64).fill("a.json") })).error!.code).toBe("E_PATH"); // 64 taken, each then read
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

  it("graph.sim: a hit window from a clip's own event, on a character file; a trace that differs, run again as given; a strike with no hit event; refusals; writes only its own", () =>
    inCwd(async (call, cwd) => {
      const g = loco(), mine = { ...JSON.parse(text(`library/sets/${Q}Punch_Jab.json`)), id: "MINE/Jab", events: [{ t: 0.147, name: "hit", dur: 0.1 }] };
      g.layers[0]!.states.jab!.clip = "MINE/Jab";
      writeFileSync(join(cwd, "g.json"), JSON.stringify(g));
      writeFileSync(join(cwd, "short one.json"), SHORT);
      writeFileSync(join(cwd, "my jab.json"), JSON.stringify(mine));
      cpSync(join(cwd, "spec/vectors/tier1b/rigify.gltf"), join(cwd, "my rig.gltf"));
      const r = await call("graph.sim", { graph: "g.json", script: "short one.json", clips: ["my jab.json"], character: "my rig.gltf", expect: "spec/sims/Walk_Run_Jump.trace.json" });
      expect(r).toMatchObject({ status: "findings", data: { character: "'my rig.gltf'", steps: 36, matches: false, diff: 'script: expected "SIMS/Walk_Run_Jump", got "SIMS/Short"', warnings: [], hits: [{ t0: 0.217, t1: 0.3, layer: "upper", state: "jab", clip: "MINE/Jab" }] }, images: [] });
      // its hints run it again as given (a script, character and clip file the shell would split), then with the trace's
      // copy
      const as = { graph: "g.json", script: "short one.json", character: "my rig.gltf", clips: ["my jab.json"] };
      expect([r.lines[0], hintedCalls(r.next).map((h) => h.args)]).toEqual([`trace differs: ${r.data!.diff}`, [{ ...as, expect: "spec/sims/Walk_Run_Jump.trace.json" }, { ...as, expect: "<copy>" }]]);
      // a strike with no hit event alone makes findings (the sensors warn), its hint the same call again
      const jab = await call("graph.sim", { graph: L, script: "short one.json" });
      expect([jab.status, (jab.data!.sensors as Row).verdict, (jab.data!.warnings as string[]).length, hintedCalls(jab.next).map((h) => h.args)]).toEqual(["findings", "warn", 1, [{ graph: L, script: "short one.json" }]]);
      // a sprint from standing fails the sensors on tiny (its pops): the findings' cut counted, no filmstrip named
      writeFileSync(join(cwd, "sprint.json"), JSON.stringify({ format: "2.0", id: "SIMS/Sprint", dur: 1, film: 0, input: [{ t: 0.1, set: { speed: 6 } }] }));
      const fast = await call("graph.sim", { graph: L, script: "sprint.json" });
      expect([fast.status, fast.data!.more, fast.lines.at(-2), fast.next.split(";")[0], hintedCalls(fast.next).map((h) => h.args)]).toEqual([
        "findings", { findings: 3 }, "more: 3 findings (fix these, then run it again)", "each finding names its time, and the states rows what played then", [{ graph: L, script: "sprint.json" }],
      ]);
      const typo = await call("graph.sim", { graph: L, script: JSON.stringify({ format: "2.0", id: "SIMS/Bad", dur: 2, input: [{ t: 0.5, trigger: "jumpp" }] }) });
      expect([typo.status, typo.verdict, issues(typo), typo.data!.trace]).toEqual(["findings", "graph.sim SIMS/Bad (the script's JSON) on tiny: FAIL, 1 issue; not run", ["S-E003 input.0.trigger: jump, punch"], null]);
      expect((await call("graph.sim", { graph: L, script: SHORT, character: "gen-x" })).error).toEqual({ code: "E_ARGS", message: 'gen-x is not a character: give a .glb, .gltf or .vrm file, or "tiny"' });
      writeFileSync(join(cwd, "bad.gltf"), '{"asset":{"version":"2.0"}}');
      expect((await call("graph.sim", { graph: L, script: SHORT, character: join(cwd, "bad.gltf") })).error!.message).toMatch(/^<the character's file>: [^/]*$/);
      // a script file that is no JSON named as clips.ts names a file: "file" for an absolute path, else as given
      writeFileSync(join(cwd, "bad one.json"), "{nope");
      for (const [script, named] of [[join(cwd, "bad one.json"), /^the script file is not JSON: [^/]*$/], ["bad one.json", /^the script 'bad one\.json' is not JSON: /]] as const) expect((await call("graph.sim", { graph: L, script })).error).toEqual({ code: "E_JSON", message: expect.stringMatching(named) });
      const long = JSON.stringify({ format: "2.0", id: "SIMS/Long", dur: 600, rate: 240, input: [] });
      expect((await call("graph.sim", { graph: L, script: long })).error).toEqual({ code: "E_ARGS", message: "the script runs 144000 steps (dur 600 s at rate 240), past the 36000 graph.sim takes: shorten dur or lower rate" });
      for (const bad of ["[1]", '{"script":"SIMS/Short","states":[]}']) expect((await call("graph.sim", { graph: L, script: SHORT, expect: bad })).error).toEqual({ code: "E_JSON", message: "the expected trace is not one: give a trace.json graph.sim wrote (spec/SIM.md §2)" });
      expect([readdirSync(join(cwd, "check-output")), readdirSync(join(cwd, "check-output/graph.sim"))]).toEqual([["graph.sim"], ["Short.trace.json", "Sprint.trace.json"]]);
    }));
});
