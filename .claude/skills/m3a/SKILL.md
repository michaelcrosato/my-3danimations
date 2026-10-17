---
name: m3a
description: "Use m3a's own tools from inside this repository, before reading the packages' source: find a library clip by words, read what a clip does, check that a character binds, compile a recipe, measure a clip with the sensors. Use when a task here needs motion clips, a character's fit, a recipe, or a verdict on motion quality, or to see the package as an agent that installed it does (the manual, the tools, the MCP server)."
---

# m3a in this repository

The package's manual is `packages/tools/MANUAL.md`: the mental model, one worked example and the API by job (find, fit,
wire, make, check, ship). Read it before the packages' source, as an agent with the installed package does. A clip's
format is `spec/MOTION.md`, read with `spec/LEGEND.md`; each set's catalog is `library/sets/<SET>/catalog.tsv`, one
clip a row.

Here the tools run from source (`npx m3a` is `packages/tools/src/node.ts`). The five that matter most, each a
registry example:

| Job | Command |
|---|---|
| Find | `npx m3a search 'drinks a potion'` |
| Read | `npx m3a describe QUATERNIUS_3D2DGE/Jump_Land` |
| Fit | `npx m3a retarget.inspect spec/vectors/tier1b/rigify.gltf` |
| Make | `npx m3a recipe.compile spec/recipes/Jab_Left.json` |
| Check | `npx m3a metrics QUATERNIUS_3D2DGE/Walk_Loop` |

Check's example replies FAIL on purpose (the registry's example shows findings): the clip's twist flips, recorded as its
baseline. On the command line a reply starts with its verdict, fits in 20 lines (`--verbose` gives the rest) and ends
with a `next:` hint; `--json` also writes a report.json. `npx m3a help` lists every tool, `npx m3a help <tool>` gives
its flags and examples. `.mcp.json` serves the same tools over MCP (`npx m3a mcp`). The skill an installed package will
ship is `skills/m3a/SKILL.md`, and `llms.txt` indexes the docs.
