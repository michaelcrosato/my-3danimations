# m3a: character animation for agents

**Draft** (WP-4.7, WP-6.6): enough to find, fit and wire characters; WP-7.3 finishes it.

m3a plays humanoid motion clips on any humanoid character, in a game or headless. Everything is text and code: clips
are JSON, the runtime is deterministic, and the sensors measure motion as numbers (and draw it as PNGs) without a
display.

## The packages

| Package | What it does | Entry |
|---|---|---|
| `@m3a/core` | clips, the `Animator`, the solver, contacts and root motion; no renderer, no Node | `@m3a/core` |
| `@m3a/library` | the clip library (the CC0 default pack): catalogs and clips by id | `@m3a/library/node` (`openLibrary`) |
| `@m3a/three` | binds a three.js character and writes poses to its bones | `@m3a/three` (three r182 is a peer) |
| `@m3a/sensors` | metrics, repairs (`fix`), contact sheets | `@m3a/sensors`, `@m3a/sensors/node` (`writePng`) |
| `@m3a/tools` | the simulation (`sim`) and this manual | `@m3a/tools` |

Units: millimetres and degrees in m3a, metres in three.js (the adapter converts). Time in seconds.

## The mental model

- A **clip** is key poses over time (`clip.keys`), each a few readable numbers per body part, in percent of the body's
  own hip height, so one clip plays on any body. `loop` says whether it cycles; `dur` is its length.
