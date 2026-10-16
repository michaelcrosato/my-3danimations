// The library as the Node host opens it for a tool call (PLAN.md WP-7.2, D10 and D53): at the tiers game.json in the
// working directory opts in to (read on every call: an agent may edit it while the MCP server runs), else CC0 alone;
// opened once per set of tiers for the process, since verifying a set hashes all of it the first time; each call's
// warnings (a deprecated id) collected for that call alone. The sets `m3a import` wrote under imports/ join it (D93:
// local sets, seen only by a game that opts in to local, which never ships), each read confined to the working
// directory, and the library opened again when one of their manifests changes.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TIERS, type Library, type LibrarySource, type Tier } from "@m3a/library";
import { defaultSets, directory, licenseText, openLibrary } from "@m3a/library/node";
import { ToolError, type LibraryAccess } from "../registry/registry.ts";
import { didYouMean, quote } from "../registry/schema.ts";
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
    throw new ToolError("E_GAME", `game.json is not JSON (${(err as Error).message}); fix it, or remove it for the CC0 default`, true);
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
 *  imported sets it holds, and the call its warnings go to while one of its methods runs. */
const opened = new Map<string, { lib: Library; stamp: string; to: { warnings?: string[] } }>();

/** Whether `path` is under the working directory `cwd`, through no link out of it. */
const within = (cwd: string, path: string): boolean => {
  try {
    return Boolean(under(cwd, path, ""));
  } catch {
    return false;
  }
};

/** `own` (the library's sets) with the sets under `cwd`'s imports/ that `m3a import` wrote (each a directory with a
 *  _set.json, every read confined to the working directory; a name the library has stays the library's), and a stamp
 *  of their manifests, empty when there are none. */
function withImports(own: LibrarySource, cwd: string): { source: LibrarySource; stamp: string } {
  if (!within(cwd, "imports") || !existsSync(join(cwd, "imports"))) return { source: own, stamp: "" };
  const lib = new Set(own.sets()), mine = directory(join(cwd, "imports")), read = (set: string, file: string) => readFileSync(under(cwd, `imports/${set}/${file}`, "keep an imported set's files in it"), "utf8");
  const sets = mine.sets().filter((s) => !lib.has(s) && within(cwd, `imports/${s}`)).sort();
  return {
    source: { sets: () => [...lib, ...sets], files: (set) => (lib.has(set) ? own : mine).files(set), read: (set, file) => (lib.has(set) ? own.read(set, file) : read(set, file)) },
    stamp: sets.map((set) => `${set}\n${read(set, "_set.json")}`).join("\n"),
  };
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

/** The library for one call at `tiers` (game.json's in `cwd` without them), read from `dir` (the default sets). */
export function libraryAccess(cwd: string, tiers?: readonly Tier[], dir: string = defaultSets()): LibraryAccess {
  const want = TIERS.filter((t) => (tiers ?? gameTiers(cwd)).includes(t)), base = resolve(cwd), { source, stamp } = withImports(directory(dir), base);
  // one library for every working directory without imported sets; one for each with them
  const key = `${dir}\n${want.join(",")}${stamp ? `\n${base}` : ""}`;
  let o = opened.get(key);
  if (o?.stamp !== stamp) {
    // opened again when an imported set's manifest changed (the lock, beside the default sets, has no imported set)
    const to: { warnings?: string[] } = {};
    opened.set(key, (o = { lib: openLibrary({ dir, source, tiers: want, warn: (m) => to.warnings?.push(m) }), stamp, to }));
  }
  const warnings: string[] = [];
  return { library: routed(o.lib, warnings, o.to), source, licenseText: licenseText(dir), tiers: want, warnings };
}
