# Gate G8, run 1 (its command set passed, 8 of 8; the owner's phone review blocked-owner; D111)

Run at eb43654 (0.51.0) on 2026-10-19 in 314.6 s, in the main checkout, the tree clean. Two implementer lanes (WP-9.1a,
WP-9.2) ran on the machine beside it (D83); no benchmark trial is in this gate.

- `report.json`: the gate's report as `npm run gate -- G8 --json` wrote it; `logs/`: each step's log and `gate.log`.
- `queue.json`: the owner's batch, as `m3a review export` wrote it in the gate's last step: the local store's queue
  (m3a.review-queue/1), no submissions (nothing is hosted until O8) and 20 library clips sampled in a fixed order,
  each with its ref (`id@hash`, the motion hash a decision is made on) and its numbers.

| Step | Result |
|---|---|
| check | PASS, 7.9 s |
| test (T1) | PASS, 90.0 s |
| doctrine, vectors --check | PASS, 0.4 s; 16 files byte for byte, 1.5 s |
| the intake store's contract on `local`, the submit function, the review tool on four surfaces | PASS, 5.3 s |
| T2: the gallery, the review queue (the 20-clip batch by touch, applied once, stale refused), previews, library QA, the sweeps | PASS, 196.9 s |
| the preview site built as Vercel builds it | PASS, 10.2 s: the gallery (with its review and contributor pages), the labs index, 1 lab; 1,432 files, 23.0 MB, stamp `m3a 0.51.0 · eb43654`, no rig |
| the owner's batch exported | 20 sampled clips, 0 submissions |

**Open (blocked-owner, §9.3):** the owner reviews this batch on a phone through the review page and exports the
review; `npx m3a review ingest <file>` applies it, its notes into docs/FEEDBACK-LOG.md and at least one threshold or
task proposal into docs/REVIEW-PROPOSALS.md. That closes G8; the gate merged with it open (§8.5).
