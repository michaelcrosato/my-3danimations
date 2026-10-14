# B2 starter

- `character.glb`: the character (a skinned humanoid, glTF, metres, facing +Z).
- `src/character.ts`: loads it with three.js (given).
- `src/fighter.ts`: the attack to write (`createFighter`).
- `check.ts`: `npm run check` drives your fighter as the grader will and prints when damage came, and for each punch
  its strike and the frames damage may come on.
- `strike.ts`: how the grader (and the check) finds a punch's strike, from the hands' places forward of the hips.
- `node_modules/@m3a/*`: the animation packages; start with `node_modules/@m3a/tools/MANUAL.md`.
