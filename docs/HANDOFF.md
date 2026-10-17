# Handoff: resumed after a usage-limit pause (2026-10-16)

The session working on PR #13 (branch `claude/cool-goldberg-qgyu06`, Phase 7 toward G7 = M2) stopped at a usage limit
on 2026-10-16 and committed everything as it stood, tested or not. A new session audited that state the same evening
with 15 read-only agents, checking each claim the pause left here. This file is the audited state; where the first
version of this file and the audit disagreed, the audit stands. Keep it current until the project is done.

## The standing goal (the owner's)

Finish my-3danimations: every ledger row (PLAN.md §14) through G10 done, deferred with its reason, or blocked-owner
with its ask on the PR; CI green on the final head. Ultracode mode (PLAN.md §11, D83): implementers in worktree lanes
(`.claude/worktrees/lane-*`, each with its own `.cache` symlinking only `src` and `fixtures`), the main session
integrates shared files, DECISIONS and merges, and runs every gate in the main checkout. Push every 30-60 minutes, at
most 3 lanes at once, none during trial batches. After each gate's squash merge (CI green), restart the branch from
`origin/main` and open the next draft PR. G8-G10 have owner steps; such a gate still merges (§8.5).

## Paused for usage (2026-10-17 16:45 UTC), resuming 18:59 UTC

- WP-7.3 (lanes manual and skill) and WP-7.4 (lane spare) were stopped mid-review and merged as they stood, each with its
  work committed: skill passed its review (nits applied); manual's round-1 fixes are in, round 2 never ran; WP-7.4's
  round-2 fixes are in, round 3 never ran. pack.ts took WP-7.4's side. T0 7.4 s, T1 89.8 s (at its 90 s budget: trim
  before G7). T2, the reviews' last rounds, the records (0.49.0 for 7.3, 0.50.0 for 7.4; D98, D99 are written) and the
  root `pack` script are owed. Then B1 and B5 at 5 trials (7.3's Verify), the known-goods `--fake --heldout G7` again
  (they passed before the packaging change), and G7. G7's held-out run 1 is committed and checked.
- During the pause: T2 passed on b46cc8c (134.3 s), CI green there; the known-goods pass `--fake --heldout G7` on the
  new packaging. T1's slowest files (one profiled run): sensors procedural 18.0 s, core procedural 17.2 s, bench
  runner 16.3 s (grew with the skill lane), sweep 13.9 s, B1 grader 12.5 s, tools-change 12.1 s, B3 grader 10.9 s.

## The state at the pause, audited

Last green, recorded commit: **1bf5252** (0.47.0: WP-7.2a done, D95). Merged on top of it, without records:

| Lane (merge) | What | Audited state |
|---|---|---|
| b0 (3f8cf6c, in 0.47.0's tree) | a character's bytes (`ctx.bytes`), io's glTF skeleton reader, characters bound through core with D49's soles, TINY | its decision text was lost; rebuild it from ba24948, a37eafe, 2c128f2, c356c5e, fe6594a and the diff `3f8cf6c^1..3f8cf6c` (+955). 0.47.0's changelog left it out |
| `lane/tools-retarget` (89a9e55) | `retarget.inspect`, `retarget.apply`; the D80 judge moved into `@m3a/tools`; three's bind takes the file's bone names | round 1 fixed (448791a). A round 2 ran and its fix was half applied (WIP 9da0d53, `body.ts` only): `meshIssue` is exported but `retarget.ts` never uses it, so a compressed or unreadable mesh still counts as a mapping issue (inspect's `next` says "fix data.patch" while the patch line says no patch clears it). Round 2's findings were not recorded |
| `lane/tools-compose` (7df2f63) | `recipe.compile`, `graph.validate`, `graph.sim`; the resolver passes E_TIER through | round 1 fixed (26836b7); rounds 2-3 owed |
| `lane/tools-exchange` (0d45a6f) | `import`, `export` (VRMA, .glb, BVH); the registry's `writes` flag (MCP readOnlyHint false, destructiveHint true) | round 1 fixed (d04d1ff); round 2 owed |
| `lane/t1-speed` (261e78c) | bit-identical speedups in core and sensors; tests sharing identical work | **proven sound by the audit** (below); only its records are owed |

No lane branch or worktree survives: the lane commits exist only as merge parents.

What the audit found, against the first version of this file:
- **T2 did run and passed**: CI's pull_request run 38916316563 on 4080135 (99.4 s: Playwright 20/20 with mcp-smoke,
  library QA, sweeps 14 files / 57 tests), and locally (148 s). three r186 is green. T0 passes on CI (12.9 s); the
  local 23.0 s was load. The only red is CI's "T0 check and T1 test" job: 3 tools tests (T1 61.9 s on CI, about 82 s
  in this 4-CPU container).
- **The 3 failures are stale tests; the code is right.** `tools-retarget.test.ts:85-86, :115`: WIP 9da0d53 reworded
  body.ts:206 to "hips (X) likely the wrong bone: only N mm up, ..." so the conclusion survives retarget.apply's
  60-character cut (retarget.ts:116); the failure is in `lines[0]`, not `next`. `tools-compose.test.ts:133`:
  retarget's 7c31eb9 made body.ts:128 name the character unquoted (`characterName`, D95's one naming) and compose's
  test still expects `"gen-x"`; exchange is not involved. With only those expectations changed, packages/tools gives
  146/146, the never-run assertions after them included.
