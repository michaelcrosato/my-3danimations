// The benchmark's packages (PLAN.md §7, WP-4.7): each @m3a package packed as an agent installs it, into
// .cache/bench/packs/. Each package's TypeScript is stripped to JavaScript file by file (the sources use erasable syntax
// only), its relative `.ts` imports pointed at `.js`, its declarations taken from `tsc -b`'s output, and `npm pack`
// run on the result, its exports and its bin pointed at that JavaScript (the sources aren't shipped: a bin at
// ./src/node.ts would dangle, and the skill names `npx m3a` commands). @m3a/library ships the CC0 default pack and its
// lock and licenses; @m3a/tools ships the manual.
// WP-7.4 replaces this with the real packaging.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
/** The packages a workspace installs, in dependency order. */
export const PACKAGES = ["core", "sensors", "io", "library", "three", "tools"] as const;
/** Where the tarballs go. */
export const PACKS = join(ROOT, ".cache/bench/packs");

/** A relative import's `.ts` pointed at `.js` (in code and in declarations). */
export function jsSpecifiers(text: string): string {
  return text.replace(/((?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']+)\.ts(["'])/g, "$1$2.js$3");
}
/** Every file under dir, as paths relative to it. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)).map((x) => join(f, x)) : [f]));
}
/** The package's exports map with each source pointed at its JavaScript (`./src/x.ts` → `./dist/x.js`, any other
 *  directory under dist/ by its name), and at its declarations where tsc wrote them (src/ only). */
function exportsOf(map: Record<string, string>): Record<string, { types?: string; default: string }> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => {
    const fromSrc = v.startsWith("./src/"), base = (fromSrc ? v.replace(/^\.\/src\//, "./dist/") : v.replace(/^\.\//, "./dist/")).replace(/\.ts$/, "");
    return [k, fromSrc ? { types: `${base}.d.ts`, default: `${base}.js` } : { default: `${base}.js` }];
  }));
}

/** The package's bin with each source pointed at its JavaScript, as its exports are (`./src/node.ts` → `./dist/node.js`). */
function binOf(bin: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(bin).map(([k, v]) => [k, exportsOf({ [k]: v })[k]!.default]));
}

/** Packs every package (after `tsc -b`, which writes the declarations); returns each tarball's path by package. */
export function pack(out = PACKS): Record<string, string> {
  execFileSync(join(ROOT, "node_modules/.bin/tsc"), ["-b"], { cwd: ROOT, stdio: "inherit" });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const tarballs: Record<string, string> = {};
  for (const name of PACKAGES) {
    const src = join(ROOT, "packages", name), dir = join(out, "src", name), pkg = JSON.parse(readFileSync(join(src, "package.json"), "utf8"));
    // src/ into dist/, and any other directory an export names (three's test-characters) into dist/<it>/
    const dirs = [...new Set(Object.values(pkg.exports as Record<string, string>).map((v) => v.replace(/^\.\//, "").split("/")[0]!))];
    for (const d of dirs) for (const f of walk(join(src, d)).filter((x) => x.endsWith(".ts"))) {
      const to = join(dir, "dist", d === "src" ? "" : d, f.replace(/\.ts$/, ".js"));
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, jsSpecifiers(stripTypeScriptTypes(readFileSync(join(src, d, f), "utf8"), { mode: "strip" })));
    }
    for (const f of walk(join(src, "dist/types")).filter((x) => x.endsWith(".d.ts"))) {
      const to = join(dir, "dist", f);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, jsSpecifiers(readFileSync(join(src, "dist/types", f), "utf8")));
    }
    const files = ["dist"];
    if (name === "library") {
      // the default pack: the CC0 sets, the lock (narrowed to them) and the licenses
      const lock = JSON.parse(readFileSync(join(ROOT, "library/sets.lock.json"), "utf8"));
      for (const set of readdirSync(join(ROOT, "library/sets"))) {
        const m = JSON.parse(readFileSync(join(ROOT, "library/sets", set, "_set.json"), "utf8"));
        if (m.tier === "cc0") cpSync(join(ROOT, "library/sets", set), join(dir, "sets", set), { recursive: true });
        else delete lock.sets[set];
      }
      writeFileSync(join(dir, "sets.lock.json"), `${JSON.stringify(lock, null, 1)}\n`);
      cpSync(join(ROOT, "library/LICENSES"), join(dir, "LICENSES"), { recursive: true });
      files.push("sets", "sets.lock.json", "LICENSES");
    }
    if (name === "tools") {
      cpSync(join(src, "MANUAL.md"), join(dir, "MANUAL.md"));
      files.push("MANUAL.md");
    }
    const { private: _private, devDependencies: _dev, ...rest } = pkg;
    writeFileSync(join(dir, "package.json"), `${JSON.stringify({ ...rest, exports: exportsOf(pkg.exports), ...(pkg.bin ? { bin: binOf(pkg.bin) } : {}), files }, null, 2)}\n`);
    cpSync(join(ROOT, "LICENSE"), join(dir, "LICENSE"));
    const file = execFileSync("npm", ["pack", "--pack-destination", out, "--silent"], { cwd: dir, encoding: "utf8" }).trim().split("\n").pop()!;
    tarballs[name] = join(out, file);
  }
  return tarballs;
}

/** The packs already built, by package, if every one is there. */
export function packed(out = PACKS): Record<string, string> | null {
  if (!existsSync(out)) return null;
  const files = readdirSync(out).filter((f) => f.endsWith(".tgz"));
  const by = Object.fromEntries(PACKAGES.map((p) => [p, files.find((f) => f.startsWith(`m3a-${p}-`))]));
  return Object.values(by).every(Boolean) ? Object.fromEntries(Object.entries(by).map(([k, f]) => [k, join(out, f!)])) : null;
}

if (import.meta.main) {
  const t = pack();
  for (const [k, v] of Object.entries(t)) console.log(`${k}: ${relative(ROOT, v)} (${(statSync(v).size / 1024).toFixed(0)} KB)`);
}
