// The duel's clips, made from the library as a game makes them (PLAN.md WP-10.1): the recipes compiled through the
// library's resolver (the slash gains its `hit` event), and every clip the graph names played through `playable` on
// the rest it was made on, so its feet plant and its root moves on any body. `libraryIds` lists the library clips the
// graph and its recipes read: the page bundles those files alone. No DOM, no Node: the page and Node run the same.
import { graph as G, playable, recipe, type AnimClip } from "@m3a/core";
import type { Library } from "@m3a/library";

/** The duel as text: the graph both fighters play and the recipes whose clips it names. */
export interface DuelText {
  graph: G.Graph;
  recipes: recipe.Recipe[];
}

/** The library clips the duel reads: the graph's clips no recipe makes, and each recipe's `clip` steps' ids, sorted. */
export function libraryIds(text: DuelText): string[] {
  const made = new Set(text.recipes.map((r) => r.id));
  const named = G.layersOf(text.graph).flatMap((L) => Object.values(L.states).flatMap((s) => G.clipsOf(s)));
  const read = text.recipes.flatMap((r) => r.steps.flatMap((s) => (s.op === "clip" && typeof s.id === "string" ? [s.id] : [])));
  return [...new Set([...named.filter((id) => !made.has(id)), ...read])].sort();
}

/** Every clip the graph names, by id, ready to play: each recipe compiled, each clip `playable` on its own rest. */
export function duelClips(library: Library, text: DuelText): Record<string, AnimClip> {
  const clips: Record<string, AnimClip> = {}, resolve = library.resolver();
  for (const r of text.recipes) {
    const made = recipe.compile(r, resolve);
    clips[made.clip.id] = playable(made.clip, made.rest);
  }
  for (const id of libraryIds(text)) {
    const { clip, rest } = library.clip(id);
    clips[id] ??= playable(clip, rest);
  }
  return clips;
}
