// The library as the Node host opens it for a tool call (PLAN.md WP-7.2, D10 and D53): at the tiers game.json in the
// working directory opts in to (read on every call: an agent may edit it while the MCP server runs), else CC0 alone;
// with the opt-in packs installed beside @m3a/library (D10, WP-7.4: looked up on every call too, so one installed while
// the server runs joins the next call); opened once per set of tiers and packs for the process, since verifying a set
// hashes all of it the first time, and at most MAX_OPEN libraries kept (the least lately used dropped), so a long-lived server isn't grown by each directory; each
// call's warnings (a deprecated id) collected for that call alone. The sets `m3a import` wrote under imports/ join it
// (D93: local sets, seen only by a game that opts in to local, which never ships), each read confined to the working
// directory, and the library opened again when one of their manifests or catalogs changes. An imported set that can't
// be read inside the working directory, whose manifest isn't an imported set's, or named as a library set (the
// library's wins) is left out with a warning on every call, so it breaks no other set.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TIERS, type Library, type LibrarySource, type Tier } from "@m3a/library";
import { defaultSets, installedPacks, licenseText, openLibrary, withPacks } from "@m3a/library/node";
import { ToolError, type LibraryAccess } from "../registry/registry.ts";
import { didYouMean, quote } from "../registry/schema.ts";
import { oneLine } from "../tools/common.ts";
import { errno, under } from "./files.ts";

/** The tiers game.json in `cwd` opts in to, in TIERS' order; ["cc0"] without the file or its "tiers". E_GAME (usage)
 *  for a file that isn't JSON, names a tier there is not, or is a link out of the working directory. */
export function gameTiers(cwd: string): Tier[] {
  let text: string;
  try {
    text = readFileSync(under(resolve(cwd), "game.json", "keep game.json in the working directory"), "utf8");
  } catch (err) {
    if (err instanceof ToolError) throw new ToolError("E_GAME", err.message, true);
    if (errno(err) === "ENOENT") return ["cc0"];
    throw new ToolError("E_GAME", `can't read game.json (${errno(err)})`, true);
  }
  let game: { tiers?: unknown };
  try {
    game = JSON.parse(text) as typeof game;
  } catch (err) {
    throw new ToolError("E_GAME", `game.json is not JSON (${oneLine(err)}); fix it, or remove it for the CC0 default`, true);
  }
  const fix = `"tiers" in game.json lists tiers, of ${TIERS.join(", ")}, as { "tiers": ["cc0", "cc-by"] }`;
  if (typeof game !== "object" || game === null || Array.isArray(game)) throw new ToolError("E_GAME", `game.json is a JSON object: ${fix}`, true);
  const tiers = game.tiers;
  if (tiers === undefined) return ["cc0"];
  if (!Array.isArray(tiers) || !tiers.length) throw new ToolError("E_GAME", fix, true);
  const bad = tiers.find((t) => !(TIERS as readonly unknown[]).includes(t));
  if (bad !== undefined) throw new ToolError("E_GAME", `game.json opts in to tier ${quote(bad)}, which there is not${typeof bad === "string" ? didYouMean(bad, TIERS) : ""}; ${fix}`, true);
  return TIERS.filter((t) => tiers.includes(t));
}

/** One opened library per directory and tiers (and working directory, when it has imported sets), the stamp of the
 *  opt-in packs and imported sets it holds, the warnings opening it raised (an opted-in tier whose pack isn't
 *  installed), which every call it serves repeats, and the call its warnings go to while one of its methods runs; the
 *  least lately used first. */
const opened = new Map<string, { lib: Library; stamp: string; built: string[]; to: { warnings?: string[] } }>();
/** The most libraries the host keeps open: each working directory with imported sets opens its own. */
export const MAX_OPEN = 8;
/** How many libraries the host has opened, each verifying its sets the first time it is used (one dropped opens again). */
let opens = 0;
/** How many libraries the host keeps open now (at most MAX_OPEN), and has opened in all. */
export const openCount = (): { open: number; opens: number } => ({ open: opened.size, opens });

/** Whether `path` is under the working directory `cwd`, through no link out of it. */
const within = (cwd: string, path: string): boolean => {
  try {
    return Boolean(under(cwd, path, ""));
  } catch {
    return false;
  }
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** Whether `m` is the manifest of imported set `set` as the library reads one: the set's own name, tier local (imports/
 *  holds nothing that ships, D10), a title, credit and content id, and each source's license and rest. */
const imported = (m: unknown, set: string): boolean =>
  isObj(m) && m.set === set && m.tier === "local" && typeof m.title === "string" && typeof m.credit === "string" && isObj(m.content) && typeof m.content.sha256 === "string" &&
  isObj(m.sources) && Object.values(m.sources).every((x) => isObj(x) && typeof x.license === "string" && isObj(x.rest)) && (m.legend === undefined || (isObj(m.legend) && Array.isArray(m.legend.text)));

