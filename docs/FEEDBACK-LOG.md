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
| Provenance of measured facts | deferred | F1 | WP-2.2 recomputes facts with core's own tools |
| Proof coverage of the migration | watch | F1 | A set is re-imported (WP-5.3) |
| What core reads and validates | no / deferred | F1 | WP-3.3 (a baseline writer besides the migrator), WP-4.3 (VRM) |
| WP sizes | **reached** (F1, F4) | F1, F4 | Now: WP-7.2b's records weigh splitting, and 8.2 and 9.1 are measured before they start |
| Roll where the format's reference is undefined | deferred | F2 | WP-3.5 lints twist and heading jumps at straight limbs |
| What the tier-3 bodies cover | deferred | F2 | WP-4.2's test characters (real rigs, other topologies) |
| Forearm twist on rigs without twist bones | deferred | F2 | WP-4.3 binds real skeletons |

## Sources

### F1 · 2026-10-11 · The G1 verifier's notes (a fresh agent, the same model family)

Its seven failures were fixed before the merge (D32). Of its notes, these were not acted on:

- **F1.1** (provenance of measured facts, deferred) `facts.by` says `m3a-migrate@1` for a `speed` that shardfall's
  importer measured; the migrator copied it. WP-2.2 recomputes facts with core's tool, and `by` then names it.
- **F1.2** (proof coverage, watch) Decoding within 1 µm is proven by decoding for three sets; QUATERNIUS_SHARDFALL and
  STYLE100 rely on equal keys and copied rests, which is valid by construction.
- **F1.3** (what core reads, no) Reading VRM's `humanBones` extension isn't in core: it belongs to `@m3a/io` (WP-4.3).
- **F1.4** (what core validates, deferred) `_baseline.json` has a schema but no validate kind in core; the migrated
  library's test checks it against the schema. Take it up when a second tool writes baselines (WP-3.3).
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
  straight limbs when re-importing (WP-5.3).
- **F2.5** (what the tier-3 bodies cover, deferred) The seven tier-3 bodies share one topology, a T rest and identity
  rest frames, and the sets' own bodies are never targets. WP-4.2's test characters add real rigs.

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
  8.2 and 9.1 are measured before they start (a split as D93's if past L).
- **F4.2** (no) The t1-speed lane's caches (rest conjugates, shoulders, hint starts, `points()` and `rootFrom` memos)
  assume a rest and the arrays core returns are never edited in place. No code in the repository does; it is the same
  pattern as the existing `DERIVED` map. State it in the API docs if hosts are found to mutate rests.
- **F4.3** (watch) `animator.test`'s second pose test reuses the first test's runs: one fewer independent re-run per
  mode, so a repeat-run slip would show only against `straight`. Cross-engine and Node = Chromium still re-run the
  whole script.
- **F4.4** (no) bind.test.ts's `libraryClip()` copies tools/qa's rest lookup; the two could drift. Both read the same
  library layout, which the loader's tests pin.
- **F4.5** (deferred) `tools/doctrine/doctrine.test.ts` leaves about 38 `/tmp/m3a-doctrine-*` directories per T1 run
  (1.2 MB). Take it up when a test-hygiene pass touches the doctrine tests.
- **F4.6** (watch) Vectors use 9.78 of the 10 MB committed budget; WP-10.2's conformance kit must generate rather than
  commit where it can.
