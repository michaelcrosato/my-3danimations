// Doctrine check, principle 1: the token and line budgets. Tokens are cl100k, counted with the pinned gpt-tokenizer.
// The manual (packages/tools/MANUAL.md) at most 8,000; the legend with one worked key (spec/LEGEND.md) at most 800;
// every catalog row (library/sets/*/catalog.tsv) at most 40; docs/PROGRESS.md at most 40 lines. A file not written
// yet is skipped and reported as pending.
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import type { Ctx, Finding } from "./context.ts";

/** cl100k tokens in a text. */
export function tokens(text: string): number {
  return encode(text).length;
}

/** A budget: a whole file in tokens or lines, or each row of matching files in tokens. */
export interface Budget {
  name: string;
  match: RegExp;
  unit: "tokens" | "lines" | "row-tokens";
  max: number;
}

/** The budgets of DOCTRINE.md principle 1. */
export const BUDGETS: Budget[] = [
  { name: "the manual", match: /^packages\/tools\/MANUAL\.md$/, unit: "tokens", max: 8000 },
  { name: "the legend with one worked key", match: /^spec\/LEGEND\.md$/, unit: "tokens", max: 800 },
  { name: "catalog rows", match: /^library\/sets\/[^/]+\/catalog\.tsv$/, unit: "row-tokens", max: 40 },
  { name: "the progress page", match: /^docs\/PROGRESS\.md$/, unit: "lines", max: 40 },
];

/** Measure every budget; returns findings and one summary line per budget. */
export function checkBudgets(ctx: Ctx, budgets: Budget[] = BUDGETS): { findings: Finding[]; lines: string[] } {
  const findings: Finding[] = [];
  const lines: string[] = [];
  for (const b of budgets) {
    const files = ctx.files.filter((f) => b.match.test(f));
    if (!files.length) {
      lines.push(`${b.name}: pending (not written yet)`);
      continue;
    }
    let worst = 0;
    for (const f of files) {
      const text = ctx.read(f);
      if (b.unit === "row-tokens") {
        const rows = text.split("\n").filter((r) => r.trim() !== "");
        rows.forEach((row, i) => {
          const n = tokens(row);
          worst = Math.max(worst, n);
          if (n > b.max) findings.push({ check: "budgets", message: `${f} row ${i + 1} is ${n} tokens, over ${b.max}: shorten its tags or description` });
        });
      } else {
        const n = b.unit === "lines" ? text.replace(/\n$/, "").split("\n").length : tokens(text);
        worst = Math.max(worst, n);
        if (n > b.max) findings.push({ check: "budgets", message: `${f} is ${n} ${b.unit}, over its budget of ${b.max}: cut it, or change the budget by a decision` });
      }
    }
    lines.push(`${b.name}: ${worst} of ${b.max} ${b.unit === "lines" ? "lines" : "tokens"}${b.unit === "row-tokens" ? " (worst row)" : ""}`);
  }
  return { findings, lines };
}
