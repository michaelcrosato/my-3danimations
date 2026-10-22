# Changelog

One version for every `@m3a` package and the spec (`node tools/version.ts`). While the major number is 0: minor for
features, patch for fixes. One line per change, under the part it touched (**Spec**, **Core**, **Sensors**, **IO**,
**Library**, **Three**, **Tools**, **Repo**, **Docs**).

## 0.57.1 · 2026-10-22

G8 passes (D133): the owner's review of the 20-clip batch applied.

### Library
- The owner's review applied (`npx m3a review ingest`): 20 clips carry it, 18 approved and 2 flagged
  (`CMU_CURATED/Jump_Twist`, `STYLE100_SIDE/LawnMower_SideLeft`); the 8 sets' manifests and the lock written by the
  review's writer, each re-import byte for byte; index serial 6.

### Docs
- docs/FEEDBACK-LOG.md's F7 (13 notes) and docs/REVIEW-PROPOSALS.md (2 task proposals), from the owner's review.

## 0.57.0 · 2026-10-22

WP-F.11 (D132): the review page plays its clips in place, links them in the gallery and opens G8's batch on its own.

### Repo
- The review page (WP-F.11, D132): each card plays its clip, looping, in place on the gallery's stage (`gen-1`, the
  sheet's view; one stage for the page, one card at a time; three.js loads at the first Play; with nothing playing the
  page draws no frame), and links it in the gallery in a new tab (`?clip=`, the route's own link; a submission's, the
  clip it improves). It opens the batch a link names (`?queue=NAME`), else a queue bundled, else the newest batch the
  build carries, saying which and linking the others; the file picker stays. `__m3a` there gains `batch`, `play`,
  `stop`, `playing` and `frame`.
- The gallery's build carries the committed review batches of library clips alone (each gate's newest holding no
  submission: G8's), or those `M3A_REVIEW_BATCHES` names (`none` for none), each checked whole: one holding a
  submission, or any key or value but a library clip's row's, fails the build, naming it; the page gets the values
  read, not the file (D132). `npm run gallery` opens G8's batch with no file.
- `npm run site` carries the same batches and names those it leaves out, and why (G8's older export superseded; G9's
  two, 10 submissions each); it still drops `M3A_REVIEW_QUEUE`.
- The gallery has unit tests (`npx vitest run --config apps/gallery/vitest.config.ts`: the review batches, a clip's
  link); `npm run e2e -- previews` runs the build's batch check on each kind of refusal.

### Docs
- `apps/gallery/README.md`: the review queue's batches, Play, the gallery link and the handle.

## 0.56.0 · 2026-10-22

WP-F.9 (D129): the rate sweep's failing loops read by D108's bar and their captured speed; 45 loops carry a named
contact reading, labelled and named in `facts.reading`; 45 failing rows gone, none added.
WP-F.10 (D130): O2 answered; `publish.yml` publishes the `@m3a` packages to npm with provenance, started by the owner
alone from a release tag.

### Spec
- §7.1: `labelled` contacts are played as written, labelled by a person or a source or chosen by a tool as one of the
  reference implementation's named readings of the clip's own motion, which `facts.reading` then names; §7.3 lists
  `reading` among the known facts (a name, not a measure), and the clip schema's `facts` takes it; `facts.reading`
  appears only beside labelled contacts. A 0.55 validator accepts it in read and lint mode (a 0.55 intake's text gate
  bounces it). Spec 2.0-rc refrozen under D129.

### Core
- `clip.readContacts(clip, R, reading)` and `clip.CONTACT_READINGS`: twelve named contact readings of an in-place loop
  (the points that read a foot, the velocity, the "still"): the six `measureFacts` and its fallbacks take, and six it
  never takes (a quarter of the body's speed as "still", the lower foot's velocity under the refinement's own) (D129).
- The validator refuses `facts.reading` that isn't a string (M2-E004) or names the reading of contacts that aren't
  labelled (M2-E016), and in lint mode warns on a name it doesn't know (M2-W007; read mode accepts it) (D129).
- A recipe takes a named reading's contacts as detected, so its result's are detected again on the edited motion (D129).

### Sensors
- `fix` detects a named reading's contacts again when a step changes the motion, and drops `facts.reading`, reporting
  it as a step of its own (D129).

### Library
- `withReading(clip, R, reading)`: a clip with its contacts written by a named reading of core's, labelled, its facts
  measured from them and `facts.reading` naming the reading; it refuses a one-shot, a loop tagged off its feet, a clip
  with a root of its own and a reading that doesn't stand. `measure` keeps `facts.reading` on labelled contacts (D129).
- 45 loops of STYLE100's sets and CMU_CURATED carry a named reading's contacts (written by `npm run import`; their
  `travel` read from them): the rate sweep's failing rows 473 → 428 (0 added), 108 loops answered (126), 25 answers
  written again from their rows; QA 1,015 / 229 / 154 (1,014 / 230 / 154); the sensors' baseline (44 clips) and the
  distributions rewritten with D129's reason (two p50s worse in their last digits, the p95s better); index serial 5.

### Tools
- A set's import spec names, per clip, the reading its contacts are written by; the importer writes it with
  `withReading`, records it in `_import.json` (`contacts`, an enum of core's names in its schema) and refuses a name it
  can't honour (an adopted clip, a clip the set doesn't write, and `withReading`'s refusals) (D129).
- `tools/facts/readings.ts` holds the rule that chooses a loop's reading by D108's bar at five speeds and its captured
  speed, reading nothing of the sweep (D129).
- `npm run facts -- --check` holds a clip that names a reading to that reading's contacts on its motion today, and a
  set's import record that names another reading for it is stale: an edit to the contacts or the name is stale even
  with its facts measured again (D129).
- The intake's text gate takes `facts.reading` by its shape, a name (D129).
- The adopt bot's import record names no reading for an adopted clip, which keeps the contacts it was adopted with; the
  import record adds `qa.read`, the verdict of a clip as written with its named reading (D129).

### Repo
- `npm run test:changed` runs the readings' test for a change under `library/` (D129).
- `.github/workflows/publish.yml`: the `@m3a` packages of a release tag published to npm with provenance, by hand
  alone and from the tag itself: every job checks the go-ahead first (`M3A_O2_PUBLISH` is `yes`, the owner started
  the run and the attempt, the tag reads `vX.Y.Z` and the run was started from it); a build job with no token holds
  the tag to `main`, its version and the run's commit, and runs `npm run pack -- --check --publishable`; a publish job
  with no checkout, in the environment `npm` the owner approves, checks each tarball's package.json and publishes the
  eight in dependency order, a version already on the registry skipped and said, a failure stopping the rest; the npm
  token (`NPM_TOKEN`, the environment's) in the publish step alone, the OIDC token in the publish job alone (D130,
  WP-F.10).
- `tools/release/publish.test.ts`: the workflow read as YAML and held to each of those, its keys and expressions held
  exactly; its go-ahead, tag check, tarball check and publish loop run on stubs; the publish order derived from
  `build.ts` (D130).
- `release.yml`'s assets job checks the go-ahead first too, so a re-run of that job alone is checked, and an empty
  owner is refused (D130).

### Docs
- `tools/bundle/README.md`: publishing as it now stands (O2 answered, D130), and the owner's steps in order, each as
  the repository's owner: the npm organization `m3a`; the token (read and write on `@m3a`, Bypass 2FA, 90 days at
  most); the environment `npm` (the owner its required reviewer, `v*` tags alone, `NPM_TOKEN` its secret);
  `M3A_O2_PUBLISH=yes`; a tag ruleset on `v*` only the owner bypasses; a tag on `main`; the run from that tag; the
  approval; and trusted publishing before January 2027.

## 0.55.3 · 2026-10-22

WP-F.7 (D127): the rate sweep's failing rows triaged, two loops read again in core, the 126 that still fail answered
with their causes.
WP-F.6 (D126): T2 under its budget in CI, the rate sweep in full in a CI job of its own.

### Core
- `measureFacts` reads a loop's contacts again (D104's `reread`) when the refinement keeps one foot a moment a cycle
  (under a fifth of it) after a height pass that held both feet down throughout, and keeps that reading only where the
  planter holds both ankles within 10% of H0: two 100STYLE runs plant both feet, held within 4.3% of H0, their ground
  speed 0.81 and 1.05 of the captured (from 0.39 and 0.87); a retimed loop's reading is held to the same bar (D127).

### Library
- STYLE100_RUN/Robot_Run and Swimming_Run carry the contacts D127 reads (written by `npm run import`); STYLE100_RUN v3
  in the index.
- The rate sweep's baseline holds 473 failing rows on 126 loops (479 on 128), 0 added, and answers each loop: its cause
  (7) and why, with the numbers.

### Tools
- `npm run sweep -- --rates --check` fails on a loop failing a row with no answer in `library/baselines/rates.json` and
  reports an answered loop that fails no row; `--baseline` carries the answers; the schema and validator hold their
  shape (D127).

### Repo
- `npm run test:changed` runs the rate sweep's answers test for a change under `library/` (D127).
- WP-F.6 (D126): T2's Playwright step runs four suites at once, not two (169 s to 133 s here, every test within its
  timeout; mcp-smoke's every-example test has 180 s, past the 30 s default its blocking spawns kept from firing).
- WP-F.6 (D126): CI's `rates` job runs the rate sweep in full (every locomotion loop at every rate on the six bodies) on
  every pull request beside T2; T2 sweeps gen-0 and the knight whole (8,110 of 24,330 rows), its steps exported and
  tested (`t2Steps`). T2 here 362.2 s to 293.3 s.

## 0.55.2 · 2026-10-21

WP-F.8 (D128): the manual teaches the test characters, `loadGlb` in a page and the attached player's `apply()`; MIGRATING's
gap 10 closed but for gap 1's names.

