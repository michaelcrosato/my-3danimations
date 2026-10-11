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
    - limbs: their poles, the natural pole at rest, the key's twisted pole posed, so a straight limb keeps its twist;
    - hands: the knuckle line;
    - feet: the pelvis's up;
    - spine bones: their share of the pelvis-to-chest turn (the key's `spine`, else the source library's when given,
      else the body's own);
    - fingers: their curl (absent: format 1's fists).
  - Local rotations are relative to the parent's world orientation, with a host's rest orientations when given (a
    test rebuilds the joints from them).
  - A pose whose lowest sole would go below the floor is lifted whole, as my-3d2dge's `Mocap.drive` did. Solving each
    leg onto the floor bent legs up to 67° from the source on a rise from the ground.
  - Results:
    - Reference body (the tiny rig): every joint within 0.002 mm of the decoder at all 7,444 tier-2 samples.
    - Tier 3, seven bodies × 331 clips × 4 times:
      - whole limbs (shoulder to virtual fist, hip to ankle) within 9°, at worst 0° to rounding;
      - the chest faces exactly where the clip's does;
      - bone lengths unchanged, soles never below the floor, no NaN.
- **Limit:** a format-2 `spine` share, or a library's (CMU's 0.55), on the lowest segment turns the decoder's
  pelvis-to-spine segment with part of the chest's turn. No hips bone that also carries the legs can do that, so the
  joints above the hips sit up to 37 mm off the decoder's on the rig (111 mm on CMU's strongest curl). Every bone still
  takes its segment's turn, and the chest still faces exactly.
- **Outside WP-2.4's Owns** (one agent, D21): `limbPoles`, exported from the decoder; the decoder's fix for a shoulder
  with no offset (a body without shoulder bones gave NaN); `quat.fromMat3`; the tier-3 test and its skeleton helper.
- **Answered:** no: made without a response, to review.
- **Landed in:** v0.10.0

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
