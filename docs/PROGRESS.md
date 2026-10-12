# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 4 First flight. **Next gate:** G4 (M1). **Version:** 0.23.1.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-35xhjq`.

## Done

- Phase 0 (G0 passed, michaelcrosato/my-3danimations#4): doctrine, toolchain, checks, pins, vectors, CI, hook.
- Phase 1 (G1 passed, michaelcrosato/my-3danimations#5): spec 2.0-rc frozen; validator; codec; skeleton profile;
  seed sets in format 2 (525 clips, 0 errors). D25 to D32.
- Phase 2 (G2 passed, michaelcrosato/my-3danimations#6): portable math, the same bits in V8 and JavaScriptCore (D33);
  the clip runtime and measured facts (D34); pose operations (D35); the solver on any recognized skeleton, its roll
  tested (D36, F2); planted feet and the ground (D37); the Animator, the same hashes and exact poses in Node,
  Chromium and Bun, and core's public API of 38 documented names (D38, F3).
- Phase 3 (G3 passed, michaelcrosato/my-3danimations#7): raster (D39); sheets, diffs (D40); 14 metrics, predicates,
  qa (D41); describe 30 of 30 (D42); 100 of 100 planted defects at their times (D43); lint and fix (D44). The G3
  verifier's 16 findings and its second review's 5, all fixed (0.19.0, 0.19.1).
- Phase 4 so far (done beside G3's review, brought over after it merged): three.js pinned at r182 (D45); test
  characters in code and real CC0 rigs by hash (D46); binding, with a report to patch (D47); baking within 0.5 mm (D48).

## Next

- WP-4.5 partial (merged before G4 at the owner's request): sweep, planting and toeless-rig fixes. To do: sweep on
  6 rigs, D49, ledger row; CI WebGPU e2e loses its GPU process on GitHub runners. Then WP-4.6, 4.7, G4.

## Blocked on the owner

- Nothing yet.

## Last gate

- **G3 passed** 2026-10-11 at 504d0f6 in 122.8 s, 11 of 11:
  - check (T0) 1.7 s; test (T1) 25.6 s, 407 tests; doctrine 8 of 8; vectors byte for byte;
  - the sensors over all 525 clips in 5.2 s, as the baseline says: 267 pass, 104 warn, 154 fail;
  - planted defects rebuilt byte for byte and 100 of 100 caught at their times; describe 30 of 30;
  - fix: each operator removes its planted defect; over the library 252 linted, 144 better, 53 with fewer findings,
    none worse or invalid; T2 8.7 s. 27 of 27 mutants of the reworked operators fail the tests.
