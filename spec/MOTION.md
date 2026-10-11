# The m3a motion format, 2.0-rc

**Status:** release candidate, written in WP-1.1 (2026-10-11); frozen at gate G1. **Legend:** `spec/LEGEND.md` (what a
model reads first). **Skeleton:** `spec/SKELETON.md` (WP-1.4). **Schemas:** `spec/schemas/` (WP-1.2). **Conformance:**
`spec/conformance/tiers.md` and `spec/vectors/`. Format 2 keeps format 1's design (my-3d2dge `src/mocap/readable.js`,
`docs/MOCAP.md` at the pinned commit) and every format-1 key decodes the same; this document says so field by field.

## 1. What a clip is

A clip is a short list of **key poses** of one humanoid body, plus what happens in it (contacts, events), what was
measured from it (facts), where it came from (provenance) and how good it is (quality, review). Each key names what an
animator would: where the hips are, how the body, chest and head turn and lean, how the shoulders reach and shrug,
which way each arm and leg points and how much the elbow or knee bends, and how the feet point. Nothing in a key
depends on body size, so the same clip plays on any humanoid; it mirrors by swapping L and R.

Why this shape (format 1's reasons, measured over the origin's libraries):
- **Limbs are a direction plus a bend, not joint angles.** An arm swinging through straight down has no angle that
  flips, a bend in degrees rounds well (reach stored as a fraction moved a nearly straight knee 56 mm per rounding
  step), and a two-bone IK consumes exactly this.
- **Whole numbers are cheap.** In cl100k `-0.35` costs several tokens and `-35` one or two. Named fields cost about a
  quarter more than bare rows and make edits safe.
- **Key poses are chosen by the format's own error**, so a clip is as short as its motion allows: the curated sets sit
  14 to 18 mm per body point from their captures, about 14× smaller than the same clips as packed GLB.

## 2. Frame, units and numbers

- **Frame:** the rig's own, right-handed: **forward** (f), **right** (r), **up** (z). At a clip's start the body faces
  forward with its root on the ground at the origin. L and R are the figure's own sides; `SG(L) = −1`, `SG(R) = +1`.
