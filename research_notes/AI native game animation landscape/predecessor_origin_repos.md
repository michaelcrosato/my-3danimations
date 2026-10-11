# Predecessor repos: what my-3d2dge and Depthward teach a standalone, agent-first animation package

Notes from reading two local clones on 2026-10-11. Both clones were treated as read-only. Commands that needed to
run (the doctrine check, the mocap test and the character sheet) ran on a copy in a scratch directory.

- **O:** `/home/user/michaelcrosato/my-3d2dge`, v0.17.4, commit `14a561c` (shallow, one commit, so there is no history to mine).
  Plain JavaScript, Canvas 2D, one-file builds. Its world is 3D, and its characters are procedural 3D rigs drawn as pixel art.
- **D:** `/home/user/michaelcrosato/my-3d2dge-2` ("Depthward"), commit `c8295dc`. TypeScript, three.js 0.186.1, Rapier 0.20.0
  and Vite. Its characters are skinned GLB meshes rendered as pixel art.
- **Path notation.** `O:path:line` and `D:path:line`. Line numbers are as of those commits.
- **Token counts** are exact cl100k counts (gpt-tokenizer 2.9.0, installed in the scratchpad) unless marked "est.".
  For the two manuals, O's own `tools/doctrine-check.mjs` only *estimates* tokens (chars/2.95 and chars/3.1), and its
  estimates run about 1-2% high.

Already read by the coordinator, so only recapped here: DOCTRINE.md (North Star: "an autonomous fighter jet with no
cockpit, flown from a ground station", O:DOCTRINE.md:21-35), CLAUDE.md, README.md, docs/MOCAP.md, docs/DECISIONS.md,
docs/FEEDBACK-LOG.md and docs/LAB-3D.md. They are cited below only where a line backs a specific claim.

---

## Part A: my-3d2dge (the origin)

### A1. The procedural animation core (`O:engine/my-3d2dge.js`, `O:engine/my-3d2dge-agent.js`)

**Where it lives and how big it is**

| Part | Location (full engine) | Lines | cl100k tokens |
|---|---|---|---|
| Whole full engine | `engine/my-3d2dge.js` (25 sections, banners `/* ===` at 72, 209, 342 ... 4660) | 5,063 | 152,633 (406 KB) |
| Whole agent edition | `engine/my-3d2dge-agent.js` (sections `// ---- N.`; Humanoid is `// ---- 10.` at :1262) | 2,889 | 83,774 (219 KB) |
| Agent edition manual (header) | `my-3d2dge-agent.js:1-357` (the "AGENTS: this header is the whole manual" block) | 357 | 8,996 (budget 10,000; doctrine-check estimates 9,071) |
| Math: `V3`, `ik3`, `ease`, `smoothDamp` | §1 MATH `:72-207` (`ease` :78-84, `V3` :121-130, `ik3` :132-143) | 23 (V3+ik3) | 601 |
| §11 HUMANOID RIG (class only) | `:1743-2462` | 720 | 27,865 |
| ... posing logic: constructor, update, hair, `_pose` | `:1765-2000` | 236 | 9,230 |
| ... drawing: `_drawHD`, `_drawClassic`, `_hat`, `drawSmear`, `debug` | `:2092-2461` | 370 | 14,870 |
| `E.Attack`, `E.Combo`, `E.MOVES`, `E.move`, `E.knockback` | `:2463-2589` | 127 | 3,732 |
| ... the `E.MOVES` table alone | `:2549-2578` | 30 | 1,818 |
| §12 BLOB RIG | `:2590-2679` | 90 | 2,663 |
| Agent edition: Humanoid with Attack, Combo and MOVES | `my-3d2dge-agent.js:1262-1753` | 492 | 18,478 |
| Agent edition: Blob | `my-3d2dge-agent.js:1754-1831` | 78 | 2,463 |

About a third of the Humanoid is motion and half is pixel drawing. The agent edition drops `_hair` (verlet hair),
`drawPortrait`, `_drawClassic`, `drawSmear`, `debug` and the `skeleton` build (compare the method lists).
`npm run test:agent` keeps the agent edition a name-for-name subset. One port lag shipped anyway: the clip-driven
turning of the face, belt and toes reached the full engine on 2026-10-06 and the agent edition only in v0.16.0
(O:CHANGELOG.md:55).

**The Humanoid rig** (O:engine/my-3d2dge.js:1743-2462)
- **Local frame:** f forward, r right, z up (:1745). The rig "poses itself every step from movement, attacks and state,
  then projects through any view" (:1745-1746). Points go from its own frame to world offsets through `_w(p)` (:1800-1803).
  The public name for that is `worldOffset` (:1798), promoted in v0.16.0.
- **Joints:** `JOINT_KEYS` lists 15 (:1756): hipL, hipR, kneeL, kneeR, footL, footR, hipC, shC, shL, shR, head, elbowL,
  elbowR, handL, handR. `J.bladeDir` is a direction. There is no spine chain: the torso is one segment, from `hipC` to
  `shC`, at a lean (:1948-1951). There are no wrists, toes or fingers; drawing details hang off joints instead.
- **Bone lengths:** the default (chibi) values are legUpper 6, legLower 6, hipZ 11.6, torso 8, shoulderHalf 3.3,
  neck 1.2, headR 3.4, armUpper 4.6 and armLower 4.6, in world units where one tile is 16 (:1769-1774). Gait style comes from
  stride 6.5, lift 3.4, swing 4 and speedRef 70.
- **Builds:** `BUILDS` holds chibi, heroic, bulky and skeleton (:1757-1764), plus a `size` multiplier.
- **IK:** `ik3(a, b, L1, L2, hint)` is analytic two-bone IK: it clamps the reach to L1+L2-0.01 and bends toward the
  hint projected off the limb axis, with a fallback when the hint is degenerate (:131-143). It is exported as `E.ik3`
  (:206). It solves the legs (:1945) and the arms (:1982), with fixed bend hints (`[1, s*.15, .1]` for knees,
  `[-1, s*.7, -.2]` for elbows). There is no other IK in the engine. A copy lives in the format codec (O:src/mocap/readable.js:89-100).
- **Gait:** `phase += dt*speed/(stride*size*max(.4, min(1, spW)))` (:1819). Each foot is placed at
  `sin(phase)*stride*speedWeight` along the move direction (so strafing and backpedalling work) and lifted by
  `max(0, cos(phase))*lift` (:1932-1934). The hips bob (:1926) and the arms counter-swing (:1959-1960).
  - It is parametric: no foot planting and no contact model. See A3 for the measured sliding.
- **Idle:** breathing `sin(t*2.3)` (:1925), a weight shift from foot to foot (`sway`, :1929), blinking (:1837) and a
  squash spring (`sq`/`sqV`, :1838).
- **Everything is a weight.** Every state moves a weight toward its target with `approach(w, target, dt*rate)`:
  dash, hurt, attack, air, held poses (cheer, cast, guard, kneel, crouch, wave, hips, block), stances (guard, ready),
  climb, die (a timed stagger, then the knees, then a topple), down and point/aim (:1820-1835). `_pose()` builds the joints
  from these weights as stacked lerps of target points, then solves the limbs with IK (:1923-2000).
  - Knocked down, the whole skeleton rotates back to lie flat (:1995-1999).
- **Secondary motion:** a verlet cape of two chains, 4 constraint iterations and a body-plane collision (`_cape`,
  :2039-2074); verlet long hair (`_hair`, :1906-1922); weapon-trail ribbons sampled from the real blade path (:1890-1903,
  `drawSmear` :2412-2448). Both cloth and hair reset on a teleport (:1811).
- **Drawing tricks tied to pixel art:** `charView()` keeps faces readable in steep views (:397-407). The "cheated 3/4"
  turns the body partly toward the camera in side views (:2096-2099). Parts are depth-sorted capsules with hue-shifted
  tones (`_drawHD` :2106-2311).

**How a move is specified: data parameters over a procedural motion model**
- **The spec.** An attack spec is plain data: `{ a0, a1, z0, z1, reach | r0, r1, hand, rel, blade, spin, kick, plane,
  lunge, hop, crouch, lean, twist, hold, wind, active, recover }` (doc comment :2540-2548; O:API.md:171).
  The motion it produces is code, in `Humanoid.update`/`_pose` (:1840-1887).
- **Phases** are `'wind' | 'active' | 'recover'`, with `u` running 0..1 inside each (:1747-1750, :1805-1808):
  - **wind** (anticipation): the hand eases (`outQuad`) from wherever the arm is to `a0`. The body leans back, draws back
    and dips (`tLean = -|lean|*.45`, `tLunge = -lunge*.3*k`, crouch) (:1858-1861).
  - **active** (strike): `outCubic` from `a0` to `a1`, with a lunge, a lead-foot step, a lean, a twist and a hop arc
    `sin(k*PI)` (:1862-1866). `spin` turns the body a full circle (a windmill in side views).
  - **recover** (follow-through, then return): it overshoots by 8% of the swept span, holds for `hold` (default 0.3 of
    the recover), then blends back to the stance by position, "never swing backwards" (:1867-1872).
  - **Chaining:** a chained hit starts from the current arm pose (`_th0`, `_from`), so there are no snaps (:1852-1856).
  - **Twist** is derived: `theta*(.32 ground | .08 side)*spec.twist`, clamped to ±0.7 (:1873).
- **Size and view independence.** `rel: true` makes heights relative to the shoulder and scales reach with arm length,
  and kick heights become shares of hip height. Side views turn horizontal swings into screen-plane chops by themselves (:1844, :2544-2546).
- **The library.** `E.MOVES` holds 25 named moves (:2549-2578):
  - blades: slash, backslash, overhead, rising, thrust, spin, plunge, twohand;
  - fists: jab, cross, hook, uppercut, haymaker, elbow;
  - kicks: kick, roundhouse, sweep, flyingkick, knee, axekick;
  - other: cast, throw, bash, claw.
  Durations are tiny: jab is 0.035/0.06/0.13 s, haymaker 0.22/0.1/0.3 s. `E.move(name, u, phase)` returns the state of
  any move at any moment, for previews (:2580-2581).
- **`E.Attack`** (:2464-2510) is the phase timer. `new E.Attack('slash')` merges a `MOVES` entry with `hitAt: .35`
  (:2476). `update(dt)` returns the phase that just began, which is where swing sounds go (:2491-2501).
  `hits(targets, test, fn)` calls `fn` once per target per swing, only during `'active'` and only once `u >= spec.hitAt`
  (:2503-2508). **That is the only hit-timing hook: a share of the active phase.**
  - O:API.md:156: "moves wait until `hitAt: .35` of the swing, so hit-stop freezes the strike, not the wind-up".
- **`E.Combo`** (:2513-2538) chains Attacks. `press()` during a recover, or within `window` (0.3 s) after one, flows
  into the next hit; otherwise the chain restarts.
- **What builders did with them.** The Vesper builder bypassed these helpers: "Combat needed explicit rules for height,
  perception, and takedowns" (O:docs/FEEDBACK-LOG.md:48-49, status "watch").

**Blob** (:2590-2678): a squash-and-stretch sphere on a spring (`sqV += (-(sq-target)*320 - 14*sqV)*dt`, :2604) that
looks at a target. Feature flags add ears, horns, wings (flap speed, folding), feet, tail and mouth, and `hang` roosts it
upside down (:2609-2620).

**Custom rigs and the body contract**
- **The contract** (O:src/emberdeep/18-characters.js:33-48) is what the game calls on a body:
  - methods: `update(dt, s)`, `draw(g, ox, oy, view)`, `drawSmear`, `drawPortrait`, `kick(v)`, `hand()`, `head()`,
    `tip()`, `_w(p)`;
  - joints `J`: at least hipC, shC, head, handL, handR and bladeDir;
  - fields: `o.size`, `C`, x, y, z, facing, t and `phase` (the gait clock);
  - optional `bones`: pairs of joint names whose length the sheet measures.
- **checkRig.** `checkRig(id)` drives a body through `CHAR_STATES`: 14 states (idle, run, dodge, jump, wind-up, strike,
  follow-through, cast, guard, hurt, knocked down, death, cheer, wave), each with a hold time, in every view
  (:81-90). It names whatever is missing.
- **The recipe** (O:docs/CHARACTERS.md, 3,002 tokens):
  - the loop `new:character`, then `character:check`, then `ed-balance` (:5-17);
  - Humanoid versus custom body (:30-37): a custom body costs "Codex's is about 440 lines, Dan's about 250";
  - craft rules for custom bodies (:63-76): ease every weight; project through `_w` and then `view.p`; sort parts by
    depth; keep bones rigid with `E.ik3` and list them in `rig.bones`; **blend directions as angles (pitch and yaw), never
    as vectors, which pass through zero and flip**; **swing on a critically damped spring**.
- **Dan** (O:src/emberdeep/22-char-dan.js; `DanRig` :21-259, 239 lines, 8,642 tokens) is a reverse-kneed beast with
  two scythes and a tail.
  - Weights eased per state (:41-57).
  - Swings ride a critically damped spring: `K = 900`, damping `2*sqrt(K)` (:61-64).
  - Legs: hip, knee and hock solved by `E.ik3` to a hock target, then a fixed-length foot bone (:91-100).
  - Arms: a library of weighted wrist, pitch and yaw targets, blended as angles so the blades never flip; the elbow is
    solved by IK (:101-125).
  - Tail: sinusoidal segments (:127-134). Joints are clamped to the floor (:135), and `bones = DAN_BONES` (13 pairs, :16-17).
- **Codex** (O:src/emberdeep/21-codex.js; `CodexRig` :1-438, 5,084 tokens) is a floating folio: detached gauntlets, a mask,
  an astrolabe and leaves. It declares no `bones`, so the sheet measures no stretching for it.
- **Beasts** (O:src/emberdeep/33-beasts.js:1-11):
  - **`BST_Crawler`** (:85-235, 7,375 tokens) is the only foot-planting implementation in either repo. Eight two-bone IK
    legs; "each foot stays planted until it strays from its rest spot, then steps in its group (alternating tetrapods)".
    The step threshold grows with speed, rest spots lead the velocity, steps follow an eased arc, and tucked feet plant
    where they land (:120-142).
  - **`BST_Serpent`** (:602-775): segments follow the head's path history.
  - **`BST_Eye`** (:858-939): a floating eye.
- **Tools around characters:**
  - `tools/new-character.mjs` (212 lines) writes a template that already passes every check, as a Humanoid or a custom
    body. `npm test` builds both templates so they never rot (:1-11).
  - `tools/character-check.mjs` (30 lines) runs syntax, build, `ed-character-test`, then `ed-sheet`, and prints a summary.
    Its exit code ignores sheet lints (:1-7).
  - `tools/ed-sheet.mjs` (147 lines, 4,847 tokens) draws the **character sheet**: one PNG of every state in every view, an
    8-way turnaround and game scale on every theme's floor, plus JSON numbers. See A3 for its metrics.

### A2. The mocap store (`O:src/mocap/`, `O:tools/`)

**Code sizes**

| File | Lines | Tokens | Role |
|---|---|---|---|
| `src/mocap/readable.js` | 339 | 10,825 | the format codec, shared by Node and the browser: measure, fit, encode, decode, text, parse, mirror, error |
| `src/mocap/mocap.js` | 266 | 7,099 | runtime: `load`, `Mannequin` (look-alike drawing), `drive` (retarget onto a Humanoid) |
| `tools/anim-import.mjs` | 264 | 8,212 | GLB to set: its own glTF parser, FK and the RIGS bone maps |
| `tools/asf-amc.mjs` | 176 | 5,721 | CMU ASF/AMC reader, loop cutting, floor estimate |
| `tools/cmu.mjs` | 259 | 7,690 | CMU index, download, survey and ledger, the 2,548-take library |
| `tools/anim-set.mjs` | 35 | 905 | cuts a small set from big ones, keeping provenance |
| `tools/anim-sheet.mjs` | 72 | 1,792 | contact sheets of clips (Playwright) |
| `tools/mocap-lib.mjs` | 39 | 599 | `readSet`, `writeSet` (runs readable.js in `vm`) |
| `tools/to-glb.py` | 62 | 827 | `.blend`, FBX or BVH to GLB through Blender's `bpy` module (headless) |
| `tools/mocap-test.mjs` | 176 | 4,705 | the lab test (46 coded failure conditions) |
| `tools/ed-clips-test.mjs` | 141 | 3,454 | the game-integration test (about 25 named checks) |
| `src/mocap.game.js` | 383 | 9,443 | the Mocap Lab page: two figures, AI panel, catalog, `window.__mocap` handle |

**Public API**
- `MocapReadable`: `{ POINTS, IDX, P, LEGEND, measure, fit, encode, pose, moveAt, keyAt, text, parse, mirror, error,
  meanError, capSample, reduce }` (readable.js:337).
- `Mocap`: `{ load, Mannequin, drive, LEGEND }` (mocap.js:264).
- The `lib` object from `Mocap.load`: `clip`, `sample(clip, t, out)` (a Float32Array of 36×3 values in mm), `moveAt`
  (root travel), `replace` / `restore` / `edited` (edits a model made), `text(clip)`, `origin(clip)` (label, origin,
  license, url, orig, take), `blend(a, b, k)` (pose lerp), `pt`, `error` (mocap.js:29-48).
- Game usage, per the agent manual (O:engine/my-3d2dge-agent.js:337-340): `Mocap.drive(rig, lib)` once, then
  `rig.mocap = lib.sample(clip, t)` each step, `rig.mocapW` to fade (0..1) and `rig.mocapMask = 'upper'`.

**The format: "readable key poses", `"format": 1`**
- **Versioning.** The only version is the set header's `"format": 1` (written at anim-import.mjs:236; seen at
  sets/hero.js:25). readable.js and LEGEND carry no version. There is no JSON Schema; `parse()` validates by hand.
