# Handoff: G8's commands passed; Phase 9 next (2026-10-19)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 then ran on
michaelcrosato/my-3danimations#14 after the library's contact-less loops were fixed (D104, D108) and passed on run 2
(D107); Phase 8 was built in lanes during it and merged on michaelcrosato/my-3danimations#15 with G8's commands
passed (D111). This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. Ultracode mode (PLAN.md §11, D83): implementers in worktree lanes
(`.claude/worktrees/lane-*`, each with its own `.cache` symlinking only `src` and `fixtures`), the main session
integrates shared files, DECISIONS and merges, and runs every gate in the main checkout. Push every 30-60 minutes, at
most 3 lanes, none during trial batches. After each gate's squash merge (CI green), restart the branch from
`origin/main` and open the next draft PR. G8-G10 have owner steps; such a gate still merges (§8.5).

## Where things stand

- **Version 0.51.0.** Done: Phases 0-8. G7 = M2 passed on run 2 (D107, D108). **G8's command set passed** (run 1,
  D111, `bench/results/gates/G8-run-1/`); its open item is the owner's phone review of the 20-clip batch there
  (`queue.json`), blocked-owner, asked on michaelcrosato/my-3danimations#15 with O8's and O3's steps.
- **Phase 9 lanes** (branches, worktrees in `.claude/worktrees/`, D83): `lane/submit` WP-9.1a done (5 commits; its
  shared-file patch in the session's scratchpad, `wp-9.1a-integrator.patch`: the `intake` script, the `library-pr` gate
  set with `--fixture`, the registry's `contributor()`, the `library` tool's group; the tools reach 3,130 of 3,000
  tokens and the manual 8,016 of 8,000 with its line, both a logged change for Phase 9); `lane/dedup` WP-9.3 done (2
  commits; its exports and the checker's wiring listed in its report: `DedupIndex.check`, `Lineage.byContent`);
  `lane/sources` WP-9.2 building. Still to write: WP-9.1b (B8, the manual's grow section), WP-9.4 (the index).
- **Phase 10 lanes:** `lane/conformance` (WP-10.1's kit, `npm run conformance`) and `lane/consumer` (WP-10.2, the
  consumer-ts lab and docs/MIGRATING.md) are built on 5d1ec8f, to merge with Phase 10.
- **Last measured (4 CPUs, lanes beside it):** T0 about 5-8 s, T1 90-104 s (the budget 90, fail at 135), T2 about
  200 s with the gallery, `pack --check` about 20 s.

## Next, in order

1. **Phase 9** on a fresh draft PR from `origin/main` after #15 merges: cherry-pick the lane commits (the lanes are
   on older bases; cherry-picks apply clean, merges would drag the pre-squash history), apply 9.1a's patch, wire 9.3
   into the checker, run the lanes for 9.1b and 9.4, settle the tool and manual budgets by a logged decision, G9's set
   (B8 and its held-out variant, ten clips through the intake, the planted bad ones bounced, the index verifying every
   set; the hosted run, the adoption by a merged PR and the owner's 70% approval are blocked-owner), G9.
2. **Phase 10:** merge the two lanes, the `conformance` and `consumer-ts` scripts, G10's set; G10 (the owner's
   confirmation: blocked-owner; O9: propose to my-3dge, never act there).

## Follow-ups recorded, owned by no WP yet

- Tools: the CLI and MCP can't name a generated `gen-<seed>` character, which the gallery plays (a character resolver
  for `gen-<seed>`), nor an arbitrary orbit (only `raster.turntable`) (D109, the Phase 8 verifier).
- Spec: the recipe schema and validator refuse `-` in a slug that spec/MOTION.md §11 allows, so no recipe reads
  `MESH2MOTION/Two-hand_Blast` (WP-9.3's lane).
- Library: the census counts a clip and its mirror twice (`Dodge_left`/`Dodge_right`, 4 pairs), which WP-9.3's dedup
  joins; counting them once lowers G5's unique count by 2.
- Intake (before G9): writing an adopted improvement into a re-imported or migrated set breaks `import --check` and
  `migrate --check`, and adoption moves the census, docs/LIBRARY.md and the distributions, which the adopt bot doesn't
  regenerate (WP-9.1a's lane).

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
