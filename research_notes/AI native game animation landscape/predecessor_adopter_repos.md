# Adopter repos of the my-3d2dge animation system: riftlight, shardfall, my-3dge

Codebase study, 2026-10-11. Clones are read-only under `/home/user/michaelcrosato/`. Each clone is one squashed commit
dated 2026-10-10, so dates below come from the repos' own docs. Paths are relative to each repo's root. "3d2dge" means
the origin project my-3d2dge, consulted only for comparison. Line numbers are `file:line`.

---

## 0. Bottom line

| Component of the 3d2dge system | riftlight (TS, three.js) | shardfall (Rust, wgpu) | my-3dge (TS, three.js) |
|---|---|---|---|
| Readable key-pose format | no (own Euler-degree `ClipDef`) | **yes, kept as is**, decoder and encoder ported to Rust | **planned** as the stored format (format 1, extended to format 2) |
| Mocap sets (Quaternius, Mesh2Motion, CMU) | no | yes, re-translated natively, plus 100STYLE, Quaternius v2, local Bandai/LaFAN1/Mixamo | planned (Phase 8), plus shardfall's 100STYLE and Quaternius v2 |
| Catalogs, provenance, fit, CMU ledger | no | yes (12 catalog files, full CMU ledger) | planned (WP 8.1), with license fixes |
| Importers | no | ported to Rust, verified number for number | planned TS port (WP 8.5), a third implementation |
| Humanoid rig / IK | own rig (jointed `Object3D`s), own two-bone IK | own puppet `Skel`, own IK; clips decoded onto it | planned port onto a rotation skeleton (WPs 3.4 to 3.6); reference vectors already committed |
| Move library (`E.MOVES`) | no (own hand-keyed attack clips) | re-encoded as `anim/moves.toml` (31 moves, new units) | planned port as timelines (WP 6.1); reference vectors committed |
| Contact sheets, filmstrips | own tools (software-rasterized sheets, motion curves, film) | own tools (`animsheet`, `filmstrip`, `turntable`) | planned (`x sheet`, `x film`, ID pass, text thumbnails) |
| Doctrine ("fighter jet with no cockpit") | yes, own expanded variant, adopted at engine 0.14 | yes, owner's base text verbatim | yes, owner's base text verbatim |

- **shardfall is the real adopter.** It took the data layer wholesale and bit-exactly, re-encoded the move library into
  TOML, and extended both: loop `speed`, 100STYLE, Quaternius v2, FBX/BVH readers, captured motion on monsters and heroes,
  and a live LLM editing studio with revisions and undo.
- **my-3dge has planned the adoption in detail but built no animation code yet.** Phases 0 and 1 are done and Box 1 is
  half done. The only animation artifact so far is 3.55 MB of port reference vectors (`tests/baselines/port/`).
- **riftlight did not adopt the animation system.** It shares the doctrine and the agent-tooling ethos, and its own
  animation stack is mature. One influence ran the other way: 3d2dge's banned-API lint cites Riftlight's
  (3d2dge `docs/LAB-3D.md:71`, "A check fails on those APIs, as Riftlight's does").
- **The readable format is the most reused artifact, and its codec is being written a third time.** JS (origin), Rust
  (shardfall, about 7,500 lines of importer and codec), and planned TS (my-3dge). my-3dge's plan declines to reuse
  shardfall's Rust port in so many words (`PLAN.md:770`).
- **Forks have already happened under the same name and version.** `QUATERNIUS` with `"format": 1` means 88 Rigify-sourced
  clips in 3d2dge and 102 Unreal-rig v2 clips (with `_RM` twins and `speed`) in shardfall.

---

## 1. riftlight (`/home/user/michaelcrosato/riftlight`)

### 1.1 What it is
- **What it is.** "Pixel Engine", a WebGPU-first 3D engine that renders authentic 2D pixel art, designed for AI agents to
  generate classic games (`README.md:1-8`).
- **Stack.** three.js r186 `WebGPURenderer` with TSL and its built-in WebGL 2 fallback, Rapier 0.20, Vite 8, TypeScript 6,
  Vitest 5 (`package.json`).
- **What it contains.** The page at `/` is **Riftlight**, a hack-and-slash ARPG: a town, 12 designed levels, endless
  rifts, loot, a passive tree of about 1,430 nodes, generated monsters and bosses (`docs/GAME.md`). There is also an
  "Engine World" tech demo with a room per technique (39 files in `src/world/rooms/`).
- **Maturity.** Engine version 0.16.0 (`CHANGELOG.md:11`). About 105k lines of TS in `src/` and 11k in `scripts/`. The
  animation engine is 4,546 lines (`src/engine/animation/`), and the monster animation 1,235 (`src/riftlight/monsters/anim/`).
- **Process.** 100% AI-driven: autopilot merges, auto-revert on a red `main`, Claude review and autofix workflows
  (`README.md`, "How work flows").
