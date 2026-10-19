# The conformance protocol (`m3a-conformance/1`)

Any implementation of the motion format, in any language, certifies itself against the vectors in `spec/vectors/` by
answering the kit's questions. The kit (`npm run conformance`, `tools/conformance/main.ts` over
`spec/conformance/kit/`) sends each tier's cases as JSON, the implementation answers in JSON, and the kit compares every
answer with the tier's tolerance (`tiers.md`). The messages' JSON Schema is `protocol.schema.json`: `$defs.ops` holds
each request's fields, `$defs.results` each answer.

## Transport

- **A sidecar.** An implementation is a command. It reads requests on stdin, one JSON object a line (UTF-8, `\n`), and
  writes one response a request on stdout, in order, one line each. Stderr is free for logs (the kit quotes its last
  lines if the sidecar dies). It exits when stdin closes. The kit sends one request at a time.
- **Messages.** A request is `{"id": 7, "op": "decode", ...fields}`. Its response is `{"id": 7, "ok": true, "result":
  ...}`, or `{"id": 7, "ok": false, "error": "why"}`; a failed request fails its case and the sidecar keeps serving.
- **Numbers** are doubles written as the shortest decimal that parses back to the same double, and `-0` is written
  `-0` or `-0.0` (JavaScript's `JSON.stringify` writes `0`; the kit's `line()` in `kit/wire.ts` doesn't). Float32 values (captured
  frames, decoded points) are written as the doubles they widen to. There is no NaN or Infinity: write `null`, which
  fails the case.
- **First, `hello`.** The kit's first request, `{"id": 1, "op": "hello", "protocol": "m3a-conformance/1"}`, is
  answered with `{"implementation", "version", "protocol", "ops", "formats"}`. A tier runs only when every op it needs
  is in `ops`; otherwise it is *not claimed*, which fails only when `--tier` names it. `formats` (`[1, 2]` when
  omitted) says which format versions it reads: a format-1 codec answers `[1]`, leaving `tier2/FORMAT2.json` and its
  clips in tier 3 unclaimed. A codec with no solver certifies tiers 1a, 1b and 2 that way (`CERTIFYING.md`).

## Ops

