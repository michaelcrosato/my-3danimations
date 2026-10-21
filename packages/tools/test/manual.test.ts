// The manual runs (PLAN.md WP-7.3, DOCTRINE.md "the manual's examples run and fit its budget"): every fenced block of
// packages/tools/MANUAL.md is run or checked, and a block that must not run says so in its info string (`norun`),
// counted here and kept to NORUN. Its json blocks parse; one named as a file (```json knight.json) is written into a
// scratch working directory, and each is checked as what it is: a recipe, graph, action or simulation script against
// its schema in spec/schemas/ and core's (or sim's) own check, game.json through the tools' reader (its tiers),
// .mcp.json as the installed package's `npx m3a mcp` (the bin its files carry); the import catalog by the import its
// sh block runs, and found in what that wrote (import passes over a "$" key or a source's field it doesn't read: its
// sources' records, its clips' tags and words). Its ts blocks run, in order, as one Node program in that directory
// (their imports merged at the top, each block in a scope of its own but the complete example's, whose names the later
// blocks use: `library`, `clips`, `bound`, `player`, ...), and the same program without the test's checks type-checks
// under the repository's strict options (an option misspelled runs, ignored, but doesn't compile). The example's
// outcome is checked (one hit, its damage, the states it went through, the distance walked; its game loop's frames and
// its simulation measured by the sensors, nothing failing: a parameter snapped pops the body). What the blocks
// document is held as they run: a line reading a member alone (`a.layers;`) must not read undefined, and the fields its
// comment lists (`// bottom first: { name, clip, ... }`, on a declaration's value too) must be on the value (an array's
// first element), as must the quoted values it gives (`// "local"`). Its sh blocks' lines are m3a calls, run meanwhile
// in that directory through the m3a command in process, each to exit 0; a ts block below an sh block waits for it (the
// program reads a line on stdin per sh block run). A hit event a recipe adds sits at its clip's measured strike. The
// directory holds what the manual says a game has: character.glb (a generated test character), mocap.gltf (tier 1b's
// rig and its three animations). And the manual's tool list is the registry's (tools/manual/toollist.ts), its clip ids
// are the library's, each name it gives with its entry ("`LibraryError` (from `@m3a/library`)") is that entry's export
// and the MCP command its prose gives (`npx m3a mcp`) the installed package's bin, as a .mcp.json block's is; the tools
// it names are tools and its prose's calls parse as the m3a command parses them (each giving its tool's required
// arguments), its masks name core's groups and fields, and neither it nor a tool's example (which `m3a help` and MCP
// show a trial agent) names a clip a bench known-good picks for its job (D77; B1's and B7's loops aside). Its token
// budget is `npm run doctrine`'s.
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, it } from "vitest";
import { actions, graph, ops, recipe } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { character, variant } from "@m3a/three/test-characters";
import { publishedManifest } from "../../../tools/bundle/build.ts";
import { BEGIN, END, withToolList } from "../../../tools/manual/toollist.ts";
import { parseCall, runCli } from "../src/cli.ts";
import { nodeHost } from "../src/node.ts";
import { gameTiers } from "../src/node/library.ts";
import { fileStore } from "../src/node/store.ts";
import { Registry } from "../src/registry/registry.ts";
import { validateScript } from "../src/sim/script.ts";
import { TOOLS } from "../src/tools/index.ts";
import { ROOT, words } from "./helpers/surfaces.ts";

const TEXT = readFileSync(join(ROOT, "packages/tools/MANUAL.md"), "utf8");
/** Blocks marked `norun`: none today; one more needs a reason here. */
const NORUN = 0;
/** The section whose ts blocks run at the top level, their names visible to every later block. */
const EXAMPLE = /^## A complete example/;

/** A fenced block: its language, the rest of its info string (a file name, `norun`), its code, line and section. */
interface Block {
  lang: string;
  info: string[];
  code: string;
  line: number;
  section: string;
}

/** The manual's fenced blocks, in order. */
function blocksOf(md: string): Block[] {
  const out: Block[] = [], lines = md.split("\n");
  let section = "", open: Block | null = null;
  lines.forEach((l, i) => {
    if (open) {
      if (!l.startsWith("```")) open.code += `${l}\n`;
      else {
        out.push(open);
        open = null;
      }
    } else if (l.startsWith("## ")) section = l;
    else if (l.startsWith("```")) {
      const [lang = "", ...info] = l.slice(3).trim().split(/\s+/);
      open = { lang, info, code: "", line: i + 1, section };
    }
  });
  if (open) throw new Error(`MANUAL.md:${(open as Block).line}: a block left open`);
  return out;
}

const BLOCKS = blocksOf(TEXT), RUN = BLOCKS.filter((b) => !b.info.includes("norun"));
const where = (b: Block) => `MANUAL.md:${b.line} (${b.lang} ${b.info.join(" ")})`;
const file = (b: Block) => b.info.find((x) => x !== "norun");

