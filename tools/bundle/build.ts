// The packages built and packed (PLAN.md WP-7.4): each @m3a package's TypeScript stripped to ES modules file by file
// with Node's own type stripping (the sources use erasable syntax only, so dist/x.js keeps src/x.ts's lines and
// columns: a stack trace points at the source line), relative `.ts` imports pointed at `.js`, the declarations from
// `tsc -b` beside them, staged under .cache/pack/stage/ with the package.json it is published with (exports to dist/,
// "private" kept until O2 is answered) and packed by `npm pack`. The library's default pack holds the CC0 sets alone;
// each other tier that ships (cc-by, cmu) is a pack of its own, `@m3a/library-<tier>`, found by the library's loader
// when installed beside it (D10). Nothing here publishes.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { checkSets, creditsBlock, type LibraryLock, type Tier } from "../../packages/library/src/index.ts";
import { directory, licenseText, PACKS as OPT_IN } from "../../packages/library/src/node.ts";
import { ROOT } from "../run/cli.ts";

/** The packages, in dependency order. */
export const PACKAGES = ["core", "sensors", "io", "library", "three", "tools"] as const;
/** Where `npm run pack` stages and packs. */
export const OUT = join(ROOT, ".cache/pack");
/** The library's sets. */
const SETS = join(ROOT, "library/sets");

/** A package packed: its tarball, the files in it (as `npm pack` lists them), its size and where it was staged. */
export interface Packed {
  tarball: string;
  files: string[];
  bytes: number;
  stage: string;
}

/** A relative import's `.ts` pointed at `.js` (in code and in declarations). */
export function jsSpecifiers(text: string): string {
  return text.replace(/((?:from|import)\s*\(?\s*["'])(\.{1,2}\/[^"']+)\.ts(["'])/g, "$1$2.js$3");
}

/** Every file under dir, as paths relative to it. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)).map((x) => join(f, x)) : [f]));
}

/** The exports map a package is published with: each source entry (`./src/x.ts`, or another directory's, three's
 *  `./test-characters/index.ts`) pointed at its JavaScript and declarations under dist/. */
export function publishedExports(map: Record<string, string>): Record<string, { types: string; default: string }> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => {
    const base = v.replace(/^\.\/src\//, "./dist/").replace(/^\.\/(?!dist\/)/, "./dist/").replace(/\.ts$/, "");
    return [k, { types: `${base}.d.ts`, default: `${base}.js` }];
  }));
}

/** The package.json a package is published with: its own, exports pointed at dist/, without devDependencies or the
 *  workspace note ("//"). "private" stays: publishing waits for O2 (PLAN.md §13). */
export function publishedManifest(pkg: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(pkg).filter(([k]) => k !== "devDependencies" && k !== "//").map(([k, v]) => [k, k === "exports" ? publishedExports(v as Record<string, string>) : v]));
}

/** Each set's tier, from its manifest. */
export function tiersOf(dir = SETS): Record<string, Tier> {
  return Object.fromEntries(directory(dir).sets().sort().map((s) => [s, (JSON.parse(readFileSync(join(dir, s, "_set.json"), "utf8")) as { tier: Tier }).tier]));
}

/** The sets each library pack holds (D10): the default @m3a/library the cc0 ones, each opt-in pack its tier's; a
 *  `local` set none, since local content never ships. */
export function packSets(tiers: Record<string, Tier>): Record<string, string[]> {
  const of = (t: Tier) => Object.keys(tiers).filter((s) => tiers[s] === t);
  return { library: of("cc0"), ...Object.fromEntries(Object.entries(OPT_IN).map(([t, name]) => [name.replace("@m3a/", ""), of(t as Tier)])) };
}

/** The license ids the sets' sources carry, sorted. */
function licensesOf(sets: readonly string[]): string[] {
  return [...new Set(sets.flatMap((s) => Object.values((JSON.parse(readFileSync(join(SETS, s, "_set.json"), "utf8")) as { sources: Record<string, { license: string }> }).sources).map((x) => x.license)))].sort();
}

/** Copies sets into a pack, with the lock narrowed to them (aliases to them kept) and their license texts. */
function stageSets(dir: string, sets: readonly string[]): void {
  const lock = JSON.parse(readFileSync(join(ROOT, "library/sets.lock.json"), "utf8")) as LibraryLock, held = new Set(sets);
  for (const s of sets) cpSync(join(SETS, s), join(dir, "sets", s), { recursive: true });
  const aliases = Object.fromEntries(Object.entries(lock.aliases ?? {}).filter(([, to]) => held.has(to.split("/")[0]!)));
  writeFileSync(join(dir, "sets.lock.json"), `${JSON.stringify({ ...lock, sets: Object.fromEntries(sets.map((s) => [s, lock.sets[s]!])), aliases }, null, 1)}\n`);
  mkdirSync(join(dir, "LICENSES"), { recursive: true });
  for (const l of licensesOf(sets)) cpSync(join(ROOT, "library/LICENSES", `${l}.txt`), join(dir, "LICENSES", `${l}.txt`));
}

/** Stages one package: dist/ (JavaScript and declarations), its published package.json, the repository's LICENSE and
 *  what its "files" name beyond dist/ (the library's CC0 sets, the tools' manual). */
