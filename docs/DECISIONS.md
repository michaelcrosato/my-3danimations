# Decisions

The decisions log the doctrine asks for (`DOCTRINE.md`, "Deviations and escalation"): every deviation from a principle
in the package tier, every call made without the owner's answer, every owner answer, and every exception granted. One
entry per decision, newest last, numbered `D1`, `D2`, ...

**The log is never cleaned up.** An entry that no longer holds is marked **Superseded by D<n>** and kept.
`npm run doctrine` (WP-0.3) fails when an entry on `main` is gone.

An entry:

```
  ## D<n> · YYYY-MM-DD · <the call, in a few words>
  - **Principle:** which one (or "process")
  - **Call:** what was decided
  - **Why:** the reasoning, and what would change it
  - **Answered:** yes (who asked or approved) | no: made without a response, to review
  - **Landed in:** the version and, once merged, the pull request
```

D1 to D15 are the decisions that shape the plan (`PLAN.md` §1.3). The owner approved the plan through
michaelcrosato/my-3danimations#1 to #3 and asked for its execution on 2026-10-11, so each is answered by that approval.
"Landed in: WP-0.1" means before the version scheme existed (WP-0.2 sets it up at v0.1.0).

## D1 · 2026-10-11 · Adopt the doctrine

- **Principle:** all
- **Call:** `PLAN.md` §3 becomes `DOCTRINE.md`, verbatim, with its headings raised one level and an "In this
  repository" table (principle, rule, check) appended. It keeps my-3d2dge's doctrine (its D1, 2026-10-10), recast for
  an animation package.
- **Why:** one statement of what we optimize, with a check per principle, read before every WP.
- **Answered:** yes, the owner (plan approval and the kickoff prompt).
- **Landed in:** WP-0.1

## D2 · 2026-10-11 · The shared unit is the spec, the data and the conformance vectors

- **Principle:** 7, 12
- **Call:** TypeScript is the reference implementation. Other languages certify against the vectors (WP-10.2) instead
  of porting the codec again.
- **Why:** across five repositories the code was rewritten each time while the format, the data and the vectors
  traveled intact (the codec exists in JavaScript and in about 7,500 lines of Rust, and a TypeScript port was planned).
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D3 · 2026-10-11 · Readable key poses stay the stored form, as format 2

- **Principle:** 1, 4, 12
- **Call:** format 2 keeps format 1's readable key poses. New degrees of freedom are named optional fields; `format` is
  validated on read; a minor version only adds named fields, and fixed-length arrays never grow.
- **Why:** key poses land 14 to 18 mm from the capture at about 14× smaller than GLB, and a model reads them as text.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D4 · 2026-10-11 · One clip per file, plain JSON; every set has a content id

- **Principle:** 4, 10
- **Call:** `library/sets/<SET>/<Clip>.json`, plain JSON with stable key order; each set's `_set.json` carries a content
  id (source edition, importer revision, SHA-256 of the clip files). No two sets share a name.
- **Why:** `QUATERNIUS` already means two different sets in two repos; per-file clips diff and review cleanly.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D5 · 2026-10-11 · The canonical skeleton is VRM 1.0's humanoid

- **Principle:** 7
- **Call:** 55 bones, 15 of them required. Mapping tables cover Mixamo, Unreal, Rigify, CMU, BVH and Unity. Khronos's
  `KHR_character_skeleton_mapping` is tracked.
- **Why:** the most widely adopted open humanoid naming; aligning with Khronos once it is ratified is cheap from there.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D6 · 2026-10-11 · The core has no dependencies, never touches a renderer, and is deterministic

- **Principle:** 5, 6
- **Call:** `@m3a/core` imports nothing; it splits `step` (hashed, deterministic) from `pose` (presentation).
- **Why:** it must run anywhere JavaScript runs and give the same bits in Node and the browser, so games can hash it.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D7 · 2026-10-11 · three.js is the first adapter, pinned to what agents write correctly

- **Principle:** 9
- **Call:** the default pin is r182, the owner's prior pin; the latest release (r186) is also tested; stale APIs are
  banned.
- **Why:** agents write the version they know cold; the latest is tested so the upgrade path stays known.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D8 · 2026-10-11 · The sensors render in software, in Node

- **Principle:** 3
- **Call:** sheets and films are drawn by a software rasterizer in Node. A browser checks adapters only, on WebGL 2.
- **Why:** headless Linux Chrome cannot screenshot WebGPU, and pixels from a software raster are deterministic.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D9 · 2026-10-11 · No committed binaries

- **Principle:** 4
- **Call:** test characters are generated in code; real CC0 rigs are fetched by SHA-256 into a git-ignored cache.
- **Why:** text diffs, reviews and reproduces; binaries reproduce from text plus pinned sources.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D10 · 2026-10-11 · License namespaces, with CC0 as the default pack

