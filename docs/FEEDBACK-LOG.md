# Feedback log

The points we did **not** act on, from models and people who used the package, reviewed the library or ran the
benchmark. The same point coming back from later sources is how a pattern shows, so it can be weighed again. What we
do act on goes into a WP (`PLAN.md`) or a decision (`docs/DECISIONS.md`) and then into the changelog.

- **Sources.** Each round of feedback is a source, numbered `F1`, `F2`, ..., newest last: a benchmark run, a review
  batch from the ground station, a game built on the package, a verifier's notes. Each point not acted on gets one
  line (`F1.1`, ...) with a theme.
- **Status.** Each point is one of three:
  - **no**: not a problem for what the package is for;
  - **deferred**: valid, but not now, with when to take it up;
  - **watch**: handled indirectly, or too early to tell.
- **Patterns.** The themes table counts sources. A theme reaches its threshold at three sources, or at two from
  different model families. Then the next WP that touches it takes it up and decides again.
- **Never cleaned up**, like `docs/DECISIONS.md`. A point taken up later is marked **Taken up in v0.x.y** and kept.

## Themes

| Theme | Status | Sources | Take it up when |
| --- | --- | --- | --- |
| Provenance of measured facts | **Taken up in v0.33.0** | F1 | Every clip's facts are core's (`by: m3a-facts@1`, WP-5.4, D64) |
| Proof coverage of the migration | watch | F1 | A set is re-imported (WP-5.3) |
| What core reads and validates | no | F1 | Answered in v0.53.1: every set's `_baseline.json`, whoever wrote it, is checked against its schema in T1 |
| WP sizes | **reached** (F1, F4) | F1, F4, F5, F6 | Taken up in v0.51.0 and v0.52.0: 8.2 and 9.1 split (D109, D112); a WP is measured against its class before it starts |
| Roll where the format's reference is undefined | **Taken up in v0.18.0** | F2 | WP-3.5 repairs twist flips; WP-5.3's `steadyTwist` (v0.32.0) holds a straight limb's twist |
| What the tier-3 bodies cover | **Taken up in v0.21.0** | F2 | WP-4.2's test characters and the fetched CC0 rigs (D46) |
| Forearm twist on rigs without twist bones | deferred | F2 | A consumer's rig without twist bones candy-wraps (WP-4.3 passed without it) |
| The manual's budget | watch | F5, F6 | A third source, or the next manual change (docs/HANDOFF.md's follow-ups) |
| What the tools can name | **Taken up in v0.54.0** | F6 | `gen-<seed>` and an orbit on every surface (D119) |
| How strict the intake is | deferred | F6 | The importers' regenerations go through the adopt bot (the terms and `intake.by`: taken up in v0.54.0, D119) |
| The intake's cost | **Taken up in v0.54.0** | F6 | The checker samples the library once and only new submissions after (D119) |
| Review notes | watch | F7 | When it reaches three sources, or two from different model families |

## Sources

### F1 · 2026-10-11 · The G1 verifier's notes (a fresh agent, the same model family)

Its seven failures were fixed before the merge (D32). Of its notes, these were not acted on:

- **F1.1** (provenance of measured facts, deferred) `facts.by` says `m3a-migrate@1` for a `speed` that shardfall's
  importer measured; the migrator copied it. WP-2.2 recomputes facts with core's tool, and `by` then names it. **Taken up in v0.33.0** (D64).
- **F1.2** (proof coverage, watch) Decoding within 1 µm is proven by decoding for three sets; QUATERNIUS_SHARDFALL and
  STYLE100 rely on equal keys and copied rests, which is valid by construction.
- **F1.3** (what core reads, no) Reading VRM's `humanBones` extension isn't in core: it belongs to `@m3a/io` (WP-4.3).
- **F1.4** (what core validates, deferred) `_baseline.json` has a schema but no validate kind in core; the migrated
  library's test checks it against the schema. Take it up when a second tool writes baselines (WP-3.3). It came (the importer writes them); **no** in v0.53.1
  (D118): every set's `_baseline.json`, whoever wrote it, is checked against the schema in T1 (`migrated.test.ts`).
- **F1.5** (WP sizes, watch) WP-1.2 added 1,232 lines, just over M's 1,200.
- **F1.6** (no) MESH2MOTION's `Death_D` and `Hit_Chest` have no `orig`: the origin has none to carry.

### F2 · 2026-10-11 · WP-2.4's verifier's notes (a fresh agent, the same model family)

Its eight failures were fixed in v0.11.1 (D36). Of its notes, these were not acted on:

- **F2.1** (forearm twist, deferred) A format-2 hand roll turns the hand bone alone, while the forearm keeps the arm
  plane's roll. On a rig without twist bones the wrist can candy-wrap. Unity splits that twist with the lower arm.
  Take it up with real skeletons (WP-4.3).
- **F2.2** (no) The floor lift leaves a planted sole floating where a longer-legged target is lifted (median 36 mm on
  the rig). Planting sets planted soles on the ground (WP-2.5, D37).
