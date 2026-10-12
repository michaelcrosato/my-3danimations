# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 6 Composition (5 done, G5 passed; 4 waits on G4). **Next gates:** G6; G4 (M1), run 2. **Version:** 0.42.3.
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
- Phase 5 (G5 passed, on michaelcrosato/my-3danimations#10 with Phase 4): layout (D53); licenses (D59); `@m3a/io` (D61);
  corpora (D62); the re-import (D63); facts (D64); search (D65); library QA, 1,199 unique motions (D66–D69).
- Phase 6 so far: recipes (D70); procedural moves, gaits and idles (D71, four verifier rounds); actions (D72); graphs,
  Node = Chromium (D73, two rounds); simulation, stride warping (D75); briefs B2–B7, the manual's wire and make (D76, D77).

## Next

- G4 run 2 waits for a sweep at ≥95% at a clean commit (a second failure is K1, PLAN.md §12), over 1,393 clips.
- Phase 6: WP-6.1 to 6.6 done (D70–D77), their last verifier rounds fixed in 0.42.3; new rounds on 6.2 and 6.6; then G6.

## Blocked on the owner

- G4's bar (D60, on michaelcrosato/my-3danimations#10): D49's reading gives 89.1%, "no fail finding added" 97.2%.
- Quaternius' current editions (D63): itch.io's download is refused here, so its two sets stay as migrated.

## Last gate

- **G5 passed** 2026-10-12 at 754adfe in 9.7 min, 12 of 12 (`bench/results/gates/G5/`, D68): 1,194 unique motions of
  1,393 clips (CC0 pack 170); every floor met; every clip valid with its verdict; search 40/40, held out 8/10. Its
  first verifier blocked run 1 (reactions short, D67). Its open items, fixed forward: a float check; picks (D69).
- **G4 run 1 failed** 2026-10-12 at 6798b45, 5 of 8 (D57): the sweep 89.1% (bar 95%), B1's variant a grader failure.
