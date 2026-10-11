# Doctrine

Adopted 2026-10-11 as D1 (`docs/DECISIONS.md`), from `PLAN.md` §3. The text below is §3 verbatim, with its headings
raised one level; the last section, "In this repository", says how each principle is enforced here.

## How to read this

Read this as a trusted, capable manager building a package that you and others will use. Every principle is a default
with a reason. When the reason doesn't hold, deviate and say why. A deviation with a case for it is welcome: variation is
how discovery works.

## North Star

Put high-quality character motion into games through agents alone. The jobs are find, fit, wire, make, check, ship and
grow, all done in text and code and verified without a display. Leave behind the tools and methods agents can't use
well.

The analogy is an autonomous fighter jet with no cockpit, flown from a ground station. Removing the pilot removes the
constraints a human imposes on the design. The ground station is where humans set direction and judge quality, and
agents fly.

**What we optimize:** verified, shippable motion in games per unit of agent time and tokens.

**How we measure it:**
- the fresh-agent benchmark: first-try success, time and tokens per brief, per model;
- the library: the clips passing every gate, and the owner's approval rate on sampled reviews;
- the sensors' distributions across the library (foot sliding, penetration, pops), which may only improve.

## Two tiers

- **The package** is the spec, core, sensors, adapters, library, tools and docs. It is built once and used by every
  game, so it gets the care, the checks, the versions and the manual.
- **Labs** (`apps/lab/`, each with a date and the question it answers) find what is worth building. A lab may reach past
  the API and deviate from any principle except 4, saying so in one line. It graduates into the package or is deleted.

## Principles

1. **Agent-readable.** An agent uses the package from the manual alone, and the manual has a measured budget (8,000
   tokens).
   - Every clip reads as text: the legend fits in 800 tokens (with one worked key), a catalog line in 40, and a
     typical clip in about 3,000.
   - No model has seen this format in pretraining. The legend, the manual and the skill stand in for that exposure,
     and they version with the schema.
   - Source files are small, each with a header saying what it holds, and names are easy to grep.
2. **Agent-operable.** Every capability has a typed API, a CLI command and an MCP tool, all from one registry, plus a
   console handle on every page. A GUI is a view over them, never the only way in.
3. **Verifiable without a display.**
   - The sensors measure motion from skeleton data, and contact sheets and filmstrips are rendered in software,
     deterministically.
   - Agents judge by numbers first and pictures second, and humans judge feel at the ground station.
   - The package ships its own test harness.
4. **Text is the source of truth.**
   - Motion, skeletons, recipes, graphs, catalogs and provenance are text an agent can read, diff and edit.
   - Binaries exist only at the edges: import, export, and runtime tracks generated from text.
   - Binaries are reproducible from text plus pinned sources, and are never committed unless they are on an approved
     list.
5. **Deterministic by construction** (invariant). The same inputs give the same numbers, bit for bit, in Node and in the
   browser, with any renderer or none. Hashed paths use the package's portable math.
6. **A core that never touches a renderer** (invariant). The core imports no renderer, DOM, GPU or Node built-in.
   Adapters translate its output. It runs anywhere JavaScript runs, and its spec lets other languages certify against
   it.
7. **Common ground.**
   - Use TypeScript, JSON, JSON Schema, glTF, VRM's bone names and three.js.
   - Don't invent a house idiom where a standard exists.
   - The new parts (the format, recipes, graphs) are small and explain themselves.
8. **Quality under the hood.**
   - Solving, retargeting, contact handling and fitting use the best method the builder can execute well, behind a
     small API.
   - Errors speak the API's language and suggest the fix.
   - A check lists everything that reaches past the API.
9. **Pin what agents know.** Use the dependency versions agents write correctly without docs, checked by a cold write.
   Pin them exactly, and ban the stale APIs agents reach for out of habit.
10. **Provenance on everything.**
    - Every clip records its source, its SPDX license, its method (captured, keyed, procedural, composed, edited or
      generated), its producer (tool, version, model), its lineage and its measured quality.
    - No clip lacks them.
    - Games get a credits list from a tool.
11. **The library grows through gates, not trust.** Every contribution, human or AI, comes in through the same intake
    queue, passes the same automated gates, and is adopted only after a human review. A flaw that slips through becomes
    a new check.
12. **Discovery first, hardening later, except the contract.**
    - Develop on one platform: Linux, Node and headless Chromium.
    - The exception is the contract: the spec, the vectors and the format's versioning. Every game and every port
      depends on them, so they are versioned and migrated from day one.

## Checks

