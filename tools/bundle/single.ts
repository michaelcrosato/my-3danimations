// The single file (PLAN.md WP-7.4; carried from riftlight's scripts/bundle.mjs, which builds one self-contained ES
// module with Vite): m3a.js, for agents that can't install packages. It is @m3a/core, sensors, io, library and tools'
// API as one ES module, every name under its own (VERSION once, PACKAGE m3a.js's own), with the CC0 subset of the
// library that tools/bundle/manifest.json lists (a game manifest: tiers ["cc0"] and its clips), opened by `openLibrary`
// as @m3a/library/node's is (./runtime.ts), and a `host` for the tools. It carries the code's license (MIT), the
// credits block and the license texts of every tier it includes, in its opening comment and as CREDITS and LICENSES.
// three.js and @m3a/three are left out: the file is for agents that can't install packages, who can't install three
// either; what they can use is headless (find, make, check, export, the tools), and bundling three would triple the
// file and put a second copy of three beside a game's own, whose objects fail the other copy's instanceof checks.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build as vite } from "vite";
import { checkGame, contentId, setText, type GameManifest, type LibraryLock } from "../../packages/library/src/index.ts";
import { directory, licenseText, sha256 } from "../../packages/library/src/node.ts";
import { ROOT } from "../run/cli.ts";
import type { BundleData } from "./runtime.ts";

/** The bundle's manifest: the CC0 clips m3a.js carries. */
export const MANIFEST = join(ROOT, "tools/bundle/manifest.json");
/** The entries m3a.js unites, in the order a name exported twice is taken from. */
export const ENTRIES = ["@m3a/core", "@m3a/sensors", "@m3a/io", "@m3a/library", "@m3a/tools"] as const;
/** The names m3a.js defines itself: the library and license texts it carries (standing in for @m3a/library/node's
 *  openLibrary and licenseText), the tools' host, the credits block, the license texts and its own PACKAGE. */
export const OWN = ["openLibrary", "licenseText", "host", "CREDITS", "LICENSES", "PACKAGE"] as const;
/** What an example may import, by module, when it runs on m3a.js: every name of ENTRIES, and these of a Node entry. */
export const STANDS_IN: Readonly<Record<string, readonly string[]>> = { "@m3a/library/node": ["openLibrary", "licenseText"] };

/** The bundle's manifest, read. */
export function readManifest(file = MANIFEST): GameManifest {
  return JSON.parse(readFileSync(file, "utf8")) as GameManifest;
}

/**
 * The subset a manifest lists as m3a.js carries it: per set, its manifest (its content id now that of the clips kept,
 * the whole set's kept beside it in `content.of`), the catalog rows and files of its clips; their lock; the license
 * texts of its sources; the credits block. Refuses a manifest that opts into a tier other than cc0, or fails
 * `npm run license -- check`.
 */
export function bundleData(game: GameManifest, dir = join(ROOT, "library/sets")): BundleData {
  if ((game.tiers ?? ["cc0"]).some((t) => t !== "cc0")) throw new Error(`m3a.js carries CC0 clips alone (D10); the manifest opts into ${game.tiers!.join(", ")}`);
  const src = directory(dir), report = checkGame(src, game, licenseText(dir, []));
  if (!report.ok) throw new Error(`tools/bundle/manifest.json fails the license check: ${report.findings.filter((f) => f.level === "fail").map((f) => `${f.where}: ${f.message}`).join("; ")}`);
  const ids = game.clips ?? src.sets().filter((s) => JSON.parse(src.read(s, "_set.json")).tier === "cc0").flatMap((s) => src.files(s).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => `${s}/${f.slice(0, -5)}`));
  const bySet = new Map<string, Set<string>>();
  for (const id of ids) bySet.set(id.split("/")[0]!, (bySet.get(id.split("/")[0]!) ?? new Set()).add(id));
  const sets: BundleData["sets"] = {}, lock: LibraryLock = { about: "The lock over the clips m3a.js carries (tools/bundle/manifest.json): each set's content id is that of its clips here.", sets: {}, aliases: {} }, licenses: Record<string, string> = {};
  for (const [set, held] of [...bySet].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const texts: Record<string, string> = {}, files: Record<string, string> = {};
    for (const id of [...held].sort()) texts[`${id.split("/")[1]}.json`] = src.read(set, `${id.split("/")[1]}.json`);
    for (const [f, t] of Object.entries(texts)) files[f] = sha256(t);
    const m = JSON.parse(src.read(set, "_set.json")) as { content: { sha256: string }; sources: Record<string, { license: string }> }, content = contentId(files, sha256);
    const all = src.files(set).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length;
    const catalog = src.read(set, "catalog.tsv").split("\n").filter((l) => held.has(l.split("\t")[0]!));
    sets[set] = { "_set.json": setText({ ...m, content: { ...m.content, sha256: content, of: `${held.size} of the set's ${all} clips; the whole set's content id is ${m.content.sha256}` } }), "catalog.tsv": `${catalog.join("\n")}\n`, ...texts };
    lock.sets[set] = { content, files };
    for (const s of Object.values(m.sources)) licenses[s.license] = licenseText(dir, [])(s.license)!;
  }
  return { sets, lock, licenses, credits: report.block };
}