- **The 36 points** the decoder rebuilds (readable.js:20-23): pelvis, spine1, spine2, chest, neck, head, headTop, faceF,
  chestF and pelvisF, plus per side clav, sh, elbow, wrist, index, knuck, pinky, fist, hip, knee, ankle, ball and toe.
- **A key pose** is `t` (s, to the millisecond) plus 14 fields (`FIELDS` :262):
  - required: hips, body, chest, head, armL, armR, legL, legR (:263);
  - optional: shL, shR, footL, footR, blade, root.
  - Every value is a whole number. Limbs are `[forward, out, up, bend, twist]`: a direction in percent plus a bend in
    degrees, not joint angles.
- **LEGEND** (readable.js:25-38, 14 lines, **440 tokens**) is copied into every set file's header (sets/hero.js:5-19):
  ```
  // hips   [forward, right, up]   the pelvis, in percent of standing hip height (100 = standing, 55 = sitting on a chair)
  // body   [turn, lean, tilt]     the pelvis, degrees ...   chest ... relative to the pelvis   head ... relative to the chest
  // shL shR    [reach, shrug]  ...  armL armR  [forward, out, up, bend, twist] ... legL legR ... footL footR [down, out, toes]
  // blade  [forward, right, up]  (sword clips) ...  root [forward, right] (clips that travel) ... percent of standing hip height
  ```
- **A real key** (sets/hero.js:474-477): one 4-line pose costs **137 tokens**. Hit_Chest (0.333 s, 5 keys) costs 755
  tokens, header included.
  ```
  {"t":0,
   "hips":[-6,-1,93], "body":[14,-15,2], "chest":[-1,2,5], "head":[0,-12,-2],
   "shL":[6,-3], "shR":[-6,-2], "armL":[29,19,-94,56,6], "armR":[29,18,-94,64,-3],
   "legL":[-15,14,-98,32,6], "legR":[-50,19,-85,23,-37], "footL":[15,8,0], "footR":[11,37,-1]},
  ```
- **Clip header:** `{clip, src, take?, orig?, dur, loop, tags, desc, keys}`. The set header holds `set, title, format,
  credit, from, fps (30), sources{ID: {file, rig, label, origin, license, url, rest{...measured body...}}}, body (the
  mannequin's segment radii and bands), fit{clip: [mean, worst] mm}, clips` (sets/hero.js:21-30).
- **Decoding** (`decodePose` :235-259):
  - Torso frames come from Euler `[turn, lean, tilt]` (:83-87). The spine bend is spread by per-library `spineW`/`neckW`
    slerp shares, which are fitted at import (`measure` :174-176).
  - Shoulders come from `[reach, shrug]` about the collarbone pivot (:193-194). Arms and legs go through two-bone IK with
    the length implied by the bend, and the twist is a pole angle about a carried reference (:243-253).
  - Feet: `[down, out, toes]` plus the rest pitches (:254-256).
- **In-betweening** (`keyAt` :265-271) is **linear per number**: loops wrap, one-shots clamp. There are no curves or
  tangents. Directions are normalized after the lerp (:244).
- **Mirroring** (`mirror` :323-335) swaps L and R and negates turns and tilts. Twists flip sign and `root`/`blade`
  mirror. Mirroring twice returns the original (tested).
- **Edits.** `parse()` (:311-321) accepts `//` comments and throws an error that names the key and the field
  (`key 1 (t 0) has no "body"`).

**Measurement and the key-pose fitter** (readable.js:139-183, :287-302)
- **`measure(clips, tpose)`** takes from the T-pose (or the first frame) the proportions, the rest frames
  `Pr`/`Cr`/`Hr`, hip, clavicle and shoulder offsets, limb lengths and foot pitches. It then grid-searches (step 0.05)
  how much of the hips-to-chest rotation each spine bone takes, and how much of the chest-to-head rotation the neck
  takes, "because a library's animators decide how the spine bends" (:150-176).
- **The error metric** (:133-138): the maximum and mean Euclidean distance over all body points in mm. The finger helper
  points (index, pinky) are left out (`SHOWN`).
- **`reduce(cap, tol)`** (:139-146): Ramer-Douglas-Peucker over whole poses. It keeps a frame when lerping the frames
  around it misses by more than `tol`.
- **`fit(R, cap, tol)`** (:293-302): it starts from the RDP keys, then greedily adds the frame whose error *above the
  format's own floor* is worst. The floor is that frame encoded as its own key and decoded, because "keys past the
  format's own limits are not worth their tokens". It stops when the worst excess is within `tol`. Returns
  `{clip, max, mean}`.
- **Error budgets:**
  - default `--tol 30` mm (anim-import.mjs:43); the CMU library cut uses a looser `libTol 50` mm (cmu.mjs:17, :153);
  - test thresholds per clip: mean ≤ 40 mm and worst ≤ 300 mm; per set: mean ≤ 20 mm (mocap-test.mjs:56-60, :74);
  - mocap-test.mjs:56-57 notes that one pixel is about 24 mm at the default zoom.
- **Cost:** "fitting costs the square of a clip's length", so takes are fitted in pieces of at most 10 s (cmu.mjs:203-215).

