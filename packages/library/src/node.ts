// @m3a/library's Node entry (PLAN.md §5.1): the library read from a directory, verified with Node's SHA-256, and its
// lock written. The package's own `sets/` when it ships one (a packed package), else the repository's library/sets;
// with them, the sets of each opt-in pack installed beside the package (D10, WP-7.4: `@m3a/library-cc-by` and
// `@m3a/library-cmu`, the tiers the default CC0 pack leaves out), each pack with its own lock and license texts.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { contentId, Library, type LibraryLock, type LibraryOptions, type LibrarySource, type Tier } from "./load/index.ts";

/** SHA-256 of a text's UTF-8 bytes, in hex. */
export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** The default directory of sets: the package's own (packed), else the repository's. */
export function defaultSets(): string {
  const own = join(import.meta.dirname, "../sets");
  return existsSync(own) ? own : join(import.meta.dirname, "../../../library/sets");
}

/** The opt-in packs (D10, WP-7.4): the tiers that ship apart from the default CC0 pack, each a package of its own that
 *  holds `sets/`, `sets.lock.json` and `LICENSES/` as the default pack does. */
export const PACKS: Readonly<Partial<Record<Tier, string>>> = { "cc-by": "@m3a/library-cc-by", cmu: "@m3a/library-cmu" };

/** The directory of sets of each opt-in pack installed where Node finds packages from `from` (this module by default),
 *  by tier: `npm install @m3a/library-cc-by` beside @m3a/library is how a game gets the cc-by sets. */
export function installedPacks(from: string = import.meta.url): Partial<Record<Tier, string>> {
  const require = createRequire(from), out: Partial<Record<Tier, string>> = {};
  for (const [tier, name] of Object.entries(PACKS) as [Tier, string][]) {
    try {
      out[tier] = join(dirname(require.resolve(`${name}/package.json`)), "sets");
    } catch {
      // not installed
    }
  }
  return out;
}

/** A directory of sets as a library source. */
export function directory(dir: string): LibrarySource {
  return {
    sets: () => readdirSync(dir).filter((s) => statSync(join(dir, s)).isDirectory() && existsSync(join(dir, s, "_set.json"))),
    files: (set) => readdirSync(join(dir, set)),
    read: (set, file) => readFileSync(join(dir, set, file), "utf8"),
  };
}

/** The sets in `dir` and in the opt-in packs' directories `packs` (the installed ones by default) as one source, a set
 *  `dir` holds staying its own; `directory(dir)` itself when no pack is installed. */
export function withPacks(dir: string, packs: readonly string[] = Object.values(installedPacks())): LibrarySource {
  const own = directory(dir);
  if (!packs.length) return own;
  const all = [own, ...packs.map(directory)], home = new Map<string, LibrarySource>();
  const of = (set: string) => home.get(set) ?? home.set(set, all.find((d) => d.sets().includes(set)) ?? own).get(set)!;
  return { sets: () => [...new Set(all.flatMap((d) => d.sets()))], files: (set) => of(set).files(set), read: (set, file) => of(set).read(set, file) };
}

/** The locks beside directories of sets (`sets.lock.json`), merged, the first one's sets and aliases winning; undefined
 *  when none has one. */
function locksOf(dirs: readonly string[]): LibraryLock | undefined {
  const locks = dirs.map((d) => join(dirname(d), "sets.lock.json")).filter((f) => existsSync(f)).map((f) => JSON.parse(readFileSync(f, "utf8")) as LibraryLock);
  if (locks.length < 2) return locks[0];
  return { ...locks[0]!, sets: Object.assign({}, ...locks.toReversed().map((l) => l.sets)), aliases: Object.assign({}, ...locks.toReversed().map((l) => l.aliases ?? {})) };
}

/**
 * Opens the library in `dir` (the default sets) with its lock (`sets.lock.json` beside the sets) and Node's SHA-256:
 * the CC0 default pack unless `tiers` opts in to more (D10). The installed opt-in packs (`packs`, by tier, to name
 * others) join it with their locks; a tier opted in to that no set holds, its pack not installed, is warned of with the
 * install that brings it. Warnings go to stderr unless `warn` takes them. `source` reads the sets from elsewhere (more
 * sets beside dir's: a project's imported ones), the locks still dir's and the packs'.
 */
export function openLibrary(opts: LibraryOptions & { dir?: string; source?: LibrarySource; packs?: Partial<Record<Tier, string>> } = {}): Library {
  const dir = opts.dir ?? defaultSets(), packs = opts.packs ?? installedPacks(), source = opts.source ?? withPacks(dir, Object.values(packs));
  const lock = opts.lock ?? locksOf([dir, ...Object.values(packs)]), warn = opts.warn ?? ((m: string) => void process.stderr.write(`${m}\n`));
  const missing = (opts.tiers ?? []).filter((t) => PACKS[t] && !packs[t]);
  if (missing.length) {
    const held = new Set(source.sets().map((s) => (JSON.parse(source.read(s, "_set.json")) as { tier: Tier }).tier));
    for (const t of missing.filter((x) => !held.has(x))) warn(`library: no ${t} set is installed: the ${t} sets ship apart from the CC0 default pack (D10); npm install ${PACKS[t]}`);
  }
  return new Library(source, { sha256, ...opts, warn, ...(lock ? { lock } : {}) });
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

/** A license's text as the library keeps it (`LICENSES/<id>.txt` beside the sets, or beside an installed opt-in pack's
 *  in `packs`), or null when none keeps it. */
export function licenseText(dir = defaultSets(), packs: readonly string[] = Object.values(installedPacks())): (id: string) => string | null {
  return (id) => {
    const f = [dir, ...packs].map((d) => join(dirname(d), "LICENSES", `${id}.txt`)).find((x) => existsSync(x));
    return /^[\w.+-]+$/.test(id) && f ? readFileSync(f, "utf8") : null;
  };
}
