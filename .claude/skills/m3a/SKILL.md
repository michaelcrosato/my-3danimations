---
name: m3a
description: "Use m3a's own tools from inside this repository, before reading the packages' source: find a library clip by words, read what a clip does, check that a character binds, compile a recipe, measure a clip with the sensors. Use when a task here needs motion clips, a character's fit, a recipe, or a verdict on motion quality, or to see the package as an agent that installed it does (the manual, the tools, the MCP server)."
---

# m3a in this repository

The package's manual is `packages/tools/MANUAL.md`: the mental model, one worked example and the API by job (find, fit,
wire, make, check, ship). Read it before the packages' source, as an agent with the installed package does. A clip's
format is `spec/MOTION.md`, read with `spec/LEGEND.md`; each set's catalog is `library/sets/<SET>/catalog.tsv`, one
clip a row.

Here the tools run from source: `node packages/tools/src/node.ts` is the `m3a` command, as `.mcp.json` runs it. Not
`npx m3a`: the workspace links no `m3a` bin (the package's is built when packed), so npx would fetch whatever npm
holds under that name. The five that matter most, each a registry example:

| Job | Command |
|---|---|
| Find | `node packages/tools/src/node.ts search 'drinks a potion'` |
| Read | `node packages/tools/src/node.ts describe QUATERNIUS_3D2DGE/Jump_Land` |
| Fit | `node packages/tools/src/node.ts retarget.inspect spec/vectors/tier1b/rigify.gltf` |
| Make | `node packages/tools/src/node.ts recipe.compile spec/recipes/Jab_Left.json` |
| Check | `node packages/tools/src/node.ts metrics QUATERNIUS_3D2DGE/Walk_Loop` |

Check's example replies FAIL on purpose (the registry's example shows findings): the clip's twist flips, recorded as its
baseline. On the command line a reply starts with its verdict, fits in 20 lines (`--verbose` gives the rest) and ends
with a `next:` hint; `--json` also writes a report.json. `node packages/tools/src/node.ts help` lists every tool,
`node packages/tools/src/node.ts help <tool>` gives its flags and examples. `.mcp.json` serves the same tools over MCP
(`node packages/tools/src/node.ts mcp`). The skill an installed package will ship is `skills/m3a/SKILL.md`, and
`llms.txt` indexes the docs.
