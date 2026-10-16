# Handoff: paused at a usage limit (2026-10-16)

The session working on PR #13 (branch `claude/cool-goldberg-qgyu06`, Phase 7 toward G7 = M2) stopped on the owner's
word when the account hit its weekly usage limit (subagents failed with "weekly limit, resets Oct 21 12:00 UTC").
Everything was committed and pushed as it stood, **tested or not**. This file is what the next session needs.

## The standing goal (the owner's, unchanged)

Continue my-3danimations to completion: the ledger (PLAN.md §14) through Phases 7–10 and G7–G10, in ultracode mode
(PLAN.md §11, D83: implementers in worktree lanes, the main session integrates shared files, DECISIONS and merges).
Push every 30–60 minutes, keep PROGRESS's Next current. Run gates in the main checkout (worktrees lack `.cache/` pins
and rigs, D57). After each gate's squash merge (CI green), restart the branch from `origin/main` and open the next
draft PR; list merged branches for the owner to delete. Done is every ledger row done, deferred with its reason, or
blocked-owner with its ask on the PR (G8–G10 have owner steps; §8.5: such a gate still merges). Trials run `claude -p`
in a clean environment: check first with `npm run bench -- quiz --trials 1`. The owner paused Vercel until the project
is complete (D85): its "Deployment was blocked" status is expected.

Items 1–4 of the goal (D82's private /tmp, G4 run 2's preparation and run, WP-6.2's verifier rounds, G6) are done and
merged in earlier PRs (#10–#12); see DECISIONS D82–D91 and the ledger.

## State at the pause

Last green, recorded commit: **1bf5252** (0.47.0: WP-7.2a done, D95). CI was green on it (T0/T1, T2, three r186).

Merged on top of it in this handoff, **untested beyond one run of the tools package**:

| Lane (branch, kept locally only) | What | Review state |
|---|---|---|
| `lane/tools-retarget` | `retarget.inspect`, `retarget.apply`; the D80 judge moved into `@m3a/tools` (`judge.ts`); three's bind takes the file's bone names; `tools/sweep/sweep.ts` uses the moved judge | round 1 sound (should-fixes fixed in 448791a); its round-2 fix and round-3 review never ran; one uncommitted edit to `body.ts` committed as WIP |
| `lane/tools-compose` | `recipe.compile`, `graph.validate`, `graph.sim`; the library's resolver passes E_TIER through | round 1 blocking, fixed in 26836b7 (running length bounded before compile via a helper shared with edit; graph.sim refuses past 36,000 steps; hint naming); round-2 review never ran |
| `lane/tools-exchange` | `import` (into `imports/<SET>/`), `export` (VRMA, .glb, BVH); registry gains a `writes` flag (MCP `readOnlyHint:false`) | round 1 fixed in d04d1ff (9 should-fixes); round-2 review never ran. Notes: exchange is 388 of its 400-token cap; all tools ≈2,424 tokens in tools/list |
| `lane/t1-speed` | bit-identical speedups (decoding, planting, snapping, sensors; tests sharing identical work) to bring T1 (84.8 s, budget 90 s) down | never reviewed; last edit to `packages/core/src/animator/animator.ts` committed as WIP. The review must prove every assertion is as strict as before and outputs bit-identical |

Merge conflicts resolved by hand: `packages/tools/src/tools/index.ts` (groups FIND, CHECK, CHANGE, RETARGET, COMPOSE,
SHIP, EXCHANGE, BASE, in that help order) and `packages/tools/test/tools-budget.test.ts` (7.2a ≤ 1,900 tokens, compose
≤ 420, exchange ≤ 400, all ≤ 3,000, one tool ≤ 240; the 20 tool names pinned in help order).

`npx vitest run packages/tools` after the merges: **143 of 146 pass, 3 fail**:
- `tools-retarget.test.ts`: "retarget.inspect finds a bone unmapped…" and "retarget.apply judges clips as the sweep
  does (D80)…": the replies' `next`/hint lines differ from the expected (likely the WIP `body.ts` edit, or the
  retarget lane's round-2 fix left half done).
- `tools-compose.test.ts`: "graph.sim: a hit window…": an E_ARGS message differs from the expected (likely exchange's
  or retarget's naming change of character files, `<the character's file>`, meeting compose's expectation).

T0, the full T1 and T2 were **not** run on the merged head; expect CI to show these failures.

## Next, in order

1. Fix the 3 failing tests (decide per case whether the test or the code is right; the lanes' round-1 reports are
   summarized above). Run T0, T1 (watch the 90 s budget; t1-speed should help), T2 (`mcp-smoke` checks every example
   through the MCP Inspector and the API).
2. Review rounds the limit cut short: retarget round 2–3, compose round 2–3, exchange round 2, t1-speed round 1
   (proving equal strength). Then WP-7.2b's verifier (two lenses, contract and adversarial, as 7.2a had, D95).
3. 7.2b's records: a D-entry (D96: its calls, every crossing of 7.2b's Owns, size; lane b0's decision text was in the
   session's scratch and is lost; reconstruct it from commit 3f8cf6c's message and diff), the ledger row, CHANGELOG
   0.48.0, PROGRESS. Push; CI green.
4. WP-7.3, the manual and the skill (PLAN.md): the manual ≤ 8,000 tokens (it is 6,712 now) with one complete example
   (walk, attack with a hit event, react) and the 7.2b tools; `.claude/skills/m3a/SKILL.md`, `skills/m3a/`,
   `llms.txt`. Fold in G6's reads past the manual (bench/results/gates/G6-run-1/README.md): Animator.layer weights
   and masks, contactRoot, three's attach, the recipe pose step's arms, simulate()'s result shape, B7's travel note.
   Done when B1 and B5 rerun with the final manual pass ≥ 4 of 5.
5. WP-7.4, packaging (the `m3a` bin needs a JS build; the single-file bundle; dry-run packs; publishing waits on O2).
6. G7 = M2: B1–B7 and fresh held-out variants through the packaged CLI, skill and MCP. The held-out writer is a fresh
   subagent barred from the manual's examples and from D76/D77-like entries (D91); each known-good passes on its
   variant (`--fake --heldout`) first. Benchmark agents run as `nobody` (D94; posted on PR #13 for the owner's review).
7. Phases 8–10, G8–G10.

## Housekeeping

- Integration checkout used: a separate worktree on `claude/cool-goldberg-qgyu06`; lanes in
  `.claude/worktrees/lane-*` with their own `.cache` (only `src` and `fixtures` symlinked; never symlink the whole
  `.cache`: shared tsc build info gave false-green typechecks). Never hide files with `.git/info/exclude` (shared by
  all worktrees; it hid G6's record copies once).
- Lane branches (`lane/*`) were never pushed; their commits are all in this branch's history via the merges.
- No remote branch other than `main` and this one exists, so there is nothing for the owner to delete.
- The session's raw chat transcript is not committed: it was not scanned for credentials (D94's work handled the
  session's credential files), so publishing it was not safe. This file and DECISIONS D82–D95 carry its substance.
