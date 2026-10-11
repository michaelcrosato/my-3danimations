// The header lint (DOCTRINE.md principle 1; PLAN.md §8.3 item 3): every source file opens with a comment saying
// what it holds, and every export declared in a package's src/ has a doc comment. Run by `npm run check`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "./cli.ts";

const SKIP = new Set(["node_modules", "dist", ".cache", "check-output", ".git"]);
const SOURCE = /\.(ts|js|mjs|cjs)$/;

/** Every source file under `dir`, recursively, skipping build and cache folders. */
export function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (SOURCE.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** True when the text opens (after an optional shebang) with a line or block comment. */
export function hasHeader(text: string): boolean {
  const body = text.startsWith("#!") ? text.slice(text.indexOf("\n") + 1) : text;
  return /^\s*(\/\/|\/\*)/.test(body);
}

/** Exports declared without a doc comment directly above them, as "line: name". Re-exports are exempt. */
export function undocumentedExports(text: string): string[] {
  const lines = text.split("\n");
  const missing: string[] = [];
  const decl = /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function\*?|const|let|class|interface|type|abstract\s+class)\s+([A-Za-z0-9_$]+)/;
  for (let i = 0; i < lines.length; i++) {
    const m = decl.exec(lines[i]!);
    if (!m) continue;
    let j = i - 1;
    while (j >= 0 && /^\s*@/.test(lines[j]!)) j--; // decorators
    if (j < 0 || !/\*\/\s*$/.test(lines[j]!)) missing.push(`${i + 1}: ${m[2]}`);
  }
  return missing;
}

/** Run the lint over the repository; returns the findings as "path: problem". */
export function lintHeaders(root: string = ROOT): string[] {
  const findings: string[] = [];
  const roots = ["packages", "tools", "tests", "spec", "bench", "apps"].map((d) => join(root, d));
  const configs = readdirSync(root).filter((n) => /\.config\.(ts|js)$/.test(n)).map((n) => join(root, n));
  for (const file of [...roots.flatMap(sourceFiles), ...configs]) {
    const rel = relative(root, file);
    const text = readFileSync(file, "utf8");
    if (!hasHeader(text)) findings.push(`${rel}: no header comment saying what the file holds`);
    if (/^packages\/[^/]+\/src\//.test(rel)) {
      for (const m of undocumentedExports(text)) findings.push(`${rel}:${m.split(":")[0]}: export ${m.split(": ")[1]} has no doc comment`);
    }
  }
  return findings;
}

if (import.meta.main) {
  const findings = lintHeaders();
  if (findings.length) {
    process.stdout.write(`headers: ${findings.length} finding(s)\n${findings.slice(0, 40).join("\n")}\nnext: add the header or doc comment, then rerun npm run check\n`);
    process.exit(1);
  }
  process.stdout.write("headers: ok\n");
}
