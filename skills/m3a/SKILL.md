---
name: m3a
description: "Humanoid character animation for games, in code and text, with the @m3a packages. Use when a game, a three.js scene or a Node project needs a character to idle, walk, run, jump, attack, react or emote: to find motion clips in a CC0 library by words, play them on any humanoid rig (glTF, GLB, VRM), wire an animation graph with hit events and root motion, make or edit a clip from a recipe, retarget, import or export motion (VRMA, GLB, BVH), or check motion (foot sliding, pops) as numbers without a display. Also when a project depends on an @m3a package or mentions m3a."
license: MIT
compatibility: Node.js 24.2 or newer; three.js r182 as @m3a/three's peer.
---

# m3a

m3a plays humanoid motion clips (JSON) on any humanoid character, in a game or headless: `@m3a/three` binds a
three.js character, and the sensors measure motion as numbers.

**Start with the manual,** `node_modules/@m3a/tools/MANUAL.md`: the mental model, a worked example and the API by job.
Read it before the packages' code. Pick clips by what `search` and the catalogs say, never by reading motion data.

## The five commands

| Job | Command | Replies with |
|---|---|---|
| Find | `npx m3a search "<a game moment>"` | library clips, best first, by id |
| Read | `npx m3a describe <SET/Name>` | the clip as a timeline: phases, strikes, travel |
| Fit | `npx m3a retarget.inspect <character.glb>` | the bones recognized and missing, a mapping patch |
| Make | `npx m3a recipe.compile <recipe.json>` | a clip file and its metrics, or each issue and fix |
| Check | `npx m3a metrics <SET/Name or clip.json>` | pass, warn or fail; each finding's repair |

A command's reply starts with its verdict, fits in 20 lines (`--verbose` gives the rest) and ends with a `next:`
hint; `--json` also writes a report.json. `npx m3a help` lists every tool and `npx m3a help <tool>` gives its flags
and examples. The same tools are MCP tools (`npx m3a mcp`, stdio, `.` written `_`: `retarget_inspect`) and
`tools.call(name, args, { host: nodeHost() })` (`tools` from `@m3a/tools`, `nodeHost` from `@m3a/tools/node`).
