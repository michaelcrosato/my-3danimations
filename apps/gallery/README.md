# The gallery

The owner's ground station (PLAN.md WP-8.1): browse and search the library's sets (every tier, the tier shown), play
any clip on any test character in 3D, read its metrics, timeline and contact sheet, and open the example recipes
(compiled and played) and graphs (their states, and their scripted simulation played in 3D). Phone first (390x844,
touch); two columns on a desk. The build stamp (version and commit) is on every view.

- `npm run gallery` serves it with live reload; `npm run gallery -- build` writes `apps/gallery/dist`; `npm run gallery
  -- preview` serves that build. `npm run e2e -- gallery` builds it and drives it headless at a phone's viewport; its
  screenshots go to `check-output/gallery/`. T1 (`npm test`) runs its unit
  tests (the pure parts: links, review batches), and `npm run e2e -- previews` runs the build's batch check on a
  refused batch of each kind.
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
- **The review queue** (`src/review/`, linked from the browse panel; WP-8.2b, WP-F.11): it opens a queue at load: the
  batch its link names (`?queue=G8-run-1/queue-0.56.0`), else a queue bundled at build time (the
  check-output/review/queue.json `m3a review export` wrote, when `M3A_REVIEW_QUEUE=1` asks: a local build's alone),
  else the newest review batch the build carries; "Open a queue file" opens any other. The batches are the committed
  queues of library clips alone: of `bench/results/gates/<gate>/queue*.json`, each gate's newest (an export made
  again supersedes the one before) when it holds no submission, G8's; the preview site (`npm run site`) and a local
  `npm run gallery` carry the same, the site saying which it left out and why. `M3A_REVIEW_BATCHES` names others
  (paths, commas between; `none` for none). Each is checked whole: a batch holding a submission, or a key or value a
  library clip's row hasn't, fails the build (a contributor's text never goes into a page), and the page gets the
  values read, never the file. The page says which batch is open and links the others; opening one decides nothing. Each card has its preview sheet, numbers, check report and diff; a
  **Play** that plays its clip, looping, right in the card on `gen-1` at the sheet's view (the gallery's own stage and
  player; one stage for the page, so starting a card stops the one playing, and three.js loads at the first Play; with
  nothing playing the page draws no frame); and
  a link opening the clip in the gallery in a new tab (`?clip=SET%2FName`; a submission's, the clip it improves) for
  slow motion, frame by frame and any view. Rows are decided by touch (one row or a batch) and exported as a review
  for `m3a review ingest <file>` (the share sheet on a phone, a download on a desk); playing decides nothing.
  `?renderer=webgl2` forces WebGL 2 there too. `__m3a` there is its handle (`state`, `open`, `batch`, `play`, `stop`,
  `playing`, `frame`, `decide`, `export` ...). **The contributor
  page** (`src/contributors/`): getting and revoking a key once O8's project is linked (the build's
  `VITE_M3A_INTAKE_URL` and `VITE_M3A_INTAKE_KEY`, the publishable key), and how agents submit locally until then.
- **Nothing only here:** `src/actions.ts` lists each action and the m3a tool or command that does the same (a per-clip
  call notes that the CLI and MCP take a cc-by or cmu clip once its tier is in game.json's `"tiers"`; the page opens
  every tier); the e2e test checks every tool it names is in the registry. Every number and picture on the page is a
  tool's reply.
