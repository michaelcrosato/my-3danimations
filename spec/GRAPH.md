# The m3a graph, 2.0

**Status:** written in WP-6.4. **Schema:** `spec/schemas/graph.schema.json`. **Runtime:** `@m3a/core`'s `Animator`
(`play`, `set`, `trigger`, `on`) and `graph` namespace. A graph is how a game drives its clips: states that play clips,
transitions between them on parameters the game sets, blend spaces, and layers. It is JSON, as PlayCanvas's anim state
graph and Godot's AnimationTree are, and it runs inside `Animator.step`: the same states at the same steps, the same
hashes and events, in every engine.

## 1. A graph

```json
{
  "format": "2.0",
  "id": "GRAPHS/Locomotion",
  "parameters": { "speed": { "type": "number", "value": 0 }, "jump": { "type": "trigger" } },
  "start": "idle",
  "states": {
    "idle": { "clip": "QUATERNIUS_3D2DGE/Idle_Loop" },
    "move": { "blend": { "param": "speed", "points": [
      { "at": 1.4, "clip": "QUATERNIUS_3D2DGE/Walk_Loop" },
      { "at": 3.2, "clip": "QUATERNIUS_3D2DGE/Jog_Fwd_Loop" }] } },
    "jump": { "clip": "QUATERNIUS_3D2DGE/Jump_Start" }
  },
  "transitions": [
    { "from": ["idle", "move"], "to": "jump", "when": [{ "param": "jump" }], "fade": 0.1 },
    { "from": "idle", "to": "move", "when": [{ "param": "speed", "op": ">", "value": 0.2 }], "fade": 0.25 },
    { "from": "move", "to": "idle", "when": [{ "param": "speed", "op": "<=", "value": 0.2 }] },
    { "from": "jump", "to": "idle", "exit": 1 }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format`, `id`, `name`, `desc`, `tags` | | `format`, `id` | As a recipe's (`RECIPE.md` §1); `id` is `SET/Slug` |
| `parameters` | object | no | By name: `{ "type": "number" \| "bool" \| "trigger", "value" }` (0, false; a trigger has none, and may have a `buffer`: how long a press waits to be used, seconds) |
| `start`, `states`, `transitions` | | yes | The base layer: the state it starts in, its states by name, its transitions in order |
| `layers` | object[] | no | Layers over the base, bottom first, each `{ name, start, states, transitions, mask, weight, additive }` |

**A state** is exactly one of:
- `clip`: a clip by id, whatever the host's clips hold (a library clip, a compiled recipe or action, a procedural part);
- `recipe`: a compiled recipe's clip by its id, played as a clip and named as made from a recipe;
- `blend`: a blend space, `{ "param": p, "points": [{ "at": x, "clip": id }, …] }` on one number parameter (points in
  rising order of `at`), or `{ "params": [p, q], "points": [{ "at": [x, y], "clip": id }, …] }` on two; `sync` (true)
  keeps its clips in phase;
- `pass`: nothing plays, so what is below shows through (a layer over the base only).

