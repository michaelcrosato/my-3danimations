// The library and the example documents as the gallery reads them (PLAN.md WP-8.1): @m3a/library's Library over the
// sets the page bundles (vite.config.ts's plugin), at every tier, verified against the lock with core's SHA-256 as the
// Node host verifies it; a set's clip files load when one of its clips is first needed (`loadSets`), so the page
// starts with the catalogs alone. The example recipes, graphs and simulation scripts of spec/ come as text.
import { parseClip, recipe, type Clip, type Rest } from "@m3a/core";
import { Library, TIERS, type LibraryLock, type LibrarySource, type Tier } from "@m3a/library";
import { LOADERS, LOCK, SETS } from "virtual:m3a-library";

const loaded = new Map<string, Record<string, string>>();
const lock = JSON.parse(LOCK) as LibraryLock;

/** The bundled sets as a library source: manifests and catalogs at once, clip files once their set is loaded. */
export const source: LibrarySource = {
  sets: () => Object.keys(SETS),
  files: (set) => SETS[set]?.files ?? [],
  read(set, file) {
    const s = SETS[set];
    if (!s) throw new Error(`gallery: no set "${set}"`);
    if (file === "_set.json") return s.manifest;
    if (file === "catalog.tsv") return s.catalog;
    const text = loaded.get(set)?.[file];
    if (text === undefined) throw new Error(`gallery: ${set}/${file} isn't loaded; await loadSets(["${set}"]) first`);
    return text;
  },
};

/** Loads the clip files of each set named (each once; a name that is no set is skipped). */
export async function loadSets(sets: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(sets)].filter((s) => LOADERS[s] && !loaded.has(s)).map(async (s) => loaded.set(s, await LOADERS[s]!())));
}

/** The sets named by the clip ids in a value (strings "SET/Name", in arrays and objects too). */
export function setsIn(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === "string") {
    const set = /^([A-Z][A-Z0-9_]*)\//.exec(v)?.[1];
    if (set && SETS[set]) out.add(set);
  } else if (Array.isArray(v)) for (const x of v) setsIn(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) setsIn(x, out);
  return out;
}

const libraries = new Map<string, Library>();
/** Where the library's warnings (a deprecated id) go: the host points it at each call's list. */
export const warnings: { to: string[] } = { to: [] };

/** The library at `tiers` (every tier by default: the gallery shows them all), verified as Node verifies it. */
export function libraryAt(tiers: readonly Tier[] = TIERS): Library {
  const key = tiers.join(",");
  let lib = libraries.get(key);
  if (!lib) libraries.set(key, (lib = new Library(source, { tiers, lock, sha256: recipe.sha256, warn: (m) => warnings.to.push(m) })));
  return lib;
}

/** A clip from its text (a compiled recipe's file) and the rest it was made on, as the tools find it (clips.ts
 *  restFor): its own set's source, else that of the set its provenance names, else the first set's by name. */
export function clipFromText(text: string): { clip: Clip; rest: Rest } {
  const clip = parseClip(text), lib = libraryAt(), sets = source.sets().sort(), setOf = (id: string) => id.split("/")[0]!;
  const orig = clip.provenance.orig, home = sets.includes(setOf(clip.id)) ? setOf(clip.id) : typeof orig === "string" && sets.includes(setOf(orig)) ? setOf(orig) : "";
  for (const s of [home, ...sets].filter((x) => sets.includes(x))) {
    const src = lib.about(s).sources[clip.restSrc];
    if (src) return { clip, rest: src.rest };
  }
  throw new Error(`gallery: ${clip.id} names rest "${clip.restSrc}", which no set's manifest has`);
}

const raw = import.meta.glob<string>(["../../../spec/recipes/*.json", "../../../spec/graphs/*.json", "../../../spec/sims/*.json"], { query: "?raw", import: "default", eager: true });
/** The example documents by their path in the repository ("spec/recipes/Jab_Left.json"), as text. */
export const SPEC: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(raw).map(([p, t]) => [p.replace(/^(\.\.\/)+/, ""), t]));

/** The documents of one kind by name ("Jab_Left"), each with its path. */
export function docs(kind: "recipes" | "graphs" | "sims"): { name: string; path: string }[] {
  return Object.keys(SPEC).filter((p) => p.startsWith(`spec/${kind}/`) && !p.endsWith(".trace.json")).sort().map((path) => ({ name: path.slice(kind.length + 6, -5), path }));
}

/** The script that drives a graph: the longest in spec/sims/ written for it (the first by name among equals), else one
 *  the gallery writes: a 4 s script pressing all its triggers together four times, 0.45 s apart from 0.5 s (at 0.5,
 *  0.95, 1.4 and 1.85 s; none for a graph without triggers). Deterministic: the same graph gives the same script. */
export function scriptFor(graphPath: string): { path: string | null; text: string } {
  const g = JSON.parse(SPEC[graphPath]!) as { id: string; name?: string; parameters?: Record<string, { type: string }> };
  const read = (path: string) => JSON.parse(SPEC[path]!) as { graph?: string; dur?: number };
  const own = docs("sims").filter((d) => read(d.path).graph === g.id).sort((a, b) => (read(b.path).dur ?? 0) - (read(a.path).dur ?? 0))[0];
  if (own) return { path: own.path, text: SPEC[own.path]! };
  const triggers = Object.entries(g.parameters ?? {}).filter(([, p]) => p.type === "trigger").map(([k]) => k);
  const input = triggers.length ? [0.5, 0.95, 1.4, 1.85].map((t) => ({ t, trigger: triggers.length === 1 ? triggers[0] : triggers })) : [];
  const name = g.id.split("/")[1] ?? "Graph";
  return { path: null, text: JSON.stringify({ format: "2.0", id: `SIMS/${name}_Gallery`, desc: "the gallery's script: its triggers pressed together four times, 0.45 s apart from 0.5 s", graph: g.id, dur: 4, input }) };
}
