// Where a review's notes go (PLAN.md WP-8.2): its points into docs/FEEDBACK-LOG.md in the log's own format (a new
// source `### F<n> · <date> · <title>`, one `**F<n>.<k>** (theme, status)` line a point, and the themes table counting
// the source on each theme's row, a new theme getting a row), and threshold and task proposals into
// docs/REVIEW-PROPOSALS.md, a list for the next WP. Pure text in, text out: a point or proposal already in its file is
// not written again, so applying a review twice adds nothing.

/** A point for the feedback log: its theme, its status (the log's three) and its text. */
export interface Point {
  theme: string;
  status: "no" | "deferred" | "watch";
  text: string;
}

/** A proposal for the next WP: a threshold to weigh or a task to do, and its text (naming the clip it is about). */
export interface Proposal {
  kind: "threshold" | "task";
  text: string;
}

/** The two files a review writes besides the store and the clips. */
export const DOCS = { log: "docs/FEEDBACK-LOG.md", proposals: "docs/REVIEW-PROPOSALS.md" } as const;

/** `text` wrapped at 118 columns, the lines after the first indented two spaces, as the log's points are. */
function wrap(text: string, width = 118): string {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > width) {
      out.push(line);
      line = `  ${w}`;
    } else line = line ? `${line} ${w}` : w;
  }
  return [...out, line].join("\n");
}

/** A theme as the table names it (its first letter upper case) and as a point does (lower case, unless it opens with
 *  an abbreviation: "WP sizes"). */
const asRow = (t: string) => t.charAt(0).toUpperCase() + t.slice(1), asPoint = (t: string) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));

/** Whether `file` holds `text` already, whitespace (a wrap) aside. */
const holds = (file: string, text: string) => file.replace(/\s+/g, " ").includes(text.replace(/\s+/g, " "));

/**
 * The feedback log with `points` appended as source F<n> (the next number), dated `date` and titled `title`, each
 * point's theme counted on its row of the themes table (a theme the table lacks gets a row); points the log holds
 * already are left out, and with none left the log comes back unchanged with `source` null.
 */
export function withPoints(log: string, points: readonly Point[], date: string, title: string): { text: string; source: string | null; added: number } {
  const fresh = points.filter((p) => !holds(log, p.text));
  if (!fresh.length) return { text: log, source: null, added: 0 };
  const n = Math.max(0, ...[...log.matchAll(/^### F(\d+) /gm)].map((m) => Number(m[1]))) + 1, src = `F${n}`;
  const lines = log.replace(/\n*$/, "\n").split("\n"), start = lines.indexOf("## Themes"), end = lines.indexOf("## Sources");
  for (const theme of [...new Set(fresh.map((p) => p.theme))]) {
    if (start < 0 || end < start) break;
    const at = lines.findIndex((l, i) => i > start && i < end && l.startsWith("| ") && l.split("|")[1]!.trim().toLowerCase() === theme.toLowerCase());
    if (at >= 0) {
      const cells = lines[at]!.split("|");
      if (!cells[3]!.split(",").map((c) => c.trim()).includes(src)) cells[3] = ` ${cells[3]!.trim()}, ${src} `;
      lines[at] = cells.join("|");
    } else {
      const last = lines.findLastIndex((l, i) => i > start && i < end && l.startsWith("| "));
      lines.splice(last + 1, 0, `| ${asRow(theme)} | ${fresh.find((p) => p.theme === theme)!.status} | ${src} | When it reaches three sources, or two from different model families |`);
    }
  }
  const body = fresh.map((p, i) => wrap(`- **${src}.${i + 1}** (${asPoint(p.theme)}, ${p.status}) ${p.text}`));
  return { text: `${lines.join("\n").replace(/\n*$/, "\n")}\n### ${src} · ${date} · ${title}\n\n${body.join("\n")}\n`, source: src, added: fresh.length };
}

/** The proposals list's text when it doesn't exist yet. */
export const PROPOSALS_HEAD = `# Review proposals

Threshold and task proposals from the owner's reviews (\`m3a review\`, PLAN.md WP-8.2), for the next WP that touches
them: one line each, newest last, with the review's date. \`m3a review\` appends them; a proposal taken up is marked
**Taken up in v0.x.y** and kept, as docs/FEEDBACK-LOG.md's points are.
`;

/** The proposals list with `proposals` appended under `date`, those it holds already left out. */
export function withProposals(list: string | null, proposals: readonly Proposal[], date: string): { text: string; added: number } {
  const was = list ?? PROPOSALS_HEAD, fresh = proposals.filter((p) => !holds(was, `${p.kind} · ${p.text}`));
  const text = fresh.length ? `${was.replace(/\n*$/, "\n")}${was === PROPOSALS_HEAD ? "\n" : ""}${fresh.map((p) => wrap(`- ${date} · ${p.kind} · ${p.text}`)).join("\n")}\n` : was;
  return { text, added: fresh.length };
}