- **Dates.** No dates in the docs. The single commit is dated 2026-10-10 (PR #47). It predates 3d2dge v0.9.0
  (2026-10-08), which cites it.

### 1.2 What it adopted from 3d2dge, and how
- **The doctrine, as an expanded variant.** It keeps the fighter-jet line (`docs/DOCTRINE.md:19-22`) and was "adopted
  mid-project (engine 0.14)" (`docs/DOCTRINE.md:103`). Its principles are reworded: P1 "Gameplay is data", P2 "Headless
  and verified", P6 "WebGPU only; gameplay on the CPU" (`docs/DOCTRINE.md:29-81`). It also has a "Where this repository
  stands" gap list (`docs/DOCTRINE.md:101-127`).
- **Nothing from the animation data system.** A grep for mocap, Quaternius, Mesh2Motion, CMU, readable, Humanoid,
  `E.MOVES`, `ik3`, retarget, "standing hip height", "turn, lean, tilt" and "forward, out, up" finds no adoption. The only
  hits are incidental ("key pose" as a word, a `humanoid()` monster plan builder).
- **Parallel, independently built tools with the same agent-first ethos:**
  - metrics with exit codes, PNG contact sheets, motion curves, version diffs (`scripts/anim.ts:1-24`);
  - filmstrips of the real game stepped frame by frame (`scripts/film.ts`, `docs/ANIMATION.md:118-169`);
  - a lab page with an agent handle, `window.__ANIM_LAB__` (`docs/ANIMATION.md:181-195`).
  These are TS on three.js, drawn by a software rasterizer (`src/engine/animation/raster.ts`, `sheet.ts`, `curves.ts`).
  Whether they inspired 3d2dge's `anim-sheet.mjs` and `filmstrip.mjs` or the reverse cannot be told from these clones.

### 1.3 What it added or changed (its own system)
- **Clip format: hand-keyed data in Euler XYZ degrees relative to rest**, 30 fps frames, full poses, and eases per key:
  `linear`, `in`, `out`, `inOut`, `hold`, `inBack`, `outBack` (`src/engine/animation/types.ts:1-45`).
  ```ts
  /** `[frame, pose, easeToNextKey?]` */
  export type Key = readonly [number, Pose, Ease?];
  export interface ClipDef { name: string; frames: number; loop?: boolean; keys: readonly Key[];
    layers?: readonly Layer[]; feet?: readonly FeetKey[]; speed?: number; stance?: number; reach?: number;
    grounded?: boolean; fast?: boolean; notes?: string; }
  ```
  - **Feet are IK goals, not angles:** `track([[frame, body, feetGoals|null, ease?]...])` re-solves the legs every frame
    (`docs/ANIMATION.md:215-233`).
  - **Locomotion comes from a gait generator** (`gaitClip`): zero foot slide by construction; `speed` is stored so playback
    matches the ground speed (`docs/ANIMATION.md:234-244`).
  - **Compiled against the rig** to three.js `AnimationClip`s (`compileClip`, `docs/ANIMATION.md:30-35`).
  - **Rig.** A `RigSpec` holds joints, mirror pairs, soles, trace points, limits and leg geometry (`types.ts:147-168`).
    The rigs are jointed `Object3D`s with meshes hung on them, not skinned (`docs/ANIMATION.md:357-376`).
  - **78 hero clips** (`HERO_CLIPS`: 60, plus 18 `COMBAT_CLIPS`, `src/game/hero/clips/index.ts`,
    `combat.ts:579`). The README still says 57 (`README.md:60`): docs drift.
- **Runtime layers.** A 1D locomotion blend space with a shared phase; `RotationBlend` for flip-free cross-fades;
  procedural pose layers (lean, look, impact, a springy cap); foot placement in `ik` and `lock` modes with a `PopGuard`
  (`docs/ANIMATION.md:256-325`; `footPlacement.ts` is 885 lines).
- **Metrics** (`analyzeClip`): `soleMin`, body under the floor, `slide` against speed, the loop seam in degrees, fastest
  joint, limits (`docs/ANIMATION.md:69-79`).
- **The monster lab ("Spore editor").** Genomes become bodies through 9 plan grammars, with 85 parts, 10 archetypes,
  26 elite mods and 12 designed bosses (`docs/GAME.md:348-659`).
  - **Animation is templated over a semantic `Poser`.** One template animates every body: "lean the spine 20°, open the
    jaw" writes whichever joints this body has (`src/riftlight/monsters/anim/poser.ts:5-11`).
  - **Baking.** `bake()` samples a template, solves every foot with N-leg IK, applies a floor clamp from convex hull
    points, and emits a plain `ClipDef` with one key per frame (`docs/GAME.md:517-527`).
  - **Timing on the clip.** Clips carry a `hit` frame and a `windup` range (`docs/GAME.md:534-538`).
  - **QA.** Monster clips pass the hero's `analyzeClip` checks (`npm run monster -- check`).
  - **Agent handle.** `window.__MONSTER_LAB__` offers generate, mutate, crossover, evolve, `lineup` and `capture`
    (`docs/GAME.md:677-685`; `src/labs/monster-lab/main.ts:44-53`).
  - **Performance.** About 4-6 ms for a monster's first build and 0.7 ms for a pack mate; about 20 draw calls and 2.5k
    triangles each (`docs/GAME.md:549-553`).
- **Banned-API and determinism lint** (`scripts/forbidden-apis.mjs:10-33`):
  - bans `EffectComposer`, `ShaderPass`, `(Raw)ShaderMaterial`, `onBeforeCompile`, `WebGLRenderer`, raw GLSL, `from 'three'`,
    React and other engines;
  - bans `Math.random` and unmarked wall clocks (`// real time: <why>`);
  - checks exact version pins in both `package.json` and `package-lock.json` (`forbidden-apis.mjs:80-87`).
- **"Tools for agents: how to build your own"** (`docs/ENGINE.md:1493-1518`): a template for every tool.
  1. A pure, seeded core in `src/`.
  2. A CLI whose header comment is its manual, with `--json` and exit 1 on failure.
  3. PNGs in `.scratch/<tool>/`.
  4. JSON or CSV next to them, with the seed and inputs.
  5. A lab page with a `window.__<TOOL>__` handle.
  6. Unit tests, plus a smoke run in the e2e `tools` suite so the tool cannot rot.
- **Engine kit for other agents.** `npm run bundle` builds one ES module, `pixel-engine.js` (about 4.3 MB), with a guide,
  a generated `API.md`, types, a starter game and `check.mjs`. `build:single` makes one offline HTML file
  (`README.md`, "Handing the engine to another agent"). A version bump plus a CHANGELOG section is enforced by `npm test`
  (`CHANGELOG.md:7-9`).

### 1.4 Problems, limits, failures
- **Stairs.** 28 cm risers on 0.8 m treads give one-frame "slips" and few-cm "sinks"; the real fix would be a stair gait
  (`docs/ANIMATION.md:336-342`).
- **Headless WebGPU.** Headless Chromium loses the WebGPU device as soon as a canvas presents (escalation #46), so the
  WebGL 2 fallback stays as the only no-display path. That conflicts with its own "WebGPU only" principle
  (`docs/DOCTRINE.md:115-121`).
- **Replay gaps.** Riftlight's mouse aim reads DOM events, so the game does not replay yet. State snapshots are not done
  (`docs/DOCTRINE.md:105-114`).
- **Timing kept apart from the clips.** Hit and cancel frames live in a table separate from the clips (`COMBAT_TIMING`,
  `src/game/hero/clips/combat.ts:60-73`): "move a hit in a clip and move it there too" (`docs/GAME.md:169-170`). The monster
  clips put `hit` on the def instead.
- **Procedural motion is outside `npm run anim`.** Spring chains, `LegStepper` and `twoBoneIK` are checked only by unit
  tests and e2e rooms (`docs/ANIMATION.md:344-350`).

---

## 2. shardfall (`/home/user/michaelcrosato/shardfall`)

### 2.1 What it is
- **What it is.** A Rust workspace: the "Pavilion" engine plus **Shardfall**, a procedural hack-and-slash with a town, 12
  levels, endless Depths, three playable heroes and a Menagerie, plus a pavilion of demo rooms (`README.md:1-33`).
- **Stack.** wgpu 30 (Vulkan, DX12, and the browser's WebGPU via wasm), rapier 0.36, egui 0.36, glam 0.33, Rust 1.98.1
  (`Cargo.toml`, `AGENTS.md:27-28`). It deploys to Vercel as WebAssembly, and ships a Windows `.exe`.
- **Size.** 73,312 lines of Rust in 6 crates (my-3dge counted "about 61,000" one day earlier, `PLAN.md:457`).
  `pavilion-lite/` is a frozen 7,945-line compact engine for handoff (`docs/ESCALATIONS.md:9-18`).
- **Dates** (`docs/HISTORY.md:878-890`, `:8-364`):
  - engine milestones M1-M10, 2026-09-30 to 2026-10-01;
  - Pavilion Lite, 2026-10-02;
  - doctrine and three animation entries, 2026-10-09;
  - Animation Studio, Object Studio, Hall of Heroes and Creature Studio, 2026-10-10.
- **Agent surface.** One tool registry, `pav`, serves as a CLI, a REPL, an MCP server and a live bridge into the running
  game (`README.md:144-163`, `AGENTS.md:179-320`).

### 2.2 What it adopted, and how (in order, all 2026-10-09)
1. **"Moves as data, and motion clips from open libraries"** (`docs/HISTORY.md:480-533`).
   - **The comparison.** It compared its puppet with 3d2dge's ("the same approach: a skeleton posed by math, two-bone IK,
     no animation files") and "took what it does better, rebuilt on this engine's foundation" (`:481-483`).
   - **The format, kept as is** "so clips move between the engines" (`:501-502`; `crates/pav_core/src/clips.rs:4-11`).
   - **The decoder, ported onto the puppet's own proportions:** "every limb within a few degrees on sword, dance,
     breakdance and death clips (the spine is one segment here, so a curled spine differs by up to ~14°)" (`:504-507`).
   - **Sets first came through 3d2dge's own conversions.** `clip_import` reads a 3d2dge set script and writes
     `anim/<set>.json` (`:509-512`). Embedded: QUATERNIUS 88, MESH2MOTION 177, CMU 60, so 325 clips, 6,469 key poses,
     1.9 MB. On disk: every CMU take, 4,770 clips, 68 MB.
   - **A doctrine decision.** "readable key-pose text counts as data, not an asset file" (`:516`).
   - **`E.MOVES` re-encoded** as `anim/moves.toml`, details in 2.3.
2. **"The engine translates open motion libraries itself"** (`docs/HISTORY.md:425-479`). 3d2dge's importer (`anim-import.mjs`,
   `asf-amc.mjs`, `cmu.mjs`, and the encoding half of `readable.js`) was ported into `pav_tools::mocap`.
   - **Ported "step for step":** "f64 in the reference's order, captured points stored as f32 like its Float32Arrays,
     fdlibm's trigonometry (`libm`, as V8), V8's `Math.hypot`, JavaScript's rounding and `toFixed`"
     (`:441-444`; `crates/pav_tools/src/mocap/readable.rs:6-9`; `Cargo.toml:34-36`).
   - **"Verified number for number":** MESH2MOTION's 177 clips and all 119,432 numbers are identical to 3d2dge's own run
     (2.3 s against its 5.4 s). CMU's 60 clips from 25 subjects match on all 104,101 numbers (`:445-449`).
   - **Kept that way by a test:** `crates/pav_tools/tests/mocap.rs:1-3`, with fixtures written by 3d2dge's tool
     (`tests/fixtures/mocap/{rig,cmu}_expected.json`).
3. **"Every open library through the engine's own tools"** (`docs/HISTORY.md:364-424`).
   - **The whole CMU survey, natively:** 2,548 takes, 10.7 h, 4,770 clips. "all 2,548 ledger rows and all 113 sets came out
     identical to the committed ones my-3D2dge's tool made; the files differ only in the legend's line for `speed`"
     (`:366-373`).
- **Doctrine** (`docs/DOCTRINE.md`). The owner's base text verbatim, adopted 2026-10-09 "partway through development"
  (`docs/HISTORY.md:281-303`, `AGENTS.md:12-41`).

### 2.3 What it added or changed
- **A text move language, `anim/moves.toml`** (505 lines, 31 moves). Each move is a parametric arc: the hand or foot
  sweeps around the shoulders, and the move has three timed phases. The fields are documented in the file header
  (`anim/moves.toml:1-36`).
  ```toml
  [[move]]
  name = "overhead"
  about = "the blade raised high behind the head and chopped straight down in front, crouching into it"
  plane = "side"
  from = 138
  to = -72
  reach = 0.76
  wind = 0.16
  active = 0.09
  recover = 0.26
  lunge = 0.106
  crouch = 0.35
  lean = 0.4
  ```
  - **Units changed from `E.MOVES`:** radians become degrees (3d2dge `slash a0: 1.7` becomes `from = 97`); pixel units
    become arm lengths, hip heights and metres on a 1.8 m figure (`docs/HISTORY.md:488-495`). Compare
    3d2dge `engine/my-3d2dge.js:2549-2577`.
  - **New `about` field:** "a model picks moves by `about`". It is the catalog idea applied to moves.
  - **Origins.** The nine original actions keep their names and order. 3d2dge's `spin` became `spinslash`, because "ours
    stays the whirlwind". New: `stir`, `stir_back`, `flick` for townsfolk.
  - **Phases stretch** so the hit lands where the skill says.
  - **Chained attacks wind up from where the hands were** (`PuppetState::set_action`, `chain_*`).
  - **Validation is strict:** `deny_unknown_fields` (`crates/pav_core/src/moves.rs:73,137`), and an unknown move name
    lists the valid ones (`moves.rs:302`).
- **Loop `speed`**, "new in the format (the legend says so; other readers ignore it)". It is percent of standing hip
  height per second. `walk_clip` plays at ground speed over the clip's speed, with a walk/run switch with hysteresis
  (`docs/HISTORY.md:460-465`; `clips.rs:137-140`). The files still say `"format": 1`.
- **New libraries and readers:**
  - **100STYLE** (CC BY 4.0). 98 forward walks embedded (`STYLE100`, 1,550 keys, about 12 mm, 440 KB). 780 more loops on
    disk: back, back run, idle, run, side and side run, 9,779 keys, 2.8 MB (`docs/HISTORY.md:374-384`, `:450-459`).
    - Loops are cut by "way" from straight passes, scored with a turn penalty.
    - Four leg-dragging styles are excluded, with reasons; two spins are dropped because they cannot loop in place.
  - **Quaternius v2** (June 2026): 102 clips, with `_RM` root-motion twins and loop speeds taken from them
    (`docs/HISTORY.md:385-387`).
  - **Readers:** FBX 7 binary (`mocap/fbx.rs`); BVH with rig maps for Mixamo, Bandai Namco, LaFAN1, Unreal and Rigify;
    the rest pose taken from the frame where the body stands straightest (`docs/HISTORY.md:388-400`).
  - **Ranged downloads:** one take read out of a remote zip by HTTP ranges (`mocap/fetch.rs`).
  - **Non-commercial libraries go only to the git-ignored `anim/local`:** Bandai Namco (175 takes, 13.6 mm), LaFAN1 and
    Mixamo (`docs/HISTORY.md:401-406`; `AGENTS.md:30-32,148-153`).
- **Catalog format** (`anim/catalogs/*.json`, 12 files including `bandai.json` and `lafan1.json`). Each catalog has
  `$sources`, `$pick` (`[take, start, end, speed?, way?]`), `$skip` and `$library` directives, then one `[tags, desc]` line
  per clip:
  ```json
  "$pick": { "Zombie_Walk_Loop": ["120_22", 2.0, 9.0], "Walk_Backwards_Loop": ["136_25", 3.0, 14.0, null, "back"] },
  "Idle_Loop": ["idle", "standing at rest, breathing and shifting weight"]
  ```
- **Captured motion drives gameplay content** (`docs/HISTORY.md:411-424`; `game/heroes.toml:14-27,77-82`):
  - **Monsters and heroes name clips in their look data:** `idle_clip`, `walk_clip`, `run_clip`, `death_clip`,
    `attack_clips` (one per combo swing), `attack_moves` and `dodge_clip`.
    ```toml
    attack_clips = { slash = ["QUATERNIUS/Punch_Jab", "QUATERNIUS/Punch_Cross", "CMU/Roundhouse_Kick"], ... }
    attack_moves = { cleave = "sweep", leap_slam = "axekick", blade_dash = "flyingkick", ... }
    ```
  - **Attacks are timed by measured "strike time":** the moment the hand, blade tip or foot reaches furthest ahead
    (`clips.rs:478-550`).
  - **Generated bipeds draw their clips from the genome** in their own RNG stream.
  - **Names are checked:** "Game data names only clips that exist (checked on load)" (`docs/HISTORY.md:422-424`).
- **Animation Studio** (2026-10-10; `docs/ANIMATION_STUDIO.md`; `docs/HISTORY.md:212-262`). Live LLM and human editing in the
  game's own renderer, over MCP and a live bridge.
  - **Tools:** `anim_edit` (create, copy, inspect, key, delete_key, replace, retime, mirror, undo, redo) and `anim_preview`
    (`ANIMATION_STUDIO.md:155-230`).
  - **Concurrency:** every result returns a `revision`, which the next edit passes as `if_revision`; a stale write returns
    a conflict (`:187-189`).
  - **History and safety:** 32-step undo/redo per clip, persisted across restarts. Imported sets are read-only, so an agent
    copies a clip into `WORKSHOP/` first. A partial pose is a channels object, e.g. `{"armR":[80,20,50,25,0]}`.
  - **Limits:** 4,096 keys, 600 s, keys at least 1 ms apart (`:212-218`).
  - **Live reload:** a file watcher reloads after 250 ms and keeps the last valid data on an error.
  - **Smoke test:** a real desktop and MCP test of 10 checks (`scripts/smoke-animation-studio.py`).
- **Object Studio and Creature Studio** (2026-10-10). The same revision, undo and frame-ticket loop for props and for
  procedural creatures (`docs/HISTORY.md:8-144`).
  - **Creature Studio vendors the owner's SpawnForge TS compiler at a pinned commit**, with a SHA-256 for every copied
    file (`tools/creature-compiler/UPSTREAM.md`, `pin.json`).
  - **It runs as a persistent Node sidecar** speaking JSON lines (`tools/creature-compiler/src/worker.mjs:1-18`). An adapter
    converts to a Rust-validated "native format 1": bind bones, 4 skin influences, clips baked at 30 fps
    (`src/engine.mjs:1-12`).
  - **The pin is strict:** "Never silently point this adapter at a newer SpawnForge checkout."
  - **A different animation path.** Creatures use baked skeletal tracks, not readable key poses.
- **A clips tool for agents** (`crates/pav_tools/src/anim_tools.rs:749-820`):
  - `clips find=WORDS` returns JSON rows (name, seconds, loop, tags, desc), 40 by default;
  - `clips name=SET/Clip` returns the legend, readable text, fit in mm, strike time, speed, source, license and credit;
  - every reply carries a `use` or `next` hint.

### 2.4 Problems, limits, metrics
- **Retargeting limits.** The decode test allows less than 9° per limb direction against 3d2dge's decoder
  (`crates/pav_core/tests/motion.rs:23-51`), because the one-segment spine differs by up to about 14°
  (`docs/HISTORY.md:504-507`). Content rejected after trying it: "a captured cartwheel or backflip as a dodge (they
  travel sideways or backwards while the dodge faces forward); a levitating idle (the clip reads as a crouch on this rig)"
  (`docs/HISTORY.md:209-210`).
- **Format friction from JS-centric containers:**
  - a special extractor for 3d2dge's JS set scripts, `(window.MOCAP = ...)["NAME"] = {...}` (`anim_tools.rs:17-30`);
  - an order-preserving JSON reader, because serde_json sorts keys and "a catalog's order is the order its moments are
    cut in" (`crates/pav_tools/src/mocap/mod.rs:38-40`).
- **Version semantics are weak.** `ClipSet.format` is `#[serde(default)] u32` and is never checked on parse. Unknown clip
  fields are silently ignored, while unknown move fields are errors (`clips.rs:153-180` against `moves.rs:73`).
- **Docs drift.** `AGENTS.md:125` and `rooms/motion_library.toml:48` say "423 clips"; the embedded sets now hold 437
  (102 + 177 + 60 + 98, counted from `anim/*.json`).
- **Imported tails.** Some imported clips have an interpolation key after their stated duration; it is normalized only
  on copy (`ANIMATION_STUDIO.md:216-218`).
- **Not done** (`docs/HISTORY.md:474-479`, `:530-533`): cloth capes (still three cones), and early on monsters with
  clips, later added. Creature "native material scope": no fur, no emissive glow, opaque wings (`:61-67`).
  Gameplay spawning of generated rigs is open (`docs/PROGRESS.md:50-51`).
- **Tool blind spots.** The HUD, inventory, tree and touch controls are invisible to the tools and headless captures
  (`docs/PROGRESS.md:46-47`).
- **Agent-facing metrics:**
  - Animation Studio: 70 selected tests, 10/10 smoke checks.
  - Object Studio, 20 edits: median apply and save 2.04 ms, RPC 292 ms, frame submission 580 ms, confirmed 898 ms.
  - Creature Studio: 117 Rust and 6 Node tests, 15 workflows. Median 133 ms to a queued job, 355 ms build and save, 544 ms
    to frame submission, 690 ms confirmed (software Vulkan) (`docs/HISTORY.md:76-80,137-143`).
- **Lessons from its journal** (my-3dge adopted them, `PLAN.md:493-503`):
  - **The replay hash covered only positions,** so replays "matched" while gold and the RNG diverged (`docs/HISTORY.md:270-277`).
  - **Startup reading was 150 KB**, cut to 40 KB with a one-page `PROGRESS.md` (`:266-269`).
  - **A fresh-agent dry run of Pavilion Lite** listed 13 friction points (unknown tool arguments silently ignored, among
    others); a smaller model's bot could not finish its own level (`docs/HISTORY.md:794-809`).
  - **A tool cut off tall creatures.** `turntable` cut the head off a 5.26 m boss until it framed every pose's bounds
    (`:708-719`).

---

## 3. my-3dge (`/home/user/michaelcrosato/my-3dge`)

### 3.1 What it is
- **What it is.** "A fully 3D web game engine written and maintained only by AI coding agents", on three.js r182 (WebGPU
  only, no WebGL fallback), Rapier 0.21 SIMD, TypeScript 5.9, Vite 7.3, Vitest 3.2, Playwright 1.64 and Node 24
  (`README.md:1-8`; `PLAN.md:3873`, `:3877` (ADR-0003, ADR-0007)).
- **Driven by `PLAN.md`:** 469,374 bytes, 4,455 lines, 72,162 words, 97 WPs. Its integration target, the **Stress Box**,
  rebuilds 3d2dge's *Stress test: 3D world* in six stages (`PLAN.md:46-67`, `:1493-1523`).
- **Status** (`docs/PROGRESS.md:6-22`; `README.md:10-13`):
  - Phases 0 and 1 done (gates G0 and G1, PRs #2 and #3);
  - Box 1 in progress (WPs 2.1, 2.2, 2.3, 2.5, 2.6, PR #4);
  - no rendering engine yet at G1; no `engine/anim/` at all.
- **Dates.** Plan dated 2026-10-09, rebased 2026-10-10 (`PLAN.md:17`). G0, G1 and Box 1's WPs all landed 2026-10-10.
- **Code:** `engine/` 24k lines (with its unit tests), `tools/` 15k, `tests/` 3.9k.

### 3.2 What it adopted, and how
- **Pinned read-only sources:** `$MY3D2DGE_SRC` at my-3d2dge@e37e4ee (v0.14.0, 2026-10-08) and `$SHARDFALL_SRC` at
  shardfall@fa2dab6 (2026-10-09) (`AGENTS.md:17-20`; `PLAN.md:16`). `node x src` checks them; docs citations are written
  `my-3d2dge:<path>[:line]` and checked for drift (`PLAN.md:1446`).
- **Done: port reference vectors** (WP 0.11, `PLAN.md:1824-1847`; `tests/baselines/port/README.md`).
  - **How they are made.** `x port refs` loads `engine/my-3d2dge.js` in a Node `vm` with `Math.random` seeded per record.
    It writes 8 text files, 3.55 MB, with `checksums.json` (SHA-256). A re-run is byte-identical.
  - **What they hold:** Humanoid joint trajectories for 18 states × 8 facings × 3 builds, `E.move` hand and tip positions
    for 24 moves × 3 phases × u = i/20, Blob scripts, and the core math and colour helpers.
  - **Frame conversion** is spelled out: (x, y, z) → (x, z, y)/16 m; yaw ψ = π/2 − φ (`tests/baselines/port/README.md`).
- **Planned:** the readable format as the stored format, the sets (from 3d2dge, plus 100STYLE and Quaternius v2 from
  shardfall), the catalogs and the ledger. The Humanoid and the moves are ported onto a rotation skeleton. The doctrine is
  the owner's base text verbatim.
- **Not taken from shardfall:** "Its clip codec and importers, which are Rust ports of the my-3d2dge JavaScript this plan
  ports itself" (`PLAN.md:765-777`).

### 3.3 What it adds or changes (planned)
- **A rotation skeleton with sockets:** root + 23 joints, with spine0 required for CMU (WP 3.4, `PLAN.md:2286-2310`).
  Research found every point 35 mm off without spine0 (`docs/research/D-mocap-library.md:494-516`).
- **Effector-space authoring, then IK, then rotations,** through an explicit layer stack: weights, base, override, solve,
  clips, additive, post IK, physics blend, secondary (WP 3.7). ADR-0009.
- **Two update paths:** `anim.step` in the sim (hashed) and `anim.pose` in the presentation (LOD, not hashed). A
  `preciseHits` flag puts pose evaluation in the sim (`PLAN.md:941-945`).
- **Moves as timelines,** with events (`wind`, `active`, `hitOpen`, `hitClose`, `recover`, `end`), root-motion curves,
  weapon sweeps and a measured `hitShape` (WP 6.1, `PLAN.md:2722-2745`).
- **Format 2, a strict superset of format 1** (`PLAN.md:3573-3597`):
  - per key: `handL/handR [flex, side, roll]`, `rollL/rollR`, `yaw`, a `spine` override, `gripL/gripR`;
  - per clip: `events`, `contacts`, `props`, `fps`, `via`, `fit`, `speed`;
  - per set: `title`, `legend`.
  - New fields are named keys, "not extra array entries, because shardfall's reader takes fixed-length arrays and skips
    unknown names" (`PLAN.md:3576`). Research had proposed extending the arrays
    (`docs/research/D-mocap-library.md:541-542`).
- **One JSON file per clip,** with `_set.json` and a generated `catalog.tsv` (about 30 tokens a row). Agents search,
  "never read it whole" (`PLAN.md:3598-3616`).
- **Bake from the format's parameters** to Float32 quaternion tracks, exposed as three.js `AnimationClip`s. Sampling stays
  on the CPU (`PLAN.md:3618-3635`; WP 8.4).
- **The ACTIONS layer:** multi-beat sequences of timelines, clips and effector overrides, with held contact frames
  (WP 8.7).
- **License corrections:** CMU's no-resale clause and NSF acknowledgment verbatim (`PLAN.md:301`, `:3546-3549`). Any page
  that ships a `style100*` clip shows 100STYLE's CC BY credit (WPs 8.9, 8.10).

### 3.4 Problems and limits recorded so far
- **Every WP that reported its actual size overran the plan by one class:** M became L for WPs 0.2, 0.4, 0.6, 1.1 and 1.5;
  S became M for 0.7, 0.8 and 0.9; S became M-L for 1.6 (`PLAN.md` §14 notes, e.g. 1.5: "≈1,950 code + 920 test lines").
  Test lines ran 30-90% of code lines.
- **22 ADR amendments in 9 ADRs within two days.** ADR-0014 (tooling) has 7 and ADR-0006 (reproducibility) has 5
  (`docs/decisions/`). They record deviations, for example "Prettier checks code, not hand-written prose: 33 of 36 Markdown
  files fail" (`docs/decisions/ADR-0014-tooling.md`, Amendment 2).
- **The T0 time budget is already tight:** `npm run check` takes 9-10 s of its 10 s budget, with `tsc` at 7 s
  (`docs/PROGRESS.md:26-27`). G1 recovered T0/T1 with TypeScript project references and by moving browser tests to T2
  (ledger, G1).
- **Escalation ESC-0001** (enable GitHub Actions) was decided in the owner's absence after 15 minutes: Actions stay off and
  `x ci --local` is the gate (`docs/escalations/ESC-0001-*.md`).
- **The verifier subagent found problems at the gates:** at G0, 5 failures and then 3 more on re-review, all fixed
  (ledger, G0). At G1, findings were fixed "with a failing test first".
- **Shardfall knowledge is already stale.** The plan has no mention of shardfall's Animation Studio, revisions, Object
  Studio or Creature Studio (grep), which all landed 2026-10-10, after the pinned fa2dab6.
- **Animation risk R1:** "the animation's tuned feel is lost in the port", mitigated by reference vectors, differential
  tests and `x film --compare` (`PLAN.md:3838`).

---

## 4. PLAN.md: the animation-relevant sections (item 5)

### §4.2 The animation core (`PLAN.md:260-280`)
- **What the rig is.** 3d2dge's rig `rig.J` holds 15 joint *positions*, with no parent table and no bone rotations; limbs
  are solved by `ik3`.
- **Layers** combine through eased named weights, then about 15 lerp overrides "in a fixed order that is the only record
  of priority".
- **What ports nearly verbatim:**
  - the move model, "the real asset": 24 moves; wind starts from the real current pose; an ease-out arc; recovery
    overshoots, holds and blends back by position;
  - `Attack`, `Combo` and `E.move`;
  - the gait and idle formulas;
  - the verlet cape and hair, and the squash spring.
- **Weaknesses:** hits are flat ground cones; reactions are thin. Reproducibility breaks twice: `Math.random` sets the
  breathing phase, and the substep length varies with the display's refresh rate. Misspelled poses fail silently.
- **Size.** The 3D math is about 43 KB (12.4k tokens); Card-mode drawing is about 60 KB and is dropped.

### §4.3 The animation library (`PLAN.md:282-301`)
- **Contents.** QUATERNIUS 88 clips (13.9/222 mm), MESH2MOTION 177 (16.1/286 mm), CMU 60 (17.8/167 mm). 1.93 MB of text,
  393 KB gzipped. Catalogs are 39 KB; the ledger has 2,548 takes (262 KB).
- **Format.** About 42 integers per key and about 2,100 tokens per clip.
- **Baking to local rotations "is exact: a mean error of 0.26–0.46 mm, if the bake works from the format's parameters.
  Converting key for key gives outliers up to 0.73 m."** (`:298`)
- **Missing degrees of freedom:** wrists, forearm twist, foot roll, per-bone spine and root yaw were never stored. But the
  CMU import regenerates `cmu.js` byte for byte from public data (`:299`).
- **The license gap:** the CMU record omitted the no-resale clause and quoted only the NSF line (`:301`).

### §4.8 What shardfall offers (`PLAN.md:455-503`)
- **Measured because of shardfall:**
  - headless WebGPU can present to a real canvas with shardfall's Chromium flags;
  - r182's readback keeps 256-byte row padding, which must be stripped;
  - r182's addons expect one fixed MRT, with every filter gated by a uniform;
  - r182's scene graph builds in Node.
  Also Rapier API traps (`timeOfImpact`, `time_of_impact`, `toi`); the controller dropping sideways motion on level ground,
  fixed by moving across first, then down; autostep climbing about 5 cm above its setting.
- **Where my-3dge chose differently:** one golden hash in Node and Chromium via the fdlibm swap (shardfall's replays
  match only on the recording machine); hit-stop by slowing the clock, not the physics step; an HTML/CSS UI visible
  through the DOM (shardfall's egui is invisible to tools); crowds with collision groups for 5,000; numeric visual checks
  instead of eyeballing captures.
- **Lessons taken:** hash everything a capture holds; record settings changed mid-run; fresh-agent dry runs; unknown
  arguments must fail; keep the startup read small; content as data lets helpers extend the engine (27 rooms); "what the
  owner sees gets fixed".

### §5.2 Carry-over inventory: the animation core (`PLAN.md:554-577`)
Verdicts are COPY, PORT, REWRITE, CONCEPT or DROP, each with a target file and a WP.
- **COPY:** `ik3` (`engine:129-140`, 12 lines), plus `twoBoneRot` with an explicit pole.
- **REWRITE:**
  - the 15-position joint set, as root plus 23 joints with local rotations;
  - `_w`, as a root transform plus a squash channel;
  - knockdown, as root-rotation get-up timelines;
  - `inArc` and `Attack.hits`, as events, weapon sweeps and a measured `hitShape`;
  - `Math.random` breathing and variable substeps, as seeded streams and a fixed dt.
- **PORT:** the gait, idle, lean and arm-swing formulas in metres (constants in tables); pose and stance targets; the
  attack arm path; `E.MOVES` with self-describing fields in metres (`hitAt` belongs to the move, add events and root
  motion); the squash spring as volume-preserving root scale; hair and cape as one generic `Chain`; the Blob; builds in
  metres.
- **CONCEPT:** outfits, hair, hats and faces, as puppet body parts.
- **DROP:** about 42 KB of 2D drawing and the view hacks (`_cheat`, `_pitch`, `_camSide`), "they write simulation state from
  drawing".

### §5.3 Carry-over inventory: the library and its tools (`PLAN.md:579-601`)
- **`readable.js` (29 KB): PORT.** Decode within 0.001 mm. The source decoder run in a `vm` is the test oracle
  (`tools/anim/legacy-readable.ts`, about 10 lines).
- **`mocap.js` (20 KB): REWRITE** as a clip layer on the rotation skeleton. Keep `drive`'s ideas: the sole, not the ankle,
  to the floor; heading trust; the blade along the knuckles; the upper mask.
- **The sets: keep the data,** repackaged one clip per file with a deep-equal proof, and the 84 Mesh2Motion re-exports
  tagged `alt`. **HERO dropped.**
- **Catalogs: COPY,** fixing the CMU license.
- **The ledger: split** into 17 category files plus `subjects.tsv`.
- **`examples/cmu-lib/` (68 MB): DROP from git,** regenerated in `.cache/`.
- **The tools (`anim-import`, `asf-amc`, `cmu`, `anim-set`): PORT,** with CUBICSPLINE and quantized-accessor guards,
  interpolated sampling by default, and `--legacy` to reproduce today's sets.
- **`anim-sheet.mjs`: REWRITE** as a Node SVG renderer. **`mocap-test.mjs`: REWRITE** as Node unit tests.
- **The Mocap Lab: REWRITE** as clip mode in the box. Keep its UX: catalog search, the clip as text with
  Apply/Reset/Mirror and "Copy for model", deep links, frame stepping.

### §5.8 Harvested from shardfall (`PLAN.md:713-777`)
Animation-related rows:
- **Clip `speed`:** rate = ground speed / capture speed, with walk/run hysteresis, so clips round-trip with shardfall
  (WPs 8.2, 8.4).
- **Strike time** from the clip (`clips.rs:478-550`).
- **A two-slot crossfade with flags,** and an upper-body blend that re-solves IK.
- **BVH rig maps** for five rig families; the rest pose from the straightest frame; units from leg length.
- **Loop finders** (straight, going, still) with a turn penalty; one file read out of a remote zip.
- **100STYLE and Quaternius v2 as DATA** (WP 8.10).
- **A planted N-leg gait, verlet chains,** and a directional flinch spring.
- **Generators that keep old seeds stable** when genes are added, each addition drawing from its own RNG stream.
- **Tool concepts:** one tool table feeding the CLI, REPL, MCP and bridge; `see` (marks plus legend); turntable framing.

**Left out:** shardfall's clip codec and importers ("Rust ports of the my-3d2dge JavaScript this plan ports itself"), and
its foot IK, which only drops the pelvis.

### §6.6 Data-first registries and schemas (`PLAN.md:996-1008`)
- **The registry API:** `defineKind(kind, schema)` with fields, defaults, ranges, units, docs, hooks and fallbacks;
  `def(kind, id, spec)` validates with coded plain-sentence errors; `get` warns once and returns the fallback; `list`.
- **"Ask the entry, never the id"**, enforced by an ESLint rule against id string comparisons.
- **Every kind gets** an `x describe` listing and an INDEX row. Templates arrive with use.
- **Animation kinds:** `skeleton`, `build`, `move`, `pose`, `stance`, `rig`, `body`, `actor`. Phase 8 adds `action` and
  `clipset`.

### §8.3 The inspector API, `window.__engine` (`PLAN.md:1275-1293`)
- **One inspector API, also headless** (`createHeadless`), minus the rendering members:
  - identity: `info()`, `errors`, `advice`;
  - time: `pause`, `resume`, `step(n, intents)`, `timeScale`, `seed`;
  - state: `state`, `hash`, `trace`, `entities`, `get`, `set` (settings schema only), `capture`, `restore`, `describe`;
  - scene: `scene.dump()` as a text tree; `camera`;
  - `stats()`, including `animMs`; `shot()`; `input.press`, `axis`, `play`, `record`; `actions`; `help()`.
- **Members are registered** with `def('inspectorMember', ...)`, never edited in, so WPs don't collide.
- **In Node,** `view: true` builds the scene graph without a GPU; only `render` and `shot` throw a coded error.

### §8.5 Visual verification without committed images or a display (`PLAN.md:1310-1328`)
1. **An ID pass:** flat per-object colours read back as `visible: [{id, name, px, bbox}]`, so "the hero covers 0 px" reads
   as text.
2. **Look metrics:** coverage, luma spread, dark and blown fractions, colour count, largest share, protagonist visibility,
   edge density.
3. **Text thumbnails:** a 48×27 hex grid stored as JSON. Playwright screenshot baselines are banned because they commit PNGs.
4. **`x film --compare <ref>`** builds the ref in a temporary worktree; the diff report attributes changed pixels via the
   ID pass.
5. **Images on demand only,** capped at 1,600 px, reviewed by a `visual-reviewer` subagent that returns JSON. `--marks`
   numbers the objects.
6. **UI through DOM queries.**

### §8.6 Content QA and baselines (`PLAN.md:1330-1355`)
- **Animation QA** over every move, clip, action and fixture rig in every body state:
  - pops, foot sliding, joints under the ground, bone stretch, joint limits, loop closure;
  - **twist jumps above 120° while a limb is folded past 140°** (the v1 pop pattern), angles beyond ±540°, NaN;
  - the same hash twice; 1/60 against 1/120.
- **Baselines** in `tests/baselines/qa-<family>.json`, listing accepted exceptions as `{id, metric, value, reason}`. A new
  violation fails the test, and so does an accepted one that got worse.

### §8.11 The MCP bridge (WP 7.6, on demand; `PLAN.md:1425-1442`)
- **Built only when** an agent that cannot run `node x` needs to drive the engine.
- **Design:** `@modelcontextprotocol/sdk` over a persistent `x inspect` session. Tools are generated from the inspector
  members' argument schemas (`engine_open`, `engine_step`, `engine_state`, `engine_shot`, `engine_input`,
  `engine_replay`, `engine_set`, `docs_lookup`, ...). It restarts when engine sources change.

### §8.12 Docs as an interface, checked for drift (`PLAN.md:1444-1457`)
- **`x docs --check` fails when:**
  - an `@example` does not run;
  - a mentioned path or name does not exist, including `my-3d2dge:`/`shardfall:` citations checked against the pinned
    sources;
  - a public export lacks a doc comment, or an error code lacks its fix;
  - INDEX, API or ERRORS are stale;
  - `help()` differs from the inspector.
- **`docs/API.md` is the game agent's complete manual.** The version lives in `package.json` only.

### Phase 8 and §10, in brief (`PLAN.md:2989-3177`, `:3523-3675`)
- **Order:** WP 8.1 provenance, then 8.2 codec and format 2, 8.3 one file per clip, 8.10 shardfall's sets, 8.4 the baker,
  clip layer, retargeting and mannequin, 8.5 the tools port, 8.6 tests and QA over 1,218 clips, 8.7 ACTIONS, 8.9 clip mode.
  8.8, re-import from the sources, is on demand.
- **Each migration step has a proof** (§10.5):
  - the split ledger joins back exactly;
  - the decode is within 0.001 mm, and the oracle is bit for bit;
  - rejoined sets deep-equal their sources;
  - Quaternius v2 against v1 on v1's rest bodies: 79 of 87 shared clips within v1's fit, the other 8 explained;
  - FK parity of 1 mm or less mean per set;
  - `x anim import --cmu --legacy` byte for byte.
- **After WP 8.10:** 1,218 clips, 5.40 MB of text (1.10 MB gzipped). Four 100STYLE clips exceed the fit limits, worst
  `WildLegs_Walk` at 71/546 mm (`PLAN.md:3540`).

---

## 5. PLAN.md structural conventions (item 6)

### 5.1 Size and shape
| Measure | Value |
|---|---|
| PLAN.md | 469,374 bytes, 4,455 lines, 72,162 words, 14 numbered sections plus Appendices A–F (source-to-target map, banned APIs, conventions, measured numbers, a draft AGENTS.md, a glossary) |
| Supporting research | 8 studies with `path:line` evidence, about 436 KB (`docs/research/A`–`H`) |
| WPs | **97**: S 25, M 61, L 11; 22 of them **on demand**; plus 10 gates (G0–G9) and 8 upgrade WPs (U-1…U-8) |
| WP entry length | median **186 words**, min 87, max 1,374 (WP 3.12, touch controls); all WP entries total 22,903 words, about 32% of the plan |
| Executed (ledger, `PLAN.md:3917-4040`) | **23 WPs done** (all 12 of Phase 0, all 6 of Phase 1, 5 of 7 in Phase 2) plus gates G0 and G1. 68 rows todo, 22 on demand. That is 24% of WPs, or 31% of the 75 scheduled, in about two days |

### 5.2 Phases, lanes, gates
- **The table** (`PLAN.md:1525-1546`):
  - Phase 0 Foundation (lane T) and Phase 1 Kernel (lane C) run sequentially.
  - Phases 2-7 are "Box 1" to "Box 6". Each runs **parallel lanes** and ends at a gate (G2 to G7, "the Stress Box").
  - Phase 8 (animation library, lane L) and Phase 9 (audio, lane X) may start early but "never delay a box stage".
  - On-demand WPs start on measured triggers. Phase H (production hardening) is unscheduled.
- **Lanes:** T tooling, C core, R render, W world, P physics, A animation, I input/UI/dev, B box (the integrator), L library,
  X audio, R2 advanced GPU.
- **Dependency graph:** each WP repeats its direct dependencies in a **Needs** line (`PLAN.md:1573-1599`), e.g.
  `Library: G0 → 8.1 ; [0.11, 1.1] → 8.2 → 8.3 ; {8.1, 8.3} → 8.10 ; ...`.
- **A gate is a fixed command set.** Gate G8: "The library is intact, with provenance and parity proofs. The clip layer
  plays every clip on every build in Node with clean QA... `x anim import --cmu --legacy --check` passes."
- **On-demand triggers are concrete** (`PLAN.md:1548-1571`). WP 8.8 starts when "a clip needs a degree of freedom format 1
  lacks ... to fix a defect that can be seen or measured". "A trigger that never fires means the WP was not needed, which
  is the expected outcome for several of them."

### 5.3 WP format (`PLAN.md:1629-1638`)
- **Owns:** the paths it may create or change. Two WPs that may run concurrently never own the same path.
- **Needs**, **Trigger** (on demand only), **Carry** (exact source paths at `my-3d2dge@e37e4ee`), **Build**,
  **Improves** (§7 ids).
- **Done when:** measurable outcomes. **Verify:** commands that must exit 0.
- **Size:** S under 300 new lines, M under 1,000, L under 2,500. "A WP that would exceed L is split."
- **Rules** (`PLAN.md:1619-1627`): "What Owns covers" implicitly (its specs, tests, templates and baselines). "Every claim
  is proved": each Done-when bullet maps to a Verify step, or is marked *(deferred proof: <where>)*.

**A complete WP as written** (`PLAN.md:2328-2350`):

```markdown
#### WP-3.6 Humanoid procedural port
- **Owns:** `engine/anim/{authoring,locomotion,poses,humanoid}.ts`
- **Needs:** WP 3.5
- **Size:** L
- **Carry:**
  - Gait, idle, lean and arm swing (`engine:1919-1954`).
  - Poses and stances (`engine:1924-1937, 1955-1968`).
  - The state update (`engine:1803` onward).
- **Build:**
  - The `B(f, r, u)` authoring helper.
  - Every constant in a table, with a one-line comment each.
  - In the differential harness, the port starts from the reference rig's recorded breathing phase (WP 0.11), so breathing cannot push the error past the tolerance.
  - An effector stage, then a solve stage:
    - the spine from lean and twist;
    - limbs through `twoBoneRot`, using the old hints as poles;
    - feet and hands.
  - A fixed dt, and seeded per-entity streams.
- **Improves:** I-09.
- **Done when:** the differential tests against `tests/baselines/port/humanoid-*.json`, converted to SI, pass:
  - joint positions are within 1 cm on average and 3 cm at worst;
  - every exception is listed with its reason. The removed view hacks are the expected exceptions.
- **Verify:** `npm test -- engine/anim/humanoid` (the motion QA runs over it from WP 6.6 on)
```

Other acceptance styles in the animation WPs:
- **WP 8.2:** "Every curated clip decodes within 0.001 mm, and the oracle reproduces the reference vectors bit for bit.
  Round trip, and mirroring twice, stay within 0.5 mm."
- **WP 8.4:** FK parity "mean of 1 mm or less for every set". A walk/run switch test runs "just above and just below
  √(w·r) × 1.15 and × 0.87 ... sees one change each way". A baked `AnimationClip` matches the clip layer within 0.1 mm.
- **WP 8.6:** fit thresholds of 40/300 mm per clip and 20 mm per set. The Node part must run "in under 30 s"; if not, T1
  keeps a sample.
- **WP 3.5:** "On a 10° slope and a 0.2 m step, soles stay within 5 mm of the surface."

### 5.4 §9.3 Definition of done for every WP (`PLAN.md:1603-1617`)
1. **Verify and tests.** Its Verify commands exit 0, and `npm run check` and `npm test` are green.
2. **Browser suites.** The T2 suites covering what it touched are green.
3. **Docs.** Every new module has a file comment and every export a doc comment; `x docs --check` passes and the generated
   docs are rewritten. In ultracode, drift is a warning and the integrator regenerates.
4. **QA and templates.** A kind with a QA family has its checks. The third hand-written entry of a kind adds a scaffold
   template.
5. **The box rule.** A Phase 2-7 capability is exercised by the box or a fixture test, and Done-when says which.
6. **Review scales with risk.** L WPs and every gate get a `verifier` review against DOCTRINE.md and Done-when, with every
   finding fixed or answered. S and M WPs rely on Verify plus the gate review ("ceremony scales with risk").
7. **Dependencies first.** Compatible releases from `x deps --update` are adopted first, in their own commit.
8. **No new advice codes** during tests, unless allowlisted with a reason.
9. **Escalations recorded.** Every escalation is in `docs/escalations/`, and every call made in the owner's absence is
   named in the ledger note.
10. **Ledger updated** (status, commit, notes). Deviations from the plan become ADR amendments, and deviations from the
    doctrine are escalated, "never silently". An on-demand WP records its trigger measurement.

Phase 0 bootstraps these as tools appear (items 1-3, 7 and 8 apply once their tools exist).

### 5.5 Tests and time budgets
- **Tiers** (`PLAN.md:1256-1273`): T0 `npm run check` under 10 s, after every edit and at Stop; T1 `npm test` under 60 s,
  before every commit; T2 `npm run e2e` under 6 min, before every push; long runs at gates.
- **Budget enforcement:** `x ci --local` warns over budget and fails at 1.5×.
- **Selection:** through Vite's module graph (`vitest --changed`, `vitest related`).
- **Rules:** "A test that waits on wall-clock time is a bug." Never skip a test to get green.
- **Output contract for every `x` command** (`PLAN.md:1213-1222`): at most about 20 lines, verdict first; always a
  `report.json` with a fixed schema; exit 0, 1 or 2; unknown flags are errors that name the closest valid one.

### 5.6 Escalations and decisions
- **Escalation** (§8.14, `PLAN.md:1468-1491`):
  1. `x esc open` writes `docs/escalations/ESC-NNNN-*.md` with a 15-minute deadline, options and a recommendation.
  2. Post the message, then `send_later` and end the turn.
  3. Never perform the action while waiting; take the doctrine's preferred alternative.
  4. With no answer: commit, decide, `x esc decide` (status `decided-in-absence`), and continue.
  - Lanes in ultracode never wait; the integrator escalates once per run. The Stop hook warns about overdue records.
- **Decisions:** 21 ADRs recorded in WP 0.1 (`PLAN.md:3867-3891`), one page each (Decision, Why, Enforced by).
  - **Deviations follow §11.4:** measure; choose what best keeps the doctrine; escalate if needed, else decide; append an
    ADR amendment with the evidence; and edit the affected WP entries in the same commit.
  - "The plan is a living document. Its ledger, ADRs and escalation records are the truth about what was done."
  - Open questions each carry a default: "proceed with the default; revisit only through an ADR amendment"
    (`PLAN.md:3893-3915`).
- **Running modes** (§11): "extra effort" is one agent working sequentially (recommended order `PLAN.md:3696-3709`); "ultracode"
  is under 10 agents, up to 6 implementers in git worktrees with Owns-only edits, a verifier queue and an integrator that
  owns shared files and regenerates docs. Implementer and verifier prompt templates are at `PLAN.md:3769-3797`; the
  implementer report is ≤ 30 lines, the verifier returns JSON `{pass, failures[{what, where, fix}], notes}`.
- **The one reading instruction** (`PLAN.md:3692`): read DOCTRINE.md, AGENTS.md, the WP entry and only the sections it
  cites, plus the file comments of the modules involved.

### 5.7 What the execution record says about plan size and granularity
- **The WP template works.** 23 WPs landed in about two days, each with a commit, Verify results, a ledger note and
  explicit "calls". The notes are long (250 to 1,555 characters) and carry the real information: deviations, measured
  numbers and deferred proofs.
- **Sizes were systematically underestimated by one class,** because tests count. The size scale counts "new lines"
  without saying whether tests are included.
- **Ten amendment-worthy surprises a day.** 22 ADR amendments show the plan's details were often wrong, or too
  prescriptive in tool-level detail. The plan absorbed this through the §11.4 rule rather than breaking.
- **The plan is too big to read, by design.** It depends on "read only your WP and its cited sections". 72k words plus
  about 436 KB of research is a lot of up-front cost, and a third of the plan describes on-demand or later work
  (Phases 10-12, H) that may never run.
- **A pinned snapshot of a fast-moving sibling went stale within a day** (shardfall's studios).
- **Takeaway for agent plans.** WP entries of about 150-250 words with Owns/Needs/Done-when/Verify/Size are the right
  grain. Wrap them in a small spine: phases, gates, a ledger, a DoD and an escalation protocol. Keep background,
  inventories and research out of the critical reading path, in separate files.

### 5.8 my-3dge's DOCTRINE.md against my-3d2dge's
- **my-3dge's is the owner's base text verbatim:** 64 lines, byte-identical to `shardfall/docs/DOCTRINE.md` (md5
  `0448c5d8…`). It has 10 one-paragraph principles, "Mastery over novelty" (12-month rule), and escalation as "escalate
  and wait; with no response in 15 minutes, commit, make the call, continue".
- **my-3dge keeps the text frozen and pushes all application elsewhere.** It goes into AGENTS.md "The doctrine, as
  checks" (`AGENTS.md:25-51`) and PLAN.md §3, a principle-to-rules-to-enforcement table (`PLAN.md:172-201`), citing
  "principles by name, never by number, so a renumbered doctrine costs nothing" (`PLAN.md:176`). A PreToolUse hook asks
  the owner before any DOCTRINE.md edit (`CLAUDE.md:5-6`).
- **my-3d2dge's is a 211-line rewrite**, decision D1 on 2026-10-10 (3d2dge `docs/DECISIONS.md:21-30`):
  - **two tiers**, the engine and prototypes ("about 1 in 100 reaches production"), with prototypes allowed to reach past
    the API;
  - **a measured North Star:** the time from a brief to a playable link, and how often a fresh agent's first build runs;
  - **P1 as "an agent builds a game from the manual alone"**, with a measured token budget (under 10,000 tokens);
  - **P5 and P6 as named invariants**;
  - **P9 renamed "Pin what agents know"**: checked by having an agent write against it cold, vendored, stale APIs banned.
    It replaces the 12-month rule;
  - **a "Checks" section** ("A principle without a check drifts");
  - **escalation by blast radius:** reversible calls are made at once in their own commit and logged; only hard-to-undo
    calls get the 15-minute timer;
  - **a decisions log that is "never cleaned up"**, and a grandfathering table "In this repository".
- **riftlight's is a third variant:** P1 "Gameplay is data" and P2 "Headless and verified", with a gap list
  (`riftlight/docs/DOCTRINE.md`).

---

## 6. Cross-repo synthesis (item 7)

### 6.1 Reused again and again (the signal for a package core)
1. **The readable key-pose format and its legend.** shardfall kept it unchanged so clips move between engines
   (`clips.rs:4-11`, `:108-121`). my-3dge makes it the stored format (ADR-0010, `PLAN.md:3553-3597`).
2. **Sets with provenance:**
   - per set: `sources` (label, license, origin, url, the measured `rest` body), `credit`, `legend`, `fps`;
   - per clip: `src`, `orig`, `take`, `fit` [avg, worst] mm (`anim/quaternius.json` header; `PLAN.md:3605`).
3. **Catalogs as a model's selection interface:** one line per clip, `[tags, desc]`, plus `$pick` for reproducible cuts
   (shardfall `anim/catalogs/*.json`; my-3dge WPs 8.1 and 8.10, `catalog.tsv` at about 30 tokens a row).
4. **The CMU ledger:** 2,548 takes with category, fit, flags and picks (shardfall `anim/cmu/takes.tsv`; my-3dge splits it
   in 17).
5. **The import pipeline:** reader, 36 body points, encode, RDP keys, then a fit that adds the worst-missed frame.
   shardfall ported it; my-3dge will port it.
6. **The move model:** an arc, wind/active/recover, lunge/hop/crouch/lean/twist, and chaining from the current pose.
   shardfall re-encoded it in TOML; my-3dge ports it as timelines with differential tests (`moves.json` vectors).
7. **Retargeting** by direction plus bend at the target's own lengths, with IK for elbows and knees and the sole (not the
   ankle) to the floor. Used by shardfall and planned by my-3dge.
8. **Two-bone IK with a pole** in every repo, under different names (riftlight `twoBoneIK`/`twoBoneX`, shardfall's
   puppet IK, my-3dge `twoBone`/`twoBoneRot`).
9. **Visual verification:** contact sheets, filmstrips and turntables with machine-readable reports, and a lab or studio
   page with a `window.__X__`/MCP handle. In all three repos.
10. **Licensing discipline:** CC0 and CMU terms embedded; CC BY with credit; non-commercial libraries local-only; binary
    sources only in a git-ignored cache.
11. **Clip facts measured from motion:** `speed` and strike time (shardfall's ideas, adopted by my-3dge §5.8).
12. **The agent-first doctrine.** All three.

### 6.2 Re-implemented in each repo (the duplication cost)
| Piece | 3d2dge (JS) | shardfall (Rust) | my-3dge (TS, planned) | riftlight (TS) |
|---|---|---|---|---|
| Codec (parse, text, mirror, decode, encode, fit) | `readable.js` 338 lines | `mocap/readable.rs` 1,065 + `clips.rs` 1,053 | `engine/anim/clip/{readable,validate,lens,mirror}.ts` (WP 8.2, M) | — |
| Importers | about 730 lines (`anim-import` 263, `asf-amc` 175, `cmu` 258, `anim-set` 34) | about 4,400 lines (`glb` 601, `acclaim` 429, `bvh` 692, `fbx` 539, `cmu` 440, `takes` 664, `fetch` 161, `mod` 882) | `tools/anim/*` (WP 8.5, L) | — |
| Clip runtime (sample, blend, mask, retarget) | `mocap.js` 265 | `clips.rs` + `puppet.rs` (1,600) | `bake/library/layer/retarget.ts` (WP 8.4, L) | `compile.ts`, `animator.ts`, `rotationBlend.ts` |
| Move library | `E.MOVES` (24) | `moves.toml` + `moves.rs` 566 | `moves.ts` + `moves-data.ts` (WP 6.1, L) | hand-keyed attack clips + `COMBAT_TIMING` |
| Animation QA | `mocap-test.mjs` (fit 40/300/20 mm, round-trip, mirror, provenance) | `tests/motion.rs`, `mocap.rs` | `tools/qa/anim.ts` (WP 6.6) | `metrics.ts` (`analyzeClip`) |
| Sheets and films | `anim-sheet.mjs`, `filmstrip.mjs` (Playwright) | `animsheet`, `filmstrip`, `turntable` (wgpu) | `x sheet` (Node SVG), `x film` | `sheet.ts`, `curves.ts`, `raster.ts`, `film.ts` (821) |
| Live clip editing | Mocap Lab "This clip as text" | Animation Studio (`anim_edit` with revisions) | clip mode in the box (WP 8.9), Library Lab on demand | Animation Lab (`__ANIM_LAB__`) |
| Procedural creatures | Blob rig | `rig.rs` N-leg gait + SpawnForge (vendored TS) | WP 10.1 (on demand) | monster `Poser` + N-leg IK |

- **The codec and importer alone** cost about 7,500 Rust lines in shardfall. my-3dge budgets an M + L + L + M set of WPs
  (8.2, 8.4, 8.5, 8.6) to redo them in TS, under the same "bit for bit or within 0.001 mm of the JS original" standard.
  That is the core argument for one shared package with a conformance suite.

### 6.3 Where formats and tools diverged (forks)
- **Format version:** shardfall added `speed` (per clip) and `title`/`legend` (per set) but kept `"format": 1`. my-3dge
  calls them format-2 fields. Nobody validates `format` on read (shardfall `clips.rs:157-158`).
- **Unknown fields:** shardfall's clip reader ignores unknown keys, and its moves reader rejects them (`moves.rs:73`).
  my-3dge rejects unknown keys in data files (`PLAN.md:1222`) but relies on shardfall ignoring them for interop
  (`PLAN.md:3576`).
- **Container:** 3d2dge uses JS scripts with a comment header (`src/mocap/sets/*.js`). shardfall uses one JSON file per
  set (comment lines `//` tolerated, `clips.rs:178`). my-3dge plans one JSON file per clip, plus `_set.json` and
  `catalog.tsv`.
- **Same name, different content:**
  - `QUATERNIUS` in 3d2dge is 88 clips from `AnimationLibrary_Godot_Standard.glb` (Rigify).
  - In shardfall it is 102 clips from `UAL1_Standard.glb` v2 (Unreal rig), with `_RM` twins. Its rest bodies differ in
    `bt`, `spineW` and `neckW`, so decoded on their own rests fewer than 60 of the 87 shared clips stay within v1's fit
    (`PLAN.md`, WP 8.10 Done-when).
  - my-3dge will merge them: v2, plus v1's `Punch_Enter`, plus v1's `body` restored for the mannequin, because shardfall's
    files drop it.
- **Moves.** Units are radians and pixels in 3d2dge, degrees and arm lengths/metres in shardfall, metres with
  self-describing fields in my-3dge. Names differ: `spin` is shardfall's whirlwind but 3d2dge's spin is shardfall's
  `spinslash`. Only shardfall has `about` lines.
- **Skeleton model.** 3d2dge stores 15 joint positions. shardfall's `Skel` holds points and frames with a one-segment
  spine. riftlight uses Euler local rotations on named `Object3D`s. my-3dge plans quaternion local rotations on root plus
  23 joints.
- **Determinism stance.** shardfall's replays hold only on the recording machine. my-3dge holds one golden across Node and
  Chromium (fdlibm swap). riftlight is seeded, but WebGL 2 is its headless path.
- **Creature animation forked off the readable format entirely:** shardfall's Creature Studio uses baked bone tracks, and
  riftlight's monsters use baked `ClipDef`s.

### 6.4 Friction in adopting
- **The JS-shaped container needed adapters** in Rust: a script-wrapper extractor, and an order-preserving JSON reader for
  catalogs.
- **Bit-exactness meant emulating V8's numerics:** f64 operation order, f32 storage, fdlibm, V8's `hypot`, JS
  `Math.round`, `toFixed`. Expensive, but it yielded number-for-number proofs.
- **Two-step adoption.** shardfall first imported 3d2dge's already-fitted sets, then wrote the native importer the same
  day (`docs/HISTORY.md:530-533`).
- **Proportion and spine mismatch** limits decode parity to direction tolerances (<9°, up to 14° for curled spines).
- **Missing degrees of freedom** (hands, forearm twist, foot roll, spine, root yaw) are not recoverable from stored
  clips; fixing them needs re-import from the sources (my-3dge WP 8.8, which needs the owner to supply the Quaternius v2
  GLBs, `PLAN.md:3125`, §11.5).
- **The format had to bend around a sibling reader:** fixed-length arrays forced named fields.
- **Licensing gaps:** CMU's record lacked the no-resale clause; non-commercial libraries need a local-only lane; CC BY
  needs an on-screen credit.
- **Stale snapshots:** porting from a pinned commit missed a day of upstream work.
- **Clip names with spaces** (`MESH2MOTION/Dance Charleston`) force slugged file names.
- **Content that does not retarget:** cartwheel and backflip as a dodge, a levitating idle, Quaternius swims with the
  hips below the floor (`PLAN.md:3645`).

---

## 7. Lessons for a standalone, agent-first animation package (TS and Rust consumers) (item 8)

### 7.1 API boundary
- **Make the shared unit data plus conformance, not code.** The format spec, the sets, the catalogs, the provenance and
  the golden vectors are what every engine reused. Code got rewritten per language each time.
  - Ship a reference implementation (TS) and a Rust crate that both pass one conformance suite.
  - Or ship one implementation behind a process boundary. Shardfall already consumes a TS package (SpawnForge) from Rust
    as a JSON-lines sidecar, with an adapter that owns the conversion to a native format the host validates.
- **Keep the core pure, deterministic and renderer-free.** my-3dge's `anim/` imports only core math and is sim-side
  (`PLAN.md:781-829`). Split the API into `step` (cheap, hashable gameplay state: timelines, events, root motion) and
  `pose` (presentation, LOD-able) (`PLAN.md:941-945`).
- **Bake to each host's standard type at the edge:** three.js `AnimationClip`/`QuaternionKeyframeTrack` in TS, a plain
  track struct in Rust. Bake from the format's **parameters**, not decoded points (0.26–0.46 mm mean, against 0.73 m
  worst for key-for-key, `PLAN.md:298`).
- **Stable string ids as the content API:** `SET/Clip` and move names, referenced from game data (`idle_clip`,
  `attack_clips` per swing, `attack_moves`, `dodge_clip`) and validated on load with suggestions.
- **Expose measured facts per clip,** so games need not reinvent them: duration, loop, `speed`, travels, strike/hit time,
  contacts, fit, license.
- **Agent tool shape:**
  - search returns short JSON rows with a limit (40), and show returns the legend, readable text and provenance;
  - edits take a `revision` and `if_revision`, with conflicts reported and undo/redo;
  - unknown arguments are errors (Pavilion Lite's friction list);
  - every reply carries a `next`/`use` hint;
  - riftlight's six-step tool template (pure core, CLI with header manual and `--json`, PNG, JSON, lab handle, smoke test).
- **No camera or visibility input into animation;** timing events live in the clip, not a side table (riftlight's
  `COMBAT_TIMING` duplication).

### 7.2 Versioning
- **Make `format` a real, validated version** with written compatibility rules:
  - **minor:** additive optional named fields; readers ignore unknown fields;
  - **never** extend fixed-length arrays;
  - **major:** anything else.
  Today format 1 plus `speed` is called "1" in one repo and "2" in another.
- **Version set content separately from the format.** Give each set a content id that includes the source edition and
  importer revision (e.g. `QUATERNIUS` UAL v2 2026-06, importer rev X), plus a content hash. One name for two different
  88/102-clip sets is a fork waiting to bite.
- **Record the producer in every file:** importer version, source file names, revision, and `via`. Include the conversion
  that made it (shardfall's `origin` strings; my-3dge's `via: v1|shardfall|source`).
- **Pin exactly in consumers,** with a deliberate upgrade step. SpawnForge's rule: "Never silently point this adapter at a
  newer checkout"; update the pin, the hashes and the contract tests together.

### 7.3 Distribution
- **Patterns seen:**
  - vendored exact source with a per-file SHA-256 manifest (`tools/creature-compiler/pin.json`);
  - a single self-contained module (riftlight's `pixel-engine.js`, about 4.3 MB) or a single HTML file;
  - pinned read-only checkouts plus committed reference vectors (my-3dge);
  - a checksummed source tarball for handoff (`pavilion-lite/package.sh`, `scripts/package-agent.sh`).
- **For a multi-language package:**
  - an npm package (TS runtime plus data) and a crate (Rust runtime plus `include_bytes!` data, or a build-time fetch);
  - both generated from one repo, with **one data directory as the source of truth**;
  - the large corpora (CMU full library, 68 MB; 100STYLE extras) as checksummed release assets fetched into a cache on
    demand, never committed (my-3dge Q10, `PLAN.md:3906`);
  - non-redistributable libraries only via local import tools into a git-ignored `local/` (shardfall `anim/local`).
- **Keep the data container trivially parseable in every language:** plain JSON (no JS wrappers), stable key order or no
  order dependence, no comments, one clip per file for agent reading and git diffs.

### 7.4 Cross-language conformance tests
Three tiers; tiers 1 and 3 are already shown in shardfall, and tier 2 is planned (my-3dge WP 8.2, todo at 652ea6b):
1. **Encoder parity, bit for bit.** A tiny rig built in test code (no binary fixture; `crates/pav_tools/tests/mocap.rs:46-140`)
   and one small text capture (CMU `09.asf` and `09_02.amc`), with the expected sets written by the reference implementation.
2. **Decoder parity in millimetres on the reference body.** The source decoder runs as an oracle (`vm`) and each clip
   decodes within 0.001 mm of the vectors (my-3dge WP 8.2). The vectors are generated by a tool, committed as text with
   SHA-256, byte-identical on re-run (`tests/baselines/port/README.md`).
3. **Semantic parity on a different body:** per-limb direction within N degrees at sample times (shardfall
   `tests/motion.rs:23-51`, <9°), plus QA invariants (finite values, feet above the floor, bone lengths).

If bit-exactness across languages is a requirement, the spec must pin the numerics: fdlibm for `sin`, `cos`, `atan2`,
`acos`, `asin` and `pow` (shardfall `libm`; my-3dge @stdlib ports and `withSimMath`), f64 operation order, the rounding
rule (JS `Math.round` semantics), and number formatting (shortest round-trip, `-0` kept). Otherwise, state tolerances
per tier.

### 7.5 The format spec
- **Write a standalone spec** that both implementations cite:
  - the legend (about 450 tokens; already embedded in every set file);
  - the frame ("forward, right, up"), units, rest-body measurement and per-library spine shares;
  - interpolation (linear per stored number; loops wrap; one-shots hold);
  - quantization (1°, 1%, ms times), angle continuity (the turn+180 alternatives) and limits (4,096 keys, 600 s, keys
    ≥ 1 ms apart).
- **Ship a validator** with coded messages naming the key, time and field:
  - twist jumps >120° while bend >140° (the v1 pop);
  - angles past ±540°, hips below the floor, direction collapse;
  - plus a "normalized lens" for reading (`PLAN.md:3589-3597`).
- **List the known missing degrees of freedom,** and the named optional fields that add them.
- **Keep the agent-facing stored form** (readable, size-independent, IK-shaped, whole numbers). Derive runtime forms from
  it, never the reverse. Rotation-native text was measured and rejected for readability and size independence
  (`docs/research/D-mocap-library.md:568-578`).

### 7.6 Sharing catalogs and provenance
- **Catalogs are the model's index:**
  - one line per clip, about 30 tokens: name, seconds, loop, speed, tags, what the body does, source;
  - tiers: a core list of about 40, then the per-set catalogs, then the ledger via a search tool;
  - "agents search the library, never read it whole".
- **Catalogs double as importer input:** `$pick [take, start, end, speed?, way?]`, `$skip` with reasons, `$sources`. This
  makes sets reproducible from public data (CMU regenerated byte for byte; shardfall re-cut 4,770 clips identically).
- **Provenance is enforced by tests:**
  - every clip has a fit, a source with a license, and a valid `orig`/`take`;
  - set fit limits are mean ≤ 20 mm, with clips ≤ 40 mm mean and ≤ 300 mm worst (3d2dge `docs/MOCAP.md:385-402`;
    my-3dge WP 8.6);
  - exceptions are baselined with reasons;
  - license texts live in `LICENSES/`, with CMU's terms verbatim.
- **License tiers in the package:** distributable (CC0, CMU terms, CC BY with a display-credit rule) and local-only
  (Bandai CC BY-NC-ND, LaFAN1, Mixamo). The package exposes the tier per set so games can comply automatically.

---

## 8. Lessons for writing the execution plan (item 9)

### What worked
- **The WP template:** Owns (exclusive paths), Needs, Carry (exact source line ranges), Build, Done when (numeric), Verify
  (exit-0 commands), Size. "Every claim is proved," or marked as deferred proof with its location (`PLAN.md:1627`).
- **Reference vectors before any port** (WP 0.11 in Phase 0), then differential tests with explicit tolerances and listed
  exceptions (WPs 3.6, 6.1, 8.2). This makes "the feel survives translation" checkable.
- **Gates as fixed command sets.** A ledger table in the plan, updated per WP with commit and notes. A one-screen
  `PROGRESS.md` (checked at 40 lines).
- **A definition of done applied to every WP** (§9.3). Review scales with risk: a verifier subagent for L WPs and gates
  (it found 8 issues at G0).
- **Concrete on-demand triggers** that keep speculative work out of the critical path. Owner switches listed with
  fallbacks, so nothing stalls (`PLAN.md:3811-3832`).
- **Escalation and decision mechanics with tools** (`x esc`, 15-minute rule, `decided-in-absence`), and ADR amendments
  for every deviation, edited into the plan in the same commit.
- **Implementer and verifier prompt templates** with short structured reports (≤ 30 lines, and JSON).

### What to avoid, or calibrate
- **Don't let the plan become the corpus.** 469 KB plus about 436 KB of research worked only because of a strict "read
  only your WP" rule. For a package plan, aim for a lean spine (tens of KB) with research and inventories in separate
  files.
- **Budget sizes about 2× and count tests explicitly.** All 9 WPs that reported a size overran by one class.
- **Expect, and plan for, about 10 amendments a day.** Prescribe outcomes and checks, not tool-level mechanics. Most of
  the 22 amendments overrode such details (Prettier scope, script timing, hook language).
- **Leave headroom in time budgets.** T0 hit its 10 s budget in Phase 1. Define the measured fix in advance (project
  references did it).
- **Plan how upstream changes flow in.** A pinned snapshot of a fast-moving sibling went stale in a day. Better: make the
  animation package itself the upstream, and have engines pin it.
- **Don't schedule duplicate ports of the same code.** Decide once where the codec lives, and give other languages a
  conformance-suite WP instead.
- **Mark untested-by-order items explicitly** (ADR-0021), so the verifier doesn't flag them and nobody assumes coverage.
- **Add fresh-agent dry runs as acceptance gates** for agent-facing surfaces. Pavilion Lite's run found 13 friction
  points, and a smaller model exposed missing affordances.

---

## Appendix: key numbers

| Fact | Value | Source |
|---|---|---|
| 3d2dge library | Q 88 (13.9/222 mm), M2M 177 (16.1/286), CMU 60 (17.8/167); 1.93 MB text | my-3dge `PLAN.md:286-292` |
| shardfall embedded sets | Q v2 102, M2M 177, CMU 60, STYLE100 98 = **437 clips, 8,487 keys** (docs say 423) | counted from `shardfall/anim/*.json` |
| shardfall on-disk sets | CMU 4,770 clips, 241,740 keys, 68 MB; 100STYLE extras 780 loops, 9,779 keys, 2.8 MB | `anim/cmu/`, `anim/100style/`; `docs/HISTORY.md:366-384` |
| Bit-exact parity | M2M 119,432 numbers; CMU 104,101; full CMU survey 2,548 rows and 113 sets identical | `docs/HISTORY.md:371-373,445-449` |
| Decode parity, different body | < 9° per limb (test), up to about 14° on a curled spine | `tests/motion.rs:23-51`; `docs/HISTORY.md:506` |
| Bake accuracy | 0.26–0.46 mm mean from parameters; key-for-key worst 0.73 m | `PLAN.md:298,4257` |
| my-3dge library after WP 8.10 | 1,218 clips, 5.40 MB (1.10 MB gzipped) | `PLAN.md:3540` |
| my-3dge port vectors | 8 files, 3.55 MB, SHA-256 checked | ledger WP 0.11 |
| PLAN.md | 469 KB, 72,162 words, 97 WPs (25 S, 61 M, 11 L; 22 on demand); median WP 186 words | computed |
| Executed | 23 WPs plus G0 and G1 (24% of WPs) by 2026-10-10 | `PLAN.md` §14; `docs/PROGRESS.md` |
| Size overruns | 9 of 9 reporting WPs over by one class | `PLAN.md` §14 notes |
| ADR amendments | 22 across 9 ADRs in 2 days | `docs/decisions/` |
| Code size | riftlight src 105k TS lines; shardfall 73k Rust; my-3dge engine 24k, tools 15k TS | `wc -l` |
