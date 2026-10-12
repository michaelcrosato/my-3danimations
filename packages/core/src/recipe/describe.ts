// A recipe in a line (PLAN.md WP-6.1): what it makes and each step in a few words, within 100 tokens; past that, the
// steps left out are counted. It reads the recipe alone, so it explains one before it compiles.
import type { Recipe, Step } from "./types.ts";

/** Most characters the text may have: 100 tokens at the 3 characters a token the shortest English text runs to. */
const BUDGET = 300;

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
  const head = `${r.id}: `, parts = r.steps.map(stepText);
  let text = head + parts.join("; ");
  for (let k = parts.length - 1; text.length > BUDGET && k > 0; k--) text = `${head}${parts.slice(0, k).join("; ")}; … ${parts.length - k} more steps`;
  return text.length > BUDGET ? `${text.slice(0, BUDGET - 1)}…` : text;
}
