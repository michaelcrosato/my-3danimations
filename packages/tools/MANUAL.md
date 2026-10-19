# m3a: character animation for agents

m3a plays humanoid motion clips on any humanoid character, in a game or headless. Clips, recipes and graphs are JSON;
the runtime is deterministic; the sensors measure motion as numbers (and PNGs) without a display. Every capability is
also a tool: `m3a <tool>`, or MCP (Tools).

## The packages

- `@m3a/core`: clips, the `Animator`, graphs, recipes, actions, solver, contacts; no renderer, no Node.
- `@m3a/library`: catalogs, search, clips by id, tiers; `openLibrary` from `@m3a/library/node`.
- `@m3a/three` (peer three r182): binds a three.js character, writes its bones; `loadGlb` (from
  `@m3a/three/test-characters`) reads a .glb in Node.
- `@m3a/sensors`: metrics, `describe`, repairs (`fix`), contact sheets; `writePng` from `@m3a/sensors/node`.
- `@m3a/io`: glTF/GLB, VRMA, BVH, CMU ASF/AMC readers and writers (import, export).
- `@m3a/tools` (and `@m3a/tools/node`): the tools, the simulation (`sim`), the `m3a` command, MCP, this manual.

Units: mm, degrees and seconds; metres in three.js (the adapter converts). "% of the hip height" and "hip
heights a second" scale with a body's hip height `H0`: one clip fits every body.

## The mental model

