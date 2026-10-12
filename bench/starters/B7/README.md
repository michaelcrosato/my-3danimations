# B7 starter

- `character.glb`: the character (a skinned humanoid, glTF, metres, facing +Z).
- `graph.json`: the graph to write (the m3a graph format: `node_modules/@m3a/tools/MANUAL.md`, "Graphs").
- `script.json`: the grader's script, the game's input over time (an m3a simulation script).
- `check.ts`: `npm run check` simulates your graph on the character with that script and prints its states.
- `src/character.ts`: loads the character with three.js (given).
