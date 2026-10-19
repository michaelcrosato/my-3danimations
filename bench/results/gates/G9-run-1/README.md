# Gate G9, run 1 (failed, 15 of 16: B8-ten's one agent got 9 of its ten clips through; D114)

Run at ba75cff (0.52.1) on 2026-10-19, 12:23–12:42 UTC, in 1,151.9 s, in the main checkout, the tree clean, no lane
running. Held-out run 2 (`bench/results/heldout/G9/run-2/`, gen-7359) was its variant; run 1 (gen-9406), written
before B8's rules grew (D113), was never used.

- `report.json`: the gate's report as `npm run gate -- G9 --json` wrote it; `logs/`: each step's log.
- `B8.json`, `B8-variant.json`, `B8-ten.json`: the bench's results (moved here from bench/results/); the variant's
  known-good check passed before its trials.
- `B8-ten-1.transcript.jsonl`: B8-ten's one trial, the agent's stream as the runner kept it.
- `queue.json`: the owner's sampled batch, `m3a review export` in B8-ten's workspace (m3a.review-queue/1): its ten
  submissions awaiting review and 20 library clips sampled in a fixed order (the owner's G9 approval, blocked-owner).

| Step | Result |
|---|---|
| check / test (T1) / doctrine / vectors --check | PASS: 2.7 s / 107.5 s (over the 90 s budget, under 135) / 8 of 8 / 16 files byte for byte |
| the intake's fixtures | PASS, 18/18 (4 wait for review, 14 bounced with their reasons) |
| a pull request with a planted bad clip fails the library gates | PASS, 28/28 plants, 61.7 s |
| the adopt bot: its dry run / its whole proof (M3A_FULL) | PASS, 8.4 s / 144.1 s |
| the library's ids / the registry index byte for byte / every set verified | PASS |
| T2: browser checks, library QA, the sweeps in full | PASS, 321.3 s of 480 |
| the held-out run fresh | PASS (run-2, seed 7359) |
| B8: 4 of 5 fresh agents | PASS, 5/5, $0.76 |
| **B8-ten: one fresh agent, ten clips, all through** | **FAIL, 0/1: 9 of its 14 submissions pass every check** ($0.21, 11 turns) |
| B8's held-out variant | PASS, 5/5, $0.55 |

**Why B8-ten failed.** The agent sent ten emotes, four of which the queue bounced as near-duplicates of their
library sources; it replaced those four, and ten waited for review with every gate green. One of the ten walks
(`describe`: "a 1.67 s loop; 0.00–1.67 s walks"), which the brief rules out (an emote stays where it stands, as
`npx m3a describe` reads it); the agent said it had not read any clip with `describe`. So 9 pass every check. The
intake had no word for it: a clip tagged emote that walks waited for review. **Fixed forward (D114):** the intake's
lint gate bounces a contribution tagged `emote` or `idle` that walks, runs or travels a quarter of its hip height or
more, as `describe` reads it, so `m3a library submit` refuses it locally, naming the reading.