- A **clip** is key poses over time, a few readable numbers per body part (`loop`, `dur`, `keys`, `events`,
  `facts`), made on a **rest** (its source's body): measure it on that rest.
- **Binding** maps a character's skeleton to the humanoid profile: `bind(scene)`; `bound.core` is the body an
  `Animator` plays on.
- An **Animator** plays clips on named **layers** at a fixed 1/60 s step: `step(dt)` moves the playheads, fires events
  and moves the root; `pose()` solves the mix onto the bones; `attach(animator, bound).update(dt)` does both.
- **Contacts** (when a foot stands) plant the feet and move the root as they push (root motion: move the character
  by it): `playable(clip, rest)` measures them; play library clips through it, or the feet slide.
- A **graph** (JSON): states, transitions on parameters the game sets, blend spaces and layers, run inside the
  Animator's step. A **recipe** (JSON) makes a clip from clips; an **action** is a recipe with ground, beats and cuts.
- The **sensors** judge motion from the bones (slide, skate, pops, jitter, penetration, NaN), a clip or a whole
  simulated run.

## A complete example: walk, attack, react

A knight walks, slashes (damage on a `hit` event at the blade's strike) and flinches from the waist up when struck.
The slash with its event is a recipe; 0.479 s is the slash's measured strike (`m3a show MESH2MOTION/Sword_Attack`, or
`clip.facts.strike[0]`).

```json slash.json
{ "format": "2.0", "id": "KNIGHT/Slash_Hit", "steps": [
  { "op": "clip", "id": "MESH2MOTION/Sword_Attack", "as": "slash" },
  { "op": "events", "in": "slash", "add": [{ "t": 0.479, "name": "hit" }] } ] }
```

The graph: `walk` blends a guard stance into a walk; `attack` (a trigger, kept 0.25 s) plays the slash until 90% of
it; `hurt` flinches an upper-body layer while the legs go on.

```json knight.json
{
  "format": "2.0", "id": "GRAPHS/Knight",
  "parameters": { "walk": { "type": "number" }, "attack": { "type": "trigger", "buffer": 0.25 },
                  "hurt": { "type": "trigger" } },
  "start": "move",
  "states": {
    "move": { "blend": { "param": "walk", "points": [{ "at": 0, "clip": "MESH2MOTION/Idle_Sword" },
                                                    { "at": 1, "clip": "MESH2MOTION/Walk_Large" }] } },
    "slash": { "clip": "KNIGHT/Slash_Hit" }
  },
  "transitions": [
    { "from": "move", "to": "slash", "when": [{ "param": "attack" }], "fade": 0.15 },
    { "from": "slash", "to": "move", "exit": 0.9, "fade": 0.3 }
  ],
  "layers": [{
    "name": "react", "mask": "upper", "start": "none",
    "states": { "none": { "pass": true }, "flinch": { "clip": "QUATERNIUS_SHARDFALL/Hit_Chest" } },
    "transitions": [{ "from": "none", "to": "flinch", "when": [{ "param": "hurt" }], "fade": 0.05 },
                    { "from": "flinch", "to": "none", "exit": 1, "fade": 0.2 }]
  }]
}
```

The game: compile the recipe, serve the graph its clips, step it every frame.

```ts
import { readFileSync } from "node:fs";
import { Animator, playable, recipe } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { attach, bind } from "@m3a/three";
import { loadGlb } from "@m3a/three/test-characters";

const library = openLibrary();                                 // the CC0 default pack
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const slash = recipe.compile(read("slash.json"), library.resolver());
const clips = (id: string) => {
  if (id === slash.clip.id) return playable(slash.clip, slash.rest);
  const { clip, rest } = library.clip(id);
  return playable(clip, rest);
};
const knight = read("knight.json");
// in a page, three's GLTFLoader; in Node, loadGlb (no textures)
const scene = (await loadGlb(readFileSync("character.glb"), { textures: false })).scene;
const bound = bind(scene);
const animator = new Animator(bound.core).play(knight, clips);   // throws E_GRAPH naming each issue
const player = attach(animator, bound);
let damage = 0;
animator.on("hit", () => (damage += 25));                        // on the blade's strike, not a timer

for (let frame = 0; frame < 210; frame++) {                      // 3.5 s at 60 fps
  animator.set("walk", Math.min(1, Math.max(0, (84 - frame) / 12)));  // 1, eased to 0 over 1.2–1.4 s
  if (frame === 84) animator.trigger("attack");
  if (frame === 144) animator.trigger("hurt");
  player.update(1 / 60);                                         // steps, fires events, poses, writes the bones
  bound.root.position.add(player.travel);                        // root motion: planted feet stay put
}
```

Headless, the graph runs a script of that input:

```json knight-sim.json
{ "format": "2.0", "id": "SIMS/Knight", "graph": "GRAPHS/Knight", "dur": 3.5,
  "input": [{ "t": 0, "set": { "walk": 1 } }, { "t": 1.2, "set": { "walk": 0 }, "over": 0.2 },
            { "t": 1.4, "trigger": "attack" }, { "t": 2.4, "trigger": "hurt" }] }
```

```ts
import { sim } from "@m3a/tools";
import { writePng } from "@m3a/sensors/node";

const run = sim.simulate({ graph: knight, script: read("knight-sim.json"), body: bound.core, clips });
run.trace.states;    // each state entered: { step, t, layer, state, from }
run.trace.hits;      // a window per hit event: { open, close, t0, t1, layer, state, clip }
run.sensors;         // { verdict, slide, skate, findings } over the whole run (null with poses: false)
writePng("knight.png", sim.filmstrip(run, 8));
```

```sh
npx m3a recipe.compile slash.json      # writes check-output/recipe.compile/Slash_Hit.clip.json
npx m3a graph.sim knight.json --script knight-sim.json --clips check-output/recipe.compile/Slash_Hit.clip.json
```

## Find: the library

```ts
const walks = library.catalog().filter((r) => r.tags.includes("walk") && r.loop);
// a row: { id, dur, loop, speed (% of the hip height a second, or null), tags, desc, src }
const hits = library.search("sword slash", { limit: 5 }).rows;  // ranked: { id, tier, dur, loop, speed (m/s at 0.95 m hips), tags, desc, score, core (true: a usual clip) }
const { clip, rest } = library.clip("MESH2MOTION/Walk_Large");  // and its set and tier
```

Pick clips by their rows, and check one with `m3a describe <id>` first: sets differ (one set's knockback gets
back up). Ids are `SET/Name`; an `_RM` clip carries its own root travel.

**Tiers.** A game sees the CC0 default pack unless it opts in twice: `"tiers"` in `game.json` (for the tools) and
`openLibrary({ tiers: ["cc0", "cc-by"] })` in code. The other tiers are packs beside `@m3a/library` (`npm install
@m3a/library-cc-by` or `@m3a/library-cmu`); a clip past the game's tiers throws `LibraryError` `E_TIER` naming the
opt-in (`E_NO_SET` without its pack). Credit each `cc-by` clip; `cmu` clips can't be resold, even converted; `local`
(what `m3a import` made) never ships (Ship).

## Fit: bind the character

```ts
bound.report.text;                    // how it was recognized, confidence, missing bones (at most 20 lines)
bound.report.patch;                   // the mapping: edit it and bind(scene, { mapping }) again
bound.core.rest.H0;                   // the hip height (mm)
```

`bind` recognizes Mixamo, Unreal, Rigify, VRM and most humanoid rigs by bone names, else by shape, and throws naming a
missing required bone. `m3a retarget.inspect <file>` says the same of a .glb, .gltf or .vrm; `m3a retarget.apply
<file> --clips <ids>` judges each clip played on its body.

## Wire: layers, events, root motion

```ts
const flinch = clips("QUATERNIUS_SHARDFALL/Hit_Chest");
const a = new Animator(bound.core).layer("base", { clip: clips("KNIGHT/Slash_Hit") });
a.layer("hurt", { clip: flinch, weight: 0.8, mask: "upper", time: 0 });   // options left out stay as they were
a.layer("hurt", { mask: { chest: 1, head: 1, armL: 0.5 } });              // weights by field; unlisted ones weigh 0
const step = a.step(0.5);             // { steps, events: [{ name, layer, clip, t, cycle, at, event }], root }
a.layers;                             // bottom first: { name, clip, weight, mask, additive, speed, time, cycle, held }
a.remove("hurt");
```

- **Layers** (`clip`, `weight`, `mask`, `additive`, `speed`, `time`): the lowest playing layer plays whole; each above
  blends over it by `weight` (0 to 1) times its mask's weight per field. A mask: groups (`upper`, `lower`, `armL`,
  `armR`, `legs`, `head`, `spine`), weights by field, or `ops.mask(groups, feather)`, fading through the next fields.
  Root motion blends by the mask's `root` and `yaw` fields: an `upper` layer leaves the travel to the legs.
  A new clip starts at `time` (0), the same clip carries on; setting `time` fires no events; `held` is `"end"` once a
  one-shot finished.
