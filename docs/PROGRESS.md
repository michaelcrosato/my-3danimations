# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 1 The language. **Next gate:** G1. **Version:** 0.4.0.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-35xhjq`.

## Done

- Phase 0 (G0 passed, merged as michaelcrosato/my-3danimations#4): doctrine, toolchain, doctrine checks, pins and
  vectors (7.1 MB, tiers 1a to 3), CI and the session hook.
- WP-1.1 The motion spec: `spec/MOTION.md` 2.0-rc and `spec/LEGEND.md` (792 of 800 tokens, a real worked key).
- WP-1.2 Schemas and the validator: 30 coded rules with fixtures; the schemas agree (Ajv); all 762 seed clips pass
  with 0 errors (D25).
- WP-1.3 The codec: tier 1a bit for bit, tier 2 equal to the micrometre at all 7,444 samples; format 2's hand,
  fingers and spine (D26, D27).

## Next

- WP-1.4 the skeleton profile, 1.5 the migration, then G1.

## Blocked on the owner

- Nothing yet.

## Last gate

- **G0 passed** 2026-10-11 at bae664e in 5.1 s: check (T0) 1.3 s of 15, test (T1) 1.3 s of 90 with 41 tests,
  doctrine 7 of 7 checks, vectors 13 files byte for byte (7.1 of 10 MB). CI green on the PR. The verifier's 4 findings
  (ledger rows, PR body, `.gltf` loosening the binaries check) are fixed (D24). PR michaelcrosato/my-3danimations#4.
