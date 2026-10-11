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
