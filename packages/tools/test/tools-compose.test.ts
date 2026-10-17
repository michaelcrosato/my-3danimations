// Compose and wire (PLAN.md WP-7.2b): recipe.compile, graph.validate and graph.sim on every surface; then each one's
// failing input with its code and fix. A recipe: a misspelt operation or clip (R-E002, R-E008 with did you mean, no file
// written), a missing file (E_PATH), one too long to build (E_ARGS, at once), a clip of a tier the game hasn't opted in
// to (E_TIER through the library's resolver, naming the game.json line) and, opted in, the credit it owes. A graph: a
// recipe of more than 64 steps or more than 100,000 step samples (the verifier's ten smooths on 600 s at 120 fps), each
// at once, while every recipe the repository ships passes. A graph: a
// misspelt clip and state (G-E009 with did you mean, G-E003), a cc-by clip (the game.json line), a recipe state (the
// file to pass), which checks once its compiled file is given, named in hints as given (a path) or as `<the clip's
// JSON>`; a WORKSHOP copy found, a missing one the copy to make; 64 clips taken, 65 refused. A script: the example trace
// matched byte for byte, a strike with no hit event alone making findings, a hit window from a clip's own event on a
// character file, a trace that differs with hints that run it again as given (a script, character and clip file whose
// names the shell would split passed as given), an unknown trigger (S-E003, not run), an unknown character (E_ARGS), a
// character file's absolute path never echoed (a run's hint names it and its script by placeholders), nor a script's
// that is no JSON (E_JSON), a run too costly refused, by what its graph and script hold at once (its steps; 501 layers
// on 60 s; a blend of 1,000 points, and one of 64 on 60 s; 20,000 transitions, one of 200,000 conditions, and one from
// 10,000 states, each on 60 s; 1,001 parameters on 60 s, and 1,000 with a number eased in) and by what its fades play
// out after a run without poses (a state left for another every step), while the shipped graphs pass at the longest
// script; a character whose bones' names miss a required bone refused
// (E_RIG), then run with the patch its retarget.inspect call gives (mapping), the run's hints keeping it; and
// writes only under check-output/recipe.compile/ and check-output/graph.sim/.
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { openLibrary } from "@m3a/library/node";
import { join } from "node:path";
import { graph as G, recipe } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { nodeHost } from "../src/node.ts";
import { Registry, type Reply } from "../src/registry/index.ts";
import { bounded, MAX_RECIPE_STEPS, MAX_STEP_SAMPLES } from "../src/tools/clips.ts";
import { runCost } from "../src/tools/compose.ts";
import { COMPOSE, RETARGET } from "../src/tools/index.ts";
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
      // its cost bounded at once: more than 64 steps, or more than 100,000 samples built (each step's length times its fps)
      const smooths = (k: number, window = 5) => Array.from({ length: k }, (_, i) => ({ op: "smooth", in: `s${i + 2}`, window })), stride = [{ op: "clip", id: `${Q}Walk_Loop` }];
      const verifier = await call("recipe.compile", { recipe: JSON.stringify({ format: "2.0", id: "RECIPES/Many", fps: 120, steps: [...stride, { op: "retime", in: "s1", dur: 600 }, ...smooths(10)] }) });
      expect([verifier.status, verifier.error]).toEqual(["usage", { code: "E_ARGS", message: "the recipe's 12 steps build 792160 samples in all (each step's length times 120 fps), past the 100000 one call compiles; use fewer steps, or a lower fps" }]);
      expect((await bad([...stride, { op: "retime", in: "s1", dur: 2 }, ...smooths(63, 0.1)])).error).toEqual({ code: "E_ARGS", message: `the recipe has 65 steps, past the ${MAX_RECIPE_STEPS} one call compiles; use fewer steps` });
      // every recipe the repository ships passes, far under the bound
      const lib = openLibrary({ tiers: ["cc0", "cc-by", "cmu"] }), shipped = [...readdirSync(join(ROOT, "spec/recipes")).map((f) => `spec/recipes/${f}`), "bench/starters/B5/emote.json", "bench/starters/B6/punch.json"];
      for (const f of shipped) expect(() => bounded(JSON.parse(text(f)) as recipe.Recipe, (id) => lib.clip(id).clip), f).not.toThrow();
      expect(MAX_STEP_SAMPLES).toBe(100_000);
      expect((await call("recipe.compile", { recipe: "spec/recipes/Nope.json" })).error).toEqual({ code: "E_PATH", message: "can't read spec/recipes/Nope.json (ENOENT); paths are relative to the working directory" });
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
        "G-E009 states.air: no such copy: `fix <a library clip> --save_as WORKSHOP/Nope` makes it",
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
      // a script and character by absolute paths: the hint names each by its placeholder, the working directory nowhere
      const abs = await call("graph.sim", { graph: L, script: join(cwd, "short one.json"), character: join(cwd, "my rig.gltf") });
      expect([abs.status, abs.next.match(/`[^`]+`/g), JSON.stringify(abs).includes(cwd)]).toEqual(["findings", [`\`graph.sim ${L} --script <the script's file> --character <the character's file>\``], false]);
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
      expect((await call("graph.sim", { graph: L, script: SHORT, character: join(cwd, "bad.gltf") })).error!.message).toMatch(/^the character's file: [^/<>]*$/);
      // a script file that is no JSON named as clips.ts's prose names a file: "the script's file" for an absolute path,
      // else as given
      writeFileSync(join(cwd, "bad one.json"), "{nope");
      for (const [script, named] of [[join(cwd, "bad one.json"), /^the script's file is not JSON: [^/]*$/], ["bad one.json", /^the script 'bad one\.json' is not JSON: /]] as const) expect((await call("graph.sim", { graph: L, script })).error).toEqual({ code: "E_JSON", message: expect.stringMatching(named) });
      const long = JSON.stringify({ format: "2.0", id: "SIMS/Long", dur: 600, rate: 240, input: [] });
      expect((await call("graph.sim", { graph: L, script: long })).error).toEqual({ code: "E_ARGS", message: "the script runs 144000 steps (dur 600 s at rate 240), past the 36000 graph.sim takes: shorten dur or lower rate" });
      // its cost bounded at once, by what the graph and script hold: 501 layers (the base and 500, a 2-point blend each)
      // on a 60 s script; a blend of 1,000 points (past the most one blend takes), and one of 64 (the clips it plays at
      // once, each a step); 20,000 transitions, one of 200,000 conditions, and one from a list of 10,000 states (each
      // read every step); 1,001 parameters (each read every step), and 1,000 with one number the script eases in
      const minute = JSON.stringify({ format: "2.0", id: "SIMS/Minute", dur: 60, film: 0, input: [] }), idle = { clip: `${Q}Idle_Loop` };
      const blend = (n: number) => ({ blend: { param: "speed", points: Array.from({ length: n }, (_, i) => ({ at: i, clip: i % 2 ? `${Q}Jog_Fwd_Loop` : `${Q}Walk_Loop` })) } });
      const layer = (i: number) => ({ name: `l${i}`, start: "a", states: { a: blend(2) }, transitions: [], weight: 0.5 });
      const graph = (layers: number, transitions: number, more: { when?: number; from?: number; base?: object; params?: number } = {}) => JSON.stringify({
        format: "2.0", id: "GRAPHS/Big", name: "Big", parameters: Object.fromEntries([["speed", { type: "number", value: 1 }], ...Array.from({ length: (more.params ?? 1) - 1 }, (_, i) => [`p${i}`, { type: "number" }])]), start: "idle", states: { idle: more.base ?? idle, idle2: idle },
        transitions: Array.from({ length: transitions }, (_, i) => ({ from: more.from ? Array.from({ length: more.from }, () => "idle") : "idle", to: "idle2", when: Array.from({ length: more.when ?? 1 }, () => ({ param: "speed", op: ">", value: 100 + i })) })),
        layers: Array.from({ length: layers }, (_, i) => layer(i)),
      });
      const costs = async (g: string, script = minute) => (await call("graph.sim", { graph: g, script })).error;
      const per = (what: string, cut: string) => ({ code: "E_ARGS", message: `${what}: ${cut}, or shorten dur or lower rate` });
      expect(await costs(graph(500, 1))).toEqual(per("the run plays 1001 clips at once (each layer's widest state: a blend's points) × 3600 steps, past the 144000 clip steps graph.sim takes (4 clips × 36000 steps)", "use fewer layers or blend points"));
      expect(await costs(graph(0, 1, { base: blend(1000) }))).toEqual({ code: "E_ARGS", message: "states.idle.blend has 1000 points, past the 64 one blend graph.sim plays takes: use fewer points" });
      expect(await costs(graph(0, 1, { base: blend(64) }))).toEqual(per("the run plays 64 clips at once (each layer's widest state: a blend's points) × 3600 steps, past the 144000 clip steps graph.sim takes (4 clips × 36000 steps)", "use fewer layers or blend points"));
      const tests = (n: number) => `the run tests ${n} transition terms (each transition 1, and its conditions and the states it is from) × 3600 steps, past the 36000000 graph.sim takes (1000 terms × 36000 steps)`;
      expect(await costs(graph(0, 20_000))).toEqual(per(tests(40_000), "use fewer transitions or conditions"));
      expect(await costs(graph(0, 1, { when: 200_000 }))).toEqual(per(tests(200_001), "use fewer transitions or conditions"));
      expect(await costs(graph(0, 1, { from: 10_000 }))).toEqual(per(tests(10_002), "use fewer transitions or conditions"));
      const reads = (k: number, n: number) => per(`the run reads ${k} parameters ${n} times (each step, and each number the script eases in), past the 3600000 parameter reads graph.sim takes (100 parameters × 36000 steps)`, "use fewer parameters");
      const eased = JSON.stringify({ format: "2.0", id: "SIMS/Eased", dur: 60, film: 0, input: [{ t: 1, set: { speed: 2 }, over: 1 }] });
      expect([await costs(graph(0, 1, { params: 1001 })), await costs(graph(0, 1, { params: 1000 }), eased)]).toEqual([reads(1001, 3600), reads(1000, 3601)]);
      // what its fades play out, by a run without poses first: a state left for another every step, each fade cut (a
      // 32-point blend: 32 clips at once, 4 states fading out with it), on a 20 s script
      const fades = JSON.stringify({ format: "2.0", id: "GRAPHS/Fades", name: "Fades", parameters: { speed: { type: "number", value: 0.5 } }, start: "a", states: { a: blend(32), b: blend(32) }, transitions: [{ from: "a", to: "b", fade: 10, interruptible: true }, { from: "b", to: "a", fade: 10, interruptible: true }] });
      expect(await costs(fades, JSON.stringify({ format: "2.0", id: "SIMS/Third", dur: 20, film: 0, input: [] }))).toEqual(per("the run plays 38400 clip steps, and its fades (1200 transitions taken) up to 153600 more, past the 144000 clip steps graph.sim takes (4 clips × 36000 steps)", "take fewer transitions, or shorter fades"));
      // while the shipped graphs pass at the longest script (Locomotion's 4 clips at once at the limit), and Sword_Combo
      // runs a combo through its fades
      const longest = { format: "2.0", id: "SIMS/Longest", dur: 600, input: [] } as unknown as Parameters<typeof runCost>[2];
      for (const f of ["spec/graphs/Locomotion.json", "spec/graphs/Sword_Combo.json"]) expect(((g: G.Graph) => runCost(G.layersOf(g), Object.keys(g.parameters ?? {}).length, longest, 36_000))(JSON.parse(text(f)) as G.Graph)).toBeUndefined();
      const combo = JSON.stringify({ format: "2.0", id: "SIMS/Combo", dur: 3, film: 0, input: [0.2, 0.6, 1.0].map((t) => ({ t, trigger: "attack" })) });
      expect(await call("graph.sim", { graph: "spec/graphs/Sword_Combo.json", script: combo })).toMatchObject({ status: "findings", data: { steps: 180, states: [{ state: "a" }, { state: "b" }, { state: "c" }] } });
      for (const bad of ["[1]", '{"script":"SIMS/Short","states":[]}']) expect((await call("graph.sim", { graph: L, script: SHORT, expect: bad })).error).toEqual({ code: "E_JSON", message: "the expected trace is not one: give a trace.json graph.sim wrote (spec/SIM.md §2)" });
      expect([readdirSync(join(cwd, "check-output")), readdirSync(join(cwd, "check-output/graph.sim"))]).toEqual([["graph.sim"], ["Combo.trace.json", "Short.trace.json", "Sprint.trace.json"]]);
    }));

  it("graph.sim: a character whose bones' names no table knows refused (E_RIG), then run with the patch its retarget.inspect call gives, the hints keeping the mapping", () =>
    inCwd(async (_call, cwd) => {
      // tier 1b's rig with every name reversed ("pelvis" "b_sivlep") and its right leg off the pelvis: its shape names
      // only some required bones
      const rig = JSON.parse(text("spec/vectors/tier1b/rig.gltf")) as { nodes: { name: string; children?: number[] }[] }, reg = new Registry([...COMPOSE, ...RETARGET]), host = nodeHost(cwd);
      const rev = (b: string) => `b_${[...b].reverse().join("")}`, on = (tool: string, args: object) => reg.call(tool, args, { host }) as Promise<Reply<Row>>;
      for (const n of rig.nodes) n.name = rev(n.name);
      rig.nodes[1]!.children = rig.nodes[1]!.children!.filter((k) => rig.nodes[k]!.name !== "b_r_hgiht");
      writeFileSync(join(cwd, "my rig.gltf"), JSON.stringify(rig));
      writeFileSync(join(cwd, "short one.json"), SHORT);
      const sim = (mapping?: object) => on("graph.sim", { graph: L, script: "short one.json", character: "my rig.gltf", ...(mapping ? { mapping } : {}) });
      const refused = await sim();
      expect([refused.status, refused.error?.code, refused.error?.message]).toEqual(["error", "E_RIG", expect.stringMatching(/^'my rig\.gltf': head, leftUpperArm, .* not mapped; `retarget\.inspect 'my rig\.gltf'` gives the patch: /)]);
      // the call it names gives the patch, each bone to fill in; filled with each bone's own (the unreversed rig's), the
      // run takes it as mapping, and its hint runs it again with it
      const [see] = hintedCalls(refused.error!.message), given = (await on(see!.tool!, see!.args!)).data!.patch as { bones: Record<string, string | null> };
      const own = ((await on("retarget.inspect", { character: "spec/vectors/tier1b/rig.gltf" })).data!.patch as { bones: Record<string, string> }).bones;
      const patch = { bones: Object.fromEntries(Object.keys(given.bones).map((h) => [h, rev(own[h]!)])) };
      const ran = await sim(patch);
      expect([ran.status, ran.data!.character, ran.data!.steps, hintedCalls(ran.next).map((h) => h.args)]).toEqual(["findings", "'my rig.gltf'", 36, [{ graph: L, script: "short one.json", character: "my rig.gltf", mapping: patch }]]);
    }));
});
