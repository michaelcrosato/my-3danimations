// The local lane on disk (PLAN.md WP-9.2, O5, D10): where `sourcing.deliver` writes a source's clips that may not
// enter the intake queue, under the working directory's library/local/ and nowhere else. Every path goes through
// `localPath` (a local set's own file: no way out by its name), and its real path, or its nearest existing ancestor's,
// must be the path itself: no link anywhere from the working directory down, so neither library/, library/local/, a
// set's directory nor a file leads into library/sets/ or out. Writes are atomic, and library/local/.lock is taken
// exclusively while a set is rewritten, so two processes never interleave one set's files. library/local/ is never
// committed (but its README) and never shipped.
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { LOCAL, localPath, type LocalLane } from "../sources/deliver.ts";
import { fail } from "../sources/types.ts";
import { errno, lockAt, writeAtomic } from "./files.ts";

/** A local set's directory, as `LocalLane.list` is given it. */
const SET_DIR = /^library\/local\/[A-Z][A-Z0-9_]*$/;

/** `path` (from the working directory `base`, its parts checked already) as an absolute path, refused (E_LOCAL) when
 *  a link stands anywhere on the way to it: the real path of it, or of its nearest existing ancestor, must be that path
 *  under the working directory's own real path. */
function inLane(base: string, path: string): string {
  const p = join(base, ...path.split("/"));
  let q = p;
  while (q !== base && !lstatSync(q, { throwIfNoEntry: false })) q = dirname(q);
  let real: string | null;
  try {
    real = realpathSync(q);
  } catch {
    real = null; // a link that leads nowhere
  }
  if (real !== join(realpathSync(base), relative(base, q))) throw fail("E_LOCAL", `${path} leads out of ${LOCAL} through a link: a source writes only real files under ${LOCAL} (remove the link)`);
  return p;
}

/**
 * The local lane in the working directory `cwd` (the current one by default): `read` a local set's file (null when it
 * isn't there), `write` one atomically, `list` a local set's files (none when it isn't there), and `lock` the lane
 * across processes. Any other path, or one through a link, is refused with E_LOCAL, and nothing is written.
 */
export function localLane(cwd: string = process.cwd()): LocalLane {
  const base = resolve(cwd);
  return {
    read(path) {
      const p = inLane(base, localPath(path));
      try {
        return readFileSync(p, "utf8");
      } catch (err) {
        if (errno(err) === "ENOENT") return null;
        throw err;
      }
    },
    write: (path, text) => writeAtomic(inLane(base, localPath(path)), text),
    list(dir) {
      if (!SET_DIR.test(dir)) throw fail("E_LOCAL", `a source lists only a local set's directory, library/local/<SET>, not ${JSON.stringify(dir)}`);
      try {
        return readdirSync(inLane(base, dir), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).sort();
      } catch (err) {
        if (errno(err) === "ENOENT") return [];
        throw err;
      }
    },
    lock: async () => lockAt(inLane(base, `${LOCAL}.lock`), `${LOCAL}.lock`),
  };
}
