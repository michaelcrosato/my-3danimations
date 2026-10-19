# Handoff: G7 passed; Phase 8 next (2026-10-19)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 then ran on
michaelcrosato/my-3danimations#14 after the library's contact-less loops were fixed (D104, D108) and passed on run 2
(D107). Phase 8's lanes (and Phase 10's) were built during it. This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. Ultracode mode (PLAN.md §11, D83): implementers in worktree lanes
(`.claude/worktrees/lane-*`, each with its own `.cache` symlinking only `src` and `fixtures`), the main session
integrates shared files, DECISIONS and merges, and runs every gate in the main checkout. Push every 30-60 minutes, at
most 3 lanes, none during trial batches. After each gate's squash merge (CI green), restart the branch from
`origin/main` and open the next draft PR. G8-G10 have owner steps; such a gate still merges (§8.5).

## Where things stand

- **Version 0.50.2.** Done: Phases 0-7 and their gates. **G7 = M2 passed on run 2** (D107) at 5d1ec8f, 24 of 24 in
  93.0 min (`bench/results/gates/G7-run-2/`); run 1 at 1623b78 failed 23 of 24 on B1's variant (D106,
  `bench/results/gates/G7-run-1/`). Its two verifier lenses' findings are fixed or answered: D108 (D104's contact
  fallbacks narrowed to contacts the planter holds: 5 of the 11 loops keep theirs, 6 are answered in `qa.json`
  `unplanted`; D104's and D106's misstatements corrected), the packs' changelog without the benchmark's lines, and
  `retarget.apply`'s reach on a rig without chest bones. Held-out run 3 of G7 does not exist; G8's is written at G8.
- **Last measured (this machine, 4 CPUs):** T0 about 2 s warm, T1 81.4 s (987 tests), T2 about 120-135 s,
  `npm run pack -- --check` about 20 s.
- **Owner items:** D94 (benchmark credentials) for review, not blocking. O2 taken at its default (D99: publish
  nothing). Phase 8 brings O8 (the hosted intake store: a Supabase project, Actions secrets) and O3 (Vercel previews,
  the project paused: D85): asked once on Phase 8's PR, blocked-owner while the work goes on.

## Next, in order

1. **Phase 8** on a fresh draft PR from `origin/main` (PLAN.md §10): the lanes are built and waiting, each on its own
   branch in `.claude/worktrees/` (D83), to merge in this order: `lane/gallery` (WP-8.1), `lane/intake` (WP-8.2a),
   `lane/review` (WP-8.2b; it merged 8.1 and 8.2a and needs `INTAKE_DIR`, `intakeFiles` exported from
   `@m3a/tools/node`, and the queue bundled into a build only when asked), `lane/previews` (WP-8.3, on 8.1). The
   integrator adds the root scripts (`gallery`, `site`), the `intake` export, the G8 gate set in `tools/run/gate.ts`,
   the D entries, ledger rows and PROGRESS; an L-WP verifier review of 8.1 and 8.2; then G8 (the owner's phone review
   of a 20-clip batch: blocked-owner) and its merge.
2. **Phase 9** (9.1a, 9.1b, 9.2, 9.3, 9.4: lane prompts drafted in the session's scratchpad, to write again from
   PLAN.md if lost), G9; the tool descriptions' budget (2,995 of 3,000 tokens) needs a logged change for 9.1's two tools.
3. **Phase 10:** `lane/conformance` (WP-10.1) and `lane/consumer` (WP-10.2) are built on 5d1ec8f; merge them, add the
   `conformance` and `consumer-ts` scripts and G10's set; G10 (the owner's confirmation: blocked-owner; O9: propose to
   my-3dge, never act there).

## Follow-ups recorded, owned by no WP yet

- Library: the importers and the migrator rewrite whole sets, so a clip's `review` (WP-8.2) would be dropped: carry
  it over while its motion hash matches (the intake lane's note).
- Budgets: the tool descriptions at 2,995 of 3,000 tokens with `review`; WP-9.1's `library.submit` and `status` need
  room (trim, or a logged budget change).

- Sensors: a check that plays each locomotion loop with its root motion at the rates a game asks (0.5 to 2) on the
  test bodies, as B1's grader reads it: keyed runs (`MESH2MOTION/Run_Female`, `Jog`) skim on some bodies (D106).

- Core: the planter (K5) and the key fit grow faster than linearly; the tools bound them (D96). Parents in a loop
  among bones a table knows by name hang recognition's ancestor walk (D96).
- Library: a composed source license (" AND ") is read as one id by license.check (D96).
- io: non-finite heads from overflowing node transforms (D96).
- The manual is at 7,997 of 8,000 tokens: the next manual change cuts text first (F5.2).
- Library: the 6 `unplanted` loops (D108) could keep contacts where a captured speed arbitrates between readings
  (`WideLegs_Walk`'s height pass reads 0.94 of its captured speed, both feet down): a choice for `@m3a/library`'s
  measure, which knows the captured speed, not core's.
- T2 could run `npm run pack -- --check` and load `m3a.js` in Chromium (F5.3); G7 runs pack --check now.

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
- Never push to my-3dge or shardfall (O9); never publish (O2, D99); Claude models only (O10).
