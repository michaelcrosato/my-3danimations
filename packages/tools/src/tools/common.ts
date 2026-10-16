// What the m3a tools share (PLAN.md WP-7.2): the clip parameter, capped rows, counts, the fixed units (mm with no
// decimals, seconds with 3), strings cut for rows, and "a file or JSON" arguments read one way everywhere.
import { ToolError, type ToolContext } from "../registry/registry.ts";
import { quote, type Schema } from "../registry/schema.ts";

/** The clip parameter of every clip tool. A WORKSHOP/<Name> id and the clip's JSON are taken too (clips.ts). */
export const CLIP: Schema = { type: "string", description: "SET/Name or a .json path" };

/** The most characters a string in a row takes. */
export const ROW_CHARS = 90;

/** `rows` cut to the first `n`; `more` says how many were cut, and is there only when some were. */
export function capped<T>(rows: readonly T[], n: number): { rows: T[]; more?: number } {
  return rows.length > n ? { rows: rows.slice(0, n), more: rows.length - n } : { rows: [...rows] };
}

/** A count and its word, plural unless one: "1 clip", "3 clips". */
export const count = (n: number, word: string, plural = `${word}s`): string => `${n} ${n === 1 ? word : plural}`;

/** `v` rounded to `d` decimals, never -0. */
export function round(v: number, d = 0): number {
  const f = 10 ** d, r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
}

/** A length in whole mm: "930 mm". */
export const mm = (v: number): string => `${round(v)} mm`;

/** A time in seconds with 3 decimals: "1.533 s". */
export const sec = (v: number): string => `${round(v, 3).toFixed(3)} s`;

/** `text` cut to `n` characters (a row's 90 by default), "..." ending a cut. */
export const cut = (text: string, n = ROW_CHARS): string => (text.length > n ? `${text.slice(0, n - 3)}...` : text);

/**
 * A "file or JSON" argument: JSON text (starting with { or [) as given, else the file it names, read and parsed; `what`
 * names it in a refusal (E_JSON: usage for text given inline, an error for a file).
 */
export async function fileOrJson(ctx: ToolContext, value: string, what: string): Promise<{ data: unknown; text: string; path: string | null }> {
  const inline = /^\s*[[{]/.test(value), text = inline ? value : await ctx.read(value);
  try {
    return { data: JSON.parse(text) as unknown, text, path: inline ? null : value };
  } catch (err) {
    throw new ToolError("E_JSON", `${inline ? what : `${what} ${quote(value)}`} is not JSON: ${(err as Error).message}`, inline);
  }
}