- **t1-speed**: 11 A/B hash parts over the whole library are bit-identical between 1bf5252 and 4080135 (decode
  0df74cdf79b8eb1b, decodeOther b142c4cd5f306f62, encode 39c519df430bcb6a, facts b79e2b4b00f55d73, root
  2eda1300ba89c3a5, plant 23cdf3509243e694 (the kept harness; the audit's first version of that part gave
  e2168daba6a8d2fe on both trees), sensors 95fbaf80facceaec, fix caf56a18d4679a48, procedural
  cd89bf81f1fe5bbf, animator 8b409beb3b160667, solve 290de4e3eae475cf); cross-engine passes (Animator
  144560999a518f7d unchanged); CI's Node = Chromium hashes are unchanged; vectors byte for byte; expect and it counts
  unchanged, nothing skipped. WIP 65ea4a6 (rootFrom memo) is complete. Owed: a D-entry and changelog lines (measureFacts
  gained an optional 4th parameter `sampled`: a feature-level change). Since done in lane t1rec: the exactness test
  (packages/core/test/exact.test.ts), `sampled` checked for count and step, the sweep's rows pinned by hash.
  The harness is kept as `tools/exact/ab.mjs` (on demand).
- **The sweep after the judge move** gives byte-identical rows (gen-0 and gen-7, `--sample 60`, 120 rows, 1bf5252 vs
  4080135); a committed check is owed.
- **WP-7.2b's size** is about 3,027 lines (b0 955 + 546 + 470 + 1,056), past L before its fixes.
- The usage limit was not in force when the audit ran: a real quiz trial passed (10/10, $0.026, claude-sonnet-5-5,
  uid 65534 under D94's isolation).

## Next, in order

1. **WP-7.2b: done** (0.48.0, D96, D97). Its follow-ups, recorded in D96 and not owned by any WP yet: core's planter
   (K5) and key fit grow faster than linearly (the tools bound them); the library reads a composed source license as
   one id; io returns non-finite heads on overflowing transforms; parents in a loop among named bones hang
   recognition's ancestor walk. K8: the manual's lines on `openLibrary().resolver()` (MANUAL.md:241, :285) predate
   E_TIER; the import catalog's format goes in the manual.
2. **WP-7.3**: the manual (packages/tools/MANUAL.md, 6,722 of 8,000 tokens, still a draft: only `help` and `validate`
   documented, @m3a/io missing, the opt-in tiers line false); a generated, checked tool list (PLAN §6 docs drift);
   D91's fold-ins (DECISIONS.md, G6's reads past the manual); a complete walk, attack-with-hit, react example that
   does not echo the B1-B3 known-goods (D77); a test running every code block (`npm test -- manual` matches nothing
   today); `.claude/skills/m3a/SKILL.md`, `skills/m3a/`, `llms.txt`, `.mcp.json`; the runner wiring below; B1 and B5
   at 4 of 5 or better.
