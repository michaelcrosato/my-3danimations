# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** all eleven built (10 done: G10's commands passed; its confirmation blocked-owner). **Next gate:** none (M4).
**Version:** 0.54.0. **Mode:** ultracode (D83). **Last change:** the post-G10 audit (D118) and its large items (D119).

## Done

- Phases 0 to 3 (G0 to G3 passed, #4 to #7): doctrine, toolchain, CI; spec 2.0-rc; codec; portable math (D33);
  facts, ops, solver, planted feet (D34–D37); the Animator (D38); raster, sheets, metrics, describe, lint (D39–D44).
- Phases 4 to 6 (G4 = M1, G5, G6 passed, #8, #10 to #12): three.js r182, test characters, binding, baking, capture,
  B1 (D45–D56); the library, licenses, io, search, QA (D59–D69); recipes, moves, actions, graphs, sims, B2–B7
  (D70–D77).
- Phase 7 (G7 = M2 passed on run 2, #13, #14): the registry on four surfaces (D92, D93); 20 tools (D95, D96); manual,
  skills (D100); packs, m3a.js, nothing published (D99, D101); contacts the planter holds (D104, D108); D105, D106.
- Phase 8 (G8's commands passed, #15): the gallery (WP-8.1); the review queue, split 8.2a and 8.2b: the intake store,
  `m3a review`, its page and the contributor page (D109); previews (WP-8.3); the free tier checked (D110).
- Phase 9 (G9's commands passed on run 2, #16): the intake, its gates, the adopt bot, B8, B8-ten (WP-9.1); sources
  (9.2); dedup, lineage (9.3); the registry index (9.4) (D112); the verifiers' fixes (D113, D114).
- Phase 10 (G10's commands passed, #17): the consumer proof and MIGRATING.md (10.1), the conformance kit (10.2) (D116).
- The audit (D118, D119): docs, the spec's errata, D96's follow-ups; gen-<seed>, first-flight, the shipped skill.

## Next

- The owner's steps below; the follow-ups in docs/HANDOFF.md, each deferred with its reason, owned by no WP.

## Blocked on the owner

- G8: the phone review of the 20-clip batch (`bench/results/gates/G8-run-1/queue.json`). Asked on #15.
- G9: O8 linked (`services/intake/README.md`), then the contract suite in Actions and an adoption through a merged
  PR; the approval of 70% of `bench/results/gates/G9-run-2/queue.json`. Asked on #16.
- G10: another repository consumes the package or certifies against the vectors, confirmed (O9). Asked on #17.
- Also: O3 (Vercel previews, paused). D94, #16's proof thread and the stray artifact: answered (D120).

## Last gate

- **G10 = M4's commands passed** (run 1, 95af62d, 8 of 8, `bench/results/gates/G10-run-1/`, D117): TypeScript certified
  (3,662 cases), the consumer proof, pack --check, T2 352 s. Before it, G9 = M3's on run 2 (D115).
