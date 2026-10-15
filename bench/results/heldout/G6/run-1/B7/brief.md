# B7 (held-out) · Boardwalk lamplighter

In *Stilt Town* the lamplighter makes the rounds of the boardwalks between houses on stilts: strolling, sprinting,
hopping gaps and now and then stepping off an edge. You're wiring that locomotion as an m3a graph. The lamplighter is
`character.glb` in this directory: a tall, thin figure, over 2 m tall with the hips about 1.2 m up, standing at rest
with the arms hanging close to its sides (a skinned humanoid, in metres, facing +Z). The m3a packages are installed in
`node_modules/@m3a/`; read their manual first: `node_modules/@m3a/tools/MANUAL.md`.

**What to write:** `graph.json`, a graph (the manual's "Graphs") that the game steers through three parameters:
- `speed` (number): how fast the game wants the character to cover the ground, in its own hip heights a second: 0 to
  stand, about 1.2 to walk, about 3.5 to run;
- `grounded` (bool): whether its feet are on the boards; true at the start;
- `jump` (trigger): the jump button.

The base layer needs the states `idle`, `walk`, `run`, `jump` and `land`, playing clips from the CC0 library; more
states are allowed (one for being in the air, say).
- The speed asked picks `idle`, `walk` or `run`, and the changes between them are smooth.
- A jump press starts `jump` only while the character is grounded; a press while it isn't is dropped, not saved for
  later.
- When `grounded` returns during `jump` or while in the air, `land` starts at once, followed by the motion the speed
  asks.

A moment after a jump press (0.1 s, as the feet leave the boards) the game sets `grounded` false, so a jump lands when
`grounded` comes back, not on the true left over from before the jump. `grounded` can also go false with no jump at
all, when the lamplighter steps off an edge: the graph may carry on as it is, or fall (a state in the air) and land
once `grounded` returns.

**Trying it:** the `graph.json` you're given checks, but only ever stands. `npm run check` simulates your graph on this
character with the grader's own script (`script.json`: standing, walking, running, a jump with a second press in
mid-air, landing into the run, walking, standing, then a step off an edge and a press while not grounded) and prints
the states it passes through.

**What passes** (headless; the m3a simulation of your graph on this character, its root following the animation):
- the graph checks with the library's clips;
- the base layer plays the motion asked 0.2 s before each change of speed and before the jump, and at the end: idle at
  1.3 s, walk at 3.3 s, run at 5.3 s and 8.3 s, walk at 9.8 s, idle at 13.8 s;
- each motion travels as it should while the speed holds, in hip heights a second: idle under 0.3 (0.5 to 1.3 s and 13
  to 13.8 s), walk 0.6 to 2 (2.5 to 3.3 s and 9 to 9.8 s), run over 2 (4.5 to 5.3 s and, after the landing, 8.1 to
  8.6 s);
- the base layer's states, in order and without repeats (any state but the five is ignored), are idle, walk, run,
  jump, land, run, walk, idle, then land, idle if it fell when `grounded` went with no jump;
- `jump` starts within 0.1 s of the press made while grounded, and never from a press made while not grounded;
- both feet leave the ground (5% of the hip height) while it jumps;
- `land` starts within 0.1 s of `grounded` coming back;
- no joint is ever NaN.

Work only in this directory.
