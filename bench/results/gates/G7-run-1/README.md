# Gate G7, run 1 (failed, 23 of 24 gating commands; D106)

Run at 1623b78 (0.50.1) on 2026-10-19 from 00:53 to 02:17 UTC, in 84.0 min, in the main checkout with the pinned
sources and the rigs fetched. The commit was fixed first: T0, T1 and T2 passed on it and CI went green at 00:56. The
held-out run (`bench/results/heldout/G7/run-1/`, written and checked on 2026-10-17) sat beside it, committed. Each
brief's known-good passed on its variant before the gate (`npm run bench -- <B> --trials 1 --fake --heldout G7`, the
`<B>-variant-known-good.json` here). The quiz passed 10 of 10 at 00:51 (`bench/results/2026-10-19-default-quiz.json`).

- `report.json`: the gate's report as `npm run gate -- G7 --json` wrote it; `logs/`: each step's log and the console
  output (`gate.log`).
- `<B>.json`: each brief's five fresh agents (B1's with its two discovery trials); `<B>-variant.json`: five on the
  held-out variant; `recorded-<model>.json`: B1 to B7 once each on the three recorded models (D98, not gating).
- `heldout.json`: run 1's writer and its independent check (`bench/results/heldout/G7/run-1/check.json`).
- `transcripts.json`: the 93 transcripts by path, SHA-256 and size (not committed; under `/tmp/m3a-bench/`).
- Byte copies of the benchmark records are in `bench/results/2026-10-19-*.json` (B1's is `-B1-4.json`).

**Results** (the CLI's default, claude-sonnet-5-5, isolation 1, five at a time):

| Brief | Trials | Variant |
|---|---|---|
| B1 | 5/5 (discovery 2/2 used the package, 1 passed) | **3/5** (seed 1287: bulky, T-pose, Rigify, twist bones, no shoulders) |
| B2 | 5/5 | 5/5 |
| B3 | 5/5 | 5/5 |
| B4 | 5/5 | 5/5 |
| B5 | 5/5 | 5/5 |
| B6 | 4/5 | 5/5 |
| B7 | 5/5 | 4/5 |

Recorded, one trial a brief: claude-opus-5-5 7/7 ($3.90), claude-haiku-5-5 7/7 ($0.33), claude-fable-5-1 7/7
($19.06). Check 2.0 s, test 81.5 s (981 tests), doctrine, vectors, the tool examples on four surfaces 18.0 s, the
manual's code 6.5 s, `pack --check` 20.5 s, the single file's licenses, T2 117.0 s, the held-out run fresh.

**What failed:** B1's variant, 3 of 5. B1-5 shipped `MESH2MOTION/Run_Female` and moved the character at v itself (the
lower foot never stood still at 3.67 m/s); B1-3 shipped `MESH2MOTION/Jog` and slid during its run, also moved at v.
D106 gives the cause and the fix; run 2 writes fresh variants into `bench/results/heldout/G7/run-2/`.
