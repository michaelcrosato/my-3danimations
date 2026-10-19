# Certifying shardfall's Rust codec

shardfall (pinned at `a9ca003` in `tools/pins.json`) carries a Rust port of the format's codec, written step for step
from my-3d2dge's `readable.js`. This is how it certifies against the kit (`PROTOCOL.md`). Adding the sidecar and a CI
job in shardfall is acting in another repository (PLAN.md §13, O9): this file is the proposal, and the owner decides.

## The tiers that apply

A codec claims tiers 1a, 1b and 2, all on format 1. Its `hello` answers `"formats": [1]`, which leaves
`tier2/FORMAT2.json` (format 2's hand, fingers, spine and yaw) unclaimed. Tier 3 is retargeting, and a codec has no
solver: leave `retarget` out of `ops`, and tier 3 reads "not claimed" (D.6, a Rust core, would add it).

| Op | shardfall's code |
|---|---|
| `reduce`, `fit` | `pav_tools::mocap::readable::{reduce, fit}`; the answer's clip is `{clip, dur, loop, tags, desc, keys}` from `clip_of`/`dur_of` and the request's `extra` (`fit` takes `extra.blade`) |
| `text`, `parse` | `pav_core::clips::Clip::text` for format 1's text; `parse` is that text read back as one clip (it is JSON) |
| `mirror` | `pav_core::clips::mirror` on each key |
| `decode` | `readable::pose_of` at each time, on the request's `rest` |
| `readGltf` | `mocap::glb::read` for `rig` and `clips` (it takes a path: write the decoded bytes to a temporary file, or add a reader of bytes); its `notes` are the protocol's `warnings`. It has no `body`: see below |
| `readCmu` | `mocap::acclaim::Subject::parse`, its takes cut by the request's picks with `mocap::takes::cut`, which refuses a pick it can't cut, as the reference does (`mocap::cmu_libraries` takes `cut_lenient` for more than one pick, which leaves such a pick out and logs it instead) |
| `measure` | `readable::Rest::measure(&caps, Some(restClip))` |

`Rest` and `Key` already (de)serialize with the vectors' field names (`H0`, `Cr`, `armL`, ...). `Cap` names two
fields differently, the protocol's `loop` is its `looping` and `move` its `travel`, and carries one the protocol has
no place for: leave `stride` out of the answer, since the kit compares a capture's fields as a set.

**The Rigify look is still to port.** At the pinned commit `glb::read`'s `Library` is `{rig, clips, notes}`, with no
mannequin look, and tier 1b compares the look of `tier1b/rigify.gltf` bit for bit: `body` is `{height, segs, bands}`,
each segment's radii and the joint-ring bands measured from the skinned meshes (`tier1b/rigify-expected.json`). Port
it from `@m3a/io`'s `readGltf` (`packages/io/src/gltf/read.ts`, "the look of the mannequin"), itself a port of my-3d2dge's
`tools/anim-import.mjs` `readLibrary`; for `rig.gltf` and any rig without Rigify's meshes `body` is `null`. Until that
port lands, `tier1b/rigify.gltf read` fails while `tier1b/rig.gltf` and `tier1b/cmu/` can pass: certify tiers 1a and
2 (`--tier 1a,2`) and develop tier 1b with `--tier 1b`.

## The numerics it must match

Tiers 1a and 1b are bit for bit (`tiers.md`, "Bit for bit"), which the port already follows:
- f64 operations in the reference's order, and f32 storage exactly where the reference keeps a `Float32Array`
  (captured frames, body points);
- fdlibm's `sin`, `cos`, `atan2`, `asin`, `acos` (the `libm` crate), V8's `Math.hypot` (`readable::hypot`), and
  JavaScript's `Math.round`, half toward +∞ (`readable::js_round`), and `toFixed`.

The wire adds two rules of its own:
- **Write an f32 as the double it widens to** (`f64::from(x)`), never through serde_json's f32 formatting: `0.1f32`
  prints `0.1`, which reads back as a different double. Captures and decoded points are f32.
- **Write a key's numbers as the text gives them.** `Key` stores f32, and the format's numbers are whole or to the
  millisecond: write `format!("{x}").parse::<f64>()` so `t` 0.493 goes out as 0.493, not 0.49300000071525574, or the
  mirror's SHA-256 and the parse check fail. Keep `-0`: serde_json writes `-0.0`, which reads as -0.

## Wrapping the binary as a sidecar

A small binary (say `crates/pav_tools/src/bin/m3a_conformance.rs`) reads stdin line by line and answers each request on
stdout, the framing `creature_worker.rs` already speaks in the other direction:

```rust
for line in std::io::stdin().lock().lines() {
    let req: serde_json::Value = serde_json::from_str(&line?)?;
    let reply = match answer(req["op"].as_str().unwrap_or(""), &req) { // one arm an op, as the table above
        Ok(result) => json!({ "id": req["id"], "ok": true, "result": result }),
        Err(e) => json!({ "id": req["id"], "ok": false, "error": e.to_string() }),
    };
    writeln!(out, "{reply}")?; // `out` is a locked stdout; flush after each reply
    out.flush()?;
}
```

`answer("hello", ..)` returns `{"implementation": "pav_tools", "version": .., "protocol": "m3a-conformance/1", "ops":
[..], "formats": [1]}`. Then, from this repository's root with shardfall built beside it:

```
npm run conformance -- --impl "../shardfall/target/release/m3a_conformance"
```

Develop one tier at a time (`--tier 1a`), and quickly with `--sample 1`. When a tier-2 hash differs, ask the reference
for its text (`node spec/conformance/adapters/ts.ts`, PROTOCOL.md "Both directions") and diff the two.

## What a pass report looks like

A format-1 codec without a solver, with the Rigify look ported, certified (the reference standing in for it):

```
conformance: pav_tools 0.x certifies tiers 1a, 1b, 2 (m3a-conformance/1, vectors 9c92061b49d3), 1321 cases in 2.6 s; not claimed: 3
  ok   tier 1a 0.1 s: 15 of 15 cases pass in 2 vector files
  ok   tier 1b 0.1 s: 6 of 6 cases pass in 3 vector files
  ok   tier 2 2.1 s: 1300 of 1300 cases pass in 3 vector files, worst decodeUm 0.500; not claimed: tier2/FORMAT2.json (format 2)
  ok   tier 3 0.0 s: not claimed: it doesn't answer retarget
```

A failure names the vector file, the case, the field and both values, and the run exits 1:

```
conformance: pav_tools 0.x fails tier 1a at tier1a/rig.json, A_TPose fit: fit.mean: ours 0.29725053906440735, want 0.29725053410854374
```

`--json` writes the whole certification to `check-output/conformance/report.json`, with what it ran against (the
protocol, the vectors' manifest SHA-256, this repository's version and commit): keep it with the release it
certifies. Each request must be answered within 60 s (`--timeout` raises it), so flush stdout after every reply, as
the loop above does.