- **Cross-fade** by hand: the new clip on a top layer at weight 0, in step (`time: mb.time(ma.phase(t))`, `ma`, `mb`
  the clips' `ops.phaseMap(c, c.contacts)`, `t` the old one's time), raised over 0.25 s, then set on the base at its
  `time`, the top layer removed. Fade one-shots in over 0.1 s or more, or the body jumps.
- **Events** (`clip.events`: `{ t, name }`) fire on the step a playhead passes them, from a layer above weight 0 or
  the lowest one: in `step(dt).events`, `player.update(dt).events`, `animator.on(name, fn)` (`"*"`: all).
  `clip.facts.strike` (or `measureFacts(clip, rest).strike`) lists an attack's strike times.
- **Root motion**: `player.travel` (a three `Vector3`, metres, the way the model faces: not always +Z) is the last
  update's move: add it to the character's position and planted feet stay put. `player.moved` the same in the
  character's frame (`forward`, `right` mm, `yaw` degrees); `player.root` where it stands; `player.pose` the last pose
  (`points`, `joints`, `hips`, `local`).
- **Matching speed**: `contact.contactRoot(c, rest, c.contacts)` is a playable clip's path on a body,
  `{ root(t), speed }` (`root(t)`: `{ forward, right, yaw }`, mm and degrees; `speed`: mean mm/s, 0 if no foot plants:
  pick another clip). For v m/s play a loop at `speed: (v * 1000) / own`, `own` its speed on `bound.core.rest` (0.5 to
  2, else pick a clip nearer v; in range a `core` row beats a nearer one), and move the character by `player.travel`,
  which then covers v: moved at v yourself, feet slide in fades and where a keyed stance drifts. In a graph,
  `"rate": "<param>"` (stride warping; its parameter needs `"value": 1`).
