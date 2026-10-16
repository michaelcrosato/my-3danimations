# @m3a/io

Readers and writers for the formats motion libraries ship in (PLAN.md WP-5.2). Every input is untrusted: sizes are
capped (`LIMITS`), and so is a file's work (its frames, every clip together, and its frames times joints), so a small
hostile file can't ask for hours or gigabytes; every buffer read is bounds-checked; a glTF's JSON is checked for the
shapes glTF gives it before anything reads it; nothing is evaluated. A refusal is an `IoError` whose `code` says why
(`E_FORMAT`, `E_LIMIT`, `E_BOUNDS`, `E_RIG`, `E_MISSING`) and whose message names the line or byte offset, and the
readers exported here let nothing else out. No dependencies beyond `@m3a/core`; the entry runs in a browser.

| Format | Read | Write | Notes |
|---|---|---|---|
| glTF / GLB, Rigify or Unreal rig | `readGltf` | `packGlb` | Bit for bit like my-3d2dge's `anim-import.mjs` (conformance tier 1b: the tiny rig, and a Rigify rig with a skinned mesh); the mesh gives the tips and the mannequin's look |
| glTF / GLB, any rig a bone map knows | `readGltfPosed` | `gltfAnimOf`, `addAnimation` | MotionBuilder names (Mixamo), Unreal, Rigify, VRM, 100STYLE, Bandai Namco; a clip played on a character bound through core is added to its own document as an animation of its own nodes (any node between bones kept at rest, scale too), and `glbGap` reads it back (WP-7.2b) |
| ASF/AMC (CMU) | `readAsf`, `readAmc`, `readCmu` | | Bit for bit like `asf-amc.mjs` (tier 1b): picks, loops cut at their best cycle and closed |
| BVH | `parseBvh`, `rigBvh`, `readBvh` | `writeBvh` | shardfall's reader as reference: units from the legs, the rest that stands straightest; written in centimetres, the zero pose the skeleton's rest, ZXY turns, and `bvhGap` reads it back (WP-7.2b) |
| VRMA (VRM Animation 1.0) | `decodeVrma`, `readVrma` | `vrmaOf`, `encodeVrma`, `writeVrma` | A clip played on a bound skeleton, as a VRM player plays it: the humanoid bones, the root's travel in the hips; written, read and written again byte for byte; id, loop, events, contacts, facts and license in the animation's `extras`, as three's bake writes them, and the credit (else the license) as the asset's copyright |

A reader gives captured body points (`Capture`: the format's 36 points every frame, mm, in the rig's frame). `importSet`
fits them into clips as a hand-written catalog says (`$sources`, `$pick`, `$skip` with reasons, and each clip's tags,
description and `orig`), with a fit report per clip; WP-5.3 runs it over the library's sources. The catalog's
`$sources.CMU` stands for every subject (`CMU_NN`), and `picksOf(catalog, fps, ledger)` plays a pick that names only its
take over the stretch the CMU ledger says it moves (`tools/corpora/cmu-takes.tsv`). `subset` picks a smaller set from
bigger ones: the clips a game adopts, with their libraries' records.

## FBX

Nothing here reads FBX: convert it to .glb first, outside this package, then read that. Neither converter below is in
this repository.

- **Blender** (any version with the glTF exporter): the seed sets took this route through my-3d2dge's
  `tools/to-glb.py` (at the commit `tools/pins.json` pins; fetch it with `npm run pins -- fetch`):
  `blender -b --python .cache/src/my-3d2dge/tools/to-glb.py -- library.fbx library.glb`, or with Blender's Python
  module alone (`pip install bpy`). `--deform-only` keeps a Rigify rig's DEF- bones without its controls.
- **ufbx** (a single-file C library that reads FBX) where Blender isn't available: a converter built on it that
  writes .glb is yours to write; none exists here.

Either way every action becomes its own animation; `readGltf` or `readGltfPosed` then reads it like any other library.
