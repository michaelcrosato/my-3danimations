# B8 · Hand the library a new emote

You're on the team behind *Night Shift*, a co-op game set aboard an orbital repair station: between jobs the crew
gather in the station's hub, and each player can play an emote from the comms panel. The panel needs one the m3a
library doesn't have yet, and what your team builds from the library goes back into it. The m3a packages are installed
under `node_modules/@m3a/`; their manual is where to begin: `node_modules/@m3a/tools/MANUAL.md`.

**The character:** `character.glb` is the crew's avatar body, a tall, thin humanoid in metres (its armature is
unscaled), facing +z with its left on +x. Its one skinned mesh spans 2.14 m in height (y -0.008 to 2.136 m), and its
hips sit 1.25 m above the origin (1.26 m above its soles). It stands in a T-pose: both arms straight out to the sides,
upper arms and forearms level. Its 27 bones carry Blender Rigify's deform names, and the hips bone `DEF-spine` is the
skeleton's root: up the back `DEF-spine.001` (spine), `DEF-spine.002` (chest), `DEF-spine.003` (upper chest),
`DEF-spine.004` and `DEF-spine.005` (neck) and `DEF-spine.006` (head). It has no shoulder bones: each arm starts on
`DEF-spine.003`, as `DEF-upper_arm.L`, `DEF-upper_arm.L.001`, `DEF-forearm.L`, `DEF-forearm.L.001`, `DEF-hand.L`;
each leg starts on `DEF-spine`, as `DEF-thigh.L`, `DEF-thigh.L.001`, `DEF-shin.L`, `DEF-foot.L`, `DEF-toe.L`; and the
same on the right with `.R`. The `.001` bones are twist bones inside the chains: each forearm is a
child of its upper arm's `.001`, each hand of its forearm's, each shin of its thigh's. three.js's GLTFLoader drops the
dots from these names when it loads the file (`DEF-spine.001` reads as `DEF-spine001`, `DEF-upper_arm.L.001` as
`DEF-upper_armL001`).

**What to do:** pick an emote yourself, build it for `character.glb` from the CC0 library, and put it forward to the
library's intake queue with `npx m3a library submit`. You're done when it sits in the queue waiting for the owner's
review (`awaiting review`) with every check green.
- The library mustn't have it already: the queue bounces a library clip sent unchanged or with only a small change.
  It goes in as a clip in its own right, so don't send it as a fix to a library clip (no `--improves`).
- An emote is played on the spot: `npx m3a describe` must read no walking or running in it, and it must travel less
  than a quarter of its hip height. Give it the tag `emote`, and a name and a description that are its own and say
  what it does, not the ones of the clip you start from.
- Fill in its provenance completely: the method and the tool that made it, a CC0 license claim, and its maker. You're
  an AI agent, so say that, with the name of your Claude model.
- The queue's local backend lives in this workspace, at `.cache/intake/`. While you work, its checker runs over it
  every 30 seconds (the hosted queue's runs every 15 minutes). `npx m3a library status` lists the state of each
  submission you've sent and the reason any was bounced; if one bounces, fix what the reason names and send it again.

**How it's graded** (headless): the checker runs on this workspace's queue, and one of your submissions waits for
review, every gate green (schema, provenance, license, text, dedup, sensors, the retarget onto the reference rigs,
budgets, lint), checked again from its text; its queue record is the one `m3a library submit` sent (its id and
content hash are its text's); its provenance is complete (method, tool and version, license `CC0-1.0`, an AI agent
and its Claude model as who made it, and the local report `m3a library submit` adds, as submit measures the clip);
its name and description are its own, not its source clip's; it is tagged `emote`, stays in place (no walking or
running as `m3a describe` reads it, under 0.25 hip heights travelled) and is sent without `--improves`; and it plays
on `character.glb`, every joint finite. Work only in this directory.
