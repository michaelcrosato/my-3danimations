# Handoff: every phase built; G10's commands passed; the owner's steps open (2026-10-19)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 passed on run 2 on
michaelcrosato/my-3danimations#14 (D107); Phase 8 merged on michaelcrosato/my-3danimations#15 (G8's commands, D111);
Phase 9 on michaelcrosato/my-3danimations#16 (G9's commands passed on run 2, D115); Phase 10 on
michaelcrosato/my-3danimations#17 (G10's commands passed on run 1, D117). This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. Ultracode mode (PLAN.md §11, D83): implementers in worktree lanes
(`.claude/worktrees/lane-*`, each with its own `.cache` symlinking `fixtures`, `src`, `100style`, `cmu`, `sources`),
the main session integrates shared files, DECISIONS and merges, and runs every gate in the main checkout. At most 3
lanes, none during trial batches. G8-G10 have owner steps; such a gate still merges (§8.5).

## Where things stand

- **Version 0.53.0.** Every WP through 10.2 is done; G0-G7 passed; G8, G9 and G10's command sets passed and each
  waits on the owner (blocked-owner, its ask on its PR):
  - **G8** (#15): the phone review of `bench/results/gates/G8-run-1/queue.json`.
  - **G9** (#16): the contract suite against O8's project (`ci` dispatched with the gate `intake-contract`, the secret
    `M3A_INTAKE_SUPABASE`), an adoption through a merged PR (intake.yml with O8's secrets), the owner's approval of 70%
    of `bench/results/gates/G9-run-2/queue.json`.
  - **G10** (#17): another repository consumes the package or certifies against the vectors, and the owner confirms
    it (O9: proposed in docs/MIGRATING.md and spec/conformance/CERTIFYING.md, never acted on there).
  - O3 (the Vercel previews, paused) and O8 (the Supabase project) are the owner's; the session creates neither.
- **Review bots:** every finding on #14, #15 and #16 is fixed or answered on its thread (D115); one, binding a
  community pack's `verify` to the admission-time proof hash, is left open on #16 for the owner.
- **Last measured (4 CPUs):** T0 about 3 s, T1 77 s in CI (about 105 s here), T2 about 350 s with the full sweeps,
  `pack --check` about 21 s, the TypeScript certification about 8 s.

## Next, in order

1. Whatever the owner sends back: a review file (`npx m3a review ingest <file>`, its notes into
   docs/FEEDBACK-LOG.md and a threshold or task proposal into docs/REVIEW-PROPOSALS.md), O8 linked (the contract run,
   the first adoption by the bot), another repository's use confirmed (G10).
2. The follow-ups below, each a WP of its own when the owner picks it.

## Follow-ups recorded, owned by no WP yet

- Tools: the CLI and MCP can't name a generated `gen-<seed>` character, which the gallery plays (a character resolver
  for `gen-<seed>`), nor an arbitrary orbit (only `raster.turntable`) (D109, the Phase 8 verifier).
- Spec: the recipe schema and validator refuse `-` in a slug that spec/MOTION.md §11 allows, so no recipe reads
  `MESH2MOTION/Two-hand_Blast` (WP-9.3's lane).
- Library: the census counts a clip and its mirror twice (`Dodge_left`/`Dodge_right`, 4 pairs), which WP-9.3's dedup
  joins; counting them once lowers G5's unique count by 2.
- Intake: library-gates holds a clip a pull request adds outside the intake to the intake's rules but still passes a
  clean one; refusing every one, as §8.4 reads after G9, waits until the importers' and procedural sets'
  regenerations go through the adopt bot (D113).
- Intake: the checker rebuilds the census over the whole library on each run (about 1 s) and the retarget gate binds
  the reference rigs per checker; a trial's checker every 30 s blocks the runner's event loop a few seconds a tick
  (WP-9.1b's review).
- Index: each regeneration before a commit mints a version (two reviews before one commit give v2 and v3); `admit`
  could run the intake's text gate on a pack's catalog and clips; a namespace's proof could list the digest too
  (WP-9.4's fix lane).
- Sources: `deliver` allows a clip whose stated and served terms differ when both are allowlisted (both recorded);
  the format leaves `intake.by` optional (the intake requires it) (D113).
- Sensors: a check that plays each locomotion loop with its root motion at the rates a game asks (0.5 to 2) on the
  test bodies, as B1's grader reads it: keyed runs (`MESH2MOTION/Run_Female`, `Jog`) skim on some bodies (D106).
- Core: the planter (K5) and the key fit grow faster than linearly; the tools bound them (D96). Parents in a loop
  among bones a table knows by name hang recognition's ancestor walk (D96).
- Library: a composed source license (" AND ") is read as one id by license.check (D96).
- io: non-finite heads from overflowing node transforms (D96).
- The manual is at 7,999 of 8,000 tokens: the next manual change cuts text first (F5.2); the consumer lab's README
  lists the public names the manual doesn't teach (D116).
- Library: the 6 `unplanted` loops (D108) could keep contacts where a captured speed arbitrates between readings
  (`WideLegs_Walk`'s height pass reads 0.94 of its captured speed, both feet down): a choice for `@m3a/library`'s
  measure, which knows the captured speed, not core's.
- T2 could load `m3a.js` in Chromium (F5.3); G7 and G10 run pack --check.
- shardfall's tier 1b waits on its glTF reader's Rigify look (CERTIFYING.md, D116; O9: a proposal).
- Repo: T1's conformance CLI test runs `main.ts --json` with the broken sidecar, so it rewrites
  check-output/conformance/report.json; a certification's report is kept by copying it at once (G10's is in its
  record).
- A stray private artifact of spec/conformance/CERTIFYING.md (https://claude.ai/artifact/5AP4qvDZDN6w7nEGxG5Tzn), made
  by a lane's mistaken edit, waits for the owner's word to delete it.

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