/** The scratch working directory: the named json blocks, a character, a motion file, and the repository's packages. */
const CWD = mkdtempSync(join(tmpdir(), "m3a-manual-"));
afterAll(() => rmSync(CWD, { recursive: true, force: true }));
symlinkSync(join(ROOT, "node_modules"), join(CWD, "node_modules"), "dir");
writeFileSync(join(CWD, "character.glb"), character(variant(1)).glb);
cpSync(join(ROOT, "spec/vectors/tier1b/rig.gltf"), join(CWD, "mocap.gltf"));
for (const b of RUN) if (b.lang === "json" && file(b)) writeFileSync(join(CWD, file(b)!), b.code);

/** Whether a text names a clip id whole (`SET/Walk` not inside `SET/Walk_Fast`). */
const mentions = (text: string, id: string) => new RegExp(`(?<![\\w/])${id}(?!\\w)`).test(text);

/** The bench jobs whose known-goods (bench/graders/<B>/known-good) the manual and the tools' examples keep clear of. */
const BRIEFS = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"];

/**
 * The library clips bench/graders' known-good solutions pick for their jobs (B2's punch, B3's reactions, B4's sneak,
 * B5's emote, B6's punch, B7's jump start and landing), which neither the manual nor a tool's example (`m3a help
 * <tool>`, MCP's tools/list, both in a trial) may name: they would hand a fresh agent the answer (D77). An id counts
 * written whole or as its set and its name apart (`${SET}/${id}` with "Hit_Head"). Only the loops B1 and B7 are built
 * from (their catalog rows' `loop`: the idle, walk, run and air loops) are left out: any search finds them, and those
 * jobs' answers are their wiring.
 */
function benchAnswers(rows: readonly { id: string; loop: boolean }[]): Set<string> {
  const picked = (brief: string) => {
    const dir = join(ROOT, "bench/graders", brief, "known-good");
    const text = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile()).map((f) => readFileSync(join(f.parentPath, f.name), "utf8")).join("\n");
    return rows.filter(({ id }) => {
      const [set, name] = id.split("/") as [string, string];
      return mentions(text, id) || (text.includes(`${set}/`) && [`"${name}"`, `'${name}'`].some((q) => text.includes(q)));
    });
  };
  const loops = new Set(["B1", "B7"].flatMap(picked).filter((r) => r.loop).map((r) => r.id));
  return new Set(BRIEFS.flatMap(picked).map((r) => r.id).filter((id) => !loops.has(id)));
}

/** An inline call's arguments as a shell splits them, a `<placeholder>` one word (`--license <SPDX id>`). */
function spanWords(text: string): string[] {
  return [...text.matchAll(/'([^']*)'|"([^"]*)"|(<[^>]*>)|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]!);
}

/** Why an MCP config's server isn't the installed `m3a mcp` ("" when it is): `npx` with @m3a/tools's bin name and
 *  `mcp`, and that bin's file in what the package ships (its "files"), read from the package as it is published
 *  (WP-7.4's publishedManifest: the workspace's bin runs the source, the published one dist/). */
function mcpLaunch(server: { command: string; args: string[] }): string {
  const pkg = publishedManifest(JSON.parse(readFileSync(join(ROOT, "packages/tools/package.json"), "utf8")) as Record<string, unknown>) as { bin?: Record<string, string>; files?: string[] };
  const [name, file] = Object.entries(pkg.bin ?? {})[0] ?? [];
  if (!name || !file) return "@m3a/tools has no bin";
  const top = file.replace(/^\.\//, "").split("/")[0]!;
  if (!(pkg.files ?? []).includes(top)) return `the bin ${file} isn't in @m3a/tools's files (${(pkg.files ?? []).join(", ")})`;
  const want = ["npx", [name, "mcp"]];
  return JSON.stringify([server.command, server.args]) === JSON.stringify(want) ? "" : `runs ${JSON.stringify([server.command, server.args])}, not ${JSON.stringify(want)}`;
}

/** A shell line without its comment (a `#` after a space, outside quotes). */
function uncommented(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) q = ch === q ? null : q;
    else if (ch === "'" || ch === '"') q = ch;
    else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]!))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

/** A ts line's code and its trailing `//` comment (null without one), a `//` inside a string left in the code. */
function splitComment(line: string): [string, string | null] {
  let q: string | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === "\\") i++;
      else if (ch === q) q = null;
    } else if (ch === '"' || ch === "'" || ch === "`") q = ch;
    else if (ch === "/" && line[i + 1] === "/") return [line.slice(0, i).trimEnd(), line.slice(i + 2)];
  }
  return [line.trimEnd(), null];
}

/** The fields a comment documents, `{ a, b: [{ c }], d (a note) }`: each key, with the shape of its value (or of its
 *  first element) when it lists one. */
type Shape = { [key: string]: Shape | null };

/** The shape a comment opens with, `{ ... }` alone or after a label (`ranked: { ... }`), or null without one (a brace
 *  later in it is prose: `bind(scene, { mapping })`); throws on a field that isn't a name. */
