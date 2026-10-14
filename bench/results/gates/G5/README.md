# Gate G5 (passed; D66, D67, D68)

Run at 754adfe on 2026-10-12, in 9.7 min, 12 of 12 commands. A first run at add333b passed its commands too, but its
verifier blocked it: the reactions floor was short (D67 has what it found and what changed).

- `report.json`: the gate's report, each command with its verdict, as `npm run gate -- G5 --json` wrote it, and the
  commit it ran at.

The numbers: 1,393 clips in 11 sets, 1,194 unique motions (84 copies by `orig`, 112 re-exports, 3 near-duplicates by
pose); the CC0 default pack 366 clips, 170 unique; every clip validates and carries its verdict (1,008 pass; 230 warn
and 155 fail baselined, each with its reason); categories against G5's floors: reactions 35/33, combat 61/60, traversal
50/30, locomotion 812/200, interaction and work 65/60, gestures and emotes 61/60, idles 108/30; the 40 search queries
40/40 and the held-out 8/10; `npm run license -- check library` passes. `docs/LIBRARY.md` is the summary.
