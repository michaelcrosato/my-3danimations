// The packages built and packed (PLAN.md WP-7.4): each @m3a package's TypeScript stripped to ES modules file by file
// with Node's own type stripping (the sources use erasable syntax only, so dist/x.js keeps src/x.ts's lines and
// columns: a stack trace points at the source line), relative `.ts` imports pointed at `.js`, the declarations from
// `tsc -b` beside them, staged under .cache/pack/stage/ with the package.json it is published with (exports, "types"
// and the m3a bin pointed from the workspace's source files to dist/, "private" kept in the workspace and the default
// staging, `publishable` staging a copy ready to publish: O2 answered, D130) and packed by `npm pack`. Every pack carries the version (one for all,
// tools/version.ts) and the repository's CHANGELOG.md, which has its section, as a consumer reads it (`packedChangelog`:
// without the Repo sections and the lines about the benchmark, whose briefs a fresh agent must not see answered). The
// tools' pack holds the manual and m3a's agentskills.io skill (skills/m3a/, D119). The library's default pack holds the
// CC0 sets alone (its license the code's and theirs); each other tier that ships (cc-by, cmu) is a pack of its own,
// `@m3a/library-<tier>`, found by the library's loader when installed beside it (D10). Nothing here publishes.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join } from "node:path";
import { checkSets, creditsBlock, type LibraryLock, type Tier } from "../../packages/library/src/index.ts";
import { directory, licenseText, PACKS as OPT_IN } from "../../packages/library/src/node.ts";
import { ROOT } from "../run/cli.ts";

/** What a packed text file may not name: the benchmark's graders, known-good solutions and held-out runs (D107). */
export const BENCH_WORDS = /known-good|bench\/graders|held-out|heldout/i;
/**
 * The changelog a pack ships: the repository's, its `### Repo` sections (the benchmark, CI, the repository's tools) left
 * out, and any bullet that names the benchmark (a brief, a grader, a known-good, a held-out run, `bench/`) with its
 * continuation lines; a release heading left with no section keeps its heading.
 */
