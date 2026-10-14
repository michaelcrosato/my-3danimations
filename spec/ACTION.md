# The m3a action, 2.0

**Status:** written in WP-6.3. **Schema:** `spec/schemas/action.schema.json`. **Compiler:** `@m3a/core`'s
`actions.compileAction`. An action is one motion made of several beats (get up, vault, climb onto a ledge, hop down,
roll, land heavily) with what a game needs to drive it: the ground it ends on, its beats by name, and the moments it
may be cut into another clip. It is a recipe (`RECIPE.md`) with three more fields, and it compiles into an ordinary
format-2 clip plus a root curve. A paired action places and times two or more characters' recipes so their moments
meet.

## 1. An action

```json
{
  "format": "2.0",
  "id": "ACTIONS/Climb_Up",
  "desc": "Pulls up onto a ledge about a hip height up and steps onto it",
  "steps": [{ "op": "clip", "id": "MESH2MOTION/ClimbUp_1m_RM", "to": 0.6 }],
  "floor": 115,
  "beats": [{ "name": "pull", "from": 0, "to": 0.3 }, { "name": "step_on", "from": 0.3, "to": 0.6 }],
  "interrupts": [{ "t": 0.45, "to": ["PROCEDURAL/Walk", "PROCEDURAL/Breathe"], "why": "both feet on the ledge" }]
}
```

Every field a recipe has (`RECIPE.md` §1), and:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `floor` | number | no | The ground it ends on, % of the hip height above the ground it starts on: a climb +, a hop down −, 0 by default; −500 to 500 |
| `beats` | object[] | yes | Its named stretches in order, each `{ name, from, to }` in seconds: a lower-case word, from 0 or later, each starting where or after the one before ends |
| `interrupts` | object[] | yes | The moments it may be cut, in time order, each `{ t, to, why }`: the time, the clips it may go on into (`SET/Slug`: a library clip, a procedural part, another action) and why there |

A step may read `PROCEDURAL/<Name>`: the gait, idle or move of that name (`@m3a/core`'s `procedural`: `Walk`, `Brisk`,
`Run`, `Limp`, `Breathe`, `Fidget`, and the moves of `library/moves.json` when the compiler is given them), made on
the rest of the action's first library clip, from its standing pose. An action reads at least one library clip.

## 2. Compiling

`compileAction(action, resolve)` checks the action (§5), compiles its recipe (`RECIPE.md` §3) with the procedural
parts added to `resolve`, and adds an event at each beat's start, named by the beat, and one named `interrupt` at each
interrupt point. Then it reads the ground: at each frame, the lowest point of either sole.
- On one ground (`floor` 0) the ground stays at the clip's floor.
- Climbing (`floor` > 0) the clip's floor is the lower ground. The ground rises to the ledge as the feet leave the floor
  for good: at each frame it is as high as the lowest the feet go from then on, at most `floor`.
- Dropping (`floor` < 0) the clip's floor is the lower ground too, and the action starts `−floor` above it. The ground
  falls from the ledge as the feet do: at each frame as high as the lowest they have been so far.

The feet must stand on the grounds the floor gives, within 6% of the hip height, or the compiler refuses the action
(`A-E006`, with the floor the feet show): at the end, the lowest they come within 0.3 s of it; at the start, the lowest
within 0.3 s of it (a run or a landing may start in the air), but a drop's first frame, which stands on the ledge.

`actionRootAt(compiled, t)` is the root curve a game moves its character along: the clip's travel and turn at `t`
(`MOTION.md` §5.3) and `up`, the ground's height above where the action started, % of the hip height. A host plays the
clip as it plays any clip and raises the character by `up`; at the end the character stands on the ledge, or below it.

## 3. Interrupts

