# B1 (held-out) · Courier gait

In *Dockside Courier* the player carries parcels along a harbour quay, and the analog stick sets how fast the courier
should cover the ground. Whatever the stick says, the courier has to look right: standing, walking or running. This
directory holds the courier, `character.glb` (a skinned humanoid, in metres, facing +Z), with the m3a animation
packages installed under `node_modules/@m3a/`. Read their manual, `node_modules/@m3a/tools/MANUAL.md`, before anything
else.

**What passes.** A grader with no screen plays the speeds 0, 1.2, 3.5, 1.2 and 0 m/s, two or three seconds each, and
reads the courier's bones. Each speed is judged from 0.75 s after it begins. The work passes when:

- `player.motion` names the right motion in at least 90% of the judged frames;
- the courier's ground speed is within 25% of the speed asked, and below 0.15 m/s when it is asked to stand;
- walking, its feet take steps and are never both off the ground at once; running, there are moments when both are;
- whenever a foot is planted, the slide and skate readings of the m3a sensors stay under their limits, and while
  walking or running the lower foot is, at times, standing still;
- no transform ever turns NaN or infinite;
- `npm run sheet` writes a PNG.

**What to build.**

- `src/player.ts` needs `createPlayer`; the types it must meet are already in the file. Once per frame the game calls
  `player.update(dt, { speed })`, passing the ground speed it wants in m/s, and then reads `player.motion`. That reads
  `"run"` from about 2.5 m/s upward, `"walk"` at walking speeds of roughly 1 to 2 m/s, and `"idle"` when the speed is
  0. The courier really moves at the speed asked: carry `character.position` forward the way it faces. A planted foot
  must not slide over the ground, a change of motion must blend in rather than snap, and no value may ever become NaN.
- `src/sheet.ts` must make `npm run sheet` write `sheet.png`, a contact sheet of the motions the courier uses.

**While you work**, `npm run check` drives your player through the grader's speed sequence and prints what it plays.
You're finished when it plays the right motion at every speed and `sheet.png` has been written.

Keep every change inside this directory.
