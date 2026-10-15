// The output contract (PLAN.md §5.6): one Reply for every surface, with a fixed schema (report.json on the CLI,
// structuredContent on MCP, the value the API and the console handle resolve to); its text, verdict first in at most 20
// lines with the details on request and a `next` hint last; images with their size and approximate token cost; and the
// exit code of each status.
import type { Schema } from "./schema.ts";

/** The reply schema's identifier, the first field of every reply and report.json. */
export const REPLY_ID = "m3a.reply/1";

/** ok (exit 0); findings: the tool found problems (1); error: it could not finish (1); usage: the call was wrong (2). */
export type Status = "ok" | "findings" | "error" | "usage";

/** The exit code of each status. */
export const EXIT: Readonly<Record<Status, number>> = { ok: 0, findings: 1, error: 1, usage: 2 };

/** An image a reply carries: its name, size, approximate token cost, PNG bytes and path (null where a surface has none). */
export interface ImageRef {
  name: string;
  width: number;
  height: number;
  tokens: number;
  bytes: number | null;
  path: string | null;
}

/** Every reply, on every surface. */
export interface Reply<D = unknown> {
  schema: typeof REPLY_ID;
  tool: string;
  status: Status;
  verdict: string;
  lines: string[];
  data: D | null;
  images: ImageRef[];
  revision: string | null;
  error: { code: string; message: string } | null;
  next: string;
}

const str: Schema = { type: "string" }, int: Schema = { type: "integer" }, orNull = (s: Schema): Schema => ({ anyOf: [s, { type: "null" }] });

/** The JSON Schema of a reply whose `data` (a JSON object) follows `data`: MCP's outputSchema. Nullable fields are
 *  anyOf with null, each branch of one type, the most portable spelling (the MCP Inspector's --strict). */
export function replySchema(data: Schema = { type: "object", additionalProperties: true }): Schema {
  const image: Schema = { type: "object", properties: { name: str, width: int, height: int, tokens: int, bytes: orNull(int), path: orNull(str) }, required: ["name", "width", "height", "tokens", "bytes", "path"] };
  const error = orNull({ type: "object", properties: { code: str, message: str }, required: ["code", "message"] });
  const properties: Record<string, Schema> = {
    schema: { type: "string", enum: [REPLY_ID] },
    tool: str,
    status: { type: "string", enum: ["ok", "findings", "error", "usage"] },
    verdict: str,
    lines: { type: "array", items: str },
    data: orNull(data),
    images: { type: "array", items: image },
    revision: orNull(str),
    error,
    next: str,
  };
  return { type: "object", properties, required: Object.keys(properties) };
}

/** About how many tokens a model spends to see an image: (w × h) / 750 after the downscale to at most 1568 px a side and
 *  about 1.15 megapixels (Anthropic's published rule; other models' costs are of the same order). */
export function imageTokens(width: number, height: number): number {
  const s = Math.min(1, 1568 / Math.max(width, height), Math.sqrt(1_150_000 / (width * height)));
  return Math.ceil((Math.round(width * s) * Math.round(height * s)) / 750);
}

/** One line for an image: name, size, bytes, token cost and path. */
export function imageLine(i: ImageRef): string {
  const size = i.bytes === null ? "" : `, ${i.bytes < 1024 ? `${i.bytes} B` : `${(i.bytes / 1024).toFixed(1)} kB`} PNG`;
  return `image ${i.name}: ${i.width}x${i.height}${size}, ~${i.tokens} tokens${i.path ? `: ${i.path}` : ""}`;
}

/** The most lines a reply's text takes unless the details are asked for. */
export const MAX_LINES = 20;

/** A reply as text: the verdict, the details (cut to fit 20 lines unless `verbose`; `more` says how to ask for the
 *  rest), one line per image (past 10, one line for them all unless `verbose`), the report's path when written, and
 *  `next:` last. */
export function render(r: Reply, opts: { verbose?: boolean; more?: string; report?: string } = {}): string {
  const dir = r.images[0]?.path?.replace(/[^/]*$/, ""), all = `${r.images.length} images, ~${r.images.reduce((n, i) => n + i.tokens, 0)} tokens in all${dir ? `: ${dir}` : ""}`;
  const images = !opts.verbose && r.images.length > 10 ? [`${all} (to list each: ${opts.more ?? "ask with verbose"})`] : r.images.map(imageLine);
  const tail = [...images, ...(opts.report ? [`report: ${opts.report}`] : []), `next: ${r.next}`];
  let body = [r.verdict, ...r.lines];
  const room = Math.max(2, MAX_LINES - tail.length);
  if (!opts.verbose && body.length > room) {
    const cut = body.length - room + 1;
    body = [...body.slice(0, room - 1), `... ${cut} more line${cut === 1 ? "" : "s"}: ${opts.more ?? "ask with verbose"}`];
  }
  return [...body, ...tail].join("\n");
}
