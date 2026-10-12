// The library loader (PLAN.md WP-5.1): sets and clips by id from any source of files (a directory in Node, a bundle
// in a browser), each set's content id checked against its files (spec/MOTION.md §9.2) and each clip against the lock,
// so a changed file is named. Sets carry a license tier (D10); the default pack is CC0, and a game sees `cc-by`, `cmu`
// or `local` sets only when it opts in. A deprecated id still resolves, with a warning naming its successor.
import { parseClip, type Clip, type Rest } from "@m3a/core";

/** A set's license tier (D10): `cc0` is the default pack; the others need opting in. */
export type Tier = "cc0" | "cc-by" | "cmu" | "local";
/** Every tier, the default pack's first. */
export const TIERS: readonly Tier[] = ["cc0", "cc-by", "cmu", "local"];

/** Where the library's files come from: its set names, a set's file names and a file's text. */
export interface LibrarySource {
  sets(): string[];
  files(set: string): string[];
  read(set: string, file: string): string;
}
/** The lock (`library/sets.lock.json`): each set's content id and each clip file's SHA-256, and deprecated ids. */
export interface LibraryLock {
  about?: string;
  sets: Record<string, { content: string; files: Record<string, string> }>;
  /** A deprecated id and the id that replaces it. */
  aliases?: Record<string, string>;
}
/** How to open the library: the tiers a game opted in to (CC0 alone by default), the lock, a SHA-256, a warning sink. */
export interface LibraryOptions {
  tiers?: readonly Tier[];
  lock?: LibraryLock;
  /** SHA-256 of a text's UTF-8 bytes, in hex: without it, nothing is verified. */
  sha256?: (text: string) => string;
  warn?: (message: string) => void;
}
/** A set as the library lists it. */
export interface SetInfo {
  set: string;
  title: string;
  tier: Tier;
  credit: string;
  clips: number;
}
/** One catalog row (spec/MOTION.md §9.3). */
export interface CatalogRow {
  id: string;
  dur: number;
  loop: boolean;
  /** % of H0 per second, when the clip travels and it was measured. */
  speed: number | null;
  tags: string[];
  desc: string;
  src: string;
}
/** A clip loaded: the clip, the rest it was made on, its set and its tier. */
export interface LoadedClip {
  clip: Clip;
  rest: Rest;
  set: string;
  tier: Tier;
}
/** Why the library refused: no such clip or set, a tier not opted in, or a file that isn't what the lock says. */
export class LibraryError extends Error {
  readonly code: "E_NO_CLIP" | "E_NO_SET" | "E_TIER" | "E_TAMPERED";
  readonly clip: string | undefined;
  constructor(code: LibraryError["code"], message: string, clip?: string) {
    super(message);
    this.name = "LibraryError";
    this.code = code;
    this.clip = clip;
  }
}

interface SetManifest {
  set: string;
  title: string;
  tier: Tier;
  credit: string;
  content: { sha256: string };
  sources: Record<string, { rest: Rest }>;
}