**Continuity handling**: "numbers continue from key to key, so in-betweens never jump"
- **Angles are unwrapped** against the previous key (`unwrap` :104).
- **Two readings of a body angle.** `[turn, lean, tilt]` and `[turn+180, 180-lean, tilt+180]` describe the same frame.
  The encoder takes whichever continues from the key before, so a body leaning past horizontal in a flip keeps leaning
  (:201-203).
- **The twist reference** is carried by the shortest rotation from one REST direction to wherever the limb points
  (Rodrigues, :112-120). The comment records the failure it fixed: "An earlier reference blended two fixed directions;
  where they faced apart it flipped, and in-betweens put the elbow on the wrong side" (:106-111).
- **A fist curled in past the shoulder** (a bent wrist mid-roll) is re-pointed away from the elbow, so the elbow stays put (:220-222).
- **Bend in degrees, not reach as a fraction:** "storing reach as a fraction moved a nearly straight knee 56 mm per
  rounding step" (O:docs/MOCAP.md:279).
- **Key times** are rounded to the millisecond so a key lands on its frame (:280).
- **CMU loops:**
  - a cycle search: a span 0.5-2.5 s long (`min` can be set) whose end pose matches its start, aligned for heading and
    measured from the hips, with a velocity match. Cost = `rms(pose) + .1*rms(Δvelocity)*fps/2 + .002*duration`; spans
    too still to be the cycle are skipped (asf-amc.mjs:111-134);
  - the residual seam is spread across the cycle so the loop closes exactly (:161-162);
  - the seam's error in mm is printed at import (:164);
  - glTF loops are found by name only (`_Loop`, `Idle`; anim-import.mjs:228), with no closure pass.
- **Floor:**
  - CMU: per subject, the most common centimetre of the lowest foot point over the lower half of sampled frames, so
    landings and ladder rungs don't move it (asf-amc.mjs:166-173);
  - at runtime, `drive` lifts any pose whose lowest point dips under zero (mocap.js:197-200), and the lab's mannequin
    does the same (`groundLift`, O:src/mocap.game.js:108).
- **Facing and origin:** each clip is turned so the hips face forward at frame 0, or along the travel direction for a
  loop, and slid so the root starts at 0 (asf-amc.mjs:148-153).

**Importers**
- **`anim-import.mjs`** reads binary glTF itself, with no three.js (:122-135). It samples every clip at 30 fps, runs FK
  and takes the 36 points in the rig's frame (:210-229). Root travel is recorded as `move`.
  - **Bone maps (`RIGS`)** cover two skeletons only: Rigify `DEF-` bones (Quaternius UAL1) and Unreal names (UAL2,
    Mesh2Motion), matched in any case (:75-93, :139-142). A third needs a new entry; there is no automatic mapping.
  - It measures the first library's skinned mesh (segment radii, the joint-ring material) for the look-alike mannequin (:158-207).
  - **The catalog** drives tags and descriptions, `loop`/`once`, `orig` provenance, `$sources` (label, origin, license,
    url), `$skip` (reason on record) and, for CMU, `$pick` (take, from, to, minCycle) (:19-31, :47-72).
- **`asf-amc.mjs`** does Acclaim FK as the format defines it: `M = M_parent·C·R·C⁻¹` (:7-11, :68-78).
- **`cmu.mjs`:**
  - `find`, `subject`, `get` and `all` (the 1.08 GB archive, read by a hand-rolled unzip, :74-100);
  - `survey` converts every take and writes the **ledger** (`src/mocap/catalogs/cmu-takes.tsv`): sec, category (regex
    over the descriptions, :104-122), active span, fit, travel, hip range, flags (inverted, floats, loose, short, fps?),
    used and note (:123, :153-232);
  - `library` writes `examples/cmu-lib/` (one set per subject, 10 s parts, tol 50);
  - `ledger` queries it.
- **`to-glb.py`** is an offline bridge for .blend, FBX and BVH through Blender's headless `bpy` (:1-17).

**Sets and catalogs** (from the set files, computed in Node)

| Set | Clips | Keys | Motion (s) | Keys/s | Mean err (mm): median / p90 / max | Worst err (mm): median / p90 / max | Raw / gz | Tokens |
|---|---|---|---|---|---|---|---|---|
| QUATERNIUS (UAL1+UAL2, CC0) | 88 | 1,295 | 135.0 | 9.6 | 14 / 18 / 22 | 78 / 120 / 222 | 387 KB / 74 KB | 193,759 |
| MESH2MOTION (CC0; 3 origins) | 177 | 2,798 | 322.1 | 8.7 | 15 / 24 / 39 | 80 / 160 / 286 | 819 KB / 158 KB | 412,230 |
| CMU (60 cut moments) | 60 | 2,376 | 235.9 | 10.1 | 17 / 25 / 34 | 89 / 137 / 167 | 722 KB / 162 KB | 364,483 |
| HERO (picked from the first two) | 15 | 238 | 25.6 | 9.3 | 14 / 25 / 26 | 101 / 159 / 227 | 75 KB / 17 KB | 37,418 |

- **Totals.** The 325 curated clips (QUATERNIUS, MESH2MOTION and CMU) hold 6,469 key poses over 693 s of motion, about
  **970k tokens**. That is ~150 tokens per key, ~1.4k tokens per second of motion and ~3k per clip.
- **Coverage.** 44 of the 60 CMU clips carry `root`, against 13 Quaternius and 21 Mesh2Motion clips. 11, 12 and 1 carry
  `blade`.
- **Catalogs.** One line per clip, about **35 tokens a clip**: quaternius.json 2,270 tokens, mesh2motion.json 6,133,
  cmu.json 3,045. The CMU ledger is 120,691 tokens for 2,548 takes (about 47 a take); its categories are locomotion 715,
  everyday 412, animal and character 211, undescribed 203, jump 181, and so on.
- **Ledger fit** (computed from cmu-takes.tsv): the mean of the takes' average errors is 17.8 mm and of their worst
  errors 95.6 mm. Flags: 56 loose, 189 inverted, 63 floats, 25 short, 113 fps?.
- **The CMU library** (`examples/cmu-lib/`) is 113 subject files plus an index, 70.4 MB. The index alone is 55,167
  tokens; the whole is about 35M tokens est. (≈2 bytes per token in samples). Agents are told to search it and never
  read a file whole (O:engine/my-3d2dge-agent.js:329-331).
- **How the format was chosen** (O:docs/MOCAP.md:302-314), on the 46 clips of UAL1:

  | Stored as | Poses | gz size | Worst error |
  |---|---|---|---|
  | every frame at 30 fps | 2,078 | 118 KB | 0 mm |
  | key poses, 10 mm budget | 905 | 78 KB | 10 mm |
  | key poses, 40 mm budget | 515 | 51 KB | 40 mm |
  | readable key poses | 615 | 31 KB | 214 mm (~12 mm mean) |

  "Halving the frame rate was the wrong cut: ... it can skip a punch's moment of contact".

**Retargeting in code: `Mocap.drive(rig, lib)` (O:src/mocap/mocap.js:165-262)**
- **Hooks.** It monkey-patches the instance: `rig.update` resets `_ownSpin` (:178), and `rig._pose` calls the procedural
  `_pose` first, then overwrites the `DRIVEN` joints from `rig.mocap` (:179-183). Overwriting a private method is the one
  grandfathered `_pose` use in O:tools/doctrine-check.mjs:77.
- **Heading.** Yaw follows the clip's chest-forward direction, flattened onto the floor. A ramp distrusts it when the chest
  faces up or down (`(fl/len - .3)/.3`, :186-192), and the clip is read in that turned frame (:193).
- **Hips.** Scale `k = rig.hipZ / src.hipZ`. Then `hipC = mid(hips)*k + lift`, with hipL/R placed along the clip's hip
  axis at the rig's `hipHalf` (:184, :195-201).
- **Legs.** `foot = hip + (soleSrc - hipSrc) * (rigLeg/srcLeg)`. The sole replaces the ankle near the ground, fading with
  height. The foot is clamped to z ≥ 0, the knee hint comes from the clip's knee, and `E.ik3` solves it (:202-209).
- **Torso and head.** Each takes the clip's direction at the rig's own length (`torso`, `shoulderHalf`, `neck+headR`) (:211-215).
- **Arms.** `hand = sh + (fistSrc - shSrc)*armK`, the elbow hint comes from the clip, and `ik3` solves it (:216-222). A
  blade runs along index-pinky when `mocapBlade` is set (:224).
- **Detail frames** for the face, hair, belt and toes: body and head frames are measured against the library's rest
  frames (`tiltFrom`, :155-159, :227-229) and handed to drawing as `rig.mocapTilt` (engine `_offsets`
  O:engine/my-3d2dge.js:2081-2090).
- **Blending.** With `mocapW < 1`, both poses move into the frame the rig draws with and are lerped (`bladeDir` is
  normalized). Spin = own×(1−w) + yaw×w (:231-240). `mocapMask = 'upper'` drives only `UPPER` (:143, :184).
- **Game-facing extras:**
  - `downW` follows the torso's tilt (the game reads it for shadows and for what a body on the floor can do) (:243-246);
  - a weapon drops flat on the floor as the body goes down (:247-250);
  - a sword never goes under the floor: the blade lowers no further than to lie along it (:251-259).
- **What it is:** proportional placement of end effectors plus two-bone IK, onto **one fixed 15-joint procedural rig**.
- **What it lacks:** contact preservation (feet keep no plant, only z ≥ 0 and the global lift); stride scaling
  (`legK` changes stride length, but the in-place loop stores no speed to match); hand-to-prop constraints;
  self-collision; and any output to a skinned skeleton.

**Known limits** (O:docs/MOCAP.md:360-366 plus code)
- **Hands:** fingers are not imported, so hands are fists (:363). The hand is a straight continuation of the forearm, so
  hard-bent wrists cost 30-40 mm; a curled spine is the other known miss (MOCAP.md:290; mocap-test.mjs:56-57).
  CMU hands have one finger bone: they turn with the wrist and never curl (:365).
- **Skeletons:** only 2 bone maps plus CMU; 100STYLE's BVH would need a map (:364).
- **Missing motion data:**
  - in-place loops carry **no stride speed**: `root` is stored only for clips that travel, and asf-amc stores none for
    loops (`if (!pk.loop ...) moved = true`, asf-amc.mjs:158);
  - in-place jumps need the game to supply the arc (MOCAP.md:355).
- **Licenses:** Mixamo is excluded (no editable redistribution) and Bandai Namco is excluded (NC-ND) (MOCAP.md:368-383).
- **Interpolation:** linear only. No events or contacts, no hit frames, no curves, no compression beyond key selection.
- **Doc drift:** MOCAP.md:362 ("The hero's face and hair follow `facing`, not the clip's head (see 3 above)") reads as
  stale against `mocapTilt` (:226-229) and the test that checks the face tracks the clip's head (mocap-test.mjs:86-107).

**Game integration: `O:src/emberdeep/96-hero-clips.js`** (184 lines, 4,202 tokens)
- **`HCL_MOVES`** (:34-50) is a small moment table. Each moment names a clip and any of: `speed`, `fade`, `out`,
  `mask: 'upper'`, `walk` (moving does not cancel it), `hold` (the last pose stays), `landed` (clip seconds by which a
  fall is down; the death panel waits for it), `at` (start offset), `next` (chain) and `instant`.
- **Mechanics:** a crossfade from whatever is playing (`from` pose, 0.18 s, :61-66, :82). `HCL_step` advances the clip
  and hands the pose to the rig before it updates (:70-84).
