// The examples `npm run pack -- --check` runs (PLAN.md WP-7.3, WP-7.4). The manual's complete example: the section of
// packages/tools/MANUAL.md headed `## A complete example...`, read as packages/tools/test/manual.test.ts reads it. Its
// json blocks named as files (```json knight.json) are written into the scratch project, its ts blocks (but `norun`
// ones) run in order as one Node program, their imports merged at the top and their names shared, and its sh lines are
// m3a calls, run there through the installed bin. A manual without that section, or one with no ts block in it,
// fails, naming the heading. On the packages the program runs in its recorded form (`recordedForm`): its @m3a/three
// imports from ./recorded.ts, three's own player recorded. Its headless form (`headlessForm`) is the same program with
// its imports of three.js's binding and Node's PNG writer, which m3a.js leaves out by design, taken from ./headless.ts,
// and what those saw printed at the end; it runs on the packages and on m3a.js, each printing the same, and plays as
// the recorded form did (`sameRun`). On m3a.js its @m3a imports come from ./m3a.js; one m3a.js can't serve (three, a
// name of @m3a/three that ./headless.ts doesn't stand in for, a Node entry beyond what m3a.js stands in for) is
// refused before it runs, naming it. Its m3a calls run on m3a.js too, through m3a.js's own runCli (`callsOnSingle`).
import type { registry, runCli } from "@m3a/tools";
import { ENTRIES, STANDS_IN } from "./single.ts";

/** The heading that opens the manual's complete example (a `## ` heading starting with these words). */
export const SECTION = "## A complete example";
/** What ./headless.ts stands in for, by module: the names of three.js's binding and Node's PNG writer an example may
 *  import when it runs headless (m3a.js leaves those modules out by design: ./single.ts). */
export const HEADLESS: Readonly<Record<string, readonly string[]>> = { "@m3a/three": ["bind", "attach"], "@m3a/three/test-characters": ["loadGlb"], "@m3a/sensors/node": ["writePng"] };
/** Where the headless form imports ./headless.ts from, beside it. */
export const STANDINS = "./headless.ts";
/** Where the recorded form imports ./recorded.ts from, beside it. */
export const RECORDED = "./recorded.ts";
/** The parts of a run's report (./headless.ts `record`) that the run on @m3a/three and the headless form both record,
 *  and must agree on, bit for bit: the updates, the events, every pose's joints (`points`), the travel and each
 *  Animator's hash. Not `poses`: three's loader names the bones its own way ("mixamorig:Hips" is "mixamorigHips") and
 *  its bind reads their rest orientations through three's matrices, so their local rotations may differ in the last
 *  bit; nor the images, as the real writePng writes its file. */
export const PLAYED = ["updates", "events", "points", "travel", "hashes"] as const;

/** A fenced block of a manual: its language, the rest of its info string (a file name, `norun`), its code, the line
 *  its fence opens on and the `## ` heading it sits under. */
export interface Block {
  lang: string;
  info: string[];
  code: string;
  line: number;
  section: string;
}

