# m3a: character animation for agents

**First draft** (WP-4.7): enough to find, fit and wire locomotion; WP-7.3 finishes it.

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
  character's own frame: `forward`, `right`, `yaw`) is how far it went in the last update; move your character by
  it, and its feet stay put.

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
humanoid rigs, by names or by topology.

## Wire: play clips

```ts
import { Animator, contact, measureFacts, playable } from "@m3a/core";
import { attach } from "@m3a/three";

const ready = playable(repaired, rest);           // contacts (feet planted, root motion) and its library's spine
const animator = new Animator(bound.core).layer("base", { clip: ready });
const player = attach(animator, bound);

// each frame
player.update(dt);                                // steps, poses, writes the bones
scene.position.z += player.moved.forward / 1000;  // a glTF character faces +Z; mm → m
scene.position.x -= player.moved.right / 1000;
```

- **Layers**: `animator.layer(name, { clip, weight, speed, time, mask, additive })` adds or changes a layer; omitted
  options stay. The lowest layer plays whole; each layer above blends over it by `weight` (0 to 1). `remove(name)`
  drops one. `animator.layers` lists them (`time` is each playhead, `held` is `"end"` once a one-shot finished).
- **Cross-fade**: add the new clip on a top layer at weight 0 and raise its weight over about 0.25 s; then set it on
  the base layer at the top layer's `time` and remove the top layer. Planting blends across the fade.
- **Matching speed**: a loop's own ground speed on this body is
  `contact.contactRoot(ready, bound.core.rest, ready.contacts).speed` (mm/s). To travel at `v` m/s, play it at
  `speed: (v * 1000) / own` (keep it within about 0.5 to 2), and move the character by `player.moved`. Moving the
  character at one speed while the feet step at another makes them slide.
- **Events**: `animator.step(dt).events` (and `player.update(dt)`) returns the events passed, in order:
  `{ name, layer, clip, t, at }`. Add your own to a clip: `{ ...clip, events: [{ t: 0.42, name: "hit" }] }`.
  `measureFacts(clip, rest).strike` gives an attack's strike time.
- **Masks**: `mask: "upper"` (or `["armL", "head"]`) plays a layer on those parts only.
- **Determinism**: the same steps give the same `animator.hash()`, in Node and in a browser; `save()` and
  `restore(data, clips)` round-trip through JSON.

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

- Clips are data: never edit `clip.keys` by hand to fix motion; use `fix`, or make a new clip (WP-6).
- Measure a clip on its own `rest`, not on your character's: `playable(clip, rest)`, `measureFacts(clip, rest)`.
- A clip's `speed` in the catalog is % of hip height per second on its own body; on yours, use `contactRoot(...).speed`.
- Don't scale or re-parent the character's bones yourself; `bind` reads them once, and `attach` writes rotations.
- `update(dt)` with a varying `dt` is fine: the Animator steps in fixed 1/60 s steps and carries the rest.
- Only the CC0 default pack is visible unless you opt in: `openLibrary({ tiers: ["cc0", "cc-by"] })` (credit each
  CC BY clip; CMU's clips can't be resold, even converted).
- Errors say what to do: read them before reading the source.