3. **Runner wiring** (verified by probe, as nobody): bench/runner/agent.ts:528-529 adds `Skill` to `--tools` and
   `Skill,mcp__m3a__*` to `--allowedTools`, `--setting-sources project`, and `--mcp-config` running `node
   node_modules/@m3a/tools/dist/node.js mcp` (keep `--strict-mcp-config`); workspace.ts copies the skill as real
   files, not symlinks; a trial fails when the init event's `mcp_servers` status is not `connected` (a dead server is
   otherwise silent).
4. **WP-7.4**: `npm run pack [-- --check]` replacing bench/runner/pack.ts, whose bin keeps `./src/node.ts`, which is
   not shipped (the packed `m3a` never ran); bin → `./dist/node.js`; opt-in cc-by and cmu packs; the single file.
   Escalate O2 once; the default is publish nothing (npm is not authenticated here anyway).
5. **G7**: gate.ts has only G0-G6, so add G7's set; a fresh held-out writer under D91's read bar (B4's seed 0 mod 4;
   B4 has never run live); each known-good passes `--fake --heldout G7` first; `npm run bench -- quiz --trials 1`
   before spending. 12 Claude models are reachable; the default gates at 4 of 5 per brief and variant, while
   opus-5-5, haiku-5-5 and fable-5-1 are recorded at 1 trial per brief, not gating (a D-entry). Then the record, two
   verifier lenses, the squash merge of #13, the branch restarted from origin/main, a new draft PR.
6. **Phases 8-10** in lanes. WP-8.1 may be built once 7.2b is done but merges only after G7, rebased, on Phase 8's PR
   (PLAN.md:741's graph line still says {4.6, 7.2}). Split 8.2 if it passes L. 10.1 and 10.2 run after G7, alongside
   8 and 9. Every gate set, script and e2e suite the WPs name (G8-G10, library-pr, pack, intake, index, conformance;
   gallery, review, previews, consumer-ts) has to be created.

## Rules learned the hard way

- Decision text and review findings go into tracked files at once, never the scratchpad: the pause lost b0's
  decision and retarget's round-2 findings that way. On the first usage-limit error: WIP-commit and merge every lane,
  push, update this file, stop.
- GitHub: `gh pr` and GraphQL return 403 here; use the GitHub MCP tools or `gh api` REST. git push works. The repo
  allows squash merges only and deletes the head branch on merge; main is unprotected, so "merge only when green" is
  ours to keep. Writes now act as the owner's login (michaelcrosato), not michaelcrosatoDM: every session comment
  opens with `<!-- m3a-session -->`, owner evidence (phone notes, approvals, adoptions) is never authored by the
  session, no review is ever approved by it, and a gate merge under this token is noted in its D-entry.
- Vercel project prj_G6lMChE61OFf2aXCRijeSQWkAAEq is linked and paused (D85), with SSO protection on: "Deployment was
  blocked" is expected. Supabase: the connector works, but no project for m3a exists; never create one without the
  owner's explicit yes. The Actions API is blocked (403), so no secrets can be set. No Docker here: the supabase
  backend can be tested against local Postgres 16 (`/usr/lib/postgresql/16/bin`) with a stubbed `auth.uid()`.
- `npm run bench` writes into the tracked `bench/results/`: commit gate records on purpose, delete stray probes.
- Time T0 and T1 with no lane testing; 4 CPUs make local timings load-sensitive.
- Never push to my-3dge or shardfall (O9); never publish (O2); Claude models only (O10).