Each promise has a check, run on every change and chosen by what changed:
- the manual's examples run and fit its budget;
- the import boundaries hold;
- no banned APIs are used;
- pinned versions and checksums match;
- the conformance vectors and the determinism hash match in Node and Chromium;
- no binaries exist outside the approved list;
- every clip validates and carries provenance, license, fit and a QA verdict;
- the token budgets hold.

A principle without a check drifts.

## Deviations and escalation

- **In a lab:** deviate when it helps, and say so in one line in its entry.
- **In the package, a reversible call** (anything a revert undoes: code, design, a dependency, a doc): make it now, in its
  own commit. Flag it in the pull request and log it in `docs/DECISIONS.md`.
- **In the package, a call that is hard to undo.** These reach outside the repository or can't be reverted: publishing,
  spending, a license, deleting what others rely on, acting in another repository.
  1. Escalate, naming the principle, the options and your recommendation.
  2. Arm a 15-minute wake-up: `send_later` with `delay_minutes: 15`, cancelled with `delete_trigger` if an answer comes
     first.
  3. Keep working on whatever doesn't depend on the answer. With nothing left, end the turn.
  4. If the wake-up fires with no answer, take the default from §13 in its own commit and log it. For publishing,
     spending and acting in another repository, the default is always "don't".
- **Every call made without an answer** goes in the decisions log and in the PR description. The log is never cleaned
  up.
- **A deviation that keeps winning** is a proposal to change this doctrine.

## In this repository

How each principle is held here. "Check" names the command that fails when it drifts; checks marked *(WP-n.m)* land in
that work package and are listed here so the gap is visible until then. `npm run doctrine` (WP-0.3) runs the static
ones.

| Principle | Rule here | Check |
|---|---|---|
| 1 Agent-readable | The manual is at most 8,000 cl100k tokens; the legend with one worked key at most 800; a catalog row at most 40; `docs/PROGRESS.md` at most 40 lines. Every source file opens with a header comment saying what it holds | `npm run doctrine` token budgets; the header lint in `npm run check` |
| 2 Agent-operable | Every capability is one `defineTool` entry, surfaced as API, `m3a` command, MCP tool and console handle; a GUI never holds the only way in | registry tests: every example runs, CLI and MCP agree *(WP-7.1, 7.2)* |
| 3 Verifiable without a display | Sensors measure skeleton data; sheets and films are drawn by the software raster; images go to `check-output/` and are never committed | planted-defect suite at 100% recall *(WP-3.6)*; non-blank image check *(WP-3.1)* |
| 4 Text is the source of truth | No binaries outside the approved list (empty at adoption); test characters are generated in code, real rigs fetched by SHA-256 into `.cache/` | `npm run doctrine` binaries; `npm run pins -- check` |
| 5 Deterministic by construction | Hashed paths use the package's portable math; no `Math.random`, wall clock or iteration-order dependence in core | determinism hash in Node and Chromium; V8 vs JavaScriptCore bit parity *(WP-2.1, 2.6)* |
| 6 A core that never touches a renderer | `@m3a/core` imports nothing outside itself: no DOM, no `node:`, no three; other packages keep Node built-ins in a `/node` entry | `npm run doctrine` import boundaries; core's lint and tsconfig (no DOM, Node or clock) |
| 7 Common ground | TypeScript, JSON, JSON Schema, glTF, VRM bone names, three.js; no house idiom where a standard exists | review against this table (§8.3 item 5) |
| 8 Quality under the hood | Errors use the API's words and suggest the fix; anything that reaches past the API is listed | `npm run doctrine` lists labs' reach-pasts; error-message tests per tool *(WP-7.1)* |
| 9 Pin what agents know | Exact versions in `package.json`; three.js r182 by default with r186 also tested; stale APIs banned | `npm run doctrine` pins and banned APIs (the list fills in WP-4.1) |
| 10 Provenance on everything | Every clip carries source, SPDX license, method, producer, lineage and measured quality; a credits tool exists | validator: provenance required *(WP-1.2)*; `npm run license -- check` *(WP-5.7)* |
| 11 The library grows through gates | One intake queue; the same automated checks for every contributor; the owner adopts every clip (O7) | intake contract suite *(WP-9.1)*; planted bad submissions bounced *(G9)* |
| 12 Discovery first, except the contract | Linux, Node 24 and headless Chromium only; the spec, vectors and format versioning are versioned from day one | `npm run vectors -- --check`; conformance tiers *(WP-1.3 on)* |
| Process | The decisions log is append-only; nothing under `library/local/` but its README is committed | `npm run doctrine` decisions log and local lane |
