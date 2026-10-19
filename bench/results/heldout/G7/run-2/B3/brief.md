# B3 · Snowball fight

In a winter playground game, a kid walks about while the others throw things: a snowball to the shoulder is a light
hit, a sledge crashing into the kid's legs a heavy one. You're wiring how the kid takes them. The project in this
directory has the kid (`character.glb`, a skinned humanoid in metres, facing +Z) and the m3a packages installed in
`node_modules/@m3a/`. Start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

The kid has a child's proportions: 1.30 m tall, the hips 0.695 m above the soles. The rest pose is a T-pose, the arms
level. The rig is a Blender Rigify one: in the file its deform bones are `DEF-spine` (the hips), `DEF-spine.001` to
`DEF-spine.004` (up the spine to the neck), `DEF-spine.005` and `DEF-spine.006` (the head), and on each side
`DEF-upper_arm.L`, `DEF-forearm.L`, `DEF-hand.L`, `DEF-thigh.L`, `DEF-shin.L`, `DEF-foot.L` and `DEF-toe.L` (and the
`.R` ones). It has twist bones inside the limb chains: `DEF-upper_arm.L.001` between the upper arm and the forearm,
`DEF-forearm.L.001` between the forearm and the hand, and `DEF-thigh.L.001` between the thigh and the shin (and the
`.R` ones). Its shoulder bones are left out: the upper arms hang straight from `DEF-spine.003`.

**The job:** implement `createReactor` in `src/reactor.ts` (its types are there). The game calls
`reactor.update(dt, { speed, hit })` each frame (60 a second): `speed` is the ground speed it asks, in the
character's hip heights a second (0 standing, 1.2 walking), and `hit` is `"light"` or `"heavy"` on the frame a hit
lands (else absent).
- Standing or walking: idle, or walk travelling at the asked speed (move `character.position` along its facing), with
  clips from the CC0 library.
- A light hit: a flinch on the upper body only, while the legs keep walking as before.
- A heavy hit: knocked down to the ground; it lies there 1 s, then gets up, and walks again.
- The feet, the hips and the head never sink through the floor.

`npm run check` drives your reactor as the grader will (walking from 1 s, a light hit at 3 s, a heavy one at 6 s) and
prints every half second how high the hips are and where the character is.

**How it's graded** (headless, from the character's bones, against the same reactor run without the light hit): walking,
in the second before the light hit and in the last second, the hips travel at the speed asked (1.2 hip heights a
second, ±10%), the lower foot stands still at times (slower than the m3a sensors' standing speed), and a standing foot
stays where it stands (the lower foot moves at 25% of the travel or less at least 40% of the time); during the light
hit's 0.8 s the legs (hips, knees and ankles against the pelvis) stay within 2% of the hip height of the walk without
it, while the hands or head move at least 5% of it from it; within 1.5 s of the heavy hit the hips go below 45% of their
standing height, lie on the ground (under 15%) for 1.3 to 3.5 s (the 1 s it lies, the fall and the start of the rise),
then are back above 85% within 3 s, and until then they go no more than 3.5 hip heights from where the hit found them,
and from 0.3 s after they are down until they rise no more than 0.6 (the body stays where it lies);
the feet, pelvis and head never go more than 5% of the hip height under the floor (a foot 10% in the half second after
the heavy hit, as a cross-fade into the fall may dip it); no transform is ever NaN. Work only in this directory.
