// The benchmark's packages (PLAN.md §7, WP-4.7), packed as an agent installs them: WP-7.4's packaging
// (tools/bundle/build.ts: ES modules with their declarations, the m3a bin at dist/node.js), into .cache/bench/packs/.
// A trial installs the six @m3a packages, the library as its CC0 default pack; the opt-in packs (cc-by, cmu) aren't
// built here, so no trial sees them.
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { build, PACKAGES } from "../../tools/bundle/build.ts";

const ROOT = join(import.meta.dirname, "../..");
/** The packages a workspace installs, in dependency order. */
export { PACKAGES };
/** Where the tarballs go. */
export const PACKS = join(ROOT, ".cache/bench/packs");

/** Builds and packs every package into `out`; returns each tarball's path by package. */
export function pack(out = PACKS): Record<string, string> {
  const packs = build(out, { optIn: false });
  return Object.fromEntries(PACKAGES.map((p) => [p, packs[p]!.tarball]));
}

/** The packs already built, by package, if every one is there (`m3a-<package>-<version>.tgz`). */
export function packed(out = PACKS): Record<string, string> | null {
  if (!existsSync(out)) return null;
  const files = readdirSync(out).filter((f) => f.endsWith(".tgz"));
  const by = Object.fromEntries(PACKAGES.map((p) => [p, files.find((f) => new RegExp(`^m3a-${p}-\\d`).test(f))]));
  return Object.values(by).every(Boolean) ? Object.fromEntries(Object.entries(by).map(([k, f]) => [k, join(out, f!)])) : null;
}

if (import.meta.main) for (const [k, v] of Object.entries(pack())) console.log(`${k}: ${relative(ROOT, v)}`);
