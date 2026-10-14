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
- `sweep.json` was re-derived on 2026-10-14 (d0bcfd5) from the
  gate's raw results (`check-output/sweep/results.json`, written at adf77ee) by `npm run sweep -- --record`, no rerun:
  each failing pair now carries the warns the skeleton added (`warns`: 86 of the 263; 792 pairs carry one in all),
  which the first record dropped (the G4 run 2 verifier, D88); every field but those and `about` is byte for byte as
  first recorded.
- `presweep.json`: the sweep outside the gate at adf77ee, the six skeletons (D57's condition for this run).
- `set.json`: the demo's scripted session (idle, walk, run, jump, attack) on each skeleton and the held-out rig, as the
  sensors read it.
- `B1.json`, `B1-variant.json`: both benchmark runs, trial by trial (5 trials and 2 discovery trials; 5 on the
  variant, its known-good first); `B1-variant-known-good.json`: the known-good on the variant, run before the gate
  (`npm run bench -- B1 --trials 1 --fake --heldout G4`). The agents' transcripts stayed in the run's workspaces under
  `/tmp/m3a-bench/` (not committed).
- `transcripts.json`: those twelve transcripts by path, SHA-256 and size. `B1.json`'s audit (and its byte copy's,
  `bench/results/2026-10-14-default-B1.json`) is the corrected one, read from them (D88: the G4 run 2 verifier found
  the runner's audit took only a shell command's absolute paths): B1-1, B1-3 and both discovery trials read past the
  manual (the packages' `.d.ts` files and the library's lock; discovery-1's `README*` glob matched no file, since no
  package ships one), B1-2 wrote a scratch file beside its workspace in its own /tmp, none touched anything outside;
  `B1-variant.json`'s audit is unchanged. The transcripts live only in this machine's `/tmp/m3a-bench/`: the hashes
  let a kept copy be checked, not the transcripts be recovered.
