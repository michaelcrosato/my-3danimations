# Conformance tiers

An implementation of the motion format (the TypeScript reference in `@m3a/core`, or a port in another language)
certifies against the vectors in `spec/vectors/` (written by `npm run vectors` from the JavaScript originals at the
pinned commits; see `spec/vectors/README.md`). Each tier has its inputs, what is compared and its tolerance. The
runner in `spec/conformance/runner/` reads the vectors for TypeScript; WP-10.2 turns it into a kit with a JSON
protocol for other languages.

| Tier | Proves | Inputs | Compared | Tolerance |
|---|---|---|---|---|
| **1a** encode and fit | The codec, with no reader involved | `tier1a/*.json`: each clip's captured body points (`capture.data`, float32 values) and the measured `rest` | `reduce` (key frames), `fit` (the clip's keys, `max`, `mean`) and `text` | Bit for bit: every number equal as a double, every string byte for byte |
| **1b** readers | glTF and ASF/AMC readers | `tier1b/rig.gltf` (packed as .glb; its SHA-256 is `tier1a/rig.json` `glbSha256`) and `tier1b/cmu/` | The captured body points and `rest` of tier 1a | Bit for bit |
| **2** decode | Decoding readable key poses onto a reference body | `tier2/<SET>.json`: `bodies` and, per clip, the clip in the origin's set file | Body points at every key time and at the three in-between times (`between`) | Within 0.001 mm per coordinate (vectors hold whole micrometres, so 0.0005 mm of that is rounding) |
| **2** mirror and text | Mirroring and the text lens | The same clips | `mirrorSha256` of the mirrored keys; mirroring twice equals the clip; `parse(text(clip))` equals the clip | Exact; zero's sign ignored after two mirrors |
| **3** other bodies | Retargeting onto bodies of other proportions | `tier3/bodies.json`: seven generated rigs and the sets' own bodies | Every limb's direction on the target against the source clip | Within 9° per limb; 14° on a curled spine (WP-2.4) |
| frozen | The math helpers, RNG, easing and the move model | `frozen/core.json`, `frozen/moves.json` (from my-3dge, never regenerated) | As each file's README section says (`core.json` bit for bit, angle helpers within 1e-12) | Per file |

## Bit for bit

Tiers 1a and 1b are exact, so they pin the numerics another implementation must reproduce, as shardfall's Rust port
did: f64 operations in the reference's order; f32 storage where the reference uses `Float32Array` (capture data, body
points); fdlibm's algorithms for `sin`, `cos`, `atan2`, `asin`, `acos`; V8's `Math.hypot`; JavaScript's `Math.round`
(half up, toward +∞) and `toFixed`. Numbers in the vectors are the shortest decimal that parses back to the same
double, with `-0` kept. `spec/MOTION.md` (WP-1.1) states these as the format's numerics.

## Known limits

- The vectors come from format 1. Format 2 (WP-1.1) keeps format 1's numbers, so a format-2 codec reading format 1 must
  pass tiers 1a and 2 unchanged; format-2-only fields get vectors of their own when they land.
- Tier 2 samples each clip at its keys and three in-betweens. `npm run vectors -- --dense` writes every clip at 30 fps
  into `.cache/vectors/tier2-dense/` for sampler tests (too large to commit).
- Tier 1b's CMU files and tier 1a's CMU vector are CMU motion capture data under CMU's notice (no resale, even in
  converted form); they are test fixtures, never library clips.
