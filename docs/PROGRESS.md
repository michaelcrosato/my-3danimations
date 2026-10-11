# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 2 The airframe. **Next gate:** G2. **Version:** 0.6.0.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-35xhjq`.

## Done

- Phase 0 (G0 passed, merged as michaelcrosato/my-3danimations#4): doctrine, toolchain, doctrine checks, pins and
  vectors (7.1 MB, tiers 1a to 3), CI and the session hook.
- WP-1.1 The motion spec: `spec/MOTION.md` 2.0-rc and `spec/LEGEND.md` (792 of 800 tokens, a real worked key).
- WP-1.2 Schemas and the validator: 30 coded rules with fixtures; the schemas agree (Ajv); all 762 seed clips pass
  with 0 errors (D25).
- WP-1.3 The codec: tier 1a bit for bit, tier 2 equal to the micrometre at all 7,444 samples; format 2's hand,
  fingers and spine (D26, D27).
- WP-1.4 The skeleton profile: `SKELETON.md`; recognize exact on 8 tables, topology fallback; measure bit for bit
  (D28).
- WP-1.5 The seed sets migrated: 5 sets, 525 clips, 0 errors, warnings baselined per clip with reasons (D30).
- G1: spec 2.0-rc frozen and held by the doctrine (D31); the verifier's 7 findings fixed (D32).

## Next

- WP-2.1 The math kernel: portable math (V8's bits), helpers, seeded streams, `hashNumbers`, V8 against JSC.

## Blocked on the owner

- Nothing yet.

## Last gate

- **G1 passed** 2026-10-11 at 6bffb3e in 11.0 s, 7 of 7: check (T0) 1.3 s of 15; test (T1) 3.0 s of 90, 178 tests;
  doctrine 8 of 8 (legend 792/800, worst catalog row 40/40, 10 files frozen); vectors byte for byte; tiers 1a and 2;
  migrate --check (525 clips); the migrated clips validate and decode like their sources. The verifier's 7 findings
  (frame wording, ranges, fit, CMU notice, W005 reasons, ledger, changelog) are fixed (D32); notes in F1.
