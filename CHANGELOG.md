# Changelog

One version for every `@m3a` package and the spec (`node tools/version.ts`). While the major number is 0: minor for
features, patch for fixes. One line per change, under the part it touched (**Spec**, **Core**, **Sensors**, **IO**,
**Library**, **Three**, **Tools**, **Repo**, **Docs**).

## 0.45.2 · 2026-10-16

### Tools
- `npm run gate` records the commit it ran at and whether the tracked tree differed from it, in the report and at the
  end of its verdict (D91).
- `npm run fixtures -- heldout` says "no rig: seeds only" for a held-out run without a rig.json, and lists each
  variant's seed against the seeds already used (D91).

### Repo
- G6 passed on run 1, 20 of 20: B2, B3, B5, B6 and B7 and their held-out variants 5 of 5 each
  (`bench/results/gates/G6-run-1/`, D91).
- The benchmark hides every checkout of the repository (`git worktree list`), its git directory, the Claude home and
  `~/.claude.json` from each agent; the agent runs in a PID namespace of its own and, where `setpriv` works, without
  CAP_SYS_ADMIN (`ownPids` and `capsDropped` recorded per trial); a timeout ends the whole namespace (D91).
- The benchmark's audit scans what a Write, an Edit or a heredoc written to a file names (for outside and scratch, not
  as reads past the manual), paths in template literals, and another process's `/proc` entry by PID, glob or variable
  (D91).
- B7's brief names the check before the jump; B3's starter check finds the hips with `bind()` (it printed NaN on
  rigify characters), and B3's known-good is graded on a rigify character in T1 (D91).

## 0.45.1 · 2026-10-15

