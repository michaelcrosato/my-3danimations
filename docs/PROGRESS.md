# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 9 The supply chain (8 done: G8's commands passed; its phone review blocked-owner). **Next gate:** G9.
**Version:** 0.51.0. **Mode:** ultracode (D83). Phase 8 merged on michaelcrosato/my-3danimations#15.

## Done

- Phases 0 to 2 (G0 to G2 passed, michaelcrosato/my-3danimations#4 to #6): doctrine, toolchain, checks, pins, vectors,
  CI; spec 2.0-rc frozen; codec; portable math, V8 = JavaScriptCore (D33); clips, facts, ops, solver, planted feet
  (D34–D37); the Animator, the same hashes in Node, Chromium and Bun; core's 38 documented names (D38, F3).
- Phase 3 (G3 passed, michaelcrosato/my-3danimations#7): raster (D39); sheets, diffs (D40); 14 metrics, qa (D41);
  describe 30/30 (D42); 100/100 planted defects (D43); lint and fix (D44); the verifier's 21 findings fixed (0.19.x).
- Phase 4 (G4 = M1 passed on run 2, michaelcrosato/my-3danimations#11): three.js r182 (D45); test characters and CC0
  rigs (D46); binding (D47, D87); baking (D48); capture, the sweep (D49, D51); the demo (D52); B1 (D54–D56, D84, D86).
- Phase 5 (G5 passed, on michaelcrosato/my-3danimations#10 with Phase 4): layout (D53); licenses (D59); `@m3a/io` (D61);
  corpora (D62); the re-import (D63); facts (D64); search (D65); library QA, 1,199 unique motions (D66–D69).
- Phase 6 (G6 passed, michaelcrosato/my-3danimations#12): recipes (D70); procedural moves, gaits and idles (D71, the
  margin rule D90); actions (D72); graphs (D73); simulation (D75); briefs B2–B7, the wire and make sections (D76, D77).
- Phase 7 (G7 = M2 passed on run 2, #13, #14): the registry on four surfaces (D92, D93); 20 tools (D95, D96); manual,
  skills (D100); packs, m3a.js, nothing published (D99, D101); contacts the planter holds (D104, D108); D105, D106.
- Phase 8 (G8's commands passed, #15): the gallery (WP-8.1); the review queue, split 8.2a and 8.2b: the intake store,
  `m3a review`, its page and the contributor page (D109); previews (WP-8.3); the free tier checked (D110).

## Next

- Phase 9 in lanes: 9.1a and 9.3 built, 9.2 building, then 9.1b and 9.4; G9; Phase 10 (10.1 and 10.2 built).

## Blocked on the owner

- G8: the owner's phone review of the 20-clip batch (`bench/results/gates/G8-run-1/queue.json`); O8 (the Supabase
  project, its Actions secrets, Actions may open PRs); O3 (Vercel previews, paused). Asked on #15. For review: D94.

## Last gate

- **G8's commands passed** (run 1) 2026-10-19 at eb43654 in 314.6 s, 8 of 8 (`bench/results/gates/G8-run-1/`, D111):
  T1 90.0 s, T2 196.9 s (gallery, review queue, previews), the intake tests, the site, the owner's batch of 20 exported.
  Open: the owner's phone review (blocked-owner). Before it, G7 = M2 passed on run 2 (D107, `G7-run-2/`).
