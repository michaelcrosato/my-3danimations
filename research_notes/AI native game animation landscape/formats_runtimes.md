# Formats, standards, runtimes and retargeting for skeletal character animation (web and native), as of October 2026

Research date: 2026-10-11. I read package versions and publish dates directly from the npm registry, crates.io and PyPI on 2026-10-11. The shared web-search budget ran out near the end of the session, so a few items (Collada's Khronos status, ozz-animation, some runtime details) could not be checked. They are listed under Gaps. "Agent-friendliness" judgments are my own inferences and are marked as such.

---

## 1. glTF 2.0 skins and animations: capabilities, limits, KHR_animation_pointer, morph targets, readability, meshopt compression, engine support

### Takeaway
glTF 2.0 is the de facto runtime interchange format for skinned characters on the web, and three.js, Babylon.js, Godot and Bevy all load its core skins and animations. Its animation model is low-level: samplers drive node translation, rotation, scale and morph weights, and targets are bound by node index. It has no humanoid semantics, no retargeting, and no layering, additive or state-machine semantics. Keyframes live in binary buffers (base64 inside `.gltf` JSON), so glTF motion is not usefully LLM-editable text. KHR_animation_pointer is ratified, but three.js core and Bevy do not support it. Animation compression is done by quantization, resampling and meshopt; KHR_meshopt_compression is at Release Candidate on GitHub.

### Cited Findings
**Core animation model (glTF 2.0 spec)**
- Channel targets: "valid values for the `path` property include `"translation"`, `"rotation"`, `"scale"`, and `"weights"`". Assets reference entities by array index: "Entities of a glTF asset are referenced by their indices in corresponding arrays." — [glTF 2.0 Specification (source)](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Sampler input is "a set of floating-point scalar values representing linear time in seconds". Output is clamped outside the input range, and the input accessor MUST define min/max. — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Interpolation modes are `LINEAR`, `STEP` and `CUBICSPLINE`. LINEAR rotation uses spherical linear interpolation of unit quaternions. CUBICSPLINE stores "three associated keyframe values: in-tangent, property value, and out-tangent". "the interpolated quaternion **MUST** be normalized". — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Accessor types: rotation outputs are VEC4 float32 or normalized integers; translation and scale are VEC3 float32; morph weights are SCALAR float or normalized integer. — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Constraints: "Within one animation, each target (a combination of a node and a path) **MUST NOT** be used more than once". Nodes defined by `matrix` MUST NOT have their TRS animated. "Non-animated properties **MUST** keep their values during animation." — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Skins: `joints` lists node indices in the same order as `inverseBindMatrices`, and `skeleton` points to the common root. "The number of joints that influence one vertex is limited to 4 per set". "Skinned animation is achieved by animating the joints in the skin's joint hierarchy." — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Morph targets: "The number of morph targets is not limited." Clients "SHOULD support at least eight morphed attributes". — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Readability: "Buffer data MAY alternatively be embedded in the glTF file via `data:` URIs". "Base64 encoding used in Data URI increases the payload's byte length by 33%." — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- glTF cannot express additive behavior. A Babylon.js maintainer said "there is today no way to store the desired animation behavior (such additive) into GLTF2.0 format". — [Babylon.js forum (additive group GLB export thread)](https://forum.babylonjs.com/t/model-disapears-on-additive-animation-group-glb-export/30199)

**KHR_animation_pointer**
- Status: "Complete, Ratified by the Khronos Group" (README copyright 2024). Contributors come from Microsoft, UX3D, AGI, Threekit, prefrontal cortex and others. It can target any mutable property in the glTF Asset Object Model (e.g., `/nodes/0/rotation`, `/materials/0/pbrMetallicRoughness/baseColorFactor`, camera `zfar`) and `extras`. The channel uses `target.path: "pointer"` with no `node`. `int`/`bool` samplers MUST use STEP. The same property cannot be targeted twice in one animation. — [KHR_animation_pointer README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_animation_pointer/README.md)
- three.js: GLTFLoader does not support KHR_animation_pointer natively. The docs list it as supported through the separately registered `needle-tools/three-animation-pointer` plugin. — [three.js GLTFLoader docs](https://threejs.org/docs/pages/GLTFLoader.html). `@needle-tools/three-animation-pointer` 1.1.3 was published 2026-10-06 (MIT). — [npm registry](https://registry.npmjs.org/@needle-tools/three-animation-pointer); [changelog](https://engine.needle.tools/docs/reference/changelogs/three-animation-pointer)
- Babylon.js: a Needle forum post from about 2022–23 says the extension was "supported in Babylon, Gestaltor, and our fork of three.js". — [Needle forum](https://forum.needle.tools/t/having-trouble-exporting-animation-and-loading-in-three/1140)
- Godot: `GLTFObjectModelProperty` maps glTF object-model JSON pointers to Godot NodePaths for KHR_animation_pointer and KHR_interactivity. This is from the 4.x "latest" docs. — [Godot docs](https://docs.godotengine.org/ja/4.x/classes/class_gltfobjectmodelproperty.html)
- Bevy: the `bevy_gltf` docs list KHR_animation_pointer (and KHR_draco_mesh_compression) as unsupported. — [docs.rs bevy_gltf](https://docs.rs/bevy_gltf)
- luma.gl supports it at runtime for node, material, texture, camera and light properties. — [luma.gl docs](https://luma.gl/docs/api-reference/gltf/gltf-native-extensions)

**KHR_interactivity (JSON behavior graphs)**
- On July 16, 2026, Khronos announced KHR_interactivity "has been submitted for ratification". It lets creators build "portable, self-contained interactive behaviors" "expressed as behavior graphs" inside the glTF asset. — [Khronos news](https://www.khronos.org/news/archives/gltf-interactivity-extension-submitted-for-ratification)

**Compression (meshopt, quantization)**
- KHR_meshopt_compression status: "Release Candidate". It is derived from EXT_meshopt_compression: the v0 bitstream is identical, v1 compresses better, and a new COLOR filter is added. Filters are OCTAHEDRAL, QUATERNION (byteStride 8), EXPONENTIAL and COLOR. Its non-normative animation guidance:
  - Remove redundant keyframes or resample uniformly.
  - Times need "enough precision to avoid animation distortion" (no filter, or EXPONENTIAL with a 23-bit mantissa).
  - "rotation data should be quantized using 16-bit normalized components" plus the QUATERNION filter.
  - Use EXPONENTIAL for translation and scale.

  — [KHR_meshopt_compression README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_meshopt_compression/README.md)
- Conflicting claim: an October 2026 secondary article says the KHR extension was "finalized and standardized at the beginning of 2026". — [80aj.com](https://www.80aj.com/2026/10/03/nvidia-zorah-gltf-compression/). The GitHub README fetched in October 2026 still says "Release Candidate".
- gltfpack does "quantizing and resampling animations to reduce animation size and simplify playback". Default output uses KHR_mesh_quantization. `-c`/`-cc` emit EXT_meshopt_compression; `-ce khr`/`-cz` emit KHR_meshopt_compression. — [gltfpack docs](https://meshoptimizer.org/gltf/). An earlier meshoptimizer release note said KHR loader support was "not yet widely available", so EXT stayed the default. — [meshoptimizer v1 notes (via scour.ing)](https://scour.ing/@matmat/p/https://meshoptimizer.org/v1.html). meshoptimizer npm 1.3.0 was published 2026-09-25 (MIT). — [npm registry](https://registry.npmjs.org/meshoptimizer)
- three.js GLTFLoader natively supports EXT_meshopt_compression, KHR_meshopt_compression (via `setMeshoptDecoder`), KHR_mesh_quantization, KHR_draco_mesh_compression and KHR_texture_basisu. — [three.js GLTFLoader docs](https://threejs.org/docs/pages/GLTFLoader.html)

**Engine import of core skins/animations**
- three.js: GLTFLoader returns `animations: Array<AnimationClip>`. — [three.js GLTFLoader docs](https://threejs.org/docs/pages/GLTFLoader.html)
- Babylon.js: its retargeter needs source animation groups that animate TransformNodes, and "glTF animations usually meet this condition". — [Babylon.js forum announcement](https://forum.babylonjs.com/t/introducing-animation-retargeting/62547)
- Bevy: its internal glTF handling uses the same Curve API as its generalized animation system (0.15). — [Bevy 0.15 release notes](https://bevy.org/news/bevy-0-15/)
- Godot: glTF and other scene imports go through the importer's Retarget/BoneMap pipeline (see Q5). — [Godot 4.7 docs](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/retargeting_3d_skeletons.html)

### Inferences
- glTF should be an import/export target and runtime payload, not the canonical agent format. A `.gltf` JSON file is readable at the scene-graph level, but motion lives in binary accessors (or base64, which is 33% larger and opaque), bound by node index rather than bone name. Motion diffs are meaningless to a human or an LLM.
- glTF lacks the semantic layer the package needs: humanoid bone semantics, a declared reference pose, layering and additive, events and contacts. VRM and the forthcoming KHR_character_* extensions (Q2) partly fill this.
- A reasonable export profile, based on the cited guidance:
  - Bake per-bone tracks at a fixed rate (VRMA suggests 30 fps).
  - Use LINEAR/slerp interpolation and int16 normalized quaternions.
  - Allow hips-only translation.
  - Apply meshopt: EXT for broad loader compatibility today, KHR once loaders catch up.
- KHR_animation_pointer matters for non-skeletal props (material, light and camera animation), not for skeletal motion. Requiring it would cut out three.js core and Bevy.

### Gaps
- The exact ratification date of KHR_animation_pointer (README shows only © 2024).
- Babylon.js 9.x support for KHR_animation_pointer is supported only by an older third-party statement. Godot's stable version shipping it and Bevy's meshopt support were not verified.
- I found no authoritative typical size for glTF animation clips.

---

## 2. VRM 1.0 and VRMA (VRM Animation): bone set, normalization, license metadata, adoption, three-vrm loader, tooling. Could VRMA be an interchange or target format?

### Takeaway
VRM 1.0 is the only widely deployed, open, glTF-based humanoid profile: 55 bones (15 required), a strict "VRM T-pose", and rich license metadata. VRMA 1.0 (status "Complete") is an open glTF-based humanoid clip format with a maintained three.js loader (`@pixiv/three-vrm-animation` 3.5.5, July 2026). That makes VRMA the best existing open interchange and target for humanoid clips. It is still a binary glTF payload, not editable text. It is humanoid-only, rotation-only apart from hips translation, and has no IK targets, contacts, layers or events. Adoption is concentrated in the Japanese avatar and VTuber ecosystem. Khronos is turning VRM concepts into general `KHR_character*` extensions (skeleton mapping, reference pose), which were heading for Release Candidate as of July 2026. Khronos deliberately avoids mandating one skeleton.

### Cited Findings
**VRM 1.0 humanoid and rest pose**
- From my tally of the spec tables: 55 humanoid bones, 15 required, 40 optional.
  - Required: hips, spine, head, left/right upperLeg, lowerLeg, foot, and left/right upperArm, lowerArm, hand.
  - Optional: chest, upperChest, neck, eyes, jaw, toes, shoulders, and 30 finger bones (3 per finger).
  - Rules: "It is permissible to have non-humanoid bone nodes between humanoid bones." "Humanoid bones must be unique in VRM." "upperChest can exist only when chest exists." Scales must be positive.

  — [VRMC_vrm-1.0 humanoid.md](https://raw.githubusercontent.com/vrm-c/vrm-specification/master/specification/VRMC_vrm-1.0/humanoid.md)
- VRM T-pose:
  - The model faces +Z, symmetric on X, ground at Y = 0.0 at the soles.
  - Arms are parallel to X, palms face -Y, nails face +Y, thumbs run along X+Z (about 45°), and feet are parallel to Z.
  - "All node transforms must be in a positive uniform scale."
  - No linear unit is stated on this page.

  — [VRMC_vrm-1.0 tpose.md](https://raw.githubusercontent.com/vrm-c/vrm-specification/master/specification/VRMC_vrm-1.0/tpose.md)
- License metadata (`meta`):
  - Required: `name`, `authors`, `licenseUrl` (must be `https://vrm.dev/licenses/1.0/`, the VRM Public License).
  - `avatarPermission`: onlyAuthor (default), onlySeparatelyLicensedPerson, everyone.
  - `commercialUsage`: personalNonProfit (default), personalProfit, corporation.
  - `creditNotation`: required (default), unnecessary.
  - `modification`: prohibited (default), allowModification, allowModificationRedistribution.
  - Booleans: `allowRedistribution`, `allowExcessivelyViolentUsage`, `allowExcessivelySexualUsage`, `allowPoliticalOrReligiousUsage`, `allowAntisocialOrHateUsage`, all defaulting to false.
  - `otherLicenseUrl` is optional.

  — [VRMC_vrm-1.0 meta.md](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/meta.md)

**VRMA (VRMC_vrm_animation-1.0)**
- "VRM Animation is a format for describing animations of humanoid models defined in VRM." It is built on glTF, and "The same VRM animation file can be used for any VRM file". It covers humanoid bone animation, expression animation and lookAt. The recommended extension is `.vrma`. The site says "The VRM Animation specification has just been officially released" and warns that apps built on the draft may behave differently. — [vrm.dev VRMA](https://vrm.dev/en/vrma/)
- Spec status "Complete" (1.0).
  - Fields: `specVersion: "1.0"`, `humanoid.humanBones` (bone → node index; eyes not allowed), `expressions.preset/custom` (→ node), `lookAt` (`node`, `offsetFromHeadBone`).
  - Normative rules: the rest pose "must follow the pose called "VRM T-pose"". T-pose hierarchies may have any rotation. Humanoid bones "must not include scales". There are no translations except on Hips.
  - Practical rules: a 30 fps guideline. Expression weight is the node translation's X component, clamped to [0, 1]. Only the first animation is loaded by default. Files are animation-only glTFs.
  - Implementations may use Unity-style humanoid retargeting or plain FK transfer.

  — [VRMC_vrm_animation-1.0 README](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm_animation-1.0/README.md)
- Listed implementations: UniVRM (Unity), @pixiv/three-vrm, VRM Add-on for Blender, bvh2vrma, VRoid Hub, AnimationClipToVrmaSample, VMagicMirror, VRM Posing Desktop, VRM Posefiler and others. — [vrm.dev VRMA](https://vrm.dev/en/vrma/)
- Date conflict: the vrm.dev VRM 1.0 page gives VRMC_vrm_animation-1.0's release as February 2020, which conflicts with the 2024 schema merge in three-vrm. — [vrm.dev/vrm1](https://vrm.dev/vrm1/); [three-vrm issue 1374](https://redirect.github.com/pixiv/three-vrm/issues/1374)
- Typings and bindings: `@pixiv/types-vrmc-vrm-animation-1.0` (TypeScript) — [libraries.io](https://libraries.io/npm/@pixiv%2Ftypes-vrmc-vrm-animation-1.0); Rust crate `vrm-spec` — [docs.rs](https://docs.rs/vrm-spec)

**three-vrm loader**
- `@pixiv/three-vrm` and `@pixiv/three-vrm-animation` 3.5.5 were published 2026-07-09 (MIT). — [npm registry](https://registry.npmjs.org/@pixiv/three-vrm-animation)
- Usage:
  1. Register `VRMAnimationLoaderPlugin` on `GLTFLoader`.
  2. Read `gltf.userData.vrmAnimations`.
  3. `createVRMAnimationClip(vrmAnimation, vrm)` returns a three.js `AnimationClip` played through `AnimationMixer`.

  The exported motion is humanoid local rotations plus hips translation. — [ARDY2VRM README (third-party)](https://replicate.com/wanjon/ardy2vrm/readme). `createVRMAnimationClip` arrived in three-vrm v2.1.0. — [three-vrm compare v2.0.10...v2.1.0](https://redirect.github.com/pixiv/three-vrm/compare/v2.0.10...v2.1.0)
- Mixamo→VRM retargeting is a common community need. There are packages such as `vrm-mixamo-retarget` — [jsDelivr README](https://cdn.jsdelivr.net/npm/vrm-mixamo-retarget@1.0.3/README.md) — and a Mixamo→VRM rig map in CharacterGen — [Hugging Face](https://huggingface.co/spaces/AIbee999/CharacterGen_test/blob/604b72580a799f334d82bcc49c9075dce80694f4/render_script/three-js/src/mixamoVRMRigMap.js). Forum users report needing VRM-specific rest-pose and parent-rotation corrections for Mixamo clips. — [three.js forum](https://discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149)

**Adoption and standardization (Khronos CATSG, KHR_character)**
- VRM dates to 2018 and is used by VRoid Studio and cluster. The press release calls it "the de facto industry standard for avatar integration across platforms within Japan". VRMC and Khronos signed a liaison agreement in January 2024 and announced a collaboration on October 24, 2024 to propose VRM features as Khronos glTF extensions. — [Khronos press release](https://khronos.org/news/press/the-khronos-group-and-vrm-consortium-collaborate-to-advance-international-standardization-of-the-vrm-3d-avatar-file-format); [VRMC press PDF](https://vrm-consortium.org/en/common/pdf/VRMC%20Khronos%20Press%20Release%2020241024.pdf)
- Timeline from a Metaverse Standards Forum deck (SIGGRAPH, July 2026; CC BY 4.0):
  - December 2024–October 2025: initial phase of general-purpose character and avatar extensions.
  - October 2025: Khronos 3D Formats WG established the **Character and Avatar TSG (CATSG)**.
  - Roadmap: VRM 1.0 → "VRM 1.X" → "VRM 2.0" re-based on those extensions.

  — [MSF 3D Assets BOF, July 2026](https://metaverse-standards.org/wp-content/uploads/MSF-3D-Assets-BOF-SIGGRAPH-Jul26.pdf)
- Extension set, from the same deck:
  - `KHR_character`: root marker for runtime discovery.
  - `KHR_character_expression`, plus `_mask` and `_mapping` to ARKit/VRM vocabularies.
  - **`KHR_character_skeleton_mapping`**: "maps character rigs to standard vocabularies; supports multiple mappings".
  - **`KHR_character_reference_pose`**: "canonical reference poses for animation retargeting... Stored as single-frame animations".
  - `KHR_node_lookat`, `KHR_node_camera_hint`, and visibility hints.
  - Reference implementations: a three.js testbed (viewer, VRM converter, reference library) and a UnityGLTF branch.
  - Status: "Prone to change in the next few months as we move towards Release Candidate status."

  — [MSF deck](https://metaverse-standards.org/wp-content/uploads/MSF-3D-Assets-BOF-SIGGRAPH-Jul26.pdf)
- CATSG philosophy: "Establishing rigid skeletal and expression standards too early creates barriers for organizations looking to integrate these extensions." Active focus areas are "Animation: Types, Layers, Events, and integrating into Interactivity" and springbones. Future topics include "Skeleton Biped Standards: Collaborate with AOUSD and MSF on common humanoid bone vocabularies" and "Metadata Ontologies: Standardize asset attribution, licensing, and usage rights". — [MSF deck](https://metaverse-standards.org/wp-content/uploads/MSF-3D-Assets-BOF-SIGGRAPH-Jul26.pdf)
- Related drafts:
  - An open glTF PR titled "KHR_skeleton_bone" (aaronfranke), last updated 2026-08-12 according to a search listing; I did not review its content. — [KhronosGroup/glTF pulls](https://github.com/KhronosGroup/glTF/pulls)
  - Community drafts EXT_skeleton_humanoid and EXT_skin_humanoid (Takahiro Aoyagi, Mozilla) predefine a humanoid skeleton (T-pose, +Z facing) for remappable animation. They are not ratified. — [EXT_skeleton_humanoid](https://github.com/takahirox/EXT_skeleton_humanoid); [EXT_skin_humanoid](https://github.com/takahirox/EXT_skin_humanoid)
- 3GPP SA4's avatar study (FS_AVATAR) received a 2025 contribution titled "pCR VRM representation format" (title only seen). — [3GPP S4-250228](https://www.3gpp.org/ftp/tsg_sa/WG4_CODEC/TSGS4_131_Geneva/Inbox/Drafts/Video/S4-250228%20%5BFS_AVATAR%5D%20pCR%20VRM%20representation%20format-rev1.docx)

### Inferences
- **VRMA as interchange or target: yes for clips, no as the canonical format.** VRMA already solves three hard problems: bone semantics (VRM names), rest-pose normalization (VRM T-pose with arbitrary local axes) and size independence (rotations only plus hips translation). An agent-first package can export to and import from VRMA cheaply and play it in three.js through three-vrm. It cannot be the authoring format: it is binary per-frame quaternions with no key-pose semantics, no IK goals or contacts, no layering and no events.
- The predecessor's 15-point IK rig lines up with VRM's 15 required bones and Unity's 15-bone humanoid minimum (Q5). Mapping readable key poses onto VRM humanoid is therefore natural. Using VRM bone names for the canonical skeleton profile is low-risk and aligns with where Khronos is heading.
- VRM's `meta` license model is a useful precedent for per-motion license fields. Khronos lists licensing metadata only as a future topic.
- If `KHR_character_skeleton_mapping` and `KHR_character_reference_pose` reach RC or ratification (possibly late 2026 or 2027, my estimate), they become the official glTF way to declare bone vocabulary and reference pose. The package should plan to emit them.

### Gaps
- VRMA's exact official release date and adoption counts (files, apps) were not found.
- The license of the VRM specification text itself is not stated on the fetched pages.
- The KHR_character* spec texts and PR numbers were not located; only the MSF slide summary is available.
- Whether `createVRMAnimationClip` can target non-VRM skeletons was not verified.

---

## 3. OpenUSD / UsdSkel and AOUSD progress (Core Specification 1.0), relevance to games and the web

### Takeaway
AOUSD announced the ratified OpenUSD Core Specification 1.0 on December 17, 2025, covering composition, data model and USDA/USDC/USDZ. In July 2026 it began the ISO process with Core Spec 1.1 and expects Geometry, Materials and Physics domain specs later in 2026. There is no character or skeletal domain spec yet, only a "Characters, Motion and Interactivity" interest group. UsdSkel is an interchange encoding (explicitly not a rigging system) with no humanoid or retargeting conventions. USDA is text, but skeletal animation is stored as vectorized arrays, and three.js support is limited. For web games, OpenUSD matters for pipeline and DCC interchange (and AOUSD's "agentic workflows" positioning), not for runtime playback.

### Cited Findings
- December 17, 2025: AOUSD called Core Spec 1.0 "the first formal, ratified core standard for OpenUSD".
  - Scope: core algorithms (composition, data models, file formats), with specs for USDA (human-readable), USDC (binary) and USDZ (packaged).
  - It defines the minimum behavior for claiming compliance, and test implementations were released.
  - Geometry, materials and physics come as separate domain specs.
  - 1.1 is planned for 2026 with "animation spline parity with OpenUSD v25.08+", variable and path expressions.

  — [AOUSD announcement](https://aousd.org/news/core-spec-announcement/); [CG Channel](https://www.cgchannel.com/2025/12/aousd-releases-the-first-openusd-core-specification/); [PR Newswire](https://www.prnewswire.com/news-releases/alliance-for-openusd-announces-core-specification-1-0-the-universal-language-for-building-3d-worlds-302644952.html); [AOUSD blog](https://aousd.org/blog/foundations-of-open-3d-development-introducing-aousd-core-specification-1-0/)
- July 21, 2026 announcement:
  - AOUSD "begins the ISO certification process in Core Specification 1.1 release", and the Core Spec now has a GitHub repository.
  - Geometry, Materials and Physics 1.0 are "expected later this year".
  - OpenUSD v26.08 adds the Profiles, Multiple LOD and Backplates schemas.
  - New members: ByteDance, Huawei, Physicl and **Unity**.
  - OpenUSD "is emerging as the 3D data layer for agentic workflows across robotics, simulation and geospatial applications". Examples include NVIDIA's experimental "nanoUSD-labs" (agent-guided generation of a portable Core Spec implementation) and PICO OS 6 adopting USD for its Spatial SDK.
  - The release does not cover skeletal animation or UsdSkel.

  — [PR Newswire, Jul 21 2026](https://www.prnewswire.com/news-releases/alliance-for-openusd-drives-global-3d-data-interoperability-and-agentic-ai-workflows-with-new-core-specification-milestones-and-members-302830574.html)
- The AOUSD "Characters Motion and Interactivity Interest Group" (Film, Games, Robotics) aims at a "Rich representation of interoperable character components" built on UsdSkel and OpenExec. Its planned output is mapping the landscape and forming working groups. Khronos CATSG has "representation in AOUSD's Character Interest Group". — [MSF deck, July 2026](https://metaverse-standards.org/wp-content/uploads/MSF-3D-Assets-BOF-SIGGRAPH-Jul26.pdf)
- UsdSkel scope and encoding:
  - It "provides an encoding of simple skeletons and blend shapes" and "does _not_ signal an intent to provide general rigging and execution behaviors".
  - It targets game pipelines and crowds of "hundreds of thousands of agents".
  - Joint animation uses "a compact, vectorized encoding on each Skeleton". Skeleton and animation are separated so the rest state can be instanced. There is no sparse layering of joint transforms, and joints are in joint-local space.

  — [OpenUSD UsdSkel intro](https://openusd.org/dev/api/_usd_skel__intro.html)
- Web: a third-party report says three.js's built-in USDLoader handles USDZ but has "limited USDC support and minimal composition". Its own @cinevva/usdjs notes that UsdSkel bindings "need conversion to SkinnedMesh". — [Cinevva tech report](https://app.cinevva.com/guides/threejs-usdc-tech-report)
- Hydra 2.0 users report problems rendering a basic UsdSkel example (HumanFemaleWalk). — [AOUSD forum](https://forum.aousd.org/t/unable-to-render-basic-skeletal-animation-using-hydra-2-0/2104)

### Inferences
- OpenUSD is not a web-game runtime animation format in 2026. A UsdSkel/USDA exporter is a "later" item for pipeline integration, more valuable now that Unity has joined AOUSD and AOUSD markets USD for agentic workflows.
- USDA is diffable at the scene level, but a SkelAnimation (arrays of quaternions per time sample) is no more LLM-editable than glTF accessors.
- No humanoid skeleton standard will come from AOUSD in 2026. Coordination between the Khronos CATSG and the AOUSD interest group is the space to watch for a future cross-standard "biped vocabulary".

### Gaps
- No AOUSD timeline for a character or UsdSkel domain spec was found.
- three.js core USDLoader capabilities were not verified against source. UsdSkel support in Babylon, Godot and Bevy was not verified.

---

## 4. BVH, FBX (proprietary SDK; ufbx), Collada; SMPL / SMPL-H / SMPL-X and AMASS, with licenses

### Takeaway
BVH is the only legacy skeletal motion format that is plain text: a joint hierarchy plus one row of channel values per frame. It has no standard skeleton, naming or units. FBX remains the dominant DCC, mocap and Mixamo exchange format but is proprietary (Autodesk FBX SDK license; redistribution terms disputed). ufbx (MIT or Unlicense, single C file) is the practical open parser. Collada is legacy: Blender 5.0 removed its built-in support. SMPL-X and AMASS are licensed for non-commercial research only, with explicit bans on commercial use and on training models for commercial use. They cannot be bundled with, or used to train, a commercially usable package without paid licenses from Meshcapade or MPI.

### Cited Findings
**BVH**
- A BVH file has a HIERARCHY section (ROOT, JOINT, End Site, OFFSET, CHANNELS) and a MOTION section (Frames, Frame Time, one row per frame). OFFSET implies bone length. The root usually has 6 channels and other joints 3. End Sites have no channels. The format comes from Biovision, which no longer exists. — [GameDev.net BVH tutorial](https://gamedev.net/tutorials/programming/general-and-gameplay-programming/bvh-file-loading-and-displaying-r3295); [bvh gem docs](https://rdoc.info/gems/bvh). An example file has 7,286 frames at 0.016667 s per frame. — [arXiv 2507.03147](https://arxiv.org/pdf/2507.03147)
- three.js users report BVH→glTF retargeting problems ("skins are squeezed", odd motion unless only some bones are mapped). — [three.js forum](https://discourse.threejs.org/t/retargeting-a-bvh-animation/21898). A bvh2vrma converter exists. — [vrm.dev VRMA](https://vrm.dev/en/vrma/)

**FBX**
- The Autodesk FBX SDK 2020 license allows building products that "read and/or write and/or translate" files and link to the Library. Licensee Products may be redistributed if the SDK parts are sublicensed "as is". — [Unity copy of Autodesk FBX SDK license](https://unity.com/legal/autodesk-fbx); [SideFX copy](https://www.sidefx.com/docs/houdini/licenses/fbx.html). An Autodesk community thread quotes a passage saying the SDK cannot be redistributed without written permission, so this is unresolved. — [Autodesk forum](https://forums.autodesk.com/t5/fbx-forum/about-fbx-sdk-2020-license/td-p/11655924)
- ufbx:
  - "available under 2 licenses -- choose whichever you prefer": MIT or the Unlicense (public domain).
  - Ships as `ufbx.h` plus `ufbx.c`, C99/C++11.
  - Reads "binary and ASCII FBX files starting from version 3000", plus OBJ.
  - Offers "Animation curve evaluation / layer blending".
  - Quality claims: 592 test cases and 604 FBX files, AFL fuzzing, "95% branch line coverage", a goal of "feature parity with the official FBX SDK", and WASI tested.

  — [ufbx GitHub](https://github.com/ufbx/ufbx)
- three.js FBXLoader got skinning, bind-matrix, rotation-animation, morph and Z-up fixes in r184 (April 16, 2026). — [three.js releases](https://github.com/mrdoob/three.js/releases)
- Mixamo FBX bones use the `mixamorig:` prefix; DAE exports used an underscore. — [Adobe community](https://community.adobe.com/t5/mixamo-discussions/blender-addon-not-generating-ik-rig-on-characters-exported-as-dae/m-p/12196761/highlight/true)

**Collada**
- Blender: "Blender 4.5 (LTS...) will be the last release to have Collada Import/Export built-in. Blender 5.0 will remove Collada support." Developers suggested glTF, USD or FBX instead. — [Blender devtalk](https://devtalk.blender.org/t/moving-collada-i-o-to-legacy-status/34621?page=2). Third-party add-ons restore DAE for Blender 5.x (e.g., a BeamNG add-on released August 2026). — [BeamNG forum](https://www.beamng.com/posts/1961656/); [Superhive DAE importer](https://superhivemarket.com/products/dae-importer)

**SMPL family and AMASS (licenses and format)**
- SMPL-X model license:
  - "for academic research purposes": non-commercial research, education or artistic projects.
  - "any use for commercial, pornographic, military, or surveillance, purposes is prohibited".
  - Training models for those uses is barred.
  - No copying, sharing or redistribution (one archive copy allowed). Reverse engineering is prohibited.
  - "Model & Software" is defined to include "3D meshes, blend weights, blend shapes, textures, software, scripts, and animations".
  - Commercial licenses come through Meshcapade.

  — [SMPL-X model license](https://smpl-x.is.tue.mpg.de/modellicense.html)
- Meshcapade SMPL pricing (via search summary; "subject to change"): commercial micro tier €1,500/yr, SME €25,000/yr, enterprise on request. R&D tiers are €0 (micro) and €7,500 (SME); the R&D license does not allow commercialization. — [Meshcapade body models](https://meshcapade.com/assets/body-models)
- AMASS license:
  - Single-user, non-commercial; "any use for commercial purposes, is prohibited".
  - No redistribution.
  - "prohibits the use of the Dataset to train methods/algorithms/neural networks/etc. for commercial use of any kind".
  - Commercial license via ps-license@tue.mpg.de. Governed by German law. The ICCV 2019 paper must be cited.

  — [AMASS license](https://amass.is.tue.mpg.de/license.html); [AMASS paper (ICCV 2019)](https://openaccess.thecvf.com/content_ICCV_2019/papers/Mahmood_AMASS_Archive_of_Motion_Capture_As_Surface_Shapes_ICCV_2019_paper.pdf)
- AMASS `.npz` keys: `poses, gender, mocap_framerate, betas, marker_data, dmpls, marker_labels, trans`. `poses[t] = [root(3) | body(63) | hands(rest)]` in axis-angle. — [wikidocs AMASS tutorial](https://wikidocs.net/299587). The frame rate varies by sub-dataset (60 and 120 seen). — [genmotion docs](https://genmotion.readthedocs.io/en/latest/tutorial/render/maya/Maya%20convert%20AMASS%20to%20USD.html). Some SMPL-X-style AMASS variants use `root_orient`, `pose_body` and `pose_hand` keys instead. — [NVIDIA Kimodo docs](https://research.nvidia.com/labs/sil/projects/kimodo/docs/user_guide/output_formats.html)
- The `smplx` Python package's latest release is 0.1.28 (2021-05-26). — [PyPI](https://pypi.org/pypi/smplx/json)

### Inferences
- **BVH import is mandatory.** It is text, ubiquitous in mocap, and has a trivial parser, but each file needs per-skeleton mapping, units and axis handling.
- **FBX import via ufbx compiled to WASM** avoids the FBX SDK's licensing ambiguity. ufbx's permissive dual license is compatible with an MIT or Apache package.
- SMPL-H `poses` is 52 joints × 3 axis-angle values = 156 numbers per frame (my arithmetic; the source does not state the total). That is compact and numeric but not semantically readable.
- **License red line:** the package must not ship SMPL or AMASS assets or models trained on them for commercial use. Importing user-supplied AMASS files is acceptable only with a clear warning that outputs inherit research-only restrictions.

### Gaps
- Collada's Khronos status (whether maintained or archived) was not checked; the search budget ran out.
- The newest FBX SDK version number (2020.3.x?) was not confirmed.
- The SMPL and SMPL-H license pages were not fetched separately. I assume they are similar to SMPL-X, but this is unverified.

---

## 5. Humanoid bone conventions and retargeting systems; is there any cross-engine standard humanoid profile?

### Takeaway
Every ecosystem has its own humanoid profile and retargeter:
- Unity Humanoid/Mecanim: muscle space, at least 15 bones.
- Unreal IK Rig/IK Retargeter: auto-retarget since 5.4, op stack since 5.6, floor and crotch constraints in 5.7, foot plane in 5.8.
- Godot: SkeletonProfileHumanoid, BoneMap and Rest Fixer, plus RetargetModifier3D since 4.4.
- VRM humanoid: 55 bones, 15 required.
- Mixamo: `mixamorig:` naming.
- Rigify: DEF-/ORG-/MCH- bones, awkward for export.
- Babylon.js 9: AnimatorAvatar with name mapping.

The only formal cross-engine humanoid standard is ISO/IEC 19774 H-Anim (Web3D), which has negligible game-engine adoption. VRM is the de facto open profile. Khronos CATSG chose mapping-to-vocabularies over a fixed skeleton. **No cross-engine humanoid standard is in practical use in games as of October 2026.**

### Cited Findings
**Unity Humanoid (Mecanim)**
- A Humanoid skeleton needs "a minimum of 15 bones", and Unity advises naming bones after body parts. — [Unity manual: Using Humanoid Characters](https://docs.unity.cn/Manual/UsingHumanoidChars.html)
- `AvatarBuilder.BuildHumanAvatar` takes a `HumanDescription`, which sets "muscle-space range limits" and retargeting parameters (twist, stretch). `HumanTrait.RequiredBone`/`RequiredBoneCount` give the required set. `HumanPoseHandler` reads and writes humanoid poses from an avatar and root. — [AvatarBuilder (6000.6)](https://docs.unity.cn/6000.6/Documentation/ScriptReference/AvatarBuilder.BuildHumanAvatar.html); [HumanTrait](https://docs.unity.cn/ru/ScriptReference/HumanTrait.html); [HumanPoseHandler (6000.0)](https://docs.unity3d.com/kr/6000.0/ScriptReference/HumanPoseHandler-ctor.html)

**Unreal IK Rig / IK Retargeter**
- UE 5.4 (April 2024):
  - Motion Matching became production-ready (tested in Fortnite).
  - Automatic retargeting works between common skeletons (Mannequins, Mixamo, MotionBuilder, Xsens) and supports root motion and IK bones.

  — [Epic blog (DE)](https://www.unrealengine.com/de/blog/unreal-engine-5-4-is-now-available); [80.lv](https://cdn.80.lv/articles/unreal-engine-5-4-s-new-animation-workflow-showcased); [CG Press](https://cgpress.org/archives/unreal-engine-5-4-released.html)
- UE 5.6: the "pre 5.6" `op_stack` is deprecated in favor of `RetargetOps`. The retarget processor is no longer a UObject. Pelvis settings moved to the Pelvis Op and warping to the Stride Warp Op. — [UE Python API: IKRetargeter](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/IKRetargeter). Plugins regenerated assets for "the new retarget op stack in UE 5.6". — [UNAmedia docs](https://docs.unamedia.com/ue5-mixamo/ue5-runtime-retargeting)
- UE 5.7 (November 12, 2025):
  - Experimental "Spatially Aware Retargeting reduces self-collision".
  - A Crotch Height setting keeps the pelvis off the ground, and a Floor Constraint holds feet near the floor.
  - Rig Mapper (experimental) transfers motion between MetaHuman and ARKit.

  — [CG Channel](https://www.cgchannel.com/2025/11/unreal-engine-5-7-five-key-features-for-cg-artists/). Per-op LOD thresholds and op-stack profiling were added. — [UNAmedia docs](https://docs.unamedia.com/ue5-mixamo/ue5-runtime-retargeting). FBIK posing is about 20% faster. — [Tom Looman](https://tomlooman.com/unreal-engine-5-7-performance-highlights/)
- UE 5.8 (announced June 17, 2026; listed dates range from June 17 to 23; described as the final UE5 release):
  - "Define a foot plane and toes for the target character for better controlled transfers".
  - Retarget Override Sets.
  - RigMapper (Beta).

  — [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes); [wnhub](https://wnhub.io/news/engines/item-51157); [GameDev.net](https://gamedev.net/news/3999-unreal-engine-58-released/); [Product Hunt (June 19)](https://www.producthunt.com/products/unreal-engine/launches/unreal-engine-5-8). In 5.8 the IK Chains op was split into three ops, which broke some Blueprints. — [UE forum](https://forums.unrealengine.com/t/ue-5-8-gasp-ikchain-retargeting-seems-broken/2732399)
- Retargeter assets are scriptable through Python (`IKRetargeterController`). — [UE Python API](https://docs.unrealengine.com/5.2/en-US/PythonAPI/class/IKRetargeterController.html)

**Godot**
- Sharing animation requires matching bone names and Bone Rests. Godot provides `SkeletonProfileHumanoid`, a BoneMap with pattern-based auto-mapping, and Rest Fixer options:
  - Apply Node Transform.
  - **Normalize Position Tracks**: scales position values by the `scale_base_bone` (Hips) height and stores `motion_scale`.
  - **Overwrite Axis**: called "the most important option" for sharing.
  - Fix Silhouette: converts A-pose to T-pose.

  Limitations: auto-mapping favors English names, and heel height can break feet. These are the Godot **4.7** stable docs. — [Godot docs: Retargeting 3D skeletons](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/retargeting_3d_skeletons.html)
- `RetargetModifier3D` (4.4) preserves the imported bone rests that the 4.0 retargeter discarded. — [Godot blog, Dec 16 2025](https://godotengine.org/article/inverse-kinematics-returns-to-godot-4-6/)

**Mixamo and Rigify**
- Mixamo still works and is free with an Adobe account, but third-party guides (July and September 2026) describe it as in maintenance mode, and Adobe's Blender add-on fails on newer Blender. — [Cinevva guide](https://app.cinevva.com/guides/free-character-animations-rigging); [Cinevva Mixamo→Blender 2026](https://app.cinevva.com/guides/mixamo-to-blender-2026). Mixamo uses names like "LeftArm" rather than Blender's "Arm.L". — [BlenderPlugins](https://github.com/MinaPecheux/BlenderPlugins). three.js users report "inverted feet, backward hands" with mixamorig. — [three.js forum](https://discourse.threejs.org/t/skeletonutils-retarget-doesnt-work-with-mixamorig-skeleton-inverted-feet-backward-hands/54892)
- Rigify adds ORG- to metarig bones, MCH- to mechanism bones and DEF- to deform bones; only DEF bones deform. Generated DEF bones are often parented to ORG bones, which "is indeed not good for export". PR #104644 proposes fixing the parenting. — [Blender devtalk](https://devtalk.blender.org/t/rigify-parent-bones-of-some-def-bones/14745); [PR #104644](https://projects.blender.org/blender/blender-addons/pulls/104644); [issue #80764](https://projects.blender.org/blender/blender-addons/issues/80764)

**Babylon.js 9 AnimatorAvatar** (details in Q6): matches bones by name, with `mapNodeNames` for prefixes like `mixamorig:`, plus rest-pose gizmos, per-keyframe frame compensation, proportional root-motion scaling and ground-reference correction. — [Babylon forum announcement](https://forum.babylonjs.com/t/introducing-animation-retargeting/62547)

**H-Anim (ISO/IEC 19774)**
- ISO/IEC 19774-1:2019 (HAnim 2.0) defines five Levels of Articulation:
  - LOA-0: only `humanoid_root`.
  - LOA-1: 18 joints/segments.
  - LOA-2: 71.
  - LOA-3: 94.
  - LOA-4: 146 in the table versus 148 in a mailing-list excerpt (discrepancy).

  Annex A gives nominal body dimensions. Part 2 covers motion data animation. — [HAnim Architecture](https://www.web3d.org/documents/specifications/19774/V2.0/Architecture/HAnimArchitecture.html); [x3d-public LOA thread](https://web3d.org/pipermail/x3d-public_web3d.org/2020-June/013050.html); [HAnim Part 2 concepts](https://freewrl.sourceforge.io/tests/26_Humanoid_Animation/web3d/MotionDataAnimation/Concepts.html); [Web3D HAnim WG](https://www.web3d.org/working-groups/hanim)

**Cross-engine standardization stance**
- Khronos CATSG prioritizes flexibility ("ratify what we know won't change"). `KHR_character_skeleton_mapping` maps rigs to standard vocabularies. A common biped vocabulary is only a future topic with AOUSD and MSF. — [MSF deck](https://metaverse-standards.org/wp-content/uploads/MSF-3D-Assets-BOF-SIGGRAPH-Jul26.pdf)

### Inferences
- **No cross-engine standard humanoid profile is in practical use.** H-Anim is formal but unused in game engines. VRM's 55-bone vocabulary is the de facto open profile, and Unity's 15-bone minimum matches VRM's 15 required bones. The package should define its canonical skeleton profile as VRM-named (with optional extras) and ship mapping tables to Unity Humanoid, Godot SkeletonProfileHumanoid, UE Mannequin, Mixamo, Rigify (DEF-) and BVH/CMU. This is the "translation" approach CATSG itself advocates.
- Engines independently converged on size-independence tricks close to the predecessor's design: Godot's Normalize Position Tracks (hips height → `motion_scale`), Babylon's proportional root-motion scaling, and VRMA's rotation-only rule. The predecessor's "pelvis height as % of standing height" is a well-founded choice.
- Retargeting quality now hinges on contact constraints (UE floor constraint and foot plane, Babylon ground reference), which supports the predecessor's IK-based retargeting over pure rotation copy.

### Gaps
- The bone count and names of Godot's SkeletonProfileHumanoid and the full Unity HumanBodyBones enumeration were not fetched.
- UE 5.5 retargeter changes were not found.

---

## 6. Runtimes: three.js, three-vrm, Babylon.js, PlayCanvas, Godot, Bevy, Unity, Unreal. Which expose programmatic or text-based definitions an agent could write?

### Takeaway
- **three.js** (r186, September 2026) has a capable but low-level mixer: weights, crossfades, warps, additive via `makeClipAdditive`. It has no state machine, no root motion support, and a `SkeletonUtils.retargetClip` with long-standing quality complaints.
- **Babylon.js 9** (February 2026) added a stronger built-in retargeter (`AnimatorAvatar`).
- **PlayCanvas** (JSON state graph), **Godot** (`.tres`/`.tscn`), **Bevy** (`.animgraph.ron`) and **Unity** (YAML) store controllers as text an agent can write.
- **Unreal** is binary-asset-based but scriptable through Python. Its next-generation Unreal Animation Framework was still experimental in 5.7, and 5.8 is its first planned showcase.

### Cited Findings
**three.js**
- Latest: `three` 0.186.1 published 2026-09-24 (MIT). — [npm registry](https://registry.npmjs.org/three). GitHub releases list r184 (Apr 16), r185 (Jul 1) and r186 (Sep 24, "Latest"). — [three.js releases](https://github.com/mrdoob/three.js/releases). A third-party blog dates r186 to September 8 and r185 to June 25, which conflicts with GitHub. — [utsubo blog](https://www.utsubo.com/blog/threejs-2026-what-changed)
- Animation changes:
  - r183 (February 2026): `BezierInterpolant` (#32829) and devtools access to AnimationMixer (#32616). — [r183 release](https://github.com/mrdoob/three.js/releases/tag/r183)
  - r184: AnimationAction interpolant and timeScale fixes (#33033, #33035), `SkinnedMesh.applyBoneTransform` accepts Vector4 (#33091), CCDIKSolver limit fix (#33386).
  - r185: AnimationAction time-warp fix (#33617).
  - r186: "KeyframeTrack: Serialize/deserialize tangent data" (#34400).
  - No SkeletonUtils items are visible in r184–r186.

  — [three.js releases](https://github.com/mrdoob/three.js/releases)
- r185 upgrade note: `positionLocal` in a positionNode no longer includes skinning (use `positionGeometry`). — [utsubo blog](https://www.utsubo.com/blog/threejs-2026-what-changed)
- AnimationAction:
  - `blendMode` (NormalAnimationBlendMode / AdditiveAnimationBlendMode) and `weight` in [0, 1].
  - Transitions: `fadeIn`, `fadeOut`, `crossFadeFrom`, `crossFadeTo`, `warp`, `syncWith`.
  - `timeScale` (negative plays backwards); loop modes LoopRepeat, LoopOnce, LoopPingPong; `clampWhenFinished`; `zeroSlopeAtStart`/`zeroSlopeAtEnd`.
  - The page does not mention root motion.

  — [three.js AnimationAction docs](https://threejs.org/docs/pages/AnimationAction.html)
- `AnimationUtils.makeClipAdditive(targetClip, referenceFrame = 0, referenceClip = targetClip, fps = 30)` and `subclip(...)`. — [three.js AnimationUtils docs](https://threejs.org/docs/pages/AnimationUtils.html)
- Root motion: there is no API. The community uses loop-event hacks or exports in-place animation and moves the object in code. — [three.js forum 5116](https://discourse.threejs.org/t/looping-skinned-mesh-animation-with-root-motion/5116); [three.js forum 88379](https://discourse.threejs.org/t/root-motion-walk-animation-snap-back-issue/88379)
- `SkeletonUtils.retarget(target, source, options)` and `retargetClip(target, source, clip, options)`. The target must have `skeleton`. Documented `RetargetOptions`:
  - `useFirstFramePosition`, `fps`, `names`, `getBoneName`, `trim`.
  - `preserveBoneMatrix` (true), `preserveBonePositions` (true), `useTargetMatrix`.
  - `hip` ('hip'), `hipInfluence`, `scale`, `localOffsets`, `hipPosition`.

  — [three.js SkeletonUtils docs](https://threejs.org/docs/pages/module-SkeletonUtils.html)
- Known retargeting problems (May 2024 thread):
  - Retargeting between two copies of the same glTF model does not reproduce the original.
  - The function does not handle glTF bind matrices (diagnosis by sunag).
  - `retargetClip` relies on an unofficial `.skeleton` property on `SkeletonHelper`.
  - Linked issues: #25288 (off-by-one frame) and #25751.
  - There is no official example.

  A later thread, "RetargetClip twists character" (October 29, 2024), describes similar trouble. — [three.js forum 65149](https://discourse.threejs.org/t/fixing-skeletonutils-retarget-and-retargetclip-functions/65149); [three.js forum 73410](https://discourse.threejs.org/t/retargetclip-twists-character/73410)
- three-vrm: VRMA → `AnimationClip` via `createVRMAnimationClip` (see Q2). — [npm registry](https://registry.npmjs.org/@pixiv/three-vrm-animation)

**Babylon.js**
- Version 9.0 retargeting (announced February 24, 2026):
  - `new AnimatorAvatar(name, rootNode)` and `retargetAnimationGroup(sourceGroup, options)`.
  - Options: `animationGroupName`, `fixRootPosition`, `fixGroundReference`, `rootNodeName`, `groundReferenceNodeName`, `mapNodeNames`.
  - Each keyframe is remapped between bone frames. Root displacement is "scaled proportionally". Ground reference "keeps feet planted", with a dynamic mode for kicks and crouches. Morph targets are supported.
  - Source groups must animate TransformNodes.
  - A no-code Retargeting Tool exports Playground code.

  — [Babylon forum announcement](https://forum.babylonjs.com/t/introducing-animation-retargeting/62547); [Babylon retargeting docs](https://doc.babylonjs.com/features/featuresDeepDive/animation/animationRetargeting); [AnimatorAvatar typings 9.18.0](https://app.unpkg.com/@babylonjs/core@9.18.0/files/Animations/animatorAvatar.d.ts)
- Problems reported:
  - A snap-to-rest-pose bug was fixed in PR #18450 (9.7.0 and later). The advice is to retarget once at load and cache the result.
  - Rest poses must match exactly.
  - Rotated avatar meshes fail.

  — [forum 63379](https://forum.babylonjs.com/t/after-anim-retarget-stopping-current-animation-jumps-to-rest-pose/63379); [forum 63568](https://forum.babylonjs.com/t/how-to-properly-retarget-animations/63568/6); [forum 63366](https://forum.babylonjs.com/t/retargeting-fails-if-avatar-mesh-is-rotated/63366)
- Latest `@babylonjs/core` is 9.30.0, published 2026-10-08 (Apache-2.0). — [npm registry](https://registry.npmjs.org/@babylonjs/core)
- AnimationGroup: `weight`, `enableBlending`, `blendingSpeed`; `AnimationGroupMask` (include/exclude); `normalize`; `speedRatio`; loop and end observables. — [Babylon AnimationGroup docs](https://doc.babylonjs.com/features/featuresDeepDive/animation/groupAnimations). Additive blending uses `AnimationGroup.MakeAnimationAdditive` (with a reference frame) or `isAdditive`. — [Babylon forum](https://forum.babylonjs.com/t/issue-with-disappearing-model-when-cloning-animation-group-for-additive-blending/50521); [Babylon forum](https://forum.babylonjs.com/t/additive-animations-behave-very-oddly/21077)

**PlayCanvas**
- `playcanvas` 2.23.2, published 2026-10-09 (MIT). — [npm registry](https://registry.npmjs.org/playcanvas)
- animstategraph asset:
  - States, including START, END and ANY.
  - Transitions with duration, exit time, offset, interruption source and priority.
  - Parameters (Boolean, Float, Integer, Trigger) and conditions.
  - Layers (Override or Additive) with runtime `weight`, and layer masks.

  — [PlayCanvas manual](https://developer.playcanvas.com/user-manual/animation/anim-state-graph-assets/)
- `AnimComponent.loadStateGraph(stateGraph)` takes a plain object, e.g. `{layers:[{name, states:[{name, speed, loop, defaultState}], transitions:[{from, to}]}], parameters:{}}`. Related calls: `assignAnimation(nodePath, animTrack, layerName, speed, loop)`, `setFloat`, `setBoolean`, `setTrigger`. — [PlayCanvas API](https://api.playcanvas.com/engine/classes/AnimComponent.html)

**Godot**
- Godot 4.7 went stable in June 2026. RC1 came out June 8; a Chinese news site dates the release to June 19 (exact day unconfirmed). — [Godot RC1](https://godotengine.org/article/release-candidate-godot-4-7-rc-1/); [wnhub (zh)](https://wnhub.io/zh/news/engines/item-51174). 4.7 animation items include AwaitTweener, collapsible track groups and an AnimationTree crash fix. — [Cinevva (fr)](https://app.cinevva.com/fr/news/2026-06-12-godot-4-7-rc)
- AnimationTree:
  - Root nodes: Animation, BlendTree, BlendSpace1D/2D, StateMachine.
  - BlendTree nodes: Blend2/3, OneShot, TimeSeek, TimeScale, Transition.
  - StateMachine transitions: Immediate, Sync, At End.
  - Filters for layering.
  - Root motion: selecting a root motion track "cancels the bone transformation visually", and `get_root_motion_position/rotation/scale` read the motion.

  — [Godot AnimationTree docs](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html)
- TSCN/TRES are text: "mostly human-readable and easy for version control systems to manage". Animation tracks are stored as `tracks/<id>/<attribute>`; 3D track `keys` is a PackedFloat32Array. — [Godot TSCN format docs](https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html)

**Bevy**
- Release dates: 0.14 (2024-07-04), 0.15 (2024-11-29), 0.16 (2025-04-24), 0.17 (2025-09-30), 0.18 (2026-01-13), 0.19 (2026-06-19), **0.20 (2026-10-08)**. — [bevy.org news](https://bevy.org/news/); [Bevy 0.20](https://bevy.org/news/bevy-0-20/); crate `bevy` 0.20.0 — [crates.io](https://crates.io/crates/bevy)
- Built-in animation graphs arrived in 0.14. — [bevy_animation_graph README](https://github.com/mbrea-c/bevy_animation_graph)
- 0.15 added:
  - Animation of arbitrary component fields (`AnimatableProperty`, `animated_field!`).
  - Masks and additive blending (`Add` node).
  - Animation events, including events on specific bones (e.g., footstep dust).
  - The `Curve<T>` API and `EaseFunction`.

  — [Bevy 0.15 release notes](https://bevy.org/news/bevy-0-15/)
- `AnimationGraph` (0.20 docs) has blend, add and clip nodes with weights and mask groups (bitfields). Graphs "can be saved and loaded as RON text", with the canonical extension `.animgraph.ron`. Builder API: `add_clip`, `add_blend`, `add_additive_blend`, `add_edge`, `save`. — [docs.rs AnimationGraph](https://docs.rs/bevy/latest/bevy/animation/graph/struct.AnimationGraph.html)
- Ecosystem crates: `bevy_animation_graph` 0.11.0 (2026-07-11, third-party) — [crates.io](https://crates.io/crates/bevy_animation_graph); `bevy_mod_inverse_kinematics` 0.12.0 (2026-09-01) — [crates.io](https://crates.io/crates/bevy_mod_inverse_kinematics)

**Unity**
- The Unity 6.4 manual still calls Mecanim the recommended system. — [Unity 6.4 manual](https://docs.unity3d.com/6000.4/Documentation/Manual/AnimationSection.html). Unity's successor animation system was targeted "during the Unity 6 release lifecycle" with no committed version (Q1 2025 update). I found no evidence it has shipped. — [Unity discussions](https://discussions.unity.com/t/animation-status-update-q1-2025-gdc-roadmap/1614718)
- Animation Rigging: 1.3.1 is stable for Unity 6.0, and 1.4.0-pre.1 exists. In Unity 6.6 alpha, core packages are fixed to the Editor version. — [Unity 6.0 docs](https://docs.unity3d.com/6/Documentation/Manual/com.unity.animation.rigging.html); [Unity 6.6 docs](https://docs.unity3d.com/6000.6/Documentation/Manual/com.unity.animation.rigging.html)
- Text serialization: assets are YAML in Force Text mode, which merges better in version control. — [Unity manual](https://docs.unity3d.com/Manual/TextSceneFormat.html). AnimatorControllers are YAML (`--- !u!91`), but state motions are referenced by `fileID`, not by name. — [Unity discussions](https://discussions.unity.com/t/easy-replacement-of-animations-in-controller-and-blendshapes/660523). Editing outside Unity is "not recommended". — [FileInfo](https://fileinfo.com/extension/controller)

**Unreal**
- UAF is "the future replacement for Anim Blueprints". 5.7 added a Footplacement Control Rig node. UAF sample content slipped to 5.8, and Mover is experimental. — [Epic GASP 5.7 blog](https://www.unrealengine.com/tech-blog/explore-the-updates-to-the-game-animation-sample-project-in-ue-5-7). The UAF plugin lives under the Experimental plugins path. — [UE API docs](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/UAF/UAnimNextComponent)
- UE 5.8:
  - Control Rig Physics (Beta) "behave as layered rigs, compositing naturally on top of existing animation".
  - Animation Mixer in Sequencer (Experimental) supports UAF workflows.
  - Mutable is production-ready.

  — [UE 5.8 release notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes)
- Motion Matching has been production-ready since 5.4. — [Epic blog (DE)](https://www.unrealengine.com/de/blog/unreal-engine-5-4-is-now-available)

### Inferences
Agent-writability of controller and graph definitions (my assessment, based on the cited formats):

| Runtime | Controller / graph definition | Text? | Agent-writable? | Notes |
|---|---|---|---|---|
| three.js | Code only (AnimationMixer/Action); KeyframeTrack has JSON serialization | Code | Yes, as JS code | No state machine, root motion or reliable retargeter: the adapter must provide them |
| three-vrm | VRMA → AnimationClip | Binary input | Indirect | Good playback path for VRM avatars |
| Babylon.js 9 | Code; retarget options object; tool exports Playground code | Code | Yes | Best built-in web retargeter; TransformNode limitation |
| PlayCanvas | `loadStateGraph` JSON object | JSON | **High** | Closest web analog to a declarative state machine |
| Godot | `.tres`/`.tscn` resources (AnimationTree, Animation) | Text | **High** | Human-readable, VCS-friendly; dense packed arrays for 3D keys |
| Bevy | `.animgraph.ron` and Rust builder API | RON | **High** | Graph is text; clips usually come from glTF |
| Unity | YAML assets with fileID cross-references; C# APIs (HumanPoseHandler, AvatarBuilder) | YAML | Medium/low | fileID references make hand-written YAML fragile; prefer C# editor scripts |
| Unreal | Binary .uasset; Python API (IKRetargeterController); UAF experimental | Binary | Low (Python only) | Adapter should import glTF/FBX plus Python setup scripts |

- For three.js, the package's adapter must add a small declarative state machine or blend graph (PlayCanvas- or Bevy-like), root-motion extraction (hips XZ delta to object), and its own retargeter. Relying on `SkeletonUtils.retargetClip` is risky given the documented failures.

### Gaps
- r183's full changelog was truncated. When `localOffsets` and `hipPosition` were added to SkeletonUtils, and whether any retargeting fix landed in r16x–r18x, was not verified.
- Babylon's official additive-animation docs and the PlayCanvas blend-tree JSON schema were not fetched.
- No built-in retargeting or IK in Bevy core was found (absence not proven).
- The exact Godot 4.7 stable date is unconfirmed.

---

## 7. IK and procedural animation libraries in JavaScript/WASM; foot locking and contact solving

### Takeaway
JavaScript IK options are thin:
- three.js ships only `CCDIKSolver` (addon).
- `closed-chain-ik` (damped least squares, Apache-2.0) is robust but robotics-oriented, and its last npm release was in 2023.
- THREE.IK (FABRIK) is a self-declared work in progress.

I found no maintained JavaScript foot-locking or contact-solving library. Native engines are ahead: Godot 4.6's IK modifier family, Unreal's footplacement Control Rig node and retargeter floor/foot constraints, and Babylon's ground-reference correction. The package will likely need its own analytic two-bone IK plus a foot-lock layer, which matches the predecessor's IK retargeting.

### Cited Findings
- three.js `CCDIKSolver` (addons) got "Fix limitation handling" (#33386) in r184. — [three.js releases](https://github.com/mrdoob/three.js/releases)
- closed-chain-ik-js (gkjohnson):
  - A generalized IK solver for closed chains and parallel kinematic systems.
  - Uses damped least squares (after Buss).
  - Supports translation and rotation joints.
  - Framework-agnostic, with three.js mapping and URDF helpers.

  — [npm closed-chain-ik](https://npmjs.com/package/closed-chain-ik); [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fgkjohnson%2Fclosed-chain-ik-js); [three.js forum post](https://discourse.threejs.org/t/closed-chain-ik-an-ik-solver-for-parallel-kinematic-systems/89829). The latest npm version is 0.0.3, published 2023-05-04 (Apache-2.0). — [npm registry](https://registry.npmjs.org/closed-chain-ik)
- THREE.IK: "multiple chains with multiple effectors, solved via FABRIK iterative solver" and a ball-joint constraint. It is marked work in progress, with breaking changes expected. — [THREE.IK README (fork)](https://github.com/whatisor/THREE.IK/blob/master/README.md); [three-ik on npm](https://www.npmjs.com/package/three-ik)
- Godot 4.6 IK (December 2025 article):
  - `IKModifier3D` → `TwoBoneIK3D` and `ChainIK3D`.
  - `ChainIK3D` → `SplineIK3D` and `IterateIK3D`.
  - `IterateIK3D` → `FABRIK3D`, `CCDIK3D`, `JacobianIK3D`.
  - Helpers: `BoneTwistDisperser3D`, `LimitAngularVelocityModifier3D`.
  - Caveats: "if the number of iterations per frame is small, the end bone may never reach its goal". Deterministic IK "cannot avoid causing rotation with large angular velocities".

  — [Godot blog](https://godotengine.org/article/inverse-kinematics-returns-to-godot-4-6/)
- Unreal: 5.7 added a Footplacement Control Rig node — [Epic GASP 5.7 blog](https://www.unrealengine.com/tech-blog/explore-the-updates-to-the-game-animation-sample-project-in-ue-5-7). The retargeter added Floor Constraint and Crotch Height in 5.7 — [CG Channel](https://www.cgchannel.com/2025/11/unreal-engine-5-7-five-key-features-for-cg-artists/) — and a foot plane and toes definition in 5.8 — [UE 5.8 notes](https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes)
- Babylon.js 9 ground-reference correction keeps feet planted, with a dynamic mode for kicks and crouches. — [Babylon forum announcement](https://forum.babylonjs.com/t/introducing-animation-retargeting/62547)
- Bevy animation events can target bones, e.g. foot-contact effects. — [Bevy 0.15 release notes](https://bevy.org/news/bevy-0-15/)
- Rapier's changelog (2024) added inverse kinematics for multibodies. — [Rapier CHANGELOG (mirror)](https://git.nea.moe/github/rapier.git/plain/CHANGELOG.md?h=v0.21.0)

### Inferences
- The predecessor's limb encoding (shoulder-to-hand or hip-to-ankle direction, plus bend angle and twist) is a two-bone IK parameterization. It maps directly onto analytic two-bone solvers (Godot `TwoBoneIK3D`, Unreal two-bone IK) and can be solved in closed form in JavaScript without an iterative library.
- Foot locking needs three parts: (a) contact detection (from authored contact flags in the canonical format, or velocity and height thresholds), (b) world-space pinning of the foot target during contact, and (c) pelvis height compensation. Making contacts explicit and agent-editable in the canonical format is a differentiator, since glTF and VRMA cannot carry them.

### Gaps
- No maintained, widely used JavaScript full-body IK or FABRIK library for three.js was verified for 2026. No JavaScript foot-locking or contact library was found.

---

## 8. Rapier 3D capabilities for animation (multibody and impulse joints, motors, ragdolls, character controller), browser physics-based animation, and MuJoCo in WASM

### Takeaway
Rapier (Apache-2.0; Rust crate `rapier3d` 0.36.1, JavaScript `@dimforge/rapier3d` 0.21.0) has the primitives for ragdolls and active ragdolls:
- Impulse joints and reduced-coordinate multibody joints.
- PD joint motors on spherical, revolute and prismatic joints.
- Multibody IK.
- A kinematic move-and-slide character controller.

It has no ready-made active-ragdoll or pose-tracking controller, and the browser examples I found are capsule controllers. MuJoCo now has official WASM bindings (`@mujoco/mujoco` 3.15.0, October 5, 2026). They are still marked work in progress but offer a research-grade path to physics-based character control in the browser.

### Cited Findings
- Versions: crate `rapier3d` 0.36.1 (2026-10-10) — [crates.io](https://crates.io/crates/rapier3d); `@dimforge/rapier3d` and `@dimforge/rapier3d-compat` 0.21.0 (2026-09-25, Apache-2.0) — [npm registry](https://registry.npmjs.org/@dimforge/rapier3d)
- Rapier JS joints:
  - Inserted with `world.createImpulseJoint` or `world.createMultibodyJoint`.
  - Types: fixed, spherical ("typical choice for shoulders"), revolute (elbows, knees), prismatic, and GenericJoint-based (free, cartesian, planar, cylindrical, pin-slot, rectangular, universal).
  - Motors on spherical, revolute and prismatic joints use a PD controller: `configureMotorPosition(target, stiffness, damping)`, `configureMotorVelocity`, `configureMotor`, `configureMotorModel`, plus a maximum motor impulse.
  - Limits are documented only for prismatic joints on this page.

  — [Rapier JS joints guide](https://rapier.rs/docs/user_guides/javascript/joints)
- Impulse versus multibody (Rust guide):
  - Impulse joints can break "if the constraint solver does not converge completely", allow any graph, and expose joint forces.
  - Multibody (reduced coordinates): "no way the body shifts to a position that is not realistic". They are more stable for large assemblies and allow moderately large time steps, but are slow to add or remove, and "Joint forces are never computed explicitly".
  - "bodies must be linked following a tree structure"; inserting a loop returns `None`. Loops are closed by adding an impulse constraint on top.
  - Robotics (control, IK) favors reduced coordinates; video games traditionally favor constraints.

  — [Rapier joint constraints guide](https://rapier.rs/docs/user_guides/rust/joint_constraints)
- KinematicCharacterController (JS 0.21):
  - Move-and-slide using shape casts, with an offset, slope limits, autostep, snap-to-ground and `setApplyImpulsesToDynamicBodies`.
  - `computeColliderMovement` returns the corrected motion; collisions are reported in order.
  - Limits: "does not support rotational movement", gravity must be emulated, and it drives kinematic bodies.

  — [Rapier character controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller)
- Multibody IK was added in 2024. — [Rapier CHANGELOG (mirror)](https://git.nea.moe/github/rapier.git/plain/CHANGELOG.md?h=v0.21.0)
- Browser examples: a Codrops tutorial (2025-05-28) builds a physics-based character controller with R3F and Rapier (capsule, not a ragdoll). — [Codrops](https://tympanus.net/codrops/2025/05/28/building-a-physics-based-character-controller-with-the-help-of-ai/). A react-three-rapier floating-capsule controller self-rights after hits. — [GitHub](https://github.com/Daudxu/CharacterControl-threejs). A three.js forum thread on active ragdolls points to cannon.js demos. — [three.js forum](https://discourse.threejs.org/t/active-ragdoll-physics/67247)
- MuJoCo official JavaScript/WASM bindings (`@mujoco/mujoco`):
  - Maintained by Google DeepMind, "always up to date with the latest developments in MuJoCo". ESM package with `.wasm`, bindings and TypeScript declarations.
  - Single-threaded by default. A multi-threaded build (`/mt`) needs COOP/COEP cross-origin isolation.
  - Core APIs (`mj_step`, `mj_loadXML`) are well tested; `mjspec` functions are less so.
  - Marked work in progress. Linux and Chrome are primary; Windows was experimental as of 2025-11-13. Objects must be freed manually with `.delete()`.

  — [@mujoco/mujoco README](https://cdn.jsdelivr.net/npm/@mujoco/mujoco@3.15.0/README.md). Version 3.15.0 was published 2026-10-05 (Apache-2.0) — [npm registry](https://registry.npmjs.org/@mujoco/mujoco); PyPI `mujoco` 3.15.0 — [PyPI](https://pypi.org/pypi/mujoco/json). The community mujoco_wasm (zalo) is pinned to an older MuJoCo (3.3.8 in a fork). — [MuJoCo repo](https://github.com/google-deepmind/mujoco); [mujoco_wasm fork](https://github.com/krishpop/mujoco_wasm)

### Inferences
- Practical Rapier roles for the package:
  - Passive ragdoll on death or hit: multibody tree from the canonical 15-point rig.
  - Partial physical blending: motors tracking animated joint targets using the PD stiffness and damping API.
  - KCC to drive the root during locomotion, with animation supplying limb motion and foot IK.
- A true active ragdoll that balances needs a controller on top of the motors (balance and center-of-mass control). That is a research-sized add-on, not a v1 feature.
- MuJoCo WASM (Apache-2.0) suits learned physics controllers (RL policies on MJCF humanoids) running in the browser. It is heavier, and its bindings are still work in progress, so it is better as an optional adapter than a core dependency.

### Gaps
- No browser active-ragdoll demo built on Rapier was verified.
- Rapier's per-axis spherical limits and contacts between jointed bodies were not covered on the fetched pages.
- MuJoCo WASM bundle size and performance are unknown.

---

## 9. Animation compression and size: keyframe reduction, quaternion quantization, ACL, typical sizes per clip

### Takeaway
ACL (MIT, v2.1.0) is the state of the art for runtime skeletal compression: about 22:1 on the CMU mocap database with sub-millimetre error, shipped with Unreal, and CI-tested on Emscripten/WASM. On the web the practical pipeline is glTF plus resampling and quantization plus meshopt (16-bit quaternions plus the QUATERNION filter). From ACL's numbers, raw sampled mocap averages about 40 KB per second of motion, and compressed about 2 KB per second. A sparse key-pose text format could plausibly sit in the same range as compressed binary.

### Cited Findings
- ACL: "This project uses the MIT license" (© 2017 Nicholas Frechette and contributors). CI covers Windows, Linux, macOS and **Emscripten (WASM)**. The Unreal plugin is "distributed... as part of each engine release since UE 5.13" (as fetched; presumably UE 5.3). The goals are "Minimizing the compression artifacts" and fast decompression. — [ACL GitHub](https://github.com/nfrechette/acl)
- ACL v2.1.0 on CMU (2,534 clips at 24 FPS, 9h 49m 37.58s):
  - Raw 1,429.38 MB → **65.66 MB (21.77:1)**.
  - Max error 0.0495 cm; 99th percentile 0.0089 cm; 99.96% of samples under 0.01 cm.
  - Compression took 1m 45s.
  - Earlier versions: v2.0.0 72.14 MB; v1.3.0 71.00 MB.

  — [ACL CMU performance](https://raw.githubusercontent.com/nfrechette/acl/develop/docs/cmu_performance.md)
- glTF core already allows normalized-integer rotation outputs. — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc). KHR_meshopt_compression recommends 16-bit normalized rotations with the QUATERNION filter, EXPONENTIAL for translation and scale, high-precision times, keyframe removal, resampling and shared input accessors. — [KHR_meshopt_compression README](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_meshopt_compression/README.md)
- gltfpack quantizes and resamples animations. — [gltfpack docs](https://meshoptimizer.org/gltf/)
- Base64 adds 33% to embedded buffers. — [glTF 2.0 Specification](https://raw.githubusercontent.com/KhronosGroup/glTF/main/specification/2.0/Specification.adoc)
- Spine: JSON "has a larger file size than the binary format and is slower to load at runtime". — [Spine JSON format](https://en.esotericsoftware.com/spine-json-format)
- A Rust port of ozz-animation exists (`ozz-animation-rs` 0.11.0, 2025-10-14). — [crates.io](https://crates.io/crates/ozz-animation-rs)

### Inferences
- Averages derived from ACL's CMU figures (my arithmetic):
  - Mean clip length is about 14.0 s.
  - Raw: about 564 KB per clip, about 40 KB per second.
  - ACL-compressed: about 26 KB per clip, about 1.9 KB per second.
- Back-of-envelope web sizing for a 20-bone character at 30 fps with rotation-only tracks:
  - float32 quaternions: 20 × 16 B × 30 ≈ 9.6 KB/s.
  - int16 quaternions: about 4.8 KB/s, before meshopt entropy coding and keyframe removal.
- A readable key-pose format would likely be about 1–3 KB/s pretty-printed, and smaller gzipped. For example: about 15–20 integer parameters per key pose (pelvis height, torso turn/lean/tilt, 4 limbs × direction + bend + twist, feet), at 2–8 key poses per second. That is within an order of magnitude of ACL-compressed mocap and much smaller than raw sampled clips, but only for stylized or keyed motion, not dense mocap. The agent-readable canonical format can be both readable and compact for game-style clips; dense mocap should be imported, reduced to keys, then baked out to glTF/VRMA for runtime.
- ACL's WASM CI suggests a compiled ACL decompressor for the web is feasible, but I found no published JavaScript binding.

### Gaps
- No measured sizes for typical web glTF character clips (e.g., Mixamo clips after gltfpack/meshopt) were found.
- No ACL JavaScript or WASM package was found.
- ozz-animation (C++, WASM samples) was not researched because the search budget ran out.

---

## 10. Text-based animation description languages and precedents (Spine, DragonBones, Lottie, Rive, BML, other LLM-readable DSLs). Which are open specs?

### Takeaway
Human-readable skeletal animation formats exist mostly in 2D:
- **Spine JSON** is readable and editable, but its runtimes require Spine Editor licenses.
- **DragonBones JSON** is MIT-licensed but the project is discontinued.
- **Lottie** is an open JSON spec (v1.0, September 2024, Lottie Animation Community under the Joint Development Foundation, a Linux Foundation project), but it is vector and layer animation without bones.
- **Rive** uses a documented binary format with MIT runtimes and a proprietary editor.
- **BML 1.0** is an open XML standard for behavior-level (not keyframe-level) control of virtual humans.
- **PoseScript** "posecodes" are a research precedent for rule-based text descriptions of 3D poses.
- Engine text formats (Godot `.tres`, Bevy RON, PlayCanvas JSON, Unity YAML, glTF KHR_interactivity JSON) are text but low-level.

I found **no open, LLM-oriented 3D skeletal motion DSL with humanoid semantics**. That is the gap the proposed package targets.

### Cited Findings
**Spine**
- Top-level sections: skeleton, bones ("parent always comes before a child bone"), slots, ik, transform, path, skins, events, animations.
- Bone timelines: `rotate`, `translate`, `scale`, `shear`, with `time` and values relative to the setup pose.
- Curves: omitted for linear, `"stepped"`, or a 4-number Bézier.
- IK timelines: `mix`, `softness`, `bendPositive`, `compress`, `stretch`.
- "The JSON format is human readable and editable, especially when used with the "pretty print" setting". Spine "can import data in this format".

— [Spine JSON format](https://en.esotericsoftware.com/spine-json-format)
- Spine Runtimes License (last updated 2025-04-05): "each user of the Products must obtain their own Spine Editor license". — [Spine Runtimes License](https://en.esotericsoftware.com/spine-runtimes-license). `@esotericsoftware/spine-core` 4.3.13 (2026-07-24) ships under a custom license reference. — [npm registry](https://registry.npmjs.org/@esotericsoftware/spine-core)

**DragonBones**
- Listed as discontinued (developer silent, downloads broken), license MIT. — [AlternativeTo](https://alternativeto.net/software/dragonbones/about)
- Community tools document the 5.5 JSON format and convert it to Spine JSON. — [dragonbones-tools JSON 5.5 doc](https://unpkg.com/dragonbones-tools@0.1.2/doc/dragonbones_json_format_5.5.md); [DB Reborn converter](https://forum.defold.com/t/db-reborn-convert-old-dragonbones-json-to-spinejson-files/82479)

**Lottie**
- The Lottie Animation Community announced the v1.0 specification on September 17, 2024. It operates under the Joint Development Foundation (a Linux Foundation project). v1.0 covers commonly implemented features and ships a JSON schema. — [Linux Foundation press](https://www.linuxfoundation.org/press/lottie-animation-community-announces-lottie-v1.0-specification). Text layers and effects are not in v1.0; the release came with IANA registration. — [LottieFiles blog](https://lottiefiles.com/blog/inside-lottiefiles/lottie-specification-v1-0-a-milestone-for-open-source-animation)
- The spec page says "still a work in progress" and "Lottie documents MUST use JSON", and links a Community Specification License 1.0. It does not mention skeletal or bone animation. — [Lottie spec](https://lottie.github.io/lottie-spec/latest/)
- Latest packages: `lottie-web` 5.13.0 (2025-05-21); `@lottiefiles/dotlottie-web` 0.81.0 (2026-10-06). — [npm registry](https://registry.npmjs.org/lottie-web); [npm registry](https://registry.npmjs.org/@lottiefiles/dotlottie-web)

**Rive**
- `.riv` is the binary runtime format exported by the editor: little-endian, "RIVE" fingerprint, major version 7. Version 6 exports lack state machines. A table of contents lets older runtimes skip unknown fields. — [Rive format docs](https://rive.app/docs/runtimes/advanced-topic/format)
- "Our official runtimes are all open-source and licensed under the MIT License." — [Rive runtimes docs](https://rive.app/docs/runtimes)
- State machines "define the logic that controls interactive animations". Rive publishes an `llms.txt` docs index. — [Rive state machines](https://rive.app/docs/runtimes/state-machines). `@rive-app/canvas` 2.44.2 (2026-10-10, MIT). — [npm registry](https://registry.npmjs.org/@rive-app/canvas)

**BML (Behavior Markup Language) 1.0**
- An XML language for controlling verbal and nonverbal behavior of humanoid embodied conversational agents. It has a small core plus extensions covering synchronisation, face, gaze, gesture, head, locomotion, posture and speech, plus feedback. It is executed by "BML Realizers". — [BML 1.0 standard wiki](https://projects.cs.ru.is/projects/behavior-markup-language/wiki); [BML 1.0 PDF](https://projects.cs.ru.is/attachments/download/843/bml-standard-1.pdf)
- BML is part of the SAIBA pipeline: intent planning → FML → behavior planning → BML → realization. — [Kopp et al., IVA 2006](https://alumni.media.mit.edu/~kris/ftp/BML-IVA-06-KoppEtAl.pdf). Elckerlyc is one realizer. — [Univ. Twente publication](https://research.utwente.nl/en/publications/the-behavior-markup-language-recent-developments-and-challenges/)

**PoseScript (research precedent for text ↔ pose)**
- ECCV 2022 (NAVER LABS Europe and CSIC-UPC). It pairs AMASS poses with human-written descriptions of body parts and their spatial relations. Automatic captions are built from "posecodes", low-level pose facts extracted by rules from 3D keypoints and combined into sentences. About 100k poses are auto-annotated. — [arXiv v3](https://arxiv.org/html/2210.11795v3); [ECCV 2022 paper](https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136660340.pdf); [NAVER LABS Europe](https://europe.naverlabs.com/research/publications/posescript-3d-human-poses-from-natural-language/)

**Other text formats relevant to agents**
- BVH (text skeleton plus per-frame channels; Q4); H-Anim (ISO humanoid; Q5).
- Godot TSCN/TRES animation text — [Godot docs](https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html)
- Bevy `.animgraph.ron` — [docs.rs](https://docs.rs/bevy/latest/bevy/animation/graph/struct.AnimationGraph.html)
- PlayCanvas `loadStateGraph` JSON — [PlayCanvas API](https://api.playcanvas.com/engine/classes/AnimComponent.html)
- Unity YAML — [Unity manual](https://docs.unity3d.com/Manual/TextSceneFormat.html)
- glTF KHR_interactivity behavior graphs (submitted for ratification July 2026) — [Khronos news](https://www.khronos.org/news/archives/gltf-interactivity-extension-submitted-for-ratification)

### Inferences
- **Open-spec status (my classification):**
  - Open specs: Lottie (Community Specification License, JDF/LF), BML 1.0 (open academic standard), H-Anim (ISO/IEC), glTF, KHR_* and VRM (open specs), BVH (de facto, no owner).
  - Documented but tied to proprietary tools: Spine JSON (runtimes need editor licenses), Rive `.riv` (binary, MIT runtimes, proprietary editor).
  - Open but abandoned: DragonBones.
- **Agent-friendliness ranking for skeletal motion (my judgment):**
  1. Spine JSON is the best existing model of an LLM-editable skeletal clip: named bones, per-bone timelines, values relative to the setup pose, explicit curve arrays. But it is 2D and its ecosystem is license-restricted.
  2. BVH is text but numerically dense and semantically flat: per-frame Euler channels with no names standard.
  3. BML is agent-friendly at the behavior level ("gaze at X", "nod") but leaves motion synthesis to a realizer.
  4. Engine formats (Godot, Bevy, PlayCanvas) are good targets for agent-written controllers but are engine-specific.
- The predecessor's "readable key poses" (integer, relative angles, limb direction plus bend plus twist, size-independent) combine the strengths of these precedents: Spine-style relative timelines, PoseScript-style semantic posecodes, and VRM/Unity humanoid semantics. Nothing found occupies this niche as an open 3D standard. The package should still borrow:
  - Spine's curve and stepped conventions.
  - BML's sync points and behavior blocks for higher-level sequencing.
  - KHR_interactivity and PlayCanvas-style state graphs for runtime logic.
  - VRM meta-style license fields.

### Gaps
- Absence of evidence: with a limited search budget I could not exhaustively rule out a recent open 3D skeletal DSL aimed at LLMs, for example in 2025–2026 research or startups.
- Rive's newer text or markup features (an "RML" docs page exists) were not examined.
- Labanotation and other dance notations were not researched.
