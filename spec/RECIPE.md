# The m3a recipe, 2.0

**Status:** written in WP-6.1. **Schema:** `spec/schemas/recipe.schema.json`. **Compiler:** `@m3a/core`'s
`recipe.compile`. A recipe is how a clip is made from clips: a short JSON list of steps, each one operation on clips the
library has or on steps before it. It is text, like a clip (`MOTION.md`): an agent writes it, a person reads it, and the
compiler turns it into an ordinary format-2 clip that names the recipe and its inputs in its provenance.

## 1. A recipe

```json
{
  "format": "2.0",
  "id": "RECIPES/Proud_Walk_Lean",
  "name": "Proud walk, leaning back",
  "tags": ["walk", "loop"],
  "desc": "A proud walk, leaning back a little more",
  "steps": [
    { "as": "walk", "op": "clip", "id": "STYLE100/Proud_Walk" },
    { "op": "pose", "in": "walk", "chest": { "lean": -10 }, "from": 0.2, "to": 0.5, "fade": 0.1 }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format` | string | yes | `"2.0"` |
| `id` | string | yes | The compiled clip's id, `SET/Slug` (`MOTION.md` §11) |
| `name`, `tags`, `desc` | | no | The compiled clip's, as in `MOTION.md` §4 (by default the result's first clip's) |
| `fps` | number | no | The rate the compiler samples the result at before it fits keys (30 by default, 1 to 120) |
| `steps` | object[] | yes | The operations, at least one; the last one's result is the clip |

Each step has an `op`, the operation's own fields, and may name itself with `as` (a word: letters, digits and `_`).
A step reads earlier steps by name (`in`, `a`, `b`, `base`, `over`, `items`); a step without `as` can still be read as
`s1`, `s2`, … by its place (from 1). Reading a later step, a missing one or a name twice is an error.

Every result is a **track**: a duration, loop or once, frames every 1/`fps` s (a once track's last at its end), each a
pose and the root's travel and turn from the start, with events and contacts. Times are seconds within the step's own
track. Poses are read on one rest body, the first clip's: a clip from another source is read on it too, its angles as
they are, so proportions that differ (a longer stride on shorter legs) can leave a foot off or into the floor, which
the sensors then report. Between frames a track blends the two either side, as a clip in-betweens its keys; each angle
is kept at the whole turn nearest the frame before, so a track never jumps a turn that means nothing.

## 2. Operations

| `op` | Fields | Result |
|---|---|---|
| `clip` | `id`; `from`, `to` (s); `loop` (true, or the seconds to blend its seam over) | A library clip by id, sliced to `from`–`to`, closed into a loop |
| `sequence` | `items` (names); `fade` (s, 0.2 by default); `sync` (`"contacts"`) | The items one after another, each crossfading into the next over `fade`; with `sync`, each next item starts where its first plant of the foot the last one planted last falls |
| `blend` | `a`, `b`; `w` (0 to 1, or `[[t, w], …]`); `warp` (true by default) | `a` blended toward `b`, each read at the same phase of its own time (two loops by their contacts), lasting between their durations by `w`. Two loops in step blend the pelvis, legs and feet as points (a foot both plant stays down) and the rest as numbers |
| `layer` | `base`, `over`; `mask` (group names or `{field: weight}`); `feather`; `weight` (1 by default); `additive` | `over` laid on `base` in the masked fields, over the base's length: two loops loop, the over stretched to the base's cycle; otherwise the over plays once from the start and holds its end. Additive: `over`'s change from its first pose added on `base` |
| `mirror` | `in` | Left and right swapped |
| `retime` | `in`; one of `speed`, `dur`, `ease` (`"in"`, `"out"`, `"inOut"`) | Faster or slower, to a duration, or through an ease |
| `pose` | `in`; a field and its parts in degrees or the field's units (`{"chest": {"lean": 10}}`); `from`, `to`; `fade` (s) | The parts moved by that much from `from` to `to`, faded in and out over `fade` |
| `look` | `in`; `at` (`[forward, right, up]` mm from the root); `from`, `to`; `fade`; `weight` | The head turned to look at the point, within what a neck does (80° to a side, 60° up or down from the chest) |
| `pin` | `in`; `end` (`handL`, `handR`, `footL`, `footR`); `path` (`[[t, f, r, z], …]` mm from the root); `fade` | That end held on the path (two-bone IK; the elbow or knee keeps its side) |
| `exaggerate` | `in`; `amount` (1.25 is a quarter more); `mask` | Every pose further from the track's mean pose |
| `smooth` | `in`; `window` (s); `mask` | Each number averaged over the window (a Gaussian), the ends held |
| `overshoot` | `in`; `amount` (0 to 1); `mask` | Where a part stops it carries on a little and settles back, like a spring |
| `stiffen` | `in`; `amount` (0 to 1); `mask` (`upper` by default) | The masked parts move less, about their mean, and smoother |
| `events` | `in`; `add` (`[{ "t": 0.4, "name": "hit" }, …]`) | Events added (`MOTION.md` §7.2) |
| `contacts` | `in`; `add` (`{ "footL": [[0.1, 0.4]] }`) | Labelled contacts added (`MOTION.md` §7.1) |

Numbers blend linearly and angles the short way round, except where a blend or a layer runs over time: there each
angle keeps the gap it had from the other track on the frame before, so the result doesn't flip half a turn where the
two tracks' angles come 180° apart (a foot pointing down, a hand rolled over).

Mask groups are core's (`ops.GROUPS`): `upper`, `lower`, `armL`, `armR`, `legs`, `head`, `spine`. A field's parts are
`MOTION.md` §5's names: `body`, `chest` and `head` turn, lean and tilt; an arm or leg points forward, out and up and
bends and twists; a foot points down, out and toes; a hand flexes, goes sideways and rolls; hips move forward, right
and up (% of the hip height).

## 3. Compiling

`compile(recipe, resolve)` checks the recipe (§4), reads each `clip` through `resolve(id)` (the library's clip, its
rest and its content id), runs the steps, samples the last track at `fps`, and fits keys to those frames the way an
import does (`MOTION.md` §6.4, 30 mm). The clip it returns:
- has the recipe's `id`, `name`, `tags` and `desc`, `loop` and `dur` from the last track, its events and contacts, and
  `restSrc` the first clip's;
- has `provenance.method` `composed` and `ai` `composite`, `src` and `orig` the first clip's source and id, `producer`
  `m3a-recipe` and the version, and `recipe`: `{ "sha256": …, "inputs": { "<id>": "<content id>", … } }`, the SHA-256
  of the recipe as canonical JSON (fields in order, no spaces) and each input clip's content id;
- has the license its inputs force (D10): CC0 when every input is, else each other license once, joined by ` AND `,
  with their credits;
- has `quality.fit` its keys' fit to the sampled frames and `qa` `unchecked` until the sensors read it.

The same recipe and the same inputs give the same clip, byte for byte, from the same compiler version. The 20 examples
in `spec/recipes/` compile into clips the sensors pass (`npm test -- recipe`).

## 4. Errors

`validate` returns coded issues, each with where and a fix, before anything runs: `R-E001` not a recipe (no `format`,
`id` or `steps`), `R-E002` an unknown `op` (the nearest named), `R-E003` a field the operation needs is missing, `R-E004`
a value out of range or of the wrong type, `R-E005` a step reads a name that isn't an earlier step, `R-E006` a name used
twice, `R-E007` an unknown field (the nearest named). Compiling adds `R-E008` a clip `resolve` doesn't know (the nearest
ids it offers) and `R-E009` a time outside its track.
