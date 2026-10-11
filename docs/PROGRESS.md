# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 2 The airframe. **Next gate:** G2. **Version:** 0.9.0.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-35xhjq`.

## Done

- Phase 0 (G0 passed, merged as michaelcrosato/my-3danimations#4): doctrine, toolchain, doctrine checks, pins and
  vectors (7.1 MB, tiers 1a to 3), CI and the session hook.
- Phase 1 (G1 passed, merged as michaelcrosato/my-3danimations#5): spec 2.0-rc frozen (`MOTION.md`, `LEGEND.md`,
  `SKELETON.md`); the validator (30 rules); the codec (tier 1a bit for bit, tier 2 to the µm); the skeleton profile;
  the seed sets in format 2 (5 sets, 525 clips, 0 errors). D25 to D32.
- WP-2.1 The math kernel: portable math with V8's bits (pow within 1 ulp), the same in V8 and JavaScriptCore; all of
  core uses it (D33).
- WP-2.2 The clip runtime: sampling, root motion over loop cycles, events, contacts, measured facts within tolerance
  of 20 independently measured clips (D34).
- WP-2.3 Pose operations: blend, deltas, masks, mirror, retime, slice, loop, contact-phase sync (D35).

## Next

- WP-2.4 The solver.

## Blocked on the owner

- Nothing yet.

## Last gate

- **G1 passed** 2026-10-11 at 6bffb3e in 11.0 s, 7 of 7: check (T0) 1.3 s of 15; test (T1) 3.0 s of 90, 178 tests;
  doctrine 8 of 8 (legend 792/800, worst catalog row 40/40, 10 files frozen); vectors byte for byte; tiers 1a and 2;
  migrate --check (525 clips); the migrated clips validate and decode like their sources. The verifier's 7 findings
  (frame wording, ranges, fit, CMU notice, W005 reasons, ledger, changelog) are fixed (D32); notes in F1.
