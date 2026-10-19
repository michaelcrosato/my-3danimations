# Handoff: Phase 7 merged before its gate (2026-10-17)

The session that resumed after the 2026-10-16 usage-limit pause finished WP-7.2b, WP-7.3 and WP-7.4, then, at the
owner's request, started no new work package and merged Phase 7's pull request (michaelcrosato/my-3danimations#13)
into `main` with CI green, **before G7** (D103). This file is what the next session needs.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. Ultracode mode (PLAN.md §11, D83): implementers in worktree lanes
(`.claude/worktrees/lane-*`, each with its own `.cache` symlinking only `src` and `fixtures`), the main session
integrates shared files, DECISIONS and merges, and runs every gate in the main checkout. Push every 30-60 minutes, at
most 3 lanes, none during trial batches. After each gate's squash merge (CI green), restart the branch from
`origin/main` and open the next draft PR. G8-G10 have owner steps; such a gate still merges (§8.5).

## Where things stand

- **Version 0.50.0.** Done: Phases 0-6 and their gates; WP-7.1, 7.2a, 7.2b (D96, D97), 7.3 (D100), 7.4 (D101).
- **G7 has not run.** Its command set is in `tools/run/gate.ts` (D98: the CLI's default model gates every brief and
  held-out variant at 4 of 5; opus-5-5, haiku-5-5 and fable-5-1 are recorded, one trial a brief, not gating). Its
  held-out run 1 (`bench/results/heldout/G7/run-1/`, seeds B1 1287, B2 1618, B3 1469, B4 1340 a VRM, B5 1171, B6 1830,
  B7 1537) was written under D91's read bar, checked (`check.json` beside it) and is unused; every known-good passes
  on its variant (`--fake --heldout G7`) with the new packaging.
- **Last measured (this machine, 4 CPUs):** T0 about 2-11 s, T1 78.0 s (974 tests), T2 113-134 s,
  `npm run pack -- --check` 17.7 s, all passing; CI green on the merged head.
- **Checked 2026-10-18 in a fresh container** (branch = `main` = 71848bb, no open PR or issue): the hook's `npm ci`,
  rigs and pins pass; Node 24.21.0, Chromium 1194, Bun, `claude` 2.1.303 (a one-call probe answers, $0.004), the
  benchmark's credentials in `/home/claude/.claude/remote`, Postgres 16; the m3a MCP server answers (0.50.0). T0 first
  run 23.2 s, a FAIL on time alone (typecheck 12.5 s and lint 9.4 s cold), then 2.0 s; T1 81.8 s (974 tests); T2
  128.5 s (20 browser tests, library QA 1,013 / 230 / 155 as baselined, the sweeps); `vectors --check` 16 files.
- **Owner items:** D94 (benchmark credentials) for review, not blocking. O2 taken at its default (D99: publish
  nothing). No other open ask.

## Next, in order

1. **Done (D104, 0.50.1): fix the library's contact-less loops** (D100): 30 loops have `contacts: {"by": "detected"}` with no foot
   contact, among them CC0's `MESH2MOTION/Run_Female`, `Run_Anime` and `Run_Stealth`. Their own ground speed reads 0
   (`contact.contactRoot`), so an agent that matches its playback speed to it can't: B1 fell to 1 of 5, then 3 of 5
   after the manual's speed fix, with agents shipping Run_Female. Detect their contacts (or mark and rank them so
   search doesn't offer them as runs), through the canonical writer, with the library QA baseline updated by a logged
   decision. Then rerun `npm run bench -- B1 --trials 5 --parallel 5`: WP-7.3's B1 proof (4 of 5) is deferred to G7.
   **The 30 split in two** (counted 2026-10-18): 11 stand on their feet and need their contacts detected (CC0's
   MESH2MOTION `Run_Female`, `Run_Anime`, `Run_Stealth`; `CMU_CURATED/Boxing_Guard_Loop`; STYLE100's `WideLegs_Walk`,
   `Drunk_RunBack`, `Waving_RunBack`, `OnHeels_Idle`, `OnHeels_Run`, `OnHeels_SideLeft`, `OnHeels_SideRight`); 19 are
   off their feet (fly, glide, swim, jump in the air, climb, hang, levitate, meditate, sleep: Mesh2Motion and both
   Quaternius sets) and should say so rather than be given contacts. Search scores `Run_Female` 9.9 beside the core
   jogs, its row reading 3.76 m/s while its own ground speed reads 0.
2. **G7** on a fresh draft PR: `npm run bench -- quiz --trials 1` first, then `npm run gate -- G7 --json` in the main
   checkout; record `bench/results/gates/G7-run-1/` as G6's record was (D91); two verifier lenses; the D-entry, ledger
   row, PROGRESS and the PR report; squash-merge with CI green.
3. **Phases 8-10** (PLAN.md §10): 8.1 the gallery, 8.2 the review queue (measure it first: split it if past L, as D93),
   8.3 previews, G8; 9.1-9.4, G9; 10.1, 10.2 (they may run alongside 8-9), G10. Every gate set, npm script and e2e
   suite those WPs name still has to be created (G8-G10 and `library-pr` aren't in gate.ts).

## Follow-ups recorded, owned by no WP yet

- Core: the planter (K5) and the key fit grow faster than linearly; the tools bound them (D96). Parents in a loop
  among bones a table knows by name hang recognition's ancestor walk (D96).
- Library: a composed source license (" AND ") is read as one id by license.check (D96).
- io: non-finite heads from overflowing node transforms (D96).
- The manual is at 7,998 of 8,000 tokens: the next manual change cuts text first (F5.2).
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