export function packedChangelog(text: string): string {
  // the text as blocks: a heading or a plain line on its own, a bullet with its continuation lines
  const blocks: string[][] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("  ") && blocks.at(-1)?.[0]!.startsWith("- ")) blocks.at(-1)!.push(line);
    else blocks.push([line]);
  }
  const out: string[] = [];
  let repo = false;
  for (const b of blocks) {
    const head = b[0]!;
    if (head.startsWith("#")) repo = head.trim() === "### Repo";
    if (repo) continue;
    if (head.startsWith("- ") && (BENCH_WORDS.test(b.join(" ")) || /\bbriefs?\b|\bgraders?\b|\bB[1-8]\b|\bbench(mark)?\b|bench\//i.test(b.join(" ")))) continue;
    out.push(...b);
  }
  // a section left empty loses its heading: a `###` line whose next non-blank line is a heading, or none
  const kept = out.filter((line, i) => !line.startsWith("### ") || !/^(#|$)/.test(out.slice(i + 1).find((l) => l.trim()) ?? ""));
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** The packages, in dependency order. */
export const PACKAGES = ["core", "sensors", "io", "library", "three", "tools"] as const;
/** Where `npm run pack` stages and packs. */
export const OUT = join(ROOT, ".cache/pack");
/** The library's sets. */
const SETS = join(ROOT, "library/sets");
/** What @m3a/tools ships beside dist/, by its path in the pack, from the repository's: the manual, and m3a's skill
 *  (agentskills.io's format, WP-7.3), so an installed package holds node_modules/@m3a/tools/skills/m3a/SKILL.md (D119).
 *  Each path's first segment is in the package's "files". */
export const TOOLS_FILES: Readonly<Record<string, string>> = { "MANUAL.md": "packages/tools/MANUAL.md", "skills/m3a": "skills/m3a" };
/** The repository the packs are built from, which npm provenance checks a published pack against. */
export const REPOSITORY = "git+https://github.com/michaelcrosato/my-3danimations.git";

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

/** A source file (`./src/x.ts`, or another directory's, three's `./test-characters/index.ts`) as published under dist/,
 *  its extension dropped. */
const distBase = (v: string) => v.replace(/^\.\/src\//, "./dist/").replace(/^\.\/(?!dist\/)/, "./dist/").replace(/\.ts$/, "");

/** The exports map a package is published with: each source entry pointed at its JavaScript and declarations under
 *  dist/. */
export function publishedExports(map: Record<string, string>): Record<string, { types: string; default: string }> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { types: `${distBase(v)}.d.ts`, default: `${distBase(v)}.js` }]));
}

/** The package.json a package is published with: its own, its exports, "types" and bins pointed from the source files
 *  the workspace runs to dist/ (each bin's JavaScript, shebang kept), "files" with CHANGELOG.md, without devDependencies
 *  or the workspace note ("//"); each peer whose types the package's declarations import (`@types/X` among its
 *  devDependencies, X a peer: three's) an optional peer at that version, so a strict TypeScript consumer knows to
 *  install it. "private" stays: the workspace never publishes (`publishable` drops it in the staged copy alone, which
 *  publish.yml publishes, D130). */
export function publishedManifest(pkg: Record<string, unknown>): Record<string, unknown> {
  const dev = (pkg.devDependencies ?? {}) as Record<string, string>, peers = (pkg.peerDependencies ?? {}) as Record<string, string>;
  const typed = Object.keys(peers).filter((p) => dev[`@types/${p}`]).map((p) => `@types/${p}`);
  const field = (k: string, v: unknown): unknown =>
    k === "exports" ? publishedExports(v as Record<string, string>)
    : k === "types" ? `${distBase(v as string)}.d.ts`
    : k === "bin" ? Object.fromEntries(Object.entries(v as Record<string, string>).map(([n, f]) => [n, `${distBase(f)}.js`]))
    : k === "files" ? [...new Set([...(v as string[]), "CHANGELOG.md"])]
    : v;
  const out = Object.fromEntries(Object.entries(pkg).filter(([k]) => k !== "devDependencies" && k !== "//").map(([k, v]) => [k, field(k, v)]));
  if (typed.length) {
    out.peerDependencies = { ...peers, ...Object.fromEntries(typed.map((t) => [t, dev[t]!])) };
    out.peerDependenciesMeta = { ...(pkg.peerDependenciesMeta as object | undefined), ...Object.fromEntries(typed.map((t) => [t, { optional: true }])) };
  }
  return out;
}

/** A staged package.json made ready to publish (`npm run pack -- --publishable`; publish.yml publishes it, D130;
 *  nothing here publishes): "private" dropped, `publishConfig` public with npm provenance, and the repository with the directory it
 *  is built from (`packages/<name>`, or `library` for an opt-in pack of its sets), which provenance is checked against. */
export function publishable(pkg: Record<string, unknown>, directory: string): Record<string, unknown> {
  const rest = Object.fromEntries(Object.entries(pkg).filter(([k]) => k !== "private"));
  return { ...rest, publishConfig: { access: "public", provenance: true }, repository: { type: "git", url: REPOSITORY, directory } };
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

/** A package's license with the data it ships beside the code (the library's CC0 clips): an SPDX expression, the
 *  code's license AND each data license id. */
export function withDataLicenses(code: string, data: readonly string[]): string {
  return [...new Set([code, ...data])].join(" AND ");
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

/** The package.json a package is staged with (publishedManifest's), the library's license naming its sets' (`sets`,
 *  those its default pack holds) beside the code's. */
export function stagedManifest(name: (typeof PACKAGES)[number], sets: readonly string[]): Record<string, unknown> {
  const out = publishedManifest(JSON.parse(readFileSync(join(ROOT, "packages", name, "package.json"), "utf8")) as Record<string, unknown>);
  if (name === "library") out.license = withDataLicenses(out.license as string, licensesOf(sets));
  return out;
}

/** Stages one package: dist/ (JavaScript and declarations), its staged package.json (`publishable` with `ready`),
 *  the repository's LICENSE and CHANGELOG.md, and what its "files" name beyond dist/ (the library's CC0 sets, the
 *  tools' manual and skill, `TOOLS_FILES`). */
function stagePackage(name: (typeof PACKAGES)[number], dir: string, sets: readonly string[], ready: boolean): void {
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
  if (name === "tools") for (const [to, from] of Object.entries(TOOLS_FILES)) cpSync(join(ROOT, from), join(dir, to), { recursive: true });
  if (existsSync(join(src, "README.md"))) cpSync(join(src, "README.md"), join(dir, "README.md"));
  const published = stagedManifest(name, sets);
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(ready ? publishable(published, `packages/${name}`) : published, null, 2)}\n`);
  cpSync(join(ROOT, "LICENSE"), join(dir, "LICENSE"));
  writeFileSync(join(dir, "CHANGELOG.md"), packedChangelog(readFileSync(join(ROOT, "CHANGELOG.md"), "utf8")));
}

/** Stages an opt-in pack (`@m3a/library-cc-by`, `@m3a/library-cmu`): its tier's sets, their lock and license texts, a
 *  README with how to opt in and the credits a game owes, CHANGELOG.md, and a package.json that needs the library at
 *  this version (`publishable` with `ready`). */
function stageOptIn(name: string, tier: Tier, dir: string, sets: readonly string[], ready: boolean): void {
  const version = (JSON.parse(readFileSync(join(ROOT, "packages/library/package.json"), "utf8")) as { version: string }).version, ids = licensesOf(sets);
  stageSets(dir, sets);
  const credits = creditsBlock(checkSets(directory(SETS), sets, licenseText(SETS, [])).credits);
  writeFileSync(join(dir, "README.md"), [`# ${name}`, "", `The ${tier} sets of the m3a library (${sets.length}: ${sets.join(", ")}), opt-in (D10): the default pack, @m3a/library, holds the CC0 sets alone.`, "", "```sh", `npm install ${name}`, "```", "", `Then opt in: \`openLibrary({ tiers: ["cc0", "${tier}"] })\` from \`@m3a/library/node\`, or \`"tiers": ["cc0", "${tier}"]\` in game.json for the m3a tools. Show the credits where the game credits its assets:`, "", "```", credits, "```", "", `Terms: ${ids.map((l) => `LICENSES/${l}.txt`).join(", ")}.`, ""].join("\n"));
  const license = ids.some((l) => l.startsWith("LicenseRef-")) ? `SEE LICENSE IN ${ids.map((l) => `LICENSES/${l}.txt`).join(", ")}` : ids.join(" AND ");
  const pkg = { name, version, private: true, description: `The ${tier} sets of the m3a library, opt-in (D10): install beside @m3a/library and opt in to "${tier}".`, license, exports: { "./package.json": "./package.json" }, files: ["sets", "sets.lock.json", "LICENSES", "README.md", "CHANGELOG.md"], peerDependencies: { "@m3a/library": version } };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(ready ? publishable(pkg, "library") : pkg, null, 2)}\n`);
  writeFileSync(join(dir, "CHANGELOG.md"), packedChangelog(readFileSync(join(ROOT, "CHANGELOG.md"), "utf8")));
}

/** A package as `npm pack --json` reports it: its tarball's name, its size and its files. */
export type PackReport = { filename: string; size: number; files: { path: string }[] };

/**
 * The one package `npm pack --json` reports, as npm 11 writes it (an array) or npm 12 (an object keyed by the package's
 * name): CI's Node bundles npm 11, a newer npm 12 (WP-F.22). Anything but one package is refused.
 */
export function packReport(json: string): PackReport {
  const parsed = JSON.parse(json) as PackReport[] | Record<string, PackReport>;
  const reports = Array.isArray(parsed) ? parsed : Object.values(parsed);
  if (reports.length !== 1) throw new Error(`npm pack reported ${reports.length} packages, not one`);
  return reports[0]!;
}

/** `npm pack` in a staged directory, into `out`: the tarball, its files and its size. */
function npmPack(stage: string, out: string): Packed {
  const r = packReport(execFileSync("npm", ["pack", "--json", "--pack-destination", out], { cwd: stage, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  return { tarball: join(out, r.filename), files: r.files.map((f) => f.path).sort(), bytes: r.size, stage };
}

/**
 * Builds and packs every package into `out` (after `tsc -b`, which writes the declarations), and with `optIn` (the
 * default) the library's opt-in packs; with `publishable`, each staged package.json is made ready to publish (O2; it is
 * not published). Returns each pack by name (`core` ... `tools`, `library-cc-by`, `library-cmu`).
 */
export function build(out = OUT, opts: { optIn?: boolean; publishable?: boolean } = {}): Record<string, Packed> {
  execFileSync(join(ROOT, "node_modules/.bin/tsc"), ["-b"], { cwd: ROOT, stdio: "inherit" });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const sets = packSets(tiersOf()), packs: Record<string, Packed> = {};
  for (const name of PACKAGES) {
    const stage = join(out, "stage", name);
    stagePackage(name, stage, sets.library!, opts.publishable ?? false);
    packs[name] = npmPack(stage, out);
  }
  if (opts.optIn ?? true) {
    for (const [tier, full] of Object.entries(OPT_IN)) {
      const name = full.replace("@m3a/", ""), stage = join(out, "stage", name);
      stageOptIn(full, tier as Tier, stage, sets[name]!, opts.publishable ?? false);
      packs[name] = npmPack(stage, out);
    }
  }
  return packs;
}
