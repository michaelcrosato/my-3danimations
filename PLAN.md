# my-3danimations: the plan

**Status:** adopted 2026-10-11 and built through Phase 10 (G10's commands passed 2026-10-19; G8 passed 2026-10-22; G9
and G10 wait on the owner, §14), then the follow-ups after G10 (F.1 to F.14), for an autonomous AI coding agent working
in Claude Code cloud sessions.
**Why this exists:** `docs/FEASIBILITY.md`. **Evidence:** `reports/AI native game animation landscape.md` and
`research_notes/`. **Read §0 first**, then only what each work package (WP) cites.

## Contents

0. [How to use this plan](#0-how-to-use-this-plan)
1. [Summary](#1-summary)
2. [Goals, non-goals and the scope rule](#2-goals-non-goals-and-the-scope-rule)
3. [The doctrine (adopted as DOCTRINE.md, D1)](#3-the-doctrine-adopted-as-doctrinemd-d1)
4. [What we carry over](#4-what-we-carry-over)
5. [Architecture and the contracts](#5-architecture-and-the-contracts)
6. [Tooling, testing and verification](#6-tooling-testing-and-verification)
7. [The benchmark](#7-the-benchmark)
8. [Work rules](#8-work-rules)
9. [Roadmap](#9-roadmap)
10. [Work packages](#10-work-packages)
11. [Running modes](#11-running-modes)
12. [Risks and kill criteria](#12-risks-and-kill-criteria)
13. [Owner decisions](#13-owner-decisions)
14. [Ledger](#14-ledger)
- [Appendix A: key numbers](#appendix-a-key-numbers) · [Appendix B: glossary](#appendix-b-glossary)

---

## 0. How to use this plan

- **Read once:** `docs/FEASIBILITY.md` §0, this plan's §0 to §3, and §8. **For every WP:** read `DOCTRINE.md`,
  `AGENTS.md`, the WP entry and only the sections and files it cites. The plan is a map, not a corpus: don't reread it
  end to end.
- **Order:** the ledger (§14), top to bottom, unless §11 lets lanes run in parallel. A WP waits until its **Needs** are
  done.
- **Every WP** follows the template and the definition of done (§8). Every **Done when** claim is proved by a
  **Verify** command, or marked *(deferred proof: where)*.
- **Gates** (§9.3) are fixed command sets. At a gate, run them, write the gate report (numbers, what works, links, what
  failed) in `docs/PROGRESS.md` and on the pull request, then go on to the next phase unless a kill criterion (§12)
  fires.
- **The plan is a living document.** When reality disagrees with it, measure, decide by the doctrine, record the
  decision in `docs/DECISIONS.md`, and edit the affected WP entries in the same commit. Expect several amendments a day.
  The plan prescribes outcomes and checks, not mechanics: where it names a tool or a mechanism and a better one
  exists, use the better one and log it.
- **Owner decisions** (§13) each have a default. Proceed on the default; escalate only the calls that are hard to undo
  (§3, "Deviations and escalation").
- **When the owner is needed** (G8's phone review, G9's sampled approval, G10's confirmation, linking O8's Supabase
  project and the repository settings it needs, an O-decision whose default is "don't"), mark the ledger row
  `blocked-owner`. Post exactly what is needed on the PR, and carry on with every WP that doesn't depend on it. The
  ledger's statuses are `todo`, `doing`, `done`, `blocked-owner` and `deferred` (with the reason).
- **Where the truth lives:** `docs/PROGRESS.md` (one screen, the current state), the ledger (§14: one row per WP),
  `docs/DECISIONS.md` (never cleaned up), `docs/FEEDBACK-LOG.md` (points not acted on, counted by theme).

---

## 1. Summary

### 1.1 What we are building

An open animation package for AI coding agents. It does for character motion what three.js does for rendering and
Rapier does for physics, and it is built for agents only. Working name **my-3danimations**, packages `@m3a/*`, CLI
`m3a`. Renaming before anything is published is decision O2.

Its parts are named for the fighter jet without a cockpit (`docs/FEASIBILITY.md` §2):

| Part | What it is | Phases |
|---|---|---|
| **The language** | A versioned spec: readable key poses (format 2), the humanoid skeleton profile, recipes and graphs, with schemas, a validator and conformance vectors | 1, 6 |
| **The airframe** | `@m3a/core`: a TypeScript runtime with no dependencies that is deterministic and never touches a renderer. It samples, blends, layers, mirrors, retimes and syncs clips, solves them onto any humanoid skeleton, and handles contacts, root motion, events and graphs | 2, 6 |
| **The sensors** | `@m3a/sensors`: motion metrics, `describe`, lint and fix, contact sheets and filmstrips rendered in software, and diffs | 3 |
| **The payload** | `library/`: over 1,000 unique, distributable motions, each with provenance, license, fit, facts and a QA verdict, found through one-line catalogs | 1, 5 |
| **The datalink** | One tool registry behind the API, the `m3a` CLI, an agent skill and an MCP server, plus a manual of at most 8,000 tokens | 7 |
| **The ground station** | A gallery on the owner's phone that plays any clip on any test character, shows its numbers, and works the review queue: approve or flag library clips; adopt, archive or reject submissions | 4, 8 |
| **The supply chain** | An intake pipeline (any agent submits to one queue, automated checks filter, the owner adopts), a socket for motion sources (generative models included), and dedup and lineage | 9 |

The rest: **adapters** (`@m3a/three` first; importers and exporters for glTF, VRMA, BVH and CMU's ASF/AMC) and
**flight tests**, the fresh-agent benchmark in `bench/`.

### 1.2 Why

In short (the full case is `docs/FEASIBILITY.md`):

- **The owner's repos prove the core and pay for the gap.**
  - Readable key poses already run at 14 to 18 mm from the capture, and a catalog line costs about 35 tokens.
  - The codec has been written twice, in JavaScript and then in Rust (about 7,500 lines with importers, in shardfall),
    and a third implementation is planned in TypeScript (my-3dge).
  - Forks have started under one name: `QUATERNIUS` means two different sets in two repos.
  - The first outside model to build a game on my-3d2dge never found the library: discoverability, not content, was
    the failure.
- **Outside, the niche is empty.**
  - No open, agent-oriented text format for 3D character motion exists. BVH and ASF/AMC are text, but flat per-frame
    channels with no naming standard.
  - No engine's official MCP server exposes animation operations; only community servers and extensions do.
  - Vision models judge motion poorly (49% on telling which of two frames came first; MotionBench mostly under 60%),
    so the sensors must measure, not look.

### 1.3 The decisions that shape everything

WP-0.1 records these in `docs/DECISIONS.md` as D1 to D15:

1. **D1 Doctrine.** §3 becomes `DOCTRINE.md`.
2. **D2 The shared unit is the spec, the data and the conformance vectors.** TypeScript is the reference
   implementation. Other languages certify against the vectors (WP-10.2) instead of porting the codec again.
3. **D3 Readable key poses stay the stored form, as format 2.**
   - New degrees of freedom are named optional fields.
   - `format` is validated on read.
   - A minor version only adds named fields, and fixed-length arrays never grow.
4. **D4 One clip per file, in plain JSON; every set has a content id.** No two sets share a name.
5. **D5 The canonical skeleton is VRM 1.0's humanoid** (55 bones, 15 of them required).
   - Mapping tables cover Mixamo, Unreal, Rigify, CMU, BVH and Unity.
   - Khronos's `KHR_character_skeleton_mapping` is tracked.
6. **D6 The core has no dependencies, never touches a renderer, and is deterministic, with a `step`/`pose` split.**
7. **D7 three.js is the first adapter.**
   - It is pinned to the version agents write correctly cold: the default is r182, the owner's prior pin.
   - The latest release (r186) is also tested.
   - Stale APIs are banned.
8. **D8 The sensors render in software, in Node.** A browser checks adapters only, on WebGL 2, because headless Linux
   Chrome cannot screenshot WebGPU.
9. **D9 No committed binaries.** Test characters are generated in code, and real CC0 rigs are fetched by SHA-256 into a
   git-ignored cache.
10. **D10 License namespaces, with CC0 as the default.**
    - The default pack is CC0: a game that installs the library gets only CC0 clips unless it opts in to more.
    - CC BY 4.0 (with credit) and CMU-licensed clips (CMU's terms forbid reselling the data "even in converted form")
      are opt-in, each in sets of their own.
    - Non-commercial and no-redistribution libraries stay in a local-only lane that never ships.
11. **D11 One tool registry, with the CLI and the skill first and MCP as a view.** CLI plus skills cost a coding agent
    less context than MCP; Playwright's own guidance says so.
12. **D12 Generative models plug in through a socket; none ships in v1.**
    - Most text-to-motion models are trained on non-commercial data (AMASS/HumanML3D) or carry restrictive terms.
    - The first commercially usable candidate, NVIDIA Kimodo, needs a GPU, so it would run as a remote backend
      (WP-D.9).
13. **D13 The benchmark is the North Star.** Fresh-agent dry runs gate every surface an agent touches.
14. **D14 This package is the upstream.** Games pin it; nobody vendors a snapshot of a sibling repo.
15. **D15 The library grows through one intake queue, and the repository stays the library.**
    - Any agent submits to a hosted queue (Supabase, O8). Automated checks run on every submission, and the owner
      adopts, archives or rejects each one that passes (O7).
    - Adopted clips are committed to the repository through pull requests, so the library stays open, versioned and
      forkable. The queue is only the inbox.
    - The queue sits behind an interface with a local backend, so no WP waits on the hosted project.

### 1.4 The shape of the roadmap

| Phases | What they do | Milestone at the end |
|---|---|---|
| 0 to 3 | Foundation, language, airframe and sensors, mostly in sequence (the contract comes first) | none |
| 4 | First flight on three.js | **M1** |
| 5 to 7 | Payload, composition and datalink (M2 needs search and the license check; library QA and G5's floors gate M3) | **M2** |
| 8 and 9 | Ground station and supply chain | **M3** |
| 10 | Consumers | **M4** |

On-demand WPs start only when their measured trigger fires (§10, "On demand").

---

## 2. Goals, non-goals and the scope rule

**Goals for v1.** A fresh agent, given the manual alone, does the seven jobs: find, fit, wire, make, check, ship and
grow. The benchmark measures it.

1. A versioned spec for format 2, the humanoid profile, recipes and graphs, with a validator and conformance vectors.
2. A deterministic TypeScript reference runtime that has no dependencies and never touches a renderer.
3. Sensors: metrics, `describe`, lint and fix, sheets and films rendered in software, and diffs.
4. A three.js adapter that puts any library clip on any humanoid glTF or VRM character, with a mapping report.
5. Library v1: at least 1,000 unique, distributable motions, each with provenance, license, fit, facts and a QA verdict,
   searchable, with the large corpora available on demand.
6. One tool registry behind the API, the CLI, the skill and MCP, and a manual within its token budget.
7. A gallery the owner reviews on a phone.
8. Growth: an intake pipeline (any agent submits, automated checks filter, the owner adopts), a motion-source socket,
   and dedup and lineage.
9. The benchmark: fresh-agent briefs, graded headless, run on every model the owner uses.

**Non-goals for v1.**

- Training, fine-tuning or hosting a motion model.
- A DCC, a timeline, or any GUI that is the only way to do something.
- A game engine, a renderer or a physics engine.
- Faces, fingers beyond curls, and cloth or hair simulation.
- Non-humanoid creatures. They are on demand, and the skeleton spec reserves body plans.
- Native adapters for engines other than three.js. glTF, VRMA and BVH exports reach the rest.
- Publishing packages (decision O2).

**The scope rule.** Work that no gate command and no benchmark brief needs is on demand, with a trigger.

---

## 3. The doctrine (adopted as DOCTRINE.md, D1)

WP-0.1 adopts this text as `DOCTRINE.md`. It keeps my-3d2dge's doctrine (adopted there as D1, 2026-10-10) and recasts it
for an animation package.

### How to read this

Read this as a trusted, capable manager building a package that you and others will use. Every principle is a default
with a reason. When the reason doesn't hold, deviate and say why. A deviation with a case for it is welcome: variation is
how discovery works.

### North Star

Put high-quality character motion into games through agents alone. The jobs are find, fit, wire, make, check, ship and
grow, all done in text and code and verified without a display. Leave behind the tools and methods agents can't use
well.

The analogy is an autonomous fighter jet with no cockpit, flown from a ground station. Removing the pilot removes the
constraints a human imposes on the design. The ground station is where humans set direction and judge quality, and
agents fly.

**What we optimize:** verified, shippable motion in games per unit of agent time and tokens.

**How we measure it:**
- the fresh-agent benchmark: first-try success, time and tokens per brief, per model;
- the library: the clips passing every gate, and the owner's approval rate on sampled reviews;
- the sensors' distributions across the library (foot sliding, penetration, pops), which may only improve.

### Two tiers

- **The package** is the spec, core, sensors, adapters, library, tools and docs. It is built once and used by every
  game, so it gets the care, the checks, the versions and the manual.
- **Labs** (`apps/lab/`, each with a date and the question it answers) find what is worth building. A lab may reach past
  the API and deviate from any principle except 4, saying so in one line. It graduates into the package or is deleted.

### Principles

1. **Agent-readable.** An agent uses the package from the manual alone, and the manual has a measured budget (8,000
   tokens).
   - Every clip reads as text: the legend fits in 800 tokens (with one worked key), a catalog line in 40, and a
     typical clip in about 3,000.
   - No model has seen this format in pretraining. The legend, the manual and the skill stand in for that exposure,
     and they version with the schema.
   - Source files are small, each with a header saying what it holds, and names are easy to grep.
2. **Agent-operable.** Every capability has a typed API, a CLI command and an MCP tool, all from one registry, plus a
   console handle on every page. A GUI is a view over them, never the only way in.
3. **Verifiable without a display.**
   - The sensors measure motion from skeleton data, and contact sheets and filmstrips are rendered in software,
     deterministically.
   - Agents judge by numbers first and pictures second, and humans judge feel at the ground station.
   - The package ships its own test harness.
4. **Text is the source of truth.**
   - Motion, skeletons, recipes, graphs, catalogs and provenance are text an agent can read, diff and edit.
   - Binaries exist only at the edges: import, export, and runtime tracks generated from text.
   - Binaries are reproducible from text plus pinned sources, and are never committed unless they are on an approved
     list.
5. **Deterministic by construction** (invariant). The same inputs give the same numbers, bit for bit, in Node and in the
   browser, with any renderer or none. Hashed paths use the package's portable math.
6. **A core that never touches a renderer** (invariant). The core imports no renderer, DOM, GPU or Node built-in.
   Adapters translate its output. It runs anywhere JavaScript runs, and its spec lets other languages certify against
   it.
7. **Common ground.**
   - Use TypeScript, JSON, JSON Schema, glTF, VRM's bone names and three.js.
   - Don't invent a house idiom where a standard exists.
   - The new parts (the format, recipes, graphs) are small and explain themselves.
8. **Quality under the hood.**
   - Solving, retargeting, contact handling and fitting use the best method the builder can execute well, behind a
     small API.
   - Errors speak the API's language and suggest the fix.
   - A check lists everything that reaches past the API.
9. **Pin what agents know.** Use the dependency versions agents write correctly without docs, checked by a cold write.
   Pin them exactly, and ban the stale APIs agents reach for out of habit.
10. **Provenance on everything.**
    - Every clip records its source, its SPDX license, its method (captured, keyed, procedural, composed, edited or
      generated), its producer (tool, version, model), its lineage and its measured quality.
    - No clip lacks them.
    - Games get a credits list from a tool.
11. **The library grows through gates, not trust.** Every contribution, human or AI, comes in through the same intake
    queue, passes the same automated gates, and is adopted only after a human review. A flaw that slips through becomes
    a new check.
12. **Discovery first, hardening later, except the contract.**
    - Develop on one platform: Linux, Node and headless Chromium.
    - The exception is the contract: the spec, the vectors and the format's versioning. Every game and every port
      depends on them, so they are versioned and migrated from day one.

### Checks

Each promise has a check, run on every change and chosen by what changed:
- the manual's examples run and fit its budget;
- the import boundaries hold;
- no banned APIs are used;
- pinned versions and checksums match;
- the conformance vectors and the determinism hash match in Node and Chromium;
- no binaries exist outside the approved list;
- every clip validates and carries provenance, license, fit and a QA verdict;
- the token budgets hold.

A principle without a check drifts.

### Deviations and escalation

- **In a lab:** deviate when it helps, and say so in one line in its entry.
- **In the package, a reversible call** (anything a revert undoes: code, design, a dependency, a doc): make it now, in its
  own commit. Flag it in the pull request and log it in `docs/DECISIONS.md`.
- **In the package, a call that is hard to undo.** These reach outside the repository or can't be reverted: publishing,
  spending, a license, deleting what others rely on, acting in another repository.
  1. Escalate, naming the principle, the options and your recommendation.
  2. Arm a 15-minute wake-up: `send_later` with `delay_minutes: 15`, cancelled with `delete_trigger` if an answer comes
     first.
  3. Keep working on whatever doesn't depend on the answer. With nothing left, end the turn.
  4. If the wake-up fires with no answer, take the default from §13 in its own commit and log it. For publishing,
     spending and acting in another repository, the default is always "don't".
- **Every call made without an answer** goes in the decisions log and in the PR description. The log is never cleaned
  up.
- **A deviation that keeps winning** is a proposal to change this doctrine.

---

## 4. What we carry over

These are the pinned commits studied on 2026-10-11. WP-0.4 records them in `tools/pins.json`; moving a pin is a commit
of its own.
- my-3d2dge `14a561c031fd2b9649606d4f3ac7baae1c2dbbfe`
- my-3d2dge-2 `c8295dc0300ffa1ccadcf4702668ff412b735c39`
- shardfall `a9ca003069db3da9245de1e1e21d5d288140f41e`
- my-3dge `652ea6bc0affdce2943f5705ee2c5fa167ddbbaa`
- riftlight `f3693fca0039bdeda5918083bfa28b4a7b8a82af`

All five repositories are public at `https://github.com/michaelcrosato/<repo>`. A shallow fetch by full SHA works
anonymously, in a cloud session and in CI. Everything the tests need from them is committed as vectors, so only the
`--check` regeneration needs the network.

The full inventories, with `path:line` references, are in `research_notes/AI native game animation landscape/`
(`predecessor_origin_repos.md`, `predecessor_adopter_repos.md`).

my-3d2dge and my-3dge are MIT. riftlight, shardfall and my-3d2dge-2 have no repository license file; their author, the
owner, licensed the code and data carried from them under MIT on 2026-10-11 (O11). The grant covers the owner's own
work: third-party motion data in a carry keeps its upstream license, and clips keep their per-set licenses (D10).

| From | What | Action | WP |
|---|---|---|---|
| my-3d2dge `src/mocap/readable.js` (338 lines) | The format codec: parse, text, mirror, continuity encoding, decode, fit | Port to TS, proved against vectors from the JS original | 0.4, 1.3 |
| my-3d2dge `src/mocap/mocap.js` (265) | Sample, blend, `Mocap.drive` retargeting (directions at the rig's own lengths, two-bone IK, heading from the chest) | Rewrite as core | 2.2–2.4 |
| my-3d2dge `tools/anim-import.mjs`, `asf-amc.mjs`, `cmu.mjs`, `anim-set.mjs` (~730) | Importers, the CMU survey and ledger, cutting sets | Port to `@m3a/io` | 5.2, 5.6 |
| my-3d2dge `src/mocap/sets/{quaternius,mesh2motion,cmu}.js`, `src/mocap/catalogs/*` | 325 curated clips, the catalogs, the 2,548-take ledger (`hero.js` is game-specific and stays behind) | Migrate to format 2 | 1.5 |
| shardfall `anim/quaternius.json`, `style100.json`, `catalogs/*`, `cmu/takes.tsv` | QUATERNIUS v2 (102 clips), STYLE100 (98), 100STYLE catalogs, CMU re-cuts | Migrate; keep v1 and v2 as distinct sets | 1.5, 5.3 |
| my-3d2dge `E.MOVES` (25 moves), shardfall `anim/moves.toml` (31), my-3dge `tests/baselines/port/moves.json` | The move model, in three unit systems | Reconcile into one data file with `about` lines; `moves.json` is a frozen fixture (see below) | 6.2 |
| shardfall `crates/pav_tools/src/mocap/` (~7,500 Rust lines), `crates/pav_tools/tests/mocap.rs` and `tests/fixtures/mocap/` | A bit-exact Rust implementation; a tiny rig built in test code; CMU text fixtures | Not ported. It is the first candidate to certify against the vectors; the tiny rig seeds the tier-1 vectors | 0.4, 10.2 |
| my-3dge `tests/baselines/port/core.json` and `moves.json`; `docs/research/C-*.md`, `D-*.md`; PLAN §4.2, §4.3, §8.5, §8.6 | Vectors for the math helpers, RNG and easing, and for the move model, generated from my-3d2dge at `e37e4eed…` (not our pin); studies; the clip-layer and QA designs | Keep `core.json` and `moves.json` as **frozen** fixtures, verified by their SHA-256 and never regenerated. Drop the `humanoid-*`, `blob` and `color` vectors: they test the chibi rig, which we don't carry. Harvest the designs | 0.4, 2.1, 6.2 |
| my-3d2dge-2 `src/agent/registry.ts`, `tools/mcp-server.mjs`, `tools/agent-cli.mjs` | One typed registry exposed to the console, a CLI and an MCP server with no dependencies | Port the pattern | 7.1 |
| my-3d2dge-2 `src/content/skills.ts`, `src/sim/actions.ts` | The skill timeline: normalized events, motion windows, cancel windows | Harvest for events and graphs | 2.2, 6.4 |
| riftlight `scripts/{png,film,gif,inspect}.ts`, `src/engine/animation/metrics.ts` | A PNG writer with no dependencies, filmstrips of the real game (`film.ts` steps the engine 1/60 s at a time in headless Chromium and captures the game's own renderer; only the strip layout is drawn in software), clip metrics (`analyzeClip`, which flags sliding against clip speed) | Harvest | 3.1–3.3 |
| riftlight `docs/ANIMATION.md` (gait `:234-244`, metrics `:69-79`), `src/riftlight/monsters/anim/poser.ts` | A gait generator with "zero foot slide by construction", foot placement with a lock mode, and a semantic `Poser` that animates any generated body from one template | Harvest | 2.5, 6.2, D.1 |
| riftlight `docs/ENGINE.md:1493-1518` | A six-step template for agent tools: pure core, a CLI with a header manual and `--json`, PNG, JSON, a lab handle, a smoke test | Harvest | 7.1 |
| shardfall `crates/pav_core/src/clips.rs:496-550`, `crates/pav_tools/src/anim_tools.rs:749-820`, `docs/ANIMATION_STUDIO.md:185-189` | A clip tool that returns legend, text, fit, strike time and license; edits that carry `revision` and `if_revision` | Harvest | 7.2 |
| my-3d2dge `tools/cross-engine-math.cjs` | Runs the same math in V8 and JavaScriptCore (through Bun, which is installed in the container) and compares the bits | Port | 2.1 |
| my-3d2dge `tools/filmstrip.mjs`, `anim-sheet.mjs`, `mocap-test.mjs` (46 coded failure conditions), `doctrine-check.mjs` | Seeded filmstrips with pixel diffs, contact sheets, clip QA, doctrine checks | Harvest | 0.3, 3.2, 5.8 |
| my-3d2dge engine `PORTABLE_MATH` (`engine/my-3d2dge.js:4677`), `docs/DECISIONS.md` D15 | fdlibm-based portable math. `sin`, `cos`, `atan`, `atan2`, `exp` and `log` match Chromium's bits exactly; the others are within a few units in the last place; parity between V8 and JavaScriptCore is proven | Port | 2.1 |

**Never carried over:**
- the pixel-art drawing;
- the chibi Humanoid and its weapons;
- Emberdeep's and Depthward's game systems;
- 12 fps, 8-direction sprite stepping (at most a render option);
- per-game sets (HERO).

---

## 5. Architecture and the contracts

### 5.1 Layers, packages and import rules

```
spec/              MOTION.md, SKELETON.md, RECIPE.md, GRAPH.md, schemas/, vectors/, conformance/
packages/core      @m3a/core     format codec, profiles, sampler, pose ops, solver, contacts,
                                 recipes, graphs, sources                          (imports nothing)
packages/sensors   @m3a/sensors  metrics, describe, lint and fix, software raster,
                                 sheets, films, diffs                              (core)
packages/io        @m3a/io       glTF/GLB, VRMA, BVH, ASF/AMC readers and writers  (core)
packages/library   @m3a/library  loader, search, facts, license tiers, dedup       (core)
packages/three     @m3a/three    three.js binding, playback, baking, capture       (core; three as a peer)
packages/tools     @m3a/tools    the tool registry, the m3a CLI, the MCP server    (all of the above)
library/           sets/<SET>/{_set.json, catalog.tsv, <Clip>.json}, LICENSES/, local/ (git-ignored except README.md)
apps/gallery       the ground station (Vite + three.js)
apps/lab           labs and demos (the lab tier)
bench/             briefs, starters, graders, the runner, results
services/intake    the intake queue's Supabase schema, policies and submit function (§5.9)
tools/             repo tooling: checks, pins, vectors, version, gates
```

The rules, checked by `npm run doctrine`:
- Core imports nothing outside itself: no DOM, no `node:` modules, no three. It has no Node entry.
- Every other package may have a Node entry (`@m3a/<package>/node`) that alone imports Node built-ins (`node:fs`,
  `node:zlib`, `node:path`). Its main entry stays runnable in a browser.
- Apps and the benchmark import packages only through their public entry points.
- Nothing imports from `apps/`.
- Only `@m3a/tools` imports `@supabase/supabase-js`, and only behind the `IntakeStore` interface (§5.9).
- Clip files under `library/sets/` are written only through the canonical serializer: core's `serialize` (WP-1.3), and
  from WP-5.1 on, `@m3a/library`'s writer, which wraps it. Never by hand-rolled code.

### 5.2 How motion flows

```
sources: GLB, BVH, ASF/AMC, VRMA, the library, recipes, procedural, generative (socket)
   └─▶ @m3a/io or a source ─▶ a format-2 clip (text + provenance) ─▶ validator ─▶ sensors ─▶ library (gates)

game:  graph (L3) ─▶ Animator.step(dt) ─▶ events, root motion, hashed state
                         └─▶ Animator.pose() ─▶ solver (any humanoid skeleton)
                                 └─▶ adapter: three.js bones, a baked AnimationClip, glTF or VRMA export
```

### 5.3 The motion format (the contract; WP-1.1 writes the full spec)

- **The stored form** is readable key poses, extended as **format 2.0**. It keeps format 1's design:
  - the legend, with three short lines per key;
  - whole numbers;
  - limbs as a direction plus a bend and a twist;
  - independence from body size;
  - mirroring.
- **The container** is one clip per file, `library/sets/<SET>/<Clip>.json`, in plain JSON with no comments and no JS
  wrapper. Keys are in a stable order and numbers are formatted per the spec. Ids are `SET/Clip`, with names slugged
  and the display name kept.
- **Each clip** has `format`, `id`, `name`, `dur`, `loop`, `fps`, `tags`, `desc`, `skeleton`, `restSrc` and `keys`,
  plus:
  - `contacts`: intervals per end effector (`footL`, `footR`, `handL`, `handR`), labelled or detected;
  - `events`: `[{ "t", "name", ... }]`, such as `hit`, `step`, `release`, `land`, or custom ones;
  - `facts`: measured values written by tools and marked as measured (speed, travel, strike time, height range, loop
    seam);
  - `provenance`: `src`, `orig`, `take`, `method`, `producer` (tool, version, model), `license` (SPDX), `credit`, and
    `ai` (an IPTC digital source type). `src` names only where the motion came from. The clip's `restSrc` names the
    `sources` entry whose spine and neck shares the keys decode on (format 1 rebuilds every clip on the rest body of
    the set's first source and takes only those shares from the clip's `src`), so a clip keyed or generated on a
    library's body is never credited to that library. Migrated clips get `restSrc` equal to `src`;
  - `quality`: `fit` as [mean, worst] mm, the QA verdict and the QA version;
  - `review`: state, who, date, and a hash of the motion reviewed (`dur`, `loop`, `fps`, `skeleton`, `restSrc`,
    `keys`, the optional degrees of freedom, `contacts`, `events` and any field listed in `requires`). An approval
    whose hash no longer matches the clip reads as stale.
- **New degrees of freedom** are named optional fields: wrist bend and forearm roll per hand, finger curls, a spine
  curl beyond the per-library shares, and root yaw and trajectory for every clip that travels. Readers ignore unknown
  fields; the linter flags them.
- **Units:** lengths in percent of standing hip height (whole numbers in keys), angles in whole degrees, times in
  seconds to the millisecond. Facts may use decimals.
- **In-betweening** is linear per stored number. Loops wrap and one-shots hold, as in format 1, with format 1's
  continuity rules (the carried twist reference and the choice between two Euler readings). Optional tangents may come
  later as a minor version, but only if the fitter shows fewer keys at the same error.
- **The legend** versions with the schema.
  - Every clip names its legend version.
  - `_set.json` carries the legend text.
  - Tools that show a clip (`m3a show`) print the legend with it, so a model never reads numbers without their key.
- **Versioning:** `format` is `"2.0"` and validated on read. A minor version only adds named optional fields, and
  fixed-length arrays never grow. Anything else is a major version that comes with a migrator. A clip that uses a field
  added after 2.0 that changes how the clip plays (tangents, say) names that field in its optional `requires` list,
  which every reader checks from 2.0 on. A reader that doesn't know a field listed there refuses the clip with a coded
  error instead of playing it differently.
- **Each set (`_set.json`)** has:
  - `set`;
  - `content`: the source edition, the importer revision and a SHA-256 of the clip files;
  - `sources`: label, origin, license, url, the measured rest body and the spine shares;
  - `credit`;
  - the legend version;
  - `tier`: one of `cc0`, `cc-by`, `cmu` or `local`.
- **The catalog (`catalog.tsv`)** has one row per clip, at most 40 tokens:
  `id | seconds | loop | speed | tags | what the body does | source`.

### 5.4 The skeleton profile (the contract; WP-1.4)

- **Canonical bone names** come from VRM 1.0's humanoid (hips, spine, chest, upperChest, neck, head, shoulders, upper
  and lower arms, hands, upper and lower legs, feet, toes, fingers, eyes, jaw). Of its 55 bones, 15 are required.
- **The format's body points** are defined on these bones. The solver needs only the 15 required ones and uses the
  optional ones when present.
- **Mapping tables** cover:
  - VRM (read from the glTF extension);
  - Mixamo (`mixamorig:*`);
  - Unreal UE4/UE5 (`pelvis`, `spine_01`, `upperarm_l`);
  - Rigify (`DEF-*`);
  - CMU ASF and 100STYLE BVH;
  - Unity `HumanBodyBones`;
  - Quaternius/Godot exports.

  Topology and geometry are the fallbacks.
- **The rest pose:** forward and right are measured (heels to toes, left thigh to right), and T, A and relaxed rests
  are normalized.
- **Watch** Khronos's `KHR_character_skeleton_mapping` and `KHR_character_reference_pose`, which were heading for
  Release Candidate in July 2026. Align with them once they are ratified.

### 5.5 The runtime contract

- **`Animator.step(dt)`** runs a fixed-step accumulator, advances graph and layer state, emits events in order and
  returns root motion. Everything it touches is hashable (`Animator.hash()`). The step size is an option, so a host
  with its own fixed loop (my-3dge's 60 Hz tick) advances it one tick at a time.
- **Save and restore.** `Animator.save()` returns plain JSON data (no class instances or typed arrays). It names each
  clip it plays by its id and a hash of its content, because an id alone survives an edit. `restore(data)` continues
  exactly: the same hashes, and no event fired twice.
- **`Animator.pose(out)`** evaluates the layers and solves onto the bound skeleton. It is presentation only: it may be
  skipped or run at lower detail (LOD), and it never feeds back into `step`.
- **Gameplay poses.** A host that hit-tests against limbs (my-3dge's `preciseHits`, `PLAN.md:944` at its pin) can ask
  for an exact-mode pose of a given animator. It runs at full detail with the portable math, whatever the presentation
  skips or LODs, never feeds back into `step`, and gives the same joints, bit for bit, in Node and Chromium.
- **Bake from the parameters, not from points.** The solver computes the target's local rotations from the format's
  numbers each frame. my-3dge's study baked densely from frames derived from decoded points: 0.26 to 0.46 mm mean on
  the reference body, but 0.3 to 1.2% of midpoints were more than 50 mm off, mostly at singular poses. Key-for-key
  baking reached 0.73 m worst. Baking from the parameters should remove the singular-pose outliers; WP-2.4 and WP-4.4
  measure it (my-3dge `docs/research/D-mocap-library.md:490-514`).
- **Exact mode:** hashed paths use portable math (fdlibm's algorithms, JavaScript's rounding), so Node and Chromium
  agree bit for bit.

### 5.6 The tool registry and the output contract

- **One definition, four surfaces.** `defineTool({ name, description, params (JSON Schema), examples, run })` becomes
  the TypeScript API, `m3a <tool>` on the CLI, an MCP tool and a console handle. Every example runs in tests.
- **Output.**
  - The verdict comes first, in 20 lines or fewer, with details on request.
  - `--json` writes a `report.json` with a fixed schema.
  - Exit codes: 0 for ok, 1 for findings, 2 for a usage error.
  - An unknown flag or argument is an error that names the closest valid one.
  - Every reply carries a `next` hint.
- **Images** go to `check-output/` and are returned as paths (CLI) or as image content (MCP). Each states its size and
  approximate token cost.
- **Edits** take `revision` and `if_revision`, report conflicts, and can be undone. They also take an optional
  `request_id`: a retry with the same id and arguments returns the first result instead of applying the edit twice,
  and the same id with different arguments is an error.

### 5.7 Rendering for the sensors

- **Sensor images are drawn by a software rasterizer in Node:** capsules on the solved joints, in orthographic views
  (front, side, top, three-quarter), with labels, written as PNG. The pixels are deterministic and every image gets a
  non-blank check.
- **The browser is only for checking adapters:** Playwright on WebGL 2 (SwiftShader), reading frames back with
  `preserveDrawingBuffer`. The proof hash of the bone transforms must equal Node's. Headless Linux can't screenshot
  WebGPU canvases, so no WebGPU screenshots.

### 5.8 Dependencies and versions

- **Platform:** Node 24, npm workspaces, TypeScript (strict, with project references), Vitest and ESLint.
- **Browser:** Playwright with the preinstalled Chromium. `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` holds build 1194.
  If the pinned Playwright expects another build, launch with `executablePath` (the container's notes name
  `/opt/pw-browsers/chromium`). The SessionStart hook exports `CHROMIUM_PATH` to match. Never run `playwright install`.
- **three.js:** pinned per D7. VRM tests use `@pixiv/three-vrm` and `@pixiv/three-vrm-animation`.
- **No runtime dependencies** in core, sensors (apart from Node built-ins in its Node entry), io or library.
- **Upgrades** are commits of their own.
- **The intake client:** `@m3a/tools` may depend on `@supabase/supabase-js`, pinned (§5.9).
- **The cloud container** has 4 cores, 15 GB of RAM, no GPU, Rust 1.97 and Python 3.13.

### 5.9 The intake queue (the contract; WP-8.2 and WP-9.1)

- **One door.** New clips, and improvements to library clips, come in through one queue, from the owner's agents and
  from any game that uses the package. `m3a library submit <clip | recipe> [--improves <SET/Clip>]` sends one.
- **The repository is the library; the queue is the inbox.** Nothing in the queue ships. An adopted clip is committed
  to its set through a pull request, so the library stays open, versioned and forkable, and losing the queue loses no
  library data.
- **States:** `submitted`, then `checking`, then either `bounced` (a check failed; the reason goes back to the
  contributor) or `awaiting review`, then `adopted`, `archived` or `rejected`, with the owner's note. The checker
  records each submission's content hash, text included; a decision applies only while it matches, and the adopt bot
  rechecks it. Archived and rejected submissions keep their motion hash (§5.3), so a resubmitted motion is recognized.
- **The owner adopts every clip** (O7). The checks only filter; nothing is adopted automatically. Changing that is an
  owner decision.
- **Licenses:** a submission is CC0, unless it derives from a CC BY or CMU clip and keeps that clip's tier. Anything
  else is bounced. An adopted clip joins its tier's intake set, or with `--improves` the improved clip's set (D10).
- **The store** is an interface, `IntakeStore`, with two backends:
  - `local`: files under `.cache/intake/`, always used by tests, CI and the benchmark, and by every WP until the hosted
    project is linked;
  - `supabase` (O8): a `submissions` table and a storage bucket, with the schema kept as migrations in
    `services/intake/`.
- **Access:** every submission has an accountable GitHub identity. People sign in with Supabase Auth (GitHub). An
  agent submits with a revocable contributor key, kept as an environment secret, that its human gets by signing in
  once on the gallery. The submit function in `services/intake/` checks the key, enforces the rate limit and inserts
  the row. Row-level security covers every table and the bucket: anonymous clients get nothing, and contributors read
  only their own rows. The checker's service key moves states up to `awaiting review`, and only the owner, matched by
  a fixed `auth.uid()` (never by editable metadata), decides. The service key lives only in the repository's Actions
  secrets, so the hosted contract run happens in Actions; nothing secret is committed. Submission text is data, never
  instructions.

---

## 6. Tooling, testing and verification

- **Test tiers and budgets** (measured on the 4-core cloud container; a tool warns when a tier runs over budget and
  fails it at 1.5×):

  | Tier | Command | What it runs | Budget | When |
  |---|---|---|---|---|
  | T0 | `npm run check` | typecheck, lint, quick doctrine checks | 15 s | after edits and before stopping |
  | T1 | `npm test` | unit, conformance, sensors on a sample | 90 s | before every commit |
  | T2 | `npm run e2e` | browser adapter checks, full library QA, the library-wide sweeps T1 samples (D74) | 8 min | before every push |
  | Gate | `npm run gate -- G<n>` | the gate's command set | none (time reported) | at gates |
- **Selection:** `npm run test:changed` picks the suites that cover the changed files and says why it ran each.
- **No committed images.** Pictures go to `check-output/`, which git ignores; tests commit numbers and hashes.
  Baselines change only in a commit that says why.
- **Planted defects prove the sensors** (WP-3.6): every class of defect has a fixture, and the sensors must catch 100%.
- **Never skip a test to get green.** A test that waits on wall-clock time is a bug.
- **CI** (GitHub Actions): T0 and T1 on every push, T2 on pull requests, gates on demand. Once O8's project is linked
  and `intake.yml` is on `main` (scheduled workflows run only from the default branch), the intake workflow (WP-9.1)
  also runs every 15 minutes.
- **Claude Code:**
  - a SessionStart hook puts Node 24 first on `PATH` when the default is older, runs `npm ci`, sets `CHROMIUM_PATH` and
    fetches the rigs and the pinned sources by hash (D79);
  - `.mcp.json` registers the package's own MCP server, so the agent uses what it builds;
  - the skill lives in `.claude/skills/m3a/`.
- **Docs drift:** generated docs (`docs/LIBRARY.md`, the manual's tool list) are rewritten by tools and checked.

---

## 7. The benchmark

The North Star measure. Each brief (`bench/briefs/B<n>.md`) comes with a starter project (a three.js scene and a
character), a grader, and a pass rule graded headless.

| Brief | Job | Pass rule |
|---|---|---|
| B1 Locomotion | find, fit, wire | Idle, walk and run switch by speed under scripted input; foot sliding stays under threshold during contacts; no NaN; a sheet is produced |
| B2 Attack with hit timing | wire | Damage is applied once per punch, from two frames before to four after its strike as played (the punching hand's last forward-speed peak before its full reach; a cross-fade moves it a frame or two from the clip's measured strike, D77) |
| B3 Reactions | wire, make | Light hits play on the upper body only while walking; heavy hits knock down and the character gets up after 1 s; ground contact holds |
| B4 Retarget onto a VRM avatar | fit, check | A sneak loop on an avatar of different proportions; sensors green |
| B5 Compose an emote | make | A two-handed wave with a hop, 1.5 s, looping; validator and sensors green; `describe` reports the hop |
| B6 Edit a punch | make | 30% faster, more anticipation, mirrored for the left hand; facts and the mirror check confirm it |
| B7 Locomotion graph | wire | Idle, walk, run and jump; jump only when grounded; land on contact; the sim trace matches |
| B8 Contribute | grow | The emote reaches the review queue through `m3a library submit`, with every check green |

- **The runner** (`npm run bench -- B1 --trials 5`) gives each brief to a fresh agent.
  - **The workspace:** a scratch directory outside the repository (`/tmp/m3a-bench/<trial>/`). It holds only the
    packed tarballs (`npm pack` of each package), the brief, the starter and the manual inside the installed package.
  - **Isolation level 1:** the `claude` CLI (installed in the container) in print mode (`claude -p`), started in that
    directory with tools limited to it, and, where the machine allows the namespaces, a `/tmp`, `/var/tmp` and
    `/dev/shm` of its own with every checkout of the repository hidden (D84, D91), as an unprivileged user with no
    capabilities (D94), so agents run at once never meet and can't read `/root`, the raw disks or the checkouts. It runs
    on the session's own Claude Code credentials (in a cloud session the CLI reads them from `/home/claude/.claude/
    remote/`, handed to the agent's user as a copy in its namespace, D94); check them with a one-line call first.
  - **Isolation level 2:** a fresh remote session with no repository attached, when the session can create one.
  - **Isolation level 3:** an in-session subagent confined by instruction, its transcript audited for reads outside the
    workspace.
  - Each trial records its isolation level, pass or fail, wall time, tokens, iterations, and every file read outside
    the manual and the starter.
  - **Discovery trials:** B1 also runs in a second starter, an ordinary three.js game project with the packages
    installed as dependencies and a brief (`bench/briefs/B1-discovery.md`) that never names them. Once WP-7.3 has made
    the skill, the runner copies it into the workspace too. Each trial records whether the agent found and used the
    package. They are reported at G4 and G7, but they do not gate and do not count toward B1's pass mark.
- **Held-out variants:** at each gate, a fresh subagent that has not read the manual's examples writes one variant of
  every brief the gate grades. It keeps the job, the pass rule and the grader, and changes the wording and the starter
  character, using one that no grader test and no earlier gate run used: a generator seed outside WP-4.2's test set, or
  a real CC0 rig from a source not in WP-4.2's list, recorded by URL, license and SHA-256 and fetched as G4's held-out
  rig is (never committed, D9). The gate fixes the commit under test before the variants are written. Before the trials,
  the brief's known-good solution must pass on each variant; if it fails, the gate reports a package or grader failure
  instead of running trials. Every run of a gate, reruns included, writes fresh variants into
  `bench/results/heldout/<gate>/run-<n>/`, where they stay as a record.
- **Briefs are built in three places:** B1 in WP-4.7, B2 to B7 in WP-6.6, B8 in WP-9.1.
- **Starters use the default CC0 pack.** A brief that needs another tier says so, and opting in is part of its job.
- **B8 runs on the local backend** in its workspace. Its grader runs the checker there, and agents read bounce reasons
  with `m3a library status` (WP-9.1).
- **Results** go in `bench/results/<date>-<model>-<briefs>.json`, with `-fake` and `-variant` as the run was and `-2`,
  `-3`... for later runs that day (D54); a gate's are kept in `bench/results/gates/<gate>-run-<n>/` and summarized in
  its ledger row. By default the
  benchmark runs on the Claude models the session can reach. Other vendors' models need their keys (decision O10).
- **Pass mark at a gate:** at least 4 of 5 trials per brief, and at least 4 of 5 on its held-out variant.

No rigorous benchmark of frontier LLMs authoring full-body skeletal motion existed as of October 2026. This one is worth
publishing once it is stable (decision O2).

---

## 8. Work rules

### 8.1 The WP template

```markdown
#### WP-n.m Title
- **Owns:** the paths it may create or change (two WPs that can run at once never own the same path)
- **Needs:** the WPs that must be done first
- **Size:** S | M | L
- **Carry:** exact source paths at the pinned commits (if any)
- **Build:** what to make: outcomes, not mechanics
- **Done when:** measurable outcomes
- **Verify:** commands that must exit 0
```

An on-demand WP adds a **Trigger:** line, the measurement that starts it.

### 8.2 Sizes

The limits count new lines, **tests included**:
- S: at most 400;
- M: at most 1,200;
- L: at most 3,000.

The owner's last plan underestimated every reported size by one class because the tests weren't counted. A WP that would
exceed L is split.

### 8.3 The definition of done (every WP)

1. Its Verify commands exit 0, T0 and T1 are green, and T2 is green for anything it touched in a browser.
2. Every Done-when claim is proved by Verify, or marked *(deferred proof: where)*.
3. Every new module has a header comment and every export a doc comment, and generated docs are rewritten.
4. A new kind of data has a schema, a validator rule, and sensors where they apply.
5. Review scales with risk. L WPs and gates get a verifier review: a subagent checks the diff against DOCTRINE.md and the
   Done-when list. Every finding is fixed or answered.
6. Dependency changes land first, in their own commit.
7. Decisions and escalations are logged, and a deviation from the plan edits the WP entries in the same commit.
8. The ledger row (§14) and `docs/PROGRESS.md` are updated: status, commit, version, and a note with the numbers.
9. A package-tier change bumps the version and adds changelog lines; WP-0.2 sets the rule up.
10. A WP that names a new `npm run <script>` creates that script.

### 8.4 Shared files and sequencing

- **Shared files sit outside every WP's Owns.** In single-agent mode any WP may append to them. In ultracode the
  integrator owns them (§11). They are:
  - the export lists in `packages/*/src/index.ts`;
  - `CHANGELOG.md` and the version fields;
  - the e2e suite registry in `tests/e2e/`;
  - `.mcp.json`;
  - `docs/PROGRESS.md` and the ledger.
- **Clip files change in sequence.** The WPs that write clips run one after another, never at once: 1.5, then 5.3 (with
  5.6 feeding it), then 5.4, 5.8, 8.2 and Phase 9. WP-1.5 writes through core's `serialize`; from WP-5.1 on, writes go
  through `@m3a/library`'s writer. After G9, new and improved clips enter only through the adopt bot (WP-9.1), one
  pull request at a time; until the importers' and procedural sets' regenerations go through it too, they land by pull
  request, held to the intake's gates (D113). Review states and on-demand WPs still go through the writer, but never during an open
  adoption.

### 8.5 Gates

A gate is a fixed command set (`npm run gate -- G<n>`) plus a short report. The report gives what passed (with the
numbers), what failed, the links (the demo, the PR) and how long it took. A failed gate is fixed forward. A gate that
fails twice is checked against the kill criteria (§12).

When a gate passes, merge its phase's pull request into `main` and start the next phase on a fresh draft pull request.
`main` then always holds the last gate that passed, which the intake bot and consumers build on. A gate whose only open
items wait on the owner (G8's phone review; G9's hosted run, adoption and sampled approval; G10's confirmation) still
merges, and those items are reported when they come.

---

## 9. Roadmap

### 9.1 Phases at a glance

| Phase | Lane | WPs | Ends with |
|---|---|---|---|
| 0 Foundation | T (tooling) | 0.1–0.5 | G0 |
| 1 The language | S (spec) | 1.1–1.5 | G1: spec 2.0-rc frozen |
| 2 The airframe | C (core) | 2.1–2.6 | G2 |
| 3 The sensors | Q (QA) | 3.1–3.6 | G3 |
| 4 First flight | R (render), B (bench) | 4.1–4.7 | G4 = **M1 First flight** |
| 5 The payload | L (library) | 5.1–5.8 | G5 |
| 6 Composition and behavior | A (authoring) | 6.1–6.6 | G6 |
| 7 The datalink | I (interfaces) | 7.1–7.4 | G7 = **M2 Agents fly it** |
| 8 The ground station | G (gallery) | 8.1–8.3 | G8 |
| 9 The supply chain | L, I | 9.1–9.4 | G9 = **M3 The library grows** |
| 10 Consumers | X (exchange) | 10.1–10.2 | G10 = **M4 The standard in use** |
| On demand | any | D.1–D.12 | their triggers |

### 9.2 Dependency graph

```
0.1 → 0.2 → {0.3, 0.4, 0.5} → G0
G0 → 1.1 → {1.2, 1.4} ; {1.2, 0.4} → 1.3 ; {1.3, 1.4} → 1.5 → G1
G1 → 2.1 → 2.2 → 2.3 ; {2.2, 1.4} → 2.4 ; {2.3, 2.4} → 2.5 ; {2.3, 2.5} → 2.6 → G2
2.4 → 3.1 → 3.2 ; 2.5 → 3.3 → {3.4, 3.6} ; 3.6 → 3.5 ; {3.2, 3.4, 3.5} → G3
G2 → 4.1 → 4.2 → 4.3 → 4.4 → {4.5, 4.6} ; 3.3 → 4.5 ; {4.6, G3} → 4.7 ; {4.5, 4.7} → G4 (M1)
1.5 → 5.1 → {5.2, 5.7} ; 5.2 → 5.6 → 5.3 ; {5.3, 3.3} → 5.4 → 5.5 ; {5.4, G3} → 5.8 ; {5.5, 5.7, 5.8} → G5
{G2, 3.3} → 6.1 → {6.2, 6.3, 6.4} ; 6.4 → 6.5 ; {4.7, 6.5} → 6.6 ; {6.2, 6.3, 6.6} → G6
G4 → 7.1 ; {7.1, 5.5, 5.7, G6} → 7.2a → 7.2b → 7.3 → 7.4 → G7 (M2)
{4.6, 7.2b} → 8.1 → 8.3 ; {8.1, 5.8} → 8.2 ; {8.2, 8.3} → G8
{G5, G7, 8.2} → 9.1 → {9.2, 9.3} → 9.4 → G9 (M3)
G7 → {10.1, 10.2} ; {G5, 10.1, 10.2} → G10 (M4)
```

After G1 the library lane (5.1, 5.2, 5.7) can start. After G2, lanes Q, R, L and A run in parallel (§11). Through search
(5.3 → 5.4 → 5.5), M2 still needs the re-import and the facts; only library QA (5.8) and G5's floors leave its path.
G5 gates M3 (through WP-9.1) and M4 (G10). Clips change in sequence (§8.4), so WP-8.2 waits for 5.8 and WP-9.1 for 8.2.

### 9.3 Gates

- **G0 Foundation:** `npm run check`, `npm test`, `npm run doctrine`, and `npm run vectors -- --check` (the vectors
  regenerate byte for byte).
- **G1 The language:**
  - spec 2.0-rc is frozen (`MOTION.md`, `SKELETON.md`);
  - conformance tiers 1a and 2 pass;
  - every migrated clip validates with zero errors, and its semantic warnings are baselined per clip with reasons (real
    clips trip the rules: a roll's pop, `Zombie_Rise`'s hips at −40%);
  - the legend, with one worked key, is at most 800 tokens, and catalog rows are at most 40.
- **G2 The airframe:**
  - conformance tiers 1a, 2 and 3 pass;
  - the determinism hash is the same in Node and Chromium;
  - the portable math gives identical bits in V8 and in JavaScriptCore (Bun);
  - the property tests are green (mirroring twice is the identity within 0.5 mm; blend endpoints; retime invariants).
- **G3 The sensors:**
  - the sensors run over every migrated clip within the T2 budget;
  - they catch 100% of planted defects, at the right times;
  - the baselines are committed (numbers only).
- **G4 First flight (M1):**
  - on at least 6 skeletons (4 or more generated variants, 2 or more real CC0 rigs from different sources), the idle,
    walk, run, jump and attack set plays with the sensors green;
  - **a headless sweep** (`npm run sweep`, WP-4.5) plays every library clip (about 1,400 since WP-5.3) on those six
    skeletons, and at least 95% pass the sensors (WP-4.5's rule, D80: the skeleton adds no fail finding the clip lacks
    on its own body), with every failure listed and its reason given, and every warn the skeleton adds listed. The gate
    report links the clip-by-skeleton results, and M1 claims only what they show;
  - **a held-out rig:** a real CC0 rig from a source that neither WP-4.2's list nor an earlier run under
    `bench/results/heldout/` used. On each run of G4, reruns included, a fresh subagent chooses one, reads its license,
    records its URL, license and SHA-256 in `bench/results/heldout/G4/run-<n>/rig.json`, and fetches it with
    `npm run fixtures -- fetch --manifest` on that file. It binds with no hand mapping, the idle, walk, run, jump and
    attack set plays on it with the sensors green, and its sweep results are reported separately;
  - sheets are produced headless;
  - B1 and its held-out variant each pass at least 4 of 5 trials with fresh agents;
  - the demo runs in CI's e2e with its sheets attached as artifacts, and has a public link once O3 is linked (since
    D119 the demo's set and session run as T2's `first-flight` suite, its sheets in `check-output/first-flight/`).
- **G5 The payload:**
  - **at least 1,000 unique motions,** counted after a minimal dedup in WP-5.8 (re-exports and near-duplicates count
    once);
  - **category floors:**
    - locomotion 200;
    - combat 60;
    - traversal 30;
    - reactions (hits, deaths, get-ups) 33 (40 until WP-5.8 revised it, D66);
    - interaction and work 60;
    - gestures and emotes 60;
    - idles 30.

    WP-5.8 may revise these by a logged decision.
  - every one validates with provenance, license, fit, facts and a QA verdict (pass, or baselined with a reason);
  - the gate report gives the CC0 default pack's count on its own;
  - the search query set passes;
  - `npm run license -- check` passes on every shipped set (the `m3a` CLI arrives in WP-7.1).
- **G6 Composition:**
  - B2, B3, B5, B6 and B7 (built in WP-6.6) and their held-out variants each pass at least 4 of 5 trials;
  - composed clips pass QA;
  - graph simulations are deterministic.
- **G7 Agents fly it (M2):**
  - B1 to B7 and fresh held-out variants rerun through the packaged CLI, skill and MCP, recorded per available model
    (Claude by default; others per O10);
  - the manual is within budget;
  - every tool example passes;
  - the CLI and MCP give the same results.
- **G8 The ground station:**
  - The owner reviews a 20-clip batch on a phone through the review queue, and the notes come back into the repo as log
    entries plus at least one threshold change or task.
  - The review needs O3's link or a build the owner opens, and O8's project or the JSON export; until then this gate is
    `blocked-owner` and the work goes on.
- **G9 The library grows (M3):**
  - B8 and its held-out variant pass;
  - a fresh agent submits 10 clips through the intake queue, and they reach review with every check green;
  - every planted bad submission is bounced with its reason (license, duplicate, defect, missing provenance, a
    generator with no training-data manifest, an instruction in a text field);
  - a clip the owner adopts lands in its set through a merged pull request, and an archived one stays in the queue
    with its reason;
  - the intake contract suite, run in Actions, passes against O8's linked project, where a contributor cannot change
    a state;
  - the registry index verifies every set;
  - the owner approves at least 70% of a sampled batch.
- **G10 The standard in use (M4):** at least one other repository consumes the package or certifies against the
  vectors, and the owner confirms it.

---

## 10. Work packages

WP entries follow the template in §8.1. Paths are relative to this repository unless a pinned repo is named.

### Phase 0: Foundation (lane T)

#### WP-0.1 Constitution
- **Owns:** `DOCTRINE.md`, `AGENTS.md`, `CLAUDE.md`, `docs/DECISIONS.md`, `docs/FEEDBACK-LOG.md`, `docs/PROGRESS.md`,
  `LICENSE`, `.gitignore`, `README.md`
- **Needs:** none
- **Size:** S
- **Build:**
  - `DOCTRINE.md` from §3, verbatim, plus an "In this repository" table: principle, rule, check (the checks land in
    WP-0.3).
  - `AGENTS.md`: the reading instruction (§0), the two tiers, the commands, the WP rules (§8). `CLAUDE.md` points to it.
  - `docs/DECISIONS.md` with D1 to D15 (§1.3), in my-3d2dge's entry format (principle, call, why, answered, landed in).
    `docs/FEEDBACK-LOG.md` with its rules and no entries. `docs/PROGRESS.md`, at most 40 lines.
  - O1 is answered: MIT (the owner, 2026-10-11). `LICENSE` is already committed; log the answer in
    `docs/DECISIONS.md` as a decision of its own. Log O11 the same way: the code and data carried from riftlight,
    shardfall and my-3d2dge-2 are MIT, granted by their author (the owner, 2026-10-11); third-party clips in them keep
    their per-set licenses (D10). Log too that the owner confirmed, the same day, that WP-1.5 commits the CMU and
    Mesh2Motion sets before WP-5.3's Mesh2Motion audit, as planned (D10, K3).
  - O7 and O8 are answered too (the owner, 2026-10-11): the owner adopts every clip, and submissions and reviews go to
    a Supabase project. Log both.
  - `.gitignore`: `node_modules/`, `.cache/`, `library/local/*` (but not `library/local/README.md`), `check-output/`,
    `dist/`.
  - `README.md`: add a status line saying the plan is being executed, linking `docs/PROGRESS.md`. Keep the kickoff
    prompt as it is.
- **Done when:** the files exist, D1 to D15 are logged, the answers to O1, O7, O8 and O11 are logged, and so is the
  owner's confirmation about the CMU and Mesh2Motion sets.
- **Verify:** `test -f DOCTRINE.md -a -f AGENTS.md -a -f CLAUDE.md -a -f docs/PROGRESS.md && [ "$(grep -c '^## D' docs/DECISIONS.md)" -ge 15 ] && grep -qw 'O1' docs/DECISIONS.md && grep -qw 'O7' docs/DECISIONS.md && grep -qw 'O8' docs/DECISIONS.md && grep -qw 'O11' docs/DECISIONS.md && grep -q 'Mesh2Motion' docs/DECISIONS.md`

#### WP-0.2 Toolchain
- **Owns:** `package.json`, `package-lock.json`, `.npmrc`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`,
  `playwright.config.ts`, `tests/e2e/smoke.e2e.ts`, `packages/*/package.json` and entry stubs, `tools/run/*`,
  `tools/version.ts`, `CHANGELOG.md` (D22)
- **Needs:** 0.1
- **Size:** M
- **Build:**
  - npm workspaces for the packages in §5.1, each with an entry point, a header comment and one smoke test.
  - Strict TypeScript with project references, so T0 stays within 15 s as the repo grows.
  - Scripts:
    - the test tiers: `check`, `test`, `e2e`;
    - `test:changed`: selection from git against `main`, saying why each suite ran;
    - the rest: `gate`, `doctrine`, `vectors`, `pins`, `bench`.
  - Tier budgets from §6 (warn when over, fail at 1.5×), and the output contract of §5.6 for repo tools.
  - One version for every package and the spec. `tools/version.ts X.Y.Z` writes it everywhere and opens a changelog
    section: minor for features, patch for fixes, while major is 0.
  - Playwright on the preinstalled Chromium (§5.8: build 1194 under `/opt/pw-browsers`, or `executablePath`).
  - Later WPs add their own scripts (§8.3, item 10).
- **Done when:** a clean clone runs `npm ci && npm run check && npm test` green within budget, and `npm run e2e` opens a
  page in headless Chromium.
- **Verify:** `npm ci && npm run check && npm test && npm run e2e`

#### WP-0.3 Doctrine checks
- **Owns:** `tools/doctrine/*`
- **Needs:** 0.2
- **Size:** M
- **Carry:** my-3d2dge `tools/doctrine-check.mjs` (148 lines: binaries, budgets, boundary, decisions log).
- **Build:** one command, `npm run doctrine`, that checks:
  - **binaries:** none outside the approved list, which starts empty;
  - **token budgets:** the manual at most 8,000, the legend with one worked key at most 800, catalog rows at most 40,
    `docs/PROGRESS.md` at most 40 lines. Count cl100k tokens with a pinned tokenizer package (for example
    `gpt-tokenizer`) as a dev dependency;
  - **the import boundaries** of §5.1;
  - **banned APIs**, filled in by WP-4.1;
  - **pinned versions and checksums** (`tools/pins.json`);
  - **the decisions log** is append-only against `main`: no entry is removed;
  - **the local lane:** nothing under `library/local/` except its `README.md` is committed, and no shipped set
    references it.
- **Done when:** each check has a failing fixture in its test, and the repo passes.
- **Verify:** `npm run doctrine && npm test -- tools/doctrine`

#### WP-0.4 Pins and reference vectors
- **Owns:** `tools/pins.json`, `tools/pins/*`, `tools/vectors/*`, `spec/vectors/**`, `spec/conformance/tiers.md`,
  `spec/conformance/runner/*`; the approved-binaries entry in `tools/doctrine/binaries.ts` (D24)
- **Needs:** 0.2
- **Size:** M
- **Carry:**
  - from my-3d2dge: `src/mocap/readable.js`, `src/mocap/mocap.js`, `tools/anim-import.mjs`, `tools/asf-amc.mjs`,
    `src/mocap/sets/{quaternius,mesh2motion,cmu}.js`;
  - from shardfall: `crates/pav_tools/tests/mocap.rs` (the tiny rig, a glTF built in test code, `:43-47`) and
    `crates/pav_tools/tests/fixtures/mocap/` (CMU text fixtures);
  - from my-3dge: `tests/baselines/port/core.json` and `moves.json`, frozen (§4).
- **Build:**
  - `tools/pins.json` holds the five repos with full SHAs and their public HTTPS URLs (§4), plus the files used.
    `npm run pins -- fetch` shallow-fetches them by SHA into `.cache/src/`, which git ignores.
  - `npm run vectors` runs the JavaScript originals as oracles and writes text vectors with SHA-256s and a README.
    - **Tier 1a, encode and fit:** the importer's captured body points before `fit`, for the tiny rig and the CMU take,
      plus the oracle's encoded and fitted output. These prove WP-1.3's codec with no readers involved.
    - **Tier 1b, readers:** the raw inputs for the same pair, so WP-5.2 can later prove reader parity.
    - **Tier 2, decode:** every curated clip decoded on its reference body; mirror twice; text round trip.
    - **Tier 3, other bodies:** the inputs, i.e. bodies of other proportions.
  - Copy my-3dge's `core.json` and `moves.json` as frozen fixtures, checked by their SHA-256 and never regenerated
    (they come from another my-3d2dge commit).
  - `spec/conformance/tiers.md` defines tiers 1a, 1b, 2 and 3 with their tolerances. A TypeScript runner reads the
    vectors. WP-10.2 later turns this into a kit for other languages.
- **Done when:**
  - `npm run vectors -- --check` regenerates every committed, non-frozen vector byte for byte;
  - the frozen fixtures match their checksums;
  - the committed vectors total under about 10 MB, and larger ones generate into `.cache/`.
- **Verify:** `npm run pins -- fetch && npm run vectors -- --check`

#### WP-0.5 CI and session setup
- **Owns:** `.github/workflows/*`, `.github/pull_request_template.md`, `.claude/settings.json`, `.claude/hooks/*`
- **Needs:** 0.2
- **Size:** S
- **Build:**
  - CI: T0 and T1 on every push, T2 on pull requests, gates by manual dispatch. Cache npm and `.cache/`.
  - A SessionStart hook that, in cloud sessions, puts the Node `engines` asks for first on `PATH`, runs `npm ci`,
    fetches by hash the real rigs, each gate's held-out rigs and the pinned sources (a failed fetch warns), and exports
    `CHROMIUM_PATH` (D79).
  - A PR template: what changed, Verify output, decisions made without an answer, the version.
- **Done when:** CI is green on the PR, and a fresh clone of the branch passes `npm run check` after only the hook.
- **Verify:**
  - the PR's checks are green, read with `gh pr checks` or the session's GitHub tools;
  - `git clone -b <branch> . /tmp/m3a-fresh && cd /tmp/m3a-fresh && CLAUDE_CODE_REMOTE=true CLAUDE_ENV_FILE=/tmp/m3a-env
    bash .claude/hooks/session-start.sh && . /tmp/m3a-env && npm run check`

**Gate G0** (§9.3).

### Phase 1: The language (lane S)

#### WP-1.1 The motion spec
- **Owns:** `spec/MOTION.md`, `spec/LEGEND.md`
- **Needs:** G0
- **Size:** M
- **Carry:**
  - from my-3d2dge: the legend and the rationale in `docs/MOCAP.md` ("The readable format", "How the format was
    chosen"), and the header of `src/mocap/readable.js`;
  - from my-3dge: the format-2 field ideas in `PLAN.md:3553-3597` (ADR-0010);
  - from shardfall: its additions, `speed`, `title` and `legend`.
- **Build:** §5.3 written out as a full spec.
  - The frame and units, and every field with its range and meaning.
  - The new named optional degrees of freedom, each with the defect it fixes: the hand held straight off the forearm,
    the curled spine, the missing root yaw, fingers.
  - Contacts, events, facts, provenance (with IPTC digital source types), quality and review.
  - In-betweening, quantization and continuity. Limits: at most 4,096 keys, at most 600 s, keys at least 1 ms apart.
  - Keys past `dur`: 52 of the 177 MESH2MOTION clips end with a key 8 to 17 ms after `dur`. Format 1 samples time only
    up to `dur` (it holds there, or wraps for a loop; my-3d2dge `src/mocap/readable.js:265-271`), so that key only
    shapes the last in-between. The spec allows such a key and says how sampling treats it, and tools that copy or edit
    a clip keep it rather than cut it off.
  - Versioning and compatibility rules; ids and slugging; the set manifest and content ids.
  - The conformance tiers with their tolerances, and the known limits. Tiers 1a and 1b are bit for bit, so the spec
    pins the numerics another language must reproduce, as shardfall's Rust port did: f64 operations in the reference's
    order, f32 storage where the reference uses `Float32Array`, fdlibm's trigonometry, V8's `Math.hypot`, JavaScript's
    `Math.round` and `toFixed`. It also pins number formatting (shortest round trip, `-0` kept); see
    `predecessor_adopter_repos.md` §2.2, §6.4 and §7.4.
  - The legend (what a model reads first): at most 800 tokens, worked key included. Format 1's legend alone is 440
    tokens and a key about 137, which leaves about 220 for the new fields. It versions with the schema (§5.3).
- **Done when:**
  - every field that appears in the vectors is specified, and the migrated sets' fields too *(deferred proof: G1, once
    WP-1.5 has run; met there: the migrated library's test finds no M2-W001)*;
  - the legend fits its budget;
  - a fresh subagent given only the legend and one clip answers 10 fixed questions about it, with at least 9 right
    *(deferred proof: WP-4.7 runs this quiz in the benchmark harness; met there, 10 of 10 in 3 trials, D54)*.
- **Verify:** `npm run doctrine`

#### WP-1.2 Schemas and the validator
- **Owns:** `spec/schemas/*.json`, `packages/core/src/validate/*`; it starts `packages/core/src/format/types.ts`,
  which WP-1.3 extends (D25)
- **Needs:** 1.1
- **Size:** M
- **Build:**
  - JSON Schemas for a clip, a set manifest and a catalog row, plus stubs for recipes and graphs (finished in Phase 6).
  - `validate(data, { mode })`, with two modes:
    - `read` accepts unknown fields;
    - `lint` flags them with a "did you mean".
  - Coded messages that name the clip, the key, the time and the field, for example
    `M2-E014 Walk_Loop key 7 (t 0.233) armL[3]: bend 191 is outside 0..180`.
  - **Errors** (structural; they fail a gate):
    - schema violations;
    - NaN;
    - values out of range;
    - key times that don't increase;
    - contacts outside the duration;
    - events out of order;
    - a field listed in `requires` that the reader doesn't know;
    - an unknown major format.
  - **Warnings** (semantic; baselined per clip with a reason):
    - format 1's pop (twist jumping more than 120° while bend is over 140°);
    - hips below the floor;
    - collapsed directions.

    Real clips trip these: the Roll clips pop, `Zombie_Rise` dips to −40%, the swims sit low. So they warn, and tag
    profiles (WP-3.3) refine them later.
- **Done when:**
  - every rule has a passing and a failing fixture;
  - each message is at most 2 lines;
  - every migrated clip passes `read` mode with zero errors *(deferred proof: WP-1.5; met there: 525 clips, 0 errors)*.
- **Verify:** `npm test -- validate`

#### WP-1.3 The codec
- **Owns:** `packages/core/src/format/*`
- **Needs:** 1.2, 0.4
- **Size:** L
- **Carry:** my-3d2dge `src/mocap/readable.js` (338 lines):
  - `text` (`:304`), `parse` (`:311`), `mirror` (`:323`);
  - continuity: `unwrap` (`:104`), the carried twist reference and pole helpers (`:106-123`), the choice between two
    Euler readings in `encodePose` (`:199-203`);
  - `decodePose` (`:235`), `encode` (`:277`);
  - `reduce` (`:140-146`) and `fit` (`:293-302`).

  (`measure`, `:155-187`, belongs to WP-1.4.)
- **Build:**
  - Parse and serialize: stable key order, number formatting per the spec, `-0` handled.
  - The text lens: three short lines per key.
  - Mirror; decode onto a reference body (body points); encode from body points.
  - Fit: Ramer–Douglas–Peucker, then add the worst-missed frame until within budget (30 mm by default), with optional
    per-group budgets.
  - Reading format 1.
- **Done when:**
  - **tier 1a:** from the oracle's captured body points, the tiny rig and the CMU take encode and fit bit for bit like
    the oracle. No readers are needed; reader parity is tier 1b, in WP-5.2;
  - **tier 2:** every curated clip decodes within 0.001 mm of the vectors;
  - the text round trip and mirroring twice are exact, or within 0.5 mm where the spec allows.
- **Verify:** `npm test -- conformance/tier1a conformance/tier2`

#### WP-1.4 The skeleton profile
- **Owns:** `spec/SKELETON.md`, `packages/core/src/skeleton/*`
- **Needs:** 1.1
- **Size:** M
- **Carry:**
  - from my-3d2dge:
    - the RIGS table in `tools/anim-import.mjs`;
    - `measure` in `src/mocap/readable.js:155-187` (the rest body and the per-library spine shares);
    - the CMU skeleton reader in `tools/asf-amc.mjs`;
  - from my-3d2dge-2: `src/render/retarget.ts` (rest-pose deltas for rigs with the same bone names).
- **Build:**
  - The canonical humanoid: VRM 1.0 bone names, 15 required, with the body points defined on bones.
  - Rest measurement: forward from heels to toes, right from the left thigh to the right; T, A and relaxed rests.
  - Per-library spine shares.
  - The mapping tables of §5.4.
  - `recognize(skeleton)` returns a mapping, a confidence, the missing bones and the issues, as a JSON file the agent
    can patch.
- **Done when:**
  - recognition is exact on a fixture for every table (prefixes and case stripped);
  - the topology fallback maps a renamed skeleton and reports its confidence;
  - `SKELETON.md` records the Khronos watch.
- **Verify:** `npm test -- skeleton`

#### WP-1.5 Migrate the seed sets to format 2
- **Owns:** `library/sets/**`, `tools/migrate/**`
- **Needs:** 1.3, 1.4
- **Size:** M
- **Carry:**
  - from my-3d2dge: `src/mocap/sets/{quaternius,mesh2motion,cmu}.js` and `src/mocap/catalogs/*`. These are the source
    for MESH2MOTION and CMU; shardfall's copies are bit-identical;
  - from shardfall: `anim/quaternius.json` (102 clips) and `anim/style100.json` (98), with `anim/catalogs/*`.
- **Build:**
  - A migrator from format 1 (my-3d2dge's JS wrappers and shardfall's JSON) to format 2: one clip per file, written
    through core's canonical `serialize` (WP-1.3), with a `_set.json` (content ids, producer records) and a
    `catalog.tsv`.
  - Distinct names for distinct content, named for the import they come from:
    - `QUATERNIUS_3D2DGE`: my-3d2dge's 88 clips (46 from UAL1, including its T-pose, and 42 from UAL2);
    - `QUATERNIUS_SHARDFALL`: shardfall's 102 clips from the UAL v2 Unreal-rig export, with their `_RM` twins;
    - `MESH2MOTION` (177), tier `cc0` pending the audit in WP-5.3 (audited CC0, D63). Any asset reported as CC BY-SA goes to `local`
      until audited;
    - `CMU_CURATED` (60), tier `cmu`. Its source record carries CMU's full notice; the origin's omits the no-resale
      clause;
    - `STYLE100` (98), tier `cc-by`.
  - WP-5.3 was to replace the two QUATERNIUS sets with `QUATERNIUS_UAL1` and `QUATERNIUS_UAL2`, re-imported from the
    source editions; they stay as migrated (D63, D81).
  - The game-specific HERO set is not migrated.
- **Done when:**
  - every migrated clip validates with zero errors, its warnings baselined with reasons, and decodes like its source
    within 0.001 mm;
  - set content ids are the same on every run;
  - the catalogs fit their budget.
- **Verify:** `npm run migrate -- --check && npm test -- library/migrated`

**Gate G1.**

### Phase 2: The airframe (lane C)

#### WP-2.1 Math kernel and determinism
- **Owns:** `packages/core/src/math/*`
- **Needs:** G1
- **Size:** M
- **Carry:**
  - from my-3d2dge: `PORTABLE_MATH` (`engine/my-3d2dge.js:4677-4905`), built on fdlibm 5.3's algorithms; its decision
    record (`docs/DECISIONS.md` D15); and `tools/cross-engine-math.cjs` (V8 against JavaScriptCore through Bun);
  - from my-3dge: `tests/baselines/port/core.json`, frozen vectors for the helpers, the RNG and easing;
  - from shardfall: its use of the `libm` crate, as the cross-language precedent.
- **Build:**
  - Vectors, quaternions, matrices and angle helpers.
  - Portable `sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`, `pow`, `hypot` and `cbrt`, built from
    `+ - * /` and `sqrt`.
  - An exact mode that the hashed paths use.
  - A seeded RNG with separate streams.
  - `hashNumbers()` for state hashes.
- **Done when:**
  - on 200,000 random inputs each, `sin`, `cos`, `atan`, `atan2`, `exp` and `log` give native V8's bits exactly. The
    others stay within the stated number of units in the last place. That is what my-3d2dge's D15 proved;
  - the portable math gives identical bits in V8 and in JavaScriptCore. Node and Chromium are both V8, so a parity test
    between them can't catch a failure; Bun runs JavaScriptCore;
  - the helpers match `core.json`;
  - their cost is measured and stated.
- **Verify:** `npm test -- math && npm run test:cross-engine` (Bun is installed in the container)
- **Landed with (D33):** the codec, the skeleton profile and the validator call the portable math too, and lint bars the
  host's transcendental `Math` in core; `pow` is within one unit of the native, which V8 takes from the C library.

#### WP-2.2 Sampler, events, contacts and facts
- **Owns:** `packages/core/src/clip/*`, `packages/core/fixtures/facts-truth.json`
- **Needs:** 2.1
- **Size:** M
- **Carry:**
  - from my-3d2dge: `src/mocap/mocap.js` (`sample`, `moveAt`, `blend`);
  - from my-3d2dge-2: `src/content/skills.ts` (normalized events, motion windows).
- **Ground truth:** `facts-truth.json` holds 20 clips whose expected facts come from sources independent of the code
  under test:
  - the travel of a `_RM` twin set against its in-place clip;
  - the loop flags in the catalogs;
  - strike times from shardfall's measured `strike` or the origin's `hitAt`;
  - the hip heights recorded at import.
- **Build:**
  - `sample(clip, t)`: linear per number, loops wrap, one-shots hold, with continuity.
  - `rootDelta(clip, t0, t1)`.
  - `events(clip, t0, t1)`: in order, and loop-aware.
  - `contactsAt(clip, t)`.
  - `measureFacts(clip)`:
    - duration and loop seam;
    - speed and travel;
    - height range;
    - strike times, from the velocity and extension peaks of the hands and feet;
    - contact intervals, detected with hysteresis when they aren't labelled.
- **Done when:**
  - samples match the vectors' decoded poses exactly at key times, and within 0.001 mm between keys;
  - an event on a loop boundary fires once;
  - a root yaw that turns through 90°, 360° and 720° samples with no jump at ±180°, and `rootDelta` across a loop seam
    carries the turn;
  - facts on the 20 clips in `facts-truth.json` are within the stated tolerances.
- **Verify:** `npm test -- clip`

#### WP-2.3 Pose operations
- **Owns:** `packages/core/src/ops/*`
- **Needs:** 2.2
- **Size:** M
- **Build:**
  - Blend, keeping angles continuous.
  - Additive pose deltas.
  - Masks by named group (`upper`, `lower`, `armL`, `armR`, `legs`, `head`, `spine`), with feathering.
  - Mirror.
  - Retime: by speed, to a target duration, or along an ease curve.
  - Slice and loop.
  - Time-warp sync by contact phase, so a walk and a run blend without foot sliding.
- **Done when:** the property tests hold:
  - mirroring twice is the identity;
  - a blend at 0 or 1 gives its inputs;
  - retiming keeps the event order and the contact proportions;
  - synced walk–run blends keep contacts within 20 mm.
- **Verify:** `npm test -- ops`

#### WP-2.4 The solver
- **Owns:** `packages/core/src/solve/*`
- **Needs:** 2.2, 1.4
- **Size:** L
- **Carry:** from my-3d2dge:
  - `src/mocap/mocap.js:165-262` (`Mocap.drive`: directions at the rig's own lengths, two-bone IK, heading from the
    chest, tilt frames, the sole on the floor);
  - `E.ik3` (`engine/my-3d2dge.js:131-143`);
  - the pole helpers in `readable.js:112-123`.
- **Build:** `solve(pose, bound)` returns local rotations for a bound skeleton, canonical or any recognized one,
  computed from the format's parameters:
  - hip height, scaled by the ratio of hip heights;
  - the spine's turn, spread over the target's spine bones;
  - two-bone IK for arms and legs, with the pole from bend and twist;
  - wrists, forearm roll and feet from their fields;
  - head and neck, and fingers when present.

  It handles T, A and relaxed rests, missing optional bones and twist bones.
- **Done when:**
  - **tier 3:** on at least 6 bodies of different proportions, every limb points within 9° of the source (14° on a
    curled spine), bone lengths are unchanged, soles never go below the floor, and there is no NaN;
  - on the reference body, the solved joints are within 1 mm of the decoder's.
- **Verify:** `npm test -- solve conformance/tier3`
- **Landed with (D36):** "the decoder's" is the decode on the target with the hips carrying the lowest spine segment
  (`decodeOn`). No hips bone that also carries the legs can take a share of the chest's turn, so the joints sit up to
  36.5 mm from the plain decoder's on the 124 tier-2 samples with a lower spine share. Bone roll is tested too: mirror,
  bend sweeps, T = A = relaxed, and fingers.

#### WP-2.5 Contacts and ground
- **Owns:** `packages/core/src/contact/*`
- **Needs:** 2.4, 2.3
- **Size:** M
- **Carry:** from riftlight: foot placement with a lock mode, and the zero-slide gait, both in `docs/ANIMATION.md`
  (`:234-244`).
- **Build:**
  - Foot locking during contact intervals: pin the world position, re-solve the leg, and blend in and out over a few
    frames.
  - The sole, not the ankle, on the ground.
  - Slopes and steps, through a ground-probe callback.
  - Hand contacts (a ledge, a prop, another character's shoulder) as weighted targets.
- **Done when:**
  - on the migrated locomotion clips and synced blends, a planted foot slides at most 10 mm per contact (the origin's
    procedural gait slid 12 to 28% of body speed);
  - on a 10° slope and a 0.2 m step, soles stay within 5 mm of the surface.
- **Verify:** `npm test -- contact` (every third loop since D74; `M3A_FULL=1 npm test -- contact`, or T2, reads them all)

#### WP-2.6 The Animator: step and pose
- **Owns:** `packages/core/src/animator/*`, `packages/core/src/index.ts`
- **Needs:** 2.3, 2.5
- **Size:** M
- **Build:**
  - `new Animator(bound, options)`, with layers (clip, weight, mask, additive, speed).
  - `step(dt)`: a fixed-step accumulator with the step size as an option; events in order; root motion; hashable
    state (`hash()`).
  - `save()` and `restore(data)` (§5.5).
  - `pose(out)`: evaluate and solve. It may be skipped or run at lower detail, and never feeds back into `step`.
  - `pose(out, { exact: true })` for gameplay hit tests (§5.5): full detail, portable math.
  - A small public API, with every export listed in one file and checked by the boundary check.
- **Done when:**
  - the same script of steps gives the same hash in Node and headless Chromium;
  - skipping `pose()` doesn't change the hashes;
  - an exact-mode pose gives the same joint positions, bit for bit, in Node and headless Chromium, whether or not
    presentation poses were skipped or LOD'd before it;
  - saving at any step and restoring into a new Animator gives the same later hashes and events as running straight
    through. The saved data survives a JSON round trip, and restoring with a clip whose content differs fails with a
    coded error that names the clip;
  - the cost of one character's `step()` and `pose()` is measured on the 4-core cloud container and stated;
  - the public API is at most 40 exports, each with a doc comment.
- **Verify:** `npm test -- animator && npm run e2e -- animator-parity`
- **Landed with (D38):**
  - "Exports" counts the names `src/index.ts` lists: 38. Each module's whole surface sits behind one of them as a
    namespace (145 runtime names through 9 namespaces).
  - The boundary check enforces it: one export per statement, each with a doc comment, no bare `export *`.
  - D71 raised the cap to 44 for Phase 6's namespaces (procedural sources, actions, graphs), one name each.
  - Outside the Owns: the boundary check, the tools and conformance tests moved onto the namespaces, core's test
    barrel, and the Animator's run in `test:cross-engine`.

**Gate G2.**

### Phase 3: The sensors (lane Q)

#### WP-3.1 The software raster
- **Owns:** `packages/sensors/src/raster/*`
- **Needs:** 2.4
- **Size:** M
- **Carry:**
  - from riftlight: `scripts/png.ts`, a PNG writer with no dependencies;
  - from my-3d2dge: `Mocap.Mannequin` (capsules sorted by depth).
- **Build:**
  - A capsule mannequin drawn on the solved joints, with a nose to show facing and the left side tinted to show sides.
  - Orthographic views (front, side, top, three-quarter) and a turntable.
  - A small bitmap font for labels.
  - PNG output through `node:zlib` in the Node entry.
  - A non-blank check, and deterministic pixels.
- **Done when:**
  - the same input gives the same bytes in two runs and in two processes;
  - a 1,000 × 1,000 image renders in at most 50 ms;
  - left and right are told apart at a glance.
- **Verify:** `npm test -- raster`

#### WP-3.2 Sheets, films and diffs
- **Owns:** `packages/sensors/src/sheet/*`
- **Needs:** 3.1
- **Size:** M
- **Carry:** from my-3d2dge: `tools/anim-sheet.mjs` (rows of eight frames), and `tools/filmstrip.mjs`, whose `--compare`
  marks changed pixels.
- **Build:**
  - A contact sheet per clip: N frames with their times, in a chosen view.
  - A filmstrip.
  - Overlays: contacts as foot markers, foot trails, and intervals the metrics flagged, in red.
  - Side-by-side and difference images, between two clips or two builds.
  - Each image reports its size and approximate token cost (about 1,300 tokens for 1,000 × 1,000 on Claude) and stays
    within a stated budget.
- **Done when:** a sheet of a 2 s clip fits in one 1,000 × 1,000 image, a diff of identical inputs is empty, and a
  planted change is marked where it is.
- **Verify:** `npm test -- sheet`

#### WP-3.3 The metrics
- **Owns:** `packages/sensors/src/metrics/*`, `packages/sensors/src/predicates/*`, `tools/qa/*`
- **Needs:** 2.5
- **Size:** L
- **Carry:**
  - from my-3d2dge: `tools/mocap-test.mjs` (fit limits 40/300/20 mm, foot under the floor, round trip) and its pop rule
    (a spike against the steps around it, not raw speed; CHANGELOG 0.8.0);
  - from riftlight: `src/engine/animation/metrics.ts` (`analyzeClip`, which flags sliding against clip speed).
- **Build:** per clip, each finding with its times:
  - **foot sliding** during contacts (mm per contact, and skate in cm/s; contacts measured where the foot stands, D41);
  - **ground penetration;**
  - **self-intersection** of limb capsules (an arm through the torso);
  - **jitter** (sustained back-and-forth on the key grid, D41) and pops;
  - **joint-limit violations:** knees bending backwards, neck over-twist (elbows wait: a format-1 arm's twist has no
    anatomical reference, D41);
  - **bone stretch** after solving;
  - **loop seam:** pose and velocity;
  - **fit** against the source;
  - **symmetry** for mirrored pairs.

  Balance (the centre of mass over the support polygon) waits for WP-D.4.

  **Predicates:** a small assertion language for expected motion, such as `footL planted 0.33–0.60 s, slide < 10 mm`
  or `hit within 1 frame of strike`. Tests, graders and agents write them, and a failed predicate reads as a repair
  instruction. MoVer showed that verifier feedback of this kind lifted correct motion graphics from 58.8% to 93.6%.

  Tag profiles (acrobatics, lying, swimming, sitting) relax the checks that don't apply. `metrics(clip)` returns a
  `report.json` and a verdict of at most 20 lines. `npm run qa` (in `tools/qa/`) runs the sensors over clips and sets.
- **Done when:**
  - every metric and predicate has unit fixtures;
  - the whole migrated library is measured within T2;
  - the first thresholds come from the library's distributions, checked against real capture, each written down with
    its reason, its unit and sample rate, and whether it scales with the skeleton's hip height. Kimodo's paper
    measures 2.21 cm/s of foot skate for capture against 3.87 cm/s for generated motion.
- **Verify:** `npm test -- metrics predicates && npm run qa -- --sample 50`

#### WP-3.4 Describe
- **Owns:** `packages/sensors/src/describe/*`, `packages/sensors/fixtures/describe-truth.json`
- **Needs:** 3.3
- **Size:** M
- **Ground truth:** `describe-truth.json` holds 30 clips whose phases were labelled from their contact sheets and
  catalog lines. A verifier subagent reviews the labels before they are used.
- **Build:** a text timeline built from contacts, the pelvis's height (the centre of mass waits for WP-D.4; D42),
  extremes, events and travel, in the format's own words. For example: "0.00–0.40 s crouches (hips 88%); 0.40–0.55 s airborne; lands on the left foot at 0.58 s; travels
  1.2 hip heights forward". At most 150 tokens by default; `--detail` gives more.
- **Done when:** on the 30 clips in `describe-truth.json` the timeline names the right phases in the right order for at
  least 27, and the output is deterministic.
- **Verify:** `npm test -- describe`

#### WP-3.5 Lint and fix
- **Owns:** `packages/sensors/src/fix/*`
- **Needs:** 3.6
- **Size:** M
- **Carry:** from my-3d2dge: the loop-cycle search and seam spreading in `tools/asf-amc.mjs`.
- **Build:**
  - `fix(clip, ops)`, where every operator returns before-and-after metrics, keeps `dur`, event times and contact
    intervals or reports each one it changes, and changes no clip silently:
    - bake foot locks into keys;
    - lift penetration;
    - close a loop seam, spreading the remainder (pose and speed) over the cycle's ends (D44);
    - filter jitter;
    - repair twist flips;
    - re-fit keys to a budget.
  - `lint(clip)` lists what `fix` would change.
- **Done when:** each operator removes its planted defect (WP-3.6) without pushing any other metric past its threshold,
  and a test shows no operator changes `dur`, an event or a contact without reporting it. Over the whole library, no
  fixed clip comes out worse or invalid (`npm run qa -- --fix`, in G3's command set; D44).
- **Verify:** `npm test -- fix`

#### WP-3.6 Planted defects
- **Owns:** `packages/sensors/fixtures/planted/*`, `tools/plant/*`
- **Needs:** 3.3
- **Size:** S
- **Build:** a generator that plants known defects into clean clips, with the expected times:
  - a sliding foot (on a stance that starts and ends within the clip, so its time shows: D43);
  - a sunk body (both soles under the floor);
  - an arm through the torso;
  - a pop;
  - a twist flip;
  - a loop seam;
  - a stretched bone;
  - a NaN;
  - events out of order;
  - a mirror on the wrong side.
- **Done when:** the sensors flag 100% of planted defects at the right times, and the false-positive rate on 100 clean
  library clips is measured and stated.
- **Verify:** `npm test -- planted`

**Gate G3.**

### Phase 4: First flight on three.js (lanes R and B)

#### WP-4.1 Pin three.js
- **Owns:** `packages/three/package.json`, `tools/doctrine/banned-three.json`, `docs/THREE.md`
- **Needs:** G2
- **Size:** S
- **Carry:**
  - from my-3d2dge: `docs/LAB-3D.md` ("Why these versions", the banned WebGL-era APIs);
  - from riftlight: `scripts/forbidden-apis.mjs`;
  - from my-3dge: `docs/THREE-DELTA.md`.
- **Build:**
  - A cold-write check: a fresh subagent, with no docs, writes a small skinned-character scene (load a glTF, play a
    clip, crossfade) against each candidate: r182 (the owner's prior pin) and r186 (the latest).
  - Pin the version it writes correctly (default r182) and test the other in CI.
  - Demos use `WebGPURenderer`, which falls back to WebGL 2 by itself. Captures force the WebGL 2 backend.
  - Ban the WebGL-era APIs agents reach for that break under `WebGPURenderer`: `ShaderMaterial`, `onBeforeCompile`,
    `EffectComposer`.
  - `docs/THREE.md` records the result.
- **Done when:** the pin and its reason are logged as a decision, and `npm run doctrine` enforces the banned list.
- **Verify:** `npm run doctrine`

#### WP-4.2 Test characters
- **Owns:** `packages/three/test-characters/*`, `tools/fixtures/*`
- **Needs:** 4.1
- **Size:** M
- **Build:**
  - **Characters generated in code**, seeded: a skinned humanoid (capsules or a lofted body), written as glTF in memory.
    They vary in:
    - proportions: chibi, heroic, bulky, child, tall and thin;
    - rest pose: T, A, relaxed;
    - bone naming: VRM, Mixamo, UE5, Rigify;
    - extra or missing bones: optional twist bones, missing optional bones.
  - **Real CC0 rigs**, fetched by SHA-256 into `.cache/fixtures/` and never committed: at least two, from different
    authors with different rig conventions.
    - One: the Quaternius mannequins in my-3d2dge-2 at `c8295dc` (`public/assets/models/mannequin_{m,f}.glb`, CC0).
    - A second: a CC0 character pack from Kenney or KayKit.
    - Optionally, a VRM avatar whose license allows it.

    Read each license file at fetch time, and record the source, license and hash. `npm run fixtures -- fetch
    --manifest <file>` fetches rigs recorded outside this list the same way, for G4's held-out rig and §7's held-out
    variants.
- **Done when:** 20 generated variants load in three.js and are recognized (WP-1.4) with a confidence reported, the
  real rigs fetch, verify and load, and a rig listed in a separate manifest fetches and verifies by its hash.
- **Verify:** `npm test -- test-characters fixtures && npm run fixtures -- fetch --check`

#### WP-4.3 Binding a skeleton
- **Owns:** `packages/three/src/bind/*`
- **Needs:** 4.2
- **Size:** M
- **Build:** `bind(object3D, { mapping? })`:
  - finds the skinned skeleton (or the VRM humanoid) and recognizes it (WP-1.4);
  - normalizes the rest pose and measures the bone lengths;
  - returns a bound skeleton and a mapping report: confidence, missing bones, issues, a suggested patch;
  - accepts a patched mapping file.
- **Done when:**
  - every test character binds with no hand mapping;
  - a deliberately renamed rig binds through topology, with its confidence stated;
  - the report reads in 20 lines or fewer.
- **Verify:** `npm test -- bind`

#### WP-4.4 Playback and baking
- **Owns:** `packages/three/src/play/*`, `packages/three/src/index.ts`
- **Needs:** 4.3
- **Size:** M
- **Build:**
  - `attach(animator, bound)`: each frame, write `pose()` to the bones as quaternions, and hand root motion to the game.
  - `bake(clip, bound)`: build a `THREE.AnimationClip` of quaternion tracks from the parameters, recording its error
    against the live solve. The clip's `loop`, `events`, `contacts` and `facts` travel with it in `userData`, which
    three's GLTFExporter writes to the animation's `extras`; a VRMA export carries them in `extras` too.
  - VRM through three-vrm's normalized humanoid.
  - VRMA export once `@m3a/io` has it (WP-5.2).
- **Done when:**
  - baked and live playback agree within 1 mm;
  - a baked clip carries the source clip's `loop`, `events`, `contacts` and `facts` in `userData`, and a VRMA export
    carries them in `extras` *(deferred proof: WP-5.2's VRMA round trip; met there, packages/io/test/readers.test.ts)*;
  - crossfades and masked layers work through the Animator;
  - the hot path allocates nothing per frame (measured): the adapter's write; a whole update's cost, core's step and
    pose included, is measured and stated (D48).
- **Verify:** `npm test -- play`

#### WP-4.5 Headless capture
- **Owns:** `packages/three/src/capture/*`, `tests/e2e/capture.e2e.ts` (the repo runs `*.e2e.ts`, D49), `tools/sweep/*`
- **Needs:** 4.4, 3.3
- **Size:** M
- **Build:** a Playwright harness that renders a bound character in headless Chromium on the WebGL 2 backend. It reads
  the frame back with `preserveDrawingBuffer`, checks it is not blank, and writes a sheet. The proof hash of the bone
  transforms must equal the Node solve's.

  Also `npm run sweep -- <rig ids | --manifest <file>>`: it plays every library clip on each given skeleton (bound by
  WP-4.3, solved in Node), runs the sensors (WP-3.3), and writes the clip-by-skeleton results with every failure and
  its reason. G4 runs it on its six skeletons and, separately, on the held-out rig (§9.3). A clip passes on a skeleton
  when the skeleton adds no fail finding (D80; D49 counted warns too): its data is sound, no metric goes past its fail
  level when it was under it on the clip's own body, read the same way, and every mapped bone's joint is within 5 mm
  of its body point. Every metric the skeleton takes past its warn level and no further is listed with its pair.
- **Done when:**
  - sheets of the generated and real rigs render in CI;
  - the hashes match;
  - a blank frame, or one that fell back to another renderer, fails loudly with the reason;
  - a sweep over two test characters writes the clip-by-skeleton results and lists a deliberately broken clip as a
    failure with its reason;
  - an added fail finding fails a pair, and an added warn passes it, listed (D80).
- **Verify:** `npm run e2e -- capture && npm test -- sweep`

#### WP-4.6 The first-flight demo
- **Owns:** `apps/lab/hello/*`, `vercel.json`, `tools/run/hello.ts` (`npm run hello`, D52); graduated after G10 into
  `tests/e2e/first-flight.e2e.ts` and `tests/e2e/first-flight/` on the public API, the lab deleted (D119)
- **Needs:** 4.4
- **Size:** M
- **Build:**
  - A page where a character (any test character) idles, walks and runs by speed (WASD), jumps, and attacks, with the
    `hit` event shown on screen.
  - Deep links: `?char=`, `?clip=`, `?t=`, `?view=`.
  - A console handle, `window.__m3a`: `state()`, `play()`, `step(n)`, `hash()`.
  - A phone-friendly layout, and the build stamp (version and commit).
  - `vercel.json`, ready for when O3 is answered.
- **Done when:**
  - the page runs locally and in CI's e2e, with its sheets kept as CI artifacts (the G4 "demo link" until O3 is
    linked);
  - the console handle drives it headless;
  - the sensors run on what it plays.
- **Verify:** `npm run e2e -- hello` (since D119: `npm run e2e -- first-flight`)

#### WP-4.7 The benchmark harness and B1
- **Owns:** `bench/runner/**`, `bench/starters/**`, `bench/briefs/B1.md`, `bench/briefs/B1-discovery.md`,
  `bench/graders/B1/**`, `bench/results/`, `packages/tools/MANUAL.md` (the first draft)
- **Needs:** 4.6, G3
- **Size:** M
- **Build:**
  - The runner of §7. It packs the packages, builds the scratch workspace outside the repo, and starts a fresh agent at
    the best isolation level available: `claude -p` first, then a fresh remote session, then an audited subagent. It
    records the isolation level, pass or fail, time, tokens, iterations, and the files read past the manual.
  - B1 and its grader: scripted input, a state trace, the sensors. Graders take the starter character as a parameter,
    and the runner takes a held-out variant written at a gate (§7).
  - The B1 discovery starter and brief (§7).
  - The legend quiz deferred from WP-1.1.
  - A first manual draft, good enough for B1 (WP-7.3 finishes it).
- **Done when:**
  - B1 runs 5 trials and writes a results file;
  - B1's discovery trials run and record whether the package was used;
  - the grader fails a planted bad solution and passes a known good one, on the default character and on a generator
    seed outside WP-4.2's test set, and the runner runs a variant given by path (its brief and starter character),
    first running the brief's known-good solution on it and stopping with a package or grader failure if that fails;
  - the legend quiz scores at least 9 of 10.
- **Verify:** `npm run bench -- B1 --trials 5 && npm test -- bench/graders bench/runner`

**Gate G4 = Milestone M1, First flight.**

### Phase 5: The payload (lane L)

#### WP-5.1 Library layout and loader
- **Owns:** `packages/library/src/load/*`, `library/README.md`, `library/LICENSES/*`
- **Needs:** 1.5
- **Size:** S
- **Build:**
  - Load a set or a clip by id, verifying content hashes.
  - Aliases and deprecation: a deprecated id still resolves, with a warning naming its successor.
  - A tier per set: `cc0`, `cc-by`, `cmu`, `local`.
  - The default pack is CC0 (D10): loading, search and the credits tool see `cc-by` and `cmu` sets only when a game
    opts in (`tiers` in its config or game manifest).
  - License texts kept verbatim in `library/LICENSES/`, CMU's notice in full.
- **Done when:** loading every migrated set verifies its hashes, a tampered file fails with the clip named, and a game
  that hasn't opted in sees only CC0 sets.
- **Verify:** `npm test -- library/load`

#### WP-5.2 Importers
- **Owns:** `packages/io/src/**`
- **Needs:** 5.1, 1.3
- **Size:** L
- **Carry:**
  - from my-3d2dge:
    - `tools/anim-import.mjs` (`:122-229`: the glTF reader, the FK sampler, the 36 body points);
    - `tools/asf-amc.mjs` (Acclaim FK, the loop-cycle search, seam spreading, floor mode);
    - `tools/cmu.mjs` (the survey and the ledger);
    - `tools/anim-set.mjs`;
  - from shardfall, as references: the BVH and FBX readers in `crates/pav_tools/src/mocap/`.
- **Build:**
  - Readers with no dependencies for glTF/GLB, ASF/AMC and BVH, plus VRMA read and write.
  - Every input file is untrusted: size limits, no `eval`, bounds-checked buffers, and errors that name the offset.
  - Catalog-driven import: `$sources`, `$pick`, and `$skip` with reasons.
  - A fit report per clip.
  - FBX only through a documented, optional converter (ufbx, or the Blender `bpy` route of my-3d2dge
    `tools/to-glb.py`), never as a runtime dependency.
- **Done when:**
  - **tier 1b**, reader parity: the tiny rig and the CMU take import bit for bit like the oracle;
  - a VRMA file written and read back is identical, with a clip's `loop`, `events`, `contacts` and `facts` in `extras`;
  - every reader has malformed-input tests with clear errors.
- **Verify:** `npm test -- io conformance/tier1b`

#### WP-5.3 Re-import from the sources
- **Owns:** `library/sets/**` (the re-imported sets), `library/catalogs/*`, `tools/migrate/*` (narrowing its check)
- **Needs:** 5.2, 5.6
- **Size:** L
- **Build:** re-import from the original sources with the new degrees of freedom (wrists, forearm roll, spine curl, root
  yaw). Sources are fetched into `.cache/`, never committed.
  - **Quaternius UAL1 and UAL2,** in their current editions. UAL2 was updated to v2.2 on 2026-09-28. *Deviation
    (D63): they come only through itch.io's download flow, which this session can't use; the owner chose to keep
    them as migrated (D81), so `QUATERNIUS_3D2DGE` and `QUATERNIUS_SHARDFALL` stay as they are.*
  - **Mesh2Motion.** Audit each asset's license: the README says CC0, but a July 2026 report says some assets are CC BY
    or CC BY-SA. Unaudited or share-alike assets go to `local`. *Audited CC0 (D63).*
  - **CMU:** the curated picks, plus new picks from the surveyed corpus (WP-5.6) chosen for the G5 category floors
    (combat, traversal, reactions, work).
  - **100STYLE** (CC BY 4.0, about 18.5 hours): import the styles the catalogs pick.

  Compare fit and metrics with the migrated versions, and keep whichever is better per clip, with the reason recorded.
  The comparison gives the change in fit against the source and the change in each other metric separately, since a
  clip can improve one and worsen another. Clips that replace migrated ones are listed, and WP-1.5's check that a clip
  decodes like its source covers only the clips still migrated.
- **Done when:**
  - every re-imported set is within the fit limits: set mean at most 20 mm; clip mean at most 40 mm and worst at most
    300 mm;
  - hand and wrist error drops measurably on clips that hold props;
  - provenance records the source edition and the importer revision.
- **Verify:** `npm run import -- --check && npm run qa -- library`

#### WP-5.4 Facts and auto-labels
- **Owns:** `packages/library/src/facts/*`
- **Needs:** 5.3, 3.3
- **Size:** M
- **Build:**
  - Write measured facts and detected contacts into every clip, marked as measured, with the tool's version: speed,
    travel, strike times, height range, loop seam.
  - Check tags against facts. A clip tagged `loop` must close; a `run` must travel or be marked as in place.
- **Done when:** every clip has facts, and every tag–fact conflict is listed and then resolved or baselined with a
  reason.
- **Verify:** `npm run facts -- --check`

#### WP-5.5 Search
- **Owns:** `packages/library/src/search/*`
- **Needs:** 5.4
- **Size:** M
- **Build:**
  - `search(query, filters)` over catalogs and facts, matching on:
    - words, with a small synonym table;
    - tags;
    - numeric filters (`speed>1.5`, `loop`, `dur<2`);
    - set and tier.
  - It returns at most 40 short rows, with a `next` hint. A query with no match is not an error: it returns zero rows
    (exit 0 under §5.6) and a `next` hint naming the nearest tags.
  - Reading comes in tiers: a core list of about 40 CC0 clips a game usually needs, then the per-set catalogs, then the
    CMU ledger.
  - It searches the tiers the game has opted into (CC0 by default), and its `next` hint says when a closer match exists
    in a tier the game hasn't opted into.
- **Done when:** for a fixed set of 40 queries written from game moments ("lands on one knee", "sneaks", "drinks a
  potion"), a fitting clip is in the top 5 for at least 32; and for 10 held-out queries, written by a verifier subagent
  that has not seen the synonym table or the 40, after the table is frozen, for at least 8. Both run with every tier
  opted in, and the CC0-only scores are reported. A query that hasn't opted in returns only CC0 rows, and its `next`
  names a closer match in an opt-in tier.
- **Verify:** `npm test -- search`

#### WP-5.6 Large corpora on demand
- **Owns:** `tools/corpora/*`, `library/local/README.md`
- **Needs:** 5.2
- **Size:** M
- **Carry:**
  - from my-3d2dge: `tools/cmu.mjs` (`all`, `survey`, `ledger`, `library`);
  - from shardfall: `anim/cmu/takes.tsv`.
- **Build:**
  - A reproducible fetch-and-import of the full CMU library (2,548 takes) and the 100STYLE extras, into `.cache/` with
    checksums, or as release assets if O2 allows.
  - The ledger, kept as text.
  - A `library/local/` lane for libraries that may not be redistributed (Bandai Namco, LaFAN1, Mixamo). Content there
    may be imported for private use, but it is never committed, never shipped, and never used to train or derive
    distributable clips.
- **Done when:** the full CMU survey regenerates its ledger byte for byte, and the doctrine check excludes local content.
- **Verify:** `npm run corpora -- cmu --survey --check && npm run doctrine`

#### WP-5.7 License compliance
- **Owns:** `packages/library/src/license/*`
- **Needs:** 5.1
- **Size:** S
- **Build:** `npm run license -- check <set | game manifest>` (exposed as `m3a license check` once WP-7.1 lands):
  - lists the credits required (CC BY, CMU);
  - credits only the tiers a game manifest opts into (CC0 by default);
  - fails on `local` content in a shipped manifest;
  - flags missing SPDX ids;
  - prints a credits block a game can show.
- **Done when:** every seed set passes, and a fixture for each failure fails.
- **Verify:** `npm test -- license && npm run license -- check library`

#### WP-5.8 Library QA
- **Owns:** `library/baselines/*`, `docs/LIBRARY.md` (generated)
- **Needs:** 5.4, G3
- **Size:** M
- **Build:**
  - Run every sensor over every clip (`npm run qa`, from WP-3.3), with tag-aware thresholds.
  - Repair what the sensors flag where a re-import can be measured against its source: the sensors' fix, kept when it
    makes the clip better within 2 mm of its source on average (D66).
  - Baseline the exceptions, each with a reason. The writers record every clip's verdict in its `quality` (D66).
  - A minimal dedup, so G5 counts unique motions:
    - the `orig` chains;
    - exact re-exports (Mesh2Motion's 86 Quaternius copies; one source's animation in two sets, or its `_RM` take);
    - a simple pose-distance pass for near-duplicates (the full dedup is WP-9.3).
  - A category per clip for G5's floors.
  - Generate `docs/LIBRARY.md`: sets, counts (raw and unique), categories, licenses, fit, QA distributions.
- **Done when:**
  - every clip has a QA verdict, pass or baselined;
  - there are at least 1,000 unique motions, and every category floor of G5 is met (or revised by a logged decision);
  - the distributions are recorded, so they can only improve.
- **Verify:** `npm run qa -- library --check`

**Gate G5.**

### Phase 6: Composition and behavior (lane A)

#### WP-6.1 Recipes
- **Owns:** `spec/RECIPE.md`, `spec/schemas/recipe.schema.json` (the stub G1 froze; D70), `spec/recipes/*`, `packages/core/src/recipe/*`
- **Needs:** G2, 3.3
- **Size:** L
- **Build:** a small declarative language (JSON) for making clips from clips. Its operations:
  - references by id, slice, loop;
  - sequence, with transitions (crossfade, sync on contacts);
  - blend (time-warped);
  - layer (mask, weight, additive);
  - mirror and retime;
  - pose deltas ("lean +10° from 0.2 to 0.5 s");
  - IK targets: look at a point, pin a hand to a path;
  - style operators: exaggerate, smooth, overshoot, stiffen;
  - events and contacts to add.

  `compile(recipe)` produces a format-2 clip whose provenance names the recipe's hash and its inputs' content ids.
- **Done when:**
  - every operator has tests;
  - the compiled clips of 20 example recipes validate and pass the sensors;
  - `describe` explains a recipe in at most 100 tokens.
- **Verify:** `npm test -- recipe`

#### WP-6.2 Procedural sources
- **Owns:** `packages/core/src/procedural/*`, `library/moves.json`
- **Needs:** 6.1
- **Size:** L
- **Carry:**
  - from my-3d2dge: `E.MOVES` (24 moves, 1.8k tokens; engine sections 10–12);
  - from shardfall: `anim/moves.toml` (31 moves with `about` lines) and `moves.rs`;
  - from my-3dge: `tests/baselines/port/moves.json`, frozen (§4);
  - from riftlight: the gait generator with "zero foot slide by construction" (`docs/ANIMATION.md:234-244`).
- **Build:** each source below produces format-2 clips with `method: procedural`; no procedural source runs inside
  `Animator.step` in v1.
  - **One move model, as data:** wind, active and recover phases; arcs; lunge, hop, crouch, lean and twist; chaining
    from a start pose given as an input (a standing pose on the rest by default, D71; graph transitions blend any
    remainder). The three unit systems are reconciled into one, with an `about` line per move.
  - **A gait synthesizer:** speed, stride, bounce and limp, with real contacts.
  - **A procedural idle:** breathing and weight shifts.
- **Done when:**
  - the move model's differential tests against `moves.json` pass within 1 cm mean and 3 cm worst, with every
    exception listed and explained;
  - a move generated from two different start poses begins at each of them;
  - the synthesized gaits slide at most 10 mm per contact. The origin's gait slid 12 to 28% of body speed; it is not a
    target to match.
- **Verify:** `npm test -- procedural`

#### WP-6.3 Actions
- **Owns:** `library/actions/*`, `packages/core/src/actions/*`
- **Needs:** 6.1
- **Size:** M
- **Build:** multi-beat actions with root curves and marked interrupt points, built as recipes over library clips plus
  procedural parts:
  - get up;
  - vault;
  - ledge climb;
  - hop down;
  - roll;
  - heavy landing;
  - a stub for paired actions on two skeletons.

  These are the `E.ACTIONS` that were never built in my-3d2dge, which the GPT-6 build then had to write by hand.
- **Done when:** each action plays on every test character with the sensors green, and its interrupt points work.
- **Verify:** `npm test -- actions` (on two of the test characters), and `npm run e2e` on all six (D74)

#### WP-6.4 Graphs
- **Owns:** `spec/GRAPH.md`, `spec/schemas/graph.schema.json` (Phase 1's stub, filled; D73), `spec/graphs/*`,
  `packages/core/src/graph/*`
- **Needs:** 6.1
- **Size:** L
- **Carry:**
  - from my-3d2dge-2: `src/sim/actions.ts` (the skill timeline, cancel windows);
  - from my-3d2dge: Emberdeep's `HCL_MOVES` (`src/emberdeep/96-hero-clips.js:34`: fade, mask, hold, landed, chaining);
  - PlayCanvas's JSON anim state graph and Godot's AnimationTree, as shapes agents may already know.
- **Build:**
  - States: a clip, a recipe, or a blend space.
  - Transitions: conditions on parameters, a duration, sync, and interrupt rules.
  - 1D and 2D blend spaces with phase sync.
  - Layers, and events delivered to callbacks.
  - Deterministic evaluation inside `Animator.step`, with the graph's state in `hash()` and `save()` (§5.5).
  - A validator with coded messages.
- **Done when:** a locomotion graph (idle, walk, run, jump, land) and an action graph (an attack combo with cancel
  windows) validate and run identically in Node and Chromium.
- **Verify:** `npm test -- graph`

#### WP-6.5 Simulation and gameplay sync
- **Owns:** `packages/tools/src/sim/*`; `tools/sim/*` (the CLI, which reads rigs and clips: D75), `spec/SIM.md`,
  `spec/sims/*`, `spec/schemas/sim.schema.json` and `sim-trace.schema.json`, and a graph state's `rate` in core
- **Needs:** 6.4
- **Size:** M
- **Build:**
  - `npm run sim -- <graph> --input <script>` (`m3a sim` once WP-7.1 lands) outputs a state trace, events, root
    motion, the sensors' results and a filmstrip.
  - Stride warping, which matches playback to ground speed.
  - Root-motion modes: in place, or root-driven.
  - Hit windows, taken from events.
- **Done when:** a scripted walk-to-run-to-jump trace matches its expected trace exactly, and stride warping keeps foot
  sliding under threshold from 0.5× to 1.8× speed.
- **Verify:** `npm test -- sim`

#### WP-6.6 Briefs B2 to B7, and the manual's wire and make sections
Split in two (D76): 6.6a the wiring briefs and the runner for any brief, 6.6b the making briefs.
- **Owns:** `bench/briefs/B2.md` to `B7.md`, `bench/starters/B2/**` to `B7/**`, `bench/graders/B2/**` to `B7/**`,
  `bench/graders/bones.ts` and `recipes.ts`, the runner's brief registry (`bench/runner/main.ts`) and its brief tests,
  the wire and make sections of `packages/tools/MANUAL.md`; it touches the library's `resolver()` (D77), T1's and T2's
  sampling (`tools/run/e2e.ts`, B1's grader test, describe's token test: D77), the body points a spine without chest
  bones gets (`packages/core/src/skeleton/bones.ts`, D77) and the root motion of a one-shot that ends off its feet
  (`packages/core/src/contact/root.ts`, D77)
- **Needs:** 4.7, 6.5
- **Size:** L, as two halves of M (D76)
- **Build:**
  - The briefs B2 to B7 of §7, each with a starter and a grader made of predicates and sensor thresholds. Graders take
    the starter character as a parameter (§7) and derive expected traces and thresholds from it, in hip heights.
    - **6.6a:** B2 (an attack's hit timing), B3 (reactions), B7 (a locomotion graph); `npm run bench` runs any brief.
    - **6.6b:** B4 (a VRM avatar), B5 (an emote), B6 (an edited punch).
  - The manual's sections for wiring (events, graphs, root motion: 6.6a) and making (recipes, edits, actions: 6.6b),
    so G6's fresh agents can work from the manual alone.
- **Done when:** every grader passes a known-good solution and fails a planted bad one, on the default character and
  on a generator seed outside WP-4.2's test set, and the manual draft stays within budget.
- **Verify:** `npm test -- bench/graders && npm run doctrine` (T1 grades on the default character, `npm run e2e` on the
  other seed too: D74)

**Gate G6.**

### Phase 7: The datalink (lane I)

#### WP-7.1 The tool registry
- **Owns:** `packages/tools/src/registry/*`, `packages/tools/src/cli.ts`, `packages/tools/src/mcp.ts`, and (D92)
  `packages/tools/src/node.ts` with the package's `./node` export and `m3a` bin (WP-7.4 builds them for publishing)
- **Needs:** G4
- **Size:** M (it came to 1,323 lines, past M, from its verifiers' findings: D92)
- **Carry:**
  - from my-3d2dge-2:
    - `src/agent/registry.ts` (`defineTool`, `schemaOf`, `validateArgs`, `callTool`);
    - `tools/mcp-server.mjs` (stdio, no dependencies);
    - `tools/agent-cli.mjs`;
  - from riftlight: the six-step tool template (`docs/ENGINE.md:1493-1518`);
  - from shardfall's dry run: silently ignored unknown arguments were among its 13 friction points, so unknown
    arguments are errors.
- **Build:**
  - `defineTool` produces four surfaces: the TypeScript API, the `m3a` CLI, an MCP stdio server, and a console handle.
    The MCP server follows the current spec, where handles are passed as ordinary tool arguments (the protocol is
    stateless).
  - The output contract of §5.6.
  - "Did you mean" on unknown names.
  - Images returned as files or as image content.
  - Every example runs as a test.
- **Done when:** a tool defined once appears identically on all four surfaces (a parity test), and the MCP server passes
  an inspector smoke test.
- **Verify:** `npm test -- registry && npm run e2e -- mcp-smoke`

#### WP-7.2a The tools: find, check, change, ship
WP-7.2 is split in two, each an L (D93): its tools, their host and the writers they need come to about 4,500 lines.
- **Owns:** `packages/tools/src/tools/*`, `packages/tools/src/node/*`, `packages/tools/test/tools-*.test.ts`,
  `packages/tools/test/helpers/*`
- **Also touches** (logged crossings, D95): the registry and the Node host (`registry/registry.ts`, `src/node.ts`,
  `src/mcp.ts`, `src/cli.ts`), `Library#about`, search's speed conversion and D10's tier rule in `@m3a/library`, the
  fix tables' export in `@m3a/sensors`, a strip from `src/sim/film.ts`, the manual's two request_id sentences, the
  e2e `mcp-smoke` suite and `.gitignore`
- **Needs:** 7.1, 5.5, 5.7, G6
- **Size:** L (it came to about 3,688 lines, past L, from its verifiers' findings: D95)
- **Carry:** from shardfall: the clip tool's `name=` branch (`crates/pav_tools/src/anim_tools.rs:750-800`), which
  returns legend, text, fit, strike time and license (`crates/pav_core/src/clips.rs:496-550` is the strike's
  measure, which `facts.strike` already gives); revisioned edits (`crates/pav_tools/src/animation_tools.rs:20`,
  `188-205`, `276-333`, `363-498`; `crates/pav_core/src/animation_edit.rs:208-216`; `docs/ANIMATION_STUDIO.md:185-189`).
- **Build:** each tool returns short JSON rows, with limits and `next` hints; every tool opens the library at the
  game's tiers (`game.json`, else cc0, D93).
  - **The host:** `ctx.library()`, writes only under `workshop/`, `.m3a/`, `imports/` and `check-output/`, and a
    durable request store, so a retried edit applies once across `m3a` runs.
  - **Find and read:** `search`; `show` (the legend, the clip as text, its provenance); `describe`.
  - **Check:** `metrics`, `sheet`, `film`, `diff`, `lint`.
  - **Change:** `fix`; `edit` (with revision checks, retry ids and undo, into `workshop/`).
  - **Ship:** `license.check`. `library.submit` comes with the intake pipeline (WP-9.1, after G5).
  - `version` and `validate` move under `tools/`.
- **Done when:** these tools each have a runnable example that replies the same on the four surfaces and a
  failing-input test; they cost at most 1,900 tokens to describe to a model; a retried `edit` with the same
  `request_id` applies once (across two `m3a` processes, within one MCP server, and after a crash between the write
  and the record); a stale `if_revision` is refused with the file unchanged, undo and redo restore the exact bytes,
  and a file edited outside m3a resets the history.
- **Verify:** `npm test -- packages/tools && npm run check && npm run doctrine`

#### WP-7.2b The tools: retarget, compose, exchange
- **Owns:** `packages/tools/src/tools/{body,judge,retarget,compose,exchange}.ts` and their tests; and (D93) a
  character's bytes in the host, `@m3a/io`'s glTF skeleton reader and its glTF animation and BVH writers (new),
  `@m3a/io`'s import and VRMA fixes, `@m3a/library`'s set writer (moved from `tools/migrate`), the bind's patch names
  in `@m3a/three`, and the D80 judge moved from `tools/sweep` (which imports it back)
- **Also touches** (logged crossings, D96): the registry and the Node host (`registry/registry.ts`, `src/node.ts`,
  `src/mcp.ts`, `src/node/{files,library}.ts`), 7.2a's `tools/{index,common,clips,change,base,ship}.ts` and their tests,
  io's glTF and BVH readers, library's resolver, core's recognition by shape, the B5 and B6 starters' check, and
  `eslint.config.js`
- **Needs:** 7.2a
- **Size:** L (it came to about 4,950 lines, past L, from its verifiers' findings: D96)
- **Build:**
  - **Retarget:** `retarget.inspect`, `retarget.apply`, on a character bound through core (no three.js loader).
  - **Compose and wire:** `recipe.compile`, `graph.validate`, `graph.sim` (a default body, the conformance rig).
  - **Exchange:** `import` (into `imports/<SET>/`, a local set); `export` (glTF, VRMA, BVH).
- **Done when:** these tools each have a runnable example on the four surfaces and a failing-input test; all the
  tools together cost at most 3,000 tokens to describe; an exported VRMA reads back byte for byte, a .glb re-reads
  through io to the same joints within 1 mm and a BVH round-trips within 1 mm; an imported set opens as a local set
  and `license.check` fails it for a shipping game; the sweep's T1 sample gives the same rows after its judge moves;
  `retarget.inspect` on the tier-1b rigify vector matches its expected mapping.
- **Verify:** `npm test -- packages/tools packages/io packages/library tools/sweep && npm run doctrine`

#### WP-7.3 The manual and the skill
- **Owns:** `packages/tools/MANUAL.md`, `.claude/skills/m3a/SKILL.md`, `skills/m3a/` (agentskills.io-compatible),
  `llms.txt`
- **Also touches** (logged crossings, D100): `packages/tools/test/manual.test.ts`, `tools/manual/`, `tools/skill/`,
  `.mcp.json`, the runner's wiring in `bench/runner/`, the registry's examples in `packages/tools/src/tools/`
- **Needs:** 7.2b
- **Size:** M (it came to about 1,500 lines, past M, mostly its tests: D100)
- **Build:**
  - **The manual** (at most 8,000 tokens):
    - the mental model;
    - one complete example: a character that walks, attacks with a hit event, and reacts;
    - the API by job: find, fit, wire, make, check, ship (WP-9.1 adds grow);
    - the rules and the common mistakes.

    Every code block runs in tests. The manual is where an agent starts, so the animation library is on its critical
    path. The GPT-6 build never found my-3d2dge's store because it sat outside the file the agent was handed.
  - **The skill:** when to reach for the package, and the five commands that matter most.
  - **`llms.txt`,** pointing at the manual, the catalogs and the tool list.
- **Done when:**
  - the budget check passes and the examples run;
  - B1 and B5, rerun with the final manual, pass at least 4 of 5.
- **Verify:** `npm run doctrine && npm test -- manual && npm run bench -- B1,B5 --trials 5`

#### WP-7.4 Packaging
- **Owns:** packaging fields in `packages/*/package.json`, `tools/bundle/*`
- **Also touches** (logged crossings, D101): `@m3a/library`'s loader (installed opt-in packs), the tools' missing-pack
  warning, `bench/runner/pack.ts`, `package-lock.json`'s bin
- **Needs:** 7.3
- **Size:** M (it came to about 1,720 lines, past M: D101)
- **Carry:** from riftlight: `scripts/bundle.mjs`, which builds one self-contained ES module, `pixel-engine.js`.
- **Build:**
  - ESM builds with types for every package.
  - The library's default package holds only `cc0` sets; `cc-by` and `cmu` sets ship as separate opt-in packs (D10).
  - A single-file bundle (`m3a.js` plus a CC0 subset of the library) for agents that can't install packages. The
    subset is listed in `tools/bundle/manifest.json`, which passes `npm run license -- check`. `npm run pack -- --check`
    also runs the sensors (WP-3.3) on every clip in it and fails on one that neither passes nor carries a WP-5.8
    baseline. The bundle carries the credits block and the license texts of every tier it includes.
  - The version and changelog rule.
  - A dry-run pack (`npm pack --dry-run`) per package.
  - Publishing waits for O2. When it comes, every release is signed with provenance (npm provenance through Sigstore)
    from the first published version. Clips are inert data, but the skills, the MCP server and the importers are code,
    and agent-skill registries have already shipped malware (ClawHub carried 341 malicious skills).
- **Done when:** a scratch project installs the packed tarballs and runs the manual's example, the single file runs
  the same example and carries the credits and license texts of its tiers, `npm run license -- check` passes on the
  bundle's manifest, every clip in it has a QA verdict, pass or baselined (WP-5.8 may not have run yet), and the
  packed default library holds no `cc-by` or `cmu` clip.
- **Verify:** `npm run pack -- --check && npm run license -- check tools/bundle/manifest.json`

**Gate G7 = Milestone M2, Agents fly it.**

### Phase 8: The ground station (lane G)

#### WP-8.1 The gallery
- **Owns:** `apps/gallery/**`
- **Needs:** 4.6, 7.2b
- **Size:** L
- **Build:**
  - Browse and search the sets.
  - Play any clip on any test character in 3D: any view, slow motion, frame by frame.
  - A metrics panel, `describe`, sheets, and views of recipes and graphs.
  - Deep links to everything, and a console handle.
  - A phone-first layout, with the build stamp.
- **Done when:**
  - every set and clip opens by link;
  - e2e drives it headless at a phone viewport;
  - nothing can be done only in the gallery.
- **Verify:** `npm run e2e -- gallery`

#### WP-8.2 The review queue
- **Owns:** `apps/gallery/src/review/*`, `apps/gallery/src/contributors/*`, `packages/tools/src/tools/review.ts`,
  `packages/tools/src/intake/*`, `services/intake/**`
- **Needs:** 8.1, 5.8
- **Size:** L
- **Build:**
  - The intake store of §5.9: `IntakeStore` with its `local` and `supabase` backends, the migrations, row-level
    security on every table and the bucket, and one contract test suite that both backends must pass. Its cases
    include: anonymous clients get nothing; a contributor reads only their own rows; editing one's own `user_metadata`
    gains nothing; only the checker moves states up to `awaiting review`; only the owner decides.
  - The submit function in `services/intake/`: it checks a contributor key, enforces the rate limit and the size
    limit, and inserts the submission. Contributors' humans sign in on the gallery's contributor page to get and
    revoke keys.
  - The review queue, in the gallery and as `m3a review`, so nothing is done only in the gallery:
    - submissions awaiting review, each with its preview sheet, its numbers, its check report and a diff against the
      clip it improves: adopt, archive or reject, with a note (WP-9.1's adopt bot commits what is adopted);
    - sampled library clips: approve or flag, with a note, written into the clip's review state;
    - batch actions for both.
  - Each decision records the hash it was made on: a submission's content hash, or a library clip's motion hash (§5.3).
    A decision on a clip that changed since it was queued is stale and is not applied.
  - Notes go into `docs/FEEDBACK-LOG.md` by theme, and threshold and task proposals into a list for the next WP.
  - Until O8's project is linked, the gallery exports a review as JSON (through the share sheet on a phone, or as a
    file on a desk), and `m3a review ingest <file>` applies it to the local store and the clips.
  - Linking the project means creating it, adding its keys to the repository's Actions secrets, and turning on the
    repository setting that lets Actions create pull requests (the adopt bot needs it). That reaches outside the repo,
    so ask the owner once, here, and build on the local store meanwhile. Check the free tier's limits, including
    whether idle projects pause, and log them in `docs/DECISIONS.md`.
- **Done when:**
  - the contract suite passes on the `local` backend *(on `supabase`: deferred proof, G9, once O8's project is
    linked)*;
  - a review made at a phone viewport changes the right states and files, applying it twice is idempotent, and a
    decision on a clip that changed since it was queued is refused as stale.
- **Verify:** `npm run e2e -- review && npm test -- review intake`
- **Split** (D109, as D93 split WP-7.2; 3,023 lines, past L): **8.2a** the store, its backends, the migrations, the
  submit function, the contract suite and `m3a review` (`packages/tools/src/intake/*`, `tools/review.ts`,
  `services/intake/**`); **8.2b** the review queue's page and the contributor page (`apps/gallery/src/review/*`,
  `apps/gallery/src/contributors/*`), with their e2e.

#### WP-8.3 Previews
- **Owns:** `vercel.json`, `apps/lab/index/*`
- **Needs:** 8.1
- **Size:** S
- **Build:** per-branch previews once O3 is linked; a labs index page, listing each lab with its date and question; the
  build stamp on every page.
- **Done when:** a branch preview shows its own commit, and the labs index links every page.
- **Verify:** `npm run e2e -- previews`. Once O3 is linked, also check the preview URL on the PR.

**Gate G8.**

### Phase 9: The supply chain (lanes L and I)

#### WP-9.1 The intake pipeline
- **Owns:** `CONTRIBUTING.md`, `packages/tools/src/tools/library-submit.ts`, `tools/intake/*`,
  `.github/workflows/intake.yml`, `.github/workflows/library-gates.yml`, `bench/briefs/B8.md`, `bench/graders/B8/**`,
  the grow section of `packages/tools/MANUAL.md`
- **Needs:** G5, G7, 8.2
- **Size:** L
- **Build:** the pipeline of §5.9, written for agents.
  - `m3a library submit <clip | recipe> [--improves <SET/Clip>]` validates and measures the clip locally, then sends
    it, its provenance and its local report to the queue under the contributor's identity. `--improves` records the
    original's id and content hash, so the review shows a diff and adoption makes a new version: this is how a game
    sends back a clip it fixed. `m3a library status [<id>]` lists a contributor's submissions with their states and any
    bounce reason. The provenance records:
    - the method;
    - the producing tool, and the model and version if one was used;
    - a hash of the prompt;
    - the license claim;
    - the IPTC source type.
  - **The checker** (`tools/intake/check.ts`, run by `intake.yml` every 15 minutes and on demand) takes new
    submissions and runs the gates: schema, lint, sensors, license allowlist, dedup, budgets, provenance, text fields
    free of instructions aimed at agents (models read catalog lines), and a retarget onto the reference rigs with the
    sensors green. It renders a preview sheet in software (WP-3.2). A failure is bounced with its reason; a pass waits
    for the owner.
  - **`library-gates.yml`** runs the same gates on every pull request that touches `library/sets/`.
  - **The adopt bot** (`tools/intake/adopt.ts`): `intake.yml` runs it after each check, and the session runs it by
    hand until `intake.yml` is on `main`. It acts only on adoptions recorded by the owner's identity in the hosted
    store. For each, one at a time, it rechecks the submission's content hash, writes the clip through
    `@m3a/library`'s writer into its set with its catalog row and provenance (review: approved by the owner, with the
    hash), opens a pull request against `main`, runs the library gates itself (a pull request opened with the
    workflow's own token starts no other workflow), and merges it if they pass. If they fail, it closes the pull
    request and returns the submission to `awaiting review` with the reason. The owner's adoption is the approval.
  - What every contributor gives:
    - a CC0 dedication (the default), or the tier of the clip it derives from;
    - an accountable human behind every agent, through the sign-in;
    - a training-data manifest for any generator used, meaning a learned motion model (procedural code, and the coding
      agent that wrote it, are not generators here);
    - disclosure of who or what made the clip.
  - A rate limit per contributor, no per-clip rewards, and the owner's review before adoption (O7).
  - Brief B8 and its grader, which takes the starter character as a parameter (§7).
  - The manual's grow section: `m3a library submit` and the intake rules, with a runnable example, so B8's fresh
    agents work from the manual alone (the bench workspace holds the manual, not `CONTRIBUTING.md`).

  The registries that survived AI floods share these defenses: disclosure, identity, automated checks, no reward for
  volume, and review before merge (research: `data_licensing_registries.md` §6). The open portals that lacked them
  were flooded (Fab) or poisoned (ClawHub).
- **Done when:**
  - on the local store, a clean submission passes every check and waits for review, and adopting it in a dry run
    against a scratch checkout writes the clip into its set with its catalog row and provenance and prints the pull
    request it would open *(the real pull request: deferred proof, G9, blocked-owner on O8, D115)*;
  - the adopt bot refuses an adoption not recorded by the owner's identity, and when the gates fail it closes the
    pull request and returns the submission to `awaiting review`;
  - each planted bad submission is bounced with a clear message, which `m3a library status` shows: a bad license, a
    duplicate, a defect, missing provenance, a generator with no manifest, an instruction hidden in a text field;
  - a pull request with a planted bad clip fails `library-gates.yml`;
  - an improvement shows its diff and is adopted as a new version, and a resubmitted archived motion is recognized;
  - B8's grader passes a known-good solution on the default character and on a generator seed outside WP-4.2's test
    set, and the manual's grow example runs within the manual's budget.
- **Verify:** `npm test -- intake bench/graders/B8 manual && npm run doctrine && npm run intake -- check --fixture all && npm run gate -- library-pr --fixture all`
- **Split** (D112, as D93 split WP-7.2): **9.1a** the pipeline (the `library` tool, `do: submit | status`; the
  checker, the adopt bot, the library gates, `intake.yml`, `library-gates.yml`); **9.1b** B8, its grader and starter,
  the manual's grow section. The tools' description budget is 3,200 tokens from 9.1a on (D112). WP-9.2 and WP-9.3
  were built beside 9.1a, neither needing its code (D112).

#### WP-9.2 The motion-source socket
- **Owns:** `packages/core/src/sources/*`, `packages/tools/src/sources/*`
- **Needs:** 9.1
- **Size:** M
- **Build:**
  - `MotionSource`: given intent, constraints, a skeleton, a duration and a seed, it returns a clip with provenance and
    a license claim, plus warnings.
  - Built-in sources: the library, recipes, procedural.
  - An HTTP adapter template for external generators, disabled by default. It can pass key poses as constraints, which
    is the input shape of NVIDIA Kimodo's constraint-based generation.
  - No source writes into a distributable set: its clips go to the intake queue through `library.submit`, and a source
    whose license isn't on the allowlist writes only to `library/local/` (O5).
  - Every source's output passes the same gates, and records the source's license version per clip, since vendors
    change terms: NVIDIA "may update" its model license "at any time".
- **Done when:** the built-in sources and a mock external source run through one interface, an allowlisted source's
  clip lands in the intake queue, and a source that isn't allowlisted can't write into a distributable set.
- **Verify:** `npm test -- sources`

#### WP-9.3 Dedup and lineage
- **Owns:** `packages/library/src/dedup/*`, `packages/library/src/lineage/*`
- **Needs:** 9.1
- **Size:** M
- **Build:**
  - Near-duplicate detection: a time-warped distance over body-point features, aware of mirroring.
  - A lineage graph from `orig`, recipe inputs and content ids.
  - Deprecation without deletion: ids are never reused.
- **Done when:**
  - planted near-duplicates (retimed, mirrored, lightly edited) are found;
  - known distinct clips are not merged;
  - every composed clip's lineage resolves.
- **Verify:** `npm test -- dedup lineage`

#### WP-9.4 The registry index
- **Owns:** `library/index.json` (generated), `tools/release/*`
- **Needs:** 9.2, 9.3
- **Size:** S (it came to 683 lines, past S)
- **Build:**
  - A versioned index of the sets as static JSON (content ids, hashes, licenses, sizes, review stats), plus a section
    of `llms.txt`.
  - Two tiers, as in package registries:
    - **the curated core** lives in this repository;
    - **community packs** are federated entries, each a namespace verified to its owner and pointing at an external set
      with a content hash. They are never uploads into the core: the core grows only by adoption from the intake
      queue (WP-9.1).
  - Versions are immutable, and sets are yanked, never deleted.
  - A release workflow that packages sets as release assets (subject to O2).
- **Done when:** the index regenerates byte for byte, a consumer can verify any set from it, and a community pack with
  a mismatched hash or an unverified namespace is refused.
- **Verify:** `npm run index -- --check`

**Gate G9 = Milestone M3, The library grows.**

### Phase 10: Consumers (lane X)

#### WP-10.1 The TypeScript consumer proof
- **Owns:** `apps/lab/consumer-ts/*`, `docs/MIGRATING.md`
- **Needs:** G7
- **Size:** M
- **Build:**
  - A lab shaped like my-3dge's needs: three.js r182, a deterministic step, and a graph-driven humanoid with hit events
    and root motion.
  - A migration guide that maps my-3dge's planned animator WPs (3.4–3.7, recorded in ADR-0009) and Phase 8 WPs
    (8.1–8.10, with ADR-0010) onto this package, marking each as replaced, wrapped or kept. Proposing the switch in
    my-3dge is O9, because it means acting in another repository.
- **Done when:** the lab passes its e2e, and the guide covers every my-3dge WP in 3.4–3.7 and 8.1–8.10, saying whether
  it is replaced, wrapped or kept, and names any other my-3dge WP it replaces.
- **Verify:** `npm run e2e -- consumer-ts`

#### WP-10.2 The conformance kit
- **Owns:** `spec/conformance/*`
- **Also touches** (logged crossing, D116): `tools/conformance/` (the `npm run conformance` CLI)
- **Needs:** G7
- **Size:** M (it came to about 1,400 lines, past M)
- **Build:**
  - The vectors plus a runner protocol (JSON in, JSON out, tolerances per tier), so any implementation can certify
    itself.
  - A Node sidecar adapter for hosts in other languages. shardfall already uses this pattern for SpawnForge.
  - Instructions for certifying shardfall's Rust codec.
- **Done when:** the TypeScript implementation certifies through the kit's own runner, and a deliberately broken
  implementation fails with the vector named.
- **Verify:** `npm run conformance -- --impl ts`

**Gate G10 = Milestone M4, The standard in use.**

### After G10: the follow-ups (lane F)

The follow-ups docs/HANDOFF.md recorded after the audit (D119) that need nothing from the owner, each a WP of its own,
picked by the owner on 2026-10-21. No gate follows them: each is held by its Verify, T0, T1 and T2.

#### WP-F.1 The m3a bin on a Node too old for it, and the session hook's install
- **Owns:** `packages/tools/src/node/engine.ts`, `packages/tools/test/engine.test.ts`, `tools/session/*`,
  `.claude/hooks/session-start.sh`
- **Also touches:** `packages/tools/src/node.ts` (the bin's last lines)
- **Needs:** G10's commands
- **Size:** S (about 210 lines with tests)
- **Build:**
  - The bin refuses, on stderr with exit 1, a Node without `import.meta.main` when it is the process's entry, rather
    than doing nothing; a Node below the engines that has it runs with a warning.
  - The SessionStart hook runs `npm ci` only when node_modules wasn't installed from this lockfile on this Node, so a
    resume, `/clear` or `/compact` no longer deletes node_modules under the m3a MCP server (D121).
- **Done when:** the packed bin under Node 20 and 21 says which Node it needs and exits 1 (`m3a version` and
  `m3a mcp`), under 22.22 warns and runs, under 24 runs with nothing on stderr *(measured once in the session, D121:
  CI has Node 24 only)*; the hook skips the install on a matching stamp and installs on a changed lockfile, another
  Node, no node_modules, and after a failed install.
- **Verify:** `npm test -- packages/tools/test/engine.test.ts tools/session`

#### WP-F.2 Contacts for the six `unplanted` loops
- **Owns:** `packages/core/src/clip/facts.ts` (`bySole`), `packages/core/test/clip.test.ts`, `library/baselines/qa.json`
  (`unplanted`), `library/sets/STYLE100_RUN/` (through `npm run import`), and what the writers and QA write from them:
  `library/sets.lock.json`, `library/index.json`, `packages/sensors/fixtures/baseline.json`,
  `library/baselines/distributions.json`, `docs/LIBRARY.md`
- **Also touches:** `tools/qa/library.test.ts` (the off-feet check's count, 6 answers to 5)
- **Needs:** G10's commands (D108's fallbacks)
- **Size:** S (78 new lines with tests: 25 in core, 48 of tests, 5 of reasons; the clip, lock, index and baselines
  written by their tools)
- **Build:**
  - Each of the six loops D108 answered `unplanted` given the contacts the planter can hold (D108's bar: the planted
    ankle's pull within 10% of H0, both feet plant, a foot down for a fifth of the loop), preferring the reading whose
    ground speed agrees with the captured speed; a loop no reading holds keeps none, its answer sharpened with the
    numbers. Decided per clip by measurement (D122).
  - Core's `measureFacts`: in place, on its feet, when every reading leaves no contact, the whole sole again, refined
    by the planted feet's velocity it gives, kept with its travel only when it stands (`bySole`).
- **Done when:** `STYLE100_RUN/OnHeels_Run` carries a contact a foot, which the planter holds within 5% of H0, its
  ground speed within 15% of its captured 1.27 H0/s and its travel within 5%; no other library clip's facts or
  contacts move; the five others read none, each answered with the numbers its test pins; every mutant of the new
  fallback is killed by a named test; the sensors' verdicts don't move; the judge over the changed clip on the six
  sweep skeletons adds no fail; B1's known-good passes in full.
- **Verify:** `npm run facts -- --check`, `npm run qa -- --check`, `npm run qa -- library --check`,
  `npm run index -- --check`, `npm run test:full -- packages/core/test/clip.test.ts packages/core/test/contact-gaits.test.ts bench/graders/B1`,
  `npm test -- tools/qa/library.test.ts tools/release`,
  `npm run sweep -- gen-0 gen-1 gen-2 gen-3 quaternius-mannequin-m kaykit-knight --clip STYLE100_RUN/OnHeels_Run`,
  `npm run import -- --set STYLE100_RUN --check` (it fetches the 1.47 GB 100STYLE archive into `.cache/100style` once)

#### WP-F.3 The root-motion rate sweep
- **Owns:** `tools/sweep/rates.ts`, `tools/sweep/rates-cli.ts`, `tools/sweep/rates-worker.ts`,
  `tools/sweep/rates.test.ts`, `tools/sweep/rates.schema.json`, `library/baselines/rates.json`; the `--rates` mode of
  `tools/sweep/main.ts`; its line in `tools/run/e2e.ts`'s `SWEEPS` (shared: the T2 registry)
- **Needs:** D106 (the follow-up), D108 (the contacts it plays), D74 and D119 (T1 samples, T2 in full)
- **Size:** M (584 new lines, tests included: rates.ts 322, rates-cli.ts 80, rates-worker.ts 7, rates.test.ts 139,
  rates.schema.json 19, main.ts and e2e.ts 17; plus the generated baseline, 487 lines of data)
- **Build:**
  - A sweep that plays every locomotion loop with contacts that travels (looping, tagged walk, run, sidestep, strafe
    or turn, its facts' speed at least 0.05 H0/s) at the rates 0.5, 0.75, 1, 1.5 and 2 on the six bodies G4 sweeps
    (gen-0 to gen-3, Quaternius' mannequin, KayKit's knight), moved by root motion as `player.travel` moves it, the
    sensors run on what it plays: B1's "planted feet don't slide" and "a foot stands still", per row (one loop at one
    rate on one body).
  - The fail rule, decided and written down (D123), with the distribution it was read from.
  - A baseline of the failing rows (`library/baselines/rates.json`, its schema and a validator), gated against: a
    failing row not in it fails; a baselined row that passes now is reported; `--baseline` rewrites it.
  - `npm run sweep -- --rates [<rigs>] [--sample N] [--clip ID] [--check] [--baseline] [--jobs N] [--out <file>]`: a
    flag on the existing script, no new npm script; worker threads, one a CPU.
  - T1 samples it (6 loops on gen-0 through the CLI); T2 runs it whole in a step of its own, "rate sweep in full"
    (M3A_FULL=1): beside the sweeps' workers its threads starved a 5 s test on CI's 4 CPUs.
- **Done when:**
  1. Every locomotion loop with contacts is played at each rate on each of the six bodies, as `Animator.pose()` poses
     it, moved by its root's travel.
  2. The fail rule is a decision with its reasons and the measured distribution (D123).
  3. The baseline holds every failing row of a whole run, and the gate fails on a failing row outside it and reports
     a baselined row that passes.
  4. The rule's edges are tested: a planted pair that must fail (B1's skater), a passing pair, a warning pair, a pair
     that fails at an extreme rate alone, a baselined failure, a baselined pair that improved, the baseline's shape.
  5. T1 runs a sample in a few seconds; T2 runs the whole sweep; regenerating the baseline is one command.
  6. T0 is clean for the lane's files.
- **Verify:** `npm run check`; `npx vitest run tools/sweep/rates.test.ts tools/sweep/sweep.test.ts`;
  `npm run test:full -- tools/sweep/rates.test.ts`; `npm run sweep -- --rates --check`

#### WP-F.4 The manual teaches the names it doesn't
- **Owns:** `packages/tools/MANUAL.md`, `packages/tools/test/manual.test.ts`
- **Needs:** WP-7.3 (the manual and its test), G7 (the briefs' evidence the manual must keep)
- **Size:** S: 49 new lines (the manual +32 −29, its test +17 −4)
- **Carry:** none
- **Build:**
  - The manual teaches F5.2's `LibraryError` (the entry that exports it, its `.code` values) and MIGRATING.md gap 10's
    `VERSION`, `math.PORTABLE`, `math.hashValue`, `graph.layersOf`, `graph.clipsOf` and the Animator's `step` option:
    what each is, when an agent reaches for it, its exact form, each form run and type-checked by the manual's test.
  - The room comes from cutting text no brief's job draws on; the budget stays 8,000.
  - The test holds the new claims: each name the prose gives with its entry is that entry's export, and the MCP command
    the prose gives runs the installed package's bin (the check the `.mcp.json` block had).
- **Done when:**
  - the manual names and shows all seven, its ts blocks running and type-checking the six code forms;
  - the manual is at most 8,000 cl100k tokens;
  - every rule B1 to B8 use is kept, word for word where a decision records it;
  - the briefs that read the changed sections are listed with why and their pass bars, and each re-run with real
    agents reaches its bar (G7's 4 of 5; B8-ten its one trial): 83 of 83 trials passed (D124).
- **Verify:** `npm run doctrine && npx vitest run packages/tools/test/manual.test.ts tools/skill/skill.test.ts
  tools/bundle/bundle.test.ts tools/doctrine/doctrine.test.ts && node tools/manual/main.ts --check && npm run check &&
  npm run pack -- --check`; `npm run bench -- B<n> --trials 5 --parallel 5` and `--heldout G7` for B1 to B7, B8 with
  `--heldout G9`, `B8-ten --trials 1`

#### WP-F.5 T1's headroom in CI
- **Owns:** `vitest.config.ts`, `spec/conformance/kit/pinned.test.ts`
- **Also touches:** `packages/tools/src/tools/library-submit.ts` (`status` counts states in `STATES`' order: the version
  bump reordered the intake fixtures' ids, D125); `packages/core/src/actions/compile.ts` and its test (a kept
  procedural part given back on the resolver's own rest: shared modules found it, D125)
- **Needs:** G10's commands
- **Size:** S (about 30 lines)
- **Trigger:** CI's T1 over 110 s; it read 126.1 s of its 135 s mark on `main` at 957bf51 (D125)
- **Build:** T1 back under its CI mark with room to grow: the files T1 runs share their worker's modules rather than
  importing the packages again for each (Vitest's `isolate: false`), the tests that relied on a fresh module fixed;
  or, failing that, the heaviest full-sweep cases moved to T2 as D74 and D119 did.
- **Done when:** T1 passes three times with its files shuffled; CI's T1 on the pull request's head is under 110 s.
- **Verify:** `npm test` (and CI's T1 time on the pull request)

#### WP-F.6 T2 back under its budget in CI
- **Owns:** `playwright.config.ts`, `.github/workflows/ci.yml` (the `rates` job, the header's line)
- **Also touches:** `tests/e2e/mcp-smoke.e2e.ts` (one test's timeout), `tools/intake/workflows.test.ts` (ci.yml's
  jobs); through the patch (section 7): `tools/run/e2e.ts` (lane R's this round: T2's steps, the rate step), and with
  it `tools/run/run.test.ts` (its test), `tools/sweep/rates.test.ts` (its header, the full test's comment) and
  `AGENTS.md` (T2's row, the rate sweep's row)
- **Needs:** WP-F.3 (D123: the rate sweep, its step in T2), WP-F.5 (D125)
- **Size:** S (105 new lines, tests included: ci.yml 32, e2e.ts 27, run.test.ts 17, workflows.test.ts 14,
  rates.test.ts 5, playwright.config.ts 4, mcp-smoke.e2e.ts 4, AGENTS.md 2; 32 removed)
- **Carry:** none
- **Trigger:** CI's T2 on michaelcrosato/my-3danimations#20 read 525.2 s of its 480 s budget (a warning; it fails at
  720): playwright 242.6 s, library QA 8.7, library sweeps in full 164.4, rate sweep in full 109.5
- **Build:**
  - Playwright runs four suites at once, not two: on 4 CPUs two kept about three busy and started gallery, the
    longest suite, tenth of eleven; four make the step CPU-bound. Every test stays within its timeout (mcp-smoke's
    every-example test gets one of its own: beside three suites it takes 46 to 49 s, past the 30 s default, which
    never fired because the test blocks on spawns).
  - The rate sweep in full moves to a CI job of its own, `rates`, on every pull request, beside T2: the same command T2
    ran (`npm run test:full -- tools/sweep/rates.test.ts`: every loop at every rate on the six bodies against the
    baseline, the threads' rows checked against one thread's). T2 sweeps two of the bodies whole (`npm run sweep --
    --rates gen-0 kaykit-knight --check`): every loop at every rate on a generated body and on the real rig whose feet
    fail the most rows. T2's steps come from `t2Steps()` in e2e.ts, as T0's from `t0Steps()`, so a test reads them.
- **Done when:**
  1. T2 here (4 CPUs) is at most about 345 s, every step measured before and after on one tree.
  2. CI's T2, estimated from here, is about 430 s or less (the 1.25 ratio, and CI's own steps scaled).
  3. Playwright on four workers passes every run, no flake, every test within its timeout.
  4. The whole rate sweep runs on every pull request, its rows byte for byte the same; `npm run sweep -- --rates
     --check` passes with nothing added; `--baseline` adds and drops nothing.
  5. T2's sample is the whole run's rows on its bodies, byte for byte, and passes the baseline check.
  6. A test holds the `rates` job (every pull request, beside T2 with neither waiting on the other, no step of it
     skipped or let fail, the rigs fetched, the cache only restored) and T2's steps (the rate step last, after the
     library sweeps, on bodies among the six, with `--check`; none under a filter); each mutant in section 2 is killed.
  7. T0 is clean for the lane's files.
- **Verify:** `npm run check`; `npx vitest run tools/intake/workflows.test.ts tools/run/run.test.ts`;
  `node_modules/.bin/playwright test`; `npm run sweep -- --rates gen-0 kaykit-knight --check`;
  `npm run test:full -- tools/sweep/rates.test.ts` (the `rates` job's command); `npm run sweep -- --rates --check`;
  `npm run e2e` (T2 within its budget); and CI's T2 and `rates` job on the pull request's head

#### WP-F.7 The rate sweep's failing rows triaged
- **Owns:** `packages/core/src/clip/facts.ts` (`weak`, `downs`, `holds`), `packages/core/test/clip.test.ts`,
  `tools/sweep/rates.ts`, `tools/sweep/rates-cli.ts`, `tools/sweep/rates.schema.json`,
  `tools/sweep/rates-answers.test.ts` (new), `tools/sweep/rates.test.ts` (the shape test), `library/baselines/rates.json`,
  `library/sets/STYLE100_RUN/` (through `npm run import`), and what the writers write from it: `library/sets.lock.json`,
  `library/index.json`; `library/README.md` (one sentence)
- **Also touches:** `tools/run/changed.ts` and `tools/run/run.test.ts` (`test:changed`'s library rule runs the answers'
  test too); `tools/sweep/main.ts` (the `--check` and `--baseline` help names the answers)
- **Needs:** WP-F.3 (D123: the rate sweep and its baseline), WP-F.2 (D122), D104, D108; WP-F.6 (D126: where the sweep
  runs in T2 and CI; nothing here depends on its patch)
- **Size:** S (375 new lines, tests included: rates-answers.test.ts 124, clip.test.ts 75, facts.ts 66, rates.ts 51,
  rates-cli.ts 31, rates.schema.json 17, main.ts 4, rates.test.ts 3, README 2, changed.ts 1, run.test.ts 1; 50 removed;
  plus the data the tools wrote: rates.json +138 −7 (7 causes, 126 answers, 6 rows gone), index.json +22 −1, 2 clips'
  contacts, 1 manifest, the lock)
- **Carry:** none
- **Trigger:** docs/HANDOFF.md's follow-up: the rate sweep's 479 failing rows (D123), each "a row to fix or to answer"
- **Build:**
  - Every failing loop measured: each failing row's worst finding read back to the motion (which foot, the sensors'
    stance against the clip's contacts, where the drift happens: before the contact, under it, after it, between two of
    its contacts, or where no contact holds the foot; how high and how fast the foot moves there).
  - What the contacts can fix, fixed through core and the importer: a loop whose refinement keeps one foot a moment a
    cycle, after a height pass that held both feet down throughout, is read again (D104's `reread`, its trigger
    widened), the reading kept where the planter holds it within 10% of H0 (`holds`); the two loops it moves written by
    `npm run import`.
  - Every loop that still fails a row answered in the baseline: `causes` (a name and what it means) and `answers` (each
    loop's cause and why, with its numbers); the schema, the validator's rule (an answer's cause is one of `causes`),
    the gate (`--check` fails on a failing loop with no answer, reports an answered loop that fails no row), and
    `--baseline` carrying the answers of the loops that still fail.
- **Done when:**
  1. Every loop the planter and the contacts can fix by a rule core reads every loop by is fixed through the writers,
     each measured: the planter's pull within 10% of H0 (core checks it, so a retimed loop's reading holds it too),
     both feet, a foot down a fifth of the loop, the ground speed against the captured speed; no rows added.
  2. No other clip's facts or contacts move; QA's verdicts, baseline and distributions don't move; B1's known-good
     passes in full; the index regenerated and checked; the judge on the six sweep skeletons adds no fail for a changed
     clip.
  3. Every loop failing a row has an answer with its numbers; the schema and validator hold the answers' shape; `--check`
     fails on a failing loop with no answer and reports an answered loop that fails no row; `--baseline` carries them;
     a test holds each answer's rows and readings to the baseline's.
  4. The baseline only shrinks: `--baseline` from a whole run adds 0 rows.
  5. Tests for each new rule and each fixed loop, each mutant of the core rule killed or shown equivalent, over the
     library's in-place loops at their own speed and retimed.
  6. T0 clean; the touched suites green.
- **Verify:** `npm run check`; `npm run doctrine`; `npm run facts -- --check`; `npm run qa -- --check`;
  `npm run qa -- library --check`; `npm run index -- --check`; `npm run library -- check`;
  `npm run import -- --set STYLE100_RUN --check` (and `STYLE100`, `STYLE100_BACKRUN`, `MESH2MOTION`);
  `npx vitest run packages/core/test/clip.test.ts tools/sweep tools/run/run.test.ts`;
  `npm run test:full -- bench/graders/B1 tools/sweep/rates.test.ts tools/sweep/rates-answers.test.ts`;
  `npm run sweep -- --rates --check`; `npm run sweep -- gen-0 gen-1 gen-2 gen-3 quaternius-mannequin-m kaykit-knight
  --clip STYLE100_RUN/Robot_Run` (and `Swimming_Run`, and `STYLE100/StartStop_Walk`, the clip the rule leaves)

#### WP-F.8 The manual teaches gap 10's last names
- **Owns:** `packages/tools/MANUAL.md`, `docs/MIGRATING.md` (gap 10), `apps/lab/consumer-ts/README.md`,
  `docs/FEEDBACK-LOG.md` (F6.4); `packages/tools/test/manual.test.ts` (unchanged: its checks cover the new lines)
- **Also touches:** `packages/three/test/test-characters.test.ts` (two assertions: the test set is seeds 0 to 19 and
  gives every build with every naming, as the manual now says)
- **Needs:** WP-F.4 (D124: the manual at 7,998 of 8,000, its test naming each entry's export)
- **Size:** S: 43 new lines (the manual +22 −19, MIGRATING +8 −5, the lab's README +8 −7, FEEDBACK-LOG +3 −1, the
  test +2)
- **Carry:** none
- **Build:**
  - The manual teaches `@m3a/three/test-characters`' `character`, `variant` and `TEST_SEEDS` (what the test characters
    are, their seeds, when an agent reaches for them, the tools' `gen-<seed>`), `loadGlb` in a page as in Node (it
    reads .glb bytes; a textured .glb in Node needs `{ textures: false }`), and the attached player's `apply()` and
    `bound` (the lab's view poses each fighter without a step). Each claim is checked against the code, and in headless
    Chromium for the page; the code it shows runs and type-checks in the manual's test.
  - The room comes from text no brief's job draws on (Ship, Make: actions); the budget stays 8,000.
  - MIGRATING.md's gap 10, the lab's README and FEEDBACK-LOG's F6.4 say what is left (gap 1's names; the types the
    lab names, left to the compiler).
- **Done when:**
  - the manual names and shows `character`, `variant`, `TEST_SEEDS` and `loadGlb` in a page, its Fit block running and
    type-checking `bind((await loadGlb(character(variant(7)).glb)).scene)` and reading `variant(7).id` as `"gen-7"`,
    and it names the attached player's `apply()` and `bound`;
  - `loadGlb` reads a generated, a textured and a meshopt-compressed .glb in a page, and the consumer lab's bundled page
    binds its test characters through it;
  - the manual is at most 8,000 cl100k tokens;
  - every rule B1 to B8 use is kept, word for word where a decision records it, and no text is cut from a section a
    brief's job draws on;
  - gap 10 says nothing is left of it but gap 1's names and the types left to the compiler, and the lab's README and
    F6.4 agree;
  - the briefs that read the changed sections are listed with why and their bars, and each re-run with real agents
    reaches its bar *(deferred proof: the integrator's re-runs; met, 79 of 83 trials, every brief and variant at its
    bar, D128)*.
- **Verify:** `npm run doctrine && npx vitest run packages/tools/test/manual.test.ts tools/skill/skill.test.ts
  tools/bundle/bundle.test.ts packages/three/test/test-characters.test.ts packages/tools/test/review.test.ts &&
  node tools/manual/main.ts --check && npm run check && npm run pack -- --check && npm run e2e -- capture consumer-ts`;
  the bench as WP-F.4's (`npm run bench -- B<n> --trials 5 --parallel 5` and `--heldout G7` for B1 to B7, B8 with
  `--heldout G9`, `B8-ten --trials 1`)

#### WP-F.9 Honest per-loop contact readings for the rate sweep's failing loops
- **Owns:** `tools/facts/readings.ts` (new), `tools/facts/readings.test.ts` (new), `packages/core/src/clip/facts.ts`
  (`readContacts`, `CONTACT_READINGS`), `packages/core/src/clip/index.ts`, `packages/core/src/validate/clip.ts` and
  `rules.ts` (`facts.reading`: M2-E004, M2-E016, M2-W007), `packages/core/test/clip.test.ts`,
  `packages/core/test/validate.test.ts`, `packages/library/src/facts/index.ts` (`withReading`, `measure` keeping
  `facts.reading`), `packages/library/src/index.ts`, `packages/library/test/library/facts.test.ts`,
  `tools/facts/facts.ts` and `facts.test.ts` (the named-reading rule), `packages/core/src/recipe/track.ts` and
  `packages/core/test/recipe.test.ts` (a named reading's contacts come into a recipe as detected),
  `packages/sensors/src/fix/fix.ts` and `packages/sensors/test/fix.test.ts` (detected again after a fix that changes
  the motion), `packages/tools/src/tools/library-submit.ts` and `tools/intake/check.test.ts` (the text gate takes
  `facts.reading`), `tools/migrate/adopted.test.ts`, `tools/import/sets.ts` (`contacts` per spec),
  `tools/import/import.ts` (`specReading`, `unwritten`, the record's `contacts` and `qa.read`, `withAdoption` dropping
  the name), `tools/import/import.schema.json`;
  spec/MOTION.md §7.1 and §7.3, `spec/schemas/clip.schema.json`, `spec/frozen.json` (refrozen, D129); `library/sets/`
  of CMU_CURATED, STYLE100, STYLE100_RUN, STYLE100_BACK, STYLE100_BACKRUN, STYLE100_SIDE and STYLE100_SIDERUN (through
  `npm run import`), and what the writers write from them: `library/sets.lock.json`, `library/index.json`,
  `library/baselines/rates.json`, `packages/sensors/fixtures/baseline.json`, `library/baselines/distributions.json`,
  `docs/LIBRARY.md`; `library/README.md`
- **Also touches:** `tools/run/changed.ts` and `tools/run/run.test.ts` (`test:changed`'s library rule runs the readings'
  test too); the doc comments that said `labelled` meant a source's labels (`measureFacts`, `playable`, `Contacts`)
- **Needs:** WP-F.7 (D127: the answers and `holds`), WP-F.3 (D123: the rate sweep), WP-F.2 (D122), D104, D108
- **Size:** M (about 650 new lines, tests included; plus the data the tools wrote: 45 clips, 14 set files, rates.json
  (45 rows and 18 answers gone, 25 answers rewritten), the index, the lock, the sensors' baseline 44 rows, the
  distributions and LIBRARY.md)
- **Carry:** none
- **Trigger:** D127's "per-loop readings would fix 167 rows on 68 loops, none added, each fitted to the sweep: not
  taken", and the owner's goal: fix through the writer what the contacts can fix, by a reading chosen on D108's own
  criteria, not on the sweep's result
- **Build:**
  - Twelve named contact readings of an in-place loop (`clip.readContacts`, `CONTACT_READINGS`: the points, the
    velocity, the "still"): the six `measureFacts` and its fallbacks take, each the same as the chain where its path
    fires, and six the chain never takes, readings D122 weighed, new to core.
  - The rule (`chooseReading`): each reading held to D108's bar at the loop's own speed and retimed at 0.5, 0.75, 1.5
    and 2 (both feet, a foot down a fifth of the loop, both ankles within 10% of H0), and of those that pass the one
    whose ground speed is nearest the captured speed; written down before the sweep was read.
  - Each loop whose chosen reading differs measured on the rate sweep, the judge and QA; adopted where none is worse.
  - The adopted readings written by the importer from a name in the set's import spec: `labelled`, the name in
    `facts.reading` (spec §7.1 and §7.3 amended, compatibly: D129) and in `_import.json`; the validator refuses the name
    beside contacts not labelled and the facts check holds the contacts to the name; a change to the motion (a recipe,
    the sensors' fix, an adoption) drops it; the baselines rewritten by their tools; the answers of the loops that
    still fail written again from their rows.
- **Done when:**
  1. The rule is written in the record before any sweep is read for it, its code reads nothing of the sweep, and it
     gives the same choice again from each loop's motion.
  2. Every loop whose chosen reading differs is measured on its 30 rate rows, its 6 judge pairs and its QA verdict, and
     adopted only where it adds no failing row, no judge fail and no worse verdict; the rest keep their contacts, each
     named with why; the rule's effect before that veto is stated beside the outcome after it.
  3. The adopted readings are written by `npm run import` from the import spec's names, each set regenerating byte for
     byte with `--check`, the import refusing a name it can't honour (an adopted clip, a one-shot, a root of its own, a
     loop tagged off its feet, a reading that doesn't stand, a clip the set doesn't write); each clip names its reading
     (`facts.reading`), the validator refuses the name beside contacts not labelled, and `npm run facts -- --check`
     holds each named clip to that reading's contacts and finds a set's import record naming another reading stale;
     the intake's text gate takes the name; a recipe, the sensors' fix and the adopt bot drop it where the motion
     changes.
  4. `npm run sweep -- --rates --baseline` adds 0 rows; every loop that still fails is answered with its rows' numbers.
  5. QA's verdicts are no worse; the sensors' baseline and the distributions are rewritten with the reason (D129).
  6. B1's known-good passes in full; T0, T1 and T2 pass; the spec's freeze names D129.
- **Verify:** `npm run check`; `npm test`; `npm run test:full -- tools/facts/readings.test.ts bench/graders/B1`; `npm run
  import -- --set <each of the 7> --check`; `npm run index -- --check`; `npm run facts -- --check`; `npm run qa --
  --check`; `npm run qa -- library --check`; `npm run sweep -- --rates --check`; `npm run vectors -- --check`; `npm run
  conformance -- --impl ts`; `npm run doctrine`; `npm run sweep -- gen-0 gen-1 gen-2 gen-3 quaternius-mannequin-m
  kaykit-knight --clip <each of the 45>`

#### WP-F.10 Publishing to npm, O2 answered
- **Owns:** `.github/workflows/publish.yml` (new), `tools/release/publish.test.ts` (new), `tools/bundle/README.md` (its
  "Publishing" section, and the two lines above it that said nothing is published until O2)
- **Also touches:** `.github/workflows/release.yml` and `tools/release/release.test.ts` (its assets job checks the
  go-ahead first too, so a re-run of that job alone is checked; an empty owner refused), `tools/bundle/build.ts` and
  `main.ts` (their words on O2)
- **Needs:** WP-7.4 (the packs, `--publishable`), WP-9.4 (`release.yml`'s go-ahead, the workflows' YAML reader), O2
  answered (the owner, 2026-10-22: D130)
- **Size:** M (about 640 new lines, tests included: the workflow 251, its test 319, the README 70 for 19)
- **Carry:** none
- **Trigger:** the owner's answer to O2 (PLAN.md §13): keep the working names `@m3a/*`, publish now
- **Build:**
  - `publish.yml`, run by hand from a tag `vX.Y.Z`, three jobs. Each job's first step is the go-ahead: it fails closed
    before anything is checked out unless the repository variable `M3A_O2_PUBLISH` is `yes`, the repository's owner
    started the run and this attempt, the tag reads `vX.Y.Z` and the run was started from that tag (`github.ref` is
    `refs/tags/<tag>`: npm's provenance names the run's ref and commit). The `go-ahead` job is that step alone.
  - A `build` job (`contents: read`, no token): the tag checked out keeping no credentials, Node 24.21.0 with no cache,
    the tag held to `main`, to its version and to the run's commit (`GITHUB_SHA`), `npm ci --ignore-scripts`, `npm run
    pack -- --check --publishable`, the eight tarballs uploaded as the artifact `packs`.
  - A `publish` job (`contents: read`, `id-token: write`, environment `npm`): no checkout, the artifact downloaded,
    Node 24.21.0 for npm's registry, each tarball's package.json checked, then `npm publish --provenance --access public`
    of each pack in dependency order, a version already on the registry skipped and said, a failure stopping the rest;
    the npm token (`secrets.NPM_TOKEN`, the environment's secret) in the publish step's env alone.
  - Its test, reading the workflow as YAML as `release.test.ts` reads `release.yml`, and running its four scripts on
    stubs; the README's publishing section rewritten to say what is true now and the owner's steps in order.
- **Done when:**
  1. `publish.yml` runs only by hand, and every job's first step, the go-ahead, stops the run before any checkout
     unless `M3A_O2_PUBLISH` is `yes`, the owner started the run and the attempt, the tag reads `vX.Y.Z` and the run was
     started from it (its shell run on stub environments); no key lets a check be skipped or ignored (`if`,
     `continue-on-error`, `shell`, `defaults`: the keys of the workflow, each job and each step are held exactly).
  2. The OIDC token is the publish job's alone and the npm token its publish step's alone, from the environment `npm`;
     every expression in the workflow is one of seven named; the build job holds no token; the publish job checks
     nothing out and runs no code but the workflow's and npm's; the checkout keeps no credentials, npm ci runs no
     install scripts, no cache is restored (asked for or automatic), and the actions are pinned by commit SHA, as
     `release.yml` and `ci.yml` pin them where they do, the comment naming the release.
  3. A tag off `main`, at a version its package.json isn't at, or at another commit than the run's publishes nothing
     (the tag step run in a scratch repository).
  4. The packs are proved from the tag with nothing fetched first: `npm run pack -- --check --publishable` passes in a
     clean copy of the commit, after `npm ci --ignore-scripts`, with no rig or pinned source in `.cache/`.
  5. Every pack `build.ts` makes is published, each after every `@m3a` package it needs: the workflow's order equals
     the one derived from `build.ts`'s packages, the library's opt-in packs and the manifests they ship with; a tarball
     at another version, kept private, naming another repository, needing another version, out of order, missing or
     extra fails the tarball step (run on tarballs the test makes, and on the real eight as the artifact gives them).
  6. A version already on the registry is skipped and said, so a re-run after a partial failure publishes the rest and
     never fails on a published version; a failed publish stops the packs after it; a registry answering neither the
     version nor E404 stops it; each failure names the codes npm gives a token it refuses; no token, nothing runs (the
     publish step run on a stub npm). On the real tarballs the loop goes through all eight with `npm publish --dry-run`.
  7. `tools/bundle/README.md` says O2 is answered (D130), what the workflow does, and the owner's eight steps in order (the tag ruleset and the token's kind after a verifier's review).
  8. The first real publish *(deferred proof: the owner's first run of `publish.yml`, each package's npm page showing
     its provenance from the tag's commit)*.
- **Verify:** `npx vitest run tools/release/publish.test.ts tools/release/release.test.ts`, `npm run pack -- --check
  --publishable`, `npm run check`, `actionlint .github/workflows/publish.yml`

#### WP-F.11 The review page plays its clips, links them in the gallery and opens G8's batch on its own
- **Owns:** `apps/gallery/src/review/*` (new: `batches.ts`, `batches.test.ts`, `play.ts`), `apps/gallery/vitest.config.ts`
  (new), `tests/e2e/review.e2e.ts`, `tests/e2e/previews.e2e.ts`
- **Also touches:** `apps/gallery/src/route.ts` (`clipLink`), `apps/gallery/vite.config.ts` (`M3A_REVIEW_BATCHES`),
  `apps/gallery/src/virtual.d.ts`, `apps/gallery/README.md` (WP-8.1's files); `tools/run/site.ts` (WP-8.3's crossing)
- **Needs:** WP-8.1, WP-8.2b, WP-8.3; G8's batch (D130)
- **Size:** M (1,113 new lines, tests included: 576 in tracked files, 537 in four new ones)
- **Carry:** none
- **Trigger:** the owner, 2026-10-22, doing G8's review on the preview: "why can't it just move here? why do I need to
  open another tab, manually edit a url, view it there, come back... why can't it play here, why is it just still
  images? why can't there at least be a URL pre filled?", and earlier "I don't know why I had to download a file and
  then upload a file that was in the repo"
- **Build:**
  - Each card's **Play** plays its clip, looping, in the card, on the gallery's default test character (`gen-1`) at the
    view its sheet is drawn at (`SHEET_VIEW`, three-quarter, now passed to the sheet explicitly), with the gallery's
    own `Stage` and `ClipPlayer` (no copy). One stage for the page, made at the first Play (three.js loads then, in its
    own chunk) and moved into the card that plays: one WebGL context however many cards play in turn; starting a card
    stops the one playing; Stop takes it out. A sampled clip plays from the library, a submitted clip from its text, a
    recipe compiled as its sheet is (`submissionClip`, shared by the sheet and the player). A card out of sight holds
    still; a frame that fails stops and says why in the card. With nothing playing the page draws no frame: three's
    own loop (r182 runs one from the renderer's init until its dispose, with no public pause) runs only while a card
    plays (its private `_animation`, pinned to r182 in a comment; a release without it plays the same). Playing
    decides nothing.
  - Each card links its clip in the gallery, in a new tab, filled in by the gallery's own route (`clipLink`:
    `../../?clip=SET%2FName`, the review page's `?renderer=webgl2` kept); a submission's links the clip it improves,
    a new one has none (said).
  - The page opens a queue at load: the batch `?queue=NAME` names, else a queue bundled by `M3A_REVIEW_QUEUE` (local
    builds), else the newest batch the build carries; the file picker stays. It says which batch is open (name, file,
    the newest or not) and links each batch the build carries, newest first; a link naming none it carries opens the
    newest and says so. Opening one decides nothing.
  - The build carries the batches `M3A_REVIEW_BATCHES` names (paths, commas between; `none` for none), else the
    committed batches of library clips alone (`committed`: the newest `bench/results/gates/<gate>/queue*.json` in each
    gate's directory, an export made again superseding the one before, when it holds no submission and its rows name
    library clips: G8-run-1's `queue-0.56.0.json`), so `npm run gallery` at a desk opens it too. Each is checked whole
    by `checkBatch`: every key and every value of the queue and its rows, nested ones included (store, date, ref,
    hash, tier, stale, review, numbers and their metrics: each of its type and form). A batch holding a submission, a
    key or value no library clip's row has, or a row that is no library clip fails the build, naming it; nothing is
    dropped or trimmed, and the page gets the queue rebuilt from the values read, never the file's text. The preview
    site (`tools/run/site.ts`) picks the same batches (written again there: nothing imports from apps/), names them to
    the build (replacing the environment's), still drops `M3A_REVIEW_QUEUE`, and says which it carried and which it
    left out, and why (superseded, holding submissions, no queue, not JSON).
- **Done when:**
  1. A card plays its clip in place by touch at a phone viewport on WebGL 2: the character drawn (more than 150 pixels
     read back), the card's canvas changing between two screenshots 400 ms of Playwright's clock apart, the clip's
     time going on by those 400 ms (to 0.05 s, a loop wrapping); a sampled clip, a submitted clip and a compiled recipe
     each play. Stopped, the page calls requestAnimationFrame 0 times in 1 s of the held clock (playing, more than 0);
     Play again plays on the same stage, its frames changing.
  2. One card plays at a time on one stage: starting another stops the first (its control back to Play, its card
     empty), the page holds one stage canvas and made one stage; a second tap stops it; no decision is made.
  3. A card's gallery link is the gallery's route for its clip (a submission's: the clip it improves) and opens it in
     a new tab, the gallery playing that clip with that link.
  4. The preview site carries G8's newest batch alone (`G8-run-1/queue-0.56.0`; its `queue.json` superseded, G9's two
     holding 10 submissions each: all three named in its reply), opens it at load saying which and deciding nothing
     (no row's verdict, no decision in the review), and opens the newest, saying so, for a link naming a batch left
     out; no submission id or content hash of a batch left out is in any file of the site. A build asked to bundle
     G9-run-2's batch fails, naming it, and so does one bundling a batch with a submission's text in a row, nested in
     its numbers or its review, or in a field's value (ref, verdict, store), a row naming a submission, or a clip not
     in the library: each refused as the config loads, writing nothing, whatever an earlier run left.
  5. A local build naming no batches carries the same batch, opens a queue bundled by `M3A_REVIEW_QUEUE` at load as
     before, a link naming a batch winning, deciding nothing; one asked for `none` carries none.
  6. The pure parts (which batches can ship, each key and value check, the queue rebuilt, the committed pick, the
     newest, the link's pick, the clip link) have unit tests.
- **Verify:** `npm run e2e -- review previews gallery`, `npx vitest run --config apps/gallery/vitest.config.ts`,
  `npm run check`, `npm test`

#### WP-F.12 The review page says what a review is for, and each card what its clip should show
- **Owns:** `apps/gallery/src/review/*` (new: `shows.ts`, `shows.test.ts`), `tests/e2e/review.e2e.ts`
- **Also touches:** `apps/gallery/README.md` (WP-8.1's file)
- **Needs:** WP-8.2b, WP-F.11; G8's review (D133)
- **Size:** M (486 new lines against the G8 commit, tests included: 278 in tracked files, 208 in two new ones; 419 as
  built, 67 more from the review's fixes)
- **Carry:** none
- **Trigger:** the owner, 2026-10-22, after reviewing G8's 20 clips on the preview's review page: "Probably give clear
  directions when someone opens that page, so they understand what they are doing. I honestly had no idea what the
  expectation was for most of these. ... idk how LLMs would select an animation but maybe you should explain that as
  well so I can better understand my role. Technically, without knowing the name of animations or what they were to
  do, they didn't look broken", and in LawnMower_SideLeft's note: "I think you need to state what the expectations are
  of what I am supposed to see and what you think is happening" (D133).
- **Build:**
  - **A guide** at the top of the review page (`index.html`'s `#guide`, static, plain words, about two phone screens),
    open on a first visit and collapsible, its open or closed kept in this browser's storage (`m3a.review.guide`, each
    read and write in try/catch: a private window opens it). It says what these clips are (sampled from the library AI
    agents use to put motion into games); how an agent chooses one (by its words: name, tags, description; and its
    numbers: how fast it travels, whether it loops, how long; it never watches the clip play, so a clip whose words
    don't match its motion misleads every agent that picks it); what the sensors already check (feet sliding, sinking into
    the floor, sudden jumps between frames, limbs through the body) and what they can't (whether it is what its words
    say, whether it looks natural and alive); the reviewer's job per card (Play; read "What it should show"; Approve if
    a game developer asking for exactly this would be happy with it; Flag if it looks broken, doesn't match its words,
    with examples, or no game could use it, saying why); a note's "task:" and "threshold:"; Export and send the file;
    playing or reading decides nothing. No jargon (no H0, contacts, refs, motion hash). After review: an agent "never
    watches the clip play: at most it reads a short summary a computer makes of the movement ("walks", "in the air") or
    looks at a few still frames" (describe, sheet, film); a card's PASS, WARN or FAIL is the sensors' result, a WARN or
    a frame marked red is where to look closely, deciding nothing; Flag's example is "an idle that is a frozen pose"
    ("an idle needn't travel, but its body should move"); the file goes "back to whoever asked you for this review
    (they apply it with one command)". A closed guide is closed by an inline line right after it, before the page
    shows (no flash of an open guide); main.ts keeps the choice.
  - **"What it should show"** on each card (`shows.ts`, pure; `view.ts` `showShows`), under its name and above its Play
    and its verdicts: its description as its file holds it (or that it has none, "worth a flag"); "Loops: it repeats
    with no break, N s each time" or "Plays once, N s long"; whether it travels, which way in its own frame (eight
    ways: forward, forward and to its left ... backward) and, from its speed fact, how fast in metres a second on the
    library's reference body (0.95 m hips: `mps`, the m/s search shows an agent) and as a grown-up's pace (a shuffle, a
    slow walk, a walk, a brisk walk or slow jog, a jog, a run, a sprint), a one-shot by where it ends ("Moves to its
    right: it ends about 0.5 metres from where it starts"); "Doesn't travel across the floor" or "Ends about where it
    starts" otherwise (never "stays", which a reviewer reads as "holds still": a frozen idle is theirs to flag); its
    tags. Read from the clip itself: a sampled clip from the library the page bundles (its set loaded when its card
    comes), a submission from its own clip (a recipe compiled as its sheet and Play compile it), its facts measured on
    the page as adoption measures them (@m3a/library's `withFacts`), never taken from its file. Each card's words come
    as its clip is read, alongside the sheets (`__m3a.described()` resolves with how many cards say it); the first
    card waits for its own set alone, as before F.12.
  - The review actions list names both (the guide: the README; what a clip should show: `m3a show`, with the tier note).
  - Everything else as it was: the sheet, Play, the gallery link, the verdicts, the export, the batch opening.
- **Done when:**
  1. A first visit opens the guide with its key sentences (the clips' origin, how an agent chooses, "It never watches
     the clip play:", what the sensors check and can't, what PASS, WARN or FAIL means, Approve's and Flag's tests,
     "task:" and "threshold:", Export and send the file back), none of H0, contacts, refs or motion hash; a tap closes
     it and it stays closed on a reload (closed before the page's script runs), opened again it stays open.
  2. Each library card's "What it should show" is its clip's description from its file, its loop or once and its
     length to the hundredth, its travel's numbers from its facts (the m/s search shows, or metres where a one-shot
     ends), its tags, before its verdicts: the e2e scratch queue's 20 and G8's 20; a submission's is its own clip's
     (the one kept as it is says "walks, kept as it is"; it and the one whose file claims a stale speed both travel at
     Walk_Loop's measured speed; the recipe's, compiled, says how it plays); nothing is decided (0 decisions, no
     verdict or note on any row). A closed guide is closed with the page's scripts served empty.
  3. The pure words (the eight ways, metres and metres a second as `mps` says them, the paces and their bounds, a
     length, a loop's and a one-shot's travel, no travel never said as "stays" or "still", no facts, a malformed
     travel, no description; G8's 20 clips from their files, its idles not travelling and its side runs at a walk)
     have unit tests.
  4. A phone's screenshot of the guide and G8's first card: `check-output/review/guide.png` (390 x 2319).
- **Verify:** `npm run check`, `npx vitest run apps/gallery`, `npm run e2e -- review previews gallery`

#### WP-F.13 The idles keep their motion, steady at the knees, through recipes too; a still check; Jump_Twist cut again
- **Owns:** `packages/core/src/format/motion.ts` (new), `pose.ts` (`steadyBend`), `fit.ts` (`spaced`), `index.ts`;
  `packages/core/src/recipe/compile.ts` (`budgetsOf`); `packages/io/src/import.ts`, `packages/io/README.md`;
  `packages/sensors/src/metrics/still.ts` (new), `metrics/index.ts`; `packages/tools/src/tools/library-submit.ts`;
  `tools/import/import.ts`, `tools/qa/library.ts`, `main.ts`, `verdict.ts`, `qa.schema.json`; `tools/intake/gates.ts`,
  `fixtures.ts`, `fixtures/submissions.json`; `tools/corpora/style100.ts`; `spec/RECIPE.md` §3 (not frozen); their tests
  (new: `packages/io/test/motion.test.ts`, `packages/sensors/test/still.test.ts`, `tools/import/fidelity.test.ts`).
  Through their writers: `library/sets/{MESH2MOTION,STYLE100_IDLE,CMU_CURATED,STYLE100_RUN,STYLE100_BACKRUN}/**`,
  `library/sets.lock.json`, `library/index.json`, `packages/sensors/fixtures/baseline.json`,
  `library/baselines/distributions.json`, `docs/LIBRARY.md`. By hand, the inputs no writer makes:
  `library/catalogs/CMU_CURATED.json` (Jump_Twist's stretch and words), `library/baselines/qa.json` (`still`).
- **Also touches:** `apps/gallery/src/review/shows.test.ts` (WP-F.12's: Jump_Twist's new length and travel)
- **Needs:** WP-5.3, WP-5.4, WP-5.8, WP-6.1, WP-9.1; G8's review (D133); after WP-F.12 (clip files change in sequence, §8.4)
- **Size:** M (958 new lines of code, comments and tests outside the library, in 32 files; two rounds, each reviewed)
- **Carry:** none
- **Trigger:** the owner's G8 review (D133): "This is a pose. There is no actual animation" (STYLE100_IDLE/CrossOver_Idle,
  OnPhoneLeft_Idle), and of CMU_CURATED/Jump_Twist "The character never gets to the actually jump, just leading up to it".
- **Build:**
  - **A clip's own motion bounds its fit** (core's `format.fitLimit`, used by `importSet`): a capture reaching 60 mm or
    more is fitted at 30 mm exactly as before; one reaching less within min(30, max(3, 0.5 × far)) mm, `far` how far it
    strays from the in-between of its ends (or its reach where that is less), so the frame that strays most, and with it
    the sway, is kept; `motion: false` fits at the fixed limit (the 100STYLE corpora check, reproducing shardfall's).
  - **Steady knees and elbows** (core's encode option `steadyBend`, off by default): a limb its joint shows bent 15° or
    less takes its bend from that joint, fading to the root-to-end reading by 25°; **no key one frame from a key**
    (core's fit option `spaced`, off by default). `importSet` sets both for a clip it fits within its own motion.
  - **Recipes keep it:** `recipe.compile` with no budget bounds each frame's budget by the motion of the second around
    it (`budgetsOf`), measures a calm frame beyond its own key's rounding and keys no calm frame beside a key; `keysOf`
    with one budget is unchanged (procedural moves, gaits, every explicit budget).
  - **The still check** (one rule, `@m3a/sensors` `checks.STILL`, `reachOf`, `isPose`): `npm run qa -- library` fails a
    clip whose body points all stay within 3 mm of where they start unless tagged `pose` or `reference` or answered in
    `library/baselines/qa.json` `still`; `m3a library submit`'s lint gate, the checker and library-gates refuse it where
    it is sent ("it never moves ... Give it its motion, or tag it pose if it is a held pose").
  - **Jump_Twist cut again** from CMU 85_01 at 3.65 to 7.80 s, "A kick up into a twisting flip, landing in a spin to face
    forward again"; a clip its catalog cuts from another stretch than its migrated version's is weighed as new.
- **Done when:**
  1. Frozen clips (every key one pose) 102 → 17: 13 tagged poses, 4 answered (the Quaternius sets' Driving_Loop and
     Sitting_Idle_Loop, frozen in their pinned sources); only clips that move little change (1,100 of the 1,208
     captures reach 60 mm or more and are fitted as before); the vectors, tiers 1a to 3 and `moves.json` byte for byte.
  2. No knee or elbow of a clip fitted within its own motion moves 20 mm or more beyond its capture's (16 did, up to
     54 mm) and none past its fit limit but six named with their reason; no shown point snaps; `fidelity.test.ts` pins
     the bound.
  3. Through a clip step, a mirror or a retime 0.8, 0 of the 87 re-fitted idles compile to one pose (83 did); blended,
     a few keys, not a staircase; sequenced, 3 of 170 swaying stretches lose half their sway (160 did); 19 of
     spec/recipes' 20 examples and the library's 7 actions byte for byte.
  4. A frozen idle is refused at lint in the intake and outside it, the same idle moving passes; five tests fail with
     the gate removed; the library passes the still check.
  5. Jump_Twist holds its flip (hips to 150% of H0, upside down, landing, facing forward again); every baseline moved
     is rewritten by its writer, with its reason (D135).
- **Verify:** `npm run check`, `npm test`, `npm run import -- --check`, `npm run index -- --check`,
  `npm run library -- check`, `npm run facts -- --check`, `npm run qa -- --check`, `npm run qa -- library --check`,
  `npm run sweep -- --rates --check`, `npm run vectors -- --check`, `npm run conformance -- --impl ts`, `npm run doctrine`,
  `npm run migrate -- --check`, `npm run plant -- --check`, `npm run gate -- library-pr --fixture all`, `npm run e2e`

#### WP-F.14 Playback as the data says: a clip's turn shown once, the data comparison, the test characters painted
- **Owns:** `packages/core/src/animator/animator.ts` (`AnimatorPose.turn`, `Animator.place`),
  `packages/core/test/animator-turn.test.ts` (new); `packages/three/src/play/write.ts`, `attach.ts`,
  `packages/three/test/turn.test.ts` (new), `packages/three/test-characters/characters.ts` (the paint);
  `apps/gallery/src/place.ts` (new), `stage.ts`, `player.ts`, `gallery.ts`, `main.ts`, `index.html`,
  `src/review/index.html`, `src/review/play.ts`, `src/playback.test.ts` (new), `README.md`; `packages/sensors/src/raster/mannequin.ts`,
  `packages/sensors/test/raster.test.ts`; `packages/tools/src/sim/simulate.ts`
- **Also touches:** `tools/run/e2e.ts` (T2's sweep list), `docs/MIGRATING.md` (the root-motion row)
- **Needs:** WP-4.4, WP-6.5, WP-8.1, WP-F.11, WP-F.12
- **Size:** S (about 390 new lines, tests included)
- **Carry:** none
- **Trigger:** the owner, reviewing CMU_CURATED/Pick_Up_Basket in chat (2026-10-23): "that character does a 360 and
  then walks backwards", where its data turns about 190° to its right and walks forward back to its start; their
  experiment, "colour code the gen-1 ... snapshot from the same perspective at the same time ... see if they look the
  same", which showed gen-1 facing away from the sheet from 2.35 s on; and "could we not make a tool that at least
  compares things on 'data' level between the two?"
- **Build:**
  - **One rule for a turn:** a pose carries its own clips' turn (each clip's `yaw` at its playhead, spec/MOTION.md §5.3);
    the root places it; what the root has turned beyond (a loop's earlier cycles, an earlier clip, a `place`) is the
    pose's `turn` (core's `AnimatorPose.turn`), and @m3a/three's attach writes the pose turned by it, so a game that
    moves the character by `travel` alone (the manual's way) faces where the root heads. The turn is measured at each
    step, `place` or `restore`, so a scrub (a clip's time set without a step) shows the clip as written.
    `Animator.place(root)` sets where the root stands (a respawn, a teleport). Nothing turns a character by `root.yaw`:
    the gallery's stage turned its carrier by it (the turn shown twice), the sensors' raster turned a pose by it (film,
    retarget's and a graph's strips), and a graph sim's frames after a turning state faced their own clip's way.
  - **The fixes:** the stage places the character and turns it only by what its bones don't carry (`place.ts`, the
    player's `turn`: a clip posed by time alone leaves a loop's earlier cycles, a stepped graph nothing); the raster's `capsules(points, root)` moves by the root's place alone, as the sensors' `world`
    does; `simulate` records each frame turned by its `turn`; the writer turns only when the turn isn't 0 (its hot path
    still allocates nothing).
  - **The data comparison** (`apps/gallery/src/playback.test.ts`): at 8 moments of each clip, the character the gallery
    poses and places against the clip's data (decoded on its own body, on its root's path), where bodies of other
    proportions still agree: the hips' facing (within 5°), the travel's direction once the data has moved half a hip
    height (within 60°), each clip's median limb direction (within 25°). T1: the 74 clips that turn, on gen-1; T2
    (`M3A_FULL=1`): every clip on gen-1 and gen-0 (gen-2 and gen-7 pass too). One clip is named with its reason:
    QUATERNIUS_SHARDFALL/Swim_Idle_Loop, a body under the floor (follow-up).
  - **The test characters painted** as the sheets' mannequin: the left side blue, the middle and right amber, the
    torso's and head's back half darker, a red nose; a legend beside the gallery's stage for a `gen-` character, and a
    sentence in the review page's guide.
- **Done when:**
  1. Facing: 0 of the 1,398 clips off by more than 5° on gen-0, gen-1, gen-2 and gen-7 (on gen-1, 55 were, by up to
     179°: Hopscotch, Pick_Up_Box, Pick_Up_Basket 174°, Jump_Kick, Stumble_Turn ...); Pick_Up_Basket turns half round
     and walks forward, as its sheet; the comparison fails when the stage turns its carrier again.
  2. attach: a clip that turns half round, then a walk: the walk faces the turn's end and walks forward (166° off
     before), on gen-1 and gen-7; fails when the writer drops the turn.
  3. The Animator's `turn` is 0 while one clip plays from its start, an earlier clip's turn after it, a loop's earlier
     cycles' turn, and follows `place`; the raster places a pose without turning it.
  4. The writer's hot path allocates under a byte a frame; T1 and T2 within their budgets.
- **Verify:** `npm run check`, `npm test`, `npm run e2e`, `M3A_FULL=1 npx vitest run apps/gallery/src/playback.test.ts`

### On demand

Each starts only when its trigger fires; record the measurement that fired it. A trigger that never fires means the WP
wasn't needed.

| WP | Trigger | What it builds |
|---|---|---|
| **D.1 Creatures and body plans** | A consumer or brief needs a non-humanoid character | Body-plan profiles (quadruped, hexapod, serpent, bird); procedural gaits with planted feet, porting the stepping groups of my-3d2dge's `BST_Crawler` (`src/emberdeep/33-beasts.js:85`); riftlight's semantic `Poser`, which animates any generated body from one template (`src/riftlight/monsters/anim/poser.ts`); a solver for any body plan; creature briefs |
| **D.2 Hands and fingers** | Grip or prop defects measured on at least 10 clips | Finger curls from the sources, hand-to-prop targets, grip presets |
| **D.3 Faces** | A consumer needs expressions or visemes | Blendshape channels (VRM expressions), timed from text or audio |
| **D.4 Physics and balance** | A brief needs physical reactions; penetration can't be fixed kinematically; or the owner flags clips that look off-balance | Active ragdolls on Rapier (`@dimforge/rapier3d`, Apache-2.0; multibody motors and MJCF import added in 2026) with PD motors; hit reactions; a balance metric (the centre of mass over the support polygon); a physics pass that checks and fixes contacts (using simulation as a verifier lifted upright execution from 80.5% to 89.5% in research); deterministic inside `step` |
| **D.5 Motion matching** | Blend-space locomotion fails a responsiveness brief | A feature database built from the library's locomotion (100STYLE is CC BY 4.0, ~18.5 h); search in `step`; WASM if needed (Daniel Holden's MIT demo already builds to WASM; its LaFAN1 data can't be used) |
| **D.6 A Rust core** | A Rust consumer adopts format 2 | Certification against the kit, tiers 1 to 3, starting from shardfall's codec |
| **D.7 Engine exporters** | A consumer works in that engine | Godot `.tres` AnimationTree, Bevy `.animgraph.ron` and Unity YAML controllers, generated from graphs |
| **D.8 Runtime compression** | A shipped game's motion payload is over its budget | Quantized tracks in the style of ACL, generated from text with the error recorded |
| **D.9 A generative backend** | The owner approves a source whose terms allow distributable output (O5) | An adapter behind the socket, its output labelled. The first candidate is NVIDIA Kimodo: Apache-2.0 code, weights under the NVIDIA Open Model License, trained on licensed studio mocap, constraint-driven, needs a GPU, so a remote backend. Its caveats: NVIDIA may change the license at any time; it is realistic-only, capped at 10 s, and skates (3.87 cm/s against 2.21 for capture). So every output passes the gates, with the license version recorded. Tencent HY-Motion's license bars it (it excludes the EU, UK and South Korea, and forbids using outputs to improve other models) |
| **D.10 WebMCP** | The owner wants browser agents to drive the gallery | The tools registered on `document.modelContext` (a W3C community-group draft, in a Chrome origin trial) |
| **D.11 Capture from video** | The owner wants new motion captured from video | A source built on a commercially usable body model (Meta's SAM 3D Body and MHR, or SOMA-X/Anny). Not GVHMR and not SMPL-based pipelines, which are non-commercial |
| **D.12 The origin plays format 2** | The owner wants my-3d2dge to consume the package | A shim that plays format-2 clips on my-3d2dge's Canvas Humanoid through its `Mocap.drive` contract. It lives in my-3d2dge or as a lab here, and needs the chibi rig, which this package doesn't carry |

---

## 11. Running modes

### One agent (effort: max)

Work the ledger in order. Use subagents for independent WPs within a phase only when their **Owns** don't overlap.
Give every L WP and every gate a verifier subagent. At the gates that grade briefs (G4, G6, G7, G9), a separate fresh
subagent that has not read the manual's examples writes the held-out variants and chooses G4's held-out rig (§7, §9.3).

### Ultracode (multi-agent)

- **The integrator** (the main session) owns the shared files of §8.4 and does every merge. On top of those it owns
  `docs/DECISIONS.md`, the root `package.json`, the `tsconfig` roots and the generated docs.
- **The spine runs single-threaded through G1**, because the contract must come from one mind.
- **From G1 on,** up to 5 implementers work in git worktrees, each editing only its WP's **Owns**. A verifier reviews
  every L WP and every gate and returns JSON. A separate fresh subagent writes each gate's held-out variants (§7).
- **Lanes after G2:**
  - Q: Phase 3, which can start after WP-2.4;
  - R: Phase 4;
  - L: Phase 5, which can start after WP-1.5;
  - A: Phase 6.

  The clip-writing WPs stay in sequence (§8.4).
- **Lanes never wait on the owner.** The integrator escalates, at most once per run.

**Implementer prompt** (template):

```
You implement WP-<n.m> of PLAN.md in <worktree>. Read DOCTRINE.md, AGENTS.md, the WP entry and only what it cites.
Edit only the paths in Owns. Meet every Done-when and prove each with Verify. Run T0 and T1 before you report.
Report in at most 30 lines: what you built, the Verify output (pass/fail with numbers), deviations with reasons,
open questions.
```

**Verifier prompt** (template):

```
Review WP-<n.m> at <commit> against DOCTRINE.md and the WP's Done-when. Run its Verify commands yourself.
Return JSON: {"pass": true|false, "failures": [{"what": "", "where": "", "fix": ""}], "notes": ""}.
```

---

## 12. Risks and kill criteria

Ranked by how hard each is to undo: **R8** (library contamination), **R1** (retargeting), **R2** (adoption), then
execution (sizes overrun; §8.2 budgets for it), then **R5** (blind or gamed metrics).

| Risk | Warning sign | Mitigation | WPs |
|---|---|---|---|
| **R1** Retargeting onto real rigs looks wrong | Sensors red on real rigs at G4; the owner flags clips | An IK-space format, mapping reports and patches, per-rig rest normalization, foot locking | 1.4, 2.4, 2.5, 4.3 |
| **R2** Agents don't reach for the package (the Vesper failure) | B1 scores low; agents read past the manual | The manual first; good defaults and examples; the skill; the benchmark tests discoverability itself | 4.7, 7.3 |
| **R3** The library is too thin or too raw for games | Search misses; the owner flags quality | Recipes, actions and procedural sources; re-import with the new degrees of freedom; purchases (O4); generative sources (D.9) | 5.3, 6.x |
| **R4** The format's limits show (wrists, spine, fingers) | Metrics or reviews flag prop holds and curled spines | Named optional degrees of freedom; re-import from the sources; a dense sidecar track as the fallback | 1.1, 5.3, D.2 |
| **R5** The sensors miss defects or cry wolf | Planted recall under 100%; the owner flags a clip that passed | The planted-defect suite; calibration; human sampling feeding new checks | 3.6, 8.2 |
| **R6** Scope creep (faces, creatures, physics, other engines) | WPs with no gate or brief behind them | The scope rule; on-demand triggers | §2, D.x |
| **R7** The ground moves under us (Khronos `KHR_character_*`, three.js releases, a leap in generative models) | New releases or ratifications | The spec watch; the socket; deliberate pin upgrades | 1.4, 4.1, 9.2 |
| **R8** Library contamination: a clip with tainted provenance ships in games and can't be recalled. The origin's CMU record already omits the no-resale clause; open AI catalogs were flooded (Fab) or poisoned (ClawHub) | Gates fire; the owner flags contributions; a license audit finds a gap | License namespaces; the seed audits (the CMU notice, Mesh2Motion, UAL2 v2.2); allowlists; provenance; dedup; disclosure; rate limits; a signed-in identity for every submitter; the owner's review before adoption; signed releases for the package's own code | 1.5, 5.3, 5.7, 7.4, 8.2, 9.1, 9.3 |
| **R9** Determinism breaks across platforms | A hash mismatch | Portable math in hashed paths; parity tests in CI | 2.1, 2.6 |

**Kill criteria.** Each one stops the affected work and escalates to the owner.
- **K1:** G4 fails twice. Stop Phase 4 and write `docs/POSTMORTEM-M1.md` with the options: VRM-normalized targets only,
  dense rotation tracks, or mapping work per rig.
- **K2:** B1 still scores under 3 of 5 after the manual's second revision. Stop the agent-facing work and run a friction
  study, in which fresh agents narrate what they were looking for.
- **K3:** a license finding removes a seed set. Move it to `library/local/`; if that drops the library under G5's
  floor, escalate.

---

## 13. Owner decisions

Each has a default; proceed on it. Escalate the hard-to-undo ones (§3) when the WP named in the last column reaches
them.

| Id | Decision | Default | Why | When |
|---|---|---|---|---|
| **O1** | The code license | **Answered: MIT** (the owner, 2026-10-11; `LICENSE` committed) | Matches my-3d2dge; permissive, so the package can become a standard | WP-0.1 logs it |
| **O2** | Package names and publishing (npm, crates, release assets, a public benchmark) | **Answered: publish now, under the working names `@m3a/*` and `m3a`** (the owner, 2026-10-22, D130): npm from `publish.yml` with provenance, the sets as release assets from `release.yml`, each started by the owner alone; before it, build everything and publish nothing | Publishing can't be taken back | WP-7.4, 9.4, F.10 |
| **O3** | A Vercel project for previews | **Answered: linked, paused by the owner (2026-10-14, D85), then unpaused (2026-10-22, D130)**: every branch builds its preview from `vercel.json` | Linking reaches outside the repo | WP-4.6, 8.3 |
| **O4** | Purchases (Quaternius UAL1 Pro, $9.99; UAL2 Source, $14.99) | Free editions only | Spending | WP-5.3 |
| **O5** | External generative services (cost, keys, output terms) | None. The socket ships with library, recipe and procedural sources and a mock | Spending, plus license risk | WP-9.2, D.9 |
| **O6** | CC BY content (100STYLE) | Accept it, in its own opt-in set (CC0 is the default pack, D10), with a credits tool | 18.5 h of locomotion styles; attribution is cheap to automate | WP-1.5, 5.3 |
| **O7** | Who adopts contributions | **Answered: the owner adopts every clip** (2026-10-11), after the automated checks; nothing is adopted automatically | Human review before adoption is what kept registries clean | WP-8.2, 9.1 |
| **O8** | Where submissions and reviews are stored | **Answered: a Supabase project, free tier** (the owner, 2026-10-11); the session may create it (the owner, 2026-10-22, D130), through the Supabase connector, connected by 2026-10-24 (D137: the README's steps 1 and 2 through it); the project `m3a-intake` created 2026-10-27, steps 1 and 2 done (D138). Until it is linked, the local store stands in and phone reviews travel as a JSON export | A hosted inbox lets any agent submit without access to the repository; the repository stays the library | WP-8.2, 9.1 |
| **O9** | Acting in other repositories (switching my-3dge's animator WPs 3.4–3.7 and its Phase 8 to this package; certification PRs in shardfall) | Propose, don't act | Reaches outside the repo | WP-10.1, 10.2 |
| **O10** | Keys for other vendors' models in the benchmark (GPT, Gemini and others) | Claude models only, through the session's own access | Keys are spending and credentials | WP-4.7, G7 |
| **O11** | Rights to the code and data carried from riftlight, shardfall and my-3d2dge-2, which have no repository license file | **Answered: MIT, granted by their author** (the owner, 2026-10-11); third-party clips keep their per-set licenses (D10) | §4 carries their code into this MIT repository | WP-0.1 logs it |

---

## 14. Ledger

One row per WP, in execution order, updated with the status (`todo`, `doing`, `done`, `blocked-owner`, `deferred`),
version, commit, date and a note with the numbers. Gates are rows too. Phase pull requests are squash-merged: the
commits named here are on their PR branches (`refs/pull/<n>/head`).

| WP | Status | Version | Commit | Date | Note |
|---|---|---|---|---|---|
| 0.1 Constitution | done | — | e8352fb | 2026-10-11 | DOCTRINE.md (12 principles + enforcement table), AGENTS.md, CLAUDE.md; D1–D21 logged (O1, O7, O8, O11, CMU/Mesh2Motion); PROGRESS 24 lines |
| 0.2 Toolchain | done | 0.1.0 | 09b64d0 | 2026-10-11 | 6 workspaces; T0 3.0 s/15, T1 1.3 s/90 (7 files, 16 tests), T2 6.4 s/480 (Chromium 1194, WebGL 2 on SwiftShader); D22 |
| 0.3 Doctrine checks | done | 0.1.0 | 43d219e | 2026-10-11 | 7 checks in 0.2 s, part of T0; 14 tests, each check with a failing fixture; gpt-tokenizer 4.0.0 pinned |
| 0.4 Pins and reference vectors | done | 0.1.0 | 20ad7a7 | 2026-10-11 | 5 repos pinned; 13 vector files, 6.14 MB + 1.0 MB frozen = 7.14 of 10 MB; tiers 1a (rig, CMU 09_02), 1b, 2 (325 clips, 6,469 keys), 3 (11 bodies); oracle = shardfall's expected sets; D23 |
| 0.5 CI and session setup | done | 0.1.0 | d594f61, 9218ce1 | 2026-10-11 | CI green on #4 at 9218ce1 (T0+T1 on push 16 s, T2 on the PR 33 s); fresh clone: hook 2.6 s, then check 4.2 s of 15 |
| **G0** | done | 0.1.0 | bae664e | 2026-10-11 | 4/4 in 5.1 s: check 1.3 s, test 1.3 s (41 tests), doctrine 7/7, vectors 13 files byte for byte; verifier: 4 findings fixed (D24) |
| 1.1 The motion spec | done | 0.2.0 | 7d1bd44 | 2026-10-11 | MOTION.md 2.0-rc (15 sections, every vector and seed-set field mapped); LEGEND.md 792/800 tokens; ranges from the 7 seed sets (spins reach 1086°); quiz deferred to WP-4.7, met there (10/10 in 3 trials, D54) |
| 1.2 Schemas and the validator | done | 0.3.0 | bcd90e6 | 2026-10-11 | 30 rules, each with a passing and a failing fixture (46 tests); Ajv agrees on 11 structural rules; 762 seed clips: 0 errors, 301 warnings as predicted; D25 |
| 1.3 The codec | done | 0.4.0 | 02efc99 | 2026-10-11 | tier 1a bit for bit (5 clips); tier 2: 7,444 samples of 325 clips equal to the micrometre; text, mirror and mirror-twice exact; 1,214 lines with tests; verifier: 3 findings fixed (D29); D26, D27 |
| 1.4 The skeleton profile | done | 0.5.0 | 76c6942 | 2026-10-11 | 8 tables × 3 name styles exact; topology maps renamed Mixamo and rig skeletons (conf 0.85); measure = tier 1a rests bit for bit; restPoints within 0.001 mm; 32 tests; D28 |
| 1.5 Migrate the seed sets | done | 0.6.0 | 48de33a, 08087bf | 2026-10-11 | 5 sets, 525 clips, 0 errors, 171 warnings baselined; keys equal their sources; 3 sets decode within 1 µm of tier 2; catalogs ≤40 tokens (34 rows cut); 4.3 MB; D30 |
| **G1** | done | 0.6.0 | 6bffb3e | 2026-10-11 | 7/7 in 11.0 s: T0 1.3 s, T1 3.0 s (178 tests), doctrine 8/8 (10 files frozen), tiers 1a and 2, migrate --check, migrated library; verifier: 7 findings fixed (D32), notes F1 |
| 2.1 Math kernel and determinism | done | 0.7.0 | 01706fd | 2026-10-11 | 13 functions give V8's bits on 200k inputs each, random bit patterns and specials; pow ≤1 ulp of glibc; core.json bit for bit; V8 = JSC on 2.8M results and a 100k-step chain; cost 0.7–4× native (D33) |
| 2.2 Sampler, events, contacts, facts | done | 0.8.0 | d774088 | 2026-10-11 | sample = tier 2 at 7,444 samples; loop events once; yaw 90/360/720° continuous, rootDelta carries seams; truth 20/20: speeds ≤11%, distances ≤0.2% or 0.2% of H0, strikes ≤0.06 s (D34) |
| 2.3 Pose operations | done | 0.9.0 | c20b087 | 2026-10-11 | mirror twice = identity on all 525 clips (≤0.5 mm); blend 0/1 = inputs; retime keeps order and contact shares; synced walk–jog/sprint blends keep planted feet ≤18.5 mm (by time, out of step: >100 mm) (D35) |
| 2.4 The solver | done | 0.11.1 | 498fab2, d854578 | 2026-10-11 | reference body: joints ≤0.0018 mm of the solver's decode at all 7,572 tier-2 samples (≤36.5 mm of the plain decoder on the 124 with a lower spine share); roll: mirror ≤3.4e-6°, bend sweeps ≤2°/step, T = A = relaxed ≤1e-4°; tier 3 on 7 bodies × 1,324 poses: limbs ≤9° (0° to rounding), chest exact, lengths kept, soles ≥ floor, no NaN (D36) |
| 2.5 Contacts and ground | done | 0.11.0 | 39c7ad5 | 2026-10-11 | 133 locomotion loops + synced blends: planted contact point slides 0.0 mm per contact (free: up to 92); 10° slopes and 0.2 m steps: planted soles within 1.7 mm, none under; pelvis drop ≤0.1 H0 (D37) |
| 2.6 The Animator | done | 0.12.1 | 7d8cef6, ba5e792 | 2026-10-11 | 480-step script: state hash every step, 29 events and 5 exact poses identical in Node and Chromium, with poses skipped, every step or alternating LOD; save at every step → restore via JSON → next 40 identical; changed/missing clip refused by name; feet ≤10 mm; step 1.4 µs, pose 0.20 ms (4 layers, 4 cores); API 38 of 40, documented ; review: seams once a cycle at any speed, one-shot ends once, no −0, body and in-place edits refused (D38) |
| **G2** | done | 0.12.1 | a5fb0a0 | 2026-10-11 | 8/8 in 42.1 s: T0 1.7 s, T1 14.8 s (305 tests), doctrine 8/8 (API 38/40), vectors, tiers 1a–3, Animator Node = Chromium (480 hashes, 41 events, 5 exact poses), V8 = JSC (math, chain, Animator), property tests; verifiers: WP-2.4 8 + G2 7 findings fixed (D36, D38), notes F2, F3 |
| 3.1 The software raster | done | 0.13.0 | 7b81c29 | 2026-10-11 | 5 views + turntable: same PNG bytes in two runs and a second process; 1,000 × 1,000 in 9.5 ms (≤50); left blue / right amber by view, the jabbing fist blue, amber when mirrored; NaN pose blank and named (D39) |
| 3.2 Sheets, films and diffs | done | 0.14.0 | 159ea49 | 2026-10-11 | 2 s clips: 1,000 × 404, 539 tokens (budget 1,400); 41 frames shrink to ≤1,000 tokens; identical diff empty; a one-key arm edit marked in exactly the frames between its neighbours, box holding the edited elbow and fist (D40) |
| 3.3 The metrics | done | 0.15.1 | f526e7d, c10d0f1 | 2026-10-11 | 14 metrics + 6 predicate forms, unit fixtures that fail on 48 of 48 mutants (36 tests); library in 5.6 s within T2: 268 pass, 111 warn, 146 fail (twist flips 92, jitter 34, pops 27; after D43, 267 / 104 / 154: twist flips 92, jitter 45, pops 25); thresholds from capture (158 clips) with unit, rate, scaling and reason; the verifier's 12 findings fixed in 0.15.1 (D41) |
| 3.4 Describe | done | 0.16.0 | f186cd3 | 2026-10-11 | 30 of 30 reviewed truth clips right (bar 27): the verifier agreed with 23, corrected 2, dropped 7, labelled 7; deterministic, at most 91 tokens over all 525 clips (5.7 s) (D42) |
| 3.6 Planted defects | done | 0.17.0 | 7eee99f | 2026-10-11 | 100 of 100 planted defects (10 kinds, 100 clean clips) flagged by their metric at their times; consequences implied in 14 runs; false positives in 3 runs (3%), each named; jitter and folding fixed on the way (D43); at G3 (0.19.0): valid planted clips, slides on 9 stances within their clips found within 0.1 s of them, 100 of 100 within their stretches, false positives in 3 runs |
| 3.5 Lint and fix | done | 0.18.0 | 821c668 | 2026-10-11 | six operators, each removing its planted defect on every WP-3.6 run of its kind (50 runs) without pushing another metric past warn; no operator moves dur, an event or a contact unreported; re-fit within 5 mm or a key budget; 16 of 16 mutants fail the tests (D44); reworked at G3 (0.19.0): valid keys, a step that would push a metric past a level not applied, loops kept closed; G3's second review (0.19.1): a step that raises a metric at warn over 5%, adds findings or lowers none it answers not applied either, twist flips spread the short way, foot locks only on the locked leg and not on in-place stepping loops; over the library 252 clips linted, 144 better, 53 with fewer findings, none worse or invalid, 114 of 456 steps not applied; 27 of 27 mutants (the verifier's 21 included) fail the tests |
| **G3** | done | 0.19.1 | 504d0f6 | 2026-10-11 | 11/11 in 122.8 s: T0 1.7 s, T1 25.6 s (407 tests), doctrine 8/8, vectors, the sensors over 525 clips in 5.2 s as baselined (267 pass, 104 warn, 154 fail), planted rebuilt byte for byte and 100/100 at their times, describe 30/30, each fix operator on its planted runs, fix over the library (252 linted, 144 better, 53 fewer findings, 0 worse or invalid), T2 8.7 s; verifiers: 16 + 5 findings fixed (D40 to D44), 27/27 mutants killed |
| 4.1 Pin three.js | done | 0.20.0 | 01f5aa8, fcbc7de | 2026-10-11 | cold-write check: both agents wrote their release correctly; r182 runs on WebGL 2 and WebGPU, r186's WebGPU fails at init (texture-view swizzle, Chromium 141); pinned r182; 7 bans + the pin in doctrine; e2e on both backends, r186 in CI (D45) |
| 4.2 Test characters | done | 0.21.0 | 5830e84, dac7541 | 2026-10-11 | 20 seeded variants (5 builds, 3 rests, 4 namings with their habits, twist and left-out bones) load in three and are recognized at confidence 1, bones within 1 µm, bound at rest; real rigs by hash: 2 Quaternius mannequins (unreal4, 1) and KayKit's Knight (topology, 0.85); a separate manifest fetches by its hash (D46) |
| 4.3 Binding a skeleton | done | 0.22.0 | 4197608, 56855f6 | 2026-10-11 | 20 test characters + a held-out seed + the real rigs bind with no hand mapping, lengths as generated to the mm; a fully renamed rig binds through topology at 0.85; renamed, 22 of 24 map as by name, 2 flagged at 0.55; report ≤ 20 lines with a patch that binds; topology fixes in core (D47, D28); 0.23.1: control bones left out, the Knight mapped bone by bone |
| 4.4 Playback and baking | done | 0.23.0 | 570b92d | 2026-10-11 | baked clips within 0.5 mm of the live solve on Mixamo, UE5 and Rigify characters (4 clips each, ≤1 mm through AnimationMixer); loop, events, contacts, facts in userData and GLTFExporter's extras; masked layers and crossfades through attach; the write allocates 0 bytes a frame, a whole update ≈7 KB and 0.16 ms (D48) |
| 4.5 Headless capture | done | 0.24.0 | e7d7456, 5b85094 | 2026-10-12 | capture: 2 generated + 2 real rigs drawn headless on WebGL 2 in CI, every frame drawn, pose hashes = Node's; blank and wrong-renderer frames fail by code; sweep over 2 test characters lists the broken clip with its reason; library sweep 80–91% on 5 generated, 86–88% on the Quaternius mannequins, 62% on the Knight (G4 asks 95%); planting and toeless-rig fixes (D49) |
| 4.6 The first-flight demo | done | 0.25.0 | 8fff7be | 2026-10-12 | lab `apps/lab/hello`: idle, walk, run by speed, jump, attack with its hit; deep links, `__m3a`, phone layout, stamp; `vercel.json`; e2e: a 13 s session headless on WebGL 2, hashes = Node's after every part, the sensors on what it played WARN with no fail, screenshots and a sheet as T2's artifact (D52); cross-fade planting fixed on the way (D51); graduated into the package tier's e2e `first-flight`, the lab deleted (D119) |
| 4.7 The benchmark harness and B1 | done | 0.27.0 | a7cc153, f4f039d | 2026-10-12 | isolation 1 (`claude -p`, clean env and home): B1 4/5 (the fifth skates at 54.5 cm/s running), 0.6–1.7 min, 7–18 turns, $0.11–0.24 a trial; discovery 2/2 found and used the package, both pass; quiz 10/10 in 3 trials; the grader fails 4 planted bad solutions and passes the known-good on seeds 1, 37 and held-out 41; a variant runs by path, its known-good first; manual draft shipped in @m3a/tools (D54) |
| **G4 = M1** | done (passed, run 2) | 0.43.1 | adf77ee | 2026-10-14 | run 2, 9 of 9 in 41.8 min (D88, `bench/results/gates/G4-run-2/`): the sweep under D80's reading 8,148 of 8,388 pairs on the six skeletons together (97.14%; the Knight 92.3% alone; held-out rig 98.4% apart); test (702), T2 (the set on seven bodies, no fail finding, every one warns), B1 5/5 and its held-out variant 5/5. Run 1, 5 of 8 in 19.7 min (D57, `bench/results/gates/G4-run-1/`): sweep 89.1% of 3,150 (bar 95%; held-out rig 90.9%); B1's variant a grader failure (seed 935, fixed in D56); vectors without the pins in the worktree; check, test (469), doctrine, T2 (the set on six skeletons and the held-out rig, no fail finding), B1 5/5 passed |
| 5.1 Library layout and loader | done | 0.26.0 | c6d1235 | 2026-10-12 | ahead of the ledger for WP-4.7 (D53): 5 sets, 525 clips load with their content ids and every file as locked; a tampered file fails with its clip named; a game that hasn't opted in sees the 3 CC0 sets (367 clips); CC0, CC BY and CMU texts in library/LICENSES/ |
| 5.2 Importers | done | 0.30.0 | 8334238 | 2026-10-12 | `@m3a/io`: readGltf and readCmu bit for bit (tier 1b: the tiny rig, a Rigify rig with a skinned mesh and its look, take 09_02); BVH and glTF on any rig through six bone maps; VRMA written, read and written again byte for byte, its humanoid bones within 0.01 mm of the Animator, root motion in the hips; importSet and subset; per-file budgets and only IoError out, 600 random corruptions included (D61); 37 io and tier 1b tests |
| 5.7 License compliance | done | 0.29.0 | 86d5fd9 | 2026-10-12 | `npm run license -- check`: the 5 seed sets pass (Mesh2Motion's 3 open audits listed; CMU and 100STYLE credited); a game manifest's clips by its tiers, no local content shipped, its credits block (D59); a fixture for each failure fails |
| 5.6 Large corpora on demand | done | 0.31.0 | ce20843 | 2026-10-12 | `npm run corpora -- cmu --survey --check`: all 2,548 takes regenerate the ledger byte for byte (every row as my-3d2dge's survey wrote it), each fetched file held to its lock; 100STYLE's archive pinned and its extras' six catalogs cut into sets, all 780 clips at the same stretch with the same keys as shardfall's (`--check`); library/local/ lane, the doctrine check reads no local content (D62) |
| 5.3 Re-import from the sources | done | 0.32.0 | c1c8ebd | 2026-10-12 | `npm run import -- --check`: 9 sets re-imported from pinned sources with format 2's hands, spine curl and root yaw, every CMU take on the ground, each clip the better of import and migrated (the reason in `_import.json`, its schema in tools/import), every set within the fit limits (means 7.7–13.9 mm); hands on prop clips 32.4 → 13.7 mm (Mesh2Motion), 19.6 → 7.3 (STYLE100), CMU 15.1 → 15.3; Mesh2Motion audited CC0; 84 new CMU picks for G5's floors (144 clips); 1,385 clips in all, QA 901/296/188; Quaternius stays as migrated until its files can be fetched, a deviation (D63) |
| 5.4 Facts and auto-labels | done | 0.33.0 | c976af8 | 2026-10-12 | `npm run facts -- --check`: all 1,385 clips carry their facts (`m3a-facts@1`; 793 with a captured speed kept) and detected contacts (1,329), written by the importer and the migrator and measured again with nothing stale; detected contacts are re-read by `measureFacts` and `playable`; the 18 tag–fact conflicts all resolved, 15 open loops closed by the fitter's `closeLoop` and 3 runs on the spot tagged `inplace`, none baselined; QA 920/285/180 (D64) |
| 5.5 Search | done | 0.34.0 | a1f15dc | 2026-10-12 | `npm test -- search`: `search` and `Library.search` over every set's catalog, rows only from the tiers opted into and `next` naming a closer match elsewhere, no match zero rows with the nearest tags, filters (speed, dur, loop, set, tier, tag), the 43-clip core list first among equals, the CMU ledger's takes; 40/40 game moments with a fitting clip in the top 5 (37 on CC0 alone); held out: round 1 4/10 against the first table, round 2 after the vocabulary was rebuilt and frozen 8/10 (7 on CC0) (D65) |
| 5.8 Library QA | done | 0.35.1 | f874b01, 754adfe | 2026-10-12 | `npm run qa -- library --check`: all 1,393 clips carry the sensors' verdict (1,008 pass; 230 warn and 155 fail baselined, each with its reason, `baselines/qa.json` by set and by clip, the metrics a profile turns off named); 110 re-imports repaired within 2 mm on average and 30 mm at worst; 1,194 unique motions (84 copies by `orig`, 112 re-exports, 3 near-duplicates by pose), the CC0 pack 170; every G5 floor met, 9 CMU get-ups added and reactions revised 40 → 33 (35); distributions recorded; `docs/LIBRARY.md` generated (D66; G5's verifier's findings, D67). After G5 (0.35.2, D69): a float check, three floats answered; 5 CMU picks, combat 64 and gestures 63, 1,199 unique of 1,398 |
| **G5** | done (passed) | 0.35.1 | 754adfe | 2026-10-12 | 12/12 in 9.7 min (`bench/results/gates/G5/`, D68): 1,194 unique motions of 1,393 clips, the CC0 pack 170 of 366; every floor met (reactions 35/33, combat 61, gestures 61, work 65, traversal 50, locomotion 812, idles 108); every clip valid with its verdict (1,008 pass, 230 warn and 155 fail baselined); search 40/40, held out 8/10; licenses pass. Run 1 at add333b passed its commands but its verifier blocked it (reactions short, D67) |
| 6.1 Recipes | done | 0.37.1 | 85dc149, e568fba, 8076745, 734486a | 2026-10-12 | `npm test -- recipe` (28 tests): 66 one-line mutants and 36 of the verifier's 41 fail them (five pass for reasons D70 gives); the 20 example recipes validate (schema and `validateRecipe`), compile into valid clips the sensors pass, and are explained in at most 100 tokens by o200k and cl100k, as are a ten-step recipe, a 45-word id and a pose of many parts; `spec/RECIPE.md` and the full `recipe.schema.json`, refrozen (D70); the verifier's rounds 1 to 3 fixed in 0.36.1, 0.36.2 and 0.37.1 |
| 6.2 Procedural sources | done | 0.45.1 | 2bfe276, a1dc1fd, 9ad1b39, 2eb0a1f, 8a53245, e9c0c52, b1e264f, 92dfe25, 95a9e06, 5f00a34, f40e677, 8bf8bbf, e824d02, ee57aaf, 43d9df6, 2664d06, ae25401, 16990ef, 00e3b69, a7b326e, f8cdd68 | 2026-10-15 | `npm test -- procedural` (55 tests, with `tools/procedural`'s carry test): the move model against my-3d2dge's frozen `moves.json`, 0.0018 cm mean and 0.012 cm worst, no exceptions; every move begins and ends exactly (0.000 mm) at three start poses on two rests, ten at five more and the three library poses a .5 field rounded off; the four gaits slide at most 7.8 mm per contact on three rests, none failing on any of 64, their contacts where the feet stand; the idles pass, 1.1–3.7 mm; `library/moves.json` (31 moves, one unit system) is the frozen schema's shape and checks clean, and its seven shardfall-only moves are their source's numbers; the moves floor by reason (D71); a gait swinging under 0.3 s (0.2 s until round 5, 0.25 until 6, 0.26 until 14) or past the ranges the presets pass is refused; `library/moves.json`'s numbers are the frozen moves'; the verifier's rounds 1 and 2 fixed in 0.37.2 and 0.39.1; round 3 in 0.42.1: a gait's loop meets itself (frames spread evenly, each knee's twist closed), 0 of 1,212 cycles near the presets failing (326 before) and 0 of 1,280 combinations of the ranges' ends on 64 rests (237), and a foot swinging past the hips faster than 400% of H0 a second refused; round 4 in 0.42.3: a run's cycle under 0.6 s (0.65 lifting over 25) and under 50 frames a second refused, an even number of frames; round 5 in 0.42.4: every gait swings 0.25 s or more and is made at 50 to 120 frames a second; round 6 in 0.42.6: the pelvis lowered so no leg reaches past 98.5% at any phase (the bounce counted), the reach bound 72%, the shortest swing 0.26 s, 50 to 110 frames a second; at those bounds the verifier's grids fail 5 of 5,258 played (recorded); round 7 in 0.44.0: the swing's height continuous in slope at its joins, the pelvis's rounding counted, 55 to 90 frames a second (55 to 75 from round 9), `fitGait`, no shrug without collarbones; the verifier's 5,160 gaits none failing (D71); rounds 8 to 14 in 0.45.0 (lane G, D71): a swinging leg folded under 25% and a knee under the floor refused, the loop's seam read on the clip's own keys and bounded, the hands aimed from the decoded shoulders, gaits from the standing pose only, `fitGait` monotone in speed, lift and swing, actions playing gaits fitted; from round 14 the margin rule (D90): every bound's worst fresh reading at about 90% of fail or under, no fail over more than 60,000 clips, a run's knee at 91.1% recorded and pinned; the close-out in 0.45.1: the seam cache by weight (16 MB; 157 MB before for 40 gaits), the actions' parts bounded, every output the same to the bit |
| 6.3 Actions | done | 0.38.0 | 394662e | 2026-10-12 | `npm test -- actions` (11 tests): the six actions and the paired one are the frozen schema's shape and check clean; each action and each role plays on the six test characters, no row worse than on its own body and none failing; each of the 14 interrupt cuts is a valid clip the sensors don't fail, from a moment a foot stands (both where its reason says); the climb's ground rises and the hop's falls; the A- checks; the pair's roles meet on their event (D72) |
| 6.4 Graphs | done | 0.42.3 | 4e7cb0c, 6b2bd3b, 8a53245 | 2026-10-12 | `npm test -- graph` (29 tests): the checks and their codes, the schema agreeing; blend weights; the locomotion and combo graphs' scripted runs take the expected transitions and carry on exactly after a save and restore; triggers, exit, windows, sync, interrupts, layers, blend phase, callbacks, refusals; `npm run e2e` `animator-parity`: both graphs give the same states, hashes, events and exact poses in Node and Chromium (D73); the verifier's round 1 fixed in 0.39.2 (a faded-in state's first events, a loop's exit stepped over, cut fades, trigger buffers, clip hashes in the save); round 2 in 0.42.3 (a one-shot at speed 0, hyphenated clip ids, the graph copied, the schema tightened and refrozen; 52 of its 79 surviving mutants now fail the tests) |
| 6.5 Simulation and gameplay sync | done | 0.40.0 | ec4e794 | 2026-10-12 | `npm test -- sim` (7 tests): the walk-to-run-to-jump script runs into `spec/sims/Walk_Run_Jump.trace.json` exactly, on three bodies; stride warped, a walk in place from 0.5× to 1.8× its own speed slides 69–91 mm per contact (warn 150), its rate the ratio, and 268 and 240 mm unwarped at 0.75× and 1.5×; hit windows from events; root modes; S-E001–S-E007 with the schemas agreeing; a run the same twice; a filmstrip; `npm run sim` writes trace, result and film in 1–2 s (D75) |
| 6.6a Briefs B2, B3, B7, the wire sections | done | 0.42.5 | 6cdf2e1, 8a53245, e9c0c52, c02909a | 2026-10-12 | `npm test -- bench/graders`: the B2, B3 and B7 graders each pass their known-good solution and fail every planted bad one (8, 9 and 6), naming the check, on gen-1 (T1 every other planted one) and gen-37 (T2's full step, all); `npm run bench -- B2,B3,B7 --trials 1 --fake` runs them through packed packages in 12.5 s; the manual's wire sections (graphs, events and hit timing, reactions, root motion and stride warping, the simulation), 3,916 of 8,000 tokens (D76); the verifier's round 1 in 0.42.3 (D77): graders reading every body point from the bones, B2's strike, B3 on chest-less characters, B7's fall, wrong solutions that passed now planted bad ones; the known-good B2, B3 and B7 pass on all 40 of gen-20 to 59; round 2 in 0.42.4 (D77): B2's strike shared with its check, B3's knockdown bounded (and core's root motion no longer flings a one-shot that ends off its feet), B4 and B3 judging a standing foot by the lower foot's speed, B7's windows, the starters loading real rigs; the known-goods pass on 40 more seeds each (B4 on 35 VRM seeds); round 3 found it done, its should-fix in 0.42.5: B3's body staying where it lies, B2's damage window and reach |
| 6.6b Briefs B4, B5, B6, the make sections | done | 0.42.5 | a56a96c, 8a53245, e9c0c52, c02909a | 2026-10-12 | `npm test -- bench/graders`: the B4, B5 and B6 graders each pass their known-good solution and fail every planted bad one (7, 5 and 4), naming the check, on the default character (gen-40 for B4, a VRM-named chibi; gen-1) in T1 (B4 every other planted one) and on a second seed (gen-44; gen-37) in T2's full step; `npm run bench -- B4,B5,B6 --trials 1 --fake` in 13.3 s; `library.resolver()`; the manual's make sections (recipes, edits, and in 0.42.1 actions), 5,564 of 8,000 tokens; T1 88.6 s, B1's second seed and describe's token count sampled as D74's sweeps (D77); the verifier's round 1 in 0.42.3 (D77): B4 grading steps and a standing foot, the manual's examples no longer the briefs' answers (5,620 tokens), `--variant` for one brief, B4's naming checked; the known-good B4, B5 and B6 pass on all 40 of gen-20 to 59; round 2 in 0.42.4 (D77): B2's strike shared with its check, B3's knockdown bounded (and core's root motion no longer flings a one-shot that ends off its feet), B4 and B3 judging a standing foot by the lower foot's speed, B7's windows, the starters loading real rigs; the known-goods pass on 40 more seeds each (B4 on 35 VRM seeds); round 3 found it done, its should-fix in 0.42.5: B3's body staying where it lies, B2's damage window and reach |
| **G6** | done (passed, run 1) | 0.45.1 | a9731b1 | 2026-10-15 | 20 of 20 in 17.2 min (D91, `bench/results/gates/G6-run-1/`): B2, B3, B5, B6 and B7 each 5/5 fresh agents and 5/5 on their held-out variants (seeds 722, 808, 765, 871, 809; each known-good first), 50/50 trials at isolation 1 with a private /tmp, five at a time, $7.15; check 10.6 s, test 76.0 s, doctrine, vectors, the moves; composed clips QA 18.1 s; graphs deterministic 5.7 s; T2 128.8 s; the verifiers' findings fixed in 0.45.2 (every worktree hidden from the agents, a PID namespace, the audit; the records' byte copies) |
| 7.1 The tool registry | done | 0.46.0 | 8ee7cb3, a3921f9, 4ae8505, 31a3567, 61b251b | 2026-10-16 | `npm test -- registry` (39 tests) and `npm run e2e -- mcp-smoke` (the MCP Inspector 2.9.0's `tools/list --strict` and `tools/call` on every example, the console handle in Chromium): one `defineTool`, four surfaces (the API, `m3a`, MCP stdio at 2026-07-28 and the legacy handshake, `__M3A_TOOLS__`), one reply `m3a.reply/1`; a parity test on every example, a failing one included; unknown names refused with the closest; request_id kept per tool, an applied edit never twice, the CLI refusing it until 7.2a's durable store; four verifier rounds, 44 targeted mutants killed; 1,323 lines, past M (D92) |
| 7.2a The tools: find, check, change, ship | done | 0.47.0 | the lanes a0, find, check, change and a-fix (merges e32c159, daefab3, ce649e8, 294f0eb, 55ccf65) | 2026-10-16 | `npm test -- packages/tools` (193 tests with io and library; T1 829+): 11 tools and version and validate, each example the same on the API, `m3a`, MCP and the console and a failing-input test; 1,763 of 1,900 tokens (edit 222 the largest); the durable store (a retried edit applies once across two processes, in one MCP server, after a crash), concurrent edits locked (E_CONFLICT, never lost), undo and redo byte-exact, an outside edit resetting every tool's history; writes only under workshop/, .m3a/, imports/, check-output/; every lane reviewed up to three rounds, the WP verified on two lenses (two blocking findings fixed, D95); about 3,688 lines, past L (D95) |
| 7.2b The tools: retarget, compose, exchange | done | 0.48.0 | lanes b0, retarget, compose, exchange (3f8cf6c, 89a9e55, 7df2f63, 0d45a6f), rounds 2-3 (9c6af0b, bb43fa6, 68a6bae), the verifier's lanes (07fef25, 071cbc1, and lane 1's merge e328f30), e7062af | 2026-10-17 | `npm test -- packages/tools packages/io packages/library tools/sweep && npm run doctrine`: 7 tools (20 in all, within 3,000 tokens) on four surfaces, each with failing inputs; VRMA byte for byte, .glb and BVH within 1 mm; an imported set local and refused for shipping; the sweep's rows pinned (b4f51cf5d8276a36, before and after the judge moved); rigify's mapping as expected. Two-lens verifier, three fix lanes, each re-reviewed until sound (D96); T1 77.8 s (923 tests), T2 131 s. ~4,950 lines, past L |
| 7.3 The manual and the skill | done | 0.49.0 | de005f4, 6ef97e2, 5254594, 4a40f8a, 79c6b5b, c51072b, 0b99f56, 2cfb004, 73cfb56 | 2026-10-17 | `npm run doctrine && npm test -- manual` pass: the manual 7,998 of 8,000 tokens, every block run, its tool list generated and checked; skills, llms.txt, .mcp.json, the runner's wiring. `npm run bench -- B1,B5 --trials 5`: B5 5/5; B1 1/5, then 3/5 after the speed fix; the deferred proof met at G7 run 2 (B1 4/5, its variant 5/5, D107) after the library's 30 contact-less loops were fixed (D104) and the manual's speed rule (D105, D106); K2 not fired |
| 7.4 Packaging | done | 0.50.0 | 909c4f9, 50fbcc1, b66bfad, a8c0c74, 9573f90, 7ccb915, c0b5d72, a4eae5f, 8800bfa, 1df7072, dadac3a, b9415ad | 2026-10-17 | `npm run pack -- --check && npm run license -- check tools/bundle/manifest.json`: PASS in 17.7 s: a scratch install runs the manual's complete example, `npx m3a` (20 tools) and `m3a mcp`; m3a.js (1.16 MB, 47 CC0 clips, credits and texts) runs it headless; every bundled clip passes or is baselined; the default pack cc0 only, opt-in packs found; nothing published (D99). Four review rounds |
| **G7 = M2** | done (passed, run 2) | 0.50.1 | 5d1ec8f | 2026-10-19 | run 2, 24 of 24 in 93.0 min (D107, `bench/results/gates/G7-run-2/`): B1 4/5 (discovery 2/2), B2–B5 and B7 5/5, B6 4/5; every held-out variant 5/5 (run-2's seven fresh seeds), 68/70 trials, $11.46; recorded opus-5-5, haiku-5-5, fable-5-1 7/7 each; check, test (981), doctrine (manual 8,000/8,000), vectors, tools on four surfaces, the manual's code, pack --check, licenses, T2 121 s. Run 1 at 1623b78, 23 of 24 in 84.0 min (D106, `bench/results/gates/G7-run-1/`): B1's variant 3/5, fixed forward in the manual. Before it: the 30 contact-less loops (D104) and the manual's root-motion rule (D105). Two verifier lenses: one blocking finding (contacts the planter couldn't hold) and the should-fixes fixed in D108 (0.50.2: 5 of the 11 loops keep contacts, 6 answered) and two lens-B commits (the packs' changelog, a chest-less rig's reach) |
| 8.1 The gallery | done | 0.51.0 | 6bc8a79, 8df80be, 07752c9 (verifier fixes) | 2026-10-19 | `npm run e2e -- gallery`: 3 passed (every set and clip by link, 1,398 clips and 20 recipes, both graphs, at 390×844 with touch; the pose hash as Node's; view, rate, search, sheet and clip panel checked, nine breaks each caught); nothing only in the gallery (every action's tool in the registry); one sim stepper; 1,537 lines, L; verifier review fixed (D109) |
| 8.2 The review queue | done | 0.51.0 | 8.2a 5a63cf2, d6bbe79, 480b420, b967983; 8.2b e1586be, e018897; fixes 9b7776f | 2026-10-19 | `npm run e2e -- review && npm test -- review intake`: 3 e2e (a 20-clip batch decided by touch at a phone viewport, applied once, again no byte, a changed clip stale; the queue bundled only when asked; the contributor page carries no secret, a build given one fails) and 28 tests, the hosted leg skipped (the contract on `local`, the RLS cases on Postgres 16, the submit function and the deployed store); on `supabase` *(deferred proof: G9, blocked-owner on O8, D115)*; the free tier checked (D110); split 8.2a/8.2b, 3,023 lines (D109) |
| 8.3 Previews | done | 0.51.0 | a9bfca5, 9b7776f (fixes) | 2026-10-19 | `npm run e2e -- previews`: 2 passed (every page of the site stamped with the branch's commit, the labs index links every lab, no queue or rig ships); the preview URL on the PR waits on O3 (D85); 285 lines, S |
| **G8** | passed (run 1, and the owner's review on 2026-10-22) | 0.57.1 | eb43654 | 2026-10-19 | run 1, 8 of 8 in 314.6 s (D111, `bench/results/gates/G8-run-1/`): check, T1 90.0 s, doctrine, vectors, the intake and review tests, T2 196.9 s, the site, the owner's 20-clip batch exported. Open: the owner's phone review of the batch and the notes and threshold or task it brings back (asked on michaelcrosato/my-3danimations#15; O8, O3) 2026-10-22 (D130): the batch exported again at 0.56.0 (`queue-0.56.0.json`: the same 20 clips, one ref moved), the page at a preview's or `npm run gallery`'s `/src/review/`; still the owner's review. 2026-10-22 (D133): the owner's review applied (`npx m3a review ingest`: 20 decisions, 18 approved, 2 flagged, 0 stale), 13 notes in FEEDBACK-LOG F7, 2 task proposals in REVIEW-PROPOSALS; it found 74 of 98 STYLE100 idles frozen, Jump_Twist cut before its jump and names that mislead (WP-F.12, F.13). |
| 9.1 The intake pipeline | done | 0.52.1 | 9.1a f63ea87, ddd09ec, c1f62cb, 1370c1d, d7fc286; adoption 0cc2cb4, 0f9f6ff, 06bcbef; 9.1b 0bb8c9c, a3217d7; fixes 4df64a4, 2f27e52, 97e2d55, 5bcbbc4, 5a21d13 | 2026-10-19 | `npm test -- intake bench/graders/B8 manual && npm run doctrine && npm run intake -- check --fixture all && npm run gate -- library-pr --fixture all`: 71 tests in 39.7 s; 18/18 fixtures (4 wait for review, 14 bounced with their reasons, an improvement of a CC BY clip kept); 28/28 plants in 60.8 s (into intake sets and an existing set); the adopt bot's dry run, and its full proof under M3A_FULL (three adoptions, STYLE100's CC BY among them; import, migrate, library, QA and index checks pass, 134.8 s); B8 and B8-ten (one agent, ten emotes) with their known-goods and planted solutions; the manual 7,999 of 8,000; the hosted run, adoption by a merged PR and the owner's sampled approval *(deferred proof: G9, blocked-owner)*; about 2,800 lines, L; verifier reviews fixed (D113) |
| 9.2 The motion-source socket | done | 0.52.1 | 64106e7, c8060d4 (exports), fixes cace9dc, bc6267b, afc46a8 | 2026-10-19 | `npm test -- sources`: 28 tests, 3.7 s: the procedural, recipe and library sources and a mock Kimodo-shaped one through `sources.sourceClip` (deterministic for a seed, key poses and root waypoints as constraints, its terms' license and version recorded per clip, the stated terms too when served under others); an allowlisted clip delivered to the intake with its `provenance.intake` and passing every no-rig gate, a CC BY generator's only to library/local/ (`localLane`, no link out); the HTTP adapter off by default, its transport injected, no network in any test; API-only (D113: principle 2's deviation); 943 lines, M; verifier review fixed (D113) |
| 9.3 Dedup and lineage | done | 0.52.1 | d9c49ad, 424a220, d1bdf8d (the checker's gate), 1720a08 (the ids check) | 2026-10-19 | `npm test -- dedup lineage`: 10 tests, 14.6 s: planted copies 87/87 in T1 and 501/501 under M3A_FULL (retimed, mirrored, lightly edited), none of 293 named distinct pairs merged (nearest 23.0 mm against 12.4); 1,398 lineages resolve, the 28 composed to 21 sources; deprecation keeps the clip; `npm run library -- check --since` holds the ids (library-pr, G9); the checker bounces a mirrored, retimed library clip the census missed, with the submission's own id; 915 lines, M; verifier review fixed (D113) |
| 9.4 The registry index | done | 0.52.1 | 41d6e01, c304bad, 4d54378, fixes 1d27fb3, e7155ff, 6a506af, 1b8d58a, 6bc035d | 2026-10-19 | `npm run index -- --check`: PASS in 0.2 s, 11 core sets, 0 community packs, serial 1, byte for byte; `verify --all` 11 sets; a latest version's recorded fields tied to its files, `--since` failing closed; a community pack refused on a mismatched hash, an unverified namespace, no recorded proof or a license its files don't give; the owner's review and the adopt bot regenerate it; `release.yml` by hand, closed until O2 (D99); 683 lines, M; verifier review fixed (D113) |
| **G9 = M3** | blocked-owner (its commands passed, run 2) | 0.52.1 | 9d4342d | 2026-10-19 | run 2, 16 of 16 in 1,641.9 s (D115, `bench/results/gates/G9-run-2/`): check, T1 108.3 s (CI 77.1 s), doctrine, vectors, the intake's 18 fixtures, 28 plants failing the library gates, the adopt bot's dry run and whole proof, the ids, the index byte for byte and every set verified, T2 327.5 s, B8 5/5, B8-ten's one agent with ten clips through (19 sent, 9 bounced), B8's held-out variant (run 3, gen-5672) 5/5; $1.87. Run 1 at ba75cff, 15 of 16 (D114, `G9-run-1/`): B8-ten 9 of 10 (a walking emote), fixed forward in the intake's lint. Open: the contract suite in Actions against O8's project, an adoption through a merged PR, the owner's 70% approval of the sampled batch (`G9-run-2/queue.json`) (asked on michaelcrosato/my-3danimations#16; O8) 2026-10-22 (D130): O8 answered yes, the session may create the project; it waits on the owner connecting the Supabase connector (no session has it before), then the secrets, the OAuth app and the Actions setting. 2026-10-24 (D137): the connector is connected (one organization, free plan, no m3a project yet); the next session creates the project and runs `services/intake/README.md`'s steps 1 and 2 through it, then asks the owner for steps 3 to 6. 2026-10-27 (D138): the project `m3a-intake` (`suhheypppwwnddbgvngx`) created, its schema applied byte for byte and its submit function deployed, both checked live; steps 3 to 6 asked of the owner with the project's values. |
| 10.1 The TypeScript consumer proof | done | 0.53.0 | fc43fc1, c55ddb8; fixes 8c76260, 6e1a7e9, af91f06 | 2026-10-19 | `npm run e2e -- consumer-ts`: 4 passed (46.0 s): a my-3dge-shaped duel on the public API (three.js r182, a fixed 60 Hz sim on my-3dge's frame clock, two humanoids on one graph, a `hit` event, root motion); the page plays as Node step by step (every event, hit, place, hp and hash), the hero on `sim.simulate`'s root path to a micron at every step (4.84 m), the page's own frame loop on a held clock, the hash the same posed or not; six mutants of the lab fail it. docs/MIGRATING.md: my-3dge's WPs 3.4–3.7 and 8.1–8.10 each replaced, wrapped or kept, the others replaced named (WP-10.8's Library Lab in part), 40 of 40 API calls run as written; proposing the switch is O9; about 850 lines, M; verifier review fixed (D116) |
| 10.2 The conformance kit | done | 0.53.0 | 305ca06, 40e92a0, b97034d, 63bc0f6, 8c268ea; fixes 833fbe4, a0b8802, 6097d27, 4b61f30 | 2026-10-19 | `npm run conformance -- --impl ts`: tiers 1a, 1b, 2 and 3 certified, 3,662 cases in 7.8 s (m3a-conformance/1, the vectors' manifest named); the broken implementation fails each of its ten defects naming the vector (a rounded fit, swapped wrists, NaN or strings at zero, hidden long legs, sunk soles, an echo, a bare hello, a null line, a hang); every answer schema-checked, a deadline a request; CERTIFYING.md: shardfall's Rust codec certifies tiers 1a and 2 now, 1b after its glTF reader's look, a proposal (O9); about 1,400 lines, past M; verifier review fixed (D116) |
| **G10 = M4** | blocked-owner (its commands passed, run 1) | 0.53.0 | 95af62d | 2026-10-19 | run 1, 8 of 8 in 537.5 s (D117, `bench/results/gates/G10-run-1/`): check, T1 109.1 s, doctrine, vectors, the TypeScript implementation certified through the kit's runner (tiers 1a, 1b, 2, 3; 3,662 cases; `certification.json`), the consumer proof's e2e, `pack --check`, T2 352.4 s. Open: another repository consumes the package or certifies against the vectors, and the owner confirms it (O9: my-3dge's switch in docs/MIGRATING.md and shardfall's certification in spec/conformance/CERTIFYING.md proposed, never acted on; asked on michaelcrosato/my-3danimations#17) 2026-10-22 (D130): the owner said wait. |
| F.1 The m3a bin and the session hook's install | done | 0.54.1 | 7615ea9, 2467b82; review fixes 5c348a8 | 2026-10-21 | `npm test -- packages/tools/test/engine.test.ts tools/session`: 11 tests; the packed bin under Node 20.20 and 21.7 says which Node it needs and exits 1 (`m3a version`, `m3a mcp`), under 22.22 warns and runs, under 24.21 runs with nothing on stderr; the MCP server's CONNECTION_CLOSED was the hook's `npm ci` deleting node_modules on each start, resume and `/compact`, not Node 22 (D121); the hook twice in the checkout: 10 s, then 2 s with `npm ci` skipped |
| F.2 Contacts for the six `unplanted` loops | done | 0.54.2 | 7e7681d | 2026-10-21 | `npm run facts -- --check` 0 stale (OnHeels_Run the one clip that moved); `bySole` in core: `STYLE100_RUN/OnHeels_Run` a step a foot, the planter's pull 3.35% of H0, ground speed 0.90 and travel 0.97 of its captured 1.27 H0/s; the other five keep none, answered with the numbers (D122); 4 of 4,965 retimed readings change, all its own; QA verdicts unchanged (1,014/230/154); the judge on six skeletons 6/6; B1's known-good 11/11; nine mutants killed; B1 with real agents 5/5, discovery 2/2, its G7 variant 5/5 |
| F.3 The root-motion rate sweep | done | 0.55.0 | c74a865; its T2 step 31418c7; review fixes 5c348a8 | 2026-10-21 | `npm run sweep -- --rates --check`: 811 loops × 5 rates × 6 bodies, 24,330 rows in 92 s; 22,892 pass, 959 warn, 479 fail (2.0%), each held in `library/baselines/rates.json`, 0 outside it; the fail rule the sensors' fail levels and "a foot stands still", every rate alike (D123); T1's sample 5.2 s, in T2 a step of its own (109.5 s in CI, whose T2 is 525.2 s of 480: a warning); D106's keyed runs pass in steady state (B1's floor at y = 0 and the fade, a follow-up) |
| F.4 The manual's untaught names | done | 0.55.1 | 6d1ac91 | 2026-10-21 | `npm run doctrine`: the manual 7,998 of 8,000 (7,999 before); `manual.test.ts` 9 passed: `LibraryError` (from `@m3a/library`) and `.code`, `VERSION`, `math.PORTABLE`, `math.hashValue`, `graph.layersOf`, `graph.clipsOf` and the Animator's `step` taught, in a block it runs; Tools −151 tokens; the briefs' sections word for word (D124); `pack --check` passes; the briefs re-run with real agents (`bench/results/2026-10-21-*`, the packages at 2467b82 and 31418c7): B1 5/5 (discovery 2/2), B2 to B7 5/5 each, every G7 held-out variant 5/5, B8 5/5, its G9 variant 5/5, B8-ten 1/1: 83 of 83 trials, $13.36 |
| F.5 T1's headroom in CI | done | 0.55.1 | 64d1358; the cache leak 5c348a8 | 2026-10-21 | trigger: CI's T1 126.1 s of 135 on main at 957bf51; `isolate: false`: `npm test` 88.0 s here (1,244 passed), from 114 to 128 s, the same tests; files shuffled three times 103, 97, 95 s, no failure between files; the kit's mock scoped to its test; `library status` counts states in their order; CI's grouping found a second leak, a kept procedural part on another resolver's rest, fixed (D125); CI's T1 on #20 79.1 s (from 126.1), 1,244 passed |
| F.6 T2 back under its budget in CI | done | 0.55.3 | 4d2b0da, 3756241 | 2026-10-22 | `npm run e2e`: T2 here 362.2 s → 293.3 s (297.6 on a patched clone): Playwright on four workers 169 → 133 s, every test within its timeout (mcp-smoke's every-example test 180 s); the rate step sweeps gen-0 and the knight whole (8,110 of 24,330 rows, byte for byte the whole run's) and ci.yml's `rates` job all six on every pull request (D126); `t2Steps()` tested, nine mutants of e2e.ts killed; CI on #21: T2 246.2 s (from 525.2: playwright 128.2, QA 5.8, the sweeps 92.5, the rate sample 19.7), the `rates` job's whole sweep 109.0 s beside it |
| F.7 The rate sweep's failing rows triaged | done | 0.55.3 | 3ba4efe | 2026-10-22 | `npm run sweep -- --rates --check`: 473 failing rows on 126 loops (479 on 128), 0 added, 126 of 126 answered with 7 causes; `measureFacts` rereads a loop whose refinement keeps one foot a moment after a height pass holding both feet throughout, held within 10% of H0 (retimed too): Robot_Run and Swimming_Run plant both feet (pull ≤4.3%, ground 0.81 and 1.05 of captured); the judge adds no fail; facts, import, index, QA (1,014/230/154) unchanged elsewhere; 17 of 19 mutants killed, 2 equivalent over 4,965 readings (D127) |
| F.8 The manual's last names | done | 0.55.2 | 5b93247 | 2026-10-22 | `npm run doctrine`: the manual 7,999 of 8,000; `manual.test.ts` 9 passed: `character(variant(7)).glb` through `loadGlb` (Node or a page), `variant(7).id` = gen-7, `TEST_SEEDS`, the attached player's `apply()` and `bound`; Ship and the actions example shorter; no rule a brief uses lost a word; MIGRATING gap 10 closed but for gap 1's names (D128); the briefs re-run with real agents (`bench/results/2026-10-22-*`, the packages at b7528b1): B1 4/5 (discovery 2/2), B2 to B6 5/5, B7 4/5; G7's variants B1 4/5, B6 4/5, the rest 5/5; B8 5/5, its G9 variant 5/5, B8-ten 1/1: 79 of 83 trials, $13.82; the four misses B1's floor (two), a jump left on the ground, a mirrored strike 10% off |
| F.9 Honest per-loop contact readings | done | 0.56.0 | e766496 (#22: 2f973fa, review fixes d5fedc0, 3c60ac0, 560b535) | 2026-10-22 | `npm run sweep -- --rates --check`: 428 failing rows on 108 loops (473 on 126), 0 added, 108 of 108 answered; the rule, written before the sweep was read, gave 57 loops another reading, 45 adopted after the sweep, judge and QA veto (12 kept their file's), written `labelled` with `facts.reading` (planted-quarter 19, planted-half 10, sole-planted-quarter 7, lower-quarter 3, lower 2, sole-planted-half 2, sole-planted 1, lower-half 1); the judge one fail gone, none added; QA 1,015 / 229 / 154; each set's import `--check` byte for byte, facts 0 stale; spec §7.1 and §7.3 amended, refrozen (D129); two adversarial reviewers' findings fixed |
| F.10 Publishing to npm (O2 answered) | done | 0.56.0 | e766496 (#22: a63dc2e, 894244c) | 2026-10-22 | `npx vitest run tools/release/publish.test.ts tools/release/release.test.ts`: 37 passed (16 publish, 21 release); 36 edits to `publish.yml`, one at a time, each fail its test; `npm run pack -- --check --publishable` in a clean copy after `npm ci --ignore-scripts`, nothing fetched: PASS, 8 packs; the publish loop with `npm publish --dry-run` on the real tarballs: 8 in dependency order; two adversarial reviewers' nine findings fixed (the run from the tag for provenance, the go-ahead in every job, the environment `npm`, no checkout beside the token); `actionlint` clean; the first real publish is the owner's (D130) |
| F.11 The review page plays its clips | done | 0.57.0 | e599e33 (#25) | 2026-10-22 | the owner's ask during G8 ("why can't it play here ... why can't there at least be a URL pre filled"): each card plays its clip in place (one stage, one card at a time, no frame drawn when idle), links it in the gallery, and the page opens G8's batch on its own; the site carries a batch of library clips alone, checked value by value, and refuses one holding a submission; `npm run e2e -- review previews gallery` 11 passed; the gallery's unit tests in T1 (7); two adversarial reviewers' 10 findings fixed (D132) |
| F.12 The review page's guide | done | 0.58.0 | deaab20 (#27) | 2026-10-22 | the owner's ask after G8 ("give clear directions when someone opens that page ... explain how LLMs would select an animation"): a guide at the top (what the clips are, how an agent chooses one, what the sensors check and can't, what Approve and Flag mean, export and send back), open on a first visit and remembered closed; each card says what its clip should show (description, loop or once, length, travel in m/s and a grown-up's pace, tags), a submission's measured as adoption measures it; `npm run e2e -- review previews gallery` 14 passed; the gallery's unit tests 18; two adversarial reviewers' 10 findings fixed, 3 blocking (D134) |
| F.13 The idles keep their motion | done | 0.59.0 | 83f8ce0 (#28) | 2026-10-22 | the owner's G8 review ("This is a pose. There is no actual animation"; Jump_Twist "never gets to the actually jump"): frozen clips 102 → 17 (13 tagged poses, 4 answered), each fit bounded by the clip's own motion; no knee or elbow 20 mm beyond its capture (16 were, up to 54 mm: `steadyBend`), no snap (`spaced`); recipes keep the sway (0 of 87 one pose through clip, mirror, retime; 83 were); the still check in QA and the intake's lint gate; Jump_Twist cut again to its flip; `npm run import -- --check` 9 sets byte for byte, vectors and conformance 3662 as before, T2 266 s; two rounds, four adversarial reviewers' 21 findings fixed (D135) |
| F.14 Playback as the data says | done | 0.60.0 | b66f248 (#29) | 2026-10-23 | the owner's in-chat review of Pick_Up_Basket ("does a 360 and then walks backwards") and their experiment (gen-1 painted, snapped at the sheet's moments and view): the gallery and the review cards turned a character by a heading its pose already carried, and the raster and graph sims likewise; one rule (a pose carries its clip's turn, attach writes the root's turn beyond it, `AnimatorPose.turn`); the data comparison `apps/gallery/src/playback.test.ts`: facing 55 clips off by up to 179° → 0 of 1,398 on four test characters; the test characters painted as the sheets (D136) |

---

## Appendix A: key numbers

| Fact | Value | Source |
|---|---|---|
| Readable key poses vs capture | Set means 13.9 mm (Quaternius), 16.1 (Mesh2Motion), 17.8 (CMU); per-clip worst up to 286 mm | my-3d2dge `docs/MOCAP.md`; `predecessor_origin_repos.md` C4 |
| Token costs | Legend 440 tokens; one key pose 137; about 1.4k per second of motion; about 3k per clip; a catalog line about 35 | `predecessor_origin_repos.md` C4 |
| Text vs binary for the same Quaternius clips | 74 KB vs 1,062 KB gzipped (about 14× smaller) | `predecessor_origin_repos.md` B4 |
| The curated library | 325 clips, 6,469 keys, 693 s, about 970k tokens; ledger of 2,548 CMU takes | `predecessor_origin_repos.md` C4 |
| shardfall's embedded sets | Quaternius v2 102, Mesh2Motion 177, CMU 60, STYLE100 98 = 437 clips | `predecessor_adopter_repos.md` appendix |
| The codec, re-implemented | JS 338 lines (origin); Rust about 7,500 lines incl. importers (shardfall); a TS port planned (my-3dge) | `predecessor_adopter_repos.md` §6.2 |
| Baking accuracy | Dense bake from point-derived frames: 0.26–0.46 mm mean, with 0.3–1.2% of midpoints over 50 mm; key-for-key baking up to 0.73 m worst; the bake from parameters, measured here (WP-4.4): within 0.5 mm of the live solve, ≤1 mm through AnimationMixer | my-3dge `docs/research/D-mocap-library.md:490-514`; D48 |
| Decoding onto a different body | Under 9° per limb (up to about 14° on a curled spine) | shardfall `tests/motion.rs` |
| The origin's procedural gait | Planted feet slide at 12% of body speed at walking pace, 28% when slow | `predecessor_origin_repos.md` C4 |
| VLMs judging motion | PhysBench best 49.5%; MotionBench mostly under 60%; telling which of two frames came first 49.1% (GPT-4o) | `agent_tooling_analogues.md` |
| Image cost | About 1,296 tokens for a 1,000 × 1,000 image on Claude | `agent_tooling_analogues.md` |
| The owner's last plan, executed | 97 WPs; 23 done in about two days; every reported size over by one class; 22 amendments in two days | `predecessor_adopter_repos.md` §5 |

## Appendix B: glossary

- **Key pose:** one moment of a clip, as readable numbers.
- **Clip:** key poses over time, plus contacts, events, facts, provenance and quality.
- **Set:** clips from one source or the intake queue, under one license tier, with one content id.
- **Default pack:** the CC0 sets a game gets without opting in to other tiers.
- **Intake queue:** the inbox where submitted clips wait for the checks and the owner's decision; the repository is the
  library.
- **Catalog:** one line per clip; how a model chooses a clip without reading motion data.
- **Fit:** a clip's distance from its source capture, as [mean, worst] mm.
- **Facts:** values measured from the motion (speed, travel, strike time and so on).
- **Contacts:** intervals when a foot or hand is planted.
- **Events:** named moments (`hit`, `step`, `land`).
- **Recipe:** a clip made from clips by operators (L2).
- **Graph:** states, transitions and blend spaces (L3).
- **Profile:** the canonical skeleton and its mapping tables.
- **Solver:** turns a pose into local rotations on a bound skeleton.
- **Sensors:** metrics, `describe`, sheets, films and diffs.
- **Gate:** a fixed command set that ends a phase.
- **Lane:** a stream of WPs that can run in parallel with others.
- **Brief:** a benchmark task given to a fresh agent.
