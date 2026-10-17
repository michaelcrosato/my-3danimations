// The manual's complete example (PLAN.md WP-7.3, WP-7.4): the code `npm run pack -- --check` runs on the installed
// packages and again on m3a.js. The marker: the first fenced block in packages/tools/MANUAL.md whose info string is
// `ts example` (a fence opening ```ts example). A manual without one fails, naming the marker; `--example <file>` runs
// another file instead (tools/bundle/standin.ts until the manual has its example). On m3a.js the example's @m3a
// imports come from ./m3a.js; one m3a.js can't serve (three, @m3a/three, a Node entry beyond what m3a.js stands in
// for) is refused before it runs, naming it.
import { ENTRIES, STANDS_IN } from "./single.ts";

/** The info string that marks the manual's complete example. */
export const MARKER = "ts example";

/** The manual's complete example: the code of its first ```ts example block. Throws, naming the marker, without one. */
export function exampleOf(manual: string, where = "packages/tools/MANUAL.md"): string {
  const m = /^(`{3,}|~{3,})ts example[ \t]*\r?\n([\s\S]*?)^\1[ \t]*$/m.exec(manual);
  if (!m) throw new Error(`${where} has no complete example: mark it with a fence opening \`\`\`${MARKER} (tools/bundle/README.md), or run another file with --example <file>`);
  return m[2]!;
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
