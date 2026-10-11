// Deterministic JSON for the vectors (used by tools/vectors to write them and by the conformance tests to hash): keys in insertion order, numbers as the shortest decimal that parses back to the
// same double with `-0` kept (JSON.stringify writes -0 as 0), arrays of primitives on one line, everything else one
// entry per line. The same value always gives the same bytes, so `npm run vectors -- --check` compares bytes.

/** A number as the shortest round-trip decimal, keeping the sign of zero. */
export function num(v: number): string {
  if (!Number.isFinite(v)) throw new Error(`vectors hold finite numbers only, got ${v}`);
  return Object.is(v, -0) ? "-0" : String(v);
}

const isPrim = (v: unknown) => v === null || typeof v !== "object";

/** Serialize a JSON value deterministically (see the header). */
export function stringify(value: unknown, indent = ""): string {
  if (value === null) return "null";
  if (typeof value === "number") return num(value);
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (ArrayBuffer.isView(value)) return stringify(Array.from(value as unknown as ArrayLike<number>), indent);
  const inner = indent + " ";
  if (Array.isArray(value)) {
    if (value.every(isPrim)) return `[${value.map((v) => stringify(v)).join(",")}]`;
    return `[\n${value.map((v) => inner + stringify(v, inner)).join(",\n")}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  if (!entries.length) return "{}";
  if (entries.every(([, v]) => isPrim(v)) && entries.length <= 8) return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stringify(v)}`).join(",")}}`;
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${stringify(v, inner)}`).join(",\n")}\n${indent}}`;
}
