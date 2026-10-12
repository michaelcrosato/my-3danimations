# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 4 First flight, 5 The payload. **Next gates:** G5; G4 (M1), run 2. **Version:** 0.35.1.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-939ofg` (D50: it takes over michaelcrosato/my-3danimations#9).

## Done

- Phase 0 (G0 passed, michaelcrosato/my-3danimations#4): doctrine, toolchain, checks, pins, vectors, CI, hook.
- Phase 1 (G1 passed, michaelcrosato/my-3danimations#5): spec 2.0-rc frozen; validator; codec; skeleton; seed sets.
- Phase 2 (G2 passed, michaelcrosato/my-3danimations#6): portable math, the same bits in V8 and JavaScriptCore (D33);
  the clip runtime and facts (D34); pose operations (D35); the solver (D36, F2); planted feet and the ground (D37); the
  Animator, the same hashes and exact poses in Node, Chromium and Bun; core's API of 38 documented names (D38, F3).
- Phase 3 (G3 passed, michaelcrosato/my-3danimations#7): raster (D39); sheets, diffs (D40); 14 metrics, qa (D41);
  describe 30/30 (D42); 100/100 planted defects (D43); lint and fix (D44); the verifier's 21 findings fixed (0.19.x).
- Phase 4 so far: three.js r182 (D45); test characters and real CC0 rigs (D46); binding (D47); baking (D48); capture
  and the sweep (D49, D51); the first-flight demo `apps/lab/hello`, driven headless, hashes = Node's (D52).

## Next

- Fix forward from G4 run 1. A second failure is K1 (PLAN.md §12): run 2 waits for a sweep at ≥95% at a clean
  commit, over the whole library now (1,390 clips, 8,340 pairs; D63). Phase 5 lanes that don't need G4 go on.
- Phase 5's WPs are done: 5.1–5.7 (D53–D65); 5.8 library QA, 1,194 unique motions in 1,393 clips (D66). G5's
  first verifier blocked it (reactions short), fixed in D67. Next: G5 again, then Phase 6.

## Blocked on the owner

- G4's bar (D60, on michaelcrosato/my-3danimations#10): D49's reading gives 89.1%, "no fail finding added" 97.2%.
- Quaternius' current editions (D63): itch.io's download is refused here, so its two sets stay as migrated.

## Last gate

- **G4 run 1 failed** 2026-10-12 at 6798b45 in 19.7 min, 5 of 8 (`bench/results/gates/G4-run-1/`, review in D57):
  - passed: check (T0) 11.5 s; test (T1) 469 tests in 53.9 s; doctrine 8/8; T2 40.8 s, the set on the six skeletons
    and the held-out rig with no fail finding; B1 5/5;
  - failed: the sweep, 2,808 of 3,150 pairs (89.1%, the bar 95%; 85.0–91.4% a skeleton; the held-out rig 90.9%, apart);
    B1's held-out variant, as a grader failure: its first seed broke the known-good solution (fixed in D56; the redrawn
    seed's 5/5 is information only); vectors --check, the worktree lacking the pinned sources (byte for byte with them).
