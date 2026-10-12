# AGENTS.md: rules for every change

my-3danimations is an open animation package for AI coding agents: a motion spec, a deterministic TypeScript runtime
(`@m3a/core`), sensors, a three.js adapter, a library of licensed clips, one tool registry (API, `m3a` CLI, MCP), a
gallery for the owner and an intake queue. `PLAN.md` is the execution plan; `DOCTRINE.md` says what we optimize and
why. This file is how.

## What to read

- **Once per session:** `docs/FEASIBILITY.md` §0, `PLAN.md` §0 to §3 and §8, and `docs/PROGRESS.md` for where things
  stand.
- **For every work package (WP):** `DOCTRINE.md`, this file, the WP's entry in `PLAN.md` §10 and only the sections and
  files it cites. The plan is a map, not a corpus: don't reread it end to end.
- **Where the truth lives:** `docs/PROGRESS.md` (one screen, the current state), the ledger (`PLAN.md` §14, one row per
  WP), `docs/DECISIONS.md` (never cleaned up), `docs/FEEDBACK-LOG.md` (points not acted on, counted by theme).
- **Writing three.js:** read `docs/THREE.md` first: the pinned release (r182), how to write against it, what is banned.

## Two tiers

- **The package** (spec, core, sensors, adapters, library, tools, docs) is built once and used by every game. It gets
  the checks, the version, the changelog and the manual.
- **Labs** live in `apps/lab/`, each with a date and the question it answers. A lab may reach past the API and deviate
  from any principle except 4 (text is the source of truth), saying so in one line. It graduates into the package or is
  deleted.

## Commands

| Command | Tier | What it runs | Budget |
|---|---|---|---|
| `npm run check` | T0 | typecheck, lint, quick doctrine checks | 15 s |
| `npm test` | T1 | unit, conformance, sensors on a sample | 90 s |
| `npm run e2e` | T2 | browser adapter checks, full library QA | 8 min |
| `npm run test:changed` | | the suites covering files changed against `main`, saying why each ran | |
| `npm run test:cross-engine` | | the portable math, a quaternion chain, the helpers and the Animator's script in V8 and JavaScriptCore (Bun), bit for bit, with each function's cost | |
| `npm run qa [-- --sample N] [--dist] [--check] [--fix]` | | the sensors over the migrated library: verdicts, the metrics that fail most, the distributions the thresholds come from; `--check` against the committed baseline (`--baseline` rewrites it, in a commit that says why); `--fix` lints and fixes every clip, failing on any that comes out worse or invalid | |
| `npm run qa -- library [--check] [--baseline]` | | the library as a whole (WP-5.8): every clip's recorded verdict and reason, reasons whose finding is gone, the census against G5's floors, the distributions against `library/baselines/distributions.json` (they may only improve; `--baseline` records them), `docs/LIBRARY.md` (`--check` compares it); T2 runs it | |
| `npm run fixtures -- fetch \| check [--manifest <file>]` | | the real CC0 rigs (`tools/fixtures/rigs.json`) fetched by SHA-256 into `.cache/fixtures/`, their licenses read; `check` reads the cache alone | |
| `npm run plant [-- --check]` | | plant ten kinds of defect into 100 clean library clips, with the times the sensors must find them (`--check`: the fixtures rebuild byte for byte) | |
| `npm run gate -- G<n>` | Gate | the gate's fixed command set (`PLAN.md` §9.3), with its time | none |
| `npm run doctrine` | | binaries, token budgets, import boundaries, banned APIs, pins, decisions log, local lane | |
| `npm run vectors [-- --check]` | | regenerate the conformance vectors from the pinned originals, or check them byte for byte | |
| `npm run pins -- fetch` | | shallow-fetch the pinned source repositories into `.cache/src/` | |
| `npm run bench -- B<n> --trials 5` | | the fresh-agent benchmark | |

A tool warns when a tier runs over budget and fails it at 1.5×. Never skip a test to get green; a test that waits on
wall-clock time is a bug. In cloud sessions the SessionStart hook runs `npm ci` and exports `CHROMIUM_PATH`; never run
`playwright install`.

## Work rules (`PLAN.md` §8)

- **Order:** the ledger, top to bottom. A WP waits until its **Needs** are done.
- **Template:** every WP has Owns, Needs, Size, Carry, Build, Done when and Verify. Every Done-when claim is proved by a
  Verify command, or marked *(deferred proof: where)*.
- **Sizes** count new lines, tests included: S at most 400, M at most 1,200, L at most 3,000. A WP that would exceed L
  is split.
- **Definition of done:**
  1. Verify exits 0; T0 and T1 are green; T2 is green for anything touched in a browser.
  2. Every Done-when is proved or marked deferred.
  3. Every new module has a header comment and every export a doc comment; generated docs are rewritten.
  4. A new kind of data has a schema, a validator rule, and sensors where they apply.
  5. L WPs and gates get a verifier subagent review against `DOCTRINE.md` and the Done-when list; every finding is
     fixed or answered.
  6. Dependency changes land first, in their own commit.
  7. Decisions and escalations are logged; a deviation from the plan edits the WP entries in the same commit.
  8. The ledger row and `docs/PROGRESS.md` are updated: status, commit, version, a note with the numbers.
  9. A package-tier change bumps the version (`tools/version.ts X.Y.Z`: minor for features, patch for fixes, while
     major is 0) and adds changelog lines.
  10. A WP that names a new `npm run <script>` creates it.
- **Shared files** sit outside every WP's Owns and any WP may append to them in single-agent mode: the export lists in
  `packages/*/src/index.ts`, `CHANGELOG.md` and the version fields, the e2e suite registry in `tests/e2e/`,
  `.mcp.json`, `docs/PROGRESS.md` and the ledger.
- **Clip files change in sequence**, never from two WPs at once, and only through the canonical serializer (core's
  `serialize`, then `@m3a/library`'s writer).
- **Gates:** run `npm run gate -- G<n>`, write the report (numbers, what works, links, what failed, how long) in
  `docs/PROGRESS.md` and on the phase's pull request, then merge that pull request into `main` and start the next phase
  on a fresh draft pull request. A failed gate is fixed forward; one that fails twice is checked against the kill
  criteria (`PLAN.md` §12).
- **Commits:** one per WP at least; dependency changes and reversible deviations in commits of their own.

## Deviating

- **Reversible** (a revert undoes it: code, design, a dependency, a doc): make the call now, in its own commit, flag it
  in the pull request and log it in `docs/DECISIONS.md`.
- **Hard to undo** (publishing, spending, a license, deleting what others rely on, acting in another repository):
  escalate with the principle, the options and a recommendation; arm a 15-minute wake-up (`send_later`,
  `delay_minutes: 15`; cancel with `delete_trigger` if answered); keep working on what doesn't depend on it. With no
  answer, take the default from `PLAN.md` §13 in its own commit and log it. For publishing, spending and acting in
  another repository the default is always "don't".
- **Owner needed** (phone review, sampled approval, linking a hosted project): mark the ledger row `blocked-owner`, post
  exactly what is needed on the pull request, and carry on with everything that doesn't depend on it.

## Code

- TypeScript, strict. Small files, each opening with a header comment saying what it holds; names easy to grep.
- `@m3a/core` imports nothing outside itself. Other packages keep Node built-ins behind a `/node` entry.
- No committed binaries and no committed images: pictures go to `check-output/`, tests commit numbers and hashes.
- Hashed paths use the package's portable math; no wall clock, no unseeded randomness.
