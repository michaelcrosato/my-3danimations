# B8-ten · Contribute ten emotes

Your game's character needs emotes the m3a library doesn't have, and your studio gives what it makes back to the
library. The m3a packages are installed in `node_modules/@m3a/`. Start with their manual:
`node_modules/@m3a/tools/MANUAL.md`.

**The job:** make ten different emotes of your choosing for `character.glb`, from the CC0 library, and contribute
each to the library through its intake queue with `npx m3a library submit`, so that all ten wait for the owner's
review (`awaiting review`) with every check green.
- Each must be new to the library: the queue bounces a library clip sent as it is, or one barely changed, and each is
  a clip of its own, not sent as a fix of a library clip (`--improves`).
- The ten must differ from each other too: the queue's dedup gate bounces a clip that is the motion of another of
  your submissions, or one barely changed from it.
- Each is an emote, so it stays where it stands: no walking or running as `npx m3a describe` reads it, and under a
  quarter of its hip height travelled. Tag each `emote`, and give each a name and a description of its own that say
  what it does, not those of the clip it is made from.
- Each one's provenance must be complete: its method and the tool that made it, a CC0 license claim, and who made it
  (you are an AI agent: say so, naming your Claude model).
- The queue takes at most 20 submissions a day from one contributor, so a bounce costs one of them. `npx m3a library
  submit` first runs the gates it can on your machine, and refuses a clip that fails one without sending it (that
  doesn't count).
- This workspace has the queue's local backend (`.cache/intake/`), and its checker runs on it every 30 seconds while
  you work, as the hosted queue's does every 15 minutes. `npx m3a library status` shows each of your submissions'
  state and a bounce's reason: if one is bounced, fix what it names and submit again.

**How it's graded** (headless): the checker runs on this workspace's queue, and at least ten of your submissions
each pass every check: it waits for review, every gate green (schema, provenance, license, text, dedup, sensors, the
retarget onto the reference rigs, budgets, lint), checked again from its text, your submissions one at a time so that
the dedup gate holds them apart; its queue record is the one `m3a library submit` sent (its id and content hash are
its text's); its provenance is complete (method, tool and version, license `CC0-1.0`, an AI agent and its Claude
model as who made it, and the local report `m3a library submit` adds, as submit measures the clip); its name and
description are its own, not its source clip's; it is tagged `emote`, stays in place (no walking or running as
`m3a describe` reads it, under 0.25 hip heights travelled) and is sent without `--improves`; and it plays on
`character.glb`, every joint finite. Work only in this directory.
