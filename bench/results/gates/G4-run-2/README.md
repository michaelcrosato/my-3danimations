# Gate G4, run 2 (passed, 9 of 9; D88)

Run at adf77ee on 2026-10-14, 21:54 to 22:36 UTC, in the main checkout with the pinned sources and the rigs fetched
first and `bench/results/heldout/G4/run-2/` beside it (untracked, identical to what is committed), in 41.8 min. The
commit was fixed before the held-out run was written (D57); the sweep outside the gate that D57 asks for ran at the same
commit first (`presweep.json`).

- `report.json`: the gate's report, each command with its verdict, as `npm run gate -- G4 --json` wrote it; `logs/`
  holds each step's log and the run's console output (`gate.log`).
- `sweep.json`: the sweep step: per skeleton, the six together, every failing pair with its reasons, and every pair
  that passes with a warn the skeleton added (`warned`, D80); a pair in neither list passes clean. The held-out rig
  apart.
- `presweep.json`: the sweep outside the gate at adf77ee, the six skeletons (D57's condition for this run).
- `set.json`: the demo's scripted session (idle, walk, run, jump, attack) on each skeleton and the held-out rig, as the
  sensors read it.
- `B1.json`, `B1-variant.json`: both benchmark runs, trial by trial (5 trials and 2 discovery trials; 5 on the
  variant, its known-good first); `B1-variant-known-good.json`: the known-good on the variant, run before the gate
  (`npm run bench -- B1 --trials 1 --fake --heldout G4`). The agents' transcripts stayed in the run's workspaces under
  `/tmp/m3a-bench/` (not committed).
