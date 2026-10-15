// The JSON Schema subset tool parameters are written in (PLAN.md §5.6) and the one checker every surface shares:
// types, enums, ranges, required names and unknown ones, each refusal naming the closest valid choice ("did you
// mean"). Unknown arguments are errors, never ignored (shardfall's dry run counted silent ones among its 13 frictions).

/** A JSON type name. */
export type SchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

/** A JSON Schema (2020-12) of the keywords tools use; other keywords pass to MCP clients as written, unchecked here. */
export interface Schema {
  type?: SchemaType;
  description?: string;
  properties?: Record<string, Schema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: Schema;
  enum?: readonly (string | number | boolean | null)[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
  anyOf?: readonly Schema[];
  examples?: readonly unknown[];
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

/** The candidate closest to `word` by edit distance (the first of equals), or undefined when there is none. */
export function closest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined, bestD = Infinity;
  for (const c of candidates) {
    const d = distance(word.toLowerCase(), c.toLowerCase());
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

/** `; did you mean "x"?` for the closest candidate, or "" when there are none. */
export function didYouMean(word: string, candidates: readonly string[]): string {
  const c = closest(word, candidates);
  return c === undefined ? "" : `; did you mean "${c}"?`;
}

const typeOf = (v: unknown): SchemaType | "undefined" | "function" | "bigint" | "symbol" =>
  v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
const fits = (t: string, want: SchemaType) => t === want || (want === "number" && t === "integer");
const shown = (v: unknown) => (typeof v === "string" ? JSON.stringify(v) : typeOf(v));

/** Checks `value` against `schema`; returns the first problem as one sentence naming where it is, or undefined. */
export function check(value: unknown, schema: Schema, at = "arguments"): string | undefined {
  const here = (name: string) => (at === "arguments" ? name : `${at}.${name}`);
  if (schema.anyOf && !schema.anyOf.some((s) => check(value, s, at) === undefined)) return `${at} matches none of its ${schema.anyOf.length} forms`;
  const t = typeOf(value);
  if (schema.type && !fits(t, schema.type)) return `${at} should be ${schema.type === "integer" ? "an integer" : schema.type === "array" || schema.type === "object" ? `an ${schema.type}` : `a ${schema.type}`}, not ${shown(value)}`;
  if (schema.enum && !schema.enum.includes(value as never)) return `${at} is ${JSON.stringify(value)}, not one of ${schema.enum.join(", ")}${typeof value === "string" ? didYouMean(value, schema.enum.map(String)) : ""}`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return `${at} is ${value}; give a finite number`;
    if (schema.minimum !== undefined && value < schema.minimum) return `${at} is ${value}, below its minimum ${schema.minimum}`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${at} is ${value}, above its maximum ${schema.maximum}`;
  }
  if (t === "array" && schema.items) {
    for (const [i, x] of (value as unknown[]).entries()) {
      const p = check(x, schema.items, `${at}[${i}]`);
      if (p) return p;
    }
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>, props = schema.properties ?? {}, names = Object.keys(props);
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(obj)) {
        if (!(k in props)) return `unknown ${at === "arguments" ? "argument" : `field in ${at}`} "${k}"${didYouMean(k, names)} (${names.length ? `takes ${names.join(", ")}` : "takes none"})`;
      }
    }
    for (const r of schema.required ?? []) if (obj[r] === undefined) return `${here(r)} is required${props[r]?.description ? `: ${props[r].description}` : ""}`;
    for (const [k, s] of Object.entries(props)) {
      const p = obj[k] === undefined ? undefined : check(obj[k], s, here(k));
      if (p) return p;
    }
  }
  return undefined;
}
