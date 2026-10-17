# B4 (held-out) · Hide-and-seek avatar

*Moonbeam Commons* is a social world where people bring their own VRM avatars, and its hide-and-seek minigame needs
the hiders to creep. You're giving one avatar its sneak. The avatar is `character.glb` in this directory: a chibi, a
big head making up about a third of its 1.03 m on a short body with stubby arms and legs, the hips about 0.42 m up, at
rest with the arms hanging some 70° down. It is a skinned humanoid in metres, facing +Z, its bones named as a VRM 1.0
avatar's humanoid (`hips`, `spine`, `chest`, `upperChest`, `neck`, `head`, `leftUpperArm`, `rightLowerLeg` and so on),
with twist bones as leaves on the upper arms, forearms and thighs (`leftUpperArmTwist`, `leftLowerArmTwist`,
`leftUpperLegTwist` and the right side's) and no toe bones. Its proportions are nothing like those of the people the
library's motion was captured from. The m3a packages are in `node_modules/@m3a/`; their manual,
`node_modules/@m3a/tools/MANUAL.md`, comes first.

**Your part:** `createSneaker` in `src/sneak.ts`, with its types already in the file. The game calls
`sneaker.update(dt)` once a frame, and the avatar creeps forward on a crouched sneaking walk loop from the CC0 library.
It travels the way its feet push it (move `character.position` by the root motion), and a foot on the ground stays put
while it stands. Measure it with the m3a sensors before you call it finished.

**Trying it:** `npm run check` drives your sneaker as the grader does (6 s) and prints how low the hips go and how far
the avatar has moved; measure the feet with the sensors as the manual's "Check" section shows.

**Pass conditions** (headless, from the avatar's bones):
- it sneaks: after the first second the hips average at most 85% of their standing height, and it moves forward at
  least 15% of the hip height a second;
- it steps: each foot lifts 7% of the hip height and sets down again, three lifts or more between the two feet in 5 s;
- the lower foot stands still at times (slower than the sensors' standing speed);
- a standing foot stays where it stands: the lower foot moves at a quarter of the avatar's travel speed or less at
  least 40% of the time, and the m3a sensors' slide and skate stay under their limits;
- nothing the sensors read of its bones fails;
- no transform is ever NaN.

Work only in this directory.
