# The m3a simulation, 2.0

**Status:** written in WP-6.5. **Schemas:** `spec/schemas/sim.schema.json` (a script), `spec/schemas/sim-trace.schema.json`
(a trace). **Runtime:** `@m3a/tools`' `sim` namespace (`simulate`, `validateScript`, `compareTraces`, `traceText`,
`filmstrip`); `npm run sim` (`m3a sim` once WP-7.1 lands). A simulation runs a graph (`GRAPH.md`) the way a game drives
it, from a script of the game's input, and says what happened: the states, the events and the hit windows at the steps
they came in, where the root went, and what the sensors read of the body. The same script, graph and clips give the
same trace on every run and, when the root follows the animation, on every body.

## 1. A script

```json
{
  "format": "2.0",
  "id": "SIMS/Walk_Run_Jump",
  "graph": "GRAPHS/Locomotion",
  "dur": 8.5,
  "input": [
    { "t": 0.5, "set": { "speed": 1.4 }, "over": 0.3 },
    { "t": 4.5, "trigger": "jump" },
    { "t": 4.6, "set": { "grounded": false } }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format`, `id`, `desc` | | `format`, `id` | As a graph's; `id` is `SET/Slug` (`SIMS/Name`) |
| `graph` | id | no | The graph it is written for: run with another, it is refused |
| `dur` | seconds | yes | How long it runs (at most 600) |
| `rate` | steps a second | no | The fixed step (60) |
| `root` | `"root"` \| `"in-place"` | no | How the character moves (§3): by the animation's root motion (default), or by the game |
| `warp` | parameter | no | In place, the number parameter set each step to match playback to the ground speed (§3) |
| `units` | `"m"` \| `"H0"` | no | What `move` is in: metres a second (default), or the character's hip heights a second |
| `film` | count | no | Frames in the filmstrip (8; 0: none) |
| `input` | rows | yes | In time order: at `t` (s), `set` parameters by name, `trigger` one or several, `move` (the ground speed forward from then on); `over` (s) eases the row's numbers there linearly, as a game eases its speed |

A row applies before the first step that starts at or after its `t`. A script's checks (`sim.validateScript(script,
graph)`) give coded issues, each with where and a fix:

| Code | What it catches |
|---|---|
| `S-E001` | Not a script: no format, id, dur or input, or one of the wrong kind |
| `S-E002` | An input row out of time order, past the script's end, or doing nothing |
| `S-E003` | A parameter or trigger the graph doesn't have, or a value not of its type |
| `S-E004` | A value out of range: dur, rate, film, a ground speed, a ramp's seconds |
| `S-E005` | Stride warping without a number parameter a state's `rate` reads, or not in place |
| `S-E006` | An unknown field |
| `S-E007` | A script written for another graph |

## 2. What a run gives

`sim.simulate({ graph, script, body, clips })` steps the Animator (the body from core's `bind`, the clips `playable`)
one fixed step at a time and returns:
- **the trace**: each state a graph layer entered (`step`, `t`, `layer`, `state`, `from`; the start states at step 0,
  from `null`), each event (`name`, the graph layer and state it came from, the clip, the clip time `at`), and each
  **hit window**: open from the step a `hit` event passes to the step it closes, after the event's own `dur` (clip
  seconds, so sooner when the state plays faster), at the clip's `hit_end` after it, or after its one step, and sooner
  if its state's layer goes;
- **where the root went** every 0.25 s (forward and right mm, heading degrees, in the world), and stride warping's rate;
- **the body's points** every step, and **the sensors' read** of the whole run in the world (`checks.measure`: a
  verdict, the slide and skate, the findings with their times);
- **warnings**: a clip played with a measured strike (`facts.strike`) and no `hit` event, so no window opens.

`sim.compareTraces(expected, actual)` names the first difference (a field, then the states, events and hits in order)
or gives null; `sim.traceText` writes a trace one state, event or hit to a line, as `spec/sims/*.trace.json` keep them.
`sim.filmstrip(run, n)` draws `n` frames spread over the run at one scale, the camera following the character, each
labelled with its time and the states playing.

`npm run sim -- <graph> --input <script> [--rig tiny|gen-<seed>|<rig id>] [--expect <trace>] [--write <trace>]` reads
a graph and a script by path or by id (`spec/graphs`, `spec/sims`), plays the library's clips (and `RECIPES/` ones
compiled) on the rig (gen-0 by default), and writes `trace.json`, `result.json` and `film.png` under
`check-output/sim/<script>/`; `--expect` fails on a trace that differs, `--write` saves one.

## 3. The root, and stride warping

With `"root": "root"` the character goes where the layers' root motion takes it: the graph's clips decide its speed,
and planted feet stay planted. A game that moves the character itself (a character controller at the speed the player
asks) uses `"in-place"`: the world root is where `move` takes it, and the animation's own root motion is dropped. The
feet then slide wherever the clips' speed isn't the ground's. **Stride warping** matches them: each step, the root's
speed as the layers mix it (each clip's own speed on this body, at its layer's speed, by its share of the root) is
compared with the ground's, and the parameter `warp` names is scaled so they meet (0.25× to 4×; 1 while nothing that
plays travels). A state reads it through its `rate` (`GRAPH.md` §1), so only the states that step are warped. From
0.5× to 1.8× a walk's own speed, warped, its feet slide under the sensors' warn level; unwarped, at 0.75× and 1.5×
they slide past it (`npm test -- sim`).

## 4. The examples

`spec/sims/` holds two scripts for `GRAPHS/Locomotion`:
- `Walk_Run_Jump`: from standing through a walk, a jog and a sprint (eased), a jump, the air, a landing on the run, a
  jab over it, and standing again; its expected trace is `Walk_Run_Jump.trace.json`, the same on the tiny rig and on
  any body;
- `Walk_In_Place`: moved by the game at 1 m/s, then 3, then stopping, stride warped.
