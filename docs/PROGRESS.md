# Progress

The current state on one screen (at most 40 lines; `npm run doctrine` checks it from WP-0.3). The ledger is
`PLAN.md` §14; decisions are in `docs/DECISIONS.md`.

**Phase:** 1 The language. **Next gate:** G1. **Version:** 0.1.0.
**Mode:** one agent (D21), branch `claude/relaxed-albattani-35xhjq`.

## Done

- WP-0.1 Constitution: `DOCTRINE.md`, `AGENTS.md`, `CLAUDE.md`, decisions D1 to D21 (O1, O7, O8, O11 and the CMU and
  Mesh2Motion confirmation logged), the feedback log, this file.
- WP-0.2 Toolchain: six `@m3a` workspaces; T0 `check` 3.0 s (budget 15), T1 `test` 1.3 s (90), T2 `e2e` 6.4 s (480)
  on Chromium 1194 with WebGL 2; `test:changed`, `gate`, header lint, `tools/version.ts` (D22).
- WP-0.3 Doctrine checks: `npm run doctrine`, 7 checks in 0.2 s, run in T0; each has a failing fixture.
- WP-0.4 Pins and vectors: 5 repos pinned; vectors regenerate byte for byte (7.1 of 10 MB): tier 1a/1b (tiny rig,
  CMU 09_02; equal to shardfall's expected sets), tier 2 (325 clips), tier 3 (11 bodies); D23, D24.
- WP-0.5 CI and session setup: CI green on the PR (T0+T1 on push, T2 on the PR); the hook installs in 2.6 s.

## Next

- Phase 1, the language: WP-1.1 the motion spec, on a fresh draft PR after Phase 0 merges.

## Blocked on the owner

- Nothing yet.

## Last gate

- **G0 passed** 2026-10-11 at bae664e in 5.1 s: check (T0) 1.3 s of 15, test (T1) 1.3 s of 90 with 41 tests,
  doctrine 7 of 7 checks, vectors 13 files byte for byte (7.1 of 10 MB). CI green on the PR. The verifier's 4 findings
  (ledger rows, PR body, `.gltf` loosening the binaries check) are fixed (D24). PR michaelcrosato/my-3danimations#4.
