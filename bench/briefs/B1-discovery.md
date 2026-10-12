# Character locomotion

This is a small three.js game project. Its player character (`character.glb`, a skinned humanoid in metres, facing +Z)
stands still: it has no animations of its own. Look around the project and its installed dependencies, and use what
helps.

**The job:** make the character idle, walk and run by the speed the game asks for.

1. Implement `createPlayer` in `src/player.ts` (its types are there). Each frame the game calls
   `player.update(dt, { speed })` with the ground speed it wants, in m/s, and reads `player.motion`:
   - `"idle"` when standing (speed 0), `"walk"` at walking speeds, `"run"` at running speeds. Speeds go with the
     character's size: for hips 1 m above the floor, walking is about 1 to 2 m/s and running about 2.5 m/s and up,
     and a character with lower hips is asked proportionally less (`speeds.json` lists what the game asks of this one);
   - the character travels at the asked speed (move `character.position` along its facing);
   - its feet don't slide on the ground while they stand;
   - switching motions blends smoothly; nothing ever becomes NaN.
2. Write `src/sheet.ts` so `npm run sheet` writes `sheet.png`: a contact sheet (a grid of frames) of the motions.

`npm run check` drives your player with the grader's speeds and prints what it plays. Work only in this directory.
