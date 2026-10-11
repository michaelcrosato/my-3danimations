// Validator findings and their messages: at most two lines, the first naming the clip, the key, the time and the field
// (`M2-E014 Walk_Loop key 7 (t 0.233) armL[3]: bend 191 is outside 0..180`), the second the fix.
import { rule, type Severity } from "./rules.ts";

/** Where a finding is: the clip, the key (1-based, as people count) and its time, the field and the index. */
export interface Where {
  clip?: string;
  key?: number;
  t?: number;
  field?: string;
  index?: number;
}

/** One finding. */
export interface Issue extends Where {
  code: string;
  severity: Severity;
  message: string;
  fix?: string;
}

/** The outcome of a validation: ok when there are no errors (warnings don't fail). */
export interface Result {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

/** Collects findings for one validation. */
export class Findings {
  readonly issues: Issue[] = [];
  /** Record a finding under `code`, at `where`. */
  add(code: string, where: Where, message: string, fix?: string): void {
    this.issues.push({ code, severity: rule(code).severity, ...where, message: message.replace(/\s*\n\s*/g, " "), ...(fix ? { fix: fix.replace(/\s*\n\s*/g, " ") } : {}) });
  }
  /** The result: errors and warnings apart. */
  result(): Result {
    const errors = this.issues.filter((i) => i.severity === "error");
    return { ok: errors.length === 0, errors, warnings: this.issues.filter((i) => i.severity === "warning") };
  }
}

/** A finding as at most two lines of text. */
export function formatIssue(i: Issue): string {
  const at = [i.clip, i.key !== undefined ? `key ${i.key}${i.t !== undefined ? ` (t ${i.t})` : ""}` : undefined].filter(Boolean).join(" ");
  const field = i.field !== undefined ? `${i.field}${i.index !== undefined ? `[${i.index}]` : ""}` : "";
  const head = `${i.code}${at ? ` ${at}` : ""}${field ? ` ${field}` : ""}: ${i.message}`;
  return i.fix ? `${head}\n  fix: ${i.fix}` : head;
}

/** The nearest of `names` to `word` by edit distance, for "did you mean" hints; undefined when none is close. */
export function nearest(word: string, names: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestD = Math.max(2, Math.floor(word.length / 3)) + 1;
  for (const n of names) {
    const d = distance(word.toLowerCase(), n.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}