- **Triggers:**
  - state-driven: `HCL_auto` (:87-96);
  - cancelled by gameplay: `HCL_cancel` (:100-105);
  - events on the bus: `heroDie` picks the fall by cause (`HCL_deathFor` :53-58), plus bossDown, heroLevel, pickup and hurt (:140-152).
- This table plus Depthward's skill timeline (B1) are the seed of a data-driven animation-graph and notify layer.

**Tests**
- **`mocap-test.mjs`** plays every clip of every set the lab carries, at 4 moments, in every view, on both figures.
  It fails on:
  - a page error or engine warning, or a value that is not a number;
  - a figure that draws nothing;
  - a mannequin foot more than 1 mm under the floor, a hero foot under it, or the hero's sword under it;
  - text that doesn't parse back within 0.5 mm, or mirror-twice that isn't within 0.5 mm of the original;
  - a fit over the thresholds, or a missing src, license, `orig` or `take` record;
  - a picked set that isn't key for key the clips it was picked from;
  - the face straying more than 2° from the clip's head;
  - a Jump_Kick that turns the hero less than 270°, or a cartwheel that never goes upside down;
  - a broken edit accepted, or an applied edit that doesn't play;
  - ledger completeness.
  (mocap-test.mjs:36-171.) **I ran it on the scratch copy: it passed, "1360 poses checked on the mannequin and the hero;
  the CMU library: 2548 takes, 5 subjects loaded and played".**
- **`ed-clips-test.mjs`** checks gameplay timing in the real game: each moment starts and releases when it should, the
  YOU DIED panel waits until `landed`, upper-body clips keep the legs walking, and the gallery plays every clip (:32-136).

### A3. Verification tooling and motion-quality metrics

**`tools/filmstrip.mjs`** (155 lines, 3,451 tokens) records a contact sheet of frames from a game page.
- **Steps:** `wait:`, `press:`, `down:`, `up:`, `rec:N:every` and `eval:`.
- **`--seed N`** installs a **virtual clock** before any page script (:41-55):
  - `performance.now` and `Date.now` are replaced and advanced only by `__film.tick()`, exactly 1/60 s per frame;
  - `requestAnimationFrame` is queued and run by the tick;
  - `Math.random` becomes mulberry32 with that seed;
  - gamepads are stubbed, WebGPU is disabled and AudioContext is removed (sound draws its own random numbers).
- **`--compare b.html`** records the same steps from a second page and lays out A, B and a diff row (A dimmed, differing
  pixels in magenta). It prints which frames differ by how many pixels (:113-150).
- **`--expect-same`** exits 1 on any difference (:153).
- **`--crop`** zooms on one character in game pixels.

**`tools/check.mjs`** (110 lines) loads the page headless, presses start, plays, cycles the views and screenshots each.
- It reports errors, engine warnings, fps, actors, draw calls and external requests.
- **"Look notes"** (:42-54, :99-107) are quick lints on the frame:
  - fewer than 40 colors on screen ("PS1-era scenes use 100+");
  - more than 40% of the screen one flat color;
  - more than 6% 1-pixel checkerboard dithering;
  - luma spread (p95 − p5) under 70.
- It exits 1 on any error or a blank screen.

**`tools/replay.mjs`** (74 lines) replays a recorded `E.session` (seed, frame times, inputs, screen, save, checksums every
60 frames) in headless Chromium. It stops at the first checksum that differs (:1-12). This rests on portable math:
`sin`, `cos`, `atan2` and friends are built from exact operations while recording and replaying, so Safari and Chromium
play the same bits. `tools/cross-engine-math.cjs` proves it on a Humanoid animated for 3,000 steps (O:CHANGELOG.md:25, :32).

**`tools/determinism-test.mjs`** (31 lines) plays an Emberdeep fight and a brawler fight twice each through
`filmstrip --seed --compare --expect-same`. The runs must match pixel for pixel (:1-31).

**`tools/doctrine-check.mjs`** (149 lines). I ran it on the copy: "doctrine ok". It checks four things:
1. **Assets.** No binary in git: a zero byte in the first 8 KB, or an extension such as .png, .glb, .fbx or .zip
   (:28-48). The exceptions are fonts and the pictures the repo's own tools draw for the docs. Two binaries are approved
   today: `docs/assets/codex-motion.gif` (1.15 MB) and `codex-showcase.png`.
2. **Token budgets** for the two manuals, in cl100k (exact with gpt-tokenizer, otherwise estimated): the agent header
   ≤ 10,000 and API.md ≤ 13,500 (:50-66). It prints 9,071 and 12,611 estimated; exact counts are 8,996 and 12,379.
3. **API boundary.** No new engine-private `_member` used outside `engine/`. Old uses are grandfathered by area, and
   prototypes may reach past the API, with their uses listed as the engine's to-do list (:68-121).
4. **The decisions log** only grows (:123-142).