function stagePackage(name: (typeof PACKAGES)[number], dir: string, sets: readonly string[]): void {
  const src = join(ROOT, "packages", name), pkg = JSON.parse(readFileSync(join(src, "package.json"), "utf8")) as Record<string, unknown>;
  const exports = pkg.exports as Record<string, string>;
  // src/ into dist/, and any other directory an export names (three's test-characters) into dist/<it>/
  for (const d of [...new Set(Object.values(exports).map((v) => v.replace(/^\.\//, "").split("/")[0]!))]) {
    for (const f of walk(join(src, d)).filter((x) => x.endsWith(".ts"))) {
      const to = join(dir, "dist", d === "src" ? "" : d, f.replace(/\.ts$/, ".js"));
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, jsSpecifiers(stripTypeScriptTypes(readFileSync(join(src, d, f), "utf8"), { mode: "strip" })));
    }
    // declarations: the package's project writes src/'s into dist/types/; the tests' project the other directories'
    const types = d === "src" ? join(src, "dist/types") : join(ROOT, ".cache/tsc/tests/packages", name, d);
    for (const f of walk(types).filter((x) => x.endsWith(".d.ts"))) {
      const to = join(dir, "dist", d === "src" ? "" : d, f);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, jsSpecifiers(readFileSync(join(types, f), "utf8")));
    }
  }
  if (name === "library") stageSets(dir, sets);
  if (name === "tools") cpSync(join(src, "MANUAL.md"), join(dir, "MANUAL.md"));
  if (existsSync(join(src, "README.md"))) cpSync(join(src, "README.md"), join(dir, "README.md"));
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(publishedManifest(pkg), null, 2)}\n`);
  cpSync(join(ROOT, "LICENSE"), join(dir, "LICENSE"));
}

/** Stages an opt-in pack (`@m3a/library-cc-by`, `@m3a/library-cmu`): its tier's sets, their lock and license texts, a
 *  README with how to opt in and the credits a game owes, and a package.json that needs the library at this version. */
function stageOptIn(name: string, tier: Tier, dir: string, sets: readonly string[]): void {
  const version = (JSON.parse(readFileSync(join(ROOT, "packages/library/package.json"), "utf8")) as { version: string }).version, ids = licensesOf(sets);
  stageSets(dir, sets);
  const credits = creditsBlock(checkSets(directory(SETS), sets, licenseText(SETS, [])).credits);
  writeFileSync(join(dir, "README.md"), [`# ${name}`, "", `The ${tier} sets of the m3a library (${sets.length}: ${sets.join(", ")}), opt-in (D10): the default pack, @m3a/library, holds the CC0 sets alone.`, "", "```sh", `npm install ${name}`, "```", "", `Then opt in: \`openLibrary({ tiers: ["cc0", "${tier}"] })\` from \`@m3a/library/node\`, or \`"tiers": ["cc0", "${tier}"]\` in game.json for the m3a tools. Show the credits where the game credits its assets:`, "", "```", credits, "```", "", `Terms: ${ids.map((l) => `LICENSES/${l}.txt`).join(", ")}.`, ""].join("\n"));
  const license = ids.some((l) => l.startsWith("LicenseRef-")) ? `SEE LICENSE IN ${ids.map((l) => `LICENSES/${l}.txt`).join(", ")}` : ids.join(" AND ");
  const pkg = { name, version, private: true, description: `The ${tier} sets of the m3a library, opt-in (D10): install beside @m3a/library and opt in to "${tier}".`, license, exports: { "./package.json": "./package.json" }, files: ["sets", "sets.lock.json", "LICENSES", "README.md"], peerDependencies: { "@m3a/library": version } };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

/** `npm pack` in a staged directory, into `out`: the tarball, its files and its size. */
function npmPack(stage: string, out: string): Packed {
  const [r] = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", out], { cwd: stage, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })) as { filename: string; size: number; files: { path: string }[] }[];
  return { tarball: join(out, r!.filename), files: r!.files.map((f) => f.path).sort(), bytes: r!.size, stage };
}

/**
 * Builds and packs every package into `out` (after `tsc -b`, which writes the declarations), and with `optIn` (the
 * default) the library's opt-in packs; returns each pack by name (`core` ... `tools`, `library-cc-by`, `library-cmu`).
 */
export function build(out = OUT, opts: { optIn?: boolean } = {}): Record<string, Packed> {
  execFileSync(join(ROOT, "node_modules/.bin/tsc"), ["-b"], { cwd: ROOT, stdio: "inherit" });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const sets = packSets(tiersOf()), packs: Record<string, Packed> = {};
  for (const name of PACKAGES) {
    const stage = join(out, "stage", name);
    stagePackage(name, stage, sets.library!);
    packs[name] = npmPack(stage, out);
  }
  if (opts.optIn ?? true) {
    for (const [tier, full] of Object.entries(OPT_IN)) {
      const name = full.replace("@m3a/", ""), stage = join(out, "stage", name);
      stageOptIn(full, tier as Tier, stage, sets[name]!);
      packs[name] = npmPack(stage, out);
    }
  }
  return packs;
}
