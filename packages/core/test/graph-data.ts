// The graph scripts' data (Node only: it reads the library): the tiny rig, the clips the two example graphs name (with
// contacts measured where they walk, and a few events added: the library's clips carry none yet), and the graphs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { graph as G, measureFacts, parseClip, type Clip, type Rest } from "./all.ts";
import type { GraphScriptData } from "./graph-script.ts";

const ROOT = join(import.meta.dirname, "../../..");
/** An example graph from spec/graphs. */
export const exampleGraph = (name: string): G.Graph => JSON.parse(readFileSync(join(ROOT, "spec/graphs", `${name}.json`), "utf8")) as G.Graph;

/** The rig, the clips and the graphs. */
export function graphData(): GraphScriptData {
  const locomotion = exampleGraph("Locomotion"), combo = exampleGraph("Sword_Combo"), ids = new Set<string>();
  for (const g of [locomotion, combo]) for (const L of G.layersOf(g)) for (const s of Object.values(L.states)) for (const id of G.clipsOf(s)) ids.add(id);
  const clips = [...ids].sort().map((id) => {
    const [set, slug] = id.split("/") as [string, string], clip: Clip = parseClip(readFileSync(join(ROOT, "library/sets", set, `${slug}.json`), "utf8"));
    if (clip.loop) clip.contacts = measureFacts(clip, (JSON.parse(readFileSync(join(ROOT, "library/sets", set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[clip.restSrc]!.rest).contacts;
    // a footfall on the loops, the moment a strike lands on the swings and the jab
    if (/Walk|Jog|Sprint/.test(slug)) clip.events = [{ t: 0.1, name: "step", foot: "L" }, { t: clip.dur / 2 + 0.1, name: "step", foot: "R" }];
    if (/Sword_Regular_[ABC]$|Punch_Jab/.test(slug)) clip.events = [{ t: Math.round(clip.dur * 0.6 * 1000) / 1000, name: "hit" }];
    return clip;
  });
  return { skeleton: rigSkeleton(), clips, locomotion, combo };
}
