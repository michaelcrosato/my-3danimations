// Doctrine check, principle 12 (the contract): the frozen spec. Gate G1 froze spec 2.0-rc; spec/frozen.json records the
// SHA-256 of each frozen file. A frozen file changes only in a commit that also rewrites spec/frozen.json
// (`node tools/doctrine/freeze.ts`) and logs the decision that allowed it. The check also fails when the record is
// gone, when a file joins the frozen set (a new schema) without being recorded, or when the decision isn't logged.
import { createHash } from "node:crypto";
import type { Ctx, Finding } from "./context.ts";

/** spec/frozen.json: the frozen version, the decision that last recorded it, and each frozen file's SHA-256. */
export interface Frozen {
  about: string;
  version: string;
  decision: string;
  files: Record<string, string>;
}

/** The files the freeze covers, of `files`: the motion and skeleton specs, the legend, the tiers' tolerances, the schemas. */
export function frozenPaths(files: readonly string[]): string[] {
  const fixed = ["spec/MOTION.md", "spec/SKELETON.md", "spec/LEGEND.md", "spec/conformance/tiers.md"];
  return [...fixed.filter((f) => files.includes(f)), ...files.filter((f) => /^spec\/schemas\/[^/]+\.json$/.test(f)).sort()];
}

/** Every frozen file that is missing, unrecorded or differs from its recorded SHA-256. */
export function checkFrozen(ctx: Ctx): { findings: Finding[]; lines: string[] } {
  const findings: Finding[] = [];
  const add = (message: string) => findings.push({ check: "frozen", message });
  if (!ctx.files.includes("spec/frozen.json")) {
    if (ctx.files.includes("spec/MOTION.md")) add("spec/frozen.json is missing, but the spec has been frozen since gate G1 (D31): restore it, or log a decision and run node tools/doctrine/freeze.ts <decision>");
    return { findings, lines: ["no frozen spec yet"] };
  }
  const fz = JSON.parse(ctx.read("spec/frozen.json")) as Frozen;
  for (const [path, sha] of Object.entries(fz.files)) {
    if (!ctx.files.includes(path)) add(`${path} is frozen (spec ${fz.version}) but missing`);
    else if (createHash("sha256").update(ctx.read(path)).digest("hex") !== sha) add(`${path} changed, but spec ${fz.version} is frozen: log a decision, then run node tools/doctrine/freeze.ts <decision> in the same commit`);
  }
  for (const path of frozenPaths(ctx.files)) if (!(path in fz.files)) add(`${path} is part of the frozen spec but not recorded in spec/frozen.json: log a decision, then run node tools/doctrine/freeze.ts <decision>`);
  if (ctx.files.includes("docs/DECISIONS.md") && !new RegExp(`^## ${fz.decision} `, "m").test(ctx.read("docs/DECISIONS.md"))) add(`spec/frozen.json names decision ${fz.decision}, which docs/DECISIONS.md doesn't log`);
  return { findings, lines: [`spec ${fz.version}: ${Object.keys(fz.files).length} files frozen (${fz.decision})`] };
}
