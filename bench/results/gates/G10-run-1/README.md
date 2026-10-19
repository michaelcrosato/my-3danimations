# Gate G10 = M4, run 1 (its command set passed, 8 of 8; another repository's use and the owner's confirmation blocked-owner; D117)

Run at 95af62d (0.53.0) on 2026-10-19, 15:20–15:29 UTC, in 537.5 s, in the main checkout, the tree clean, no lane
running. G10 runs no benchmark trial.

- `report.json`: the gate's report as `npm run gate -- G10 --json` wrote it; `logs/`: each step's log.
- `certification.json`: `npm run conformance -- --impl ts --json` at the same commit right after the gate: the
  TypeScript implementation's certification, naming the protocol (m3a-conformance/1), the vectors' manifest SHA-256
  and the commit, every tier's cases and worst numbers.

| Step | Result |
|---|---|
| check / test (T1) / doctrine / vectors --check | PASS: 2.5 s / 109.1 s (over the 90 s budget, under 135; the kit's own tests among them: its broken implementation fails each defect naming the vector) / 8 of 8 / 16 files byte for byte |
| the TypeScript implementation certifies through the kit's own runner | PASS: tiers 1a, 1b, 2 and 3, 3,662 cases in 7.9 s |
| the consumer proof (apps/lab/consumer-ts) | PASS, 39.2 s: the page as Node step by step, the hero on `sim.simulate`'s root path, the frame loop on a held clock |
| `pack --check`: the packages as another repository installs them | PASS, 21.4 s |
| T2: browser checks, library QA, the sweeps in full | PASS, 352.4 s of 480 |

**Open (blocked-owner, §9.3, O9):** "at least one other repository consumes the package or certifies against the
vectors, and the owner confirms it". Acting in another repository is the owner's call: docs/MIGRATING.md proposes
my-3dge's switch (its WPs 3.4–3.7 and 8.1–8.10 replaced, wrapped or kept) and spec/conformance/CERTIFYING.md
shardfall's certification of its Rust codec (tiers 1a and 2 now). Asked on michaelcrosato/my-3danimations#17. G10
merges with it open (§8.5).