It may have `speed` (1; a one-shot's above 0, as it plays forward); `rate`, a number parameter the speed is multiplied
by each step (a host matching playback to its ground speed sets it: stride warping, `SIM.md` §3); and, a clip state,
`at`: where it starts, seconds (0).

**A transition** goes `from` a state (a list of them, or `"*"` for any) `to` another, and is taken when all of `when`
hold: `{ "param", "op", "value" }` compares a number (`== != < <= > >=`) or a bool (`==`, `!=`); a bool or a trigger
alone, `{ "param" }`, is true or set. It may also have:

| Field | Meaning |
|---|---|
| `exit` | Taken only once the state it leaves has played this share of its length, 0 to 1 (of each cycle for a loop, so a loop's is under 1; a step that carries a loop past it into the next cycle takes it too): `1` chains a one-shot into the next at its end |
| `window` | `[from, to]`: taken only while the state it leaves is within these seconds of its own time, a cancel window |
| `fade` | The crossfade, seconds (0.2); 0 cuts |
| `sync` | The state it goes to starts at the phase the one it leaves is at (a walk into a jog in step), not at its start |
| `interruptible` | While it fades, the state it goes to may be left by its own transitions (false: the fade plays out first); cut, what it was fading out goes on fading out from where it was, so the pose carries on (at most four states at once, the faintest dropped) |

**A layer** over the base has a `mask` (body groups, `"upper"` or `["armL", "head"]`, or weights by field; all by
default), a `weight` (1) and `additive` (false: its states' changes from their first keys added over what is below).

## 2. Playing

`animator.play(graph, clips)` checks the graph (§4) with the host's clips (a map, a list or a lookup, as `restore`
takes), and enters each layer's start state (no `enter` event: nothing was left). `animator.set(name, value)` sets a
number or bool parameter, `animator.trigger(name)` a trigger (`set(name, false)` clears one unused); both are read from
the next step. `animator.stop()` stops it, and its layers (named `@…`) go with it: `layer()` and `remove()` refuse
them. `animator.graph` gives the id, each layer's state (and the one it left, while that fades out, and how far) and
the parameters.

Each fixed step, before the playheads move, each layer from the bottom:
1. lets a finished fade go;
2. unless it is fading and the fade can't be interrupted, takes the first transition in its list that holds: the state
   it is in is in its `from` (`"*"` never re-enters the state it is in; naming the state does), its conditions hold,
   and its `exit` and `window` allow it; the triggers it read are used up, the others stay set (a press made during a
   fade waits for it: input buffering), each for its `buffer` if it has one, else until it is used;
3. moves its fade on and plays its states as Animator layers named `@layer/entry/point`: a clip state one, a blend
   space one per point, a fade the states it fades out and the one it fades in, each at its share as the step ends
   (linear over `fade`), so a state faded into plays, and fires its events, from its first step.

A blend space's weights come from its parameters: on one, linear between the two points either side (held at the
ends); on two, by gradient bands (each point's weight how far the input is from passing any other, normalized: Unity's
2D freeform). Kept in phase, each clip plays at the speed that keeps it at the space's phase (its length over the
weighted mean length). The Animator mixes these layers as it mixes any (`MOTION.md`): their weights give each part its
share over what is below; masked weights between 0 and 1 blend as the layer stack does, so a feathered mask's share is
near, not exact. Root motion, planted feet, events and `pose()` come from the layers as ever.

Entering a state fires an event named `enter` (layer the graph layer's name, `event.state` and `event.from`); the
clips' own events fire with the Animator layer's name. `animator.on(name, fn)` (`"*"` for every event) calls `fn` with
each as the step passes it, in order, after its step; what a callback sets or triggers plays from the next step. It
returns its undo.

`save()` and `hash()` hold the graph's state too (`graph`: its id and content hash, each clip it names with its content
hash, the parameters, the triggers set and how long each has waited, each layer's state, entry and fade), so
`restore(save, clips, graph)` carries on exactly; it refuses a save without the graph it played (`E_GRAPH_MISSING`) or
with another (`E_GRAPH_CHANGED`), a clip the graph names edited since, playing or not (`E_CLIP_CHANGED`), and a graph
state the graph can't have (`E_SAVE`). The same graph, clips and calls give the same
states at the same steps and the same hashes in Node and Chromium (`npm run e2e`'s `animator-parity`).

## 3. The examples

`spec/graphs/` holds two, on Quaternius' clips:
- `Locomotion`: stands, walks, jogs and sprints by `speed` (a blend kept in step), jumps on `jump` (in the air when the
  jump's start ends) and lands when `grounded`, and throws a jab from the waist up on `punch` over whatever the legs do
  (a layer, passing between jabs). A press waits 0.2 s (a jump) or 0.3 s (a jab) to be used.
- `Sword_Combo`: three strikes, each pressed on (`attack`) within its cancel window, late in a strike or early in its
  recovery, else recovered to guard. A press waits 0.3 s to be used.

## 4. Errors

`graph.validateGraph(graph, { clips })` returns coded issues, each with where and a fix; `play` refuses a graph with any
(`E_GRAPH`, naming them), `set` and `trigger` an unknown parameter or a value of the wrong type (`E_PARAM`, naming the graph's own).

| Code | What it catches |
|---|---|
| `G-E001` | Not a graph: no format, id, start, states or transitions, or a name, desc or tags of the wrong kind |
| `G-E002` | A state that isn't exactly one of clip, recipe, blend or pass (a pass in the base), or a blend space out of order |
| `G-E003` | A name that isn't there (a transition's state, a layer's start, a blend's number parameter), or a transition that isn't one |
| `G-E004` | A condition that doesn't fit its parameter: an unknown one, or an op or value of the wrong kind |
| `G-E005` | A value out of range or of the wrong kind: a fade, exit or window, a speed (a one-shot's backward, with the clips), a weight, a flag |
| `G-E006` | A parameter of an unknown type, or a value (or a trigger's buffer) that isn't of it |
| `G-E007` | An unknown field (the nearest named) |
| `G-E008` | A state the layer's start never reaches |
| `G-E009` | A clip the host's clips don't have |
| `G-E010` | A layer named twice, layers that aren't a list, or a mask naming a body group or a field there isn't |
