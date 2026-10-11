# Changelog

One version for every `@m3a` package and the spec (`node tools/version.ts`). While the major number is 0: minor for
features, patch for fixes. One line per change, under the part it touched (**Spec**, **Core**, **Sensors**, **IO**,
**Library**, **Three**, **Tools**, **Repo**, **Docs**).

## 0.1.0 · 2026-10-11

### Repo
- WP-0.1: the doctrine (`DOCTRINE.md`), the agent rules (`AGENTS.md`), the decisions log (D1 to D21), the feedback log
  and the progress page.
- WP-0.2: npm workspaces for the six `@m3a` packages, strict TypeScript with project references, ESLint, Vitest and
  Playwright on the preinstalled Chromium; the tiers `check` (T0), `test` (T1) and `e2e` (T2) with their budgets,
  `test:changed`, `gate`, the header lint and `tools/version.ts`.
