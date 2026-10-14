# B1 (held-out) · Platform dash

In *Last Train* the player steers a commuter across a station concourse, and how far the stick is pushed sets how
fast she should cover the ground: standing under the departures board, walking to her platform, running when the
doors begin to close. This directory holds her, `character.glb` (a young woman in a casual suit with a ponytail: a
skinned humanoid, in metres, facing +Z), with the m3a animation packages installed under `node_modules/@m3a/`. Read
their manual first: `node_modules/@m3a/tools/MANUAL.md`.

**Your task:** make the commuter stand, walk and run according to the speed the game asks of her.

1. Fill in `createPlayer` in `src/player.ts`; the types it must satisfy are already in that file. On every frame the
   game calls `player.update(dt, { speed })`, where `speed` is the ground speed it wants in m/s, and then reads
   `player.motion`:
   - it must read `"idle"` while she stands (speed 0), `"walk"` at walking speeds and `"run"` at running speeds.
     What counts as a walking or running speed depends on the character's size: with hips 1 m above the floor,
     walking is roughly 1 to 2 m/s and running roughly 2.5 m/s and faster, and a character whose hips sit lower is
     asked proportionally less (`speeds.json` lists the speeds the game asks of this one);
   - she really covers the ground at the speed asked (move `character.position` along the way she faces);
   - a foot that stands on the ground must not slide;
   - a change of motion blends in smoothly, and no value ever becomes NaN.
2. Write `src/sheet.ts` so that `npm run sheet` writes `sheet.png`, a contact sheet of the motions you used.

`npm run check` drives your player through the grader's speeds (`speeds.json`: 0, 1.2, 3.5, 1.2 and 0 m/s for hips
1 m high, two or three seconds each) and prints what it plays. You're finished when it plays the right motion at
every speed and the sheet has been written.

**How it's graded** (headless, from the character's bones): judged from 0.75 s after each speed begins, at least 90%
of frames report the right motion; she travels within 25% of the speed asked (when idle, under 0.15 m/s for hips 1 m
high); her feet take steps when she walks, and both are off the ground at times when she runs but never when she
walks; while a foot stands, the m3a sensors' slide and skate readings stay under their limits, and, walking or
running, the lower foot stands still at times; no transform is ever NaN; `npm run sheet` writes a PNG. Keep all your
work inside this directory.
