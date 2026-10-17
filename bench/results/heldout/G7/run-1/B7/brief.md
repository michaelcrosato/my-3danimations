# B7 (held-out) · Log yard

In *Timber Run* you play a lumberjack crossing a log yard: standing among the stacks, walking, running, jumping the
gaps between piles, and now and then stepping off the top of one. You're wiring that locomotion as an m3a graph. The
lumberjack is `character.glb` in this directory: a bulky body, broad across the shoulders (about 0.59 m) and thick in
the limbs, about 1.88 m tall with the hips about 1.05 m up, at rest in an A-pose with the arms some 40° down. The bones
have Mixamo names (`mixamorig:Hips`, `mixamorig:Spine`, `mixamorig:Spine1`, `mixamorig:LeftForeArm` and so on), in
centimetres under the armature's 0.01 scale as Mixamo rigs are, with no upper-chest bone (no `mixamorig:Spine2`) and
no twist bones. It is a skinned humanoid in metres overall, facing +Z. The m3a packages are installed in
`node_modules/@m3a/`; read the manual first: `node_modules/@m3a/tools/MANUAL.md`.

**Your part:** `graph.json`, a graph (the manual's "Graphs") that the game drives through three parameters:
- `speed` (number): the ground speed asked, in the character's hip heights a second: 0 to stand, about 1.2 to walk,
  about 3.5 to run;
- `grounded` (bool): whether he is on the ground (true at the start);
- `jump` (trigger): the jump button.

Its base layer has the states `idle`, `walk`, `run`, `jump` and `land` (more are fine, a state for being in the air
for one), playing clips from the CC0 library:
- `idle`, `walk` or `run` as the speed asks, switching between them smoothly;
- `jump` when the button is pressed while he is grounded; a press while he isn't is dropped, not held for later;
- `land` as soon as `grounded` comes back during the jump or in the air, then whatever the speed asks.

The game sets `grounded` false a moment after a jump press (0.1 s, as the feet leave the ground), so a jump lands when
`grounded` comes back, not while it is still true from before the jump. `grounded` can also go false with no jump at
all, when he steps off a pile: the graph may carry on as it is, or fall (a state in the air) and land once `grounded`
comes back.

**Trying it:** the `graph.json` you start from checks, but it only ever stands. `npm run check` simulates your graph on
this character with the grader's script (`script.json`: standing, walking, running, a jump with a second press in the
air, landing into the run, walking, standing, then a step off something and a press while not grounded) and prints the
states it goes through.

**Pass conditions** (headless; the m3a simulation of your graph on this character, its root following the animation):
- the graph checks with the library's clips;
- 0.2 s before each change of speed and before the jump, and at the end, it plays the motion asked;
- each motion travels as it should while the speed holds, in hip heights a second: idle under 0.3 (0.5 to 1.3 s and 13
  to 13.8 s), walk 0.6 to 2 (2.5 to 3.3 s and 9 to 9.8 s), run over 2 (4.5 to 5.3 s and, after the landing, 8.1 to
  8.6 s);
- the base layer's states, in order and without repeats (states other than the five are ignored), are idle, walk, run,
  jump, land, run, walk, idle (then land, idle, if it fell when `grounded` went without a jump);
- `jump` comes within 0.1 s of the press made while grounded, and never from a press made while not grounded;
- both feet leave the ground (5% of the hip height) while it jumps;
- `land` comes within 0.1 s of `grounded` coming back;
- no joint is ever NaN.

Work only in this directory.