/** `own` (the library's sets) with the sets under `cwd`'s imports/ that `m3a import` wrote (each a directory named as a
 *  set, with a _set.json; a name the library has stays the library's), every read confined to the working directory; a
 *  stamp of their manifests and catalogs, empty when there are none; and a warning for each set left out (one that
 *  leads out of the working directory, can't be read, or whose manifest isn't an imported set's). A set that isn't the
 *  library's is listed and read under imports/<SET>/ when asked, not as imports/ stood when the call opened its
 *  library: an import that opened it before another import made imports/ still sees what that one wrote, so it
 *  replaces it (a set imports/ doesn't hold is ENOENT, which import reads as none; one through a link out is refused). */
function withImports(own: LibrarySource, cwd: string): { source: LibrarySource; stamp: string; warnings: string[] } {
  const lib = new Set(own.sets()), read = (set: string, file: string) => readFileSync(under(cwd, `imports/${set}/${file}`, "keep an imported set's files in it"), "utf8");
  const files = (set: string) => readdirSync(under(cwd, `imports/${set}`, "keep an imported set in imports/"));
  const sourceOf = (sets: readonly string[]): LibrarySource => ({ sets: () => [...lib, ...sets], files: (set) => (lib.has(set) ? own.files(set) : files(set)), read: (set, file) => (lib.has(set) ? own.read(set, file) : read(set, file)) });
  const none = { source: sourceOf([]), stamp: "", warnings: [] };
  if (!existsSync(join(cwd, "imports"))) return none;
  if (!within(cwd, "imports")) return { ...none, warnings: ["imports/ is left out: it leads out of the working directory"] };
  const sets: string[] = [], stamp: string[] = [], warnings: string[] = [], names = (() => {
    try {
      return readdirSync(join(cwd, "imports"));
    } catch (err) {
      warnings.push(`imports/ is left out: it can't be listed (${errno(err)})`);
      return [];
    }
  })();
  for (const set of names.filter((s) => /^[A-Z][A-Z0-9_]*$/.test(s) && existsSync(join(cwd, "imports", s, "_set.json"))).sort()) {
    if (lib.has(set)) {
      warnings.push(`imports/${set}/ is left out: the library has a set ${set}; import it again under another name, or remove it`);
      continue;
    }
    let why: string;
    try {
      const text = read(set, "_set.json");
      if (imported(JSON.parse(text), set)) {
        stamp.push(set, text, read(set, "catalog.tsv"));
        sets.push(set);
        continue;
      }
      why = "its _set.json isn't an imported set's manifest";
    } catch (err) {
      why = err instanceof ToolError ? "it leads out of the working directory" : err instanceof SyntaxError ? "its _set.json isn't JSON" : `its files can't be read (${errno(err)})`;
    }
    warnings.push(`imports/${set}/ is left out: ${why}; import it again, or remove it`);
  }
  return { source: sourceOf(sets), stamp: stamp.join("\n"), warnings };
}

/** `lib` whose warnings go to `into` while each of its methods runs, and while a function one returns (the resolver) does:
 *  the library is shared between calls, its warnings are not. */
function routed(lib: Library, into: string[], to: { warnings?: string[] }): Library {
  const wrap = (f: (...a: unknown[]) => unknown, self: unknown) => (...a: unknown[]) => {
    const was = to.warnings;
    to.warnings = into;
    try {
      const v = f.apply(self, a);
      return typeof v === "function" ? Object.assign(wrap(v as (...a: unknown[]) => unknown, undefined), v) : v;
    } finally {
      to.warnings = was;
    }
  };
  return new Proxy(lib, { get: (t, k) => ((v) => (typeof v === "function" ? wrap(v as (...a: unknown[]) => unknown, t) : v))(Reflect.get(t, k, t)) });
}

/** The library for one call at `tiers` (game.json's in `cwd` without them), read from `dir` (the default sets) and the
 *  opt-in packs' directories `packs` by tier (D10: those installed beside @m3a/library, looked up on every call, so a
 *  pack `npm install`ed while `m3a mcp` runs joins the next call, as the missing-pack warning promises). */
export function libraryAccess(cwd: string, tiers?: readonly Tier[], dir: string = defaultSets(), packs: Partial<Record<Tier, string>> = installedPacks()): LibraryAccess {
  const want = TIERS.filter((t) => (tiers ?? gameTiers(cwd)).includes(t)), base = resolve(cwd), dirs = Object.values(packs);
  const { source, stamp: imports, warnings: left } = withImports(withPacks(dir, dirs), base);
  // one library for every working directory without imported sets; one for each with them
  const key = `${dir}\n${want.join(",")}${imports ? `\n${base}` : ""}`, stamp = `${dirs.join("\n")}\0${imports}`;
  let o = opened.get(key);
  if (o?.stamp !== stamp) {
    // opened again when an opt-in pack is installed or removed (its sets and lock join or leave), or an imported set's
    // manifest or catalog changed (no lock covers an imported set)
    const built: string[] = [], to: { warnings?: string[] } = { warnings: built };
    o = { lib: openLibrary({ dir, source, packs, tiers: want, warn: (m) => to.warnings?.push(m) }), stamp, built, to };
    to.warnings = undefined;
    opens++;
  }
  opened.delete(key);
  opened.set(key, o);
  if (opened.size > MAX_OPEN) opened.delete(opened.keys().next().value!);
  const warnings: string[] = [...left, ...o.built];
  return { library: routed(o.lib, warnings, o.to), source, licenseText: licenseText(dir, dirs), tiers: want, warnings };
}