**`tools/ed-sheet.mjs`, the character sheet: the motion numbers that exist** (:100-131)
- **pop:** a joint (in the body's frame, normalized by size) jumps more than 9 units in one 1/60 s step, and more than
  2.5× the larger of the steps before and after (:123-126);
- **feet slide, idle only:** total horizontal foot travel over the idle hold above 2×size (:116, :122);
- **joint under the floor:** z < −1.5×size (:118);
- **bone stretch:** max/min length > 1.12 over the declared `bones` (or the Humanoid's 8 limb bones) (:119, :128);
- **fastest joint:** units per step;
- **non-motion numbers:** silhouette pixels per view (warns when one view has < 50% of another), palette < 6 colors, and
  contrast on each theme's floor < 50% of pixels (luma difference ≥ 24) (:129-131).
- **My run on the copy:**
  - Wanderer (Humanoid): no lints; fastest joint 6.7 units a step; 8 bones measured;
  - Dan: no lints; 11.69; 13 bones;
  - Codex: three pops (handR 11.1 and 10.3, handL 12.5 units in one step) and "no bones declared".
  - The PNG is a 14-state × 4-view grid plus an 8-way turnaround and the floor swatches; viewed, it is a good
    one-image review artifact.

**Other metrics in the tests:** foot under the floor (mm), sword under the floor, fit in mm (mean and worst against the
capture), text round trip and mirror ≤ 0.5 mm, face-to-head drift ≤ 2°, spin ≥ 270°, upside down, NaN, and drawn or not
drawn (mocap-test.mjs). Pixel diffs (filmstrip). Look notes (check.mjs).

**Missing metrics, with one measured here**
- **Foot skating in locomotion.** It is not measured anywhere. The sheet checks sliding only while idle, and its "run" state
  runs in place (`['run', { vx: 84, run: 1 }]`, O:src/emberdeep/18-characters.js:83) with the body pinned at x = 0
  (ed-sheet.mjs:32-33).
  - **I measured the procedural gait** by loading the engine in Node, read-only, and stepping
    `new Humanoid({size: 1.3})` at a constant speed for 4 s at 1/120 s steps:

    | Speed (units/s) | Each foot on the ground (z < 0.3) | Both feet airborne | Planted-foot slide | Slide / body speed |
    |---|---|---|---|---|
    | 40 | 40% | 18% | 11.0 units/s | 0.28 |
    | 70 (walk) | 26% | 45% | 8.2 units/s | 0.12 |
    | 120 | 25% | 46% | 13.2 units/s | 0.11 |

    - With a looser 1.0-unit contact threshold, the slide is 0.22-0.53 of body speed.
    - heroic and bulky builds behave the same: 8-14 units/s.
    - So the "fluid" gait has no ground contact model. Stance is about 25% per foot (a real walk is ~60%), it is airborne
      almost half the time even while walking, and planted feet slide at 11-28% of body speed. At 40-60 px tall heroes
      this is mostly hidden by the stylization, but an objective metric would fail it.
- **No metric for:**
  - jitter or jerk (the pop lint covers single spikes only);
  - mesh or ground penetration beyond "joint z < threshold", and self-penetration;
  - joint-limit violations;
  - balance (centre of mass over the support polygon);
  - contact consistency;
  - loop seam continuity for glTF loops (the CMU seam is only printed);
  - stride or root-motion mismatch;
  - retarget fidelity (end-effector error after `drive`, against the clip);
  - hit-frame alignment with motion peaks;
  - a perceptual or vision-judge score. A vision judge is only planned, for the benchmark (A4).
- Depthward has no motion metrics at all (B4).

### A4. External builder feedback (Vesper, GPT-6) and the planned benchmark

Sources: O:docs/HANDOFF-VESPER-FEEDBACK.md (a temporary plan) and O:docs/FEEDBACK-LOG.md.

- **Who and what.** "GPT-6 Astra Pro", in a ChatGPT cloud workspace with a shell, Node 24 and Chromium 131. It was handed
  only `my-3d2dge.js` v0.17.2 and built "Vesper: The Ninth Bell", an isometric Assassin's Creed with climbing, guards,
  takedowns and touch UI. That is about 50k tokens of game code, plus an engine patch and 16 simulation checks
  (HANDOFF:22-38, FEEDBACK-LOG:33-44).
- **Used:** the renderer, views, TileMap, Body, FlowField, **Humanoid**, input, camera, particles, audio, font and storage
  (FEEDBACK-LOG:41-42). It also used x-ray silhouettes, props and weapon trails (HANDOFF:230-231).
- **Ignored or bypassed, for animation:**
  - **The melee helpers.** `E.Attack` and `E.Combo` were bypassed: "Combat needed explicit rules for height, perception,
    and takedowns" (FEEDBACK-LOG:48-49, theme "watch", :23).
  - **The motion store.** It went entirely unused, though "The motion store already has the traversal clips such a game
    needs: `ClimbUp_1m_RM`, Climb Wall, Ledge Hang, Pipe Climb, Crawl, `Walk_Stealth`, `Run_Stealth`, `Crouch_Walk`,
    Roll, `Dive_Roll`, `Land_Three_Point` and the NinjaJump pair ... Only `Land_Three_Point` is used by a game so far
    (Emberdeep's landing)" (HANDOFF:74-77).
  - **Multi-beat actions were written by hand.** Its output went 2.4k tokens to traversal, 1.6k to takedowns and 4.1k to
    setup, input, rigs and actor drawing (HANDOFF:56-67). The 2026-09-29 survey had ranked an `E.ACTIONS` library of
    timed, multi-beat actions first: get up, ledge climb, roll. It was "removed in v0.14.1 as unstarted", with frame
    timings such as Prince of Persia's 14 frames to hang and 17 to climb (HANDOFF:78-81; O:CHANGELOG.md:75; it can be
    read with `git show f990e9a^:docs/ANIMATION-RESEARCH.md`, but this shallow clone can't).
  - **The engine's clock.** It ran its own 1/60 s substeps because it didn't trust the engine's. The header's claim of
    identical motion at 60, 120 and 144 Hz was false: `Body.jump` peaks at 30.63, 30.77 and 31.06 depending on the step
    (HANDOFF:47, :73).
  - **The source.** It read the 150k-token source to find 28 undocumented members (HANDOFF:54).
- **The plan's animation items** (HANDOFF Phase 3, :236-251):
  - `E.ACTIONS` plus a player: multi-beat actions that move a body along a curve, with marked interrupt points
    (climbUp, played backwards to climb down; vault; hopDown; roll; getUp; and a **paired** `takedown` that drives two rigs);
  - rig states hang, wall-climb, sneak, sprint lean and heavy landing, "Build them in code first. Where code can't match
    a clip, cut a small traversal set from the store";
  - judge each action on filmstrips in 3 views.
- **The benchmark** (Phase 5, :312-329; the North Star measure "how often a fresh agent's first build runs",
  O:DOCTRINE.md:33-35). `tools/agent-bench.mjs` [proposal] hands a brief and `dist/handoff/` to a fresh coding agent in an
  empty directory and records:
  - output tokens and wall time;
  - whether the first build passes `tools/check.mjs`;
  - whether the agent opened the engine below its header;
  - a vision judge's score of the screenshots against the PS1/N64 bar.

  Three briefs: Vesper's Assassin's Creed (the baseline: about 50k output tokens, an engine patch, 28 undocumented
  members), a Breath of the Wild village and a Batman: Arkham predator room. Runs cost money, so they need the owner's
  approval; "If it fires with no answer, the call this plan recommends is to run nothing" (:326-328; O:CHANGELOG.md:12).
  **Status: planned only.** There are no results, and the tool doesn't exist in this commit.
- **Relevance to the package:** the first external builder never reached for the animation library, even with the right
  clips in the store. The store sat outside the one-file engine it was handed, which only *pointed* to it. Discoverability
  and packaging, not content, were the failure.

### A5. CHANGELOG lessons, format evolution, and how agents are told to animate

**CHANGELOG** (O:CHANGELOG.md): mocap is barely itemized there. The detailed failure stories live in docs/MOCAP.md and in
code comments, and with one commit there is no git history.
- **0.6.0** (:193-195): the move library (`E.MOVES`, `E.Combo`), poses and stances, side-view chops and weapon trails.
- **0.7.0** (:186) introduced everything mocap at once: the glTF importer, retargeting onto the Humanoid, the Mocap Lab,
  QUATERNIUS 88, MESH2MOTION 177, CMU 60 and every one of the 2,548 takes in the lab's library with a ledger. "The hero
  turns, tilts and rolls with a clip; the sword can be put away." Also the character registry, contract, test and sheet
  (:171-179), and repeatable `--seed`/`--compare` filmstrips (:188).
- **0.8.0** (:160-162):
  - Dan, with springs and IK;
  - bodies may list `rig.bones`, and the sheet measures a body's own bones instead of the Humanoid's;
  - **a pop is now a spike against the steps around it, so a long blade's fast, steady sweep is no longer flagged** (a
    false positive fixed);
  - the balance run became repeatable once the game clock moved only with its steps.
- **0.8.1** (:153-154): a map of the store went into every manual (about 600 tokens), and `npm run test:agent` checks that
  every path in it exists and that its recipe works: search the ledger, cut a curated clip and a mocap take, play both on
  the agent edition (O:tools/agent-test.mjs:185-221).
- **0.9.0** (:143): rigs, moves, the mocap player and Dan run unchanged in a three.js 3D world, as **Card** (the engine
  draws the rig onto a camera-facing card) or **Puppet**. The Puppet's 3D parts are listed as data on the same joints:
  `['limb','hipL','kneeL',1.45,1.2,'pants']` (O:src/lab3d/40-characters.js:1-19). Evidence that the joint set is
  renderer-independent.
- **0.14.1** (:75): `docs/ANIMATION-RESEARCH.md` deleted (the survey of famous animations and a never-started build list).
- **0.16.0** (:55): the agent edition caught up on clip-driven face, belt and toe tilting and on the cape trailing the
  body's turn. They had been in the full engine since 2026-10-06 and were "never ported": the cost of two editions.
- **0.16.0-0.17.2** (:25-58): sound draws its own random numbers, seeded sessions replay, and portable math gives
  bit-identical Humanoid animation in V8 and JavaScriptCore.

**How the format evolved.** These steps are documented in docs and comments, not in the CHANGELOG.
- Five candidates were compared side by side on 46 clips; readable key poses won (MOCAP.md:302-314).
- Reach as a fraction became bend in degrees (MOCAP.md:279).
- The twist reference changed from a blend of two fixed directions, which flipped, to a carried reference (readable.js:106-111).
- The encoder picks between the two Euler readings for continuity (readable.js:201-203).
- Spine shares are fitted per library (readable.js:150-176).
- Key times are stored to the millisecond.
- The finger helper points are left out of error measurements.
- `"format": 1` in every set; there has been no version bump since.

**How agents are told to animate**
- O:AI_GUIDE.md:20, "Characters are puppets, not sprite sheets. A `Humanoid` is a 3D skeleton posed by math every step".
- O:AI_GUIDE.md:64-70, "Animation: fluid, varied, readable":
  - "Moves, not raw specs. `new E.Attack('overhead')` ... Every move in `E.MOVES` winds up, strikes with a lunge, step,
    lean and twist, follows through, holds, and eases back to the stance. It never sweeps backwards through its own arc."
  - "A move set per character ... Two heroes must never share one swing."
  - "Enemies telegraph. Give enemy attacks a longer `wind` (.2-.35 s)".
  - "Check the motion. `node tools/filmstrip.mjs ... rec:16:2 press:KeyJ` ... Look for the wind-up, the strike and a
    clean settle".
- O:AI_GUIDE.md:77, hard rule 4: "Animate with continuous values (phases, velocities, eased timers), never frame lists."
- O:AI_GUIDE.md:314-318 (lessons from Emberdeep): add new animation by post-processing the Humanoid's joints after
  `rig.update` (a dodge roll turns every joint around the hips; drinking re-solves one arm with `E.ik3`).
- O:AI_GUIDE.md:324-331 and O:API.md:204-206: find, take, play and edit motion clips.
  - **Find** in the catalogs or with `cmu.mjs ledger`. **Take** with `anim-set.mjs --clips ... --name MINE`.
  - **Play** with `Mocap.load` / `Mocap.drive`, setting `rig.mocap = lib.sample(...)` each step.
  - **Edit**: "a clip is text. Change a key pose's numbers to fix or vary it".
- O:API.md:216-217: "check every attack with it (a swing must wind up, strike, and settle back without jerks or backward
  sweeps)"; "every character has its own moves from `E.MOVES`".

### A6. "Front-runners"

The word appears in exactly two places in either repo (grep over all files):
- O:DOCTRINE.md:157-159: "The owner reviewed what was grandfathered and kept it (D10): my-3D2dge differs from the
  front-runners on purpose (pixel art drawn by code in the classic views, one HTML file that works anywhere)".
- O:docs/DECISIONS.md:143 (D10): "this engine is uniquely different from the four front-runners, and that counts for something".

**They are never named.** No other engine is named in the docs either; the only "Unreal" hits are bone-name maps
(MOCAP.md:44, :112, :364). The repo characterizes them only by contrast with what D10 kept: Canvas 2D instead of
WebGPU-only (D3), determinism from the test harness instead of the engine (D4), one-file pages (D5) and grandfathered
private-member uses (D6) (O:docs/DECISIONS.md:136-145). The doctrine was adopted from a "draft 'Agent-First Game Engine:
Doctrine'" (D1, :23-26).

My inference, unverified: the four front-runners are the owner's competing agent-first engine candidates that follow the
draft doctrine literally (WebGPU, engine-level determinism, multi-file). Depthward, with three.js on a deterministic
60 Hz sim, is a plausible member of that set. **Ask the owner.**

---

## Part B: my-3d2dge-2 (Depthward)

Size: `src/` is 26,299 lines of TypeScript (1.28 MB). 143 Vitest `it()` cases across 17 files; kit.test.ts has 21 and
agent-tools.test.ts 17.

### B1. How character animation works

**Assets and the manifest**
- **Shipped files** (D:public/assets, 5.1 MB): `anims/ual1.glb` (1.19 MB) and `ual2.glb` (1.28 MB), plus 14 model GLBs:
  mannequins, heads, outfits and hair, all on one **65-joint UE5-style skeleton** (`manifest.json`, 946 lines, 7,046 tokens).
- **The manifest's notes:**
  - "All models share the 65-joint UE5-style skeleton names; rest poses differ slightly, so the runtime retargets
    rotations by rest-pose deltas";
  - "Clips are in-place: translation only on pelvis, no scale tracks. rootSpeed (m/s) is measured from the root-motion
    variants and used to match stride to movement speed".
- **Clips:** 86 in all (UAL1 and UAL2 each include an A_TPose). Each entry is `{name, lib, file, duration, loop,
  rootSpeed}`; for example `Walk_Loop(1.33, loop, rs=0.97)`, `Jog_Fwd_Loop(0.93, rs=5.36)`, `Sprint_Loop(0.67, rs=8.25)`.
- **The asset pipeline** (D:tools/build-assets.mjs:1-21, 313 lines):
  - downloads the free Quaternius packs from itch;
  - strips the meshes from the animation libraries, and every scale track and every translation track except `pelvis`,
    "so characters keep their own bone lengths and runtime bone scaling (chunky heads/hands) is not overwritten" (:223);
  - removes redundant keys with `resample({tolerance: 1e-4})` (:231);
  - measures `rootSpeed` from the `_RM` variants (:194, :248);
  - simplifies triangles to 30-60%, keeps textures ≤ 256 px, cuts heads out by skin weight;
  - packs buffers with meshopt and textures as lossless WebP (7.6 → 5.3 MB, from the build log PR #30).
- **`AssetLibrary`** (D:src/render/assets.ts:46-116, 1,003 tokens) loads the manifest and GLBs, through an embedded-asset
  map in the standalone build (:58-65). It caches retargeted clips per (rest pose, clip) (:104-115). `clipTable()` hands
  the sim only `{duration, loop, rootSpeed}` (:33-35).

**Retargeting** (D:src/render/retarget.ts, 79 lines, 873 tokens): rest-pose deltas between skeletons that share bone names.
- **Why it is needed:** the packs' bind poses differ from the mannequin the clips were authored on by up to ~11° at
  spine_03, ~6° at the neck and ~12° at the thumbs (:4-6).
- **The correction:** `C_b = W_src(b)⁻¹·W_dst(b)` and then `q_dst = C_p⁻¹·q_src·C_b` for every rotation key (:7-11,
  :42-71). Pelvis translation is scaled by the ratio of pelvis heights (:72-75). Tracks for bones the target lacks are dropped (:62).
- **What it is:** exact for the same topology and naming. It has no name mapping, no proportion handling beyond the
  pelvis, and no IK clean-up.

**CharacterView** (D:src/render/characterView.ts, 349 lines, 3,704 tokens)
- **Assembly:** `SkeletonUtils.clone` of the base model, with every part's skinned meshes **rebound to the base skeleton's
  bones by name** (:101-116). That makes modular characters on one skeleton.
- **Looks:** toon materials, tints and glows, occlusion silhouettes as stencil-tested skinned copies (:120-153),
  hand-tuned grip transforms for the weapon, off-hand and helmet bones (:178-202), and chunky proportions through bone
  scale (`render.headScale` 1.2, `handScale` 1.25, :239-245; D:src/config.ts:46-47).
- **`pose(p)`** (:256-279) uses three.js `AnimationMixer` **only as a stateless evaluator**. It sets `action.time` and the
  weights of at most two actions (current and previous, for the crossfade), then calls `mixer.update(0)`. "Pose the
  skeleton exactly at the given clip times (no mixer clock)". If the pose input hasn't changed it skips the work, and
  that is most frames, since poses change only on sprite ticks (:86-87).

**The sim owns animation state, deterministically** (D:src/sim/sim.ts, 1,730 lines)
- **`AnimState`** is `{clip, time, speed, prevClip, prevTime, prevSpeed, blend}`.
  - `play()` starts a clip with a crossfade from the previous one (`anim.blend` 0.1 s) (:933-945).
  - `advanceAnim` loops or clamps it and advances the blend (:959-972).
  - `clipDone` (:974-976).
  - `anim.time` is part of the state hash (:1716).
- **The state machine** is a hand-written `switch (ch.state)` (:1094-1230) over `CharState = idle | move | air | land |
  attack | recover | hit | dead | forced | action | stun` (D:src/sim/types.ts:19). It is not a data-driven graph. There
  are no blend trees, layers, masks, additive poses or IK.
  - hit: recover when the clip is done (:1112-1123);
  - action: cancel windows, buffered `next`, dodge-cancel (:1124-1170);
  - recover clips after combo hits (:1161-1167);
  - jump: `jumpStart` from 0.35 s at 1.25× speed, then `jumpLoop`, then `jumpLand` from 0.25 s at 1.3× (:1220-1229, :1284-1288).
- **Locomotion** (:1310-1328): walk, run or sprint is chosen by speed thresholds. **Playback rate =
  speed/rootSpeed, clamped to [0.5, 1.8]**: stride matching from the measured root speed. When pushing a crate, a push
  clip plays. Idle or talk depends on the distance to the player for NPCs.
- **Sprite ticks** (:1636-1652): poses and facing are sampled into `SpriteState` only on ticks (`anim.fps` 12, so every
  5th sim frame at 60 Hz), with facing snapped to 8 directions (`anim.dir8`) (D:src/config.ts:48-51).
  - The stage interpolates positions by `alpha` and snaps them to the art-pixel grid, but poses stay stepped
    (D:src/render/stage.ts:418-462).
  - Tested: "samples poses and facing only on sprite ticks, snapped to 8 directions" (D:tests/kit.test.ts:264-290).

**How gameplay drives animation and syncs hits** (data in D:src/content/skills.ts, code in D:src/sim/actions.ts)
- **The skill** is a timeline normalized to 0..1, whose base duration `time` is scaled by attack or cast speed, slows
  and difficulty (`skillSpeed`, actions.ts:34-47). "attack speed literally speeds up the animation" (D:docs/GAME-DESIGN.md:112).
- **`anim`** is an `AnimSpec` or a list of them: `{clip, from?, to?, span?, spin?}` maps clip seconds onto a span of the
  timeline (skills.ts:16-25). `animSegments()` fills unspecified spans (:513-525).
  - Example: Ground Slam is `NinjaJump_Start` (0.1-0.62 s) over 55% of the timeline, then `NinjaJump_Land` (0-0.7 s)
    over 45% (:212).
- **`effects[]`** fire at a normalized `at`, in order (actions.ts:293-294): strike, projectile, zone, chain, sweep, buff,
  summon, heal, selfDestruct (skills.ts:86-94). **That is the hit frame and notify mechanism:** `slash1` strikes at 0.55
  of `Sword_Regular_A`, `slash2` at 0.48, `slash3` at 0.64 (:158-180). The `at` values are authored by hand against the
  clip; nothing detects contact or the motion peak.
- **Telegraphed strikes** become zones at the cast's start with `delay = at*dur`, so the warning lasts the whole wind-up
  (actions.ts:205-213).
- **The clip is scrubbed by the timeline** (`scrubClip`, sim.ts:953-957; actions.ts:297-301): animation follows gameplay
  time, not the reverse. Only the blend weight advances by itself (sim.ts:1295-1300).
- **Root motion is gameplay data, not taken from the clip:** `motion: {kind: lunge|dash|leap|blink, from, to, speed |
  distance, toAim, ghost, height, over}` (skills.ts:96-111; actions.ts:261-286). A leap's visual arc is
  `height*4u(1-u)` (:277-280).
- **Other timeline windows:** `iframes: [a, b]` (:287), `cancelAfter` (fluid combat), `next` (combo buffer) and
  `channel {from, to}` loop windows for held skills (:241-260).
- **Hit feel:** a local hitstop freezes the attacker's animation and action for 1-4 frames (actions.ts:453-457;
  D:src/sim/types.ts:189-190). Heavy hits add a global hitstop.
- **The legacy sandbox combo** uses `step.impact` as a share of the clip's duration (sim.ts:1182), the same idea as O's `hitAt`.

**The kit** (D:kit/3dpixel2d.ts, 2,361 lines, 32,074 tokens; the header plus example to §1 is 6,672 tokens)
- It repackages this as `World.play/clipDone` (§10 :1321-1560) and `ActorView` (§11 :1561-1631). ActorView takes optional
  skeletal clips posed exactly at sim times, or a `pose(p, view)` procedural callback that runs only when the pose changes.
- Its rule 4 (:44-45): "Movers are drawn on whole art pixels (snapToGrid) and posed only on sprite ticks (anim.fps, 12 by
  default) with 8-way facing. That is what makes 3D read as hand-drawn sprites."
