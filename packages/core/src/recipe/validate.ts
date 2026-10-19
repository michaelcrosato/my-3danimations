// Checking a recipe before it runs (spec/RECIPE.md §4): every step's operation, its fields and their values, and the
// names steps read, with coded issues that say where and how to fix it. The compiler adds the two it alone can see
// (a clip id the library doesn't know, a time outside its track).
import { GROUPS } from "../ops/pose.ts";
import { KEY_FIELDS } from "../format/types.ts";
import { nearest } from "../validate/issues.ts";
import type { Step } from "./types.ts";

/** One recipe issue: its code, the step (1-based) and field it is at, what is wrong and the fix. */
export interface RecipeIssue {
  code: string;
  step?: number;
  field?: string;
  message: string;
  fix?: string;
}
/** The recipe rules: each code and what it catches. */
export const RECIPE_RULES: Readonly<Record<string, string>> = {
  "R-E001": "not a recipe: no format 2.x, id or steps",
  "R-E002": "an unknown operation",
  "R-E003": "a field the operation needs is missing",
  "R-E004": "a value out of range or of the wrong type",
  "R-E005": "a step reads a name that isn't an earlier step",
  "R-E006": "a step name used twice, or one of the s1, s2, … names",
  "R-E007": "an unknown field",
  "R-E008": "a clip id the library doesn't have",
  "R-E009": "a time outside its track",
};
/** A recipe error, carrying its issues. */
export class RecipeError extends Error {
  /** Every issue, in order. */
  readonly issues: readonly RecipeIssue[];
  constructor(issues: readonly RecipeIssue[]) {
    super(issues.map(formatRecipeIssue).join("\n"));
    this.name = "RecipeError";
    this.issues = issues;
  }
}
/** An issue as one or two lines. */
export function formatRecipeIssue(i: RecipeIssue): string {
  const at = [i.step !== undefined ? `step ${i.step}` : "", i.field ?? ""].filter(Boolean).join(" ");
  return `${i.code}${at ? ` ${at}` : ""}: ${i.message}${i.fix ? `\n  fix: ${i.fix}` : ""}`;
}

type Check = (v: unknown) => string | null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const num = (min: number, max: number): Check => (v) => (isNum(v) && v >= min && v <= max ? null : `a number from ${min} to ${max}`);
const word = (words: readonly string[]): Check => (v) => (typeof v === "string" && words.includes(v) ? null : `one of ${words.join(", ")}`);
const bool: Check = (v) => (typeof v === "boolean" ? null : "true or false");
// a recipe's own id is SET/Slug; a clip it reads may have a hyphen in its slug, as the library's do (spec/MOTION.md
// §11: MESH2MOTION/Two-hand_Blast), as graph/validate.ts reads a state's clip
const id: Check = (v) => (typeof v === "string" && /^[A-Z0-9_]+\/[A-Za-z0-9_]+$/.test(v) ? null : "a recipe id, SET/Slug");
const clipId: Check = (v) => (typeof v === "string" && /^[A-Z0-9_]+\/[A-Za-z0-9_-]+$/.test(v) ? null : "a clip id, SET/Slug");
const name: Check = (v) => (typeof v === "string" && /^[A-Za-z0-9_]+$/.test(v) ? null : "a step's name (letters, digits and _)");
const names: Check = (v) => (Array.isArray(v) && v.length >= 2 && v.every((x) => name(x) === null) ? null : "a list of at least two step names");
const vec3: Check = (v) => (Array.isArray(v) && v.length === 3 && v.every(isNum) ? null : "[forward, right, up] in mm");
const time = num(0, 600);
const loopOrBlend: Check = (v) => (typeof v === "boolean" || (isNum(v) && v > 0 && v <= 5) ? null : "true, or the seconds to blend the seam over (up to 5)");
/** Points whose times (each one's first number) rise. */
const rising = (v: unknown[]) => v.every((p, i) => i === 0 || (p as number[])[0]! > (v[i - 1] as number[])[0]!);
const weightCurve: Check = (v) => (isNum(v) && v >= 0 && v <= 1) || (Array.isArray(v) && v.length > 0 && v.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && p[0] >= 0 && isNum(p[1]) && p[1] >= 0 && p[1] <= 1) && rising(v)) ? null : "a weight from 0 to 1, or [[t, w], …] with t rising";
const maskOf: Check = (v) => {
  const groups = Object.keys(GROUPS), fields = [...Object.keys(KEY_FIELDS), "yaw"];
  if (typeof v === "string") return groups.includes(v) ? null : `a group: ${groups.join(", ")}`;
  if (Array.isArray(v)) return v.length && v.every((g) => typeof g === "string" && groups.includes(g)) ? null : `groups: ${groups.join(", ")}`;
  if (v && typeof v === "object") return Object.keys(v).length > 0 && Object.entries(v).every(([f, w]) => fields.includes(f) && isNum(w) && w >= 0 && w <= 1) ? null : "{ field: weight 0 to 1 }, at least one";
  return "group names or { field: weight }";
};
const path: Check = (v) => (Array.isArray(v) && v.length > 0 && v.every((p) => Array.isArray(p) && p.length === 4 && p.every(isNum) && (p[0] as number) >= 0) && rising(v) ? null : "[[t, forward, right, up], …] in s and mm, t rising");
const eventList: Check = (v) => (Array.isArray(v) && v.length > 0 && v.every((e) => e && typeof e === "object" && isNum((e as { t: unknown }).t) && typeof (e as { name: unknown }).name === "string" && /^[a-z][a-z0-9_-]*$/.test((e as { name: string }).name)) ? null : "[{ t, name }, …] (a name: lower-case letters, digits, _ and -, as a clip's events, MOTION.md §7.2)");
const contactsAdd: Check = (v) => (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0 && Object.entries(v).every(([end, iv]) => ["footL", "footR", "handL", "handR"].includes(end) && Array.isArray(iv) && iv.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]) && p[0] >= 0 && p[1] > p[0]))) ? null : "{ footL | footR | handL | handR: [[from, to], …] }";