- **F2.3** (what the tier-3 bodies cover, no) Tier 3's whole-limb check is 0° by construction, because the decoder
  sets that direction on any body. A per-segment reading would fail (thigh against shin 14.3°) only because the
  source bodies' segment ratios differ. The format's contract is the whole limb (shardfall's tests/motion.rs:23-51).
- **F2.4** (roll where the format's reference is undefined, deferred) Thigh and calf turn about their own axis where
  the data's twist jumps at a straight leg (Sprint_Loop: 177°, then 354°). A foot's roll does the same where its
  heading jumps pointing straight down. Joint positions are unaffected. Lint them (WP-3.5) and carry the twist through
  straight limbs when re-importing (WP-5.3). **Taken up in v0.18.0 and v0.32.0**.
- **F2.5** (what the tier-3 bodies cover, deferred) The seven tier-3 bodies share one topology, a T rest and identity
  rest frames, and the sets' own bodies are never targets. WP-4.2's test characters add real rigs. **Taken up in v0.21.0** (D46).

### F3 · 2026-10-11 · The G2 verifier's notes (a fresh agent, the same model family)

Its seven failures were fixed in v0.12.1 (D38). So were most of its notes:
- a clip with no id, a zero-length loop, a malformed saved layer, and a clip map's prototype names;
- a base layer at weight 0 now fires its events;
- event times are exact;
- the clamped weight is documented;
- the Animator's script runs in Bun too.

These were not acted on:

- **F3.1** (no) D36 was rewritten in place, with lines removed, before its phase merged. Decisions are append-only
  once on `main`, which the doctrine check guards; within the open phase a WP's own entry is kept current with what
  landed.
- **F3.2** (no) `maxSteps` and the ground are not in the save. They are the host's settings, like the dt it passes,
  and D38 says so.

### F4 · 2026-10-16 · The audit of the state a usage limit left (15 read-only agents, the same model family)

The pause left WP-7.2b's lanes merged with no records. What the audit found is acted on in WP-7.2b's fixes and D96/D97;
these points were not:

- **F4.1** (WP sizes, reached) WP-7.1 ran about 10% past its size and WP-7.2a 23%; WP-7.2b is about 3,027 lines, past
  L's 3,000, before its fixes. The theme reaches two sources here (F1.5, F4): 7.2b's D-entry weighs the overrun, and
  8.2 and 9.1 are measured before they start (a split as D93's if past L). **Taken up in v0.51.0 and v0.52.0** (D109, D112).
- **F4.2** (no) The t1-speed lane's caches (rest conjugates, shoulders, hint starts, `points()` and `rootFrom` memos)
  assume a rest and the arrays core returns are never edited in place. No code in the repository does; it is the same
  pattern as the existing `DERIVED` map. State it in the API docs if hosts are found to mutate rests.
- **F4.3** (watch) `animator.test`'s second pose test reuses the first test's runs: one fewer independent re-run per
  mode, so a repeat-run slip would show only against `straight`. Cross-engine and Node = Chromium still re-run the
  whole script.
- **F4.4** (no) bind.test.ts's `libraryClip()` copies tools/qa's rest lookup; the two could drift. Both read the same
  library layout, which the loader's tests pin.
- **F4.5** (deferred) `tools/doctrine/doctrine.test.ts` leaves about 38 `/tmp/m3a-doctrine-*` directories per T1 run
  (1.2 MB). Take it up when a test-hygiene pass touches the doctrine tests. **Taken up in v0.53.1** (D118).
- **F4.6** (watch) Vectors use 9.78 of the 10 MB committed budget; WP-10.2's conformance kit must generate rather than
  commit where it can. **Taken up in v0.53.0**: the kit commits no vectors.

### F5 · 2026-10-17 · WP-7.3's and WP-7.4's reviews, and B1's rerun (the same model family)

Acted on in D100 and D101; these points were not:

- **F5.1** (WP sizes, reached) WP-7.3 came to about 1,500 lines and WP-7.4 to about 1,720, both past M's 1,200,
  mostly tests. A third source for the theme (F1, F4, F5): 8.2 and 9.1 are measured before they start. **Taken up in v0.51.0 and
  v0.52.0** (D109, D112).
- **F5.2** (deferred) The manual doesn't say which package exports `LibraryError` or that its code is on `.code`; at
  7,998 of 8,000 tokens it has no room. Take it up with the next manual change, cutting first. **Taken up in v0.55.1**
  (D124): Find's Tiers sentence names `@m3a/library` and the codes `E_TIER`, `E_NO_SET`, `E_NO_CLIP`.
- **F5.3** (deferred) T2 doesn't run `npm run pack -- --check` or load `m3a.js` in Chromium; G7's set runs pack
  --check. Take it up if a packaging change slips between gates. **Taken up in v0.53.1** (D118): T2 loads `m3a.js` in
  Chromium.
- **F5.4** (deferred) 30 library loops have no detected foot contacts; agents that pick one can't match its speed
  (B1). The next session fixes them before G7 (HANDOFF). **Taken up in v0.50.1** (D104; narrowed in
  v0.50.2, D108; the 6 left wait in docs/HANDOFF.md's follow-ups, D119).

### F6 · 2026-10-19 · Phases 8 to 10's verifier reviews and the post-G10 audit (the same model family)

The reviews' fixes landed in D109, D113, D116 and D117, the audit's easy findings in D118; these points were not
acted on (D119 took up or deferred each):

- **F6.1** (what the tools can name, deferred) The CLI and MCP can't name a generated `gen-<seed>` character, which the
  gallery plays, nor an orbit other than the named views (D109). **Taken up in v0.54.0** (D119).
- **F6.2** (how strict the intake is, deferred) library-gates holds a clip added outside the intake to the intake's
  gates but passes a clean one (D113); `deliver` allows differing stated and served terms when both are allowlisted,
  and the format leaves `intake.by` optional. The terms and `intake.by` **taken up in v0.54.0** (D119); the
  adopt bot's monopoly waits for the importers (docs/HANDOFF.md).
- **F6.3** (the intake's cost, deferred) Each checker run rebuilds the census over the whole library, about 1 s on the
  runner's event loop (WP-9.1b's review). **Taken up in v0.54.0** (D119): later runs sample only what is new.
- **F6.4** (the manual's budget, watch) The manual, at 7,999 of 8,000 tokens, can't teach the names the consumer lab
  uses beyond it (D116, MIGRATING gap 10). **Taken up in v0.55.1** (D124): the manual teaches six of them, cutting its Tools
  reference, at 7,998 of 8,000. **Taken up in v0.55.x** (D128): the rest but gap 1's (`character`, `variant`,
  `TEST_SEEDS`, `loadGlb` in a page, the attached player's `apply()` and `bound`; the types left to the compiler),
  cutting Ship and actions, at 7,999 of 8,000.
- **F6.5** (WP sizes, reached) WP-8.2 came to 3,023 lines and was split, 9.1 to about 2,800 (split), 9.4 to 683 (past
  S) and 10.2 to about 1,400 (past M).

### F7 · 2026-10-22 · A review from the ground station (owner)

- **F7.1** (review notes, watch) `STYLE100_SIDERUN/Stiff_SideRunLeft@6b352005f1fd` approved: This is a side step,
  definitely not a side run.
- **F7.2** (review notes, watch) `CMU_CURATED/Jump_Twist@3ab846fac374` flagged: The character never gets to the
  actually jump, just leading up to it, which was fine. **Taken up in v0.59.0** (D135): cut again to the flip itself.
- **F7.3** (review notes, watch) `STYLE100_SIDERUN/ShieldedRight_SideRunRight@2da4aa85e13a` approved: Again, side step
  but otherwise if he is holding hand up and there was a shield it would be fine
- **F7.4** (review notes, watch) `STYLE100_SIDE/LawnMower_SideLeft@e9a30279816d` flagged: I think you need to state
  what the expectations are of what I am supposed to see and what you think is happening, there is a person rolling
  his hands in front of his pelvis bending over. **Taken up in v0.58.0** (D134): each card says what its clip should
  show, as an agent reads it, and the page's guide what to look for.
- **F7.5** (review notes, watch) `STYLE100_SIDE/CrowdAvoidance_SideRight@6d215290cc63` approved: A person side
  stepping, head slightly back
- **F7.6** (review notes, watch) `STYLE100_BACKRUN/KarateChop_RunBack@4dd46b3d65ff` approved: They are moving
  backwards, run debatable, he is doing a chopping motion with his hands
- **F7.7** (review notes, watch) `STYLE100_IDLE/CrossOver_Idle@b65028f82f7c` approved: This is a pose. There is no
  actual animation. **Taken up in v0.59.0** (D135): the idles keep their motion (frozen clips 102 → 17).
- **F7.8** (review notes, watch) `STYLE100_IDLE/OnPhoneLeft_Idle@f2e25e7b2368` approved: A pose no animation. **Taken
  up in v0.59.0** (D135), as F7.7.
- **F7.9** (review notes, watch) `CMU_CURATED/Pick_Up_Basket@04c9a32eadf4` approved: Idk, they walk up, pick up, turn
  right spin 360 degrees and back pedal, **Taken up in v0.60.0** (D136): the page showed the clip's turn twice; its
  data turns about 190° to its right and walks forward. The review stands, the owner's to keep or remake.
- **F7.10** (review notes, watch) `STYLE100_BACKRUN/Elated_RunBack@1492349cad00` approved: Its faster than the other
  back runs idk what elated means
- **F7.11** (review notes, watch) `CMU_CURATED/Wrench_Bolt@fb26b9a3a9c1` approved: Look fine not sure what its for
- **F7.12** (review notes, watch) `MESH2MOTION/Fighting_Right_Jab@ab1b5c8b9f0c` approved: Jab is a fine if they want
  to love tap or touch the chest
- **F7.13** (review notes, watch) `STYLE100_BACK/WildArms_WalkBack@b9dfd2a9af09` approved: Sure... wildarms, walking
  like a kid swinging his arms up and and down as they walk to a pose
