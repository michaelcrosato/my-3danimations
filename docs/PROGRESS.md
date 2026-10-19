# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 10 Consumers (9 done: G9's commands passed on run 2; its owner steps blocked-owner). **Next gate:** G10.
**Version:** 0.52.1. **Mode:** ultracode (D83). Phase 9 on michaelcrosato/my-3danimations#16.

## Done

- Phases 0 to 3 (G0 to G3 passed, #4 to #7): doctrine, toolchain, CI; spec 2.0-rc; codec; portable math (D33);
  facts, ops, solver, planted feet (D34–D37); the Animator (D38); raster, sheets, metrics, describe, lint (D39–D44).
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
- Phase 9 (G9's commands passed on run 2, #16): the intake, its gates, the adopt bot, B8, B8-ten (WP-9.1); sources
  (9.2); dedup, lineage (9.3); the registry index (9.4) (D112); the verifiers' fixes (D113, D114).

## Next

- Phase 10 on a fresh PR: the consumer proof and the conformance kit (built, reviewed and fixed in lanes), G10.

## Blocked on the owner

- G8: the owner's phone review of the 20-clip batch (`bench/results/gates/G8-run-1/queue.json`); O8 (the Supabase
  project, its Actions secrets, Actions may open PRs); O3 (Vercel previews, paused). Asked on #15. For review: D94.
- G9: the contract suite in Actions against O8's project; an adoption through a merged PR (O8); the owner's approval
  of 70% of `bench/results/gates/G9-run-2/queue.json`. Asked on #16.

## Last gate

- **G9 = M3's commands passed** (run 2, 9d4342d, 16 of 16, `bench/results/gates/G9-run-2/`, D115): the intake, the
  adopt bot, the index, T2, B8 5/5, B8-ten 10 of 10, the variant 5/5. Run 1: B8-ten 9 of 10 (D114).
