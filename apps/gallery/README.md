# The gallery

The owner's ground station (PLAN.md WP-8.1): browse and search the library's sets (every tier, the tier shown), play
any clip on any test character in 3D, read its metrics, timeline and contact sheet, and open the example recipes
(compiled and played) and graphs (their states, and their scripted simulation played in 3D). Phone first (390x844,
touch); two columns on a desk. The build stamp (version and commit) is on every view.

- `npm run gallery` serves it with live reload; `npm run gallery -- build` writes `apps/gallery/dist`; `npm run gallery
  -- preview` serves that build. `npm run e2e -- gallery` builds it and drives it headless at a phone's viewport; its
  screenshots go to `check-output/gallery/`.
- **Characters:** `gen-<seed>` (any whole number; 0 to 19 are the test set) built in code, and the real CC0 rigs that
  `npm run fixtures -- fetch` put in `.cache/fixtures/` (none in a build without them).
- **Deep links** open everything: `?set=SET` (its catalog), `?clip=SET/Name`, `?recipe=Name` (`spec/recipes/`),
  `?graph=Name` (`spec/graphs/`, driven by the longest script in `spec/sims/` written for it, else one pressing its
  triggers, stepped by graph.sim's own stepper, `sim.SimStepper`), `?char=gen-<seed>|<rig>`,
  `?view=three-quarter|front|side|back|top|orbit`, `?t=<seconds>` (paused there, to the microsecond), `?rate=0.1..2`,
  `?panel=browse|clip|metrics|sheet|recipes|graphs`, `?q=<search>`, `?renderer=webgl2`. What plays: the clip, else the
  recipe, else the graph, else the set's first clip. The page keeps its link in step with what it shows: a pause, a
  frame step or a scrub holds the moment to the microsecond the link writes, so the link reopens the same pose, bit for
  bit. When a second link opens while the first still loads, the second wins.
- **Keys:** Space plays and pauses, the arrows step a frame (a clip's 1/fps from the nearest whole frame, a script's
  step).
- **Console:** `__m3a.state()` (the route, the link, what plays with its time and root, the camera's view and angles,
  the panel's replies), `__m3a.open("?clip=..." | { clip, view, ... })` (resolves when shown), `play()`, `pause()`,
  `step(n)`, `seek(t)`, `hash()` (the bones' proof hash, as Node's), `frame()` (a frame read back), `entered()` (a graph
  run's states), `replies()` (the panel's tool replies whole), `actions()`, and `__M3A_TOOLS__` (every m3a tool, on the
  gallery's host).
- **Labs:** the browse panel links the labs index (`./labs/`), which the preview site (`npm run site`) serves beside
  the gallery; the gallery's own server (`npm run gallery`) has no labs, so the link 404s there.
- **The review queue** (`src/review/`, linked from the browse panel; WP-8.2b): the queue `m3a review export` wrote
  (bundled at build time from check-output/review/queue.json when `M3A_REVIEW_QUEUE=1` asks, or a file opened on the
  page), each row's preview sheet, numbers, check report and diff, decided by touch (one row or a batch) and exported
  as a review for `m3a review ingest <file>` (the share sheet on a phone, a download on a desk); `__m3a` there is its
  handle. **The contributor
  page** (`src/contributors/`): getting and revoking a key once O8's project is linked (the build's
  `VITE_M3A_INTAKE_URL` and `VITE_M3A_INTAKE_KEY`, the publishable key), and how agents submit locally until then.
- **Nothing only here:** `src/actions.ts` lists each action and the m3a tool or command that does the same (a per-clip
  call notes that the CLI and MCP take a cc-by or cmu clip once its tier is in game.json's `"tiers"`; the page opens
  every tier); the e2e test checks every tool it names is in the registry. Every number and picture on the page is a
  tool's reply.
