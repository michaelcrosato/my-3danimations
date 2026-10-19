# B5 · Signal from the lighthouse

In a harbour game, when a ship comes in the lighthouse keeper signals to it from the gallery: both arms up and waving,
hopping on the spot. You're making that motion from the clips you have. The m3a packages are installed in
`node_modules/@m3a/`. Start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

The keeper (`character.glb`, the workspace's character, which the made clip is played on) is tall and athletic:
1.85 m tall, her hips 1.04 m above her soles. She rests in a relaxed pose, her arms hanging 70° below level. Her rig is
a Blender Rigify one: in the file her bones are `DEF-spine` (the hips), `DEF-spine.001`, `DEF-spine.004` (the neck),
`DEF-spine.005` and `DEF-spine.006` (the head), and on each side `DEF-shoulder.L`, `DEF-upper_arm.L`, `DEF-forearm.L`,
`DEF-hand.L`, `DEF-thigh.L`, `DEF-shin.L`, `DEF-foot.L` and `DEF-toe.L` (and the `.R` ones). Her chest bones are left
out (there is no `DEF-spine.002` or `DEF-spine.003`: the neck and shoulders sit on `DEF-spine.001`), and she has no
twist bones.

**The job:** write `emote.json`, an m3a recipe (the manual's "Make") that compiles, against the CC0 library, into a
**two-handed wave with a hop**:
- both hands raised above the head, waving side to side;
- a hop: the whole body leaves the ground once in each cycle;
- 1.5 s long, looping.

`npm run check` compiles your recipe and prints what the grader reads: the checks' issues, the clip's length and
loop, the sensors' verdict, its description (`describe`), and how the hands move.

**How it's graded** (headless, the recipe compiled against the CC0 library): the recipe checks and compiles into a
valid clip; it is 1.5 s (±0.05) and loops; the m3a sensors find nothing failing; its description reports it in the air;
both wrists are above the head for at least a quarter of the cycle, and each moves side to side at least 10% of the hip
height, changing direction at least twice; it plays on `character.glb`, every joint finite. Work only in this directory.
