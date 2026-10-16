// The library as the Node host opens it for a tool call (PLAN.md WP-7.2, D10 and D53): at the tiers game.json in the
// working directory opts in to (read on every call: an agent may edit it while the MCP server runs), else CC0 alone;
// opened once per set of tiers for the process, since verifying a set hashes all of it the first time; each call's
// warnings (a deprecated id) collected for that call alone.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TIERS, type Library, type Tier } from "@m3a/library";
import { defaultSets, directory, licenseText, openLibrary } from "@m3a/library/node";
import { ToolError, type LibraryAccess } from "../registry/registry.ts";
import { didYouMean, quote } from "../registry/schema.ts";

/** The tiers game.json in `cwd` opts in to, in TIERS' order; ["cc0"] without the file or its "tiers". E_GAME (usage)
 *  for a file that isn't JSON or names a tier there is not. */
export function gameTiers(cwd: string): Tier[] {
  let text: string;
  try {
    text = readFileSync(join(cwd, "game.json"), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return ["cc0"];
    throw new ToolError("E_GAME", `can't read game.json (${(err as NodeJS.ErrnoException).code ?? "unreadable"})`, true);
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

/** One opened library per directory and tiers, with the call its warnings go to while one of its methods runs. */
const opened = new Map<string, { lib: Library; to: { warnings?: string[] } }>();

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
  const want = TIERS.filter((t) => (tiers ?? gameTiers(cwd)).includes(t)), key = `${dir}\n${want.join(",")}`;
  let o = opened.get(key);
  if (!o) {
    const to: { warnings?: string[] } = {};
    opened.set(key, (o = { lib: openLibrary({ dir, tiers: want, warn: (m) => to.warnings?.push(m) }), to }));
  }
  const warnings: string[] = [];
  return { library: routed(o.lib, warnings, o.to), source: directory(dir), licenseText: licenseText(dir), tiers: want, warnings };
}