| Op | Tier | Fields | Result | Compared |
|---|---|---|---|---|
| `reduce` | 1a | `capture`, `tol` | the kept frames' indices | bit for bit |
| `fit` | 1a | `rest`, `capture`, `tol`, `extra` (the importer's `blade`, `tags`, `desc`) | `{max, mean, clip}` | bit for bit |
| `text` | 1a, 2 | `clip`, `format` (1: format 1's text; 2: format 2's key lens) | the text | 1a byte for byte; 2 by SHA-256 |
| `parse` | 2 | `text`, `format` | `{keys}` | equal to the clip's keys, zero's sign ignored |
| `mirror` | 2 | `clip` | the mirrored clip | SHA-256 of its `keys`; mirrored again, the clip's keys (zero's sign ignored) |
| `decode` | 2 | `rest`, `clip`, `times` | at each time, the 108 numbers of the body points (mm) | within 0.001 mm |
| `readGltf` | 1b | `glb` (the .glb's bytes, base64), `fps` | `{rig, warnings, body, clips}` | the clips, in order, bit for bit; the Rigify rig's look and no warnings |
| `readCmu` | 1b | `asf` (text), `amc` (each take's text by name), `picks`, `fps` | `{clips, log}` | bit for bit |
| `measure` | 1b | `clips`, `restClip` | the rest | bit for bit |
| `retarget` | 3 | `skeleton` (`bones`: name, parent, head in metres; `up`), `source` (the clip's rest), `clip`, `times` | `{bones, rest, poses}` | limbs and chest in degrees, lengths (below) |

**Shapes** (as the vectors hold them; the schema has each):
- a *capture* is `{name, n, dur, loop, fps, take?, move, data}`: `data` holds `n` frames of 108 float32 values, `move`
  the root's travel (two numbers a frame) or `null`;
- a *rest* is a body's measurements as `tier1a/rig.json`'s `rest` holds them (`spec/MOTION.md`);
- a *clip* is a vector's clip object: its header fields and `keys`, each key `t` and its named fields;
- *body points* are the 36 points of a vector's `points` list, each forward, right, up;
- *joints* (tier 3) are each humanoid bone's head (VRM's names, `spec/SKELETON.md`) in the format's frame, mm. `bones`
  maps each humanoid bone to the skeleton's, `rest` gives the joints at rest and `poses` one set of joints a time.

## What each tier asks

- **1a**, per clip of `tier1a/rig.json` and `tier1a/cmu-09_02.json` that has a fit: `reduce` and `fit` on its
  captured points, and `text` of the oracle's clip.
- **1b**: `readGltf` of `tier1b/rig.gltf` and `tier1b/rigify.gltf`, each packed as .glb (glTF 2.0 §4.4: JSON padded
  with spaces, the buffer with zeros; `runner/vectors.ts` `tier1bGlb`), and `readCmu` of `tier1b/cmu/` with its
  catalog's picks; then `measure` on each library's captures.
- **2**, per clip of every `tier2/<SET>.json`: `decode` at its keys and three in-betweens, `text`, `parse` of that
  text, `mirror`, and `mirror` of the mirrored clip. Before hashing, the kit puts each mirrored key's fields in the
  reference's order (`t`, `hips`, `body`, `chest`, `head`, `root`, then L before R), so field order is free.
- **3**, per generated body of `tier3/bodies.json` (its skeleton built from its `proportions` by the vectors' rig
  generator) and every tier-2 clip at its first key and three in-betweens: each arm (shoulder to the virtual fist, the
  wrist plus the forearm's direction times the body's `fist`) and leg (hip to ankle) within 9° of the source's tier-2
  points; the chest within 9° of the source's (the turn from the target's rest chest frame `Cr` to the source's posed
  one, against the turn the target's upper chest makes, read from its neck and shoulders), or 14° on a curled spine
  (that chest turn more than 30° from the turn the target's hips make); each humanoid bone's distance to its humanoid
  parent kept to 0.000001 mm.

## Reports

`npm run conformance -- --impl ts|"<command>" [--tier 1a,1b,2,3] [--sample N]` prints the verdict first, then one line
a tier and, for a failing tier, one line a failing vector file: its failures and its first failing case, field and both
values. `--json` writes `check-output/conformance/report.json` with the whole certification; exit 0 certified, 1 a
failure, 2 a usage error. `--sample N` runs at most N clips a vector file: a quick check, never a certification. A
failure reads:

```
conformance: @m3a/core 0.50.1 fails tier 1a at tier1a/rig.json, A_TPose fit: fit.mean: ours 0.29725053906440735, want 0.29725053410854374
```

## Both directions

1. **The kit drives your implementation**: `npm run conformance -- --impl "target/release/codec --conformance"` (run
   through the shell, from the repository root). This is how a port certifies.
2. **Your host drives the reference**: `node spec/conformance/adapters/ts.ts` (Node 24, from a checkout after `npm ci`)
   is a Node sidecar answering every op with `@m3a/core` and `@m3a/io`, for any input, not only the vectors. A host in
   another language keeps one such process and talks JSON lines with matched ids, the pattern shardfall's Rust tools
   use for the SpawnForge compiler (`crates/pav_tools/src/creature_worker.rs`). Use it for differential tests on your
   own clips, or to see the reference's text when a tier-2 SHA-256 differs:

```
printf '%s\n' '{"id":1,"op":"text","format":1,"clip":{"clip":"x","dur":0,"keys":[{"t":0,"hips":[0,-0,100]}]}}' | node spec/conformance/adapters/ts.ts
```

The kit proves itself on a deliberately broken implementation (`adapters/broken.ts`: `round` rounds fit's mean to
float32, `swap` swaps the wrists in every decoded pose), which it must fail with the vector named (`kit/kit.test.ts`).

## Versioning

The protocol is versioned with the contract (DOCTRINE.md principle 12). New ops join `m3a-conformance/1`, claimed
through `hello`. A change to an existing op's fields or result is `m3a-conformance/2`, and the kit speaks both for a
release before dropping the old one.
