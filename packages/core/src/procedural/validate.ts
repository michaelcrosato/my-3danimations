// The moves file's validator (PLAN.md WP-6.2, D71): library/moves.json is the shape spec/schemas/moves.schema.json
// gives, and these rules say what JSON Schema can't: a name used once, an alternate that names a move the file has, a
// height on the ground plane only, the strike's share and the hold's inside their phase.
import type { RecipeIssue } from "../recipe/validate.ts";

/** The moves rules: each code and what it catches. */
export const MOVES_RULES: Readonly<Record<string, string>> = {
  "MV-E001": "not a moves file: no about or moves",
  "MV-E002": "a field a move needs is missing or of the wrong type",
  "MV-E003": "a value out of range",
  "MV-E004": "a move name used twice, or not a lowercase name",
  "MV-E005": "an alternate that names no move in the file",
  "MV-E006": "an unknown field",
  "MV-E007": "a height on the side plane, or none on the ground plane",
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const NAME = /^[a-z][a-z0-9_]*$/;
const HANDS = ["right", "left", "both", "pair", "kick"], PLANES = ["ground", "side"];
/** Each field a move may have: whether it's required, the JSON type it holds, whether a value is in range, and what it
 *  holds in words. */
const FIELDS: Record<string, { need: boolean; type: string; ok: (v: unknown) => boolean; range: string }> = {
  name: { need: true, type: "string", ok: () => true, range: "a name" },
  about: { need: true, type: "string", ok: (v) => (v as string).length > 0, range: "a line of text" },
  hand: { need: true, type: "string", ok: (v) => HANDS.includes(v as string), range: HANDS.join(", ") },
  plane: { need: true, type: "string", ok: (v) => PLANES.includes(v as string), range: PLANES.join(", ") },
  from: { need: true, type: "number", ok: (v) => isNum(v) && Math.abs(v) <= 720, range: "degrees, -720..720" },
  to: { need: true, type: "number", ok: (v) => isNum(v) && Math.abs(v) <= 720, range: "degrees, -720..720" },
  height: { need: false, type: "object", ok: (v) => Array.isArray(v) && v.length === 2 && v.every((x) => isNum(x) && Math.abs(x) <= 300), range: "[start, end], % of the hip height, -300..300" },
  reach: { need: true, type: "object", ok: (v) => Array.isArray(v) && v.length === 2 && v.every((x) => isNum(x) && x > 0 && x <= 2), range: "[start, end], arm lengths, above 0 and at most 2" },
  windReach: { need: false, type: "number", ok: (v) => isNum(v) && v > 0 && v <= 2, range: "arm lengths, above 0 and at most 2" },
  wind: { need: true, type: "number", ok: (v) => isNum(v) && v > 0 && v <= 5, range: "seconds, above 0 and at most 5" },
  active: { need: true, type: "number", ok: (v) => isNum(v) && v > 0 && v <= 5, range: "seconds, above 0 and at most 5" },
  recover: { need: true, type: "number", ok: (v) => isNum(v) && v > 0 && v <= 5, range: "seconds, above 0 and at most 5" },
  hold: { need: true, type: "number", ok: (v) => isNum(v) && v >= 0 && v < 1, range: "a share, 0 to under 1" },
  hit: { need: true, type: "number", ok: (v) => isNum(v) && v >= 0 && v <= 1, range: "a share, 0..1" },
  lunge: { need: true, type: "number", ok: (v) => isNum(v) && Math.abs(v) <= 100, range: "% of the hip height, -100..100" },
  hop: { need: true, type: "number", ok: (v) => isNum(v) && v >= 0 && v <= 100, range: "% of the hip height, 0..100" },
  crouch: { need: true, type: "number", ok: (v) => isNum(v) && v >= 0 && v <= 1, range: "0..1" },
  lean: { need: true, type: "number", ok: (v) => isNum(v) && Math.abs(v) <= 90, range: "degrees, -90..90" },
  twist: { need: true, type: "number", ok: (v) => isNum(v) && v >= 0 && v <= 2, range: "0..2" },
  spin: { need: true, type: "boolean", ok: (v) => typeof v === "boolean", range: "true or false" },
  trail: { need: true, type: "boolean", ok: (v) => typeof v === "boolean", range: "true or false" },
  guard: { need: false, type: "boolean", ok: (v) => typeof v === "boolean", range: "true or false" },
  alt: { need: false, type: "string", ok: (v) => typeof v === "string", range: "a move's name" },
};

/** Every issue in a moves file (library/moves.json), in order; none means every move can be played. `step` is the move's index. */
export function validateMoves(data: unknown): RecipeIssue[] {
  const o = data as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || Array.isArray(o)) return [{ code: "MV-E001", message: "a moves file is a JSON object", fix: '{ "about": "…", "moves": [ … ] }' }];
  const out: RecipeIssue[] = [];
  if (typeof o.about !== "string") out.push({ code: "MV-E001", field: "about", message: "a moves file says what it holds in about" });
  if (!Array.isArray(o.moves) || !o.moves.length) return [...out, { code: "MV-E001", field: "moves", message: "a moves file has at least one move" }];
  for (const k of Object.keys(o)) if (k !== "about" && k !== "moves") out.push({ code: "MV-E006", field: k, message: `"${k}" is not a moves file's field (about, moves)` });
  const names = new Set<string>(), moves = o.moves as unknown[];
  moves.forEach((m, at) => {
    if (!m || typeof m !== "object" || Array.isArray(m)) return void out.push({ code: "MV-E002", step: at, message: "a move is a JSON object" });
    const mv = m as Record<string, unknown>;
    for (const [f, spec] of Object.entries(FIELDS)) {
      if (!Object.hasOwn(mv, f)) {
        if (spec.need) out.push({ code: "MV-E002", step: at, field: f, message: `a move needs ${f}` });
      } else if (typeof mv[f] !== spec.type || !spec.ok(mv[f])) out.push({ code: typeof mv[f] === spec.type ? "MV-E003" : "MV-E002", step: at, field: f, message: `${f} ${JSON.stringify(mv[f])} is not ${spec.range}` });
    }
    for (const f of Object.keys(mv)) if (!Object.hasOwn(FIELDS, f)) out.push({ code: "MV-E006", step: at, field: f, message: `"${f}" is not a move's field` });
    if (typeof mv.name === "string") {
      if (!NAME.test(mv.name)) out.push({ code: "MV-E004", step: at, field: "name", message: `name "${mv.name}" is not lowercase letters, digits and _`, fix: mv.name.toLowerCase().replace(/[^a-z0-9_]/g, "_") });
      else if (names.has(mv.name)) out.push({ code: "MV-E004", step: at, field: "name", message: `a second move named "${mv.name}"` });
      names.add(mv.name);
    }
    if (mv.plane === "ground" && mv.height === undefined) out.push({ code: "MV-E007", step: at, field: "height", message: "a move on the ground plane gives the hand's (or foot's) height", fix: '"height": [-60, -60]' });
    if (mv.plane === "side" && mv.height !== undefined) out.push({ code: "MV-E007", step: at, field: "height", message: "a move on the side plane has no height: its arc goes up and down in front" });
  });
  moves.forEach((m, at) => {
    const alt = (m as Record<string, unknown> | null)?.alt;
    if (typeof alt === "string" && !names.has(alt)) out.push({ code: "MV-E005", step: at, field: "alt", message: `alt "${alt}" names no move in the file` });
  });
  return out;
}
