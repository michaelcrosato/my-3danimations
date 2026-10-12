# Changelog

One version for every `@m3a` package and the spec (`node tools/version.ts`). While the major number is 0: minor for
features, patch for fixes. One line per change, under the part it touched (**Spec**, **Core**, **Sensors**, **IO**,
**Library**, **Three**, **Tools**, **Repo**, **Docs**).

## 0.27.0 · 2026-10-12

### Sensors
- `checks.STANCE` is exported (the speed under which a foot stands).

### Three
- `@m3a/three/test-characters` is a public entry: the generated test characters and `loadGlb`.

### Tools
- The benchmark (WP-4.7, D54): `npm run bench -- B1 | quiz [--trials N] [--discovery N] [--parallel N] [--variant
  dir] [--model m] [--fake]`; fresh agents at isolation level 1 in workspaces outside the repository, the packages
  installed from their tarballs; each trial's time, turns, tokens, cost and audit in `bench/results/`.
- B1 (locomotion): its brief, starter, discovery starter and brief, and a grader that judges the character's bones;
  the legend quiz (deferred from WP-1.1).
- The manual's first draft (`packages/tools/MANUAL.md`, shipped in `@m3a/tools`).

### Repo
- The boundaries check allows any subpath a package's exports map declares.

## 0.26.0 · 2026-10-12

### Library
- The loader (WP-5.1, D53): `Library` (sets, catalogs and clips by id) and `@m3a/library/node`'s `openLibrary`; each
  set's content id checked against its files and each clip against `library/sets.lock.json`, so a changed file is
  named; CC0 alone unless a game opts in to a tier; deprecated ids resolve with a warning.
- `library/LICENSES/`: CC0 1.0 and CC BY 4.0 verbatim, CMU's notice in full; `library/README.md`.

### Tools
- `npm run library -- lock | check | list [--tiers ...]`.

## 0.25.0 · 2026-10-12

### Core
- Planting on another body (D51): the body settles onto its feet over 0.2 s (`PlantOptions.settleBlend`), from the
  float a foot had as it lifted or toward the one it lands with; only a standing foot lifts the body; a re-solved knee
  keeps the clip's knee unless the new ankle bends the leg further; a hold lets go of its drift over 0.2 s
  (`PlantOptions.release`), done before the foot lands again.
- `contact.plantMix`: under a cross-fade or a blend each layer plants its own clip and their corrections blend by their
  shares of the legs; the Animator uses it whenever two layers share the legs, so a planted foot no longer jumps when
  the layer that most decides the legs changes.
- `ik3` keeps a limb's lengths when its end is inside its fold (a thigh much longer than its shin folded tight).

### Sensors
- `checks.motionOfFrames` takes the root's path (`root`): the points on the root, so a loop's seam is read on the body
  and its feet's slide in the world.
- Reading by parts (`Motion.parts`, `checks.partScale`, `checks.TYPICAL_CHAIN`): each point against its chain from the
  pelvis, for bodies whose proportions are far from a person's; off by default, so the library's readings are as
  baselined. `checks.stance` is exported.

### Three
- The first-flight demo (`apps/lab/hello`, a lab, D52): a test character idles, walks and runs by speed, jumps and
  attacks, its hit shown; deep links, `window.__m3a`, a phone layout, the build stamp; `vercel.json` for O3.

### Tools
- `npm run sweep` reads seams on the body, every point by its part, and the clip's own slide over the stretches the
  played body stands on; each failing metric's own and played values and levels are in the results (D51).
- `npm run hello [-- build | preview]`: the demo served, built into `apps/lab/hello/dist`, or that build served.
- e2e `hello`: the demo driven headless; its hashes are Node's, its hit shows, the sensors read what it plays, its
  screenshots and contact sheet go to `check-output/hello/`.

## 0.24.0 · 2026-10-12

### Core
- Planting (D49, revising D37): the re-solved knee keeps the clip's own knee as its pole, a sole's setting eases in
  before a contact and out after it, the body is lifted and lowered continuously (`PlantOptions.settle`, default on),
  and a contact through a loop's seam is one contact.
- A foot segment of no length measures no pitch (a toeless rig measured a NaN rest).

### Three
- `@m3a/three/capture`: a bound character drawn headless on WebGL 2, every frame read back, checked not blank, with
  the proof hash of its bones; `CaptureError` for a blank frame or another renderer (D49).