/** What a needed field is, for R-E003's fix. */
const FIELD_HELP: Readonly<Record<string, string>> = { id: "a clip id, SET/Slug", items: "the names of the steps to play in turn", a: "a step's name", b: "a step's name", w: "a weight from 0 to 1", base: "a step's name", over: "a step's name", in: "a step's name", at: "[forward, right, up] in mm", end: "handL, handR, footL or footR", path: "[[t, forward, right, up], …]", amount: "a number", window: "seconds", add: "what to add" };
/** An operation: the fields that read steps, the ones it needs, and every field it takes. */
interface OpSpec {
  reads: readonly string[];
  needs: readonly string[];
  fields: Readonly<Record<string, Check>>;
  /** At least one of these. */
  oneOf?: readonly string[];
}
const span = { from: time, to: time, fade: num(0, 10) };
/** Every operation and its fields. */
export const OPS: Readonly<Record<string, OpSpec>> = {
  clip: { reads: [], needs: ["id"], fields: { id: clipId, from: time, to: time, loop: loopOrBlend } },
  sequence: { reads: ["items"], needs: ["items"], fields: { items: names, fade: num(0, 5), sync: word(["contacts"]) } },
  blend: { reads: ["a", "b"], needs: ["a", "b", "w"], fields: { a: name, b: name, w: weightCurve, warp: bool } },
  layer: { reads: ["base", "over"], needs: ["base", "over"], fields: { base: name, over: name, mask: maskOf, feather: num(0, 1), weight: num(0, 2), additive: bool } },
  mirror: { reads: ["in"], needs: ["in"], fields: { in: name } },
  retime: { reads: ["in"], needs: ["in"], oneOf: ["speed", "dur", "ease"], fields: { in: name, speed: num(0.05, 20), dur: num(0.001, 600), ease: word(["in", "out", "inOut"]) } },
  pose: { reads: ["in"], needs: ["in"], fields: { in: name, ...span } },
  look: { reads: ["in"], needs: ["in", "at"], fields: { in: name, at: vec3, weight: num(0, 1), ...span } },
  pin: { reads: ["in"], needs: ["in", "end", "path"], fields: { in: name, end: word(["handL", "handR", "footL", "footR"]), path, fade: num(0, 10) } },
  exaggerate: { reads: ["in"], needs: ["in", "amount"], fields: { in: name, amount: num(0, 4), mask: maskOf } },
  smooth: { reads: ["in"], needs: ["in", "window"], fields: { in: name, window: num(0.01, 5), mask: maskOf } },
  overshoot: { reads: ["in"], needs: ["in", "amount"], fields: { in: name, amount: num(0, 1), mask: maskOf } },
  stiffen: { reads: ["in"], needs: ["in", "amount"], fields: { in: name, amount: num(0, 1), mask: maskOf } },
  events: { reads: ["in"], needs: ["in", "add"], fields: { in: name, add: eventList } },
  contacts: { reads: ["in"], needs: ["in", "add"], fields: { in: name, add: contactsAdd } },
};

