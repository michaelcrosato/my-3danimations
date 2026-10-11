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

## Sources

None yet.