- **Determinism**: the same calls give the same `animator.hash()` in Node and a browser; `save()` and
  `restore(data, clips, graph?)` round-trip through JSON; `update(dt)` takes any dt (fixed steps, the rest carried).

## Wire: graphs

- **A state** is one of `clip`, `recipe` (a compiled recipe's id), `blend` (`{ param, points: [{ at, clip }] }` in
  rising `at`, or two parameters: `params`, `at: [x, y]`; `sync`, true, keeps its clips in step) or `pass` (on a layer:
  what is below shows). It may have `speed`, `rate` and `at` (the clip time it starts at).
- **A transition** goes `from` a state (a list, or `"*"`) `to` another when all of `when` hold: a number compared
  (`== != < <= > >=`), a bool alone or compared (`{ "param": "grounded", "op": "==", "value": false }`), a trigger
  alone (used up when taken). `exit`: once the state has played that share (1: a one-shot's end). `window`: `[from,
  to]` s of the state's time (a cancel window). `fade` (0.2; 0 cuts). `sync`: start at the phase of the state left.
  `interruptible`: may be left mid-fade. The first that holds is taken.
- **A trigger** waits until a transition uses it, or for its `buffer` s; `set(name, false)` clears it.
- **Layers**: `{ name, mask, weight, additive, start, states, transitions }`, bottom first, played on Animator layers
  named `@…` under any you add; `stop()` removes them.
- `graph.validateGraph(g, { clips })` gives issues `{ code, field, message, fix }` (none: it plays); `animator.graph`
  gives `{ id, states: [{ layer, state, from, fade }], params }`; entering a state fires `enter`.

## Make: recipes and edits

Each step names its result with `as` (else `s1`, `s2`, … by place); later steps read names (`in`, `base`, `over`, `a`,
`b`, `items`); the last step's result is the clip, with the recipe's `name`, `desc`, `tags`.

- `clip` (`id`; `from`, `to` s; `loop`: true, or seconds to blend its seam over): a library clip, sliced, closed into
  a loop
- `sequence` (`items`; `fade`, 0.2): one after another, each where the last left the root
- `blend` (`a`, `b`; `w`, 0 to 1 or `[[t, w], …]`): `a` toward `b`, each at the same phase
- `layer` (`base`, `over`; `mask`; `weight`; `additive`): `over` on `base` in the masked parts
- `mirror` (`in`): left and right swapped, so the other hand strikes
- `retime` (`in`; `speed`, `dur` or `ease`): faster or slower (events too), or to a length
- `pose` (`in`; parts by field, or `yaw`; `from`, `to` s; `fade`): the parts moved by that much over the span
- `look`, `pin` (`in`; `at` mm; `end`, `path`): the head turned to a point; a hand or foot held on a path
- `exaggerate`, `smooth`, `overshoot`, `stiffen` (`in`; `amount` or `window`; `mask`): bigger, smoother, springier,
  stiffer
- `events`, `contacts` (`in`; `add`): events or contacts added

A `pose` step adds its parts to the clip's own, faded in and out. `body`, `chest`, `head`: `turn` (+ toward the
right), `lean` (+ forward), `tilt` (+ toward the right), degrees. `armL`, `armR` (shoulder to fist, chest space),
`legL`, `legR` (hip to ankle, pelvis space): `forward`, `out` (+ away from the body), `up`, a direction in percent
(`forward: 30` swings a hanging arm about 17° forward); `bend` (elbow or knee, degrees, 0 straight); `twist` (degrees
round the limb). `hips`: `forward`, `right`, `up` (% of the hip height). `yaw` turns the whole character.

```ts
import { describe, metrics } from "@m3a/sensors";
import { serialize, validate } from "@m3a/core";
import { writeFileSync } from "node:fs";

