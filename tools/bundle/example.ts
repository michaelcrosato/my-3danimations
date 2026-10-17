// The examples `npm run pack -- --check` runs (PLAN.md WP-7.3, WP-7.4). The manual's complete example: the section of
// packages/tools/MANUAL.md headed `## A complete example...`, read as packages/tools/test/manual.test.ts reads it. Its
// json blocks named as files (```json knight.json) are written into the scratch project, its ts blocks (but `norun`
// ones) run in order as one Node program, their imports merged at the top and their names shared, and its sh lines are
// m3a calls, run there through the installed bin. A manual without that section, or one with no ts block in it,
// fails, naming the heading. Its headless form (`headlessForm`) is the same program with its imports of three.js's
// binding and Node's PNG writer, which m3a.js leaves out by design, taken from ./headless.ts, and what those saw printed
// at the end; it runs on the packages and on m3a.js, each printing the same. On m3a.js its @m3a imports come from
// ./m3a.js; one m3a.js can't serve (three, a name of @m3a/three that ./headless.ts doesn't stand in for, a Node entry
// beyond what m3a.js stands in for) is refused before it runs, naming it.
import { ENTRIES, STANDS_IN } from "./single.ts";

/** The heading that opens the manual's complete example (a `## ` heading starting with these words). */
export const SECTION = "## A complete example";
/** What ./headless.ts stands in for, by module: the names of three.js's binding and Node's PNG writer an example may
 *  import when it runs headless (m3a.js leaves those modules out by design: ./single.ts). */
export const HEADLESS: Readonly<Record<string, readonly string[]>> = { "@m3a/three": ["bind", "attach"], "@m3a/three/test-characters": ["loadGlb"], "@m3a/sensors/node": ["writePng"] };
/** Where the headless form imports ./headless.ts from, beside it. */
export const STANDINS = "./headless.ts";

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
