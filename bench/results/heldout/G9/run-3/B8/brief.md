# B8 · An emote for the harbourmaster

Your studio makes a trading game set in an island harbour town. When players meet on the quays they pick emotes from
a wheel, and the wheel of the harbourmaster, the game's character, is one emote short: the m3a library holds nothing
like the one the team wants. The studio's rule is that whatever it builds from the library goes back into it. The
m3a packages are installed under `node_modules/@m3a/`, and their manual, `node_modules/@m3a/tools/MANUAL.md`, is
where to begin.

**The character** is `character.glb`, the body the grader plays your emote on. It is generated with a bulky build:
1.88 m from the underside of its feet to the crown of its head (the mesh runs from 0.04 m below the origin to 1.83 m
above it), with its hips joint 1.01 m above the origin. Its rest pose is relaxed: the upper arms and forearms hang
70° below level. It faces +z, with its left on +x. Its skeleton is in metres, the armature unscaled and no bone node
rotated (each bone's frame is the world's), and its 20 bones carry VRM 1.0's humanoid names: `hips` at the root;
`spine`, `chest`, `upperChest`, `neck` and `head` up the middle; `leftShoulder`, `leftUpperArm`, `leftLowerArm` and
`leftHand` on `upperChest`; `leftUpperLeg`, `leftLowerLeg` and `leftFoot` on `hips`; and the same on the right. It
has no toe bones and no twist bones, and one skinned mesh. It is a plain glTF binary with VRM's bone names, not a
`.vrm` file: it carries no VRM extension. three.js loads its bone names as the file spells them.

**What to do:** give the harbourmaster an emote you choose yourself, made from the CC0 library, and hand it to
the library through its intake queue: send it with `npx m3a library submit` until it sits waiting for the
owner's review (`awaiting review`) with every one of its checks green.
- It has to be something the library lacks. The queue sends back a library clip submitted unchanged, or changed only
  a little, and your emote goes in as a clip in its own right: don't send it as a fix to a library clip
  (`--improves`).
- An emote is played on the spot: `npx m3a describe` must read no walking or running in it, and it may travel less
  than a quarter of its hip height. Tag it `emote`, and give it a name and a description that are its own and tell
  what it does, not the ones of the clip you built it from.
- Its provenance has to be complete: the method and the tool that made it, a claim that it is licensed CC0, and who
  made it. You are an AI agent: say so, and name the Claude model you are.
- The queue here is its local backend, in `.cache/intake/`. Its checker goes over it every 30 seconds while you work,
  as the hosted queue's checker does every 15 minutes. `npx m3a library status` lists the state of each submission
  you've made and, for one that bounced, the reason: fix what it names and submit again.

**How it's graded** (headless): the checker runs on this workspace's queue, and one of your submissions waits for
review, every gate green (schema, provenance, license, text, dedup, sensors, the retarget onto the reference rigs,
budgets, lint), checked again from its text; its queue record is the one `m3a library submit` sent (its id and
content hash are its text's); its provenance is complete (method, tool and version, license `CC0-1.0`, an AI agent
and its Claude model as who made it, and the local report `m3a library submit` adds, as submit measures the clip);
its name and description are its own, not its source clip's; it is tagged `emote`, stays in place (no walking or
running as `m3a describe` reads it, under 0.25 hip heights travelled) and is sent without `--improves`; and it plays
on `character.glb`, every joint finite. Work only in this directory.
