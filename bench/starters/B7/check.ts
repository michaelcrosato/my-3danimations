// `npm run check`: simulates graph.json on the character with the grader's script (script.json) and prints the states
// it went through and when, and whether every joint stayed finite. It doesn't grade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { graph as G, playable, type AnimClip } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { bind } from "@m3a/three";
import { sim } from "@m3a/tools";
import { loadCharacter } from "./src/character.ts";

const read = (f: string) => JSON.parse(readFileSync(join(import.meta.dirname, f), "utf8"));
const graph = read("graph.json") as G.Graph, script = read("script.json") as sim.SimScript, library = openLibrary();
const clips = (id: string): AnimClip | undefined => {
  try {
    const { clip, rest } = library.clip(id);
    return playable(clip, rest);
  } catch {
    return undefined;
  }
};
const issues = G.validateGraph(graph, { clips });
if (issues.length) {
  for (const i of issues) console.log(`${i.code} ${i.field ?? ""}: ${i.message}${i.fix ? ` (fix: ${i.fix})` : ""}`);
  process.exit(1);
}
const body = bind(await loadCharacter()).core, run = sim.simulate({ graph, script: { ...script, graph: graph.id }, body, clips });
for (const s of run.trace.states) console.log(`${s.t.toFixed(2)} s  ${s.layer}: ${s.from ?? "start"} > ${s.state}`);
console.log(run.frames.every((f) => f.every(Number.isFinite)) ? "every joint finite" : "NON-FINITE joints");
