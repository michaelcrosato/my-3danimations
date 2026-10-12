# Gate G4, run 1 (failed, 5 of 8; D57)

Run at 6798b45 on 2026-10-12, with `bench/results/heldout/G4/run-1/` beside it, in 19.7 min.

- `report.json`: the gate's report, each command with its verdict, as `npm run gate -- G4 --json` wrote it. Its B1
  variant step reads PASS; it counts as a grader failure (§7: the first seed broke the known-good solution).
- `sweep.json`: the sweep step's results per skeleton, and every failing pair with its reasons (a pair not listed
  passes); the held-out rig apart.
- `set.json`: the demo's scripted session on each skeleton and the held-out rig, as the sensors read it.
- `B1.json`, `B1-variant.json`: both benchmark runs, trial by trial (the variant's on seed 401, the redraw).