- The kit leaves out retargeting, creatures and Rapier (:93-97).

### B2. Procedural creatures (`D:src/content/procgen/creature.ts`, `D:src/render/creature/*`)

- **The genome** (creature.ts:17-48; 265 lines, 6,561 tokens) is plain data: plan, seed, length, height, pitch, girth,
  spine, taper, hump, squash, neck, head (shape, size, eyes, jaw), horns, tail (segments, tip), legs (pairs, length,
  thickness, `joints: 2 | 3`, splay, foot), arms (pincer), spikes, plates, wings, tentacles, float, pattern and `stride`.
  - **Plans:** 8 body plans (quadruped, hexapod, arachnid, biped, serpent, floater, centipede, blob) (:13, :50) and 16
    presets with biases (wolf, boar, drake, spider, scorpion, beetle, crab, serpent, wyrm, brute, raptor, eye, wisp,
    centipede, spore, slime) (:53-70).
  - **Edits:** `GenomeEdits` merge per field. Values are clamped to what the rig builder supports, and unknown fields throw
    with the list of valid ones (:79-113).
  - **Workshop share codes** are about 225 characters (D:README.md:8).
- **Genome to skinned mesh** (D:src/render/creature/build.ts, 589 lines, 10,205 tokens):
  - Bones are created at rest with **identity rotations, so every animation rotation is about world-aligned axes**.
  - Body, neck, tail and limbs are tubes skinned along their bone chains, with joints blended 50/50. Heads, eyes, horns,
    spikes, plates and feet are rigid to one bone. One SkinnedMesh, two materials (:1-7, :186-200).
  - **Gait phase offsets per plan** (:433-441): quadruped trot pairs, hexapod and arachnid alternating tripod or
    tetrapod groups, a centipede wave of `pair*0.8`.
  - Legs with 2 joints (vertebrate) or 3 (arthropod, with a `mid` bone) (:442-487).
- **Animation** (D:src/render/creature/view.ts, 305 lines, 4,255 tokens): "There are no keyframes anywhere" (:1-10).
  `poseCreature(rig, state)` is a pure function that resets every bone to identity and sets FK rotations (:156-304).
  - **Gait phase** advances with distance travelled divided by `genome.stride*scale` (:99-104), which is stride matching.
  - **Locomotion** per plan (:167-214): blobs hop and squash; floaters bob with waving tentacles; serpents and centipedes
    wave the spine; legs swing as `sin(phase+leg.phase)` and lift as `max(0, cos)`; arthropods swing around the vertical
    axis; tails sway; wings flap.
  - **Actions:** the skill's `pose` hint (bite, claw, slam, spit, cast, charge, roar, leap, burst) shapes the timeline's
    progress through **fixed windows: wind 0-0.42, strike 0.42-0.58, recover 0.6-1** (:216-283; `CreaturePose`,
    D:src/content/skills.ts:113).
  - **Reactions:** hit flinch, stun wobble, death roll (:285-303).
  - **Previews:** `PREVIEW_POSES` = idle, walk, bite, claw, slam, spit, roar, hit and dead, through `previewState(pose, u)`
    (D:src/render/creature/studio.ts:14-27).
- **How well it generalizes:**
  - **Strong:** genome to rig is general, data-driven and deterministic. It holds 8 plans with clamped edits, a rigInfo
    summary, and agent tools to render any seed or pose. Bones at identity rest make procedural rotation math trivial.
  - **Weak:** the motion is FK sinusoids: no IK, **no foot planting or ground contact (feet slide, no terrain
    adaptation)**, no balance and no secondary dynamics. Pose code is hand-written per plan and per pose. The strike window
    (0.42-0.58) lines up with a skill's effect `at` only by convention; nothing checks it.
  - It cannot play authored clips: creatures have no retargeting path. And there is no shared skeleton standard across
    plans, so motion can't move between species.
  - O's `BST_Crawler`, with planted IK feet and stepping groups, is the better locomotion model.
  - **Doc drift:** creature.ts:4-6 points to `render/creature/animate.ts`, which doesn't exist; the code is in `view.ts`.

### B3. The agent tool system

**Registry** (D:src/agent/registry.ts, 181 lines, 2,172 tokens)
- **`defineTool({name, group, desc, params, needs?: 'game', example?, run(args, ctx)})`** (:50-70). A `ParamSpec` is
  `{type, desc, default, enum, items, min, max, required}` (:22-32).
- **`schemaOf`** derives the JSON Schema (`additionalProperties: false`) used as the MCP `inputSchema` (:81-95).
- **`validateArgs`** (:107-135):
  - rejects an unknown parameter, listing the valid ones;
  - names a missing required one with its description;
  - checks type, enum and range;
  - coerces CLI strings to numbers and booleans;
  - fills defaults.
- **`callTool`** answers an unknown tool with "Did you mean ...?" (:157-161). Results are
  `{ok, data, images, ms} | {ok: false, error, ms}`.
- **Images:** a tool calls `ctx.image(name, img, scale)` and puts the returned reference string in its data. The CLI
  replaces it with a written PNG path, MCP returns image content, and the console gets a data URL (:13-14, :163-171;
  D:tools/lib/agent-session.mjs:94-113).

**Tools.** There are **46** `defineTool` calls: 26 in `content.ts`, 14 in `world.ts`, 4 in `render.ts` and 2 in `audio.ts`.
README.md:84 still says "42": stale. AGENTS.md, llms.txt and ai-catalog.json say 46.
- **Pure** tools (`content.ts`, 17,735 tokens) run under Vitest too, and agent-tools.test.ts runs every tool's example.
- **Live** tools (`needs: 'game'`) need the renderer.

| Group | Tools |
|---|---|
| meta, catalog | help, catalog.list |
| creature | creature.genome, species.create, species.design, bestiary.list, monster.inspect, encounter.roll |
| item | item.roll, unique.design, loot.simulate |
| level | campaign.list, level.generate |
| tree, hero | tree.inspect, tree.path, tree.render, hero.build, skill.inspect, skill.test |
| balance | replay.verify, balance.curve, balance.run, balance.campaign |
| config | config.get, config.set, difficulty.set |
| render | creature.render, creature.lineup, monster.render, item.icon |
| world (live) | game.state, game.goto, game.step, game.input, hero.set, hero.sheet, hero.give, monster.spawn, bot.play, bot.autopilot, scene.capture, theme.design, scene.stats, logs.read |
| audio | audio.list, audio.inspect |

- **Animation-relevant tools:**
  - `creature.render`: a sprite sheet with rows = pose × direction and columns = frames, plus rig info (bones, limbs,
    height) (D:src/agent/tools/render.ts:23-43; `renderCreatureSheet`, D:src/agent/forge.ts:37-87; `rigInfo` :89-96);
  - `creature.lineup`: a contact sheet across seeds (render.ts:45-73);
  - `monster.render`: humanoid idle, run, attack and death clips as an 8-fps sprite sheet (`renderSpriteSheet`,
    D:src/agent/capture.ts:221-286), or a creature sheet (render.ts:75-106);
  - `skill.inspect` / `skill.test`: timeline effects, casts and hits;
  - `game.step`: exact frames; `game.state`: `sprite.frame/frames/dir` per character (sim.ts:1688-1694).
  - **No tool lists, inspects, edits or quality-checks clips.** The manifest exposes names, durations and rootSpeed only.
