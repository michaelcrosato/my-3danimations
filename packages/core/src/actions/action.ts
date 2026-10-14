// Actions (PLAN.md WP-6.3, D72; spec/ACTION.md): a recipe that is one multi-beat motion (get up, climb up, vault, hop
// down, roll, a heavy landing) with what a game needs to drive it: the ground it ends on (a climb's ledge, a hop's
// drop), its beats by name, and the points where it may be cut into another clip. A paired action places and times two
// or more roles, each a recipe, so their moments meet. This file holds their shapes and the checks a schema can't say.
import type { Recipe, Step } from "../recipe/types.ts";
import { validateRecipe, type RecipeIssue } from "../recipe/validate.ts";

/** A named stretch of an action, in seconds. */
export interface Beat {
  name: string;
  from: number;
  to: number;
}
/** A moment an action may be cut into another clip: the clips it may go on into (SET/Slug ids: library clips,
 *  PROCEDURAL/<Name> parts, other actions), and why there. */
export interface Interrupt {
  t: number;
  to: string[];
  why: string;
}
/** An action: a recipe (spec/RECIPE.md) and its ground, beats and interrupt points. */
export interface Action extends Recipe {
  /** The ground it ends on, % of the hip height above the ground it starts on (a climb +, a hop down −; 0 by default). */
  floor?: number;
  beats: Beat[];
  interrupts: Interrupt[];
}
/** A role of a paired action: its recipe's steps, and where it stands at the start in the lead role's frame:
 *  [forward, right] in % of the hip height and the way it faces in degrees (+ toward the right). */
export interface Role {
  steps: Step[];
  place?: [number, number, number];
}
/** Two or more roles played together, each started so the event named `sync` falls at the same moment in all. The
 *  first role leads: the others are placed in its frame. */
export interface PairedAction {
  format: string;
  id: string;
  name?: string;
  desc: string;
  tags?: string[];
  sync: string;
  roles: Record<string, Role>;
}

