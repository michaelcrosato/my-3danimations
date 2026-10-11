# Feasibility: an animation package built for AI agents

<!-- DRAFT: sections marked TODO are filled from the research in reports/ and research_notes/. -->

## 1. The question

**How do I get high-quality animations into my game in a way that works easily with LLM agents?**

The package this repository weighs would answer that the way three.js answers rendering and Rapier answers physics:
one dependency that solves the problem. The difference is who it is for. It is built from the ground up for AI coding
agents, and only for them, with no legacy weight carried for human workflows.

"Solves the problem" means an agent building a game can do seven jobs without a human, a GUI or a display:

1. **Find** a motion for a moment ("lands on one knee and a hand", "overhead two-handed chop") without watching videos.
2. **Fit** it onto *this* character (any humanoid skeleton, any proportions) without a retargeting dialog.
3. **Wire** it to gameplay (locomotion blends, actions with hit frames, reactions, transitions, root motion)
   without a boxes-and-arrows editor.
4. **Make** a motion that does not exist yet, by editing, composing or generating, without an animator.
5. **Check** that it looks right (feet planted, no popping, no limbs through the body, timing that reads) without
   watching it.
6. **Ship** it knowing it may be shipped (license, credit) and that it plays the same everywhere (deterministic,
   versioned).
7. **Grow** the library: hand what it made to the next agent, safely.

"High quality" has three layers, and the package owns them differently:

- **The source motion**: captured or keyed by skilled people, or generated well. The package *curates* it.
- **The runtime**: blending, contacts, IK, timing, responsiveness, root motion. The package *delivers* it in full.
- **The fit**: on-model, on-style, on-beat for this game. The package *gives the tools* and the agent does the work.

## 2. The fighter jet without a cockpit, applied to animation

The owner's analogy: build a fighter jet today, but take out the pilot and the cockpit. The jet flies itself; the human
is remote, at a ground station, for the highest-level strategy and for quality assurance. Removing the pilot removes
every constraint a human imposes on the design.

Today's animation pipeline is a cockpit. Almost every tool in it exists because a human was in the seat:

| The cockpit (built for a human) | Why it exists | What replaces it (built for agents) |
|---|---|---|
| Timeline, dope sheet and curve editors (Maya, Blender, MotionBuilder) | A human poses with a mouse and judges by scrubbing | Motion as readable text: key poses of whole numbers, named the way an animator thinks (lean, turn, reach, bend), plus operators an agent calls (retime, mirror, layer, exaggerate, pin a hand, look at) |
| The viewport, watched at 60 fps | Eyes are the QA instrument | **Sensors**: motion metrics reported as text with times ("left foot slides 42 mm, 0.53 to 0.71 s"); contact sheets and frame strips sized for a vision model's token budget; pixel and metric diffs against the last build |
| Binary interchange (FBX, `.anim`, `.uasset`) | App-to-app transfer; formats owned by vendors | Text is the source of truth; binaries live only at the edges (import, export), converted with their provenance recorded |
| Boxes-and-arrows state machines (Unity's Animator, Unreal's AnimGraph) | A human wires behavior visually | State graphs and blend spaces as data, with a validator, and a simulator that turns an input script into a state trace and frames |
| The retargeting dialog (map bones by hand, fix the rest pose) | A human recognizes bones by name and shape | Automatic skeleton recognition with a confidence report; motion stored in a body-size-independent IK space; a mapping file the agent can read and patch |
| Marketplaces browsed by thumbnail and video; licenses read by people, or not at all | Humans choose by watching | A catalog of one line per clip (~30 tokens), searchable by words, tags and numbers (speed, height, travel); a machine-readable license and provenance on every clip; compatibility checked by a tool |
| An animator for every new motion | Only skilled people could make motion | **Motion sources** the agent drives: the library, composition and edits, procedural generators, importers and, as plug-ins, generative models. Every source goes through the same QA gates |
| A person reviews every asset | Trust needed a human | Automated gates on every clip; humans sample on a review page and turn their notes into thresholds and rules |
| Every game rebuilds blending, foot IK and hit events | Engines ship GUIs, not reusable runtimes an agent can read | One runtime, adapters per renderer, one conformance suite |
| Manuals and tutorials for people | People learn by reading and watching | A token-budgeted manual, `llms.txt`, an agent skill, errors in the API's own language, examples that run |

**What the ground station does.** The human sets direction ("grounded and heavy", "snappy, like an anime fighter"),
sets the bar (the thresholds the sensors enforce), reviews on a phone (a gallery that plays any clip on any test
character, with its metrics, approve or flag in one tap), and makes the calls that are hard to undo (licenses, spending,
publishing). The human never keys a pose.

**The laws of flight still apply.** Taking out the cockpit removes human constraints, not physical ones: anatomy (joint
limits, bone lengths), physics (contact, balance, momentum), the principles of animation (anticipation, follow-through,
arcs, timing) and art direction. In this design they become checks the sensors run on every clip.

**Built for a pilot who keeps getting better.** Models are improving fast, so the airframe must not cap the pilot:

1. Key poses are a *view*. Dense samples stay available and imports keep their source, so a stronger model can work at
   a lower level when it is able to.
2. The same tools serve a small model (pick a clip by its catalog line) and a frontier model (author a new motion with
   IK targets, read the metrics, fix it, check again).
3. The pilot is measured. A benchmark of agent tasks, graded by metrics, vision-model review and human sampling, runs on
   every new model, so improvements show up as numbers and the ground station can hand over more.
4. Generative models plug in. The package defines the socket (intent and constraints in; a clip in the format, with
   provenance and license, out) and the QA gate, not the model.
5. The durable value is curated, licensed, verified motion data plus the evals that grade it. Those are exactly what
   future models need, whoever builds them.

## 3. What already works

TODO (from research_notes/.../predecessor_origin_repos.md and predecessor_adopter_repos.md)

## 4. The landscape, October 2026

TODO (from reports/AI native game animation landscape.md)

## 5. Feasibility, dimension by dimension

TODO

## 6. The thesis: build the airframe, not the pilot

### 6.1 An AI-native language, in levels

Agents work at the highest level that does the job and drop a level when they must. Every level is text, compiles to the
one below, has a validator whose errors name the field, a `describe` that says it back in words, and a `render` that
feeds the sensors.

| Level | What it is | Example | Who writes it |
|---|---|---|---|
| **L4 Intent** | A brief in words | "the goblin limps to the brazier and kicks it over" | the game's agent, or the human |
| **L3 Behavior** | State graphs, blend spaces, events bound to gameplay | locomotion by speed (idle, walk, run); `attack.hit` at 0.32 s | the game's agent |
| **L2 Recipe** | Composition of clips and operators | a limp cycle three times, then a front kick played 0.8x slower, with a torch-holding right arm layered on top | the game's agent, library contributors |
| **L1 Key poses** | Readable numbers per key pose | `{"t":0.13, "hips":[-2,-2,90], "armL":[60,-44,66,132,155], ...}` | importers, generators, agents editing |
| **L0 Samples** | Dense transforms per frame | a rotation per bone at 30 fps | importers, the runtime, the sensors |

TODO: subsystems, non-goals, why a standard.
