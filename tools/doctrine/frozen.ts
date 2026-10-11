// Doctrine check, principle 12 (the contract): the frozen spec. Gate G1 froze spec 2.0-rc; spec/frozen.json records the
// SHA-256 of each frozen file. A frozen file changes only in a commit that also rewrites spec/frozen.json
// (`node tools/doctrine/freeze.ts`) and logs the decision that allowed it.
import { createHash } from "node:crypto";
import type { Ctx, Finding } from "./context.ts";

/** spec/frozen.json: the frozen version and each frozen file's SHA-256. */
export interface Frozen {
  about: string;
  version: string;
  decision: string;
  files: Record<string, string>;
}

/** Every frozen file that is missing or differs from its recorded SHA-256. */
export function checkFrozen(ctx: Ctx): { findings: Finding[]; lines: string[] } {
  if (!ctx.files.includes("spec/frozen.json")) return { findings: [], lines: ["no frozen spec yet"] };
  const fz = JSON.parse(ctx.read("spec/frozen.json")) as Frozen;
  const findings: Finding[] = [];
  for (const [path, sha] of Object.entries(fz.files)) {
    if (!ctx.files.includes(path)) findings.push({ check: "frozen", message: `${path} is frozen (spec ${fz.version}) but missing` });
    else if (createHash("sha256").update(ctx.read(path)).digest("hex") !== sha) findings.push({ check: "frozen", message: `${path} changed, but spec ${fz.version} is frozen: log a decision, then run node tools/doctrine/freeze.ts <decision> in the same commit` });
  }
  return { findings, lines: [`spec ${fz.version}: ${Object.keys(fz.files).length} files frozen (${fz.decision})`] };
}
