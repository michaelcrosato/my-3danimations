// One way to name a clip for every clip tool (PLAN.md WP-7.2): a library id (SET/Name, at the game's tiers), a workshop
// copy (WORKSHOP/Name: workshop/Name.json, its rest kept in its history), a .json path, or the clip's JSON. A file or
// JSON clip is checked with @m3a/core's validator and takes its rest from a set's manifest. A refusal names the closest
// id, or the game.json line that opts in to a tier. And a recipe resolver over the library and the workshop.
import { recipe, validate, validation, type Clip, type Rest } from "@m3a/core";
import { LibraryError, type SourceAbout, type Tier } from "@m3a/library";
import { ToolError, type LibraryAccess, type ToolContext } from "../registry/registry.ts";
import { closest, quote } from "../registry/schema.ts";
import { count } from "./common.ts";

/** The workshop's set name: WORKSHOP/<Name> is the edited clip in workshop/<Name>.json. */
export const WORKSHOP = "WORKSHOP";
/** A workshop clip's name: a letter, then letters, digits or "_". */
export const WORKSHOP_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
/** The file a workshop clip lives in. */
export const workshopFile = (name: string): string => `workshop/${name}.json`;
/** The file a workshop clip's history lives in: the clip it came from (`from`), that clip's rest, its undo stack. */
export const historyFile = (name: string): string => `.m3a/history/${name}.json`;

/** Where a clip's rest comes from: the set and key (the clip's restSrc) of a manifest's source, with that source. */
export type ClipSource = SourceAbout & { set: string; key: string };

/** A clip loaded for a tool: its id, the clip, its rest, the set its id names (WORKSHOP for a workshop copy), its tier
 *  (a workshop copy's origin's; null when no library set is its), its rest's source (null when only a history kept the
 *  rest), where it came from, and its file and text (null for a library clip). */
export interface ClipRef {
  id: string;
  clip: Clip;
  rest: Rest;
  set: string;
  tier: Tier | null;
  source: ClipSource | null;
  where: "library" | "workshop" | "file" | "text";
  path: string | null;
  text: string | null;
}

/**
 * Loads the clip `ref` names: its JSON (starting with "{"), a .json path, WORKSHOP/<Name>, or a library id at the game's
 * tiers. Refusals: E_NO_CLIP, E_NO_SET and E_TIER (usage); E_CLIP (usage for JSON given inline, an error for a file);
 * E_REST when no set has its rest; E_TAMPERED (an error).
 */
export async function loadClip(ctx: ToolContext, ref: string): Promise<ClipRef> {
  const lib = ctx.library(), id = ref.trim();
  if (id.startsWith("{")) return fromText(lib, id, "text", null);
  if (/\.json$/i.test(id)) return fromText(lib, await ctx.read(id), "file", id);
  const [set, name, more] = id.split("/");
  if (set !== WORKSHOP) return fromLibrary(lib, id);
  if (!name || more !== undefined || !WORKSHOP_NAME.test(name)) throw new ToolError("E_NO_CLIP", `${quote(id)} is no workshop id: WORKSHOP/<Name>, the name a letter, then letters, digits or "_"`, true);
  const path = workshopFile(name), text = await ctx.tryRead(path);
  if (text === null) throw new ToolError("E_NO_CLIP", `no workshop clip ${quote(id)} (${path}); fix or edit a library clip with save_as "${id}" to make one`, true);
  let h: { from?: unknown; rest?: Rest } | null;
  try {
    h = JSON.parse((await ctx.tryRead(historyFile(name))) ?? "null") as { from?: unknown; rest?: Rest } | null;
  } catch {
    h = null; // an unreadable history: the rest comes from the manifests, as for a file
  }
  return fromText(lib, text, "workshop", path, typeof h?.from === "string" ? h.from.split("/")[0] : undefined, h?.rest);
}

/** A clip from its text: parsed and checked with core's validator (read mode), its rest from `rest` or a manifest. */
function fromText(lib: LibraryAccess, text: string, where: "workshop" | "file" | "text", path: string | null, origin?: string, rest?: Rest): ClipRef {
  const what = path === null ? "the clip JSON" : quote(path), inline = where === "text";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new ToolError("E_CLIP", `${what} is not JSON: ${(err as Error).message}`, inline);
  }
  const r = validate(data, { mode: "read" });
  if (!r.ok) throw new ToolError("E_CLIP", `${what} is not a valid clip (${count(r.errors.length, "error")}): ${validation.formatIssue(r.errors[0]!).replace(/\s*\n\s*/g, "; ")}`, inline);
  const clip = data as Clip, set = clip.id.split("/")[0]!, own = origin ?? set, found = restFor(lib, clip, own);
  if (!found && !rest) throw new ToolError("E_REST", `${what} names rest ${quote(clip.restSrc)}, which no set's manifest has; make it on a library rest (each set's _set.json lists its sources)`, inline);
  const tier = lib.source.sets().includes(own) ? lib.library.about(own).tier : null;
  return { id: clip.id, clip, rest: rest ?? found!.rest, set, tier, source: found?.source ?? null, where, path, text };
}

