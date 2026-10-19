# B1 · The lamplighter's rounds

A town-builder game needs its lamplighter to get about on foot between the street lamps. The project in this directory
has him (`character.glb`, a skinned humanoid in metres, facing +Z) and the m3a animation packages installed in
`node_modules/@m3a/`. Start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

The lamplighter is tall and long-limbed: 2.15 m from his soles to the top of his head, his hips 1.26 m above his soles.
He rests in an A-pose, his arms 40° below level. His rig was exported the Mixamo way: in the file his bones are
`mixamorig:Hips`, `mixamorig:Spine`, `mixamorig:Spine1`, `mixamorig:Neck` and `mixamorig:Head`, and on each side
`mixamorig:LeftShoulder`, `mixamorig:LeftArm`, `mixamorig:LeftForeArm`, `mixamorig:LeftHand`, `mixamorig:LeftUpLeg`,
`mixamorig:LeftLeg`, `mixamorig:LeftFoot` and `mixamorig:LeftToeBase` (and the `Right` ones), in centimetres under an
armature scaled 0.01. One spine bone is left out (there is no `mixamorig:Spine2`: the neck and shoulders sit on
`mixamorig:Spine1`), and there are no twist bones.

**The job:** have him idle, walk and run by the speed the game asks for.

1. Implement `createPlayer` in `src/player.ts` (its types are there). Each frame the game calls
   `player.update(dt, { speed })` with the ground speed it wants, in m/s, and reads `player.motion`:
   - `"idle"` when standing (speed 0), `"walk"` at walking speeds, `"run"` at running speeds. Speeds go with the
     character's size: for hips 1 m above the floor, walking is about 1 to 2 m/s and running about 2.5 m/s and up,
     and a character with lower hips is asked proportionally less (`speeds.json` lists what the game asks of this one;
     the lamplighter's hips are higher than 1 m, so he is asked proportionally more);
   - the character travels at the asked speed (move `character.position` along its facing);
   - its feet don't slide on the ground while they stand;
   - switching motions blends smoothly; nothing ever becomes NaN.
2. Write `src/sheet.ts` so `npm run sheet` writes `sheet.png`: a contact sheet of the motions you used.

`npm run check` drives your player with the grader's speeds (`speeds.json`: 0, 1.2, 3.5, 1.2 and 0 m/s for hips 1 m
high, two or three seconds each) and prints what it plays. You're done when it plays the right motion at each speed and the sheet is written.

**How it's graded** (headless, from the character's bones): after 0.75 s at each speed, at least 90% of frames report
the right motion; the character travels within 25% of the asked speed (when idle, under 0.15 m/s for hips 1 m high); the feet step when
it walks, and both leave the ground at times when it runs but never when it walks; while a foot stands, the m3a
sensors' slide and skate stay under their limits and, walking or running, the lower foot stands still at times; no
transform is ever NaN; `npm run sheet` writes a PNG. Work only in this directory.
