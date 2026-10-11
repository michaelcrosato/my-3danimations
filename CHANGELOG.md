# Changelog

One version for every `@m3a` package and the spec (`node tools/version.ts`). While the major number is 0: minor for
features, patch for fixes. One line per change, under the part it touched (**Spec**, **Core**, **Sensors**, **IO**,
**Library**, **Three**, **Tools**, **Repo**, **Docs**).

## 0.6.0 · 2026-10-11

### Library
- WP-1.5: the seed sets in format 2: QUATERNIUS_3D2DGE (88), QUATERNIUS_SHARDFALL (102), MESH2MOTION (177),
  CMU_CURATED (60, tier cmu, CMU's full notice), STYLE100 (98, tier cc-by): 525 clips, each with `_set.json`,
  `catalog.tsv` (rows within 40 tokens) and `_baseline.json`.

### Tools
- WP-1.5: `npm run migrate [-- --check]`.

### Core
- WP-1.3's verifier fixes: hand roll unwraps; fingers curl toward the palm normal; `fromFormat1` takes the method;
  the normalized lens; format 2's fields get vectors (`tier2/FORMAT2.json`).

## 0.5.0 · 2026-10-11

### Spec
- WP-1.4: `spec/SKELETON.md`: VRM 1.0's humanoid (55 bones, 15 required), frames, rest measurement, body points on
  bones, the mapping tables, recognize's output, the Khronos watch.

### Core
- WP-1.4: `skeleton/`: `recognize` (8 tables and a topology fallback), `patchMapping`, `restFrame` (T, A or relaxed),
  `measure` (the origin's, bit for bit) and `restPoints`.

## 0.4.0 · 2026-10-11

### Core
- WP-1.3: the codec (`format/`): decode onto a rest body, encode from body points, sampling, RDP and fit (one budget
  or one per region), format 1's text and parse, the format-2 key lens, mirror, the canonical clip file, slugs, the
  motion hash's input, and reading format 1. Format 2's hand, fingers and spine decode; hands and fingers encode.

### Spec
- WP-1.3: conformance tiers 1a (bit for bit) and 2 (to the micrometre) pass; tier 2's vectors carry their input clips.

## 0.3.0 · 2026-10-11

### Spec
- WP-1.2: JSON Schemas for a clip, a set manifest and a catalog row (`spec/schemas/`), with stubs for recipes and
  graphs.

### Core
- WP-1.2: `validate(data, { mode, kind })`: 30 coded rules (20 clip errors, 6 warnings, 4 set and catalog errors),
  messages of at most two lines naming the clip, key, time and field; `read` accepts unknown fields, `lint` flags
  them with the nearest name. The format-2 types and key-field table.

## 0.2.0 · 2026-10-11

### Spec
- WP-1.1: `spec/MOTION.md`, the motion format 2.0-rc (frame and units, every field with its range, the new optional
  hand, fingers, spine and yaw fields, contacts, events, facts, provenance with IPTC source types, quality, review,
  sampling, limits, versioning, ids, sets and content ids, numerics), and `spec/LEGEND.md` (792 of 800 tokens with a
  worked key).

## 0.1.0 · 2026-10-11

### Repo
- WP-0.1: the doctrine (`DOCTRINE.md`), the agent rules (`AGENTS.md`), the decisions log (D1 to D21), the feedback log
  and the progress page.
- WP-0.2: npm workspaces for the six `@m3a` packages, strict TypeScript with project references, ESLint, Vitest and
  Playwright on the preinstalled Chromium; the tiers `check` (T0), `test` (T1) and `e2e` (T2) with their budgets,
  `test:changed`, `gate`, the header lint and `tools/version.ts`.
- WP-0.3: `npm run doctrine` (also in T0): binaries, cl100k token budgets, import boundaries, banned APIs, exact
  pins and checksums, the append-only decisions log and the local lane.
- WP-0.5: CI (T0 and T1 on every push, T2 on pull requests, gates by manual dispatch; actions pinned by SHA), the
  SessionStart hook (`npm ci`, `CHROMIUM_PATH`) and the pull request template.

### Spec
- WP-0.4: the conformance vectors (`spec/vectors/`, tiers 1a, 1b, 2 and 3, plus two frozen fixtures from my-3dge),
  `spec/conformance/tiers.md` and the TypeScript runner; `npm run pins` and `npm run vectors` with `--check`.
