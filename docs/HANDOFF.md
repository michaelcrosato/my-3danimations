# Handoff: every phase built; the follow-ups after G10 built (F.1 to F.9); the owner's steps open (2026-10-22)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 passed on run 2 on
michaelcrosato/my-3danimations#14 (D107); Phase 8 merged on michaelcrosato/my-3danimations#15 (G8's commands, D111);
Phase 9 on michaelcrosato/my-3danimations#16 (G9's commands passed on run 2, D115); Phase 10 on
michaelcrosato/my-3danimations#17 (G10's commands passed on run 1, D117). After it, an audit (D118, D119) on
michaelcrosato/my-3danimations#18, then the five follow-ups that need nothing from the owner, WP-F.1 to F.5 (PLAN.md
§10 "After G10", D121 to D125), on michaelcrosato/my-3danimations#20, three more, WP-F.6 to F.8 (D126 to D128),
on michaelcrosato/my-3danimations#21, and WP-F.9 (D129) on michaelcrosato/my-3danimations#22. This file is what the
next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. That holds: what is left is the owner's, or new work the owner
picks from the follow-ups below. Ultracode mode (PLAN.md §11, D83): implementers in lanes, the main
session integrates shared files, DECISIONS and merges, and runs every gate in the main checkout; at most 3 lanes,
none during trial batches.

## Where things stand