`interruptInto(compiled, point, target)` cuts the action at an interrupt point and goes on into `target`: a compiled
recipe of the action until then and the target crossfaded in (0.3 s by default), in step on the feet (`sync:
"contacts"`). The target is raised to the ground the action stands on there (a pose step's `hips.up`) and turned to
face the way the action faces then (its pelvis turn less the root's), so a get-up that ends turned from its root walks
on the way it faces. Its id is the action's with `_To_` and the target's slug. Any clip the resolver knows can be the
target; the action's own `to` lists say which it was made for. With `play`, only that many seconds of the target play
after the action (all of it, a loop's whole cycle, by default): a preview of the cut.

## 4. Paired actions

```json
{
  "format": "2.0",
  "id": "ACTIONS/Jab_And_Flinch",
  "desc": "One throws a jab to the head; the other, facing them, flinches as it lands",
  "sync": "hit",
  "roles": {
    "attacker": { "steps": [{ "op": "clip", "id": "QUATERNIUS_SHARDFALL/Punch_Jab" }] },
    "victim": { "steps": [{ "op": "clip", "id": "QUATERNIUS_SHARDFALL/Hit_Head" }], "place": [105, 0, 180] }
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format`, `id`, `name`, `tags`, `desc` | | `format`, `id`, `desc` | As an action's |
| `sync` | string | yes | The event every role carries (its own, or added with an `events` step) |
| `roles` | object | yes | Two or more, by a lower-case name, each `{ steps, place }`: a recipe's steps, and where it stands at the start in the first role's frame, `[forward, right, turn]` (% of the hip height, and degrees + toward the right) |

`compilePaired(pair, resolve)` compiles each role (its id the pair's with the role's name) and starts each so its
`sync` event falls at the same moment; `pairAt(compiled, t)` gives each role's own clip time and its root in the first
role's frame. Each role plays on its own character, whatever its skeleton.

## 5. Errors

`validateAction` returns the recipe's coded issues (`RECIPE.md` §4) and its own, each with where and a fix:

| Code | What it catches |
|---|---|
| `A-E001` | Not an action: no beats or interrupts, or a paired action without two roles (or its `sync` or `desc`) |
| `A-E002` | A beat with no name, or out of order: each starts where or after the last one ends, and ends after it starts |
| `A-E003` | An interrupt without a time, a clip to go into or a reason, or out of order |
| `A-E004` | An action that reads no library clip: it needs one to set its body |
| `A-E005` | A time outside the action once compiled (a beat's end), or a role with no `sync` event |
| `A-E006` | The ground the feet stand on doesn't match the floor given |
| `A-E007` | An unknown field in a paired action or a role |

`validatePaired` checks a paired action the same way. `spec/schemas/action.schema.json` gives both shapes (an action is
a recipe's, from `recipe.schema.json`, and its own fields; a paired action has `roles`); the validator also checks what
a schema can't: beats and interrupts in order, a library clip read.

## 6. The library's actions

`library/actions/` holds six actions and one paired action, each made from clips the library has. Each, and each role
of the pair, plays on every test character with the sensors' verdict no worse than on its own body and none failing;
each interrupt point goes on into every clip it names, a clip the sensors don't fail, from a moment a foot (both, where
its reason says so) stands on the ground (`npm test -- actions`).

| Action | Made from | Floor | Interrupts into |
|---|---|---|---|
| `Get_Up` | CMU's get-up from lying face down | 0 | breathing, walking, standing |
| `Climb_Up` | Mesh2Motion's 1 m climb | +115 | walking, breathing: a foot on the ledge, the other stepping up |
| `Vault` | CMU's run and jump over, smoothed | 0 | running, walking, landed |
| `Hop_Down` | CMU's jump off a ledge, from its step off | −72 | breathing, landed; breathing, walking, steadied |
| `Roll` | Mesh2Motion's dive roll, smoothed | 0 | running, walking, back on its feet |
| `Heavy_Landing` | Mesh2Motion's landing, slowed | 0 | the roll, as it lands; breathing, walking, risen |
| `Jab_And_Flinch` | Quaternius' jab and head hit | paired | met at the jab's `hit` |
