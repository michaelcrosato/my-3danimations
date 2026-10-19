# B8 · The crew chief's emote

Your studio makes a rally game. Between stages the players gather in the service park around their crew chief and
pick emotes for the chief from a radial menu. The chief needs one more, one the m3a library hasn't got, and the
studio's rule is that whatever it makes for the game goes back into the library. The m3a packages sit in
`node_modules/@m3a/`; their manual, `node_modules/@m3a/tools/MANUAL.md`, is the place to begin.

**The character** (`character.glb`) is the crew chief, a tall adult, 1.93 m from the soles to the top of the head,
standing in an A-pose: both arms straight and 40° below level. The skeleton is named the Unreal Engine 5 way and
measured in metres, facing +z with the character's left on +x. A `root` bone sits at the origin, and the hips,
`pelvis`, are 1.08 m above it (the soles reach 2 cm below the origin, so the hips are 1.10 m above them). Up the back
run `spine_01`, `spine_03`, `spine_04` and `spine_05`, with a `spine_02` branching off `spine_01`; `head` sits on
`spine_05` directly, with no neck bone between them. Each arm is `clavicle_l`, `upperarm_l`, `lowerarm_l` and
`hand_l`, each leg `thigh_l`, `calf_l`, `foot_l` and `ball_l`, and the right side is the same with `_r`. Twist bones
branch off each upper arm, forearm and thigh (`upperarm_twist_01_l`, `lowerarm_twist_01_l`, `thigh_twist_01_l` and
their `_r` twins), with nothing hanging from them: 30 bones in all.

**The job:** working from the CC0 library, make an emote of your own choosing for `character.glb` and send it to the
library's intake queue with `npx m3a library submit`, where it must end up waiting for the owner's review
(`awaiting review`) with every check green.
- The library mustn't have it already: the queue bounces a library clip sent as it is, or one only barely changed. Send
  it as a clip in its own right, not as a fix of a library clip (`--improves`).
- Tag it `emote`, and give it a name and a description that say what it does.
- Its provenance must be complete: its method and the tool that made it, a CC0 license claim, and who made it (you are
  an AI agent working for the rally studio: say so, and name your model).
- The queue's local backend is in this workspace (`.cache/intake/`). Its checker goes over it every 30 seconds while
  you work, as the hosted queue's checker does every 15 minutes. `npx m3a library status` lists each of your
  submissions' state and, for one that was bounced, the reason: fix what it names and submit again.

**How it's graded** (headless): the checker runs on this workspace's queue, and one of your submissions waits for
review, every gate green (schema, provenance, license, text, dedup, sensors, the retarget onto the reference rigs,
budgets, lint), checked again from its text; its provenance is complete (method, tool and version, license
`CC0-1.0`, who made it, and the local report `m3a library submit` adds); it is tagged `emote` and sent without
`--improves`; and it plays on `character.glb`, every joint finite. Work only in this directory.
