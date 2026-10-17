# B1 (held-out) · Smithy rounds

In *Cinderholt*, a village-life game, you play the village smith. He stands at his anvil, walks his errands across the
green, and breaks into a run when the forge bell rings, and the left stick tells the game how fast he should go. He is
`character.glb` in this directory: a bulky, barrel-chested man with thick limbs and shoulders about 0.56 m across, some
1.85 m tall with his hips about 1 m up, at rest in a T-pose with his arms straight out to the sides. His skeleton is a
Blender Rigify deform rig (`DEF-spine` up to `DEF-spine.006`, `DEF-upper_arm.L`, `DEF-thigh.R` and so on) with twist
bones inside the limb chains (`DEF-upper_arm.L.001`, `DEF-forearm.L.001`, `DEF-thigh.L.001` and the right side's) and
no shoulder bones: the upper arms hang straight off the chest. It is a skinned humanoid in metres, facing +Z. The m3a
animation packages are installed in `node_modules/@m3a/`; begin with their manual, `node_modules/@m3a/tools/MANUAL.md`.

**Your part:** the smith stands, walks or runs by the speed the game asks of him.

1. Write `createPlayer` in `src/player.ts`; the types it has to satisfy are already in the file. Every frame the game
   calls `player.update(dt, { speed })` with the ground speed it wants, in m/s, and then reads `player.motion`:
   - `"idle"` when asked to stand (speed 0), `"walk"` at walking speeds and `"run"` at running speeds. Which speeds
     those are depends on the body: with the hips 1 m off the floor, walking is about 1 to 2 m/s and running about
     2.5 m/s and over, and each speed is scaled by the hip height (`speeds.json` holds the ones the game asks of this
     character);
   - he really covers the ground at the speed asked: move `character.position` the way he faces;
   - a foot planted on the ground doesn't slide;
   - one motion blends into the next rather than snapping, and no value ever turns NaN.
2. Write `src/sheet.ts` so that `npm run sheet` writes `sheet.png`, a contact sheet of the motions you used.

**Trying it:** `npm run check` drives your player through the grader's speeds (`speeds.json`: 0, 1.2, 3.5, 1.2 and
0 m/s for hips 1 m up, each held two or three seconds) and prints what it plays. You're done when every speed plays the
right motion and the sheet has been written.

**Pass conditions** (checked headless, from the character's bones; each speed is judged from 0.75 s after it starts):
- at least 90% of the judged frames report the right motion;
- he travels within 25% of the speed asked, and under 0.15 m/s (for hips 1 m up) when asked to stand;
- walking, his feet take steps; running, both feet are off the ground at times; walking, never both at once;
- while a foot stands, the m3a sensors' slide and skate readings stay under their limits, and, walking or running, the
  lower foot is standing still at times;
- no transform is ever NaN;
- `npm run sheet` writes a PNG.

Work only in this directory.
