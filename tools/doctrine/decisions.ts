// Doctrine check, process: docs/DECISIONS.md is append-only against main. Every entry (`## D<n>`) on main is still
// there, and ids are unique. Entries inside fenced code blocks (the template) don't count.
import type { Ctx, Finding } from "./context.ts";

const LOG = "docs/DECISIONS.md";

/** The entry ids in a decisions log, outside code fences, in order. */
export function entryIds(text: string): string[] {
  const ids: string[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const m = !fenced && /^## (D\d+)\b/.exec(line);
    if (m) ids.push(m[1]!);
  }
  return ids;
}

/** Compare the log with main's copy; returns findings and a summary line. */
export function checkDecisions(ctx: Ctx): { findings: Finding[]; lines: string[] } {
  const findings: Finding[] = [];
  if (!ctx.files.includes(LOG)) return { findings: [{ check: "decisions", message: `${LOG} is missing` }], lines: [] };
  const now = entryIds(ctx.read(LOG));
  const seen = new Set<string>();
  for (const id of now) {
    if (seen.has(id)) findings.push({ check: "decisions", message: `${LOG} has ${id} twice: number the new entry after the last one` });
    seen.add(id);
  }
  const before = ctx.atMain(LOG);
  if (before === null) return { findings, lines: [`${now.length} entries (no copy on main to compare with)`] };
  const gone = entryIds(before).filter((id) => !seen.has(id));
  for (const id of gone) findings.push({ check: "decisions", message: `${LOG} lost ${id}: the log is never cleaned up; mark an entry "Superseded by D<n>" instead` });
  return { findings, lines: [`${now.length} entries, ${gone.length ? `${gone.length} removed` : "none removed"} since main`] };
}