/** The action rules: each code and what it catches (the recipe's own R- codes come with them). */
export const ACTION_RULES: Readonly<Record<string, string>> = {
  "A-E001": "not an action: no beats or interrupts, or a paired action without two roles",
  "A-E002": "a beat with no name, or out of order: each starts where or after the last one ends, and ends after it starts",
  "A-E003": "an interrupt without a time or a clip to go into, or out of order",
  "A-E004": "an action reads no library clip: it needs one to set its body",
  "A-E005": "a time outside the action, once compiled",
  "A-E006": "the ground the feet stand on doesn't match the floor given",
  "A-E007": "an unknown field",
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const NAME = /^[a-z][a-z0-9_-]*$/, ID = /^[A-Z0-9_]+\/[A-Za-z0-9_]+$/;
/** The recipe an action is, without its own fields. */
export function recipeOf(a: Action): Recipe {
  const { floor: _f, beats: _b, interrupts: _i, ...r } = a;
  return r;
}

/** Every issue in an action, in order: its recipe's (R- codes), then its own (A- codes). */
export function validateAction(a: unknown): RecipeIssue[] {
  if (!a || typeof a !== "object" || Array.isArray(a)) return [{ code: "A-E001", message: "an action is a JSON object", fix: '{ "format": "2.0", "id": "ACTIONS/Name", "steps": [ … ], "beats": [ … ], "interrupts": [ … ] }' }];
  const o = a as Record<string, unknown>, out = validateRecipe(recipeOf(o as unknown as Action));
  if (o.floor !== undefined && !(isNum(o.floor) && Math.abs(o.floor) <= 500)) out.push({ code: "R-E004", field: "floor", message: "floor is % of the hip height, -500 to 500", fix: '"floor": 110 (a ledge a hip height up), or leave it out' });
  if (!Array.isArray(o.beats) || !o.beats.length) out.push({ code: "A-E001", field: "beats", message: "an action names its beats", fix: '"beats": [{ "name": "rise", "from": 0, "to": 1.2 }]' });
  else
    (o.beats as unknown[]).forEach((b, i) => {
      const x = b as Partial<Beat> | null, last = i ? (o.beats as Beat[])[i - 1] : undefined;
      if (!x || typeof x.name !== "string" || !NAME.test(x.name)) return void out.push({ code: "A-E002", field: `beats.${i}`, message: "a beat's name is lower-case letters, digits, _ and -", fix: '"name": "pull_up"' });
      if (!isNum(x.from) || !isNum(x.to) || x.to <= x.from || x.from < 0) out.push({ code: "A-E002", field: `beats.${i}`, message: `beat "${x.name}" runs from a time to a later one`, fix: '"from": 0, "to": 0.5' });
      else if (last && isNum(last.to) && x.from < last.to - 1e-9) out.push({ code: "A-E002", field: `beats.${i}`, message: `beat "${x.name}" starts before "${last.name}" ends`, fix: `"from": ${last.to}` });
    });
  if (!Array.isArray(o.interrupts) || !o.interrupts.length) out.push({ code: "A-E001", field: "interrupts", message: "an action marks where it may be cut", fix: '"interrupts": [{ "t": 1.2, "to": ["PROCEDURAL/Walk"], "why": "on its feet" }]' });
  else
    (o.interrupts as unknown[]).forEach((x, i) => {
      const it = x as Partial<Interrupt> | null, last = i ? (o.interrupts as Interrupt[])[i - 1] : undefined;
      if (!it || !isNum(it.t) || it.t < 0) return void out.push({ code: "A-E003", field: `interrupts.${i}`, message: "an interrupt has a time", fix: '"t": 1.2' });
      if (!Array.isArray(it.to) || !it.to.length || !it.to.every((id) => typeof id === "string" && ID.test(id))) out.push({ code: "A-E003", field: `interrupts.${i}.to`, message: "an interrupt names the clips it may go on into (SET/Slug)", fix: '"to": ["PROCEDURAL/Walk", "PROCEDURAL/Breathe"]' });
      if (typeof it.why !== "string" || !it.why) out.push({ code: "A-E003", field: `interrupts.${i}.why`, message: "an interrupt says why it may be cut there", fix: '"why": "both feet down"' });
      if (last && isNum(last.t) && it.t <= last.t) out.push({ code: "A-E003", field: `interrupts.${i}`, message: "interrupts are in time order", fix: `a time after ${last.t}` });
    });
  if (Array.isArray(o.steps) && !(o.steps as Step[]).some((s) => s && s.op === "clip" && typeof s.id === "string" && !s.id.startsWith("PROCEDURAL/"))) out.push({ code: "A-E004", field: "steps", message: "an action reads at least one library clip", fix: '{ "op": "clip", "id": "SET/Slug" }' });
  return out;
}

/** Every issue in a paired action. */
export function validatePaired(p: unknown): RecipeIssue[] {
  if (!p || typeof p !== "object" || Array.isArray(p)) return [{ code: "A-E001", message: "a paired action is a JSON object", fix: '{ "format": "2.0", "id": "ACTIONS/Name", "desc": "…", "sync": "hit", "roles": { … } }' }];
  const o = p as Record<string, unknown>, out: RecipeIssue[] = [];
  if (typeof o.format !== "string" || !/^2\.\d+$/.test(o.format)) out.push({ code: "A-E001", field: "format", message: "format is 2.x", fix: '"format": "2.0"' });
  if (typeof o.id !== "string" || !ID.test(o.id)) out.push({ code: "A-E001", field: "id", message: "id is SET/Slug", fix: '"id": "ACTIONS/My_Pair"' });
  if (typeof o.desc !== "string" || !o.desc) out.push({ code: "A-E001", field: "desc", message: "a paired action says what it is", fix: '"desc": "…"' });
  if (typeof o.sync !== "string" || !NAME.test(o.sync)) out.push({ code: "A-E001", field: "sync", message: "sync names an event every role carries", fix: '"sync": "hit"' });
  for (const k of Object.keys(o)) if (!["format", "id", "name", "desc", "tags", "sync", "roles"].includes(k)) out.push({ code: "A-E007", field: k, message: `"${k}" is not a paired action's field`, fix: "format, id, name, desc, tags, sync, roles" });
  const roles = o.roles as Record<string, Role> | undefined;
  if (!roles || typeof roles !== "object" || Object.keys(roles).length < 2) return [...out, { code: "A-E001", field: "roles", message: "a paired action has two roles or more", fix: '"roles": { "attacker": { "steps": [ … ] }, "victim": { "steps": [ … ], "place": [60, 0, 180] } }' }];
  for (const [name, r] of Object.entries(roles)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) out.push({ code: "A-E001", field: `roles.${name}`, message: "a role's name is a lower-case word", fix: '"attacker"' });
    for (const i of validateRecipe({ format: "2.0", id: "ACTIONS/Role", steps: r?.steps } as Recipe)) out.push({ ...i, field: `roles.${name}${i.field ? `.${i.field}` : ""}` });
    if (r?.place !== undefined && !(Array.isArray(r.place) && r.place.length === 3 && r.place.every(isNum))) out.push({ code: "R-E004", field: `roles.${name}.place`, message: "place is [forward, right, turn]", fix: '"place": [60, 0, 180]' });
    for (const k of Object.keys(r ?? {})) if (k !== "steps" && k !== "place") out.push({ code: "A-E007", field: `roles.${name}.${k}`, message: `"${k}" is not a role's field`, fix: "steps, place" });
  }
  return out;
}
/** Whether data is a paired action rather than a single one. */
export const isPaired = (d: unknown): d is PairedAction => !!d && typeof d === "object" && "roles" in (d as object);
