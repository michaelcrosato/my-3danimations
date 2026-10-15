# B2 (held-out) · Tavern brawler

*Lantern Row* is a back-alley brawling game. Its bruiser has one attack button, and the hit it deals has to register at
the moment the fist connects. The bruiser is `character.glb` in this directory: a bulky, broad-shouldered, thick-limbed
humanoid with its hips about 1 m up, standing at rest with its arms hanging loosely at its sides (a skinned humanoid,
in metres, facing +Z). The m3a animation packages are installed under `node_modules/@m3a/`; read their manual first,
`node_modules/@m3a/tools/MANUAL.md`.

**What to write:** `createFighter` in `src/fighter.ts`, whose types are already in the file. Sixty times a second the
game calls `fighter.update(dt, { attack })`, and `attack` is true only on the frame the player presses the button.
- Between punches the bruiser idles, playing an idle clip from the CC0 library.
- A press throws a punch, a second clip from that library, after which the bruiser returns to idling.
- Each punch calls the game's `damage(10)` exactly once, on the frame it lands. A punch lands when the punching hand
  moves fastest toward its target, the clip's measured strike (an event in the clip at that time is the usual way to
  get there); the frame of the press, or the end of the punch, is the wrong moment.

**Trying it:** `npm run check` plays your fighter through the grader's input, two presses two seconds apart, then
prints the frames on which `damage` was called and, for each punch, its strike and the window of frames damage may
fall in.

**What passes** (graded with no screen, by reading the bruiser's bones):
- it idles before the first press and after the last punch: the body moves, since a pose held still is no idle;
- each press is followed by a punch: a hand goes at least 15% of the hip height forward and strikes faster than one hip
  height a second against the pelvis; within 1.5 s the bruiser is idling again (that hand comes back at least half
  way);
- `damage(10)` comes exactly once per punch and never without one, from two frames before the punch's strike to four
  frames after it, and never after the hand is farthest out. The strike is the last time, before the hand is farthest
  out, that its forward speed peaks faster than one hip height a second: the punch's own peak, not a fade into a
  stance ahead of it. `strike.ts` finds it, the same way for the grader and for the check;
- no transform ever becomes NaN.

Keep all your work in this directory.