- A clip was made on a **rest** (its source's body). Measuring a clip (contacts, speed, strike) uses that rest.
- **Binding** reads a character's skeleton and maps it to the humanoid profile: `bind(scene)` from `@m3a/three`. The
  bound body (`bound.core`) is what an `Animator` plays on.
- An **Animator** plays clips on layers, on a fixed step: `step(dt)` advances time and fires events; `pose()` solves
  the mixed pose onto the skeleton. With `@m3a/three`, `attach(animator, bound).update(dt)` does both and writes the
  bones.
- **Contacts** (when a foot stands) let the Animator plant feet and move the root the way the feet push it. The
  library's clips don't carry them yet; `playable(clip, rest)` measures them on the clip's own rest and puts them on
  the clip, with its library's spine and neck shares (so its torso bends as its library posed it, on any body).
- **Root motion**: an in-place loop with contacts travels as its planted feet imply. `attach(...).moved` (mm, the
  character's own frame: `forward`, `right`, `yaw`) is how far it went in the last update, and `.travel` that move in
  the scene (metres, the way the model faces: not always +Z); move your character by it, and its feet stay put.

## Find: the library

```ts
import { openLibrary } from "@m3a/library/node";
const library = openLibrary();                    // the CC0 default pack
const walks = library.catalog().filter((r) => r.tags.includes("walk") && r.loop);
// a row: { id, dur, loop, speed (% of hip height per s, or null), tags, desc, src }
const { clip, rest } = library.clip("QUATERNIUS_3D2DGE/Walk_Loop");
```

Pick clips from catalog rows (ids, tags, descriptions), never by reading motion data. Useful tags: `idle`, `walk`,
`run`, `jump`, `attack`, `sword`, `unarmed`, `death`, `crouch`, `sit`, `emote`. Ids are `SET/Name`; `_Loop` names
loops. A `_RM` clip carries its own root travel.

## Check and repair a clip before you use it

```ts
import { fix, metrics } from "@m3a/sensors";
metrics(clip, rest).verdict;                      // "pass" | "warn" | "fail"; .text explains, at most 20 lines
const repaired = fix(clip, rest).clip;            // repairs what it can (twist flips, jitter, seams), never worse
```

## Fit: bind the character

```ts
import { bind } from "@m3a/three";
const bound = bind(scene);                        // the glTF scene with the skinned mesh
bound.report.text;                                // how it was recognized; confidence; missing bones
```

`bind` throws if required bones are missing, saying which. It works on Mixamo, Unreal, Rigify, VRM and most other
humanoid rigs, by names or by topology. `bound.core.rest.H0` is the character's hip height in mm: speeds and sizes in
"hip heights" are multiples of it.

## Wire: play clips

```ts
import { Animator, contact, measureFacts, playable } from "@m3a/core";
import { attach } from "@m3a/three";

const ready = playable(repaired, rest);           // contacts (feet planted, root motion) and its library's spine
const animator = new Animator(bound.core).layer("base", { clip: ready });
const player = attach(animator, bound);

// each frame
player.update(dt);                                // steps, poses, writes the bones
scene.position.add(player.travel);                // the root's move (m), the way the model faces
```

- **Layers**: `animator.layer(name, { clip, weight, speed, time, mask, additive })` adds or changes a layer; omitted
  options stay. The lowest layer plays whole; each layer above blends over it by `weight` (0 to 1). `remove(name)`
  drops one. `animator.layers` lists them (`time` is each playhead, `held` is `"end"` once a one-shot finished).
- **Cross-fade**: add the new clip on a top layer at weight 0 and raise its weight over about 0.25 s; then set it on
  the base layer at the top layer's `time` and remove the top layer. Planting blends across the fade.
- **Matching speed**: a loop's own ground speed on this body is
  `contact.contactRoot(ready, bound.core.rest, ready.contacts).speed` (mm/s). To travel at `v` m/s, play it at
  `speed: (v * 1000) / own` (keep it within about 0.5 to 2), and move the character by `player.travel`. Moving the
  character at one speed while the feet step at another makes them slide.
- **Events**: `animator.step(dt).events` (and `player.update(dt)`) returns the events passed, in order:
  `{ name, layer, clip, t, at }`. Add your own to a clip: `{ ...clip, events: [{ t: 0.42, name: "hit" }] }`.
  `measureFacts(clip, rest).strike` gives an attack's strike time.
- **Masks**: `mask: "upper"` (or `["armL", "head"]`) plays a layer on those parts only.
- **Determinism**: the same steps give the same `animator.hash()`, in Node and in a browser; `save()` and
  `restore(data, clips)` round-trip through JSON.

## Wire: graphs

A graph is JSON: states that play clips, transitions on parameters the game sets, blend spaces and layers. The
Animator runs it inside its fixed step, the same in Node and in a browser.

```json
{
  "format": "2.0", "id": "GRAPHS/Swimmer",
  "parameters": { "speed": { "type": "number" }, "atEdge": { "type": "bool" },
                  "climb": { "type": "trigger", "buffer": 0.2 } },
  "start": "swim",
  "states": {
    "swim": { "blend": { "param": "speed", "points": [{ "at": 0, "clip": "QUATERNIUS_3D2DGE/Swim_Idle_Loop" },
                                                      { "at": 1, "clip": "QUATERNIUS_3D2DGE/Swim_Fwd_Loop" }] } },
    "climb": { "clip": "QUATERNIUS_3D2DGE/ClimbUp_1m_RM" },
    "stand": { "clip": "QUATERNIUS_3D2DGE/Idle_Loop" }
  },
  "transitions": [
    { "from": "swim", "to": "climb", "when": [{ "param": "climb" }, { "param": "atEdge" }], "fade": 0.15 },
    { "from": "climb", "to": "stand", "exit": 1, "fade": 0.2 },
    { "from": "stand", "to": "swim", "when": [{ "param": "speed", "op": ">", "value": 0.5 }] }
  ]
}
```

- **A state** is one of `clip`, `recipe`, `blend` (one parameter: `param`, points in rising `at`; two: `params`, `at`
  `[x, y]`; its clips kept in step) or `pass` (on a layer only: what is below shows). It may have `speed`, `rate` (a
  number parameter multiplying the speed) and `at` (the clip time it starts at).
- **A transition** goes `from` a state (a list, or `"*"`) `to` another when all of `when` hold: a number compared
  (`== != < <= > >=`), a bool alone (true) or compared (`{ "param": "grounded", "op": "==", "value": false }`), or a
  trigger alone (pressed; used up when taken). `exit`: only once the
  state has played that share (1: a one-shot's end). `window`: `[from, to]` s of the state's time (a cancel window).
  `fade`: seconds (0.2; 0 cuts). `sync`: start at the phase of the state left. `interruptible`: may be left mid-fade.
  The first that holds is taken.
- **A trigger** waits until a transition uses it, or for its `buffer` seconds; `set(name, false)` clears it.
- **Layers** over the base: `"layers": [{ "name": "upper", "mask": "upper", "start": "none", "states": { "none":
  { "pass": true }, "jab": { "clip": "…" } }, "transitions": [ … ] }]`, with `weight` and `additive`.

```ts
import { Animator, graph, playable } from "@m3a/core";
const clips = (id: string) => { const { clip, rest } = library.clip(id); return playable(clip, rest); };
graph.validateGraph(g, { clips });            // issues: { code, field, message, fix }; none means it plays
const animator = new Animator(bound.core).play(g, clips);   // throws E_GRAPH naming the issues
animator.set("speed", 0.8); animator.trigger("climb");      // read from the next step
animator.on("splash", (e) => playSound(e.name));           // each event as its step passes it ("*": all)
animator.graph!.states;                                     // [{ layer, state, from, fade }]
```

The graph plays on Animator layers named `@layer/entry/point`; leave them be (`stop()` removes them). Layers you add
with `layer()` go over them.

## Wire: events and hit timing

- An event (`clip.events`: `{ t, name, … }`) fires on the step the playhead passes it: in `step(dt).events`,
  `player.update(dt).events` and `animator.on(name, fn)`. A layer at weight 0 fires none (the lowest layer always does).
- An attack's strike is `clip.facts.strike[0]` (or `measureFacts(clip, rest).strike[0]`): when its fastest hand or
  foot moves fastest toward the target. To act at a moment of a clip, put an event there
  (`playable({ ...clip, events: [{ t, name }] }, rest)`) and act when it fires, not on a timer. Played at speed s, an
  event at t comes `t / s` s in.
- Fade a one-shot in over about 0.1 s or more: snapped in at weight 1, the body jumps. `animator.layers` shows
  `held: "end"` once a one-shot ended.

## Wire: reactions

- **Upper body only:** `animator.layer("flinch", { clip, time: 0, mask: "upper", weight })`; the legs, hips and root
  keep what the layers below play. Groups: `upper`, `lower`, `armL`, `armR`, `legs`, `head`, `spine`.
- **Knocked down:** the knockdown takes the base layer (cross-fade), holds its end, then the next clip. From one pose
  lying on the floor to another, cut (`layer("base", { clip, time: 0 })`): a blend between two lying poses swings the
  limbs through the floor. Search the library for the reactions (hits, knockdowns, get-ups), and check what a clip does
  before you use it: `describe` says whether it ends lying, and sets differ (one set's knockback may get back up).

## Wire: root motion, in place, stride warping

- **Root-driven:** move the character by `player.travel`: the clips decide its speed and planted feet stay put.
- **In place** (the game moves the character): play the moving clips at the ground speed over their own, or the feet
  slide. A clip's own speed on this body is `contact.contactRoot(clip, bound.core.rest, clip.contacts).speed` (mm/s).
  In a graph, give the moving state `"rate": "warp"` (a number parameter) and set it each frame: stride warping.

## Check a graph: the simulation

```ts
import { sim } from "@m3a/tools";
const script = { format: "2.0", id: "SIMS/Test", dur: 6, input: [
  { t: 0.5, set: { speed: 0.8 }, over: 0.3 },   // over: eased there in 0.3 s
  { t: 2, set: { atEdge: true } }, { t: 2.2, trigger: "climb" } ] };
const run = sim.simulate({ graph: g, script, body: bound.core, clips });
run.trace.states;    // [{ step, t, layer, state, from }]: when each state was entered
run.trace.events;    // every event; run.trace.hits: windows from "hit" events
run.sensors;         // { verdict, slide, skate, findings } over the whole run
writePng("film.png", sim.filmstrip(run, 8));
```

`root: "in-place"` with `move` (the ground speed, m/s) and `warp: "warp"` simulates a game moving the character,
stride warped. `sim.validateScript(script, g)` checks a script; `sim.compareTraces(expected, actual)` names the first
difference.

## Make: recipes

A recipe is JSON: steps that make a new clip from the library's. It compiles the same everywhere, and the clip it makes
names its inputs.

```json
{
  "format": "2.0", "id": "PATROL/Torch_Walk",
  "steps": [
    { "op": "clip", "id": "QUATERNIUS_3D2DGE/Walk_Loop", "as": "walk" },
    { "op": "clip", "id": "QUATERNIUS_3D2DGE/Idle_Torch_Loop", "loop": 0.2, "as": "torch" },
    { "op": "retime", "in": "torch", "dur": 1.333, "as": "torch2" },
    { "op": "layer", "base": "walk", "over": "torch2", "mask": "upper" }
  ]
}
```

Each step names its result with `as`; later steps read it by name (`in`, `base`, `over`, `a`, `b`, `items`); the last
step's result is the clip.

| op | Fields | Result |
|---|---|---|
| `clip` | `id`; `from`, `to` (s); `loop` (true, or seconds to blend its seam over) | A library clip, sliced, closed into a loop |
| `sequence` | `items`; `fade` (0.2) | One after another, each cross-faded and placed where the last left the root |
| `blend` | `a`, `b`; `w` (0 to 1, or `[[t, w], …]`) | `a` toward `b`, each at the same phase of its own time |
| `layer` | `base`, `over`; `mask`; `weight`; `additive` | `over` on `base` in the masked parts |
| `mirror` | `in` | Left and right swapped: the other hand strikes |
| `retime` | `in`; `speed`, `dur` or `ease` | Faster or slower (its events and strike too), or to a length |
| `pose` | `in`; a field's parts (`{ "chest": { "turn": 25, "lean": -8 } }`) or `yaw`; `from`, `to` (s); `fade` | The parts moved by that much over the span, faded in and out |
| `look`, `pin` | `in`; `at` (mm); `end`, `path` | The head turned to a point; a hand or foot held on a path |
| `exaggerate`, `smooth`, `overshoot`, `stiffen` | `in`; `amount` or `window`; `mask` | Bigger, smoother, springier, or stiffer motion |
| `events`, `contacts` | `in`; `add` | Events (`[{ "t": 0.4, "name": "hit" }]`) or contacts added |

A field's parts: `body`, `chest` and `head` turn, lean and tilt (degrees); an arm or leg points forward, out and up,
bends and twists; hips move forward, right and up (% of the hip height).

```ts
import { recipe, serialize, validate } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { describe, metrics } from "@m3a/sensors";

recipe.validateRecipe(r);                                      // issues: { code, field, message, fix }
const { clip, rest } = recipe.compile(r, openLibrary().resolver());   // throws, naming the step
validate(clip).errors;                                         // a valid format-2 clip
metrics(clip, rest).verdict;                                   // the sensors, on the clip's own rest
describe(clip, rest).text;                                     // "a 1.33 s loop; 0.00–1.33 s walks; …"
writeFileSync("torch_walk.json", serialize(clip));                   // the clip, as the library writes clips
```

## Make: edits

- **Faster or slower:** `retime` with `speed` (1.5 is half again as fast) or `dur`; events and facts move with it.
- **The other side:** `mirror` (left and right swapped: the other hand or foot leads).
- **More anticipation:** before the key moment, move the body the other way with a `pose` from 0 to just before it,
  faded in and out (a right-handed overhand throw: `{ "chest": { "turn": 20, "lean": -8 } }` winds the throwing side
  back), and check that the moving part draws back before it goes out.
- **Bigger or softer:** `exaggerate` (1.25: a quarter more), `stiffen`, `smooth`.
- **What changed:** `measureFacts(clip, rest)` gives `strike` (when the fastest fist or foot moves fastest), `speed`,
  `travel` and `height`; compare an edit's with its source's.

## Make: actions

An action is a recipe with the ground it ends on, its beats and the moments it may be cut (a climb, a get-up, a roll):

```json
{
  "format": "2.0", "id": "ACTIONS/Climb_Up", "desc": "Pulls up onto a ledge and steps on",
  "steps": [{ "op": "clip", "id": "MESH2MOTION/ClimbUp_1m_RM", "to": 0.6 }],
  "floor": 115,
  "beats": [{ "name": "pull", "from": 0, "to": 0.3 }, { "name": "step_on", "from": 0.3, "to": 0.6 }],
  "interrupts": [{ "t": 0.45, "to": ["PROCEDURAL/Walk"], "why": "both feet on the ledge" }]
}
```

`floor` is the ground it ends on, % of the hip height above where it starts (a hop down's is below 0). A step may read
`PROCEDURAL/Walk`, `Brisk`, `Run`, `Limp`, `Breathe` or `Fidget`: a gait or idle made on the action's body
(`procedural.gaitClip(g, rest, { restSrc })` makes one with your own speed, cycle and stance).

```ts
import { actions } from "@m3a/core";

const c = actions.compileAction(a, openLibrary().resolver());  // c.clip: events at each beat's start, and "interrupt"
actions.actionRootAt(c, t);                // { forward, right, yaw, up } (% of the hip height): move and raise the character
const cut = actions.interruptAt(c, t);     // the next cut from t: { t, to, why }
actions.interruptInto(c, cut!, "PROCEDURAL/Walk").clip;  // the action to the cut, faded into the walk on the ledge
```

Two characters timed together (a jab and the flinch it lands on): a paired action, `{ "sync": "hit", "desc": "…", "roles": {
"attacker": { "steps": […] }, "victim": { "steps": […], "place": [105, 0, 180] } } }`, each role's steps carrying the
`sync` event (an `events` step adds it); `actions.compilePaired(p, resolve)`, and `actions.pairAt(c, t)` gives each
role's clip time and root.

## Check: sensors and sheets

```ts
import { checks, sheet, raster } from "@m3a/sensors";
import { writePng } from "@m3a/sensors/node";

writePng("walk.png", sheet(clip, rest, { frames: 8 }).image);          // a contact sheet of a clip
writePng("three.png", raster.join([a.image, b.image], { down: true })); // sheets one under another

// what a character actually played: its body points each frame (mm, `pose.points`), as the sensors read them
const frames = [], roots = [];
for (let i = 0; i < 120; i++) { player.update(1 / 60); frames.push(Float32Array.from(player.pose.points)); roots.push({ ...player.root }); }
const m = checks.motionOfFrames(frames, bound.core.rest, { root: roots });
checks.measure(m).verdict;                         // slide, skate, pops, jitter, NaN, ... on what played
```

A sheet costs about width × height / 750 tokens to look at; read the numbers first.

## Rules and common mistakes

- Clips are data: never edit `clip.keys` by hand to fix motion; use `fix`, or make a new clip with a recipe.
- Measure a clip on its own `rest`, not on your character's: `playable(clip, rest)`, `measureFacts(clip, rest)`.
- A clip's `speed` in the catalog is % of hip height per second on its own body; on yours, use `contactRoot(...).speed`.
- Don't scale or re-parent the character's bones yourself; `bind` reads them once, and `attach` writes rotations.
- `update(dt)` with a varying `dt` is fine: the Animator steps in fixed 1/60 s steps and carries the rest.
- Only the CC0 default pack is visible unless you opt in: `openLibrary({ tiers: ["cc0", "cc-by"] })` (credit each
  CC BY clip; CMU's clips can't be resold, even converted).
- Errors say what to do: read them before reading the source.