const weary = { format: "2.0", id: "KNIGHT/Walk_Weary", steps: [
  { op: "clip", id: "MESH2MOTION/Walk_Large", as: "w" },
  { op: "pose", in: "w", chest: { lean: 12 }, head: { lean: 8 }, armL: { forward: 15, bend: 25 } } ] };
recipe.validateRecipe(weary);                          // issues: { code, step, field, message, fix }
const made = recipe.compile(weary, library.resolver());    // { clip, rest, track }; throws naming the step
validate(made.clip).errors;                            // a valid format-2 clip: []
metrics(made.clip, made.rest).verdict;                 // "pass" | "warn" | "fail"; .text explains
describe(made.clip, made.rest).text;                   // a timeline: "a 1.42 s loop; 0.00–1.42 s walks ..."
writeFileSync("walk_weary.json", serialize(made.clip));    // as the library writes clips
```

`recipe.compile` and `actions.compileAction` read clips through `library.resolver()`, which throws `E_TIER` (Tiers)
for an installed pack's clip past the game's tiers, and `recipe.RecipeError` for any other unknown id (its `.issues`
hold `R-E008`, the nearest id in its fix, if any). Edits: faster, `retime` (`speed: 1.5`); bigger, `exaggerate` (`amount: 1.25`); anticipation, a `pose` the
other way first.
`m3a edit <clip> --ops <json> --save-as WORKSHOP/<Name>` applies steps to a copy, with undo.

## Make: actions

An action is a recipe with `desc`, the floor it ends on (`floor`, % of the hip height above its start), `beats` and
`interrupts` (where it may be cut):

```json climb.json
{
  "format": "2.0", "id": "ACTIONS/Climb_Up", "desc": "Pulls up onto a ledge and steps on",
  "steps": [{ "op": "clip", "id": "MESH2MOTION/ClimbUp_1m_RM", "to": 0.6 }],
  "floor": 115,
  "beats": [{ "name": "pull", "from": 0, "to": 0.3 }, { "name": "step_on", "from": 0.3, "to": 0.6 }],
  "interrupts": [{ "t": 0.45, "to": ["PROCEDURAL/Walk"], "why": "both feet on the ledge" }]
}
```

```ts
import { actions } from "@m3a/core";

const c = actions.compileAction(read("climb.json"), library.resolver());  // c.clip: an event at each beat and interrupt
actions.actionRootAt(c, 0.3);           // { forward, right, up (% of the hip height), yaw (°) }: move and raise it
const cut = actions.interruptAt(c, 0.3);  // the next cut from then: { t, to, why }
actions.interruptInto(c, cut!, "PROCEDURAL/Walk").clip;   // cut there, faded into a walk on the ledge
```

A step may read `PROCEDURAL/Walk`, `Brisk`, `Run`, `Limp`, `Breathe` or `Fidget`: a gait or idle made on the action's
body. A paired action times two characters on one event: `actions.compilePaired(p, resolve)`, `actions.pairAt(c, t)`.

## Check: sensors, sheets, simulations

```ts
import { checks, fix, raster, sheet } from "@m3a/sensors";

const walk = library.clip("MESH2MOTION/Walk_Large");
fix(walk.clip, walk.rest).clip;                                 // repairs what it can, never worse
const sheets = [walk, library.clip("MESH2MOTION/Idle_Sword")].map((x) => sheet(x.clip, x.rest, { frames: 8 }).image);
writePng("sheets.png", raster.join(sheets, { down: true }));   // about width × height / 750 tokens to look at

