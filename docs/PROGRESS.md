# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** all eleven built (10 done: G10's commands passed; its confirmation blocked-owner). **Next gate:** none (M4).
**Version:** 0.57.1. **Mode:** ultracode (D83). **Last change:** G8 passed, the owner's review applied (D133).

## Done

- Phases 0 to 3 (G0 to G3 passed, #4 to #7): doctrine, toolchain, CI; spec 2.0-rc; codec; portable math (D33);
  facts, ops, solver, planted feet (D34–D37); the Animator (D38); raster, sheets, metrics, describe, lint (D39–D44).
- Phases 4 to 6 (G4 = M1, G5, G6 passed, #8, #10 to #12): three.js r182, test characters, binding, baking, capture,
  B1 (D45–56); library, licenses, io, search, QA (D59–69); recipes, moves, actions, graphs, sims, B2–7 (D70–77).
- Phase 7 (G7 = M2 passed on run 2, #13, #14): the registry on four surfaces (D92, D93); 20 tools (D95, D96); manual,
  skills (D100); packs, m3a.js, nothing published (D99, D101); contacts the planter holds (D104, D108); D105, D106.
- Phase 8 (G8 passed: its commands, #15; the owner's review, D133): the gallery (WP-8.1); the review queue (8.2a,
  8.2b): the intake store, `m3a review`, its page, the contributor page (D109); previews (WP-8.3); the free tier (D110).
- Phase 9 (G9's commands passed on run 2, #16): the intake, its gates, the adopt bot, B8, B8-ten (WP-9.1); sources
  (9.2); dedup, lineage (9.3); the registry index (9.4) (D112); the verifiers' fixes (D113, D114).
- Phase 10 (G10's commands passed, #17): the consumer proof and MIGRATING.md (10.1), the conformance kit (10.2) (D116).
- The audit (D118, D119); the follow-ups F.1 to F.11 (#20 to #25, D121–D132): the bin and the hook, contacts, the rate
  sweep (its rows answered, 45 loops read by D108's bar), the manual's names, T1's shared modules, T2 under budget.

## Next

- WP-F.12, the review page's guide; WP-F.13, frozen clips flagged, the idles' motion kept, Jump_Twist cut again (D133).
- The owner's steps below. Deferred with reasons (HANDOFF): B1's floor until the owner's go (it changes G7's evidence).

## Blocked on the owner

- G9: O8 linked (`services/intake/README.md`; the session may create it once the Supabase connector is connected,
  D130), the contract suite, an adoption, the approval of 70% of `G9-run-2/queue.json`. Asked on #16.
- G10: another repository consumes the package or certifies against the vectors, confirmed (O9). Asked on #17.
- O2 answered, publish now (D130): the owner starts `publish.yml` and `release.yml` on `v0.56.0`. O3 unpaused.

## Last gate

- **G10 = M4's commands passed** (run 1, 95af62d, 8 of 8, `bench/results/gates/G10-run-1/`, D117): TypeScript certified
  (3,662 cases), the consumer proof, pack --check, T2 352 s. Before it, G9 = M3's on run 2 (D115).
