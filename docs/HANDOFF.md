# Handoff: every phase built; the post-G10 audit landed; the owner's steps open (2026-10-19)

Phase 7 merged before its gate (michaelcrosato/my-3danimations#13, D103); G7 passed on run 2 on
michaelcrosato/my-3danimations#14 (D107); Phase 8 merged on michaelcrosato/my-3danimations#15 (G8's commands, D111);
Phase 9 on michaelcrosato/my-3danimations#16 (G9's commands passed on run 2, D115); Phase 10 on
michaelcrosato/my-3danimations#17 (G10's commands passed on run 1, D117). After it, an audit of the whole repository
(D118) fixed its easy findings and listed its large ones in `AUDIT.md`. This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. That holds: what is left is the owner's, or new work the owner
picks from `AUDIT.md` and the follow-ups below. Ultracode mode (PLAN.md §11, D83): implementers in lanes, the main
session integrates shared files, DECISIONS and merges, and runs every gate in the main checkout; at most 3 lanes,
none during trial batches.

## Where things stand

- **Version 0.53.1.** Every WP through 10.2 is done; G0-G7 passed; G8, G9 and G10's command sets passed and each
  waits on the owner (blocked-owner, its ask on its PR):
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
  - **D94** (#13): the CLI's credentials handed to benchmark agents, flagged for the owner's review.
- **Review bots:** every finding on #14 to #17 is fixed or answered on its thread (D115, D117); one, binding a
  community pack's `verify` to the admission-time proof hash, is left open on #16 for the owner.
- **A stray private artifact** of spec/conformance/CERTIFYING.md (https://claude.ai/artifact/5AP4qvDZDN6w7nEGxG5Tzn),
  made by a lane's mistaken edit, waits for the owner's word to delete it.
- **Last measured (4 CPUs):** T0 about 3 s, T1 77 s in CI (about 105 s here), T2 about 350 s with the full sweeps,
  `pack --check` about 21 s, the TypeScript certification about 8 s.

## Next, in order

1. Whatever the owner sends back: a review file (`npx m3a review ingest <file>`, its notes into
   docs/FEEDBACK-LOG.md and a threshold or task proposal into docs/REVIEW-PROPOSALS.md), O8 linked (the contract run,
   the first adoption by the bot), another repository's use confirmed (G10).
2. The large items in `AUDIT.md`, each a WP of its own when the owner picks it; the follow-ups below likewise.

## Follow-ups recorded, owned by no WP yet

The audit's large items (`AUDIT.md`) are not repeated here. Besides them:

- Library: the census counts a motion and its mirror apart by design (D67: a game needs each side), while WP-9.3's
  dedup reads Mesh2Motion's `Dodge_left`/`Dodge_right` (and their `_RM` takes) as one motion mirrored
  (`dedup.test.ts` pins it); counting them once would reverse D67, the owner's call.
- Index: each regeneration before a commit mints a version (D113 accepts it); a namespace's proof vouches by content
  id, not digest, beside the open #16 thread.
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
  share the main checkout on disjoint files, without committing, the integrator committing after T0 and T1 (D118).
- Never push to my-3dge or shardfall (O9); never publish (O2, D99); Claude models only (O10).
