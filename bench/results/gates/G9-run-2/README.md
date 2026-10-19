# Gate G9 = M3, run 2 (its command set passed, 16 of 16; the hosted run, the adoption by a merged pull request and the owner's approval blocked-owner; D115)

Run at 9d4342d (0.52.1) on 2026-10-19, 13:11–13:39 UTC, in 1,641.9 s, in the main checkout, the tree clean, no lane
running. Its held-out variant was run 3 (`bench/results/heldout/G9/run-3/`, gen-5672, a bulky VRM-named body, arms 70°
down), written and checked by two fresh subagents under D91's read bar; runs 1 and 2 were not used (run 1 written
before B8's rules grew, run 2 used by G9's run 1).

- `report.json`: the gate's report as `npm run gate -- G9 --json` wrote it; `logs/`: each step's log.
- `B8.json`, `B8-variant.json`, `B8-ten.json`: the bench's results (moved here from bench/results/); the variant's
  known-good check passed before its trials.
- `B8-ten-1.transcript.jsonl`: B8-ten's one trial, the agent's stream as the runner kept it.
- `queue.json`: **the owner's sampled batch** for G9's approval: `m3a review export` in B8-ten's workspace
  (m3a.review-queue/1), its ten submissions awaiting review (each with its ref, `id@hash`, and its numbers) and 20
  library clips sampled in a fixed order.

| Step | Result |
|---|---|
| check / test (T1) / doctrine / vectors --check | PASS: 2.8 s / 108.3 s (over the 90 s budget, under 135; CI's T1 77.1 s) / 8 of 8 / 16 files byte for byte |
| the intake's fixtures | PASS, 18/18 (4 wait for review, 14 bounced with their reasons) |
| a pull request with a planted bad clip fails the library gates | PASS, 28/28 plants, 64.7 s |
| the adopt bot: its dry run / its whole proof (M3A_FULL) | PASS, 8.8 s / 156.3 s |
| the library's ids / the registry index byte for byte / every set verified | PASS |
| T2: browser checks, library QA, the sweeps in full | PASS, 327.5 s of 480 |
| the held-out run fresh | PASS (run-3, seed 5672) |
| B8: 4 of 5 fresh agents | PASS, 5/5, $0.51 |
| B8-ten: one fresh agent, ten clips, all through | PASS, 1/1: 19 sent, 10 waiting for review passing every check, 9 bounced (7 near-duplicates, 2 retarget slides), 28 turns, 389 s, $0.41 |
| B8's held-out variant | PASS, 5/5, $0.95 |

**Open (blocked-owner, §9.3):** the intake contract suite run in Actions against O8's linked project (a contributor
can't change a state there); a clip the owner adopts landing in its set through a merged pull request (the adopt bot
in intake.yml, which needs O8's secrets and Actions allowed to open pull requests); the owner approving at least 70% of
a sampled batch (this `queue.json`, through the gallery's review page, then `npx m3a review ingest <file>`). Asked on
michaelcrosato/my-3danimations#16. G9 merges with them open (§8.5).
