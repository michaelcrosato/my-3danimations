# B6 · The southpaw's cross

A boxing game's sparring partner is a southpaw: his cross comes from the left. You're editing his punch. The m3a
packages are installed in `node_modules/@m3a/`. Start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

The sparring partner (`character.glb`, the character the grader plays the punch on: a skinned humanoid in metres,
facing +Z) is tall and lean: 2.14 m tall, his hips 1.23 m above his soles. He rests in a T-pose, his arms level. His
skeleton is named the Unreal Engine 5 way: a `root` bone at the origin, then `pelvis`, `spine_01` to `spine_05`,
`neck_01` and `head`, and on each side `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, `calf_l`,
`foot_l` and `ball_l` (and the `_r` ones). No bone is left out, and there are no twist bones.

**The job:** write `punch.json`, an m3a recipe (the manual's "Make") that compiles, against the CC0 library, into an
edit of the library's `MESH2MOTION/Punch_Cross` (a right cross):
- **30% faster**: the whole punch, and its strike, take the original's time over 1.3;
- **more anticipation**: before it strikes, the punching fist first draws back (the original has none: its fist goes
  straight out), by at least 4% of the hip height;
- **mirrored for the left hand**: the left fist strikes, as the right did.

`npm run check` compiles your recipe and prints what the grader reads: the checks' issues, the clip's length, its
strike (the measured fact) and which fist strikes, how far that fist draws back first, and the sensors' verdict.

**How it's graded** (headless, the recipe compiled against the CC0 library, the facts measured on its rest): the recipe
checks and compiles into a valid clip; it lasts the original's length over 1.3 (±3%) and strikes at the original's
strike time over 1.3 (±0.05 s); the left fist strikes; mirrored back, its striking fist at the strike is within 10% of
the hip height of the original's (against the pelvis); the fist draws back at least 4% of the hip height before it
strikes; the m3a sensors find nothing failing; it plays on `character.glb`, every joint finite. Work only in this
directory.
