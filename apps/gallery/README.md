# The gallery

The owner's ground station (PLAN.md WP-8.1): browse and search the library's sets (every tier, the tier shown), play
any clip on any test character in 3D, read its metrics, timeline and contact sheet, and open the example recipes
(compiled and played) and graphs (their states, and their scripted simulation played in 3D). Phone first (390x844,
touch); two columns on a desk. The build stamp (version and commit) is on every view.

- `npm run gallery` serves it with live reload; `npm run gallery -- build` writes `apps/gallery/dist`; `npm run gallery
  -- preview` serves that build. `npm run e2e -- gallery` builds it and drives it headless at a phone's viewport; its
  screenshots go to `check-output/gallery/`. T1 (`npm test`) runs its unit
  tests (the pure parts: links, review batches, what a card says a clip should show), and `npm run e2e -- previews` runs the build's batch check on a
  refused batch of each kind.
- **Characters:** `gen-<seed>` (any whole number; 0 to 19 are the test set) built in code, and the real CC0 rigs that
  `npm run fixtures -- fetch` put in `.cache/fixtures/` (none in a build without them). A test character wears the
  contact sheets' colours (its left side blue, its middle and right amber), its torso's and head's back half darker and a
  red nose, so which way it faces reads at a glance; a legend beside it says so (F.14).
- **Playing as the data says (F.14):** the character is placed where the root stands and turned only by what its bones
  don't carry: a pose carries its clip's own turn, `@m3a/three`'s attach writes it turned by the Animator's `turn` beyond
  that, and a clip posed by time alone leaves the stage a loop's earlier cycles (the player's `turn`), so a clip's turn
  shows once. `src/playback.test.ts` compares the character the gallery plays with each clip's data at 8
  moments (facing, travel's direction, each limb's direction): the clips that turn on `gen-1` in T1, every clip on
  `gen-1` and `gen-0` in T2.
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
  values read, never the file. The page says which batch is open and links the others; opening one decides nothing.
  **The guide** (WP-F.12) sits at the top, open on a first visit; closed, it stays closed in that browser (its storage,
  read by an inline line before the page shows, so a closed guide never flashes open; a private window opens it
  again). It says, in these words or near them:
  - *These clips* are sampled from the library that AI agents use to put motion into games: someone making a game asks
    an agent for "a character running away", and the agent picks clips from this library.
  - *How an agent chooses a clip:* by its words (its name, tags and description) and its numbers (how fast it travels,
    whether it loops, how long it is). It never watches the clip play: at most it reads a short summary a computer makes
    of the movement ("walks", "in the air", `m3a describe`) or looks at a few still frames (`sheet`, `film`). So a clip
    whose words don't match its motion misleads every agent that picks it.
  - *What the sensors already check:* feet sliding on the ground, sinking into the floor, sudden jumps between frames,
    arms or legs passing through the body. *What they can't:* whether a clip is what its words say, and whether it
    looks natural and alive. That is the reviewer's part. Each card's PASS, WARN or FAIL is the sensors' result; a
    WARN, or a frame marked red on its preview sheet, is where to look closely. It doesn't decide for you.
  - *For each card:* press Play and watch it; read "What it should show"; **Approve** if a game developer asking for
    exactly this would be happy with it; **Flag** if it looks broken, doesn't match its words (called a run but it is a
    walk, an idle that is a frozen pose, a jump that never leaves the ground), or no game could use it, saying why in a
    few words (an idle needn't travel, but its body should move). A note starting "task:" proposes something to fix or
    build; "threshold:" says a sensor's limit looks wrong.
    A submission is adopted, archived or rejected the same way.
  - *When you are done:* press Export review at the bottom and send the file back to whoever asked for the review
    (they apply it with one command, `m3a review ingest`). Playing a clip or reading a card decides nothing.

  Each card says, under its name and above its Play and its verdicts, **What it should show** (`src/review/shows.ts`):
  what an agent reads about the clip, from the clip itself (a sampled clip's file as the page's library holds it; a
  submission's own clip, a recipe compiled, its facts measured on the page as adoption measures them, `withFacts`,
  never taken from its file): its description (or that it has none, itself worth a flag), whether it loops or plays
  once and its length in seconds, whether it travels, which way in its own frame (forward, backward, to its left or
  right, or between) and, from its speed fact, how fast in metres a second on the library's reference body (0.95 m
  hips: the m/s search shows an agent) and as a grown-up's pace (a shuffle, a slow walk, a walk, a brisk walk or slow
  jog, a jog, a run, a sprint); a one-shot by where it ends, in metres; one that doesn't travel says just that ("Doesn't
  travel across the floor", never that it holds still: a frozen idle is the reviewer's to flag); and its tags. Each
  card's words come as its clip is read, alongside its preview sheet. `m3a show <SET/Name>` reads the same from the
  CLI. Each card
  also has its preview sheet, numbers, check report and diff; a
  **Play** that plays its clip, looping, right in the card on `gen-1` at the sheet's view (the gallery's own stage and
  player; one stage for the page, so starting a card stops the one playing, and three.js loads at the first Play; with
  nothing playing the page draws no frame); and
  a link opening the clip in the gallery in a new tab (`?clip=SET%2FName`; a submission's, the clip it improves) for
  slow motion, frame by frame and any view. Rows are decided by touch (one row or a batch) and exported as a review
  for `m3a review ingest <file>` (the share sheet on a phone, a download on a desk); playing decides nothing.
  `?renderer=webgl2` forces WebGL 2 there too. `__m3a` there is its handle (`state`, `open`, `batch`, `play`, `stop`,
  `playing`, `frame`, `decide`, `export`, `described` (resolves when every card says what its clip should show),
  `drawn` ...). **The contributor
  page** (`src/contributors/`): getting and revoking a key once O8's project is linked (the build's
  `VITE_M3A_INTAKE_URL` and `VITE_M3A_INTAKE_KEY`, the publishable key), and how agents submit locally until then.
- **Nothing only here:** `src/actions.ts` lists each action and the m3a tool or command that does the same (a per-clip
  call notes that the CLI and MCP take a cc-by or cmu clip once its tier is in game.json's `"tiers"`; the page opens
  every tier); the e2e test checks every tool it names is in the registry. Every number and picture on the page is a
  tool's reply.