/** The content id of a set's clip files (spec/MOTION.md §9.2): each name, a newline, its SHA-256, a newline, by name. */
export function contentId(files: Record<string, string>, sha256: (text: string) => string): string {
  const names = Object.keys(files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sha256(names.map((n) => `${n}\n${files[n]}\n`).join(""));
}

/** The library: its sets, catalogs and clips, as the tiers a game opted in to let it see. */
export class Library {
  readonly tiers: readonly Tier[];
  #src: LibrarySource;
  #opts: LibraryOptions;
  #manifests = new Map<string, SetManifest>();
  #verified = new Set<string>();

  constructor(source: LibrarySource, opts: LibraryOptions = {}) {
    for (const t of opts.tiers ?? []) if (!(TIERS as readonly string[]).includes(t)) throw new Error(`library: no tier "${t}"; the tiers are ${TIERS.join(", ")}`);
    this.tiers = opts.tiers ?? ["cc0"];
    this.#src = source;
    this.#opts = opts;
  }

  /** The sets the game sees (its tiers'), by name. */
  sets(): SetInfo[] {
    return this.#src.sets().sort().map((s) => this.#manifest(s)).filter((m) => this.tiers.includes(m.tier)).map((m) => ({ set: m.set, title: m.title, tier: m.tier, credit: m.credit, clips: this.#clipFiles(m.set).length }));
  }

  /** The catalog rows of the sets the game sees, or of one of them. */
  catalog(set?: string): CatalogRow[] {
    const names = set ? [this.#visible(set).set] : this.sets().map((s) => s.set);
    return names.flatMap((s) => this.#src.read(s, "catalog.tsv").split("\n").filter((l) => l.trim()).map((line) => {
      const [id, dur, loop, speed, tags, desc, src] = line.split("\t");
      return { id: id!, dur: Number(dur), loop: loop === "loop", speed: speed ? Number(speed) : null, tags: tags ? tags.split(" ") : [], desc: desc ?? "", src: src ?? "" };
    }));
  }

  /** A clip by id ("SET/Name"), with its rest: its set checked first (a deprecated id resolves, with a warning). */
  clip(id: string): LoadedClip {
    const to = this.#opts.lock?.aliases?.[id];
    if (to) {
      this.#opts.warn?.(`library: "${id}" is deprecated; use "${to}"`);
      return this.clip(to);
    }
    const [set, name] = id.split("/");
    if (!set || !name) throw new LibraryError("E_NO_CLIP", `library: "${id}" isn't a clip id; ids are "SET/Name", as the catalog lists them`, id);
    const m = this.#visible(set, id), file = `${name}.json`;
    if (!this.#clipFiles(set).includes(file)) throw new LibraryError("E_NO_CLIP", `library: no clip "${id}"; ${set} has ${this.#clipFiles(set).length} clips (library.catalog("${set}") lists them)`, id);
    this.verify(set);
    const clip = parseClip(this.#src.read(set, file)), source = m.sources[clip.restSrc];
    if (!source) throw new LibraryError("E_NO_CLIP", `library: clip "${id}" names rest "${clip.restSrc}", which ${set}'s manifest doesn't have`, id);
    return { clip, rest: source.rest, set, tier: m.tier };
  }

  /**
   * Checks a set's files (or every visible set's): its content id against its manifest's, and each clip file against
   * the lock. Throws E_TAMPERED naming each file that changed. Without a SHA-256 it checks nothing.
   */
  verify(set?: string): void {
    const sha = this.#opts.sha256;
    if (!sha) return;
    for (const s of set ? [set] : this.sets().map((x) => x.set)) {
      if (this.#verified.has(s)) continue;
      const m = this.#manifest(s), files: Record<string, string> = {};
      for (const f of this.#clipFiles(s)) files[f] = sha(this.#src.read(s, f));
      const locked = this.#opts.lock?.sets[s];
      if (locked) {
        const changed = [...new Set([...Object.keys(files), ...Object.keys(locked.files)])].filter((f) => files[f] !== locked.files[f]).sort();
        if (changed.length) throw new LibraryError("E_TAMPERED", `library: ${s} doesn't match its lock: ${changed.map((f) => `${s}/${f.replace(/\.json$/, "")} ${!(f in files) ? "is missing" : !(f in locked.files) ? "isn't in the lock" : "changed"}`).join("; ")}; restore it, or write the set through @m3a/library's writer and lock it again (npm run library -- lock)`, `${s}/${changed[0]!.replace(/\.json$/, "")}`);
      }
      const id = contentId(files, sha);
      if (id !== m.content.sha256) throw new LibraryError("E_TAMPERED", `library: ${s}'s clip files give content id ${id.slice(0, 12)}…, its manifest says ${m.content.sha256.slice(0, 12)}…; a file changed outside the writer`);
      this.#verified.add(s);
    }
  }

  #manifest(set: string): SetManifest {
    let m = this.#manifests.get(set);
    if (!m) {
      if (!this.#src.sets().includes(set)) throw new LibraryError("E_NO_SET", `library: no set "${set}"; the sets are ${this.#src.sets().sort().join(", ")}`);
      this.#manifests.set(set, (m = JSON.parse(this.#src.read(set, "_set.json")) as SetManifest));
    }
    return m;
  }
  /** A set the game sees, or a refusal saying how to opt in. */
  #visible(set: string, id?: string): SetManifest {
    const m = this.#manifest(set);
    if (!this.tiers.includes(m.tier)) throw new LibraryError("E_TIER", `library: ${id ? `"${id}" is in ${set}, ` : `${set} is `}a ${m.tier} set, and this game sees only ${this.tiers.join(", ")}: opt in with { tiers: [${[...this.tiers, m.tier].map((t) => `"${t}"`).join(", ")}] } (D10; its terms: ${m.credit})`, id);
    return m;
  }
  #clipFiles(set: string): string[] {
    return this.#src.files(set).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();
  }
}