/** A pose step's part fields: a key field (or `yaw`) with its parts' amounts by name. */
function poseParts(s: Step, at: number, out: RecipeIssue[]): void {
  const fields = Object.keys(s).filter((k) => !["op", "as", "in", "from", "to", "fade"].includes(k));
  if (!fields.length) out.push({ code: "R-E003", step: at, message: "a pose step moves at least one field's parts", fix: 'add one, e.g. "chest": { "lean": 10 }' });
  for (const f of fields) {
    const spec = Object.hasOwn(KEY_FIELDS, f) && f !== "root" ? KEY_FIELDS[f] : undefined, v = s[f];
    if (!spec && f !== "yaw") {
      const near = nearest(f, [...Object.keys(OPS.pose!.fields), ...Object.keys(KEY_FIELDS), "yaw"]);
      out.push({ code: "R-E007", step: at, field: f, message: `"${f}" is not a field a pose step moves`, fix: f === "root" ? "a pose step turns the character with yaw; its travel is the clip's" : near ? `did you mean "${near}"?` : `one of yaw, ${Object.keys(KEY_FIELDS).filter((k) => k !== "root").join(", ")}` });
      continue;
    }
    if (f === "yaw") {
      if (!isNum(v)) out.push({ code: "R-E004", step: at, field: f, message: "yaw is a number of degrees", fix: '"yaw": 30 (degrees, + toward the right)' });
      continue;
    }
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      out.push({ code: "R-E004", step: at, field: f, message: `${f} gives its parts by name`, fix: `{ ${spec!.parts.map((p) => `"${p}": …`).join(", ")} }` });
      continue;
    }
    for (const [p, x] of Object.entries(v)) {
      if (!Object.hasOwn(v, p) || !spec!.parts.includes(p)) {
        const near = nearest(p, spec!.parts);
        out.push({ code: "R-E007", step: at, field: `${f}.${p}`, message: `${f} has no part "${p}" (${spec!.parts.join(", ")})`, fix: near ? `did you mean "${near}"?` : `one of ${spec!.parts.join(", ")}` });
      } else if (!isNum(x)) out.push({ code: "R-E004", step: at, field: `${f}.${p}`, message: "an amount is a number", fix: `"${p}": 10` });
    }
  }
}