function shapeOf(text: string, at: string): Shape | null {
  const a = /^\s*(?:[^{}:"]*:\s*)?\{/.exec(text)?.[0].length ?? 0;
  if (!a) return null;
  return fieldsOf(text, a - 1, at);
}

/** The fields of the braces opening at `a`. */
function fieldsOf(text: string, a: number, at: string): Shape {
  const parts: string[] = [];
  let depth = 0, from = a + 1;
  for (let i = a; i < text.length; i++) {
    const ch = text[i]!;
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    if ((ch === "," && depth === 1) || depth === 0) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
    if (depth === 0) break;
  }
  if (depth) throw new Error(`${at}: a "{" left open in the comment`);
  const shape: Shape = {};
  for (const p of parts) {
    const key = /^\s*([A-Za-z_$][\w$]*)/.exec(p)?.[1];
    if (!key) throw new Error(`${at}: "${p.trim()}" in the comment's { ... } isn't a field name`);
    shape[key] = /^\s*[\w$]+\s*:\s*\[?\s*\{/.test(p) ? fieldsOf(p, p.indexOf("{"), at) : null;
  }
  return shape;
}

/** What a comment says of the value its line reads: its fields (`{ ... }`) and, for a comment opening with quoted
 *  strings (`"pass" | "warn"`), the values it may have. Null when it says neither. */
function said(comment: string | null, at: string): { shape: Shape | null; oneOf: string[] | null } | null {
  if (comment === null) return null;
  const quoted = /^\s*("[^"]*"(?:\s*\|\s*"[^"]*")*)/.exec(comment)?.[1];
  const shape = shapeOf(comment, at), oneOf = quoted ? quoted.split("|").map((s) => JSON.parse(s.trim()) as string) : null;
  return shape || oneOf ? { shape, oneOf } : null;
}

/** A call's arguments, parentheses nested three deep. */
const ARGS = String.raw`\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)`;
/** A member chain: a name, then `.x`, `(args)` or `!` in any order. */
const CHAIN = String.raw`[A-Za-z_$][\w$]*(?:\.[\w$]+|${ARGS}|!)*`;
/** A statement that is a chain alone (`bound.report.text;`), or a declaration (`const hits = ...rows;`). */
const BARE = new RegExp(String.raw`^(\s*)(${CHAIN});$`), DECL = /^(\s*)(const|let) ([A-Za-z_$][\w$]*) = (.+);$/;
/** The chain ends in a member read, whose value the manual documents and which must therefore be there. */
const READ = new RegExp(String.raw`^${CHAIN}$`), MEMBER = /\.[\w$]+$/;

/** A ts block's code with each documented read checked as the program runs (`__see`, below): a statement reading a
 *  member alone (`a.layers;`) is refused undefined, and the fields or values its comment (or, after a declaration, the
 *  next line's comment) lists are checked on the value (an array's first element). Returns the code and the checks. */
function checked(b: Block): { code: string; checks: number } {
  let checks = 0, last: string | null = null;
  const see = (expr: string, at: string, defined: boolean, s: ReturnType<typeof said>) => {
    checks++;
    return `__see((${expr}), ${JSON.stringify(at)}, ${JSON.stringify(expr)}, ${defined}, ${JSON.stringify(s?.shape ?? null)}, ${JSON.stringify(s?.oneOf ?? null)});`;
  };
  const code = b.code.split("\n").map((line, i) => {
    const at = `MANUAL.md:${b.line + 1 + i}`, [text, comment] = splitComment(line), tail = comment === null ? "" : ` //${comment}`, s = said(comment, at);
    const bare = BARE.exec(text), decl = DECL.exec(text), prev = last;
    last = decl ? decl[3]! : text.trim() === "" && comment !== null ? last : null;
    if (bare && (MEMBER.test(bare[2]!) || s)) return `${bare[1]}${see(bare[2]!, at, MEMBER.test(bare[2]!), s)}${tail}`;
    const read = decl !== null && READ.test(decl[4]!) && MEMBER.test(decl[4]!);
    if (decl && (read || s)) return `${decl[1]}${decl[2]} ${decl[3]} = ${decl[4]}; ${see(decl[3]!, at, read, s)}${tail}`;
    if (text.trim() === "" && s && prev) return `${line.slice(0, line.indexOf("//"))}${see(prev, at, false, s)}${tail}`;
    return line;
  });
  return { code: code.join("\n"), checks };
}

/** The program's helpers: `__see` checks a documented read (counted in `__seen`), and `__sh(n)` waits until the
 *  test has run the manual's first n sh blocks (it writes a line to stdin after each, and ends stdin after the last). */
const PRELUDE = `const __seen = { reads: 0, shapes: 0, empty: 0 };
function __shape(v, shape, at, path) {
  if (Array.isArray(v)) { if (!v.length) { __seen.empty++; return; } v = v[0]; path += "[0]"; }
  if (v === null || (typeof v !== "object" && typeof v !== "function")) throw new Error(at + ": " + path + " is " + (v === null ? "null" : typeof v) + ", not { " + Object.keys(shape).join(", ") + " }");
  for (const k of Object.keys(shape)) {
    if (!(k in v)) throw new Error(at + ": " + path + " has no " + k + " (it has " + Object.keys(v).join(", ") + ")");
    if (shape[k]) __shape(v[k], shape[k], at, path + "." + k);
  }
  __seen.shapes++;
}
function __see(v, at, expr, defined, shape, oneOf) {
  if (defined && v === undefined) throw new Error(at + ": " + expr + " is undefined");
  if (shape) __shape(v, shape, at, expr);
  if (oneOf && !oneOf.includes(v)) throw new Error(at + ": " + expr + " is " + JSON.stringify(v) + ", not " + oneOf.join(" | "));
  __seen.reads++;
}
let __shDone = 0, __shEnd = false;
const __shWait = [];
const __wake = () => { for (const f of __shWait.splice(0)) f(); };
process.stdin.setEncoding("utf8").on("data", (d) => { __shDone += d.split("\\n").filter(Boolean).length; __wake(); }).on("end", () => { __shEnd = true; __wake(); });
async function __sh(n, at) {
  while (__shDone < n) {
    if (__shEnd) throw new Error(at + ": the sh blocks before it didn't all run");
    await new Promise((ok) => __shWait.push(ok));
  }
}
const __frames = [], __roots = [];
function __track(p) { __frames.push(Float32Array.from(p.pose.points)); __roots.push({ ...p.root }); }
function __motion(rest) {
  const r = checks.measure(checks.motionOfFrames(__frames, rest, { root: __roots }));
  return { frames: __frames.length, verdict: r.verdict, fails: r.findings.filter((f) => f.level === "fail").map((f) => f.metric + " " + (f.where ?? "") + " at " + f.t0.toFixed(2) + " s") };
}`;

/** The example's code with the body points and root its player posed recorded after each `player.update(...)` (the
 *  game loop's frames, which the test measures with the sensors). */
function tracked(code: string): string {
  return code.split("\n").map((line) => {
    const [text, comment] = splitComment(line), m = /^(\s*player\.update\([^;]*\);)$/.exec(text);
    return m ? `${m[1]} __track(player);${comment === null ? "" : ` //${comment}`}` : line;
  }).join("\n");
}

/** The ts blocks as one program, in the manual's order: imports merged at the top (single-line named imports only),
 *  the example's blocks at the top level and every other block in a scope of its own. To run, each block waits for the
 *  sh blocks above it (`__sh`) and each documented read is checked (`checked`), a line after the example prints its
 *  outcome and one at the end the checks that ran; `raw`, it is the blocks alone, as a reader's compiler sees them.
 *  Returns the program, the checks it holds and each line's place in the manual (null for the test's own lines). */
function program(blocks: readonly Block[], raw = false): { text: string; checks: number; at: (string | null)[] } {
  // the sensors, for what the example's loop played (`__motion`)
  const imports = new Map<string, Set<string>>(raw ? [] : [["@m3a/sensors", new Set(["checks"])]]), body: { line: string; at: string | null }[] = [];
  const add = (text: string) => body.push(...text.split("\n").map((line) => ({ line, at: null })));
  let example = false, sh = 0, checks = 0;
  for (const b of blocks) {
    if (b.lang === "sh") sh++;
    if (b.lang !== "ts") continue;
    const merged = b.code.replace(/^import \{([^}]*)\} from "([^"]+)";\n/gm, (_, names: string, from: string) => {
      const set = imports.get(from) ?? new Set<string>();
      for (const n of names.split(",").map((s) => s.trim()).filter(Boolean)) set.add(n);
      imports.set(from, set);
      return "\n"; // a line kept, so each line keeps its number
    });
    expect(merged, `${where(b)}: an import the test can't merge (one line, named imports)`).not.toMatch(/^\s*import\b/m);
    const inExample = EXAMPLE.test(b.section);
    if (example && !inExample && !raw) add(`console.log("M3A-EXAMPLE " + JSON.stringify({ damage, hits: run.trace.hits.length, states: run.trace.states.map((s) => s.layer + ":" + s.state), walked: bound.root.position.length(), motion: __motion(bound.core.rest), sim: run.sensors?.verdict ?? null }));`);
    example = inExample;
    const c = raw ? { code: merged, checks: 0 } : checked({ ...b, code: inExample ? tracked(merged) : merged });
    checks += c.checks;
    add(`// ${where(b)}`);
    if (!inExample) add("{");
    if (sh && !raw) add(`await __sh(${sh}, ${JSON.stringify(where(b))});`);
    // the block's lines, one for one (checked and tracked add to a line, never a line)
    body.push(...c.code.replace(/\n$/, "").split("\n").map((line, i) => ({ line, at: `MANUAL.md:${b.line + 1 + i}` })));
    if (!inExample) add("}");
  }
  if (!raw) add(`console.log("M3A-SEEN " + JSON.stringify(__seen));`);
  const head = [...[...imports].map(([from, names]) => `import { ${[...names].join(", ")} } from "${from}";`), ...(raw ? [] : PRELUDE.split("\n"))];
  return { text: [...head, ...body.map((l) => l.line)].join("\n"), checks, at: [...head.map(() => null), ...body.map((l) => l.at)] };
}

