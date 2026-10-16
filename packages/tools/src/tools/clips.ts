// One way to name a clip for every clip tool (PLAN.md WP-7.2): a library id (SET/Name, at the game's tiers), a workshop
// copy (WORKSHOP/Name: workshop/Name.json, its origin and rest kept in its history while that history is the file's), a
// .json path, or the clip's JSON. A file or JSON clip is checked with @m3a/core's validator and takes its rest from a
// set's manifest. A refusal names the closest id, or the game.json line that opts in to a tier. And a recipe resolver
// over the library and the workshop.
import { recipe, validate, validation, type Clip, type Rest } from "@m3a/core";
import { LibraryError, tierOf, type SourceAbout, type Tier } from "@m3a/library";
import { ToolError, type LibraryAccess, type ToolContext } from "../registry/registry.ts";
import { closest, quote } from "../registry/schema.ts";
import { absolute, arg, count } from "./common.ts";
import { readTarget, WORKSHOP, workshopName } from "./workshop.ts";

/** Where a clip's rest comes from: the set and key (the clip's restSrc) of a manifest's source, with that source. */
export type ClipSource = SourceAbout & { set: string; key: string };

/** A clip loaded for a tool: its id, the clip, its rest, the set its id names (WORKSHOP for a workshop copy), `home`,
 *  the set it belongs to (a workshop copy's origin's: its history's, else the set of the library clip its provenance
 *  names; a file's own set, else that one's; its tier and rest are looked up there), that set's tier (null when it is
 *  no library set), its rest's source (null when only a history kept the rest), the library clip its workshop history
 *  names (`origin`; null for any other), where it came from, its file and text (null for a library clip), and its
 *  workshop name (null unless a workshop copy). */
export interface ClipRef {
  id: string;
  clip: Clip;
  rest: Rest;
  set: string;
  home: string;
  tier: Tier | null;
  source: ClipSource | null;
  origin: string | null;
  where: "library" | "workshop" | "file" | "text";
  path: string | null;
  text: string | null;
  name: string | null;
}

/** A clip read for its own data alone (readClip): a ClipRef whose rest is null when no set has it. */
export type ClipData = Omit<ClipRef, "rest"> & { rest: Rest | null };

/** The set a clip id names: its part before the "/". */
const setOf = (id: string): string => id.split("/")[0]!;

/**
 * How replies name a loaded clip: `as`, the way a next hint gives it to be called again (its library id, WORKSHOP/<Name>
 * for a workshop copy however it was given, so its history applies, or its path as given, single-quoted where the
 * shell would split it), or `<whose JSON>` / `<whose file>` for clip JSON, an absolute path or a path with a control
 * character, which no reply echoes; and `title`, the way a verdict names it: `as`, or for those its id with "(whose
 * JSON)" or "(whose file)". `whose` tells two clips apart (diff's "a's" and "b's").
 */
export function naming(ref: Pick<ClipRef, "id" | "where" | "path" | "name">, whose = "the clip's"): { as: string; title: string } {
  if (ref.where === "library") return { as: ref.id, title: ref.id };
  if (ref.where === "workshop") return { as: `${WORKSHOP}/${ref.name}`, title: `${WORKSHOP}/${ref.name}` };
  const hidden = ref.where === "text" ? "JSON" : absolute(ref.path!) || /\p{Cc}/u.test(ref.path!) ? "file" : null;
  return hidden ? { as: `<${whose} ${hidden}>`, title: `${ref.id} (${whose} ${hidden})` } : { as: arg(ref.path!), title: arg(ref.path!) };
}

/** A license's parts: a composed clip carries each of its inputs' licenses, joined with " AND " (D10). */
export const parts = (license: string): string[] => license.split(" AND ").map((p) => p.trim());
/** Whether a game at `tiers` may use what `tier` holds: that tier is among them, or local, which holds anything. */
export const fits = (tier: Tier, tiers: readonly Tier[]): boolean => tiers.includes(tier) || tiers.includes("local");
/** What a clip's provenance names: its `orig` and its recipe's inputs. */
export const namedBy = (clip: Clip): unknown[] => [clip.provenance.orig, ...Object.keys((clip.provenance as { recipe?: { inputs?: object } }).recipe?.inputs ?? {})];
/** The library clips among `xs`, each once. */
export function libraryClips(lib: LibraryAccess, xs: readonly unknown[]): string[] {
  const is = (x: unknown): x is string => {
    const [set = "", name] = typeof x === "string" ? x.split("/") : [];
    return lib.source.sets().includes(set) && lib.source.files(set).includes(`${name}.json`);
  };
  return [...new Set(xs.filter(is))];
}

/**
 * What shipping `ref` needs that the game's tiers lack (D93: a file, JSON or workshop clip loads whatever its tier, so
 * it is flagged rather than refused; a library id is held to the tiers before it loads): the tiers of the set it
 * belongs to and of the library clips it names (its workshop origin, its provenance's orig and recipe inputs), and of
 * each part of its license, as license.check would fail it. The warning's text (naming the game.json line to add), or
 * null when the game may ship it.
 */
export function tierWarning(lib: LibraryAccess, ref: ClipData): string | null {
  if (ref.where === "library") return null;
  const license = ref.clip.provenance.license, sets = [...new Set([...(ref.tier ? [ref.home] : []), ...libraryClips(lib, [ref.origin, ...namedBy(ref.clip)]).map(setOf)])];
  const out = sets.map((s) => [s, lib.library.about(s).tier] as const).filter(([, t]) => !lib.tiers.includes(t)), title = naming(ref).title;
  const missing = [...new Set([...out.map(([, t]) => t), ...parts(license).map(tierOf).filter((t) => !fits(t, lib.tiers))])];
  if (missing.includes("local")) return `${title}: its license (${license}) fits no tier a shipped game opts in to (D10)`;
  const why = `${out.map(([s, t]) => `${s} is a ${t} set, `).join("")}its license is ${license}`;
  return missing.length ? `add ${missing.map((t) => `"${t}"`).join(" and ")} to "tiers" in game.json before shipping ${title}: ${why}` : null;
}