// what a character played: its body points each frame (mm)
const frames: Float32Array[] = [], roots: { forward: number; right: number; yaw: number }[] = [];
for (let i = 0; i < 120; i++) { player.update(1 / 60); frames.push(Float32Array.from(player.pose.points)); roots.push({ ...player.root }); }
checks.measure(checks.motionOfFrames(frames, bound.core.rest, { root: roots })).verdict;
```

`sim.simulate({ graph, script, body, clips, poses })` returns `{ trace, path, rates, frames, root, sensors, warnings }`:
`trace` (`states`, `events`, `hits`, `steps`, `rate`); `path`, the root every 0.25 s and at the end (`{ t, forward,
right, yaw }`, mm, world): a state's travel is the distance between two rows over their time; `rates`, stride warping's;
`frames` and `root`, each step's body points and root; `warnings` (a strike with no hit event). Script rows: `{ t, set,
over, trigger, move }`; `root: "in-place"` with `move` (m/s) and `warp: "<param>"` simulates a game moving the
character. `sim.validateScript(script, graph)` checks a script; `sim.compareTraces(expected, actual)` names the first
difference.

## Ship: licenses, import, export

`m3a license.check` checks `game.json` (`tiers`, `clips`, `ships`) or `--clips`, and prints the credits block.
`m3a import <file> --license <SPDX id>` writes its `local` set (`--set`, default `IMPORT`), which the tools read
when game.json's `"tiers"` holds `"local"`; `license.check` passes it only with `"ships": false`. A catalog
(`--catalog`) says what to take:

```json catalog.json
{
  "$sources": { "MOCAP": { "label": "Our studio's capture", "license": "CC0-1.0" } },
  "$pick": { "Wave_Short": ["Wave_Loop", 0, 0.5] },
  "Wave_Short": ["wave gesture", "waves the right hand once"]
}
```

`$sources`: the source's record (`label`, `license`, `credit`, `url`, `origin`), keyed by its name. `$pick`: each
clip's `[take, from s, to s, shortest cycle s]` (only picked takes are read). `$skip`: `{ "<animation>": "why" }`
leaves one out. A clip's entry: `["tags", "what it does"]`; `loop` or `once` among the tags sets whether it loops.

```json game.json
{ "game": "Knight Demo", "tiers": ["cc0", "local"], "ships": false }
```

```sh
npx m3a import mocap.gltf --list                 # its animations and rig; writes nothing
npx m3a import mocap.gltf --license CC0-1.0 --catalog catalog.json --set MOCAP
npx m3a license.check
npx m3a export MESH2MOTION/Walk_Large --character character.glb --format glb
```

```ts
const mine = openLibrary({ dir: "imports", tiers: ["local"] });  // in code, the imported sets
mine.clip("MOCAP/Wave_Short").tier;                               // "local"
```

## Grow: contribute to the library

`m3a library submit <clip> --by "<who made it>"` sends a clip (compiled: a recipe takes no `--by`) to the intake queue
(`.cache/intake/`, or the hosted one); `m3a library status [<id>]` lists yours: `submitted`, then `bounced` (with the
fix) or `awaiting review`: the owner adopts each. It is `CC0-1.0`, or keeps the license and credit of the CC BY
or CMU clip it derives from; its provenance gives its method and tool (`recipe.compile` writes them), who made it
(`--by`: an agent with its human), a model's prompt (`--prompt`) and a learned motion model's training-data
manifest (`--manifest <https URL>#sha256=<hex>`). A library clip barely changed bounces unless sent as
its fix:

```sh
npx m3a library submit check-output/recipe.compile/Slash_Hit.clip.json --improves MESH2MOTION/Sword_Attack --by "Claude (an AI agent) for Ana"
```

## Tools: the m3a command, MCP and the console

Every tool is served four ways: `tools.call(name, args, { host: nodeHost() })` (`tools` from `@m3a/tools`,
`nodeHost` from `@m3a/tools/node`), the `m3a` command, MCP (`m3a mcp`, stdio), and `__M3A_TOOLS__` on a page
(`installConsole(tools)`). Each line: the call (`<x>` by position, `[--x]` optional), then the MCP name where it
differs.

