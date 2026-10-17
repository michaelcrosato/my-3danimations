# B5 (held-out) · Regatta cheer

In *Harbour Regatta*, a sailing game, the crew waiting on the dock celebrate every boat that crosses the finishing
line. You're making that celebration out of clips that already exist. The grader plays it on `character.glb`, one of
the crew: an athletic, heroic build about 1.87 m tall with the hips about 1.05 m up, at rest in an A-pose with the arms
angled some 40° down. Its skeleton is a Blender Rigify deform rig (`DEF-spine` up to `DEF-spine.006`, `DEF-upper_arm.L`,
`DEF-shin.R` and so on) with no upper-chest bone (there is no `DEF-spine.003`: the neck and arms hang from
`DEF-spine.002`) and no twist bones. The m3a packages are installed in `node_modules/@m3a/`; start with their manual,
`node_modules/@m3a/tools/MANUAL.md`.

**Your part:** `emote.json`, an m3a recipe (the manual's "Make") that compiles, against the CC0 library, into a
**two-handed wave with a hop**: both hands up above the head, waving from side to side, and once in every cycle a hop
in which the whole body leaves the ground. It lasts 1.5 s and loops.

**Trying it:** `npm run check` compiles your recipe and prints what the grader reads: the checks' issues, the clip's
length and whether it loops, the sensors' verdict, its description (`describe`) and how the hands move.

**Pass conditions** (headless; the recipe compiled against the CC0 library):
- the recipe checks and compiles into a valid clip;
- it is 1.5 s long (±0.05) and loops;
- the m3a sensors find nothing failing, and its description reports it in the air;
- both wrists are above the head for at least a quarter of the cycle, and each moves side to side by at least 10% of
  the hip height, changing direction at least twice;
- it plays on `character.glb` with every joint finite.

Work only in this directory.