/** Runs a Node program in the scratch directory: its stdin (the sh blocks run, a line each) and its exit code and
 *  output once it ends. */
function node(path: string): { stdin: Writable; done: Promise<{ code: number | null; out: string }> } {
  const p = spawn(process.execPath, ["--no-warnings", path], { cwd: CWD });
  p.stdin.on("error", () => {}); // the program may have failed and ended before the test's last line
  return {
    stdin: p.stdin,
    done: new Promise((ok) => {
      let out = "";
      p.stdout.on("data", (d: Buffer) => (out += d));
      p.stderr.on("data", (d: Buffer) => (out += d));
      p.on("close", (code) => ok({ code, out }));
    }),
  };
}

/** Each `hit` event a recipe's events step adds to a library clip (a clip step's result), with that clip's first
 *  measured strike (`clip.facts.strike[0]`), which the manual says the event sits at. */
function hitsAtStrike(r: { steps: { op: string; id?: string; as?: string; in?: string; add?: { t: number; name: string }[] }[] }, at: string): { at: string; t: number; strike: number | undefined }[] {
  const lib = openLibrary();
  return r.steps.flatMap((s) => {
    const from = r.steps.find((c) => c.op === "clip" && c.as === s.in);
    if (s.op !== "events" || !from) return [];
    const strike = (lib.clip(from.id!).clip.facts as { strike?: number[] } | undefined)?.strike?.[0];
    return (s.add ?? []).filter((e) => e.name === "hit").map((e) => ({ at: `${at}: ${from.id}'s hit`, t: e.t, strike }));
  });
}