- **Capture helpers** (capture.ts, 287 lines):
  - `captureFrame` reads exact low-res pixels, "so images are small, lossless and match what the pixel pipeline
    produced" (:1-5, :65-80);
  - `entityBoxes` and `annotate` draw labelled boxes for vision models (:81-138);
  - `renderIsolated` (:139), `countColors` (:156-166), `diffPixels` (threshold > 2, :168-176), `grid` (:185-201);
  - `withConfig` applies temporary config overrides (:204-215).
- **`probe.ts`** (83 lines) makes throwaway sims (an empty room, spawn and measure) for inspection that never touches the
  live game's RNG (:1-27; the AGENTS.md:11 rule "UI and tools must never consume the sim RNG").

**Four transports over one registry**
- **Browser:** `window.agent.call` / `tools` / `step` / `idle` (D:src/agent/api.ts:1-36). It exists in every mode.
  `?agent` starts paused, with human input, saves and settings profiles off (D:README.md:52, :107).
- **CLI** (D:tools/agent-cli.mjs, 86 lines): `npm run agent -- tool k=v` or a JSON object; `--script steps.json` runs
  several calls in one session; `repl`; `--url`, `--standalone` or Vite in-process.
- **MCP** (D:tools/mcp-server.mjs, 135 lines, 1,425 tokens): stdio JSON-RPC 2.0 written by hand, with **no SDK
  dependency**.
  - It answers initialize, ping, tools/list and tools/call, and empty resources/prompts; `instructions` is a 5-line
    briefing (:34-40, :72-105).
  - Names map `.` → `_`, and descriptions are prefixed with `[group, live game]` plus the example (:46-55).
  - Text is truncated at 120k characters; images come back as MCP image content and are also written to `.agent/out/` (:57-70).
  - Calls are serialized so live-game steps never interleave (:124-125).
  - It is registered in D:.mcp.json.
