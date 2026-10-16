// What the m3a tools share (PLAN.md WP-7.2): the clip parameter, capped rows and the one line that says what a cap
// cut, counts, the fixed units (mm with no decimals, seconds with 3), the one arrow from before to after, strings cut
// for rows, image names a file system takes, the one form a next hint writes a call in (`call`), each tool's minimal
// output schema, "a file or JSON" arguments read one way everywhere, and the absolute paths no reply echoes. Every tool
// names the clip in its data `clip`.
import { recipe } from "@m3a/core";
import { ToolError, type ToolContext } from "../registry/registry.ts";
import { quote, type Schema, type SchemaType } from "../registry/schema.ts";

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

/** The one line a capped list ends with when its cap cut some: "more: 3 findings", and in brackets how to see them
 *  (`rest`, a call) when one does; none when nothing was cut. */
export const more = (n: number | undefined, what: string, rest?: string, plural?: string): string[] => (n ? [`more: ${count(n, what, plural)}${rest ? ` (${rest})` : ""}`] : []);

/** The one arrow replies write from a value before to one after ("FAIL → PASS"), as the sensors' text does. */
export const ARROW = "→";

/** An image's name for a clip id or two (diff's "a-vs-b"): as is up to 100 characters, else its first 80 and 12 hex
 *  digits of its SHA-256, so a long id still makes a file name the file system takes. */
export const imageName = (name: string): string => (name.length <= 100 ? name : `${name.slice(0, 80)}-${recipe.sha256(name).slice(0, 12)}`);

/** A tool's minimal output schema: its data's top-level fields, each there on every reply, with its JSON type ("?"
 *  after it when it may be null); the registry checks each reply's data against it. */
export function output(fields: Record<string, SchemaType | `${SchemaType}?`>): Schema {
  const one = (t: string): Schema => (t.endsWith("?") ? { anyOf: [{ type: t.slice(0, -1) as SchemaType }, { type: "null" }] } : { type: t as SchemaType });
  return { type: "object", properties: Object.fromEntries(Object.entries(fields).map(([k, t]) => [k, one(t)])), required: Object.keys(fields) };
}

/** `v` rounded to `d` decimals, never -0. */
export function round(v: number, d = 0): number {
  const f = 10 ** d, r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
}

/** A length in whole mm: "930 mm". */
export const mm = (v: number): string => `${round(v)} mm`;

/** A time in seconds with 3 decimals: "1.533 s". */
export const sec = (v: number): string => `${round(v, 3).toFixed(3)} s`;

/** A value as a hint writes it for a shell: as is when the shell keeps it whole, else single-quoted ('' when empty);
 *  one holding a placeholder in angle brackets (`<the clip's JSON>`, `WORKSHOP/<Name>`) as is, for the caller to fill. */
export const arg = (v: string): string => (/^[\w./:=@,+-]*(<[A-Za-z' ]+>)?[\w./:=@,+-]*$/.test(v) && v !== "" ? v : `'${v.replace(/'/g, "'\\''")}'`);

/**
 * A call as a reply's `next` (or a line pointing at one) writes it, one form for every surface: in backticks, as the
 * m3a command takes it after "m3a": the tool, its positionals, then `--<parameter> <value>` with the parameter's own
 * name (the CLI also spells it with "-"), a value the shell would split single-quoted (`arg`), an array or object as
 * JSON, a boolean as the bare flag or `--<parameter>=false`, an undefined one left out. On MCP and in the API the same
 * names are the arguments: `show X --from 0.733` is show {clip: "X", from: 0.733}. A part in angle brackets (`<the
 * clip's JSON>`, `WORKSHOP/<Name>`, `<seconds>`) is the caller's to fill. Positionals come as written (a clip as
 * clips.ts's naming gives it). A flag alone in backticks (`--if_revision 3f2a...`, `--save_as WORKSHOP/<Name>`) is one
 * to add to the call just made, in the same form; a refusal names a parameter it asks for that way too.
 */
export function call(tool: string, positionals: readonly string[] = [], flags: Record<string, unknown> = {}): string {
  const rest = Object.entries(flags).filter(([, v]) => v !== undefined);
  const flag = ([k, v]: [string, unknown]) => (typeof v === "boolean" ? [v ? `--${k}` : `--${k}=false`] : [`--${k}`, arg(typeof v === "string" ? v : JSON.stringify(v))]);
  return `\`${[tool, ...positionals, ...rest.flatMap(flag)].join(" ")}\``;
}

/** Whether `path` is absolute (a reply never echoes one: it is "the file", or `<the clip's file>` in a hint). */
export const absolute = (path: string): boolean => /^([A-Za-z]:|[\\/])/.test(path);

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