/** The keys of an import catalog that import reads (packages/tools/src/tools/exchange.ts, catalogOf). */
const CATALOG_KEYS = ["$sources", "$pick", "$skip"];
/** The fields of a catalog's source record the manual gives, each read from the set's _set.json as import keeps it:
 *  the license as its `terms` when `--license` differs, the credit as the set's. */
const SOURCE_FIELDS: Record<string, (kept: Record<string, unknown>, set: Record<string, unknown>) => unknown> = {
  label: (k) => k.label,
  license: (k) => k.terms ?? k.license,
  credit: (_k, s) => s.credit,
  url: (k) => k.url,
  origin: (k) => k.origin,
};

/** Checks that what an import wrote into `imports/<set>/` is what its catalog says: each "$" key is one import reads
 *  (it passes over any other), each source's record keeps each field the catalog gives it (import passes over a field
 *  it doesn't read, too), and each clip's entry gave that clip its tags, its words and whether it loops. */
function expectCatalogKept(catalog: Record<string, unknown>, set: string, at: string): void {
  expect(Object.keys(catalog).filter((k) => k.startsWith("$") && !CATALOG_KEYS.includes(k)), `${at}: keys import doesn't read`).toEqual([]);
  const manifest = JSON.parse(readFileSync(join(CWD, "imports", set, "_set.json"), "utf8")) as { sources: Record<string, Record<string, unknown>> };
  for (const [name, given] of Object.entries((catalog.$sources ?? {}) as Record<string, Record<string, unknown>>)) {
    const kept = manifest.sources[name];
    expect(kept, `${at}: $sources ${name} in ${set}'s _set.json`).toBeDefined();
    const read = (field: string) => (Object.hasOwn(SOURCE_FIELDS, field) ? SOURCE_FIELDS[field]!(kept!, manifest) : `(not a field the manual gives: ${Object.keys(SOURCE_FIELDS).join(", ")})`);
    expect(Object.fromEntries(Object.keys(given).map((f) => [f, read(f)])), `${at}: $sources ${name}`).toEqual(given);
  }
  const lib = openLibrary({ dir: join(CWD, "imports"), tiers: ["local"] });
  for (const [name, [tags, desc]] of Object.entries(catalog).filter(([k]) => !k.startsWith("$")) as [string, [string, string]][]) {
    const words = tags.split(" ").filter(Boolean), { clip } = lib.clip(`${set}/${name}`);
    const loop = words.includes("loop") ? true : words.includes("once") ? false : expect.any(Boolean);
    expect({ tags: clip.tags, desc: clip.desc, loop: clip.loop }, `${at}: ${name}`).toEqual({ tags: expect.arrayContaining(words.filter((w) => w !== "loop" && w !== "once")), desc, loop });
  }
}

/** Type-checks the program in tsconfig.json's one file (in a child, as tsc reads that file): the file's own syntactic
 *  and semantic diagnostics, and the config's and the options', as a JSON line `M3A-TYPES [{ line, code, text }]`. */
const TYPECHECK = `import ts from "typescript";
const sys = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, " ")); } };
const config = ts.getParsedCommandLineOfConfigFile("tsconfig.json", {}, sys);
const program = ts.createProgram({ rootNames: config.fileNames, options: config.options, configFileParsingDiagnostics: config.errors });
const file = config.fileNames.length === 1 ? program.getSourceFile(config.fileNames[0]) : undefined;
if (!file) throw new Error("tsconfig.json names one file, in the program: " + config.fileNames.join(", "));
const found = [...config.errors, ...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics(), ...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
console.log("M3A-TYPES " + JSON.stringify(found.map((d) => ({ line: d.file === file && d.start !== undefined ? file.getLineAndCharacterOfPosition(d.start).line + 1 : null, code: d.code, text: ts.flattenDiagnosticMessageText(d.messageText, " ") }))));`;

