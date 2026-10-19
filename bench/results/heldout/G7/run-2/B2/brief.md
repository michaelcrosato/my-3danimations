# B2 · The bouncer's punch

The bouncer at the door of a tavern-brawl game needs his punch wired. The project in this directory has him
(`character.glb`, a skinned humanoid in metres, facing +Z) and the m3a packages installed in `node_modules/@m3a/`.
Start with their manual: `node_modules/@m3a/tools/MANUAL.md`.

The bouncer is broad and heavy-set: 1.90 m tall, his hips 1.05 m above his soles. He rests in a relaxed pose, his arms
hanging 70° below level. His skeleton is named the Unreal Engine 5 way: a `root` bone at the origin, then `pelvis`,
`spine_01` to `spine_05`, `neck_01` and `head`, and on each side `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l`,
`thigh_l`, `calf_l` and `foot_l` (and the `_r` ones). He has twist bones, leaves hanging off the limbs:
`upperarm_twist_01_l`, `lowerarm_twist_01_l` and `thigh_twist_01_l` (and the `_r` ones). His toe bones are left out:
there is no `ball_l` or `ball_r`.

**The job:** implement `createFighter` in `src/fighter.ts` (its types are there). The game calls
`fighter.update(dt, { attack })` each frame (60 a second), with `attack` true on the frame the attack button is
pressed:
- standing, the character idles (a clip from the CC0 library);
- pressed, it throws a punch (another), then goes back to idling;
- the game's `damage(10)` is called once per punch, on the frame the punch lands: when the punching hand moves fastest
  toward its target (the clip's measured strike: an event in the clip at that time is the usual way), not when the
  button is pressed or when the punch ends.

`npm run check` drives your fighter as the grader will (two presses, two seconds apart) and prints when it called
`damage`, and for each punch its strike and the frames damage may come on.

**How it's graded** (headless, from the character's bones): before the first press and after the last punch it idles
(the body moves: a pose held still is no idle); after each press the character punches (a hand reaches at least 15%
of the hip height forward and strikes faster than one hip height a second against the pelvis), and within 1.5 s goes
back to idling (the hand comes at least half way back); `damage(10)` is called exactly once per punch, never without
one, from two frames before its strike to four after, and not after the hand is farthest out (the strike: the last
time the punching hand's forward speed peaks faster than one hip height a second before it is farthest out, the
punch's own peak, not a fade into a stance before it; `strike.ts` finds it, for the grader and the check alike); no
transform is ever NaN. Work only in this directory.
