# my-3danimations

**Should we build the animation package for AI agents, and how?** This repository answers that question.

The package would do for character animation what three.js does for rendering and Rapier does for physics: one
dependency that solves the problem. It would be built from the ground up for LLM coding agents, and only for them,
with no legacy weight. The question it answers:

> How do I get high-quality animations into my game in a way that works easily with LLM agents?

**The analogy.** If you built a fighter jet today, you would take out the pilot and the cockpit. The jet flies itself,
and the human is remote, at a ground station, giving the highest-level strategy and doing quality assurance. The
animation pipeline's cockpit is everything built for a human in the seat: timelines and curve editors, binary FBX files,
judging motion by eye in a viewport, retargeting dialogs, and marketplaces browsed by video. This repository asks what
the pipeline looks like with all of that removed.

## The answer

**Go, scoped as the airframe, not the pilot.** Build the language, runtime, sensors, library, interfaces, ground station
and supply chain an agent needs. Plug models that generate motion into a socket instead of building one.
[`docs/FEASIBILITY.md`](docs/FEASIBILITY.md) gives the full case. In short:

- **The core is proven.** my-3d2dge's readable key poses land 14 to 18 mm from the capture, are 14× smaller than the
  same clips as GLB, and are chosen from catalog lines of about 35 tokens. shardfall ported the format to Rust bit for
  bit.
- **You are already paying for not having it.** The codec has been written three times (JavaScript, Rust, and now
  planned in TypeScript). One set name already means two different sets in two repos. The first outside model to build
  on my-3d2dge never found the library.
- **The niche is empty.**
  - There is no open text format for 3D character motion.
  - No engine's MCP server exposes animation.
  - Vendor pipelines end in binary files.
  - three.js has no state machine or root motion, and its retargeting has documented failures.
- **The hard parts are engineering, not research.** Retargeting, foot locking, blending, graphs and motion metrics are
  known techniques. Text-to-motion generation is mostly off-limits under its licenses anyway: most models are trained on
  non-commercial data. The first commercially usable model, NVIDIA Kimodo, plugs into the socket later.
- **It improves as models improve.** The airframe gets better pilots every few months. The curated, licensed, verified
  motion and the evals that grade agents only gain value.

## What's here

| Path | What it is |
|---|---|
| [`docs/FEASIBILITY.md`](docs/FEASIBILITY.md) | The analysis: the question, the cockpit-free design, the evidence, the landscape, feasibility by dimension, risks, owner decisions, the verdict |
| [`PLAN.md`](PLAN.md) | The execution plan for an autonomous coding agent: the doctrine, the architecture and contracts, 11 phases, 56 work packages, 10 gates, 4 milestones, the benchmark, the ledger |
| [`reports/AI native game animation landscape.md`](reports/AI%20native%20game%20animation%20landscape.md) | The research synthesis, October 2026 |
| [`research_notes/AI native game animation landscape/`](research_notes/AI%20native%20game%20animation%20landscape/) | Seven cited studies: AI motion technology, commercial tools, formats and runtimes, data and licensing, agent tooling, the origin repos, the adopter repos |

## Run the plan

Start a Claude Code session on this repository with this prompt:

```
Execute PLAN.md in michaelcrosato/my-3danimations. Read docs/FEASIBILITY.md §0, then PLAN.md §0–§3 and §8, and adopt
the doctrine in §3 as DOCTRINE.md (WP-0.1). Work the ledger (§14) in order: for each WP read only its entry and what it
cites, meet every Done-when and prove it with Verify, apply the definition of done (§8.3), update the ledger and
docs/PROGRESS.md, commit per WP, and keep one draft PR current. Make reversible calls yourself and log them; escalate
only hard-to-undo calls (§3), using the 15-minute timer and the defaults in §13. Run each gate's command set and post
its report on the PR. Reach G4 (M1, first flight) first, then continue phase by phase; stop only for a kill criterion
(§12) or a finished ledger.
```

**Effort: ultracode** (recommended). The plan is built for parallel lanes: every work package owns its paths, and there
are verifier and integrator roles (`PLAN.md` §11). The contract runs single-threaded and the lanes fan out after G2.
**Max** is the single-agent fallback, and a good choice for the first session if you'd rather watch the contract form
before paying for parallel lanes. `docs/FEASIBILITY.md` §9 gives the reasoning.

The milestones:
- **M1 "first flight":** any library clip on any humanoid skeleton in three.js, verified headless.
- **M2 "agents fly it":** the CLI, the skill, MCP and the manual, benchmarked.
- **M3 "the library grows":** gated contributions from other AIs.
- **M4 "the standard in use":** another repository consumes it.

## Lineage

- [my-3d2dge](https://github.com/michaelcrosato/my-3d2dge) started it all. It brought the agent-first doctrine (the
  fighter jet with no cockpit), readable key poses, catalogs and provenance, importers, and verification without a
  display.
- [my-3d2dge-2](https://github.com/michaelcrosato/my-3d2dge-2), [riftlight](https://github.com/michaelcrosato/riftlight),
  [shardfall](https://github.com/michaelcrosato/shardfall) and [my-3dge](https://github.com/michaelcrosato/my-3dge)
  adopted or re-implemented parts of it. Their duplication is the case for one package that they all pin.

## License

Not chosen yet. `PLAN.md` WP-0.1 asks the owner (decision O1, default MIT).