- **Version 0.56.0.** Every WP through 10.2 and F.1 to F.9 is done; G0-G7 passed; G8, G9 and G10's command sets passed
  and each waits on the owner (blocked-owner, its ask on its PR):
  - **G8** (#15): the phone review of `bench/results/gates/G8-run-1/queue-0.56.0.json` (the same 20 clips as
    `queue.json`, exported again at 0.56.0: one ref moved, D130). The page is a branch preview's `/src/review/` (O3 is
    live again) or `npm run gallery` on a checkout, at `/src/review/`: "Open a queue file", decide each clip, Export,
    and send the file back.
  - **G9** (#16): the contract suite against O8's project; an adoption through a merged PR; the owner's approval of
    70% of `bench/results/gates/G9-run-2/queue.json`. O8's setup is `services/intake/README.md`: the Supabase project,
    the Actions secrets `M3A_SUPABASE_URL` and `M3A_SUPABASE_SERVICE_ROLE_KEY` (intake.yml) and `M3A_INTAKE_SUPABASE`
    (ci.yml's `intake-contract`, dispatched with that gate), and "Allow GitHub Actions to create and approve pull
    requests". The owner said yes to the session creating the project (D130), but no session has the Supabase
    connector until the owner connects it (claude.ai/customize/connectors); the next session then creates it and runs
    the README's steps 1 and 2; the OAuth app, the first sign-in, the secrets and the Actions setting stay the
    owner's.
  - **G10** (#17): another repository consumes the package or certifies against the vectors, and the owner confirms
    it (O9: proposed in docs/MIGRATING.md and spec/conformance/CERTIFYING.md, never acted on there).
  - **O2 answered (D130): publish now under `@m3a/*`.** The session built `publish.yml` (WP-F.10) and never publishes;
    the owner's steps, each as `michaelcrosato` (`tools/bundle/README.md`, "Publishing"): the npm organization `m3a`;
    a granular token ("Read and write (publish and stage)" on `@m3a` alone, Bypass 2FA, 90 days at most); the
    environment `npm` (the owner its required reviewer, Prevent self-review off, administrators' bypass off,
    deployment from `v*` tags alone, the token as its secret `NPM_TOKEN`, never a repository secret); the variable
    `M3A_O2_PUBLISH=yes`; a tag ruleset `release tags` on `v*` (restrict creations, updates and deletions; only the
    repository admin bypasses); the tag `v0.56.0` on #22's merge commit e766496, made by the owner (the session's git
    connection refuses tag pushes, D131); Actions, publish, Run workflow with "Use workflow from: Tags → v0.56.0" and
    `v0.56.0` as the tag; the publish job approved (Review deployments → npm). Before January 2027 (npm stops taking
    `npm publish` with a granular token): each package's trusted publisher, `npm publish` ticked under Allowed
    actions. For the sets as release assets: the variable `M3A_O2_RELEASE_ASSETS=yes`, release.yml run on the same tag,
    the draft release published. **O3 unpaused** by the owner (D130): 2f973fa's preview built; Vercel blocked each
    later commit before its build (on its side: the owner allows them from the deployment's page).
- **The follow-ups built (#20, 2026-10-21, the owner's pick):** the m3a bin refuses a Node without `import.meta.main`
  and the hook no longer deletes node_modules under the MCP server (F.1, D121); `STYLE100_RUN/OnHeels_Run` planted by
  its whole sole, the other five `unplanted` loops answered with numbers (F.2, D122); the root-motion rate sweep,
  479 of 24,330 rows baselined (F.3, D123); the manual teaches `LibraryError` and gap 10's six names, 7,998 of 8,000
  (F.4, D124); T1's files share their worker's modules, CI's T1 79.1 s from 126.1 (F.5, D125). The briefs re-run with
  real agents after F.2 and F.4 (`bench/results/2026-10-21-*`): B1 5/5 (discovery 2/2), B2 to B7 5/5 each,
  every G7 held-out variant 5/5, B8 5/5, its G9 variant 5/5, B8-ten 1/1: 83 of 83 trials, $13.36.
- **The next three (#21, 2026-10-22, the owner's pick, built by a workflow: two lanes, each WP reviewed by two
  adversarial reviewers and fixed):** T2 under its budget: Playwright on four workers, T2 sweeping two of the rate
  sweep's bodies and ci.yml's `rates` job all six on every pull request (F.6, D126); the rate rows triaged, two loops
  read again in core (held within 10% of H0, retimed too), 473 rows on 126 loops, each loop answered with one of 7
  causes (F.7, D127); the manual teaches the test characters, `loadGlb` in a page and the attached player's `apply()`,
  7,999 of 8,000 (F.8, D128). The briefs re-run with real agents after F.7 and F.8
  (`bench/results/2026-10-22-*`): B1 4/5 (discovery 2/2), B2 to B6 5/5, B7 4/5; G7's variants B1 4/5, B6 4/5, the rest 5/5; B8 5/5, its G9 variant 5/5, B8-ten 1/1: 79 of 83 trials, $13.82; two of the four misses are B1's floor.
- **F.9 (#22, 2026-10-22, the goal's "fix through the writer what the contacts can fix"):** the 126 failing loops read
  by a rule written before the sweep was read (`tools/facts/readings.ts`: core's twelve named readings held to D108's
  bar at five speeds, the one nearest the captured speed), 57 another reading, then vetoed by the sweep, the judge and
  QA: 45 adopted, written by the importer `labelled` and named in `facts.reading`; spec §7.1 and §7.3 amended
  compatibly and refrozen (D129, made without the owner's answer: reversible by reverting its commit; dropping the names
  in `tools/import/sets.ts` and re-importing the 7 sets reverts only the clips, and `rates.json`'s answers come back
  from 0.55.3). 473 → 428 failing rows (0 added), 108 loops answered; the judge
  one fail gone, none added; QA 1,015 / 229 / 154. No clip a brief's agent picks moved, so no brief re-ran.
- **Review bots:** every finding on #14 to #18 is fixed or answered on its thread (D115, D117, D120); on #20 Codex didn't review:
  its connector answers the PR's account (michaelcrosatoDM) with "create a Codex account", so only the owner's
  `@codex review` runs it; an independent reviewer's four findings were fixed in 5c348a8 (D121, D123). On #21 each
  WP's two reviewers' findings were fixed before the PR (D126 to D128); Codex again doesn't serve its account.
- **Last measured (4 CPUs):** on main at e766496 (0.56.0, #22): T2 300.4 s here (playwright 146.0, QA 11.0, the
  sweeps 115.0, the rate sample 28.4), all of #22's CI green (T2, the `rates` job, T0/T1); before it: T0 about 3 s warm; T1 63.6 s here (79.1 s in CI on #20); T2 239.8 s here (playwright
  111.6, QA 9.2, the sweeps 96.8, the rate sample 22.2) and 246.2 s in CI on #21 (from 525.2 on #20; playwright
  128.2, QA 5.8, the sweeps 92.5, the rate sample 19.7), its budget 480; CI's `rates` job, the whole rate sweep, 109.0 s,
  done before T2; `pack --check` about 21 to 33 s.

## Next, in order

1. Whatever the owner sends back: a review file (`npx m3a review ingest <file>`, its notes into
   docs/FEEDBACK-LOG.md and a threshold or task proposal into docs/REVIEW-PROPOSALS.md), O8 linked (the contract run,
   the first adoption by the bot), another repository's use confirmed (G10).
2. B1's floor, the session's call under D131: a WP of its own (B1's grader reads feet from the body's measured floor),
   then G7's B1 evidence run again (about $12 and 1.5 hours of real agents), its result logged.
3. The other follow-ups below stay as D131 calls them (deferred or kept, each with its reason) until the owner says
   otherwise.

## Follow-ups recorded, owned by no WP yet

- B1's floor (D123): B1's grader reads heights from y = 0, which stands 16 to 44 mm above a generated test character's
  soles (`bench/graders/bones.ts` `bodyOf`), so a foot within 40 to 86 mm of its floor reads as down; D106's "keyed
  runs skim" were that floor and Run_Female's walk-to-run fade, not the loops (the rate sweep passes them). Reading
  from the body's measured floor changes G7's evidence (B1's known-goods and variants): a decision of its own.
- The rate sweep's 428 failing rows on 108 loops, each loop answered with its cause in `library/baselines/rates.json`
  (D127, D129). D129's three calls are the owner's, each reversible: the spec's amendment (`labelled` covering a named
  reading, `facts.reading`), the six readings new to core (31 of the 45), and the bar ("no failing row added"; "no
  still-failing row reads worse" would adopt 25). The 12 readings the veto turned down are named in D129; 53 of the 84 rows
  the 45 still fail read further past their fail level. A retimed `STYLE100/Rushed_Walk` (×1.5, ×2) reads a contact
  the planter pulls 12.2% of H0 on every reading, answered there.
  The adopt bot doesn't regenerate the baseline: an adopted locomotion loop that fails a row fails the `rates` job
  until baselined or fixed, and must carry an answer.
- Gates and the rate sweep (D126): a gate's T2 step now holds the two-body sample (8,110 of 24,330 rows); every row
  runs in ci.yml's `rates` job on every pull request. A gate whose proof should hold every row adds
  `["the rate sweep in full", "sweep", "--rates", "--check"]` to its set in PLAN.md §9.3: the owner's call.
- The five loops still without contacts (D122): `WideLegs_Walk` (both feet slide outward), `Drunk_RunBack` (its feet
  never leave the floor), `Boxing_Guard_Loop` (skims between stances), `Run_Anime` and `Run_Stealth` (a still root
  under sweeping feet). No reading the planter holds exists; a contact that moves with the foot (a slide the planter
  follows) would be a new kind of contact, the spec's call.
- Manual: gap 1's page loader (`directory`, `defaultSets`, `new Library(source)`) and the types the consumer lab names
  (left to the compiler) are all MIGRATING still lists; the manual is at 7,999 of 8,000 tokens (D128).
- Intake: refusing every clip added outside the adopt bot (§8.4 after G9). D113's call stands until the importers'
  and procedural sets' regenerations go through the bot; then `gatesOf` refuses an added clip without intake
  provenance (a fixture planting a clean clip into an existing set proves it).
- Core: a linear planter (K5) and key fit (D96; the tools bound them). Both change outputs bit for bit, so the frozen
  vectors, the A/B hashes and the cross-engine checks are re-baselined by a decision; other implementations certify
  against those vectors (G10's route), so it waits for one.
- Index: each regeneration before a commit mints a version (D113 accepts it); a namespace's proof vouches by content
  id, not digest, and the owner kept it so (D120).
- Library: the census counts a motion and its mirror apart by design (D67: a game needs each side), while WP-9.3's
  dedup reads Mesh2Motion's `Dodge_left`/`Dodge_right` as one motion mirrored; counting them once reverses D67, the
  owner's call.
- shardfall's tier 1b waits on its glTF reader's Rigify look (CERTIFYING.md, D116; O9: a proposal).

## Rules learned the hard way

- Decision text and review findings go into tracked files at once, never the scratchpad (the first pause lost b0's
  decision and retarget's round-2 findings). On the first usage-limit error: WIP-commit and merge every lane, push,
  update this file, stop.
- GitHub: `gh pr` and GraphQL return 403 here; use the GitHub MCP tools or `gh api` REST. git push works. Squash merges
  only, and the head branch is deleted on merge; `main` is unprotected, so "merge only when green" is ours to keep.
  Writes act as an owner's login (michaelcrosato to #19, michaelcrosatoDM on #20, which Codex's review bot doesn't
  serve): every session comment opens with `<!-- m3a-session -->`, owner evidence (phone notes, approvals, adoptions)
  is never authored by the session, and no review is approved by it.
- Vercel project prj_G6lMChE61OFf2aXCRijeSQWkAAEq is linked and paused (D85), SSO on: "Deployment was blocked" is
  expected. Supabase: the connector works, no project for m3a exists; never create one without the owner's explicit
  yes. The Actions API is blocked (403). No Docker: the supabase backend can be tested against local Postgres 16
  (`/usr/lib/postgresql/16/bin`) with a stubbed `auth.uid()`.
- `npm run bench` writes into the tracked `bench/results/`: commit gate and Verify records on purpose, move stray
  probes out by name (a glob once moved committed files: restore with `git checkout -- bench/results/`).
- Time T0 and T1 with no lane testing; 4 CPUs make local timings load-sensitive. A fresh container's first
  `npm run check` can fail T0 on time alone (cold type-check and lint caches): run it again before calling it a
  regression.
- Two lanes can meet at a merge (the bin moved to `dist/` in one, the skill calling `npx m3a` in another): run T1 on
  the merged head before pushing.
- In this container the auto-mode classifier may refuse `git worktree add` and deleting local branches: lanes can
  share the main checkout on disjoint files, without committing, the integrator committing after T0 and T1 (D118;
  three lanes so again for F.2 to F.4, each writing its record to an untracked docs/lane-F<n>.md).
- The m3a MCP server's CONNECTION_CLOSED was the hook's `npm ci` deleting node_modules as the server started, not the
  container's Node 22 (D121): the hook now skips a current install; on a fresh container's first start the server may
  still race the install, and `/mcp` reconnects it.
- Generated clips carry the package version (`facts.by`, the producer's), so a version bump changes their bytes and
  every id hashed from them: a test or a reply must never depend on hash order (`library status` did, D125).
- T1 shares modules between files (D125): a test that mocks a module does it with `vi.doMock` inside the test and
  `vi.doUnmock` plus `vi.resetModules` after; a test that sets process state puts it back. Check a change with the
  files shuffled (`npx vitest run --sequence.shuffle.files --sequence.seed=<n>`), not the tests: some files run their
  tests in order on purpose.
- Never push to my-3dge or shardfall (O9); never publish (O2 answered: the owner starts `publish.yml`, D130); Claude
  models only (O10).
- The session's git connection pushes this session's branch alone: a tag push is cut off ("unexpected disconnect").
  Release tags are the owner's to make (and the `v*` ruleset makes them the owner's alone, D130, D131).
- The owner's standing rule (D131): a minor decision, or one the owner doesn't answer, is the session's, made forward
  by the North Star and logged; the owner's evidence (reviews, approvals, adoptions) and what reaches outside the
  repository stay the owner's.