/** The names each entry gives m3a.js, in ENTRIES' order: a name an earlier entry (or m3a.js itself) gives is left
 *  out, VERSION being core's everywhere; any other name two entries give fails the build, naming it. */
export async function namesOf(): Promise<Record<string, string[]>> {
  const taken = new Map<string, string>(OWN.map((n) => [n, "m3a.js"])), out: Record<string, string[]> = {};
  for (const e of ENTRIES) {
    const mod = (await import(e)) as Record<string, unknown>;
    out[e] = [];
    for (const n of Object.keys(mod).sort()) {
      const was = taken.get(n);
      if (was && n !== "VERSION" && n !== "PACKAGE") throw new Error(`m3a.js: ${e} and ${was} both export ${n}; give one of them another name, or take one in tools/bundle/single.ts`);
      if (was) continue;
      taken.set(n, e);
      out[e].push(n);
    }
  }
  return out;
}

/** m3a.js's opening comment: what it is, how to import it, the code's license, the credits block and the license
 *  texts of every tier it includes, verbatim. */
function banner(version: string, data: BundleData): string {
  const clips = Object.values(data.lock.sets).reduce((n, s) => n + Object.keys(s.files).length, 0);
  const texts = [["License of the code: MIT", readFileSync(join(ROOT, "LICENSE"), "utf8")], ...Object.entries(data.licenses).sort().map(([id, t]) => [`License of the clips: ${id} (also export LICENSES)`, t])];
  const text = [
    `/*! m3a.js ${version}: @m3a/core, sensors, io, library and tools' API in one ES module, with ${clips} CC0 clips of the m3a library`,
    `(tools/bundle/manifest.json). Runs in Node and in a browser; three.js and @m3a/three are left out. import { openLibrary, Animator, metrics, tools, host } from "./m3a.js";`,
    "openLibrary() opens the clips carried here; tools.call(name, args, { host }) runs a tool on them. The manual is @m3a/tools' MANUAL.md.",
    "",
    "Credits (also export CREDITS):",
    data.credits,
    "",
    ...texts.flatMap(([what, t]) => [what!, t!.trimEnd(), ""]),
    "*/",
  ].join("\n");
  if (text.slice(3, -2).includes("*/")) throw new Error("m3a.js: a license text holds */, which would end the opening comment");
  return text;
}

/**
 * Builds m3a.js into `out` (out/m3a.js) from the bundle's manifest: the generated entry re-exports every entry's names
 * and m3a.js's own over the subset, Vite bundles it into one ES module (not minified: an agent may read it), and the
 * opening comment goes on top.
 * Returns the file, its size, its clips and its export names.
 */
export async function buildSingle(out: string, game: GameManifest = readManifest()): Promise<{ file: string; bytes: number; clips: number; exports: string[] }> {
  const data = bundleData(game), names = await namesOf(), version = (JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as { version: string }).version;
  // the entry sits in the repository, where its imports resolve to the packages' sources (one per run: runs may overlap)
  const work = join(ROOT, ".cache", `m3a-single-${process.pid}`), entry = join(work, "entry.ts");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  writeFileSync(entry, [
    "// m3a.js's entry, generated by tools/bundle/single.ts: every entry's names, and the library m3a.js carries.",
    `import { bundled } from ${JSON.stringify(join(import.meta.dirname, "runtime.ts"))};`,
    `const data = ${JSON.stringify(data)};`,
    "const lib = bundled(data);",
    "export const openLibrary = lib.openLibrary, licenseText = lib.licenseText, host = lib.host;",
    "export const CREDITS = data.credits, LICENSES = data.licenses, PACKAGE = \"m3a.js\";",
    ...Object.entries(names).map(([e, n]) => `export { ${n.join(", ")} } from ${JSON.stringify(e)};`),
    "",
  ].join("\n"));
  await vite({
    configFile: false,
    root: ROOT,
    cacheDir: join(ROOT, ".cache/vite"),
    logLevel: "warn",
    publicDir: false,
    build: {
      outDir: work,
      emptyOutDir: false,
      minify: false,
      target: "es2023",
      lib: { entry, formats: ["es"], fileName: () => "m3a.js" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const file = join(out, "m3a.js");
  mkdirSync(out, { recursive: true });
  writeFileSync(file, `${banner(version, data)}\n${readFileSync(join(work, "m3a.js"), "utf8")}`);
  rmSync(work, { recursive: true, force: true });
  return { file, bytes: readFileSync(file).length, clips: Object.values(data.lock.sets).reduce((n, s) => n + Object.keys(s.files).length, 0), exports: [...OWN, ...Object.values(names).flat()].sort() };
}
