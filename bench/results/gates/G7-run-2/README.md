# Gate G7, run 2 (passed, 24 of 24 gating commands; D107)

Run at 5d1ec8f (0.50.1) on 2026-10-19 from 02:58 to 04:31 UTC, in 93.0 min, in the main checkout with the pinned
sources and the rigs fetched. The commit was fixed first (committed 02:42; CI green at 02:46; T0, T1 and T2 passed on
it in CI and again as the gate's own first steps). Then a fresh subagent wrote `bench/results/heldout/G7/run-2/`
under D91's read bar, and a second, independent one checked it (its record and the check are `heldout.json` here and
`bench/results/heldout/G7/run-2/check.json`: pass, the read bar kept, nits only). Each brief's known-good passed on
its variant before the gate (`<B>-variant-known-good.json`, 02:51:53 to 02:52:43, while the check, written at 02:58:41,
was still under way; each variant step ran its known-good again before its trials). The held-out run sat untracked beside the commit during
the gate and was committed after it, byte for byte as the gate read it.

- `report.json`: the gate's report as `npm run gate -- G7 --json` wrote it; `logs/`: each step's log and `gate.log`.
- `<B>.json`: each brief's five fresh agents (B1's with its two discovery trials); `<B>-variant.json`: five on the
  held-out variant; `recorded-<model>.json`: B1 to B7 once each on the three recorded models (D98, not gating).
- `transcripts.json`: the 93 transcripts by path, SHA-256 and size (not committed; under `/tmp/m3a-bench/`).
- Byte copies of the benchmark records are in `bench/results/2026-10-19-*.json` (`-B1-7`, `-B1-variant-5`,
  `-B<n>-2`, `-B<n>-variant-2`, the recorded models' `-2`, the known-goods' `-fake-variant-2`).

**Results:** 68 of 70 gating trials pass, every brief and variant at least 4 of 5; the CLI's default
(claude-sonnet-5-5), isolation 1, five at a time, $11.46 in all.

| Brief | Trials | Variant (seed) | Wall time | Turns | Cost (both) |
|---|---|---|---|---|---|
| B1 | 4/5 (discovery 2/2 used the package, 2 passed) | 5/5 (2329: tall, A, Mixamo, no upper chest) | 41–84 s | 9–17 | $2.15 |
| B2 | 5/5 | 5/5 (3542: bulky, relaxed, UE5, twist bones, no toes) | 22–118 s | 6–8 | $1.22 |
| B3 | 5/5 | 5/5 (4743: child, T, Rigify, twist bones, no shoulders) | 56–116 s | 8–21 | $2.45 |
| B4 | 5/5 | 5/5 (5980: chibi, A, VRM, twist bones, no neck) | 21–82 s | 6–16 | $1.28 |
| B5 | 5/5 | 5/5 (6251: heroic, relaxed, Rigify, no chest) | 16–125 s | 5–29 | $1.62 |
| B6 | 4/5 | 5/5 (7434: tall, T, UE5) | 17–68 s | 5–17 | $1.16 |
| B7 | 5/5 | 5/5 (8592: bulky, T, VRM) | 35–71 s | 7–15 | $1.57 |

Recorded, one trial a brief: claude-opus-5-5 7/7 ($3.81), claude-haiku-5-5 7/7 ($0.55), claude-fable-5-1 7/7
($20.71). Check 2.1 s, test 83.0 s, doctrine, vectors, the tool examples on four surfaces 19.3 s, the manual's code
6.4 s, `pack --check` 20.7 s, the single file's licenses, T2 121.1 s, the held-out run fresh.

**What failed:** B1-4 slid a planted foot at 7.75–8.00 s (skate 87.0 cm/s, fail 41.9); B6-2's mirrored
cross struck where the original does (57% of the hip height from it). Both briefs still passed 4 of 5.

**What the agents used** (the verifier's audit, D107): every trial had the packed `m3a mcp` server connected and the
skill loaded; MCP tools were called in 10 of 70 gating trials, the Skill tool in none (one discovery trial invoked it),
the rest through `npx m3a` and the API, as the briefs point agents to the manual. 20 of 70 read past the manual into
the installed packages' types (B1 10 of 10, mostly a graph `rate` parameter's starting value after E_GRAPH G-E006).
The audit's read-past lists over-count a little: a grep whose target the packs don't ship is listed as read (B1v-1's
`node_modules/@m3a/core/README.md` and `tools/README.md`, B7-5's `core/README.md`), and system directories are exempt
by design (a recorded haiku trial's `ls /usr/lib/node_modules`, empty).
