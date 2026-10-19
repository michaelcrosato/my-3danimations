# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 8 The ground station (7 done: G7 = M2 passed). **Next gate:** G8. **Version:** 0.50.2.
**Mode:** ultracode (D83). G7 ran and merged on michaelcrosato/my-3danimations#14; Phase 8 on a fresh draft PR.

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
- Phase 7 (G7 = M2 passed on run 2, #13, #14): the registry on four surfaces (D92, D93); 20 tools (D95, D96); the
  manual, skills, llms.txt (D100); packs, m3a.js, nothing published (D99, D101); contacts the planter holds (D104,
  D108); the manual's root motion and speed rule (D105, D106).

## Next

- Phase 8 in lanes (8.1 the gallery, 8.2a and 8.2b the review queue, 8.3 previews), G8; then 9 and 10 (10.1-10.2 built).

## Blocked on the owner

- Nothing blocks. For review: D94 hands the benchmark agent a namespace-private copy of the session's credentials.

## Last gate

- **G7 = M2 passed** (run 2) 2026-10-19 at 5d1ec8f in 93.0 min, 24 of 24 (`bench/results/gates/G7-run-2/`, D107):
  B1, B6 4/5, the rest and every fresh variant 5/5 (68/70, $11.46), packaged CLI, skill, MCP; recorded models 7/7. Run 1
  (1623b78, 84.0 min, `G7-run-1/`) failed 23/24, B1's variant 3/5 (D106). Two verifier lenses, fixed in D108 (0.50.2).
