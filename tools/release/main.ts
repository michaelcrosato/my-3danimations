// `npm run index [-- --check [--since <ref>]] | verify <SET | namespace/SET> <dir> [--v N] [--proof <file>] | verify
// --all | admit <pack.json> <dir> --proof <file>` (PLAN.md WP-9.4): writes library/index.json from library/sets (every
// file as locked), tools/release/registry.json and the index before it (./index.ts); `--check` regenerates it and fails
// unless it is the committed file byte for byte, and with `--since` unless its history stands as committed at that ref
// (a ref git can't read fails the check; one that holds no index yet is the first index's).
// `verify` checks a set's files (a directory, such as an unpacked release asset) against the index: a core set's
// content id and digest, a community pack's content id and its namespace's proof, fetched from the URL the reply names;
// `verify --all` checks every core set's files in library/sets/ so. `admit` adds a community pack to the registry when
// its files and its proof hold, then rewrites the index.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TIERS } from "../../packages/library/src/index.ts";
import { directory, openLibrary, sha256 } from "../../packages/library/src/node.ts";
import { closest, finish, fmtMs, parseArgs, ROOT, usage } from "../run/cli.ts";
import { admit, buildIndex, history, indexText, proofUrl, verifySet, type Candidate, type Registry, type RegistryIndex } from "./index.ts";

/** The index, generated. */
export const INDEX = join(ROOT, "library/index.json");
/** The registry's hand-kept inputs: yanks and admitted community packs. */
export const REGISTRY = join(ROOT, "tools/release/registry.json");

const FLAGS = [
  { name: "check", help: "regenerate the index and fail unless it is library/index.json, byte for byte" },
  { name: "since", takesValue: true, help: "with --check, also fail on history rewritten since the index at this git ref (origin/main)" },
  { name: "v", takesValue: true, help: "verify against this version (the latest by default)" },
  { name: "all", help: "with verify: every core set, its files in library/sets/<SET>" },
  { name: "proof", takesValue: true, help: "a community namespace's proof, as fetched from its proof URL" },
];
const read = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const filesOf = (dir: string) => Object.fromEntries(readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()).sort().map((f) => [f, readFileSync(join(dir, f), "utf8")]));
/** The index committed at git ref `ref` in the repository at `root`: undefined when that commit holds no
 *  library/index.json (the history starts with the first index); throws when git can't resolve the ref or read the
 *  file, or the file isn't JSON, so a history check that can't read its ref fails rather than passes. */