### Core
- Gaits (WP-6.2's close-out, D71): the seam readings `fitGait` and `gaitClip` share are kept by weight, 16 MB across
  all rests, the one read longest ago dropped first, each grid keeping only what is read again; before, they grew with
  each rest (40 gaits of 3 s held 157 MB, and a process over about 100 rests ran out of a 3 GB heap). Every clip and
  refusal is the same to the bit; `fitGait` is about 8% quicker and `gaitClip` about 5%.
- Actions: the ready-made procedural parts are kept for the 96 used last (16 bodies of six), not without limit.

### Sensors
- Tests: the run knee the margin rule records (91.1%, D90) is pinned between 90% and 92%, naming what to restate when
  it moves.

## 0.45.0 · 2026-10-15

### Core
- Gaits (WP-6.2's rounds 8 to 14, D71, D90): every bound keeps the worst reading of its class at about 90% of the
  sensors' fail level or under, measured on fresh grids. A swinging leg folded under 25% of its length and a knee under
  the floor are refused; the loop's seam is read on the clip's own keys and bounded at 70%, the pelvis's whole-% steps
  about it re-rounded; the hands are aimed from the decoded shoulders. A gait is made from the rest's standing pose
  only, at 55 to 75 frames a second (was 90), with a key budget of 0 to 2 mm; the shortest swing is 0.3 s (was 0.26).
  `fitGait` fits speed, lift and arm swing together, monotone in each: the fastest whole speed that plays within the
  pace bound, a lower lift only where no speed plays, a narrower swing where the hands need it. Refusals name what
  `fitGait` would make. ARM_TURN is gone (every cycle taken now covers it).
- Actions: a ready-made procedural gait is fitted to the action's body (`fitGait`), so a run on a short-legged body
  plays a little slower instead of throwing.

### Tools
- The manual's procedural gait lines name the standing start, 55 to 75 frames a second, the pace bound, the shortest
  swing and run cycle, and what `fitGait` changes.

### Repo
- Tests: core's copies of the sensors' seam and pop levels held equal to the sensors'; the round-8 to 14 repros and the
  margin's worst cases pinned under the fail level; actions on test characters 0 to 3 at the fitted speed.
- `.gitignore` matches a worktree's `.cache` symlink (D83's implementer worktrees link it).

## 0.44.1 · 2026-10-14

### Core
- Gaits and idles are made 7 to 8 times faster, the same clips byte for byte: `snapLegs` scores each candidate leg by
  its ankle alone (`ankleOf`, the decoder's own steps for it) instead of decoding the whole pose for each of 81
  candidates a leg; a test holds `ankleOf` to `decodePose`'s ankle exactly (D89).

### Tools
- `npm run sweep -- --record <results.json> --commit <sha>` writes a gate's sweep record from the sweep's raw results
  (`tools/sweep/record.ts`); its failing pairs carry the warns the skeleton added too, as D80 asks (D88).

### Repo
- CI's T1 job fetches the gates' held-out rigs, as T2 does: B1's grader test reads run 1's (D89).
- The benchmark's audit reads a shell command's relative paths (from the workspace, following `cd`, a `for` loop's
  variable and globs as written) and counts any read under `node_modules/@m3a/` but the manual as past the manual; the
  repository counts as outside wherever it lives (D88).
- G4 run 2's record (D88): passed, 9 of 9, at adf77ee; its sweep record re-derived with the failing pairs' added warns,
  no rerun; its trials' audit corrected from the kept transcripts, which `transcripts.json` pins by SHA-256.

## 0.44.0 · 2026-10-14

### Core
- Gaits (D71, the verifier's round 7): the swinging foot's height keeps its slope where the lift-off meets the arc and
  the arc the set-down (a run's seam and short swings' knees popped); the pelvis is lowered with its sway and rounding
  counted; gaits are made at 55 to 90 frames a second. Refusals name the field, take a 0.26 s swing to the
  millisecond, and give the reach with the fastest speed the legs take; `procedural.fitGait(g, rest)` slows a gait to a
  body's reach.
- Format: a body measured without collarbones encodes no shrug (every procedural source made NaN on one).

### Tools
- The manual names `procedural.fitGait`.

### Repo
- Tests: the swing's slope at its joins, the round's repros under the sensors, the reach's edge on two rests, legs at
  most 98.5% of their length at the bound with a bounce, the stance end's margin, refusals, `fitGait`, procedural clips
  on test character 3; two slide bars moved with the arc (D71).

## 0.43.1 · 2026-10-14

### Three
- `bind` reads where a childless foot or toe ends from every skinned mesh that skins it, not only the one with the most
  bones: KayKit's Knight keeps its feet in its leg meshes and floated 55 mm at idle; it stands on its soles now. Rigs
  whose feet one mesh skins bind exactly as before (their bound rests' hashes pinned in a test) (D87).

### Repo
- B1's grader test says why the Knight stays ungraded: its 430 mm boots ride the floor under the library's toe curls
  (D87).

## 0.43.0 · 2026-10-14

### Three
- `attach(...).travel`: the last update's root move in the root's parent space (metres), along the way the model faces,
  read from its bones, turned and scaled as the root is; G4 run 1's held-out rig faces +X, and moved along +Z its
  standing feet slid 1.2 m/s (D86).

### Tools
- The manual moves the character by `player.travel` (5,656 of 8,000 tokens).

### Repo
- B1's starters read meshopt and leave textures out (the discovery starter with three's own decoder, naming no
  package); B1's known-good moves by `travel` and passes on both Quaternius mannequins and G4 run 1's held-out rig
  (1 m below its origin, facing +X), and on seeds 1, 37, 41 and 935; T2 grades it there, with the planted bad ones
  (D86, D77's S7 and S8).

## 0.42.7 · 2026-10-14

### Repo
- The benchmark: each agent starts in a mount namespace with a `/tmp` of its own (its scratch files kept beside its
  workspace, listed apart by the audit) and the repository and this session's Claude home hidden; agents run at once
  only where that holds, else one at a time; each trial records it; the runner's and briefs' tests remove their
  temporary directories; CI's runners allow user namespaces (D84).
- The sweep: a pair fails on a fail finding the skeleton adds; a warn it adds passes, listed with the pair and in the
  results' `warned` list; `--out` names the results file; PLAN.md §9.3's G4 line and WP-4.5 say so (D80).

## 0.42.6 · 2026-10-13

### Core
- Gaits (D71, the verifier's round 6): the pelvis is lowered until no leg reaches past 98.5% of its length at any
  phase, the bounce counted (a bounce of 3 or more drove a far-reaching leg straight, popping its knee); the reach
  bound is 72% of a leg; the shortest swing 0.26 s; 50 to 110 frames a second.

### Repo
- Tests: the gaits' refusals at the new bounds, a gait made at 110 frames a second; a one-shot's sideways root speed
  spent and a loop's flight in-betweened (D71, D77); the gaits' arm-swing test given 30 s.
- The SessionStart hook puts Node 24 (`engines`, CI's pin) first on `PATH` when the container's default is older, and
  fetches the real rigs, each gate's held-out rigs and the pinned sources by hash, so no test skips for want of them;
  CI's T1 job fetches the pinned sources too, so the carry test runs there (D79).

## 0.42.5 · 2026-10-13

### Repo
- B3 checks the body stays where it lies (from 0.3 s after the hips are down, 0.6 hip heights at most), and its
  standing-foot bar is 25%, as B4's: walks stride-warped as the manual shows read up to 22% (D77, the verifier's round
  3).
- B2's damage comes from two frames before the strike to four after, not to the hand's farthest reach, and a punch
  reaches 15% of the hip height; PLAN.md §7's B2 row says so (D77).
- The verifiers' sliding body and twitching hand planted; B6's README lists its character; the records' numbers
  corrected (D77).

## 0.42.4 · 2026-10-12

### Core
- A one-shot that ends off its feet spends its root motion's speed over the time a body falls its hip height: a
  knockback's take-off speed was held to its end, flinging the body 7 to 9 hip heights (D77).
- Gaits (D71, the verifier's round 5): every gait swings 0.25 s or more (a stance of 0.5 near the cap, and bounce 6, on
  shorter swings popped knees on half the rests or more), and is made at 50 to 120 frames a second.

### Tools
- The manual: a right-handed throw's wind-up turns +20; a bool may be compared; a paired action has its `desc` (D77).

### Repo
- B2's strike is found by the starter's `strike.ts`, for the grader and the check alike: the punch's last peak, not a
  fade into a stance; damage passes from two frames before it to the hand's farthest reach; each punch goes back to
  idling (D77).
- B3: a knockdown carries the body no more than 3.5 hip heights; the walk is checked again at the end, a standing foot
  staying; the light hit's bars in hip heights; a foot's dip in the cross-fade into the fall allowed (D77).
- B4 judges a standing foot by the lower foot's speed, not the sensors' contacts (`Walk_Stealth` fails); B7 judges the
  run after landing from 8.1 s, and its brief gives every window (D77).
- B2, B3, B4 and B7's starters load their character as the graders do (meshopt read, textures left out); the graders
  read a model far off y = 0 from its own floor (D77).
- Tests: the verifiers' wrong solutions planted (a fighting jab's press, a punch looped on, a flung knockdown, an idle
  after getting up, a skating walk, the stealth walk); the gaits' refusals at 0.25 s and 120 frames a second.

## 0.42.3 · 2026-10-12

### Spec
- A graph names library clips whose ids have a hyphen; its schema refuses what JSON Schema can say the checks do (a
  mask's groups, a pass state in the base, `at` off a clip state, `rate` on a pass, a layer named `base`, 2D points
  in a 1D blend); refrozen (D73).
- `GRAPH.md`: a loop's exit of 1 is taken at each seam; a window a step goes over opens; the fade-out cap is four
  besides the state fading in; a loop's `at` wraps (D73).

### Core
- Graphs (D73, the verifier's round 2): a one-shot at speed 0, a rate parameter starting at 0, a pass state's exit or
  late window and a state into itself waiting on nothing are refused; the run plays its own copy of the graph, so one
  edited after `play` changes nothing and a `-0` is 0; a loop's `at` wraps; a window narrower than a step opens.
- Gaits (D71, the verifier's round 4): a lift over 12% of the hip height needs a swing of 0.25 s, a run (stance under
  half) a cycle of 0.6 s (0.65 lifting over 25), and a gait 50 frames a second or more; each refused with what to
  change. A gait has an even number of frames, so its left foot is seen at its right's phases (a run of 0.65 s, 39
  frames, popped its left knee on 10 of 64 rests). The cap's message names the right foot only for a limp. "At any
  cycle" was more than was measured: at the cycles these allow.
- `BODY_POINTS`: a spine without chest bones puts the chest points a third and two thirds along it, not at its tip
  (D77: B3's lying head went through the floor on chest-less characters).

### Tools
- The manual's examples are no longer the briefs' answers: a swimmer's graph, a torch walk's recipe, a throw's
  edits; reactions name no clips; `H0` is the hip height (D77).

### Repo
- Graders read every body point from the bones, those off the joints carried on theirs (`bench/graders/bones.ts`);
  B2's strike is the last peak of the punching hand's speed before it is farthest out; B3 checks the walk's pace and a
  standing foot; B4 checks steps and a standing foot staying; B7 checks each motion's travel, the jump leaving the
  ground, and a fall when `grounded` goes without a jump (D77).
- `npm run bench`: `--variant` takes one brief; B4's variant must give VRM bone names; `speeds.json` only in B1's
  workspaces; a T2 test runs every brief's known-good through the packed packages (D77).
- Tests: the verifier's graph mutants (52 of 79 now fail them), the gaits' new refusals, each knee's twist step on
  three rests, at 50 frames a second and on an odd count made even (D71, D73).

## 0.42.2 · 2026-10-12

### Repo
- G6's command set: composed clips passing QA, graph simulations deterministic, the held-out run fresh, and B2, B3,
  B5, B6 and B7 with their held-out variants, 5 fresh agents each (D78).
- `npm run fixtures -- heldout <gate>` asks a rig manifest only of G4, and refuses a variant's seed a test grades on,
  WP-4.2's set has, or another held-out run used (D78).

## 0.42.1 · 2026-10-12

### Core
- A gait's loop meets itself at any cycle: its frames spread evenly over it, and each knee's turn about the leg, which
  drifted 3° to 22° over a cycle, closed over it (D71, the verifier's round 3).
- A gait whose foot swings forward past the hips faster than 400% of the hip height a second is refused: a long
  stance's knee popped mid-swing (D71).

### Tools
- The manual's "Make: actions": an action's fields, compiling, its root curve, cutting at an interrupt point, paired
  actions, a gait of one's own (D77).

### Repo
- Tests: the seam, the short swings' slide, the swing's speed, the dip's and lean's ranges (D71).
- WP-2.5's Verify, AGENTS.md's T2 row and G6's e2e step say what T1 samples and T2 runs in full (D74).

## 0.42.0 · 2026-10-12

### Library
- `library.resolver()`: a recipe's clips from the library, each with its rest and content id (D77).

### Tools
- The manual's make sections (D77): recipes and their operations, compiling against the library, edits, facts.

### Repo
- Briefs B4 (a sneak on a VRM-named avatar), B5 (an emote: a two-handed wave with a hop) and B6 (an edited punch), each
  with a starter, a grader, a known-good solution and planted bad ones; a brief may have its own default character.
- T1 samples B1's grader (gen-1; gen-37 in T2) and describe's token count (every third clip; all in T2), as D74's
  sweeps: 88.6 s (D77).

## 0.41.0 · 2026-10-12

### Tools
- The manual's wire sections (D76): graphs, events and hit timing, reactions, root motion and stride warping, and
  checking a graph with the simulation.

### Repo
- Briefs B2 (an attack's hit timing), B3 (reactions) and B7 (a locomotion graph), each with a starter, a grader, a
  known-good solution and planted bad ones (D76); `npm run bench` runs any brief; T2's full step grades them on a
  second character.

## 0.40.0 · 2026-10-12

### Tools
- `sim` (D75): `simulate` runs a script of a game's input on a graph (eased parameters, triggers, a ground speed) and
  gives its trace (states, events, hit windows at their steps), where the root went, the body every step and the
  sensors' read; the root follows the animation or stays in place, stride warped to the ground speed;
  `validateScript` (S-E001–S-E007), `compareTraces`, `traceText`, `filmstrip`. `npm run sim -- <graph> --input
  <script>` writes trace.json, result.json and film.png, and compares with `--expect`.

### Core
- Graphs: a state's `rate`, a number parameter its speed is multiplied by each step (stride warping sets it).

### Spec
- `spec/SIM.md`, `sim.schema.json` and `sim-trace.schema.json` (frozen under D75); `graph.schema.json`'s `rate`
  (refrozen under D75); `spec/sims/`: two scripts and an expected trace; Locomotion's move reads `warp`.

## 0.39.2 · 2026-10-12

### Core
- Graphs, after WP-6.4's verifier (D73): a state faded into plays, and fires its events, from its first step; a loop's
  exit share is taken when a step carries it past; a cut fade carries on from what it was fading out; a trigger may
  have a `buffer`, and `set(trigger, false)` clears one; a save holds the content hash of every clip the graph names,
  and restore refuses one edited since (E_CLIP_CHANGED) or a graph state the graph can't have (E_SAVE);
  `validateGraph` returns issues where it threw, checks a mask's field names, `name`, `desc` and `tags`, and gives
  every issue a fix; `remove("@…")` refuses a graph's layer.

### Spec
- `graph.schema.json`: a trigger's `buffer`, a mask's field names (refrozen under D73); `spec/GRAPH.md` says the
  above; the examples' presses wait 0.2 to 0.3 s.

## 0.39.1 · 2026-10-12

### Core
- Gaits, after WP-6.2's second verifier (D71): a foot lifts off to 9% of the hip height however short its swing, and a
  swing under 0.2 s is refused (a foot up for under 0.1 s reads as never leaving the floor: limps on a 1 s cycle slid
  up to 1.3 m); lift, bounce, dip, sway, lean and arm swing are taken in the ranges the presets pass (a lift of 40 or
  a sway of 5 popped a run's knee); the soft reach, which changed nothing, is gone.
- Moves begin and end exactly at the start pose given (a field ending in .5 was a degree off at the first or last
  key: up to 3.3 mm).

### Tools
- `carry.ts` exports its derivation; a T1 test holds `library/moves.json`'s numbers to my-3d2dge's frozen moves, and
  the whole file to the carry tool's where the pinned sources are. Without them `npm run moves` says to fetch them;
  gate G6 fetches them first.
- T1 reads every third loop of the planted-feet sweeps and plays the actions on two of the six test characters; T2
  runs those files in full (`M3A_FULL=1`, D74). T1 was 91.8 s against its 90.

## 0.39.0 · 2026-10-12

### Core
- `graph` (D73): graphs of states (a clip, a recipe, a blend space on one or two parameters, or pass), transitions
  (conditions, exit, cancel windows, fade, sync, interrupts) and layers, checked (`validateGraph`, G-E001–G-E010); the
  Animator plays one inside `step` on its own layers (`play`, `stop`, `set`, `trigger`, `on`, `graph`), its state in
  `save()`, `hash()` and `restore()`. An Animator without a graph hashes as before.

### Spec
- `spec/GRAPH.md`; `spec/schemas/graph.schema.json` filled (refrozen under D73); two example graphs in `spec/graphs/`.

### Tools
- e2e `animator-parity`: the example graphs run the same in Node and Chromium.

## 0.38.0 · 2026-10-12

### Core
- `actions` (D72): `compileAction` compiles an action (a recipe with its floor, beats and interrupt points) with its
  procedural parts, marks its beats and points as events and reads the ground its feet stand on (A-E006 when it isn't
  the floor given); `actionRootAt` its root curve, the ground's height with it; `interruptInto` cuts it into another
  clip, in step, raised and turned (`play` for a preview); `compilePaired` and `pairAt` time and place a pair's roles
  to meet on an event; `validateAction`, `validatePaired` (A-E001–A-E007).
- Recipes: a loop's root a float step short of its end reads the end of its cycle, not its start (a sequence ending on
  a walk jumped back a cycle on its last frame).

### Spec
- `spec/ACTION.md` and `spec/schemas/action.schema.json` (frozen under D72).

### Library
- `library/actions/`: get up, climb up, vault, hop down, roll and a heavy landing, and a paired jab and flinch, each
  from library clips, playing on the six test characters.

## 0.37.2 · 2026-10-12

### Core
- Procedural sources, after WP-6.2's first verifier (D71): a move begins and ends at any start pose (straight limbs, a
  `spine` field, a pose from a clip), each frame blended from it over the first and last 0.1 s; a leg whose start knee
  points back starts from its knee turned to the front; the hold is kept above 0 and at most 0.95.
- Gaits: a foot lifts off straight up to 9% of the hip height (above the 7% a lifted foot is read at) and sets down
  from 4.5%; a stride past 75% of a leg, a lift under 9% and a limp that leaves a foot no swing are refused with what
  to change; contacts are the model's; 60 fps. The presets slide at most 7.8 mm on three rests and none fails on any
  of 64; the run preset is 350.
- Idles: a breath leans the chest back and shrugs the shoulders (the torso's lengthening never reached the keys); the
  chest tips away from the standing hip (it tipped with it).
- `validateMoves`: MV-E008, a kick on the side plane; a blank `about`; a null height is a type error.

### Spec
- `moves.schema.json`: `hold` above 0 and at most 0.95, a kick on the ground plane, an `about` with text (refrozen
  under D71).

### Tools
- `npm run moves -- --check` (the carry tool), in gate G6's first command set; `carry.ts` reads the source's lengths
  from `procedural.SOURCE`.

## 0.37.1 · 2026-10-12

### Core
- Recipes, after WP-6.1's third verifier (D70): a blend of two travelling loops takes its cycle from its own roots
  (two facing apart jumped at the seam), and in step reads each loop on past its seam; `describeRecipe` reads a recipe
  not yet checked; the yaw's fix hint says + toward the right. 36 of the verifier's 41 mutants fail the tests; five
  pass for reasons D70 gives.

### Spec
- `spec/RECIPE.md`: the yaw's sign, and that a yaw held from a clip's start shows only in clip space.

## 0.37.0 · 2026-10-12

### Core
- `procedural` (D71): `moveClip` makes a move from `library/moves.json` into a clip on any rest from any start pose
  (it begins and ends there, a `hit` event where it connects); `gaitClip` a travelling walk, run or limp that slides
  at most 9 mm per contact; `idleClip` a breathing, weight-shifting loop on planted feet; `GAITS` and `IDLES` ready
  made; `moveState` and `placeMove`, the move model, match my-3d2dge's to 0.012 cm; `validateMoves` (MV-E001–MV-E007).

### Spec
- `spec/schemas/moves.schema.json`, the moves file's shape (frozen under D71).

### Library
- `library/moves.json`: 31 moves from my-3d2dge and shardfall in one unit system, each with an `about` line.

### Tools
- `node tools/procedural/carry.ts [--check]` writes `library/moves.json` from the pinned sources; doctrine's API cap
  for core is 44 (D71).

## 0.36.2 · 2026-10-12

### Core
- Recipes, after WP-6.1's second verifier (D70): a pose `yaw` turns the way the character travels (a turned loop no
  longer jumps at its seam), and a sequence keeps an item's own turn; `describeRecipe` always ends, and `tokenCount`
  counts at or over o200k and cl100k (it undercounted ids); a weight curve blends the legs as points and reads `a`'s
  clock; a loop that plays once keeps both parts of a seam contact; `sync` reads a plant over a loop's seam; `pin`
  stops short of a straight limb; a slice leaving nothing, a seam blend too long and a contact's end are coded R-E009,
  and a loop's contact may wrap; every issue has a fix. 66 one-line mutants each fail the tests.

### Spec
- `spec/RECIPE.md`: the yaw's travel, a curve's clock, a once result's contacts, the R-E009 times; the schema refuses
  a pose `root` (refrozen under D70); Jab_Cross_Combo's cross hit at 1.3 s, two descriptions say the upper body.

## 0.36.1 · 2026-10-12

### Core
- Recipes, after WP-6.1's verifier (D70): a sequence turns each next item's body with the heading the root has
  reached; a pose `yaw` turns the body with the root, and a loop closes on its first root; a loop's contact over its
  seam stays one wrapping interval; a blend that can't close and an eased loop play once; `sync` keeps in step only
  on a step; the clip's inputs are the clips the result is made from; every time a step gives is checked (R-E009);
  `validateRecipe` ignores JavaScript's own names, refuses a pose `root` and an empty mask, takes a clip's event
  names and gives every issue a fix; `describeRecipe` counts tokens, not characters; `pin` turns the elbow or knee
  with the limb's swing and bends it the natural way as the limb straightens.

### Spec
- `spec/RECIPE.md` matches the compiler (the content id, the inputs, canonical JSON, the defaults); the schema refuses
  `s1`-style step names and an empty mask (refrozen under D70); four examples replaced by chained ones (a hand on a
  rail, a timed turn, a jab-cross combo, a walk stiffening along a curve), three descriptions corrected.

## 0.36.0 · 2026-10-12

### Spec
- `spec/RECIPE.md`: recipes, clips made from clips (D70): fifteen operations, how a recipe compiles, its errors
  R-E001–R-E009. `spec/schemas/recipe.schema.json` gives every operation and its fields (the G1 stub, refrozen under
  D70); 20 example recipes in `spec/recipes/`.

### Core
- `recipe`: `validateRecipe`, `compile` (a format-2 clip, keys within 30 mm, provenance with the recipe's SHA-256 and
  its inputs' content ids, the license its inputs force), `describeRecipe` (one line, at most 100 tokens), and the
  tracks the steps make; a blend over time keeps each angle's gap from frame to frame, and two loops in step blend
  the pelvis, legs and feet as points.

### Sensors
- The 20 example recipes compile into valid clips the sensors pass (`npm test -- recipe`).

## 0.35.2 · 2026-10-12

### Library
- Five CMU picks from takes no pick shares (D69): `Swordplay`, `Boxing_Flurry`, `Backpedal_Punch` (combat 64) and
  `Explain_With_Hands`, `Angry_Quarrel` (gestures 63); CMU_CURATED 158 clips, 1,199 unique motions of 1,398.
- `library/baselines/qa.json` answers the three clips that stand off the floor (`floats`): two rise onto their toes,
  and `Shoot_Bow`'s source take holds no one floor for both feet.

### Tools
- `npm run qa -- library` checks floating (D69): an upright body with both soles more than 4.2% of H0 off the floor
  for 1 s or more, in a clip its tags don't put in the air, fails unless `qa.json` answers it; an answer whose clip
  floats no longer is named.
- The importer refuses a catalog that names a key twice in one object (`duplicateKeys`): JSON keeps the last unsaid.

## 0.35.1 · 2026-10-12

### IO
- `cutPicks` with `floorEach` stands a take whose feet don't show its floor where its feet stand while the body is
  upright (`UPRIGHT`: before a fall, after a get-up), else on the floor its whole body shows, not on the other takes'
  floor (D67): CMU subject 90's falls floated 23–25 cm.

### Library
- G5's verifier's findings (D67): two get-ups that duplicated captures already picked replaced, and six get-ups from
  takes no pick shares added (CMU_CURATED 153 clips); Mesh2Motion's floating `Hit_Chest` left out; `Fall_On_Face`
  described as the dive it is. Reactions 35 unique, 1,194 unique motions in all.
- A repair, or a re-import kept for a better verdict, moves no point more than 30 mm further from its source
  (`WORST`); `_import.json` records the fit before a repair. 110 clips repaired; fails 155.
- A clip's QA reason names the metrics its tags' profile turns off, and a warn's says no more than the sensors
  measured.

### Tools
- The census finds a re-export's original by pose at the rate it plays (`REEXPORTS`) and counts two clips that hold the
  same pose once (`STILL`); `qa library --check` compares each clip's whole reason and names a set reason no clip
  needs; `tools/qa/qa.schema.json` and `distributions.schema.json`, checked on read; the importer's `repairGuard` and
  `choose`, tested.

## 0.35.0 · 2026-10-12

### Sensors
- `checks.QA_VERSION` (`m3a-sensors@1`): the metrics' and levels' revision a clip's `quality.qaVersion` names (WP-5.8).
- `fix` keeps the facts a source gave (`captured`) when it measures a clip's facts again after a repair: a repaired
  100STYLE run had its captured speed replaced by its planted feet's.

### Library
- Library QA (WP-5.8, D66): every clip carries the sensors' verdict in its `quality`: pass, or baselined with a reason
  naming the level and the metrics past it, then why it is kept (`baselines/qa.json` by set and by clip, the warn
  level's, or how it stands to its source). 1,045 pass, 206 warn, 139 fail of 1,390.
- The re-import repairs what the sensors flag with their `fix` where it comes out better within 2 mm of its source
  (148 clips), and keeps a re-import the sensors judge better over its migrated version within 2 mm (8 STYLE100 walks).
- Five CMU get-ups for G5's reactions (Get_Up_Careful, Get_Up_Careful_From_Back, Get_Up_Heavy, Get_Up_From_Floor,
  Get_Up_Via_Kneel): CMU_CURATED has 149 clips.
- `docs/LIBRARY.md`, generated: sets, counts raw and unique (1,193 unique motions; the CC0 pack 173), categories
  against G5's floors, licenses, fit and the QA distributions; `baselines/distributions.json` records them.

### Tools
- `npm run qa -- library [--check] [--baseline]`: every clip's recorded verdict against the sensors', reasons whose
  finding is gone, the census (`tools/qa/census.ts`: a category per clip, copies by `orig`, re-exports and pose
  near-duplicates counted once) against G5's floors, the distributions (they may only improve), `docs/LIBRARY.md`. T2
  runs it.
- T1 runs a test file on every core (Vitest left one idle), and describe's token count over the library is a file of
  its own: 72 s, from 93 s after the library grew.

## 0.34.0 · 2026-10-12

### Library
- Search (WP-5.5, D65): `search(items, query, opts)` and `Library.search(query)` over every set's catalog. A game
  moment in words ("drinks a potion", "slips past the guards unseen") matched against tags, names and descriptions
  through a vocabulary of concepts by kind of motion, idioms (`PHRASES`) and stems, the moment's verb and rare words
  counting most; filters `speed>1.5` (m/s on 0.95 m hips), `dur<2`, `loop`, `once`, `set:`, `tier:`, `tag:`. At most
  40 short rows, the core list (`CORE`, 43 CC0 clips a game usually needs) first among equals, and a `next` hint: the
  nearest tags when nothing matches, a closer match in a tier the game hasn't opted into, the CMU ledger's takes.
  For 40 game moments a fitting clip is in the top 5 for 40 (37 on CC0 alone); for 10 held-out ones, 8 (7).

## 0.33.0 · 2026-10-12

### Core
- `measureFacts` and `playable` detect a tool's contacts again and take only a source's labelled ones as given (WP-5.4,
  D64): library clips carry their detected contacts now, and an edit since (a repair, a retime) may have moved the feet.
- The fitter's `closeLoop`: a loop whose capture closes ends on its first key, each angle by the whole turns nearest
  its own, so a nearly straight limb's held twist can't leave it open.

### Library
- Facts and auto-labels (WP-5.4, D64): `measureClipFacts`, `withFacts`, `capturedSpeed`, `tagConflicts`. Every clip
  carries its facts (`by: m3a-facts@1`: speed, travel, height, seam, strikes; a source's speed kept and named in
  `captured`) and its detected contacts, written by the importer and the migrator. A clip tagged `loop` must close,
  and a `run` must travel or be tagged `inplace`.
- The re-imported loops close (`closeLoop`): the 15 tagged loops that didn't now do. Mesh2Motion's Run_Anime and
  Run_Stealth and 100STYLE's Flapping_RunBack run on the spot: tagged `inplace` (and no longer `root-motion`).
- QA's baseline rewritten: 920 pass, 285 warn, 180 fail.

### Tools
- `npm run facts [-- --check]` (`tools/facts/`): every clip's facts and contacts against a fresh measurement, and
  every tag its facts don't bear out, each resolved or given a reason in `library/baselines/tags.json`.
- `npm run import` and `npm run migrate` write each clip's facts and contacts (`withFacts`).

## 0.32.0 · 2026-10-12

### Core
- Format 2's new degrees of freedom in the fitter (WP-5.3, D63): `encode`/`fit` take `spine` (the spine's curl, a
  sequential share fit, kept for a clip only if in some key it brings a spine point 5 mm closer; `spineGain`), `yaw`
  (root yaw from the hip line, held where the torso is far from upright, the line near vertical or the heading jumps;
  `turning`; kept only if the clip ends facing 20° or more from where it began) and `steadyTwist` (a nearly straight
  limb's twist held where it would swing 45° or more); a hand's flex is clamped to ±90° and its side to ±45°.

### Sensors
- The seam fix makes the two segments that meet at a loop's seam equally long, so the curves it spreads the gap along
  end at the same speed both sides (a sparsely keyed clip with a short last segment read as a hitch).

### IO
- `importSet` takes the encode options (`hands`, `spine`, `yaw`, `steadyTwist`) and writes a looping clip's `speed`
  from its stride (the cutter's `Capture.stride`).
- `readCmu`'s `floorEach` (the cutter's): every take and the rest stood on the ground, each take on its own floor where
  its feet mostly stand on one level, else on the floor of the subject's takes that do (a subject's takes can stand
  12 cm apart); off, the origin's one floor a subject, so tier 1b and the ledger don't move.

### Library
- Nine sets re-imported from their sources (WP-5.3, D63): MESH2MOTION, CMU_CURATED, STYLE100 and its six extras
  (runs, backward walks and runs, sidesteps and sideways runs each way, idles; 779 clips), each clip the better of
  its re-import and its migrated version, the reason in the set's `_import.json`; the Mesh2Motion audit closed (CC0).
  CMU_CURATED gains 84 picks for G5's floors (reactions, gestures and emotes, work, traversal, combat): 144 clips.
  The library is 1,385 clips. The Quaternius sets stay as migrated until their current editions can be fetched.
- Removed: STYLE100/HandsBetweenLegs_Walk, SwingArmsRound_Walk and WildLegs_Walk (format 2 can't hold the pose; their
  migrated fits were past the limits), with their reasons in the catalog's `$skip`. No successor, so no alias.
- The catalogs of every re-imported set live in `library/catalogs/` (the 100STYLE extras moved there from
  `tools/corpora/100style/`).

### Tools
- `npm run import [-- --set NAME] [--check]` (`tools/import/`): fetches each source into `.cache/` held to its pin
  (`tools/import/sources.json` and the corpora's locks), re-imports, compares each clip with the migrator's output
  (fit and every metric, separately; the hands from the pelvis) and writes the sets and the library's lock, or
  rebuilds them in memory and compares byte for byte; a migrated clip kept keeps its rest. `_import.json`'s schema is
  `tools/import/import.schema.json`. `npm run migrate` leaves the re-imported sets alone.
- `npm run plant -- --check` checks G3's runs against the library (every run's clip there, clean and able to show its
  defect) instead of rebuilding them, which a grown library changes.
- The demo (`apps/lab/hello`) plays its moves' hands only if every move has them (`handsAlike`): its migrated
  Quaternius moves have none and its re-imported jumps close the fist, which would clench and open within each fade.
- QA's baseline rewritten for the re-imported library (1,385 clips); the contact test runs the locomotion loops,
  sidesteps included, in four files (one cycle each for 100STYLE's).

## 0.31.0 · 2026-10-12

### Tools
- Large corpora on demand (WP-5.6, D62): `npm run corpora -- cmu --fetch | --survey [--check] | --import | --find |
  --ledger` fetches CMU's index, archive and the takes it lacks into `.cache/cmu`, each file held to
  `tools/corpora/cmu.lock.json`, and writes the ledger `tools/corpora/cmu-takes.tsv` (2,548 takes; every row as
  my-3d2dge's survey wrote it); `npm run corpora -- 100style --fetch | --import [--check]` fetches 100STYLE's archive
  (held to `tools/corpora/100style.lock.json`) and cuts its extras' six catalogs (`tools/corpora/100style/`) into sets:
  780 clips, every one cut at the same stretch with the same keys as shardfall's sets (`--check`).
- The doctrine check outside git reads only what a commit could hold: not `library/local/`'s content, `.cache/` or
  the outputs.

### IO
- The shared cutter finds a pick's stretch when asked (`Pick.find`: `straight`, `still`, `whole`, or a way to go:
  `forward`, `back`, `left`, `right`), cuts a loop going a way from the pass with the cleanest cycle, facing forward,
  and, `lenient`, leaves out a pick it can't cut with the reason (shardfall's takes.rs); `readBvh` takes `lenient`.

### Library
- `library/local/README.md`: the local lane's three rules and how to import into it; the library README lists the
  corpora.

## 0.30.0 · 2026-10-12

### IO
- The importers (WP-5.2, D61): `@m3a/io` reads untrusted input with capped sizes, a per-file budget of frames and
  joint transforms, bounds-checked buffers and glTF shapes checked before use; the readers it exports let nothing out
  but an `IoError` naming its cause and offset. `readGltf` (Rigify and Unreal rigs) and `readCmu` (ASF/AMC picks) read
  bit for bit like the origin's importer (conformance tier 1b); `parseBvh`/`rigBvh`/`readBvh` and `readGltfPosed` read
  any skeleton a bone map knows (MotionBuilder/Mixamo, Unreal, Rigify, VRM, 100STYLE, Bandai Namco);
  `vrmaOf`/`encodeVrma`/`decodeVrma`/`writeVrma`/`readVrma` write and read VRM animations byte for byte, the humanoid
  bones alone with the root's travel in the hips, the clip's loop, events, contacts and facts in the animation's
  extras as three's bake writes them; `importSet` fits libraries into a set as a catalog says (`$sources`, one CMU
  record a subject, `$pick` with the ledger's stretches, `$skip` with reasons), with a fit report per clip; `subset`
  picks a smaller set from bigger ones. FBX through an optional converter outside the package (README).

### Spec
- Conformance tier 1b runs: `spec/conformance/tier1b.test.ts`, with a second glTF vector, a Rigify rig with a skinned
  mesh (`tier1b/rigify.gltf`, `rigify-expected.json`): every accessor form, STEP and scale tracks, a turned and scaled
  root, and the mannequin's look, bit for bit like the origin's importer.

### Tools
- `tools/vectors/rigify.ts` builds the Rigify rig; `npm run vectors` reads it with the origin's importer.

## 0.29.0 · 2026-10-12

### Library
- License compliance (WP-5.7, D59): `checkSets` (each source an SPDX id fitting its set's tier, its text kept, a
  credited set's credit; open audits listed) and `checkGame` (a game manifest's clips from the tiers it opts into, no
  `local` content shipped), the credits owed and `creditsBlock`; `licenseText` in `@m3a/library/node`.

### Tools
- `npm run license -- check <library | SET | game.json>`: the check, with the credits block a game shows.

## 0.28.1 · 2026-10-12

### Core
- Planting holds a foot through a gap of under 0.1 s between two of its contacts (a loop's seam included): letting
  the hold go and taking it again there moved the foot by its whole drift in a frame (D58).

### Tools
- `npm run fixtures -- heldout <gate>`: whether the gate's latest held-out run is fit for a gate run (unused by a
  recorded one, its license file's SHA-256 pinned, its rig cached and verified); G4 runs it first (D57).
- A rig manifest may pin its license file's SHA-256 (`licenseSha256`), checked at fetch and in the cache.
- `npm run bench` records the commit under test with `git` (a worktree's too) and whether the tree differed, the models
  the agents ran and a variant's directory and character, and no longer overwrites an earlier run's results.
- G4 runs B1's discovery trials (2, reported, not gating; §7).

### Repo
- The capture e2e draws sheets of G4's six skeletons, a toeless test character and the held-out rig.

## 0.28.0 · 2026-10-12

### Core
- A clip plays with its library's spine and neck shares (spec §3.3, D55): `AnimClip.shares`; the Animator carries them
  in each key's `spine` and mixes the neck's as the head is; `playable(clip, rest)` makes a library clip ready (its
  contacts measured on its rest, its shares); `solver.reachable(k, R)` keeps the neck where R's shares put it when
  the hips carry the lowest segment.
- Planting: the settle, a planted foot's float and the reach drop averaged over ±0.1 s (`PlantOptions.settleSmooth`),
  within 2% of H0 of the pose's own; a planted sole within 2.5 mm of the surface, the body down far enough that a
  planted foot floats at most 3 mm; each sample reads its own hold; the reach drop continuous past the leg's reach;
  a knee the clip holds past straight no longer folds backward when the planted leg bends further.
- `clip.sole`: a foot's sole points (the heel turned with the foot), moved from the sensors.

### Sensors
- The sole comes from core (`clip.sole`); readings unchanged.

### Three
- The demo (`apps/lab/hello`): the jab for the attack; the flight lasts through the landing's fade.

### Tools
- The sweep plays clips with their library's shares.
- B1 asks speeds in proportion to the character's hip height (D56): `speeds.json` in each workspace, read by the
  starters' `npm run check`; the briefs say so.

### Repo
- CI's T2 job fetches each gate's held-out rigs (`bench/results/heldout/*/run-*/rig.json`) before the e2e suite.

## 0.27.0 · 2026-10-12

### Sensors
- `checks.STANCE` is exported (the speed under which a foot stands).

### Three
- `@m3a/three/test-characters` is a public entry: the generated test characters and `loadGlb`.

### Tools
- The benchmark (WP-4.7, D54): `npm run bench -- B1 | quiz [--trials N] [--discovery N] [--parallel N] [--variant
  dir] [--model m] [--fake]`; fresh agents at isolation level 1 in workspaces outside the repository, the packages
  installed from their tarballs; each trial's time, turns, tokens, cost and audit in `bench/results/`.
- B1 (locomotion): its brief, starter, discovery starter and brief, and a grader that judges the character's bones;
  the legend quiz (deferred from WP-1.1).
- The manual's first draft (`packages/tools/MANUAL.md`, shipped in `@m3a/tools`).

### Repo
- The boundaries check allows any subpath a package's exports map declares.

## 0.26.0 · 2026-10-12

### Library
- The loader (WP-5.1, D53): `Library` (sets, catalogs and clips by id) and `@m3a/library/node`'s `openLibrary`; each
  set's content id checked against its files and each clip against `library/sets.lock.json`, so a changed file is
  named; CC0 alone unless a game opts in to a tier; deprecated ids resolve with a warning.
- `library/LICENSES/`: CC0 1.0 and CC BY 4.0 verbatim, CMU's notice in full; `library/README.md`.

### Tools
- `npm run library -- lock | check | list [--tiers ...]`.

## 0.25.0 · 2026-10-12

### Core
- Planting on another body (D51): the body settles onto its feet over 0.2 s (`PlantOptions.settleBlend`), from the
  float a foot had as it lifted or toward the one it lands with; only a standing foot lifts the body; a re-solved knee
  keeps the clip's knee unless the new ankle bends the leg further; a hold lets go of its drift over 0.2 s
  (`PlantOptions.release`), done before the foot lands again.
- `contact.plantMix`: under a cross-fade or a blend each layer plants its own clip and their corrections blend by their
  shares of the legs; the Animator uses it whenever two layers share the legs, so a planted foot no longer jumps when
  the layer that most decides the legs changes.
- `ik3` keeps a limb's lengths when its end is inside its fold (a thigh much longer than its shin folded tight).

### Sensors
- `checks.motionOfFrames` takes the root's path (`root`): the points on the root, so a loop's seam is read on the body
  and its feet's slide in the world.
- Reading by parts (`Motion.parts`, `checks.partScale`, `checks.TYPICAL_CHAIN`): each point against its chain from the
  pelvis, for bodies whose proportions are far from a person's; off by default, so the library's readings are as
  baselined. `checks.stance` is exported.

### Three
- The first-flight demo (`apps/lab/hello`, a lab, D52): a test character idles, walks and runs by speed, jumps and
  attacks, its hit shown; deep links, `window.__m3a`, a phone layout, the build stamp; `vercel.json` for O3.

### Tools
- `npm run sweep` reads seams on the body, every point by its part, and the clip's own slide over the stretches the
  played body stands on; each failing metric's own and played values and levels are in the results (D51).
- `npm run hello [-- build | preview]`: the demo served, built into `apps/lab/hello/dist`, or that build served.
- e2e `hello`: the demo driven headless; its hashes are Node's, its hit shows, the sensors read what it plays, its
  screenshots and contact sheet go to `check-output/hello/`.

## 0.24.0 · 2026-10-12

### Core
- Planting (D49, revising D37): the re-solved knee keeps the clip's own knee as its pole, a sole's setting eases in
  before a contact and out after it, the body is lifted and lowered continuously (`PlantOptions.settle`, default on),
  and a contact through a loop's seam is one contact.
- A foot segment of no length measures no pitch (a toeless rig measured a NaN rest).

### Three
- `@m3a/three/capture`: a bound character drawn headless on WebGL 2, every frame read back, checked not blank, with
  the proof hash of its bones; `CaptureError` for a blank frame or another renderer (D49).
- Bind gives a foot that ends with no child an end bone where its mesh ends, on the sole (D49, revising D47).

### Sensors
- Foot locks bake planting with `settle: false` (D44).

### Tools
- `npm run sweep`: every migrated clip played by the Animator on each skeleton, judged against the clip on its own
  body, with every failure's reason (D49).
- CI's T2 fetches the real rigs and prints the browser log when it fails.

## 0.23.1 · 2026-10-11

### Three
- `bind` recognizes only the bones that deform the mesh (and those above them): a rig's IK and roll controls were taken
  for limbs (KayKit's Knight bound its arms to its legs' controls) (D47).

## 0.23.0 · 2026-10-11

### Three
- WP-4.4: `attach(animator, bound)` writes an Animator's poses to a character's bones each update (the write allocates
  nothing) and hands the root's motion to the game; `bake(clip, bound)` makes a THREE.AnimationClip within 0.5 mm of the
  live solve, carrying the clip's loop, events, contacts and facts in `userData` (D48).

## 0.22.0 · 2026-10-11

### Three
- WP-4.3: `bind(root, { mapping? })`: a three.js character's skeleton (or VRM humanoid) recognized, its rest read in
  its own space, bound for the solver, with a report of at most 20 lines and a mapping patch to edit and pass back (D47).

### Core
- Recognition by topology: a long clavicle is the shoulder, a rig with no neck keeps its arms, a twist leaf isn't the
  hand, a chain of neck bones ends at the head, a twist bone in the thigh is passed over, and an arm with twist bones in
  it is reported with lower confidence (D28 revised).

## 0.21.0 · 2026-10-11

### Three
- WP-4.2: test characters (`packages/three/test-characters/`): skinned humanoids generated from a seed as GLB in
  memory, varying in build, rest pose, bone names (VRM, Mixamo, UE5, Rigify, with each family's habits), twist bones
  and left-out bones; the 20 of the test set load in three.js and are recognized; `loadGlb` and `skeletonIn` read any
  character in three (D46).

### Tools
- `npm run fixtures -- fetch | check [--manifest <file>]`: real CC0 rigs fetched by SHA-256 into `.cache/fixtures/`,
  their license files read and checked; Quaternius' mannequins and KayKit's Knight. CI fetches them before T1.

## 0.20.0 · 2026-10-11

### Three
- WP-4.1: `@m3a/three` pins three.js r182 (`three@0.182.0`), the release fresh agents write correctly that runs on
  both of `WebGPURenderer`'s backends in the platform's Chromium (r186's WebGPU fails to start there) (D45).

### Tools
- `npm run doctrine` bans the WebGL-era three.js APIs that break under `WebGPURenderer` and holds `packages/three` to
  the pin (`tools/doctrine/banned-three.json`).
- e2e `three`: the pinned release loads a skinned glTF, plays and crossfades on both backends; CI's `three-next` job
  runs it on r186.

### Docs
- `docs/THREE.md`: the pin, why, how to write against it, and the banned APIs.

## 0.19.1 · 2026-10-11

### Sensors
- G3's second review of WP-3.5 (D44): `fix` doesn't apply a step that raises a metric already at warn by more than
  5%, adds findings, or lowers none of the metrics its operator answers (as well as one pushing a metric past a level);
  twist flips take whole turns out of a stretch before spreading it; foot locks aim only the locked side's leg and
  leave an in-place loop that steps as it is (the step says why); jitter treats a key out of place alone apart from a
  shake.
- `compareClips` throws when its three rows can't fit the budget, instead of returning over it (D40).
- The describe tests count tokens by cl100k as well as o200k (D42).

### Tools
- `npm run qa -- --fix` counts a clip with more findings as worse, and its summary is in the verdict line.

## 0.19.0 · 2026-10-11

### Sensors
- G3 review of WP-3.5 (D44): `fix` doesn't apply a step that would push any metric past a level it was under (the
  step says which), every key an operator adds or edits is tidied to the format's whole numbers and ranges (`fixes.tidy`),
  edits are keyed every 0.1 s, twist flips keep a loop closed, the seam operator adds no key when the seam closes and
  matches speeds where they stand out (lint names it for `seamVelocity`), penetration sets on the floor only a foot
  standing still, re-fit counts the root's travel and turn, and an unknown operator name throws.
- Describe's text holds to 150 tokens as counted, not 600 characters, and says how many items it left out (D42).
- A predicate whose interval starts after the clip ends is refused (D41).
- A sheet whose frames draw no body throws, naming them; a diff's three rows share its token budget (D40).

### Tools
- `npm run qa -- --fix`: lint and fix over the library, failing on any clip that comes out worse or invalid; in G3's
  command set. The verdicts line names the metrics that fail most.
- The planted defects (D43): every planted clip validates; slides lie on stances within their clips and are found
  within 0.1 s of them; the defects take clips in turn, about 10 each; edits keyed every 0.1 s.

## 0.18.1 · 2026-10-11

### Tools
- The sensors' baseline (`packages/sensors/fixtures/baseline.json`, numbers only): every migrated clip's verdict,
  values and finding counts. `npm run qa -- --check` fails on any difference and T2 runs it; `--baseline` rewrites it,
  in a commit that says why.
- `npm run plant [-- --check]` for the planted defects.
- `npm run gate -- G3`: its command set.

## 0.18.0 · 2026-10-11

### Sensors
- WP-3.5: `fix(clip, R)` and `lint(clip, R)`, and the operators one by one (`fixes`): repair twist flips, filter
  jitter and pops, lift penetration, bake foot locks, close a loop seam (pose and speed), re-fit keys to a budget.
  Each is measured before and after, and no clip changes silently: `dur`, events and contacts are checked after every
  operator, and stored facts measured again (D44).
- The metrics' key grid is the keys as played: a key past the end counts only through the pose at the end.

### Tools
- The plant tool's new keys snap to a clip's own within 5 ms; the slide plant keys its drag on the 1/30 s grid.

## 0.17.0 · 2026-10-11

### Sensors
- WP-3.6: 100 planted defects (`fixtures/planted/runs.json`), ten kinds, every one flagged by its metric at its times;
  false positives in 3 runs of 100, each stated (D43).
- Jitter takes the smaller of two opposite bends, so a key out of place doesn't read as a shake beside it (warn 26,
  fail 90 from capture); a flip at a limb read as straight folds its swing too.

### Tools
- `node tools/plant/main.ts [--check]`: plants ten defects into clean library clips with the times they must be found
  at (a slide, a sink, an arm through the torso, a pop, a twist flip, a loop seam, a stretched bone, a NaN, events out
  of order, a wrong mirror).

## 0.16.0 · 2026-10-11

### Sensors
- WP-3.4: `describe(clip, R)`: a clip as a short text timeline: its phases by rule (stand, walk, run, crouch, sit, lie,
  air), landings, strikes, events and travel; at most 150 tokens, more with `detail`. 30 of 30 on the reviewed ground
  truth (`fixtures/describe-truth.json`).
- The metrics' stance can read by height alone.

## 0.15.1 · 2026-10-11

### Sensors
- WP-3.3 review: where a foot stands is measured (on the floor, slower than a swing or carried with the pelvis), so a
  sliding or gliding foot is measured; slide is a contact's drift from where it landed; skate is a metric of its own.
- The root adds its place, not a second turn by its yaw; the heel's sole point turns with the foot.
- Jitter and pops read the key grid; pops follow my-3d2dge's 2.5× rule, per body part; thresholds re-derived from capture.
- Twist flips are judged at any spacing where the reference is undefined, by rate elsewhere; the head limit reads
  either encoding of the head.
- A flip folds only what it swings within its keys, takes their worst level, and keeps them as `folded`.
- Predicates convert or reject units, read the measured stance, and refuse backward intervals; a sliding profile.

### Tools
- `npm run qa`: `--dist` prints the distributions (capture and all); every clip's findings go to `clips.json`.

## 0.15.0 · 2026-10-11

### Sensors
- WP-3.3: the metrics (`metrics/`), `metrics(clip, R)`: slide and skate, penetration, self-intersection, jitter, pops,
  twist flips, knee and neck limits, stretch, loop seams, fit, non-numbers, events and symmetry. Each finding has its
  times and a repair. Thresholds come from capture, each with its reason; tag profiles relax what doesn't apply. The
  verdict is at most 20 lines.
- Predicates (`predicates/`): planted, free, within, height, compare and "no". A failure reads as a repair.
- The raster's capsules are named by part.

### Tools
- `npm run qa`: the sensors over the migrated library (`--sample`, `--set`, `--clip`, `--dist`, `--strict`). T2 runs
  it.
- The boundary check's import scanner no longer reads `import's` in a string as an import.

## 0.14.0 · 2026-10-11

### Sensors
- WP-3.2: sheets, films and diffs (`sheet/`):
  - `sheet` (a clip's frames at one scale, in rows of eight) and `filmstrip`;
  - overlays for planted feet, foot trails, flagged times in red, and a timeline of contacts and flags;
  - `diff` (A, B, and A with changes marked) and `compareClips` (two clips on one camera);
  - each image's size and token cost, within a budget.

## 0.13.0 · 2026-10-11

### Sensors
- WP-3.1: the software raster (`raster/`):
  - the capsule mannequin on a pose's body points, lit and z-buffered, its left side blue, with a nose for facing;
  - front, side, back, top and three-quarter views, any azimuth, and a turntable;
  - a 5 × 7 bitmap font for labels and a non-blank check;
  - PNG bytes (`encodePng`; `png` and `writePng` in the new `@m3a/sensors/node` entry, through node:zlib).

## 0.12.1 · 2026-10-11

### Core
- The Animator, fixed from the G2 review (D38):
  - a loop's events fire once a cycle at any speed, backward too, however many cycles one step covers;
  - a one-shot's end fires once when the playhead turns round at it;
  - no −0 in the state;
  - `restore()` hashes clips afresh (one edited in place is refused) and refuses a save made on another body
    (E_BODY_CHANGED);
  - each call's turn is composed step by step (no 360° jump);
  - a clip with no id, a zero-length loop and a malformed save are refused or played still;
  - the lowest layer fires its events whatever its weight.

### Tools
- `npm run test:cross-engine` runs the Animator's script in JavaScriptCore (Bun) too: the same hash as V8.

## 0.12.0 · 2026-10-11

### Core
- WP-2.6: the Animator (`animator/`):
  - layers (clip, weight, mask, additive, speed);
  - `step(dt)` on a fixed step: events in the order the playheads pass them, root motion mixed like the pose;
  - `hash()`; `save()` and `restore()` as plain JSON, naming each clip by id and content hash, refusing a changed or
    missing clip by name;
  - `pose()` with planted feet, the ground and hand targets, at full detail, `lod` 1 or `{ exact: true }`.
- The public API is `src/index.ts`, all of it: 38 documented names, each module as a namespace (`format`, `ops`,
  `math`, `solver`, ...).

### Tools
- The doctrine's boundary check counts each package's public exports (core at most 40), and fails a bare `export *`
  or an export with no doc comment.

### Repo
- e2e `animator-parity`: the Animator's hashes, events and exact poses are the same in Node and headless Chromium.

## 0.11.1 · 2026-10-11

### Core
- The solver's bone roll, fixed from WP-2.4's review (D36):
  - the left arm's rest pole is no longer mirrored (it rolled 62.7° on every pose);
  - arms and legs roll by their bend plane's normal, with no flip at any bend;
  - feet and toes roll about the axis they pitch about;
  - hands roll by the knuckle line, the skeleton's own at rest, and a format-1 hand stays on its forearm;
  - fingers curl toward the palm at any hand roll;
  - T, A and relaxed rests give the same rotations.
- The hips carry the lowest spine segment, so every point the solver decodes is one the bones reach (`solveRest`,
  `reachable`, `decodeOn`).

### Spec
- Conformance tier 3 reads its tolerances from the runner's `TOLERANCE`.

## 0.11.0 · 2026-10-11

### Core
- WP-2.5: contacts and ground (`contact/`): `plant` holds each planted foot's contact point still in the world
  (stateless: the motion's own drift since landing, undone), sets the sole on the ground (pitched to slopes and steps
  through a ground probe), lowers the pelvis where a leg can't reach, solves the legs again, and draws hands to
  weighted targets; `contactRoot` gives an in-place clip the root its planted feet imply. `solve` takes edited points.
- Contact detection also asks a planted foot to be still in the world (slower than half the body's speed), and closes
  gaps up to 0.1 s; `syncBlend` gives the blend's contacts, the inputs' weighted.
- On all 133 migrated locomotion loops and on synced walk–run blends a planted foot slides at most 10 mm per contact
  (0 mm measured); on 10° slopes and 0.2 m steps planted soles stay within 5 mm of the surface (1.7 mm measured).

## 0.10.0 · 2026-10-11

### Core
- WP-2.4: the solver (`solve/`): `bind` (recognize, measure the body from the bones, map the format's frame to the
  skeleton's) and `solve` (each bone's world and local rotation and the hips' place, from the key's numbers decoded on
  the target body: limbs rolled by their poles, the spine by its shares, fingers by their curls, soles on the floor);
  `forward` for the joints. Handles T, A and relaxed rests, missing optional bones, twist bones and a host's rest
  rotations.
- `quat.fromMat3`; the decoder's `limbPoles`; the decoder places a shoulder with no offset at its clavicle point.

### Spec
- Conformance tier 3 runs (`spec/conformance/tier3.test.ts`): every generated body of `tier3/bodies.json`, every tier-2
  clip at four times.

## 0.9.0 · 2026-10-11

### Core
- WP-2.3: pose operations (`ops/`): `blend` (angles the short way round; exact at 0 and 1 up to whole turns),
  `delta` and `addDelta`, `mask` by body group with feathering, `mirrorPose`, `retime` (speed, duration or an ease
  curve), `slice` (across a loop's seam; the root restarts), `loopify`, and `phaseMap` and `syncBlend` (contact-phase
  sync; the legs blend in point space, so planted feet stay within 20 mm of the floor).
- `encodePose` takes `round: false` for exact, unrounded numbers (the default is unchanged).

## 0.8.0 · 2026-10-11

### Core
- WP-2.2: the clip runtime (`clip/`): `sample` (body points at t), `rootAt` and `rootDelta` (root travel and heading,
  composed over loop cycles), `events` (each occurrence once, in order, loop-aware, either direction), `contactsAt`
  and `detectContacts` (hysteresis about the floor), and `measureFacts` (seam, travel, speed from the planted feet,
  height, strike, contacts).
- WP-2.2: `fixtures/facts-truth.json`: 20 clips whose speeds, distances, strikes and loop flags come from my-3d2dge-2's
  asset manifest and skill timings and shardfall's importer; measureFacts is within tolerance on all 20.

### Repo
- Lint bars `**` other than squaring in core (the host's pow; D34).

## 0.7.0 · 2026-10-11

### Core
- WP-2.1: the math kernel (`math/`): portable `sin`, `cos`, `tan`, `atan`, `atan2`, `asin`, `acos`, `exp`, `log`,
  `log2`, `log10`, `hypot` and `cbrt` with native V8's bits on every input tested (fdlibm, FreeBSD and V8's own
  algorithms, Payne–Hanek past 2^19·π/2), and `pow` within one unit of glibc's; `PORTABLE`, `NATIVE` and `mathFor`.
- WP-2.1: my-3d2dge's helpers bit for bit with core.json (`clamp`, `lerp`, `approach`, the angle helpers,
  `smoothDamp`, `ease`, `hash2`, `noise2`); `Rng`, `rng`, `derive` and `RngStreams`; `Fnv64`, `hashNumbers` and
  `hashValue`; `vec3`, `quat` (slerp, swing-twist, from unit vectors) and `mat4`.
- WP-2.1: the codec, the skeleton profile and the validator call the portable math (tiers 1a and 2 unchanged, bit
  for bit); lint bars the host's transcendental `Math` functions from core (D33).

### Tools
- WP-2.1: `npm run test:cross-engine`: V8 against JavaScriptCore (Bun), bit for bit, with each function's cost.

## 0.6.0 · 2026-10-11

### Spec
- G1: spec 2.0-rc frozen (D31): `spec/frozen.json` holds the SHA-256 of `MOTION.md`, `SKELETON.md`, `LEGEND.md`,
  `conformance/tiers.md` and the schemas. Before the freeze: `_baseline.json` (§9.4, with
  `schemas/baseline.schema.json`) and the source record's `terms`, `audit`, `file` and `rig` (§9.1).
- G1's verifier fixes (D32): the frame is f × r = z as numbers, left-handed physically (§2); §5.2 gives every
  optional field's range, and `root` is ±10,000,000 in spec, validator and schema; `quality.fit` is measured against
  the source frames whatever the method (§7.5); skeleton names drop the `mixamorig` prefix three.js's loader leaves.

### Library
- WP-1.5: the seed sets in format 2: QUATERNIUS_3D2DGE (88), QUATERNIUS_SHARDFALL (102), MESH2MOTION (177),
  CMU_CURATED (60, tier cmu, CMU's notice word for word), STYLE100 (98, tier cc-by): 525 clips, each with
  `_set.json`, `catalog.tsv` (rows within 40 tokens) and `_baseline.json` (reasons per warning, from the clip's keys).

### Tools
- WP-1.5: `npm run migrate [-- --check]`.
- G1: the doctrine's `frozen` check and `node tools/doctrine/freeze.ts <decision>`; it also fails a missing record, an
  unrecorded schema and an unlogged decision. `npm run gate -- G1` runs the gate's command set.

### Core
- WP-1.3's verifier fixes: hand roll unwraps; fingers curl toward the palm normal; `fromFormat1` takes the method;
  the normalized lens; format 2's fields get vectors (`tier2/FORMAT2.json`).
- Sampling takes a format-2 clip directly (`Timed.keys` accepts `Key`).
- The set validator rejects a non-positive `rest.H0` and non-string source fields, as the schema does.

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
