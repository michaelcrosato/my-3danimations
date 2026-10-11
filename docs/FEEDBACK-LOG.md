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
| WP sizes | watch | F1 | A WP runs past its size by more than a fifth |
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