export function atRef(ref: string, root: string = ROOT): RegistryIndex | undefined {
  const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 }), cant = (why: string) => new Error(`--since ${ref}: ${why}, so the index's history can't be checked against it`);
  const commit = git("rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`), at = commit.stdout.trim();
  if (commit.status !== 0 || !at) throw cant(`git can't resolve that ref here (fetch it first: git fetch origin main)`);
  const listed = git("ls-tree", "--name-only", at, "--", "library/index.json");
  if (listed.status !== 0) throw cant(`git ls-tree failed (${listed.stderr.trim().split("\n")[0]})`);
  if (!listed.stdout.trim()) return undefined;
  const shown = git("show", `${at}:library/index.json`);
  if (shown.status !== 0) throw cant(`git show failed (${shown.stderr.trim().split("\n")[0]})`);
  try {
    return JSON.parse(shown.stdout) as RegistryIndex;
  } catch {
    throw cant("its library/index.json isn't JSON");
  }
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), FLAGS);
    const [verb, a, b] = parsed.positionals;
    if (verb && verb !== "verify" && verb !== "admit") throw new Error(`expected verify, admit or nothing, got "${verb}"; did you mean ${closest(verb, ["verify", "admit"])}?`);
    if (parsed.flags.all && (verb !== "verify" || a)) throw new Error("--all is verify's, with no set: npm run index -- verify --all");
    if (verb && !parsed.flags.all && (!a || !b)) throw new Error(`${verb} takes ${verb === "verify" ? "a set (SET or namespace/SET)" : "a pack (.json)"} and the directory of its files`);
    if (parsed.flags.v !== undefined && (verb !== "verify" || parsed.flags.all || !/^[1-9][0-9]*$/.test(String(parsed.flags.v)))) throw new Error("--v is verify's, on one set, and takes a version number (1, 2, ...)");
  } catch (err) {
    usage("index", err, FLAGS);
  }
  const [verb, what, dir] = parsed.positionals, f = parsed.flags, t0 = performance.now(), lib = join(ROOT, "library/sets"), warnings: string[] = [];
  const prev = existsSync(INDEX) ? read<RegistryIndex>(INDEX) : undefined, registry = read<Registry>(REGISTRY), proofText = typeof f.proof === "string" ? readFileSync(f.proof, "utf8") : undefined;
  let detail: string[] = [], summary = "", next = "npm run index -- --check";
  try {
    if (verb === "verify" && f.all) {
      // every core set, as a consumer verifies one: its files against the index's latest version
      const sets = Object.keys(prev?.core ?? {});
      for (const set of sets) detail.push(...verifySet(prev!, set, filesOf(join(lib, set)), sha256).map((p) => `${set}: ${p}`));
      summary = detail.length ? `${detail.length} problem(s) over ${sets.length} core sets` : `every core set's files are the index's (${sets.length} sets)`;
      next = detail.length ? "npm run index writes library/index.json from the library" : "npm run index -- --check";
    } else if (verb === "verify") {
      const core = prev?.core[what!], pack = prev?.community[what!], url = pack ? proofUrl(pack.namespace)! : "", v = typeof f.v === "string" ? Number(f.v) : undefined;
      detail = verifySet(prev ?? { about: "", format: "1", serial: 0, core: {}, community: {} }, what!, filesOf(resolve(dir!)), sha256, { ...(v === undefined ? {} : { v }), ...(proofText === undefined ? {} : { proof: { url, text: proofText } }) });
      const held = (core ?? pack)?.versions ?? [], at = held.find((x) => x.v === (v ?? held.at(-1)?.v)), yanked = core?.yanked ?? at?.yanked;
      if (yanked) warnings.push(`${what} is yanked: ${yanked}`);
      summary = !held.length ? `no ${what} in the index` : !at ? `${what} has no v${v} (versions: ${held.map((x) => x.v).join(", ")})` : detail.length ? `${what} v${at.v}: ${detail.length} problem(s)` : `${what} v${at.v}: its files are the index's (content ${at.content.slice(0, 12)}…)`;
      next = !held.length ? "name a set library/index.json holds" : !at ? `name a version ${what} holds: --v ${held.at(-1)!.v}, or no --v for the latest` : detail.length ? (pack ? `fetch ${what}'s files again and its proof from ${url}` : `fetch ${what} again: its release asset, or library/sets/${what}`) : "use the set";
    } else if (verb === "admit") {
      const c = read<Candidate>(what!), reg = admit(registry, c, filesOf(resolve(dir!)), proofText === undefined ? undefined : { url: proofUrl(c.namespace) ?? "", text: proofText }, sha256);
      const built = buildIndex(directory(lib), sha256, reg, prev);
      writeFileSync(REGISTRY, `${JSON.stringify(reg, null, 1)}\n`);
      writeFileSync(INDEX, indexText(built));
      next = "commit tools/release/registry.json and library/index.json";
      summary = `${c.namespace}/${c.set} admitted as v${reg.community[`${c.namespace}/${c.set}`]!.versions.length}; library/index.json at serial ${built.serial}`;
    } else {
      openLibrary({ dir: lib, tiers: TIERS, warn: () => {} }).verify();
      const built = buildIndex(directory(lib), sha256, registry, prev), text = indexText(built);
      if (f.check) detail = [...history(typeof f.since === "string" ? atRef(f.since) : undefined, built), ...(prev && text === indexText(prev) ? [] : ["library/index.json isn't the index the library gives: npm run index writes it"])];
      else writeFileSync(INDEX, text);
      summary = `${Object.keys(built.core).length} core sets, ${Object.keys(built.community).length} community packs, serial ${built.serial}${f.check ? (detail.length ? "" : ": byte for byte") : ": written to library/index.json"}`;
    }
  } catch (err) {
    detail = [(err as Error).message];
  }
  const ms = performance.now() - t0, ok = detail.length === 0, name = verb ?? (f.check ? "check" : "write");
  finish({ tool: "index", ok, verdict: `index ${name}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps: [{ name, ok, ms, summary, detail }], warnings, ms, next: ok || verb === "verify" ? next : "fix what the refusal names, then rerun (npm run index writes library/index.json)" }, parsed);
}
