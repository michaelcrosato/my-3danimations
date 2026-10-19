# consumer-ts: the TypeScript consumer proof

**Lab, 2026-10-19** (PLAN.md WP-10.1). **The question:** can a game shaped like my-3dge (three.js r182, a fixed
60 Hz sim stepped as its engine steps, a sim hash that never depends on posing) drive graph-driven humanoids with hit
events and root motion through the package's public API alone, the same in Node and in a browser? The answer and
the migration it argues for are in `docs/MIGRATING.md`. It reaches past the manual in one place: the page reads the
library from files its Vite config bundles with `@m3a/library/node`'s `defaultSets` and `directory` (gap 1 there).

- **What plays:** a hero and a training dummy (generated test characters, seeds 1 and 2, 6 m apart) on one graph,
  `data/duel.graph.json`: stand, walk and jog by `speed` (a blend kept in step), a slash
  (`data/slash.recipe.json`: `MESH2MOTION/Sword_Attack` with a `hit` event at its strike) and a flinch from the
  waist up on `hurt`. The sim (`src/game.ts`) steps both Animators once a tick, moves each by its root motion, and
  its rules land a `hit` on a fighter within 1.8 m in front, which loses 25 hp and flinches.
- **The session:** `data/session.sim.json`, the hero's input in m3a's sim format (spec/SIM.md), so `m3a graph.sim`
  and `sim.simulate` read it too; `intents()` turns it into one intent a step.
- **Serve it:** `node_modules/.bin/vite --config apps/lab/consumer-ts/vite.config.ts` (W or ↑ walks, Shift jogs, J
  slashes; `?renderer=webgl2`, `?paused=1`). **Check it:** `npm run e2e -- consumer-ts`, whose screenshots and
  `session.json` go to `check-output/consumer-ts/`.
- **Console:** `__m3a.state()`, `__m3a.hash()`, `__m3a.step(n, { speed, attack })`, `__m3a.session()` (the scripted
  session from a fresh duel, posed every step), `__m3a.pause(on)`.