/** A manual's fenced blocks, in order (fences of three backticks, as the manual writes them). */
export function blocksOf(md: string, where = "packages/tools/MANUAL.md"): Block[] {
  const out: Block[] = [];
  let section = "", open: Block | null = null;
  md.split("\n").forEach((l, i) => {
    if (open) {
      if (/^```\s*$/.test(l)) {
        out.push(open);
        open = null;
      } else open.code += `${l}\n`;
    } else if (l.startsWith("## ")) section = l.trim();
    else if (l.startsWith("```")) {
      const [lang = "", ...info] = l.slice(3).trim().split(/\s+/);
      open = { lang, info, code: "", line: i + 1, section };
    }
  });
  if (open) throw new Error(`${where}:${(open as Block).line}: a fenced block left open`);
  return out;
}

/** The manual's complete example as it runs in a scratch project: the files it reads (its named json blocks), its ts
 *  blocks as one program, its sh lines (each an m3a call) and how many ts blocks went in. */
export interface Example {
  files: Record<string, string>;
  program: string;
  sh: string[];
  blocks: number;
}

/** The ts blocks' code as one program: every static import moved to the top, named imports from one module merged
 *  (each name once), any other import kept once; the code after them in order, at the top level. */
export function program(codes: readonly string[]): string {
  const named = new Map<string, Set<string>>(), other = new Set<string>(), body: string[] = [];
  for (const code of codes) {
    body.push(code.replace(/^import\s+([^;"']*?)\s*from\s*(["'])([^"']+)\2;?[ \t]*(?:\r?\n|$)|^import\s*(["'])[^"']+\4;?[ \t]*(?:\r?\n|$)/gm, (stmt, clause: string | undefined, _q, from: string | undefined) => {
      const list = clause ? /^\{([^}]*)\}$/.exec(clause.trim())?.[1] : undefined;
      if (list === undefined || !from) other.add(stmt.trim());
      else {
        const set = named.get(from) ?? named.set(from, new Set()).get(from)!;
        for (const n of list.split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean)) set.add(n);
      }
      return "";
    }));
  }
  return [...[...named].map(([from, names]) => `import { ${[...names].join(", ")} } from "${from}";`), ...other, ...body].join("\n");
}

/** A manual's complete example (the section headed SECTION). Throws, naming the heading, when the manual has no such
 *  section or no ts block in it, and naming the line, on an sh line that isn't an m3a call. */
export function completeExample(manual: string, where = "packages/tools/MANUAL.md"): Example {
  const blocks = blocksOf(manual, where).filter((b) => b.section.startsWith(SECTION) && !b.info.includes("norun"));
  const ts = blocks.filter((b) => b.lang === "ts");
  if (!ts.length) throw new Error(`${where} has no complete example: a section headed "${SECTION}..." with a \`\`\`ts block in it (tools/bundle/README.md); or run another file with --example <file>`);
  const files: Record<string, string> = {}, sh: string[] = [];
  for (const b of blocks.filter((x) => x.lang === "json" && x.info[0])) {
    if (!/^\w[\w.-]*$/.test(b.info[0]!)) throw new Error(`${where}:${b.line}: "${b.info[0]}" isn't a file name the scratch project can hold (letters, digits, _ . -)`);
    files[b.info[0]!] = b.code;
  }
  for (const b of blocks.filter((x) => x.lang === "sh")) {
    for (const line of b.code.replace(/\\\n/g, " ").split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))) {
      if (!/^\s*(npx\s+)?m3a\s/.test(line)) throw new Error(`${where}:${b.line}: "${line.trim()}" in the complete example isn't an m3a call (its sh lines run through the installed m3a bin)`);
      sh.push(line.trim());
    }
  }
  return { files, program: program(ts.map((b) => b.code)), sh, blocks: ts.length };
}


/** One import of an example: its module and the names it takes ("default", or "*" for a namespace); type-only ones
 *  (which Node strips) are left out. */
export interface ExampleImport {
  from: string;
  names: string[];
}

