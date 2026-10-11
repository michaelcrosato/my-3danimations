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
    TypeScript yet; it is pinned with the first module that does (WP-4.3).
  - **Found on the way:** r182's `three.webgpu.js` reads `GPUShaderStage` as it loads, and WebGPU's interfaces exist
    only in a secure context, so on a plain `http:` host other than localhost the module fails to load at all,
    WebGL 2 included. Pages are served from `localhost` or `https:` (docs/THREE.md).
- **Result:** the test passes on r182 on both backends (the frame drawn, moving, the crossfade ending on its clip, no
  warning) and on r186 on WebGL 2, its WebGPU start failing as in the check. Doctrine finds each banned API in a
  fixture and a pin moved in the package or the lockfile.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.20.0
