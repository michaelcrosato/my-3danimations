# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 7 The datalink (6 done: G6 passed). **Next gate:** G7 = M2. **Version:** 0.45.2.
**Mode:** ultracode (D83): implementers in worktrees, the main session integrates; #12 (Phase 6, G6) merging.

## Done

- Phases 0 and 1 (G0, G1 passed, michaelcrosato/my-3danimations#4, #5): doctrine, toolchain, checks, pins, vectors,
  CI, hook; spec 2.0-rc frozen; validator; codec; skeleton; seed sets.
- Phase 2 (G2 passed, michaelcrosato/my-3danimations#6): portable math, the same bits in V8 and JavaScriptCore (D33);
  the clip runtime and facts (D34); pose operations (D35); the solver (D36, F2); planted feet and the ground (D37); the
  Animator, the same hashes and exact poses in Node, Chromium and Bun; core's API of 38 documented names (D38, F3).
- Phase 3 (G3 passed, michaelcrosato/my-3danimations#7): raster (D39); sheets, diffs (D40); 14 metrics, qa (D41);
  describe 30/30 (D42); 100/100 planted defects (D43); lint and fix (D44); the verifier's 21 findings fixed (0.19.x).
- Phase 4 (G4 = M1 passed on run 2, michaelcrosato/my-3danimations#11): three.js r182 (D45); test characters and CC0
  rigs (D46); binding (D47, D87); baking (D48); capture, the sweep (D49, D51); the demo (D52); B1 (D54–D56, D84, D86).
- Phase 5 (G5 passed, on michaelcrosato/my-3danimations#10 with Phase 4): layout (D53); licenses (D59); `@m3a/io` (D61);
  corpora (D62); the re-import (D63); facts (D64); search (D65); library QA, 1,199 unique motions (D66–D69).
- Phase 6 (G6 passed, michaelcrosato/my-3danimations#12): recipes (D70); procedural moves, gaits and idles (D71, the
  margin rule D90); actions (D72); graphs (D73); simulation (D75); briefs B2–B7, the wire and make sections (D76, D77).

## Next

- Phase 7 on a fresh branch: WP-7.1 (the tool registry, done in a lane) merges first; then WP-7.2 in two (7.2a find,
  check, change, ship; 7.2b retarget, compose, exchange); WP-7.3 takes G6's reads past the manual (D91).

## Blocked on the owner

- Nothing: G4's bar (D80), the Quaternius sets (D81) and Vercel, paused until the end (D85), answered 2026-10-14.

## Last gate

- **G4 = M1 passed** (run 2) 2026-10-14 at adf77ee in 41.8 min, 9 of 9 (`bench/results/gates/G4-run-2/`, D88): the
  sweep 97.14% of 8,388 pairs on the six skeletons together (bar 95%; the Knight 92.3% alone; held-out rig 98.4%); no
  fail finding on any of the seven bodies, every one warns; B1 5/5, its held-out variant 5/5. Run 1 failed (D57).
- **G6 passed** (run 1) 2026-10-15 at a9731b1 in 17.2 min, 20 of 20 (`bench/results/gates/G6-run-1/`, D91): B2, B3,
  B5, B6, B7 each 5/5 and 5/5 on held-out variants (50/50 trials, $7.15); composed clips QA; graphs deterministic; T2.
