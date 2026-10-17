# B2 (held-out) · Dojo pads

*Little Dragons Dojo* is a martial-arts game for young players: the student punches the pads a sparring partner holds
up, and the game scores each clean hit at the instant the fist meets the pad. The student is `character.glb` in this
directory: a child about 1.3 m tall with the hips about 0.7 m up, at rest in an A-pose, the arms angled some 40° down
from level. The bones carry Unreal Engine 5 mannequin names under a `root` bone on the floor (`pelvis`, `spine_01` to
`spine_05`, `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_r`, `calf_r`, `foot_r`, `ball_r` and so on), with
no neck bone (the head sits directly on the spine) and no twist bones. It is a skinned humanoid in metres, facing +Z.
The m3a packages are installed under `node_modules/@m3a/`; read their manual, `node_modules/@m3a/tools/MANUAL.md`,
before anything else.

**Your part:** `createFighter` in `src/fighter.ts`, whose types are already in the file. The game calls
`fighter.update(dt, { attack })` once a frame, 60 frames a second, and `attack` is true only on the frame the attack
button goes down.
- While nothing is pressed the student idles, playing an idle clip from the CC0 library.
- A press throws a punch, another clip from that library, after which the student settles back into idling.
- The game's `damage(10)` is called exactly once for each punch, on the frame the punch lands: when the punching hand is
  moving fastest toward its target, the clip's measured strike (an event placed in the clip at that time is the usual
  way). Calling it on the frame of the press, or when the punch finishes, is wrong.

**Trying it:** `npm run check` runs your fighter on the grader's input, two presses two seconds apart, then prints the
frames `damage` came on and, for each punch, its strike and the frames damage is allowed on.

**Pass conditions** (headless, read from the character's bones):
- it idles before the first press and after the last punch, which means the body moves: a pose held still is no idle;
- every press is followed by a punch, a hand going at least 15% of the hip height forward and striking faster than one
  hip height a second against the pelvis, and within 1.5 s it is idling again (that hand at least half way back);
- `damage(10)` comes exactly once per punch and never without one, from two frames before the punch's strike to four
  frames after it, and not after the hand is farthest out. The strike is the last moment before the hand is farthest
  out at which its forward speed peaks faster than one hip height a second: the punch's own peak, not a fade into a
  guard ahead of it. `strike.ts` finds it, in the same way for the grader and for the check;
- no transform ever becomes NaN.

Work only in this directory.
