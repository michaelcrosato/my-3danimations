# hello: the first-flight demo

**Lab, 2026-10-12** (PLAN.md WP-4.6). **The question:** can a game put a character that idles, walks, runs, jumps
and attacks on screen through the package alone, with every move checked by the sensors and drivable without a
display? It reaches past `@m3a/three`'s entry for the generated test characters, which are fixtures, not API.

- `npm run hello` serves it; `npm run hello -- build` writes `dist/`, which `vercel.json` deploys once the owner links
  the project (O3). Until then the demo runs locally and in CI's e2e (`npm run e2e -- hello`), whose frames and
  contact sheet are kept in the `check-output-t2` artifact.
- **Keys:** WASD or the arrows move, Shift runs, Space jumps, J attacks. Phones get a stick and buttons.
- **Deep links:** `?char=gen-<seed>` (any generated character), `?clip=SET/Name` (one clip alone, looping),
  `?t=<seconds>` (paused there), `?view=front|side|back|top|three-quarter`, `?renderer=webgl2`.
- **Console:** `__m3a.state()`, `__m3a.play("walk" | "run" | "jump…" | "attack")`, `__m3a.step(n, input?)`,
  `__m3a.hash()`, `__m3a.points()`.
- `src/game.ts` is the game without a renderer: Node runs it too, so the page's hashes are checked against Node's.