/** Every issue in a recipe, in order; none means it can run. */
export function validateRecipe(r: unknown): RecipeIssue[] {
  const out: RecipeIssue[] = [];
  if (!r || typeof r !== "object" || Array.isArray(r)) return [{ code: "R-E001", message: "a recipe is a JSON object", fix: '{ "format": "2.0", "id": "SET/Slug", "steps": [ … ] }' }];
  const o = r as Record<string, unknown>;
  if (typeof o.format !== "string" || !/^2\.\d+$/.test(o.format)) out.push({ code: "R-E001", field: "format", message: `format ${JSON.stringify(o.format)} is not 2.x`, fix: '"format": "2.0"' });
  if (id(o.id) !== null) out.push({ code: "R-E001", field: "id", message: `id ${JSON.stringify(o.id)} is not SET/Slug`, fix: '"id": "RECIPES/My_Clip"' });
  if (!Array.isArray(o.steps) || !o.steps.length) return [...out, { code: "R-E001", field: "steps", message: "a recipe has at least one step", fix: '"steps": [{ "op": "clip", "id": "SET/Slug" }]' }];
  if (o.fps !== undefined && num(1, 120)(o.fps) !== null) out.push({ code: "R-E004", field: "fps", message: "fps is a number from 1 to 120", fix: '"fps": 30 (or leave it out)' });
  if (o.tags !== undefined && !(Array.isArray(o.tags) && o.tags.every((t) => typeof t === "string" && /^[a-z0-9-]+$/.test(t)))) out.push({ code: "R-E004", field: "tags", message: "tags are lower-case words", fix: '"tags": ["walk", "loop"]' });
  for (const k of ["name", "desc"]) if (o[k] !== undefined && typeof o[k] !== "string") out.push({ code: "R-E004", field: k, message: `${k} is text`, fix: `"${k}": "…"` });
  for (const k of Object.keys(o)) if (!["format", "id", "name", "tags", "desc", "fps", "steps"].includes(k)) {
    const near = nearest(k, ["format", "id", "name", "tags", "desc", "fps", "steps"]);
    out.push({ code: "R-E007", field: k, message: `"${k}" is not a recipe field`, fix: near ? `did you mean "${near}"?` : "a recipe's fields: format, id, name, tags, desc, fps, steps" });
  }
  const seen = new Set<string>();
  (o.steps as unknown[]).forEach((raw, i) => {
    const at = i + 1;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void out.push({ code: "R-E004", step: at, message: "a step is an object with an op", fix: '{ "op": "clip", "id": "SET/Slug" }' });
    const s = raw as Step, spec = typeof s.op === "string" && Object.hasOwn(OPS, s.op) ? OPS[s.op] : undefined;
    if (!spec) {
      const near = typeof s.op === "string" ? nearest(s.op, Object.keys(OPS)) : undefined;
      out.push({ code: "R-E002", step: at, field: "op", message: `no operation ${JSON.stringify(s.op)}`, fix: near ? `did you mean "${near}"?` : `one of ${Object.keys(OPS).join(", ")}` });
    } else {
      for (const f of spec.needs) if (s[f] === undefined) out.push({ code: "R-E003", step: at, field: f, message: `${s.op} needs ${f}`, fix: `add "${f}" (${FIELD_HELP[f] ?? "see spec/RECIPE.md §2"})` });
      if (spec.oneOf && spec.oneOf.filter((f) => s[f] !== undefined).length !== 1) out.push({ code: "R-E003", step: at, message: `${s.op} takes exactly one of ${spec.oneOf.join(", ")}`, fix: `keep one of ${spec.oneOf.join(", ")}` });
      if (s.op === "pose") poseParts(s, at, out);
      for (const [f, v] of Object.entries(s)) {
        if (f === "op" || f === "as" || (s.op === "pose" && ((Object.hasOwn(KEY_FIELDS, f) && f !== "root") || f === "yaw"))) continue;
        const check = Object.hasOwn(spec.fields, f) ? spec.fields[f] : undefined;
        if (!check) {
          if (s.op === "pose") continue;
          const near = nearest(f, Object.keys(spec.fields));
          out.push({ code: "R-E007", step: at, field: f, message: `${s.op} has no field "${f}"`, fix: near ? `did you mean "${near}"?` : `${s.op} takes ${Object.keys(spec.fields).join(", ")}` });
          continue;
        }
        const bad = check(v);
        if (bad) out.push({ code: "R-E004", step: at, field: f, message: `${f} is ${bad}, not ${JSON.stringify(v)?.slice(0, 40)}`, fix: `give ${f} as ${bad}` });
      }
      if (isNum(s.from) && isNum(s.to) && s.to <= s.from) out.push({ code: "R-E004", step: at, field: "to", message: `to (${s.to}) comes after from (${s.from})`, fix: `a to later than ${s.from}` });
      // the names it reads: earlier steps only
      for (const f of spec.reads) {
        const v = s[f], read = Array.isArray(v) ? v : v === undefined ? [] : [v];
        for (const n of read) if (typeof n === "string" && !seen.has(n)) {
          const near = nearest(n, [...seen]);
          out.push({ code: "R-E005", step: at, field: f, message: `"${n}" is not an earlier step`, fix: near ? `did you mean "${near}"?` : seen.size ? `read one of ${[...seen].join(", ")}` : "start with a clip step" });
        }
      }
    }
    if (s.as !== undefined) {
      if (name(s.as) !== null || /^s\d+$/.test(s.as)) out.push({ code: "R-E006", step: at, field: "as", message: `${JSON.stringify(s.as)} can't name a step (a word, not s1, s2, …)`, fix: 'a word of your own, e.g. "walk2"' });
      else if (seen.has(s.as)) out.push({ code: "R-E006", step: at, field: "as", message: `"${s.as}" names an earlier step already`, fix: `another name, e.g. "${s.as}2"` });
    }
    seen.add(`s${at}`);
    if (typeof s.as === "string") seen.add(s.as);
  });
  return out;
}
