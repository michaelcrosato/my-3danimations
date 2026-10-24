# Handoff: every phase built; the follow-ups after G10 built (F.1 to F.14); the next goal written (2026-10-24)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 passed on run 2 on
michaelcrosato/my-3danimations#14 (D107); Phase 8 merged on michaelcrosato/my-3danimations#15 (G8's commands, D111);
Phase 9 on michaelcrosato/my-3danimations#16 (G9's commands passed on run 2, D115); Phase 10 on
michaelcrosato/my-3danimations#17 (G10's commands passed on run 1, D117). After it, an audit (D118, D119) on
michaelcrosato/my-3danimations#18, then the five follow-ups that need nothing from the owner, WP-F.1 to F.5 (PLAN.md
§10 "After G10", D121 to D125), on michaelcrosato/my-3danimations#20, three more, WP-F.6 to F.8 (D126 to D128),
on michaelcrosato/my-3danimations#21, and WP-F.9 (D129) on michaelcrosato/my-3danimations#22. Then D131 and the
records (michaelcrosato/my-3danimations#23, #24), WP-F.11 (D132, #25), G8's pass (D133, #26), and the owner's asks
after it: WP-F.12 (D134, #27), F.13 (D135, #28) and F.14 (D136, michaelcrosato/my-3danimations#29, merged as b66f248),
then the records after it (#30, 8c88b42, main's head). On 2026-10-24 a session checked the environment (everything
the work needs is here, and the Supabase connector is now connected), corrected the records and wrote the next goal
below (D137). This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. That holds: what is left is the owner's, or new work the owner
picks from the follow-ups below. Ultracode mode (PLAN.md §11, D83): implementers in lanes, the main
session integrates shared files, DECISIONS and merges, and runs every gate in the main checkout; at most 3 lanes,
none during trial batches.

## The next goal (2026-10-24, D137)

Everything the session can still do, as one goal for the owner to start (`/goal`, then this text):

```
Finish my-3danimations per docs/HANDOFF.md "The next goal", by AGENTS.md's rules, through draft PRs each merged
green: (1) O8's steps 1-2 through the Supabase connector (D137); (2) one WP each for Swim_Idle_Loop under its floor,
`describe` naming turns and bends, the engine sheet, the encoder's steady rounding (D135) and T1's headroom; (3) B1's
floor with G7's B1 evidence re-run (~$12); (4) the owner's next review batch on the site. Done when each is done or
blocked-owner with its exact ask posted, the ledger, PROGRESS, HANDOFF and DECISIONS agree, and CI is green on main.
```

What each item means and when it is done:

1. **O8's steps 1 and 2** (`services/intake/README.md`, D130, D137): `create_project` on the free plan in the one
   organization D137 names (a nonzero quote waits for the owner), `apply_migration` with `migrations/`,
   `deploy_edge_function` `submit` with `verify_jwt` off. Done when the tables and their row-level security are there
   (`list_tables`, `get_advisors` answered), the function refuses a submission without a key, the README records the
   project's ref and URL, and the PR asks the owner for steps 3 to 6 with the project's own values filled in (the
   OAuth callback, the contributor page's redirect URL, the secrets' names). G9 stays blocked-owner on those, the
   contract run, an adoption by a merged PR and the 70% approval.
2. **The five follow-ups no decision deferred** (below), each a WP of its own in PLAN.md §10 "After G10" (the template,
   Verify, a ledger row, a version and changelog lines):
   - Swim_Idle_Loop's body under its floor (D136): done when `apps/gallery/src/playback.test.ts` no longer names it
     (it agrees with its data on every test character), or a decision answers it with numbers.
   - `describe` names a turn and a bend (Pick_Up_Basket reads "walks; stands"): done when the turn's side and size and
     the bend are in its text within its token bound, its truth clips still read right.
   - The engine sheet (D136, the owner's idea): the gallery's character drawn at the sheet's moments beside the sheet,
     the data comparison's numbers under each frame, from a tool (principle 2), images to `check-output/`.
   - The encoder's steady rounding of the hips, chest and head (D135's follow-up): done when the idles it names move
     no further than their capture, measured as D135 measured them, the sets re-imported byte for byte, the frozen
     spec untouched.
   - T1's headroom (Last measured): the slowest files made faster, never the budget raised, until T1 sits well under
     90 s here and in CI.
3. **B1's floor** (D123, D131): B1's grader reads heights from the body's measured floor, then G7's B1 known-goods and
   variants run again with real agents (about $12, 1.5 hours), the result logged. The owner's last goal kept it
   deferred until their go (#24): this goal, started as written, is that go; without item 3 it stays deferred.
4. **The owner's next review batch:** `npx m3a review export` (the unreviewed and stale clips: Jump_Twist cut again,
   the idles whose reviews were dropped, and Pick_Up_Basket and Wrench_Bolt to look at again), committed as a batch
   the site carries (D132), its link posted for the owner.
5. **The owner's, asked once each with exactly what is needed, never done for them:** the verdict on Pick_Up_Basket
   in their words; the batch's review; O8's steps 3 to 6; G9's approval and adoption; G10's confirmation (O9, "wait");
   O2's publish steps on the latest tag (below).

Left as they are, each with its reason: the follow-ups D131 deferred or kept (the five contact-less loops, a linear
planter and key fit, the adopt bot's monopoly, a gate over the whole rate sweep, the mirror census, D129's calls),
MIGRATING's gaps (with G10, O9), an AI visual pre-screen (the owner's call, D136), and the on-demand WPs (PLAN.md §10:
none of their triggers has fired). Add `ultracode` to the goal to run its WPs in lanes (D83).

## Where things stand

- **Version 0.60.0.** Every WP through 10.2 and F.1 to F.14 is done; G0-G8 passed; G9 and G10's command sets passed
  and each waits on the owner (blocked-owner, its ask on its PR):
  - **G8** (#15): **passed** on 2026-10-22 (D133): the owner's review of G8-run-1's `queue-0.56.0.json` on the
    site's review page, applied with `npx m3a review ingest` (20 decisions, 18 approved, 2 flagged); its notes are
    FEEDBACK-LOG F7, its two task proposals REVIEW-PROPOSALS. It found 74 of 98 STYLE100 idles frozen, Jump_Twist cut
    before its jump and names that mislead an agent: WP-F.12 (D134, the page's guide and each card's "What it should
    show") and WP-F.13 (D135: frozen clips 102 → 17, each fit bounded by the clip's own motion, steady knees, recipes
    keeping the sway, a still check in QA and the intake, Jump_Twist cut again) are done.
  - **G9** (#16): the contract suite against O8's project; an adoption through a merged PR; the owner's approval of
    70% of `bench/results/gates/G9-run-2/queue.json`. O8's setup is `services/intake/README.md`: the Supabase project,
    the Actions secrets `M3A_SUPABASE_URL` and `M3A_SUPABASE_SERVICE_ROLE_KEY` (intake.yml) and `M3A_INTAKE_SUPABASE`
    (ci.yml's `intake-contract`, dispatched with that gate), and "Allow GitHub Actions to create and approve pull
    requests". The owner said yes to the session creating the project (D130), and on 2026-10-24 the Supabase
    connector is connected (D137: one organization on the free plan, through Vercel's marketplace, no m3a project
    yet), so the next session creates it and runs the README's steps 1 and 2 through the connector (the next goal's
    item 1); the OAuth app, the first sign-in, the secrets and the Actions setting stay the owner's.
  - **G10** (#17): another repository consumes the package or certifies against the vectors, and the owner confirms
    it (O9: proposed in docs/MIGRATING.md and spec/conformance/CERTIFYING.md, never acted on there).
  - **O2 answered (D130): publish now under `@m3a/*`.** The session built `publish.yml` (WP-F.10) and never publishes;
    the owner's steps, each as `michaelcrosato` (`tools/bundle/README.md`, "Publishing"): the npm organization `m3a`;
    a granular token ("Read and write (publish and stage)" on `@m3a` alone, Bypass 2FA, 90 days at most); the
    environment `npm` (the owner its required reviewer, Prevent self-review off, administrators' bypass off,
    deployment from `v*` tags alone, the token as its secret `NPM_TOKEN`, never a repository secret); the variable
    `M3A_O2_PUBLISH=yes`; a tag ruleset `release tags` on `v*` (restrict creations, updates and deletions; only the
    repository admin bypasses); the latest release's tag, now `v0.60.0` on #29's merge commit b66f248 (D131 named
    `v0.56.0` on e766496 when it was the latest; any `vX.Y.Z` on main whose packages are at X.Y.Z publishes), made by
    the owner (the session's git connection refuses tag pushes, D131); Actions, publish, Run workflow with "Use
    workflow from: Tags → v0.60.0" and `v0.60.0` as the tag; the publish job approved (Review deployments → npm).
    Before January 2027 (npm stops taking `npm publish` with a granular token): each package's trusted publisher, `npm
    publish` ticked under Allowed actions. For the sets as release assets: the variable `M3A_O2_RELEASE_ASSETS=yes`,
    release.yml run on the same tag, the draft release published. **O3 unpaused** by the owner (D130): the site is live at
    https://my-3danimations-ten.vercel.app (the review page at `/src/review/`), redeployed on every merge to main
    (b66f248 was live within minutes), and each push's preview builds again (#29's: Ready).
- **The owner's asks after G8, each a WP of its own:** F.11 (#25, D132): each review card plays its clip in place,
  links it in the gallery, and the page opens G8's batch at load. F.12 and F.13 above. F.14 (#29, D136): reviewing
  CMU_CURATED/Pick_Up_Basket in chat, the owner saw it "do a 360 and then walk backwards"; their experiment (gen-1
  painted as the sheets' mannequin, captured at the sheet's 12 moments from its view) showed the gallery turning the
  character by the root's heading on top of the turn its pose already carries. One rule now: a pose carries its clips'
  turn, a root places it, and core's `AnimatorPose.turn` is what the root has turned beyond it (attach writes it;
  `Animator.place` is new); the raster and `graph.sim` follow it. `apps/gallery/src/playback.test.ts` compares what
  the gallery plays with each clip's data (facing, travel's direction, limbs): 55 clips off by up to 179° on gen-1
  before, 0 of 1,398 after. The test characters are painted (left side blue, the back darker, a red nose; a legend
  beside the gallery's stage). After the merge, the live gallery captured at the sheet's moments matched the sheet in
  both views (three-quarter, top).
- **The in-chat review, open:** CMU_CURATED/Pick_Up_Basket@04c9a32eadf4 on the fixed gallery: it walks forward about
  2.5 m, bends to the basket, turns about 190° to its right, walks forward back toward its start and bends again; its
  description is "Walks up to a laundry basket and picks it up" (no turn, no walk back). The owner's verdict is
  pending: record it in their words alone (`npx m3a review approve|flag CMU_CURATED/Pick_Up_Basket@04c9a32eadf4
  --note "<their words>"`). Their G8 review of it (approved, FEEDBACK-LOG F7.9) stands until they remake it.
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
- **Last measured (4 CPUs here; GitHub's runners):** on main's head 8c88b42 in a fresh container (2026-10-24, D137):
  T0 19.5 s cold (over 15 s on cold caches only), T1 88.4 s (1,343 passed, budget 90: the headroom follow-up), T2
  337.1 s (Playwright 39 passed in 167.0 s, QA 11.1, the sweeps 132.2, the rate sample 26.7, 0 rows unbaselined).
  F.14 on 57b61b9 here: T1 68.7 s (1,344 passed), T2 277.6 s
  (Playwright 39 passed, the sweeps 137 tests); CI on #29's head 47ed20e, all green: T0 7.9 s, T1 108.8 s, T2 289.9 s
  (playwright 148.4, QA 5.8, the sweeps 116.1, the rate sample 19.6), the `rates` job about 2 minutes. CI's T1 swings
  with the runner for the same tests: its step took 58 s on main after #29's merge and 106 s after #28's; over 90 s it
  warns, at 135 s (1.5×) it fails (follow-ups). Before: T2 300.4 s here at e766496 (0.56.0); T0 about 3 s warm;
  `pack --check` about 21 to 33 s.

## Next, in order

0. The next goal (above), once the owner starts it; items 2 and 3 below are its items 4 and 3.
1. Whatever the owner sends back: their verdict on Pick_Up_Basket (above), a review file (`npx m3a review ingest
   <file>`, its notes into docs/FEEDBACK-LOG.md and a threshold or task proposal into docs/REVIEW-PROPOSALS.md), O8
   linked (the contract run, the first adoption by the bot), another repository's use confirmed (G10).
2. The owner's next review batch: `npx m3a review export` samples the unreviewed and stale clips, among them Jump_Twist
   (cut again) and the three idles whose reviews were dropped with their old motion; D135 lists what to look at (the
   feet that follow the hips' rounding, the few idles under 0.8 of their capture's sway). D135's follow-up: a steady
   rounding of the hips, chest and head in the encoder, measured the same way. Also to look at again (D136): G8's
   CMU_CURATED/Pick_Up_Basket and Wrench_Bolt were reviewed on a page that showed their turn twice (WP-F.14 fixed it);
   their reviews stand (the motion is the same), the owner's to keep or remake.
3. B1's floor stays deferred, with its reason: reading B1's feet from the body's measured floor changes G7's evidence
   (its known-goods and variants), so it waits for the owner's go, which starting the next goal as written gives
   (D137). When it comes (D131's call is to fix it): a WP of its own, then G7's B1 evidence run again (about $12 and
   1.5 hours of real agents), its result logged.
4. The other follow-ups below stay as D131 calls them (deferred or kept, each with its reason) until the owner says
   otherwise.

## Follow-ups recorded, owned by no WP yet

- A body under its floor (D136): QUATERNIUS_SHARDFALL/Swim_Idle_Loop ("treading water", its hips 36 to 47% of H0 under
  the floor, the water's surface) plays far from its data in the engine (its limbs 93 to 102° off on every test
  character) and the gallery's solid floor hides it. `apps/gallery/src/playback.test.ts` names it; when fixed, that
  entry goes (the test fails while it is named and no longer parts from its data).
- An AI visual pre-screen of every clip (D136): considered, not built (the owner's call): only if the data comparison
  misses what a reviewer sees.
- `describe` reports no turn and no bend (CMU_CURATED/Pick_Up_Basket: "walks; stands" for a walk, a pick-up, a half
  turn, a walk back and a set-down): the text an agent reads should say both.
- An engine sheet: the gallery's character drawn at the sheet's moments beside the sheet, the comparison's numbers under
  each frame (the owner's idea, D136), for a reviewer or a failing comparison. Until then it is done by hand: the
  gallery's `window.__m3a` (`seek`, `pause`, `state`) driven by Playwright at `?char=gen-1&clip=<id>&view=<view>`,
  each canvas captured at the sheet's times, set beside `npx m3a sheet --clip <id> --frames 12 --view <view>`.
- CI's T1 near its budget (Last measured): 58 to 109 s on GitHub's runners for the same tests (79.1 s after F.5, D125;
  1,343 passing in CI now). A run at 135 s fails: before then, the slowest files made faster (PLAN.md §6), not the budget
  raised.

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
- Vercel project prj_G6lMChE61OFf2aXCRijeSQWkAAEq is linked and unpaused (D130): production is
  https://my-3danimations-ten.vercel.app, redeployed on each merge to main; previews have SSO on (the owner's
  sign-in). Supabase: the connector is connected from 2026-10-24 (D137): one organization, "michaelcrosato-1122's
  projects", on the free plan through Vercel's marketplace, holding `bmbptv-records` (not m3a's: never touch it) and
  no m3a project yet; the owner's yes to create one (D130) holds. No Supabase CLI or Deno here: the connector's
  `create_project`, `apply_migration` and `deploy_edge_function` do steps 1 and 2. Actions: the GitHub MCP tools read
  runs, jobs and logs (a job's `logs_url` downloads with curl); other Actions calls returned 403 before. No Docker: the
  supabase backend can be tested against local Postgres 16 (`/usr/lib/postgresql/16/bin`) with a stubbed
  `auth.uid()`.
- What the owner sees on a page is evidence (D136): before answering that a clip doesn't do what they saw, put the
  page beside the data. The sheet (`npx m3a sheet`, about 540 tokens a picture at 1000×404) draws the keys alone; the
  painted gen-1 captured at the sheet's moments and view shows what the engine plays. The unpainted mannequin read the
  same from the front and the back, and the session wrongly told the owner they saw it wrong; the paint, then
  `apps/gallery/src/playback.test.ts`, settled it.
- Playwright's clock: a hold (`pauseAt`) of a flowing clock can leave the page's next frame due past the clock's now,
  so a `runFor` then runs no frames (#30's T2: the gallery's rate 1 moved 0 s after holding twice). Hold, then
  `runFor(16)` until the page's loop shows a frame, before measuring; the review and gallery e2e both do now.
- Worktrees, where the classifier allows them: link the main checkout's `.cache/src` into the worktree or the library
  sweeps fail; the intake's SQL test can't start Postgres from under /tmp/claude-0 (permissions): run it in the main
  checkout.
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
  still race the install, and `/mcp` reconnects it (2026-10-24 it did race; started by hand after, it served its 22
  tools).
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
