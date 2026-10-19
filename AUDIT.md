# Audit: the large items (temporary)

The post-G10 audit (D118, 2026-10-19) fixed every easy finding in its own pull request. These are the large ones,
each a work package of its own. This file is temporary: each item moves into a WP (`PLAN.md` §10 and the ledger) when
it is picked, or into `docs/HANDOFF.md`'s follow-ups, and the file is deleted when it is empty.

| # | Item | Size | Needs | Status |
|---|---|---|---|---|
| 1 | Graduate apps/lab/hello: its "set on G4's skeletons" check into a package-tier e2e, then delete the lab | M | nothing | open |
| 2 | Name a generated character (`gen-<seed>`) and an arbitrary orbit in the CLI and MCP | M | nothing | open |
| 3 | Ship the agentskills.io skill in `@m3a/tools`'s tarball | S | O2 stays "don't publish" | open |
| 4 | Teach the manual's untaught names (F5.2, MIGRATING gap 10) | M | a decision: cut text or raise the budget | open |
| 5 | Refuse every clip added outside the adopt bot (§8.4 after G9) | L | the importers' and procedural sets' regenerations through the bot first | open |
| 6 | The intake checker's census over the whole library on every run | M | nothing | open |
| 7 | A locomotion sweep at the rates a game asks (0.5 to 2) on the test bodies | L | a decision on what fails | open |
| 8 | A linear planter and key fit (K5) | L | a decision re-baselining the vectors and A/B hashes | open |
| 9 | Contacts for the 6 `unplanted` loops, arbitrated by captured speed | L | clip files: in sequence, through the writer | open |
| 10 | `deliver` refusing a clip whose stated and served terms differ; `provenance.intake.by` required by the format | S | reverses D113's calls: a decision (frozen schema) | open |
| 11 | A namespace's proof listing the digest too; one index version per commit | S | the open #16 thread is the owner's (D115) | owner |
| 12 | The census counting a motion and its mirror once | S | reverses D67 (a game needs each side): the owner's call | owner |

## 1. Graduate apps/lab/hello

The lab answered its question at G4 (D88) and stays only because its e2e is T2's standing G4 check: the idle, walk,
run, jump and attack set on G4's six skeletons and the held-out rig, sensors green (`tests/e2e/hello.e2e.ts`).
consumer-ts doesn't cover it (gen-1 and gen-2 only, no jump or run). Plan: move the GUI-free `game.ts` set and that
test into `tests/e2e/first-flight.e2e.ts` on the package's public API; repoint G4's step label in `tools/run/gate.ts`
and `PLAN.md` WP-4.6 and §9.3; then delete `apps/lab/hello`, `tools/run/hello.ts` and the `hello` script (AGENTS.md's
command table, the site's lab list). Verify: `npm run e2e -- first-flight previews`, `npm run gate -- G4`'s T2 step.

## 2. `gen-<seed>` and an arbitrary orbit

The gallery plays generated characters the tools can't name (D109). `body.ts`'s `skeletonOf` takes a `.glb/.gltf/.vrm`
path or `tiny`. Plan: a `gen-<digits>` branch that builds `character(variant(seed))` through an export of
`@m3a/three/test-characters` that doesn't pull in three's loaders (the single `m3a.js` bundles the tools); `sheet`'s
`view` takes a name or `{yaw, pitch}` (`raster.viewOf` already takes a View). The tool descriptions are at 3,130 of
3,200 tokens (D113): trim first. Verify: `characterOf(ctx, "gen-3")` binds with the same rest as the GLB it builds;
`npm run doctrine`; `npm test -- tools-body tools-check`.

## 3. Ship the skill

No tarball carries `skills/m3a/SKILL.md` (D118); an installed `@m3a/tools` gives an agent the manual but no skill.
Plan: stage `skills/m3a/` into the tools package in `tools/bundle/build.ts`, add it to `files`, assert it in
`pack --check`, and have the runner copy it from the packed tarball. Nothing is published (O2).

## 4. The manual's untaught names

The manual is at 7,999 of 8,000 tokens. F5.2 (which package exports `LibraryError`, its `.code`) and MIGRATING gap
10's names (`VERSION`, `math.PORTABLE`, `math.hashValue`, `graph.layersOf`, `graph.clipsOf`, the Animator's `step`
option) wait for room. Any cut is graded: G7's quiz and B1 to B8 read the manual (one line flipped a gate, D106), so a
change reruns the briefs it touches. Raising the budget is principle 1's call.

## 5. Only the adopt bot adds clips

library-gates holds a clip added outside the intake to the intake's gates, but a clean one passes (D113), because the
importers and procedural sets still regenerate clips by pull request. Plan: give those regenerations the adopt bot's
path (or a maintenance path the gates can tell apart), then make `gatesOf` refuse any added clip without intake
provenance. Test: a fixture planting a clean clip into an existing set fails `library-pr`.

## 6. The checker's census

Every checker run rebuilds the census over the library and the batch (about 1 s, synchronous); B8's tick skips idle
runs, so it stalls only ticks that find a submission. Plan: cache the library pool's sampled poses in the Checker and
sample only new submissions (an incremental census in `tools/qa/census.ts`), or run the check in a worker.

## 7. The locomotion rate sweep

D106: keyed runs skim on some bodies at some rates, which neither QA (own rest) nor the sweep (rate 1) catches. Plan:
`npm run sweep -- gen-0..gen-19 --rates 0.5,1,2 --locomotion`, playing each locomotion loop with root motion as B1's
grader does, reporting skim and slide per body and rate; a decision says what fails, with a baseline for the known
keyed runs.

## 8. A linear planter and key fit

The planter (K5) and the key fit grow faster than linearly; the tools bound them (D96). Making them linear changes
outputs bit for bit: a decision re-baselines `spec/vectors`, the A/B hashes and the cross-engine checks, and
conformance reruns.

## 9. The 6 unplanted loops

`Boxing_Guard_Loop`, `Run_Anime`, `Run_Stealth`, `WideLegs_Walk`, `Drunk_RunBack`, `OnHeels_Run` are answered
`unplanted` (D108). Plan: in `@m3a/library`'s measure, which knows a loop's captured speed, prefer the contact reading
whose ground speed agrees with it (`WideLegs_Walk`'s height pass reads 0.94); regenerate through the writer, update
`library/baselines/qa.json` and `tools/qa/library.test.ts`, rerun QA and the sweep.

## 10. Terms and `intake.by`

D113 allowed a clip whose stated and served terms differ when both are allowlisted, and left `intake.by` optional in
the format (the intake requires it). Tightening both is small but reverses those calls and touches the frozen clip
schema: it needs a decision.

## 11 and 12. The owner's

The proof-hash thread on #16 and D67's mirror rule are the owner's to decide; nothing changes until then.
