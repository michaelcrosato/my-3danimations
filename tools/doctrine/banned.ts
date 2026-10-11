// Doctrine check, principle 9: banned APIs, the stale calls agents reach for out of habit. WP-4.1 fills BANNED with
// the three.js APIs removed or renamed before the pinned release; any WP may add one with a reason.
import type { Ctx, Finding } from "./context.ts";

/** A banned API: a pattern, where it is banned (path prefixes; empty means everywhere), and what to use instead. */
export interface Ban {
  pattern: RegExp;
  where: string[];
  use: string;
}

/** The banned APIs. */
export const BANNED: Ban[] = [];

/** Every use of a banned API in source and Markdown files (the manual's examples count). */
export function checkBanned(ctx: Ctx, bans: Ban[] = BANNED): Finding[] {
  const findings: Finding[] = [];
  const files = ctx.files.filter((f) => /\.(ts|js|mjs|tsx|md|html)$/.test(f) && !f.startsWith("tools/doctrine/") && f !== "PLAN.md" && !f.startsWith("docs/") && !f.startsWith("research_notes/") && !f.startsWith("reports/"));
  for (const ban of bans) {
    for (const f of files) {
      if (ban.where.length && !ban.where.some((w) => f.startsWith(w))) continue;
      const lines = ctx.read(f).split("\n");
      lines.forEach((line, i) => {
        if (ban.pattern.test(line)) findings.push({ check: "banned", message: `${f}:${i + 1} uses ${ban.pattern.source}: ${ban.use}` });
      });
    }
  }
  return findings;
}