/** The ts blocks as a reader's compiler sees them, type-checked in the scratch directory as an ES module under the
 *  repository's strict options (tsconfig.base.json, Node's types), started now so it runs beside the tests. */
const TYPED = program(RUN, true);
writeFileSync(join(CWD, "package.json"), JSON.stringify({ type: "module" }));
writeFileSync(join(CWD, "manual.typed.ts"), TYPED.text);
writeFileSync(join(CWD, "tsconfig.json"), JSON.stringify({ extends: join(ROOT, "tsconfig.base.json"), compilerOptions: { composite: false, declaration: false, emitDeclarationOnly: false, noEmit: true, types: ["node"] }, files: ["manual.typed.ts"] }));
writeFileSync(join(CWD, "typecheck.mjs"), TYPECHECK);
const TYPECHECKED = node(join(CWD, "typecheck.mjs"));
TYPECHECKED.stdin.end();

describe("packages/tools/MANUAL.md", () => {
  it("lists the registry's tools as tools/manual/main.ts writes them", () => {
    expect(withToolList(TEXT, TOOLS), "the tool list differs from the registry: node tools/manual/main.ts rewrites it").toBe(TEXT);
    for (const t of TOOLS) expect(TEXT, t.name).toContain(`\`m3a ${t.name}`);
  });

  it("runs or checks every block; a block that can't run is marked, and counted", () => {
    expect(BLOCKS.length - RUN.length, "norun blocks").toBe(NORUN);
    for (const b of BLOCKS) expect(["ts", "json", "sh"], where(b)).toContain(b.lang);
    expect(RUN.filter((b) => b.lang === "ts").length).toBeGreaterThanOrEqual(6);
  });

  it("names only clips the library has and tools the registry has", () => {
    const lib = openLibrary({ tiers: ["cc0", "cc-by", "cmu"] }), sets = new Set(lib.sets().map((s) => s.set)), ids = new Set(lib.catalog().map((r) => r.id));
    const named = [...TEXT.matchAll(/\b([A-Z][A-Z0-9_]+)\/([A-Za-z0-9_]+)\b/g)].filter((m) => sets.has(m[1]!)).map((m) => m[0]);
    expect(named.length).toBeGreaterThanOrEqual(8);
    expect(named.filter((id) => !ids.has(id))).toEqual([]);
    const tools = new Set([...TOOLS.map((t) => t.name), "help", "mcp"]);
    // each call in backticks (`m3a show ...`); the sh lines run below
    const calls = [...TEXT.matchAll(/`(?:npx )?m3a ([a-z][a-z.-]*[a-z])/g)].map((m) => m[1]!);
    expect(calls.length).toBeGreaterThanOrEqual(30);
    expect(calls.filter((n) => !tools.has(n))).toEqual([]);
    // and the prose's calls with arguments (outside the generated list) parse as the m3a command parses them, a
    // `<placeholder>` a value, each giving the tool's required arguments
    const prose = TEXT.slice(0, TEXT.indexOf(BEGIN)) + TEXT.slice(TEXT.indexOf(END));
    const given = [...prose.matchAll(/`(?:npx )?m3a ([a-z][a-z.-]*[a-z])\s+([^`]+)`/g)].map((m) => ({ tool: m[1]!, argv: spanWords(m[2]!) }));
    expect(given.length).toBeGreaterThanOrEqual(6);
    for (const c of given) {
      const t = TOOLS.find((x) => x.name === c.tool), call = `m3a ${c.tool} ${c.argv.join(" ")}`;
      expect(t, call).toBeDefined();
      const args = parseCall(t!, c.argv);
      expect(typeof args === "string" ? args : "", call).toBe("");
      expect((t!.schema.required ?? []).filter((r) => !Object.hasOwn(args as object, r)), call).toEqual([]);
    }
  });

  it("names each export with the entry that has it, and the MCP server as the installed package runs it", async () => {
    // "`openLibrary` from `@m3a/library/node`", "`LibraryError` (from `@m3a/library`)": the entry, as Node resolves it
    const named = [...TEXT.matchAll(/`([A-Za-z_$][\w$]*)`\s+\(?from\s+`(@m3a\/[\w-]+(?:\/[\w-]+)?)`/g)].map((m) => ({ name: m[1]!, from: m[2]! }));
    expect(named.map((n) => n.name)).toEqual(expect.arrayContaining(["LibraryError", "openLibrary", "writePng", "loadGlb"]));
    for (const { name, from } of named) expect(Object.keys((await import(from)) as object), `\`${name}\` from \`${from}\``).toContain(name);
    // the MCP command it gives runs the bin @m3a/tools's published files carry
    const mcp = /`(npx) (m3a) (mcp)`/.exec(TEXT);
    expect(mcp, "the manual gives the MCP server's command, `npx m3a mcp`").not.toBeNull();
    expect(mcpLaunch({ command: mcp![1]!, args: [mcp![2]!, mcp![3]!] })).toBe("");
  });

  it("hands no bench job its answer: neither the manual nor a tool's example names a clip a known-good picks", () => {
    const answers = benchAnswers(openLibrary({ tiers: ["cc0", "cc-by", "cmu"] }).catalog());
    // read from the known-goods, each way they name a clip, B7's one-shots among them; B1's and B7's loops left out
    expect([...answers]).toEqual(expect.arrayContaining(["QUATERNIUS_3D2DGE/Punch_Jab", "QUATERNIUS_3D2DGE/Hit_Head", "MESH2MOTION/Crouch_Walk", "MESH2MOTION/Victory", "MESH2MOTION/Punch_Cross", "QUATERNIUS_3D2DGE/Jump_Start", "QUATERNIUS_3D2DGE/Jump_Land"]));
    expect([...answers].filter((id) => /^QUATERNIUS_3D2DGE\/(Idle|Walk|Jog_Fwd|Jump)_Loop$/.test(id))).toEqual([]);
    const examples = TOOLS.flatMap((t) => t.examples.map((e) => [`m3a help ${t.name}`, JSON.stringify(e.args)] as const));
    const named = [["MANUAL.md", TEXT] as const, ...examples].flatMap(([at, text]) => [...answers].filter((id) => mentions(text, id)).map((id) => `${at}: ${id}`));
    expect(named).toEqual([]);
  });

  it("masks only by core's groups and fields (an unknown field weighs 0, silently)", () => {
    const fields = new Set(Object.values(ops.GROUPS).flat()), masks: string[] = [];
    for (const b of RUN.filter((x) => x.lang === "ts" || x.lang === "json")) {
      for (const m of b.code.matchAll(/"?mask"?: \{([^}]*)\}/g)) masks.push(...[...m[1]!.matchAll(/"?([A-Za-z_]\w*)"?\s*:/g)].map((k) => `${where(b)} field ${k[1]}`));
      for (const m of b.code.matchAll(/"?mask"?: "(\w+)"/g)) masks.push(`${where(b)} group ${m[1]}`);
    }
    expect(masks.length).toBeGreaterThanOrEqual(4);
    expect(masks.filter((m) => !(m.includes(" field ") ? fields : new Set(Object.keys(ops.GROUPS))).has(m.split(" ").at(-1)!))).toEqual([]);
  });

  it("parses every json block and checks each as what it is", () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true }), schema = (n: string) => JSON.parse(readFileSync(join(ROOT, `spec/schemas/${n}.schema.json`), "utf8")) as { $id: string };
    const r = schema("recipe");
    ajv.addSchema(r); // an action's schema refers to the recipe's
    const checks = { recipe: ajv.getSchema(r.$id)!, graph: ajv.compile(schema("graph")), action: ajv.compile(schema("action")), sim: ajv.compile(schema("sim")) };
    const kinds: string[] = [], strikes: ReturnType<typeof hitsAtStrike> = [];
    for (const b of RUN.filter((x) => x.lang === "json")) {
      const name = file(b), data = JSON.parse(b.code) as Record<string, unknown>;
      const kind = name === "game.json" ? "game" : name === ".mcp.json" ? "mcp" : Object.keys(data).some((k) => k.startsWith("$")) ? "catalog" : "beats" in data ? "action" : "states" in data ? "graph" : "input" in data ? "sim" : "steps" in data ? "recipe" : "unknown";
      kinds.push(kind);
      if (kind === "recipe" || kind === "graph" || kind === "action" || kind === "sim") expect(checks[kind](data) || checks[kind].errors, where(b)).toBe(true);
      if (kind === "recipe") expect(recipe.validateRecipe(data as never), where(b)).toEqual([]);
      if (kind === "recipe") strikes.push(...hitsAtStrike(data as never, where(b)));
      if (kind === "action") expect(actions.validateAction(data as never), where(b)).toEqual([]);
      if (kind === "graph") expect(graph.validateGraph(data as never), where(b)).toEqual([]);
      if (kind === "game") expect(gameTiers(CWD)).toEqual((data as { tiers: string[] }).tiers);
      // .mcp.json runs the installed package's bin (npx finds it in node_modules/.bin), which its files carry
      if (kind === "mcp") expect(mcpLaunch((data as { mcpServers: { m3a: { command: string; args: string[] } } }).mcpServers.m3a), where(b)).toBe("");
      // a catalog is checked by the import that reads it (an sh block), so it must be named there
      if (kind === "catalog") expect(TEXT, where(b)).toContain(`--catalog ${name}`);
    }
    expect(kinds, "a json block the test can't check").not.toContain("unknown");
    // a hit event a recipe adds sits at its clip's measured strike, the time the prose gives
    expect(strikes.length).toBeGreaterThanOrEqual(1);
    for (const s of strikes) {
      expect(s.t, s.at).toBe(s.strike);
      expect(TEXT, s.at).toContain(`${s.strike} s is`);
    }
    // each script names the graph it was written for, which a json block holds
    for (const b of RUN.filter((x) => x.lang === "json" && "input" in JSON.parse(x.code))) {
      const script = JSON.parse(b.code) as { graph: string }, g = RUN.map((x) => (x.lang === "json" ? (JSON.parse(x.code) as { id?: string }) : {})).find((x) => x.id === script.graph);
      expect(g, where(b)).toBeDefined();
      expect(validateScript(script as never, g as never), where(b)).toEqual([]);
    }
  });

  it("runs the ts blocks as one program and the sh blocks' m3a calls, each exiting 0", async () => {
    const prog = program(RUN);
    writeFileSync(join(CWD, "manual.ts"), prog.text);
    const ran = node(join(CWD, "manual.ts"));
    // meanwhile, the m3a calls in order, as the m3a command makes them (its retries kept in .m3a/requests/), the
    // program told after each sh block so a ts block below one runs after it
    const registry = new Registry(TOOLS, fileStore(CWD)), host = nodeHost(CWD), calls: string[] = [], imports: { at: string; argv: string[] }[] = [];
    try {
      for (const b of RUN.filter((x) => x.lang === "sh")) {
        for (const line of b.code.split("\n").map(uncommented).filter(Boolean)) {
          const argv = words(line);
          if (argv[0] === "npx") argv.shift();
          expect(argv[0], `MANUAL.md:${b.line}: ${line}`).toBe("m3a");
          let out = "";
          const code = await runCli(registry, argv.slice(1), { print: (t) => (out += t), write: (p, t) => void host.write!(p, t), host });
          expect(code, `MANUAL.md:${b.line}: ${line}\n${out}`).toBe(0);
          calls.push(argv[1]!);
          if (argv[1] === "import") imports.push({ at: `MANUAL.md:${b.line}: ${line}`, argv: argv.slice(2) });
        }
        ran.stdin.write("ran\n");
      }
    } finally {
      ran.stdin.end();
    }
    expect(calls.length).toBeGreaterThanOrEqual(8);
    // each catalog an import read is found in what it wrote (in import's default set when --set is left out)
    const importTool = TOOLS.find((t) => t.name === "import")!, withCatalog = imports.map((c) => ({ ...c, args: parseCall(importTool, c.argv) as { catalog?: string; set?: string } })).filter((c) => c.args.catalog);
    expect(withCatalog.length).toBeGreaterThanOrEqual(1);
    for (const c of withCatalog) expectCatalogKept(JSON.parse(readFileSync(join(CWD, c.args.catalog!), "utf8")) as Record<string, unknown>, c.args.set ?? (importTool.schema.properties?.set as { default: string }).default, c.at);
    const { code, out } = await ran.done;
    expect(code, out).toBe(0);
    const ex = JSON.parse(/^M3A-EXAMPLE (.*)$/m.exec(out)?.[1] ?? "null") as { damage: number; hits: number; states: string[]; walked: number; motion: { frames: number; verdict: string; fails: string[] }; sim: string | null } | null;
    expect(ex, out).not.toBeNull();
    // the knight's one slash dealt its damage once, the simulation saw its one hit window, it flinched and walked
    expect([ex!.damage, ex!.hits]).toEqual([25, 1]);
    expect(ex!.states).toEqual(["base:move", "react:none", "base:slash", "react:flinch", "react:none", "base:move"]);
    expect(ex!.walked).toBeGreaterThan(0.5);
    // and the game loop, as written, moves the body without a failing finding (a parameter snapped pops it): every
    // frame it posed, measured by the sensors; so does the simulation of its input
    expect(ex!.motion.frames).toBeGreaterThanOrEqual(60);
    expect([ex!.motion.verdict, ex!.motion.fails]).toEqual([expect.not.stringMatching(/^fail$/), []]);
    expect(ex!.sim).toMatch(/^(pass|warn)$/);
    // every documented read ran and held: the fields its comment lists (an array's first element), its values
    const seen = JSON.parse(/^M3A-SEEN (.*)$/m.exec(out)?.[1] ?? "null") as { reads: number; shapes: number; empty: number } | null;
    expect(seen?.reads, out).toBe(prog.checks);
    expect(prog.checks).toBeGreaterThanOrEqual(20);
    expect(seen!.shapes).toBeGreaterThanOrEqual(10);
    // a shape read on an empty array checks nothing: only the valid recipe's issues ([]) may be one
    expect(seen!.empty, "documented shapes read on an empty array").toBeLessThanOrEqual(1);
  }, 60_000);

  it("type-checks the ts blocks as that one program, strict, as a reader's compiler would", async () => {
    // a misspelled option runs (ignored) but doesn't compile: `sheet(..., { framez: 8 })` is TS2561
    const { code, out } = await TYPECHECKED.done;
    expect(code, out).toBe(0);
    const found = JSON.parse(/^M3A-TYPES (.*)$/m.exec(out)?.[1] ?? "null") as { line: number | null; code: number; text: string }[] | null;
    expect(found, out).not.toBeNull();
    expect(found!.map((d) => `${(d.line && TYPED.at[d.line - 1]) || `manual.typed.ts:${d.line}`}: TS${d.code} ${d.text}`)).toEqual([]);
    expect(TYPED.at.filter(Boolean).length, "the ts blocks' lines in the program").toBe(RUN.filter((b) => b.lang === "ts").reduce((n, b) => n + b.code.split("\n").length - 1, 0));
  }, 60_000);
});