### Docs
- The manual teaches the test characters, `character(variant(seed)).glb` from `@m3a/three/test-characters`
  (`variant(seed).id` is the tools' `gen-<seed>`; `TEST_SEEDS`, 0 to 19, give every build with every bone naming),
  `loadGlb` in a page as in Node (a textured .glb in Node takes `{ textures: false }`), and the attached player's
  `apply()` (the pose written without a step) and `bound`, Fit's in a block its test runs; Ship and the climb action's
  example are shorter (the export call left to the tool list, the import's `--set` default to `m3a help`). 7,999 of
  8,000 tokens (D128).
- docs/MIGRATING.md's gap 10 is closed but for gap 1's names, the types the lab names left to the compiler; the
  consumer lab's README names gap 1's loader and those types; FEEDBACK-LOG's F6.4 taken up.

### Three
- The test characters' test holds that `TEST_SEEDS` are seeds 0 to 19 and give every build with every naming (20
  pairs), as the manual says.

## 0.55.1 · 2026-10-21

WP-F.4 (D124): the manual teaches the seven names it didn't, within its 8,000 tokens. WP-F.5 (D125): T1's files share
their worker's modules.

### Core
- `actions.proceduralResolver` gives a ready-made gait or idle it kept back on its own rest, not on the equal rest
  another resolver made it on first (its clip still shared, D125).

### Tools
- `m3a library status` counts a contributor's submissions by state in the lifecycle's order (submitted, checking,
  bounced, awaiting review, adopted, archived, rejected), not as their ids happen to sort (D125).

### Docs
- The manual teaches `LibraryError` (from `@m3a/library`) and its `.code` (`E_TIER`, `E_NO_SET`, `E_NO_CLIP`), and, for
  a game's own fixed-step sim, the Animator's `step` option, `math.hashValue`, `math.PORTABLE`, `VERSION`,
  `graph.layersOf` and `graph.clipsOf`, in a block its test runs; its Tools reference is shorter (the MCP command,
  `npx m3a mcp`, and its `_` names in one line; the `.mcp.json` example gone). 7,998 of 8,000 tokens.
- docs/MIGRATING.md's gap 10 and the consumer lab's README name only what the manual still doesn't teach
  (`character`, `variant`, `loadGlb` in a browser); FEEDBACK-LOG's F5.2 and F6.4 taken up.

### Repo
- The manual's test checks each name the manual gives with its entry against that entry's exports, and its MCP command
  against the published bin.
- T1's files share their worker's modules (Vitest's `isolate: false`, D125): 88 s here from 114 to 128, the same tests;
  the kit's manifest mock is its test's alone (`vi.doMock`, then `vi.doUnmock` and `vi.resetModules`).

## 0.55.0 · 2026-10-21

WP-F.3 (D123): the root-motion rate sweep, every locomotion loop with contacts at 0.5 to 2 on the six sweep bodies,
gated by a baseline of the 479 rows that fail.

### Tools
- `npm run sweep -- --rates [<rigs>] [--sample N] [--clip ID] [--check] [--baseline] [--jobs N] [--out <file>]`: the
  root-motion rate sweep (D123). Every locomotion loop with contacts at 0.5, 0.75, 1, 1.5 and 2 on the six bodies G4
  sweeps, moved by its root's travel, as `Animator.pose()` poses it (its points, within 1e-6 mm); a row fails on the
  planted feet's slide or skate past the sensors' fail level on that body or no foot that stands still, warns past a
  warn level. `--check` against `library/baselines/rates.json` (one it can't read fails at once), `--baseline`
  rewrites it (replacing one it can't read); worker threads, one a CPU; every row to check-output/sweep/rates.json.

### Library
- `library/baselines/rates.json`: the 479 rows of the rate sweep that fail (of 24,330: 811 loops × 5 rates × 6
  bodies), with their reasons; it may only shrink (D123). Its shape: `tools/sweep/rates.schema.json`.

### Repo
- T2 runs the whole rate sweep against its baseline in a step of its own, "rate sweep in full"
  (`tools/sweep/rates.test.ts`: its worker threads take every CPU); T1 a sample of 6 loops on gen-0 (D74, D123). `npm run test:changed` runs it for a change under `library/`.

## 0.54.2 · 2026-10-21

WP-F.2 (D122): the six loops D108 left `unplanted` read again; `STYLE100_RUN/OnHeels_Run` planted by its whole sole,
the other five answered with the numbers that rule each reading out.

### Core
- `measureFacts` (D122): in place, on a loop on its feet, when the refinement and `reread` leave no contact, the feet
  are read by their whole sole again and refined by the velocity they give, kept with their travel only when both feet
  plant for a fifth of the loop: a run on its heels whose toes the default points catch only into each swing.

### Sensors
- The baseline reads `STYLE100_RUN/OnHeels_Run` on its contacts: slide 0 → 43.9 mm, skate 0 → 7.65 cm/s, skateMean 0
  → 12.4 (pass, as before); the distributions' skate p50 5.3 → 5.31 and skateMean p50 4.73 → 4.75 by D122.

### Library
- `STYLE100_RUN/OnHeels_Run` carries contacts, a step a foot (the planter holds them within 3.4% of H0; its ground
  speed 1.14 H0/s, 0.90 of its captured 1.27), and the travel they give ([77.2, 10.3], from [23.1, −12.4]):
  STYLE100_RUN v2 in the registry index. The other five `unplanted` loops keep none, their answers in
  `library/baselines/qa.json` rewritten with the numbers that rule each reading out. QA 1,014 pass, 230 warn, 154 fail.

### Docs
- docs/LIBRARY.md: the library's skate p50 5.31.

## 0.54.1 · 2026-10-21

WP-F.1 (D121): the m3a bin refuses a Node too old to start it; the session hook stops deleting node_modules under the
MCP server.

### Tools
- The `m3a` bin, on a Node without `import.meta.main` (before 22.18 and 24.2), says on stderr which Node it needs and
  exits 1, where it ran nothing and exited 0; on a Node below the engines that has it (22.18 to 24.1) it runs with a
  one-line warning on stderr. `m3a mcp`'s stdout stays the protocol's.

### Repo
- The cloud SessionStart hook runs `npm ci` only when node_modules wasn't installed from this package-lock.json and
  these package.json files on this Node (a stamp, `node_modules/.m3a-installed`): a resume, `/clear` or `/compact` no longer deletes node_modules while
  the m3a MCP server starts beside it (its CONNECTION_CLOSED). `tools/session/session-start.test.ts` tests it on a
  scratch project, and `npm run test:changed` runs that test for a change to the hook.

## 0.54.0 · 2026-10-19

The audit's large items (D119): six built, the rest deferred with their reasons in docs/HANDOFF.md; `AUDIT.md` retired.
The owner's answers on D94, #16's proof thread and the stray artifact recorded (D120).

### Spec
- A clip's `provenance.intake` requires `by` (who or what made it) whenever the record is present (clip.schema.json,
  MOTION.md §7.4); a source's stated terms that differ from the served ones keep its clips out of the intake. Refrozen
  under D119.

### Core
- The validator refuses `provenance.intake` without `by` (M2-E003 at `provenance.intake.by`).

### Three
- `@m3a/three/test-characters/generate`: the test characters as GLB bytes without three or its loaders, for code that
  reads them as files (a test pins that its imports reach only `@m3a/core`).

### Tools
- A character can be `gen-<seed>` (a generated test character, one name a seed: `gen-7`, never `gen-007`) wherever a
  tool takes one: retarget.inspect, retarget.apply, graph.sim, export (its .glb too), on every surface and in m3a.js.
- `sheet` draws any orbit: `view` is a named view or `{yaw, pitch}` in degrees (`--view 30,10` on the command line),
  pitch within -90 to 90, each wrong form refused with what is wrong.
- An argument that fits none of its forms is told what is wrong in the one form of its type: `{yaw: 30}` reads
  "view.pitch is required" on every surface.
- `@m3a/tools` ships the agentskills.io skill as `skills/m3a/SKILL.md`; `pack --check` asserts it, and the benchmark
  runner copies it from the installed package (the repository's when none is installed).
- `deliver` refuses a clip whose source states terms other than those it served; `m3a library submit` refuses a
  clip with no `--by` and no recorded `by`, and `--by` fills a record the clip's file carries without one.
- The intake checker samples the library once and then only new submissions (the census's later counts about 0.13 s,
  from 0.8 s), with the same result as the whole census.

### Repo
- e2e `first-flight`: G4's demo set and session (idle, walk, run, jump, attack with its hit) on the six skeletons and
  the held-out rig, sensors green, page = Node hash for hash, on the public API; `apps/lab/hello`, its e2e,
  `tools/run/hello.ts` and `npm run hello` retired.
- T1 samples and T2 runs in full (D74): one planted case each of B1, B3, B4 and B7's graders, B3's Rigify known-good,
  the runner's variant trial, the sweep's clip-by-skeleton sample, the intake census's equality proof, every ninth
  clip's token count and every ninth locomotion loop's planted feet (every third before): T1's work 250 s of file
  time, from 287; CI's T1 had reached 138 s of its 135 s mark.
- doctrine: `@m3a/tools` may reach `@m3a/three` only through `test-characters/generate`.

## 0.53.1 · 2026-10-19

The post-G10 audit (D118): every easy finding fixed, two duplicates retired, the large items listed in `AUDIT.md`.

### Spec
- A recipe's clip step and an action's interrupt targets take a library clip's id as the format writes it, its slug
  perhaps with `-` (MOTION.md §11: `MESH2MOTION/Two-hand_Blast`), as the graph schema already did; a recipe's and a
  paired action's own id keep SET/Slug without one. Refrozen under D118 with MOTION.md's errata (§6.1's 176 clips,
  §7.4's `recipe` provenance row, §15's twist pop staying in Quaternius' migrated clips), tiers.md's tier 1b inputs
  (the Rigify vector) and the kit, and SKELETON.md §7's Khronos watch (run: neither extension listed by Khronos).
- spec/SIM.md names the tool `graph.sim`; the vectors' README says Mesh2Motion's CC0 was audited (D63).

### Core
- `validateRecipe` and `validateAction` take a clip id with `-` in its slug for a clip step and an interrupt's targets
  (R-E004 and A-E003 refused `MESH2MOTION/Two-hand_Blast`); `interruptInto` writes the cut's own id with `_` for it.
- `skeleton.recognize` throws a RangeError naming a bone in a loop of parents among bones a name table knows, as its
  topology fallback did, instead of hanging (D96).

### IO
- `skeletonOfGltf` refuses a bone whose rest head isn't finite (node transforms whose product overflows) with E_RIG
  naming the bone, instead of returning NaN heads (K7, D96).

### Library
- `checkSets` reads a composed source license (ids joined with " AND ") part by part: each an SPDX id with its text
  kept, fitting the set's tier, and the credits list each part (D96).
- The Quaternius sets' baselined twist pops give the validator's threshold, 140° (was 135°), and say the re-import
  waits for the source files (D63); the registry index mints their v2 (serial 2).

### Tools
- `npm run index -- admit` holds a community pack's clip files and catalog rows to the intake's text gate, naming the
  file and field without quoting them; library-submit exports `proseProblems`, the gate's reading of one string.
- `license.check` passes a composed set whose parts fit and whose texts are kept; import no longer notes otherwise.

### Repo
- `npm run test:changed` picks the suites that cover what changed: a source file runs every suite whose tests import
  it, a package change also runs the tools' and benchmark's suites that import it, and the benchmark, the intake
  service, the workflows, the skills and llms.txt, the library and the feedback log each run the suites that read them.
- A repo tool's `--json` report goes under `$M3A_CHECK_OUTPUT/<tool>/` when set; T1's conformance CLI test writes
  there, so `npm test` no longer overwrites a certification's report; `qa` writes its clips.json there too, and
  T1's QA and sweep runs write to scratch, leaving a person's `check-output/qa/` and the sweep results a gate's
  `--record` reads as they were.
- `npm run doctrine` fails a budgeted file or tools/pins.json that no longer exists, where it reported it pending;
  the doctrine tests remove their /tmp fixtures (F4.5); `npm run gate` names the gates when given one it lacks.
- e2e `single`: `m3a.js`, built as `npm run pack` builds it, runs in Chromium and replies as on Node (F5.3).
- CI: the dispatched gate job fetches the held-out rigs; each dispatched gate has its own concurrency group, so
  `intake-contract` no longer cancels a running gate; the dispatch input names the gates a runner can run.
- The root `engines` asks for Node >=24.2 (every repo CLI runs under `import.meta.main`), and the SessionStart hook
  compares major and minor.
- T0 runs its typecheck and lint side by side (a tier step can run `together` with the one before it), and lint keys
  its cache by content, not mtime, so CI's fresh checkout reuses it: a cold T0 about 16.7 s here (was about 23), a
  warm one 2.3 s; CI's T0 had failed at 23.4 s and 22.9 s, over 1.5× its 15 s budget, with every step passing.
- T1 keeps search answering round 1's 10 held-out queries (D65); the review test numbers sources from the log it
  copies; AGENTS.md's command table is checked to name every package.json script.
- Retired: tools/run/pending.ts (Phase 0's placeholder) and two loose bench results that were byte copies of
  G4-run-2's. apps/lab/hello imports `@m3a/three/test-characters` (no lab reaches past the API) and records why it
  stays (G4's standing check, D118).

### Docs
- README describes the built package; AGENTS.md lists every script and the adopt bot's rule; DOCTRINE.md's table,
  PLAN.md's status, met deferred proofs, ledger commits, gate statuses and O3; llms.txt and the skills on the npm
  bin and the seventh job; the library READMEs on intake and the index; FEEDBACK-LOG's taken-up points and F6;
  HANDOFF rewritten; `AUDIT.md` (temporary) lists the large items.
- services/intake/README.md: O8's runbook (the Supabase CLI's layout, the owner's row, GitHub sign-in, the Actions
  secrets, Actions opening pull requests).
- Stale comments on WP-7.1, 7.4 and 9.1 as future work corrected (the contributor page, the runner, the CLIs).

## 0.53.0 · 2026-10-19

### Spec
- The conformance kit (WP-10.2, spec/conformance/): its protocol, m3a-conformance/1 (PROTOCOL.md, protocol.schema.json):
  an implementation is a sidecar answering newline-delimited JSON on stdin and stdout, eleven ops over tiers 1a, 1b, 2
  and 3, each compared at its tier's tolerance, every answer checked against the schema, a deadline a request; the
  TypeScript reference's sidecar and a deliberately broken one that fails naming its vector; CERTIFYING.md, how
  shardfall's Rust codec certifies tiers 1a and 2 (1b once its glTF reader gives the Rigify look), a proposal (O9).

### Repo
- `npm run conformance -- --impl ts|"<command>" [--tier] [--sample] [--timeout]`: a certification per tier and vector
  file, naming the first failing vector, its case, field and both values; its report names the protocol, the vectors'
  manifest SHA-256 and the commit (`-dirty` when anything the run executed changed: the kit's imports, package.json,
  the lock, and with `--impl ts` packages/core and packages/io). The TypeScript implementation certifies every tier
  (3,662 cases in 7 s). The wire writes -0 as raw JSON, so no string a message holds turns into -0
  (michaelcrosato/my-3danimations#17's review).
- G10's command set: check, test, doctrine, vectors, the full TypeScript certification, the consumer proof's e2e,
  `pack --check` and T2.

### Docs
- The consumer proof (WP-10.1): apps/lab/consumer-ts, a my-3dge-shaped duel on the public API (three.js r182, a fixed
  60 Hz sim on my-3dge's frame clock, two humanoids on one graph, a hit event, root motion), its e2e comparing the page
  with Node step by step, the hero with `sim.simulate`'s root path, and the page's own frame loop on a held clock
  (a J press in a frame that runs no step waits for the next; after a frame of several steps the view lerps between
  the last two places; `__m3a.drawn()`);
  docs/MIGRATING.md, my-3dge's WPs 3.4–3.7 and 8.1–8.10 as replaced, wrapped or kept, a proposal (O9).

## 0.52.1 · 2026-10-19

### Spec
- `provenance.intake` and `provenance.source` have a schema and validator rules: an unknown shape refused (E003, E004,
  E014, E017), an unknown field flagged in lint mode (W001); `source.stated`, the terms a source states when it served
  its clip under others (§7.4, D113).

### Core
- `sources`: the socket refuses a malformed source name or terms (E_SOURCE) and unreadable served terms (E_INVALID),
  and records the stated terms beside the served ones.

### Tools
- `sourcing.deliver` writes the clip's `provenance.intake` (`by`, the intent's SHA-256, the manifest, the local report)
  and refuses one with no `by`, or a generated clip with no manifest; `allowlisted` needs both terms on the allowlist;
  the tools' source types are core's.
- `localLane` (from `@m3a/tools/node`): library/local/'s sets written atomically under a lock, every path through
  `localPath`, a link on the way refused (E_LOCAL).
- `m3a library submit`'s gates: a derivative keeps each source's credit; fields that aren't prose checked by their
  shape; text aimed at agents, self-promotion and other languages bounced; `provenance.source` read by kind;
  `intake.by` may describe the agent and its model; a contribution tagged `emote` or `idle` that walks, runs or
  travels a quarter of its hip height, as `describe` reads it, is a lint finding (D114).
- `retarget.apply`'s reach gives the torso its allowance only where a spine bone spans a point the rig has no bone
  for, and only to the joints that bone carries: a rig missing only its neck or upper chest is read joint by joint, so
  a shoulder mapped wrong fails as it does with the bone (michaelcrosato/my-3danimations#14's review).
- `m3a library` refuses a half-linked hosted store (some of M3A_SUPABASE_URL, M3A_SUPABASE_ANON_KEY,
  M3A_CONTRIBUTOR_KEY, or the token alone) with E_KEY naming what is missing, instead of using the local queue
  (michaelcrosato/my-3danimations#16's review).
- `m3a review` regenerates the registry index after a decision, putting every file back if that refuses;
  `m3a review ingest` refuses a reviewer's name with a line break and a `proposals` that isn't a list (E_REVIEW).
- The submit function reads a body sent without a length as a counted stream and refuses it past the limit (413),
  never buffering it whole; a retry of an accepted text answers its row (200) at the rate's limit, in the function and
  the database's rate trigger (michaelcrosato/my-3danimations#15's review).

### Library
- `checkIds` names a deprecation taken back (`undeprecated`) or pointed at another clip (`retargeted`), so `npm run
  library -- check --since` fails both (#16's review).

### Repo
- The registry index: `--check --since <ref>` holds the serial to that ref's index (it stays when nothing else
  changed, grows when anything did); `release.yml` uploads only to a draft release, the one it drafts for a tag with
  none; `library-gates.yml` fires on `library/LICENSES/**` and checks every set's license texts before the gate.
- The migrator keeps an adopted clip only on the rest its set recorded, failing the set when the source measures it
  otherwise (the owner adopts it again); the adopt bot probes `_2`, `_3`, ... until a new clip's id is free (#16's
  review).
- The intake's checker: an improvement keeps its previous version's tier, license and credit (an improved CC BY or
  CMU clip can be adopted); dedup asks with the submission's own id and against earlier submissions; a reason quotes
  no submission text and holds 500 characters; a submission whose gate throws is bounced alone, the batch going on.
- The library gates: a clip added outside the intake goes through dedup, gets no credit for its own QA claim, carries
  no review, and a generated one needs its manifest; `npm run library -- check --since <ref>` holds the lock's ids
  against that ref's (none dropped, deleted or reused) and fails on a ref it can't read, in the library-pr gate and G9.
- The adopt bot: its GitHub path gates the pull request's branch, not main, and returns to the base after each
  adoption, each caught alone; an adoption the importers and the migrator keep is the bot's own record.
- The registry index binds the fields it records to the files and fails on an unreadable `--since` ref; a community
  pack's version carries a digest over all its files, its proof's hash and the license its files give.
- `npm run site` empties an `--out` directory only when its `.m3a-site` marker is there; `npm run qa -- library`'s
  off-feet check names an answer left in the field its loop doesn't need (michaelcrosato/my-3danimations#14's review).
- Workflows: `intake.yml` and `release.yml` give their secret and token only to the steps that use them, keep no
  checkout credentials and install without scripts; `release.yml` checks the triggering actor; `library-gates.yml`
  fires on the lock, the index and the registry too.

- The bench: B8's grader holds what its brief asks (an emote stays in place; its queue record is the one `library
  submit` sent, its id, content hash and local report its text's; an AI agent and its Claude model named; a name and
  description of its own), each with a planted case; `B8-ten`, one fresh agent sending ten distinct emotes through one
  queue (its grader, a known-good of ten, 240 turns and 90 minutes); G9 runs B8 at 4 of 5 and B8-ten once; the checker
  every 30 s logs a failure to `<workspace>.checker.log`.

### Docs
- The manual says a recipe's `name`, `desc` and `tags` become its clip's (7,999 of 8,000 tokens); CONTRIBUTING.md's
  preview sheet is the local queue's.

## 0.52.0 · 2026-10-19

### Spec
- `provenance.intake` (a contributed clip's record from the intake queue) and `provenance.source` (the motion source
  that made it, its terms' license and version, the seed, a hash of the intent), both optional (§7.4, D112).

### Core
- `sources` (WP-9.2): `MotionSource` and `sourceClip`, the one interface every motion source runs through (the
  request checked, the clip validated, its source record written, warnings on changed terms, missed constraints and
  length), with the procedural and recipe sources; deterministic for a seed.

### Library
- Near-duplicates (WP-9.3): `DedupIndex` (time-warped, mirror-aware, a submission checked against the library in
  milliseconds), `motionFeatures`, `motionDistance`; lineage: `Lineage` (from `orig`, recipe inputs and content ids,
  resolved to source clips), `deprecate` and `checkIds` (ids never reused or removed).

### Tools
- `m3a library submit | status` (WP-9.1a): a clip or recipe sent to the intake queue with its provenance, after the
  local gates, and a contributor's submissions with their states and bounce reasons; the tools' budget is 3,200
  tokens (D112).
- The manual's Grow section (WP-9.1b): `m3a library submit` and `status`, the queue's states, the license rule,
  provenance and disclosure, a generator's training-data manifest, the owner's adoption; 7,997 of 8,000 tokens, its
  tables made lists to make room.
- `sourcing` (WP-9.2): the library source, an HTTP adapter template for external generators (off by default, its
  transport injected, key poses as constraints), the source gate, the allowlist, and the way to the intake queue or,
  for a source not on it, `library/local/` alone.

### Repo
- The intake (WP-9.1a): `npm run intake -- check` (schema, provenance, license, text, dedup, sensors, retarget,
  budgets, lint; a preview sheet; bounced with a reason or waiting for review), the adopt bot (the owner's adoptions
  alone, its pull request whole: the lock, baselines, docs/LIBRARY.md and the index regenerated), `intake.yml` and
  `library-gates.yml`, `npm run gate -- library-pr`; the importers and the migrator keep an adopted version.
- The registry index (WP-9.4): `library/index.json` (each set's immutable versions, community packs from verified
  namespaces), `npm run index` (`--check`, `verify`, `verify --all`, `admit`), `release.yml` (by hand, closed until
  the owner's O2 go-ahead).
- Brief B8 (WP-9.1b): contribute an emote through `m3a library submit` to the workspace's local queue, reaching review
  with every check green; its grader runs the intake's checker on the queue, seven planted bad solutions each failing
  the check it names; `CONTRIBUTING.md`, the same rules for people and agents.
- The bench's `--need N`; `npm run gate -- G9`.

## 0.51.0 · 2026-10-19

### Tools
- `m3a review` (WP-8.2a): the owner's review queue on every surface: submissions awaiting review with their numbers,
  check report and diff, and 20 library clips sampled unreviewed or stale (a list shows 8); `export` writes the queue
  for the gallery and the phone, `ingest` applies a review, `adopt`, `archive`, `reject`, `approve` and `flag` decide
  on refs with a note. Each decision records the hash it was made on; a stale one is refused, a repeat is no change.
- The intake store (`intake`, WP-8.2a): §5.9's contract, its `local` backend (`@m3a/tools/node`'s `INTAKE_DIR`,
  `intakeFiles`) and `supabase` backend, the review's two formats (m3a.review-queue/1, m3a.review/1) with schemas.
- The manual's generated tool list names an MCP name only where it differs from the tool's (7,971 of 8,000 tokens).
- `sim.SimStepper`: graph.sim's stepping loop, exported, which `simulate` and the gallery's stage both run (its outputs
  byte for byte).
- The intake store's hosted schema: only `decide` moves a submission to a verdict, the rate (20 a contributor a day)
  is held in the database under a lock, a build given a secret intake key fails (D109).

### Repo
- The gallery (`npm run gallery`, WP-8.1): every set and clip played, measured and linked at a phone viewport, the
  recipes and graphs, deep links, `__m3a` and `__M3A_TOOLS__`; the review queue's page (decided by touch, exported
  through the share sheet) and the contributor page (keys once O8 is linked), WP-8.2b.
- `services/intake/`: the hosted store's migrations (row-level security on every table and the bucket), the submit
  function (a contributor key, 256 KiB and 20 a day), a test stub; nothing is created (O8).
- Previews (`npm run site`, `vercel.json`, WP-8.3): the gallery, the labs index and every lab, each page stamped with
  its commit.
- `npm run gate -- G8`.

## 0.50.2 · 2026-10-19

### Core
- `measureFacts` (D108): D104's fallbacks read only a loop on its feet (a one-shot with no contact plays still again),
  `reread` only in place (a clip's own root is exact), and a reread counts only when both feet plant and a foot is down
  for a fifth of the loop; nothing falls back to the height pass, whose contacts the planter couldn't hold (feet
  pulled up to 1.8 H0).

### Library
- 6 of D104's 11 loops (`MESH2MOTION/Run_Anime`, `Run_Stealth`, `CMU_CURATED/Boxing_Guard_Loop`, STYLE100's
  `WideLegs_Walk`, `Drunk_RunBack`, `OnHeels_Run`) and its 18 one-shots have no contact again; the 6 are answered in
  `library/baselines/qa.json`'s new `unplanted` (why no foot holds still). `Run_Female`, `Waving_RunBack` and the three
  `OnHeels` stances keep theirs. QA 1,014 pass, 230 warn, 154 fail; skateMean p95 19.6 → 19.8 by D108.

### Tools
- `npm run qa -- library`'s off-feet check reads `unplanted` too, a loop on its feet answered with why no foot holds
  still (D108).
- `retarget.apply` reads a rig without chest bones limb by limb: each bone against its mapped parent, the spine's own
  miss reported as `spans` and allowed within 5% of H0 (G7 verifier).
- The manual: search rows' `core`; R-E008's nearest id, if any; a graph's rate parameter needs `"value": 1`; 7,997 of
  8,000 tokens.

## 0.50.1 · 2026-10-19

### Core
- `measureFacts` (D104): the world refinement never erases every contact the height pass found on a body that stands:
  it reads again with "still" at half the body's speed (then, in place, with the lower foot's velocity), else keeps
  the height pass's (narrowed by D108 in 0.50.2); a clip with no contact by ankle, ball and toe is read by its whole
  sole (`DetectOptions.sole`, the heel included). Neither applies to a clip tagged off its feet (`clip.OFF_FEET`: air,
  fly, swim, climb, lie, sit). A clip that had a contact reads the same.

### Library
- 11 loops that stand on their feet (CC0's `MESH2MOTION/Run_Female`, `Run_Anime`, `Run_Stealth` among them) and 18
  one-shots carry contacts; `Run_Female`'s ground speed reads 4.09 H0/s against its measured 3.95 (it read 0). The 19
  loops off their feet are answered in `library/baselines/qa.json` `offFeet`. QA 1,014 pass, 230 warn, 154 fail; the
  three `OnHeels` stances gain travel facts; two distribution p50s worse in their last digit, by D104.

### Tools
- `npm run qa -- library` checks that every loop with no contact is tagged off its feet and answered (`offFeet`).
- Each pack's CHANGELOG.md is the repository's without its Repo sections or a line about the benchmark, and
  `pack --check` fails when a packed text file names the benchmark's graders, known-goods or held-out runs (D107).
- The manual (D105, D106): root motion moves the character (moved at v, feet slide in fades and where a keyed stance
  drifts); cross-fade in step with `ops.phaseMap`; in the speed rule's range a `core` clip beats a nearer one;
  8,000 of 8,000 tokens.

## 0.50.0 · 2026-10-17

### Repo
- `npm run pack [-- --check]` (WP-7.4, D101): every `@m3a` package built as ES modules with declarations and packed
  (the workspace's bin runs the source, the packed one `dist/node.js`); a scratch project installs the tarballs and runs
  the manual's complete example, `npx m3a` and `m3a mcp`; nothing is published (D99), every package stays private.
- `m3a.js`, one self-contained ES module with 47 CC0 clips (`tools/bundle/manifest.json`), the credits block and the
  license texts; it runs the manual's complete example headless (no three.js).
- The benchmark packs through `tools/bundle`.

### Library
- The default `@m3a/library` pack holds the cc0 sets; `@m3a/library-cc-by` and `@m3a/library-cmu` are opt-in packs
  that `openLibrary` finds when installed (D10).

### Tools
- Every reply warns when a game opts into a tier whose pack isn't installed.

## 0.49.0 · 2026-10-17

### Tools
- The manual (WP-7.3, D100): one complete example (a knight that walks, slashes with a hit event and staggers its
  target), the API by job, the 20 tools as `m3a` and MCP calls in a list generated from the registry, the reads G6's
  agents made past it, matching a loop's speed and moving by `player.travel`, the import catalog; every code block runs
  in `npm test -- manual`. Within 8,000 tokens.
- The registry's examples for edit, film, diff and describe name clips no benchmark brief asks for.

### Docs
- `skills/m3a/SKILL.md` (agentskills.io) and this repository's `.claude/skills/m3a/SKILL.md`; `llms.txt`; `.mcp.json`.

### Repo
- Benchmark trials get the skill, the `Skill` tool and the packed `m3a mcp` server; a trial whose server didn't
  connect fails; the shipped skill and `llms.txt` count as the manual.
- T1 shares identical work in its eight slowest files (89.8 s to about 78 s here), every test and assertion kept (D102).

## 0.48.0 · 2026-10-17

### Tools
- WP-7.2b's tools (D93, D96), each on the API, `m3a`, MCP and the console: `retarget.inspect` (a character's
  mapping, its issues and a rest turntable; hips bound on a wrong bone and each missing bone's likely sources named) and
  `retarget.apply` (up to 20 clips played on it, each judged as the sweep judges a skeleton, D80); `recipe.compile`,
  `graph.validate` and `graph.sim` (a script on a character, tiny by default, its trace diffed against an expected
  one; a mapping taken as retarget takes it); `import` (a .gltf, .glb, .bvh or .vrma file's animations fitted into a
  local set under `imports/<SET>/`) and `export` (a clip on a character as .vrma, .glb or .bvh, each read back within
  1 mm). 20 tools in all, within 3,000 tokens to describe.
- A character is bound through `@m3a/io` and core, with no three.js (lane b0, in 0.47.0's tree): `ctx.bytes`, a VRM's
  humanoid taken as the file's word, `TINY` the default body. A mesh io can't read (compressed, weights unreadable,
  soles unread) is said, with what re-exporting mends, and is no mapping issue.
- One naming rule (D96): a hint names a given file with its placeholder or the path as given, quoted for the shell;
  refusals, verdicts and data use the same words without brackets, never an absolute path or a JSON-quoted one. Every
  hint runs as written; parser messages fit one line.
- Bounds on what one call costs, each refused up front naming the remedy: a held foot past what the planter replays
  cheaply (retarget.apply, export, graph.sim), graph.sim's clip and fade steps, a recipe's steps, samples, list reads
  and the samples its keys are fitted to (3,600; edit too, which keeps its chain only within them), import's 120 s take,
  240 s and 500 clips. The host stats a file before reading it (512 MiB binary, 64 MiB text).
- import: the license and credit a file carries are used (a contradicting `--license` refused, ids compared as sets,
  a composed license taken); it removes only clip files an import wrote and names them; a set whose directory holds
  another .json, or a library set's name, is refused; a glTF no bone map knows is refused with calls that work. MCP
  lists it as writing (readOnlyHint false, destructiveHint true).
- The host keeps at most 8 libraries open and reads an imported set under `imports/` at call time.

### IO
- `skeletonOfGltf` (a glTF's skeleton as three's bind takes it, unweighted joints left out) and `meshEnds` (D49's sole
  end bones from the mesh), signed and quantized accessors read, sparse ones refused (lane b0).
- The BVH writer and `bvhGap`, the glTF animation writer and `glbGap` (a joint missing from the read-back file is
  E_MISSING); a VRMA carries its license in extras and its credit as the copyright, a .glb's animation both; a
  one-frame take held a frame.
- `animationNames`: each glTF animation its own name (`X`, `X_2`, `animation<i>` for none) in every reader, in linear
  time; a BVH frame time must be above 0 and at most 1 s; rigBvh's E_RIG reads for a .bvh and a glTF alike.

### Library
- The set writer (`setFiles`, `setText`, `catalogRow`), moved from `tools/migrate`; `openLibrary` takes a source.
- `Library.resolver()` throws E_TIER for a clip an out-of-tier set holds, so a recipe names the opt-in; any other id
  is R-E008 with its did-you-mean.

### Core
- Bit-identical speedups (D97): decoding and encoding by offsets found once, rest conjugates, shoulders and hint
  starts found once per rest, contactRoot decoding the legs alone, planting without per-call arrays. CI's T1 74.4 s
  to 61.9 s with 38 more tests.
- `measureFacts` takes samples a caller already took (an optional fourth argument, `sampled`), checked for count and
  step against sampleAll's.
- Recognition by shape walks the skeleton without recursion: chains of 130,000 bones recognize; parents in a loop
  throw a RangeError naming a bone. Every output as before (pinned by hash).

### Three
- The bind sanitizes a patch's source bone as three's loader sanitizes node names, so the tools' patch binds in three.

### Repo
- The D80 judge lives in `@m3a/tools` (`judge.ts`); the sweep imports it, its rows pinned by hash (the same before
  the move). `tools/exact/ab.mjs`, the bit-identity harness, kept on demand. B5's and B6's starter check names a clip
  past CC0 as R-E008. eslint leaves the lane worktrees out.

## 0.47.0 · 2026-10-16

### Tools
- WP-7.2a's tools (D93, D95), each on the API, `m3a`, MCP and the console, opening the library at the game's tiers
  (`game.json`, else cc0): `search` (a game moment in words and filters, best first, naming a closer clip in another
  tier); `show` (a clip's keys as text, its provenance, license and the credit owed); `describe` (a short timeline);
  `metrics`, `sheet`, `film`, `diff`, `lint` (the sensors' verdicts, findings and pictures, each image with its size
  and token cost); `fix` and `edit` (into `workshop/<Name>.json`, revisioned, retry-safe, with undo and redo in one
  history); `license.check` (clips, a set or the game against licenses and tiers, with the credits block).
- The host: a tool reads, writes and removes files only under `workshop/`, `.m3a/`, `imports/` and `check-output/`,
  atomically and never through a link out; `m3a` keeps retries in `.m3a/requests/`, so `--request-id` works on the
  CLI; two edits of one clip never both apply (a per-clip lock, E_CONFLICT with the current revision); a clip edited
  outside m3a resets its history for every tool; slow retimes past 600 s are refused before they compile.
- A clip given by path, JSON or from the workshop that the game's tiers couldn't ship gets a warning line in every
  tool; a library id outside them is refused.
- Every next hint writes its calls as the `m3a` command takes them, and they run as written; replies name a clip one
  way and never an absolute path; every tool declares an output schema; MCP's `tools/list` leaves out
  `outputSchema` (about 250 tokens a tool). The 13 tools cost 1,763 tokens to describe.

### Library
- `Library#about(set)` (a set's legend and sources, whatever the game's tiers); search's `mps`; D10's tier rule
  (`tierOf`, `credited`).

### Sensors
- `fixes.worse` and `fixes.ANSWERS` are exported.

### Docs
- The manual's two request_id sentences match the durable store.

### Repo
- e2e `mcp-smoke` runs each example through the Inspector and the API in working directories of their own, seeded
  alike, so an example that writes doesn't meet the other's file.

## 0.46.1 · 2026-10-16

### Repo
- Benchmark agents run as `nobody` with no capabilities and no new privileges where the runner is root (as itself
  where it isn't: CI), so `/root`, the raw disks and every checkout (covers now mode 0700) refuse them; their
  workspace, home and own `/tmp` are handed to them walking real directories only, the proxy's CA copied into the home,
  and in a cloud session the CLI's credentials copied into a tmpfs of the namespace's own (D94).
- In an agent's namespace `/var/tmp` and `/dev/shm` are an empty tmpfs of its own; the audit counts its files there as
  its scratch. Trials and results record `uid` and `unprivileged`; `capsDropped` means no capabilities at all (D94).

## 0.46.0 · 2026-10-16

### Tools
- The tool registry (WP-7.1, D92): a tool defined once with `defineTool` is served four ways: the API
  (`tools.call(name, args)`), the `m3a` command (`m3a <tool> [args] [--json] [--verbose]`, `m3a help [tool]`), an MCP
  stdio server (`m3a mcp`) and the console handle `__M3A_TOOLS__` (`installConsole`).
- One reply, `m3a.reply/1` (verdict, lines, data, images, revision, error, next), shared by `report.json`, MCP's
  `structuredContent` and the API; the verdict is one line and the text fits 20 lines unless `--verbose` or
  `verbose: true` asks for all; `m3a help` lists every tool. Exit codes 0 ok, 1 findings or a failed tool, 2 usage;
  on MCP a failed tool or a wrong call is an `isError` result.
- Wrong calls name the closest valid choice (an unknown tool, flag, argument, help argument or nested field); every
  reply ends with a `next` hint. Parameter names are ones every surface can pass.
- Edits' `request_id` and `if_revision`, handled by the registry: a retry with the same id and arguments returns the
  first reply, and an edit that applied never applies again; `m3a` refuses `--request-id` until it keeps retries
  between runs (WP-7.2a).
- The MCP server follows the 2026-07-28 revision and still answers the `initialize` handshake back to 2024-11-05;
  tool names use `_` for `.`.
- Images from tools go to `check-output/<tool>/`, with size and approximate token cost; MCP also sends them as image
  content. The tools `version` and `validate`; the `@m3a/tools/node` entry and the `m3a` bin.
- The manual's tools section: the `m3a` command, MCP and the console.

### Repo
- `@modelcontextprotocol/inspector` 2.9.0 (dev, pinned) and the e2e suite `mcp-smoke` (`npm run e2e -- mcp-smoke`).
- PLAN.md: WP-7.2 split into 7.2a and 7.2b, each an L (D93).

## 0.45.2 · 2026-10-16

### Tools
- `npm run gate` records the commit it ran at and whether the tracked tree differed from it, in the report and at the
  end of its verdict (D91).
- `npm run fixtures -- heldout` says "no rig: seeds only" for a held-out run without a rig.json, and lists each
  variant's seed against the seeds already used (D91).

### Repo
- G6 passed on run 1, 20 of 20: B2, B3, B5, B6 and B7 and their held-out variants 5 of 5 each
  (`bench/results/gates/G6-run-1/`, D91).
- The benchmark hides every checkout of the repository (`git worktree list`), its git directory, the Claude home and
  `~/.claude.json` from each agent; the agent runs in a PID namespace of its own and, where `setpriv` works, without
  CAP_SYS_ADMIN (`ownPids` and `capsDropped` recorded per trial); a timeout ends the whole namespace (D91).
- The benchmark's audit scans what a Write, an Edit or a heredoc written to a file names (for outside and scratch, not
  as reads past the manual), paths in template literals, and another process's `/proc` entry by PID, glob or variable
  (D91).
- B7's brief names the check before the jump; B3's starter check finds the hips with `bind()` (it printed NaN on
  rigify characters), and B3's known-good is graded on a rigify character in T1 (D91).

## 0.45.1 · 2026-10-15

### Core
- Gaits (WP-6.2's close-out, D71): the seam readings `fitGait` and `gaitClip` share are kept by weight, 16 MB across
  all rests, the one read longest ago dropped first, each grid keeping only what is read again; before, they grew with
  each rest (40 gaits of 3 s held 157 MB, and a process over about 100 rests ran out of a 3 GB heap). Every clip and
  refusal is the same to the bit; `fitGait` is about 8% quicker and `gaitClip` about 5%.
- Actions: the ready-made procedural parts are kept for the 96 used last (16 bodies of six), not without limit.

### Sensors
- Tests: the run knee the margin rule records (91.1%, D90) is pinned between 90% and 92%, naming what to restate when
  it moves.

## 0.45.0 · 2026-10-15

### Core
- Gaits (WP-6.2's rounds 8 to 14, D71, D90): every bound keeps the worst reading of its class at about 90% of the
  sensors' fail level or under, measured on fresh grids. A swinging leg folded under 25% of its length and a knee under
  the floor are refused; the loop's seam is read on the clip's own keys and bounded at 70%, the pelvis's whole-% steps
  about it re-rounded; the hands are aimed from the decoded shoulders. A gait is made from the rest's standing pose
  only, at 55 to 75 frames a second (was 90), with a key budget of 0 to 2 mm; the shortest swing is 0.3 s (was 0.26).
  `fitGait` fits speed, lift and arm swing together, monotone in each: the fastest whole speed that plays within the
  pace bound, a lower lift only where no speed plays, a narrower swing where the hands need it. Refusals name what
  `fitGait` would make. ARM_TURN is gone (every cycle taken now covers it).
- Actions: a ready-made procedural gait is fitted to the action's body (`fitGait`), so a run on a short-legged body
  plays a little slower instead of throwing.

### Tools
- The manual's procedural gait lines name the standing start, 55 to 75 frames a second, the pace bound, the shortest
  swing and run cycle, and what `fitGait` changes.

### Repo
- Tests: core's copies of the sensors' seam and pop levels held equal to the sensors'; the round-8 to 14 repros and the
  margin's worst cases pinned under the fail level; actions on test characters 0 to 3 at the fitted speed.
- `.gitignore` matches a worktree's `.cache` symlink (D83's implementer worktrees link it).

## 0.44.1 · 2026-10-14

### Core
- Gaits and idles are made 7 to 8 times faster, the same clips byte for byte: `snapLegs` scores each candidate leg by
  its ankle alone (`ankleOf`, the decoder's own steps for it) instead of decoding the whole pose for each of 81
  candidates a leg; a test holds `ankleOf` to `decodePose`'s ankle exactly (D89).

### Tools
- `npm run sweep -- --record <results.json> --commit <sha>` writes a gate's sweep record from the sweep's raw results
  (`tools/sweep/record.ts`); its failing pairs carry the warns the skeleton added too, as D80 asks (D88).

### Repo
- CI's T1 job fetches the gates' held-out rigs, as T2 does: B1's grader test reads run 1's (D89).
- The benchmark's audit reads a shell command's relative paths (from the workspace, following `cd`, a `for` loop's
  variable and globs as written) and counts any read under `node_modules/@m3a/` but the manual as past the manual; the
  repository counts as outside wherever it lives (D88).
- G4 run 2's record (D88): passed, 9 of 9, at adf77ee; its sweep record re-derived with the failing pairs' added warns,
  no rerun; its trials' audit corrected from the kept transcripts, which `transcripts.json` pins by SHA-256.

## 0.44.0 · 2026-10-14

### Core
- Gaits (D71, the verifier's round 7): the swinging foot's height keeps its slope where the lift-off meets the arc and
  the arc the set-down (a run's seam and short swings' knees popped); the pelvis is lowered with its sway and rounding
  counted; gaits are made at 55 to 90 frames a second. Refusals name the field, take a 0.26 s swing to the
  millisecond, and give the reach with the fastest speed the legs take; `procedural.fitGait(g, rest)` slows a gait to a
  body's reach.
- Format: a body measured without collarbones encodes no shrug (every procedural source made NaN on one).

### Tools
- The manual names `procedural.fitGait`.

### Repo
- Tests: the swing's slope at its joins, the round's repros under the sensors, the reach's edge on two rests, legs at
  most 98.5% of their length at the bound with a bounce, the stance end's margin, refusals, `fitGait`, procedural clips
  on test character 3; two slide bars moved with the arc (D71).

## 0.43.1 · 2026-10-14

### Three
- `bind` reads where a childless foot or toe ends from every skinned mesh that skins it, not only the one with the most
  bones: KayKit's Knight keeps its feet in its leg meshes and floated 55 mm at idle; it stands on its soles now. Rigs
  whose feet one mesh skins bind exactly as before (their bound rests' hashes pinned in a test) (D87).

### Repo
- B1's grader test says why the Knight stays ungraded: its 430 mm boots ride the floor under the library's toe curls
  (D87).

## 0.43.0 · 2026-10-14

### Three
- `attach(...).travel`: the last update's root move in the root's parent space (metres), along the way the model faces,
  read from its bones, turned and scaled as the root is; G4 run 1's held-out rig faces +X, and moved along +Z its
  standing feet slid 1.2 m/s (D86).

### Tools
- The manual moves the character by `player.travel` (5,656 of 8,000 tokens).

### Repo
- B1's starters read meshopt and leave textures out (the discovery starter with three's own decoder, naming no
  package); B1's known-good moves by `travel` and passes on both Quaternius mannequins and G4 run 1's held-out rig
  (1 m below its origin, facing +X), and on seeds 1, 37, 41 and 935; T2 grades it there, with the planted bad ones
  (D86, D77's S7 and S8).

## 0.42.7 · 2026-10-14

### Repo
- The benchmark: each agent starts in a mount namespace with a `/tmp` of its own (its scratch files kept beside its
  workspace, listed apart by the audit) and the repository and this session's Claude home hidden; agents run at once
  only where that holds, else one at a time; each trial records it; the runner's and briefs' tests remove their
  temporary directories; CI's runners allow user namespaces (D84).
- The sweep: a pair fails on a fail finding the skeleton adds; a warn it adds passes, listed with the pair and in the
  results' `warned` list; `--out` names the results file; PLAN.md §9.3's G4 line and WP-4.5 say so (D80).

## 0.42.6 · 2026-10-13

### Core
- Gaits (D71, the verifier's round 6): the pelvis is lowered until no leg reaches past 98.5% of its length at any
  phase, the bounce counted (a bounce of 3 or more drove a far-reaching leg straight, popping its knee); the reach
  bound is 72% of a leg; the shortest swing 0.26 s; 50 to 110 frames a second.

### Repo
- Tests: the gaits' refusals at the new bounds, a gait made at 110 frames a second; a one-shot's sideways root speed
  spent and a loop's flight in-betweened (D71, D77); the gaits' arm-swing test given 30 s.
- The SessionStart hook puts Node 24 (`engines`, CI's pin) first on `PATH` when the container's default is older, and
  fetches the real rigs, each gate's held-out rigs and the pinned sources by hash, so no test skips for want of them;
  CI's T1 job fetches the pinned sources too, so the carry test runs there (D79).

## 0.42.5 · 2026-10-13

### Repo
- B3 checks the body stays where it lies (from 0.3 s after the hips are down, 0.6 hip heights at most), and its
  standing-foot bar is 25%, as B4's: walks stride-warped as the manual shows read up to 22% (D77, the verifier's round
  3).
- B2's damage comes from two frames before the strike to four after, not to the hand's farthest reach, and a punch
  reaches 15% of the hip height; PLAN.md §7's B2 row says so (D77).
- The verifiers' sliding body and twitching hand planted; B6's README lists its character; the records' numbers
  corrected (D77).

## 0.42.4 · 2026-10-12

### Core
- A one-shot that ends off its feet spends its root motion's speed over the time a body falls its hip height: a
  knockback's take-off speed was held to its end, flinging the body 7 to 9 hip heights (D77).
- Gaits (D71, the verifier's round 5): every gait swings 0.25 s or more (a stance of 0.5 near the cap, and bounce 6, on
  shorter swings popped knees on half the rests or more), and is made at 50 to 120 frames a second.

### Tools
- The manual: a right-handed throw's wind-up turns +20; a bool may be compared; a paired action has its `desc` (D77).

### Repo
- B2's strike is found by the starter's `strike.ts`, for the grader and the check alike: the punch's last peak, not a
  fade into a stance; damage passes from two frames before it to the hand's farthest reach; each punch goes back to
  idling (D77).
- B3: a knockdown carries the body no more than 3.5 hip heights; the walk is checked again at the end, a standing foot
  staying; the light hit's bars in hip heights; a foot's dip in the cross-fade into the fall allowed (D77).
- B4 judges a standing foot by the lower foot's speed, not the sensors' contacts (`Walk_Stealth` fails); B7 judges the
  run after landing from 8.1 s, and its brief gives every window (D77).
- B2, B3, B4 and B7's starters load their character as the graders do (meshopt read, textures left out); the graders
  read a model far off y = 0 from its own floor (D77).
- Tests: the verifiers' wrong solutions planted (a fighting jab's press, a punch looped on, a flung knockdown, an idle
  after getting up, a skating walk, the stealth walk); the gaits' refusals at 0.25 s and 120 frames a second.

## 0.42.3 · 2026-10-12

### Spec
- A graph names library clips whose ids have a hyphen; its schema refuses what JSON Schema can say the checks do (a
  mask's groups, a pass state in the base, `at` off a clip state, `rate` on a pass, a layer named `base`, 2D points
  in a 1D blend); refrozen (D73).
- `GRAPH.md`: a loop's exit of 1 is taken at each seam; a window a step goes over opens; the fade-out cap is four
  besides the state fading in; a loop's `at` wraps (D73).

### Core
- Graphs (D73, the verifier's round 2): a one-shot at speed 0, a rate parameter starting at 0, a pass state's exit or
  late window and a state into itself waiting on nothing are refused; the run plays its own copy of the graph, so one
  edited after `play` changes nothing and a `-0` is 0; a loop's `at` wraps; a window narrower than a step opens.
- Gaits (D71, the verifier's round 4): a lift over 12% of the hip height needs a swing of 0.25 s, a run (stance under
  half) a cycle of 0.6 s (0.65 lifting over 25), and a gait 50 frames a second or more; each refused with what to
  change. A gait has an even number of frames, so its left foot is seen at its right's phases (a run of 0.65 s, 39
  frames, popped its left knee on 10 of 64 rests). The cap's message names the right foot only for a limp. "At any
  cycle" was more than was measured: at the cycles these allow.
- `BODY_POINTS`: a spine without chest bones puts the chest points a third and two thirds along it, not at its tip
  (D77: B3's lying head went through the floor on chest-less characters).

### Tools
- The manual's examples are no longer the briefs' answers: a swimmer's graph, a torch walk's recipe, a throw's
  edits; reactions name no clips; `H0` is the hip height (D77).

### Repo
- Graders read every body point from the bones, those off the joints carried on theirs (`bench/graders/bones.ts`);
  B2's strike is the last peak of the punching hand's speed before it is farthest out; B3 checks the walk's pace and a
  standing foot; B4 checks steps and a standing foot staying; B7 checks each motion's travel, the jump leaving the
  ground, and a fall when `grounded` goes without a jump (D77).
- `npm run bench`: `--variant` takes one brief; B4's variant must give VRM bone names; `speeds.json` only in B1's
  workspaces; a T2 test runs every brief's known-good through the packed packages (D77).
- Tests: the verifier's graph mutants (52 of 79 now fail them), the gaits' new refusals, each knee's twist step on
  three rests, at 50 frames a second and on an odd count made even (D71, D73).

## 0.42.2 · 2026-10-12

### Repo
- G6's command set: composed clips passing QA, graph simulations deterministic, the held-out run fresh, and B2, B3,
  B5, B6 and B7 with their held-out variants, 5 fresh agents each (D78).
- `npm run fixtures -- heldout <gate>` asks a rig manifest only of G4, and refuses a variant's seed a test grades on,
  WP-4.2's set has, or another held-out run used (D78).

## 0.42.1 · 2026-10-12

### Core
- A gait's loop meets itself at any cycle: its frames spread evenly over it, and each knee's turn about the leg, which
  drifted 3° to 22° over a cycle, closed over it (D71, the verifier's round 3).
- A gait whose foot swings forward past the hips faster than 400% of the hip height a second is refused: a long
  stance's knee popped mid-swing (D71).

### Tools
- The manual's "Make: actions": an action's fields, compiling, its root curve, cutting at an interrupt point, paired
  actions, a gait of one's own (D77).

### Repo
- Tests: the seam, the short swings' slide, the swing's speed, the dip's and lean's ranges (D71).
- WP-2.5's Verify, AGENTS.md's T2 row and G6's e2e step say what T1 samples and T2 runs in full (D74).

## 0.42.0 · 2026-10-12

### Library
- `library.resolver()`: a recipe's clips from the library, each with its rest and content id (D77).

### Tools
- The manual's make sections (D77): recipes and their operations, compiling against the library, edits, facts.

### Repo
- Briefs B4 (a sneak on a VRM-named avatar), B5 (an emote: a two-handed wave with a hop) and B6 (an edited punch), each
  with a starter, a grader, a known-good solution and planted bad ones; a brief may have its own default character.
- T1 samples B1's grader (gen-1; gen-37 in T2) and describe's token count (every third clip; all in T2), as D74's
  sweeps: 88.6 s (D77).

## 0.41.0 · 2026-10-12

### Tools
- The manual's wire sections (D76): graphs, events and hit timing, reactions, root motion and stride warping, and
  checking a graph with the simulation.

### Repo
- Briefs B2 (an attack's hit timing), B3 (reactions) and B7 (a locomotion graph), each with a starter, a grader, a
  known-good solution and planted bad ones (D76); `npm run bench` runs any brief; T2's full step grades them on a
  second character.

## 0.40.0 · 2026-10-12

### Tools
- `sim` (D75): `simulate` runs a script of a game's input on a graph (eased parameters, triggers, a ground speed) and
  gives its trace (states, events, hit windows at their steps), where the root went, the body every step and the
  sensors' read; the root follows the animation or stays in place, stride warped to the ground speed;
  `validateScript` (S-E001–S-E007), `compareTraces`, `traceText`, `filmstrip`. `npm run sim -- <graph> --input
  <script>` writes trace.json, result.json and film.png, and compares with `--expect`.

### Core
- Graphs: a state's `rate`, a number parameter its speed is multiplied by each step (stride warping sets it).

### Spec
- `spec/SIM.md`, `sim.schema.json` and `sim-trace.schema.json` (frozen under D75); `graph.schema.json`'s `rate`
  (refrozen under D75); `spec/sims/`: two scripts and an expected trace; Locomotion's move reads `warp`.

## 0.39.2 · 2026-10-12

### Core
- Graphs, after WP-6.4's verifier (D73): a state faded into plays, and fires its events, from its first step; a loop's
  exit share is taken when a step carries it past; a cut fade carries on from what it was fading out; a trigger may
  have a `buffer`, and `set(trigger, false)` clears one; a save holds the content hash of every clip the graph names,
  and restore refuses one edited since (E_CLIP_CHANGED) or a graph state the graph can't have (E_SAVE);
  `validateGraph` returns issues where it threw, checks a mask's field names, `name`, `desc` and `tags`, and gives
  every issue a fix; `remove("@…")` refuses a graph's layer.

### Spec
- `graph.schema.json`: a trigger's `buffer`, a mask's field names (refrozen under D73); `spec/GRAPH.md` says the
  above; the examples' presses wait 0.2 to 0.3 s.

## 0.39.1 · 2026-10-12

### Core
- Gaits, after WP-6.2's second verifier (D71): a foot lifts off to 9% of the hip height however short its swing, and a
  swing under 0.2 s is refused (a foot up for under 0.1 s reads as never leaving the floor: limps on a 1 s cycle slid
  up to 1.3 m); lift, bounce, dip, sway, lean and arm swing are taken in the ranges the presets pass (a lift of 40 or
  a sway of 5 popped a run's knee); the soft reach, which changed nothing, is gone.
- Moves begin and end exactly at the start pose given (a field ending in .5 was a degree off at the first or last
  key: up to 3.3 mm).

### Tools
- `carry.ts` exports its derivation; a T1 test holds `library/moves.json`'s numbers to my-3d2dge's frozen moves, and
  the whole file to the carry tool's where the pinned sources are. Without them `npm run moves` says to fetch them;
  gate G6 fetches them first.
- T1 reads every third loop of the planted-feet sweeps and plays the actions on two of the six test characters; T2
  runs those files in full (`M3A_FULL=1`, D74). T1 was 91.8 s against its 90.

## 0.39.0 · 2026-10-12

### Core
- `graph` (D73): graphs of states (a clip, a recipe, a blend space on one or two parameters, or pass), transitions
  (conditions, exit, cancel windows, fade, sync, interrupts) and layers, checked (`validateGraph`, G-E001–G-E010); the
  Animator plays one inside `step` on its own layers (`play`, `stop`, `set`, `trigger`, `on`, `graph`), its state in
  `save()`, `hash()` and `restore()`. An Animator without a graph hashes as before.

### Spec
- `spec/GRAPH.md`; `spec/schemas/graph.schema.json` filled (refrozen under D73); two example graphs in `spec/graphs/`.

### Tools
- e2e `animator-parity`: the example graphs run the same in Node and Chromium.

## 0.38.0 · 2026-10-12

### Core
- `actions` (D72): `compileAction` compiles an action (a recipe with its floor, beats and interrupt points) with its
  procedural parts, marks its beats and points as events and reads the ground its feet stand on (A-E006 when it isn't
  the floor given); `actionRootAt` its root curve, the ground's height with it; `interruptInto` cuts it into another
  clip, in step, raised and turned (`play` for a preview); `compilePaired` and `pairAt` time and place a pair's roles
  to meet on an event; `validateAction`, `validatePaired` (A-E001–A-E007).
- Recipes: a loop's root a float step short of its end reads the end of its cycle, not its start (a sequence ending on
  a walk jumped back a cycle on its last frame).

### Spec
- `spec/ACTION.md` and `spec/schemas/action.schema.json` (frozen under D72).

### Library
- `library/actions/`: get up, climb up, vault, hop down, roll and a heavy landing, and a paired jab and flinch, each
  from library clips, playing on the six test characters.

## 0.37.2 · 2026-10-12

### Core
- Procedural sources, after WP-6.2's first verifier (D71): a move begins and ends at any start pose (straight limbs, a
  `spine` field, a pose from a clip), each frame blended from it over the first and last 0.1 s; a leg whose start knee
  points back starts from its knee turned to the front; the hold is kept above 0 and at most 0.95.
- Gaits: a foot lifts off straight up to 9% of the hip height (above the 7% a lifted foot is read at) and sets down
  from 4.5%; a stride past 75% of a leg, a lift under 9% and a limp that leaves a foot no swing are refused with what
  to change; contacts are the model's; 60 fps. The presets slide at most 7.8 mm on three rests and none fails on any
  of 64; the run preset is 350.
- Idles: a breath leans the chest back and shrugs the shoulders (the torso's lengthening never reached the keys); the
  chest tips away from the standing hip (it tipped with it).
- `validateMoves`: MV-E008, a kick on the side plane; a blank `about`; a null height is a type error.

### Spec
- `moves.schema.json`: `hold` above 0 and at most 0.95, a kick on the ground plane, an `about` with text (refrozen
  under D71).

### Tools
- `npm run moves -- --check` (the carry tool), in gate G6's first command set; `carry.ts` reads the source's lengths
  from `procedural.SOURCE`.

## 0.37.1 · 2026-10-12

### Core
- Recipes, after WP-6.1's third verifier (D70): a blend of two travelling loops takes its cycle from its own roots
  (two facing apart jumped at the seam), and in step reads each loop on past its seam; `describeRecipe` reads a recipe
  not yet checked; the yaw's fix hint says + toward the right. 36 of the verifier's 41 mutants fail the tests; five
  pass for reasons D70 gives.

### Spec
- `spec/RECIPE.md`: the yaw's sign, and that a yaw held from a clip's start shows only in clip space.

## 0.37.0 · 2026-10-12

### Core
- `procedural` (D71): `moveClip` makes a move from `library/moves.json` into a clip on any rest from any start pose
  (it begins and ends there, a `hit` event where it connects); `gaitClip` a travelling walk, run or limp that slides
  at most 9 mm per contact; `idleClip` a breathing, weight-shifting loop on planted feet; `GAITS` and `IDLES` ready
  made; `moveState` and `placeMove`, the move model, match my-3d2dge's to 0.012 cm; `validateMoves` (MV-E001–MV-E007).

### Spec
- `spec/schemas/moves.schema.json`, the moves file's shape (frozen under D71).

### Library
- `library/moves.json`: 31 moves from my-3d2dge and shardfall in one unit system, each with an `about` line.

### Tools
- `node tools/procedural/carry.ts [--check]` writes `library/moves.json` from the pinned sources; doctrine's API cap
  for core is 44 (D71).

## 0.36.2 · 2026-10-12

### Core
- Recipes, after WP-6.1's second verifier (D70): a pose `yaw` turns the way the character travels (a turned loop no
  longer jumps at its seam), and a sequence keeps an item's own turn; `describeRecipe` always ends, and `tokenCount`
  counts at or over o200k and cl100k (it undercounted ids); a weight curve blends the legs as points and reads `a`'s
  clock; a loop that plays once keeps both parts of a seam contact; `sync` reads a plant over a loop's seam; `pin`
  stops short of a straight limb; a slice leaving nothing, a seam blend too long and a contact's end are coded R-E009,
  and a loop's contact may wrap; every issue has a fix. 66 one-line mutants each fail the tests.

### Spec
- `spec/RECIPE.md`: the yaw's travel, a curve's clock, a once result's contacts, the R-E009 times; the schema refuses
  a pose `root` (refrozen under D70); Jab_Cross_Combo's cross hit at 1.3 s, two descriptions say the upper body.

## 0.36.1 · 2026-10-12

### Core
- Recipes, after WP-6.1's verifier (D70): a sequence turns each next item's body with the heading the root has
  reached; a pose `yaw` turns the body with the root, and a loop closes on its first root; a loop's contact over its
  seam stays one wrapping interval; a blend that can't close and an eased loop play once; `sync` keeps in step only
  on a step; the clip's inputs are the clips the result is made from; every time a step gives is checked (R-E009);
  `validateRecipe` ignores JavaScript's own names, refuses a pose `root` and an empty mask, takes a clip's event
  names and gives every issue a fix; `describeRecipe` counts tokens, not characters; `pin` turns the elbow or knee
  with the limb's swing and bends it the natural way as the limb straightens.

### Spec
- `spec/RECIPE.md` matches the compiler (the content id, the inputs, canonical JSON, the defaults); the schema refuses
  `s1`-style step names and an empty mask (refrozen under D70); four examples replaced by chained ones (a hand on a
  rail, a timed turn, a jab-cross combo, a walk stiffening along a curve), three descriptions corrected.

## 0.36.0 · 2026-10-12

### Spec
- `spec/RECIPE.md`: recipes, clips made from clips (D70): fifteen operations, how a recipe compiles, its errors
  R-E001–R-E009. `spec/schemas/recipe.schema.json` gives every operation and its fields (the G1 stub, refrozen under
  D70); 20 example recipes in `spec/recipes/`.

### Core
- `recipe`: `validateRecipe`, `compile` (a format-2 clip, keys within 30 mm, provenance with the recipe's SHA-256 and
  its inputs' content ids, the license its inputs force), `describeRecipe` (one line, at most 100 tokens), and the
  tracks the steps make; a blend over time keeps each angle's gap from frame to frame, and two loops in step blend
  the pelvis, legs and feet as points.

### Sensors
- The 20 example recipes compile into valid clips the sensors pass (`npm test -- recipe`).

## 0.35.2 · 2026-10-12

### Library
- Five CMU picks from takes no pick shares (D69): `Swordplay`, `Boxing_Flurry`, `Backpedal_Punch` (combat 64) and
  `Explain_With_Hands`, `Angry_Quarrel` (gestures 63); CMU_CURATED 158 clips, 1,199 unique motions of 1,398.
- `library/baselines/qa.json` answers the three clips that stand off the floor (`floats`): two rise onto their toes,
  and `Shoot_Bow`'s source take holds no one floor for both feet.

### Tools
- `npm run qa -- library` checks floating (D69): an upright body with both soles more than 4.2% of H0 off the floor
  for 1 s or more, in a clip its tags don't put in the air, fails unless `qa.json` answers it; an answer whose clip
  floats no longer is named.
- The importer refuses a catalog that names a key twice in one object (`duplicateKeys`): JSON keeps the last unsaid.

## 0.35.1 · 2026-10-12

### IO
- `cutPicks` with `floorEach` stands a take whose feet don't show its floor where its feet stand while the body is
  upright (`UPRIGHT`: before a fall, after a get-up), else on the floor its whole body shows, not on the other takes'
  floor (D67): CMU subject 90's falls floated 23–25 cm.

### Library
- G5's verifier's findings (D67): two get-ups that duplicated captures already picked replaced, and six get-ups from
  takes no pick shares added (CMU_CURATED 153 clips); Mesh2Motion's floating `Hit_Chest` left out; `Fall_On_Face`
  described as the dive it is. Reactions 35 unique, 1,194 unique motions in all.
- A repair, or a re-import kept for a better verdict, moves no point more than 30 mm further from its source
  (`WORST`); `_import.json` records the fit before a repair. 110 clips repaired; fails 155.
- A clip's QA reason names the metrics its tags' profile turns off, and a warn's says no more than the sensors
  measured.

### Tools
- The census finds a re-export's original by pose at the rate it plays (`REEXPORTS`) and counts two clips that hold the
  same pose once (`STILL`); `qa library --check` compares each clip's whole reason and names a set reason no clip
  needs; `tools/qa/qa.schema.json` and `distributions.schema.json`, checked on read; the importer's `repairGuard` and
  `choose`, tested.

## 0.35.0 · 2026-10-12

### Sensors
- `checks.QA_VERSION` (`m3a-sensors@1`): the metrics' and levels' revision a clip's `quality.qaVersion` names (WP-5.8).
- `fix` keeps the facts a source gave (`captured`) when it measures a clip's facts again after a repair: a repaired
  100STYLE run had its captured speed replaced by its planted feet's.

### Library
- Library QA (WP-5.8, D66): every clip carries the sensors' verdict in its `quality`: pass, or baselined with a reason
  naming the level and the metrics past it, then why it is kept (`baselines/qa.json` by set and by clip, the warn
  level's, or how it stands to its source). 1,045 pass, 206 warn, 139 fail of 1,390.
- The re-import repairs what the sensors flag with their `fix` where it comes out better within 2 mm of its source
  (148 clips), and keeps a re-import the sensors judge better over its migrated version within 2 mm (8 STYLE100 walks).
- Five CMU get-ups for G5's reactions (Get_Up_Careful, Get_Up_Careful_From_Back, Get_Up_Heavy, Get_Up_From_Floor,
  Get_Up_Via_Kneel): CMU_CURATED has 149 clips.
- `docs/LIBRARY.md`, generated: sets, counts raw and unique (1,193 unique motions; the CC0 pack 173), categories
  against G5's floors, licenses, fit and the QA distributions; `baselines/distributions.json` records them.

### Tools
- `npm run qa -- library [--check] [--baseline]`: every clip's recorded verdict against the sensors', reasons whose
  finding is gone, the census (`tools/qa/census.ts`: a category per clip, copies by `orig`, re-exports and pose
  near-duplicates counted once) against G5's floors, the distributions (they may only improve), `docs/LIBRARY.md`. T2
  runs it.
- T1 runs a test file on every core (Vitest left one idle), and describe's token count over the library is a file of
  its own: 72 s, from 93 s after the library grew.

## 0.34.0 · 2026-10-12

### Library
- Search (WP-5.5, D65): `search(items, query, opts)` and `Library.search(query)` over every set's catalog. A game
  moment in words ("drinks a potion", "slips past the guards unseen") matched against tags, names and descriptions
  through a vocabulary of concepts by kind of motion, idioms (`PHRASES`) and stems, the moment's verb and rare words
  counting most; filters `speed>1.5` (m/s on 0.95 m hips), `dur<2`, `loop`, `once`, `set:`, `tier:`, `tag:`. At most
  40 short rows, the core list (`CORE`, 43 CC0 clips a game usually needs) first among equals, and a `next` hint: the
  nearest tags when nothing matches, a closer match in a tier the game hasn't opted into, the CMU ledger's takes.
  For 40 game moments a fitting clip is in the top 5 for 40 (37 on CC0 alone); for 10 held-out ones, 8 (7).

## 0.33.0 · 2026-10-12

### Core
- `measureFacts` and `playable` detect a tool's contacts again and take only a source's labelled ones as given (WP-5.4,
  D64): library clips carry their detected contacts now, and an edit since (a repair, a retime) may have moved the feet.
- The fitter's `closeLoop`: a loop whose capture closes ends on its first key, each angle by the whole turns nearest
  its own, so a nearly straight limb's held twist can't leave it open.

### Library
- Facts and auto-labels (WP-5.4, D64): `measureClipFacts`, `withFacts`, `capturedSpeed`, `tagConflicts`. Every clip
  carries its facts (`by: m3a-facts@1`: speed, travel, height, seam, strikes; a source's speed kept and named in
  `captured`) and its detected contacts, written by the importer and the migrator. A clip tagged `loop` must close,
  and a `run` must travel or be tagged `inplace`.
- The re-imported loops close (`closeLoop`): the 15 tagged loops that didn't now do. Mesh2Motion's Run_Anime and
  Run_Stealth and 100STYLE's Flapping_RunBack run on the spot: tagged `inplace` (and no longer `root-motion`).
- QA's baseline rewritten: 920 pass, 285 warn, 180 fail.

### Tools
- `npm run facts [-- --check]` (`tools/facts/`): every clip's facts and contacts against a fresh measurement, and
  every tag its facts don't bear out, each resolved or given a reason in `library/baselines/tags.json`.
- `npm run import` and `npm run migrate` write each clip's facts and contacts (`withFacts`).

## 0.32.0 · 2026-10-12

### Core
- Format 2's new degrees of freedom in the fitter (WP-5.3, D63): `encode`/`fit` take `spine` (the spine's curl, a
  sequential share fit, kept for a clip only if in some key it brings a spine point 5 mm closer; `spineGain`), `yaw`
  (root yaw from the hip line, held where the torso is far from upright, the line near vertical or the heading jumps;
  `turning`; kept only if the clip ends facing 20° or more from where it began) and `steadyTwist` (a nearly straight
  limb's twist held where it would swing 45° or more); a hand's flex is clamped to ±90° and its side to ±45°.

### Sensors
- The seam fix makes the two segments that meet at a loop's seam equally long, so the curves it spreads the gap along
  end at the same speed both sides (a sparsely keyed clip with a short last segment read as a hitch).

### IO
- `importSet` takes the encode options (`hands`, `spine`, `yaw`, `steadyTwist`) and writes a looping clip's `speed`
  from its stride (the cutter's `Capture.stride`).
- `readCmu`'s `floorEach` (the cutter's): every take and the rest stood on the ground, each take on its own floor where
  its feet mostly stand on one level, else on the floor of the subject's takes that do (a subject's takes can stand
  12 cm apart); off, the origin's one floor a subject, so tier 1b and the ledger don't move.

### Library
- Nine sets re-imported from their sources (WP-5.3, D63): MESH2MOTION, CMU_CURATED, STYLE100 and its six extras
  (runs, backward walks and runs, sidesteps and sideways runs each way, idles; 779 clips), each clip the better of
  its re-import and its migrated version, the reason in the set's `_import.json`; the Mesh2Motion audit closed (CC0).
  CMU_CURATED gains 84 picks for G5's floors (reactions, gestures and emotes, work, traversal, combat): 144 clips.
  The library is 1,385 clips. The Quaternius sets stay as migrated until their current editions can be fetched.
- Removed: STYLE100/HandsBetweenLegs_Walk, SwingArmsRound_Walk and WildLegs_Walk (format 2 can't hold the pose; their
  migrated fits were past the limits), with their reasons in the catalog's `$skip`. No successor, so no alias.
- The catalogs of every re-imported set live in `library/catalogs/` (the 100STYLE extras moved there from
  `tools/corpora/100style/`).

### Tools
- `npm run import [-- --set NAME] [--check]` (`tools/import/`): fetches each source into `.cache/` held to its pin
  (`tools/import/sources.json` and the corpora's locks), re-imports, compares each clip with the migrator's output
  (fit and every metric, separately; the hands from the pelvis) and writes the sets and the library's lock, or
  rebuilds them in memory and compares byte for byte; a migrated clip kept keeps its rest. `_import.json`'s schema is
  `tools/import/import.schema.json`. `npm run migrate` leaves the re-imported sets alone.
- `npm run plant -- --check` checks G3's runs against the library (every run's clip there, clean and able to show its
  defect) instead of rebuilding them, which a grown library changes.
- The demo (`apps/lab/hello`) plays its moves' hands only if every move has them (`handsAlike`): its migrated
  Quaternius moves have none and its re-imported jumps close the fist, which would clench and open within each fade.
- QA's baseline rewritten for the re-imported library (1,385 clips); the contact test runs the locomotion loops,
  sidesteps included, in four files (one cycle each for 100STYLE's).

## 0.31.0 · 2026-10-12

### Tools
- Large corpora on demand (WP-5.6, D62): `npm run corpora -- cmu --fetch | --survey [--check] | --import | --find |
  --ledger` fetches CMU's index, archive and the takes it lacks into `.cache/cmu`, each file held to
  `tools/corpora/cmu.lock.json`, and writes the ledger `tools/corpora/cmu-takes.tsv` (2,548 takes; every row as
  my-3d2dge's survey wrote it); `npm run corpora -- 100style --fetch | --import [--check]` fetches 100STYLE's archive
  (held to `tools/corpora/100style.lock.json`) and cuts its extras' six catalogs (`tools/corpora/100style/`) into sets:
  780 clips, every one cut at the same stretch with the same keys as shardfall's sets (`--check`).
- The doctrine check outside git reads only what a commit could hold: not `library/local/`'s content, `.cache/` or
  the outputs.

### IO
- The shared cutter finds a pick's stretch when asked (`Pick.find`: `straight`, `still`, `whole`, or a way to go:
  `forward`, `back`, `left`, `right`), cuts a loop going a way from the pass with the cleanest cycle, facing forward,
  and, `lenient`, leaves out a pick it can't cut with the reason (shardfall's takes.rs); `readBvh` takes `lenient`.

### Library
- `library/local/README.md`: the local lane's three rules and how to import into it; the library README lists the
  corpora.

## 0.30.0 · 2026-10-12

### IO
- The importers (WP-5.2, D61): `@m3a/io` reads untrusted input with capped sizes, a per-file budget of frames and
  joint transforms, bounds-checked buffers and glTF shapes checked before use; the readers it exports let nothing out
  but an `IoError` naming its cause and offset. `readGltf` (Rigify and Unreal rigs) and `readCmu` (ASF/AMC picks) read
  bit for bit like the origin's importer (conformance tier 1b); `parseBvh`/`rigBvh`/`readBvh` and `readGltfPosed` read
  any skeleton a bone map knows (MotionBuilder/Mixamo, Unreal, Rigify, VRM, 100STYLE, Bandai Namco);
  `vrmaOf`/`encodeVrma`/`decodeVrma`/`writeVrma`/`readVrma` write and read VRM animations byte for byte, the humanoid
  bones alone with the root's travel in the hips, the clip's loop, events, contacts and facts in the animation's
  extras as three's bake writes them; `importSet` fits libraries into a set as a catalog says (`$sources`, one CMU
  record a subject, `$pick` with the ledger's stretches, `$skip` with reasons), with a fit report per clip; `subset`
  picks a smaller set from bigger ones. FBX through an optional converter outside the package (README).

### Spec
- Conformance tier 1b runs: `spec/conformance/tier1b.test.ts`, with a second glTF vector, a Rigify rig with a skinned
  mesh (`tier1b/rigify.gltf`, `rigify-expected.json`): every accessor form, STEP and scale tracks, a turned and scaled
  root, and the mannequin's look, bit for bit like the origin's importer.

### Tools
- `tools/vectors/rigify.ts` builds the Rigify rig; `npm run vectors` reads it with the origin's importer.

## 0.29.0 · 2026-10-12

### Library
- License compliance (WP-5.7, D59): `checkSets` (each source an SPDX id fitting its set's tier, its text kept, a
  credited set's credit; open audits listed) and `checkGame` (a game manifest's clips from the tiers it opts into, no
  `local` content shipped), the credits owed and `creditsBlock`; `licenseText` in `@m3a/library/node`.

### Tools
- `npm run license -- check <library | SET | game.json>`: the check, with the credits block a game shows.

## 0.28.1 · 2026-10-12

### Core
- Planting holds a foot through a gap of under 0.1 s between two of its contacts (a loop's seam included): letting
  the hold go and taking it again there moved the foot by its whole drift in a frame (D58).

### Tools
- `npm run fixtures -- heldout <gate>`: whether the gate's latest held-out run is fit for a gate run (unused by a
  recorded one, its license file's SHA-256 pinned, its rig cached and verified); G4 runs it first (D57).
- A rig manifest may pin its license file's SHA-256 (`licenseSha256`), checked at fetch and in the cache.
- `npm run bench` records the commit under test with `git` (a worktree's too) and whether the tree differed, the models
  the agents ran and a variant's directory and character, and no longer overwrites an earlier run's results.
- G4 runs B1's discovery trials (2, reported, not gating; §7).

### Repo
- The capture e2e draws sheets of G4's six skeletons, a toeless test character and the held-out rig.

## 0.28.0 · 2026-10-12

### Core
- A clip plays with its library's spine and neck shares (spec §3.3, D55): `AnimClip.shares`; the Animator carries them
  in each key's `spine` and mixes the neck's as the head is; `playable(clip, rest)` makes a library clip ready (its
  contacts measured on its rest, its shares); `solver.reachable(k, R)` keeps the neck where R's shares put it when
  the hips carry the lowest segment.
- Planting: the settle, a planted foot's float and the reach drop averaged over ±0.1 s (`PlantOptions.settleSmooth`),
  within 2% of H0 of the pose's own; a planted sole within 2.5 mm of the surface, the body down far enough that a
  planted foot floats at most 3 mm; each sample reads its own hold; the reach drop continuous past the leg's reach;
  a knee the clip holds past straight no longer folds backward when the planted leg bends further.
- `clip.sole`: a foot's sole points (the heel turned with the foot), moved from the sensors.

### Sensors
- The sole comes from core (`clip.sole`); readings unchanged.

### Three
- The demo (`apps/lab/hello`): the jab for the attack; the flight lasts through the landing's fade.

### Tools
- The sweep plays clips with their library's shares.
- B1 asks speeds in proportion to the character's hip height (D56): `speeds.json` in each workspace, read by the
  starters' `npm run check`; the briefs say so.

### Repo
- CI's T2 job fetches each gate's held-out rigs (`bench/results/heldout/*/run-*/rig.json`) before the e2e suite.

## 0.27.0 · 2026-10-12

### Sensors
- `checks.STANCE` is exported (the speed under which a foot stands).

### Three
- `@m3a/three/test-characters` is a public entry: the generated test characters and `loadGlb`.

### Tools
- The benchmark (WP-4.7, D54): `npm run bench -- B1 | quiz [--trials N] [--discovery N] [--parallel N] [--variant
  dir] [--model m] [--fake]`; fresh agents at isolation level 1 in workspaces outside the repository, the packages
  installed from their tarballs; each trial's time, turns, tokens, cost and audit in `bench/results/`.
- B1 (locomotion): its brief, starter, discovery starter and brief, and a grader that judges the character's bones;
  the legend quiz (deferred from WP-1.1).
- The manual's first draft (`packages/tools/MANUAL.md`, shipped in `@m3a/tools`).

### Repo
- The boundaries check allows any subpath a package's exports map declares.

## 0.26.0 · 2026-10-12

### Library
- The loader (WP-5.1, D53): `Library` (sets, catalogs and clips by id) and `@m3a/library/node`'s `openLibrary`; each
  set's content id checked against its files and each clip against `library/sets.lock.json`, so a changed file is
  named; CC0 alone unless a game opts in to a tier; deprecated ids resolve with a warning.
- `library/LICENSES/`: CC0 1.0 and CC BY 4.0 verbatim, CMU's notice in full; `library/README.md`.

### Tools
- `npm run library -- lock | check | list [--tiers ...]`.

## 0.25.0 · 2026-10-12

### Core
- Planting on another body (D51): the body settles onto its feet over 0.2 s (`PlantOptions.settleBlend`), from the
  float a foot had as it lifted or toward the one it lands with; only a standing foot lifts the body; a re-solved knee
  keeps the clip's knee unless the new ankle bends the leg further; a hold lets go of its drift over 0.2 s
  (`PlantOptions.release`), done before the foot lands again.
- `contact.plantMix`: under a cross-fade or a blend each layer plants its own clip and their corrections blend by their
  shares of the legs; the Animator uses it whenever two layers share the legs, so a planted foot no longer jumps when
  the layer that most decides the legs changes.
- `ik3` keeps a limb's lengths when its end is inside its fold (a thigh much longer than its shin folded tight).

### Sensors
- `checks.motionOfFrames` takes the root's path (`root`): the points on the root, so a loop's seam is read on the body
  and its feet's slide in the world.
- Reading by parts (`Motion.parts`, `checks.partScale`, `checks.TYPICAL_CHAIN`): each point against its chain from the
  pelvis, for bodies whose proportions are far from a person's; off by default, so the library's readings are as
  baselined. `checks.stance` is exported.

### Three
- The first-flight demo (`apps/lab/hello`, a lab, D52): a test character idles, walks and runs by speed, jumps and
  attacks, its hit shown; deep links, `window.__m3a`, a phone layout, the build stamp; `vercel.json` for O3.

### Tools
- `npm run sweep` reads seams on the body, every point by its part, and the clip's own slide over the stretches the
  played body stands on; each failing metric's own and played values and levels are in the results (D51).
- `npm run hello [-- build | preview]`: the demo served, built into `apps/lab/hello/dist`, or that build served.
- e2e `hello`: the demo driven headless; its hashes are Node's, its hit shows, the sensors read what it plays, its
  screenshots and contact sheet go to `check-output/hello/`.

## 0.24.0 · 2026-10-12

### Core
- Planting (D49, revising D37): the re-solved knee keeps the clip's own knee as its pole, a sole's setting eases in
  before a contact and out after it, the body is lifted and lowered continuously (`PlantOptions.settle`, default on),
  and a contact through a loop's seam is one contact.
- A foot segment of no length measures no pitch (a toeless rig measured a NaN rest).

### Three
- `@m3a/three/capture`: a bound character drawn headless on WebGL 2, every frame read back, checked not blank, with
  the proof hash of its bones; `CaptureError` for a blank frame or another renderer (D49).
- Bind gives a foot that ends with no child an end bone where its mesh ends, on the sole (D49, revising D47).

### Sensors
- Foot locks bake planting with `settle: false` (D44).

### Tools
- `npm run sweep`: every migrated clip played by the Animator on each skeleton, judged against the clip on its own
  body, with every failure's reason (D49).
- CI's T2 fetches the real rigs and prints the browser log when it fails.

## 0.23.1 · 2026-10-11

### Three
- `bind` recognizes only the bones that deform the mesh (and those above them): a rig's IK and roll controls were taken
  for limbs (KayKit's Knight bound its arms to its legs' controls) (D47).

## 0.23.0 · 2026-10-11

### Three
- WP-4.4: `attach(animator, bound)` writes an Animator's poses to a character's bones each update (the write allocates
  nothing) and hands the root's motion to the game; `bake(clip, bound)` makes a THREE.AnimationClip within 0.5 mm of the
  live solve, carrying the clip's loop, events, contacts and facts in `userData` (D48).

## 0.22.0 · 2026-10-11

### Three
- WP-4.3: `bind(root, { mapping? })`: a three.js character's skeleton (or VRM humanoid) recognized, its rest read in
  its own space, bound for the solver, with a report of at most 20 lines and a mapping patch to edit and pass back (D47).

### Core
- Recognition by topology: a long clavicle is the shoulder, a rig with no neck keeps its arms, a twist leaf isn't the
  hand, a chain of neck bones ends at the head, a twist bone in the thigh is passed over, and an arm with twist bones in
  it is reported with lower confidence (D28 revised).

## 0.21.0 · 2026-10-11

### Three
- WP-4.2: test characters (`packages/three/test-characters/`): skinned humanoids generated from a seed as GLB in
  memory, varying in build, rest pose, bone names (VRM, Mixamo, UE5, Rigify, with each family's habits), twist bones
  and left-out bones; the 20 of the test set load in three.js and are recognized; `loadGlb` and `skeletonIn` read any
  character in three (D46).

### Tools
- `npm run fixtures -- fetch | check [--manifest <file>]`: real CC0 rigs fetched by SHA-256 into `.cache/fixtures/`,
  their license files read and checked; Quaternius' mannequins and KayKit's Knight. CI fetches them before T1.

## 0.20.0 · 2026-10-11

### Three
- WP-4.1: `@m3a/three` pins three.js r182 (`three@0.182.0`), the release fresh agents write correctly that runs on
  both of `WebGPURenderer`'s backends in the platform's Chromium (r186's WebGPU fails to start there) (D45).

### Tools
- `npm run doctrine` bans the WebGL-era three.js APIs that break under `WebGPURenderer` and holds `packages/three` to
  the pin (`tools/doctrine/banned-three.json`).
- e2e `three`: the pinned release loads a skinned glTF, plays and crossfades on both backends; CI's `three-next` job
  runs it on r186.

### Docs
- `docs/THREE.md`: the pin, why, how to write against it, and the banned APIs.

## 0.19.1 · 2026-10-11

### Sensors
- G3's second review of WP-3.5 (D44): `fix` doesn't apply a step that raises a metric already at warn by more than
  5%, adds findings, or lowers none of the metrics its operator answers (as well as one pushing a metric past a level);
  twist flips take whole turns out of a stretch before spreading it; foot locks aim only the locked side's leg and
  leave an in-place loop that steps as it is (the step says why); jitter treats a key out of place alone apart from a
  shake.
- `compareClips` throws when its three rows can't fit the budget, instead of returning over it (D40).
- The describe tests count tokens by cl100k as well as o200k (D42).

### Tools
- `npm run qa -- --fix` counts a clip with more findings as worse, and its summary is in the verdict line.

## 0.19.0 · 2026-10-11

### Sensors
- G3 review of WP-3.5 (D44): `fix` doesn't apply a step that would push any metric past a level it was under (the
  step says which), every key an operator adds or edits is tidied to the format's whole numbers and ranges (`fixes.tidy`),
  edits are keyed every 0.1 s, twist flips keep a loop closed, the seam operator adds no key when the seam closes and
  matches speeds where they stand out (lint names it for `seamVelocity`), penetration sets on the floor only a foot
  standing still, re-fit counts the root's travel and turn, and an unknown operator name throws.
- Describe's text holds to 150 tokens as counted, not 600 characters, and says how many items it left out (D42).
- A predicate whose interval starts after the clip ends is refused (D41).
- A sheet whose frames draw no body throws, naming them; a diff's three rows share its token budget (D40).

### Tools
- `npm run qa -- --fix`: lint and fix over the library, failing on any clip that comes out worse or invalid; in G3's
  command set. The verdicts line names the metrics that fail most.
- The planted defects (D43): every planted clip validates; slides lie on stances within their clips and are found
  within 0.1 s of them; the defects take clips in turn, about 10 each; edits keyed every 0.1 s.

## 0.18.1 · 2026-10-11

### Tools
- The sensors' baseline (`packages/sensors/fixtures/baseline.json`, numbers only): every migrated clip's verdict,
  values and finding counts. `npm run qa -- --check` fails on any difference and T2 runs it; `--baseline` rewrites it,
  in a commit that says why.
- `npm run plant [-- --check]` for the planted defects.
- `npm run gate -- G3`: its command set.

## 0.18.0 · 2026-10-11

### Sensors
- WP-3.5: `fix(clip, R)` and `lint(clip, R)`, and the operators one by one (`fixes`): repair twist flips, filter
  jitter and pops, lift penetration, bake foot locks, close a loop seam (pose and speed), re-fit keys to a budget.
  Each is measured before and after, and no clip changes silently: `dur`, events and contacts are checked after every
  operator, and stored facts measured again (D44).
- The metrics' key grid is the keys as played: a key past the end counts only through the pose at the end.

### Tools
- The plant tool's new keys snap to a clip's own within 5 ms; the slide plant keys its drag on the 1/30 s grid.

## 0.17.0 · 2026-10-11

### Sensors
- WP-3.6: 100 planted defects (`fixtures/planted/runs.json`), ten kinds, every one flagged by its metric at its times;
  false positives in 3 runs of 100, each stated (D43).
- Jitter takes the smaller of two opposite bends, so a key out of place doesn't read as a shake beside it (warn 26,
  fail 90 from capture); a flip at a limb read as straight folds its swing too.

### Tools
- `node tools/plant/main.ts [--check]`: plants ten defects into clean library clips with the times they must be found
  at (a slide, a sink, an arm through the torso, a pop, a twist flip, a loop seam, a stretched bone, a NaN, events out
  of order, a wrong mirror).

## 0.16.0 · 2026-10-11

### Sensors
- WP-3.4: `describe(clip, R)`: a clip as a short text timeline: its phases by rule (stand, walk, run, crouch, sit, lie,
  air), landings, strikes, events and travel; at most 150 tokens, more with `detail`. 30 of 30 on the reviewed ground
  truth (`fixtures/describe-truth.json`).
- The metrics' stance can read by height alone.

## 0.15.1 · 2026-10-11

### Sensors
- WP-3.3 review: where a foot stands is measured (on the floor, slower than a swing or carried with the pelvis), so a
  sliding or gliding foot is measured; slide is a contact's drift from where it landed; skate is a metric of its own.
- The root adds its place, not a second turn by its yaw; the heel's sole point turns with the foot.
- Jitter and pops read the key grid; pops follow my-3d2dge's 2.5× rule, per body part; thresholds re-derived from capture.
- Twist flips are judged at any spacing where the reference is undefined, by rate elsewhere; the head limit reads
  either encoding of the head.
- A flip folds only what it swings within its keys, takes their worst level, and keeps them as `folded`.
- Predicates convert or reject units, read the measured stance, and refuse backward intervals; a sliding profile.

### Tools
- `npm run qa`: `--dist` prints the distributions (capture and all); every clip's findings go to `clips.json`.

## 0.15.0 · 2026-10-11

### Sensors
- WP-3.3: the metrics (`metrics/`), `metrics(clip, R)`: slide and skate, penetration, self-intersection, jitter, pops,
  twist flips, knee and neck limits, stretch, loop seams, fit, non-numbers, events and symmetry. Each finding has its
  times and a repair. Thresholds come from capture, each with its reason; tag profiles relax what doesn't apply. The
  verdict is at most 20 lines.
- Predicates (`predicates/`): planted, free, within, height, compare and "no". A failure reads as a repair.
- The raster's capsules are named by part.

### Tools
- `npm run qa`: the sensors over the migrated library (`--sample`, `--set`, `--clip`, `--dist`, `--strict`). T2 runs
  it.
- The boundary check's import scanner no longer reads `import's` in a string as an import.

## 0.14.0 · 2026-10-11

### Sensors
- WP-3.2: sheets, films and diffs (`sheet/`):
  - `sheet` (a clip's frames at one scale, in rows of eight) and `filmstrip`;
  - overlays for planted feet, foot trails, flagged times in red, and a timeline of contacts and flags;
  - `diff` (A, B, and A with changes marked) and `compareClips` (two clips on one camera);
  - each image's size and token cost, within a budget.

## 0.13.0 · 2026-10-11

### Sensors
- WP-3.1: the software raster (`raster/`):
  - the capsule mannequin on a pose's body points, lit and z-buffered, its left side blue, with a nose for facing;
  - front, side, back, top and three-quarter views, any azimuth, and a turntable;
  - a 5 × 7 bitmap font for labels and a non-blank check;
  - PNG bytes (`encodePng`; `png` and `writePng` in the new `@m3a/sensors/node` entry, through node:zlib).

## 0.12.1 · 2026-10-11

### Core
- The Animator, fixed from the G2 review (D38):
  - a loop's events fire once a cycle at any speed, backward too, however many cycles one step covers;
  - a one-shot's end fires once when the playhead turns round at it;
  - no −0 in the state;
  - `restore()` hashes clips afresh (one edited in place is refused) and refuses a save made on another body
    (E_BODY_CHANGED);
  - each call's turn is composed step by step (no 360° jump);
  - a clip with no id, a zero-length loop and a malformed save are refused or played still;
  - the lowest layer fires its events whatever its weight.

### Tools
- `npm run test:cross-engine` runs the Animator's script in JavaScriptCore (Bun) too: the same hash as V8.

## 0.12.0 · 2026-10-11

### Core
- WP-2.6: the Animator (`animator/`):
  - layers (clip, weight, mask, additive, speed);
  - `step(dt)` on a fixed step: events in the order the playheads pass them, root motion mixed like the pose;
  - `hash()`; `save()` and `restore()` as plain JSON, naming each clip by id and content hash, refusing a changed or
    missing clip by name;
  - `pose()` with planted feet, the ground and hand targets, at full detail, `lod` 1 or `{ exact: true }`.
- The public API is `src/index.ts`, all of it: 38 documented names, each module as a namespace (`format`, `ops`,
  `math`, `solver`, ...).

### Tools
- The doctrine's boundary check counts each package's public exports (core at most 40), and fails a bare `export *`
  or an export with no doc comment.

### Repo
- e2e `animator-parity`: the Animator's hashes, events and exact poses are the same in Node and headless Chromium.

## 0.11.1 · 2026-10-11

### Core
- The solver's bone roll, fixed from WP-2.4's review (D36):
  - the left arm's rest pole is no longer mirrored (it rolled 62.7° on every pose);
  - arms and legs roll by their bend plane's normal, with no flip at any bend;
  - feet and toes roll about the axis they pitch about;
  - hands roll by the knuckle line, the skeleton's own at rest, and a format-1 hand stays on its forearm;
  - fingers curl toward the palm at any hand roll;
  - T, A and relaxed rests give the same rotations.
- The hips carry the lowest spine segment, so every point the solver decodes is one the bones reach (`solveRest`,
  `reachable`, `decodeOn`).

### Spec
- Conformance tier 3 reads its tolerances from the runner's `TOLERANCE`.

## 0.11.0 · 2026-10-11

### Core
- WP-2.5: contacts and ground (`contact/`): `plant` holds each planted foot's contact point still in the world
  (stateless: the motion's own drift since landing, undone), sets the sole on the ground (pitched to slopes and steps
  through a ground probe), lowers the pelvis where a leg can't reach, solves the legs again, and draws hands to
  weighted targets; `contactRoot` gives an in-place clip the root its planted feet imply. `solve` takes edited points.
- Contact detection also asks a planted foot to be still in the world (slower than half the body's speed), and closes
  gaps up to 0.1 s; `syncBlend` gives the blend's contacts, the inputs' weighted.
- On all 133 migrated locomotion loops and on synced walk–run blends a planted foot slides at most 10 mm per contact
  (0 mm measured); on 10° slopes and 0.2 m steps planted soles stay within 5 mm of the surface (1.7 mm measured).

## 0.10.0 · 2026-10-11

### Core
- WP-2.4: the solver (`solve/`): `bind` (recognize, measure the body from the bones, map the format's frame to the
  skeleton's) and `solve` (each bone's world and local rotation and the hips' place, from the key's numbers decoded on
  the target body: limbs rolled by their poles, the spine by its shares, fingers by their curls, soles on the floor);
  `forward` for the joints. Handles T, A and relaxed rests, missing optional bones, twist bones and a host's rest
  rotations.
- `quat.fromMat3`; the decoder's `limbPoles`; the decoder places a shoulder with no offset at its clavicle point.

### Spec
- Conformance tier 3 runs (`spec/conformance/tier3.test.ts`): every generated body of `tier3/bodies.json`, every tier-2
  clip at four times.

## 0.9.0 · 2026-10-11

### Core
- WP-2.3: pose operations (`ops/`): `blend` (angles the short way round; exact at 0 and 1 up to whole turns),
  `delta` and `addDelta`, `mask` by body group with feathering, `mirrorPose`, `retime` (speed, duration or an ease
  curve), `slice` (across a loop's seam; the root restarts), `loopify`, and `phaseMap` and `syncBlend` (contact-phase
  sync; the legs blend in point space, so planted feet stay within 20 mm of the floor).
- `encodePose` takes `round: false` for exact, unrounded numbers (the default is unchanged).

## 0.8.0 · 2026-10-11

### Core
- WP-2.2: the clip runtime (`clip/`): `sample` (body points at t), `rootAt` and `rootDelta` (root travel and heading,
  composed over loop cycles), `events` (each occurrence once, in order, loop-aware, either direction), `contactsAt`
  and `detectContacts` (hysteresis about the floor), and `measureFacts` (seam, travel, speed from the planted feet,
  height, strike, contacts).
- WP-2.2: `fixtures/facts-truth.json`: 20 clips whose speeds, distances, strikes and loop flags come from my-3d2dge-2's
  asset manifest and skill timings and shardfall's importer; measureFacts is within tolerance on all 20.

### Repo
- Lint bars `**` other than squaring in core (the host's pow; D34).

## 0.7.0 · 2026-10-11

### Core
- WP-2.1: the math kernel (`math/`): portable `sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`,
  `log2`, `log10`, `hypot` and `cbrt` with native V8's bits on every input tested (fdlibm, FreeBSD and V8's own
  algorithms, Payne–Hanek past 2^19·π/2), and `pow` within one unit of glibc's; `PORTABLE`, `NATIVE` and `mathFor`.
- WP-2.1: my-3d2dge's helpers bit for bit with core.json (`clamp`, `lerp`, `approach`, the angle helpers,
  `smoothDamp`, `ease`, `hash2`, `noise2`); `Rng`, `rng`, `derive` and `RngStreams`; `Fnv64`, `hashNumbers` and
  `hashValue`; `vec3`, `quat` (slerp, swing-twist, from unit vectors) and `mat4`.
- WP-2.1: the codec, the skeleton profile and the validator call the portable math (tiers 1a and 2 unchanged, bit
  for bit); lint bars the host's transcendental `Math` functions from core (D33).

### Tools
- WP-2.1: `npm run test:cross-engine`: V8 against JavaScriptCore (Bun), bit for bit, with each function's cost.

## 0.6.0 · 2026-10-11

### Spec
- G1: spec 2.0-rc frozen (D31): `spec/frozen.json` holds the SHA-256 of `MOTION.md`, `SKELETON.md`, `LEGEND.md`,
  `conformance/tiers.md` and the schemas. Before the freeze: `_baseline.json` (§9.4, with
  `schemas/baseline.schema.json`) and the source record's `terms`, `audit`, `file` and `rig` (§9.1).
- G1's verifier fixes (D32): the frame is f × r = z as numbers, left-handed physically (§2); §5.2 gives every
  optional field's range, and `root` is ±10,000,000 in spec, validator and schema; `quality.fit` is measured against
  the source frames whatever the method (§7.5); skeleton names drop the `mixamorig` prefix three.js's loader leaves.

### Library
- WP-1.5: the seed sets in format 2: QUATERNIUS_3D2DGE (88), QUATERNIUS_SHARDFALL (102), MESH2MOTION (177),
  CMU_CURATED (60, tier cmu, CMU's notice word for word), STYLE100 (98, tier cc-by): 525 clips, each with
  `_set.json`, `catalog.tsv` (rows within 40 tokens) and `_baseline.json` (reasons per warning, from the clip's keys).

### Tools
- WP-1.5: `npm run migrate [-- --check]`.
- G1: the doctrine's `frozen` check and `node tools/doctrine/freeze.ts <decision>`; it also fails a missing record, an
  unrecorded schema and an unlogged decision. `npm run gate -- G1` runs the gate's command set.

### Core
- WP-1.3's verifier fixes: hand roll unwraps; fingers curl toward the palm normal; `fromFormat1` takes the method;
  the normalized lens; format 2's fields get vectors (`tier2/FORMAT2.json`).
- Sampling takes a format-2 clip directly (`Timed.keys` accepts `Key`).
- The set validator rejects a non-positive `rest.H0` and non-string source fields, as the schema does.

## 0.5.0 · 2026-10-11

### Spec
- WP-1.4: `spec/SKELETON.md`: VRM 1.0's humanoid (55 bones, 15 required), frames, rest measurement, body points on
  bones, the mapping tables, recognize's output, the Khronos watch.

### Core
- WP-1.4: `skeleton/`: `recognize` (8 tables and a topology fallback), `patchMapping`, `restFrame` (T, A or relaxed),
  `measure` (the origin's, bit for bit) and `restPoints`.

## 0.4.0 · 2026-10-11

### Core
- WP-1.3: the codec (`format/`): decode onto a rest body, encode from body points, sampling, RDP and fit (one budget
  or one per region), format 1's text and parse, the format-2 key lens, mirror, the canonical clip file, slugs, the
  motion hash's input, and reading format 1. Format 2's hand, fingers and spine decode; hands and fingers encode.

### Spec
- WP-1.3: conformance tiers 1a (bit for bit) and 2 (to the micrometre) pass; tier 2's vectors carry their input clips.

## 0.3.0 · 2026-10-11

### Spec
- WP-1.2: JSON Schemas for a clip, a set manifest and a catalog row (`spec/schemas/`), with stubs for recipes and
  graphs.

### Core
- WP-1.2: `validate(data, { mode, kind })`: 30 coded rules (20 clip errors, 6 warnings, 4 set and catalog errors),
  messages of at most two lines naming the clip, key, time and field; `read` accepts unknown fields, `lint` flags
  them with the nearest name. The format-2 types and key-field table.

## 0.2.0 · 2026-10-11

### Spec
- WP-1.1: `spec/MOTION.md`, the motion format 2.0-rc (frame and units, every field with its range, the new optional
  hand, fingers, spine and yaw fields, contacts, events, facts, provenance with IPTC source types, quality, review,
  sampling, limits, versioning, ids, sets and content ids, numerics), and `spec/LEGEND.md` (792 of 800 tokens with a
  worked key).

## 0.1.0 · 2026-10-11

### Repo
- WP-0.1: the doctrine (`DOCTRINE.md`), the agent rules (`AGENTS.md`), the decisions log (D1 to D21), the feedback log
  and the progress page.
- WP-0.2: npm workspaces for the six `@m3a` packages, strict TypeScript with project references, ESLint, Vitest and
  Playwright on the preinstalled Chromium; the tiers `check` (T0), `test` (T1) and `e2e` (T2) with their budgets,
  `test:changed`, `gate`, the header lint and `tools/version.ts`.
- WP-0.3: `npm run doctrine` (also in T0): binaries, cl100k token budgets, import boundaries, banned APIs, exact
  pins and checksums, the append-only decisions log and the local lane.
- WP-0.5: CI (T0 and T1 on every push, T2 on pull requests, gates by manual dispatch; actions pinned by SHA), the
  SessionStart hook (`npm ci`, `CHROMIUM_PATH`) and the pull request template.

### Spec
- WP-0.4: the conformance vectors (`spec/vectors/`, tiers 1a, 1b, 2 and 3, plus two frozen fixtures from my-3dge),
  `spec/conformance/tiers.md` and the TypeScript runner; `npm run pins` and `npm run vectors` with `--check`.
