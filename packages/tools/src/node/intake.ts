// The review queue's Node side (PLAN.md WP-8.2a): the local intake store's files under .cache/intake/ (one JSON
// record a submission, written atomically, behind a lock file as an edit's are), and the ReviewHost m3a review runs on:
// that store as the owner; the library at every tier from the working directory's library/sets/ when it is the
// repository's checkout (the installed library otherwise, read alone); a clip's review written through @m3a/library's
// writer (each changed clip file and _set.json's content id, catalog.tsv kept, as a review is in no catalog row) with
// the set's entry in library/sets.lock.json; docs/FEEDBACK-LOG.md and docs/REVIEW-PROPOSALS.md; and the clock (the
// wall clock by default; tests give a fixed one). These and the local lane's (./local-lane.ts, under library/local/)
// are the only writes m3a makes outside its write roots.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseClip, type Clip } from "@m3a/core";
import { setFiles, TIERS, type LibraryLock } from "@m3a/library";
import { defaultSets, openLibrary } from "@m3a/library/node";
import { DOCS, IntakeError, localStore, supabaseStore, type IntakeStore, type ReviewHost, type StoreFiles } from "../intake/index.ts";
import { errno, lockAt, under, writeAtomic } from "./files.ts";

/** Where the local intake store keeps its records, under the working directory. */
export const INTAKE_DIR = ".cache/intake";

const RECORD = /^s-[0-9a-f]{16}\.json$/, sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

/** The local store's StoreFiles in directory `dir` (absolute): records named `s-<16 hex>.json`, nothing else read or
 *  written, and `.lock` its lock file. */
export function intakeFiles(dir: string): StoreFiles {
  const at = (name: string) => {
    if (!RECORD.test(name)) throw new IntakeError("E_INPUT", `${JSON.stringify(name)} is no intake record's name`);
    return join(dir, name);
  };
  return {
    read(name) {
      try {
        return readFileSync(at(name), "utf8");
      } catch (err) {
        if (errno(err) === "ENOENT") return null;
        throw err;
      }
    },
    write: (name, text) => writeAtomic(at(name), text),
    list: () => (existsSync(dir) ? readdirSync(dir).filter((n) => RECORD.test(n)) : []),
    lock: () => lockAt(join(dir, ".lock"), `${INTAKE_DIR}/.lock`),
  };
}

/** The contributor `m3a library` submits as (WP-9.1a), with the clock its days are counted by: the hosted store when
 *  `env` links it (M3A_SUPABASE_URL and M3A_SUPABASE_ANON_KEY, and the contributor key M3A_CONTRIBUTOR_KEY its human got by
 *  signing in on the gallery; M3A_CONTRIBUTOR_TOKEN reads its rows), else the local store under .cache/intake/ as
 *  M3A_CONTRIBUTOR, the accountable identity ("local" by default). */
export function nodeContributor(cwd: string, env: NodeJS.ProcessEnv = process.env, today: () => string = () => new Date().toISOString().slice(0, 10)): { store: IntakeStore; today(): string } {
  const url = env.M3A_SUPABASE_URL?.trim(), apikey = env.M3A_SUPABASE_ANON_KEY?.trim(), key = env.M3A_CONTRIBUTOR_KEY?.trim(), token = env.M3A_CONTRIBUTOR_TOKEN?.trim();
  if (url && apikey && key) return { store: supabaseStore({ url, apikey, key, ...(token ? { token } : {}) }), today };
  const dir = under(resolve(cwd), INTAKE_DIR, "keep .cache/intake/ in the working directory");
  return { store: localStore({ files: intakeFiles(dir), role: "contributor", id: env.M3A_CONTRIBUTOR?.trim() || "local", today }), today };
}

/** How the review host is opened: its clock (YYYY-MM-DD) and the reviewer's name. */
export interface ReviewHostOptions {
  today?: () => string;
  by?: string;
}

/** The ReviewHost for the working directory `cwd`. */
export function nodeReviewHost(cwd: string, opts: ReviewHostOptions = {}): ReviewHost {
  const base = resolve(cwd), sets = join(base, "library/sets"), lockPath = join(base, "library/sets.lock.json");
  const checkout = existsSync(sets) && existsSync(lockPath), today = opts.today ?? (() => new Date().toISOString().slice(0, 10)), by = opts.by ?? "owner";
  const store = localStore({ files: intakeFiles(under(base, INTAKE_DIR, "keep .cache/intake/ in the working directory")), role: "owner", id: by, today });
  const library = openLibrary({ dir: checkout ? sets : defaultSets(), tiers: TIERS, packs: {}, warn: () => {} });
  return {
    store, library, checkout, today, by,
    writeClips(set, clips) {
      if (!checkout) throw new IntakeError("E_STORE", "the library here isn't a checkout's library/sets/");
      const dir = under(base, `library/sets/${set}`, "keep the set in library/sets/"), names = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();
      const now = new Map(names.map((f) => [f, readFileSync(join(dir, f), "utf8")])), mine = new Map(clips.map((c) => [`${c.id.slice(set.length + 1)}.json`, c]));
      const all: Clip[] = names.map((f) => mine.get(f) ?? parseClip(now.get(f)!)), manifest = JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as Parameters<typeof setFiles>[0];
      const out = setFiles(manifest, all, { sha256 }), lock = JSON.parse(readFileSync(lockPath, "utf8")) as LibraryLock;
      for (const [f, text] of out) if (f !== "catalog.tsv" && text !== (now.get(f) ?? readFileSync(join(dir, f), "utf8"))) writeAtomic(join(dir, f), text);
      const files = Object.fromEntries(names.map((f) => [f, sha256(out.get(f)!)])), content = (JSON.parse(out.get("_set.json")!) as { content: { sha256: string } }).content.sha256;
      lock.sets[set] = { content, files };
      writeAtomic(lockPath, `${JSON.stringify(lock, null, 1)}\n`);
    },
    doc(path) {
      try {
        return readFileSync(under(base, path, "keep docs/ in the working directory"), "utf8");
      } catch (err) {
        if (errno(err) === "ENOENT") return null;
        throw err;
      }
    },
    writeDoc(path, text) {
      if (!Object.values(DOCS).includes(path)) throw new IntakeError("E_INPUT", `a review writes only ${Object.values(DOCS).join(" and ")}`);
      writeAtomic(under(base, path, "keep docs/ in the working directory"), text);
    },
  };
}