- Bind gives a foot that ends with no child an end bone where its mesh ends, on the sole (D49, revising D47).

### Sensors
- Foot locks bake planting with `settle: false` (D44).

### Tools
- `npm run sweep`: every migrated clip played by the Animator on each skeleton, judged against the clip on its own
  body, with every failure's reason (D49).
- CI's T2 fetches the real rigs and prints the browser log when it fails.

## 0.23.1 · 2026-10-11

### Three
- `bind` recognizes only the bones that deform the mesh (and those above them): a rig's IK and roll controls were taken
  for limbs (KayKit's Knight bound its arms to its legs' controls) (D47).

## 0.23.0 · 2026-10-11

### Three
- WP-4.4: `attach(animator, bound)` writes an Animator's poses to a character's bones each update (the write allocates
  nothing) and hands the root's motion to the game; `bake(clip, bound)` makes a THREE.AnimationClip within 0.5 mm of the
  live solve, carrying the clip's loop, events, contacts and facts in `userData` (D48).

## 0.22.0 · 2026-10-11

### Three
- WP-4.3: `bind(root, { mapping? })`: a three.js character's skeleton (or VRM humanoid) recognized, its rest read in
  its own space, bound for the solver, with a report of at most 20 lines and a mapping patch to edit and pass back (D47).

### Core
- Recognition by topology: a long clavicle is the shoulder, a rig with no neck keeps its arms, a twist leaf isn't the
  hand, a chain of neck bones ends at the head, a twist bone in the thigh is passed over, and an arm with twist bones in
  it is reported with lower confidence (D28 revised).

## 0.21.0 · 2026-10-11

### Three
- WP-4.2: test characters (`packages/three/test-characters/`): skinned humanoids generated from a seed as GLB in
  memory, varying in build, rest pose, bone names (VRM, Mixamo, UE5, Rigify, with each family's habits), twist bones
  and left-out bones; the 20 of the test set load in three.js and are recognized; `loadGlb` and `skeletonIn` read any
  character in three (D46).

### Tools
- `npm run fixtures -- fetch | check [--manifest <file>]`: real CC0 rigs fetched by SHA-256 into `.cache/fixtures/`,
  their license files read and checked; Quaternius' mannequins and KayKit's Knight. CI fetches them before T1.

## 0.20.0 · 2026-10-11

### Three
- WP-4.1: `@m3a/three` pins three.js r182 (`three@0.182.0`), the release fresh agents write correctly that runs on
  both of `WebGPURenderer`'s backends in the platform's Chromium (r186's WebGPU fails to start there) (D45).

### Tools
- `npm run doctrine` bans the WebGL-era three.js APIs that break under `WebGPURenderer` and holds `packages/three` to
  the pin (`tools/doctrine/banned-three.json`).
- e2e `three`: the pinned release loads a skinned glTF, plays and crossfades on both backends; CI's `three-next` job
  runs it on r186.

### Docs
- `docs/THREE.md`: the pin, why, how to write against it, and the banned APIs.

## 0.19.1 · 2026-10-11

### Sensors
- G3's second review of WP-3.5 (D44): `fix` doesn't apply a step that raises a metric already at warn by more than
  5%, adds findings, or lowers none of the metrics its operator answers (as well as one pushing a metric past a level);
  twist flips take whole turns out of a stretch before spreading it; foot locks aim only the locked side's leg and
  leave an in-place loop that steps as it is (the step says why); jitter treats a key out of place alone apart from a
  shake.
- `compareClips` throws when its three rows can't fit the budget, instead of returning over it (D40).
- The describe tests count tokens by cl100k as well as o200k (D42).

### Tools
- `npm run qa -- --fix` counts a clip with more findings as worse, and its summary is in the verdict line.

## 0.19.0 · 2026-10-11

### Sensors
- G3 review of WP-3.5 (D44): `fix` doesn't apply a step that would push any metric past a level it was under (the
  step says which), every key an operator adds or edits is tidied to the format's whole numbers and ranges (`fixes.tidy`),
  edits are keyed every 0.1 s, twist flips keep a loop closed, the seam operator adds no key when the seam closes and
  matches speeds where they stand out (lint names it for `seamVelocity`), penetration sets on the floor only a foot
  standing still, re-fit counts the root's travel and turn, and an unknown operator name throws.
- Describe's text holds to 150 tokens as counted, not 600 characters, and says how many items it left out (D42).
- A predicate whose interval starts after the clip ends is refused (D41).
- A sheet whose frames draw no body throws, naming them; a diff's three rows share its token budget (D40).

### Tools
- `npm run qa -- --fix`: lint and fix over the library, failing on any clip that comes out worse or invalid; in G3's
  command set. The verdicts line names the metrics that fail most.
- The planted defects (D43): every planted clip validates; slides lie on stances within their clips and are found
  within 0.1 s of them; the defects take clips in turn, about 10 each; edits keyed every 0.1 s.

## 0.18.1 · 2026-10-11

### Tools
- The sensors' baseline (`packages/sensors/fixtures/baseline.json`, numbers only): every migrated clip's verdict,
  values and finding counts. `npm run qa -- --check` fails on any difference and T2 runs it; `--baseline` rewrites it,
  in a commit that says why.
- `npm run plant [-- --check]` for the planted defects.
- `npm run gate -- G3`: its command set.

## 0.18.0 · 2026-10-11

### Sensors
- WP-3.5: `fix(clip, R)` and `lint(clip, R)`, and the operators one by one (`fixes`): repair twist flips, filter
  jitter and pops, lift penetration, bake foot locks, close a loop seam (pose and speed), re-fit keys to a budget.
  Each is measured before and after, and no clip changes silently: `dur`, events and contacts are checked after every
  operator, and stored facts measured again (D44).
- The metrics' key grid is the keys as played: a key past the end counts only through the pose at the end.

### Tools
- The plant tool's new keys snap to a clip's own within 5 ms; the slide plant keys its drag on the 1/30 s grid.

## 0.17.0 · 2026-10-11

### Sensors
- WP-3.6: 100 planted defects (`fixtures/planted/runs.json`), ten kinds, every one flagged by its metric at its times;
  false positives in 3 runs of 100, each stated (D43).
- Jitter takes the smaller of two opposite bends, so a key out of place doesn't read as a shake beside it (warn 26,
  fail 90 from capture); a flip at a limb read as straight folds its swing too.

