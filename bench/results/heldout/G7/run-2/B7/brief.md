# B7 · The smith on the rooftops

In a rooftop platformer, a burly blacksmith crosses the town over its roofs. You're wiring his locomotion as an m3a
graph. The project in this directory has him (`character.glb`, a skinned humanoid in metres, facing +Z) and the m3a
packages installed in `node_modules/@m3a/`. Start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

The smith is bulky: 1.94 m tall, his hips 1.10 m above his soles. He rests in a T-pose, his arms level. His bones carry
VRM 1.0's humanoid names: `hips`, `spine`, `chest`, `upperChest`, `neck` and `head`, and on each side `leftShoulder`,
`leftUpperArm`, `leftLowerArm`, `leftHand`, `leftUpperLeg`, `leftLowerLeg`, `leftFoot` and `leftToes` (and the
`right` ones). No bone is left out, and there are no twist bones.

**The job:** write `graph.json`, a graph (the manual's "Graphs") that the game drives with three parameters:
- `speed` (number): the ground speed the game asks, in the character's hip heights a second: 0 standing, about 1.2
  walking, about 3.5 running;
- `grounded` (bool): whether the character stands on the ground (true at the start);
- `jump` (trigger): the jump button.

Its base layer has the states `idle`, `walk`, `run`, `jump` and `land` (you may add others, such as one in the air),
playing clips from the CC0 library:
- `idle`, `walk` or `run` by the speed asked, switching smoothly;
- `jump` when the jump button is pressed and the character is grounded; a press while it isn't grounded is ignored
  (not kept for later);
- `land` as soon as `grounded` comes back while jumping or in the air, then the motion the speed asks.

The game sets `grounded` false a moment after a jump is pressed (0.1 s, as the feet leave the ground), so a jump lands
when `grounded` comes back, not while it is still true from before. `grounded` can also go false without a jump (the
character steps off something): the graph may stay as it is or fall (a state in the air) and land when it comes back.

`npm run check` simulates your graph on this character with the grader's script (`script.json`: standing, walking,
running, a jump with a second press in the air, landing on the run, walking, standing, a step off something and a press
while not grounded) and prints the states it went through. The given `graph.json` is a start: it checks, and only
stands.

**How it's graded** (headless, the m3a simulation of your graph on this character, its root following the animation):
the graph checks with the library's clips; 0.2 s before each change of speed and before the jump, and at the end, it
plays the motion asked; each travels as it should where the speed holds (idle under 0.3 hip heights a second from 0.5 to
1.3 s and 13 to 13.8 s, walk 0.6 to 2 from 2.5 to 3.3 s and 9 to 9.8 s, run over 2 from 4.5 to 5.3 s and, after the
landing, 8.1 to 8.6 s); the base layer's states, in order and without repeats (states other than the five ignored), are
idle, walk, run, jump, land, run, walk, idle (then land, idle, if it fell when `grounded` went without a jump); `jump`
comes within 0.1 s of the grounded press, and never from a press while not grounded; both feet leave the ground (5% of
the hip height) while it jumps; `land` comes within 0.1 s of `grounded` coming back; no joint is ever NaN. Work only in
this directory.
