# Feasibility: an animation package built for AI agents

**Date:** 2026-10-11. **Evidence:** `reports/AI native game animation landscape.md` (the synthesis) and the seven studies in
`research_notes/AI native game animation landscape/` (sources, quotes, `path:line` references). **Next:** `PLAN.md`.

## Contents

0. [The answer](#0-the-answer)
1. [The question](#1-the-question)
2. [The fighter jet without a cockpit, applied to animation](#2-the-fighter-jet-without-a-cockpit-applied-to-animation)
3. [What already works: evidence from five repositories](#3-what-already-works-evidence-from-five-repositories)
4. [The landscape, October 2026](#4-the-landscape-october-2026)
5. [Feasibility, dimension by dimension](#5-feasibility-dimension-by-dimension)
6. [The thesis: build the airframe, not the pilot](#6-the-thesis-build-the-airframe-not-the-pilot)
7. [Risks, and how the plan retires them](#7-risks-and-how-the-plan-retires-them)
8. [Decisions for the owner](#8-decisions-for-the-owner)
9. [Recommendation, the kickoff prompt and the effort level](#9-recommendation-the-kickoff-prompt-and-the-effort-level)

---

## 0. The answer

**Verdict: go.** Build it, scoped as **the airframe, not the pilot**. That means the language, runtime, sensors, library,
interfaces, ground station and supply chain an agent needs to put character motion in a game. It does not mean a model
that invents motion; generation plugs in through a socket.

**The analogy is only half right, and the half that's wrong matters.** three.js and Rapier ship code and no content:
their users bring the assets and the judgment. Here, across five repositories, the code was rewritten every time while
the format, the data and the golden vectors traveled intact. The scarce, defensible assets in 2026 are clean motion data
and checks you can trust, not playback code. So the package is closer to **glTF plus Poly Haven plus a test suite**,
with a three.js-like runtime as its reference implementation. Its first deliverable is governance: the spec, its
versioning, provenance, the gates and conformance. `PLAN.md` puts these first.

**Confidence:**
- **High** that the package can be built and pays off in the owner's own games. Its core already exists in pieces
  across five repositories.
  - The format, the verifier and the interfaces are ready to standardize now.
  - **The runtime is the heavy lift.** Retargeting onto arbitrary skinned skeletons while keeping contacts is unsolved
    in every predecessor and missing from three.js. Unreal took several releases to get it right. It will absorb most of
    the engineering, which is why it is the M1 test.
- **Medium** on how far "high quality" reaches. The runtime can be first-rate, but **the library is the weakest leg**.
  - Clean motion data is scarce: the CC0 core is about 200 clips, and the rest comes from CMU and 100STYLE.
  - The one clean open generator, NVIDIA's Kimodo, sits under a license NVIDIA may change at any time.
  - The library grows at the pace of clean generators and human-backed gates, not the pace agents can produce clips.
- **Unknowable today** whether it becomes *the* standard. Being early and open helps, and so does a conformance kit, but
  adoption beyond the owner's repositories is a milestone to earn (M4), not an assumption. The window is real but not
  permanent: Khronos's character extensions are heading for release, and Epic and NVIDIA each hold most of the pieces
  of an open motion stack.

**Why go:**
1. **The core is proven, not speculative.**
   - Readable key poses land 14 to 18 mm from the capture.
   - They are 14× smaller than the same clips as packed GLB.
   - A model chooses clips from catalog lines of about 35 tokens, without reading motion data.
   - Retargeting by direction plus bend holds within 9° per limb on other bodies.
   - A bit-exact Rust port shows the format crosses languages.
2. **The owner is already paying for its absence.**
   - The codec has been written in JavaScript, ported to Rust (about 7,500 lines with importers), and is planned again
     in TypeScript.
   - One set name already means two different sets in two repos.
   - The first outside model to build a game on my-3d2dge used none of the library, although the clips it needed were
     there: discoverability and packaging failed, not content.
3. **The niche is empty.**
   - No open, text-based format for 3D character motion exists, and VRMA, the best interchange format, is binary.
   - No engine's MCP server (Unity, Unreal, Roblox, Godot, Blender) exposes animation operations.
   - Every vendor pipeline ends in binary files, with no headless quality checks.
   - three.js has no state machine and no root motion, and its retargeting has documented failures.
   - JavaScript IK and foot locking are thin.
4. **The hard parts are engineering, not research.** Retargeting onto arbitrary skeletons, foot locking, synced
   blending, graphs and motion metrics are known techniques. The research-grade part, generating motion from text, is
   the part we plug in rather than build.
5. **It improves as models improve.**
   - An airframe built for agents gets better pilots every few months.
   - Its durable assets (curated, licensed, verified motion, and evals that grade agents) become more valuable, not
     less.
   - World models such as Genie 3 and Muse generate pixels without persistent state, so games will keep needing
     explicit, deterministic animation for years.

**What could sink it,** ranked by how hard each is to undo. Each has a plan defence (§7):
1. **Library contamination.** A clip with tainted provenance ships in games and can't be recalled. The origin's own CMU
   record already omits CMU's no-resale clause.
2. **Retargeting onto real rigs looks wrong.**
3. **Agents don't reach for it.** They ignore what isn't in their context, and no model has seen this format in
   pretraining.
4. **Execution slips.** Every size in the owner's last plan overran.
5. **Metrics that miss defects or get gamed.**

**How to present it.** In the GDC 2026 survey, 52% of game developers called generative AI bad for the industry, 64%
among visual and technical artists. So present this as correctness, verification and provenance tooling, not as a
replacement for animators.

**What to build.** `PLAN.md`: 11 phases, 56 work packages, 11 gates (G0 to G10), 4 milestones. The first milestone, **M1 "first
flight"**, tests the thesis. Any library clip plays on any humanoid skeleton in three.js, the sensors are green, sheets
render headless, and fresh agents succeed at the first brief in at least 4 of 5 tries.

**How to start:** the prompt and effort level are in §9. In short, run `PLAN.md` from WP-0.1 with **ultracode**, or with
**max** for a single agent.

---

## 1. The question

**How do I get high-quality animations into my game in a way that works easily with LLM agents?**

The package this repository weighs answers it the way three.js answers rendering and Rapier answers physics: one
dependency that solves the problem. The difference is who it serves. It is built from the ground up for AI coding agents,
and only for them, with no legacy weight carried for human workflows.

"Solves the problem" means an agent building a game can do seven jobs without a human, a GUI or a display:

1. **Find** a motion for a moment ("lands on one knee and a hand", "overhead two-handed chop") without watching videos.
2. **Fit** it onto *this* character (any humanoid skeleton, any proportions) without a retargeting dialog.
3. **Wire** it to gameplay (locomotion blends, actions with hit frames, reactions, transitions, root motion) without a
   boxes-and-arrows editor.
4. **Make** a motion that doesn't exist yet, by editing, composing or generating, without an animator.
5. **Check** that it looks right (feet planted, no popping, no limbs through the body, timing that reads) without
   watching it.
6. **Ship** it knowing it may be shipped (license, credit) and that it plays the same everywhere (deterministic,
   versioned).
7. **Grow** the library: hand what it made to the next agent, safely.

"High quality" has three layers, and the package owns each differently:

- **The source motion,** captured or keyed by skilled people, or generated well. The package *curates* it.
- **The runtime:** blending, contacts, IK, timing, responsiveness, root motion. The package *delivers* it in full.
- **The fit:** on-model, on-style, on the beat for this game. The package *gives the tools*, and the agent does the work.

---

## 2. The fighter jet without a cockpit, applied to animation

The owner's analogy: build a fighter jet today, but take out the pilot and the cockpit. The jet flies itself, and the
human is remote, at a ground station, for the highest-level strategy and for quality assurance. Removing the pilot
removes every constraint a human imposes on the design.

Today's animation pipeline is a cockpit. Almost every tool in it exists because a human was in the seat:

| The cockpit (built for a human) | Why it exists | What replaces it (built for agents) |
|---|---|---|
| Timeline, dope sheet and curve editors (Maya, Blender, MotionBuilder) | A human poses with a mouse and judges by scrubbing | Motion as readable text: key poses of whole numbers, named the way an animator thinks (lean, turn, reach, bend), plus operators an agent calls (retime, mirror, layer, exaggerate, pin a hand, look at) |
| The viewport, watched at 60 fps | Eyes are the QA instrument | **Sensors**: motion metrics reported as text with times ("left foot slides 42 mm, 0.53 to 0.71 s"); contact sheets and filmstrips sized for a vision model's token budget; diffs of metrics and pixels against the last build |
| Binary interchange (FBX, `.anim`, `.uasset`) | App-to-app transfer; vendor-owned formats | Text is the source of truth; binaries live only at the edges (import, export), converted with their provenance recorded |
| Boxes-and-arrows state machines (Unity's Animator, Unreal's AnimGraph) | A human wires behavior visually | State graphs and blend spaces as data, with a validator and a simulator that turns an input script into a state trace and frames |
| The retargeting dialog (map bones by hand, fix the rest pose) | A human recognizes bones by name and shape | Automatic skeleton recognition with a confidence report; motion stored in an IK space independent of body size; a mapping file the agent can read and patch |
| Marketplaces browsed by thumbnail and video; licenses read by people, or not at all | Humans choose by watching | A catalog of one line per clip (~35 tokens), searchable by words, tags and numbers (speed, height, travel); a machine-readable license and provenance on every clip; compatibility checked by a tool |
| An animator for every new motion | Only skilled people could make motion | **Motion sources** the agent drives: the library, composition and edits, procedural generators, importers and, as plug-ins, generative models. Every source goes through the same QA gates |
| A person reviews every asset | Trust needed a human | Automated gates on every clip; humans sample on a review page and turn their notes into thresholds and rules |
| Every game rebuilds blending, foot IK and hit events | Engines ship GUIs, not runtimes an agent can read and reuse | One runtime, adapters per renderer, one conformance suite |
| Manuals and tutorials for people | People learn by reading and watching | A token-budgeted manual, an agent skill, errors in the API's own language, examples that run |

**What the ground station does.**
- **Sets direction:** "grounded and heavy", "snappy, like an anime fighter".
- **Sets the bar:** the thresholds the sensors enforce.
- **Reviews on a phone:** a gallery plays any clip on any test character, shows its metrics, and takes an approve or a
  flag in one tap.
- **Makes the calls that are hard to undo:** licenses, spending, publishing.

The human never keys a pose.

**The laws of flight still apply.** Taking out the cockpit removes human constraints, not physical ones:
- anatomy: joint limits, bone lengths;
- physics: contact, balance, momentum;
- the principles of animation: anticipation, follow-through, arcs, timing;
- art direction.

Here they become checks that the sensors run on every clip. This matters more than it seems: vision models are weak
judges of motion, scoring 49% on telling which of two frames came first and under 60% on fine-grained motion. So the
laws have to be measured, not eyeballed.

**Built for a pilot who keeps getting better.** Models are improving fast, so the airframe must not cap the pilot:

1. **Key poses are a view, not a ceiling.** Dense samples stay available and imports keep their source, so a stronger
   model can work at a lower level when it is able to.
2. **The same tools serve every pilot.** A small model picks a clip by its catalog line. A frontier model authors a new
   motion with IK targets, reads the metrics, fixes it and checks again.
3. **The pilot is measured.** A benchmark of agent tasks, graded by metrics with human sampling, runs on every new model.
   Improvements show up as numbers, and the ground station can hand over more.
4. **Generative models plug in.** The package defines the socket and the QA gate, not the model. Into the socket go
   intent and constraints; out comes a clip in the format, with provenance and license.
5. **The durable value is curated, licensed, verified motion data plus the evals that grade it.** Those are exactly what
   future models need, whoever builds them.

---

## 3. What already works: evidence from five repositories

The owner's repositories already hold most of this package, scattered and re-implemented. (Studies:
`predecessor_origin_repos.md`, `predecessor_adopter_repos.md`.)

| Repository | What it proves | Numbers |
|---|---|---|
| **my-3d2dge** (the origin; JavaScript, one-file engine) | The readable key-pose format; one-line catalogs; per-clip provenance and fit; importers for Quaternius, Mesh2Motion and the whole CMU database; retargeting by direction plus bend onto its Humanoid; seeded filmstrips with pixel diffs; the agent-first doctrine and its checks | 325 curated clips plus a ledger of all 2,548 CMU takes; set means of 13.9, 16.1 and 17.8 mm; a 440-token legend; ~35 tokens per catalog line; the same Quaternius clips are 74 KB gzipped as text against 1,062 KB as packed GLB |
| **my-3d2dge-2** (Depthward; TypeScript, three.js, Rapier) | One typed tool registry served to the console, a CLI, an MCP server and WebMCP, with every example run as a test; skinned GLB playback through three.js; a skill timeline that places hits and motion windows in data | 46 tools; 143 tests |
| **shardfall** (Rust, wgpu) | The format crosses languages unchanged: its importer and codec were ported to Rust bit for bit. It also re-encoded the move library as TOML with an `about` line per move, imported 100STYLE, and built an animation studio where an LLM edits clips with revisions and undo | 119,432 Mesh2Motion numbers and 104,101 CMU numbers identical to the JavaScript; about 7,500 Rust lines; 437 embedded clips |
| **my-3dge** (TypeScript, three.js; built from a large plan) | The need again: its plan schedules a third port of the codec and importers (four WPs) and already commits 3.55 MB of reference vectors from the origin's rigs and moves | 97 WPs, 23 done in about two days; every reported size over by one class |
| **riftlight** (TypeScript, its own animation stack) | Independent convergence: software-drawn contact sheets, films, clip metrics and a lab handle, built without the origin's code | an animation stack of its own; a banned-API lint the origin cited |

**What the same evidence says is missing.**
- **Discoverability.** The GPT-6 "Vesper" build, handed the origin engine, used **zero** library clips. It wrote 4k
  tokens of traversal and takedown animation by hand, although climbs, rolls and stealth walks sat in the store. The
  store lived outside the one file it was handed, which only pointed to it.
- **Degrees of freedom and semantics.** Format 1 has no wrist or forearm roll (the hand is a straight continuation of
  the forearm), no spine curl, no contacts, no events or hit frames, and no root yaw. Nothing checks its `format` field,
  so forks share a version.
- **Motion metrics.**
  - The origin's procedural gait slides its planted feet at 12 to 28% of body speed, yet its character sheet reported
    "no sliding": the metric checked only idle.
  - Depthward has no motion metrics at all.
- **Retargeting onto arbitrary skinned skeletons.**
  - The origin retargets onto one fixed 15-joint drawn rig.
  - Depthward only corrects rest poses between rigs that share bone names.
- **A home.** Every repo re-implemented its clip runtime, IK, sheets and metrics. That duplication is the internal case
  for a standalone package: data plus a spec plus conformance vectors as the shared unit, with each engine pinning it.

---

## 4. The landscape, October 2026

Full synthesis: `reports/AI native game animation landscape.md`. What matters for the decision:

### 4.1 Generative motion: the pilot, not ours to build

- **Text-to-motion is mostly off-limits for shipped, redistributable motion.**
  - Nearly every academic model (MDM, T2M-GPT, MoMask, MotionGPT, MotionLCM, Light-T2M, BAMM) is trained on
    HumanML3D, which comes from AMASS. AMASS "prohibits the use of the Dataset to train… neural networks… for commercial
    use of any kind."
  - Tencent's HY-Motion is strong, but its license excludes the EU, UK and South Korea, needs permission above 1 million
    monthly users, and forbids using outputs to improve other models.
- **NVIDIA Kimodo (March 2026) is the first commercially usable candidate.**
  - The code is Apache-2.0, and the weights are under the NVIDIA Open Model License.
  - It was trained on 700 hours of licensed studio mocap.
  - It takes full-body keyframes and sparse joint, root and path constraints, landing about 2.7 cm from the keyframes.
  - It needs a GPU (about 17 GB of VRAM, or under 3 GB with the text encoder on the CPU), so it would run as a remote
    backend.
  - Its constraint inputs map well onto readable key poses: an agent writes three to ten keys, the model fills the
    frames between, and the verifier checks the result against the keys.
  - It comes with caveats:
    - NVIDIA "may update" the license "at any time".
    - The model card calls its training data "proprietary".
    - It is realistic-only and capped at 10 s per clip.
    - It skates: its own paper measures 3.87 cm/s of foot skate against 2.21 cm/s for real capture.

    So every output goes through the same gates as any import, with the license version recorded per clip.
- **Motion matching** needs a dense locomotion set. Daniel Holden's demo code is MIT and already builds to WASM, but its
  LaFAN1 data is non-commercial.
- **Physics controllers** need GPU clusters to train but little to run. NVIDIA's SONIC web demo runs a policy in the
  browser with MuJoCo compiled to WASM and ONNX Runtime Web. Using simulation as a verifier lifted upright execution of
  generated clips from 80.5% to 89.5%.
- **Video-to-motion:** GVHMR and every SMPL-based pipeline are non-commercial. Meta's SAM 3D Body with its MHR rig is
  the commercially usable path.
- **Evaluation:**
  - The checks games need are geometric: foot skate, contact, penetration, jitter.
  - The learned critic MotionCritic agrees with humans 85% of the time, against 64–72% for heuristics.
  - Vision-language models are not reliable judges of physical artifacts.
- **LLMs authoring motion** works through compact semantic forms: pose codes, foot-contact patterns, CSS keyframes. That
  supports the readable key-pose design. **No benchmark of frontier LLMs authoring full-body keyframes exists**, which
  makes the plan's benchmark a first.

**So:** don't build a generator; build the socket and the gates, and let Kimodo-class backends plug in when the owner
approves one (PLAN WP-9.2, D.9).

### 4.2 Commercial tools: consolidation, and nobody in the agent-native seat

- **Consolidation, 2025–2026:**
  - RADiCAL shut down after Autodesk bought its IP, and Ready Player Me closed after Netflix bought it.
  - Unity Muse was retired, and Epic absorbed Meshcapade.
  - Kinetix pivoted to video, Uthana moved to pay-as-you-go and pitches robotics, and Rokoko folded its tools into
    Rokoko Create.
- **Engines and big vendors now own the space:**
  - Unity AI uses Uthana.
  - Unreal 5.8 added an experimental MCP plugin and full-body capture from a webcam.
  - Maya 2027.2 trains MotionMaker models locally.
  - Tripo and Meshy sell rigging and preset-animation APIs.
- **Agents can fetch motion but not work with it.** Uthana's GraphQL API takes a prompt and returns FBX, GLB or BVH, and
  Meshy and Tripo have REST endpoints. But every pipeline ends in binary or engine-native files. No vendor offers a
  text-native format or headless quality checks, so an agent can fetch motion but can't meaningfully read, edit or
  verify it.
- **Output terms rule out a redistributable library built on vendors:**
  - Adobe forbids "any type of free distribution of character or animation raw files" from Mixamo, and ML training on
    them.
  - DeepMotion owns its outputs.
  - Uthana's and Meshy's free tiers are CC BY.
- **Developers keep naming the same pain:** foot sliding, cleanup time, fingers and contact, rest-pose mismatches in
  retargeting.

**So:** don't compete on generation, capture or in-engine tooling, where the space is well-funded or engine-owned. Be
the neutral, text-native layer that any backend plugs into and any agent can verify.

### 4.3 Formats and runtimes: interoperate, then fill the gaps

- **No open, text-based, agent-oriented 3D motion format exists.**
- **VRM 1.0** is the de facto open humanoid profile: 55 bones, 15 required, matching the origin's 15-point rig and
  Unity's humanoid minimum. **VRMA 1.0** is the best existing clip interchange, playable in three.js through
  `@pixiv/three-vrm-animation`. It can't be the canonical form: it is binary and sampled, with no key poses, IK goals,
  contacts or layering.
- **Khronos's `KHR_character_skeleton_mapping` and `KHR_character_reference_pose`** were heading toward Release
  Candidate in July 2026. Khronos says outright it won't fix a single skeleton.
- **OpenUSD's Core Specification 1.0** (December 2025) has no character spec.
- **three.js r186 leaves holes:**
  - its mixer handles crossfades and additive clips;
  - it has no state machine and no root motion;
  - `SkeletonUtils.retargetClip` has documented failures, and none were fixed in r184–r186.
- **Babylon.js 9.0's retargeter is stronger** and proves the approach: it scales root motion by proportion and keeps
  feet planted.
- **PlayCanvas, Godot, Bevy and Unity** all store controllers as text an agent could write, so they are export targets
  later.
- **Rapier** has joints, PD motors and a character controller but no ready-made active ragdoll.
- **JavaScript IK is thin:** only `CCDIKSolver` in three.js, and no foot-locking library.

**So:** VRM's bone names as the canonical skeleton, glTF and VRMA as exports, and readable key poses as the agent's
layer. The package fills three.js's gaps: retargeting, graphs, root motion, contacts.

### 4.4 Data and law: a real seed, real boundaries

- **What can seed an open, editable, commercially shippable library:**
  - **CC0:** Quaternius UAL1 and UAL2 (UAL2 updated to v2.2 on 2026-09-28), Mesh2Motion (its README says CC0, but a
    July 2026 report says some assets are CC BY or CC BY-SA, so audit each) and Kenney.
  - **CC BY 4.0:** 100STYLE, about 18.5 hours of locomotion styles.
  - **CMU:** "You may include this data in commercially-sold products, but you may not resell this data directly, even
    in converted form."
    - CMU-derived clips can ship inside games.
    - A free public repository of converted clips is a grey zone, and the clips can't be relicensed as CC0 or MIT,
      since that would let others resell them.
    - So they keep CMU's notice, in a namespace of their own. Treat this as a known, logged risk (PLAN K3), not a
      settled question.
- **What can't:**
  - the AMASS family (HumanML3D, BABEL, Motion-X, MotionMillion);
  - LaFAN1 and Bandai Namco;
  - Mixamo, Ready Player Me, Truebones and Rokoko's libraries (in-game use only, no redistribution).
- **AI-generated motion:**
  - In the US it isn't copyrightable when purely AI-generated (Copyright Office Part 2, January 2025; the Supreme Court
    denied review in *Thaler* in March 2026). It is effectively public domain, unless it reproduces protected
    choreography.
  - A human approving a clip isn't authorship.
  - EU Article 50 labelling applies from August 2026; whether it covers motion data is uncertain.
  - Label every clip with an IPTC digital source type anyway, because Steam and Fab require AI disclosure.
- **Registries:**
  - Open upload portals flooded (Fab took 38–41k AI assets from one seller), and Civitai changed policy under pressure.
  - What held up: single-author CC0 catalogs, or vetted submissions with disclosure, identity, automated checks, no
    reward for volume, and human review before merge.
  - There is no provenance standard specific to motion. The practical stack is SPDX license ids with REUSE, IPTC source
    types, content hashes for lineage, and signed attestations.

**So:** a seed of 1,000+ distributable clips with real breadth (locomotion, combat basics, interactions, emotes,
acrobatics) across three license namespaces. Contributions are gated and reviewed before merge, and AI provenance is
always recorded.

### 4.5 Agent tooling: verifiers close the loop

- **MCP servers now exist for every major engine, and none exposes animation operations.**
  - Unity's official server is in beta; Unreal 5.8's is experimental, local-only and unauthenticated; Roblox builds one
    into Studio.
  - The community Blender server has 30k stars.
- **The standards:**
  - Agent Skills became an open standard (46 clients).
  - The MCP spec of 2026-07-28 is stateless.
  - Playwright's own README recommends **CLI plus skills over MCP** for coding agents, to save context.
  - `llms.txt` files get few requests (97% got none).
  - WebMCP is in a Chrome origin trial.
- **Code-first animation works when a verifier closes the loop.**
  - The Manim agent TheoremExplainAgent succeeds 93.8% of the time.
  - A checkable motion spec (MoVer) lifts correct motion graphics from 58.8% to 93.6% with verifier feedback alone.
  - Remotion ships 12 official agent skills.
  - The makers of Motion built paid tooling because LLMs "can't visualise timing or easing curves".
- **Visual checks are fragile in sandboxes.** Linux headless Chrome cannot screenshot WebGPU canvases, failures are
  silent (black frames, quiet fallbacks), and SwiftShader is slow. An image of 1,000 × 1,000 pixels costs about 1,296
  tokens on Claude.

**So:** the CLI and a skill first, MCP as a view. Sensors compute from skeleton data, and pictures come second, rendered
in software.

---

## 5. Feasibility, dimension by dimension

| Dimension | Verdict | Why | Main risk | Retired at |
|---|---|---|---|---|
| **Format, runtime, sensors** | High | Proven in my-3d2dge and shardfall; the techniques are known | Scope | G1–G3 |
| **Retargeting onto arbitrary skinned skeletons** | Medium (the heavy lift) | The IK-space format is built for it, VRM gives the bone vocabulary, and contact constraints are where the industry converged. But no predecessor has done it onto arbitrary skinned skeletons; Unreal needed 5.4, 5.7 and 5.8 to get there; Babylon.js 9's new retargeter still fails on rotated meshes | Odd rigs, rest poses (T vs A), twist bones, rotated meshes | G4 (M1) |
| **Runtime quality** (contacts, synced blending, root motion) | High | Engineering with known methods; foot locking and phase sync are specified | None beyond effort | G2, G4 |
| **Source-motion quality** | Medium | The open data is decent and broad but not AAA; CMU is raw capture; Quaternius is stylized | Thin coverage of game-specific moves (combat variety, traversal polish) | G5; recipes and actions (Phase 6); generative backends (D.9) |
| **Motion made by agents** | Medium, rising | Composition, edits and procedural sources, all checked by sensors; models improve; the socket is ready | Agents can't judge feel by eye | G6 and the benchmark |
| **The seed library (data and legal)** | Medium | A clean seed exists across three namespaces, but it is small: the CC0 core is about 200 clips, and CMU and 100STYLE supply the rest. Purely AI-generated output is public domain in the US | The Mesh2Motion audit; CMU's grey zone; repairs the origin owes (the CMU record, the UAL2 v2.2 update) | G5 |
| **Library growth by AI contribution** | Low-medium (the weakest leg) | Only one clean open generator, under terms its owner can change; open AI-fed catalogs elsewhere were flooded (Fab) or poisoned (ClawHub) | Contamination that can't be recalled once a game ships | G9, with human review before merge |
| **Agent usability** | High, if packaged right | The owner's own tool patterns are proven; a registry serves the CLI, skill and MCP | Discoverability (the Vesper failure) | G4, G7 (benchmark) |
| **Becoming the standard** | Low to medium (unknowable) | An empty niche, an open license, a spec, conformance vectors, exports to everything | Khronos, engines or vendors define the standard first; models aren't trained on a new library | G10 (M4) |
| **Durability as models improve** | High | The airframe scales with the pilot; data and evals appreciate | World models replace explicit animation (not for years: they keep no persistent state) | Continuous |
| **Effort** | Medium | 56 WPs at the grain the owner's agents already execute | Sizes overrun (all nine that reported did) | Gates |

**Effort, roughly.** The owner's last plan ran 23 WPs of this grain in about two days, and every reported size overran
by one class. Expect M1 within the first few days of continuous agent time, and M3 in one to two weeks.
Running lanes in parallel (ultracode) shortens this after G2. Treat these as orders of magnitude; the ledger will
measure the real pace.

---

## 6. The thesis: build the airframe, not the pilot

### 6.1 An AI-native language, in levels

Agents work at the highest level that does the job, and drop a level when they must. Every level:
- is text and compiles to the one below;
- has a validator whose errors name the field;
- has a `describe` that says it back in words;
- has a `render` that feeds the sensors.

| Level | What it is | Example | Who writes it |
|---|---|---|---|
| **L4 Intent** | A brief in words | "the goblin limps to the brazier and kicks it over" | the game's agent, or the human |
| **L3 Behavior** | State graphs, blend spaces, events bound to gameplay | locomotion by speed (idle, walk, run); `attack.hit` at 0.32 s | the game's agent |
| **L2 Recipe** | Composition of clips and operators | a limp cycle three times, then a front kick played 0.8× slower, with a torch-holding right arm layered on top | the game's agent, library contributors |
| **L1 Key poses** | Readable numbers per key pose | `{"t":0.13, "hips":[-2,-2,90], "armL":[60,-44,66,132,155], ...}` | importers, generators, agents editing |
| **L0 Samples** | Dense transforms per frame | a rotation per bone at 30 fps | importers, the runtime, the sensors |

### 6.2 The airframe's systems

| Jet | Package | What it is |
|---|---|---|
| Airframe and flight controls | `@m3a/core` | Format codec, skeleton profiles, sampler, pose operations, solver, contacts, recipes, graphs; with no dependencies, deterministic, never touching a renderer |
| Sensors | `@m3a/sensors` | Metrics with times, `describe`, lint and fix, contact sheets and films rendered in software, diffs |
| Datalink | `@m3a/tools` | One registry behind the API, the `m3a` CLI, a skill and MCP; the manual within its token budget |
| Payload | `library/` | Sets in three license namespaces, catalogs, facts, provenance, QA verdicts |
| Ground station | `apps/gallery` | Review on a phone: play, measure, approve or flag; notes return as rules and thresholds |
| Supply chain | the protocol and the socket | Gated contributions, motion sources (including generative ones), dedup, lineage, a registry index |
| Hardpoints | `@m3a/three`, `@m3a/io` | three.js binding and playback; glTF, VRMA, BVH and CMU in and out |
| Flight tests | `bench/` | Fresh-agent briefs, graded headless, per model |
| **The pilot** | **not built here** | Coding agents and generative models. They get better every few months, and the airframe lets them fly better |

### 6.3 What it will not be

- **A text-to-motion model.** The licenses are hostile, GPUs are needed, and well-funded players exist. It plugs in
  instead.
- **A DCC or a timeline GUI.** Views only, never the only way in.
- **A game engine, renderer or physics engine.** It sits beside three.js and Rapier and exports to the rest.
- **Faces, fingers beyond curls, creatures, physics-driven ragdolls, motion matching** in v1. Each is an on-demand work
  package with a measured trigger.
- **A vendor-specific integration.** It stays neutral: any backend plugs into the socket, and any engine can take its
  exports.

### 6.4 Why a standard, and how one is earned

A library is code people use; a standard is a contract several implementations honor. glTF earned that status with a
spec, a validator and sample assets. Here, the plan builds the same three things:
- **the spec:** format 2, the skeleton profile, recipes, graphs;
- **the reference implementation:** TypeScript;
- **the conformance kit:** vectors, plus a runner any language can use.

shardfall's bit-exact Rust port shows a second implementation is realistic.

The rest is earned in public:
- an open license;
- versioning that never breaks readers;
- exports to VRMA and glTF;
- alignment with VRM and Khronos as they settle;
- a benchmark that shows agents succeed with it;
- the owner's own engines as first adopters (M4).

Being first in an empty niche helps. Claiming the title doesn't.

Three choices follow from the evidence:

- **TypeScript first, with Rust certified later.** The Rapier analogy taken literally would mean one Rust core shipped
  as both a crate and an npm package through WASM. That ends rewrites at the cost of a WASM boundary. The plan starts
  with TypeScript, because:
  - agents iterate fastest there;
  - the first consumers (my-3dge, the gallery, three.js games) are TypeScript;
  - the conformance kit lets a Rust implementation certify later (PLAN WP-10.2, D.6), and shardfall's codec already
    nearly does.

  If Rust hosts must become first-class, revisit this with a decision entry.
- **Substitute for pretraining.** No model has seen this format in pretraining. Agents do well with Manim and Remotion
  partly because those are mainstream code seen at scale. Here the legend, the token-budgeted manual and the skill do
  that job, and they version with the schema.
- **Build on Khronos, not against it.** Emit the `KHR_character_*` vocabularies once they are ratified, and publish the
  spec before an incumbent defines one (decision O2 governs the timing).

---

## 7. Risks, and how the plan retires them

Ranked by how hard each is to undo, which is the order that matters:

| Risk | How the plan answers it | Where |
|---|---|---|
| **Library contamination:** a clip with tainted provenance ships in games and can't be recalled | License namespaces; provenance on every clip; the seed audits (the CMU notice, Mesh2Motion, UAL2 v2.2); allowlists; dedup; disclosure; human review before merge | WPs 1.5, 5.3, 5.7, 9.1, 9.3 |
| **Supply-chain risk in what the package ships.** Clips are inert data, but skills, the MCP server and importers are code | Importers treat every input as untrusted; signed releases with provenance from the first published version | WPs 5.2, 7.4 |
| **Retargeting onto real rigs looks wrong** | An IK-space format; skeleton recognition with confidence reports and patchable mappings; rest normalization; foot locking; tested on generated variants and real CC0 rigs | WPs 1.4, 2.4, 2.5, 4.3; G4 |
| **Agents don't use it** (the Vesper failure) | The manual is the front door, with defaults and examples; a skill; the benchmark measures whether agents read past the manual | WPs 4.7, 7.3; G4, G7 |
| **The library is too thin for games** | Re-import with the new degrees of freedom; recipes, actions and procedural sources; purchases (O4) and generative backends (D.9) as levers | WPs 5.3, 6.1–6.3 |
| **The format's limits show** (wrists, spine, fingers) | Named optional fields; re-import from the sources; a dense sidecar track as the fallback | WPs 1.1, 5.3, D.2 |
| **Sensors miss defects or cry wolf** | A planted-defect suite with 100% recall required; calibration against the library; human sampling feeding new checks | WPs 3.6, 8.2 |
| **Scope creep** | The scope rule (no gate or brief, no work) and on-demand triggers | PLAN §2, §10 |
| **Contributions turn into a flood** | A curated core plus a federated, namespace-verified index for community packs, never an open upload portal; allowlists, provenance, dedup, disclosure, rate limits, an accountable human behind every agent, no per-clip rewards, human review before merge | WPs 9.1, 9.3, 9.4 |
| **Metrics miss defects or get gamed** (the origin's slide check ran only on idle; a generator over-optimized against a learned critic broke down) | Planted defects; calibration against real capture; human sampling; an adversarial review of what each gate fails to see | WPs 3.3, 3.6, 8.2 |
| **The ground moves** (Khronos, three.js, a generative leap) | A spec watch, deliberate pin upgrades, the socket | WPs 1.4, 4.1, 9.2 |

**Kill criteria** (PLAN §12). Each stops the work and escalates:
- **G4 fails twice.** A post-mortem with options follows: VRM-normalized targets only, dense rotation tracks, or mapping
  work per rig.
- **B1 stays under 3 of 5 after two manual revisions.** A friction study follows.
- **A license finding removes a seed set.** It moves to the local lane; if that drops the library under G5's floor,
  escalate.

---

## 8. Decisions for the owner

The plan proceeds on these defaults and escalates the hard-to-undo ones when it reaches them (PLAN §13):

| Id | Decision | Default |
|---|---|---|
| O1 | The code license | **Answered: MIT** (the owner, 2026-10-11), matching my-3d2dge |
| O2 | Package names and publishing (npm, crates, release assets, a public benchmark) | Build everything, publish nothing; working names `@m3a/*` and `m3a` |
| O3 | A Vercel project for previews | `vercel.json` prepared; you link the repo |
| O4 | Buying Quaternius UAL1 Pro ($9.99) and UAL2 Source ($14.99), both CC0 | Free editions only |
| O5 | External generative services (cost, keys, output terms) | None; the socket ships with a mock. NVIDIA Kimodo is the first candidate worth approving |
| O6 | CC BY content (100STYLE) | Accept it, in its own namespace with a credits tool |
| O7 | Who merges library contributions | You, with CI gates required |
| O8 | Where gallery reviews are stored | A static JSON export (no hosting costs) |
| O9 | Acting in other repositories (switching my-3dge's Phase 8 to this package; certification in shardfall) | Propose, don't act |

**One question to the owner, for context only:** my-3d2dge's decisions log mentions "the four front-runners" without
naming them. If they are other agent-first engines, they are natural early adopters for M4.

---

## 9. Recommendation, the kickoff prompt and the effort level

**Recommendation: proceed.** Execute `PLAN.md`. M1 ("first flight") is the real test of this analysis. If any library
clip plays cleanly on any humanoid skeleton in three.js, measured by the sensors and achieved by fresh agents from the
manual alone, the thesis holds. If not, the kill criteria stop the work early and cheaply.

**The kickoff prompt:**

```
Execute PLAN.md in michaelcrosato/my-3danimations. Read docs/FEASIBILITY.md §0, then PLAN.md §0–§3 and §8, and adopt
the doctrine in §3 as DOCTRINE.md (WP-0.1). Work the ledger (§14) in order: for each WP read only its entry and what it
cites, meet every Done-when and prove it with Verify, apply the definition of done (§8.3), update the ledger and
docs/PROGRESS.md, commit per WP, and keep one draft PR current. Make reversible calls yourself and log them; escalate
only hard-to-undo calls (§3), using the 15-minute timer and the defaults in §13. Run each gate's command set and post
its report on the PR. Reach G4 (M1, first flight) first, then continue phase by phase. When something needs the owner,
mark it blocked-owner, say exactly what is needed on the PR, and carry on with the rest. Stop only for a kill criterion
(§12) or a finished ledger.
```

**Effort level: ultracode** (recommended), with **max** as the fallback.

- **Why ultracode.**
  - This is the package tier: built once and used by every game, so it gets the care.
  - The plan is built for multi-agent execution (§11). Every WP owns its paths, there are implementer and verifier
    templates, and an integrator owns the shared files.
  - The contract runs single-threaded through G1, and after G2 four lanes fan out (sensors, three.js, library,
    composition).
  - Verifier reviews of L WPs and gates catch the defects that compound.
- **Why not lower.** The format, the solver and the sensors compound: a mistake there costs every later WP, so
  medium and high are false economies.
- **When to choose max instead.** If you'd rather watch the contract form in one coherent session before paying for
  parallel lanes, run the first session at max through G1 or G4, then switch to ultracode.
