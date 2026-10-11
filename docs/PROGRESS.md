# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 3 The sensors. **Next gate:** G3. **Version:** 0.18.1.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-35xhjq`.

## Done

- Phase 0 (G0 passed, merged as michaelcrosato/my-3danimations#4): doctrine, toolchain, doctrine checks, pins and
  vectors (7.1 MB, tiers 1a to 3), CI and the session hook.
- Phase 1 (G1 passed, merged as michaelcrosato/my-3danimations#5): spec 2.0-rc frozen (`MOTION.md`, `LEGEND.md`,
  `SKELETON.md`); the validator (30 rules); the codec (tier 1a bit for bit, tier 2 to the µm); the skeleton profile;
  the seed sets in format 2 (5 sets, 525 clips, 0 errors). D25 to D32.
- Phase 2 (G2 passed, michaelcrosato/my-3danimations#6): portable math, the same bits in V8 and JavaScriptCore (D33);
  the clip runtime and measured facts (D34); pose operations (D35); the solver on any recognized skeleton, its roll
  tested (D36, F2); planted feet and the ground (D37); the Animator, the same hashes and exact poses in Node,
  Chromium and Bun, and core's public API of 38 documented names (D38, F3).
- Phase 3 so far (michaelcrosato/my-3danimations#7): the raster (D39); sheets and diffs (D40); 14 metrics from capture,
  predicates, `npm run qa` (D41); describe, 30 of 30 (D42); 100 of 100 planted defects found, 4% false positives (D43);
  lint and fix, each operator removing its planted defect (D44).

## Next

- Phase 3 The sensors: gate G3.

## Blocked on the owner

- Nothing yet.

## Last gate

- **G2 passed** 2026-10-11 at a5fb0a0 in 42.1 s, 8 of 8:
  - check (T0) 1.7 s; test (T1) 14.8 s, 305 tests; doctrine 8 of 8 (core's API 38 of 40); vectors byte for byte;
  - conformance tiers 1a, 2 and 3;
  - the Animator's 480 step hashes, 41 events and 5 exact poses identical in Node and Chromium;
  - V8 = JavaScriptCore on 2.8M portable results, a 100k-step chain and the Animator's script;
  - property tests: mirror twice ≤0.5 mm, blend ends, retime, solver roll.
- The verifiers' findings, all fixed: WP-2.4's 8 (D36) and G2's 7 (D38); notes in F2 and F3.
