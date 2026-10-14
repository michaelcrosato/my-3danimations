// The library as the page reads it (WP-4.6): every migrated clip's text and its set's rests, bundled by Vite and
// fetched on demand, so a deep link can play any clip (`?clip=SET/Name`). Node's tests read the files directly.
import { parseClip, type Clip, type Rest } from "@m3a/core";

const clips = import.meta.glob<string>(["../../../../library/sets/*/*.json", "!**/_*.json"], { query: "?raw", import: "default" });
const sets = import.meta.glob<string>("../../../../library/sets/*/_set.json", { query: "?raw", import: "default" });
const path = (id: string) => `../../../../library/sets/${id}.json`;

/** Every clip id in the library ("SET/Name"). */
export function clipIds(): string[] {
  return Object.keys(clips).map((p) => p.replace(/^.*library\/sets\//, "").replace(/\.json$/, "")).sort();
}

/** A clip and the rest it was made on (its set's source rest). */
export async function loadClip(id: string): Promise<{ clip: Clip; rest: Rest }> {
  const load = clips[path(id)];
  if (!load) throw new Error(`hello: no clip "${id}" in the library; ids look like QUATERNIUS_3D2DGE/Walk_Loop (${clipIds().length} clips)`);
  const clip = parseClip(await load()), set = JSON.parse(await sets[`../../../../library/sets/${id.split("/")[0]}/_set.json`]!()) as { sources: Record<string, { rest: Rest }> };
  return { clip, rest: set.sources[clip.restSrc]!.rest };
}