### Tools
- `node tools/plant/main.ts [--check]`: plants ten defects into clean library clips with the times they must be found
  at (a slide, a sink, an arm through the torso, a pop, a twist flip, a loop seam, a stretched bone, a NaN, events out
  of order, a wrong mirror).

## 0.16.0 · 2026-10-11

### Sensors
- WP-3.4: `describe(clip, R)`: a clip as a short text timeline: its phases by rule (stand, walk, run, crouch, sit, lie,
  air), landings, strikes, events and travel; at most 150 tokens, more with `detail`. 30 of 30 on the reviewed ground
  truth (`fixtures/describe-truth.json`).
- The metrics' stance can read by height alone.

## 0.15.1 · 2026-10-11

### Sensors
- WP-3.3 review: where a foot stands is measured (on the floor, slower than a swing or carried with the pelvis), so a
  sliding or gliding foot is measured; slide is a contact's drift from where it landed; skate is a metric of its own.
- The root adds its place, not a second turn by its yaw; the heel's sole point turns with the foot.
- Jitter and pops read the key grid; pops follow my-3d2dge's 2.5× rule, per body part; thresholds re-derived from capture.
- Twist flips are judged at any spacing where the reference is undefined, by rate elsewhere; the head limit reads
  either encoding of the head.
- A flip folds only what it swings within its keys, takes their worst level, and keeps them as `folded`.
- Predicates convert or reject units, read the measured stance, and refuse backward intervals; a sliding profile.

### Tools
- `npm run qa`: `--dist` prints the distributions (capture and all); every clip's findings go to `clips.json`.

## 0.15.0 · 2026-10-11

### Sensors
- WP-3.3: the metrics (`metrics/`), `metrics(clip, R)`: slide and skate, penetration, self-intersection, jitter, pops,
  twist flips, knee and neck limits, stretch, loop seams, fit, non-numbers, events and symmetry. Each finding has its
  times and a repair. Thresholds come from capture, each with its reason; tag profiles relax what doesn't apply. The
  verdict is at most 20 lines.
- Predicates (`predicates/`): planted, free, within, height, compare and "no". A failure reads as a repair.
- The raster's capsules are named by part.

