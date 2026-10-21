# Handoff: every phase built; the follow-ups after G10 built (F.1 to F.5); the owner's steps open (2026-10-21)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 passed on run 2 on
michaelcrosato/my-3danimations#14 (D107); Phase 8 merged on michaelcrosato/my-3danimations#15 (G8's commands, D111);
Phase 9 on michaelcrosato/my-3danimations#16 (G9's commands passed on run 2, D115); Phase 10 on
michaelcrosato/my-3danimations#17 (G10's commands passed on run 1, D117). After it, an audit (D118, D119) on
michaelcrosato/my-3danimations#18, then the five follow-ups that need nothing from the owner, WP-F.1 to F.5 (PLAN.md
§10 "After G10", D121 to D125), on michaelcrosato/my-3danimations#20. This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. That holds: what is left is the owner's, or new work the owner
picks from the follow-ups below. Ultracode mode (PLAN.md §11, D83): implementers in lanes, the main
session integrates shared files, DECISIONS and merges, and runs every gate in the main checkout; at most 3 lanes,
none during trial batches.

## Where things stand

- **Version 0.55.1.** Every WP through 10.2 and F.1 to F.5 is done; G0-G7 passed; G8, G9 and G10's command sets passed
  and each waits on the owner (blocked-owner, its ask on its PR):
  - **G8** (#15): the phone review of `bench/results/gates/G8-run-1/queue.json`.
  - **G9** (#16): the contract suite against O8's project; an adoption through a merged PR; the owner's approval of
    70% of `bench/results/gates/G9-run-2/queue.json`. O8's setup is `services/intake/README.md`: the Supabase project,
    the Actions secrets `M3A_SUPABASE_URL` and `M3A_SUPABASE_SERVICE_ROLE_KEY` (intake.yml) and `M3A_INTAKE_SUPABASE`
    (ci.yml's `intake-contract`, dispatched with that gate), and "Allow GitHub Actions to create and approve pull
    requests".
  - **G10** (#17): another repository consumes the package or certifies against the vectors, and the owner confirms
    it (O9: proposed in docs/MIGRATING.md and spec/conformance/CERTIFYING.md, never acted on there).
  - O3 (the Vercel previews, paused, D85) and O2 (publishing: release.yml waits for the repository variable
    `M3A_O2_RELEASE_ASSETS=yes`) are the owner's; the session creates no Supabase or Vercel resource.
- **The follow-ups built (#20, 2026-10-21, the owner's pick):** the m3a bin refuses a Node without `import.meta.main`
  and the hook no longer deletes node_modules under the MCP server (F.1, D121); `STYLE100_RUN/OnHeels_Run` planted by
  its whole sole, the other five `unplanted` loops answered with numbers (F.2, D122); the root-motion rate sweep,
  479 of 24,330 rows baselined (F.3, D123); the manual teaches `LibraryError` and gap 10's six names, 7,998 of 8,000
  (F.4, D124); T1's files share their worker's modules, CI's T1 79.1 s from 126.1 (F.5, D125). The briefs re-run with
  real agents after F.2 and F.4 (`bench/results/2026-10-21-*`): B1 5/5 (discovery 2/2), B2 to B7 5/5 each,
  B8 5/5, its G9 variant 5/5, B8-ten 1/1; G7's variants running.
- **Review bots:** every finding on #14 to #18 is fixed or answered on its thread (D115, D117, D120); #20's: none yet.
- **Last measured (4 CPUs):** T0 about 3 s warm, T1 88 s here (79.1 s in CI), T2 400 s with the full sweeps and the
  rate sweep (budget 480: the next sweep added goes to its own step or a sample), the rate sweep alone 80 to 92 s,
  `pack --check` about 21 to 33 s.

## Next, in order

1. Whatever the owner sends back: a review file (`npx m3a review ingest <file>`, its notes into
   docs/FEEDBACK-LOG.md and a threshold or task proposal into docs/REVIEW-PROPOSALS.md), O8 linked (the contract run,
   the first adoption by the bot), another repository's use confirmed (G10).
2. The follow-ups below, each a WP of its own when the owner picks it.

## Follow-ups recorded, owned by no WP yet

- B1's floor (D123): B1's grader reads heights from y = 0, which stands 16 to 44 mm above a generated test character's
  soles (`bench/graders/bones.ts` `bodyOf`), so a foot within 40 to 86 mm of its floor reads as down; D106's "keyed
  runs skim" were that floor and Run_Female's walk-to-run fade, not the loops (the rate sweep passes them). Reading
  from the body's measured floor changes G7's evidence (B1's known-goods and variants): a decision of its own.
- The rate sweep's 479 failing rows (`library/baselines/rates.json`, D123): each a loop that slides or skates at a rate
  on a body (slow rates on slide, fast on skate; STYLE100's 411 of them). A row fixed or answered shrinks it. The
  adopt bot doesn't regenerate it: an adopted locomotion loop that fails a row fails T2 until baselined or fixed.
- The five loops still without contacts (D122): `WideLegs_Walk` (both feet slide outward), `Drunk_RunBack` (its feet
  never leave the floor), `Boxing_Guard_Loop` (skims between stances), `Run_Anime` and `Run_Stealth` (a still root
  under sweeping feet). No reading the planter holds exists; a contact that moves with the foot (a slide the planter
  follows) would be a new kind of contact, the spec's call.
- Manual: gap 10's last names (`@m3a/three/test-characters`' `character`, `variant`, `loadGlb` in a browser) and gap
  1's page loader (`directory`, `defaultSets`, `new Library(source)`), at 7,998 of 8,000 tokens (D124).
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
  Writes act as the owner's login (michaelcrosato): every session comment opens with `<!-- m3a-session -->`, owner
  evidence (phone notes, approvals, adoptions) is never authored by the session, and no review is approved by it.
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
- Never push to my-3dge or shardfall (O9); never publish (O2, D99); Claude models only (O10).
