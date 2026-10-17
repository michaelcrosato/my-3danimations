# B3 (held-out) · Snowball crossing

In *Frostbite Fair*, a winter-festival game, the postman you play walks his round across the town square in the middle
of a snowball fight. A snowball that grazes him makes him flinch without breaking stride; a big one bowls him over, and
he lies there a moment before getting up and walking on. The postman is `character.glb` in this directory: a tall,
thin figure about 2.15 m tall with the hips about 1.25 m up, at rest with his arms hanging close to his sides, some 70°
down from level. His bones have Mixamo names (`mixamorig:Hips`, `mixamorig:Spine`, `mixamorig:LeftArm`,
`mixamorig:RightUpLeg` and so on), with Mixamo's habit of centimetre offsets under the armature's 0.01 scale; roll
(twist) bones hang as leaves off the upper arms, forearms and thighs (`mixamorig:LeftArmRoll`,
`mixamorig:LeftForeArmRoll`, `mixamorig:LeftUpLegRoll` and the right side's); and there are no chest bones, the spine
running from `mixamorig:Spine` straight to the neck. It is a skinned humanoid in metres overall, facing +Z. The m3a
packages are installed under `node_modules/@m3a/`; their manual, `node_modules/@m3a/tools/MANUAL.md`, is where to begin.

**Your part:** `createReactor` in `src/reactor.ts`, with its types already in the file. Each frame, 60 a second, the
game calls `reactor.update(dt, { speed, hit })`. `speed` is the ground speed it asks, counted in the character's own hip
heights a second (0 to stand, 1.2 to walk); `hit` is `"light"` or `"heavy"` on the frame a snowball lands, and missing
otherwise.
- With no hit, he idles or walks with clips from the CC0 library, and the walk really covers the ground at the speed
  asked: move `character.position` along the way he faces.
- A light hit: a flinch in the upper body alone, while the legs carry on walking exactly as before.
- A heavy hit: knocked down to the ground, where he lies for 1 s, then gets up and walks again.
- His feet, hips and head never go through the floor.

**Trying it:** `npm run check` drives your reactor on the grader's timetable (walking from 1 s, a light hit at 3 s, a
heavy one at 6 s) and every half second prints how high the hips are and where the character is.

**Pass conditions.** The grader runs your reactor twice, headless, reading its bones: once on that timetable, and once
with the light hit left out, to compare against.
- Walking, in the second before the light hit and in the last second: the hips travel at the 1.2 hip heights a second
  asked (±10%); the lower foot stands still at times (slower than the m3a sensors' standing speed); and a standing foot
  stays where it stands, the lower foot moving at 25% of the travel or less at least 40% of the time.
- During the light hit's 0.8 s: the legs (hips, knees and ankles against the pelvis) stay within 2% of the hip height of
  the run without the hit, while the hands or the head move at least 5% of it away from it.
- After the heavy hit: within 1.5 s the hips are below 45% of their standing height; they lie on the ground (under 15%)
  for 1.3 to 3.5 s, which counts the 1 s lying, the fall and the start of the rise; and within 3 s of rising past 15%
  they are back above 85%. Until he is up again they never get more than 3.5 hip heights from where the hit caught
  him, and from 0.3 s after they are down until he rises, no more than 0.6 (he stays where he fell).
- The feet, pelvis and head never go more than 5% of the hip height below the floor (a foot may go 10% in the half
  second after the heavy hit, where a cross-fade into the fall can dip it).
- No transform is ever NaN.

Work only in this directory.