- **WebMCP** (D:src/agent/webmcp.ts, 60 lines) registers on `navigator.modelContext`, when the browser has it, behind
  feature detection. It caps at 40 tools (Lighthouse's advice) and excludes 6 diagnostics and batch runs, warning when the
  cap drops tools (:22-31).
- **The session** behind the CLI and MCP (D:tools/lib/agent-session.mjs:21-121) is persistent headless Chromium with
  SwiftShader WebGL, so no GPU is needed (`--use-angle=swiftshader`). It boots once and is shared, records page errors
  and restarts after a crash (:45-83).
- **Discovery:**
  - D:public/llms.txt (552 tokens): what it is, play links, docs and the kit;
  - D:public/.well-known/ai-catalog.json: an MCP server card (`application/mcp-server-card+json`) with
    `representativeQueries`, plus entries for the llms guide and the kit;
  - "Lighthouse's agentic-browsing audit scores 100" (D:README.md:89).
- **The kit** holds a single-file engine whose header is the contract, and D:tests/kit.test.ts keeps its shared code
  identical to the source (GLSL, config, RNG, grid, palettes, materials, pixel font, tool registry). `verify:kit` plays
  its demo headless.

**Patterns worth reusing for an animation package's agent interface**
1. One typed registry fanned out to every transport: console or JS API, CLI with JSON scripts and a REPL, a zero-dependency
   stdio MCP server, WebMCP. Schemas, examples and "did you mean" come from one definition.
2. Image results as references written to files plus inline MCP images. Exact low-res captures. Sprite and contact sheets
   with labelled rows (pose × direction × frame).
3. Pure versus live tools: everything that can run headless in Node runs under unit tests, and each tool's example is a test.
4. Persistent headless sessions, exact `step(frames)`, a paused agent mode with human input off, and determinism checks
   (`replay.verify`, state hashes).
5. Discovery files (llms.txt, an ai-catalog server card with representative queries) and a token-budgeted
   header-as-manual (O's doctrine-check budgets; D's kit header at 6.7k tokens).
6. From O: deep links to any moment (`mocap-lab.html#Dance_Loop?set=hero&view=side&speed=.25`, O:src/mocap.game.js:9-11),
   a console handle (`window.__mocap`, :381), and a "Copy for a model" panel that pairs the legend with the clip text.
7. **Missing in both, and needed:** animation-domain tools such as `clip.search`, `clip.inspect` (text plus metrics),
   `clip.edit` (validate and preview), `clip.render` (filmstrip or turnaround), `clip.qa` (skating, contacts, jitter),
   `retarget.preview`, `library.contribute`.

### B4. The binary-asset tension

| | O: text key poses only (binaries banned) | D: committed GLBs |
|---|---|---|
| Rule | Doctrine principle 4: procedural first, then readable text or data; binary only with approval. Enforced by O:tools/doctrine-check.mjs:28-48 (only fonts and docs pictures pass) | `public/assets/` is one of the "intentional tracked deliverables" (D:AGENTS.md:15); `*.glb binary` in D:.gitattributes |
| What ships | 4 curated sets, 2.0 MB of text (`src/mocap/sets`), plus a 70 MB text CMU library; the clips play on procedural rigs drawn by code | 5.1 MB of packed GLBs (16 files: 14 models, 2 animation libraries); the standalone HTML is 11.2 MB with the assets embedded |
| Same source, side by side | QUATERNIUS (UAL1+UAL2, 88 clips): 387 KB raw, **74 KB gz** | ual1.glb + ual2.glb (86 clips): 2,465 KB raw, **1,062 KB gz** (already meshopt-packed): ~14× larger gz |
| Fidelity | Lossy: a mean body-point error of 13.9-17.8 mm per set, worst up to 286 mm; 36 points; no fingers; hand fixed in line with the forearm; linear in-betweens | Full 65-bone rotation tracks at authoring rate (resampled at tolerance 1e-4), fingers included |
| What it bought | An agent can read, grep, diff and edit motion (the lab's "raise the right arm in every key" edit is tested, mocap-test.mjs:140-147). Provenance sits inside each clip (src, orig, take, license). Token-measurable. One-file HTML delivery. Mirror and round-trip tests. A library that grows by text PRs. Size-independent playback on any build | Real skinned, modular characters on one skeleton. Native three.js loading and AnimationMixer evaluation. Production-art path. Near-zero pipeline code at runtime. The kit stays small |
| What it cost | About 1,000 lines of importer, fitter and codec (readable.js 339, anim-import 264, asf-amc 176, cmu 259); a Blender (`bpy`) side path for FBX, BVH and .blend; source GLBs not kept (re-import means downloading again); no skinned meshes, so procedural drawn rigs only; the CMU library at ~35M tokens est. is bigger than binary would be; even the doctrine had to approve two binary pictures | Agents can't read or edit clips: only names, durations and rootSpeed are visible. Clip semantics (hit frames, contacts) live in hand-authored skill data. No fit or quality metrics. Rebuilding needs network plus gltf-transform, sharp and meshoptimizer. Opaque diffs and repo weight. A license notice must travel (D:public/assets/LICENSE-quaternius.txt) |

**Takeaway:** neither extreme suits a package. The readable text is the right *authoring and agent interface*, plus the
source of truth for edits and provenance. A compact runtime track (binary, quantized, or glTF output generated from the
text and checked against it with a recorded error) is the right *playback artifact*. Make the generated artifacts
reproducible from text plus pinned sources, so the "no unexplained binaries" rule survives.

---

## Part C: Synthesis for a standalone, AI-agent-first animation package

### C1. Keep / port / rewrite / drop

| Area | Keep (ideas, as they are) | Port (code, lightly adapted) | Rewrite | Drop |
|---|---|---|---|---|
| **Format** | Readable key poses: whole numbers, named fields, three short lines per key; limbs as direction + bend + twist (flip-free, IK-ready); size-independent; mirror-friendly; a ~440-token legend; per-clip `fit`; `src`/`orig`/`take` provenance; per-library spine shares (O:src/mocap/readable.js) | `parse` / `text` / `mirror` / continuity encoding (Euler dual reading, unwrap, carried twist reference) | A versioned schema (JSON Schema plus a `format` field per clip) with: a skeleton profile id; contacts and events channels; root motion and stride speed for every locomotion clip; optional hand channels (finger curls, a wrist bend, removing the "hand straight off the forearm" limit); optional face channels; an interpolation mode (linear, plus optional cubic tangents); a dense or quantized runtime sidecar generated from the text | O's 36 fixed points as the only skeleton; the mm error in a pixel-art frame of reference ("1 px ≈ 24 mm") |
| **Fitter** | Error-budgeted keying against the format's own floor (RDP, then add the worst frame), a recorded mean and worst error per clip, budgets enforced in tests (O:readable.js:139-146, :287-302) | The ~60 lines of `reduce`/`fit` | Per-joint-group budgets (feet and hands tighter); contact-preserving constraints (a planted foot stays within N mm); timing-preserving constraints (keep peak and impact frames; MOCAP.md:314 warns that frame-rate cuts skip contacts); speed beyond O(n²) for long takes | |
| **Importers** | A dependency-free glTF reader; the FK sampler; catalog-driven tags and provenance (`$sources`, `$skip` with a reason, `$pick` with take and seconds) | `anim-import.mjs` core (:122-229); `asf-amc.mjs` (Acclaim FK, loop-cycle search, seam spreading, floor mode); `cmu.mjs` survey and ledger mechanics; `to-glb.py` as an optional offline path | A general **skeleton-mapping layer**: auto-detect plus overrides for Mixamo, VRM humanoid, Unreal/UE5, Rigify, CMU, BVH (100STYLE), MotionBuilder HumanIK; a native BVH and FBX path without Blender where feasible; record the import and fit report per clip | Hard-coded RIGS of 2 entries; regex categories as the only classification (keep as a fallback, add model-written descriptions plus human review) |
| **Catalogs and provenance** | One catalog line per clip (~35 tokens) for search, never motion data; the ledger idea (every source take measured, flagged, with a note column); license per library; `orig` chains for derived clips; "search, never read a file whole" | catalog JSON shapes; `anim-set.mjs` (cut a small set and keep the source records) | A registry manifest with content hashes, SPDX license ids, attribution (human, agent, model), review state, QA metrics, dependency chains (derived from X), and a contribution protocol (PR, automated QA gate, human or agent review) so other AIs can grow the library | Per-game sets as the unit of distribution (HERO) |
| **Retargeting** | O: "borrow directions, keep your own bone lengths, re-solve limbs with IK, heading from the chest, tilt frames for details, upper-body mask, weight fade" (mocap.js:165-262). D: rest-pose delta correction for same-named skeletons (retarget.ts:42-78) | D's `retargetClip` as the same-topology fast path; O's frame helpers (`frame3`, `tiltFrom`, `frameMix`) | A general retargeter onto arbitrary skinned skeletons: bone mapping, rest-pose normalization (T or A pose), proportion scaling, IK fix-ups that preserve contacts and hand targets, root-motion scaling, per-chain options; validate with end-effector error metrics | Retargeting onto one fixed 15-joint procedural rig as the only target; monkey-patching `rig._pose` |
| **IK** | Analytic two-bone with a pole (`ik3`, O:engine/my-3d2dge.js:131-143; the twist and pole helpers `hintFor`, `poleOf` and `poleHint` in readable.js:112-123) | `ik3`, `bendOf` / `reachOf` | A solver set: two-bone with soft limits, FABRIK/CCD chains (tails, spines, tentacles), look-at/aim, foot placement with ground probes, hand IK to props, a full-body-lite pass (pelvis offset for reach) | |
| **Procedural moves** | Data-first phase specs (wind, active, recover with anticipation, overshoot, hold, return by position; `rel` scaling with build; `E.MOVES`, 25 moves in 1.8k tokens); O's moment table (`HCL_MOVES`: speed, fade, mask, walk, hold, landed, at, next); D's skill timeline (anim segments mapping clip seconds onto spans, effects `at`, motion windows, iframes, `cancelAfter`, channel loops, telegraph delay = `at`·dur); critically damped springs and angle blending (Dan); the crawler's planted-foot stepping groups (`BST_Crawler`) | Attack and Combo timers as a generic "phased action" player; the crawler stepping algorithm; D's `animSegments` | A procedural layer that works on any skeleton (overlays on clips: lean, look-at, hit reactions, breathing; procedural gaits for multi-legged rigs with real foot planting); a multi-beat **actions** library (climb, vault, roll, get-up, paired takedowns: the never-built `E.ACTIONS`) | The chibi Humanoid rig and its pixel drawing; the sinusoid gait without contacts (measured slide 11-28% of body speed); creature FK sinusoids without IK |
| **Verification** | Seeded virtual clock plus pixel-diff filmstrips (`--seed`, `--compare`, `--expect-same`); the one-image character sheet (state × view grid, turnaround, numbers a model trusts more than its eye); contact sheets per clip; round-trip and mirror tests; determinism and replay tests; doctrine-style budget and boundary checks | `filmstrip.mjs` virtual clock (:41-55) and diff (:113-143); `ed-sheet.mjs` lints (:100-131); `anim-sheet.mjs`; mocap-test check patterns; D's `captureFrame`, `entityBoxes`, `diffPixels`, `renderSpriteSheet` | A motion-QA library with objective, per-clip report cards: foot skating (stance-phase slide), contact detection and consistency, jitter and jerk spectra, pops, penetration (ground and self, on a skinned mesh), joint-limit violations, bone stretch, balance (centre of mass over support), loop seam continuity, stride versus root speed, retarget end-effector error, hit-frame versus velocity-peak alignment; plus a vision-judge harness on filmstrips | Look notes tuned for a PS1/N64 pixel style (colors < 40, checkerboards) as general quality signals |
| **Agent interface** | D: one typed registry to console, CLI, MCP and WebMCP; schemas, examples and "did you mean"; image references; pure versus live tools tested with their examples; persistent headless session; llms.txt and ai-catalog. O: deep links, a console handle, the legend paired with clip text, manuals with token budgets and a check | `registry.ts` (`defineTool` / `schemaOf` / `validateArgs` / `callTool`); `mcp-server.mjs` (zero-dependency stdio); `agent-session.mjs`; `webmcp.ts` | Animation-domain tools (search, inspect, edit, preview, retarget, QA, contribute, cut a set); a text-first, headless runtime (Node, no DOM) so agents can sample, measure and QA clips without a browser, using a browser only for rendered checks | Game-control tools (loot, tree, campaign, bot) |

### C2. Game-specific; do NOT carry over

- **Pixel-art presentation.** `_drawHD`, `_drawClassic`, capsules and tone ramps, the cheated 3/4 turn, `charView`, smear
  ribbons, hats, faces drawn in pixels, portraits (O §11 drawing, :2092-2461). D's sprite ticks at 12 fps with 8-way
  facing snaps (D:src/sim/sim.ts:1636-1652; kit rule 4) belong in a renderer-side *stepping option*, not the core.
- **The chibi Humanoid** with its 15 joints and baked "builds" (chibi, heroic, bulky, skeleton), the weapon set (sword,
  gun, staff), the blade direction tied to the right hand, `mocapBlade`, and the sword-floor rule.
- **Emberdeep integration:** the HCL triggers (death causes, YOU DIED panel timing, town UI moments), the event names on
  its bus, the gallery reels, `ownLayers`, `prime`, the character registry fields (saveKey, kit, dollHeight, menuNotes).
- **Melee gameplay helpers:** `E.inArc`, `hits()` target loops, `E.knockback`, Combo input buffering. Keep only the
  *timing and notify* contract.
- **Depthward's ARPG systems:** skill stats and costs, attack speed from weapons, telegraph zones as gameplay, hitstop
  numbers, Rapier character controllers, NPC talk distances. Also its Quaternius-specific asset recipes: heads cut by
  skin weight, outfit hoods hidden under helmets, hand-tuned grip offsets, the `headScale`/`handScale` chunky look.
- **Doctrine specifics:** the one-HTML-file rule, Canvas 2D, and token budgets sized for those manuals. Keep the
  *practice* of budgets and checks, not the numbers.
- **The CMU regex categories and the Emberdeep-driven `$pick` choices.** Useful seeds, not a taxonomy.

### C3. Gaps a standalone package must fill (neither repo solves them)

| Gap | O today | D today |
|---|---|---|
| Retargeting onto arbitrary skinned skeletons (glTF, VRM, Mixamo, Unreal-style, Rigify, CMU, BVH) | 2 bone maps plus CMU, *into* the 36-point format; output only to the 15-joint drawn rig | Same-named UE5 skeletons only (rest deltas); no name mapping |
| Skinned-mesh playback | None (rigs are drawn procedurally; the Puppet/Card labs are prototypes) | Yes, through three.js AnimationMixer as an evaluator; no engine-agnostic runtime |
| Blend trees and state machines | Weights in code; the HCL moment table; Combo | A hand-written `switch` state machine; 2-clip crossfades; speed-threshold walk, run and sprint picks |
| Root motion | `root` only for travelling clips; in-place loops have no stride speed | `rootSpeed` measured per clip; playback rate scaled (0.5-1.8×); skill motion synthesized from data |
| Foot locking and contacts | Only `BST_Crawler` plants feet; the Humanoid gait slides (measured above); retarget keeps no plants | None (creatures slide; clips rely on the authored motion) |
| Events and notifies (hit frames) | `hitAt` as a share of the active phase; HCL `landed` | Skill `effects[].at` (normalized), authored by hand; nothing in the clip format |
| Fingers and hands | Not imported; fists | Present in the GLB tracks, unused by tools; grips hand-tuned |
| Faces | Pixel faces with expressions on the drawn rig; nothing in the format | None |
| Creatures and quadrupeds | Hand-written custom rigs (Dan, crawler, serpent, eye) per body | Genome-to-rig for 8 plans; FK sinusoid motion; no clips, no IK |
| Physics-based secondary motion and ragdolls | Verlet cape and hair on the Humanoid | None (Rapier bodies drive capsules, not limbs) |
| Compression | Key selection by error budget (the format *is* the compression); no quantization | meshopt packing; resample tolerance 1e-4 |
| Performance and LOD | Crowd tricks in the 2D renderer; skip-if-unchanged posing | Pose only on sprite ticks; skip unchanged poses; one skeleton texture per part (a GPU leak fixed in PR #24) |
| Additive and layered animation, masks, IK overlays | `mocapMask = 'upper'` only | None |
| Animation QA metrics (skating, jitter, penetration, balance) | Pops, idle slide, under floor, stretch | None |
| Library growth by other AIs | Text PRs in principle; no contribution protocol, hashing, review or QA gate | None |
| Discoverability from the artifact an agent is handed | The store sat outside the one file; the GPT-6 builder never used it (A4) | MCP card, llms.txt, kit; no animation tools |

### C4. Measured numbers worth quoting

**Sizes and tokens**
- O engine: 5,063 lines and 152,633 tokens. The Humanoid class: 720 lines and 27,865 tokens (9,230 posing, 14,870
  drawing). Attack, Combo and MOVES: 3,732 tokens. `E.MOVES`: 25 moves in 1,818 tokens.
- O agent edition: 2,889 lines and 83,774 tokens; its manual header is 8,996 tokens (budget 10,000). API.md is 12,379
  tokens (budget 13,500), AI_GUIDE.md 9,953, MOCAP.md 11,174, CHARACTERS.md 3,002.
- The format's LEGEND: 440 tokens. One key pose: 137 tokens. ~150 tokens per key, ~1.4k per second of motion, ~3k per clip.
- The 325 curated clips: 6,469 keys, 693 s, ~970k tokens. Catalogs: ~35 tokens a clip (11.4k for all 325). The ledger:
  120.7k tokens for 2,548 takes. The CMU library: 70.4 MB, ~35M tokens est.
- Format choice (46 UAL1 clips): readable 615 poses and 31 KB gz against every frame, 2,078 poses and 118 KB gz.
- Text against GLB for the same Quaternius libraries: 74 KB gz against 1,062 KB gz.
- D: `src/` is 26,299 lines. The kit is 2,361 lines and 32,074 tokens (header and example 6,672). `retarget.ts` is 79
  lines and 873 tokens. CharacterView 3,704 tokens. Creature build plus view plus genome: 21k tokens. The agent registry
  is 2,172 tokens and the MCP server 1,425. `public/assets` is 5.1 MB, and the standalone HTML 11.2 MB.

**Errors** (body-point distance against the capture)
- Set means: 13.9 mm (QUATERNIUS), 16.1 (MESH2MOTION), 17.8 (CMU), 15.1 (HERO).
- Per-clip mean, median / p90 / max: 14 / 18 / 22 (Q), 15 / 24 / 39 (M2M), 17 / 25 / 34 (CMU).
- Per-clip worst: median 78-101 mm, max 286 mm.
- The ledger: 17.8 mm mean of means and 95.6 mm mean of worsts over 2,548 takes; 56 loose takes (> 30 mm).
- The bind poses of D's packs differ by up to ~11°, ~6° and ~12° (spine_03, neck, thumbs).

**Motion quality** (measured here)
- The O Humanoid gait at 70 units/s: each foot on the ground ~26% of the time, both feet airborne ~45%, planted-foot
  slide ~12% of body speed (8.2 units/s); 28% at 40 units/s.
- Character sheet: the Wanderer and Dan are clean; Codex has 3 pops (10.3-12.5 units a step).

**Tests**
- O mocap-test: 46 coded failure conditions; passes on the copy with 1,360 poses checked.
- O ed-clips-test: about 25 named checks. O has 13 `*-test.mjs` suites, plus the runner `test-run.mjs`.
- O doctrine-check: OK (2 approved binaries).
- D: 143 Vitest cases across 17 files (kit 21, agent-tools 17).
- D tools: 46 `defineTool` calls; 40 are offered over WebMCP.

**Agent behaviour**
- The GPT-6 Vesper build: about 50k output tokens, 0 library clips used (the store had the needed traversal clips), 28
  undocumented members found by reading the 150k-token source, and its own clock substeps.
- The planned benchmark measures output tokens, wall time, first build passing `check.mjs`, whether the agent read past
  the header, and a vision score. Never run.

### C5. Doc drift and inconsistencies noticed

- D:README.md:84 says "42 typed, documented tools"; there are 46 (AGENTS.md:17, llms.txt and ai-catalog.json agree on 46).
- D:src/content/procgen/creature.ts:6 references `render/creature/animate.ts`, which doesn't exist.
- O:docs/MOCAP.md:362, the Limits line on face and hair following `facing` and its "(see 3 above)", looks stale against
  the `mocapTilt` code and tests.
- O's engine header promised identical motion at 60, 120 and 144 Hz; Vesper showed it false (HANDOFF:47; fixed in plan
  Phase 0, not yet landed in this commit).
- O's character sheet reports "no sliding" for a gait that slides in locomotion: the metric is idle-only, and the sheet's
  `run` state is run-in-place.