/** The modules an example imports, each with the names it takes: static imports, re-exports and dynamic import()s. */
export function importsOf(code: string): ExampleImport[] {
  const out: ExampleImport[] = [];
  for (const m of code.matchAll(/\b(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*["']([^"']+)["']/g)) {
    if (m[2]) continue;
    const clause = m[3]!.trim(), names: string[] = [];
    const list = /\{([^}]*)\}/.exec(clause)?.[1] ?? "", rest = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
    for (const n of list.split(",").map((x) => x.trim()).filter((x) => x && !x.startsWith("type "))) names.push(n.split(/\s+as\s+/)[0]!);
    if (/\*\s*as\s+\w+|^\*$/.test(rest)) names.push("*");
    else if (rest) names.push("default");
    out.push({ from: m[4]!, names });
  }
  for (const m of code.matchAll(/(?:^|[\n;])\s*import\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push({ from: (m[1] ?? m[2])!, names: m[2] ? ["*"] : [] });
  return out;
}

/** An example's headless form: the same program, its imports of what ./headless.ts stands in for (HEADLESS) taken from
 *  it, and `headlessReport()` printed at the end, so a run on the packages and one on m3a.js can be compared bit for
 *  bit. Throws, naming each, on a name of those modules that ./headless.ts doesn't stand in for. */
export function headlessForm(code: string): string {
  const refused: string[] = [];
  for (const { from, names } of importsOf(code)) {
    const served = HEADLESS[from];
    for (const n of served ? names.filter((x) => !served.includes(x)) : []) refused.push(`${n === "*" ? "the namespace" : n} from "${from}" (tools/bundle/headless.ts stands in for ${served!.join(" and ")} alone)`);
  }
  if (refused.length) throw new Error(`the example can't run headless: it imports ${refused.join("; ")}`);
  const modules = Object.keys(HEADLESS).map((m) => m.replace(/[.]/g, "\\.")).join("|");
  const rewritten = code.replace(new RegExp(`((?:\\bfrom|\\bimport)\\s*\\(?\\s*)(["'])(?:${modules})\\2`, "g"), `$1"${STANDINS}"`);
  return program([rewritten, `import { headlessReport } from "${STANDINS}";\nconsole.log(headlessReport());\n`]);
}

/** The example as it runs on m3a.js, every @m3a import taken from ./m3a.js. Throws, naming each, on an import m3a.js
 *  can't serve: a module it leaves out, or a name it doesn't export (`exported`, m3a.js's names). */
export function forSingle(code: string, exported: readonly string[]): string {
  const has = new Set(exported), refused: string[] = [];
  for (const { from, names } of importsOf(code)) {
    if (from.startsWith("node:") || from.startsWith(".")) continue;
    const served = (ENTRIES as readonly string[]).includes(from) ? null : STANDS_IN[from];
    if (served === undefined) refused.push(`"${from}" (m3a.js leaves it out: it holds ${ENTRIES.join(", ")} and @m3a/library/node's ${STANDS_IN["@m3a/library/node"]!.join(" and ")}; three.js and @m3a/three are not in it)`);
    else for (const n of names.filter((x) => x !== "*" && (served ? !served.includes(x) : !has.has(x)))) refused.push(`${n} from "${from}" (m3a.js doesn't export it)`);
  }
  if (refused.length) throw new Error(`the example can't run on m3a.js: it imports ${refused.join("; ")}`);
  return code.replace(/((?:\bfrom|\bimport)\s*\(?\s*)(["'])@m3a\/[^"']+\2/g, '$1"./m3a.js"');
}

/** An example's recorded form, as it runs on the packages: the same program, its imports of @m3a/three taken from
 *  ./recorded.ts (every name three gives, its player recorded) and `recordedReport()` printed at the end. */
export function recordedForm(code: string): string {
  const rewritten = code.replace(/((?:\bfrom|\bimport)\s*\(?\s*)(["'])@m3a\/three\2/g, `$1"${RECORDED}"`);
  return program([rewritten, `import { recordedReport } from "${RECORDED}";\nconsole.log(recordedReport());\n`]);
}

/** Where the run on @m3a/three (`real`, the recorded form's last line) and the headless form (`headless`, its last
 *  line) play otherwise: each part of PLAYED that differs, with both values; none when they agree, bit for bit. */
export function sameRun(real: string, headless: string): string[] {
  const a = JSON.parse(real) as Record<string, unknown>, b = JSON.parse(headless) as Record<string, unknown>;
  return PLAYED.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${JSON.stringify(a[k])} on @m3a/three, ${JSON.stringify(b[k])} headless`);
}

/** An m3a call's words as sh reads its line, `m3a` or `npx m3a` dropped: split at blanks, '...' and "..." quoting, a
 *  backslash escaping the next character, a word opening with # ending the line. Throws, naming the line, on what only
 *  a shell makes something of (an expansion, a redirection, a pipe or list, a glob), and on a line that isn't an m3a
 *  call. */
export function argvOf(line: string): string[] {
  const refuse = (why: string) => new Error(`"${line}" can't run on m3a.js: ${why}`), shell = (c: string) => refuse(`"${c}" needs a shell, and m3a.js runs the call's words through its runCli`);
  const words: string[] = [];
  let w: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (/\s/.test(c)) {
      if (w !== null) words.push(w);
      w = null;
    } else if (c === "#" && w === null) break;
    else if (c === "'") {
      const j = line.indexOf("'", i + 1);
      if (j < 0) throw refuse("a ' quote is left open");
      w = (w ?? "") + line.slice(i + 1, j);
      i = j;
    } else if (c === '"') {
      let j = i + 1, t = "";
      for (; j < line.length && line[j] !== '"'; j++) {
        if (line[j] === "$" || line[j] === "`") throw shell(line[j]!);
        t += line[j] === "\\" && /[$`"\\]/.test(line[j + 1] ?? "") ? line[++j] : line[j];
      }
      if (j >= line.length) throw refuse('a " quote is left open');
      w = (w ?? "") + t;
      i = j;
    } else if (c === "\\") w = (w ?? "") + (line[++i] ?? "");
    else if (/[$`|;&<>()*?[]/.test(c) || (c === "~" && w === null)) throw shell(c);
    else w = (w ?? "") + c;
  }
  if (w !== null) words.push(w);
  const at = words[0] === "npx" ? 1 : 0;
  if (words[at] !== "m3a") throw new Error(`"${line}" isn't an m3a call`);
  return words.slice(at + 1);
}

/** What running the example's m3a calls on m3a.js takes from it: its runCli, the registry it serves (`tools`) and its
 *  host (the library it carries; no files). */
export interface SingleCli {
  runCli: typeof runCli;
  tools: Parameters<typeof runCli>[0];
  host: registry.Host;
}

/** The example's m3a calls (its sh lines) run on m3a.js in order, as the bin runs them on the packages: each line's
 *  words (argvOf) through m3a.js's runCli, its host serving `files` (the example's, by name: m3a.js reads no files,
 *  and a tool given a path answers E_HOST without one) and keeping what each call writes for the calls after it.
 *  Throws on the first call that exits otherwise than 0, with what it printed; returns each call's verdict. */
export async function callsOnSingle(m3a: SingleCli, sh: readonly string[], files: Readonly<Record<string, string | Uint8Array>>): Promise<string[]> {
  const key = (p: string) => {
    const out: string[] = [];
    if (p.startsWith("/")) throw new Error(`${p}: the example's calls name files by relative paths`);
    for (const s of p.split("/").filter((x) => x && x !== ".")) {
      if (s !== "..") out.push(s);
      else if (out.pop() === undefined) throw new Error(`${p} is outside the example's files`);
    }
    return out.join("/");
  };
  const held = new Map(Object.entries(files).map(([p, f]) => [key(p), f]));
  const got = (p: string) => {
    const f = held.get(key(p));
    if (f === undefined) throw new Error(`no file ${p}: the example has none, and no call before this one wrote it`);
    return f;
  };
  const host: registry.Host = {
    ...m3a.host,
    read: async (p) => ((f) => (typeof f === "string" ? f : new TextDecoder().decode(f)))(got(p)),
    tryRead: async (p) => (held.has(key(p)) ? host.read!(p) : null),
    bytes: async (p) => ((f) => (typeof f === "string" ? new TextEncoder().encode(f) : f))(got(p)),
    write: (p, d) => (held.set(key(p), d), key(p)),
    remove: (p) => void held.delete(key(p)),
  };
  const said: string[] = [];
  for (const line of sh) {
    let out = "";
    const exit = await m3a.runCli(m3a.tools, argvOf(line), { print: (t) => void (out += t), write: (p, t) => void held.set(key(p), t), host });
    if (exit !== 0) throw new Error(`${line} exits ${exit} on m3a.js:\n${out}`);
    said.push(out.split("\n")[0]!);
  }
  return said;
}
