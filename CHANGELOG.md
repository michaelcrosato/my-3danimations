# Changelog

One version for every `@m3a` package and the spec (`node tools/version.ts`). While the major number is 0: minor for
features, patch for fixes. One line per change, under the part it touched (**Spec**, **Core**, **Sensors**, **IO**,
**Library**, **Three**, **Tools**, **Repo**, **Docs**).

## 0.11.0 · 2026-10-11

### Core
- WP-2.5: contacts and ground (`contact/`): `plant` holds each planted foot's contact point still in the world
  (stateless: the motion's own drift since landing, undone), sets the sole on the ground (pitched to slopes and steps
  through a ground probe), lowers the pelvis where a leg can't reach, solves the legs again, and draws hands to
  weighted targets; `contactRoot` gives an in-place clip the root its planted feet imply. `solve` takes edited points.
- Contact detection also asks a planted foot to be still in the world (slower than half the body's speed), and closes
  gaps up to 0.1 s; `syncBlend` gives the blend's contacts, the inputs' weighted.

### Tests
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
