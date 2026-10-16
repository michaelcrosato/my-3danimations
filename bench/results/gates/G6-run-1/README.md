# Gate G6, run 1 (passed, 20 of 20)

Run at a9731b1 (0.45.1) on 2026-10-15 from 22:19 to 22:36 UTC, in 17.2 min. It ran in the main checkout, after the
pinned sources and the rigs were fetched.

The commit was fixed first: T0, T1 and T2 passed on it, and CI was green. Then `bench/results/heldout/G6/run-1/` was
written and committed (7996969); during the gate it sat untracked beside the commit, identical to what is committed (a
local exclude hid it and the gate's results from git status, and also, unnoticed, from the record's first commit: the
byte copies below came in a later commit, the G6 verifier's finding). Each brief's known-good solution passed on its
variant before the gate (`npm run bench -- <B> --trials 1 --fake --heldout G6`). `claude -p` was checked with the quiz
at 18:47 that day, at 70a45c6 (10/10, `bench/results/2026-10-15-default-quiz.json`).

- `report.json`: the gate's report, each command with its verdict, as `npm run gate -- G6 --json` wrote it.
- `logs/`: each step's log, and the run's console output (`gate.log`).
- `B2.json`, `B3.json`, `B5.json`, `B6.json`, `B7.json`: each brief's five fresh agents, trial by trial (isolation 1,
  each agent with its own /tmp, five at a time, D84).
- `<B>-variant.json`: five fresh agents on the held-out variant, its known-good first.
- `<B>-variant-known-good.json`: the known-good on the variant, run before the gate.
- Byte copies of the ten benchmark records are in `bench/results/2026-10-15-default-*.json`.
- `heldout.json`: the held-out run's writer and its independent check.
  - The writer was a fresh subagent that read neither the manual nor any known-good solution; its file list is
    recorded. It did read docs/DECISIONS.md's D76 and D77, which describe the known-good solutions and name the
    manual's examples (the G6 verifier's finding): the one trace either check found is B6's "wind-up", the word D77
    gives a manual example. Later runs' writers are barred from them (D91).
  - The seeds are 722 (B2: bulky, relaxed, ue5), 808 (B3: child, A, vrm), 765 (B5: chibi, T, mixamo, twist bones),
    871 (B6: heroic, A, rigify, twist bones) and 809 (B7: tall, relaxed, mixamo).
  - The check returned ok with three nits, recorded and not changed:
    - B2's title names a tavern its scene doesn't have.
    - B6 calls the draw-back a "wind-up", a word D77 gives a manual example (the writer read D77, not the manual).
    - B6 reuses more of its original's wording than the others: 35% of its 6-grams, against 14 to 24%.
- `transcripts.json`: the fifty agent transcripts by path, SHA-256 and size. They stayed in the runs' directories
  under `/tmp/m3a-bench/` and are not committed.

**Results:** 50 of 50 trials pass, at least 4 of 5 needed on each; every agent ran claude-sonnet-5-5, the CLI's
default, in print mode with the tools Bash, Edit, Glob, Grep, Read and Write, five at a time. Costs are rounded to the
cent.

| Brief | Trials | Variant | Wall time | Turns | Cost (both) |
|---|---|---|---|---|---|
| B2 | 5/5 | 5/5 (seed 722) | 21–27 s | 5–6 | $1.11 |
| B3 | 5/5 | 5/5 (seed 808) | 49–149 s | 7–22 | $2.38 |
| B5 | 5/5 | 5/5 (seed 765) | 17–34 s | 5–9 | $0.95 |
| B6 | 5/5 | 5/5 (seed 871) | 19–80 s | 6–22 | $1.15 |
| B7 | 5/5 | 5/5 (seed 809) | 36–85 s | 5–14 | $1.58 |

No agent touched anything outside its workspace and its own `/tmp` (the audit's `outside` is empty in every trial, and
the G6 verifier read all fifty transcripts: 379 tool calls, none naming another path). Twenty trials kept scratch files
in their own `/tmp` (`scratch`; B6-4 briefly wrote one at `../dbg_B6.ts`, inside it): B3-1, -2, -4 and its variant's
-1, -2, -3, -5; B5-1 and its variant's -1, -2, -4; B6-3, -4 and its variant's -3, -5; B7-1, -2 and its variant's -1,
-2, -4. Some read past the manual, into the packages:

- the `.d.ts` files: all five of B3's variant trials; B6-1 and B6-5 on its variant and B6-4 on the brief; B7-4 on
  its variant and B7-2 on the brief;
- `@m3a/core`'s README: B6-4 on the variant;
- the recipe compiler's and the pose operations' built JS: B6-4 on the brief; the recipe validator's: B6-5 on the
  variant.

B7-2 on the variant is listed with `@m3a/library`'s Node entry, but it only named that file in an import line written
into a heredoc and replaced it before running anything: an over-report of the audit (D91).

These name what the manual leaves to the types, which is WP-7.3's input.

The other commands:
- T0 passed in 10.6 s and T1 in 76.0 s.
- The doctrine, vectors and moves checks passed.
- Composed clips passed QA (recipes, procedural sources, actions and their cuts) in 18.1 s; the cuts on all six
  test characters are proved by T2's full sweep (T1 samples two).
- Graph simulations were deterministic in 5.7 s.
- T2 passed in 128.8 s, with the graphs equal in Node and Chromium, library QA, and the sweeps in full.
- The held-out run was fresh.
