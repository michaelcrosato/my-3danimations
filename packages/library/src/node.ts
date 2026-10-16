// @m3a/library's Node entry (PLAN.md §5.1): the library read from a directory, verified with Node's SHA-256, and its
// lock written. The package's own `sets/` when it ships one (a packed package), else the repository's library/sets.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { contentId, Library, type LibraryLock, type LibraryOptions, type LibrarySource } from "./load/index.ts";

/** SHA-256 of a text's UTF-8 bytes, in hex. */
export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** The default directory of sets: the package's own (packed), else the repository's. */
export function defaultSets(): string {
  const own = join(import.meta.dirname, "../sets");
  return existsSync(own) ? own : join(import.meta.dirname, "../../../library/sets");
}

/** A directory of sets as a library source. */
export function directory(dir: string): LibrarySource {
  return {
    sets: () => readdirSync(dir).filter((s) => statSync(join(dir, s)).isDirectory() && existsSync(join(dir, s, "_set.json"))),
    files: (set) => readdirSync(join(dir, set)),
    read: (set, file) => readFileSync(join(dir, set, file), "utf8"),
  };
}

/**
 * Opens the library in `dir` (the default sets) with its lock (`sets.lock.json` beside the sets) and Node's SHA-256:
 * the CC0 default pack unless `tiers` opts in to more (D10). Warnings go to stderr unless `warn` takes them. `source`
 * reads the sets from elsewhere (more sets beside dir's: a project's imported ones), the lock still dir's.
 */
export function openLibrary(opts: LibraryOptions & { dir?: string; source?: LibrarySource } = {}): Library {
  const dir = opts.dir ?? defaultSets(), lockFile = join(dirname(dir), "sets.lock.json");
  const lock = opts.lock ?? (existsSync(lockFile) ? (JSON.parse(readFileSync(lockFile, "utf8")) as LibraryLock) : undefined);
  return new Library(opts.source ?? directory(dir), { sha256, warn: (m) => process.stderr.write(`${m}\n`), ...opts, ...(lock ? { lock } : {}) });
}

/** The lock for the sets in `dir`: each set's content id and each clip file's SHA-256 (aliases kept from `previous`). */
export function lockLibrary(dir = defaultSets(), previous?: LibraryLock): LibraryLock {
  const src = directory(dir), sets: LibraryLock["sets"] = {};
  for (const s of src.sets().sort()) {
    const files: Record<string, string> = {};
    for (const f of src.files(s).filter((x) => x.endsWith(".json") && !x.startsWith("_")).sort()) files[f] = sha256(src.read(s, f));
    sets[s] = { content: contentId(files, sha256), files };
  }
  return { about: "Each set's content id (spec/MOTION.md §9.2) and each clip file's SHA-256, so the loader names a file that changed (WP-5.1). Written by npm run library -- lock; aliases map a deprecated id to its successor.", sets, aliases: previous?.aliases ?? {} };
}

/** A license's text as the library keeps it (`LICENSES/<id>.txt` beside the sets), or null when it isn't kept. */
export function licenseText(dir = defaultSets()): (id: string) => string | null {
  return (id) => {
    const f = join(dirname(dir), "LICENSES", `${id}.txt`);
    return /^[\w.+-]+$/.test(id) && existsSync(f) ? readFileSync(f, "utf8") : null;
  };
}
