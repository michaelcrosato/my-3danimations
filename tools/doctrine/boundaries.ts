// Doctrine check, principles 6 and 8: the import boundaries of PLAN.md §5.1.
// - @m3a/core imports nothing outside its own src/: no packages, no `node:`, no relative path out.
// - Other packages: Node built-ins only in their `/node` entry (src/node.ts or src/node/), only the packages in
//   ALLOWED, never another package's internals; @supabase/supabase-js only in @m3a/tools' src/intake/.
// - Apps and the benchmark reach packages only through `@m3a/<name>` or `@m3a/<name>/node`; labs (apps/lab/) may
//   reach past, and are listed instead of failed. Nothing imports from apps/.
import { builtinModules } from "node:module";
import { dirname, join, normalize } from "node:path";
import type { Ctx, Finding } from "./context.ts";

const BUILTINS = new Set(builtinModules);

/** Bare specifiers each package may import (beyond Node built-ins in its node entry). */
export const ALLOWED: Record<string, RegExp[]> = {
  core: [],
  sensors: [/^@m3a\/core$/],
  io: [/^@m3a\/core$/],
  library: [/^@m3a\/core$/],
  three: [/^@m3a\/core$/, /^three(\/.*)?$/, /^@pixiv\/three-vrm(-animation)?$/],
  tools: [/^@m3a\/(core|sensors|io|library|three)(\/node)?$/, /^@supabase\/supabase-js$/],
};

/** Every module specifier a source file imports, re-exports or loads dynamically. */
export function specifiers(text: string): string[] {
  const out: string[] = [];
  const res = [/\bimport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*["']([^"']+)["']/g, /\bexport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g];
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  for (const re of res) for (const m of code.matchAll(re)) out.push(m[1]!);
  return out;
}

const isNode = (s: string) => s.startsWith("node:") || BUILTINS.has(s.split("/")[0]!);
const isRelative = (s: string) => s.startsWith("./") || s.startsWith("../");

/** Check every source file's imports; returns findings and the labs' reach-pasts (listed, never failed). */
export function checkBoundaries(ctx: Ctx): { findings: Finding[]; reachPasts: string[] } {
  const findings: Finding[] = [];
  const reachPasts: string[] = [];
  const fail = (f: string, s: string, why: string) => findings.push({ check: "boundaries", message: `${f} imports "${s}": ${why}` });
  for (const f of ctx.files.filter((p) => /\.(ts|js|mjs|cjs|tsx)$/.test(p) && !p.endsWith(".d.ts"))) {
    const specs = specifiers(ctx.read(f));
    const pkg = /^packages\/([^/]+)\/src\//.exec(f)?.[1];
    const app = /^(apps\/[^/]+|bench)\//.exec(f)?.[1];
    const isLab = f.startsWith("apps/lab/");
    for (const s of specs) {
      const target = isRelative(s) ? normalize(join(dirname(f), s)).split("\\").join("/") : null;
      if (target?.startsWith("apps/") && !f.startsWith("apps/")) fail(f, s, "nothing imports from apps/; move the shared code into a package");
      if (pkg) {
        const nodeEntry = new RegExp(`^packages/${pkg}/src/node(\\.ts|/)`).test(f);
        if (target) {
          if (!target.startsWith(`packages/${pkg}/src/`)) fail(f, s, `a relative import must stay inside packages/${pkg}/src/; import the package's public entry instead`);
        } else if (isNode(s)) {
          if (pkg === "core") fail(f, s, "core imports no Node built-in (principle 6); take the data as an argument");
          else if (!nodeEntry) fail(f, s, `Node built-ins belong in @m3a/${pkg}'s node entry (src/node.ts or src/node/) so the main entry runs in a browser`);
        } else if (pkg === "core") {
          fail(f, s, "core imports nothing outside itself (principle 6)");
        } else if (!(ALLOWED[pkg] ?? []).some((re) => re.test(s))) {
          fail(f, s, `@m3a/${pkg} may import only ${(ALLOWED[pkg] ?? []).map((r) => r.source).join(", ") || "itself"}; add a dependency deliberately, with a decision`);
        } else if (s === "@supabase/supabase-js" && !f.startsWith("packages/tools/src/intake/")) {
          fail(f, s, "only the IntakeStore in packages/tools/src/intake/ imports the Supabase client (§5.9)");
        }
      } else if (app) {
        const deep = /^@m3a\/[^/]+\/(?!node$)/.test(s) || (target !== null && target.startsWith("packages/"));
        if (deep) {
          if (isLab) reachPasts.push(`${f} -> ${s}`);
          else fail(f, s, "apps and the benchmark use only the packages' public entries (@m3a/<name> or @m3a/<name>/node)");
        }
      }
    }
  }
  return { findings, reachPasts };
}