- **Principle:** 10, 11
- **Call:** the default pack is CC0. CC BY 4.0 (with credit) and CMU-licensed clips (no resale "even in converted
  form") are opt-in, in sets of their own. Non-commercial and no-redistribution libraries stay in `library/local/`,
  which never ships.
- **Why:** a clip with tainted provenance shipped in a game cannot be recalled (R8); a game gets only CC0 unless it
  opts in.
- **Answered:** yes, the owner (plan approval, PR #3).
- **Landed in:** WP-0.1

## D11 · 2026-10-11 · One tool registry; the CLI and the skill first, MCP as a view

- **Principle:** 2
- **Call:** `defineTool` entries become the API, the `m3a` CLI, an MCP tool and a console handle.
- **Why:** CLI plus skills cost a coding agent less context than MCP (Playwright's own guidance); one registry keeps the
  surfaces from drifting.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D12 · 2026-10-11 · Generative models plug in through a socket; none ships in v1

- **Principle:** 10, scope
- **Call:** the socket ships with library, recipe and procedural sources and a mock. NVIDIA Kimodo, the first
  commercially usable candidate, would run as a remote backend (WP-D.9).
- **Why:** most text-to-motion models are trained on non-commercial data (AMASS, HumanML3D) or carry restrictive terms.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D13 · 2026-10-11 · The benchmark is the North Star

- **Principle:** North Star
- **Call:** fresh-agent dry runs (`bench/`) gate every surface an agent touches.
- **Why:** the first outside model to build on my-3d2dge never found the library; only a fresh agent measures that.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D14 · 2026-10-11 · This package is the upstream

- **Principle:** process
- **Call:** games pin it; nobody vendors a snapshot of a sibling repo.
- **Why:** forks have already started under one name.
- **Answered:** yes, the owner (plan approval).
- **Landed in:** WP-0.1

## D15 · 2026-10-11 · The library grows through one intake queue, and the repository stays the library

- **Principle:** 11
- **Call:** any agent submits to a hosted queue (O8); automated checks run on every submission; the owner adopts,
  archives or rejects each one that passes (O7). Adopted clips land through pull requests. The queue sits behind an
  interface with a local backend, so no WP waits on the hosted project.
- **Why:** open AI catalogs were flooded (Fab) or poisoned (ClawHub); human review before adoption kept registries
  clean.
- **Answered:** yes, the owner (plan approval, PR #3).
- **Landed in:** WP-0.1

## D16 · 2026-10-11 · O1 answered: the code license is MIT

- **Principle:** process (owner decision O1)
- **Call:** the package's code is MIT. `LICENSE` was committed by the owner before execution began.
- **Why:** matches my-3d2dge; permissive, so the package can become a standard. Clips keep their per-set licenses (D10).
- **Answered:** yes, the owner, 2026-10-11.
- **Landed in:** WP-0.1

## D17 · 2026-10-11 · O11 answered: code and data carried from riftlight, shardfall and my-3d2dge-2 are MIT

- **Principle:** 10 (owner decision O11)
- **Call:** those three repositories have no license file; their author, the owner, granted MIT for the code and data
  carried from them into this repository. Third-party clips in them keep their per-set licenses (D10).
- **Why:** `PLAN.md` §4 carries their code; the grant makes the carry clean.
- **Answered:** yes, the owner, 2026-10-11.
- **Landed in:** WP-0.1

## D18 · 2026-10-11 · WP-1.5 commits the CMU and Mesh2Motion sets before WP-5.3's Mesh2Motion audit

- **Principle:** 10, 11 (D10, kill criterion K3)
- **Call:** the owner confirmed the plan's order: WP-1.5 migrates and commits the CMU and Mesh2Motion sets (each in its
  own tier, CMU opt-in) before WP-5.3 audits Mesh2Motion's licensing. If that audit removes the set, K3 applies: it
  moves to `library/local/`, and an escalation follows only if the library drops under G5's floor.
- **Why:** the sets are needed for G1 and M1; the audit is reversible by K3's move while nothing is published.
- **Answered:** yes, the owner, 2026-10-11.
- **Landed in:** WP-0.1

## D19 · 2026-10-11 · O7 answered: the owner adopts every clip

- **Principle:** 11 (owner decision O7)
- **Call:** after the automated checks, the owner adopts, archives or rejects every submission; nothing is adopted
  automatically. Changing that is an owner decision.
- **Why:** human review before adoption is what kept registries clean.
- **Answered:** yes, the owner, 2026-10-11.
- **Landed in:** WP-0.1

## D20 · 2026-10-11 · O8 answered: submissions and reviews are stored in a Supabase project, free tier

- **Principle:** 11 (owner decision O8)
- **Call:** the hosted intake queue is a Supabase project on the free tier. Until the owner links it, the local store
  stands in and phone reviews travel as a JSON export.
- **Why:** a hosted inbox lets any agent submit without access to the repository; the repository stays the library.
- **Answered:** yes, the owner, 2026-10-11.
- **Landed in:** WP-0.1

## D21 · 2026-10-11 · Run the plan in single-agent mode

- **Principle:** process (`PLAN.md` §11)
- **Call:** the kickoff did not name ultracode, so the plan runs as one agent ("max"), working the ledger in order,
  with subagents only for independent WPs whose Owns don't overlap, and a verifier subagent on every L WP and gate.
  Phases stay on one development branch, `claude/relaxed-albattani-35xhjq`; after each gate's merge the branch restarts
  from `main` and a fresh draft pull request opens for the next phase.
- **Why:** §11's single-agent mode; the session's push rights cover that one branch.
- **Answered:** no: made without a response, to review.
- **Landed in:** WP-0.1

## D22 · 2026-10-11 · Toolchain: TypeScript run directly by Node 24, versions agents know cold

- **Principle:** 9, 7 (WP-0.2)
- **Call:**
  - Node 24 runs the TypeScript sources directly (type stripping), so repo tools and tests need no build step. The
    tsconfig allows only erasable syntax (no enums, namespaces or parameter properties) and `.ts` import extensions;
    `tsc -b` checks every project and emits declarations only. A JavaScript build for packing arrives with WP-4.7/7.4.
  - Pins: TypeScript 5.9.3 (not 7.0, the native port, which typescript-eslint does not support yet), Vitest 4.1.11,
    Vite 7.3.7, ESLint 10.12.0 (9.x is now marked unsupported upstream), typescript-eslint 8.71.1, Playwright 1.56.1
    (its Chromium is the container's build 1194, so `playwright install` is never needed here), `@types/node` 24.
  - The workspaces are `private` until O2 is answered, so nothing can be published by accident.
  - WP-0.2 also owns `.npmrc` (`save-exact`), `playwright.config.ts` and `tests/e2e/smoke.e2e.ts`; its entry says so.
  - Core's lint bans `Math.random`, `Date.now`, `performance.now` and host globals, and its tsconfig has no DOM or Node
    types, so principles 5 and 6 fail at T0 already.
- **Why:** these are the versions an agent writes correctly without docs; the rest keeps T0 at about 3 s.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.1.0

## D23 · 2026-10-11 · How the conformance vectors are cut

- **Principle:** 12 (the contract), 4 (WP-0.4)
- **Call:**
  - The oracles run unchanged from the pins cache. `readLibrary`, which tools/anim-import.mjs does not export, is
    loaded from that file's own text up to its run section with an export appended; the function bodies are untouched.
    Each oracle run is cross-checked against shardfall's `rig_expected.json` and `cmu_expected.json` (written by the
    same importer), and the generator fails if they differ. They agree in every rest and every key.
  - Tier 1b's rig is committed as a `.gltf` (glTF JSON with its buffer embedded as base64): text, and the standard text
    form of glTF. Packed as .glb it hashes to the bytes the oracle read. The doctrine's binary list no longer counts
    `.gltf` as binary.
  - Tier 2 decodes every curated clip at its key times and at 0.37, 0.71 and 1.05 of its duration (a loop wraps, a
    one-shot holds), in whole micrometres: 6.1 MB in all. Every clip at 30 fps would be about 20 MB, so
    `npm run vectors -- --dense` writes that into `.cache/` instead.
  - Tier 3's bodies are the tiny rig rescaled per segment (seven, measured by the origin's `measure`), plus the sets'
    own bodies and CMU subject 09.
  - CMU's take 09_02 and skeleton are committed as test fixtures under CMU's notice (recorded in the vectors' README);
    they are never library clips.
- **Why:** bit-for-bit tiers need the oracle's exact inputs; the sizes keep the committed vectors at 7.1 MB of the
  10 MB budget, frozen fixtures included.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.1.0

## D24 · 2026-10-11 · Phase 0's verifier findings: .gltf stays binary; Owns overlaps logged

- **Principle:** 4, process (G0's verifier review)
- **Call:**
  - **Supersedes D23's line on .gltf.** A `.gltf` counts as binary again, because one can embed a whole rig as base64;
    `spec/vectors/tier1b/rig.gltf`, generated in code by `tools/vectors/rig.ts`, is approved by its exact path in
    `tools/doctrine/binaries.ts`, and a failing fixture covers any other `.gltf`. WP-0.4's Owns now lists that entry.
  - WP-0.3 added the doctrine step to `tools/run/tiers.ts`, which WP-0.2 owns; in single-agent mode this is logged
    rather than split out.
  - Phase 0 lands as v0.1.0 throughout: nothing is released before G0, so its WPs share the first version.
  - The SessionStart hook runs only in cloud sessions (`CLAUDE_CODE_REMOTE=true`), as WP-0.5 says; CI pins Node
    24.21.0; the e2e smoke suite asserts WebGL 2.
- **Why:** the verifier's failures and notes; each fix is small and in scope.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.1.0

## D25 · 2026-10-11 · The validator is hand-written; Ajv checks the schemas agree

- **Principle:** 6, 7 (WP-1.2)
- **Call:**
  - `@m3a/core` imports nothing, so `validate` implements the rules in code; the JSON Schemas in `spec/schemas/`
    are the portable statement of the structure, and a test runs Ajv 8.20.0 (a dev dependency) over the same fixtures
    so the two can't drift: every structural failure the validator raises is a schema failure too.
  - Angles unwrap, so they are valid within ±3600 and warn past ±540 (the seed sets reach 582 and −1086); hips are
    bounded at ±1000% forward and right and −100..1000% up; root travel is unbounded in practice (±10⁷).
  - The shared format types (`packages/core/src/format/types.ts`) land in WP-1.2 although WP-1.3 owns `format/`,
    because the validator needs them first; WP-1.3 extends the file.
  - A scratch run over all 762 clips of the seven seed sets (my-3d2dge's three, shardfall's four) gives zero errors and
    the predicted warnings: 16 twist pops (the Roll clips), 71 keys with hips below the floor (Zombie_Rise at −40%, the
    swims), 214 angles past ±540 (spins).
- **Why:** the doctrine keeps core dependency-free; the schemas keep the format readable by any language's tools.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.3.0

## D26 · 2026-10-11 · Tier 2's vectors carry their input clips

- **Principle:** 12 (the contract), D2 (WP-1.3)
- **Call:** each tier-2 clip now holds `clip`, the origin's clip object with its keys, beside its decodes, so tier 2
  runs from the committed vectors alone (in CI, and for another language's port) instead of needing the pins cache.
  The vectors' JSON writer moves to `spec/conformance/runner/json.ts`, where the conformance tests hash mirrored keys
  with it. The committed vectors grow to 9.54 of 10 MB with the frozen fixtures; nothing else is planned for tier 2,
  and format-2 fields will get small vectors of their own.
- **Why:** a conformance kit must hold its inputs (WP-10.2); a test that needs the network is a test CI skips.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.4.0

## D27 · 2026-10-11 · The codec: format 1 exactly, format 2 on separate paths

- **Principle:** 12, 1 (WP-1.3)
- **Call:**
  - `@m3a/core/src/format/` ports readable.js operation for operation; tier 1a matches the oracle bit for bit (the
    rig's and the CMU take's reduce, fit, max, mean, keys and text) and tier 2 rounds to the oracle's micrometre at
    every one of 7,444 samples (key times and in-betweens) of the 325 curated clips.
  - Format 2's hand, fingers and spine take branches a key without them never enters. Encoding them: `hands: true`
    fits the hand from the wrist, knuckle and knuckle line (roll solved exactly from the plane of the knuckle line and
    the hand) and estimates all five finger curls from the middle finger, the only one with a body point. Encoding
    `spine` shares and `yaw` waits for WP-5.3's re-import, which has the source's spine bones and root rotation.
  - `fit` takes one budget, or one per region (torso, arms, legs): a frame's excess is its largest error over its
    floor beyond that region's budget. The single-budget path is the origin's, unchanged.
  - The canonical file writes the header one field per line, nested objects in a fixed order, and each key as the
    lens's three short lines, so a clip file is itself the readable form and diffs per key.
- **Why:** bit-for-bit parity is the contract other languages certify against; new fields must not move old numbers.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.4.0

## D28 · 2026-10-11 · The skeleton profile: tables first, topology as a reported fallback

- **Principle:** 7, 8 (WP-1.4)
- **Call:**
  - Eight mapping tables (VRM/Godot, Unity, Mixamo, UE5, UE4/Quaternius UAL2/Mesh2Motion, Rigify, CMU ASF, 100STYLE
    BVH) match names after dropping namespaces, case and separators; the table with the most required bones wins.
  - When names leave required bones unmapped, a topology and geometry fallback maps the skeleton and says so, starting
    at confidence 0.85; a named `table` turns the fallback off. `patchMapping` is how an agent corrects a mapping.
  - The format's (forward, right, up) coordinates are a left-handed triad physically; glTF is right-handed. The
    conversion is one reflection, `(f, r, z) → (−r, z, f)`, done once by adapters (SKELETON.md §2).
  - `measure` is the origin's, operation for operation (it reproduces tier 1a's rests bit for bit), and `restPoints`
    places body points on any recognized skeleton (within 0.001 mm of the importer on the tiny rig), so the solver can
    measure a target body the same way as a library's.
- **Why:** exact names are cheap and certain; a renamed rig still binds, with the doubt visible in its confidence.
- **Revised in WP-4.3 (D47):** binding renamed test characters showed the topology fallback taking a long clavicle for
  the upper arm (every arm bone one off), climbing past the spine's branch into an arm when the head had no neck and
  nothing above it, taking a twist leaf for the hand, taking the last neck bone for the head, and a twist bone in the
  thigh for the shin. Fixed, each with a fixture that fails on the old rule; an arm whose mapped upper arm and forearm
  cover under 65% of its chain (twist bones in it) is reported, with the confidence lowered.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.5.0

## D29 · 2026-10-11 · WP-1.3's verifier findings: roll unwraps, fingers curl to the palm normal, keyed sources

- **Principle:** 12, 10 (WP-1.3's verifier review)
- **Call:**
  - **Hand roll is an angle that unwraps** (`MOTION.md` §5.3, §6.3), like a twist: full pronation sits at ±180 and a
    forearm turning through it must not spin through supination in an in-between. Valid within ±3600, warned past
    ±540; the encoder unwraps it against the key before.
  - **Fingers curl toward the palm normal** `n = m′ cos φ − a sin φ`, perpendicular to the hand for any flex and side;
    the first rule (toward `m′` made perpendicular to the hand) degenerated at full flex and tilted with side.
  - **`fromFormat1` takes the source's method**, and `ai` follows it: Quaternius' and Mesh2Motion's hand-animated
    clips are `keyed` (`digitalCreation`), the captures `captured` (`digitalCapture`).
  - Also: `serialize` orders nested objects recursively; `mirror` negates `facts.travel`'s sideways part; `fromFormat1`
    copies key arrays; the key lens writes valid JSON with no header; the normalized lens exists (`normalized`).
  - **Format 2's fields get vectors now:** `tier2/FORMAT2.json`, six clips with hand, fingers, spine and yaw decoded by
    `@m3a/core`, the reference implementation for them (D2), so any change to their geometry fails `vectors --check`.
    The committed vectors are at 9.70 of 10 MB.
- **Why:** the verifier's three failures and its notes, each reproduced by a test before the fix.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.5.0 (the codec's fixes ride WP-1.5's version)

## D30 · 2026-10-11 · The seed sets migrated: five sets, provenance corrected, catalogs fitted

- **Principle:** 10, 4, 1 (WP-1.5)
- **Call:**
  - Five sets, 525 clips, one file each through core's `serialize`: QUATERNIUS_3D2DGE (88), QUATERNIUS_SHARDFALL (102),
    MESH2MOTION (177), CMU_CURATED (60) and STYLE100 (98). Every migrated key equals its source's, number for number;
    the three sets tier 2 covers decode within the micrometre of the oracle on the manifests' own rest bodies.
  - **Provenance corrected where the origin was wrong or thin:** CMU's source records carry CMU's full notice (the
    origin's said "free for all uses" and omitted "you may not resell this data directly, even in converted form") with
    `LicenseRef-CMU-Mocap`; licenses become SPDX ids with the free text kept as `terms`; Quaternius' clips and
    Mesh2Motion's hand-animated ones are `keyed` (`digitalCreation`), the captures `captured`.
  - **MESH2MOTION stays `cc0`, flagged.** Its README licenses the animations CC0; a July 2026 report of CC BY and
    CC BY-SA assets names models, not animations, so no clip goes to `local` now. Each source record carries an `audit`
    note pending WP-5.3's per-asset audit (D18; K3 applies if the audit removes it).
  - **MESH2MOTION's `orig`** (`QUATERNIUS/<clip>`) points at the Quaternius import that has the clip, the v2 one first
    (it has the `_RM` twins): all 84 resolve. CMU comes from my-3d2dge, whose copy differs from shardfall's in one clip.
  - **Catalogs:** the source column is the clip's `src` (the file names any `orig`), and a description that would
    overrun 40 tokens is cut for the row at a sentence, a clause, or a word with "…" (34 of 525 rows); the clip keeps
    it whole. `MOTION.md` §9.3 says so.
  - **Warnings** (171 in all, none an error) are baselined per clip in each set's `_baseline.json`, each with its
    reason and the WP that addresses it; a new or vanished warning fails `library/migrated`.
  - The migrator stamps its own revision (`m3a-migrate 1`), not the package version, so version bumps don't move the
    library: content ids are the same on every run.
- **Why:** distinct content gets distinct names (D4), and provenance must be right before anything ships (R8).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.6.0

## D31 · 2026-10-11 · Spec 2.0-rc frozen at G1, held by a doctrine check

- **Principle:** 12 (the contract), D3 (gate G1)
- **Call:** `spec/MOTION.md`, `spec/SKELETON.md`, `spec/LEGEND.md` and `spec/schemas/*.json` are frozen as spec 2.0-rc.
  `spec/frozen.json` records their SHA-256s and `npm run doctrine` fails when one changes without it. A frozen file
  changes only in a commit that logs a decision and reruns `node tools/doctrine/freeze.ts <decision>`. Before the
  freeze the spec gained `_baseline.json` (§9.4, with a schema) and the source record's `terms`, `audit`, `file` and
  `rig` (§9.1), so every field in the vectors and the migrated sets is specified (the library test lints every clip
  and manifest for unknown fields: none). The freeze check lands in `tools/doctrine/`, which WP-0.3 owns.
- **Why:** every game and every port depends on the contract (principle 12); a freeze nobody checks drifts.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.6.0

## D32 · 2026-10-11 · G1's verifier findings: the spec amended before the merge, the freeze check tightened

- **Principle:** 12 (the contract), 4 (provenance), D31 (the freeze)
- **Call:** the G1 verifier failed the gate on seven findings; all are fixed before PR merge, under this decision:
  - `MOTION.md` §2 called the frame right-handed. It now says what the code and `SKELETON.md` §2 do: f × r = z as
    numbers, a left-handed triad physically, mirrored once by an adapter.
  - `MOTION.md` §5.2 gains a Range column (`shL`/`shR` ±180, the foot's down and toes ±180, `blade` a direction not
    all 0). `root` was "no bound" in the spec, ±10^7 in the validator and unbounded in the schema; it is ±10,000,000 in
    all three (100,000 body heights).
  - `MOTION.md` §7.5 said `fit` is `[0, 0]` for keyed clips, but D29 made the Quaternius and Mesh2Motion sources keyed
    and their clips carry a measured fit. `fit` is now measured against the source frames a clip was fitted from,
    whatever its method, and `[0, 0]` only when there were none. The validator's hint says the same.
  - CMU's `terms` now hold CMU's notice word for word (the acknowledgments request included), not its first two
    sentences; the library test compares it with the research note's quote.
  - Baseline reasons are written per warning from the clip's own keys, not one text per code: 52 of CMU's 107
    `M2-W005` warnings are a nearly straight leg's twist winding up (bend at most 24°), not a spin, and now say so.
    A warning no reason covers fails the migration, and the test checks each reason's claim about the limb's bend.
  - `SKELETON.md` §5: name matching also drops a leading `mixamorig` with no colon, since three.js's loader turns
    `mixamorig:Hips` into `mixamorigHips` (such rigs fell to the topology fallback).
  - Set sources: the schema declares `terms`, `audit`, `file` and `rig`; the validator rejects a non-positive `H0` and a
    non-string `credit`, as the schema does.
  - The freeze check now also fails when `spec/frozen.json` is gone, when a file joins the frozen set (a new schema)
    unrecorded, or when the decision it names isn't logged; `spec/conformance/tiers.md` (the tolerances) joins the
    frozen set, and `freeze.ts` refuses a decision that isn't logged.
- **Why:** a frozen spec that contradicts its code or its library misleads every port (a reader trusting "right-handed"
  mirrors every character); notices and reasons are provenance (principle 4) and must be true word for word.
- **Not acted on, logged in `docs/FEEDBACK-LOG.md`:** `facts.by` naming the migrator for a speed shardfall measured;
  1 µm decoding proven by decoding for 3 of 5 sets (the other 2 by equal keys and copied rests); VRM `humanBones` reading
  (io, WP-4.3); a validate kind for `_baseline.json`.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.6.0

## D33 · 2026-10-11 · The portable math is V8's bits, and all of core uses it

- **Principle:** 5 (deterministic by construction), WP-2.1
- **Call:**
  - `@m3a/core`'s `math/portable.ts` gives native V8's bits for `sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`,
    `exp`, `log`, `log2`, `log10`, `hypot` and `cbrt` on every input tested: 200,000 per function in the origin's
    ranges, 30,000 random bit patterns each over the whole double range, and the special values. That is more than
    the origin, whose 6 exact functions stopped at 2^19·π/2 and whose others were a few units off. The extra exactness
    comes from porting what V8 runs: fdlibm's `tan`, `asin`, `acos`, `log10`, `cbrt` and Payne–Hanek reduction,
    FreeBSD's `log2` and `atan2` (±π/2 when |y/x| > 2^60), V8's `hypot` (scaled, Kahan-summed) and its `exp(1)` case.
  - `pow` is fdlibm's, within one unit of the native: V8 calls the platform's C library for `pow` (glibc's here), so
    native `pow` itself differs between platforms, and no portable `pow` can match every one.
  - The kernel's functions that need trigonometry take a `MathLike`, portable by default; presentation may pass
    `NATIVE`. The codec, the skeleton profile and the validator now call `PORTABLE` too (tiers 1a and 2 stay bit for
    bit, because the bits are the same), and ESLint bars the host's transcendental `Math` functions from core outside
    `math/portable.ts`. This went beyond WP-2.1's `Owns`; one agent holds every lane (D21).
  - `npm run test:cross-engine` fails when no Bun is found, rather than passing unchecked: the G2 criterion needs a
    second engine.
- **Cost, measured** (`npm run test:cross-engine`, ns per call through a function value, Node 24.21 and Bun 1.4.2 in
  the container): `sin`, `cos`, `atan`, `asin`, `acos`, `exp` and `hypot` 0.7 to 1.5× native; `tan`, the logs and
  `cbrt` 1.5 to 3.5×; `pow` about 4× (about 150 ns). A pose of 36 points with its trig costs a few microseconds more.
- **Why:** the hashed paths and the exact-mode pose (§5.5) must give the same bits in Node, Chromium and Safari; matching
  V8 exactly also keeps every vector generated in Node valid.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.7.0

## D34 · 2026-10-11 · Facts are measured, and their ground truth is the origins' own measurements

- **Principle:** 9 (QA first), 5, WP-2.2
- **Call:**
  - `facts-truth.json` takes its expectations from three sources the code under test never saw:
    - my-3d2dge-2's asset manifest, which measured each GLB clip's root speed (m/s) and loop flag;
    - its designers' strike times for the hero's skills;
    - shardfall's importer's recorded 100STYLE speeds.

    Clips were chosen by rule, not by result: every forward-stepping UAL loop the manifest gives a speed, 100STYLE's
    fastest and slowest recorded walks, all six `_RM` clips, and the hero's sword strikes. The origin's `hitAt` belongs
    to procedural moves, and shardfall's `strike` is computed by its Rust runtime at run time (no stored numbers), so
    neither could serve. Monster skills' timings are left out: they also drive procedural creatures, and one
    (`Zombie_Scratch`) sits 0.24 s after the swipe.
  - An in-place loop's speed is read from its planted feet: at each sample, the planted foot nearest under the pelvis,
    its lowest point, the median velocity. Every stepping loop lands within 11% of its source speed.
    - Swims and slides plant no foot on the floor, so they read as not travelling.
    - A shuffle reads low (100STYLE's `Penguin_Walk`, −18%, outside the truth set's rule).
  - Contacts are detected about the format's floor (z = 0) with hysteresis. A toe dipping through the floor mid-swing
    must not move the ground, and an end far under the floor isn't planted.
  - The strike is when the fastest end moves fastest relative to the pelvis: the fists, a blade's tip (one H0 along the
    knuckle line) when the clip holds one, and the toes for a kick. It lands within 0.06 s of the designers' times.
  - Events fire in half-open windows `[t0, t1)`, so a loop's `t = 0` and `t = dur` are one moment, firing once a
    cycle. A one-shot's end event fires once the playhead passes `dur`.
  - Lint now also bars `**` in core other than squaring, which is exact in every engine.
- **Why:** facts drive QA, search and gameplay timing; a fact checked only against the code that computed it proves
  nothing (PLAN.md WP-2.2, "Ground truth").
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.8.0

## D35 · 2026-10-11 · Pose operations work on key numbers; synced blends take the legs from points

- **Principle:** 2 (one language), 9, WP-2.3
- **Call:**
  - Pose operations work on a key's numbers (`KeyLike`), the format's own parameters, as the solver will (§5.5:
    bake from the parameters).
  - `blend` takes an angle to the other pose's value nearest it (whole turns apart), so it blends the short way round.
    At 0 it gives its first input exactly; at 1 the second, angles up to whole turns, which decode identically and
    stay continuous with the first.
  - A field neither pose has stays out, because a `hand` present changes how the arm reads (§5.3).
  - A synchronized blend maps each loop's cycle to a contact phase: the left plant is 0, the right plant 0.5.
  - Given a rest body, it blends the legs in point space. Both poses are decoded, the points lerped, and the pelvis
    and legs encoded back unrounded (`encodePose(..., { round: false })`, added to WP-1.3's encoder; its default and
    the vectors are unchanged).
    - Why: a foot's height isn't linear in a leg's direction and bend. Blending those numbers lifted feet that both
      inputs plant by up to 35 mm in a walk–run blend; in point space they stay within 18.5 mm.
    - Started half a stride out of step, the same blend by time lifts them over 100 mm.
  - Masks are named groups (`upper`, `lower`, `armL`, `armR`, `legs`, `head`, `spine`), feathered along the body's
    links.
  - Retiming and slicing drop measured facts, to be measured again; loopify eases the last stretch toward the first
    pose.
- **Why:** these are the operations every layer and graph state (WP-2.6, 6.x) is built from; their properties are the
  G2 property tests.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.9.0

## D36 · 2026-10-11 · The solver decodes on the target's own body and rolls each bone from the parameters

- **Principle:** 2, 12, WP-2.4 (PLAN.md §5.5: bake from the parameters)
- **Call:**
  - `bind` measures the target's body from its bones: `restPoints` plus `measure`, so its proportions, offsets and
    rest frames are its own. It maps the format's frame to the skeleton's linearly; that map is a reflection for glTF.
  - `solve` decodes the key on that body, which places the hips by the hip-height ratio and puts every limb at its
    own lengths with the key's pole. Each bone then turns from its rest triad to its posed one. Rotations are built
    from mapped triads, so no quaternion is ever reflected.
  - Each bone's roll comes from the parameters:
    - limbs: the normal of the plane they bend in (the whole limb's direction × its pole), perpendicular to both bones
      at every bend, so a straight limb keeps its twist and no bend flips it. Posed, the pole is the key's, twisted.
      At rest it is the pole the decoder gives a T arm (a straight-down leg) at twist 0, carried onto the rest limb by
      the shortest turn, so an A or relaxed rest is the T body with its arms turned;
    - hands: the knuckle line (index side). At rest it is the skeleton's own; posed, the decoder's thumb side (the
      key's hand frame), a format-1 blade's line, or for a format-1 hand (no roll in the data) the rest line carried
      by the forearm, so the wrist doesn't twist;
    - feet and toes: the axis they pitch about (level, across the foot's heading);
    - spine bones: their share of the pelvis-to-chest turn (the key's `spine`, else the source library's when given,
      else the body's own);
    - fingers: their curl, toward the palm about the knuckle line (absent: format 1's fists; a format-2 hand without
      fingers is open).
  - The hips carry the lowest spine segment (`solveRest`, `reachable`, `decodeOn`). The hips bone also carries the
    legs, so it can't take a share of the chest's turn; a share there (a format-2 `spine`, CMU's up to 1) goes to the
    segments above, and every point the solver decodes is one the bones reach.
  - Local rotations are relative to the parent's world orientation, with a host's rest orientations when given (a
    test rebuilds the joints from them).
  - A pose whose lowest sole would go below the floor is lifted whole, as my-3d2dge's `Mocap.drive` did. Solving each
    leg onto the floor bent legs up to 67° from the source on a rise from the ground.
  - Results:
    - Reference body (the tiny rig): every joint within 0.0018 mm of the solver's decode at all 7,572 tier-2
      samples; against the plain decoder, the 124 samples with a lower spine share differ by up to 36.5 mm
      (`Sword_Attack`'s `spine` [41, 40, 80]).
    - Roll: a T key on a T rest gives the rest rotations (within 1°); a pose and its mirror give mirror rotations
      (within 3.4e-6°); sweeps through elbow, knee and foot bends turn no bone more than 2° per 0.05° step; A and
      relaxed rests give the T's rotations (within 1e-4°); fingers curl toward the palm at any hand roll.
    - Tier 3, seven bodies × 331 clips × 4 times:
      - whole limbs (shoulder to virtual fist, hip to ankle) within 9°, at worst 0° to rounding;
      - the chest faces exactly where the clip's does;
      - bone lengths unchanged, soles never below the floor, no NaN.
- **Limit:** the format's twist at a straight limb, and a foot's heading when it points straight down, are whatever
  the encoder measured there (spec/MOTION.md §6.3). The solver follows them, so a straight leg can turn about its own
  axis where the data's twist jumps (`Sprint_Loop`'s left leg, straight at 0 s: 177°, then 354° one key later).
  Joint positions don't change. F2.4.
- **Review:** WP-2.4's verifier found 8 failures, all fixed in v0.11.1:
  1. the left arm's rest pole was mirrored, a 62.7° roll on every pose;
  2. the upper arm and shin flipped 180° at the bend where the pole lies along the bone;
  3. the foot rolled by the pelvis's up and flipped at toe-off;
  4. format-1 hands rolled onto a placeholder line, 180° off their mirror;
  5. the hand's rest line was the chest's right axis, so T, A and relaxed rests differed by up to 90°;
  6. fingers curled toward the unrolled palm;
  7. `Solved.points` were not the points the bones reach;
  8. the Done-when held only without a lower spine share.

  Joint tests can't see roll, so tests now check rotations. Its notes not acted on are F2.
- **Outside WP-2.4's Owns** (one agent, D21): `limbPoles`, exported from the decoder; the decoder's fix for a shoulder
  with no offset (a body without shoulder bones gave NaN); `quat.fromMat3`; the tier-3 test and its skeleton helper.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.10.0; the review's fixes in v0.11.1

## D37 · 2026-10-11 · Planting holds the contact point, statelessly, and in-place clips move by their feet

- **Principle:** 5, 9, WP-2.5 (riftlight's zero-slide gait and foot lock)
- **Call:**
  - `plant` holds a planted foot's contact point still in the world, not its ankle. The contact point is the lowest
    sole point at each step: the heel at strike, the ball and toes at push-off.
    - It does so by undoing that point's drift in the motion since the foot landed, summed on a fixed 60 Hz grid.
    - The result depends on time alone, so the Animator can skip or thin presentation poses without changing any pose
      it takes.
    - The hold engages at once, because there is no drift yet at landing, and eases out over 0.05 s.
    - Pinning the ankle instead fought the heel rising at push-off and dragged the foot up to 71 mm.
  - Planted soles touch the surface. Off flat ground the foot is pitched about its heel to the surface's slope (±45°).
    The body rests on the lower foot's ground, and the pelvis drops where a planted leg can't reach, by at most a tenth
    of H0 (median worst 7.8 mm over the locomotion loops, 57 mm on CMU's zombie walk). Free feet only come up out of
    the surface.
  - An in-place clip's root is the one its planted feet imply (`contactRoot`): the weight-bearing foot's contact point,
    reversed, with flight in-betweened. A constant speed left feet dragging up to 42 mm where the body's speed varies
    within the stride (a skip).
  - Contact detection gained a second test: a planted foot is still in the world, slower than half the body's speed.
    Without it, shuffles and low swings counted as planted for whole cycles (up to 1.8 m of slide). Gaps up to 0.1 s
    close, so a foot rolling off its heel onto its toes is one contact. The speed fact still reads the first pass (D34);
    facts-truth.json passes unchanged.
  - A synchronized blend's contacts are its inputs' contacts, weighted, rather than detected on the blend.
- **Result:** on all 133 migrated locomotion loops (walk and run, travelling) and synced walk–jog and walk–sprint
  blends at 0.25, 0.5 and 0.75, a planted foot's contact point slides 0.0 mm per contact (unplanted: up to 92 mm). On
  10° slopes and 0.2 m steps, up and down, planted soles are within 1.7 mm of the surface and no sole goes under it.
- **Revised in WP-4.5 (D49):** a re-solved knee takes the clip's own knee as its pole (the twist's pole winds round at
  a straight leg); the sole's setting eases in before a contact and out after it; the body is lifted and lowered
  continuously (`PlantOptions.settle`); a contact through a loop's seam is one contact.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.11.0

## D38 · 2026-10-11 · The Animator: plain state on a fixed step, poses that never feed back, a public API of namespaces

- **Principle:** 3, 5, 8, WP-2.6 (PLAN.md §5.5, the runtime contract)
- **Call:**
  - **State is plain data.** An Animator's state is:
    - its layers: clip id and content hash, weight, mask, additive, speed, playhead, loop cycles, and the one-shot end
      it rests on;
    - the steps taken, the time carried to the next step, and the root;
    - the bound body's fingerprint, because root motion scales with the body.

    `save()` returns exactly that, `hash()` hashes it, and `restore()` takes it back. A save made on another body is
    refused (E_BODY_CHANGED). No −0 is kept, since JSON writes it as 0. Everything else is cached as a pure function
    of a clip and the body (the root path, decoded points, an additive clip's first key), so a restored Animator
    rebuilds it identically. `maxSteps` and the ground are the host's settings, like the dt it passes.
  - **A clip's content hash** covers what playing reads: duration, loop, keys, events and contacts, as the clip's JSON
    text gives them. A clip loaded from its file and the same clip built in memory hash alike, and an edit to its name
    or description doesn't refuse a restore. Restoring a changed clip throws E_CLIP_CHANGED; a missing one throws
    E_CLIP_MISSING. Both name the clip. `layer()` reads clips as immutable (edit a copy and set it), and `restore()`
    hashes each clip afresh, so a clip edited in place is refused too.
  - **The step.** A fixed-step accumulator: a step is due once the carried time reaches it (to a billionth of a step,
    so 1/120 twice is one 1/60 step). `maxSteps` caps one call. In each step every layer's playhead moves, and the
    events it passes fire in the order they are passed, ties in layer order.
    - A window takes the point it leaves and not the one it reaches, so consecutive windows share an exact boundary.
    - A loop walks cycle by cycle in clip time, so a step covering several cycles fires each event once a cycle,
      backward too. An event at a loop's end is the same moment as its start.
    - A one-shot's end fires once as the playhead reaches it, forward or backward, and is remembered, so turning round
      there doesn't fire it again.
    - A layer at weight 0 fires nothing, except the lowest playing layer, which is taken whole.
    - Each call reports the root's move composed step by step, so a heading crossing ±180° never jumps a turn.
  - **Mixing.** The lowest playing layer is taken whole, as engines treat a base layer. Each layer above blends over it
    by weight and mask (`ops.blend`), or adds its change from its first key (`ops.addDelta`). Root motion mixes the same
    way: each clip's root path on this body, which is its own travel or, for an in-place clip, the path its planted feet
    imply (`contactRoot`, D37). The root's heading is kept within ±180°.
  - **The pose** is presentation only and never feeds back. Full detail (`lod` 0) plants the feet:
    - The layer whose clip most decides the legs (its share after the layers above) lends its contacts and root path,
      anchored where the Animator's root stands.
    - At its playhead the mixed pose stands in for its clip's.
    - Then the ground, hand targets, and the solve.
    `lod` 1 solves the mixed key alone, lifted onto the floor. `{ exact: true }` is full detail whatever `lod` says.
    Every path runs on the portable math, so presentation at full detail and an exact pose agree.
  - **The public API** is `packages/core/src/index.ts`, all of it, one export per statement with a doc comment: 38
    names. The everyday ones are top-level: the Animator and its types, `bind`, `solve`, `forward`, `recognize`,
    `parseClip`, `serialize`, `validate`, `measureFacts`, and the core types. Each module's whole surface is one
    namespace (`math`, `format`, `clip`, `ops`, `skeleton`, `solver`, `contact`, `validation`, `animator`). The
    doctrine's boundary check counts the names (at most 40 for core) and fails a bare `export *` or an export with no
    doc comment. Tools and the conformance tests use the namespaces. Core's own tests reach the modules through a
    test-only barrel (`packages/core/test/all.ts`).
- **Result:**
  - A 480-iteration script: a walk crossfaded into a jog, a masked punch, an additive flinch, speed changes and
    backward play, irregular dt on a slope.
  - It gives the same state hash after every step, the same 29 events and the same exact-mode joints at 5 points, bit
    for bit, in Node and headless Chromium (`npm run e2e -- animator-parity`). That holds with presentation poses
    skipped, taken every step, or alternating between full detail and `lod` 1.
  - Saving after any of the 480 iterations and restoring into a new Animator through JSON gives the next 40
    iterations' hashes, events and exact poses unchanged.
  - Planted feet hold within 10 mm per contact while the Animator walks.
- **Cost** (the 4-core cloud container, Node 24, one character, four layers: walk, jog at 0.5, masked punch, additive
  flinch): `step()` 1.4 µs; `pose()` 0.20 ms at full detail (0.22 ms exact, 0.17 ms at `lod` 1), most of it the
  solve. Sixty characters posed every frame at 60 Hz take about 0.7 of one core.
- **Review:** the G2 verifier found 7 failures, all fixed in v0.12.1:
  1. loop seam events fired twice backward and were lost across several cycles in one step;
  2. a one-shot's end fired again when the playhead turned round there;
  3. a −0 in the state broke the hash after JSON;
  4. a clip edited in place escaped E_CLIP_CHANGED;
  5. the body wasn't in the save;
  6. each call's turn jumped 360° across ±180°;
  7. WP-2.6's entry lacked its "Landed with" line.

  Each has a test that fails on v0.12.0. The Animator's script now also passes the loops' seams backward and turns
  the punch round at its end. `npm run test:cross-engine` runs the script in JavaScriptCore (Bun) as well: the same
  hash as V8. Its notes not acted on are F3.
- **Outside WP-2.6's Owns** (one agent, D21): the boundary check's API rule and its tests; the tools, conformance
  tests and other packages' entries moved onto the namespaced API; core's test barrel; the cross-engine check's
  Animator run.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.12.0; the review's fixes in v0.12.1

## D39 · 2026-10-11 · The raster draws body points as lit capsules, z-buffered, the left side blue

- **Principle:** 5, 6, 9, WP-3.1
- **Call:**
  - The mannequin is drawn on the 36 body points, as a solve on the reference body places its joints (within 0.002
    mm, D36), so any clip draws without a skeleton. Its parts and radii are my-3d2dge's `Mocap.Mannequin`, scaled by
    the thigh's length.
  - Each capsule is a lit tube with a dark rim, written per pixel through a depth buffer over the parts' box. The
    origin sorted whole parts by depth; per-pixel depth shows an arm through the torso as one (WP-3.3's
    self-intersection, WP-3.6's planted defect).
  - The body's left side is blue and its right and middle amber, and a red nose sticks out of the face along the
    head's forward, so sides and facing read in any view, mirrored as each view sees them. The front view shows the
    body's right on the image's left.
  - Views are orthographic at an azimuth and elevation (front, side from the right, back, top with forward up,
    three-quarter at 45° and 20°), using core's portable trigonometry. `fit` frames many poses at one scale for
    sheets.
  - Whole pixels, no smoothing: the same input gives the same bytes in any run and engine. PNG encoding takes its
    compressor as an argument, so the raster runs in a browser; `@m3a/sensors/node` passes node:zlib's (level 9).
  - The font is 5 × 7, written as pictures in the source. Lower case is drawn in capitals, and an unknown character
    as a box.
- **Result:** the five views and a six-azimuth turntable give the same PNG bytes in two runs and in a second process. A
  1,000 × 1,000 three-quarter view renders in 9.5 ms (the budget is 50). The left fist reads blue, and in the mirrored
  pose the right fist reads amber. A NaN pose draws nothing, and the non-blank check names it.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.13.0

## D40 · 2026-10-11 · Sheets are sized to a token budget and compared on one camera

- **Principle:** 4, 5, WP-3.2
- **Call:**
  - A sheet's cost is stated as width × height / 750 tokens (1,334 for 1,000 × 1,000), and every sheet carries its
    size and cost. Cells shrink from the widest the width allows until the image is within the budget (1,400 tokens by
    default), so a dense sheet never costs more than it says.
  - Every cell of a sheet is drawn at one scale and centre, fitted over all its frames and the feet's trails. A loop's
    sheet draws its cycle without the repeated end, and a one-shot's runs from start to end.
  - Overlays:
    - planted feet as diamonds on the floor under the sole, in the side's dark colour, drawn over the body so the foot
      can't hide them;
    - each foot's trail on the floor;
    - flagged times framed in red;
    - a timeline with each foot's contacts on its own lane, the flags in red, and the frames as ticks.
  - A diff is three rows (A, B, and A dimmed with every changed pixel magenta, the changed region boxed in red), or
    the marked row alone. `compareClips` draws both sheets at the same times, under one title and on one camera
    fitted over both, so only the motion can differ.
- **Result:** the 2 s clips' sheets are 1,000 × 404 (539 tokens); 41 frames at a 1,000-token budget fit. A diff of
  identical clips is empty. An edit to one key's right arm is marked in exactly the frames between its neighbouring
  keys, and the box holds the edited elbow and fist.
- **Revised at G3 (v0.19.0):** a diff stacks three sheets, so the budget was each sheet's and the image ran over it
  (the default diff 1,627 tokens against 1,400): each sheet now takes a third of the budget (the marked row alone all
  of it), smaller until the stacked image fits. Every cell is checked for a drawn body, not only the whole image (the
  floor, labels and timeline always draw): a sheet whose frames draw none throws, naming them.
- **Revised at G3's second review (v0.19.1):** after 20 tries `compareClips` returned a diff over its budget, unsaid;
  it throws now, with the smallest it came to. A sheet with some frames blank (one key not a number) is tested too.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.14.0; revised at G3 in v0.19.0 and v0.19.1

## D41 · 2026-10-11 · The metrics read sampled points and the key grid; thresholds come from capture; a flip's swing is the flip

- **Principle:** 4, 5, 9, WP-3.3
- **Call:**
  - **One motion for every metric.** A clip is sampled at 60 Hz on its rest, and its keys are decoded as they are (the
    key grid). Where the root stands in the world comes from the clip's own travel (added as a place: the clip-space
    pose already carries its heading, spec/MOTION.md §5.3), or, for an in-place loop that steps (a foot lifts and
    lands in the cycle), from a treadmill at its measured speed. An in-place one-shot, or a loop whose feet never
    lift, stands still. Captured points (frames at a rate) are read the same way, their samples their grid, so a baked
    or imported motion is measured like a clip.
  - **Where an end stands is measured, not taken from the clip or core.** Core's contacts ask a planted foot to be
    still (core plants feet, so it needs where they stay), which leaves a sliding foot unplanted and its slide
    unmeasured. Here an end stands while its lowest point is within 4% of H0 of the floor (it lifts past 7%) and it
    is slower than half an H0 a second in the world, or carried along with the pelvis within a tenth of one (a glide
    or a dragged foot, however fast). A walk's swinging foot skims the floor at two to four times the walking speed,
    and in big strides lower than the band, so height alone reads swings as stances; the pelvis rule keeps a foot
    that slides with the body. The predicates' "planted" and "free" read the same stance.
  - **Fourteen metrics, each finding with its times and a repair:**
    - foot slide: each contact's drift from where it landed, summed step by step at its lowest sole point, so a
      heel-to-toe roll drifts nothing and marker noise cancels (a path length added it up: 6 s of standing read
      400 mm); skate, a contact's slide over its time in cm/s, for contacts of at least 0.25 s;
    - sole penetration (the heel's sole point turned with the foot, so a foot lying toes up has its heel behind the
      ankle; the finding names the foot) and body penetration;
    - self-intersection: a forearm or hand in the torso, an upper arm in the torso below the shoulders, a lower leg in
      the other, as the mannequin's capsules;
    - the key grid is the keys as played: those up to the end, and the pose at the end where the last of them falls
      short of it (a key past the end shapes only that stretch; read as a key, a 9 ms gap read as a 2.9 m/s pop: D44);
    - jitter, on the key grid: the median over 5 keys of the smaller of consecutive opposite second differences (the
      smaller, so a key out of place doesn't lift its neighbours: WP-3.6, D43). In-betweens are straight lines, so on
      60 Hz samples of 30 fps keys two consecutive samples never both bend, and a shake at the key rate read 0;
    - pops, on the key grid: my-3d2dge's rule, a step over 2.5 times the larger of its neighbours, or a pair out and
      back against the steps either side of it; one finding per body part and stretch of keys;
    - twist flips: a limb's twist, a hand's roll or a foot's heading jumping between keys. Where the reference is
      undefined (a straight limb, a foot pointing straight down) the jump counts at any spacing; elsewhere its rate,
      as the turn in 0.1 s;
    - knee and neck limits, the head read with its lean within ±90° (§6.3's second reading is the same pose);
    - bone stretch;
    - loop seam, pose and velocity;
    - the import's recorded fit;
    - non-numbers;
    - events;
    - symmetry against a mirrored pair, leaving out format 1's placeholder index and pinky.
  - **Thresholds come from capture.** CMU and STYLE100 (158 clips) are the real motion. Warn sits at capture's p95
    (jitter's at p90) and fail at its maximum (jitter's at p99), except where capture itself carries the encoding's
    flips (twist flips, by meaning). Each threshold records its unit, sample rate (0 for the key grid), whether it
    scales with hip height (× H0 / 950), and its reason with capture's numbers (`thresholds.ts`): slide 52 mm at the
    median, 145 at p95, 229 at most; skate 5.7, 18, 38 cm/s; jitter 5.5, 26 (p90), 90 (p99) mm; pops 0.63, 2.1, 3.6
    m/s. Keyed sets exceed capture often: pops up to 37 m/s, soles 660 mm under the floor. That is what they are.
  - **A flip's swing is the flip.** Where a foot points down, the data's heading jumps and the toes swing. The jitter
    and pops on the points a flip swings (a heading the ball and toes; a twist its middle joint and what hangs off it,
    not the end it aims at), within its key interval, fold into the twist-flip finding, which takes their worst level
    and names them; a limb read as straight (under 20°) still swings a little, so its flips fold too (D43). The report
    keeps the folded findings (`folded`), and the predicate "no pop" reads them.
  - **Elbows aren't limit-checked.** A format-1 arm has no hand frame, and its twist's reference isn't anatomical with
    the arm raised. Capture would read elbows "bending backwards" in reaches.
  - **Tag profiles** turn off what doesn't apply:
    - acrobatics (dodge, climb, getup; flips, cartwheels, tumbles, handstands and rolls by name, not a dance's body
      roll): body on the floor, curling;
    - lying (death, lie, crawl): body on the floor, sliding, curling;
    - sliding (slide: a feet-first slide): sliding, body on the floor;
    - swimming (swim, fly): the floor;
    - sitting (sit, vehicle): body on the floor, curling.
  - **The report** is the values, the findings and the folded findings, plus a verdict of at most 20 lines, failures
    first.
  - **Predicates** have six forms: planted (with a slide bound), free, within frames of an event or the strike, a
    point above or below a height, any metric compared (in its unit or one that converts: mm, cm, m; mm/s, cm/s, m/s,
    km/h; another unit doesn't parse), and "no" a metric. Intervals run forward. A failed predicate's repair names the
    times and the change.
  - **`npm run qa`** measures the library, writes every clip's verdict, values and findings to
    `check-output/qa/clips.json`, and with `--dist` prints each metric's distribution in capture and in all; T2 runs
    it.
- **Review** (the verifier, 12 findings, all fixed in v0.15.1, each by a fixture that fails on the old code): slide
  missed root-motion skating (its contacts were core's, gated on world speed); `world()` turned clip-space points by
  the yaw a second time; jitter couldn't see a shake at the key rate; the pop rule flagged smooth fast motion (a
  0.2 s jab); folding hid independent defects (a head's shake behind a foot's flip) and lowered the verdict; flips over
  keys more than 0.1 s apart were never judged; the neck limit misread the head's second reading; the heel straight
  under the ankle put lying feet under the floor; predicates ignored their units, trusted contact labels and accepted
  backward intervals; 19 of 31 mutants survived the fixtures (all 48 now fail them); `--dist` printed nothing and
  `--json` overwrote the clips' rows; PROGRESS and the WP entry lagged. Not changed: capture's knee-limit hits just
  past the 20° bend gate (Chop_Wood: bend 21, twist 185) stay findings; a knee bent 21° pointing backwards is one.
- **Result:**
  - The whole migrated library is measured in 5.6 s within T2: 267 pass, 104 warn, 154 fail (after D43). The fails
    are mostly twist flips (92 clips; the encoding's, F2.4), jitter (45) and pops (25, keyed snaps).
  - Every metric and predicate has a unit fixture: a defect found at its times, and nothing on the clean motion.
    Mutating the metrics 50 ways (each rule removed or inverted) fails the fixtures every time.
- **Known limit:** a body gliding faster than half an H0 a second with its feet still on it is measured only through
  the pelvis rule; a foot dragged at a different speed from the body and faster than that reads as a swing.
- **Outside WP-3.3's Owns** (one agent, D21): names on the raster's capsules; T2's runner; the boundary check's
  import scanner, which read `import's` inside a string as an import.
- **Revised at G3 (v0.19.0):** a predicate whose interval starts after the clip ends was judged at its last sample (a
  foot "planted 50–60 s" in a 2.5 s clip passed): it is refused with a PredicateError naming the clip's end. `npm run
  qa` names the metrics that fail most on its verdicts line (they were only in `--json`), and `--fix` runs lint and fix
  over the library (D44). The fit finding's repair no longer names re-fit, which only drops keys: it says to import
  again.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.15.0; revised after review in v0.15.1 and at G3 in v0.19.0

## D42 · 2026-10-11 · Describe reads phases by rule from postures, steps and holds; the ground truth reviewed first

- **Principle:** 4, 5, 9, WP-3.4
- **Call:**
  - **Phases by rule, from a fixed vocabulary** (stand, walk, run, crouch, sit, lie, air; `describe-truth.json`), so
    the same clip always reads the same. Each sample's posture comes from the body's numbers:
    - air: no part of the mannequin's surface within 6% of hip height of the floor;
    - lie: the trunk more than 60° from upright and low (the pelvis under 60% of its rest height, the neck under 45%
      of hip height: a three-point landing leans as far with its neck well up);
    - sit: the trunk upright, on the floor or seated back with the thighs level;
    - crouch: the pelvis under 80% of its rest height; stand otherwise.
  - **The pelvis, not the centre of mass.** The plan names the centre of mass; balance waits for WP-D.4, and the
    pelvis's height against its rest is what the phases need (the WP entry is edited).
  - **Gaits from steps:** three or more landings, the feet in turn, each within 1.5 s of the last, the body upright.
    A foot lands where it comes down and stays 0.08 s, read two ways: where it stands as the metrics measure it (a
    sneaking step skims the floor) and where it is down by height alone (an in-place loop without a treadmill slides
    its planted foot back faster than a stance). A foot down from the clip's start, or for a whole loop, hasn't
    landed. Within a gait, a flight under 0.4 s is a running stride (a jog in place floats 0.27 s); longer is a leap.
  - **Phases hold.** A phase lasts 0.15 s. A stand, crouch or sit is one only where the pelvis holds for 0.2 s, or a
    crouch where it bottoms out (down into it and up out of it: a landing's crouch, not a pass on the way into a seat).
    A pose at the clip's start or end counts from 0.1 s (air from 0.05 s: a clip that opens falling). Anything else is
    a transition and joins the phase it leads into.
  - **Moments:** landings (on a foot, the back, the front, or seated), strikes by limb, the clip's events; travel in
    hip heights. The text is at most 150 tokens; `detail` adds every moment and each phase's particulars.
- **The ground truth, reviewed before use:** a verifier checked the 30 labels against side sheets and the body's
  numbers. It agreed with 23 and corrected 2: Death_C is thrown through the air before it lands; Jump_Land starts at its
  impact and is never airborne. 4 were dropped as undecidable under the vocabulary: two in-place jump poses with a leg
  through the floor, an upright two-knee kneel, a run-up whose flights are within capture's noise. 3 more were dropped
  as near-duplicates of clips kept. It labelled 7 replacements, each a different motion, by eye and by numbers. Its
  rules are in the vocabulary: stepping beats height; one repositioning step is not walk; moving into or out of a
  seat is not crouch, but a crouch held about 0.25 s is; an opening pose counts only if held; kneeling is undefined.
- **Result:** 30 of 30 clips name the right phases in the right order (the bar is 27). Every clip's text is the same
  every run, at most 91 tokens over the whole library (525 clips described in 5.7 s). Outside the 30, the rules read
  sensibly: the other rig's Jump_Land is crouch then stand; Backflip is stand, crouch, air, crouch, stand; the
  undecidable ones read as walk (Run_Jump_Over's run-up) and sit (Death_A's kneel).
- **Outside WP-3.4's Owns** (one agent, D21): the metrics' `stance` reads by height alone on request; the sensors
  index exports `describe`.
- **Revised at G3 (v0.19.0):** "150 tokens" was a 600-character cap, about twice that in tokens on a long clip, and it
  dropped later phases unmarked: the text is now held to 150 tokens as `tokenCount` counts them (a word every six
  letters, a number every three digits, a space before a number and any other mark one each: never under the cl100k
  count on any library clip), and the items it drops are counted ("… 12 more to 35.80 s").
- **Revised at G3's second review (v0.19.1):** the 91 tokens above, and the test's count, were o200k's (the tokenizer
  package's default), not cl100k's: cl100k counts 94. The tests now hold `tokenCount` at or above both counts on every
  library clip's text, and a long clip's text to 150 tokens by either.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.16.0; revised at G3 in v0.19.0 and v0.19.1

## D43 · 2026-10-11 · Planted defects: ten kinds in 100 clean clips, each found where it was planted

- **Principle:** 4, 5, 9, WP-3.6
- **Call:**
  - **`tools/plant`** plants ten defects, each a pure function of a clean clip and a seed, with the metric that must
    find it and its times (`fits` says where a defect can show: a seam needs a loop, a sink a sole on the floor, a pair
    an asymmetric motion, and no clip whose profile turns the metric off). Keys are edited where the defect lives in
    keys, at millisecond times as the format keeps them; a stretched bone lives only in baked points.
    - **slide:** the foot dragged outward over its longest stance (as the sensors measure it), at 0.4 hip heights a
      second and at most 250 mm, so it stays on the floor and slower than a swing, then eased back in the air. Found by
      its slide (mm) or its skate (cm/s), whichever it reaches. Not planted in an in-place loop that steps: its
      treadmill is set by its feet (D41), so a dragged foot moves the ground in part (Walk_Backwards_Loop: 220 mm
      dragged read 127).
    - **sink:** the body lowered 150 mm under the floor where a sole is on it, eased in and out over 0.25 s.
    - **arm through the torso:** the right arm aimed through the belly, eased in and out over 0.3 s.
    - **pop:** one key out of place (the left arm turned 45°), keys 1/60 s either side holding the clean pose.
    - **twist flip:** the left knee's twist jumps 170° in one 1/30 s interval and stays.
    - **seam:** the right arm drifting up and out over a loop's last 0.3 s.
    - **stretch:** baked points, the right shin 6% longer for 0.25 s.
    - **nan, events out of order, a pair mirrored on the wrong side** (the clip given as its own mirror).
  - **`npm test -- planted`** plants each of the 100 runs in `fixtures/planted/runs.json` again (the times must match
    the fixture's), measures it and the clean clip the same way, and counts a finding the clean clip lacks, of another
    metric, as a consequence the defect implies (a flipped bent knee bends backwards; a sunk body takes its knees and
    hands under the floor; a defect that lasts to a loop's end breaks its seam) or a false positive.
  - **What planting found in the metrics** (fixed, with fixtures that fail on the old rule):
    - jitter's back-and-forth took the geometric mean of two opposite bends, so one key out of place beside a fast
      motion's ordinary bends read as a shake on its neighbours: it takes the smaller now (capture: 5.5, 26 at p90,
      90 at p99; warn 26, fail 90);
    - a flip at a limb read as straight (bent under 20°) folded nothing, but a knee bent 19° swings: every flip folds;
    - the plants themselves: a key added beside a millisecond-rounded one (0.3 ms apart) made a bend of its own; the
      seam and slide plants snapped back (a pop); edits that reach `dur` left the key past it untouched.
- **Result:** 100 of 100 planted defects flagged by their metric at their times. 14 runs show a consequence the defect
  implies. False positives in 4 runs of 100 (4%; 3 before WP-3.5 put the slide plant's keys on the 1/30 s grid): a
  knee left pointing backwards by a flip that then reads as shaking (twistFlip → jitter, twice in one run), a fast
  throw's ordinary bends beside the planted pop (pop → jitter), a stretched shin that lowers a foot below the floor band
  so a small step merges two stances into a slide (stretch → slide), and in-between keys the slide plant adds letting
  a format-1 pinky point read 28 mm of shake, just over its warn (slide → jitter).
- **Revised in WP-3.5 (D44):** a plant's new key within 5 ms of a clip's own is that key (two keys a millisecond apart
  read as a snap to the fix operators), and the slide plant keys its drag on the 1/30 s grid.
- **Outside WP-3.6's Owns** (one agent, D21): the jitter and folding fixes in `metrics/` (WP-3.3's), with their
  fixtures and threshold.
- **Revised at G3 (v0.19.0):** the slide runs all lay on stances from the clip's start (10 of 11 standing clips whose
  stance is the whole clip), so a slide found at any time passed as found at its time. Now:
  - a slide is planted on the longest stance of at least 0.45 s that starts and ends within the clip with the foot
    still (its ankle within 40 mm: a foot pivoting through a turn, dragged too, moves faster than a stance), its
    ankle, ball and toes moved along the floor and its leg re-aimed at them (its twist kept), the way that keeps the
    ankle within the leg's reach; only 9 clean clips have one, and each takes a slide;
  - the runs take the defects in turn, each the first clean clip left that can show it (about 10 each);
  - a finding counts only within its planted stretch: a slide within 0.1 s of its stance, the others within the
    0.35 s the plants ease over;
  - every key a plant adds or edits is tidied (whole numbers within their ranges), so a planted clip validates (the
    Bear slide carried 2,754 non-whole numbers), and plants key their edits every 0.1 s, skipping a time within
    0.05 s of the clip's own key (rounded keys every 1/30 s read as a shake; two keys 9 ms apart, as a pop).

  100 of 100 found within their stretches; 11 runs show a consequence the defect implies; false positives in 3 runs
  (3%): a flipped knee read as shaking (twistFlip → jitter, twice in one run), a pinky beside a slide and one beside a
  pop just over jitter's warn.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.17.0; revised at G3 in v0.19.0

## D44 · 2026-10-11 · Lint and fix: six operators on keys, each measured before and after, nothing changed silently

- **Principle:** 4, 5, 9, WP-3.5
- **Call:**
  - **`fix(clip, R)`** runs the operators lint names (or those asked for, or operators of one's own) in a fixed order:
    twist flips (a flip's swing first), jitter and pops, penetration, foot locks, the seam, re-fit. Each runs on the
    clip the one before left, with the metrics before and after it and a line for every change. They edit keys only,
    at millisecond times and in whole numbers, as the format keeps them; a new key within 5 ms of the clip's own is
    that key.
  - **Nothing changes silently.** After each operator, `dur`, the events and the contacts are compared with what they
    were and any that moved is reported with its changes (an operator of one's own that moves them is reported too);
    when anything changed, stored facts are measured again and what they say differently is reported.
  - **The operators:**
    - **twist flips:** whole turns out first (they move nothing); where the reference is undefined around the jump (a
      straight limb, a foot pointing down) the change is spread over that stretch's keys, where nothing shows it;
      elsewhere the jump is undone from that key on (a knee flipped mid-bend points back the way it pointed);
    - **jitter and pops:** the keys of the part the finding is on (then the torso's, then every pose field, if those
      don't carry it) are smoothed by time, two keys either side: a key far outside its neighbours takes their
      in-between; for a shake every key moves halfway to it;
    - **penetration:** the body is raised by the deepest sole's depth along the lowest curve over it that changes by at
      most 0.75 H0 a second (a body rising from a crouch moves about that fast), so it follows a sink as it came and a
      foot stepping up out of a sunk floor rises with the body; a standing foot left off the floor, or still under it,
      is moved straight onto it by its leg, eased over 0.1 s;
    - **foot locks:** each sliding contact (or every one) is held still where it landed with its sole on the floor by
      core's planting, written into keys on the 1/30 s grid and the clip's own; the foot stays planted through a 0.3 s
      release and eases back to the clip's pose; a loop's contact runs through its seam;
    - **the seam:** what the last pose differs from the first, and that field's speed difference, is spread over the
      cycle's ends along Hermite curves (half each side, a quarter of the cycle, at most 0.5 s), so the poses meet at
      the same speed. The plan said over the cycle (my-3d2dge's way, for captured frames): spread over the whole cycle,
      a drift at the end tilts every key (an arm raised at the end swung into the chest mid-cycle), so the WP entry is
      edited;
    - **re-fit:** Ramer–Douglas–Peucker over the decoded key poses, in-betweened as the format does, within 5 mm (or
      the tolerance that fits `maxKeys`); the first and last keys stay.
  - **`lint(clip, R)`** lists the operators the metrics' findings call for (slide or skate: foot locks; penetration;
    seam; jitter or pop; twist flips; keys denser than 30 a second: re-fit), with the findings, in at most 20 lines.
  - **What fixing found in the sensors:** the key grid read a key past the end as played (D41: now the keys as played);
    the plant tool's keys could fall a millisecond from a clip's own (D43).
- **Result:** every operator removes its planted defect on all of WP-3.6's runs of that kind (footLocks 11 slides,
  penetration 11 sinks, jitter 11 pops, twist flips 9 flips, seam 8 seams), each pushing no other metric past its
  warn level that was under it in the clip as planted and as it was clean. No operator moves `dur`, an event or a
  contact; one of one's own that does is reported. Re-fit keeps an idle's keys every 1/60 s to under a quarter within
  5 mm and holds a budget of 3 keys. Mutating the operators 16 ways fails the tests every time.
- **Outside WP-3.5's Owns** (one agent, D21): the metrics' key grid (D41); the plant tool's keys (D43); the sensors
  index exports `fix`, `lint` and `fixes`.
- **Revised at G3 (v0.19.0):** the verifier ran fix over the library: 72 of 248 fixed clips failed validation
  (in-between keys left fractional, a direction pushed to 101), 8 came out worse (twist flips undone to a loop's end
  opened its seam; foot locks made pops of 8 to 25 m/s), the seam operator added keys to every loop it was run on
  while reporting nothing, a loop meeting in pose but not in speed was neither linted nor repaired, and re-fit's
  tolerance left out the root's travel and turn. Seven mutants survived the tests. Now:
  - **nothing pushed past a level:** a step that would push any metric past a level (warn or fail) it was under is not
    applied, and the step says which (`rejected`; widened in v0.19.1, below);
  - **valid keys:** every key an operator adds or edits is tidied: its time to the millisecond, its numbers whole and
    within their ranges, a direction an edit took past ±100 scaled back (keys it left alone stay exactly as they were);
  - **sparser edits:** edits are keyed every 0.1 s (a time within 0.05 s of the clip's own key edits that key): an
    added key is rounded, and keyed every 1/30 s its rounding steps read as a shake;
  - **twist flips** in a loop undo a jump only until it jumps back, or ease the undoing out over the rest of the cycle
    (or in over its start), so the cycle still closes; a re-aimed limb keeps its own twist;
  - **penetration** reads each key's depth from its own pose, rounds the lift curve's corners, and sets on the floor
    only a foot standing still (under 0.2 H0 a second: a landing foot isn't);
  - **the seam** reads the ends before adding any key (a closed seam gets none), matches a speed change only where it
    stands out from the clip's own (over 3 times the median change at its keys), and where the metrics find the
    seam's speeds changing, matches the speeds of fields whose poses meet; lint names it for `seamVelocity` too;
  - **re-fit** measures the root's travel and turn with the pose;
  - **fix** throws for a name that isn't an operator, naming the closest.

  Every operator removes its planted defect on all of WP-3.6's revised runs of its kind (footLocks 9 slides,
  penetration 11 sinks, jitter 10 pops, twist flips 10 flips, seam 10 seams) and each fixed clip validates. Over the
  library (`npm run qa -- --fix`, in G3's command set): 252 clips linted, 147 better, 105 as they were or with fewer
  findings, none worse or invalid; 75 of 399 steps were not applied, mostly edits that move a foot under the floor
  (undoing a leg's flip or smoothing a leg). 14 mutants, the verifier's 7 among them, each fail the tests: contacts not
  compared, no spread at a straight limb, feet not set after a lift, no whole turns, lint blind to skate, to the seam
  or to flips, the guard off, a loop's flip undone to its end, speeds never matched, re-fit blind to the root, the seam
  adding keys silently, no tidying, an unknown name ignored.
- **Revised at G3's second review (v0.19.1):** a second verifier ran the reworked operators over the library and
  mutated them again. Five findings, all fixed:
  - **twist flips spread a heading winding nearly a whole turn the long way** (99 spreads over the library; a walk's
    foot turned 310° where 50° would do, and the guard let it through within its level): the spread now takes the
    whole turns across its stretch out first, from the stretch's far end on;
  - **"nothing gets worse" held only for levels:** applied steps raised metrics within their level (19 clips more than
    5%, some on the very metric the step answered) and added findings (3 clips). A step is now not applied when it
    pushes a metric past a level it was under, raises one already at warn or past it by more than 5%, adds findings,
    or (an operator answering metrics) lowers none of those it answers that were found; `worse` says which. `qa --fix`
    counts a clip with more findings as worse, and its summary is in the gate's line;
  - **foot locks still made pops** (with every contact locked over the library, 231 steps refused, 214 for pops) and
    changed an in-place loop's treadmill. Both legs were encoded again from the planted points mixed over every lock,
    so a leg no lock held moved too. Now each lock aims only its own side's leg and foot at the points mixed by its
    weight, the leg's own twist kept, and the pelvis lowers by the deepest lock's share; an in-place loop that
    steps is not locked (the step says why: its feet set its treadmill, D41). With every contact locked over the
    library: 267 clips locked, 73 refused (37 naming pops, 57 more findings), 150 in-place loops left, 35 with
    nothing to lock;
  - **21 of the verifier's mutants survived the tests** (11 of them the gate's `qa --fix` too). With 6 more for this
    revision's own changes, each now fails a targeted case: the guard's levels, its 5% rise, its findings and the answered metrics; the seam's 3 times the
    median and its quarter cycle; penetration's depth per key, its slope and its rounded corners; a loop's flip that
    jumps back; whole turns in a spread; the 5 ms key; tidy's yaw, zero direction, scaling and clamping; jitter's
    escalation to the torso and its halving of a shake (a key out of place alone takes its neighbours' in-between,
    one among neighbours that leap too is a shake); re-fit's turn and sideways travel; foot locks' `allContacts` and
    treadmill; `fixAll`'s validation and `worse`; a sheet with some frames blank; a predicate starting just after the
    clip; a diff over its budget (D40). 27 of 27 fail the tests;
  - **the rejected steps were described wrongly** ("mostly edits that move a foot under the floor"); restated below.

  Over the library (`npm run qa -- --fix`): 252 clips linted, 144 with a better verdict, 53 with fewer findings, 55
  as they were, none worse or invalid. Of 456 steps, 12 didn't run (foot locks on in-place loops) and 114 were not
  applied: by operator jitter 45, twist flips 40, penetration 14, the seam 8, foot locks 7; naming jitter in 40, pops
  in 33, penetration in 28, more findings in 21, and skate, the seam's speeds, joint limits, the seam, intersection,
  slide or a twist flip in 4 or fewer each.
- **Revised in WP-4.5 (D49):** foot locks bake core's planting with `settle: false`, the body keeping its height as
  before planting lifted and lowered it.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.18.0; reworked at G3 in v0.19.0, revised in v0.19.1

## D45 · 2026-10-11 · three.js pinned at r182: the release fresh agents write that runs on both backends here

- **Principle:** 1, 9, WP-4.1
- **Call:**
  - **The cold-write check:** two fresh agents, given no docs and writing from memory, each wrote a skinned-character scene
    (load the Khronos Fox glTF, play a clip, crossfade) for one candidate, r182 (the owner's prior pin) or r186 (the
    latest, 0.186.1). Run unedited in headless Chromium 141: both draw and crossfade on the forced WebGL 2 backend;
    on WebGPU r182 runs and r186 fails at `renderer.init()`, its texture views carrying a `swizzle` this Chromium
    rejects (my-3dge met the same). Both agents wrote their release's idioms correctly, so the choice turns on what
    runs: **r182**, `three@0.182.0` exactly, a peer dependency of `@m3a/three` (the game brings its three, as the
    package's header says), installed here as a dev dependency.
  - **The other candidate in CI:** `tests/e2e/three.e2e.ts` repeats the check on a character built in code (a skinned
    arm through `GLTFExporter` and `GLTFLoader`, a clip, a crossfade) and is part of `npm run e2e`; CI's `three-next`
    job runs it on r186 through `M3A_THREE_DIR`, asserting WebGL 2 and reporting WebGPU. WebGPU is asserted where the
    browser has an adapter (here, SwiftShader's Vulkan); without one, `WebGPURenderer` falls back to WebGL 2, which the
    other test checks.
  - **The banned APIs** in `tools/doctrine/banned-three.json`, with the pin: `ShaderMaterial` and
    `RawShaderMaterial`, `onBeforeCompile`, `EffectComposer` with `ShaderPass` and the `postprocessing/` addons,
    `WebGLRenderer`, raw GLSL, `renderAsync()` (deprecated in r181) and `RenderPipeline` (r183's name for
    `PostProcessing`). `npm run doctrine` fails on a use and on the package or lockfile leaving the pin.
  - **Types later:** `@types/three@0.182.0` brings 7 packages (Rapier's among them) and nothing imports three from
    TypeScript yet; it is pinned with the first module that does (WP-4.2's tests).
  - **Found on the way:** r182's `three.webgpu.js` reads `GPUShaderStage` as it loads, and WebGPU's interfaces exist
    only in a secure context, so on a plain `http:` host other than localhost the module fails to load at all,
    WebGL 2 included. Pages are served from `localhost` or `https:` (docs/THREE.md).
- **Result:** the test passes on r182 on both backends (the frame drawn, moving, the crossfade ending on its clip, no
  warning) and on r186 on WebGL 2, its WebGPU start failing as in the check. Doctrine finds each banned API in a
  fixture and a pin moved in the package or the lockfile.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.20.0

## D46 · 2026-10-11 · Test characters generated in code, and real CC0 rigs fetched by hash

- **Principle:** 1, 4, 9, WP-4.2
- **Call:**
  - **Generated characters** (`packages/three/test-characters/`): a skinned humanoid written as GLB in memory by its
    own small writer (three's `GLTFExporter` needs a browser's `FileReader` for binary output), its body a tube per
    bone skinned to it and blended half into the next at the joint. A seed fixes it: `variant(seed)` picks the build
    (chibi, heroic, bulky, child, tall and thin), the rest pose (T, A at 40°, relaxed at 70°), the naming (VRM, Mixamo,
    UE5, Rigify), twist bones and the optional bones left out (upper chest, chest, neck, shoulders, toes), and its
    lengths vary ±4% by seed. Each naming brings its family's habits, where real rigs differ: Mixamo's centimetres
    under the armature's 0.01 scale, UE5's root bone and five spine bones, Rigify's twist bones in the chain
    (`DEF-upper_arm.L.001` between the upper arm and the forearm) and `DEF-spine.005`; bone frames along the bone
    (Blender's, Mixamo's, UE5's) or the world's (VRM 1.0's normalized humanoid). Seeds 0 to 19 are the test set,
    chosen so every build, rest pose and naming shows and each naming with and without twist bones; any other seed is
    a held-out character.
  - **Real rigs** (`tools/fixtures/rigs.json`), never committed: Quaternius' mannequins (male and female, from
    my-3d2dge-2 at `c8295dc`: Unreal-style names, meshopt-compressed) and KayKit's Knight (Kay Lousberg's Adventurers
    pack at `672074b`: its own names, 76 clips). KayKit over Kenney: its pack is fetchable file by file at a commit;
    Kenney's come as zips from its site. `npm run fixtures -- fetch` downloads with curl (it honours the proxy, and
    reads `file://` for the tests), keeps a file only if its SHA-256 matches and its license file says CC0, and records
    both in `.cache/fixtures/fetched.json`; `check` reads the cache alone; `--manifest` fetches any other list the same
    way (G4's held-out rig). CI fetches them before T1 and a gate, cached with `.cache`.
  - **Loading in Node:** three's `GLTFLoader` with the meshopt decoder; a GLB's images are dropped first
    (`textures: false`: Node has no image decoder).
- **Result:** the 20 variants load in three.js with their bones where they were generated (under 1 µm) and bound at
  rest (bone times inverse bind within 1e-5 of the identity), each recognized by its naming's table with confidence 1
  and its rest pose read as written; a seed gives the same bytes every run, and seed 1000 is another character
  recognized the same way. The mannequins are recognized by the unreal4 table (confidence 1), the Knight by topology
  (0.85). A rig in a manifest of its own fetches and verifies by its hash; a wrong hash or a license that doesn't say
  CC0 keeps nothing.
- **Outside WP-4.2's Owns** (one agent, D21): `tsconfig.tests.json` checks the test characters; `npm run fixtures`;
  CI's fetch step; `@types/three` in `packages/three/package.json` (its own commit).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.21.0

## D47 · 2026-10-11 · Binding a three.js character: its own space, its own rotations, a report to patch

- **Principle:** 2, 4, 8, WP-4.3
- **Call:**
  - **`bind(root, { mapping? })`** (`@m3a/three`) takes the skinned mesh with the most bones under `root` (or a VRM's
    humanoid, from three-vrm's `userData.vrm`), reads each bone's rest head and orientation in the root's own space
    (its world transform left out, so a character placed anywhere binds the same; metres, any armature scale applied),
    recognizes the skeleton (WP-1.4: by name, else by topology), and binds it with core's `bind` (the rest frame, the
    body measured from the bones), the bones' own rest orientations kept so the solver's rotations are three's.
  - **The report** (at most 20 lines): how the skeleton was read and how sure (confidence), the rest pose read (T, A or
    relaxed, the arms' drop), what is mapped and unmapped, what is missing, the issues, the limb lengths (mm, left and
    right), and a patch: the mapping as `{ bones: { humanoidBone: sourceBone | null } }`, missing bones as null, to edit
    and pass back as `mapping`. A missing required bone throws with the report's text.
  - **Topology, fixed on the way** (core, WP-1.4's, D28 revised): binding every generated character with its bones
    renamed showed the fallback mapping arms one bone off, losing the arms when the head had no neck, and more.
- **Result:** the 20 test characters and a held-out seed bind with no hand mapping, each limb length as generated to the
  millimetre and the rest pose as written; the mannequin and the Knight bind too. A test character with every bone
  renamed binds through topology at confidence 0.85, its lengths right. Renamed, 22 of 24 generated characters map as
  they do by name; the other 2 (Rigify's twist bones in the arm chain) are reported with confidence 0.55. A character
  moved and turned in a scene binds to the same rest points. A missing hand throws with a report naming it and how to
  patch it; the patch, written to a file and read back, binds.
- **Outside WP-4.3's Owns** (one agent, D21): the topology fixes in core's `recognize` (WP-1.4's) with their
  fixtures; `@m3a/three`'s index exports `bind` and its types.
- **Revised in WP-4.5 (v0.23.1):** capturing the Knight showed it bound to its IK controls: its skin lists every bone,
  the controls too (`control-toe-roll`, `kneeIK`, `handIK`), and topology took three chains of them for the legs and
  arms (hips at the root, the arms on the legs: its reported 0.85 hid it). Bind now recognizes only the bones some vertex
  is weighted to, and those above them; the Knight maps each limb to its own bones (T pose, forearm 260 mm), and the
  real rigs' tests check the mapping bone by bone, not only that nothing is missing.
- **Revised in WP-4.5 (D49):** a foot that ends with no child gets an end bone where its mesh ends, on the sole; a
  toe segment of no length has no pitch (a toeless rig measured a NaN rest).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.22.0; revised in v0.23.1

## D48 · 2026-10-11 · Playing and baking on three.js: the solver's rotations as three's, baked densely enough

- **Principle:** 1, 4, 5, WP-4.4
- **Call:**
  - **`attach(animator, bound)`**: each `update(dt)` steps the Animator, poses it and writes the pose: each bone's local
    rotation as the solver gives it (bind passed three's own rest orientations, so they are three's; a bone whose parent
    isn't a bone turned into its parent node's space), the hips placed in their parent's space. Crossfades, masked and
    additive layers are the Animator's. The root's motion is the game's: `root` and `moved` (since the last update), in
    mm and degrees; the character's object isn't moved.
  - **`bake(clip, bound)`**: a THREE.AnimationClip of quaternion tracks for every bone and a position track for the
    hips, solved from the clip's parameters. A fixed rate isn't enough: halfway between 60 fps samples three's slerp
    strays up to 21 mm from the live solve in a fast punch. The bake samples at the clip's keys and 30 a second, then
    halves each stretch whose middle, as three in-betweens it, is more than 0.5 mm from the live solve (down to 1/3840
    s); the worst measured is recorded with the sample count in `userData.error`. `userData` also carries the clip's
    id, loop, events, contacts and facts, which GLTFExporter writes to the animation's `extras`.
  - **Allocation:** the adapter's write allocates nothing a frame: measured as the heap left after 120,000 frames less
    that after 20,000 (`--expose-gc`). A whole update, core's step and pose included, allocates about 7 KB a frame
    (0.16 ms): core's solver builds its result each time. Making it allocation-free means rewriting the solver's math
    in place, whose bits the hashes hold (D33, D38): not this WP's, so the Done-when is edited to say what is measured,
    and the cost is stated.
  - **VRM:** bind reads three-vrm's humanoid from `userData.vrm` when present; no VRM avatar is in the fixtures yet
    (optional in WP-4.2), so it isn't exercised. VRMA export waits for WP-5.2.
- **Result:** on Mixamo, UE5 and Rigify test characters, Walk_Loop, Punch_Jab, Run_Loop and Jump_2 bake within 0.5 mm
  (53 to 134 samples), and three's AnimationMixer agrees; a masked upper-body punch leaves the legs the walk's, and at
  half weight puts the arm between; a travelling clip's root motion is handed over while the hips stay over the root.
- **Outside WP-4.4's Owns** (one agent, D21): none.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.23.0

## D49 · 2026-10-12 · Headless capture, and a sweep that plays every clip as a game would on every skeleton

- **Principle:** 1, 4, 5, 9, WP-4.5
- **Call:**
  - **Capture** (`@m3a/three/capture`): a bound character played by an Animator and drawn in headless Chromium through
    WebGPURenderer on its WebGL 2 backend (forced: a capture mustn't depend on a GPU), each frame read back from a
    render target (a headless canvas reads blank), with the proof hash of its bone transforms (FNV-1a 64 over each
    bone's position, rotation and scale as float64 bits). A frame is blank when no pixel differs from its top-left
    corner by more than the threshold (the colour pipeline makes an absolute background value unreliable); a blank frame
    or a backend other than the one asked for throws a `CaptureError` (`E_BLANK`, `E_RENDERER`) saying why. The test is
    `tests/e2e/capture.e2e.ts`, not the plan's `capture.spec.ts`: the repo's Playwright runs `*.e2e.ts` (WP-0.2), so
    the WP entry is edited.
  - **The sweep** (`npm run sweep -- <rig ids> [--manifest f] [--sample N] [--clip id] [--min P]`): every migrated clip
    played by core's Animator on each skeleton (bound as WP-4.3 binds, solved in Node), every 1/60 s or so in whole
    fixed steps (a loop's last sample its cycle's end), its feet planted; the sensors (WP-3.3) run on the played body
    points in the world and on the clip on its own body, read the same way. A clip passes on a skeleton when the
    skeleton adds nothing wrong: its data is sound (no non-number, events in order), no metric goes past a level (warn
    or fail) it was under on the clip's own body (each against its own body's levels), and every mapped bone's joint
    is within 5 mm of its body point. The clip's own defects stay the clip's: 29% (154 of 525) of the library fails on its
    own body. Results go to `check-output/sweep/results.json`, a row per clip per skeleton with every reason.
  - **Contacts:** no library clip carries contacts yet (WP-5.4 writes them), so the Animator planted nothing. The
    sweep plays each clip with the contacts `measureFacts` detects on its own body, as WP-5.4 will store them.
- **What the sweep found in the player** (fixed in core and three, outside WP-4.5's Owns, one agent, D21):
  - **planting (revises D37):** a re-solved knee took its pole from the key's twist, which winds round in a few frames
    where a leg is straight, so a foot set on the floor swung the knee 220 mm in a frame: the pole is now the clip's own
    knee, easing into the knee's natural way as the leg straightens. A planted foot's sole was snapped onto the floor
    when its contact began and let go in a frame when it ended; another body's proportions hold a foot 30 to 55 mm off
    the floor, so that was a pop: the setting eases in before a contact and out after it, the body is lifted where a
    sole is under the floor (as the solver lifts a pose it decodes alone) and lowered to a planted foot's float, each
    continuously, so no correction jumps and no leg stretches as a contact eases in. A contact running to a loop's end
    and one starting at its start are one contact through the seam. `PlantOptions.settle` (default true) turns the
    body's lift and settle off: WP-3.5's foot locks bake planting into keys and keep the body's height (D44);
  - **toeless rigs (revises D47):** with no toe bones, SKELETON.md puts the ball and toe at the foot's tip, and a leaf
    bone's tip is read on in its parent's direction: down the shin. The rest then measured a NaN toe pitch, and every
    solve was NaN. A segment of no length now has no pitch, and three's bind gives the bone a foot ends with (its toes,
    or the foot), where it has no child, an end bone at the farthest point of the mesh skinned to it, on the sole (as
    rigs with a LeftToe_End have); the ground is read under that end too. A generated toed character's toe tip, read
    on down the foot's slope, sat 32 mm under the floor; it is now on it.
- **Result:** sheets of two generated characters (one without toe bones) and the two real rigs render headless on
  WebGL 2 in CI (the rigs fetched first), every frame drawn, each frame's pose hash equal to Node's for the same play;
  a blank frame and a WebGPU frame asked of a WebGL 2 capture fail with their codes. The sweep test plays 8 clips on two
  test characters and lists a walk with a non-number pelvis as a failure on both, its reason first. Over the whole
  library (525 clips, about 40 s a skeleton) the sweep passes 80.0% on a chibi, 90.7% heroic, 87.0% bulky without
  toes, 86.1% child, 85.3% tall, 86.3% and 88.2% on the two Quaternius mannequins and 61.9% on KayKit's Knight; the
  reasons by metric: pops 204, skate 166, slide 123, jitter 116, intersection 100, the seam's speed 81, the seam 49,
  body penetration 10. G4 asks 95% on its six skeletons: that is the gate's work. What remains is mostly another body's
  proportions under the same keys (a large foot shakes more; a folded arm's direction is ill-defined, so its elbow
  lands elsewhere on other arm lengths; a kneel's knee goes through a floor its legs can't reach) and slides on
  stances the clip's own contacts don't cover.
- **Outside WP-4.5's Owns** (one agent, D21): core's planting and rest measurement, three's bind, the sensors' foot
  locks (`settle: false`).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.24.0

## D50 · 2026-10-12 · Phase 4 continues on this session's branch; michaelcrosato/my-3danimations#9 is superseded

- **Principle:** process
- **Call:** A new session continues Phase 4. Its branch is `claude/relaxed-albattani-939ofg`, and it may push to no
  other branch. michaelcrosato/my-3danimations#9 was the phase's draft pull request, on `claude/relaxed-albattani-35xhjq`.
  Its two commits (c04014e, CI's WebGPU check on SwiftShader's Vulkan; 5b85094, WP-4.5 done at 0.24.0) were checked here
  before being taken: T0 green in 14.0 s, T1 440 tests in 39.8 s, and T2 9 of 9 with the real rigs (library QA as
  baselined). They are taken unchanged by a fast-forward. The rest of the phase goes to a new draft pull request from
  this branch, and #9 is closed with a link to it, not merged.
- **Why:** a phase's pull request must be one the working session can push to. A fast-forward keeps #9's commits and
  their history, so nothing in it is lost or rewritten. Closing #9, rather than leaving two open pull requests with the
  same commits, leaves one place for the G4 report. Reopening #9 undoes the call.
- **Answered:** no: made without a response, to review (the owner asked this session to review #9 and decide).
- **Landed in:** v0.24.0 (no package change)

## D51 · 2026-10-12 · The sweep, round two: seams on the body, every point by its part, the player fixed where it adds

- **Principle:** 3, 5, 8, G4 (WP-4.5's follow-up)
- **Call:** the six G4 skeletons (gen-0 to gen-3, the Quaternius mannequin, KayKit's Knight) passed 82.0% of their 3,150
  clip-skeleton pairs (D49's sweep, run again here). Each kind of failure was traced to its cause, and fixed where it
  was the reading's or the player's:
  - **The reading** (`tools/sweep`, the sensors):
    - The sweep handed the sensors points in the world, so a walking loop's seam read its whole stride (1.4 m), on its
      own body too. `checks.motionOfFrames` now takes the root's path, the points stay on the root, and seams are read
      on the body.
    - The levels scale by H0, the pelvis's height, which is a poor ruler for a chibi. The Knight's pelvis is 113 mm
      under its hips, and its arms are 2.1 times, and its feet nearly 3 times, a person's of its H0, so its arms'
      speeds read twice as bad as they were. Reading by parts (`Motion.parts`, off by default, so the library reads
      as baselined) reads each point against its chain from the pelvis, compared with a typical person's (the median
      over the library's 33 rests). The sweep reads both bodies that way.
    - A foot the clip drags along the floor too fast to read as standing doesn't count as a slide on its own body, but
      where the played body's settle brings it down it does. The clip's own slide is now read over the stretches the
      played body stands on, where its own foot is down too.
  - **The player** (core's planting):
    - The body settled onto the higher foot's float in 0.05 s. It now eases over 0.2 s (`settleBlend`), from the
      float a foot had as it lifted or toward the one it will land with, so it shifts its weight rather than dropping
      in a frame.
    - The body was lifted after any sole under the floor. Only a standing foot lifts it now: a swinging foot that dips
      under comes up on its own leg, where lifting the body after it bounced it.
    - A re-solved knee took the clip's own knee direction from a 12° bend. Where the planted leg bent further, a nearly
      straight leg's twist turned it round in a frame. It now keeps the clip's knee wherever the new ankle bends the
      leg no further, and eases into the knee's natural way by the clip's offset against the new one.
    - A hold let go of its drift in 0.05 s. It now lets go over 0.2 s (`release`), done before the foot lands again.
    - Under a cross-fade the layer that most decided the legs planted alone, and at half way its anchor changed, so a
      planted ankle jumped up to 462 mm in a step. `contact.plantMix` plants each layer on its own clip and blends
      their corrections by their shares of the legs, and the Animator uses it whenever two layers share them.
    - `ik3` stretched a limb whose end was inside its fold (the Knight's thigh is 227 mm, its shin 149 mm). It now
      folds the limb, its lengths kept. A decoded bend of 180° is unchanged, so the conformance vectors are byte for
      byte.
- **Tried and not kept:**
  - Contacts read by the sensors' stance, or core's stretched to it, gave fewer slides but more pops, and the same
    total (87.7%).
  - A soft lift for a free foot under the floor cost five pops and fixed no slide.
  - A margin on a level's crossing: the median failing metric is 0.79 of a level worse than on the clip's own body,
    and a margin of a quarter of a level moves 87.7% to 89.2%. The failures aren't the reading's edges, so no margin.
- **Result:** 87.7% (2,763 of 3,150). By skeleton: gen-0 (chibi) 84.2%, gen-1 91.4%, gen-2 89.7%, gen-3 87.8%,
  mannequin 88.0%, Knight 85.1% (61.9% before). 362 clips pass on all six. The reasons over the six: skate 106,
  pops 96, slide 79, intersection 58, jitter 57, the seam's speed 44. What remains is mostly another body's
  proportions under the same keys: arms through a torso of another width, knees that turn with a clip's noisy twist
  on longer limbs, getting up and strafing on other feet. G4 asks 95%.
- **Also found:** no run loop in the library passes the sensors on its own body, even after `fix` (their twist flips
  are repaired; the jog's change of speed across its seam stays, as closing it raises pops). WP-5.8 takes it up.
- **Tests:** each fix has a test that the code before it fails (the settle, the knee, a free leg, a cross-fade, the
  fold; root paths and parts in the sensors; seams and like-for-like slides in the sweep).
- **Outside WP-4.5's Owns** (one agent, D21): core's planting, `ik3` and the Animator's pose; the sensors' motion and
  levels.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.25.0

## D52 · 2026-10-12 · The first-flight demo: a lab that plays what passes, repaired at load, its jump and travel the game's

- **Principle:** 1, 2, 3, WP-4.6
- **Call:**
  - `apps/lab/hello` is a lab (dated 2026-10-12, its question in its README). It reaches past `@m3a/three`'s entry
    only for the generated test characters.
  - `game.ts` is the game without a renderer: input → idle, walk or run by speed (cross-faded, each at the rate its
    speed asks), a jump and an attack. Node runs it too, so the e2e test checks the page's hashes against Node's. The
    character travels by the Animator's whole root move (forward, right and turn) along its facing, so a held foot
    stays held where the game puts it. The in-place jump clips leave the height to the game: a ballistic arc from
    take-off to landing.
  - The clips are the library's own, CC0, and repaired at load by the sensors' `fix` (each step kept only if it makes
    the clip better), as a game would do until WP-5.8 writes the repairs back. They were chosen so that each passes
    the sensors on its own body after repair: Idle_Loop, Walk_Loop, Mesh2Motion's jump and Punch_Cross. Quaternius's
    Jump_Start opens with a key 38% of H0 lower than the next, 1/30 s later. The jog has no passing alternative
    (D51). The attack's `hit` is put at the strike time core measures.
  - Deep links `?char=gen-<seed>`, `?clip=SET/Name`, `?t=` (paused there), `?view=`, `?renderer=webgl2`. The handle
    `window.__m3a` has `state()`, `play()`, `step(n, input)`, `hash()` and `points()`, the last placed as the game
    places them. A phone gets a stick and buttons. The stamp shows the version, the commit and the query.
  - `vercel.json` builds it (`npm run hello -- build`) for when O3 is linked. A Vercel project already reports on the
    pull requests, so the preview may build from this commit.
- **Result:** the e2e `hello` builds it with Vite and drives a 13 s session headless on WebGL 2. The page's hashes
  equal Node's after every part, the hit fires and the HUD counts it, and the sensors read every frame it played:
  WARN, no fail (a toe's jitter from the jog's twist, a forearm in the chest during the punch). Six screenshots, a
  deep-linked frame and a contact sheet go to `check-output/hello/`, CI's T2 artifact.
- **The boundaries check:** nothing imports from `apps/`, except now a lab's own e2e test reading its lab
  (`tests/e2e/<lab>.e2e.ts` → `apps/lab/<lab>/`), to run the game in Node beside the page.
- **Outside WP-4.6's Owns** (one agent, D21): `tools/run/hello.ts` (the npm script); `tests/e2e/hello.e2e.ts` (the e2e
  registry is shared); the boundaries check; `apps/**` in `tsconfig.tests.json`; core's `plantMix`, found by this
  demo's sensors (D51).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.25.0

## D53 · 2026-10-12 · The library loader: content ids, a lock that names a changed clip, CC0 unless a game opts in

- **Principle:** 4, 10, 11, WP-5.1
- **Call:**
  - `@m3a/library`'s `Library` reads sets and clips by id from any source of files, and `@m3a/library/node` reads a
    directory: the package's own `sets/` when packed, else the repository's.
  - The first time a set is read, its content id (the spec's, §9.2) is recomputed from its clip files and checked
    against its manifest. The id says that a set changed, not which file, so `library/sets.lock.json` records each
    clip file's SHA-256, and a changed file is named (`E_TAMPERED`).
  - `npm run library -- lock` rewrites the lock after the writer changes clips. A test fails if the committed lock
    isn't what the files give.
  - Tiers as D10 has them: CC0 by default. A clip in another tier is refused, with the option that opts in and the
    set's terms. A deprecated id resolves through the lock's `aliases`, with a warning naming its successor; none are
    deprecated yet.
  - `library/LICENSES/` holds CC0 1.0 and CC BY 4.0 verbatim (SPDX's license-list-data v3.25.0 texts) and CMU's
    notice in full, as its front page gives it (checked against mocap.cs.cmu.edu today).
- **Why:** WP-4.7's fresh agents need to find and load clips from the packed package, not from paths into the
  repository. WP-5.1 is small and needs only WP-1.5, so it runs here, ahead of the ledger's order (G4's other items
  don't depend on it).
- **Outside WP-5.1's Owns** (one agent, D21): `packages/library/src/node.ts` and the package's exports (the `/node`
  entry), `tools/library/main.ts` (`npm run library`), `library/sets.lock.json`.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.26.0

## D54 · 2026-10-12 · The benchmark harness: isolation level 1, B1 graded on the bones, running seen as flight

- **Principle:** 1, 6, 7, WP-4.7
- **Call:**
  - The runner packs each package as an agent installs it (`bench/runner/pack.ts`): each file's types stripped by
    Node's `stripTypeScriptTypes`, relative `.ts` imports pointed at `.js`, declarations from `tsc -b`, then
    `npm pack`. `@m3a/library` ships the CC0 sets, the lock narrowed to them and the licenses; `@m3a/tools` ships the
    manual. WP-7.4 replaces this with the real packaging.
  - Isolation level 1 as §7 has it: `claude -p` in `/tmp/m3a-bench/<run>/<trial>/`, with a clean environment (the
    proxy, its certificates and a PATH; none of this session's tokens), a fresh home (no settings, skills or memory),
    the tools limited to files and a shell, no MCP servers. `--dangerously-skip-permissions` is refused as root, so
    the tools are pre-approved with `--allowedTools` instead. The stream-json transcript is kept; each trial records
    its time, turns, tokens and cost, the paths it touched outside its workspace and the files it read past the
    manual. A one-turn probe checks the credentials first. `--parallel N` runs N agents at once, each with its own
    TMPDIR; agents still write scratch files to `/tmp` by name (all 7 of the first run wrote `/tmp/cat.mjs`), so runs
    that count at a gate run one at a time.
  - B1's grader drives the workspace's player headless with scripted speeds (0, 1.2, 3.5, 1.2, 0 m/s) on the
    starter's character and judges the bones, not the player's word: the motion reported; the speed travelled
    (within 25%; under 0.15 m/s idle); the feet stepping when walking (their speed against the pelvis over twice
    idle's); running seen as flight, both feet off the ground in at least 10% of running frames and under 2% of
    walking ones; the lower foot still at times while walking or running; the sensors' slide and skate on what played
    under their **fail** levels; nothing non-finite; a non-blank sheet.
  - Results go to `bench/results/<date>-<model>-<briefs>.json` (§7 says `<date>-<model>.json`; one file per run of a
    brief, so a quiz and a B1 run on the same day don't overwrite each other).
  - `@m3a/three/test-characters` becomes a public subpath (the runner writes a starter's character from a seed, and
    the grader loads it); the boundaries check now allows any subpath a package's exports map declares.
- **Why:**
  - Fail levels, not warn levels, for slide and skate: the sensors' stance (D41) reads a foot as standing only when
    it is slow, so a skating foot moving fast is never judged, and the known-good solution's slow drift at the start
    of a stance reads as a warn (skate 25 against 19.8) while nothing is wrong to the eye. The stillness check catches
    the fast skate the sensors can't see. Raising stance coverage is the sweep's work (D51) and WP-5.8's.
  - Flight, not a swing ratio, for running: how much faster the feet swing running than walking depends on the
    body's proportions (1.61 on generator seed 41 against a 1.65 bar, with the known-good playing a jog), while every
    run has moments with both feet off the ground (62% and 65% of the known-good's running frames) and a walk none.
  - The quiz runs with no tools and one turn: it tests the legend, not a search.
- **Measured** (the CLI's default model, isolation level 1): the quiz 10 of 10 in 3 trials; B1 4 of 5 (the fifth's
  feet skate at 54.5 cm/s while it runs: an agent's mistake the grader names), 0.6 to 1.7 minutes and 7 to 18 turns a
  trial, $0.11 to $0.24; discovery 2 of 2 found the package with no word of it in their brief, and passed. Three of
  the 7 listed a `dist/` directory past the manual; none read the packages' code. The only paths outside the
  workspaces were scratch files in `/tmp`.
- **Outside WP-4.7's Owns** (one agent, D21): `package.json` (`npm run bench`); `vitest.config.ts` and
  `tsconfig.tests.json` (bench/ in the tests, its starters and known-good out); `@m3a/three`'s exports; sensors'
  `STANCE` export (the grader's stillness bar); the boundaries check; `bench/quiz/legend.json`.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.27.0

## D55 · 2026-10-12 · The sweep, round three: clips keep their library's spine, the hips settle smoothly, knees bend forward

- **Principle:** 3, 5, 8, G4 (WP-4.5's follow-up)
- **Call:** the round-two sweep (D51, 87.7%) was traced again, failure by failure, on G4's six skeletons:
  - **A clip's library's spine.** Spec §3.3 has a clip decode with its library's spine and neck shares; the Animator
    used the bound body's own (a skinned rig's are `[0, 0, 0, 1]` and 0), so on every body a torso leaned and a head
    turned unlike the clip's: a Quaternius pistol aim held its arms 79 mm nearer the hips, and arms went through them.
    `AnimClip.shares` carries the library's; the Animator puts them in each key's `spine` (so layers blend them) and
    mixes the neck's as the head is mixed. `playable(clip, rest)` makes a library clip ready: its contacts measured on
    its rest, its shares. Where the lowest segment takes a share (CMU's), which the hips carry, `solver.reachable`
    raises the shares above it until the neck sits where the library's shares put it (within 1.2 mm on the test rig).
  - **The hips settle as a weight shift.** The settle followed a planted sole frame by frame: a toe dipping between two
    keys (a foot's angles turn its toe through an arc), or pitching at toe-off, bobbed the whole body (Sprint's pelvis
    jerked 37 mm). The settle, a planted foot's float and the reach drop are now averaged over ±0.1 s
    (`PlantOptions.settleSmooth`, a triangle over the 60 Hz grid), each within 2% of H0 of the pose's own (a foot
    landing on a step lifts the body only as the foot on the low ground lets go); a planted sole keeps the clip's dip
    by at most 2.5 mm, and the body comes down far enough that a planted foot floats at most 3 mm (WP-2.5's 5 mm holds).
  - **Each sample its own hold.** Each contact's drift is followed once a call and kept as running sums, so the poses
    either side of t each read their own hold (one hold for all moved every sample at once in a dash).
  - **The reach drop never jumps.** Past the leg's reach along the ground it went to nothing; it now brings the hip down
    toward the ankle's height, its limit there (a pushup's feet crossed it).
  - **Knees bend forward.** A capture often holds a straight leg a little past straight; where the planted leg bends
    further, the knee followed the clip's offset behind the line. That offset now fades by how far back it points and
    how much further the leg bends (none at the clip's own bend, so a knee the clip winds round stays the clip's).
  - **One heel.** The sensors' sole (the heel turned with the foot) moves into core (`clip.sole`).
  - **The demo.** The cross punch's fade back to idle took the forearm through the chest on three skeletons; the jab's
    doesn't. The feet touched down as the landing's fade began and skidded on gen-0; the flight now lasts through it.
- **Tried and not kept:**
  - Contacts read as the sensors read standing (slower than 0.5 H0/s in the world, or carried with the pelvis, on the
    shared sole), in core's detection. The sweep's slides and skates fell from 187 to 99 (91.0% with the rest), but
    holding a foot that slides that fast cost a walk's travel 12 mm, slid planted feet 26 to 89 mm a contact (WP-2.5
    asks 10) and snapped knees. Core keeps its stricter rule (0.3 H0/s, half the body's speed). The gap between what
    the sensors judge standing and what core plants is now the largest cause of failure.
  - A float read straight between keys: the window does more. Pulling a planting foot down over its sole's three-frame
    ease to meet the surface: 9 of 16 sampled pairs failed on it.
- **Result:** 89.1% (2,808 of 3,150; 91 pairs fixed, 46 worse): gen-0 85.0%, gen-1 91.4%, gen-2 90.7%, gen-3 91.0%,
  mannequin 90.5%, Knight 86.3%. The reasons: skate 105, pop 82, slide 82, jitter 59, the seam's speed 47,
  intersection 15 (58 before), penetration 11, seam 2. G4 asks 95%. The idle, walk, run, jump and attack set plays
  on all six with no fail finding (warns: jitter, a skate).
- **Tests:** each fails on the code before it: the neck with and without shares (Quaternius, CMU, 100STYLE), Sprint's
  pelvis, Chop_Wood's knees held all along, four sweep pairs on generated rigs; WP-2.5's ground tests hold.
- **Outside WP-4.5's Owns** (one agent, D21): core's planting, solver, Animator and contacts, its public `playable`;
  the sensors' sole; the demo's attack and flight.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.28.0

## D56 · 2026-10-12 · B1 asks speeds in proportion to the character's hips; G4's first held-out run

- **Principle:** 1, 7, WP-4.7, G4
- **Call:**
  - G4's first held-out run (`bench/results/heldout/G4/run-1/`, for commit 6798b45): a fresh subagent chose the rig,
    `orangejuice-male-base` (orange juice games' male base mesh, CC0 1.0, a Blender human metarig, bound by
    topology at 0.85). Doubt: the pinned license file is the re-uploader's repository license (BoQsc's, CC0 1.0); the
    author's own CC0 statement is on its itch.io page, which can't be pinned. Another wrote B1's variant: its first
    draw, generator seed 935, failed the brief's known-good solution (the walk travelled 0.84 m/s for 1.2, the
    running foot never stood still), which §7 reports as a package or grader failure; it drew again (seed 401, which
    passes). Both draws are kept in the run's directory.
  - The failure was the grader's: seed 935 is a chibi with hips 0.44 m up, and B1 asked every character 1.2 and
    3.5 m/s, more than two and eight of its hip heights a second, past any walk's rate, while the stillness bar is a
    share of its H0. B1 now asks speeds in proportion to the character's hip height (1.2 and 3.5 m/s for hips 1 m
    up; `scriptFor`), each workspace lists them in `speeds.json`, the starters' `npm run check` reads them, and the
    briefs say speeds go with size. The known-good solution scales its thresholds the same way, and passes on 935.
- **Why:** a brief a correct player can't pass on some of its own characters measures the brief. The speeds a game
  asks of a small character are smaller (a walk's speed goes with leg length).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.28.0 (bench only; no package changed)

## D57 · 2026-10-12 · G4 run 1 failed, 5 of 8; what run 2 needs

- **Principle:** 1, 9, G4, K1
- **Call:**
  - `npm run gate -- G4` ran at 6798b45 (the held-out run's files beside it, untracked, identical to 11c6130's) in a
    worktree: 19.7 min, **failed**. Passed: check (T0), test (T1, 469 tests), doctrine 8/8, T2 (12 Playwright tests:
    the idle, walk, run, jump and attack set on the six skeletons and the held-out rig, no fail finding on any, all
    warn), B1 5/5. Failed: the sweep, 2,808 of 3,150 pairs (89.1%; gen-0 85.0%, gen-1 91.4%, gen-2 90.7%, gen-3
    91.0%, the Quaternius mannequin 90.5%, the Knight 86.3%; the held-out rig 477 of 525, 90.9%, apart); `vectors
    --check`, which found no pinned sources in the worktree (with them, byte for byte at the same commit). The record:
    `bench/results/gates/G4-run-1/` (the report, every failing pair with its reasons, the set, both B1 runs).
  - **The verifier's review** (a fresh subagent, AGENTS.md): it recounted every number from the outputs and found them
    right, and found:
    - B1's held-out variant is a failure, not a pass: its first seed (935) broke the brief's known-good solution, and
      §7 then reports a package or grader failure instead of running trials. Run 1 redrew (seed 401: 5/5, kept as
      information). So run 1 is 5 of 8. Run 2 doesn't redraw.
    - The sweep's pass rule (D49: the skeleton adds no finding the clip lacks on its own body) was never written into
      §9.3 or WP-4.5. It now is, unchanged. Read literally on the played body alone, "pass the sensors" gives 91.7% (no
      fail finding) or 72.4% (no finding): every reading misses 95%. The owner is asked which reading M1 means; until
      answered, D49's stands.
    - The B1 records lack the commit (a worktree's `.git` is a file), a dirty flag, the variant's directory and seed,
      and discovery trials (§7 reports them at G4); agents wrote scratch files to `/tmp` outside their workspaces (no
      repository path read: no contamination found). The capture sheets cover four of G4's seven bodies. The held-out
      rig's license file is its re-uploader's, and only its SHA is unrecorded in `rig.json`.
  - **Run 2** (K1: a second failure for any reason stops Phase 4): only when a sweep outside the gate passes ≥95% at a
    clean commit; then pins and fixtures fetched first, a fresh held-out rig whose author's own source carries its
    license (its license file's SHA-256 recorded), fresh variants written after the commit is fixed, the gate run on
    that commit with every log kept.
- **Why:** a gate's report says what its outputs show; a run that redrew a failing variant didn't pass that step.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.28.0 (records and the plan's wording only)

## D58 · 2026-10-12 · The sweep, round four: where its failures come from, and what was tried

- **Principle:** 1, 4, WP-2.5, WP-4.5, G4
- **Call:**
  - **Where the 342 failing pairs of run 1 come from** (each traced on the played body):
    - **contacts:** skate and slide fail 187 pairs, and on the Knight 47 of their 68 findings lie wholly outside the
      contacts planting uses (20 partly, 1 inside): the foot stands by the sensors' rule, the player doesn't plant it;
    - **the clip's own defects, larger on another body:** a foot's heading that flips between two keys (Jog's left
      foot, 7° to 169°) swings a longer foot's toe further, past a level its own body stays under; a knee the clip
      bends against its foot (Chop_Wood's right knee, 40–143 mm on every body);
    - **planting's transitions:** pops and seam speeds where a hold starts or lets go.
  - **Kept:** a foot off the floor for under 0.1 s between two of its contacts stays planted (`plant`, a loop's seam
    included): Zombie_Walk_Loop's left foot lifts for 33 ms across its seam, and letting its hold go there moved the
    ankle 31 mm in a frame (10 mm now). The sweep: one pair more.
  - **Tried, not kept** (each over all 3,150 pairs):
    - planting on contacts read on the played body (core's, joined with the sensors' stance on a first play): skate
      105 → 12, slide 82 → 4, but pops 82 → 144 and seams 2 → 27, so 90.3% (157 fixed, 119 broken). The new pops:
      a foot the clip drags with its body is standing by the sensors' rule, and held still it stretches the leg and
      drops the body up to 62 mm in a frame; knees that flip to the other side where a planted leg bends further than a
      knee the clip bends against its foot (the pole's fade crosses zero). Planting only feet still in the world fixes
      the first, not the second;
    - a release continuous in speed (the foot's move since it lifted undone too, then let go): 88.7%: the planted
      target lags the swing and the leg's reach drops the body;
    - trusting a clip's clearly bent knee (offset over 10% of the leg): net 0 (5 fixed, 5 broken), and it folds
      Chop_Wood's knee 27 mm further back on the core test's rig;
    - a constant-speed root for in-place loops: 89.2%.
- **Why:** the gate wants 95%; each of these is measured, and only what helps without breaking a test is kept. The
  largest lever left is planting where the playing body's feet stand, which needs the knee's way chosen without a
  flip; that and the clips' own defects are the next round's.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.28.1

## D59 · 2026-10-12 · License compliance: the sets' terms by tier, and a game manifest of tiers and clips

- **Principle:** 8, WP-5.7, D10
- **Call:**
  - `checkSets` (`@m3a/library`): each set's sources carry an SPDX id (or `LicenseRef-` for terms SPDX doesn't list)
    that fits the set's tier: `cc0` holds CC0-1.0 alone, `cc-by` a CC-BY-x.y (not share-alike: a CC BY-SA clip can't
    sit in a pack a game ships under its own terms), `cmu` CMU's notice, `local` anything (it never ships). Each
    license's text is kept verbatim in `library/LICENSES/<id>.txt`; a `cc-by` or `cmu` set says how to credit it. An
    open `audit` on a source (Mesh2Motion's three, until WP-5.3's per-asset audit) is a question, listed, not a failure.
  - **A game manifest** (the plan names one, never its shape): `{ game?, tiers?, clips?, ships? }`. The tiers it opts
    into (CC0 alone by default, D10), the clips it plays by id (none: every set of its tiers), and whether it ships
    (true by default). `checkGame` fails a clip from a tier it didn't opt into, a clip the library lacks, and `local`
    content in a game that ships; the credits it owes are the credited sets its clips come from, and `creditsBlock`
    writes them as lines a game shows. WP-7.1's game config can carry the same fields.
  - `npm run license -- check <library | SET | game.json>` runs either and prints the block.
- **Result:** the five seed sets pass, with Mesh2Motion's three open audits listed; CMU_CURATED (60 clips) and STYLE100
  (98) are the sets to credit. A fixture for each failure fails with its reason.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.29.0

## D60 · 2026-10-12 · G4's bar goes to the owner: which reading of "pass the sensors" M1 means

- **Principle:** 1, 9, G4, K1
- **Call:** escalated on michaelcrosato/my-3danimations#10 with the numbers. Over run 1's 3,150 pairs, the readings
  give: D49's (the skeleton adds no warn or fail the clip lacks) 89.1%; the skeleton adds no fail finding (warns
  listed) 97.2% (gen-0 95.6%, gen-1 98.1, gen-2 98.3, gen-3 98.5, the mannequin 98.5, the Knight 94.1); the played
  verdict alone has no fail 91.7%; is "pass" 72.4%. Round four's levers (D58) and clips repaired at load (89.8%)
  together reach about 91% under D49's. Recommended: "no fail finding added", every added warn listed, since the
  sensors set warn at capture's p95 and fail past all capture; the set test already reads "green" so. Until answered,
  D49's reading stands and G4 run 2 doesn't start (K1); Phase 5 and 6 go on.
- **Why:** the reading decides whether M1 passes, so it is the owner's; choosing the one that passes after seeing the
  numbers would be the agent grading itself.
- **Answered:** no: escalated, waiting.
- **Landed in:** v0.29.0 (no code)

## D61 · 2026-10-12 · The importers: two readers bit for bit, the rest through bone maps, VRMA written and read exactly

- **Principle:** 2, 6, 8, WP-5.2
- **Call:**
  - **`@m3a/io`** reads every input as untrusted: sizes capped (`LIMITS`), and a file's work too (its frames, every
    clip together, at most 262,144; frames times joints at most 2^24), so a 6 KB file can't ask for hours or
    gigabytes; every buffer read bounds-checked; a glTF's JSON checked for the shapes glTF gives it before anything
    reads it; skeletons walked without recursion, names in maps without a prototype; nothing evaluated. A refusal is
    an `IoError` naming its cause and line or byte offset, and the readers the package exports let nothing else out
    (anything else an input provokes is refused as E_FORMAT, named). No dependency beyond `@m3a/core`; the entry
    runs in a browser (text and bytes in, never a path).
  - **Bit for bit where an oracle exists:** the glTF reader for Rigify and Unreal rigs (`readGltf`) and CMU's
    ASF/AMC (`readCmu`) port my-3d2dge's `anim-import.mjs` and `asf-amc.mjs` in the originals' order of operations,
    with core's portable math (V8's results in every engine). Tier 1b reads the tiny rig and take 09_02 into tier 1a's
    captures, every float32 of every frame, the travel, the takes, the rest and the log line, and now a second glTF
    vector the review asked for: a Rigify rig with a skinned mesh (strided, normalized and short accessors, a split
    weight, a joint-ring material), STEP and scale tracks and a root turned 20° and scaled to centimetres, read with
    its look bit for bit like the origin's importer (`tier1b/rigify.gltf`, `rigify-expected.json`; the .gltf generated
    by `tools/vectors/rigify.ts` and approved as a binary, as D23 approved the tiny rig's). The frozen
    `tiers.md` is unchanged: tier 1b's rule (the readers, bit for bit) covers it. Where the original was wrong on a
    valid file, the port reads it right and nothing in the vectors moves: a node's `matrix` is its transform (the
    original ignored it), a skin without inverse bind matrices has identity ones, chunks of other types are skipped,
    and a file that needs an extension to read its buffers (meshopt, Draco) is refused by name.
  - **Everything else through bone maps:** shardfall's BVH reader (as reference) gives five maps (100STYLE, MotionBuilder
    for Mixamo and most converters, Bandai Namco, Unreal, Rigify), the units from the legs' length and the rest that
    stands straightest; a later take of the same joints shares the first take's rig only when its offsets match too
    (shardfall's `adopt`). A glTF animation on any other rig is read as posed joints through the same maps
    (`readGltfPosed`), posed frame by frame as asked, so memory stays with the tracks; a sixth map takes VRM's humanoid
    names. Takes are cut into clips by one shared cutter (`takes.ts`, CMU's: loops at their best cycle, closed; the
    rest stood on the takes' floor).
  - **VRMA:** `vrmaOf` plays a clip on a bound skeleton (the Animator: feet planted, the root's travel and turn) and
    keeps what a VRM player plays, the humanoid bones alone: each bone's rotation relative to its parent as a player
    sees the parent (a non-humanoid node at rest), and the hips' place with the root's travel and turn in it. The
    first cut kept the root's motion on the skeleton's non-humanoid root node, which a VRM player never reads, so a
    knockback played in place; the review caught it. Every humanoid bone now lands within 0.01 mm of where the
    Animator put it, root motion and all (forward kinematics of the file against the Animator, the test). The clip's
    id, loop, length, events, contacts and facts go in the animation's `extras`, where three's bake puts them, and
    `readVrma` reads the loop back. `decodeVrma` reads back the same structure, so a file written, read and written
    again is the same bytes.
  - **Import:** `importSet` fits libraries into a set as a hand-written catalog says (`$sources`, `$pick`, `$skip` with
    each reason on record, tags, `orig`), with a fit report per clip (mean, worst, keys); on the tiny rig and the CMU
    take its fits are tier 1a's bit for bit. As the original did, the catalog's `$sources.CMU` becomes one record a
    subject (`CMU_NN`, its line and page), and a `$pick` that names only its take plays the stretch where the take
    moves at its own rate, as the ledger measured it (`picksOf(cat, fps, ledger)`). It writes format 1, as the
    migrator reads it (WP-5.3 runs both). `subset` makes a smaller set from bigger ones with their libraries' records
    (my-3d2dge's `anim-set.mjs`).
  - **Carried elsewhere:** `cmu.mjs`'s survey and ledger fetch and write files, so they are Node tooling, not the
    browser-safe package: they land in WP-5.6's `tools/corpora/` (its owner), built on `readCmu`.
  - **FBX** is documented, not shipped: convert to .glb first, with Blender (my-3d2dge's `tools/to-glb.py` at the
    pinned commit, not carried here) or a ufbx-based converter (none in this repository); nothing reads FBX at runtime.
  - **The verifier's review** (a fresh subagent): one blocking finding (hostile files hung the readers or took
    gigabytes: the budgets above), five to fix (non-IoError throws, tier 1b's narrow coverage, VRMA root motion, CMU
    provenance, the carry), and notes (error wording, unknown chunks, `matrix`, extras placement, FBX wording); each
    is fixed above, with tests (`packages/io/test/hostile.test.ts`: the budgets, the shapes, 600 random corruptions of
    real files giving a reading or an IoError and nothing else).
- **Why:** the readers decide the library's numbers, so where an oracle exists they match it exactly; where none does,
  a table per skeleton (shardfall's design) reads new sources without new code. A reader takes files from anywhere,
  so a hostile one must cost at most a bounded refusal.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.30.0

## D62 · 2026-10-12 · Large corpora on demand: CMU's ledger regenerated byte for byte, 100STYLE's extras from its archive

- **Principle:** 4, 9, 10, 11, WP-5.6
- **Call:**
  - **Into `.cache/`, held to locks, never committed or published** (O2: publish nothing, so no release assets). CMU:
    the site's index (the parsed `index.tsv`), its archive (`allasfamc.zip`, 1.08 GB, 2,514 takes) and the 34 takes
    of subject 144 it lacks, each file's SHA-256 in `tools/corpora/cmu.lock.json`; a fetch keeps a file only if it
    matches, checks every archive entry's CRC-32 as it unpacks, and resumes. 100STYLE: Zenodo's archive (1.47 GB),
    its SHA-256 in `tools/corpora/100style.lock.json`, read take by take, never unpacked. Node has no unzip, so
    `tools/corpora/zip.ts` reads an archive entry by entry (my-3d2dge's `cmuAll`), refusing ZIP64 and lying entries.
  - **The CMU ledger** (`tools/corpora/cmu-takes.tsv`, kept as text): my-3d2dge's `cmu.mjs` survey ported onto
    `@m3a/io`'s `readCmu` and core's fit. Run over all 2,548 takes (10.7 hours of motion, about 5 minutes), every one
    of its rows came out identical to the ledger my-3d2dge and shardfall carry: the port, the reader and the fitter
    agree with the originals number for number across the whole database. Only the comment head is new (this
    repository's command and the CMU notice's file). `used` follows `library/sets/CMU_CURATED`'s clips (the same 59
    takes); notes are kept when the survey runs again. `npm run corpora -- cmu --survey --check` regenerates it byte
    for byte (the Verify); `--find`, `--ledger` search it; `--import` writes every take as a format-1 set a subject.
  - **100STYLE's extras:** the gaits beyond the forward walks STYLE100 holds (runs, backward walks and runs, sidesteps
    and sideways runs each way, idles: 780 picks in six catalogs carried from shardfall, their license field now the
    SPDX id). They need shardfall's cutter: a pick finds its own stretch (the longest straight run, the longest pass
    going a way of where the hips face, never doubling back, the longest still stretch, or the stretch as given)
    inside the frames the dataset marks as the style (Frame_Cuts.csv), a loop going a way is cut from the pass whose
    cycle is cleanest and faces forward, and a pick that can't be cut is left out with its reason. That lands in
    `@m3a/io`'s shared cutter (`takes.ts`, `Pick.find`) and `readBvh`'s `lenient`; a pick that doesn't ask cuts exactly
    as before, so tier 1b and the CMU ledger don't move. Imported from the archive (about 2.5 minutes), all 780 clips
    come out cut at the same stretch and with the same keys as shardfall's sets of them (the pinned source; set means
    9.2–11.8 mm), which `npm run corpora -- 100style --import --check` holds to; none is left out, and each catalog's
    skips stay on record with their reasons. Every take's zero pose stands, so the first take's rig is every take's,
    as shardfall's rule (the take that stands straightest) gives too.
  - **The local lane:** `library/local/README.md` says what may live there (Bandai Namco, LaFAN1, Mixamo) and the three
    rules (never committed, never shipped, never used to derive a distributable clip). The doctrine check reads only
    what a commit could hold: through git, the ignored lane is never listed; outside git, its walk now skips the
    lane's content, `.cache/` and the outputs too (it used to read them).
- **Why:** the corpora are too large to commit and some can't be redistributed, but a re-import (WP-5.3) must be
  reproducible: a pinned checksum on every input, and a ledger that regenerates exactly, make it so.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.31.0

## D63 · 2026-10-12 · The re-import: nine sets from their sources, Quaternius as migrated until its files come

- **Principle:** 4, 8, 10, 11, WP-5.3, O4
- **Call:**
  - **Nine sets re-imported from their sources** by `npm run import` (`tools/import/`), each source fetched into
    `.cache/` and held to a pinned SHA-256: MESH2MOTION (mesh2motion-app@653a969's three GLBs,
    `tools/import/sources.json`), CMU_CURATED (the takes `tools/corpora/cmu.lock.json` pins), STYLE100 and its six
    extras (the archive `tools/corpora/100style.lock.json` pins; the extras' catalogs moved to `library/catalogs/`).
    Every clip is fitted with format 2's new degrees of freedom: the hands (flex clamped to ±90°, side to ±45°), the
    spine's curl (kept for a clip only if, in some key, it brings a spine point 5 mm closer), and root yaw (the heading
    from the hip line, held where the torso is far from upright, the line stands near vertical or the heading jumps;
    kept only if the clip ends facing 20° or more from where it began, its first and last half second averaged, so a
    swing of the hips that comes back is the body's), with a nearly straight limb's twist held where it would swing 45°
    or more between keys (`steadyTwist`). A looping clip records its speed (`speed`, from its stride).
  - **Every CMU take on the ground.** The origin's reader stands a subject's picks and rest on one floor, the most
    common among its takes, at the height the capture has it, not on the ground: the CMU rests' ankles stood from 22 to
    136 mm up, and with more picks a floor moved (subject 79's by 3 cm, floating its clips and folding a planted knee).
    Its takes stand on floors up to 12 cm apart (79's from −2 to 10 cm). So `readCmu`'s `floorEach` (the cutter's)
    stands each take on the ground: on its own floor where it shows one (its feet mostly on one level: 90% of the lower
    half of its lowest foot points within a centimetre), else on the floor of the subject's takes that do (a fall, a
    flip, a take on a platform: their lowest foot points sit wherever the feet are); the rest stands on the ground too.
    The re-import turns it on. Off, the reader is the origin's: tier 1b and the CMU ledger (which reads a subject's
    takes together) don't move. Clips that sank or floated come back to the floor (Chop_Wood's sole 25 mm under it → 0,
    Jump_Kick's 63 → 0).
  - **Each clip keeps the better version**, compared with the migrator's own output: the re-import, unless its mean fit
    against the source is worse or the sensors judge it worse. The set's `_import.json` (its schema
    `tools/import/import.schema.json`) records the choice and why (naming a worst error that grew: 15 clips keep a
    re-import whose worst is 20 mm or more further, the furthest 130 mm), both fits, both verdicts, every metric that
    moved and the hands' error. MESH2MOTION keeps 166 re-imported and 11 migrated (9.6 mm on average), CMU_CURATED 55
    and 5 (13.9 mm), STYLE100 83 and 12 (8.7 mm); the extras are new (7.7–9.4 mm). A migrated clip kept decodes on the
    rest it was made on: where the re-import measures its source's rest anew (more picks from a performer move the
    spine's shares and the floor), that rest stays as its own source record (`CMU_13_MIGRATED` and three more) and the
    clip names it. Every set is within the fit limits (set mean ≤ 20 mm, clip mean ≤ 40, worst ≤ 300). Provenance names
    `m3a-import 1` and the manifest the sources' edition. `npm run import -- --check` rebuilds every file byte for byte.
  - **The hands** (mean error against the capture, from the pelvis, so where a take stands doesn't count): on the clips
    that hold something (picked by the words of their names and descriptions and by their tags, mimed props included)
    Mesh2Motion 32.4 → 13.7 mm (40 clips), STYLE100 19.6 → 7.3 (8); CMU 15.1 → 15.3 (8). Over every clip: Mesh2Motion
    31.7 → 13.9, STYLE100 15.6 → 8.8, CMU 13.9 → 13.4. CMU captures a hand as a stub (no finger joints), so format 2's
    hands have little to recover there, and on its prop clips nothing.
  - **Clips gone:** STYLE100's HandsBetweenLegs_Walk, SwingArmsRound_Walk and WildLegs_Walk are left out, each with its
    reason in the catalog's `$skip`: format 2 can't hold the pose, and their migrated fits (73/292, 40/395 and 71/546
    mm) were past the limits. Their ids are gone with no successor, so no alias. One sideways run (Elated_SideRunRight)
    is left out the same way.
  - **The Mesh2Motion audit is closed: CC0.** At the pinned commits the app's README says its art assets (models, rigs,
    animations) are all CC0, mesh2motion-assets' LICENSE is CC0 1.0 Universal, and the three GLBs carry no license or
    copyright mark of their own. Nothing in them is CC BY or BY-SA, so the set stays tier `cc0` and nothing goes to
    `local`. Each source's `terms` cite both files.
  - **CMU's new picks for G5's floors:** 84 takes from the ledger (43 subjects in all), chosen for the categories the
    library was short of: reactions (get-ups, falls, stumbles, limps: CMU has no hit or death takes), gestures and
    emotes (emotions, dances, social gestures), interaction and work (tools, kitchen, carrying, pushing), traversal
    (steps, ledges, ladders, jumps) and a few for combat, each described in the ledger's own words. They are cut as the
    existing picks are (a 6 s window of a long take, or the stretch the ledger says it moves). CMU_CURATED now has 144
    clips; the ledger's `used` follows (`npm run corpora -- cmu --survey --check` passes).
  - **Quaternius stays as migrated** (QUATERNIUS_3D2DGE, QUATERNIUS_SHARDFALL), a deviation from WP-5.3: the current
    editions come only through itch.io's download flow, which this session's permission layer refused. The owner was
    asked (michaelcrosato/my-3danimations#10: allow the download, or put the zips in Drive); with no answer the default
    (option 3) stands. When the files come, `tools/import/sets.ts` takes the two sets like the others.
  - **What moved with the library:**
    - The seam fix (`@m3a/sensors`) makes the two segments that meet at the seam equally long, so the curves it spreads
      the gap along end at the same speed both sides (on a sparsely keyed clip, a short last segment against a long
      first one read as a hitch). Over the 478 clips lint flags, `npm run qa -- --fix` makes none worse (244 better).
    - The contact test runs the library's locomotion loops (sidesteps now too) in four files side by side, 100STYLE's
      over one cycle each (planting depends on the time alone: a loop's second cycle is its first moved on), so T1 keeps
      its 90 s.
    - QA's baseline is rewritten: 1,385 clips, 901 pass, 296 warn, 188 fail. On the same clips the re-imported sets fail
      fewer than migrated: CMU 21 → 7 of 60, Mesh2Motion 48 → 37 of 177, STYLE100 22 → 14 of 95. The exceptions are
      WP-5.8's.
    - The planted runs stay G3's: chosen from the library as it was, every run's clip is still in it, clean and able to
      show its defect, which `npm run plant -- --check` now checks (it used to rebuild the runs, which a grown library
      changes). Chosen again from today's library, 4 of 39 planted and fix tests fail (a slide planted 9 times, not 10;
      a finding the run doesn't state on CMU's Lindy_Hop; a slide foot locking leaves on CMU's Comfort; a sink the
      penetration fix leaves on Mesh2Motion's Angry): WP-5.8's.
    - The demo (`apps/lab/hello`, G4's T2 set) plays its moves' hands only if every move has them: its migrated
      Quaternius moves have none and Mesh2Motion's re-imported jumps close the fist, which on gen-0 clenched and opened
      within each fade fast enough to fail as a pop. With Quaternius re-imported, the set has hands throughout.
    - G4 run 2's sweep reads the whole library: 1,385 clips on six skeletons, 8,310 pairs (run 1: 525 and 3,150).
- **Why:** a re-import is only worth its churn where it is better, clip by clip, and the record says so; a source that
  can't be fetched waits rather than coming from a copy that isn't the original.
- **Answered:** no: made without a response, to review. Quaternius' option 3 is the default the owner was told of.
- **Landed in:** v0.32.0

## D64 · 2026-10-12 · Facts and contacts in every clip; detected contacts are re-read; loops close

- **Principle:** 3, 4, 5, 10, WP-5.4
- **Call:**
  - **Every clip carries its facts and contacts.** `@m3a/library`'s `measure` reads core's `measureFacts` on the clip's
    own rest: speed, travel, the hips' height range, a loop's seam, an attack's strikes (spec/MOTION.md §7.3), and the
    planted intervals (§7.1, `by: "detected"`, to the millisecond). They are marked `by: m3a-facts@1`, a revision a
    change to the measurement bumps. A speed the source gave (a capture's own travel over its cycle, the migrated sets'
    and 100STYLE's) is kept and named in `captured`: planted feet on a decoded clip estimate it within 5% at the median
    but miss an odd gait's by half (LegsApart_Walk's 12 against 1.4). 1,385 clips: 1,329 with planted contacts, 793 with
    a captured speed, 75 with strikes.
  - **Written by the writers.** The importer and the migrator call `withFacts` on each clip before it is written, so
    `npm run import -- --check` and `npm run migrate -- --check` still rebuild the library byte for byte, and a change
    to the measurement is a change to the clips. `npm run facts -- --check` (the Verify) measures every clip again and
    fails on a fact or contact that differs.
  - **Detected contacts are re-read.** A clip that carries contacts used to have them taken as given, by `measureFacts`
    and by `playable`. Once written into the library, that changed what the sensors read (the speed a loop's first-pass
    contacts give, so its treadmill: Strafe_right went from pass to warn). It also planted feet on intervals a repair
    had since moved (the demo's toe popped at 9.5 m/s after `fix`). So both detect a tool's contacts again and take only
    a source's labelled ones as given (spec §7.1's `by`). The written ones are for reading (an agent, search) without
    measuring, and every reading is the same with them or without.
  - **The tags against the facts:** a clip tagged `loop` must close (its seam within the sensors' seam fail level, 60 mm
    at a 950 mm hip height, scaled), and a `run` that loops must travel (10% of its hip height a second, the importer's
    least speed) or be tagged `inplace`. A conflict is resolved, or given a reason in `library/baselines/tags.json`
    (none is needed now). There were 18:
    - 15 loops that didn't close. All re-imported, all from the same cause: a nearly straight limb's twist or a wrist's
      roll, which its points barely show, held by `steadyTwist` in the last key while the capture had come back to its
      first frame (Akimbo_SideLeft's leg 9° → 110°). The fitter's `closeLoop` (on in the importer) ends a loop whose
      capture closes on its first key, each angle by the whole turns nearest its own. All 15 now close; QA goes from 901
      pass, 296 warn, 188 fail to 920, 285, 180; and closed loops let more re-imports win (Mesh2Motion keeps 168,
      STYLE100 86, whose prop clips' hands go 19.6 → 6.1 mm).
    - 3 runs that don't travel. Mesh2Motion's Run_Anime and Run_Stealth, both before WP-5.3 too, have a still root and
      never plant a foot: runs on the spot, wrongly tagged `root-motion` and described as travelling. 100STYLE's
      Flapping_RunBack moves back 1.2% of its hip height a second, flapping on tiptoes. All three are tagged `inplace`
      in their catalogs.
- **Why:** facts in the file let an agent or a search read a clip without measuring it, but only if no reading depends
  on whether they are there; the check makes the tags say what the motion does.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.33.0

## D65 · 2026-10-12 · Search: a vocabulary of motion, the verb first, measured on queries it never saw

- **Principle:** 1, 2, 10, WP-5.5, D10
- **Call:**
  - **What it searches:** every set's catalog row (id, duration, loop, speed from the facts, tags, description), in
    every tier, but it returns only the tiers the game opted into (CC0 alone by default, D10); a better match in another
    tier is named in `next` with the tiers to opt into. No match is not an error: zero rows, and `next` gives the
    nearest tags. Rows are short (a description cut at 90 characters), at most 40, 10 by default. The reading tiers: the
    core list (43 CC0 clips a game usually needs, first among equal scores), then the catalogs, then the CMU ledger,
    whose takes `next` names when the library has nothing close.
  - **How it scores:** each word of the query against a clip's tags (3), name (2.5) and description (1), weighted by how
    rare the word is in the library; through a synonym, 0.7 of that for the concept's first library word and 0.5 for the
    others ("cut" finds a sword before any attack); the first word, the moment's verb, counts half again ("sneaks past a
    guard" is a sneak); a clip that answers every word, a third more. Before scoring, stop words go, then idioms become
    the word they mean ("throws a punch", "slips past", "flags down"), then particles, degree words and light verbs
    ("gets hit" is a hit; "shuffles down the lane" isn't about anything down).
  - **The measure:** for the 40 queries written from game moments, a fitting clip (each query's own regex over ids) is
    in the top 5 for 40, every tier opted in; 37 on CC0 alone, the three misses having no CC0 clip that fits (a dig, a
    limp, a trip), for which `next` names the CMU clip. Held out, written by verifier subagents that saw only the
    catalogs:
    - **Round 1** scored 4 of 10 against the first table, a small list of synonyms: game moments say "elderly",
      "clinging to the edge", "winded", "split logs", "flag down", and the table knew none of them, while particles
      ("down") matched clips named …_Down. The vocabulary was rebuilt by kind of motion (moving, fighting, reacting,
      working, gesturing, resting, about 100 concepts), with idioms, particles and the scoring above. Round 1 is no
      longer held out (`heldout-round1.json`, kept as a record; it now passes 10 of 10).
    - **Round 2**, written by a new subagent after the vocabulary was frozen again, without the vocabulary, the 40 or
      round 1: 8 of 10 every tier opted in (the bar is 8), 7 on CC0 alone. Its misses: "loses his footing on black ice"
      (a slip it reads as feet) and "teeth chattering in a blizzard" (chattering read as talk).
- **Why:** an agent writes what the game needs in a designer's words, not the library's; the held-out rounds are what
  says the search understands them, and the first one said it didn't.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.34.0

## D66 · 2026-10-12 · Library QA: repair what can be measured, baseline the rest with a reason, count what is unique

- **Principle:** 3, 8, 10, WP-5.8, G5, D63, D64
- **Call:**
  - **Repairs:** a re-import the sensors flag goes through their `fix` (WP-3.5); the fixed clip is kept when it comes
    out better (a better verdict, or as good with fewer findings), valid, and within `CLOSE` (2 mm) of its source on
    average and inside the fit limits, its facts and fit measured again. 148 clips were repaired; for 148 no step
    makes them better, and for 74 the repair would take them further from their source than that (the reason is in
    `_import.json`'s `unrepaired`). The two Quaternius sets stay as migrated: with no source frames there is nothing
    to measure a repair against. The sensors' `fix` now keeps facts a source gave (`captured`) when it measures them
    again: a repaired 100STYLE run had lost its captured speed and read as a run that doesn't travel.
  - **D63's choice revised:** a re-import the sensors judge better is kept over its migrated version within `CLOSE` mm
    of it on average (it had to fit as closely): 8 STYLE100 walks, 2 fails and 6 warns, now pass.
  - **Verdicts in every clip:** the writers record the sensors' verdict in `quality`: `pass`, or `baselined` with a
    reason, read with `m3a-sensors@1` (`checks.QA_VERSION`, changed when a change moves a verdict). A reason starts
    "fail on twistFlip, jitter:" and then says why the clip is kept, the first that applies: a reason given by hand
    for that clip and metric (`library/baselines/qa.json`: a ledge hang whose toes reach below the floor, a zombie
    rising out of the ground); its set's (the Quaternius sets: no source frames, their keys the source's until the
    re-import can fetch them); for a warn, that it is short of every fail level; for a fail, how the clip stands to its
    source (as captured or as keyed, its fit, what the fix did). Of 1,390 clips: 1,045 pass, 206 warn, 139 fail (60 in
    the Quaternius sets, 48 captured, 29 keyed, 2 by hand).
  - **Why fails are baselined, not dropped:** a fail level is the most the capture the thresholds were read from
    reaches (157 clips, D41), and the library now holds a thousand captured clips; most fails are a twist flip (60
    clips), which thresholds.ts already calls common in encoded capture. Dropping them would drop real motions the
    floors count on. A game reads the verdict and the reason in the clip, and `distributions.json` keeps the counts
    from growing.
  - **Tag-aware thresholds:** the profiles from WP-3.3 (acrobatics, lying, swimming, sliding, sitting). No new one: the
    one clip a profile would serve (the ledge hang) has its reason by hand.
  - **The census** (`tools/qa/census.ts`): a category per clip from its tags, the first of seven that takes it (a hurt
    walk is locomotion, a pitch is sport); one motion counted once when it is a copy by `orig` (84), a re-export (one
    source's animation of one name in two sets, or its `_RM` take: 110), or within 20 mm of another on average over its
    whole length, 24 poses on the pelvis scaled to a 950 mm hip, loops at every phase (3: three 100STYLE idles a style
    barely shows in). No pose distance alone separates the two Quaternius migrations of one animation (8 to 35 mm
    apart) from distinct 100STYLE idles (16 mm and up), hence the re-export rule. 1,193 unique motions of 1,390; the
    CC0 pack 173 of 367.
  - **Floors:** every one met but reactions, 28 unique. CMU has get-ups and falls but no hits or deaths, and the keyed
    sets' hits and deaths are re-exports of one another. Six CMU picks were tried; five get-ups stay, and a stunt fall
    went (its knee bends backward): 47 reaction clips, 33 motions. The reactions floor goes from 40 to 33.
    The rest of the way is hits composed from these (WP-6.1's layers and pose deltas) or a source with captured hits
    (the intake, WP-9.1).
  - **Recorded:** `library/baselines/distributions.json` (the verdicts' counts, each metric's p50, p95 and most); `npm
    run qa -- library --check` fails on any that gets worse, a verdict a clip records that the sensors no longer give,
    a reason whose finding is gone, a floor short, or a `docs/LIBRARY.md` that isn't as generated. T2 runs it.
  - **T1:** the library's growth took T1 to 93 s. Vitest left a core idle; it now runs a file on each, and describe's
    token count over every clip is a file of its own: 72 s.
- **Why:** G5 asks for a verdict on every clip and floors counted on unique motions. A fail can be repaired, explained
  or dropped. Repairs are kept only where a source says they didn't change the motion, and a drop only where the
  motion is broken (the stunt fall). Everything else is explained in the clip itself, where a game will look.
- **Answered:** no: made without a response, to review (the reactions floor above all).
- **Landed in:** v0.35.0

## D67 · 2026-10-12 · G5's verifier: duplicate captures, an unlinked re-export, floating falls, repairs that moved a point too far

- **Principle:** 3, 8, 10, G5, D66
- **Call:** the gate's commands passed (12 of 12, 9.6 min), but its verifier found the reactions floor not met even at
  D66's 33, and more. What changed:
  - **Reactions (blocking).** Two of D66's five get-ups were the same capture as picks already in: CMU subject 77's
    takes 01–34 are byte for byte subject 139's (77_16 is 139_16, Get_Up_Ready). They are gone, and six get-ups from
    takes no pick shares (111_06, 111_08, 140_02, 140_04, 140_09, 139_17; four are second takes of a get-up already
    picked, by the same performer) are in. Mesh2Motion's `Death_D` and `Hit_Chest` are re-exports of Quaternius without
    an `orig`: the census now finds such a clip's original by pose with the original read at the rate the re-export
    plays it (Mesh2Motion plays library 1 at 0.8 of its speed; REEXPORT_NEAR 80 mm, the declared copies sit at 47–65),
    and `Hit_Chest`, whose export floats 59 cm above the floor its whole length, is left out (`$skip`). Reactions: 35
    unique (the floor stays 33, D66).
  - **Floating falls.** A CMU take whose feet don't show its floor stood on the floor of the subject's other takes,
    23–25 cm off for subject 90's falls. It now stands where its feet stand while the body is upright (the hips at 0.8
    of their tallest above the feet: before a fall, after a get-up, a ledge jump's lower level), else on the floor its
    whole body shows (`@m3a/io` cutPicks). The falls start on the floor; some get-ups' lying parts dip 10–16 cm below
    it (Lie_Down's 24 cm), as their captures put the lying body below where the feet stand. `Fall_On_Face` is a dive
    (its hips rise to 1.6 times standing height): its description says so.
  - **Repairs that moved a point too far.** A repair, and a re-import kept for a better verdict, may now also move no
    point more than WORST (30 mm) further from its source at its worst; `_import.json` keeps the fit before a repair
    (`unrepairedFit`). 110 clips are repaired (148 before), 38 held back by the new guard (their twist flips stay,
    with that reason); of D66's 8 walks only Tiptoe_Walk is kept by the relaxed rule. Fails 139 → 155.
  - **Combat.** Two clips that hold the same pose still count once whatever their lengths (STILL, 10 mm): a held aim
    and a held idle. Combat 61.
  - **Reasons.** A warn's reason no longer says "unusual, not broken": it is short of every fail level the sensors
    apply, and every reason names the metrics its tags' profile turns off ("not measured for its tags:
    bodyPenetration, intersection" on a get-up). `qa library --check` now compares each clip's whole reason with what
    `library/baselines/qa.json` and the writer's record give, and names a set's reason when no clip in it fails.
  - **Schemas** for `library/baselines/qa.json` and `distributions.json` (`tools/qa/*.schema.json`), checked on read;
    tests for the repair guard and the choice rule, the census's new rules, the summary, and the floors against
    PLAN.md's; `npm run qa -- library` is in AGENTS.md's table.
- **Answered, not changed:**
  - Categories by first tag: a hurt or dizzy idle is a reaction a game plays after a hit, a talking idle a gesture, a
    sitting idle or an exercise interaction; the rule is coarse and written down (`CATEGORIES`).
  - Two levitations count as combat through `magic`: in this library magic is a fighting style. A combo that strings
    two sword attacks is its own motion. Left and right mirrors (a dodge, a strafe) both count: a game needs each.
  - Subject 77 and 139 are the same files at 60 and 120 fps in CMU's index; the two picks from 77 left
    (Duck_Thrown_Object, Creep_Limp_Loop) keep the index's 60, and no new pick takes a file another pick shares.
  - Repairs may raise another metric short of its warn level (a slide 34 → 93 mm): `fix` refuses a step that pushes
    any metric past a level (WP-3.5).
  - The acrobatics profile turns bodyPenetration off, so a get-up's knee 10 cm under the floor isn't measured: the
    reasons now say so; a profile that measures how deep a contact goes is the sensors' next change, not G5's.
- **Why:** the floors count what a game can use; a duplicate capture, an unlinked re-export or a floating clip
  counted where it shouldn't, and a repair kept for its verdict at a point's expense trades the motion for the number.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.35.1

## D68 · 2026-10-12 · G5 passes at 754adfe; what its verifier left open

- **Principle:** 3, 8, G5, D66, D67
- **Call:** G5's commands passed at 754adfe (12 of 12, 9.7 min; `bench/results/gates/G5/`), and its verifier's second
  round found nothing blocking: the six new get-ups are takes no pick shares and distinct by the census's own measure,
  the falls start on the floor, every repair keeps both guards, all 385 baselined reasons are what `verdict.ts` gives,
  and the numbers in D67, the ledger and `docs/LIBRARY.md` match the data. G5 passes. Its open items, fixed forward:
  - **Floating since D67's floor rule:** a take whose feet don't show its floor stands where its feet stand while
    upright over the whole take, which lifts `Shoot_Bow` 55–73 mm off the floor (take 79_86) and four others 17–31 mm;
    nothing in the sensors measures a clip floating. Next: a float check, and each pick stood on its own stretch.
  - **Floors met by one or two under the tag rule** (combat 61, gestures 61; reactions 35 counting two tired rests):
    the verifier reads the levitations as not combat. Next: CMU picks for combat and gestures, so no floor rests on
    those readings.
  - **Notes, answered:** a bare `pass` doesn't say which metrics its profile turned off (only baselined reasons do;
    three get-ups would fail bodyPenetration if it were measured, the sensors' next change, D67); D67's "four of the
    six" second takes is six of six; `Pistol_Idle_Loop`'s description says held low where it is held up; D63's base
    choice rule keeps a re-import whose mean doesn't get worse whatever its worst (seven are 30 mm and more worse at
    worst), as D63 disclosed.
- **Why:** the gate's bar is met and checked twice; what is left makes the library better, not the gate true.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.35.1 (the record), the fixes after

## D69 · 2026-10-12 · G5's open items: a float check, picks for combat and gestures

- **Principle:** 3, 8, G5, D67, D68
- **Call:** D68's open items, fixed forward:
  - **A float check** in `npm run qa -- library` (`tools/qa/library.ts` `FLOAT`): a stretch of 1 s or more where the
    body stands upright (hips at least 70% of H0) with both soles more than 4.2% of H0 off the floor (40 mm on a
    950 mm H0), read every 1/30 s, in a clip whose tags don't put it in the air (air, fly, swim, climb, jump), fails
    unless `library/baselines/qa.json` `floats` answers it; an answer whose clip floats no longer is named. Three clips
    float by it, each answered: `Ballet_Pirouette` and `Stretch_Yawn` rise onto their toes (the hips rise with the
    heels), and `Shoot_Bow`'s take 79_86 holds the left heel 60–70 mm up throughout while the right toes touch down at
    3.5 s, so no one floor stands both feet. The other four D68 counted float 17–31 mm, under the check's level.
  - **Each pick on its own stretch:** not built. `Shoot_Bow`'s pick holds the stretch where its right toes touch down,
    so its own floor is the one it has; build it when a float the check finds needs it.
  - **Picks for combat and gestures** from takes no pick shares and no take repeats byte for byte: `Swordplay` (02_08),
    `Boxing_Flurry` (79_08), `Backpedal_Punch` (76_01), `Explain_With_Hands` (19_08), `Angry_Quarrel` (18_11). Combat
    64 and gestures 63 unique, so neither floor rests on the levitations. A sixth, the traffic director's wave of
    13_27, was dropped: it ties `Wave_Hello` for "flag down a rescue helicopter" and puts the held-out answer sixth.
    Picks from subjects 2, 18 and 76 refit those subjects' rests (`Walk_Loop`, `Sword_Lunge` move 1–4 mm in fit).
  - **A catalog that names a key twice** is refused (`duplicateKeys`): a sixth pick first reused `Direct_Traffic` and
    JSON.parse kept the last without a word.
- **Why:** the floor rule that fixed D67's falls could lift a take where nothing measured it; a check and three
  answers keep that seen. The floors stand on clips the verifier reads as what their tags say.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.35.2

## D70 · 2026-10-12 · Recipes: clips made from clips (WP-6.1)

- **Principle:** 1, 3, 4, D10, D32
- **Call:** a recipe is JSON (`spec/RECIPE.md`): an id and description and a list of steps, each one operation on
  library clips or on earlier steps by name. Fifteen operations: `clip` (slice, loop), `sequence` (crossfades, in step
  on the contacts), `blend` (time-warped, a weight or a curve), `layer` (mask, weight, additive), `mirror`, `retime`
  (speed, length, ease), `pose` (deltas over a span), `look` and `pin` (IK), `exaggerate`, `smooth`, `overshoot`,
  `stiffen`, `events` and `contacts`. `recipe.compile` (`@m3a/core`) runs the steps on tracks (frames every 1/fps s,
  roots composed so travel never jumps), fits keys within 30 mm the way an import does, and writes a format-2 clip
  whose provenance is `composed`/`composite` with the recipe's SHA-256 (canonical JSON) and its inputs' content ids,
  under the license its inputs force (D10). The same recipe and inputs give the same bytes. `validateRecipe` gives
  coded issues R-E001–R-E007 with where and a fix; compiling adds R-E008 (an unknown clip, the nearest named) and
  R-E009 (a time past its track). `describeRecipe` says it in one line, at most 100 tokens.
  - **Blending over time keeps each angle's gap** from the other track on the frame before, and every track keeps each
    angle at the turn nearest its frame before: a short-way blend flipped half a turn where two clips' angles came
    180° apart (Mesh2Motion's hands at ±180° roll against a clip with none; 100STYLE's `BigSteps_Walk` winding its
    foot heading as the foot points down), and the sensors read a turn as a jump. Two loops blended in step take the
    pelvis, legs and feet from blended points (a foot both plant stays down), the steady numbers choosing the reading.
  - **One rest:** a recipe's poses are read on its first clip's rest; another source's clip is read on it as is, so a
    CMU walk into a 100STYLE run sank a foot 51 mm; the example uses 100STYLE's walk, and the sensors judge the rest.
  - **The schema:** `spec/schemas/recipe.schema.json`, a stub frozen at G1 (D32: "stub until Phase 6"), now gives
    every operation and its fields; a test holds it to `OPS`. This decision allows the change, and the freeze is rerun.
    WP-6.1's entry named `spec/schemas/recipe.json`; it is the stub's name, and the entry now says so.
  - **Done when:** every operation has tests (`packages/core/test/recipe.test.ts`); the 20 example recipes
    (`spec/recipes/`) validate and their clips pass the sensors, and each is explained in at most 100 tokens by o200k
    and cl100k (`packages/sensors/test/recipe-examples.test.ts`).
  - **Limits, on record:** two loops whose angles wind a turn apart over a cycle (100STYLE's `Strutting_Walk` arm twist,
    already a warn in its source) can't blend into a loop without a seam, and a foot pointing straight down can still
    turn its heading between keys; the sensors report both.
- **Why:** a recipe is how an agent makes the clip the library lacks without keying it: text it can write and a person
  can read, compiled into the same format every tool already checks.
- **Verifier, round 1** (at 85dc149): not done. 10 of 14 one-line mutants passed the tests, and untested paths hid
  bugs. Fixed in v0.36.1, every finding:
  - **Tests:** every operation's test now fails its mutant (the ease's midpoint, a blend reaching `b`, an additive
    layer's change, a pose yaw, merged contacts, the elbow's side, the neck's limit, a mirrored turn, a sequence
    started mid-stride, an overshoot that never lags); all ten mutants fail.
  - **The heading:** a sequence turns each next item's body (`body[0]`, and the pelvis's place) by the heading the
    root has reached, as `MOTION.md` §5.3 has a pose carry it; a pose `yaw` turns body and root together; a loop whose
    first root is turned closes on it (`nextCycle`), and repeats its cycle in that frame.
  - **Contacts:** a loop's contact over its seam stays one interval that wraps (`MOTION.md` §7.1) through every step
    and the compiler (556 of the library's 1,028 loops have one); `contacts` merges round the loop and labels all.
  - **Blends and retimes that can't loop play once:** a curve ending elsewhere than it starts, two loops read out of
    step at different lengths, an ease (which stalls at the seam).
  - **`sync` only on a step:** a foot planted since its clip began, or one the next item never lifts, sets no phase
    (a jab into a cross played 0.88 s into the cross).
  - **Inputs:** the clips the last track is made from, the one whose rest it decodes on first; `src`, `orig`,
    `restSrc`, the license and the default `desc` follow it.
  - **Checks:** every time a step gives (R-E009, events before 0 too); JavaScript's own names (`toString`,
    `constructor`) are no operation, field or part; a pose has no `root`; event names are a clip's; an empty mask
    and unsorted curves and paths are refused; every issue has a fix; `s1`-style names are refused by the schema too.
  - **`describeRecipe`** counts tokens (`tokenCount`, no fewer than cl100k or o200k), tested on a ten-step recipe.
  - **`pin`** turns the elbow or knee with the limb's swing and, as the limb straightens, bends it the way an elbow
    or a knee bends (a straight leg's knee wandered 30 cm).
  - **`RECIPE.md`** matches the code; a content id is the SHA-256 of the clip as `serialize` writes it.
  - **Notes:** four examples became chained ones and three descriptions were corrected. A recipe clip with a
    compound license (`CC-BY-4.0 AND LicenseRef-CMU-Mocap`) has no set tier: such a clip enters the library only in
    a set of the stricter tier, when a WP adds recipe clips to it.
- **Verifier, round 2** (at e568fba): not done. All ten round-1 mutants failed, but 15 of 40 new ones passed, and two
  bugs were blocking. Fixed in v0.36.2, every finding:
  - **A pose yaw turns the way the character travels**, each frame's step taken the way it then faces, a loop's cycle
    from where the turned travel got to. Before, the travel went straight on while the closing key turned: a crawl
    turned 90° jumped at every seam (11 %H0 in 1/120 s; a ducking clip looped, 107). In a sequence an item's own first
    turn now turns it from where it starts: `[crawl, crawl yaw 60]` went toward −60° facing 0°, and now goes and faces 60°.
  - **`describeRecipe` ends:** past the first cut each cut changed nothing, so a long id looped forever. It now cuts the
    first step's text and keeps the count of the rest. `tokenCount` was no upper bound: it undercounted 249 of 486
    lines of library ids. It now splits words at their capitals and counts an upper-case run a token every two letters,
    a lower-case run one every three. A test holds it at or over o200k and cl100k on every example and on the long and
    made-up cases (random letters can still count higher).
  - **A curve blends the legs as points**, as a number does: a constant curve popped at the seam where the same
    number only warned. A curve's times are `a`'s, stretched with the result (one reached 1 halfway through).
  - **A loop that now plays once keeps both parts of a seam contact:** an unwarped or unclosed blend, an eased retime,
    and a layer under a once clip each dropped one.
  - **`sync` reads a loop's plant over its seam** from where it began: three walks faded over 0.5 s fell a step behind.
  - **`pin` reaches at most 98.5% of an arm, 99.8% of a leg:** a hand pinned to full reach flipped its twist (141°).
  - **Times are coded:** a slice that leaves none of a clip, and a seam blend longer than the clip, threw uncoded
    errors; they are R-E009 now. A contact's end is checked as an end: within a once track, or wrapping a loop's seam
    by up to a cycle, which `MOTION.md` §7.1 allows and the check had refused. 0.36.1's "every time checked" and
    "every issue has a fix" were false (15 issues carried no fix, or one only with a near name); both hold now, tested.
  - **Records:** the schema refuses a pose `root` as the validator does (refrozen under D70); Jab_Cross_Combo's second
    hit moves to 1.3 s, where the cross lands (at 1.0 the fist was at guard); two descriptions say the upper body,
    which the `upper` mask moves, not "arms and chest".
  - **Tests:** the 15 surviving mutants and 26 more of the new code, 66 in all, each fail `npm test -- recipe`.
- **Verifier, round 3** (at 8076745): done, nothing blocking. Its round-2 repros, a fuzz of 1,500 recipes and 3,000
  descriptions over library ids all hold. Three should-fix findings and four notes, fixed or answered in v0.37.1:
  - **Two travelling loops facing apart blended with a seam jump:** the cycle was lerped in each loop's own frame
    while the frames' roots were lerped as they are, so a crawl turned 90° blended with the plain one ended its frames
    at (71, 71) and started its next cycle at (100, 100). The cycle is now the blend's own, from its first root to where
    the next cycle starts. In step, each loop's time is read on past its seam from where the blend starts in it, so a
    loop that travels and steps (a procedural gait, D71) never jumps back a cycle mid-blend.
  - **Tests:** of the verifier's 41 new mutants, 21 passed; 36 now fail, among them REACH, LEG_REACH, the bend hint's
    reach, the turn taken halfway through a frame, stacked yaws and sideways travel. Five pass for a reason:
    - The 1 ms slice check is equivalent to `<= 0`, since the length is rounded to the millisecond first.
    - The four `tokenCount` mutants each loosen one coefficient. The count's job is an upper bound for ids not yet
      written, so its coefficients carry a margin: a test holds it at or over o200k and cl100k on every library id, the
      examples and made-up words, and at most 1.8 times over on the examples.
  - **The yaw's fix hint said "+ to the left";** the format's yaw is + toward the right (`MOTION.md` §5.3). The hint
    and `RECIPE.md`'s `pose` row now say so.
  - **Notes:**
    - A yaw held from a clip's start shows only in clip space, since a host reads root motion from the first key;
      `RECIPE.md` now says so, and says to turn part of a clip or an item of a sequence instead.
    - `describeRecipe` threw on a recipe not yet checked; it now names a step it can't read by its op.
    - An id of random letters can still count more tokens than `tokenCount` says; its doc comment says so.
    - The ledger counts both test files: 28 tests.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.36.0, v0.36.1, v0.36.2, v0.37.1

## D71 · 2026-10-12 · Procedural sources: one move model, gaits and idles (WP-6.2)

- **Principle:** 3, 4, 5, 8, 10, 12, D10, D32
- **Call:** `@m3a/core`'s `procedural` namespace makes format-2 clips (`method: procedural`, CC0, `ai:
  algorithmicMedia`) from three sources, each on any rest from any start pose. None runs inside `Animator.step`.
  - **One move model, as data:** `library/moves.json` holds 31 moves: my-3d2dge's `E.MOVES` (24; WP-6.2's entry said
    25 and now says 24) and shardfall's seven others, each with shardfall's `about` line. `node
    tools/procedural/carry.ts` writes it from the pinned sources. The three unit systems become one:
    - angles in degrees;
    - reach in arm lengths (my-3d2dge's units over its 9.2-unit arm);
    - heights, lunges and hops in % of the hip height (my-3d2dge's units over its 11.6; shardfall's metres at 0.0529 m
      a unit), a kick's height as % too;
    - times in seconds.

    Two names change: my-3d2dge's `spin` is shardfall's `spinslash`, and shardfall's own `spin` becomes `whirlwind`.
    `spec/schemas/moves.schema.json` gives the shape; it joins the frozen set under this decision, and the freeze is
    rerun. `validateMoves` checks MV-E001–MV-E008: a name used once, an alternate that names a move in the file, a
    height on the ground plane only, a kick on it.
  - **The differential:** `moveState` and `placeMove` reproduce my-3d2dge's hands, blade tip and kicking foot on its
    three builds against `spec/vectors/frozen/moves.json` (216 records × 21 samples × 4 points): mean 0.0018 cm,
    worst 0.012 cm, against a bar of 1 cm and 3 cm. There are no exceptions.
  - **Settle and raw:** the frozen numbers are the source's raw targets, which its rig eases each frame. A clip uses
    `settle`, every phase eased in and out, so nothing changes speed where two phases meet. The wind, strike and
    recovery last at least `MIN_PHASE` (0.25, 0.2 and 0.45 s): the source's are shaped for a game that stretches them
    round the hit (shardfall's stir winds up in 0.05 s).
  - **From any start pose:** `moveClip` places the model's numbers on the rest's body and applies them to the start
    pose's points (the standing pose by default).
    - The first and last keys are the start pose: each frame is blended from it over the first and last 0.1 s (twists
      unwrapped from the frame before), and the first and last frames are the start pose itself, its angles rounded
      before they are unwrapped and the fields it leaves out at their defaults. A move begins and ends exactly there,
      0.000 mm from 88 library poses, straight limbs and a `spine` field (rounds 1 and 2).
    - As the recovery lets go, the arms (and a kick's leg) come home. Without that, the IK left elbows up to 11 cm from
      where they started.
    - The limbs are solved by the recipes' two-bone IK on the body as the format holds it (encoded, then decoded). A
      torso twisted and leaning that far is held by the chest's and shoulders' parts within their ranges, and the
      shoulders it holds were up to 18 cm from the points' (Mesh2Motion's bash; 13 on 100STYLE, 2 on CMU): an arm
      solved on the points came out straight.
    - A punch's free hand guards the chin (`guard`). The lead foot steps lifted, on its own clock. A `hit` event falls
      where the strike connects.
  - **Gaits**, after riftlight's "zero foot slide by construction":
    - A foot stands still in the world through its stance: in the root's frame it slides back at the ground speed.
    - In swing it lifts straight up to 9% of H0, past the 7% a lifting foot is read as lifted at, however short the
      swing (round 2), and later sets straight down from 4.5%, above the 4% a foot is read as standing within, both
      still in the world. Between, it
      travels on a Hermite curve. Without the rise, a slow swing's foot read as planted while it still moved: up to
      39 mm of slide (round 1 gives the lift-off's height).
    - The root and pelvis are put on the format's grid before the feet are aimed. Each leg's numbers are whichever of
      81 roundings lands the ankle nearest where it landed, and the keys are fitted within 2 mm.
    - Its parameters are speed, cadence, stance, lift, bounce, dip, sway, lean, arm swing and limp, each taken in the
      range the presets pass on three rests (lift 9–35, bounce 0–6, dip 0–12, sway 0–4, lean −10° to 25°, arm swing
      0–80°); a swing under 0.2 s is refused (round 2; under 0.25 s from round 5, 0.26 s from round 6). A limp shortens
      the weak leg's stance by up to 30%; that leg lands later and the other stands longer, keeping the plain gait's
      double support. Without that, neither foot stood just before the strong foot landed.
    - `GAITS` gives four ready made: walk, brisk, run and limp. On three rests (Mesh2Motion, 100STYLE, CMU) they slide
      at most 7.8 mm per contact and none fails; on all 64 of the library's rests (set and source pairs, 62 distinct)
      none fails and one reads over 10 mm (round 1; 10.1, the limp on CMU_31). The origin's gait slid 12–28% of body speed; capture's median is 52 mm. The run passes on the
      three rests and on 63 of 64 (round 4; it warned of a knee before round 3).
  - **Idles:** the body breathes (the chest lifting, leaning back a touch, and the shoulders rising) and shifts its
    weight (the pelvis swaying over the standing foot, the chest leaning against it) on planted feet. The loop holds
    whole breaths and one shift. `IDLES` gives two, breathe and fidget; both pass on three rests, sliding 1.1–3.7 mm.
    The format keeps the pelvis's place in whole % of H0, so the default sway is 2%.
  - **The API:** core's cap of 40 names (WP-2.6) rises to 44 for Phase 6's namespaces, one name each: procedural now,
    actions and graphs to come. WP-2.6's entry says so.
- **Limits, on record:** the moves, per rest:

  | Rest | Pass | Warn | Fail |
  |---|---|---|---|
  | Mesh2Motion | 5 | 18 | 8 |
  | 100STYLE | 10 | 17 | 4 |
  | CMU | 9 | 15 | 7 |

  - **A hand or arm into the body by about two of its widths** (the sensors' unit is the thinner part's width; they
    read 1.6–2.1): slash, backslash (the upper arm; on CMU the forearm, into the belly), plunge, twohand, bash, stir
    and stir_back. Their arcs, drawn for a stick figure, cross the body.
  - **Pops and a flip:** twohand's off arm pops, jitters and flips its twist (177°) as the grip swings over;
    haymaker's lead knee pops as it steps in, and bash's on CMU; plunge's hand snaps round on CMU.

  `packages/sensors/test/procedural.test.ts` holds them as a floor, by reason: no other move fails, a listed move
  fails for no other reason, and at least 23 of 31 pass or warn on each rest. Off those three rests, on five more:
  roundhouse's knee doubles back as the kicking leg folds and comes down (88 mm, on Mocopi's and UAL1's rests), and
  overhead, leap and claw put the hand into the hips on two CMU rests. On all 64 rests (round 2's verifier, at
  a1dc1fd), 50 have a failure outside the floor's reasons: claw on 14, roundhouse 15, overhead 8, leap 5, uppercut 3
  (Quaternius'), thrust 2, jab 1, rising 1, and twohand's arm into the belly on many CMU rests. The fewest that pass or
  warn on one rest is 19 of 31 (CMU_141, 12 failing). The floor is the three test rests'; the rest are on record.
- **Why:** the library holds what was captured, but a game asks for a slash on its own character, from where the
  character stands. The move model is the one three repos already shared. It is now one unit system with a line per
  move, so an agent picks a move by its line and gets a clip the sensors have read. Gaits and idles fill the loops a
  graph needs, on any body, without foot slide.
- **Done when** (`npm test -- procedural`):
  - the differential is within 1 cm mean and 3 cm worst (0.012 cm worst), with no exceptions;
  - every move begins and ends at each of two start poses on Mesh2Motion's rest and one on 100STYLE's, and ten moves
    at each of five more (straight arms, straight legs, a curled spine, a walk's and a crouch walk's middles);
  - the gaits slide at most 10 mm per contact on three rests;
  - `moves.json` has the schema's shape and checks clean.
- **Verifier, round 1** (at 2bfe276): not done. The differential and the units held, but two Done-when claims held
  only for the inputs the tests used. Fixed or answered in v0.37.2, every finding:
  - **A move begins and ends at any start pose:** straight arms began 56 mm off, straight legs 23 mm (start and end),
    a `spine` field 54 mm, a walk's middle 63 mm and a crouch walk's 36 mm. `posed` re-solved every limb, frame 0
    too, with the IK's reach short of straight, and dropped `spine`. Each frame is now blended from the start pose
    over the first and last 0.1 s and `spine` is kept; a test holds every move from three starts and ten from five
    more (straight arms and legs, a curled spine, two library poses) within 1 mm at the first key, 2 mm at the last.
  - **The gaits slide at most 10 mm over their range, not only the presets:**
    - As the swing starts the foot stops going back with the ground and comes forward, and for a moment it moves with
      the hips, which the sensors read as a dragged foot, standing, while it is under 7% of H0. It lifted to 4.5%, so
      a frame that fell there added about 15 mm. It now lifts off to 9% in at least 0.08 s (its share of the swing no
      more than a leg trailing 70% of its length allows; a run's is shorter and lower) and sets down from 4.5%.
    - A run's knee popped where the swing's curve overshot the leg's reach. A swinging foot's target is now held softly
      within the reach, the pelvis dips for the set-down's lead too, and a stride past 75% of a leg ahead and behind is
      refused with what to change. So is a lift under 9% (a foot that never reads as lifted) and a limp that leaves a
      foot under 15% of the cycle to swing (stance 0.8 with limp 1 never swung the right foot). The run preset is 350%
      of H0 a second: 380 reached 75–77% of a leg on three CMU rests.
    - A planted ankle is held where it landed through the rounding: each frame's leg numbers are the 81 roundings'
      nearest, judged as the key will be written.
    - Measured: the presets on all 64 rests, 256 clips, none failing and one over 10 mm (the limp on one CMU rest,
      10.1); the verifier's grids on three rests, none failing but one run (seam velocity): walk 2 of 248 over 10 mm
      (worst 11.0), run 0 of 96 (66 refused), limp 2 of 145 (worst 11.2; 35 refused). What remains is the format's
      precision: a leg's direction in hundredths moves a planted ankle about 4 mm from rounding to rounding, and the
      sensors read a contact's drift from its first frame. Aiming the sole's points as well changed nothing.
  - **Contacts are the model's** (`by: "labelled"`), each foot from its touchdown for its stance: detected by height
    alone, a low lift's feet read as standing all cycle, and a default one's ran 40–90 ms into the swing.
  - **The moves file:** `hold` is above 0 and at most 0.95, as shardfall clamps it (0 made NaN, 0.99 snapped the arms
    home), in the schema and `validateMoves`, and the model clamps it too. A kick on the side plane is MV-E008 (my-3d2dge
    plays kicks on the ground plane). An `about` of spaces is refused, and a null or object `height` is MV-E002, a type
    error. The schema is refrozen under this decision.
  - **Start poses:** a leg whose start knee points back (a straight leg, its twist turned round) starts from its knee
    turned to the front. From the arms-up idle 29 of 31 moves bent a knee back; 6 now fail. From five non-standing
    starts (arms up, two crouches, a fighting idle, a crouch walk) 4 to 8 of 31 fail, mostly an arm already raised
    flipping its twist as the arc swings it. The moves are drawn from a standing body; a graph blends any remainder.
    (Round 2: from STYLE100_IDLE's Crouched_Idle 16 of 31 fail, and from BentKnees_Idle 25 of 31.)
  - **The idle's breath shows:** the format holds the bones' directions, not their lengths, so the torso's
    lengthening never reached the keys, and lifting the collarbones with the shoulders shrugged nothing. A breath in now
    leans the chest back 1.5° and lifts the shoulders 0.8% of H0 for each unit of depth: the keys' `chest` and `sh`.
    The chest's lean against the weight shift went with it; it now tips away from the standing hip.
  - **Records:** the reasons above (two widths, not 2 mm; 18 cm, not 13; 11, not 23; the run's pop in the swing);
    1.1–3.7 mm for the idles; the core index's cap is 44; WP-6.2's entry says a standing pose by default.
  - **Tests:** the floor matches each failing move's findings to its reasons; a test holds the seven shardfall-only
    moves to their source's numbers; `npm run moves -- --check` is in G6's command set (the gate fetches the pinned
    sources). Of the verifier's 38 surviving mutants, 33 now fail the tests (the guard, the step, the wind's easing,
    the arm swing and lean, the limp, the torso's clearance, the crouch's lean, the spin's way, the breath, the checks,
    the kick's arms, the seven moves' units). Five pass for a reason: the pelvis put on the grid (GA9) and the leg snap
    searching two of its four numbers (SN2) are made up by the second pass, which aims each planted ankle after the
    pelvis is rounded; without the idle's foot IK (I7) the snap still puts the ankles where the start pose has them; the
    hips' twist factor (MM1) is read by nothing; and no move in the file tells fists that ignore `left` apart (MM6).
    Eleven mutants of this round's fixes all fail them. The verifier's harness ran the sensors' tests on the main
    tree's core (its `node_modules` link), so a mutant only they could see passed there; those were rerun in place.
- **Verifier, round 2** (at a1dc1fd): not done, one blocking finding. Fixed or answered in v0.39.1, every finding:
  - **A swing under about 0.21 s dragged** (blocking). The lift-off took at least 0.08 s to reach 9% and its share
    was capped at 0.3 of the swing, so a short swing's foot was under 7% when it moved on; and the sensors read a foot
    up for under 0.1 s as never having left the floor. Limps on a 1 s cycle and fast walks slid 500–1,300 mm (82 of
    459 limps on the verifier's grid). The lift-off now reaches 9% however short the swing (quicker), and a swing
    under 0.2 s is refused with what to change: on the grids every swing of 0.19 s or more passes, every shorter one
    failed. Limps (540 on three rests, 171 refused) and fast walks (144, 27 refused) now have none failing, worst
    10.6 mm.
  - **Numbers that broke a clip:** a lift of 60 failed all four presets (knee pops), 40 the run, a sway of 5 the run on
    two rests. Each optional number has the range the presets pass on three rests, refused past it with why.
  - **Begins and ends exactly:** 3 of the verifier's 88 library starts were 3.0–3.3 mm off at a first or last key: a
    field ending in .5, blended by a hair, or a twist unwrapped a turn on (−5.5 against 354.5), rounded the other
    way. The first and last frames are now the start pose itself: all 88 starts × 31 moves are 0.000 mm at both ends,
    and a test holds those three.
  - **The soft reach did nothing:** round 1's swinging foot held within the leg's reach (for the run's knee) changed
    no result on 496 gaits (the presets on 64 rests, the lift grid and 132 others): refusing a stride past 75% of a
    leg already keeps the feet within reach. It is removed.
  - **Records:** off the presets the gaits slide up to 12.7 mm (a walk on CMU at 115, 1.05 s, 0.6), not 11.2; "held
    where it landed" is within the format's rounding, about ±4.5 mm frame to frame, as the gait's header now says; the
    moves on all 64 rests and the crouched starts above; the `ProceduralOptions` doc gives each source's rate and
    budget; the boundaries check's comment says 44.
  - **Tests:** the surviving mutants that mattered now fail them: the set-down and lift-off held in the second pass,
    and the second pass itself (gaits held to their slide, 5 to 9 mm); the limp's refusal and range; 60 fps; the
    limp's 30%; the presets' numbers. A T1 test (`tools/procedural/carry.test.ts`) derives every number of
    `library/moves.json` that my-3d2dge's frozen moves give, so a hand edit to a guard, a hit share or a reach fails
    it, and the whole file where the pinned sources are. Without them `carry.ts` says to fetch them, and G6 fetches
    them before checking the moves (its label said it did). The about lines and the alternates are shardfall's, so
    only that second test and G6 see an edit to them.
- **Verifier, round 3** (at 9ad1b39): not done, one blocking finding, older than round 2 (a1dc1fd gives the same
  numbers). Its grids had cycles on 0.05 s and changed one number at a time. Fixed or answered in v0.42.1, every finding:
  - **A loop didn't meet itself at the seam** (blocking). Each knee is carried on from the frame before, so over a
    cycle its turn about the leg drifted (3° on a walk, 8° on a run, 22° on a run lifting 35% and swaying 4%), and the
    first frame, from the start pose, didn't meet the last. And on the frame grid a cycle off it left its last frame
    1 to 16 ms before the seam, where that step, or a pelvis rounding a whole % of H0, read as a pop. Within 50 ms of
    the presets' cycles 326 of 1,212 clips failed at the seam on the three rests; a run lifting 35% and swaying 4%
    failed on all 64 rests (237 of the 1,280 combinations of the ranges' ends). The frames are now spread evenly over
    the cycle, and the frame after the last says how far each knee drifted, taken back a share at a time over the
    cycle: a turn about the leg moves no ankle, so the feet are where they were (the presets on 64 rests are as before,
    none failing, worst 10.1 mm). The elbows come back by themselves (0° on every preset). Now 0 of the 1,212 fail,
    and 0 of the 1,280. Off the frame grid a clip's keys fall between the sensors' frames, which read the in-betweens:
    the worst slide there is 14.2 mm (a brisk walk of 0.997 s on 100STYLE; 6.8 before), on the grid 12.5 as before.
  - **A long fast stride popped a knee mid-swing.** At 0.2 s of swing, a stance of 0.75 at 140% of H0 a second failed
    on 12 of 64 rests (CMU's and Quaternius'), at 0.95 s on 1, and at 160 on two of the three. A grid by how fast the
    swinging foot comes forward past the hips (its stride over its swing: the speed times its stance over its swing,
    whatever the cycle), 36 gaits on all 64 rests, read none failing at 402 and under; at 420 the stance of 0.75 failed
    13 of 128, while stances of 0.7 and 0.65 at 420 to 427 and a full limp at 457 passed. A foot faster than 400 is
    refused with what to change (a lower speed, a shorter stance, a lighter limp); the presets' fastest is the limp's
    strong foot, 299. Off the frame grid, swings of 0.17 to 0.30 s (1,596 gaits on three rests): 450 refused, 3 failed
    (each that knee pop, now refused; at 9ad1b39 132 of 886 failed), worst slide 13.5 mm.
  - **Records:** "every swing of 0.19 s or more passes" (round 2) held for its grids only: it is a swing of 0.2 s or
    more, at most 400 a second past the hips, now measured as above; the ranges' ends hold together too, not only one
    at a time; off the presets the gaits slide up to 14.2 mm, not 12.7.
  - **Tests:** the frames' spacing and each knee's twist across the seam (a run of 0.705 s, a walk of 1.102 s, a run
    lifting 35% and swaying 4%); those three on the three rests under the sensors; two swings of 0.2 s held to their
    slide (7.6 and 13.1 mm on 100STYLE, bars 9 and 14: lifting off as round 2 did, they slid 500 to 690 mm, a mutant
    no test saw); the swing's speed, the dip's and the lean's ranges refused. Of seven mutants of this round's fixes and
    the verifier's survivors (the frames on the grid, no closing, no cap, round 2's lift-off, any dip, any lean), six
    fail them; the seventh, the elbows left out of the closing, changes nothing, so the closing is the knees'.
  - **D74's loose ends:** WP-2.5's Verify says T1 reads every third loop and `M3A_FULL=1` or T2 all; AGENTS.md's T2
    row and G6's e2e step name the sweeps; T1 back within its budget is D77's.
- **Verifier, round 4** (at 2eb0a1f): not done, two blocking findings, both round 3's claims measured at the default
  lift and the presets' cycles only. Fixed or answered in v0.42.3, every finding:
  - **A high lift on a short swing popped a knee** (blocking): lifting 20 or more in 0.2 to 0.22 s of swing, 199 gaits
    failed (R1: speed 120, cycle 0.5, stance 0.6, lift 25; R5: a stance of 0.75 at 0.8 s lifting 35). A lift over 12
    now needs a swing of 0.25 s: lifts of 16 to 35 at swings of 0.25 to 0.3 s, walks and limps, 660 on the three rests,
    and walks, 1,024 on all 64 (0.25 s, lifting 25 and 35), none fail (worst slide 12.2 mm).
  - **Short-cycle runs failed at the seam** (blocking): a run of 0.4 s lifting 25 failed on all 64 rests (R3), and
    under 0.5 s the verifier's grid failed 4 to 100%; the seam fell where the swinging foot accelerates hardest. A run
    (a stance under half) now needs a cycle of 0.6 s (200 steps a minute), and 0.65 s lifting over 25 (a run lifting
    35 and swaying 4 failed its seam at 0.6 and 0.625 s on one of three rests). Runs of 0.6 to 0.7 s on three rests,
    148 played, none fail; at 0.6 s on all 64, 128 none; lifting 35 at 0.65 s on all 64, 187 none. The verifier's
    other fix, the loop's origin at a calm phase, wasn't taken: the refusal says what to change, and the presets' run
    is 0.7 s.
  - **An odd number of frames popped a run's left knee** (found measuring that bound): a run of 0.65 s at 4.25 hip
    heights a second, stance 0.3 (39 frames), popped the left knee on 10 of 64 rests, and at 0.6, 0.625 and 0.7 s
    none did. A plain gait's left foot lands half a cycle after the right, so on an odd count it was seen half a frame
    off the right's phases. A gait now has the even number of frames nearest cycle × fps: that run passes on all 64;
    the cycles within 50 ms of the presets, 1,212 on three rests, none fail, worst 14.2 mm as before.
  - **Rates under 60:** at 24 frames a second the run with the ranges' low ends failed on 53 of 64 rests. A gait is
    made at 50 frames a second or more (refused under): the presets and that run at 50 on all 64, 512, none fail.
  - **Starts other than standing:** from 21 library idles (84 clips, each on its rest), 2 failed (brisk from
    `MESH2MOTION/Idle_Talking`, the run from `STYLE100_IDLE/ArmsFolded_Idle`; both before round 3 too) and 26 slid over
    10 mm (25.6, the limp from `QUATERNIUS_3D2DGE/Pistol_Idle_Loop`). The gaits are measured from the standing pose
    (`standingOn(rest)`, the default); from another, these are their limits, recorded, not refused.
  - **Tests:** the verifier's surviving mutants M10 (the knees not closed frame by frame) and M20 (the rate ignored):
    every knee's twist step, the seam's among them, 3° or less on three rests, at 60 and 50 frames a second, an odd
    count made even; the refusals, with R1, R5 and R3.
  - **Records:** "at any cycle" (0.42.1, the ledger) is at the cycles these allow. The cap was measured on walks and
    limps (stances 0.62 to 0.75): a run's feet come forward slower than the body goes, so it reaches the cap only past
    400% of H0 a second (930% at stance 0.3), where no run was measured. Round 3's "stances of 0.7 and 0.65 at 420 to
    427 passed" is where they played: the 0.65 at 230 and 0.75 s was refused for reach on 25 of 64 rests. The code's
    and test's "13 of 64 rests" is 13 of 128 clips on 12 rests. "The run warns" was stale. The cap's message named a
    foot by rounding: it names the right one for a limp, both otherwise. Two docs said a gait's frames were 1/fps apart.
- **Verifier, round 5** (at 8a53245): not done, two blocking findings, each a gait `checkGait` took that failed on many
  bodies; every round-4 number it re-measured held. Fixed or answered in v0.42.4:
  - **A stance of 0.5 near the cap** (blocking): speed 400, cycle 0.45 s (a swing of 0.225 s) failed on 60 of 62 rests
    with 28 frames, a knee popping; at 2eb0a1f, 27 frames, on none. Round 4's run rule refused a stance of 0.49 and took
    0.5; the even count decided pass or fail in this marginal region, as it did the other way for a run of 0.683 s.
  - **Bounce 6 on a short swing** (blocking, older than round 4): a stance of 0.75 at 0.84 s (a swing of 0.21 s) failed
    on 30 of 64 rests, the knees popping at lift-off.
  - **Both answered by one bound:** a swing of 0.25 s or more for every gait, not only those lifting over 12 (which
    rule goes). Every grid either verifier ran at 0.25 s or more passed; at it now, on all 64 rests: a stance of 0.5 at
    350 to 400 and cycles of 0.5 to 0.55 s, 497 played, 2 failing (a knee at 380 and 0.505 or 0.51 s on one CMU rest
    each, where 17 to 20 of the 64 refuse it for reach: the reach bound's edge, recorded, not refused); bounce 6 at a
    stance of 0.75 and swings of 0.25 to 0.275 s, 640, none. The run rule stays (a run of 0.4 s swings 0.28 s and
    fails on every rest); it refuses some runs that would pass, recorded.
  - **Rates over 120:** at 240 a walk failed on every rest (its keys, fitted to 2 mm, pop between frames); at 144 a run
    on 1 of 64. A gait is made at 50 to 120 frames a second; the presets at 120 on all 64, 256, none fail.
  - **Tests:** the refusals at 0.24 s and taken at 0.25 s (lifting 13), the round's repros refused, 240 frames a second
    refused; the sensors' two shortest swings now 0.25 s (10.6 and 6.4 mm on 100STYLE, bars 12 and 8), the sensors'
    test names no longer "at any cycle" or "every rest". Mutant N4 (the lift rule's bound) goes with the rule; N7, N8,
    N11, N13, N14 and N16 move an equality or a bound the grids found passing either side.
  - **Records:** "both feet at the same phases" is a plain gait's (a limp's left lands at its own phase); round 4's
    1,024 on all 64 rests were walks; the worst slide off the presets is 14.4 mm (a limp at 2.5 s, 100STYLE), not
    14.2; the `Gait` type now says what `checkGait` refuses. Round 4's "none of the grids at those bounds fails" was
    true of its grids, not of the bounds: this round's grids are at the bounds themselves.
- **Verifier, round 6** (at e9c0c52): not done, one blocking finding: 770 of the 10,102 accepted gaits it played
  failed, 752 with a bounce of 3 or more. Fixed or answered in v0.42.6:
  - **The bounce drove a far-reaching leg straight** (blocking): the pelvis was lowered for a leg to reach the stance's
    ends at its base height, and the bounce then lifted it twice a cycle, at a stance of a half while the swinging
    foot reached far ahead (a leg at 99.7% of its length against 97.4% without the bounce), and the knee snapped.
    `gaitClip` now samples the cycle and lowers the pelvis until no leg reaches past 98.5% of its length at any phase,
    the bounce, the foot's lift and its place ahead or behind all counted (5 of the presets' 256 clips on 64 rests
    change, the run on five CMU rests; they pass). The verifier's grids rerun: 147 of 8,306 failing, nearly all at 72.5
    to 74.5% of a leg's reach. So the reach bound is 72% (no preset reaches it on any rest), and the grids rerun at
    71.5%: 97 of 8,244 failing, all but 5 at swings of 0.25 to 0.257 s (a stance of 0.5 near the reach bound with a
    bounce). The shortest swing is 0.26 s: at 0.26 s and more, 5 of 5,258 fail (four runs lifting 35 at a stance of 0.2
    with every range end at the reach edge, one run's seam at 0.6 s), recorded, not refused.
  - **Rates over 110:** at 120 a brisk walk with the ranges' high ends popped its elbows on 4 of 64 rests (Quaternius'
    two UAL rests): a gait is made at 50 to 110; at 110 with those ends, 512 on all 64, none fail.
  - **Records:** round 5's "every grid either verifier ran at 0.25 s or more passed" was false (the round-5 verifier's
    own grid held 2 failures at 0.25 s), as was the code's "at 0.25 s and more none did"; its "2 failing at the reach
    bound's edge" was that edge failing far more with a bounce; mutant N13 (a stance of 0.5 read as a run) refused
    exactly where the failures were. The `Gait` doc credited `checkGait` with the reach check, which is `gaitClip`'s on
    the rest given. The ledger and this decision's own call still said 0.2 s.
  - **Tests:** the refusals at 0.25 s, 111 frames a second and 72%; a gait made at 110; the cap's cases at swings of
    0.26 s; the sensors' two shortest swings now 0.26 s (6.2 and 8.0 mm on 100STYLE). The root change (D77): a one-shot's
    sideways speed is spent too, and a loop's flight is still in-betweened (its mutants R6 and R11 now fail the test).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.37.0, v0.37.2, v0.39.1, v0.42.1, v0.42.3, v0.42.4, v0.42.6

## D72 · 2026-10-12 · Actions: multi-beat motions with their ground, beats and interrupt points (WP-6.3)

- **Principle:** 3, 4, 5, 8, 12, D70, D71
- **Call:** an action is a recipe (`spec/RECIPE.md`, D70) with three fields more: `floor`, the ground it ends on (% of
  the hip height above where it starts: a climb +, a hop down −), its `beats` by name, and its `interrupts`, the moments
  it may be cut into another clip, each with the clips it may go on into and why there (`spec/ACTION.md`,
  `spec/schemas/action.schema.json`, which joins the frozen set under this decision; the freeze is rerun). `@m3a/core`'s
  `actions` namespace (core's 42nd name, within D71's 44):
  - **Compiling** (`compileAction`): the recipe on the library and its procedural parts (`PROCEDURAL/<Name>`: a gait,
    idle or move of D71 made on the action's first clip's rest, from its standing pose; a ready-made gait or idle is
    made once a body), an event at each beat's start and one named `interrupt` at each point, and the ground under it
    read from the lowest sole: it rises to a ledge only as the feet leave the floor for good, falls from one only as
    they do. The feet near each end must stand on the grounds the floor gives, within 6% of the hip height (A-E006,
    with the floor they show): the lowest they come within 0.3 s of the end, and of the start (a run or a landing may
    start in the air) except on a drop, where its first frame stands on the ledge.
  - **The root curve** (`actionRootAt`): the clip's travel and turn, and `up`, the ground's height above the start: a
    host plays the clip as any clip and raises the character by `up`.
  - **Interrupts** (`interruptInto`): the action until the point, then the target crossfaded in (0.3 s), in step on the
    feet, raised to the ground there and turned to face as the action faces then; `play` plays only so much of the
    target, a preview of the cut.
  - **Paired actions** (`compilePaired`, `pairAt`): two or more roles, each a recipe placed in the first's frame
    (`[forward, right, turn]`), each started so the event named `sync` falls with the others'. Each role is its own clip,
    so each plays on its own character, whatever its skeleton.
  - **Checks** (`validateAction`, `validatePaired`): the recipe's R- codes, and A-E001–A-E007 (`ACTION_RULES`).
  - **The library's actions** (`library/actions/`), each from library clips: `Get_Up` (CMU's get-up from lying face
    down, turning about a third of a turn), `Climb_Up` (Mesh2Motion's 1 m climb, floor +115), `Vault` (CMU's run and
    jump over, smoothed), `Hop_Down` (CMU's jump off a ledge from its step off, floor −72), `Roll` (Mesh2Motion's dive
    roll, smoothed), `Heavy_Landing` (Mesh2Motion's landing, slowed to 0.7), and the paired stub `Jab_And_Flinch`
    (Mesh2Motion's jab and head hit, the victim 105% of the hip height away facing the jab, met at its `hit`). Its first
    draft took Quaternius' jab, a baselined fail on its own body; Mesh2Motion's passes.
  - **A bug the actions found in the recipes (D70):** a loop's root one float step short of its end read the start of
    its cycle without the cycle's travel (`((t % d) + d) % d` rounds such a time to 0 for some lengths, 1.1 s among
    them), so a sequence ending on a procedural walk jumped back a cycle on its last frame (a climb then a walk ended at
    65% of the hip height instead of 208). The track's time within a cycle no longer wraps twice; a test holds it.
- **Limits, on record:**
  - The climb's source is 0.667 s and ends mid-step, one foot on the ledge: its point says so (the draft said both
    feet). The hop down's later point moved to 1.85 s, where both feet stand (at 2.2 one was 6% up).
  - **The cut clips on the six skeletons** (not the bar: a host crossfades at its own pace at a point): of 84 rows (14
    cuts on six), 41 are no worse than on the clip's own body and 33 fail as played. A 0.3 s crossfade between poses
    that differ pops on the chibi, gen-0 (13 of the 14 cuts are worse there); a walk after a run or a vault slides as
    the speed changes at once (both worse on five or six skeletons); and the climb's walk and breath, raised onto the
    ledge, are read by the sweep on flat ground, where a foot on the ledge never reads as standing.
- **Why:** these are the `E.ACTIONS` my-3d2dge listed and never built, which a game then writes by hand: a motion of
  several beats that moves the character's ground and must be cut cleanly into whatever comes next. As recipes over the
  library they are text an agent can read and change, and the points say where a cut works and why.
- **Done when** (`npm test -- actions`):
  - each action and each role of the pair plays on the six test characters (gen-0 to gen-3, Quaternius' mannequin,
    KayKit's knight), no row worse than on its own body and none failing;
  - each interrupt point goes on into every clip it names, a valid clip the sensors don't fail, read 1.5 s on, with a
    foot on the ground at the point (both where its reason says both);
  - the actions are the schema's shape and check clean; the climb's ground rises and the hop's falls; the checks name
    each problem; the pair's roles meet on their event.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.38.0

## D73 · 2026-10-12 · Graphs: states, transitions, blend spaces and layers, run inside `Animator.step` (WP-6.4)

- **Principle:** 2, 3, 4, 5, 8, D33, D38
- **Call:** a graph is JSON (`spec/GRAPH.md`; `spec/schemas/graph.schema.json`, Phase 1's stub filled and refrozen
  under this decision): parameters (number, bool, trigger), a base layer of states and transitions, and layers over it
  (mask, weight, additive). A state plays a clip (anything the host's clips hold: library clips, compiled recipes and
  actions, procedural parts), a recipe's clip, a blend space on one or two parameters, or nothing (`pass`, over the
  base). A transition has conditions, an exit share, a cancel window, a fade, sync and whether it may be interrupted.
  - **One mixer:** the graph doesn't mix poses itself. Each fixed step, before the playheads move, it takes the
    transitions that hold and sets the Animator's own layers (`@layer/entry/point`): a crossfade's two states and a
    blend space's points at weights that give each its share over what is below, a blend's clips at the speeds that
    keep them in phase. Root motion, planted feet, events, `pose()` and masks are the Animator's as ever (D38), and the
    graph adds nothing an engine could round differently.
  - **State in the hash:** `save()` and `hash()` carry the graph's id and content hash, parameters, triggers set, and
    each layer's state, entry and fade; `restore(save, clips, graph)` carries on exactly and refuses another graph.
    An Animator without a graph saves as before, so its hashes are unchanged.
  - **Events to callbacks:** `on(name, fn)`; entering a state fires `enter` with the state and the one it left.
  - **Semantics a host may lean on:** the first transition in list order that holds is taken; `"*"` never re-enters the
    state it is in; triggers stay set until a transition reads them, so a press during a fade waits (input buffering);
    a fade plays out unless the transition that started it is `interruptible`.
  - **The examples** (`spec/graphs/`): `Locomotion` (idle; walk, jog and sprint blended by speed in step; a jump and
    its landing; a jab over it from the waist up, a layer passing between jabs) and `Sword_Combo` (three strikes, each
    pressed on in its cancel window, else recovered to guard), on Quaternius' clips. `G-E001`–`G-E010` (`GRAPH_RULES`).
  - **The API:** core's 43rd name, `graph` (D71's cap of 44 left one); the Animator gains `play`, `stop`, `set`,
    `trigger`, `on` and `graph`.
- **Limits, on record:** a masked layer's fractional weights (a feathered mask) blend as the layer stack does, so a
  part's share there is near, not exact; a loop's `exit` is a share of each cycle, so 1 never comes (use a share under
  it); interrupting a fade drops the state that was fading out at once (its share was what was left of the fade).
- **Why:** a game asks for states and transitions, not layer weights: agents know PlayCanvas's and Godot's shapes, and a
  combo needs cancel windows (my-3d2dge-2's skill timeline) and chaining (Emberdeep's clip moves: fade, mask, a start
  time, the next move). Running it inside `step` on the Animator's layers keeps the same-bits promise (D33) for games.
- **Done when** (`npm test -- graph`, `npm run e2e`): the two example graphs validate (schema and checks), their
  scripted runs take the expected transitions and carry on exactly after a save and restore, and they run the same in
  Node and Chromium: states, hashes after every step, events and exact poses.
- **Verifier, round 1** (at 4e7cb0c): the Done-when holds (both graphs validate and run the same in Node and
  Chromium; restored at every 7th step they carry on exactly; no graph, the same hashes as before), with two blocking
  defects in the runtime. Fixed or answered in v0.39.2, every finding:
  - **A state faded into lost its first events** (blocking): the plan was made before the fade moved on, so on the
    step a fade began the new state's share was 0, and the Animator fires a layer's events only when it weighs
    something. Clip events at 0 and 0.01 s were dropped on the default fade. The fade now moves on first: each state
    plays at its share as the step ends, from its first step.
  - **A loop's exit share could be stepped over** (blocking): `exit: 0.99` on the jog (56 steps; its phases k/56)
    never left, and the walk left eleven cycles late. A step that carries a loop past its exit share into the next
    cycle now takes the transition too.
  - **A cut fade jumped:** the state fading out was dropped and its target went to its whole share at once (a joint
    0.70 m in a step; 0.36 in the example's jump out of the land). What a cut fade was fading out now goes on fading
    out from its share then (at most four states, the faintest dropped), and the pose carries on.
  - **Triggers never expired and couldn't be cleared:** a jump pressed in the air fired 3.5 s after landing. A trigger
    may have a `buffer` (seconds a press waits; without one, until used, as before), and `set(trigger, false)` clears
    one. The examples' presses wait 0.2 s (a jump) and 0.3 s (a jab, a strike).
  - **The checks threw** on `"layers": {}` or a null blend point, and `"layers": "upper"` gave six issues. They are
    issues now. A mask by field names its fields (`{"upper": 1}` and `{"armr": 1}` changed nothing; the fix names
    `"mask": "upper"` and `"armR"`), in the schema too. `name`, `desc` and `tags` are checked as the schema does, and
    every issue has a fix. A one-shot with a negative speed (it never reaches its exit) is refused with the clips.
  - **Restore and clips the graph names but isn't playing:** the save now holds every such clip's content hash, and
    restore refuses one edited since (`E_CLIP_CHANGED`), as PLAN.md §5.5 asks. A graph state the graph can't have (a
    state, parameter, trigger or fade it doesn't have) is `E_SAVE`, not a TypeError on the next step.
  - **Tests:** of the verifier's 15 surviving mutants, those that mattered now fail them: an upper layer's fade and an
    additive one's shares; triggers and an interruptible fade restored (restores at the first step with a press waiting
    and inside the land's cut-able fade); the fade's linear share and its first step; the heaviest point's phase; a
    state's `at`; callbacks inside one long step; the graph's layers under the host's; playing again. The Locomotion
    script lands later, so the jump goes through `air`. Each fix reverted (the fade's order, the loop's exit, the cut
    fade, the buffer) fails them.
  - **Nits:** `-0` in a graph's value or fade is made 0 (it broke a hash after a JSON round trip); `set(x, NaN)` says
    NaN; an unknown trigger lists the graph's; an event named `*` reaches `*` listeners once; `remove("@…")` refuses
    as `layer()` does; the docs' section numbers; `GraphRun`'s fields documented; the spec says the start states fire
    no `enter`. A fade lasts its length to a billionth of a second (a 0.1 s fade ran a seventh step at a share of
    1e-16).
- **Verifier, round 2** (at 2eb0a1f): done, nothing blocking; every round-1 fix held, restored at every one of 600
  steps per example and 900 of a richer graph (a 2D blend of five points, an additive layer, a mask by field weights,
  cut fades, rate, sync, windows), in Node and Chromium alike. Fixed or answered in v0.42.3:
  - **A one-shot at speed 0 never ended** and passed the checks: a one-shot's speed is now above 0, as the spec said.
  - **A library clip id with a hyphen** (`MESH2MOTION/Two-hand_Blast`) was refused: a state's and a blend point's
    `clip` take the clip schema's ids (`[A-Za-z0-9_-]`); the graph's own id and `recipe` keep the stricter pattern.
  - **The graph was held by reference:** edited after `play`, a step threw a TypeError, and `restore` with the very
    graph playing was refused. The run plays its own copy (JSON), which also makes every `-0` in it 0 (N1).
  - **Test gaps** (79 of 138 one-line mutants lived): the tests now pin a blend fading in at each point's weight
    times the fade's share, a zero-weight point kept out of the events, a synced blend's mean length and its start
    phase, 2D weights by value, a loop's exit at a speed other than 1, a state restarted by a transition naming it,
    each op either side of its value, `play` again, a richer graph restored at every one of 150 steps, each
    validator rule broken once, and the parameters', a start state's `at` and a fade's defaults. Rerun, 52 of the 79
    die; one was rewritten with the code it mutated (the loop's `at`, now wrapped); 26 live. About ten of those
    are equivalent: the base layer's mask (it has none), a bool condition read as `!!v`, a 1D blend's ends and its
    early exit, the unreachable 2D fallback, the Animator clamping a weight the checks bound, and restore's layer
    count and names, which the graph's hash refuses first. The rest are edges no example reaches: ties between
    points, a one-shot held at its end, the fade-out list's order and its cap, the fade's last 1e-9, and an event
    named `*`.
  - **Nits:** N1 (`-0` in `at` or a mask) by the copy; N2, the two issues without a fix or a field, have them; N3, the
    spec and D73 said a loop's exit of 1 never comes, but it is taken at each seam, and the fade-out cap is four
    besides the state fading in (both reworded); N4, a state played at a `rate` whose parameter starts at 0 never
    moved: refused (G-E006); `set()` still takes 0, a host's pause; N5, a pass state's exit or late window never
    fired, and a state into itself waiting on nothing fired every step: both refused (G-E003); N6, a loop's `at` past
    its length wraps round its cycle, as `layer({ time })` does; N7, a window narrower than a step opens when the step
    goes over it, as an exit does; N8, the schema says what JSON Schema can (a mask's groups, no pass state in the
    base, `at` only on a clip state, `rate` not on a pass, no layer named `base`, 1D points as numbers), refrozen.
    N9 stays: the saved `count` equals `entry` (kept, so a save's shape doesn't change), and a save without a graph
    ignores the graph passed to `restore`.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.39.0, v0.39.2, v0.42.3

## D74 · 2026-10-12 · T1 samples the library-wide sweeps; T2 runs them in full

- **Principle:** 9, §6
- **Call:** `npm test` reads every third locomotion loop in the planted-feet sweeps (`contact`, `contact-gaits`,
  `contact-sidesteps`, `contact-siderun`) and plays the actions on two of the six test characters (gen-0 and KayKit's
  knight). `npm run e2e` runs the same files in full (`M3A_FULL=1`: every loop, all six skeletons), as its "library
  sweeps in full" step. A tier step can now set environment variables. WP-6.3's Verify says so.
- **Why:** T1 had grown to 91.8 s on an idle machine (budget 90 s): 664 tests, with WP-6.3's six-skeleton actions
  sweep (29 s of CPU) on top of the planted-feet sweeps (80 s of CPU, a fifth of T1). PLAN.md §6 gives T1 "sensors on
  a sample" and T2 the full library, and T2 runs on every pull request in CI, so every claim is still checked before a
  merge. Sampled, the five files take 52 s of CPU against 107 s in full; both pass.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.39.1

## D75 · 2026-10-12 · Simulation: a game's input run on a graph, its trace, root modes and stride warping (WP-6.5)

- **Principle:** 1, 2, 4, 8, 9, §5.5
- **Call:**
  - **Where it lives:** `@m3a/tools`' `sim` namespace (`packages/tools/src/sim/*`, browser-safe: `simulate`,
    `validateScript`, `compareTraces`, `traceText`, `filmstrip`), and `npm run sim` in `tools/sim/` (reading files,
    the library's clips and the example recipes, and a rig: the tiny conformance rig, a generated test character or a
    cached real one). The tools package may import only the packages' main and `/node` entries, and loading a
    character's GLB needs three.js's loader, so the CLI is the repo's until WP-7.1's `m3a sim`. WP-6.5's entry owns
    `tools/sim/*`, `spec/SIM.md`, `spec/sims/*` and the two schemas too, and says so.
  - **A script** (`spec/SIM.md` §1, `sim.schema.json`, frozen under this decision) is rows of a game's input at their
    times: parameters set (`over` eases a row's numbers, as a game eases its speed: set at once, the walk–jog blend
    switched in a step and popped the toes and the chest), triggers pressed, and the ground speed (`move`, in metres
    or hip heights a second). `validateScript` gives S-E001–S-E007, each with a fix.
  - **A trace** (`sim-trace.schema.json`, frozen) is the states each graph layer entered, every event and every hit
    window, at the fixed step each came in: integers, so an expected trace is compared exactly. With the root
    following the animation, the graph's timing is the clips', not the body's: the example's trace is the same on the
    tiny rig, on it with longer legs and shorter arms, on a half-size one, and on gen-3.
  - **Hit windows from events:** a `hit` event opens one, closed after its `dur` (clip seconds: played at 1.2, a
    0.1 s window is 5 steps), at the clip's `hit_end`, or after its step; sooner if its state's layer goes. A clip
    played with a measured strike and no `hit` event is warned of (the library's carry none yet: B2's job).
  - **Root modes:** `"root"` (default), the character goes where the root motion takes it; `"in-place"`, where the
    game's ground speed does, the root motion dropped.
  - **Stride warping** matches playback to the ground speed, as PLAN.md's entry says: core's graph gains a state's
    `rate`, a number parameter its speed is multiplied by each step (Unity's speed multiplier; the graph schema,
    refrozen under this decision). The sim sets it each step to the ground speed over the root's speed as the layers
    mix it (each clip's own speed on this body, from the path its planted feet imply, at its layer's speed and share),
    within 0.25× to 4×. Locomotion's `move` reads `warp`. Scaling the stride's length instead (the feet placed further
    apart at the same cadence) is not done: the planted-feet solve would need the root's path scaled, and the plan
    asks for playback matched.
  - **The sensors** read the whole run in the world (`motionOfFrames` with the world root), and the filmstrip draws
    frames spread over it, labelled with the states playing.
- **Done when** (`npm test -- sim`, 7 tests): the walk-to-run-to-jump script's trace is `spec/sims/Walk_Run_Jump.trace.json`
  exactly, on the tiny rig and on two other proportions; stride warped, a walk in place from 0.5× to 1.8× its own speed
  slides 69–91 mm per contact (the warn level 150), its rate the ratio exactly, and unwarped at 0.75× and 1.5× it slides
  268 and 240 mm (at 0.5× and 1.8× its feet move too fast to read as standing at all); hit windows, root modes, the
  checks with the schemas agreeing, a run the same twice, a filmstrip.
- **Limits, on record:** on the test characters the runs warn and fail on the planted feet's toes (pops), the sweep's
  open issue (G4, D57–D60), not the sim's: the example reads a slide of 120 mm on the tiny rig and 127 on gen-0. A
  script's speeds in metres a second are a body's: `"units": "H0"` makes them any body's.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.40.0

## D76 · 2026-10-12 · Briefs B2, B3 and B7, graded from bones and traces; WP-6.6 in two halves (WP-6.6a)

- **Principle:** 1, 7, 9, §7
- **Call:**
  - **The split:** WP-6.6's six briefs, each a starter, a grader, a known-good solution and planted bad ones, are two
    M halves: 6.6a the wiring briefs (B2, B3, B7) with the runner made to run any brief and the manual's wire sections;
    6.6b the making briefs (B4, B5, B6) and the make sections. WP-6.6's entry says so.
  - **B2, an attack's hit timing:** the grader drives the fighter with two presses and finds each punch's strike on the
    character's bones, as the format's facts define it: when a hand moves fastest toward the target (forward) against
    the pelvis. Measured as speed alone, raising the guard as the jab fades in (11 m/s) beat the jab itself. Damage
    must come once per punch, within one frame of it. Planted: damage on the press, as the punch ends, twice, and a
    fighter that never punches.
  - **B3, reactions:** the reactor runs twice, with and without the light hit (an Animator is deterministic): during
    the hit the legs stay within 2 cm of the walk without it (0.0 cm, masked to the upper body) and the hands or head
    move 5 cm (33 cm). The heavy hit's lying is the hips under 15% of their standing height for 1.3 to 3.5 s (the
    known-good lies 2.0 s, the fall and the start of the rise included; at once, 0.95). Ground contact is judged on the
    feet, the pelvis and the head: the library's get-up pushes an elbow 13.5 cm under the floor on gen-37, which the
    sensors' lying profile allows (touching the floor is the motion). From one lying pose to another the known-good
    cuts: cross-faded, an elbow went 33 cm through the floor.
  - **B7, a locomotion graph:** the speed is in hip heights a second, so one graph and one script serve any body. The
    grader simulates the graph with its own copy of the script (the root following the animation) and reads the
    trace: the motion asked before each change of speed, the base layer's states in order, the jump only from a
    grounded press (a press in the air must not be kept: the trigger's `buffer`), the landing within 0.1 s of touching
    down. The feet are not graded (B1 grades them): the known-good's transitions slid 313 mm on gen-37 against a limit
    of 264.
  - **The runner:** `npm run bench -- B1,B2,B3,B7` runs any registered brief (`SPECS`: its starter, grader and
    known-good files); `--heldout` takes one brief's variant.
  - **T1 and T2:** the graders' tests grade on gen-1 in T1 and on gen-37 too in T2's full step (D74).
  - **The manual:** its wire sections (graphs, events and hit timing, reactions, root motion and stride warping, the
    simulation) bring it to 3,916 of 8,000 tokens.
- **Verifier, round 1:** both halves together, recorded in D77 (B2's strike and idle, B3's chest-less characters and
  walk, B7's travel, jump and fall, the manual's examples).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.41.0, v0.42.3

## D77 · 2026-10-12 · Briefs B4, B5 and B6: a VRM avatar's sneak, an emote and an edited punch (WP-6.6b)

- **Principle:** 1, 7, 9, §7
- **Call:**
  - **B4, a VRM avatar:** no VRM loader is installed (`@pixiv/three-vrm` is allowed, not a dependency), so the avatar
    is a generated test character named as a VRM 1.0 humanoid, which `bind` recognizes by its names: gen-40 (a chibi,
    hips 442 mm up, no neck bone) by default, gen-44 (tall, twist bones) for the second seed, both outside WP-4.2's set.
    The runner gives a brief its own default character. Graded from the bones: crouched (the hips 85% of standing or
    less) and travelling (15% of the hip height a second); a foot stands still at times (the lower foot's slowest tenth
    under the sensors' standing speed, as B1 reads it: a foot sliding faster than that is never read as standing, so
    the slide alone can't see a skate); slide and skate under their limits; the sensors' read of the bones fails on
    nothing but jitter and pops (the points the bones don't carry are filled in). (Round 1 of its verifier, below,
    changed this: steps, a standing foot staying, every point from the bones, pops counted.)
  - **B5, an emote, and B6, an edited punch:** the agent hands in a recipe, which the grader compiles against the CC0
    library (`library.resolver()`, new: a recipe's clips from the library with their rests and content ids). A made
    clip is graded on its own rest and played on the workspace's character (every joint finite). B5: 1.5 s (±0.05) and
    looping; nothing failing; `describe` reports it in the air; both wrists above the head a quarter of the cycle or
    more, each waving side to side 10% of the hip height with two turns. `describe` reads jumping jacks as running (feet
    landing one after the other count as steps), so the known-good hops with the library's victory jump under its
    two-arm wave: "0.52–0.95 s in the air". B6 edits `MESH2MOTION/Punch_Cross`, which passes the sensors 30% faster
    (Quaternius' cross pops its wrist then): the length and strike over 1.3 (±3%, ±0.05 s); the left fist strikes;
    mirrored back, its fist at the strike within 10% of the hip height of the original's; the fist draws back 4% of
    the hip height first (the original's goes straight out: 0 mm; the known-good's chest wound 25° before it, 91 mm).
  - **The manual:** its make sections (recipes and their operations, compiling against the library, edits, facts)
    bring it to 5,007 of 8,000 tokens.
  - **T1:** with six graders it took 97–100 s, over its 90 s budget. D74's sampling now covers the two files it
    missed: B1's grader grades gen-37 only in T2's full step, as the others do, and describe's token count reads every
    third clip (all of them in T2): 88.6 s.
  - **The manual's actions** (v0.42.1): WP-6.6's make sections name actions too, which 6.6b left out. "Make: actions"
    gives an action's fields with the ledge climb inline (it compiles on the CC0 sets an agent's workspace has; the get
    up, the vault and the hop down read CMU's clips, which it doesn't), compiling, the root curve with its `up`, cutting
    at an interrupt point, paired actions and a gait of one's own: 5,564 of 8,000 tokens, each snippet run as written.
- **Verifier, round 1** (both halves, at 2eb0a1f): not done. The Done-when held as written, but two graders could be
  fooled or failed a right answer, and the manual held the answers. Fixed or answered in v0.42.3, every finding:
  - **B3's known-good failed on every character without chest bones** (blocking; seeds 5 mod 6: 7 of gen-20 to 59).
    With chest and upper chest missing, the body's chest point sat at the spine bone's tip (the neck), so the decoder's
    top segment, which takes the chest's whole turn, had no length, and the one below took the source library's 55%:
    lying flat, the head went 16 to 19 cm through the floor. The missing points now sit a third and two thirds along
    the spine bone, as a full spine's would (core's `BODY_POINTS`; a skeleton test holds it); lying, gen-29's head is
    80 mm up. B3's T2 step grades gen-29 too.
  - **B4 passed a crouched idle slid or jumped along, and read nothing on a foot without toes** (blocking). The
    graders read every body point from the bones now: one off the joints (a toe-less foot's ball at the foot's tip, a
    hand's knuckles, the head's top) rides its bone from its rest place (`bench/graders/bones.ts`); filled in from the
    joints, a toe-less ball sat at the world's origin and the sensors read no contact at all. B1's grader reads them
    the same way. B4 grades steps (each foot lifts 7% of the hip height and sets down, three lifts or more in 5 s) and
    a standing foot staying (while the sensors read it standing, its median speed a quarter of the travel or less), and
    counts pops again (the filled-in points made them). The verifier's slides, jumps and skates fail; the crouch walks
    played at their pace pass, a constant 0.65 hip heights a second on gen-44 too (that body's own pace, 0.62).
    `MESH2MOTION/Walk_Stealth`, which the verifier counted a right answer, fails: its standing feet move at 56 to 63% of
    the travel on these avatars (the library passes it on its own rest). The known-good passes on all 40 of gen-20 to
    59; B3's floor check reads the feet by their joints (a toe's tip digs in lying, as the library's get-ups' do).
  - **The manual held the known-good solutions** (the recipe example was B5's, the edits B6's, the graph B7's pattern,
    the events and reactions B2's and B3's clips): its examples are other jobs now (a swimmer's graph climbing out on a
    buffered press, a torch walk's recipe, a throw's wind-up); the reactions name no clips (search, and check with
    `describe` what a clip does: one set's knockback gets back up); `Fit` says `bound.core.rest.H0` is the hip height.
    5,620 of 8,000 tokens; each new snippet run.
  - **B2's strike** was the hand's fastest moment after the press, which a fade into a fighting stance can be (5.4 m/s
    at the press against the jab's 3.1): it is now the last peak of the punching hand's forward speed before it is
    farthest out, at half its fastest or more, and the starter's check prints the same. 17 solutions on gen-1 and gen-29
    pass, the two that failed among them.
  - **Wrong solutions that passed:** B7 checks each motion's travel where the speed holds (idle under 0.3 hip heights a
    second, walk 0.6 to 2, run over 2) and the jump leaving the ground (both feet 5% of the hip height); B3 the walk's
    pace (1.2, ±10%: the known-good 1.18 to 1.20, the clip's own pace 1.05 to 1.08 fails) and a foot standing still;
    B2 an idle (a point moving 0.5% of the hip height against the pelvis before the first press and at the end) and
    damage 10. Each is a planted bad solution in its test.
  - **B7's fall:** the brief says `grounded` goes false 0.1 s after a jump press and may go without a jump; the
    grader takes a fall and a landing at the end, the script runs 14 s and idle is checked at 13.8 s.
  - **The runner:** `--variant` takes one brief, as `--heldout` does; B4's spec names its avatar's naming and a
    variant seed that doesn't give it is refused, saying which seeds do. A T2 test runs every brief's known-good
    through the packed packages, B4 on its avatar.
  - **Nits:** `speeds.json` only in B1's workspaces; B5's check prints the wave; B5's README lists the character;
    WP-6.6's Owns lists what it touched. Left: B3's lying window (1.3 to 3.5 s with the fall and rise) can't tell half
    a second of lying from two, as clips' falls and rises differ; and its two runs import the top module anew, so
    state a solution keeps in a helper module of its own carries over (nothing a fresh agent's reactor needs).
  - **Measured:** the known-good solutions on gen-20 to 59: B2, B3, B4, B5, B6 and B7 each 40 of 40.
- **Verifier, round 2** (both halves, at 8a53245): not done, two blocking findings. Fixed or answered in v0.42.4:
  - **B2's strike took a fade-in for the strike** (blocking): with `MESH2MOTION/Fighting_Right_Jab`, the fists lifting
    into the stance at the press moved the hand forward faster (2.9 m/s) than the jab itself (1.2 to 1.3), so no peak
    reached half the fastest and the strike fell back to the press frame: a right fighter failed on 22 of 68 seeds,
    and damage on the press passed. The strike is now the last peak of the hand's forward speed faster than one hip
    height a second before it is farthest out, and damage passes from two frames before it (a cross-fade moves the
    played peak a frame or two from the clip's measured strike: `Punch_Cross` faded in over 0.25 s) to the hand's
    farthest reach. One function, the starter's `strike.ts`, finds it for the grader and the check alike (the check's
    search differed). The verifier's 88 punches (11 clips through a layer, a base cross-fade or a graph, fades of 0.1 to
    0.25 s) pass on six seeds each, 528; damage on the press with the fighting jab fails; a punch looped on fails the
    new "back to idling" check (its hand comes at least half way back within 1.5 s: N2).
  - **B3's knockdown flung the body 7 hip heights** (blocking): core's root motion held `Hit_Knockback`'s take-off
    speed (its right foot read planted 4 frames while swept away, about 9 hip heights a second) to the clip's end. A
    one-shot that ends off its feet now spends its speed over the time a body falls its hip height: the three sets'
    knockbacks travel 2.6 to 2.9 hip heights (the root-motion clips', 3.3 to 3.4; core's test holds it and fails the
    old code). B3 checks it: from the hit until it stands, the hips go no more than 3.5 hip heights (the alternatives
    0.2 to 2.9); a flung knockdown is a planted bad one.
  - **B3's other bars (S1 to S3):** the light hit's in hip heights (2% and 5%); a foot may go twice the floor's limit
    in the half second after the heavy hit (a cross-fade from a step dipped one 6 cm on bulky bodies); the walk is
    checked in the last second too, with a standing foot staying (the lower foot at 15% of the travel or less 40% of
    the time: moved by its feet 0%, stride-warped as the manual shows 7 to 13%, slid at half rate 48%); the idle slid
    along after getting up and the half-rate skate are planted bad ones. A walk played at its own pace while the body
    goes at the asked one skates 13 to 23%: it fails on 4 of 5 seeds, and on gen-1 (13%) passes, as stride warping's
    own slide does.
  - **B4's standing foot (S4):** judged as B3's, the lower foot at a quarter of the travel or less 40% of the time, not
    by the sensors' contacts (on bulky bodies they read only a few frames of each of `Walk_Stealth`'s stances):
    `Walk_Stealth` reads 89 to 151% and fails on every body (planted); the crouch walks moved by their feet read 0%.
  - **B7's windows (S5):** the run after landing is judged from 8.1 to 8.6 s, so a landing played to its end first
    passes, and the brief gives every window. N3: a jump state playing the jog left the ground only through the graph's
    `air` state, which the check reads with it; the known-good's landing waits on its 0.1 s jump fade, as the brief
    warns a graph must (a fade of 0.08 lands on the `grounded` still true from before, and fails, as it should).
  - **The manual (S6, N3, N4):** the throw's wind-up turns +20 (−20 moved the hand forward); a bool may be compared
    (`"op": "==", "value": false`); the paired action has its `desc`. 5,653 of 8,000 tokens.
  - **The starters' loader (S7):** B2, B3, B4 and B7 load their character as the graders do (meshopt read, textures
    left out), so the four real rigs on hand load (three didn't). B1's starters are G4's and stay (its discovery
    starter names no package); its known-good fails on the meshopt rigs, for G4's run 2 to take up.
  - **A model off the floor (S8):** the graders read heights from a model's lowest sole at rest when that is more than
    10% of the hip height off y = 0 (G4's held-out rig stands 1 m down); B3 there no longer reads the body under the
    floor. But the player's planting takes the floor at y = 0, so on that rig the feet slide (B1, B3, B4), and on the
    KayKit knight (a real chibi) B3's body lies with its hips over 15% of its hip height: both are G7's, which reruns
    the briefs on real rigs; G6's variants are generator seeds (D78).
  - **Nits:** the ledger's planted counts (now 7, 8 and 6 for B2, B3 and B7; 7, 5 and 4 for B4, B5 and B6); "crouch
    walks played at their pace pass on gen-44 too" (round 1) held for the clips' own pace, and the manual's in-place
    method fails B4 (the brief asks for root motion); B4's naming check is a seed's (a rig's naming isn't checked:
    recorded); T1's time ran under the other verifier's load.
  - **Measured:** the known-goods on new seeds, B2, B3 and B7 40 of 40 (gen-60 to 99), B4 35 of 35 (VRM seeds 60 to
    196); on three real rigs, B2 and B7 pass on all, B3 and B4 on the mannequin. T1 grades every other planted solution
    of B2, B3 and B4 on its default character (gen-1; B4's gen-40), T2 all of them on two or three (as D74 samples the
    sweeps), keeping T1 in budget.
- **Verifier, round 3** (both halves, at e9c0c52): done, nothing blocking; every round-2 fix held (1,548 right
  fighters, B3's and B7's alternatives, B4's crouch walks on 10 more VRM seeds, the known-goods 40 of 40 on gen-100 to
  139, the starters and graders on the four real rigs as round 2 said). Five should-fix findings, fixed or answered in
  v0.42.5:
  - **B3 passed a body sliding along the floor as it lay** (a game that keeps moving the character while it is down:
    2 hip heights along the floor, inside the 3.5 the knockdown may carry it). B3 now checks it stays where it lies:
    from 0.3 s after the hips are down until they rise, they move no more than 0.6 hip heights (right solutions 0.02 to
    0.16, `Death01`'s slower fall 0.44; the verifier's sliders 0.81 to 2.1); the brief says so; one is planted.
  - **B2's damage window ran to the hand's farthest reach**, up to 17 frames after the strike: a timer 9 frames late
    passed. It now runs from two frames before the strike to four after, and not past the farthest reach (of the
    verifier's 2,304 right punches, two landed four after); PLAN.md §7's B2 row says so, as the plan's "within one frame
    of the clip's measured strike" no longer did.
  - **B2 had no reach:** a jab layered at 15% weight (a hand 3 to 8 cm forward at 1.3 m/s) passed as a punch. A punch
    now reaches 15% of the hip height forward of where the hand was before the press (right punches 28% or more); the
    brief and the check say so; the twitch is planted.
  - **B3's standing-foot bar failed walks stride-warped as the manual shows:** `MESH2MOTION/Walk_Large` reads 14 to 22%
    (moved by its feet, 0%), `Walk_Formal_Loop` 15 to 17% on a chibi; the default walk 6 to 14% (round 2's "7 to 13%"
    was short). The bar is now 25%, as B4's. The walk played at its own pace while the body goes at the asked one (13
    to 23%) passes with it: its slide is no worse than stride warping's own. `MESH2MOTION/Walk_Female` fails moved by
    its feet too (its contacts are read poorly: 22 to 56%), recorded.
  - **Records:** round 2's knockback travel (2.6 to 2.9, not 2.8), its alternatives (to 2.9, not 2.6), and T1's
    sampling (B4's default character is gen-40, and T2 grades B2 and B4 on two characters) are corrected above; "a
    landing played to its end first passes" holds for the Quaternius landings, while `MESH2MOTION/Jump_Land` (1.58 s)
    played to its end isn't running by 8.3 s; the ledger rows say T1 grades half the planted ones; WP-6.6's Owns lists
    core's `contact/root.ts`.
  - **Nits, recorded:** a jog played at a fifth of its rate passes B3's end walk on some seeds; B7's travel bands pass
    some wrong clips played at odd rates (a run that is a crawl at 3x); a lie of 0.3 s passes inside the 1.3 to 3.5 s
    window; on the off-floor rig the starters' checks print raw heights (G7's); a jab on an upper-body layer over a
    turned stance fails, rightly (the hand goes sideways); a table pick-up passed as a punch at round 3 (it fails now);
    `Run_Female` reads no contacts; B1's known-good fails on KayKit's textures too. B6's README lists the character.
- **The root change, measured** (WP-6.2's verifier, round 6): it moves 38 of the library's 167 in-place one-shots,
  every loop (993) unchanged. The knockbacks go from 9.3, 8.4 and 7.9 hip heights to 2.9, 2.6 and 2.7; `Death_C` from
  3.8 to 0.4; the three `NinjaJump_Start` from 4.5 to 1.2; `ClimbUp_1m` from 2.2 to 0.9; `Slide_Start` from 1.25 to 0.9;
  no clip travels over 3 hip heights now (7 did). A jump start does lose travel a body in flight would keep: its
  take-off speed was read off a foot sweeping away (the overestimate the knockbacks showed), and a one-shot with no
  landing in view can't say how far its flight goes; the clip after it (a jump loop, a landing) carries the travel
  on. Of the sweeps' rows for the 21 most moved, on two test characters, 6 of 42 change, all for the better.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.42.0, v0.42.1, v0.42.3, v0.42.4, v0.42.5, v0.42.6

## D78 · 2026-10-12 · G6's command set; a held-out run's variants on generator seeds alone

- **Principle:** 9, §7, §8.5
- **Call:**
  - **The set** (`npm run gate -- G6`), PLAN.md's G6 line by line: T0, T1, the doctrine, the moves against their
    pinned sources; composed clips passing QA (`npm test -- recipe procedural actions`: the 20 example recipes, the
    gaits, idles and moves on three rests, the actions and every interrupt cut on the six test characters); graph
    simulations deterministic (`npm test -- graph sim`: the expected traces exactly, on three bodies, a run the same
    twice, save and restore), and T2 (the graphs in Node and Chromium, the sweeps in full); the held-out run fresh; and
    B2, B3, B5, B6 and B7, each 5 fresh agents and 5 on its held-out variant, at least 4 of 5 each, 5 at a time.
  - **A held-out run without a rig:** G4's sweep reads its held-out run's `rig.json`; G6 grades briefs only, so its
    variants may be generator seeds alone and `npm run fixtures -- heldout G6` asks for a rig manifest only when there
    is one. Each variant's seed must be one no grader or runner test grades on (`{ seed: n }` in their tests), outside
    WP-4.2's test set (0 to 19) and unused by any other held-out run, as PLAN.md §7 says; the check now enforces it.
- **Why:** the gate's line names the briefs, the held-out variants, composed clips and determinism; each gets its
  command so a gate run reports which one failed.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.42.2

## D79 · 2026-10-14 · The SessionStart hook runs Node 24 and fetches what the tests and gates read; so does CI's T1

- **Principle:** process, WP-0.5 (D22: Node 24; principle 9: pins)
- **Call:**
  - Numbered D79, after D78 on michaelcrosato/my-3danimations#10's branch (D49 to D78 were taken there, `main` ended at
    D48), so the two logs merge without a duplicate id.
  - The cloud container's default `node` is 22.22.0; Node 24.21.0, CI's pin, sits in `/opt/node24`. The hook reads
    `engines.node` from `package.json` (none read as 0) and, when the default is older, puts the lowest
    `/opt/node<major>/bin` that qualifies (sorted by version) first on `PATH`, for `npm ci` (npm 11, as CI) and through
    `CLAUDE_ENV_FILE` for the session. It exports `CHROMIUM_PATH` before any download.
  - It then fetches by hash the real CC0 rigs, each gate's held-out rigs (`bench/results/heldout/*/run-*/rig.json`,
    where they exist) and the pinned sources. A failed fetch warns and the session still starts; `test-characters` and
    `bind` name what to fetch when they skip, the carry test (`it.skipIf`) skips without a reason.
  - CI's T1 job fetches the pinned sources too (`npm run pins -- fetch`, cached with `.cache`): it fetched only the
    rigs, so the carry test skipped there (694 passed, 8 skipped at 0870490).
- **Why:** on `main` a fresh session's T1 passed with 5 of the rigs' tests skipped (`test-characters`, `bind`), and on
  #10's branch the carry test skipped, in sessions and in CI, for want of shardfall's pin: "never skip a test to get
  green" didn't hold. The toolchain ran on Node 22 while D22, §5.8 and CI say 24. Measured from a fresh clone, the hook
  takes 20 to 24 s (npm ci 3 s, rigs 2 s, pins 13 s); after it, on v24.21.0, T0 passes, and T1 runs 440 of 440 on
  `main` and 695 of 702 on #10, the 7 skipped being the briefs' runner test, which runs in T2 only (`M3A_FULL`, D74).
- **Answered:** no: made without a response, to review.
- **Landed in:** michaelcrosato/my-3danimations#10, after 0.42.6 (Repo lines only, no version)

## D80 · 2026-10-14 · D60 answered: a sweep pair passes when the skeleton adds no fail finding

- **Principle:** 1, 9, G4, K1 (D60)
- **Call:** the owner took D60's recommendation. A clip passes on a skeleton when the skeleton adds no *fail* finding
  the clip lacks on its own body; every warn it adds is listed in the sweep's and the gate's report. Run 1's 3,150 pairs
  read 97.2% so (gen-0 95.6%, gen-1 98.1, gen-2 98.3, gen-3 98.5, the mannequin 98.5, the Knight 94.1). §9.3's G4 line,
  WP-4.5's rule and `tools/sweep/sweep.ts` change to this reading together, with tests. D57's condition stands: run 2
  starts only when a sweep outside the gate passes 95% under this reading, at a clean commit, over the library G4
  sweeps (about 1,400 clips; run 1's 97.2% covered its 525), since a second failure is K1.
- **Why:** answered by the owner after the numbers were put to them, so the reading isn't the agent grading itself
  (D60); the sensors set warn at real capture's p95 and fail past all of it.
- **Answered:** yes, the owner, 2026-10-14.
- **Landed in:** michaelcrosato/my-3danimations#10 (recorded only); the change lands with G4 run 2's preparation

## D81 · 2026-10-14 · D63's question answered: the Quaternius sets stay as migrated

- **Principle:** 4, 10, WP-5.3, O4
- **Call:** QUATERNIUS_3D2DGE and QUATERNIUS_SHARDFALL stay as migrated (D63's third option): no itch.io download and
  no Drive upload. WP-5.3 stays done with that deviation; a re-import from UAL 1 and 2's current editions waits until
  their files reach a session.
- **Why:** the owner's call; nothing waits on it (G5 passed with both sets as migrated).
- **Answered:** yes, the owner, 2026-10-14.
- **Landed in:** michaelcrosato/my-3danimations#10 (recorded only)

## D82 · 2026-10-14 · #10 merged before G6 and G4 run 2, at the owner's request; a fresh branch from here

- **Principle:** process (AGENTS.md, "Gates"), D50
- **Call:** the owner asked for every branch merged or deleted before work resumes. michaelcrosato/my-3danimations#10
  (Phase 4 but G4, Phase 5 with G5, Phase 6 but G6: 0.42.6, with D79 to D82) is squash-merged into `main` with CI
  green, as #8 was before G4. Its branch `claude/relaxed-albattani-939ofg`, #9's `claude/relaxed-albattani-35xhjq`
  (contained in #10) and `claude/cool-goldberg-qgyu06` (D79, carried into #10) are deleted. The next session starts a
  fresh branch from `main` and a draft pull request for the rest of Phase 6 onward, merging at each gate.
- **Why:** one line of history and no stale branches. The previous session ended on a usage limit with work unpushed
  (WP-6.2's seventh verifier round and G6's preparation: a private `/tmp` per benchmark agent, tests that remove their
  temporary directories, the held-out variants); it is redone, not recovered.
- **Answered:** yes, the owner, 2026-10-14.
- **Landed in:** michaelcrosato/my-3danimations#10
