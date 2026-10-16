# B6 (held-out) · Southpaw cross

In *Ironclad Arena*, a boxing game, the new southpaw contender needs a punch of its own: you'll rework the library's
`MESH2MOTION/Punch_Cross`, a right cross. The contender the grader plays it on is `character.glb` (a skinned humanoid,
in metres, facing +Z): a heroic, athletic build, standing at rest in an A-pose with the arms angled down. The m3a
packages are installed in `node_modules/@m3a/`; start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

**What to write:** `punch.json`, an m3a recipe (the manual's "Make") that compiles, against the CC0 library, into that
cross changed three ways:
- **30% quicker**: the whole punch, its strike included, runs in the original's time divided by 1.3;
- **a wind-up**: before the strike, the punching fist first pulls back, by at least 4% of the hip height (the original
  has none: its fist travels straight out);
- **thrown with the left**: mirrored, so the left fist strikes as the right one does in the original.

**Trying it:** `npm run check` compiles your recipe and prints what the grader reads, beside the original's: the
checks' issues, the clip's length, its strike (the measured fact) and which fist throws it, how far that fist pulls
back first, and the sensors' verdict.

**What passes** (headless; the recipe compiled against the CC0 library, the facts measured on its rest):
- the recipe checks and compiles into a valid clip;
- it lasts the original's length over 1.3 (±3%), and strikes at the original's strike time over 1.3 (±0.05 s);
- the left fist is the one that strikes;
- mirrored back, its striking fist at the strike is within 10% of the hip height of the original's (against the
  pelvis);
- before the strike, the fist pulls back at least 4% of the hip height;
- the m3a sensors find nothing failing;
- played on `character.glb`, every joint stays finite.

Work only in this directory.
