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
