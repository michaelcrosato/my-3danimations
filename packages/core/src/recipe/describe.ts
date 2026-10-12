// A recipe in a line (PLAN.md WP-6.1): what it makes and each step in a few words, within 100 tokens as tokenCount
// counts them (no fewer than cl100k or o200k); past that, the steps left out are counted. It reads the recipe alone,
// so it explains one before it compiles.
import type { Recipe, Step } from "./types.ts";

/** Most tokens the text may have. */
const BUDGET = 100;
/**
 * A count of tokens no lower than a tokenizer's on the lines describe writes (cl100k and o200k, checked over the
 * example recipes, every library id and made-up names such as Walka_Walkb; a run of random letters can count higher):
 * a word split at its capitals, a lower-case run a token every three letters, an upper-case run one every two
 * (STYLE100 and the like break up small), a number one every three digits, a space before a number one, any other
 * mark one.
 */
export function tokenCount(s: string): number {
  let n = 0;
  for (const x of s.match(/[A-Z]{2,}(?![a-z])|[A-Z]?[a-z]+|[A-Z]|\d+|\s(?=\d)|[^\sA-Za-z\d]/g) ?? []) n += /^\d/.test(x) ? Math.ceil(x.length / 3) : /^[A-Z]{2,}$/.test(x) ? Math.ceil(x.length / 2) : /^[A-Za-z]/.test(x) ? Math.ceil(x.length / 3) : 1;
  return n;
}

const span = (s: Step) => (s.from !== undefined || s.to !== undefined ? ` ${s.from ?? 0}–${s.to ?? "end"} s` : "");
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const masked = (m: unknown) => (m === undefined ? "" : typeof m === "string" ? ` (${m})` : Array.isArray(m) ? ` (${m.join("+")})` : ` (${Object.keys(m as object).join("+")})`);

/** One step in a few words. */
function stepText(s: Step): string {
  switch (s.op) {
    case "clip":
      return `${s.id}${s.from !== undefined || s.to !== undefined ? ` ${s.from ?? 0}–${s.to ?? "end"} s` : ""}${s.loop ? " looped" : ""}`;
    case "sequence":
      return `${(s.items as string[]).join(" → ")}${s.sync ? " in step" : ""}`;
    case "blend":
      return `${s.a} ${typeof s.w === "number" ? `${Math.round((s.w as number) * 100)}%` : "by a curve"} toward ${s.b}`;
    case "layer":
      return `${s.over} ${s.additive ? "added on" : "over"} ${s.base}${masked(s.mask)}`;
    case "mirror":
      return `${s.in} mirrored`;
    case "retime":
      return `${s.in} ${s.speed !== undefined ? `×${s.speed}` : s.dur !== undefined ? `to ${s.dur} s` : `eased ${s.ease}`}`;
    case "pose": {
      const moves = Object.entries(s).filter(([k]) => !["op", "as", "in", "from", "to", "fade"].includes(k)).map(([f, v]) => (typeof v === "number" ? `${f} ${signed(v)}` : Object.entries(v as Record<string, number>).map(([p, x]) => `${f} ${p} ${signed(x)}`).join(", ")));
      return `${moves.join(", ")}${span(s)}`;
    }
    case "look":
      return `looks at ${(s.at as number[]).join(",")}${span(s)}`;
    case "pin":
      return `${s.end} on a ${(s.path as unknown[]).length}-point path`;
    case "exaggerate":
    case "overshoot":
    case "stiffen":
      return `${s.op} ${s.amount}${masked(s.mask)}`;
    case "smooth":
      return `smoothed over ${s.window} s${masked(s.mask)}`;
    case "events":
      return `+${(s.add as { name: string }[]).map((e) => e.name).join(", ")}`;
    case "contacts":
      return `+contacts ${Object.keys(s.add as object).join(", ")}`;
  }
  return s.op;
}

/** The recipe in at most 100 tokens: its id, then its steps; the later ones counted when they don't fit. */
export function describeRecipe(r: Recipe): string {
  const head = `${r.id}: `, parts = r.steps.map(stepText), more = (n: number) => (n ? `; … ${n} more step${n === 1 ? "" : "s"}` : "");
  let k = parts.length, body = head + parts.join("; ");
  while (tokenCount(body + more(parts.length - k)) > BUDGET && k > 1) body = head + parts.slice(0, --k).join("; ");
  // a first step too long for the line (a long id) is cut at a word (a long word a few letters at a time), still counted
  let text = body + more(parts.length - k);
  while (tokenCount(text) > BUDGET) {
    const cut = body.lastIndexOf(" ");
    body = cut > 0 ? body.slice(0, cut) : body.slice(0, Math.max(0, body.length - 8));
    text = `${body} …${more(parts.length - k)}`;
  }
  return text;
}
