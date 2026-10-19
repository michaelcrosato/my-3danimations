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
    that count at a gate run one at a time. **Superseded in part by D84:** each agent gets a `/tmp` of its own, so
    agents run at once where the machine allows it.
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
- **Answered:** yes, the owner, 2026-10-14: "no fail finding added" (D80).
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
- **Answered:** no: made without a response, to review. Quaternius' option 3 is the default the owner was told of; the owner kept it, 2026-10-14 (D81).
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
  algorithmicMedia`) from three sources, each on any rest: a move and an idle from any start pose, a gait from the
  rest's standing pose (any other start is refused, round 13). None runs inside `Animator.step`.
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
      0–80°); a swing under 0.3 s is refused (0.2 s from round 2, 0.25 s from round 5, 0.26 s from round 6, 0.3 s
      from round 14). A limp shortens the weak leg's stance by up to 30%; that leg lands later and the other stands
      longer, keeping the plain gait's double support. Without that, neither foot stood just before the strong foot
      landed.
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
- **Verifier, round 7** (at bf3f9ed): not done, three blocking findings. Fixed or answered in v0.44.0:
  - **The swing's height broke its slope** (blocking) where the lift-off met the arc (infinite there, sin(πw^0.756))
    and where the arc met the set-down. A run lifting 35 whose foot began its arc on the loop's seam failed seam speed
    on all three test rests (4.1 to 5.0 m/s). The height is now one curve with continuous slope through the floor, 9%,
    the peak (at 40% of the swing), 4.5% and the floor, still at the floor at its ends: the repros pass (1.0 to 1.9
    m/s), the verifier's seam grid goes from 9 to 0 of 129, and the walk keeps 5% of H0 clearance at 80% of its swing
    (6.6%).
  - **At 50 frames a second short swings popped knees** (blocking): 44 of 418 failed; with the arc fixed, 7 of 456 (a
    fast thigh sweep on 0.26 s swings); at 55 and 60, none. A gait is made at 55 frames a second or more.
  - **At 110 the pelvis stair-stepped** (blocking): the format holds the hips in whole % of H0, so a slow bouncing
    pelvis steps every other frame and a planted knee jumps about 30 mm with it. Counting the pelvis's sway and
    rounding in the 98.5% loop cut the 64-rest grid from 29 to 8 of 256, not to none; at 90 none fail (35 warn, 59
    before). A gait is made at 90 frames a second or fewer (75 or fewer since round 9).
  - **Should-fix:** 15 mutants of 0.42.6's fixes survived the tests (the 98.5% loop gone or blind to the bounce, the
    reach check at 0.75 with its message kept, the stance end, the swing and rate checks a hair off): tests now pin the
    loop (a gait at speed 375, cycle 0.52, stance 0.5, bounce 6 on `MESH2MOTION/Idle_A`, a pop without it), legs at
    most 98.5% of their length at the reach bound with a bounce, the reach's edge (189 taken and 190 refused on
    Mesh2Motion's rest, 177 and 178 on 100STYLE's), a swing of 0.255 s and 54.9 frames a second refused; all 15 and
    this round's own 12 mutants fail them. A body without collarbones (test characters 3, 9, 15...) made NaN in every
    procedural source: the encoder writes no shrug for a collarbone 0 mm long (the vectors byte for byte), and a gait,
    an idle and a move are made on test character 3. Since the 72% bound the run preset fits 4 of the 20 test
    characters as it is (the tall ones) and the brisk walk 14: the refusal names the fastest speed the legs take, and
    `procedural.fitGait(g, rest)` slows a gait to it (all 80 fitted presets pass, read plainly and by parts).
  - **Nits:** a swing of 0.26 s is compared to the millisecond (0.8 s at a stance of 0.675 is taken; to within a float's
    error since round 14); a missing or blank name or about, a non-number field or rate is refused by its name before
    the clip is made (idles too); "no leg past 98.5% at any phase" held for the model's targets while the written clip
    read up to 99.3%: the loop now counts the pelvis's rounding, and the 5,160-gait grid reads at most 98.46% (a leg's
    own rounding, about 0.3%, is not counted).
  - **Measured:** the verifier's 5,160 gaits (64 library rests and 33 test characters, rates within 55 to 90): none
    fail, 768 warn, knee-pop findings 50 (187 before), the worst seam speed 3.8 m/s (6.6); the presets on 64 rests at
    60: none fail, the worst slide 8.3 mm (10.1). The arc moved two off-preset slides by about 2 mm (format rounding):
    two sensors-test bars 5 → 6.5 mm and 7 → 8 mm.
- **Verifier, round 8, and its fixes' reviews, rounds 9 to 14** (lane G in ultracode, D83; the margin rule, D90): (the
  verifier's round 8 on 0.44.0, then the integrator's reviews of lane G, each fixed Fixed, answered or recorded in
  v0.44.1 and v0.45.0:
  - **Round 8, the verifier (at 585bbf1).** Blocking: a short-stance run lifting high and bouncing folded its swinging
    leg shut (stance 0.2 at the reach bound: the swing's ends keep the ground speed, the foot swings 87% of a leg past
    the stride's ends, the pelvis was lowered to 44-56% of H0 for it, and the lifted foot passed under the hips: legs
    2-8% of their length, knees flipping round at 18-50 m/s; fitGait's own output on the three rests; 25 of 1,248 of the
    corner grid). Change: legsOf measures the shortest leg at any phase as the clip holds it; under FOLD_MIN (25%)
    gaitClip refuses naming the speed and lift that fit, and fitGait slows to it (every grid failure was under 25%).
    Should-fixes: fitGait gives back unfittable numbers for gaitClip to refuse by field; reach and pace shown rounded
    up; NaN rates printed as themselves; a legless rest refused in words; the halving's whole speed taken down until it
    fits (test character 33's limp). Recorded: at 90 fps 929 of 1,248 slow gaits warned (97% by parts on a short spine).
  - **Round 8's review → round 9.** A knee went 61-85 mm under the floor (stance 0.2 near the reach bound lifting 9-15,
    bouncing 6: the pelvis under half of H0, the trailing knee bent forward through the floor; legs only folded to
    24-27%). Change: legsOf weighs the lowest a knee can be (kneeLow: ik3's apex turned the lowest way a forward knee
    can be, the pelvis half a % lower and either way along and across, bounce, sway and limp counted); under KNEE_FLOOR
    (0) refused and fitted (CMU_91's 309 → 289). fitGait fits speed and lift together. The pelvis's lone steps of two %
    beside still frames popped a short spine by parts (to 136% at 90, 104-121% at 75 and 80): pelvisGrid takes one end a
    % toward the other (Z_SLACK 0.75 of its drawn place, the legs still fitting). The integrator capped the rate at 75
    (from 90: at 75 steps 82%, at 80 89% and an elbow 118%, at 90 97%). The arms turning round on the seam read 101% by
    parts at 75 swinging 80 in 0.52 s: ARM_TURN, 250° a second squared of the cycle.
  - **Round 9's review → round 10.** Elbows popped (a lean spread up the spine decodes the shoulders back, so a hand
    aimed from the turned shoulder was past the arm's reach from the decoded one: the arm held straight, its bend 25 → 0
    in a frame; 109% at 75 plainly, 105% by parts): the torso is placed where its key decodes it before the hands are
    aimed (onKeyTorso; the arm bent 37-39° throughout; every made preset clip changed, its arms only). fitGait scans
    each whole speed down where the halving finds none (a gait playing only between two speeds). ARM_TURN's claim
    restated.
  - **Round 10's review → round 11.** A run's left knee turned round on the loop's seam (its foot comes forward there at
    a run's shortest cycles and a stance of 0.35-0.45: seamVelocity or pop@knee to 113.5%, 33 of 2,600 fitted runs, at
    every rate; MIN_RUN_CYCLE doesn't bound it). Change: the knees and feet read at the seam on every grid 55-75 gives,
    refused past SEAM_TURN (0.7) naming the speed that plays, fitGait slowing to it; the hands likewise (failing once
    searched, to 103%), the refusal naming the widest swing, fitGait narrowing.
  - **Round 11's review → round 12.** The seam was read where the feet were aimed, before the format's rounding (to 0.42
    under the sensors' pop rule: CMU_144's run taken at 0.70 read 0.91). Change: seamOf makes the keys about each grid's
    seam exactly as gaitClip makes them and reads them as the sensors do (the pop rule at the first and last steps
    counted conservatively), and gaitClip keeps those frames as keys whatever the budget; SEAM_TURN bounds that reading
    itself (to 1e-5 of the level against the sensors). The pelvis's whole-% steps either side of the seam jolted a short
    spine to 0.938: where the torso reads past SEAM_TURN pelvisGrid takes the pelvis's places about the seam again. The
    refusal's widest swing made monotone (every narrower whole swing plays); refusals name the whole of what fitGait
    makes of a gait.
  - **Round 12's review → round 13.** From a library clip's first key as the start, 8 of 227 gaits failed (a forearm
    into the hips, a wrist popping), and nothing had been measured from one: gaitClip refuses any start but the standing
    pose. fitGait made monotone in the lift (the highest whole lift some speed plays at, at the fastest speed there:
    test character 25's limp asking 35 played at 328 lifting 9, now 215 lifting 34). The pelvis's seam pass weighs the
    steps within the clip its frames make or stand beside, the pelvis along kept nearest (it had moved the seam's step
    two frames in, 0.779, and stepped on three axes at once). Recorded then, not bounded: the late-swing knee at the
    shortest swings (to 95% at 14.5-15.5 frames a swing).
  - **Round 13's review → round 14, and the margin rule.** The integrator's rule for WP-6.2 replaces "no fail found":
    every bound on what gaitClip accepts (and what fitGait returns) keeps the worst reading of each class of defect it
    bounds at about 90% of that class's fail level or under, on fresh grids over the whole accepted space at 55 to 75
    frames a second (real rates and every even frame grid), the library's rests plainly and test characters by parts
    (and everything by parts), raw and fitted, plus searches tuned to sit just under each bound; the measured worst is
    stated in the bound's comment with the grid it covers.
    - **The late-swing knee at the shortest swings** (blocking): CMU_18's rest read plainly, {cycle 0.555, stance 0.53,
      lift 10, bounce 5.3, dip 5.7, sway 1.7, lean -6, swing 17, speed 333.6} (a swing of 0.261 s), failed pop@knee at
      104.6% at 57.5 to 58 frames a second (32 frames: 15 a swing), and fitGait gave it back unchanged. Cause: near the
      reach bound the leading leg straightens as its foot comes farthest ahead and bends again as the hips come on over
      the planted foot; where the swing spans under 16 frames that falls within one key. The model can't read it (the
      keys' rounding moves the knee's step by up to 24 mm, and the pop rule's ratio turns that into readings where the
      model's points read none). Change: MIN_SWING 0.26 → 0.3 s, rate-free: a cycle's grid holds the even number of
      frames nearest it, as few as one fewer than 55 a second gives, and every cycle taken is 0.6 s or more, so a swing
      of T spans at least T × (55 − 1/0.6) frames, 16 at 0.3 s. The refusal names the shortest cycle and the longest
      stance that swing so (a run's only where its cycle is a run's), and a lighter limp. Measured on round 13's tree
      (every rest, the protocol's reading, the knee's pop the worst): over swings of 0.26 to 0.34 s on every even grid
      (2,492 gaits, 37,870 clips), by frames a swing 87.5% at 14.5 to 15.5, 82.7% at 15.5 to 16, 72.7% at 16 to 16.5,
      71.5% at 16.5 to 17; at the worst grid alignment (4,160 gaits, the three lowest grids, 27,213 clips) 78.7% at
      0.285 to 0.29 s, 70.5% at 0.29 to 0.3, 72.8% at 0.3 to 0.302. Round 14 took the swing to the ms, so 0.2995 s still
      passed (a 0.599 s cycle at a stance of a half, 15.97 frames a swing at 55: corrected in the second pass, below),
      and its climbs' worst, CMU_114 plainly at 55 at 75.5%, swung 0.2997 s. Every preset swings 0.3 s or more (the
      limp's right foot 0.3006 s).
    - **ARM_TURN removed** (found applying the rule): with every cycle 0.6 s or more, 250° for each second squared of
      the cycle allows 90°, past the swing's 0 to 80 range, so it could refuse nothing; the hands' turn on the seam
      stays SEAM_TURN's. Its refusal test refuses the 0.565 s cycle by its swing and reads the hands at 0.6 s
      (Mesh2Motion at the reach bound, 340: 69° refused at 76%, 68 and narrower play, fitGait narrows to 68).
    - **fitGait not monotone over whole speeds** (should-fix): test character 1's limping run lifting 35 plays at 215
      and 217 but not 216 nor 218 to 368 (its reach's bound), and the halving stopped at 215, so asking 218 to 368
      fitted 215 while asking 217 fitted 217. Change: after the halving (the fold and the knee, at each lift) every
      whole speed above its result up to the one asked (or the reach's bound) is tried from the top, the reach, fold and
      knee first and the seam only where they fit; the old scan where the halving found none is folded into it. Round
      14's 9,820 grid fits and 2,400 fits on ladders of asked speeds fit as round 13's did, at 65 ms a fit against 64.
    - **opts.budget** (nit): -1 threw a bare TypeError, NaN, Infinity or 1,000 kept 8 or 9 keys that failed, 150 to 300
      mm popped knees past 1.0. Change: a gait takes a budget of 0 (every frame a key) to 2 mm (its default) and refuses
      any other in its own words. Measured: 2,310 gaits at 0, 1 and 2 mm: none reads more at 0 or 1 than at 2, 82.3% at
      most.
    - **Measured** on round 14's fresh grids (seeds 1411 to 1418: 17,238 gaits, 9,820 fitted, 15,792 made), the presets
      on every rest at 55 to 75 (3,935 made) and 13,872 jobs tuned to the bounds (6,917 made): none fails. Round 14
      stated its own grids' class worsts (a knee's or foot's pop 69.2%, a hand's 57.8% by parts, the fold class 51.4%,
      the knee-floor class 47.3%, the pace class 51.8%); its review's wider grids read more in each (below), none past
      0.90.
    - **Outputs:** all 4,160 preset makes, the unfitted grid clips and the fits are round 13's byte for byte; what
      changed is what is refused (swings of 0.26 to 0.3 s; budgets outside 0 to 2 mm) and the swing refusal's words.
  - **Round 14's review → its second pass (2664d06, on 43d9df6).**
    - **fitGait past the pace bound** (should-fix): fitOf and legsFit weighed only the reach, fold, knee and seam, so a
      gait asked faster than SWING_SPEED (400% of H0 a second: its stride over its swing, checkGait's on any body) was
      slowed only to its legs' bound and given back at a speed gaitClip refused: Mesh2Motion's Quaternius rest asked
      {1000, 1.933 s, stance 0.65, limp 1, lift 9} fitted 78 (426%; 73 plays), the limp preset asked 300 on CMU_91
      fitted 121 (403%; 120 plays), on CMU_141 and CMU_54 122 (406%): the limp asked 300 or 1,000 on 9 of the 104 rests,
      and 346 of 2,912 long stances at the shortest cycles their swing takes asked 1,000 (to 425%). The same on ee57aaf:
      it predates round 14, whose grids never asked past the cap. Change: fitOf caps the starting speed at the fastest
      whole speed under the pace (paceSpeed, with checkGait's own arithmetic), as the reach caps it, and fitGait gives a
      gait back as it is only where its pace takes it too; the pace refusal names that speed ("use a speed of at most
      120 (fitGait slows it so), a shorter stance or a lighter limp"). Of 14,069 fresh-grid fits, the 398 that change
      are exactly those the base tree gave past the pace, each now the cap's whole speed, lift and swing as before; the
      2,912 scan, again at the swing's exact bound, all play (420 at the pace bound); no fit on any grid is refused;
      fitGait's time unchanged (about 80 ms a fit).
    - **Class worsts stated short** (should-fix): the review's grids on 43d9df6 (46,825 clips on all 104 rests at 55 to
      75: 12,168 fresh jobs, 14,203 tuned, 9,325 runs at their shortest cycle on the four highest grids, 9,760 fitted
      swings at the 0.2995 s bound on the four lowest, 2,288 high lifts, about 30 climbs; none failing, nothing at 0.90)
      read more than the comments and D71 stated: a knee's or foot's pop within the clip 79.7% climbed (CMU_54's run
      {0.6 s, stance 0.418, limp 0.003, lift 12.583, bounce 0.91, dip 0, sway 1.001, lean -6.803, swing 30.45} at 380.5,
      plainly at 70: 42 frames; 71.6% by parts), 75.4% tuned, 74.7% fresh (test character 14's slow walk at 74.9 by
      parts), against 69.2%; the model's fold under 27% 66.7% (test character 18's fitted run lifting 35, at 64.6; 51.4%
      stated); the knee within 40 mm of the floor 68.5% by parts, 65.4% plainly (CMU_81's run at 0.6 s, 455.5, at 60;
      47.3%); the pace past 360 60.6% over 1,478 clips (51.8%); a hand's pop 62.4% (test character 24's limp by parts at
      71.3; 57.8%). No class past 0.90, so no bound tightens. Change: each bound's comment restates its class's worst
      from the review's grids and this pass's, naming the case and the grid.
    - **The swing to the ms** (nit): checkGait rounded the swing to the ms, so 0.2995 s passed and a 0.599 s cycle at a
      stance of a half was taken (CMU_91's at 55 read 71.3%), against "every cycle taken is 0.6 s or more" and "16
      frames a swing at 0.3 s"; and round 14's late-swing worsts sat in that sliver (its climbs' 75.5% at 0.2997 s, the
      review's climbs' 76.4% and its 9,760 at 0.2995 s, 68.8%). Change: the swing is compared with 0.3 s to within a
      float's error (1e-9 s: 0.9375 s at a stance of 0.68 still swings 0.3 s) and shown rounded down in the refusal
      (0.1976 s reads 0.197), so the comments' 0.6 s and 16 frames hold; swings of 0.2995 to 0.3 s are refused now.
    - **The refusal's shortest and longest** (nit): computed against 300 ms while 299.5 passed, the named cycle was a ms
      longer than the shortest taken (13,928 of 20,000) and the stance 0.001 shorter (3,492). Each is now found against
      the check itself: over 20,000 random swing refusals every named cycle and stance is taken and a ms shorter or
      0.001 longer is not, and no swing shown reads 0.3; over 20,000 pace refusals the speed named is taken and one more
      is not.
    - **opts.start null** (nit): threw a TypeError from samePose; anything but a pose (null, a number, a string, an
      array) is refused as a start other than the standing one, in the gait's words.
    - **Measured on this tree** (seeds 1501 to 1513): fresh grids of 20,592 gaits on every rest at 55 to 75 (real rates
      and every even grid; 598 clips at 55, 1,859 at 75): round 14's kinds, those fitted asked up to 1,000 past the pace
      cap too; long stances and limps fitted past the cap or within 10% under it; those at the shortest cycles their
      swing takes (2,600); the review's pace scan (2,912); 2,080 runs at their shortest cycle on the four highest grids
      and 2,080 shortest swings at the reach bound, fitted from 1,000; 14,069 fitted, 17,880 made. 19,800 jobs tuned
      just under the bounds (each slowed or narrowed fit a half and 0.99 over its whole speed, its swing a half wider,
      and the speed just under the pace cap where that set it, on its two lowest, two highest and two other grids:
      10,515 made just under a bound, 9,285 refused just over, by the reach 650 gaits, the pace 400, the fold 47, the
      seam's legs 38 and hands 12, the floor 1). Seven climbs (1,620 steps; runs at their shortest cycle on 60 or 64 to
      75, the late swing at the exact bound on 55 to 63, a test character's hands on 69 to 74). None fails, plainly or
      by parts. Worst of each class: the pelvis's whole-% steps 82.3% (test character 9 at 72.5 and 75); a knee's or
      foot's pop within the clip 73.0% fresh (test character 8's fitted run by parts at 73.6), 73.5% tuned (100STYLE's
      side-run rest at 73.2, just under the reach), 79.7% at most climbed (the climbs from CMU_54's and CMU_19's runs
      found none higher); the late-swing knee at the exact bound 72.3% (climbs: CMU_18 {0.633 s, stance 0.526, swinging
      0.30004 s} at 303.5, plainly at 55, 34 frames; 67.2% by parts), 68.1% fresh at 55 to 63, 54.9% on the
      shortest-swing grid; the seam 70.0% at a knee, 69.9% at the torso, 69.3% at a hand by parts, the knuckles 67.9%
      and the elbows and wrists 64.4% by parts, no clip over its own seamOf reading; a hand's pop 62.6% by parts
      (CMU_13's migrated rest, a fitted limp at 73.7), the elbows and wrists 60.8%; pace past 360 69.9% (2,733 clips;
      UAL2's at 75 by parts), past 395 65.3% (586), just under the cap 67.1% (4,991); the fold class 61.4% (1,328),
      42.6% just under it; the knee-floor class 44.7% (126), the body into the floor 0, the feet 5.2%; jitter 57.0%;
      intersection 53.2%; joints 32.7%; twist flips 4.4%; stretch 0. By rate: 69.5% at 55 to 57.5 (69.9% tuned; 72.3% at
      55 climbed), 69.6% at 57.5 to 62.5, 71.3% at 62.5 to 65, 76.4% at 65 to 70, 82.3% at 70 to 75 and at 75.
    - **Outputs:** all 4,160 preset makes (104 rests, raw and fitted at their own speeds, 55 to 75) byte-identical; the
      limp asked 300 or 1,000 on the 9 rests above now fits to 120 and plays (36 makes, refused before); swings of
      0.2995 to 0.3 s refused; the swing and pace refusals' words.
    - **Tests:** the limp asked 300 and 1,000 on CMU_91 fits to 120 and plays, 121 refused naming 120; the pace refusals
      name the speed; cycles of 0.599, 0.5995 and 0.5999 s at a stance of a half refused, 0.6 taken; each named cycle
      and stance exact ({0.341 s, 0.547} names 0.663, 0.662 refused); non-pose starts refused; the late-swing case moved
      from CMU_114's 0.2997 s swing (refused now) to the climbs' worst at the bound, CMU_18 at 0.633 s, read at 55, 58
      and 60 under 90%. T1 78.0 s.
  - **The bounds as they stand**, each with its class's worst over round 14's grids, its review's and the second pass's
    (the protocol's reading unless given; by parts within 0.03 unless given):
    - MIN_SWING 0.3 s, to within a float's error (the late-swing knee's pop): 72.3% at the bound (CMU_18 at 55,
      climbed), 68.1% fresh, 67.1% tuned; 75.5 to 76.4% only at 0.2995 to 0.3 s, refused since the second pass (0.2 s
      from round 2, 0.25 from 5, 0.26 from 6, 0.3 from 14).
    - MIN_RUN_CYCLE 0.6 s, 0.65 lifting over 25 (a run's knee popping within the clip, the most any knee reads): 79.7%
      (the review's climb, CMU_54 at 70; 750 more steps found none higher), 75.4% tuned, 74.4% fresh; the seam 70.0%.
      The final review climbed to 91.1% on a fitted run (the close-out below; recorded, D90).
    - STRIDE_MAX 72% of a leg: just under it a knee's pop 75.4% (the review's tuned), 73.5% (5,101 clips), the seam
      69.5%, anything 82.3%.
    - FOLD_MIN 25%: the model's fold under 27% a knee's pop 66.7% (the review's), 61.4% (1,328 clips), joints 33.9%;
      just under it 47.3%.
    - KNEE_FLOOR 0 mm: the body into the floor 0 in every clip; the model's knee within 40 mm a knee's pop 68.5% by
      parts, 65.4% plainly (the review's), 44.7% (126 clips); just under it 42.7%.
    - SWING_SPEED 400% of H0 a second (fitGait slows to it since the second pass): past 360 a knee's or foot's pop 69.9%
      by parts (2,733 clips), past 395 65.3%, just under it 67.1% by parts (4,991).
    - SEAM_TURN 0.7 (the legs, torso and hands on the seam, read on the clip's own keys): the legs 70.0%, the torso
      69.9%, the hands 69.8%; knuckles 67.9%, elbows and wrists 65.1% by parts (not read by it); no clip over its own
      reading.
    - MIN_GAIT_FPS 55: 72.3% at 55 (the late-swing climbs), 69.9% on the grids at 55 to 57.5; MAX_GAIT_FPS 75: 82.3% at
      70 to 75 and at 75 (the pelvis's steps).
    - GAIT_BUDGET 0 to 2 mm: none reads more at 0 or 1 than at 2 (2,310 gaits); 82.3% at most.
    - RANGES (lift 9-35, bounce 0-6, dip 0-12, sway 0-4, lean -10-25, swing 0-80): drawn at their ends a quarter of the
      time on the fresh grids; within the readings above.
    - Not bound-specific: a hand's pop 62.6% by parts (the review's 62.4%; climbed 58.7%), the elbows and wrists 60.8%;
      jitter 71.8% (round 14's tuned, test character 5), 64.6% climbed (the review's); intersection 54.4%; joints 34.5%;
      twist flips 4.4%; the feet into the floor 5.2%; stretch 0.
    - ARM_TURN (250° a second squared, rounds 9 to 13): removed in round 14, subsumed.
    - Recorded, measured only: the pelvis's whole-% steps within a clip, 82.3% by parts (test character 9's diagonal
      step over a 13 ms key at 75), the most any class reads on fresh grids since round 12 (the run knee's 91.1% was
      climbed, D90); a three-axis step (1.008) never found.
- **The close-out** (lane G: ae25401, 16990ef; its review's fixes 00e3b69, a7b326e, f8cdd68; v0.45.1). Two passes, each
  reviewed (sound):
  - **The seam cache, bounded.** Round 12's `SEAMS` kept 32 `seamOf` readings a rest for as long as the rest lived, each
    with every grid's frames and keys: 40 distinct 3 s gaits on CMU_54 held 157 MB, the presets fitted and made on the
    64 library rests 297 MB, and shards over about 100 rests ran out of a 3 GB heap (round 14's final review). Each grid
    now keeps only its reading, the pelvis's places and the hands' footing (packed, 2.7 KB), the frames redrawn and the
    keys re-derived when read again; `seamAt` keeps readings across all rests while they weigh 16 MB or less
    (`SEAM_BYTES`, each reading weighing itself within 10% of what it holds), the one read longest ago dropped first.
    The first pass kept 32 readings in all, which made a make three times slower (74 ms against 23) when more than 32
    readings came between a gait's fit and its make (the review's 124 fits, then 124 makes); by weight 16 MB holds some
    225 presets or 57 gaits of 3 s, and that order makes at 23 ms again. Fitting more than about 225 presets before
    making any still re-reads them (the 64 rests' 256: 76 ms a make), as the comment says. Held after two forced gcs,
    heap and array buffers: 13 MB for the 40 gaits, 17 MB for the presets on 64 rests, 17 MB for all 104 bodies in one
    process (2,904 clips), past 16 MB by at most the newest reading's growth (about 0.3 MB). `proceduralResolver`'s
    ready-made parts are kept for the 96 used last (16 bodies of six), not without limit (43 MB on 104 bodies; about 24
    MB now, the seam's readings counted). Every output is the same to the bit: the presets' 5,824 makes on 104 bodies at
    55 to 75 frames a second, raw, fitted and asked at 300 and 1,000 (225 refusals), 7,072 grid gaits (922 refused) and
    the four gaits' 416 content ids through the resolver. `fitGait` is about 8% quicker over the grid gaits and
    `gaitClip` about 5% (by shard, 6 to 10% and 3 to 7%).
  - **The final review's worsts**, no fail anywhere, plainly or by parts. Fresh grids, 18,815 clips: a knee's pop 72.7%
    (CMU_77's walk at 74.675), the seam 70.0% at a knee or foot, 69.9% at a hand or the torso, knuckles 68.0%, elbows
    and wrists 65.7%, the hands' pop 65.0%, anything 82.3% (test character 9's pelvis steps). Tuned to the bounds,
    14,841 clips: a knee's pop 73.4%, the hands' pop 76.1%, the seam at a hand 70.0%, anything 82.3%. Runs under 0.65 s:
    71.6% fresh, 68.2% tuned, 77.4% over 27,487 fitted runs remade on every grid from 60 to 75.
  - **Climbed, recorded (D90):** a run's knee 91.1% on MESH2MOTION's Animated rest (cycle 0.6 s, stance 0.415, lift
    10.246, bounce 1.12, dip 6.819, sway 2.833, lean 3.407, swing 62.979) fitted to 377 for any faster ask, at 73.333
    frames a second (44 frames), plainly and by parts; also 88.1% (CMU_140 at 375.5, 70) and 87.2% (Quaternius's at 359,
    70.968, its numbers whole in `MIN_RUN_CYCLE`'s comment). The sensors' test pins it between 90% and 92%, naming what
    to restate when it moves. The bounds' comments say so: every bound but this one at 90% or under, and the pelvis's
    82.3% the most only on fresh grids (its worked sum with `partScale` 0.3488; a three-axis step 1.008).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.37.0, v0.37.2, v0.39.1, v0.42.1, v0.42.3, v0.42.4, v0.42.6, v0.44.0, v0.44.1 (lane G merged in
  michaelcrosato/my-3danimations#12), v0.45.0, v0.45.1

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
- **Landed in:** michaelcrosato/my-3danimations#10 (recorded only); the sweep, §9.3 and WP-4.5 in v0.42.7

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

## D83 · 2026-10-14 · Ultracode from here: implementers in worktrees, one integrator; gates in the main checkout

- **Principle:** process (`PLAN.md` §11), D21
- **Call:**
  - The owner's prompt for this session names ultracode, so the plan switches from D21's single agent to §11's
    multi-agent mode. The main session is the integrator: it owns §8.4's shared files, `docs/DECISIONS.md`, the root
    `package.json`, the `tsconfig` roots and the generated docs, and does every merge. Up to five implementers work
    in git worktrees, each editing only its WP's Owns; a verifier reviews every L WP and every gate; a separate fresh
    subagent writes each gate's held-out variants (§7).
  - A worktree lacks what the SessionStart hook leaves in the main checkout (`.cache/`'s pinned sources, rigs and
    held-out rigs; `node_modules`): G4 run 1's `vectors --check` failed so (D57). An implementer's worktree links
    `.cache` to the main checkout's and runs `npm ci`; gates run in the main checkout, never a worktree.
  - The branch is `claude/cool-goldberg-qgyu06`, restarted from `main` after each gate's squash merge with a fresh
    draft pull request (D82).
- **Why:** the owner asked for it; the lanes that remain (G6's preparation, G4 run 2's, Phases 7 to 10) have Owns that
  don't overlap often enough for parallel work to pay.
- **Answered:** yes, the owner's prompt, 2026-10-14.
- **Landed in:** (this pull request; no version)

## D84 · 2026-10-14 · A benchmark agent gets a /tmp of its own, the repository hidden; agents run at once (D54, D78)

- **Principle:** 3, §7 (isolation level 1), D54, D78
- **Call:**
  - `bench/runner/agent.ts` starts each `claude` in a mount namespace of its own (`unshare -m`, or `unshare -r -m`
    through a user namespace when not root; probed once by bind-mounting a directory). Its workspace and home are
    bound into a directory beside them, `<trial>-tmp`, at their own paths, that directory is bound over `/tmp`, and the
    repository and this session's Claude home are covered by empty directories; then `claude` starts in its workspace,
    `TMPDIR=/tmp`. What an agent writes to `/tmp` by name (`/tmp/cat.mjs`, as all 7 of D54's first trials did) lands
    in its own `<trial>-tmp`, kept with the run; the audit lists those paths as its `scratch`, apart from `outside`.
    Each trial records `privateTmp`.
  - D54's "runs that count at a gate run one at a time" is superseded: D78's gate set runs five agents at once
    (`--parallel 5`), as `tools/run/gate.ts` has it. Where no namespace can be made, the runner runs agents one at a
    time whatever `--parallel` asks (`lanes`), and the results file records the lanes it used.
  - The test: two stand-in `claude`s first on the agents' PATH, run at once, each report that they started in their
    own workspace with `TMPDIR=/tmp`, that their `/tmp` held only the way to their workspace and home, that the
    repository showed empty, and that the `/tmp/cat.mjs` each wrote is in its own `<trial>-tmp`. CI's runners (a user,
    not root) get user namespaces with `kernel.apparmor_restrict_unprivileged_userns=0`, so the test runs there too.
  - `runner.test.ts` and `briefs.test.ts` remove the temporary directories they make (packs, workspaces and installs:
    they were kept, and filled the disk).
  - The quiz probe at isolation level 1 passes: 10 of 10 in 4.9 s on the CLI's default model.
- **Why:** five agents writing the same `/tmp` file at once can read each other's work, and an agent able to read the
  repository can read the graders and the known-good solutions; the audit found neither in D54's or G4 run 1's trials,
  but a gate shouldn't rest on an audit when the machine can prevent it. Running five at once cuts a G6 run from about
  50 agent-runs in a row to 10 rounds.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.42.7

## D85 · 2026-10-14 · O3: the Vercel deployment is paused until the project is complete

- **Principle:** O3, WP-4.6, WP-8.3, G4, G8
- **Call:** the owner paused the repository's Vercel deployment: it isn't needed until the project is complete. Until
  then O3's default holds: demos run locally and in CI's e2e, their sheets kept as CI artifacts; G4's public link and
  WP-8.3's preview URL on the pull request wait for it and are reported when it comes; G8's phone review uses a build
  the owner opens. A pull request's checks no longer list Vercel's.
- **Why:** the owner's call.
- **Answered:** yes, the owner, 2026-10-14.
- **Landed in:** (this pull request; no version)

## D86 · 2026-10-14 · B1 on real rigs: the starters read meshopt; a model's move along the way it faces (D77's S7, S8)

- **Principle:** 3, 8, §7, G4 (D57, D77)
- **Call:**
  - **S7:** B1's starters load their character as B2, B3, B4 and B7's do (`loadGlb`: meshopt read, textures left
    out); the discovery starter does the same with three's own `MeshoptDecoder` and a loader plugin that drops texture
    slots, naming no `@m3a` package. G4's starters threw on the Quaternius mannequins (meshopt) and on KayKit's Knight
    (no image decoder in Node). A T1 test loads all four real rigs on hand through both starters as the grader does.
  - **S8 was the facing, not the floor:** core already takes the ground at the rest soles (G4 run 1's held-out rig
    stands at y −0.997 m; its planted toes sit 0 to 3 mm on the grader's floor). That rig faces +X (its armature turned
    a quarter about Y), and the known-good moved it along +Z, as the manual showed, so it walked sideways and its lower
    foot slid 1.2 to 3.1 m/s. `@m3a/three`'s `attach(...).travel` is the last update's root move in the root's parent
    space, along the facing bind reads from the bones; the manual's snippet moves the character by it. A test: facing
    +X it travels 2.83 m along +X with the standing ankle at 0.000 m/s (the old way, 1.26 m/s).
  - B1's known-good passes on the mannequins, G4 run 1's held-out rig and seeds 1, 37, 41 and 935; the four planted
    bad ones fail on gen-1, gen-37 and the held-out rig, naming their check (T2, 11 tests in 40 s).
  - **Left open:** KayKit's Knight floats 55 mm, because bind reads its soles from its arm mesh, the one with the most
    bones, so B1's known-good fails there; reading every mesh made its boots drag and moved the actions sweep, so the
    fix goes with a sweep of its own (in hand). B3's and B4's known-goods still move along +Z (their planted bad ones
    edit those lines); G6 grades them on generator seeds, which face +Z, and G7 reruns them on real rigs.
- **Why:** §7 wants the known-good to pass on any held-out variant before trials, and an agent can't see which way a
  model faces while bind can read it.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.43.0

## D87 · 2026-10-14 · bind reads a foot's sole from every mesh; long feet are the retargeting's next limit (R1)

- **Principle:** 8, 3, R1, G4
- **Call:**
  - `@m3a/three`'s `bind` places a childless foot's or toe's end bone where its part of the mesh ends, read now from
    every skinned mesh that skins it (half its weight or more), not only the mesh with the most bones. KayKit's Knight
    keeps its feet in its leg meshes (its arm mesh has the most bones), so it floated 55 mm at idle and its boots sank
    to −61 mm walking; it now stands on its soles (within 5 mm over its idle). The 21 generated characters, both
    Quaternius mannequins (two meshes each) and G4 run 1's held-out rig bind byte for byte as before (a test pins their
    bound rests' hashes).
  - **Measured on the Knight:** the whole-library sweep 96.1% → 92.3% (18 pairs fixed, 72 broken: pop 30, seam speed
    25, skate 24, slide 17, jitter 15); the six skeletons together 97.8% → 97.1% (8,148 of 8,388; the bar 95%). G4's
    set (idle, walk, run, jump, attack) still has no fail finding on any of the seven skeletons; on the Knight its warns
    change (a sole 36 mm under the floor at the run's end, a slide 85 → 81 mm, jitter on the balls moved).
  - **Why the Knight loses pairs:** its boots are 430 mm, 106% of its hip height, the toe 205 mm past the ball (the
    library's rests: 51 to 92 mm). The clips curl a human toe straight down in a swing (92 mm under the ball on their
    own body), which puts the Knight's 205 mm under, so the body must lift and a run never leaves the ground. A short
    end bone hides the boot's front under the floor instead (122 to 154 mm walking) while the sweep reads 96.9%: the
    sensors' gain, the eye's loss, so not taken. B1's known-good still fails its run on the Knight, which its test
    leaves ungraded, saying why.
  - **Left open (R1):** retargeting a long foot for clearance in core (the toe's curl and the foot's pitch capped so
    its tip clears the floor as the source's does, scaled by hip height; a heel behind the ankle, where the boot's is
    101 mm). Not on the ledger; G7 reruns the briefs on real rigs and is where it next shows.
- **Why:** a body standing in the air is a binding bug whatever the sensors read; the Knight's long feet are a real
  limit of retargeting a human foot's motion, and the sweep should show it rather than hide it.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.43.1

## D88 · 2026-10-14 · G4 = M1 passed on run 2, 9 of 9; what M1 means under D80, and the verifier's five fixes

- **Principle:** 1, 9, G4, K1 (D57, D80)
- **Call:**
  - **Run 2 passed**, 9 of 9, at adf77ee on 2026-10-14 in 41.8 min, in the main checkout (D83) with the pinned
    sources and the rigs fetched first. The commit was fixed before a fresh subagent wrote the held-out run, and D57's
    sweep outside the gate ran at the same commit first (`presweep.json`; its 240 failures are the gate's six-skeleton
    failures). Times from the files: commit 20:57:45, presweep 20:58 to 21:06, held-out run written 21:23, gate 21:54 to
    22:36 UTC. The record is `bench/results/gates/G4-run-2/`.
  - **Its commands:** check 4.9 s; test 76.9 s (702 passed, 7 skipped); doctrine 8 of 8; vectors byte for byte; the
    held-out run fresh (its rig, `talkinghead-mpfb` from met4citizen/TalkingHead@2afe6d7, CC0 by its author's README,
    used by no earlier run or test); the sweep under D80's reading, the six skeletons together 8,148 of 8,388 pairs
    (97.14%; bar 95%): gen-0 1,359 of 1,398, gen-1 1,370, gen-2 1,377, gen-3 1,375, the mannequin 1,377, the Knight
    1,290 (92.3% alone, R1, D87), the held-out rig 1,375 (98.4%) apart, 9,523 of 9,786 with it; T2 in 123.7 s; B1 5 of
    5 fresh agents, both discovery trials passing with the package; B1's held-out variant 5 of 5, its known-good first.
  - **What M1 claims, by D80's reading:** on the six skeletons together, 95% of the library's pairs gain no fail finding
    (the Knight alone does not reach 95%); the demo's set (idle, walk, run, jump, attack) shows no fail finding on any
    of the seven bodies, and every one warns (the Knight's sole 36 mm under the floor, a planted foot sliding 81 mm; on
    the held-out rig planted feet glide at 18.7 and 20.0 cm/s against a warn level of 18). Nothing per skeleton beyond
    that.
  - **The verifier** recounted every number from the outputs and found no blocking finding; its five should-fix items
    are fixed here: (1) the record dropped the warns skeletons added on 86 failing pairs: `npm run sweep -- --record`
    now writes the record, failures carrying `warns`, re-derived from the gate's raw results with no rerun (792 pairs
    carry an added warn, 706 passing and 86 failing); `presweep.json` keeps its count of warns, its role being the 95%.
    (2) CI's T1 never fetched the held-out rigs (D89). (3) The runner's audit took only a shell's absolute paths: it
    resolves relative ones now, and the record is corrected from the kept transcripts: B1-1, B1-3 and both discovery
    trials read packages' `.d.ts` files and the library's lock (inside the installed packages: not contamination), B1-2
    wrote a scratch file in its own `/tmp`; `transcripts.json` pins the twelve by SHA-256 (they live only in this
    machine's `/tmp/m3a-bench`). (4) This entry's wording of M1. (5) The presweep's times above, read from file times
    (its record has no date or dirty flag).
  - **Known limits of the audit's shell reading:** brace expansion, a subshell's `cd`, `pushd`, `cd` through a variable
    and `cd -` are missed, and xargs and `$(...)` approximate; a here-string or a grep pattern naming a package path
    counts as a read. None occurs in G4 run 2's transcripts (every command starts with an absolute `cd`).
  - **Not verified:** that the held-out variant's writer had not read the manual's examples (its prompt is not kept).
- **Why:** the gate met its bar under the reading the owner chose after seeing the numbers (D60, D80); saying exactly
  what that reading covers keeps M1 from claiming more than the outputs show.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.44.1, michaelcrosato/my-3danimations#11

## D89 · 2026-10-14 · CI's T1 green again: the held-out rigs fetched, gaits made 7 to 8 times faster, the same bytes

- **Principle:** process, WP-6.2 (D71), D33, D74
- **Call:**
  - CI's T1 was red from adf77ee: B1's grader test reads run 1's held-out rig and the T1 job fetched none. It fetches
    every gate's held-out manifest now, as T2 does (the cache key already covered them).
  - From 585bbf1 T1 also ran long (146.2 s on one runner, 78.1 s on another; budget 90 s) and "refuses a gait it can't
    play" passed vitest's 5 s. Round 7 didn't slow a gait (a walk 330 → 353 ms); its tests made 52 more (core's
    procedural test 57 → 83, the sensors' 32 → 58). Profiled: 86% of a gait was `snapLegs`, decoding the whole pose for
    each of 81 candidates a leg, three times a frame, to read one ankle. It now scores a candidate with `ankleOf`, the
    decoder's own steps for the ankle (`limbEnd` at `reachOf`'s length, `ik3`'s clamp, `Math.fround` as the decoder's
    Float32Array), and computes the hips once; the idle's `snapLegs` too.
  - **The same bytes:** 896 gait and idle clips on all 64 library rests (the presets, fitted presets, 256 seeded random
    gaits at 55 to 90 fps, starts, limps, 84 refusals with the same messages) serialize identically before and after,
    checked by the implementer and again by an independent reviewer; a test holds `ankleOf` to `decodePose`'s ankle
    exactly on 1,200 legs (it fails without the `fround`).
  - **Measured** (the same load): a walk 353 → 49 ms; the 896 clips 349 → 42.5 s (8.2×); core's procedural test
    34.6 → 9.2 s, the sensors' 39.3 → 8.2 s; the refusal test 4.1 → 0.6 s. No test skipped, sampled or given more time.
  - **Left:** `ankleOf` repeats `format/pose.ts`'s leg-end steps; the exact test catches drift, and sharing one helper
    is later cleanup.
- **Why:** a red T1 is fixed, not waited out; the regression was test count times an avoidable cost, so removing the
  cost keeps every test.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.44.1

## D90 · 2026-10-15 · WP-6.2 closes under a margin rule: every gait bound at about 90% of its class's fail level

- **Principle:** 1, 8, process (WP-6.2, D71)
- **Call:**
  - WP-6.2's verifier rounds 1 to 8 and the reviews of their fixes (rounds 9 to 13) each found the next failing corner
    of the gait space, because each bound sat at the fail line and "no fail found" was the only test. From round 14 the
    integrator's rule replaces it: every bound on what `gaitClip` accepts and `fitGait` returns keeps the worst reading
    of each class of defect it bounds at about 90% of that class's fail level or under, on fresh grids over the whole
    accepted space at 55 to 75 frames a second (real rates and every even frame grid), the library's rests read plainly
    and test characters by parts, raw and fitted, plus searches tuned to sit just under each bound; each bound's comment
    states its measured worst and the grid behind it.
  - Under it round 14 raised the shortest swing to 0.3 s (the late-swing knee: 104.6% at 0.261 s, 72.3% at 0.3 s) and
    made `fitGait` the fastest whole speed that plays, within the pace bound; its review and the second pass's found no
    fail over more than 60,000 clips.
  - **Recorded, not bounded:** a run's knee popping within the clip reads 0.911 of the fail level on one gait `fitGait`
    returns (MESH2MOTION's Animated rest, cycle 0.6 s, stance 0.415, fitted to 377, at 73.333 frames a second; also
    0.881 on CMU_140 at 70 and 0.872 on Quaternius's at 70.968), predating round 14. It is not a fail; a further round
    to win the last point is not worth its cost, so the bound's comment states it and a test pins it between 0.90
    and 0.92 (v0.45.1), naming what to restate when it moves.
- **Why:** a bound that sits at the fail line is moved by the next grid; a stated margin makes the claim checkable and
  stops the rounds. The one class past 0.90 by 1.1 points is named rather than chased.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.45.0, v0.45.1, michaelcrosato/my-3danimations#12

## D91 · 2026-10-15 · G6 passed on run 1, 20 of 20: every brief and its held-out variant 5 of 5

- **Principle:** 1, 9, G6 (§7, D78, D84)
- **Call:**
  - **Run 1 passed**, 20 of 20, at a9731b1 (0.45.1) on 2026-10-15 in 17.2 min, in the main checkout (D83) with the
    pinned sources and the rigs fetched first. The commit was fixed first (committed 22:04:27; T0, T1 and T2 passed
    locally and CI went green at 22:07). A fresh subagent then wrote the held-out run, 22:10 to 22:11 UTC; it read
    neither the manual nor a known-good solution (but two decision entries, below), and its file list is kept. An
    independent check found that each variant keeps its brief's job, contract and pass rule, describes its character as
    the seed generates it, and uses a fresh seed. Each brief's known-good passed on its variant at 22:17 to 22:18, and
    the gate ran from 22:19 to 22:36. The record is `bench/results/gates/G6-run-1/`.
  - **Its commands:**
    - check 10.6 s; test 76.0 s; doctrine 8 of 8; the pinned sources and `library/moves.json` as they give it;
      vectors byte for byte;
    - composed clips passing QA (the example recipes, the procedural sources, the actions and their cuts) 18.1 s; graph
      simulations deterministic (the expected traces exactly, a run the same twice, save and restore) 5.7 s;
    - T2 in 128.8 s (the graphs in Node and Chromium, library QA, the sweeps in full); the held-out run fresh;
    - B2, B3, B5, B6 and B7: each 5 of 5 fresh agents, and 5 of 5 on its held-out variant (seeds 722, 808, 765, 871 and
      809: a bulky ue5 body, a child, a chibi with twist bones, a heroic rigify body with twist bones and a tall one).
      50 of 50 trials, isolation 1 with each agent's own `/tmp`, five at a time, 17 to 149 s and 5 to 22 turns each,
      $7.15 in all.
  - **What the agents read:** nothing outside their workspaces and their own `/tmp`. The verifier read all fifty
    transcripts (379 tool calls), and the records' audit matches them except one over-report. Twenty trials kept
    scratch files in their own `/tmp`. Some read past the manual into the installed packages' types, one README and
    some built JS: all five of B3's variant trials, three of B6's and two of B7's across brief and variant. That shows
    what the manual leaves to the types: `Animator.layer`'s weights and masks, `contactRoot`, `@m3a/three`'s attach,
    the recipe pose step's arm fields and signs, and `simulate()`'s result shape. It is WP-7.3's input.
  - **The held-out check's three nits,** recorded and not changed (the writer's text):
    - B2's title names a tavern its scene doesn't have.
    - B6 calls the draw-back a "wind-up", the word D77 gives a manual example.
    - B6 reuses more of its original's wording than the others.
  - **The gate's verifiers** (two lenses, D83): one on the records and the gate's line, one on the agents' isolation
    and the audit. They recounted the numbers, regraded four trials from copies (all pass) and checked that the
    grader's inputs were untouched. Their findings, each fixed or answered:
    - **The record's byte copies were not committed.** The local exclude that kept the gate checkout's untracked
      files out of `git status` is shared by every worktree, so the first record commit silently skipped
      `bench/results/2026-10-15-default-*.json`, which the README said it held. They were committed in 76c54ce, and
      the exclude is gone.
    - **The writer read D76 and D77,** which describe the known-good solutions and name the manual's examples. It
      read neither the manual nor a known-good solution. Diffing every variant against its original, the one trace
      found is B6's "wind-up"; B6 passed 5/5 on its original too. Recorded, not rerun. From G7, a held-out writer
      reads §7, D78, the briefs, the starters, the graders and the generator, and no decision entry that describes a
      solution or a manual example; the checker reviews the read list against that bar.
    - **D84 hid only the checkout the runner ran from.** The integration worktree, holding the graders, the
      known-good solutions and the held-out originals, stayed readable, and with no PID namespace `/proc/<pid>/root`
      reaches the outer mount view. No trial came near either: no call names `/home`, `/root`, `/proc` or another
      worktree. So G6's isolation rests here on the transcripts, not the machine. Fixed below.
    - **The audit's blind spots:** Write and Edit content wasn't scanned; `/proc` counted as an ordinary path; a path
      named only in a heredoc counted as a read (B7-2 on the variant, `@m3a/library`'s Node entry). Fixed below.
    - **Nits:** the README's costs rounded and model named; the quiz's time and commit; the cuts on all six characters
      proved by T2's full sweep, not the composed-clips step; the gate report records its commit; the freshness log
      on a run with seeds only; B7's brief names the grader's check before the jump; B3's check finds the hips with
      `bind()` (on rigify the name regex printed NaN).
  - **Fixed after the gate** (063c0a3, 7ae691e, each reviewed; the gate not rerun, since no trial came near what
    they close):
    - **Isolation.** `bench/runner/agent.ts` covers every checkout `git worktree list` gives, the git directory and
      the Claude home (`hidden`), and binds `/dev/null` over `~/.claude.json`. Each agent runs in a PID namespace with
      a `/proc` of its own (`unshare --pid --fork --mount-proc --kill-child`), and the timeout kills the whole
      namespace. Where `setpriv` works it starts without CAP_SYS_ADMIN, so it can't unmount the covers or mount
      anything, even through a nested user namespace. Each trial and results file records `ownPids` and
      `capsDropped`, and each falls back cleanly where the machine refuses it. A stand-in agent saw 102 entries of
      the other checkouts, 86 processes and the repository through the runner's `/proc` entry; now it sees 0, 4 and
      nothing, and an unmount is refused. D84's test asserts all of it. `claude --version` still starts inside, and
      node and curl still reach the proxy.
    - **Why hide, not allow:** every copy of the graders outside `/tmp` lies in a worktree. Hiding keeps D84's
      mechanism, which is tested as root and through a user namespace on CI. A fresh root holding only what an agent
      needs would have to carry everything the CLI reaches for, and a miss would show only as failed trials at a
      gate.
    - **Known limits:** the agent still runs as root, so it could read a raw disk under `/dev`, and `/root`'s other
      files (`.ssh`, `.aws`, `.gitconfig`) stay readable. No G6 trial named any of them, and the audit would list
      them. They are closed before G7's trials (running agents as an unprivileged user).
    - **The audit** now scans a Write's content, an Edit's new string and a heredoc that `cat` or `tee` writes,
      taking relative paths from the written file's directory, and catches paths in template literals. What these
      name counts for `outside` and `scratch`, not as a read past the manual. Another process's `/proc` entry is
      outside, by PID, glob or shell variable; `/proc/self` and `/proc/$$` are the agent's own. Its header lists what
      it still over- and under-reports. Re-run over the 50 kept transcripts, unchanged by SHA-256, one field changes:
      B7-2's `pastManual` on the variant becomes empty. `outside` stays empty in all 50.
    - **The rest:**
      - `npm run gate` records the commit it ran at and whether the tree differed from it.
      - `fixtures heldout` says "no rig: seeds only" and lists each variant's seed against the 27 already used.
      - B7's brief names the check before the jump.
      - B3's starter check finds the hips with `bind()`; B3's known-good is graded on a rigify character (gen-7) in
        T1.
  - **Worktree lanes' `.cache` (D83):** a lane linked the main checkout's whole `.cache`, so T0's TypeScript build
    information was shared, and a typecheck could pass on a newer build info another checkout wrote (found by the fix
    lane). From here, a lane's `.cache` is its own directory, linking only the pinned sources and the rigs, as the
    integration checkout's does.
- **Why:** G6's line, command by command; the held-out variants stand in for briefs the agents have never seen, on
  bodies no test grades on.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.45.1, v0.45.2, michaelcrosato/my-3danimations#12

## D92 · 2026-10-16 · WP-7.1: one reply on four surfaces; what the registry adds, refuses and keeps

- **Principle:** 2, 7, 8, 9 (WP-7.1, PLAN.md §5.6)
- **Call:**
  - **One reply everywhere.** `defineTool` and `Registry` (`packages/tools/src/registry/`) give every surface one
    reply, `m3a.reply/1`: `{schema, tool, status, verdict, lines, data, images, revision, error, next}`. It is the
    CLI's `report.json`, MCP's `structuredContent` (its `outputSchema` built from the tool's), what the API returns
    and what the console handle `__M3A_TOOLS__` returns. `data` is a JSON object or null on every reply, and a tool's
    declared output schema is checked on each one. The verdict is one line; each detail line is one line; every name
    or value a refusal echoes is quoted and cut to 60 characters.
  - **Exit codes:** ok 0; findings 1; error 1 (the tool could not finish, its verdict says so); usage 2. On MCP, a
    failed tool or a wrong call is an `isError` result; findings are not.
  - **What the registry adds and reserves:**
    - `verbose` on every tool, for the details: the text fits 20 lines otherwise. MCP has no flags, so it reads the
      same parameter. Past 10 images the text folds them into one line. `m3a help`'s tool list is exempt: it lists
      every tool, one line each.
    - `if_revision` and `request_id`, on edits only and reserved on every tool. An edit must read its target's
      revision.
    - The examples, in JSON Schema's `examples`.
  - **Unknown names are refused** on every surface, naming the closest valid one. This covers tools, flags,
    arguments (own properties only, so `constructor` or `__proto__` is unknown too), help's own arguments and fields
    of nested objects. A parameter name is a letter, then letters, digits or `_`, so the CLI can spell every one.
  - **request_id** is kept in the registry by tool and id, compared as canonical JSON (keys sorted, defaults filled).
    The same id with other arguments is refused, naming what differs. Only applied replies are kept, and an edit that
    applied is kept even when its output check then fails, so a retry never applies it twice. The store is in memory
    (the API, the MCP server, the console). The `m3a` command refuses `--request-id` until WP-7.2a's durable store,
    and `m3a help` marks it so: a promise the surface can't keep is refused, not ignored.
  - **MCP** follows the 2026-07-28 revision (stateless requests with `_meta`, `server/discover`) and still answers the
    `initialize` handshake of 2025-11-25 back to 2024-11-05, as current clients (the Inspector among them) open with
    it. Tool names use `_` for `.`. An unknown tool is a JSON-RPC error; argument errors and tool failures are
    `isError` results. Its text content is the verdict-first rendering, not the serialized JSON (a spec SHOULD);
    `structuredContent` carries the whole reply.
  - **Images** go to `check-output/<tool>/`, listed with size and approximate tokens; MCP also sends image content.
    The Node host reads files under the working directory only.
  - **Deviations in Owns and size:** `src/node.ts` (the Node host, the `./node` export and the `m3a` bin, WP-7.4's to
    build for publishing), the shared `src/index.ts`, the e2e registry's `mcp-smoke` suite and a dev dependency, the
    MCP Inspector 2.9.0 (pinned, its own commit). 1,323 new lines, past M's 1,200, from the verifiers' findings.
  - **The verifiers,** four rounds (D83): round 1 found that MCP ignored `verbose` (blocking), prototype names
    accepted and edits without a revision; round 2 an array in help's `data`, a failing tool untested on every surface
    and parameter names the CLI couldn't reach; round 3 nits only. Each was fixed, with 44 targeted mutants killed.
- **Why:** one registry keeps the surfaces from drifting (D11): the parity test compares descriptions, replies, exit
  codes, `isError` and the text with and without `verbose`, on every example. A wrong call comes back naming the fix,
  which shardfall's dry run asked for, and the official Inspector proves the server against a client not written here.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.46.0

## D93 · 2026-10-16 · WP-7.2 split in two; the tools' tiers, writes and characters

- **Principle:** 2, 4, 8, §8 (sizes), D10, D53
- **Call:**
  - **The split.** Scouting each tool against the packages put WP-7.2 at about 4,460 lines: the tools, their host
    (library access, write roots, a durable request store, a workshop with undo) and what other packages lack (a
    glTF skeleton reader, glTF animation and BVH writers, a set writer, the D80 judge moved out of the sweep). Over L,
    so two Ls with a clean seam at binary input and characters: 7.2a (find, check, change, ship; about 2,430) and
    7.2b (retarget, compose, exchange; about 2,030). Each runs as a foundation lane, then three tool lanes at once.
  - **Tiers:** every tool opens the library at the game's tiers, `game.json`'s `tiers` in the working directory, else
    cc0 (D10, D53). Only `license.check` takes tiers as an argument. Rejected: read-only tools seeing every tier, which
    would let an agent build on clips it can't ship and learn it only at the end.
  - **Writes:** the tools write only under `workshop/` (edited clips, id `WORKSHOP/<Name>`), `.m3a/` (edit history,
    retry records), `imports/` (imported local sets, until WP-9.1's submit) and `check-output/`; never `library/`.
  - **MCP's `outputSchema`** is left out of `tools/list`, about 5,100 tokens a listing; `structuredContent` is still
    validated in the tests.
  - **Characters bind through core** (`@m3a/io` reads the skeleton, core recognizes and binds it), not three.js's
    loader, which fails in Node and renames bones; the tools take no generator seeds (the package boundary keeps the
    test characters out).
  - **Names:** `license.check` for the CLI's `license check`; one `character` parameter where export and the
    simulation each named their own.
  - **Plan corrections:** WP-7.2's carry pointed at the strike's measure (`clips.rs:496-550`), which `facts.strike`
    already gives; the clip tool is `anim_tools.rs:750-800`. `npm test -- tools` also runs every repo `tools/**`
    suite, so each half's Verify names its packages.
- **Why:** sizes are counted, and a WP over L is split (§8); the seam leaves 7.2a's tools usable on their own, and the
  policies keep an agent's view of the library the one its game ships.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.46.0

## D94 · 2026-10-16 · Benchmark agents run as nobody with no capabilities; the CLI's credentials are handed to them
(D84, D91)

- **Principle:** 3, §7 (isolation level 1), D84, D91
- **Call:**
  - **Who the agent runs as.** Where the runner is root, `bench/runner/agent.ts` starts each trial's `claude` in its
    mount and PID namespaces as `nobody` (the passwd entry, 65534). Its supplementary groups are cleared, and it gets no
    capabilities and no new privileges (`setpriv --reuid --regid --clear-groups --bounding-set -all --inh-caps -all
    --no-new-privs`). The switch is probed once in the namespace (`agentUser`).
  - **What refuses it.** `/root` (`.ssh`, `.aws`, `.gitconfig`, `.boto`, the proxy's CA), the raw disks under `/dev` and
    other users' unreadable files. The covers over every checkout, the git directory and the Claude home are mode 0700,
    so it is refused rather than shown an empty directory. Neither `umount`, `mount` nor a nested `unshare -r -m` can
    lift them.
  - **What it is handed.**
    - Its workspace, home and `<trial>-tmp` become its user's. The walk lchowns real directories only: a link is handed
      itself, never what it leads to, and is never walked through.
    - The /tmp directories leading to them stay root's, so it writes nothing beside them.
    - The files that NODE_EXTRA_CA_CERTS and SSL_CERT_FILE name are copied into `<home>/.ca/`, and both variables point
      there.
  - **What it shares with other agents.** Nothing: /tmp (D84), /var/tmp and /dev/shm are each its own in its namespace.
    The last two are an empty tmpfs, mode 1777 as before. Agents run at once, all `nobody` now, meet in none of them.
  - **The audit.** The audit counts a file in any of those three as the agent's `scratch` (`ownScratch()`: /var/tmp and
    /dev/shm where each is a directory, not a link, as the namespace covers them). Without a namespace, it counts such a
    file as `outside`. Before this, a file in /var/tmp read as `outside` and a file in /dev/shm was not reported at all.
  - **Credentials.** The CLI does not get its credentials from the proxy, as §7 implied. In a cloud session it reads
    `/home/claude/.claude/remote/` (root's alone), whoever it runs as; as `nobody` it said "Not logged in". The
    namespace script copies that directory into a tmpfs of the namespace's own, owned by the agent's user, binds it over
    the directory and drops the scratch mount.
    - The CLI reads the credentials where it did as root.
    - The copy never lands on disk and ends with the namespace. The session's files stay root's (the test checks this).
    - The agent's tools can read the copy, as they could read the original as root, so its reach is no wider than
      before.
  - **Where the machine refuses.** A runner that isn't root (CI) runs agents as itself, already unprivileged, with all
    capabilities dropped in its user namespace. Where the switch is refused, the agent runs as root. Where `setpriv` is
    refused, it runs as root with its capabilities.
  - **Records.** Each trial and each results file record `uid` (as the machine counts users) and `unprivileged`, beside
    `privateTmp`, `ownPids` and `capsDropped`. `capsDropped` now means no capabilities at all. The audit's and the
    transcripts' formats are unchanged, and the grader reads the workspace as root, as before.
  - **The test.** D84's test now asserts:
    - the user, and zero capabilities;
    - `/root`, the raw disks and every checkout refused to `nobody`;
    - the workspace and home writable, and the CA read from the home's copy;
    - the credentials' copy owned by the agent's user, while the session's stay root's;
    - a directory link in the workspace handed alone, with what it leads to still the runner's;
    - /var/tmp and /dev/shm empty and private between two agents run at once;
    - the audit's scratch and outside for /var/tmp and /dev/shm, with and without a namespace.

    It passes as root here and as a non-root user through a user namespace. Two reviews caught real faults, and each
    fails on its version:
    - the link assertion fails on the first walk (a recursive readdir with lchown, which went through links to
      directories);
    - the audit assertion fails on the old classification.
  - **Proof.**
    - Zero-cost probes as `nobody` in the namespace: `id`; `/root`, `/dev/vda`, `/home/user/*` and the hidden checkouts
      refused; /var/tmp and /dev/shm its own; the workspace writable; `node`, `npm` and `npm run check` run in it; curl
      and node reach the API, the registry and the proxy; `claude --version` starts.
    - The quiz, one real trial on a clean tree: 10 of 10 in 4.0 s, $0.026, uid 65534.
    - B2 `--fake` passes.
- **Why:** to close D91's known limits before G7's trials. As root with CAP_DAC_OVERRIDE, the agent could read the raw
  disks and `/root`'s other files. Now the machine prevents it, rather than the audit only reporting it.
- **Known limits:**
  - **World-readable files stay readable, as for any user.** This covers the system's files, the two names in
    `/home/user`, `/home/claude`'s world-readable files and a sibling repository in a session with several. Covering
    `/home/claude` except `remote/` is left open, because the CLI reads its cloud-session state there. The audit lists
    any such path.
  - **The CA is copied at each trial's start.**
- **Answered:** no: made without a response, to review; the credentials hand-off is flagged for the owner on
  michaelcrosato/my-3danimations#13.
- **Landed in:** v0.46.1

## D95 · 2026-10-16 · WP-7.2a's verifier fixes, and every crossing of its Owns

- **Principle:** 2, 7, 8, 9, §8 (sizes), D10, D92, D93 (WP-7.2a, PLAN.md §5.6)
- **Call:**
  - **Concurrent edits are locked.** An edit writes under its clip's lock, `.m3a/locks/<Name>.lock`.
    - Within one process (the API, one MCP server), two edits take turns, whatever the host. The registry keeps its own
      lock per path (`locked`: a chain of promises, platform-neutral).
    - The host's lock keeps out other processes. The Node host creates the lock file exclusively (`lockFile` in
      `src/node/files.ts`).
    - The lock is held across the revision's re-check, the history's write and the clip's write. The re-check compares
      the history's text as well as the file's revision. So of two edits from one state, the second is refused with
      E_CONFLICT, and nothing is lost.
    - A lock is stale when its process on this machine is gone, or when it is older than 30 s.
    - One waiter at a time breaks a stale lock, under `<lock>.break` (taken the same way). It removes the lock only
      while it still holds what was judged stale, so no waiter removes a lock another just took in its place.
    - A `.break` file left by a waiter killed while breaking is stale by the same rule. A lock still held after 10 s
      gives E_LOCKED.
    - A host without `lock` is safe within one process. Across processes, only a host's lock keeps writers apart.
    - E_CONFLICT carries the current revision and a next hint naming the retry, through ToolError's optional `next` and
      `revision`.
    - This replaces plan §3's "no lock files". A two-process race disproved it (both processes replied applied), and so
      did an in-process race on a host without a lock.
  - **An outside edit resets the history for every tool.** readClip reads a workshop clip the way the edit tools do
    (readTarget).
    - Its history counts only while it is the file's, or when it steps back from a write cut short.
    - Otherwise the file is read like any clip file, on the manifests' rest, found by its own id or by the library clip
      its provenance names.
    - A history whose rest doesn't have core's Rest shape is unreadable.
    - While a history is the file's, its rest is the one the clip was made on, kept as is if a manifest changes later.
      .m3a/ is m3a's own state, so it is checked for its shape, not against the manifests. Checking against the
      manifests would reset every copy's undo whenever a library update re-measures a rest.
  - **Tiers for the user's own clips (D93).** A library id outside the game's tiers is still refused.
    - A file, JSON or workshop clip that needs such a tier gets a warning line naming the game.json line to add.
    - This applies in every tool that loads a clip, and on an edit's undo and redo.
    - The check covers the clip's own set, the library clips it names, and each part of its license.
  - **Bounded edits.** A recipe whose running length passes 600 s (M2-E010) at any step is refused as usage, naming the
    step, before it compiles.
  - **One naming, one hint form.**
    - Replies name a clip one way (`clips.ts` naming): its id, `WORKSHOP/<Name>`, or the path as given. Clip JSON, an
      absolute path or a path with a control character becomes `<the clip's JSON>` / `<the clip's file>`.
    - A hint writes each call in backticks as the m3a command takes it, `--<parameter> <value>` with the parameter's own
      name. The CLI parses it as written, and on MCP it reads as the arguments.
    - A flag alone in backticks (`--if_revision X`, `--save_as WORKSHOP/<Name>`) is one to set on the call just made,
      added or in place of its own. Both E_CONFLICTs, E_EXISTS, the save_as refusal and E_NO_CLIP name a parameter that
      way.
    - E_EXISTS carries the revision, and names changing in place as "the same call on WORKSHOP/<Name>", with no clip id
      in backticks.
    - The tests parse every example's next, and the E_EXISTS and E_CONFLICT texts, each flag alone set on the call just
      made.
  - **No absolute path in a reply.** E_PATH, E_WRITE and E_LOCKED call an absolute path they were given "the file"
    (`files.ts` shown, `common.ts` absolute). They never name the working directory's absolute path. E_CLIP, E_REST and
    validate do the same.
  - **Leftovers.** A write killed before its rename leaves `<file>.<pid>.tmp`. The file's next write sweeps it once its
    process is gone. The request store also sweeps its own.
  - **Retries.** A history keeps the requests of its last 8 writes, not only the last one.
  - **D10's tier rule** is exported from @m3a/library (`tierOf`, `credited`) and used by the tools. license.check owes
    credit per license part.
  - **Crossings of WP-7.2a's Owns, all lanes (a0, a-find, a-check, a-change, a-fix):**
    - WP-7.1's files:
      - `packages/tools/src/registry/registry.ts`:
        - Host and ToolContext gain tryRead, write, remove, library and lock; LibraryAccess.
        - Only examples[0] in the schema, and shorter reserved descriptions.
        - ToolError's next and revision.
        - The registry's own lock per path within one process, and the pre-run E_CONFLICT's next in the hint form.
      - `registry/index.ts`: exports; it no longer lists tools.
      - `registry/reply.ts`: replySchema's doc.
      - `registry/tools.ts`: deleted, moved to `tools/base.ts`.
      - `src/mcp.ts`: tools/list without outputSchema.
      - `src/cli.ts`: the report-write warning; help's --request-id note.
      - `src/node.ts`: the Node host's library, writes, durable store and lock; E_PATH and E_WRITE without the absolute
        working directory or an absolute path given.
      - `src/node/{files,library,store}.ts`: new.
      - `src/index.ts`: the shared export list.
      - `test/registry-surfaces.test.ts`: built from the demo tools; one line pins the E_PATH words.
      - `test/registry.test.ts`: the E_CONFLICT next.
    - The library (WP-5.1, 5.5, 5.7):
      - `packages/library/src/load/library.ts` and `load/index.ts`: Library#about, SetAbout, SourceAbout.
      - `src/search/index.ts`: `mps`.
      - `src/license/index.ts`: `tierOf`, `credited`.
      - `src/index.ts`: the shared export list.
      - `test/library/load.test.ts`.
    - The sensors (D44): `packages/sensors/src/fix/fix.ts` and `fix/index.ts` export `worse` and `ANSWERS`.
    - WP-6.5: `packages/tools/src/sim/film.ts` (`strip` extracted).
    - WP-7.3: `packages/tools/MANUAL.md`, its two request_id sentences only.
    - The e2e registry: `tests/e2e/mcp-smoke.e2e.ts` runs each example in a fresh seeded working directory (acdeeb1).
    - Test helpers beyond `surfaces.ts`: `packages/tools/test/helpers/{cwd,tally,race,workshop}.ts`.
    - `.gitignore`: workshop/, .m3a/, imports/.
    - WP-7.2b's foundation lane (b0) also touches `registry.ts` and `node.ts` (bytes), in its own decision. This lane
      merges onto the integration head with b0 (3f8cf6c) without conflict.
  - **Owns edited to match:**
    - WP-7.2a's Owns becomes `packages/tools/src/tools/*`, `packages/tools/src/node/*`,
      `packages/tools/test/tools-*.test.ts` and `packages/tools/test/helpers/*`.
    - Everything else above stays a logged crossing, also listed under "Also touches".
  - **Size:** about 3,688 new lines: 2,659 across the four lane merges, plus 1,029 from the verifier fixes and their two
    reviews. That is past L's 3,000, because of the verifiers' findings.
  - **The verifiers:** two lenses, then two reviews of the fixes.
    - Contract: should-fixes on naming, the hint form and the records. Nits on conventions, the tier rule, `last`,
      output schemas and refusals.
    - Adversarial: two blocking findings (concurrent edits lost; the outside-edit reset only partial). Should-fixes on
      slow retimes and out-of-tier files. Nits on paths, quoting, credit parts, the example's request_id, .tmp files and
      long names.
    - The first review of the fixes:
      - One should-fix: two in-process edits on a host without a lock.
      - Nits: an echoed absolute path, the conflict hints' form, the workshop's .tmp files, undo's tier warning, and the
        history's rest. The last is answered above.
    - The second review: sound. Its nits were E_EXISTS's hint form, a stale lock broken by two waiters at once, and an
      out-of-date note about lane b0's merge.
    - Each is fixed, with a test that fails without the fix where one could be written.
- **Why:**
  - An edit tool that can report applied while the edit is lost breaks the plan's contract (§3, §5.6), on any surface.
  - A history that every tool reads one way keeps each measurement on the clip's own rest.
  - Flagging rather than refusing the user's own copies keeps D93's promise that an agent learns early what it can't
    ship.
  - One hint form lets a hint be run as written on every surface.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.47.0

## D96 · 2026-10-16 · WP-7.2b: the retarget, compose and exchange tools; lane b0's foundation rebuilt; every crossing

- **Principle:** 2, 7, 8, 9, §8 (sizes), D10, D49, D80, D92, D93, D95 (WP-7.2b, PLAN.md §5.6)
- **Call:**
  - **Lane b0, the foundation** (3f8cf6c, in 0.47.0's tree; its own decision text was lost at the pause and is rebuilt
    here from ba24948, a37eafe, 2c128f2, c356c5e and fe6594a, four review rounds):
    - **R6, a character's bytes:** `ctx.bytes(path)` in the registry (E_HOST "opens no binary files" without one) and
      the Node host, confined to the working directory as text reads are (a path or link out, or a missing file, is
      E_PATH).
    - **I1, io's glTF skeleton reader:** `skeletonOfGltf(doc)` gives the skeleton, its rest in the scene's space and
      its nodes: the biggest skin a mesh node uses (as three's bind takes the skinned mesh with the most bones), else
      every node; parents the nearest joint above through any helper node. Joints no vertex is weighted to are left out
      with every joint above a weighted one kept, as three's bind does (20 of KayKit's knight's 41 joints: IK targets,
      poles and hand slots that misled recognition by shape); a VRM, or weights it can't read, keeps them all.
      `meshEnds` gives D49's sole end bone where a foot's mesh ends, from the vertices weighted half or more to the
      foot's last bone, skinned by the joints alone (glTF ignores the mesh node's transform), and says when it can't
      read them (`unread`: compressed, sparse or broken accessors). io's accessors read signed bytes and shorts
      (KHR_mesh_quantization) and refuse sparse ones. Rigify, the 20 generated characters and the knight bind at three's
      bind's rest points within 1e-3 mm.
    - **V1, characters through core:** body.ts's `characterOf(ctx, ref, mapping)` binds through io and core
      (recognize, patchMapping, bind; no three.js). A VRM's humanoid maps its bones as the file's word; a patch is
      checked with did-you-mean; no humanoid bone at all is E_RIG; over 4,096 bones is E_LIMIT. `TINY`, the 34-bone
      conformance rig, is the default body (deep-frozen; end bones go on a copy).
  - **The tools** (one lane each, merged at 89a9e55, 7df2f63 and 0d45a6f):
    - **Retarget:** `retarget.inspect` binds a character and returns its report (findings while an issue other than
      the patch stands, with a rest turntable); hips bound under half the legs' length are an issue, its conclusion
      first ("hips (root) likely the wrong bone: only -20 mm up, ..."), so it survives apply's 60-character warning;
      each missing bone's likely source bones, at most 3. `retarget.apply` plays 1 to 20 clips, each judged as the sweep
      judges a skeleton (D80), findings when one fails. **W1:** the judge moved from `tools/sweep` into
      `@m3a/tools/judge.ts`, which the sweep imports back. **H1:** three's bind sanitizes a patch's source bone as
      three's loader sanitizes node names, so the tools' patch binds in three too.
    - **Compose and wire:** `recipe.compile` (bounded before it compiles by `bounded()`, shared with edit),
      `graph.validate`, `graph.sim` (tiny by default; a run past 36,000 steps refused). **L3:**
      `Library.resolver()` rethrows E_TIER, so a recipe naming an out-of-tier clip names the opt-in, not R-E008.
    - **Exchange:** `import` fits a .gltf, .glb, .bvh or .vrma file's animations into a local set under
      `imports/<SET>/` (D10's local tier, a per-set lock; the host reopens it by its stamp); `export` writes .vrma (read
      back byte for byte), .glb (the character's own document, its animation added) or .bvh, each read back through io
      within 1 mm. The registry's `writes` flag lists import to MCP as writing (readOnlyHint false, destructiveHint
      true). **I2-I5:** io's BVH writer and gap, the glTF animation writer and gap, a one-frame take held a frame, a
      VRMA's license in extras and its credit as `asset.copyright`. `@m3a/library` gains the set writer, moved from
      `tools/migrate` (migrate --check byte for byte).
  - **The pause** (D97 records the speed lane merged with these): the lanes were merged at a usage limit with three
    tests stale and retarget's round-2 fix half applied (9da0d53). The tests took the code's wording (4a505d2).
  - **Crossings of 7.2b's Owns:**
    - The registry and host: `registry/registry.ts` (bytes; the `writes` flag), `src/node.ts` (bytes), `src/mcp.ts`
      (the annotations), `src/node/library.ts` (imported sets as local sets).
    - 7.2a's files: `tools/index.ts` (the RETARGET, COMPOSE and EXCHANGE groups), `tools/change.ts` and
      `tools/clips.ts` (`bounded()`), `test/tools-budget.test.ts`, `test/helpers/surfaces.ts`,
      `test/registry-surfaces.test.ts`.
    - io: `src/gltf/read.ts` (signed accessors; mat and mul exported), `src/import.ts`, `src/vrma/vrma.ts`, the
      README's BVH note, `src/index.ts` (the shared export list).
    - library: `src/load/library.ts` (E_TIER), `src/node.ts`, `src/index.ts`; `tools/migrate/migrate.ts`.
    - three: `src/bind/bind.ts` and its test.
    - `tools/sweep/sweep.ts` (imports the judge).
  - **Round 2 and 3 of the tool lanes** (after the pause, lanes retarget, wire and t1rec, merged at 9c6af0b, bb43fa6
    and 68a6bae; each round's findings and dispositions are in its commit messages):
    - **Retarget:** a mesh io can't read (compressed, weights unreadable, soles unread) is no mapping issue
      (`meshIssue`): with no other issue inspect replies ok, the issue in its lines and data, and the patch line says
      what re-exporting mends; apply says it as a `note:` line and keeps its mapping warning and next for mapping
      issues. The bind-failure E_RIG stays a defensive catch no file reaches (core's bind throws only for a missing
      required bone, which characterOf never binds). A chain past 1,024 bones (MAX_DEPTH) and bones of no usable length
      (every node at one point, a scale of 0 or out of range) are refused before recognition. apply refuses clips
      lasting over 600 s in all. The Node host's `ctx.bytes` stats a file and refuses one past io's 512 MiB limit
      without reading it.
    - **Compose and exchange:** graph.sim and export name the character by `characterName`; one helper, `given(as,
      value)` in clips.ts, passes a name the shell would split as given in hints; import removes only clip files an
      import wrote, names what it removed, and refuses a set whose directory holds any other .json or a library set's
      copied manifest (E_EXISTS, nothing changed); parser messages (E_JSON, E_CLIP, E_GAME) on one line (`oneLine`);
      export's read-back checks refuse a joint missing from the file (io's E_MISSING); the host keeps at most 8
      libraries open, the least lately used dropped; B5's and B6's starter check names a clip past CC0 as R-E008 again.
    - **t1rec:** see D97; and the sweep's rows pinned by hash in `tools/sweep/sweep.test.ts` (b4f51cf5d8276a36 at
      1bf5252, before the judge moved, and after), which proves the Done-when "the sweep's T1 sample gives the same
      rows after its judge moves".
  - **The verifier** (two lenses at daaf91c, then three lanes, each re-reviewed until sound):
    - Contract: every Done-when proved and the Verify command passing (28 files, 239 tests; doctrine 8/8); should-fixes
      on a closing hint that didn't run as written (retarget.apply's license.check with a clip file whose name has a
      space) and on cost (below); nits on hints, naming and these records.
    - Adversarial: blocking findings on glTF animations sharing a name (collapsed into one clip), two racing first
      imports into one set (both replied success, the set tampered), and calls that run for hours inside their bounds;
      should-fixes on the file's own license ignored on import, graph.sim's E_RIG asking for a mapping it took no
      parameter for, glTF rigs import can't read, the host's text reads, and recipe and graph costs.
    - **Lane 2, io, library and the host** (07fef25): `animationNames` gives each glTF animation its own name
      (`X`, `X_2`, ...; `animation<i>` for none), in describeGltf, the exact reader and readGltfPosed alike, in linear
      time; a BVH Frame Time must be above 0 and at most 1 s; rigBvh's E_RIG reads for a .bvh and a glTF alike, VRM's
      humanoid bones listed; a .glb's animation carries the clip's credit beside its license; the resolver throws
      E_TIER only for a clip the out-of-tier set holds (else R-E008 with its did-you-mean); the host reads an imported
      set under `imports/` at call time, so racing first imports end with a set that verifies.
    - **Lane 3, core** (071cbc1): recognition by shape (`topology()` in recognize.ts) walks the tree without recursion
      or spreading a list that grows with the skeleton: chains of 130,000 bones recognize, parents in a loop throw a
      RangeError naming a bone. Bit for bit: 118 recognitions pinned by hash before the change, the 12 parts of
      `tools/exact/ab.mjs` equal, vectors byte for byte, cross-engine equal; an A/B fuzz of 40,000 skeletons identical.
      Left: parents in a loop among bones a table knows by name still hang finish()'s ancestor walk, before and after.
  - **Deferred, with their numbers (a core follow-up, proposed here; PLAN.md has no WP for it yet):**
    - **K5, the planter's cost:** core's planter re-sums a held foot's drift from the start of its stretch at every
      pose (contact/plant.ts holds), and the Animator's pose cache clears at 1,024 poses (about 17 s), so cost is
      superlinear in how long a foot is held: retarget.apply on tiny with an idle held throughout, 12 s 1.8 s, 17 s 2.6
      s, 24 s 23.7 s, 30 s 44.6 s, 60 s 233.7 s. Carrying the sums across poses can't be bit for bit (each pose's root
      is anchored afresh at the Animator's world root, animator.ts rootFrom), so a linear planter needs its own decision
      to re-baseline the vectors and the A/B hashes. Meanwhile the tools refuse a held foot past a measured bound.
    - **The key fit's cost** grows with samples times the keys it adds (import: 30, 60 and 120 s takes 2.3, 6.5 and 21
      s; recipe.compile at MAX_FIT_SAMPLES: QUATERNIUS_3D2DGE/Walk_Loop sequenced to 120 s at 30 fps 22.8 s,
      Jog_Fwd_Loop to 30 s at 120 fps 55.3 s, the densest found, QUATERNIUS_SHARDFALL/NinjaJump_Start to 120 s at 30
      fps with 3,410 keys, 117 s). One call can still spend about 2 minutes fitting, about 3 with its steps' build at
      every bound together; library clips (at most 12.1 s), spec/recipes and the starters compile in under a second.
      A fit linear in its keys is core's follow-up, with K5's.
    - **A composed license in the library:** import now takes a composed clip's license (D10's ids joined with
      " AND "), but `@m3a/library`'s checkSets reads a source's license as one id with one text file, so license.check
      fails such a set for good; import's note says so. Each part checked and credited is the library's follow-up.
    - **K7:** io's skeletonOfGltf can return heads that aren't finite when node transforms overflow; every tool path
      refuses it (bones of no usable length); io's own callers get the numbers. **K8:** the manual's lines on
      `openLibrary().resolver()` (MANUAL.md:241, :285) predate L3's E_TIER: WP-7.3 rewrites them. The import catalog
      (`$sources`, `$pick`, `$skip`) stays io's input format, not a spec schema (spec/schemas is frozen and the catalog
      is the pinned sources' format since WP-5.2): the tool checks its shape and WP-7.3's manual documents it.
      Importing a glTF whose bones no map knows by shape or a given mapping is a feature, not a fix: import refuses it
      with a working remedy (retarget.inspect and export).
    - **Lane 1, the tools** (merged at the head after 07fef25 and 071cbc1; ten commits, each listing its findings;
      four re-review rounds, the third cut by a session limit and finished after it):
      - **One naming rule, replacing D95's two forms.** Inside backticks a hint names a given file or JSON with its
        placeholder (`<the character's file>`, `<the clip's JSON>`, `<the motion file>`) or the path as given, quoted
        for the shell where it would split (`arg`); a refusal, verdict, line or data field uses the same words without
        brackets ("the character's file") or the path as given, never JSON-quoted, never absolute. `prose(as)` in
        clips.ts; the host's `shown()` is `arg(path)`, or "the file" for an absolute path or one with a control
        character (E_PATH, E_WRITE, E_LOCKED, E_LIMIT). A test reads an absolute path and one with a control character
        through four tools and the host: the working directory appears nowhere.
      - **Hints that run as written:** retarget.apply's closing license.check passes a clip file's path as given;
        the missing workshop copy's hint is one whole call (`fix <a library clip> --save_as WORKSHOP/<Name>`), in
        E_NO_CLIP and G-E009 alike; license.check on a local set says to set `"ships": false` in game.json.
      - **The host's text reads** stat a file and refuse past io's 64 MiB text limit before reading it (E_LIMIT).
      - **Bounds on one call's cost** (the integrator's scope rule after round 3: these and no more; any slow path
        left inside them is recorded above with its numbers): a held foot past MAX_HOLD, or a clip whose planter
        rereads pass MAX_REREAD (16 s), refused by retarget.apply, export and graph.sim (judge.ts `boundHolds`; no
        library clip is refused); graph.sim charges its run's clip steps (MAX_CLIP_STEPS) and what fades and a held clip
        played at several times at once add (MAX_FADE_STEPS); a recipe's steps, samples, list reads (a pin's path, a
        weight curve, a sequence's items: MAX_LIST_READS) and the samples its output's keys are fitted to
        (MAX_FIT_SAMPLES = 3,600: 120 s at 30 fps, 30 s at 120), shared with edit, which keeps its chain only while the
        chain passes them and otherwise compiles the file as it is; import fits a take of at most 120 s (MAX_TAKE),
        240 s in all (MAX_FIT) and 500 clips (MAX_IMPORT_CLIPS), each refusal naming the step, the length and the
        remedy. Every bound carries its measurements in its doc comment.
      - **Import:** the license and credit a glTF-family file carries are used (each animation's extras, the asset's
        copyright); a --license whose ids aren't the file's is refused, ids compared as sets, case aside, and a
        composed license (" AND ") is taken; a glTF whose bones no map knows by name is refused with calls that work
        (retarget.inspect binds by shape, export plays a clip on it), and list says so first; io's refusals name the
        file as given; the verdict says what an import replaced.
      - **graph.sim takes a mapping**, as retarget and export do, so its E_RIG can be followed; a mapping that gives two
        humanoid bones one source bone is refused; export names its file by the clip and the character
        (`<clip>-on-<character>.<format>`), so two characters don't overwrite each other.
      - **No test reads the clock:** three wall-clock assertions removed (the refusals asserted instead); T1 adds about
        6 s for the whole of the verifier's fixes.
  - **Crossings of 7.2b's Owns, added after the pause:** WP-7.2a's files `tools/common.ts` (oneLine, fileOrJson's
    naming), `tools/clips.ts` (given, prose, the E_CLIP, E_REST and E_NO_CLIP words, bounded's budgets),
    `tools/change.ts` (edit's chain under the bounds), `tools/base.ts` (validate's naming), `tools/ship.ts` (the local
    set's line), `src/node.ts` (bytes and text stat first), `src/node/files.ts` (shown), `src/node/library.ts` (the
    cache, imported sets read at call time), `registry/registry.ts` (bytes' doc) and their tests (tools-host,
    tools-change, tools-ship, tools-find, tools-check, registry-surfaces, sim, tools-budget, helpers/surfaces); io's
    `gltf/read.ts` (animationNames), `gltf/posed.ts`, `gltf/anim.ts` (credit), `bvh/read.ts` (frame time, E_RIG),
    `bvh/write.ts` and their tests; library's `load/library.ts` (the resolver's E_TIER); core's
    `skeleton/recognize.ts` (iterative), `clip/facts.ts` and `clip/contacts.ts` (D97), `contact/plant.ts` (contactAt);
    `bench/starters/B5` and `B6` `check.ts` and their graders' tests; `packages/three/test/play.test.ts`;
    `tools/sweep/sweep.test.ts` (the pinned rows); `eslint.config.js` (the lane worktrees left out).
  - **Owns edited to match:** WP-7.2b's entry gains "Also touches" listing the crossings above, as 7.2a's did.
  - **Size:** about 4,950 new lines: lane b0's 955, the three tool lanes' 2,072 at the pause, and about 1,920 after
    it (rounds 2 and 3 and the verifier's three lanes), the t1-speed lane and its records (D97) left out. That is 65%
    past L's 3,000: the WP should have been split again (D93 split 7.2 in two; each half was still an L). The WP-sizes
    theme reached its threshold (FEEDBACK-LOG F4.1): 8.2 and 9.1 are measured before they start.
- **Why:**
  - A retarget, compose or exchange tool that answers wrongly, or whose hint fails as written, costs an agent more than
    one that refuses with a working remedy (§5.6, D92).
  - One naming rule for every surface keeps a path out of replies and lets every hint run as written.
  - A tool an agent calls must not run for hours on a valid input: the bounds refuse such calls up front, and the
    causes in core are recorded with their numbers rather than chased in the tools.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.48.0

## D97 · 2026-10-16 · The t1-speed lane: T1 cut by bit-identical speedups, proved and recorded after the pause

- **Principle:** 5 (determinism), process, D33, D74, D89
- **Call:**
  - **What it did** (0ac8205..65ea4a6, merged at 261e78c, no WP: T1 stood at 84.8 s of its 90 s locally): decodePose
    and encodePose take each side's fields and points by names and offsets found once; a rest frame's conjugate, each
    shoulder's rest swing and hintFor's rest direction are found once per rest (WeakMaps, like `derived()`); planting
    takes points by side and offset, a leg's pole from the pelvis alone (`legPoleOf`) and finds a foot's contact
    without an array a call; contactRoot decodes the legs alone (`decodeLegs`, `sampleLegs`, sharing decodePose's leg
    steps); measureFacts reads samples a caller already took (an optional fourth argument, `sampled`); the sensors
    read their samples once; tests share identical work (every input, threshold, case and expect() count unchanged).
    The last edit, the Animator's `rootFrom` memo (65ea4a6), was committed as WIP at the pause; it is complete.
  - **The proof, after the pause** (the lane's own 17-part harness was lost with its scratch): `tools/exact/ab.mjs`
    (kept, on demand) gives the same hashes at 1bf5252 and after the lane on all 11 parts (decode 0df74cdf79b8eb1b,
    decodeOther b142c4cd5f306f62, encode 39c519df430bcb6a, facts b79e2b4b00f55d73, root 2eda1300ba89c3a5, plant
    23cdf3509243e694, sensors 95fbaf80facceaec, fix caf56a18d4679a48, procedural cd89bf81f1fe5bbf, animator
    8b409beb3b160667, solve 290de4e3eae475cf; a twelfth, limbPoles d6301fd29f5c9bbb, added since); cross-engine equal
    (the Animator 144560999a518f7d); CI's Node = Chromium hashes unchanged; vectors byte for byte.
  - **Made durable** (lane t1rec): `packages/core/test/exact.test.ts` holds `legPoleOf`, `decodeLegs` and `sampleLegs`
    to the functions they copy, bit for bit, as D89's ankleOf test does; measureFacts's `sampled` is documented as
    trusted and checked for its count and step against sampleAll's (`sampleGrid`, shared with sampledBy), throwing on
    a mismatch; contactAt holds a better contact by plain assignments.
  - **Measured:** CI's T1 74.4 s at 1bf5252, 61.9 s after the lane with 38 more tests; locally about 82 s.
- **Why:** a slow T1 is fixed by removing cost, never by sampling or skipping tests (D89); a speedup with no proof
  breaks principle 5, so the proof is committed where it can run again.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.48.0


## D98 · 2026-10-17 · G7's command set: the default model gates, three others are recorded one trial a brief

- **Principle:** §7 (the benchmark, per model), §9.3 (G7), O10 (Claude models only)
- **Call:**
  - **Which models.** PLAN.md §7 says the benchmark runs "on the Claude models the session can reach", and G7 records
    B1 to B7 "per available model". On 2026-10-16 twelve Claude models answered one turn as the benchmark's `nobody`
    agent (sonnet-5-5, the CLI's default; opus-5-5, haiku-5-5, fable-5-1, fable-5, opus-5, opus-4-8, opus-4-7, opus-4-6,
    sonnet-5, sonnet-4-6, haiku-4-5). Read literally, G7 is about 900 trials. Every gate so far ran the default alone.
  - **The rule:** the CLI's default model gates G7, as at G1 to G6: each brief and each held-out variant at least 4 of
    5. The current generation's other three, `claude-opus-5-5`, `claude-haiku-5-5` and `claude-fable-5-1`, are
    recorded: B1 to B7 once each, in the gate's report and records, not gating. The older generations are left out.
  - **Recorded steps:** `tools/run/gate.ts` reports a step named `recorded: ...` but leaves it out of the gate's
    verdict (`RECORDED`; the verdict counts them apart).
  - **G7's set:** check, test, doctrine (the manual's and the tools' budgets), vectors, the tool examples on four
    surfaces, the manual's code, `pack --check` (the packaged CLI, MCP server and single file running the manual's
    example; the bundle's licenses and QA), the single file's license check, T2 (the MCP Inspector on every example),
    a fresh held-out run, B1 with 2 discovery trials (reported, §7), B2 to B7, each brief's held-out variant, then the
    three recorded models.
- **Why:** the gate measures whether agents can use the package; one model held to the pass mark keeps that bar
  comparable with G4 and G6, and three others show how far it carries, at a fraction of the cost of twelve (about $300
  at list prices, all from the session's own account).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.49.0 (WP-7.3's version)

## D99 · 2026-10-17 · O2 taken at its default: build and dry-run pack everything, publish nothing

- **Principle:** §3 (hard to undo), AGENTS.md "Deviating", §13 O2
- **Call:**
  - WP-7.4 reached O2 (package names and publishing). It was escalated on michaelcrosato/my-3danimations#13 at 14:59 UTC
    (principle, three options, a recommendation) and a 15-minute check armed. No answer came by 15:15 UTC.
  - **The default stands:** the packages are built, packed and checked (`npm run pack -- --check`, dry-run packs per
    package, a scratch install, the single file) under the working names `@m3a/*` and `m3a`; every source
    `package.json` stays `private: true`; nothing is published to npm or as a release asset. npm provenance (Sigstore)
    is prepared for the first published version but not enabled.
  - When the owner answers O2, the names and the publishing step change in a commit of their own; WP-9.4's release
    workflow follows the same rule.
- **Why:** publishing can't be taken back, and for publishing the default is always "don't" (AGENTS.md).
- **Answered:** no: the default taken after the escalation's 15 minutes, to review.
- **Landed in:** v0.50.0 (WP-7.4's version)

## D100 · 2026-10-17 · WP-7.3: the manual, its test and tool list, the skills, llms.txt, .mcp.json and the runner's wiring

- **Principle:** 2, 3, 9, D77, D91, D96 (K8) (WP-7.3)
- **Call:**
  - **The manual** (`packages/tools/MANUAL.md`, 7,998 of 8,000 tokens): the mental model; one complete example (a
    knight that walks, slashes with a hit event and staggers its target), unlike the B1 to B3 known-goods in clips,
    structure and wording (D77, checked by the reviews); the API by job (find, fit, wire, make, check, ship); the 20
    tools as `m3a` and MCP calls in a list generated from the registry between markers and checked so it can't drift
    (`tools/manual/toollist.ts`); D91's reads past the manual folded in (layer weights and masks, contactRoot's
    return, three's attach, the pose step's arm fields, simulate()'s result); K8's E_TIER; the import catalog; the
    rules and common mistakes.
  - **Every code block runs** (`packages/tools/test/manual.test.ts`, `npm test -- manual`): the ts blocks type-check
    and run as one program, JSON blocks are checked as what they are, `m3a` calls run and inline ones parse with their
    flags, the `.mcp.json` block names the published bin.
  - **The skills:** `skills/m3a/SKILL.md` (agentskills.io: name, a description under 1,024 characters, the five
    commands, where an installed package keeps the manual) and this repository's `.claude/skills/m3a/SKILL.md` (the
    CLI run from source, so a fresh `npm ci` never sends `npx m3a` to the registry); `llms.txt`; `.mcp.json`; a test
    of their format, commands and paths (`tools/skill/skill.test.ts`).
  - **The runner** (a crossing into WP-4.7's `bench/runner`): each trial gets the skill as real files, the `Skill` tool,
    `--setting-sources project` and an `--mcp-config` running the packed `m3a mcp` (the CLI's own bundled skills off);
    a trial whose init event shows the server not connected fails; reading the shipped skill or `llms.txt` isn't past
    the manual.
  - **No example gives a bench job away:** the registry's examples for edit, film, diff and describe no longer name a
    brief's clips or edits (they reach every trial through MCP's tools/list).
  - **The Verify:** `npm run doctrine` and `npm test -- manual` pass. B5 5 of 5. B1 1 of 5 with the first rewrite: it
    dropped the old manual's speed matching (play a loop at `(v * 1000) / own`, move by `player.travel`), and three
    agents shipped `MESH2MOTION/Run_Female`, whose own speed reads 0 because the library holds no foot contacts for
    it. Restored (2cfb004), B1 3 of 5: one agent still shipped Run_Female, one slid at a fade. **B1's 4 of 5 is a
    deferred proof, to G7**, after the library fix the next session makes first: 30 loops have no detected contacts,
    among them CC0's Run_Female, Run_Anime and Run_Stealth. K2 (B1 under 3 of 5 after the second revision) did not
    fire.
  - **Reviews:** two rounds a lane, then a close-out round. Blocking findings fixed: the repository skill's `npx m3a`
    reaching the registry; should-fixes: the registry examples above, the example's loop snapping a blend parameter
    (it pops; the loop eases it now, as its script does).
  - **Crossings:** `bench/runner/{agent,workspace,main}.ts` and their tests; the registry examples in
    `packages/tools/src/tools/{change,check,find}.ts`; `tools/skill/`, `tools/manual/`.
  - **Size:** about 1,500 lines (the test and the skills' test most of it), past M's 1,200.
- **Why:** the manual is where an agent starts (§7); what it says must run, and what it leaves out must not trip the
  briefs.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.49.0

## D101 · 2026-10-17 · WP-7.4: the packs, the single file and `npm run pack -- --check`; nothing published

- **Principle:** 2, 6, 7, D10, D59, D99 (WP-7.4, O2)
- **Call:**
  - **The packs** (`tools/bundle/build.ts`): each `@m3a` package built as ES modules with declarations, by Node's own
    type stripping file for file (so `dist/x.js` keeps `src/x.ts`'s lines), relative `.ts` imports pointed at `.js`,
    the `.d.ts` from `tsc -b`, staged in `.cache/pack/stage/` with its published `package.json` (exports, types and
    bins pointed at `dist/`; devDependencies dropped; `private` kept, D99) and packed. The workspace's own bin and
    types stay on the sources, so `npm ci` links `m3a` to `src/node.ts`; only the staged copy points at `dist/`.
  - **Tiers as packs (D10):** the default `@m3a/library` holds the cc0 sets alone, its lock and license texts narrowed
    to them; `@m3a/library-cc-by` and `@m3a/library-cmu` hold their tiers' sets with the opt-in and credits block,
    peer-depending on the library. `openLibrary` finds an installed pack (a crossing into `@m3a/library`'s loader),
    and every m3a and MCP reply warns when a game opts into a tier whose pack isn't installed (a crossing into
    `@m3a/tools`).
  - **The single file** `m3a.js` (Vite, carried from riftlight's bundle.mjs): every name of core, sensors, io, library
    and tools once (a new collision fails the build), 47 CC0 clips listed in `tools/bundle/manifest.json` (a
    GameManifest; the license check passes; each clip passes the sensors or carries its WP-5.8 baseline), the credits
    block and the license texts verbatim, 1.16 MB, not minified. three.js and `@m3a/three` are left out: the file is
    for agents that can't install packages, who can't install three either, and a second three beside a game's would
    break `instanceof`. **How "the single file runs the same example" is read:** m3a.js runs the manual's complete
    example program itself (its ts blocks, JSON files and m3a calls), with only the imports it leaves out (three and
    `@m3a/three`) served headless, and prints what the packages print for that headless form.
  - **`npm run pack [-- --check]`** (`tools/bundle/main.ts`, about 18 s): the packs and m3a.js; `--check` fails on a
    set in the wrong pack, a bin that isn't `dist/node.js` with its shebang or can't start, m3a.js's credits or texts,
    the manifest's license check, a bundled clip's QA, a scratch project that installs the tarballs and can't run the
    manual's complete example, `npx m3a help` and `version`, `m3a mcp`'s tools/list, the opt-in packs, or m3a.js
    printing anything else. It is in G7's set (D98); T2 doesn't run it (the integrator's call: 18 to 30 s, and G7
    runs it).
  - **The runner** packs through `tools/bundle` (a crossing into WP-4.7's `bench/runner/pack.ts`); the known-goods'
    `--fake` runs pass, on G7's held-out variants too.
  - **Provenance** (npm, through Sigstore) is written down in `tools/bundle/README.md` for the first published version,
    not enabled (D99).
  - **Reviews:** four rounds. Blocking findings fixed: the workspace's bin moved to `dist/` (which `npm ci` never
    builds, so `npx m3a` would have reached the registry), and m3a.js running a stand-in rather than the manual's
    example. Should-fixes: the deviation unrecorded (here now), a bin that can't start passing the check.
  - **Size:** about 1,720 lines (tools/bundle, the library's loader, the packaging fields), past M's 1,200.
- **Why:** an agent installs the packages or drops in one file; both must run the manual's example, carry their
  licenses and keep tiers opt-in, and nothing is published before the owner answers O2.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.50.0

## D102 · 2026-10-17 · T1 trimmed by sharing identical work: 89.8 s to about 78 s, no test, input or assertion less

- **Principle:** process, D74, D89
- **Call:**
  - With WP-7.3's runner tests T1 reached 89.8 s of its 90 s here (CI's runner is faster). Eight files that took most
    of it (the sensors' and core's procedural tests, the runner's, the sweep's, the actions sweep, the B1 and B3
    graders and tools-change) now share identical work: a fixture built once per file, a pure result reused (each
    reuse's purity argued in 0ea84f2), and their Node child processes share a compile cache (`tools/run/compile-cache.ts`).
  - Per file the it( and expect( counts are unchanged and no input, threshold or case changed; an independent review
    confirmed it, mutating a key assertion in each to show it still fails.
  - Measured: T1 78.0 s on the merged head (974 tests).
  - Left: the procedural files are bound by core's gait code; cutting further needs source changes with byte-identity
    proofs (as D89).
- **Why:** a slow T1 is fixed by removing cost, never coverage.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.49.0

## D103 · 2026-10-17 · Phase 7's pull request merged before G7, at the owner's request

- **Principle:** §8.5 (a gate merges its phase), process
- **Call:**
  - On 2026-10-17 the owner asked to finish the active work packages (WP-7.3, WP-7.4), start no new one, prepare the
    repository for a handoff and merge. michaelcrosato/my-3danimations#13 is squash-merged with CI green, holding
    WP-7.1 to WP-7.4, G7's command set (D98) and its held-out run 1 (checked, unused). G7 itself has not run.
  - **So `main` holds Phase 7's packages without its gate.** The next session opens a fresh draft pull request for
    G7 (and Phase 7's remaining fix: the library's 30 contact-less loops, D100), runs `npm run gate -- G7` there, and
    merges it as G7's.
  - The merge is made by the session under the owner's GitHub login, as the request asked; no review was approved.
- **Why:** the owner's call; §8.5's rule (main holds the last gate that passed) bends once, recorded here.
- **Answered:** yes: the owner's request, 2026-10-17.
- **Landed in:** michaelcrosato/my-3danimations#13


## D104 · 2026-10-19 · The library's 30 contact-less loops: 11 given contacts by two fallbacks in core, 19 marked off their feet

- **Principle:** 3, 8, 10, D34, D64, D69, D100 (G7's open fix)
- **Call:**
  - **What was wrong** (D100): 30 loops (and 23 one-shots) carried `contacts: {"by": "detected"}` with nothing in it.
    Of the loops, 11 stand on their feet: CC0's MESH2MOTION `Run_Female`, `Run_Anime`, `Run_Stealth`,
    `CMU_CURATED/Boxing_Guard_Loop` and seven STYLE100 clips. Two causes, both in `measureFacts`:
    - **the world refinement erased every contact** (8 loops): the height pass found each foot down once a step, but a
      planted foot must also be still in the world, slower than 0.3 H0/s and half the body's speed. A keyed run in
      place drifts 0.6 to 1.3 H0/s while planted (Run_Female runs at 3.95 H0/s, its swinging foot at 5 to 14), a run on
      the spot (Run_Anime, Run_Stealth: the body's speed 0) is held to 0.05 H0/s, and STYLE100's retargeted run-backs
      skate. With no contact the Animator's `contactRoot` reads a ground speed of 0, so B1's agents, told to match a
      loop's playback to its own speed, couldn't, and shipped Run_Female anyway;
    - **the feet were read by ankle, ball and toe** (3 loops): STYLE100's `OnHeels_*` stand on their heels with the
      toes raised, the ankle 4 to 6% of H0 up, past the 4% a foot plants within.
  - **Two fallbacks in core's `measureFacts`, for a clip no tag puts off its feet** (`OFF_FEET`: air, fly, swim, climb,
    lie, sit, a new export of the clip namespace):
    1. **the refinement never erases every contact** the height pass found (`reread`): it reads again with "still"
       meaning slower than half the body's own speed (the swinging foot moves at about twice it; never under the
       default 0.3 H0/s), first with the body's velocity the planted feet give, then, in place, with the one the lower
       foot gives (STYLE100's run-backs keep the swinging foot inside the 7% height band, so the height pass holds both
       feet down all loop, their median velocity near 0, while the lower foot's gives 1.20 H0/s against the source's
       captured 1.23); failing both, the height pass's contacts stand, and the sensors judge how far they slide;
    2. **a clip with no contact by ankle, ball and toe is read by its whole sole** (`DetectOptions.sole`: the heel
       `sole()` gives, as the sensors read a foot).
    The default reading is unchanged: no clip that had a contact changes, so no other clip, hash, trace or sweep moves.
    A first version kept the height pass right after one retry; it held the run-backs' both feet down all loop, and
    the planter (WP-2.5's sweep) slid them 162 to 167 mm a contact: the lower foot's reading plants every one of the
    eleven at 0.0 mm.
  - **What changed in the library** (written by `npm run import`, `npm run migrate` and their canonical writers): the
    11 loops and 18 one-shots (attacks, slides, jump starts, a knockback; every one stands at some point) carry
    contacts; three clips' facts gain the travel their new contacts give (`OnHeels_Idle`, `OnHeels_SideLeft`,
    `OnHeels_SideRight`), no other fact moves (the travel reads the height pass, as before). Run_Female's ground speed
    now reads 4.09 H0/s against its measured 3.95 (3%); Run_Anime's and Run_Stealth's 0: each carries a root of its own that
    stands still (`inplace`), which `contactRoot` reads first (the manual: 0 means pick another clip).
  - **The 19 off their feet are marked** in `library/baselines/qa.json` `offFeet` (where each is instead: flying,
    swimming, on a wall or a pole, hanging, lying, sitting, a jump's held pose), and `npm run qa -- library` gains the
    off-feet check (T2): a loop with no contact must carry an `OFF_FEET` tag and an answer, and an answer whose loop has
    contacts is named. None is given contacts.
  - **QA:** the sensors read a stance of their own, so the verdicts barely move: 1,014 pass, 230 warn, 154 fail (1,013
    / 230 / 155 before: `STYLE100_SIDE/OnHeels_SideLeft` fail → pass; `OnHeels_SideRight` and `OnHeels_Idle` slide a
    little more, below warn). `packages/sensors/fixtures/baseline.json` rewritten for those three; the distributions
    recorded again (`library/baselines/distributions.json`): fails 155 → 154, skate p95 22.6 → 22.5, skateMean p95
    20.2 → 19.6, and two p50s worse in their last digit, slide 38.3 → 38.4 mm and skate 5.29 → 5.31 cm/s, which a rule
    that "may only improve" admits only by a logged decision: this one (29 clips measured at all are worth more than
    the p50s' last digit); `npm run facts --
    --check` 1,398 clips, none stale; `npm run import` and `npm run migrate` wrote the 29 clips, their manifests, the
    import records' `moved` readings and the lock.
- **Why:** a loop that stands on its feet must say where its feet are, or nothing that reads them (root motion, speed
  matching, the slide sensors) can; a loop off its feet must say so, so its empty contacts read as a fact, not a gap.
  The fallbacks touch only clips the default reading left with nothing, so the library's measured contacts elsewhere
  keep their D64 truth; a broader change (the heel in every reading) would move every clip and is not needed.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.50.1

## D105 · 2026-10-19 · The manual: move by the travel, cross-fade in step (B1 3 of 5 → 5 of 5)

- **Principle:** 1, 3, D100 (WP-7.3's deferred B1 proof)
- **Call:**
  - With D104's contacts, B1 at cce4964 went 3 of 5 (`bench/results/2026-10-19-default-B1.json`). Every agent
    shipped `MESH2MOTION/Run_Female` (3.76 m/s, the nearest to the 3.5 asked); the two that failed moved the character
    at v themselves, which the manual allowed ("**In place** (the game moves it at v), any other rate ... slides the
    feet", implying a matched rate doesn't). That holds for an even stance only: Run_Female is keyed, its planted foot
    drifting 0.6 to 1.3 H0/s about the body's mean, so at a constant speed its lower foot never stands still (0.66 to
    0.69 m/s at its slowest tenth; the grader asks 0.52). Moved by `player.travel` (the planted foot's own path) it
    passes, as the other three did.
  - **The manual now says so:** move by `player.travel`; moved at v by the game, feet slide at any other rate, and
    where a stance drifts (keyed runs) at any. B1 4 of 5 (`-B1-2.json`): every agent moved by the travel; the fifth
    slid at its run-to-walk fade, fading the walk in from time 0, out of step (D35: in step a walk–jog fade keeps the
    feet within 18.5 mm, out of step over 100).
  - **And how to cross-fade in step:** the new clip at `mb.time(ma.phase(t))`, `ma` and `mb` the two clips'
    `ops.phaseMap(c, c.contacts)` (core's, public since WP-2.3, never in the manual). B1 5 of 5 (`-B1-3.json`).
  - **Budget:** 8,000 of 8,000 tokens: the rules list's line on the travel (now said where speed matching is) and a few
    words elsewhere cut. The next manual change cuts text first (F5.2).
  - These three runs are probes on a working tree (`dirty: true`); G7's B1 step, at the gate's commit, is WP-7.3's
    proof.
- **Why:** the manual is all a fresh agent reads; a sentence that is true for one kind of clip and false for another
  costs trials, and the fix is the true sentence, not a weaker grader.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.50.1

## D106 · 2026-10-19 · G7 run 1 failed on B1's held-out variant (3 of 5); the manual's speed rule fixed forward

- **Principle:** 1, §8.5 (a failed gate is fixed forward), §7, K2 (not fired)
- **Call:**
  - **Run 1** at 1623b78, 84.0 min: 23 of 24 gating commands passed. Every brief 5 of 5 but B6 (4 of 5), every
    held-out variant 5 of 5 but B7 (4 of 5) and **B1's, 3 of 5**; the three recorded models 7 of 7 each. The record is
    `bench/results/gates/G7-run-1/`.
  - **Why B1's variant failed** (seed 1287, a bulky Rigify body): the agents picked the CC0 run nearest the asked
    3.5 m/s, `MESH2MOTION/Run_Female` (3.76 m/s) or `MESH2MOTION/Jog`, over the core `QUATERNIUS_3D2DGE/Jog_Fwd_Loop`
    (6.16 m/s, played at about 0.57). Both are keyed and land with the foot held low and still against the pelvis
    while the root carries on, which the sensors read as a dragged foot. On this body, at the rate the agents choose,
    the B1 known-good with Run_Female in place of its jog skates at 82 cm/s, with `MESH2MOTION/Jog` at 50 (the fail
    level is 42); with the core jog it passes. Neither the library's QA (on the clip's own rest) nor the sweep (rate
    1) catches it: it depends on the body and the rate. Two agents also moved the character at v themselves.
  - **The fix, in the manual** (8,000 of 8,000 tokens): the mental model says root motion moves the character, never
    a speed of one's own; the speed rule says "0.5 to 2, else pick a clip nearer v; in range a `core` row beats a
    nearer one", and that moved at v, feet slide in fades and where a keyed stance drifts. Probes on the working tree
    (`bench/results/2026-10-19-default-B1-{5,6}.json`, `-B1-variant-{2,3,4}.json`, on run 1's variant, now used):
    with the travel rule alone 4 of 5 on the variant; with a "core first" line in Find 4 of 5 on B1 and 1 of 5 on the
    variant (four shipped Run_Female, moved by the travel, and skated); with the speed rule 5 of 5 on the variant and
    4 of 5 on B1 (the fifth trial's agent hung for 10 minutes with no output and was ended: an outage, not a grade).
  - **Left for later** (follow-up, owned by no WP yet): a check that plays each locomotion loop with its root motion
    at the rates a game asks (0.5 to 2) on the test bodies, as B1's grader reads it, so a keyed run that skims is
    flagged in the library rather than found by fresh agents.
  - **Run 2** fixes the commit first, then a fresh subagent writes `bench/results/heldout/G7/run-2/` under D91's read
    bar and an independent check reviews it; each known-good passes on its variant; then the gate runs again.
- **Why:** the gate failed on a manual line that steered agents to the nearest speed over the curated clip; the fix
  is the manual's rule, not the grader. K2 (B1 under 3 of 5 after the manual's second revision) didn't fire.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.50.1

## D107 · 2026-10-19 · G7 = M2 passed on run 2, 24 of 24: every brief and held-out variant at least 4 of 5

- **Principle:** 1, 2, 9, G7 (§7, §9.3, D98)
- **Call:**
  - **Run 2 passed**, 24 of 24 gating commands, at 5d1ec8f (0.50.1) on 2026-10-19 in 93.0 min, in the main checkout.
    The commit was fixed first (02:42, CI green 02:46); a fresh subagent then wrote `bench/results/heldout/G7/run-2/`
    under D91's read bar (it read §7, D78, the briefs, the starters, the graders' grade.ts, the generator and
    fixtures.ts; past the bar only directory names and one package.json line), and an independent subagent checked
    it: pass, every stated fact of the seven characters generated and bound again, each contract word for word, nits
    only (the variants keep 0.91 to 0.96 of their originals' 6-grams, the contracts copied verbatim; two bone-name
    and hip-height wordings). Each known-good passed on its variant before the trials. The record is
    `bench/results/gates/G7-run-2/`.
  - **Its commands:** check 2.1 s; test 83.0 s (981 tests); doctrine (the manual 8,000 of 8,000 tokens, the tools
    within 3,000); vectors byte for byte; every tool example on the API, `m3a`, MCP and the console 19.3 s; the
    manual's code 6.4 s; `pack --check` 20.7 s (the packaged CLI, MCP server and single file run the manual's
    example); the single file's licenses; T2 121.1 s; the held-out run fresh.
  - **The benchmark** through the packaged CLI, the skill and the packed `m3a mcp` (each trial's record shows the
    server connected and the skill present): B1 4/5 (discovery 2/2 used the package, both passed), B2 to B7 5/5 but
    B6 4/5; every held-out variant 5/5 (seeds 2329, 3542, 4743, 5980, 6251, 7434, 8592: a tall Mixamo body without
    an upper chest, a bulky UE5 one with twist bones and no toes, a Rigify child without shoulders, a VRM chibi with
    twist bones and no neck, a chest-less heroic Rigify body, a tall UE5 one and a bulky VRM one). 68 of 70 trials,
    $11.46. Recorded, one trial a brief, not gating: claude-opus-5-5 7/7 ($3.81), claude-haiku-5-5 7/7 ($0.55),
    claude-fable-5-1 7/7 ($20.71).
  - **What failed:** B1-4 slid a planted foot at 7.75–8.00 s (skate 87 cm/s, fail 42); B6-2's mirrored cross struck
    57% of the hip height from where the original does.
  - **WP-7.3's deferred proof** (B1 at least 4 of 5 with the manual) is this run's B1 step.
  - **Lanes ran during the recorded models' trials** (WP-8.1, 8.2a, 8.3, 10.1, 10.2 in worktrees, D83): a deviation
    from the handoff's "no lanes during trial batches", taken once every gating step had finished, so the load could
    move only the three recorded, non-gating steps; they passed 21 of 21.
  - **Verifiers:** two lenses, fresh subagents. **Lens B** (the run and its record against §7, D91, D98 and the 93
    transcripts): pass, with four should-fixes: each pack shipped the repository's whole changelog, the benchmark's
    lines in it (four trials grepped it; none gained) — packs now ship it without them and `pack --check` fails on
    benchmark text; `retarget.apply`'s reach failed every rig without chest bones (B5's variant 6251: 11 to 19 mm on
    ordinary clips, while its grader passed) — it reads such a rig limb by limb now; the record wasn't committed yet —
    it is; and D106's "a `core` row beats a nearer one" changed no pick (9 of 10 B1 trials shipped `Run_Female`) —
    answered: the manual's search rows didn't name `core` (lens A's finding too), they do now, and the skim check stays
    a follow-up. Its four nits: a rate parameter's `"value": 1` (in the manual now), the known-goods' order and the
    agents' tool use, and the audit's over-count (all three in the record's README). **Lens A** (D104 to D106 against
    DOCTRINE.md and the done list, in four dimensions, each finding checked by two skeptics: all held but the mental model's wording, a nit one skeptic called no defect, cut anyway): one
    blocking finding, contacts the planter couldn't hold, and the should-fixes (one-shots and a stance moved by
    contacts, one foot's speeds, untested fallbacks, D104's and D106's misstatements, the manual's undefined `core`,
    the stale handoff and ledger row), fixed in D108; its nits (the reread floor, R-E008's "if any", stale headers and
    AGENTS.md's qa row, the off-feet step untested, the changelog's omissions, PROGRESS's run time) too.
- **Why:** M2 is agents flying the package from its manual, tools and skill alone; at the pass mark on every brief and
  every fresh variant, through the packaged surfaces, it is met.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.50.1, michaelcrosato/my-3danimations#14

## D108 · 2026-10-19 · G7's verifiers: D104's fallbacks narrowed to the contacts the planter can hold, the rest answered

- **Principle:** 3, 8, 10, D104, D107 (G7's verifier, lens A)
- **Call:**
  - **What was wrong** (lens A, blocking): D104's `reread` could give contacts the planter can't hold. Its last resort
    kept the height pass's contacts, and on a clip with a root of its own its first try counted a foot "still" below
    half the root's mean speed, so the planter held feet the motion moves away: the planted ankle pulled up to 148% of
    H0 (`Run_Anime`), 125% (`Run_Stealth`), 180% (`QUATERNIUS_SHARDFALL/Slide_Start_RM`), 83% and 49 to 51% (the sword
    and hook one-shots). The retarget judge went from pass to fail on 28 clip-and-skeleton pairs of the 29 clips × the
    6 sweep skeletons (gen-0 to gen-3, the Quaternius mannequin, the KayKit knight). And the fallbacks reached one-shots, which the
    Animator had played still: an in-place `Jump_Start` now moved 89% of H0 backward a play, a `Melee_Hook` 39%; a
    guard stance (`CMU_CURATED/Boxing_Guard_Loop`, one 50 ms contact a cycle, which `contactRoot` stretches over the
    loop) drifted 0.27 H0/s (0.26 m/s on the conformance rig); and four loops got one foot's contacts, their ground speed off by up to 3 times
    (`WideLegs_Walk` 2.31 times its captured speed, the guard 3.07).
  - **The fix, in core's `measureFacts`:** the fallbacks read a loop on its feet only; `reread` reads in place only (a
    clip's own root is exact, so a looser "still" admits only sliding feet); a reread counts only when both feet plant
    and a foot is down for a fifth of the loop or more (`stands`, plantedVelocity's bar); and nothing falls back to the
    height pass: a loop no reading stands up keeps none. A contact the planter can't hold is worse than none: none
    plays still and reads a ground speed of 0, which the manual answers with "pick another clip".
  - **What it gives:** 5 of D104's 11 loops keep their contacts byte for byte (`MESH2MOTION/Run_Female`,
    `STYLE100_BACKRUN/Waving_RunBack`, the three `OnHeels` stances), the planter holding each within 2.4 to 6.2% of H0
    (a test bounds it at 10%); the other 6 and the 18 one-shots have none again, as before D104. The 6 stand on their
    feet, so the off-feet check gains a second answer, `unplanted` in `library/baselines/qa.json` (why no foot holds
    still; a schema and a validator rule): the two runs on the spot sweep the floor under a root that stands still, the
    guard holds its right foot 50 ms a cycle and its left never, and three retargeted STYLE100 loops (`WideLegs_Walk`,
    `Drunk_RunBack`, `OnHeels_Run`) have one foot that never reads still. The judge over the same 29 clips × 6
    skeletons, against no contacts: 0 pass → fail, 7 fail → pass (the `OnHeels_Side*` stances).
  - **QA:** verdicts unchanged (1,014 pass, 230 warn, 154 fail). `packages/sensors/fixtures/baseline.json` moves back to
    its pre-D104 rows for three clips (`Boxing_Guard_Loop` slide 34 → 44.7 mm, skateMean 15.9 → 16.9;
    `WideLegs_Walk` slide 129 → 145, skate 9.91 → 11.1; `Drunk_RunBack` slide 43.6 → 32.1, skate 12.5 → 0, skateMean
    16.8 → 32.9). The distributions recorded again: skate p50 5.31 → 5.3, and skateMean p95 19.6 → 19.8, worse, which
    "may only improve" admits by this decision (it gives back a third of what D104 took, 20.2 → 19.6, and still beats
    the record before it). `npm run import` and `npm run migrate` wrote the 24 clips, their manifests and the lock;
    `facts --check` 1,398 clips, none stale.
  - **Tests** (lens A found seven mutants of the fallbacks that no named test killed): the lower-foot reread on a
    run-back (both feet, its ground speed within 5% of its captured 123), the three sole-read stances' contacts and
    travel as their files hold them, the planter's pull on every loop the fallbacks plant, none on a run on the spot,
    a stance or a walk one foot of which holds still, none on three one-shots; the off-feet step is built by a tested
    function (`offFeetStep`).
  - **D104 corrected** (the log is append-only): the sensors' baseline was rewritten for eight clips, not three, the
    contacts moving their slide and skate below warn: `Boxing_Guard_Loop` slide 44.7 → 34; `Run_Female` slide 0 → 103
    and skateMean 0 → 124 cm/s (read on its contacts now); `WideLegs_Walk` slide 145 → 129, skate 11.1 → 9.91;
    `Drunk_RunBack` slide 32.1 → 43.6, skate 0 → 12.5; `Waving_RunBack` slide 14.4 → 17.1; `OnHeels_Idle` slide 80.6
    → 89.9, skate 2.14 → 2.39; `OnHeels_SideLeft` fail → pass (slide 287 → 57.7, skate 41.6 → 7.16); `OnHeels_SideRight`
    slide 54.4 → 76.4, skate 0 → 11.5. Its "never under the default 0.3 H0/s" was not so: detectContacts bounds "still"
    at half the body's speed and at least 0.05 H0/s, so the floor did nothing and is gone. 0.50.1 was a patch because
    D104 fixed D100's data, the `OFF_FEET` export and `DetectOptions.sole` serving the fix; D108 is a fix too, 0.50.2.
  - **D106 corrected:** the speed-rule probe's fifth trial wasn't an outage: it was graded, a slide (footL at 7.75 to
    8.00 s, skate 87 cm/s against a fail level of 42, as `-B1-5.json`'s B1-1); a sixth agent hung for 10 minutes and its
    work passed.
  - **Checked after** (a fresh verifier on 8420d14): the blocking finding resolved (the 5 loops that gained contacts
    since 71848bb pull 2.4 to 6.2% of H0; the 11 loops past 10% have had their contacts since before D104), facts the
    same as 71848bb's but on the 5 and as cce4964's but on the 24. Its should-fixes: the one-shot and sole-path guards
    untested (now tested: three more one-shots, two clips off their feet; the off-feet step's ok on a gone answer) and
    the ground speed `stands` doesn't bound, which a retimed loop reaches through `playable` (detected contacts are
    detected again): of 1,628 retimed in-place loops (814 × 1.5 and 2), 59 now reach `reread` (at 71848bb they read
    none and played still), and 8 read a ground speed 1.6 to 3.3 times their original contacts' mapped speed. Answered:
    each reading is held (the worst pull 1.4% of H0), so moved by `player.travel` its feet stay planted and the speed
    rule matches v against that same speed; nothing ships them, and a second reference to gate on doesn't exist in
    core (the height pass's speed is no reference: `Waving_RunBack`'s reads 6.6 against a true 123). The 20% bar
    changes no library clip; it stays, plantedVelocity's bar. Its nits: two `unplanted` answers reworded, numbers here.
  - **The gate's record stands at 5d1ec8f:** the fix returns 24 clips to their contacts before D104, which every gate
    to G6 played, and leaves untouched the clips B1's agents ship (`Run_Female` and the core jogs keep theirs byte for
    byte); every known-good passes again at the fixed head, on its brief and on run 2's held-out variant
    (`bench/results/2026-10-19-default-B1-B2-B3-B4-B5-B6-B7-fake.json`, `-B<n>-fake-variant-3.json`); T0, T1 (987
    tests, 81.4 s), T2 (126.0 s, the sweeps in full) and `pack --check` pass.
- **Why:** the library says where a loop's feet are only where the planter can hold them there; where it can't, it says
  why, so nothing that reads contacts (root motion, speed matching, the slide sensors) is told a wrong answer.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.50.2, michaelcrosato/my-3danimations#14

## D109 · 2026-10-19 · Phase 8 built in lanes: the gallery, the review queue split in two (8.2a, 8.2b), previews

- **Principle:** 2, 5, 11, D83 (lanes), D93 (a WP past L is split), §5.9
- **Call:**
  - **WP-8.1, the gallery** (1,537 lines, L): `apps/gallery`, a Vite page on `@m3a/three` and the tool registry
    running on a browser host, so `__M3A_TOOLS__` and the page's own calls are the same calls; every set and clip
    opens by link (`?set ?clip ?recipe ?graph ?char ?view ?t ?rate ?panel ?q`), plays at any view, 0.1× to 2× or a
    frame at a time, with metrics, describe, sheets, the example recipes and graphs; `src/actions.ts` names the tool or
    command that does each action, which the e2e holds to the registry (nothing only in the gallery).
  - **WP-8.2 measured 3,023 lines, past L, so it was split as D93 split WP-7.2:** 8.2a (2,104 lines: the intake store
    of §5.9 with its `local` and `supabase` backends, the migrations with row-level security on every table and the
    bucket, the submit function, the contract suite, `m3a review`) and 8.2b (919 lines: the review queue's page and
    the contributor page, with their e2e).
  - **Crossings of Owns, logged:** 8.2a shortened WP-7.3's generated tool list in the manual (an MCP name only where it
    differs from the tool's, in its own commit, reversible: the manual went from 8,000 to 7,948 tokens, 7,974 with
    `review`'s line); the registry's Host and ToolContext gained `intake` (E_HOST without one); the tool descriptions
    reached 2,995 of 3,000 tokens. 8.2b edited four of WP-8.1's files (vite.config.ts builds its two pages,
    `REVIEW_ACTIONS`, the browse panel's links, the README), in a commit of its own; its pages are served at `/src/…`
    because its Owns put them under `src/`.
  - **WP-8.3, previews** (285 lines, S): `vercel.json` builds the whole preview site (`npm run site`: the gallery at
    the root, the labs index at `/labs/`, every lab at `/labs/<name>/`), every page stamped with core's version and
    the branch's commit; a .glb in the site fails the build (D9). The preview URL itself waits on O3 (D85).
  - **The integrator's changes:** G8's gate set (below); the `site` and `m3a` scripts; `m3a review` samples 20
    library clips, G8's batch (a list shows 8); the review page bundles a queue only when `M3A_REVIEW_QUEUE` asks
    (8.2b's open question: a queue holds submissions' text, so no build carries one by accident and the preview site
    never does), with an e2e; `@m3a/tools/node` exports `INTAKE_DIR` and `intakeFiles` (8.2b's ask, for a contributor
    on the local store until WP-9.1).
  - **G8's command set:** check, test, doctrine, vectors, the intake and review tests, T2 (the gallery, the review queue
    and previews suites among its browser checks), the preview site built, and the owner's 20-clip batch exported. The
    owner's phone review of that batch is theirs: blocked-owner until it comes (§8.5), the notes it brings back
    applied with `m3a review ingest`.
  - **8.3's crossing:** `tools/run/site.ts`, the preview site's builder `vercel.json` runs, outside its Owns.
  - **The verifier review** (three lenses, fresh subagents, each lens's findings checked by a skeptic: all held but one,
    G8's set, which the skeptic found sound). Fixed:
    - **8.2:** a secret intake key given to the build was inlined into the contributor page (the build now fails); the
      guard trusted a setting any session can set, so the checker's role could move a submission to a verdict (now
      only decide does, as the decision it has just written says); the rate limit was a count then an insert that
      parallel requests all passed (a database trigger holds it under a per-contributor lock); anon kept the decisions
      sequence; the deployed store, a revoked key and an agent's key-only submit were untested (tested; the function
      deploys with `--no-verify-jwt`, the key its check); the hosted contract leg could pass once per project (its texts
      carry the run's nonce).
    - **8.1:** the e2e passed with the view, rate, search, sheet and clip panel broken (it fails on each now, nine
      breaks proved); overlapping opens left the stage on the first clip (a generation guard); a frame-stepped link
      reopened another pose (`t` to the microsecond, steps on whole frames); the stage copied graph.sim's stepping loop
      (one `sim.SimStepper` now, its outputs byte for byte); `npm run e2e -- <name>` ran every suite in a checkout
      whose path held the name (a bare name is its suite).
    - **8.3:** the e2e opened 3 of the site's 5 pages (it opens every page now); nothing stopped `M3A_REVIEW_QUEUE`
      reaching the site (site.ts drops it, tested); no link from the gallery to the labs; three copies of the stamp's
      commit helper (one, `tools/run/stamp.ts`).
    - Answered: the CLI and MCP can't name a `gen-<seed>` character or an arbitrary orbit (the gallery's actions list
      says which API call does it; a resolver for `gen-<seed>` is a follow-up); G8's ingest clause is read off the
      owner's `m3a review ingest` line when the review comes, as the gate's comment says.
- **Why:** the plan's Phase 8, each WP's Done-when proved by its Verify; the split keeps each lane within L.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.51.0

## D110 · 2026-10-19 · O8: Supabase's free tier, its limits and its pause, checked

- **Principle:** O8, D20, WP-8.2 ("check the free tier's limits, including whether idle projects pause")
- **Call:**
  - **The limits** (checked 2026-10-19 on supabase.com/pricing): a 500 MB database (shared CPU, 500 MB RAM), 1 GB of
    file storage, 5 GB egress and 5 GB cached egress, 50,000 monthly active users, 500,000 Edge Function invocations,
    two active projects. At the submit function's limits (a submission's text at most 256 KiB, 20 a contributor a
    day) the bucket holds at least 4,000 submissions at the size limit, and many times that at a clip's usual tens of
    kilobytes; the intake is far inside every limit.
  - **The pause** (supabase.com/docs/guides/platform/free-project-pausing): "Free projects are paused after 1 week of
    inactivity", too little database activity over a week; "a few user requests to the database each day" keeps one
    awake, and a paused project can be restored "for up to 1 year after it was paused", its data and configuration as
    they were. Once linked, WP-9.1's checker runs every 15 minutes against it, which is that activity; until then
    nothing is hosted, so nothing pauses.
  - **Nothing is created:** linking the project (creating it, its keys in the repository's Actions secrets, the
    setting that lets Actions open pull requests) reaches outside the repository and is the owner's (O8): asked once
    on Phase 8's pull request, built meanwhile on the local store.
- **Why:** WP-8.2 asks for the limits in the log before the hosted store is relied on; none of them binds the intake.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.51.0

## D111 · 2026-10-19 · G8's command set passed (run 1); the owner's phone review is blocked-owner

- **Principle:** 2, 11, G8 (§9.3), §8.5
- **Call:**
  - **Run 1 passed its 8 commands** at eb43654 (0.51.0) on 2026-10-19 in 314.6 s, the tree clean: check, T1 (90.0 s),
    doctrine, vectors, the intake store's contract on `local` with the submit function and the review tool, T2 (196.9
    s: the gallery's every set and clip by link at a phone viewport, the review queue's 20-clip batch decided by touch
    and applied once, a stale decision refused, every preview page stamped, library QA, the sweeps), the preview site
    as Vercel builds it, and the owner's batch exported (20 sampled clips). The record is
    `bench/results/gates/G8-run-1/`, the batch its `queue.json`.
  - **What a machine can't do is the owner's:** the phone review of that batch, and the notes and the threshold or task
    it brings back. It needs a build the owner opens (O3's preview once un-paused, or `npm run gallery`) and the JSON
    export (O8 isn't linked): asked once on the pull request with O8's and O3's steps, blocked-owner while Phase 9 goes
    on (§8.5: a gate whose only open items wait on the owner still merges).
  - **Verifier:** the Phase 8 review (three lenses, a skeptic each, D109) read G8's command set against §9.3 and
    found it sound; its fixes landed before this run.
- **Why:** G8's machine part proves the way to the owner's review end to end; the review itself is the owner's.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.51.0

## D112 · 2026-10-19 · Phase 9 in lanes: 9.1 split, 9.2 and 9.3 beside 9.1a, one `library` tool, the tools' budget 3,200

- **Principle:** 1 (budgets), 10, 11, D83, D93, §5.9
- **Call:**
  - **WP-9.1 split as D93 split WP-7.2:** 9.1a, the intake pipeline (the `library` tool, the checker, the adopt bot,
    the library gates, `intake.yml` and `library-gates.yml`; about 1,790 lines with tests), and 9.1b (brief B8, its
    grader and starter, the manual's grow section).
  - **WP-9.2 and WP-9.3 were built beside 9.1a,** though their Needs is 9.1: neither needs 9.1's code. 9.3 is a
    library module the checker calls: the integrator wired its index (`DedupIndex.check`, time-warped and mirror-aware)
    into the dedup gate, the clip a submission improves and that clip's census copies aside; a library jog mirrored
    and retimed is bounced, which the census's pose match lets through. 9.2's clips enter through the store's own
    submit, the door `library submit` sends through after its local gates; the checker runs every gate on what
    arrives, and `deliver` runs the source's gate first.
  - **One tool, `library` (`do: submit | status`), not two:** the CLI's form is `m3a <tool>`, as `review` is; 135
    tokens. The tools' descriptions come to 3,130 of 3,000, so **the budget becomes 3,200 tokens**: the intake's tool is
    §5.9's way in for every contributor, and cutting 130 tokens from the other 21 tools' descriptions would drop words
    G7's agents read; G7's record at 3,000 stands as measured.
  - **9.1a's other calls:** a clip that fails a local gate isn't sent (the checker reruns every gate on what arrives); a
    recipe is sent as written (it has no field for `by`, `prompt`, `manifest` or `improves`); an improvement is
    adopted as a new version of the same id, the old file's SHA-256 in its provenance; in a pull request, a clip that
    didn't come through the intake is judged against the library's own baselines, its retarget left to T2's sweep (two
    maintenance changes on main failed otherwise); the retarget runs last, once every other gate passes. `intake.yml`
    reads `M3A_SUPABASE_URL` and `M3A_SUPABASE_SERVICE_ROLE_KEY` and does nothing, saying so, without them.
  - **Adoption keeps the library whole** (a lane after 9.1a, its open question): an adopted improvement is a new
    version of the clip in that clip's set, so the importers and the migrator keep a clip whose provenance names its
    intake submission and whose review is the owner's approval on its current motion hash over its source's version,
    `--check` counting it byte for byte (`kept: "adopted"` in the import record; a migrated set has no import record,
    the clip's provenance and review are its record), and any other rewritten clip keeps its review while its motion
    hash matches. The bot's pull request regenerates the lock, the sensors' baseline, the distributions,
    docs/LIBRARY.md and the registry index with the repository's own commands, a distribution worse than recorded named
    in its body (the owner's adoption is the logged decision), a failed regeneration a failed gate. Proved under
    M3A_FULL on a migrated and an imported clip: `migrate --check`, `import --check`, `library check`, `qa --check`,
    `qa library --check` and `index --check` pass on what it merges. A hand-written QA reason whose finding an
    improvement removes makes the bot close the pull request, not edit the reason.
  - **9.3's calls:** one motion under 12 mm a point plus 2% of how much the stiller clip moves (`NEAR`, `SHARE`: very
    fast clips can't be refitted closer); a light edit is a 1° chest lean, 50 ms of smoothing or a 5% trim; copies
    across rigs are lineage's (`orig`), not the motion distance's. Planted copies: 87 of 87 found in T1, 501 of 501 in
    full; none of 293 named distinct pairs merged (the nearest 23.0 mm against 12.4); every clip's lineage resolves, the
    28 composed ones to 21 sources.
  - **9.2's calls:** a clip's `provenance.source` records the source, its terms' license and version as served, the
    seed and a SHA-256 of the intent; the HTTP adapter template lives in tools (a network adapter), off by default,
    its transport always injected, sending Kimodo's constraint shape; core's public API reaches 44 of 44 with
    `sources`, and the tools' half is `sourcing` (m3a.js holds every package's names once).
  - **9.4's calls:** each core set's versions are numbered per set (v1, v2, ...) and the index's `serial` grows with
    every change, neither the package's version; a version carries a digest over all its set's files beside its content
    id (which covers the clip files only); a community pack is admitted from its namespace's proof (a domain's
    `/.well-known/m3a-packs.json`, or `m3a-packs.json` in a GitHub owner's `.github` repository) and refused on a
    mismatched hash, an unverified namespace or a license that can't be redistributed; the index has a JSON Schema
    (tools/release/index.schema.json); the `library-pr` gate checks the index too, so a pull request that changes a set
    carries its new version. `release.yml` runs only by hand and fails closed unless the repository variable
    `M3A_O2_RELEASE_ASSETS` is "yes" and the repository's owner started it: that variable is the owner's O2 go-ahead,
    which no session sets (D99: nothing is published).
  - **9.1b's calls:** B8's emote is the agent's choice (the brief names the job, not the clip); its grader asks for
    more than the queue does (the clip tagged emote, no `--improves` on a new clip, the disclosure and the local
    report `library submit` adds, so a recipe sent as written fails) and plants seven bad solutions (never submitted,
    bounced as a duplicate, a false CC0 claim, a sunk body, `--improves` on a new clip, a recipe as written, a record
    written by hand); the runner gains `solve` (the known-good's m3a calls) and `during` (the checker every 30 s while
    the agent works, so `status` shows its bounces); the manual's Grow example sends a fix with `--improves`, not B8's
    job; the manual's cuts each say the same thing shorter (its two tables as lists, duplicates and rewordings).
  - **The spec documents the two provenance records the intake and the sources write** (`intake`, `source`, both
    optional; spec/MOTION.md §7.4, re-frozen by this decision): readers and the schema accepted them already.
  - **The bench's `--need N`:** a gate's clause can need more than 4 of 5 (G9's ten clips through review, every one).
- **Why:** the plan's Phase 9 in the lanes D83 allows, each WP's Done-when proved by its Verify; the budget change keeps
  the tools whole for agents rather than trimming words they use.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.52.0

## D113 · 2026-10-19 · Phase 9's verifier review: its fixes, the two provenance records' shape, the source socket API-only

- **Principle:** 2 (a deviation), 10, 11, §5.9, D112
- **Call:**
  - **The review:** a fresh verifier per lens (the intake and adoption; the sources and dedup; the index and G9's
    set), each finding checked by a skeptic that reproduced it. Every finding is fixed below or answered here; three
    lanes fixed them (fix-intake, fix-sources, fix-index), the integrator the rest.
  - **The two provenance records have a schema** (clip.schema.json and core's validator; MOTION.md §7.4's rows, re-frozen
    by this decision; D112 said readers and the schema took them, but the schema took any value): `intake` is `{ by,
    prompt, manifest, improves, submission, report }`, each part optional in the format, the intake's gate requiring
    `by`; `source` is `{ name, license, version, stated, seed, prompt }`. An unknown shape is refused (E003, E004, E014,
    E017), an unknown field flagged in lint mode (W001).
  - **A source's terms are recorded both ways:** when a remote source serves its clip under terms other than it states,
    `provenance.source` keeps the served terms and `stated` the stated ones, and `allowlisted()` needs both on the
    intake's allowlist (a derived tier only when both inherit). The socket refuses a malformed name or terms (E_SOURCE)
    and unreadable served terms (E_INVALID). Both being allowlisted while they differ is allowed and recorded.
  - **A source's clip reaches the intake whole:** `deliver` takes `by` and the generator's `manifest` and writes the
    clip's `provenance.intake` as `library submit` does (the intent's SHA-256 as its prompt, submit's local report), and
    refuses with no `by`, or a generated clip with no manifest; the tools' sources types are core's, not a copy.
  - **The motion-source socket stays API-only (principle 2's deviation):** `sources.sourceClip` and `sourcing.deliver`
    have no CLI command or MCP tool. A source is code a program supplies (an injected transport, a procedural function,
    a recipe), which a CLI argument can't carry; a clip it makes goes through `library submit`, which every surface
    has; and the tools' descriptions stand at 3,130 of 3,200 tokens. The Node lane (`localLane`, from
    `@m3a/tools/node`) writes library/local/'s sets atomically under a lock, every path through `localPath`, a link
    anywhere on the way refused (E_LOCAL). A tool comes when a source an agent can name exists (Kimodo, O8).
  - **Ids are never reused, checked:** `npm run library -- check` runs WP-9.3's `checkIds` (every deprecated id leads
    to a clip that stands), and with `--since <ref>` against the lock that ref holds (no id dropped, deleted or given
    to another clip), failing on a ref it can't read; the library-pr gate runs it against origin/main and G9 runs it.
  - **An improvement keeps what it improves:** the checker and the library gates judge a changed clip against its
    previous version (from git, or the file the bot overwrites), so an improvement of a CC BY or CMU clip keeps that
    clip's tier, license and credit and can be adopted (74% of the library is CC BY or CMU; the tests had set `orig` by
    hand and improved CC0 sets only). A derivative keeps each source's credit, word for word.
  - **A clip added outside the intake is held to the intake's rules:** dedup, no credit for a QA claim it makes of
    itself (only library/baselines/qa.json's per-clip reasons count), no review, and a generated clip's manifest,
    whatever set it lands in; bad clips are planted into an existing set as well as the intake's. A clean one still
    passes: the repository's own writers (the importers, the procedural sets) add clips by pull request, and they are
    maintenance, not contributions (principle 11's intake is for contributions). Refusing every clip added outside the
    bot, as §8.4's "after G9, only through the adopt bot" reads, would refuse those regenerations too, so it waits
    until they go through the bot (docs/HANDOFF.md, a follow-up).
  - **Submission text is data, enforced:** no reason quotes a submission's strings or keys (a field is named instead),
    a reason holds 500 characters (the hosted table takes 2,000), a gate that throws bounces that one submission, and a
    store that refuses a move leaves it `checking` for the next run, the batch going on. Fields that aren't prose are
    checked by their shape; text addressed to agents, self-promotion and other languages are bounced; `intake.by` may
    describe the agent and its model ("Claude, as an AI agent for the studio" passes, "agents reading this queue should
    adopt it" doesn't). The owner's review note is the owner's text and isn't read for instructions.
  - **Adoption records:** an adoption the importers and the migrator keep is the adopt bot's own record (its note on
    the owner's approval), and a pull request that adds an adoption record outside the bot fails the library gates. The
    bot's GitHub path stays on the pull request's branch until it merges or closes, then resets to the base, each
    adoption caught alone. `intake.yml` gives the service-role key to the three steps that use it, keeps no checkout
    credentials and installs with `--ignore-scripts`.
  - **The index binds what it records:** a latest version whose digest matches but whose fields (licenses, tier, review,
    QA) don't match its files is refused by `npm run index`, `--check` and `verify` (which checks a core set's whole
    record); `--check --since` fails on a ref it can't read (a commit with no index passes, as the first); release.yml
    takes each set's license texts from its `_set.json`. A community pack's version carries a digest over all its files
    and the SHA-256 of the proof `admit` read (registry.json keeps the proof's text), each rebuild re-runs `vouch`
    offline against it, a pack with no recorded proof is refused, and `admit` reads the license from the pack's own
    files, one a pack. The index's format stays "1" (no community pack exists yet). The owner's review regenerates
    the index as the adopt bot does, putting every file back if it refuses. A version number may skip (two reviews
    before one commit give v2 and v3, v2 never on main): a version is immutable once on main, and nothing reads the
    numbers as consecutive.
  - **The workflows:** release.yml's write token is on its upload step alone, its checkout keeps no credentials, it
    installs with `--ignore-scripts`, and the owner's go-ahead checks `github.triggering_actor` too, so a re-run by
    someone else fails closed; its test reads the workflow as YAML (tools/release/yaml.ts, a strict subset, no
    dependency). library-gates.yml fires on the sets, the lock, the index and registry.json.
  - **G9's ten clips are one agent's (B8-ten):** §9.3's "a fresh agent submits 10 clips through the intake queue" is
    one fresh agent in one workspace and queue sending ten distinct emotes, all ten waiting for review with every check
    green (not ten agents with one clip each, as D112's `--need 10` read it). It gets 240 turns and 90 minutes, three
    times one brief's, the setup shared. G9 runs B8 itself at 4 of 5, as every brief, and its held-out variant; no
    gate passes `--need` now, and the flag stays for a clause that needs it.
  - **B8's grader holds what its brief asks** (WP-9.1b's review): an emote stays in place (no walking or running as
    `describe` reads it, under 0.25 hip heights travelled); the queue record is the one `library submit` sent (its id and
    content hash its text's, its local report as submit measures the clip); who made it names an AI agent and its Claude
    model (O10: every trial runs one); its name and description are its own, not its source clip's. B8.md says each, so
    held-out run 1, written before these rules, is replaced by run 2 (a fresh writer and checker, D91), run 1 kept unused.
  - **The integrator's three:** `--need` never lowers the pass mark under 4 of 5 (ceil 80%, PLAN.md §7) and the
    results record the mark they were judged at; G9 runs the adopt bot's whole proof (`npm run test:full`, vitest under
    M3A_FULL); G9's doctrine step says the tools' 3,200 is T1's tools-budget test.
- **Why:** the review found the Done-when unmet on paths the tests didn't take (an improvement of a CC BY clip, a
  clip added to an existing set, a source's clip), each fixed with a test that fails without it.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.52.1

## D114 · 2026-10-19 · G9 run 1 failed on B8-ten (9 of 10); fixed forward: the intake reads an emote or idle that moves

- **Principle:** 11, 12, PLAN.md §7, §9.3, D78
- **Call:**
  - **Run 1** (ba75cff, 0.52.1, `bench/results/gates/G9-run-1/`) passed 15 of its 16 commands: the intake's 18
    fixtures, the 28 plants in a pull request, the adopt bot's dry run and whole proof, the ids, the index, T2, B8 at
    5 of 5 and its held-out variant (run 2, gen-7359) at 5 of 5. B8-ten failed: its one agent had ten emotes waiting
    for review with every gate green, but one of them walks (`describe`: "0.00–1.67 s walks"), which its brief rules
    out, and it hadn't read its clips with `describe`; 9 pass every check. The grader stands as it was written: the
    brief named the rule, so the miss is the agent's, and the clause is all ten.
  - **Fixed forward in the intake, not the grader:** the lint gate (local in `m3a library submit`, and the checker's)
    finds a contribution tagged `emote` or `idle` that `describe` reads walking or running, or that travels a quarter
    of its hip height or more (a loop's cycle), and names the reading ("tag emote: it walks from 0.00 s as describe
    reads it: an emote stays where it stands; keep it in place, or tag it as the motion it is"). A mis-tagged clip
    misleads search and the agents reading catalog rows, so the library's door holds it, as B8's grader does; the
    library's own clips are untouched (the rule reads submissions only; its emotes travel 0.02 at most). B8's planted
    walk is bounced by it now too.
  - **Run 2** takes a fresh held-out variant (run 3, by a fresh writer and checker under D91's read bar): run 2's was
    used by run 1.
- **Why:** §8.5 fixes forward a failed gate and runs it again; the fix is the tool telling a contributor what its
  brief asked it to check, not a looser grade.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.52.1

## D115 · 2026-10-19 · G9 = M3's command set passed on run 2; its hosted run, adoption and approval blocked-owner

- **Principle:** 11, PLAN.md §7, §8.5, §9.3, D91, D114
- **Call:**
  - **Run 2** at 9d4342d (0.52.1, `bench/results/gates/G9-run-2/`) passed 16 of 16 in 1,641.9 s: check, T1 (108.3
    s here, 77.1 s in CI), doctrine, vectors, the intake's 18 fixtures, 28 plants failing the library gates, the adopt
    bot's dry run and whole proof, the ids, the index byte for byte and every set verified, T2 (327.5 s), the held-out
    run fresh, B8 at 5 of 5, B8-ten's one agent with ten clips through (19 sent, 9 bounced by the queue: 7 near-
    duplicates, 2 retarget slides), and B8's held-out variant (run 3, gen-5672) at 5 of 5; $1.87 of trials.
  - **What waits on the owner** (blocked-owner, asked on the pull request): the intake contract suite run in Actions
    against O8's linked project; an adoption landing through a merged pull request (intake.yml's adopt bot, O8's
    secrets, Actions allowed to open pull requests); the owner's approval of at least 70% of a sampled batch
    (`queue.json` in the run's record: B8-ten's ten submissions). §8.5 merges the gate with them open, as G8's phone
    review.
  - **The review bot's findings on #14 and #15** (posted after they merged, found before this pull request's merge):
    the submit function reads a body without a length as a counted stream (413 past the cap), a retry of an accepted
    text answers its row at the rate's limit (the function and the rate trigger, the migration edited in place while
    O8's project is unlinked), the review file's `by` is one line and its `proposals` a list, the site empties only a
    directory with its marker, the retarget judge's torso allowance covers only a real span's joints (no judged pair of
    6,990 moved; the sweep's pin re-pinned for reach and spans alone), and QA's off-feet answers sit in their own field.
    The submit function stays without CORS: no browser calls it (the contributor page reaches Auth and PostgREST
    alone), and §5.9 keeps the contributor key out of pages.
  - **The review bot's findings on this pull request:** a deprecation can't be taken back or pointed elsewhere; a
    half-linked hosted store is E_KEY, not the local queue; the migrator refuses an adopted clip whose source's rest
    moved (the owner adopts it again: keeping the old rest would change the clip's `restSrc`, which its motion hash
    covers); the adopt bot probes for a free id; the index's serial is held to the trusted index's; release.yml uploads
    only to a draft; library-gates.yml checks every set's license texts (in the workflow, before the gate: the gate's
    license step reads only the sets whose clips change). Not taken: binding a community pack's `verify` to the proof
    hash recorded at admission. `verify` checks the files against the index's content id and digest first, so a forged
    proof can't pass other files, and the namespace's proof file changes as the owner admits more (a new SHA-256) while
    each rebuild already re-vouches the recorded proof; the thread stays open for the owner.
  - **T1 at the gate was 108 s on this machine** (CI 77 s on the same tree): over its 90 s budget, under its fail
    mark; Phase 9's heavy proofs run in T2's full step (ba75cff).
- **Why:** the gate's machine-provable clauses, each run in its command set, and the owner's left as the owner's.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.52.1

## D116 · 2026-10-19 · Phase 10: the conformance kit's protocol, the consumer proof, G10's command set and its review

- **Principle:** 3, 5, 7, 12, O9, D83
- **Call:**
  - **WP-10.2, the kit's protocol (m3a-conformance/1, spec/conformance/PROTOCOL.md):** an implementation is a sidecar,
    a command reading newline-delimited JSON requests on stdin and answering one line each on stdout, the pattern
    shardfall's Rust tools use for SpawnForge; `hello` names the ops and format versions it answers; eleven ops cover
    tiers 1a, 1b, 2 and 3, each compared at its tier's tolerance (1a and 1b bit for bit, 2 within 0.001 mm and by the
    vectors' SHA-256s, 3 by the bodies' limbs within 9°, the chest within 9 (14 curled), lengths kept, soles on the
    floor); a tier whose ops an implementation doesn't answer is "not claimed", failing only when `--tier` names it;
    `frozen/` is core's own check, not asked. Every answer, hello's too, is checked against protocol.schema.json
    before it is compared; a request unanswered past its deadline (60 s, `--timeout`) fails with its op named; the
    vectors are verified against their manifest first, and a certification names the protocol, the manifest's
    SHA-256 and the commit.
  - **The CLI lives in tools/conformance/** (`npm run conformance -- --impl ts|"<command>"`), beside the other repo
    tools, though WP-10.2's Owns names spec/conformance/* alone; the kit, the adapters and the protocol are there.
  - **The broken implementation** (adapters/broken.ts) takes its defects by name, comma-separated, so one process
    serves several cases: a rounded fit, swapped wrists, NaN or strings where the reference is zero, longer legs with
    their bones hidden, sunk soles, an echo, a bare hello, a null line, a hang. Each fails naming its vector.
  - **shardfall's Rust codec certifies tiers 1a and 2 now** (CERTIFYING.md, read against its pin a9ca003): its glTF
    reader gives no mannequin look and calls its warnings `notes`, so tier 1b waits on that port; written here only,
    as a proposal (O9).
  - **WP-10.1, the consumer proof (apps/lab/consumer-ts):** a my-3dge-shaped duel (three.js r182, a fixed 60 Hz sim
    on my-3dge's frame clock, two humanoids on one graph, a slash whose `hit` event lands through the sim's rules,
    root motion) on the public API alone; its e2e plays the scripted session in the browser and in Node and compares
    them step by step (events, hits, places, hp, hashes), holds the hero to `sim.simulate`'s root path at every step,
    and runs the page's own frame loop on a held clock. The lab reaches past the manual twice, both public names: the
    library's files bundled by its Vite config (`defaultSets`, `directory`) and the names its README lists; the manual
    stays at 7,999 of 8,000 tokens.
  - **docs/MIGRATING.md** maps my-3dge's WPs 3.4–3.7 (ADR-0009) and 8.1–8.10 (ADR-0010), at its pin 652ea6b, as
    replaced, wrapped or kept, and names the others the package replaces (WP-10.8's Library Lab in part); every API
    call it writes runs as written. Proposing the switch in my-3dge is O9: the guide proposes, it changes nothing
    there.
  - **G10's command set:** check, test, doctrine, vectors, the full TypeScript certification, the consumer proof's
    e2e, `pack --check` (the packages as another repository installs them) and T2. G10's clause, another repository
    consuming the package or certifying against the vectors and the owner's confirmation, is the owner's (O9):
    blocked-owner, asked on the pull request.
  - **The review:** a fresh verifier per WP, each finding checked by a skeptic. The kit certified a retarget that
    hid its bones and NaN answers where the reference was zero, crashed on a wrong-shaped answer or a null line, hung
    on a silent sidecar and didn't enforce its own schema; T2 was red on the lab's stamp, and the e2e passed a lab
    without root motion or a broken hash. Every finding is fixed with a test that fails without it (the e2e against
    six mutants of the lab).
- **Why:** the plan's Phase 10, each WP's Done-when proved by its Verify, and what only the owner can give asked for
  rather than done (O9).
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.53.0

## D117 · 2026-10-19 · G10 = M4's command set passed on run 1; another repository's use and the owner's confirmation blocked-owner

- **Principle:** O9, PLAN.md §8.5, §9.3, D116
- **Call:**
  - **Run 1** at 95af62d (0.53.0, `bench/results/gates/G10-run-1/`) passed 8 of 8 in 537.5 s: check, T1 (109.1 s
    here), doctrine, vectors, the full TypeScript certification (tiers 1a, 1b, 2 and 3, 3,662 cases), the consumer
    proof's e2e, `pack --check` and T2 (352.4 s); the certification's report is kept beside it.
  - **G10's clause is the owner's:** another repository consuming the package or certifying against the vectors, and
    the owner's confirmation. The session acts in no other repository (O9): docs/MIGRATING.md proposes my-3dge's
    switch and spec/conformance/CERTIFYING.md shardfall's certification; asked on the pull request, blocked-owner, and
    the gate merges with it open (§8.5).
  - **After the gate, the review bot's four findings** (#17): the wire writes -0 as raw JSON (no sentinel string), the
    certification's `-dirty` covers what the run executed (with `--impl ts`, packages/core and io), and the lab keeps
    a J press until a step takes it and lerps between the last two states after a multi-step frame. Re-checked on the
    fixed head: the kit's 55 tests, the TypeScript certification (3,662 cases), the consumer proof's e2e (5 of 5) and
    T1 (1,187 tests); the gate's record stands at its commit.
  - **Every §14 row through G10** is done or blocked-owner with its ask on its pull request: G8's phone review (#15),
    G9's hosted run, adoption and approval (#16), G10's confirmation (#17).
- **Why:** the last gate's machine-provable clauses run, and what only the owner can give asked for rather than done.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.53.0

## D118 · 2026-10-19 · The post-G10 audit: stale text corrected, two duplicates retired, small bugs fixed, the large items listed

- **Principle:** 4 (text is the source of truth), 12 (the contract), AGENTS.md's definition of done and two tiers
- **Call:**
  - **An audit of the repository after G10** (eight read-only auditors and a completeness critic, 78 findings): every
    easy finding is fixed in this change; every large one is listed in `AUDIT.md` (temporary) with its plan, and the
    owner's are in docs/HANDOFF.md.
  - **The frozen spec takes errata, refrozen under this decision:** a library clip named in a recipe's clip step or an
    action's interrupt takes the clip id's slug with `-`, as MOTION.md §11, the clip schema and the graph schema
    already do (no recipe could name `MESH2MOTION/Two-hand_Blast`); MOTION.md §6.1's count (176), §7.4's `recipe`
    provenance row and §15's twist pop (Quaternius stays migrated, D63); tiers.md's 1b inputs (the Rigify vector) and
    the kit (WP-10.2, done); SKELETON.md §7's watch says what is practised.
  - **The Khronos watch (R7), run now:** the registry (KhronosGroup/glTF `extensions/README.md` on main, read
    2026-10-19) lists neither `KHR_character_skeleton_mapping` nor `KHR_character_reference_pose`, ratified or in
    progress; nothing to align.
  - **The skill isn't in any tarball:** WP-7.4's Build never packed it, so the runner's copy from the repository is
    the path, and the comments that said "until WP-7.4 packs it" now say so. Shipping it in `@m3a/tools` would be new
    work (`AUDIT.md`).
  - **apps/lab/hello stays,** answered at G4 (D88): its e2e is T2's standing G4 check (the set on G4's skeletons and
    the held-out rig), which consumer-ts doesn't cover. Graduating that check into the package tier, then deleting
    the lab, is listed in `AUDIT.md`.
  - **Retired:** `tools/run/pending.ts` (the Phase 0 placeholder no script has used since d18e398) and two loose
    bench results that are byte copies of G4-run-2's (`2026-10-14-default-B1-variant.json`,
    `-fake-variant.json`); every other loose result is a gate's byte copy or backs a number a decision cites.
  - **The census still counts a mirror twice by design** (D67, a game needs each side): HANDOFF's bullet that read it
    as a defect is corrected, and joining them stays the owner's call.
  - **D96's follow-ups closed here:** parents in a loop among named bones throw instead of hanging; io refuses a
    non-finite rest head (K7); a composed source license is read part by part. A recipe's or action's clip step may
    name a hyphenated slug, and `interruptInto` writes the cut's own id with `_` for it.
  - **Two Quaternius baselines' reasons corrected** (140°, the re-import waiting on the source files): the sets'
    files changed, so the registry index mints their v2 (serial 2), one regeneration in one commit (D113).
  - **Small widenings, reversible:** `test:changed` follows imports (a core change selects nearly every suite, which
    is what covers it); `M3A_CHECK_OUTPUT` moves a tool's `--json` report (T1's conformance test uses it); doctrine
    fails a budgeted file or tools/pins.json that is gone, where Phase 0 reported it pending.
  - **T0 runs its typecheck and lint side by side, and lint caches by content:** CI's checkout gives every file a
    new mtime, so the mtime-keyed cache never hit there and lint took 9 to 10 s; with a cold type-check (core's types
    changed) this pull request's runs failed T0 at 23.4 and 22.9 s, over the 22.5 s mark, every step passing. The two
    steps share nothing, so they run at once: a cold T0 is about 16.7 s here, a warm one 2.3 s. Running lint on
    every core as well was slower beside the type-check, so it stays single-threaded.
- **Why:** documents that describe the plan as unbuilt, commands that no longer exist and doctrine checks that pass
  on a deleted file mislead the next session as surely as a failing test; the large items need their own WPs.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.53.1

## D119 · 2026-10-19 · The audit's large items: six built, the rest deferred with their reasons

- **Principle:** 2 (agent-operable), 10 (provenance), 11 (the library grows through gates), AGENTS.md's two tiers
- **Call:**
  - **Built here** (`AUDIT.md` items 1, 2, 3, 6, 10, 13): hello's G4 check moves into the package tier and the lab is
    deleted; the CLI and MCP name a generated character (`gen-<seed>`) and an orbit; `@m3a/tools` ships the
    agentskills.io skill; the intake checker samples only what is new; `deliver` refuses a clip whose stated and
    served terms differ, and the format requires `provenance.intake.by` (reversing two of D113's calls); T1's
    heaviest benchmark cases run in full in T2, a sample in T1, as D74 did.
  - **Deferred, each with its reason** (moved to docs/HANDOFF.md's follow-ups, `AUDIT.md` then deleted): the manual's
    untaught names (item 4: the manual is graded by G7's quiz and briefs, so a cut reopens G7's evidence); only the
    adopt bot adding clips (item 5: D113's call stands until the importers' regenerations go through the bot);
    the locomotion rate sweep (item 7: D106's follow-up needs a decision on what fails before it can gate); a linear
    planter and key fit (item 8: it changes the frozen vectors other implementations certify against, G10's route);
    contacts for the six unplanted loops (item 9: D108 answered them, and B1 grades the clips they'd change); the
    proof's digest and the census's mirrors (items 11, 12: the owner's, on #16 and D67).
  - **How they landed:** `gen-<seed>` takes a whole number without leading zeros (one name a seed) and no negative
    seed, unlike the sweep's and the gallery's parse; the tools' descriptions now cost 3,189 of their 3,200 tokens;
    the registry tells an argument off every form what is wrong in the one form of its type; first-flight drops
    hello's deep-link test (the lab's UI, not the package) and requires G4's held-out rig; the census's later counts
    take about 0.13 s, from 0.8 s; T1's graders run one planted case each (22 s of T1, from 34.5), T2 all; after CI's T1 reached 138 s, the runner's
    variant trial, the sweep's clip-by-skeleton sample, B3's Rigify known-good and two thirds of the token counts
    move to T2's full step too, the census's equality proof with them, and T1 reads every ninth locomotion loop's planted
    feet (every third before): T1's file time 250 s, from 287.
- **Why:** what needs nothing from the owner is done rather than listed; what changes graded, frozen or decided ground
  waits with its reason written down.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.54.0

## D120 · 2026-10-19 · The owner's answers: #18 merges, D94 stands, the #16 proof thread stays as is, the stray artifact goes

- **Principle:** 11, O2, the owner's review of calls made without an answer
- **Call:** asked in the session after #18's CI went green, the owner answered four questions:
  - **D94 stands:** benchmark agents keep running as an unprivileged user with no capabilities and are handed the
    CLI's credentials so they can call the model. D94 is answered yes.
  - **#16's proof thread, as is:** a community pack's `verify` keeps checking the pack's content id against the live
    proof; it is not bound to the proof hash recorded at admission (D115's call kept). The thread is answered and
    resolved.
  - **The stray artifact is deleted:** the private copy of spec/conformance/CERTIFYING.md a lane published by mistake
    (D116's lane) no longer exists; the repository's file is unchanged.
  - **#18 is squash-merged** once its head is green with this record (0.54.0).
- **Why:** each was the owner's to decide; the record keeps D94's and D115's answers next to the calls they settle.
- **Answered:** yes, the owner, 2026-10-19.
- **Landed in:** v0.54.0