/** Puts tierWarning's line for `ref` among the call's warnings (once), which the registry puts first among the reply's
 *  lines. */
export function flagTier(lib: LibraryAccess, ref: ClipData): void {
  const warn = tierWarning(lib, ref);
  if (warn && !lib.warnings.includes(warn)) lib.warnings.push(warn);
}

/**
 * Loads the clip `ref` names: its JSON (starting with "{"), a .json path, WORKSHOP/<Name> (or its file's path, read as
 * that id so its history applies), or a library id at the game's tiers. Refusals: E_NO_CLIP, E_NO_SET and E_TIER
 * (usage); E_CLIP (usage for JSON given inline, an error for a file); E_REST when no set has its rest; E_TAMPERED (an
 * error). Only a library id is held to the game's tiers: a file, JSON or workshop copy is the user's and loads whatever
 * set it came from, its `tier` saying which; when the game couldn't ship it, the call's warnings say so (tierWarning),
 * which the registry puts first among the reply's lines, for every tool that loads a clip.
 */
export async function loadClip(ctx: ToolContext, ref: string): Promise<ClipRef> {
  const r = await readClip(ctx, ref);
  flagTier(ctx.library(), r);
  if (r.rest) return { ...r, rest: r.rest };
  throw new ToolError("E_REST", `${r.path === null ? "the clip JSON" : absolute(r.path) ? "the clip file" : quote(r.path)} names rest ${quote(r.clip.restSrc)}, which no set's manifest has; make it on a library rest (each set's _set.json lists its sources)`, r.where === "text");
}

/** As loadClip, for a tool that needs only the clip's own data (license.check): a clip whose rest no set has (and no
 *  history kept) loads too, its rest null. A workshop copy's history counts only as the edit tools read it (workshop.ts
 *  readTarget): the file's own, or stepped back from a write cut short; set aside (the file changed outside m3a, or
 *  the history unreadable), the file is read as any clip file is. */
export async function readClip(ctx: ToolContext, ref: string): Promise<ClipData> {
  const lib = ctx.library(), given = ref.trim(), name = workshopName(given);
  if (name !== null) {
    const t = await readTarget(ctx, name), h = t.history;
    if (t.text === null) throw new ToolError("E_NO_CLIP", `no workshop clip ${quote(t.id)} (${t.path}); fix or edit a library clip with \`--save_as ${t.id}\` to make one`, true);
    return fromText(lib, t.text, "workshop", t.path, name, h && { origin: h.from, rest: h.rest });
  }
  if (given.startsWith("{")) return fromText(lib, given, "text", null, null);
  if (/\.json$/i.test(given)) return fromText(lib, await ctx.read(given), "file", given, null);
  return fromLibrary(lib, given);
}

/** A clip from its text: parsed and checked with core's validator (read mode), its rest from its history (`kept`) or a
 *  manifest. E_CLIP when it is no clip (usage for JSON given inline). */
export function fromText(lib: LibraryAccess, text: string, where: "workshop" | "file" | "text", path: string | null, name: string | null, kept?: { origin: string; rest: Rest } | null): ClipData {
  const what = path === null ? "the clip JSON" : absolute(path) ? "the clip file" : quote(path), inline = where === "text";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new ToolError("E_CLIP", `${what} is not JSON: ${(err as Error).message}`, inline);
  }
  const r = validate(data, { mode: "read" });
  if (!r.ok) throw new ToolError("E_CLIP", `${what} is not a valid clip (${count(r.errors.length, "error")}): ${validation.formatIssue(r.errors[0]!).replace(/\s*\n\s*/g, "; ")}`, inline);
  const clip = data as Clip, set = setOf(clip.id), sets = lib.source.sets(), orig = clip.provenance.orig;
  const home = kept ? setOf(kept.origin) : !sets.includes(set) && typeof orig === "string" && sets.includes(setOf(orig)) ? setOf(orig) : set;
  const found = restFor(lib, clip, home), tier = sets.includes(home) ? lib.library.about(home).tier : null;
  return { id: clip.id, clip, rest: kept?.rest ?? found?.rest ?? null, set, home, tier, source: found?.source ?? null, origin: kept?.origin ?? null, where, path, text, name };
}

/** A library clip, its refusal turned into a tool's. */
function fromLibrary(lib: LibraryAccess, id: string): ClipRef {
  try {
    const got = lib.library.clip(id), key = got.clip.restSrc, src = lib.library.about(got.set).sources[key]!;
    return { id: got.clip.id, clip: got.clip, rest: got.rest, set: got.set, home: got.set, tier: got.tier, source: { ...src, set: got.set, key }, origin: null, where: "library", path: null, text: null, name: null };
  } catch (err) {
    throw err instanceof LibraryError ? refusal(err, id, lib) : err;
  }
}

/**
 * The rest `clip` was made on and its source: in the manifest of `set` (the one its id names by default), else of the
 * first set by name with its restSrc (rest names repeat across sets: UAL1 is in both QUATERNIUS sets). Every tier is
 * read, since a rest is no clip. Null when no set has it.
 */
export function restFor(lib: LibraryAccess, clip: Clip, set = setOf(clip.id)): { rest: Rest; source: ClipSource } | null {
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
    const tier = /(?:,| is) a (\S+) set/.exec(said)?.[1]; // a clip's ("X" is in SET, a cmu set) or a set's (SET is a cmu set)
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