<!-- tools: written by node tools/manual/main.ts -->
- `m3a search <query> [--limit]`: Library clips for a game moment in words and filters, best first
- `m3a show <clip> [--from] [--legend]`: A clip's keys as text from time `from`, with source, license, fit, speed and strike
- `m3a describe <clip> [--detail]`: A clip as a short timeline
- `m3a metrics <clip> [--limit]`: Measure a clip with the sensors
- `m3a sheet <clip> [--frames] [--view]`: A clip as a contact-sheet PNG, the sensors' findings in red
- `m3a film <clip> [--frames] [--around]`: A PNG strip of a clip moving through space around a moment
- `m3a diff <a> <b> [--frames]`: Compare two clips
- `m3a lint <clip>`: The repairs a clip needs and the tags its motion doesn't bear out
- `m3a fix <clip> [--ops] [--save-as] [--max-keys] [--dry-run]` (an edit): Repair a clip with lint's operators, keeping steps that make nothing worse, into a WORKSHOP copy
- `m3a edit <clip> [--ops] [--action] [--save-as]` (an edit): Change a clip with recipe steps into a WORKSHOP copy
- `m3a retarget.inspect <character> [--mapping]` · `retarget_inspect`: Bind a character
- `m3a retarget.apply <character> --clips <clips> [--mapping]` · `retarget_apply`: Play clips on a character
- `m3a recipe.compile <recipe>` · `recipe_compile`: Compile a recipe into a clip file
- `m3a graph.validate <graph> [--clips]` · `graph_validate`: Check a graph
- `m3a graph.sim <graph> --script <script> [--character] [--mapping] [--expect] [--clips]` · `graph_sim`: Run a game-input script on a graph
- `m3a license.check [--clips] [--tiers] [--ships] [--set]` · `license_check`: Check clips, a set or game.json against licenses and tiers
- `m3a import <path> [--set] [--license] [--catalog] [--list] [--from]` (writes files): Fit a motion file's animations into `imports/<SET>/`, a local set, each with its fit
- `m3a export <clip> --character <character> [--format] [--mapping]`: Play a clip on a character and write it as .vrma, .glb or .bvh in `check-output/export/`, read back to check it
- `m3a review <do> <on> [--note]` (writes files): The owner's review queue
- `m3a library <do> <on> [--improves] [--by] [--prompt] [--manifest]` (writes files): Send a clip or recipe to the intake queue, or list yours
- `m3a version`: The m3a version and the clip format it reads and writes
- `m3a validate <path> [--text] [--mode]`: Validate a clip by path or as text
<!-- /tools -->

```sh
npx m3a help                     # every tool, one line each
npx m3a help graph.sim           # its flags and examples (or: npx m3a graph.sim -h)
```

- **Replies:** a verdict line first, at most 20 lines (`--verbose`, or `verbose: true`, for all), ending with `next:`,
  a call that runs as written. Exit codes: 0 ok; 1 findings or a failed tool; 2 a wrong call (MCP: `isError` for the
  last two, not for findings). A wrong tool, flag or field is refused naming the closest.
- **Flags:** `--save-as` or `--save_as`, given once except an array (`--clips a,b`, or JSON); a value starting with
  `--` is written `--flag=--value`. Paths are read under the working directory only; JSON may be passed as text.
- **`--json`** also writes `check-output/<tool>/report.json`: `{ schema: "m3a.reply/1", tool, status, verdict, lines,
  data, images, revision, error, next }`, as MCP's `structuredContent` and `tools.call`'s result. Images go to
  `check-output/<tool>/`, each with its size and token cost.
- **Edits** (fix, edit) take `--if-revision` (refused when the target moved on) and `--request-id` (a retry returns
  the first result, kept in `.m3a/requests/`).
- **MCP:** register the server, for example in `.mcp.json`:

```json .mcp.json
{ "mcpServers": { "m3a": { "command": "npx", "args": ["m3a", "mcp"] } } }
```

## Rules and common mistakes

- Clips are data: never edit `clip.keys` by hand; `fix` repairs, a recipe or `m3a edit` makes a new clip.
- A catalog `speed` is % of its own body's hip height a second; on yours, `contactRoot(...).speed` (mm/s).
- Don't move or scale the bones: `bind` reads them once and `attach` writes their rotations.
- Act on events, not timers; cut, don't blend, between two lying poses.
- `set` and `trigger` are read from the next step. Parameters aren't smoothed: ease a blend's over 0.2 s, or the
  body pops.
- Errors say what to do: read them first.
