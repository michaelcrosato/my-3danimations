# B6 (held-out) · Pocket champion's left

*Tiny Titans* is a mobile boxing game with chibi fighters, and its newest fighter leads with the left. Give it a punch
by reworking the library's `MESH2MOTION/Punch_Cross`, a right cross. The grader plays your result on `character.glb`:
a chibi with an oversized head, about a third of its 1.05 m, on a short, stubby body, the hips about 0.43 m up, at
rest in a T-pose with the arms straight out. Its bones have Unreal Engine 5 mannequin names under a `root` bone
(`pelvis`, `spine_01` to `spine_05`, `neck_01`, `head`, `upperarm_l`, `calf_r` and so on), with twist bones as leaves
(`upperarm_twist_01_l`, `lowerarm_twist_01_l`, `thigh_twist_01_l` and the right side's), every optional bone present.
It is a skinned humanoid in metres, facing +Z. The m3a packages are installed in `node_modules/@m3a/`; their manual,
`node_modules/@m3a/tools/MANUAL.md`, is the place to start.

**Your part:** `punch.json`, an m3a recipe (the manual's "Make") that compiles, against the CC0 library, into that cross
changed three ways:
- **30% faster:** the whole punch, its strike included, takes the original's time divided by 1.3;
- **more anticipation:** before it strikes, the punching fist first pulls back, by at least 4% of the hip height (the
  original has none: its fist heads straight out);
- **mirrored to the left hand:** the left fist strikes, as the right one does in the original.

**Trying it:** `npm run check` compiles your recipe and prints what the grader reads, next to the original's: the
checks' issues, the clip's length, its strike (the measured fact) and which fist throws it, how far that fist pulls back
first, and the sensors' verdict.

**Pass conditions** (headless; the recipe compiled against the CC0 library, its facts measured on its rest):
- the recipe checks and compiles into a valid clip;
- it lasts the original's length over 1.3 (±3%), and strikes at the original's strike time over 1.3 (±0.05 s);
- it is the left fist that strikes;
- mirrored back, its striking fist at the strike is within 10% of the hip height of the original's (against the
  pelvis);
- before the strike, the fist pulls back at least 4% of the hip height;
- the m3a sensors find nothing failing;
- it plays on `character.glb` with every joint finite.

Work only in this directory.
