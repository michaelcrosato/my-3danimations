# my-3danimations

**Status:** built. Every phase of `PLAN.md` is done (0.60.0): G0 to G8 passed (M1, M2), and G9 and G10's command sets
passed and wait on the owner's steps (M3, M4); [`docs/PROGRESS.md`](docs/PROGRESS.md) shows where it stands.

**Should we build the animation package for AI agents, and how?** This repository answered that question, then built it.

The package does for character animation what three.js does for rendering and Rapier does for physics: one
dependency that solves the problem. It is built from the ground up for LLM coding agents, and only for them, with no
legacy weight. The question it answers:

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
- **You are already paying for not having it.** The codec has been written twice (JavaScript, then Rust) and is
  planned a third time in TypeScript. One set name already means two different sets in two repos. The first outside
  model to build on my-3d2dge never found the library.
- **The niche is empty.**
  - There is no open, agent-oriented text format for 3D character motion. BVH is text, but flat per-frame channels with
    no naming standard.
  - No engine's official MCP server exposes animation operations; only community servers and extensions do.
  - Vendor pipelines end in binary files or flat BVH.
  - three.js has no state machine or root motion, and its retargeting has documented failures.
- **The hard parts are engineering, not research.** Retargeting, foot locking, blending, graphs and motion metrics are
  known techniques. Text-to-motion generation is mostly off-limits under its licenses anyway: most models are trained on
  non-commercial data. The first commercially usable model, NVIDIA Kimodo, plugs into the socket later.
- **It improves as models improve.** The airframe gets better pilots every few months. The curated, licensed, verified
  motion and the evals that grade agents only gain value.
- **The analogy is half right.** three.js and Rapier ship code, not content. Here the scarce assets are clean motion data
  and trustworthy checks, so the package is closer to glTF plus Poly Haven plus a test suite, with a three.js-like
  runtime as its reference implementation.
- **Two parts carry the risk.** Retargeting onto arbitrary skinned skeletons is the heavy lift, and that is what the
  first milestone tests. A library grown by AIs is the weakest leg, so it grows only through one intake queue: license
  namespaces, provenance, automated checks, and your review before anything is adopted.

## What's here

| Path | What it is |
|---|---|
| [`packages/tools/MANUAL.md`](packages/tools/MANUAL.md) | The manual: where an agent using the package starts (the API by job: find, fit, wire, make, check, ship, grow) |
| [`llms.txt`](llms.txt) | The index for agents: the manual, the catalogs, the tool list |
| `packages/` | The six `@m3a` packages: `core` (the format and a deterministic runtime), `sensors`, `io`, `library`, `three` (the three.js adapter) and `tools` (one registry as the API, the `m3a` CLI and MCP) |
| `spec/` | The motion format, the legend, the skeleton profile, recipes, graphs, actions and sims, the conformance vectors and kit |
| [`library/`](library/README.md) | 11 licensed sets of clips with their catalogs, licenses, baselines and the registry index |
| `apps/` | The gallery (the owner's ground station) and the labs |
| `services/intake/` | The hosted intake queue's store (Supabase) |
| `tools/`, `bench/` | The repository's commands ([`AGENTS.md`](AGENTS.md) lists them) and the fresh-agent benchmark |
| [`docs/MIGRATING.md`](docs/MIGRATING.md), [`spec/conformance/CERTIFYING.md`](spec/conformance/CERTIFYING.md) | For a repository adopting the package, or certifying its own implementation |
| [`AGENTS.md`](AGENTS.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), [`DOCTRINE.md`](DOCTRINE.md) | The rules for every change, how to contribute clips or code, what the package optimizes and why |
| [`docs/FEASIBILITY.md`](docs/FEASIBILITY.md) | The analysis: the question, the cockpit-free design, the evidence, the landscape, feasibility by dimension, risks, owner decisions, the verdict |
| [`PLAN.md`](PLAN.md) | The execution plan for an autonomous coding agent: the doctrine, the architecture and contracts, 11 phases, 57 work packages and the 14 follow-ups after G10, 11 gates (G0 to G10), 4 milestones, the benchmark, the ledger |
| [`reports/AI native game animation landscape.md`](reports/AI%20native%20game%20animation%20landscape.md) | The research synthesis, October 2026 |
| [`research_notes/AI native game animation landscape/`](research_notes/AI%20native%20game%20animation%20landscape/) | Seven cited studies: AI motion technology, commercial tools, formats and runtimes, data and licensing, agent tooling, the origin repos, the adopter repos |

## How it was built

Claude Code sessions ran the kickoff prompt in `docs/FEASIBILITY.md` §9 at effort ultracode (D83): the ledger
(`PLAN.md` §14) in order, one draft pull request a phase (#4 to #17), each merged at its gate (§8.5), then an audit
and the follow-ups after G10 (#18 to #30).
`docs/DECISIONS.md` logs every call made on the way.

The milestones:
- **M1 "first flight":** library clips on humanoid skeletons in three.js, verified headless: at least 95% of the
  migrated clips pass the sensors on at least six test skeletons, every failure is listed, and the core moves play on a
  held-out real rig chosen at the gate. Fresh agents pass the first brief and a held-out variant of it, 4 of 5 each.
- **M2 "agents fly it":** the CLI, the skill, MCP and the manual, benchmarked.
- **M3 "the library grows":** any agent submits animations to an intake queue; automated checks filter them, and you
  adopt, archive or reject each one from your phone.
- **M4 "the standard in use":** another repository consumes it.

## Lineage

- [my-3d2dge](https://github.com/michaelcrosato/my-3d2dge) started it all. It brought the agent-first doctrine (the
  fighter jet with no cockpit), readable key poses, catalogs and provenance, importers, and verification without a
  display.
- [my-3d2dge-2](https://github.com/michaelcrosato/my-3d2dge-2), [shardfall](https://github.com/michaelcrosato/shardfall)
  and [my-3dge](https://github.com/michaelcrosato/my-3dge) adopted or re-implemented parts of it.
- [riftlight](https://github.com/michaelcrosato/riftlight) shares the doctrine but built its own animation stack,
  reaching software-drawn contact sheets, clip metrics and agent tools independently.
- Their duplication is the case for one package that they all pin.

## License

MIT. See [`LICENSE`](LICENSE). The library's default pack is CC0. CC BY 4.0 and CMU-licensed sets are opt-in, and every
clip records its license in its provenance.
