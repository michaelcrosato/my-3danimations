# B3 (held-out) · Dodgeball recess

In *Recess Rumble*, a playground dodgeball game, the kid you control crosses the yard while balls fly. A glancing ball
should make them flinch without breaking stride; a full hit should knock them flat for a moment before they scramble
up and carry on. The kid is `character.glb` in this directory: a child, about 1.3 m tall with the hips about 0.7 m up,
standing at rest in an A-pose, arms angled down and out (a skinned humanoid, in metres, facing +Z). The m3a animation
packages are installed under `node_modules/@m3a/`; their manual, `node_modules/@m3a/tools/MANUAL.md`, is the place to
start.

**What to write:** `createReactor` in `src/reactor.ts`, with its types already in the file. Every frame, 60 a second,
the game calls `reactor.update(dt, { speed, hit })`. `speed` is the ground speed it wants, measured in the character's
own hip heights a second (0 to stand, 1.2 to walk); `hit` is `"light"` or `"heavy"` on the one frame a ball lands, and
absent otherwise.
- With no hit, the kid idles or walks, with clips from the CC0 library, and walking really covers the ground at the
  speed asked: move `character.position` along the way it faces.
- `"light"`: a flinch confined to the upper body, while the legs go on walking exactly as they were.
- `"heavy"`: down to the ground, lying there for 1 s, then up again and walking.
- At no time do the feet, the hips or the head sink through the floor.

**Trying it:** `npm run check` runs your reactor on the grader's schedule (13 s: standing, then walking from 1 s, a
light hit at 3 s, a heavy one at 6 s) and every half second prints how high the hips are and where the character is.

**What passes.** The grader, headless, reads the bones of two runs: that schedule, and the same reactor run again with
the light hit left out, to compare against.
- Walking, over the second before the light hit and again over the last second: the hips cover 1.2 hip heights a
  second (±10%); the lower foot is still at times (slower than the m3a sensors' standing speed); and a planted foot
  stays put, the lower foot moving at 25% of the travel or less at least 40% of the time.
- Over the light hit's 0.8 s, the legs (hips, knees and ankles against the pelvis) stay within 2% of the hip height of
  the run without it, while the hands or the head move at least 5% of it away from it.
- After the heavy hit, the hips drop below 45% of their standing height within 1.5 s and lie on the ground (under 15%)
  for 1.3 to 3.5 s, which counts the 1 s spent lying, the fall and the start of getting up; within 3 s of rising past
  15% they are back above 85%. Until then they never get more than 3.5 hip heights from where the hit found them, and
  from 0.3 s after they are down until they rise, no more than 0.6 (the body stays where it fell).
- The feet, pelvis and head never go more than 5% of the hip height below the floor (a foot may go 10% in the half
  second after the heavy hit, where a cross-fade into the fall can dip it).
- No transform is ever NaN.

Work only in this directory.
