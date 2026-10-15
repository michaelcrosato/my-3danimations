# B5 (held-out) · Summit cheer

*Cairn Climbers* is a co-op mountaineering game, and when a team tops a peak its mascot climber celebrates. You're
building that celebration from clips that already exist. The climber the grader plays it on is `character.glb`: a
chibi, an oversized head on a short body, at rest in a T-pose, arms straight out. The m3a packages are installed in
`node_modules/@m3a/`; read their manual first: `node_modules/@m3a/tools/MANUAL.md`.

**What to write:** `emote.json`, an m3a recipe (see "Make" in the manual) that compiles, against the CC0 library, into
a **two-handed wave with a hop**, 1.5 s long and looping: both hands above the head, waving from side to side, while
once each cycle the whole body hops clear of the ground.

**Trying it:** `npm run check` compiles your recipe and prints what the grader reads: the checks' issues, the clip's
length and whether it loops, the sensors' verdict, its description from `describe`, and how the hands move.

**What passes** (headless; the recipe compiled against the CC0 library and measured on the clip's own rest):
- the recipe checks and compiles into a valid clip, 1.5 s (±0.05) long and looping;
- the m3a sensors find nothing failing, and its description says it is in the air;
- both wrists are above the head for at least a quarter of the cycle, and each travels side to side at least 10% of
  the hip height, turning back at least twice;
- played on `character.glb`, every joint stays finite.

Work only in this directory.