/** A library clip, its refusal turned into a tool's. */
function fromLibrary(lib: LibraryAccess, id: string): ClipRef {
  try {
    const got = lib.library.clip(id), key = got.clip.restSrc, src = lib.library.about(got.set).sources[key]!;
    return { id: got.clip.id, clip: got.clip, rest: got.rest, set: got.set, tier: got.tier, source: { ...src, set: got.set, key }, where: "library", path: null, text: null };
  } catch (err) {
    throw err instanceof LibraryError ? refusal(err, id, lib) : err;
  }
}

/**
 * The rest `clip` was made on and its source: in the manifest of `set` (the one its id names by default), else of the
 * first set by name with its restSrc (rest names repeat across sets: UAL1 is in both QUATERNIUS sets). Every tier is
 * read, since a rest is no clip. Null when no set has it.
 */
export function restFor(lib: LibraryAccess, clip: Clip, set = clip.id.split("/")[0]!): { rest: Rest; source: ClipSource } | null {
  const sets = lib.source.sets().sort();
  for (const s of [set, ...sets].filter((x) => sets.includes(x))) {
    const src = lib.library.about(s).sources[clip.restSrc];
    if (src) return { rest: src.rest, source: { ...src, set: s, key: clip.restSrc } };
  }
  return null;
}

/** The visible clip id closest to `id`: in its set (or the nearest set's name), the shortest name beginning with the
 *  asked one, else the nearest name by edit distance; undefined when the game sees no clip. */
export function suggestId(lib: LibraryAccess, id: string): string | undefined {
  const setOf = (x: string) => x.slice(0, Math.max(0, x.indexOf("/"))), nameOf = (x: string) => x.slice(x.indexOf("/") + 1);
  const ids = lib.library.catalog().map((r) => r.id), set = id.includes("/") ? closest(setOf(id), [...new Set(ids.map(setOf))]) : undefined;
  const pool = set === undefined ? ids : ids.filter((x) => setOf(x) === set), name = nameOf(id).toLowerCase();
  const begins = pool.filter((x) => nameOf(x).toLowerCase().startsWith(name)).sort((a, b) => a.length - b.length)[0];
  const near = closest(name, pool.map(nameOf));
  return begins ?? pool.find((x) => nameOf(x) === near);
}

/** A library refusal as a tool's: an unknown clip or set (usage, naming the closest visible id), a tier the game hasn't
 *  opted in to (usage, naming the line to add to game.json), or a tampered file (an error). */
export function refusal(err: LibraryError, id: string, lib?: LibraryAccess): ToolError {
  const said = err.message.replace(/^library: /, ""), near = lib && err.code !== "E_TIER" && err.code !== "E_TAMPERED" ? suggestId(lib, id) : undefined;
  const hint = near ? `; did you mean ${quote(near)}?` : "";
  if (err.code === "E_TAMPERED") return new ToolError(err.code, said);
  if (err.code === "E_TIER") {
    const tier = /, a (\S+) set/.exec(said)?.[1];
    return new ToolError(err.code, tier ? said.replace(/opt in with \{ tiers: \[[^\]]*\] \}/, `add "${tier}" to "tiers" in game.json`) : said, true);
  }
  if (!id.includes("/")) return new ToolError("E_NO_CLIP", `${quote(id)} is no clip id: give SET/Name (search finds them), a .json path or the clip's JSON${hint}`, true);
  if (/names rest/.test(said)) return new ToolError("E_REST", said);
  return new ToolError(err.code, `no ${err.code === "E_NO_SET" ? `set ${quote(id.split("/")[0])}` : `clip ${quote(id)}`}${hint}`, true);
}

/** A recipe resolver over the library (at the game's tiers) and the workshop. A resolver answers at once, so the
 *  WORKSHOP ids among `ids` (a recipe's clips) are read first; library ids go through the library's own resolver. */
export async function clipResolver(ctx: ToolContext, ids: readonly string[] = []): Promise<recipe.Resolver> {
  const base = ctx.library().library.resolver(), own = new Map<string, recipe.Resolved>();
  for (const id of new Set(ids.filter((x) => x.startsWith(`${WORKSHOP}/`)))) {
    const r = await loadClip(ctx, id);
    own.set(id, { clip: r.clip, rest: r.rest, contentId: recipe.sha256(r.text!) });
  }
  return Object.assign((id: string) => own.get(id) ?? base(id), { ids: () => [...(base.ids?.() ?? []), ...own.keys()] });
}
