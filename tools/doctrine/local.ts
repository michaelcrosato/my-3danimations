// Doctrine check, D10: the local lane. Nothing under library/local/ but its README.md is committed, and no shipped
// set (library/sets/) has the `local` tier or refers to library/local/.
import type { Ctx, Finding } from "./context.ts";

/** Check the local lane; returns findings. */
export function checkLocal(ctx: Ctx): Finding[] {
  const findings: Finding[] = [];
  for (const f of ctx.files) {
    if (f.startsWith("library/local/") && f !== "library/local/README.md") {
      findings.push({ check: "local", message: `${f} is committed, but library/local/ never ships: keep it in the git-ignored lane (D10)` });
    }
    if (f.startsWith("library/sets/") && /\.(json|tsv|md)$/.test(f)) {
      const text = ctx.read(f);
      if (text.includes("library/local/")) findings.push({ check: "local", message: `${f} refers to library/local/: a shipped set never depends on the local lane` });
      if (f.endsWith("/_set.json") && /"tier"\s*:\s*"local"/.test(text)) findings.push({ check: "local", message: `${f} has tier "local": move the set under library/local/` });
    }
  }
  return findings;
}
