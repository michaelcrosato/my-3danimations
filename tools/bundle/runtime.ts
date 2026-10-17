// The single file's library (PLAN.md WP-7.4), bundled into m3a.js: the CC0 subset m3a.js carries as text (each set's
// manifest, catalog and clip files, their lock, the license texts of its tier, the credits block) opened as
// @m3a/library/node's openLibrary opens a directory: the same Library, verified with core's portable SHA-256 (the
// same content ids a recipe compiled on it records as on the packages), and a host for the tools that serves it
// (`tools.call("search", { query }, { host })`). No file system and no Node built-in: m3a.js runs in a browser too.
import { recipe } from "@m3a/core";
import { Library, type LibraryLock, type LibraryOptions, type LibrarySource, type Tier } from "@m3a/library";
import type { registry } from "@m3a/tools";

/** What m3a.js carries: each set's files by name, the lock over them, the license texts by SPDX id, the credits block. */
export interface BundleData {
  sets: Record<string, Record<string, string>>;
  lock: LibraryLock;
  licenses: Record<string, string>;
  credits: string;
}

/** The single file's library over `data`: `openLibrary` (CC0 alone by default, as the packages'), `licenseText`, the
 *  tools' `host` (the library at a call's tiers; no files: a tool that reads one refuses with E_HOST) and the source. */
export function bundled(data: BundleData): { openLibrary: (opts?: LibraryOptions) => Library; licenseText: (id: string) => string | null; host: registry.Host; source: LibrarySource } {
  const source: LibrarySource = {
    sets: () => Object.keys(data.sets),
    files: (set) => Object.keys(data.sets[set] ?? {}),
    read: (set, file) => {
      const text = data.sets[set]?.[file];
      if (text === undefined) throw new Error(`m3a.js: no file ${set}/${file} in the bundle`);
      return text;
    },
  };
  const held = new Set(Object.values(data.sets).map((s) => (JSON.parse(s["_set.json"]!) as { tier: Tier }).tier));
  const licenseText = (id: string): string | null => data.licenses[id] ?? null;
  const openLibrary = (opts: LibraryOptions = {}): Library => {
    const warn = opts.warn ?? ((m: string) => console.warn(m));
    for (const t of (opts.tiers ?? []).filter((x) => !held.has(x))) warn(`m3a.js carries CC0 clips alone (tools/bundle/manifest.json), no ${t} set: ${t === "local" ? "local sets never ship (D10)" : `the packages carry them (npm install @m3a/library @m3a/library-${t})`}`);
    return new Library(source, { sha256: recipe.sha256, lock: data.lock, ...opts, warn });
  };
  // one library per set of tiers, verified once; what opening it warned (a tier m3a.js doesn't carry) goes to every
  // call it serves, and a call's own warnings (a deprecated id) to that call
  const opened = new Map<string, { lib: Library; built: string[]; to: string[] }>();
  const host: registry.Host = {
    library(tiers) {
      const want = [...(tiers ?? ["cc0"])], key = want.join(",");
      let o = opened.get(key);
      if (!o) {
        const built: string[] = [], box = { lib: null as unknown as Library, built, to: built };
        box.lib = openLibrary({ tiers: want, warn: (m) => box.to.push(m) });
        opened.set(key, (o = box));
      }
      const warnings = [...o.built];
      o.to = warnings;
      return { library: o.lib, source, licenseText, tiers: want, warnings };
    },
  };
  return { openLibrary, licenseText, host, source };
}
