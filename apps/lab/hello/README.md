# hello: the first-flight demo

**Lab, 2026-10-12** (PLAN.md WP-4.6). **The question:** can a game put a character that idles, walks, runs, jumps
and attacks on screen through the package alone, with every move checked by the sensors and drivable without a
display? It never reaches past the public API (`npm run doctrine` lists no reach-past here); it reads the library's
files by path (`src/library.ts`, bundled by Vite), not through `@m3a/library`, which came after it (WP-5.1).

**Status:** answered yes at G4 (D88), and kept as G4's standing demo, whose e2e runs in T2 at every gate until that
check moves to the package tier (D118).

- `npm run hello` serves it; `npm run hello -- build` writes `dist/`. The preview site (`npm run site`, what
  `vercel.json` builds for every branch; WP-8.3) serves it at `/labs/hello/`; the Vercel project is paused by the
  owner (O3, D85), so the demo runs locally and in CI's e2e (`npm run e2e -- hello`), whose frames and contact sheet
  are kept in the `check-output-t2` artifact.
- **Keys:** WASD or the arrows move, Shift runs, Space jumps, J attacks. Phones get a stick and buttons.
- **Deep links:** `?char=gen-<seed>` (any generated character), `?clip=SET/Name` (one clip alone, looping),
  `?t=<seconds>` (paused there), `?view=front|side|back|top|three-quarter`, `?renderer=webgl2`.
- **Console:** `__m3a.state()`, `__m3a.play("walk" | "run" | "jump…" | "attack")`, `__m3a.step(n, input?)`,
  `__m3a.hash()`, `__m3a.points()`.
- `src/game.ts` is the game without a renderer: Node runs it too, so the page's hashes are checked against Node's.