### Tools
- `npm run qa`: the sensors over the migrated library (`--sample`, `--set`, `--clip`, `--dist`, `--strict`). T2 runs
  it.
- The boundary check's import scanner no longer reads `import's` in a string as an import.

## 0.14.0 · 2026-10-11

### Sensors
- WP-3.2: sheets, films and diffs (`sheet/`):
  - `sheet` (a clip's frames at one scale, in rows of eight) and `filmstrip`;
  - overlays for planted feet, foot trails, flagged times in red, and a timeline of contacts and flags;
  - `diff` (A, B, and A with changes marked) and `compareClips` (two clips on one camera);
  - each image's size and token cost, within a budget.

## 0.13.0 · 2026-10-11

### Sensors
- WP-3.1: the software raster (`raster/`):
  - the capsule mannequin on a pose's body points, lit and z-buffered, its left side blue, with a nose for facing;
  - front, side, back, top and three-quarter views, any azimuth, and a turntable;
  - a 5 × 7 bitmap font for labels and a non-blank check;
  - PNG bytes (`encodePng`; `png` and `writePng` in the new `@m3a/sensors/node` entry, through node:zlib).

## 0.12.1 · 2026-10-11

### Core
- The Animator, fixed from the G2 review (D38):
  - a loop's events fire once a cycle at any speed, backward too, however many cycles one step covers;
  - a one-shot's end fires once when the playhead turns round at it;
  - no −0 in the state;
  - `restore()` hashes clips afresh (one edited in place is refused) and refuses a save made on another body
    (E_BODY_CHANGED);
  - each call's turn is composed step by step (no 360° jump);
  - a clip with no id, a zero-length loop and a malformed save are refused or played still;
  - the lowest layer fires its events whatever its weight.

### Tools
- `npm run test:cross-engine` runs the Animator's script in JavaScriptCore (Bun) too: the same hash as V8.

## 0.12.0 · 2026-10-11

### Core
- WP-2.6: the Animator (`animator/`):
  - layers (clip, weight, mask, additive, speed);
  - `step(dt)` on a fixed step: events in the order the playheads pass them, root motion mixed like the pose;
  - `hash()`; `save()` and `restore()` as plain JSON, naming each clip by id and content hash, refusing a changed or
    missing clip by name;
  - `pose()` with planted feet, the ground and hand targets, at full detail, `lod` 1 or `{ exact: true }`.
- The public API is `src/index.ts`, all of it: 38 documented names, each module as a namespace (`format`, `ops`,
  `math`, `solver`, ...).

### Tools
- The doctrine's boundary check counts each package's public exports (core at most 40), and fails a bare `export *`
  or an export with no doc comment.

### Repo
- e2e `animator-parity`: the Animator's hashes, events and exact poses are the same in Node and headless Chromium.

## 0.11.1 · 2026-10-11

### Core
- The solver's bone roll, fixed from WP-2.4's review (D36):
  - the left arm's rest pole is no longer mirrored (it rolled 62.7° on every pose);
  - arms and legs roll by their bend plane's normal, with no flip at any bend;
  - feet and toes roll about the axis they pitch about;
  - hands roll by the knuckle line, the skeleton's own at rest, and a format-1 hand stays on its forearm;
  - fingers curl toward the palm at any hand roll;
  - T, A and relaxed rests give the same rotations.
- The hips carry the lowest spine segment, so every point the solver decodes is one the bones reach (`solveRest`,
  `reachable`, `decodeOn`).

### Spec
- Conformance tier 3 reads its tolerances from the runner's `TOLERANCE`.

## 0.11.0 · 2026-10-11

### Core
- WP-2.5: contacts and ground (`contact/`): `plant` holds each planted foot's contact point still in the world
  (stateless: the motion's own drift since landing, undone), sets the sole on the ground (pitched to slopes and steps
  through a ground probe), lowers the pelvis where a leg can't reach, solves the legs again, and draws hands to
  weighted targets; `contactRoot` gives an in-place clip the root its planted feet imply. `solve` takes edited points.
- Contact detection also asks a planted foot to be still in the world (slower than half the body's speed), and closes
  gaps up to 0.1 s; `syncBlend` gives the blend's contacts, the inputs' weighted.
- On all 133 migrated locomotion loops and on synced walk–run blends a planted foot slides at most 10 mm per contact
  (0 mm measured); on 10° slopes and 0.2 m steps planted soles stay within 5 mm of the surface (1.7 mm measured).

## 0.10.0 · 2026-10-11

### Core
- WP-2.4: the solver (`solve/`): `bind` (recognize, measure the body from the bones, map the format's frame to the
  skeleton's) and `solve` (each bone's world and local rotation and the hips' place, from the key's numbers decoded on
  the target body: limbs rolled by their poles, the spine by its shares, fingers by their curls, soles on the floor);
  `forward` for the joints. Handles T, A and relaxed rests, missing optional bones, twist bones and a host's rest
  rotations.
- `quat.fromMat3`; the decoder's `limbPoles`; the decoder places a shoulder with no offset at its clavicle point.

### Spec
- Conformance tier 3 runs (`spec/conformance/tier3.test.ts`): every generated body of `tier3/bodies.json`, every tier-2
  clip at four times.

## 0.9.0 · 2026-10-11

### Core
- WP-2.3: pose operations (`ops/`): `blend` (angles the short way round; exact at 0 and 1 up to whole turns),
  `delta` and `addDelta`, `mask` by body group with feathering, `mirrorPose`, `retime` (speed, duration or an ease
  curve), `slice` (across a loop's seam; the root restarts), `loopify`, and `phaseMap` and `syncBlend` (contact-phase
  sync; the legs blend in point space, so planted feet stay within 20 mm of the floor).
- `encodePose` takes `round: false` for exact, unrounded numbers (the default is unchanged).

## 0.8.0 · 2026-10-11

### Core
- WP-2.2: the clip runtime (`clip/`): `sample` (body points at t), `rootAt` and `rootDelta` (root travel and heading,
  composed over loop cycles), `events` (each occurrence once, in order, loop-aware, either direction), `contactsAt`
  and `detectContacts` (hysteresis about the floor), and `measureFacts` (seam, travel, speed from the planted feet,
  height, strike, contacts).
- WP-2.2: `fixtures/facts-truth.json`: 20 clips whose speeds, distances, strikes and loop flags come from my-3d2dge-2's
  asset manifest and skill timings and shardfall's importer; measureFacts is within tolerance on all 20.

### Repo
- Lint bars `**` other than squaring in core (the host's pow; D34).

## 0.7.0 · 2026-10-11

### Core
- WP-2.1: the math kernel (`math/`): portable `sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`,
  `log2`, `log10`, `hypot` and `cbrt` with native V8's bits on every input tested (fdlibm, FreeBSD and V8's own
  algorithms, Payne–Hanek past 2^19·π/2), and `pow` within one unit of glibc's; `PORTABLE`, `NATIVE` and `mathFor`.
- WP-2.1: my-3d2dge's helpers bit for bit with core.json (`clamp`, `lerp`, `approach`, the angle helpers,
  `smoothDamp`, `ease`, `hash2`, `noise2`); `Rng`, `rng`, `derive` and `RngStreams`; `Fnv64`, `hashNumbers` and
  `hashValue`; `vec3`, `quat` (slerp, swing-twist, from unit vectors) and `mat4`.
- WP-2.1: the codec, the skeleton profile and the validator call the portable math (tiers 1a and 2 unchanged, bit
  for bit); lint bars the host's transcendental `Math` functions from core (D33).

### Tools
- WP-2.1: `npm run test:cross-engine`: V8 against JavaScriptCore (Bun), bit for bit, with each function's cost.

## 0.6.0 · 2026-10-11

### Spec
- G1: spec 2.0-rc frozen (D31): `spec/frozen.json` holds the SHA-256 of `MOTION.md`, `SKELETON.md`, `LEGEND.md`,
  `conformance/tiers.md` and the schemas. Before the freeze: `_baseline.json` (§9.4, with
  `schemas/baseline.schema.json`) and the source record's `terms`, `audit`, `file` and `rig` (§9.1).
- G1's verifier fixes (D32): the frame is f × r = z as numbers, left-handed physically (§2); §5.2 gives every
  optional field's range, and `root` is ±10,000,000 in spec, validator and schema; `quality.fit` is measured against
  the source frames whatever the method (§7.5); skeleton names drop the `mixamorig` prefix three.js's loader leaves.

### Library
- WP-1.5: the seed sets in format 2: QUATERNIUS_3D2DGE (88), QUATERNIUS_SHARDFALL (102), MESH2MOTION (177),
  CMU_CURATED (60, tier cmu, CMU's notice word for word), STYLE100 (98, tier cc-by): 525 clips, each with
  `_set.json`, `catalog.tsv` (rows within 40 tokens) and `_baseline.json` (reasons per warning, from the clip's keys).

### Tools
- WP-1.5: `npm run migrate [-- --check]`.
- G1: the doctrine's `frozen` check and `node tools/doctrine/freeze.ts <decision>`; it also fails a missing record, an
  unrecorded schema and an unlogged decision. `npm run gate -- G1` runs the gate's command set.

### Core
- WP-1.3's verifier fixes: hand roll unwraps; fingers curl toward the palm normal; `fromFormat1` takes the method;
  the normalized lens; format 2's fields get vectors (`tier2/FORMAT2.json`).
- Sampling takes a format-2 clip directly (`Timed.keys` accepts `Key`).
- The set validator rejects a non-positive `rest.H0` and non-string source fields, as the schema does.

## 0.5.0 · 2026-10-11

### Spec
- WP-1.4: `spec/SKELETON.md`: VRM 1.0's humanoid (55 bones, 15 required), frames, rest measurement, body points on
  bones, the mapping tables, recognize's output, the Khronos watch.

### Core
- WP-1.4: `skeleton/`: `recognize` (8 tables and a topology fallback), `patchMapping`, `restFrame` (T, A or relaxed),
  `measure` (the origin's, bit for bit) and `restPoints`.

## 0.4.0 · 2026-10-11

### Core
- WP-1.3: the codec (`format/`): decode onto a rest body, encode from body points, sampling, RDP and fit (one budget
  or one per region), format 1's text and parse, the format-2 key lens, mirror, the canonical clip file, slugs, the
  motion hash's input, and reading format 1. Format 2's hand, fingers and spine decode; hands and fingers encode.

### Spec
- WP-1.3: conformance tiers 1a (bit for bit) and 2 (to the micrometre) pass; tier 2's vectors carry their input clips.

## 0.3.0 · 2026-10-11

### Spec
- WP-1.2: JSON Schemas for a clip, a set manifest and a catalog row (`spec/schemas/`), with stubs for recipes and
  graphs.

### Core
- WP-1.2: `validate(data, { mode, kind })`: 30 coded rules (20 clip errors, 6 warnings, 4 set and catalog errors),
  messages of at most two lines naming the clip, key, time and field; `read` accepts unknown fields, `lint` flags
  them with the nearest name. The format-2 types and key-field table.

## 0.2.0 · 2026-10-11

### Spec
- WP-1.1: `spec/MOTION.md`, the motion format 2.0-rc (frame and units, every field with its range, the new optional
  hand, fingers, spine and yaw fields, contacts, events, facts, provenance with IPTC source types, quality, review,
  sampling, limits, versioning, ids, sets and content ids, numerics), and `spec/LEGEND.md` (792 of 800 tokens with a
  worked key).

## 0.1.0 · 2026-10-11

### Repo
- WP-0.1: the doctrine (`DOCTRINE.md`), the agent rules (`AGENTS.md`), the decisions log (D1 to D21), the feedback log
  and the progress page.
- WP-0.2: npm workspaces for the six `@m3a` packages, strict TypeScript with project references, ESLint, Vitest and
  Playwright on the preinstalled Chromium; the tiers `check` (T0), `test` (T1) and `e2e` (T2) with their budgets,
  `test:changed`, `gate`, the header lint and `tools/version.ts`.
- WP-0.3: `npm run doctrine` (also in T0): binaries, cl100k token budgets, import boundaries, banned APIs, exact
  pins and checksums, the append-only decisions log and the local lane.
- WP-0.5: CI (T0 and T1 on every push, T2 on pull requests, gates by manual dispatch; actions pinned by SHA), the
  SessionStart hook (`npm ci`, `CHROMIUM_PATH`) and the pull request template.

### Spec
- WP-0.4: the conformance vectors (`spec/vectors/`, tiers 1a, 1b, 2 and 3, plus two frozen fixtures from my-3dge),
  `spec/conformance/tiers.md` and the TypeScript runner; `npm run pins` and `npm run vectors` with `--check`.