- **Lengths in keys** are whole percent of **standing hip height** `H0` (the pelvis's height in the rest pose). Decoded
  body points are millimetres.
- **Angles** are whole degrees. **Directions** are three whole percentages; only their direction counts.
- **Times** (`t`, `dur`, contact and event times) are seconds rounded to the millisecond, written as the shortest
  decimal (`0.267`, `1`).
- **Facts** may use decimals (§7.3).
- **Number formatting** in files is JSON's: the shortest decimal that parses back to the same double. `-0` is written
  `0` (a key's sign of zero never changes a decoded point beyond rounding). No `NaN`, no infinities, no exponents in
  key numbers.

## 3. The body

### 3.1 Body points

Decoding a key gives **36 body points** in the rig frame (millimetres), in this order (`POINTS`):

`pelvis spine1 spine2 chest neck head headTop faceF chestF pelvisF`, then for L then R:
`clav sh elbow wrist index knuck pinky fist hip knee ankle ball toe`.

`faceF`, `chestF` and `pelvisF` mark where the head, chest and pelvis face (`chestF` and `pelvisF` 120 mm ahead,
`faceF` at the rest's measured face offset); `index` and `pinky` mark the knuckle line across the hand, 20 mm either
side of `fist`, the middle finger's middle joint. `SKELETON.md` maps the
points onto VRM 1.0's humanoid bones.

### 3.2 The rest body

A **rest body** is measured once per source library from its own clips (`measure`, WP-1.4) and stored as plain data in
the set manifest (§9.1): `H0`, `hipZ`, `ankleZ` (mm); the rest frames `Pr`, `Cr`, `Hr` of pelvis, chest and head
(`[F, R, U]` rows); offsets `hip`, `clav`, `cv` (per side), `spine` (four segments), `neckSeg`, `topH`, `faceH` (mm);
segment lengths `up`, `fore`, `knuck`, `fist`, `thigh`, `shin`, `ab`, `bt` (mm); foot pitches `abPitch`, `btPitch`
(degrees); and the **spine shares** `spineW` (four weights, the last 1) and `neckW`: how much of the pelvis-to-chest
turn each spine bone takes, and of the chest-to-head turn the neck takes. The shares differ per library (how its
animators posed the spine), so they are fitted from its clips.

### 3.3 Which body a clip decodes on

A clip decodes on its **set's reference body**, the rest of the set's first `sources` entry, with the spine and neck
shares of the source its `restSrc` names. This is format 1's rule (my-3d2dge `src/mocap/mocap.js:24-28`): a clip keyed
or generated on a library's body is never credited to that library, because `restSrc` says only whose shares it decodes
with; `provenance.src` says where the motion came from (§7.4). Migrated clips have `restSrc` equal to `src`. On another
body (a game's character) a solver puts the same key on that body's own proportions (WP-2.4); the reference body is what
the conformance vectors and `fit` measure against.

## 4. The clip file

One clip per file, `library/sets/<SET>/<Slug>.json`: plain JSON, UTF-8, no comments, no wrapper, a trailing newline.
Writers emit the fields in this order and only through the canonical serializer (`@m3a/core` `serialize`); readers do
not depend on the order.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format` | string | yes | `"2.0"` (§10) |
| `id` | string | yes | `SET/Slug` (§11) |
| `name` | string | yes | The display name as the source gives it (`Dance Charleston`) |
| `legend` | string | yes | The legend version the keys follow: `"2.0"` |
| `dur` | number | yes | Duration, seconds, > 0 (a one-key pose: the time it holds, at least 0.001) |
| `loop` | boolean | yes | Wraps (true) or holds its last pose (false) |
| `fps` | number | yes | The source's sampling rate the clip was fitted at (30 for the curated sets) |
| `tags` | string[] | yes | Lower-case words; may be empty |
| `desc` | string | yes | What the body does, in a few plain words; may be empty |
| `skeleton` | string | yes | The body plan the keys describe: `"humanoid"` (`SKELETON.md`); others are reserved |
| `restSrc` | string | yes | The `sources` entry whose shares the keys decode with (§3.3) |
| `requires` | string[] | no | Fields after 2.0 that change how the clip plays (§10) |
| `contacts` | object | no | Planted intervals per end (§7.1) |
| `events` | object[] | no | Named moments (§7.2) |
| `facts` | object | no | Measured values (§7.3) |
| `provenance` | object | yes | Where it came from (§7.4) |
| `quality` | object | yes | Fit and QA verdict (§7.5) |
| `review` | object | no | The owner's review of this motion (§7.6) |
| `keys` | object[] | yes | The key poses, at least one, times increasing (§5) |

Readers **accept unknown fields** (a later minor version may add some) except those named in `requires`; the linter
(`validate` in lint mode) flags them with the nearest known name.

## 5. Key poses

Each key is an object: `t` and named arrays of whole numbers. Key times strictly increase, keys at least 1 ms apart.

### 5.1 Required in every key

| Field | Numbers | Meaning | Range |
|---|---|---|---|
| `t` | 1 | Seconds from the clip's start | 0 ≤ t ≤ 600 |
| `hips` | `[forward, right, up]` | The pelvis relative to the root, % of `H0` (100 = standing, 55 = sitting on a chair) | forward, right ±1000; up −100..1000 |
| `body` | `[turn, lean, tilt]` | The pelvis frame, degrees: turn + toward the right, lean + forward, tilt + toward the right | angles |
| `chest` | `[turn, lean, tilt]` | The chest frame relative to the pelvis | angles |
| `head` | `[turn, lean, tilt]` | The head frame relative to the chest | angles |
| `armL`, `armR` | `[forward, out, up, bend, twist]` | Direction from the shoulder to the fist in chest space, percent (out + away from the body on that side; `[0,0,-100]` hangs down); bend = the elbow, degrees, 0 straight; twist = degrees the elbow swings round the arm from its natural direction (back and down) | direction −100..100 each, not all 0; bend 0..180; twist an angle |
| `legL`, `legR` | `[forward, out, up, bend, twist]` | Hip to ankle in pelvis space; bend the knee; twist from the knee pointing forward | as arms |

**Angles** unwrap (§6.3), so a spin counts past ±180: a stored angle is valid within ±3600, and the validator warns past
±540 (the seed sets reach a body turn of 582 and a leg twist of −1086 in spins and rolls).

### 5.2 Optional in format 1 already

| Field | Numbers | Meaning | When absent |
|---|---|---|---|
| `shL`, `shR` | `[reach, shrug]` | Degrees the shoulder (collarbone) swings forward and up from rest | `[0, 0]` |
| `footL`, `footR` | `[down, out, toes]` | Degrees the foot points down from standing, turns outward (an angle, unwrapped), the toes bend up | `[0, 0, 0]` |
| `blade` | `[forward, right, up]` | A blade held in the right fist, in chest space (sets the knuckle line) | no blade |
| `root` | `[forward, right]` | How far the root has travelled since the clip's start, % of `H0`, in the start frame (no bound) | in place |

An optional field is present in every key of a clip or in none (the validator warns otherwise: format 1 in-betweens a
field only from keys that have it).

### 5.3 New in format 2: named optional degrees of freedom

Each fixes a defect measured in format 1. A key without them decodes exactly as format 1.

| Field | Numbers | The defect it fixes |
|---|---|---|
| `handL`, `handR` | `[flex, side, roll]` degrees | Format 1 holds the hand straight off the forearm: a bent wrist misplaces the elbow and wrist (its worst misses), and a prop held at an angle can't be expressed |
| `fingersL`, `fingersR` | `[thumb, index, middle, ring, pinky]` curl, % (0 straight, 100 a fist) | Hands are always fists; a wave, a point or an open palm can't be told apart |
| `spine` | `[lower, middle, upper]` % | The set's fixed spine shares put a curl where the library's animators bent most: a crunch, a fetal roll or a back-bend misses by up to 14° per limb on other bodies |
| `yaw` | 1 number, degrees | Turning clips carry their turn in `body` only: a game can't turn the character's root with the clip |

Their geometry (the decoder's, `@m3a/core`, WP-1.3):

- **`hand`.** With a hand, the arm's `[forward, out, up, bend]` aim at the **virtual fist**, where a straight hand's
  fist would be (the wrist plus the forearm's direction times the rest's `fist` length), so a format-1 reader that
  ignores `hand` still places the elbow and wrist right and shows a straight hand. The hand frame at the wrist: `a` the
  forearm's direction (elbow to wrist); `e` the direction the elbow points (the arm's pole, as the IK uses it,
  `readable.js:245`); the palm side `m = norm(−(e − a (e·a)))`, the inside of the elbow; the thumb side
  `l = SG · (m × a)`. Roll ρ turns both about `a`: `m′ = m cos ρ − l sin ρ`, `l′ = l cos ρ + m sin ρ` (+ pronates). The
  hand's direction is `h = norm((a cos φ + m′ sin φ) cos σ + l′ sin σ)` for flex φ and side σ. Then
  `knuck = wrist + h·knuck`, `fist = wrist + h·fist` (rest lengths), and `index`, `pinky` = `fist ± 20 mm` along `l′`
  made perpendicular to `h` (along `blade` when the key has one, as in format 1). Ranges: flex −90..90, side −45..45,
  roll −180..180. Mirroring swaps `handL` and `handR` unchanged.
- **`fingers`.** The middle curl c bends the `fist` point about the knuckle toward `m′`, by `0.9 · c` degrees; the
  other curls move no body point and drive finger bones where a skeleton has them (`SKELETON.md`). Range 0..100.
  Mirroring swaps the sides unchanged.
- **`spine`.** Replaces the reference body's `spineW[0..2]` for this key with `[lower, middle, upper] / 100`
  (`spineW[3]` stays 1). Range −100..200. Mirroring keeps it.
- **`yaw`.** The root's heading (turn + toward the right) relative to the clip's start, at this key. Decoding in clip
  space ignores it; a host applying root motion turns the character by the change in `yaw` and plays each pose with
  `body[0] − yaw`. Every clip that travels carries `root` in every key, and `yaw` when it turns. Mirroring negates it.

## 6. Sampling, quantization and continuity

### 6.1 In-betweening

The pose at time `t` (`keyAt`, `readable.js:265-271`):
1. `dur` is the clip's duration. For a loop with `dur > 0`, `tt = ((t mod dur) + dur) mod dur`; otherwise
   `tt = min(max(0, t), dur)`.
2. With keys `K[0..n−1]`: start at `i = 0` and advance while `i < n − 2` and `K[i+1].t ≤ tt`. Then `a = K[i]`,
   `b = K[min(i+1, n−1)]` and `u = b.t > a.t ? clamp((tt − a.t) / (b.t − a.t), 0, 1) : 0`.
3. Every number of every field `a` has moves linearly: `v = a_j + (b_j − a_j) · u` (from `a`'s own value when `b`
   lacks the field). A field `a` lacks is absent from the pose.

So a loop holds its last key until `dur` and then starts again from its first: a seamless loop's last key equals its
first. A one-shot holds its first key before 0 and its last after `dur`.

**Keys past `dur`.** 52 of MESH2MOTION's 177 clips end with a key 8 to 17 ms after `dur` (the capture's last frame).
Sampling never reaches past `dur`, so such a key only shapes the last in-between. It is allowed (at most one key past
`dur`, within 50 ms), and tools that copy or edit a clip keep it rather than cut it off.

### 6.2 Quantization

Every key number is rounded to a whole number with JavaScript's `Math.round` (halves toward +∞); `t` to the
millisecond (`Math.round(t · 1000) / 1000`). Directions are scaled to a length of 100 before rounding, so their largest
component is about ±100.

### 6.3 Continuity

The encoder keeps numbers continuous from one key to the next, so in-betweens never jump:
- **Turn, lean and tilt** each have a second reading (`turn + 180`, `180 − lean`, `tilt + 180`). The encoder takes the
  one closer to the key before (by the summed absolute difference), so a body leaning past horizontal in a flip keeps
  leaning instead of jumping round.
- **Angles unwrap:** each angle is taken within 180° of the same number in the key before (`v + 360 · round((prev − v)
  / 360)`), so a spin counts past ±180.
- **Twist** is measured round the limb from a reference carried smoothly from one rest direction to wherever the limb
  points (`readable.js:106-123`). It is singular only straight opposite the rest direction (an arm behind the head
  across the back, a leg up behind), where no limb reaches.
- **A fist folded inside the shoulder** (closer than a straight hand can fold): the encoder points the fully bent limb
  away from the elbow instead, so the elbow stays where it was (`readable.js:220-222`).

### 6.4 Fit

`fit` chooses the keys: Ramer–Douglas–Peucker over whole poses at the budget (30 mm by default), then repeatedly the
frame the readable in-betweening misses most, until every frame is within the budget of what the format can hold at
all (the frame encoded as its own key). Error is the worst body-point distance, leaving out `index` and `pinky`.
`quality.fit` records the clip's mean and worst over its frames.

## 7. What a clip carries besides keys

### 7.1 Contacts

`contacts`: `{ "by": "detected" | "labelled", "footL": [[from, to], …], "footR": …, "handL": …, "handR": … }`. Each
interval is when that end is planted, in seconds, `0 ≤ from < to`, sorted and not overlapping. An end with no contact
is omitted. `by` says whether a tool detected them (WP-2.2) or a person or source labelled them. `to ≤ dur`, except
that a loop's last interval may wrap: `to > dur` means the contact continues from 0 until `to − dur`.

### 7.2 Events

`events`: `[{ "t": 0.42, "name": "hit", … }]`, sorted by `t`, `0 ≤ t ≤ dur`. Names: `hit`, `step`, `release`, `land`,
`launch`, `grab`, or a custom lower-case name. Other fields are the event's data (`side`: `"L"` or `"R"`, `power`, …),
named in plain words.

### 7.3 Facts

`facts`: values measured from the motion by a tool, never typed by hand: `{ "by": "<tool>@<version>", … }`. Known
facts: `speed` (% of `H0` per second a loop travels as captured, shardfall's), `travel` (`[forward, right]` % over the
clip), `strike` (seconds, when an attack's hand or foot moves fastest toward its target), `height` (`[min, max]` of the
hips' up, % of `H0`) and `seam` (a loop's mm between its last and first pose). Facts may be decimals. A fact a tool can
recompute is checked against the motion by QA.

### 7.4 Provenance

`provenance` (required):

| Field | Meaning |
|---|---|
| `src` | The `sources` entry the motion came from (a library, a CMU subject, the intake queue) |
| `orig` | The clip it was made from, as `SET/Clip`, when it is a copy, an edit or a composition (optional) |
| `take` | The recording and the stretch of it (`"09_02 0.20-0.95"`), for captures cut from long takes (optional) |
| `method` | `captured`, `keyed`, `procedural`, `composed`, `edited` or `generated` |
| `producer` | `{ "tool": "m3a-migrate", "version": "0.2.0", "model": "…" }`: what wrote the clip (`model` for generated or agent-made clips) |
| `license` | An SPDX identifier (`CC0-1.0`, `CC-BY-4.0`) or `LicenseRef-CMU-Mocap` for CMU's terms |
| `credit` | The attribution line a game shows (required for `CC-BY-4.0` and CMU) |
| `ai` | The IPTC digital source type (`http://cv.iptc.org/newscodes/digitalsourcetype/`): `digitalCapture` (captured), `digitalCreation` (keyed), `algorithmicMedia` (procedural), `composite` (composed), `humanEdits` (edited), `trainedAlgorithmicMedia` (generated) |

A clip's license is its set's tier's (D10): a clip derived from a CC BY or CMU clip keeps that license.

### 7.5 Quality

`quality` (required): `{ "fit": [mean, worst], "qa": "pass" | "baselined" | "fail" | "unchecked", "qaVersion": "…",
"baseline": "reason" }`. `fit` is in whole millimetres against the capture (`[0, 0]` for keyed or procedural clips);
`baseline` gives the reason when QA warnings are accepted for this clip.

### 7.6 Review

`review`: `{ "state": "approved" | "flagged" | "unreviewed", "by": "…", "date": "YYYY-MM-DD", "motion": "<sha256>",
"note": "…" }`. `motion` is the SHA-256 of the **motion hash input**: the canonical serialization of
`{dur, loop, fps, skeleton, restSrc, keys, contacts, events}` plus every field listed in `requires`. An approval whose
`motion` no longer matches reads as **stale**.

## 8. Limits

At most 4,096 keys and 600 s per clip; keys at least 1 ms apart; at most one key past `dur`, within 50 ms; at most 64
events; at most 256 contact intervals per end. A clip that needs more is split.

## 9. Sets

### 9.1 The set manifest, `_set.json`

| Field | Meaning |
|---|---|
| `set` | The set's name, upper case (`QUATERNIUS_3D2DGE`); unique across the library (D4) |
| `title` | The name as people read it |
| `format` | `"2.0"` |
| `legend` | `{ "version": "2.0", "text": [lines] }`: the legend the clips follow (`LEGEND.md`), so a model never reads numbers without it |
| `tier` | `cc0`, `cc-by`, `cmu` or `local` (D10) |
| `content` | `{ "edition": "…", "importer": "…", "sha256": "…" }`: the source edition, the importer revision, and the SHA-256 of the set's clip files (§9.2) |
| `sources` | `{ id: { label, origin, license, url, credit, rest } }`: where each library came from and its measured rest body (§3.2) |
| `credit` | The set's attribution line |
| `producer` | `{ tool, version }` that wrote the set |
| `body` | Optional: the mannequin's look measured from the first library's mesh |

### 9.2 Content ids

A set's `content.sha256` is the SHA-256 of the concatenation, in byte order of their file names, of each clip file's
name, a newline, its SHA-256 in hex and a newline. The same clips give the same id on every run; one changed byte gives
another.

### 9.3 The catalog, `catalog.tsv`

One row per clip, tab-separated, at most 40 cl100k tokens: `id`, seconds, `loop` or `once`, speed (% of `H0` per second,
empty when it doesn't travel), tags (space-separated), what the body does, source (`= SET/Clip` when `orig` names
one). A model picks clips from catalog rows, never from motion data.

## 10. Versioning and compatibility

- `format` is `"MAJOR.MINOR"` and **validated on read**. A reader refuses a clip whose major it doesn't know with a coded
  error.
- **A minor version only adds named optional fields.** Fixed-length arrays never grow; every existing field keeps its
  meaning. Readers ignore fields they don't know.
- **`requires`.** A clip that uses a field added after 2.0 that changes how it plays (tangents, say) lists it in
  `requires`. Every reader checks `requires` from 2.0 on and refuses a clip naming a field it doesn't know, with a coded
  error, instead of playing it differently. Fields that only add information (facts, events) are never required.
- **A major version** is anything else, and comes with a migrator from the previous major.
- **Format 1** (my-3d2dge's sets, shardfall's JSON) reads as 2.0 with every new field absent: its keys are format 2's.
  Format 1 has no `format` string (`1` as a number, or nothing); readers accept that and migrate (WP-1.5).
- The legend, the schemas and this document version together.

### 10.1 Format 1's fields, and where they go

Format 1 keeps a whole set in one file (my-3d2dge: a script assigning `window.MOCAP[SET]`; shardfall: one JSON file per
set). Its fields map onto format 2 like this:

| Format 1 | Format 2 |
|---|---|
| set `set`, `title`, `credit` | `_set.json` `set` (renamed per D4 where two sets shared a name), `title`, `credit` |
| set `format` (`1`), `fps` | clip `format` `"2.0"`; clip `fps` |
| set `legend` (shardfall: an array of lines) | `_set.json` `legend.text`, at legend version 2.0 |
| set `sources[id]`: `file`, `rig`, `label`, `origin`, `license`, `url`, `rest` | `_set.json` `sources[id]` with the same fields; `license` becomes SPDX, the free text kept as `terms` |
| set `body` (`height`, `segs`, `bands`: the mannequin's measured look) | `_set.json` `body`, unchanged |
| set `fit[clip]` (`[mean, worst]` mm) | clip `quality.fit` |
| clip `clip` (its name) | clip `name`; its slug makes `id` and the file name (§11) |
| clip `src` | clip `provenance.src` and `restSrc` |
| clip `take`, `orig` | clip `provenance.take`, `provenance.orig` |
| clip `dur`, `loop`, `tags`, `desc`, `keys` | the same fields |
| clip `speed` (shardfall) | clip `facts.speed` |
| the importer's capture `fps` | clip `fps` |

## 11. Ids and file names

A clip's **slug** is its display name with every run of characters outside `A–Z a–z 0–9 _ -` replaced by one `_`, and
leading or trailing `_` removed (`Dance Charleston` → `Dance_Charleston`). Its **id** is `SET/Slug`, its file
`library/sets/<SET>/<Slug>.json`. Two clips in a set whose slugs collide get `_2`, `_3` in the order the source lists
them. Set names are upper case, `A–Z 0–9 _`.

## 12. Numerics (what bit-for-bit means)

Tiers 1a and 1b are exact, so the reference's numerics are part of the format:
- f64 arithmetic in the reference's operation order (`readable.js`); f32 storage where the reference uses
  `Float32Array` (captured frames, decoded body points);
- fdlibm's algorithms for `sin`, `cos`, `atan2`, `asin`, `acos` (V8's, which `Math` uses in Node and Chromium) and
  V8's `Math.hypot`;
- JavaScript's `Math.round` (halves toward +∞) and `Number.prototype.toFixed`;
- numbers in vectors as the shortest round-trip decimal, `-0` kept.

Tier 2 compares decoded points within 0.001 mm and tier 3 limb directions within degrees, so a port that cannot match
V8's libm still certifies there.

## 13. Conformance

`spec/conformance/tiers.md` defines tiers 1a (encode and fit), 1b (readers), 2 (decode, mirror, text) and 3 (other
bodies) with their tolerances; `spec/vectors/` holds the vectors, generated from the JavaScript originals and checked
byte for byte.

## 14. Text lenses

- **The key lens** (`text`): a clip's header on one line, then each key as three short lines: torso (`hips body chest
  head root yaw spine`), arms (`shL shR armL armR handL handR fingersL fingersR blade`), legs (`legL legR footL
  footR`). It is how tools show a clip to a model, always with the legend.
- **The normalized lens** folds angles into ±180° for reading, without changing the stored numbers.

## 15. Known limits

- Faces, fingers beyond curls, cloth and hair are out of scope (`PLAN.md` §2). Non-humanoid body plans are reserved.
- The hand's roll reference comes from the elbow's pole: an arm held perfectly straight keeps the pole the twist sets.
- A clip decodes on its set's reference body; across sets of very different rests, `fit` is not comparable.
- Format 1's twist pop (twist jumping more than 120° while the bend is over 140°) survives in some migrated clips; the
  validator warns on it (WP-1.2) and re-import fixes it (WP-5.3).
