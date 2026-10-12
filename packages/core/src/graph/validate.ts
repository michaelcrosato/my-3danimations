// The graph's checks (PLAN.md WP-6.4, D73; spec/GRAPH.md §5): every issue with its code, where it is and a fix.
// spec/schemas/graph.schema.json gives the shape; these also check what a schema can't: names that exist, blend points
// in order, conditions that fit their parameter's type, states the start reaches, clips the host has.
import { GROUPS } from "../ops/pose.ts";
import type { RecipeIssue } from "../recipe/validate.ts";
import { clipsOf, layersOf, type Condition, type Graph, type GraphLayer, type GraphState, type GraphTransition } from "./types.ts";

/** The graph rules: each code and what it catches. */
export const GRAPH_RULES: Readonly<Record<string, string>> = {
  "G-E001": "not a graph: no format, id, start, states or transitions",
  "G-E002": "a state that isn't exactly one of clip, recipe, blend or pass, or a blend space out of order",
  "G-E003": "a name that isn't there: a transition's state, a layer's start, a blend's parameter",
  "G-E004": "a condition that doesn't fit its parameter: an unknown one, or an op or value of the wrong kind",
  "G-E005": "a value out of range: a fade, exit or window, a speed, a weight",
  "G-E006": "a parameter of an unknown type, or a value that isn't of it",
  "G-E007": "an unknown field",
  "G-E008": "a state the layer's start never reaches",
  "G-E009": "a clip the host's clips don't have",
  "G-E010": "a layer named twice, or with an unknown mask",
};

const ID = /^[A-Z0-9_]+\/[A-Za-z0-9_]+$/, NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
const OPS = ["==", "!=", "<", "<=", ">", ">="];
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const FIELDS = {
  graph: ["format", "id", "name", "desc", "tags", "parameters", "start", "states", "transitions", "layers"],
  layer: ["name", "start", "states", "transitions", "mask", "weight", "additive"],
  state: ["clip", "recipe", "blend", "pass", "speed", "at"],
  blend: ["param", "params", "points", "sync"],
  transition: ["from", "to", "when", "exit", "window", "fade", "sync", "interruptible"],
  condition: ["param", "op", "value"],
};
/** The field nearest a misspelt one, if any is near. */
function near(f: string, known: readonly string[]): string | undefined {
  const d = (a: string, b: string) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0]![j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i]![j] = Math.min(m[i - 1]![j]! + 1, m[i]![j - 1]! + 1, m[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length]![b.length]!;
  };
  const best = known.map((k) => [k, d(f.toLowerCase(), k.toLowerCase())] as const).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 2 ? best[0] : undefined;
}

/**
 * Every issue in a graph, in order; none means it can play. With `clips` (the host's clips by id, as the Animator is
 * given them), each clip a state names must be there too.
 */
export function validateGraph(data: unknown, opts: { clips?: (id: string) => unknown } = {}): RecipeIssue[] {
  const out: RecipeIssue[] = [];
  const add = (code: string, field: string, message: string, fix?: string) => void out.push({ code, field, message, ...(fix ? { fix } : {}) });
  if (!isObj(data)) return [{ code: "G-E001", message: "a graph is a JSON object", fix: '{ "format": "2.0", "id": "GRAPHS/Name", "start": "idle", "states": { … }, "transitions": [ … ] }' }];
  const g = data;
  if (typeof g.format !== "string" || !/^2\.\d+$/.test(g.format)) add("G-E001", "format", "format is 2.x", '"format": "2.0"');
  if (typeof g.id !== "string" || !ID.test(g.id)) add("G-E001", "id", "id is SET/Slug", '"id": "GRAPHS/Locomotion"');
  unknown(g, FIELDS.graph, "", add);
  // parameters
  const params = new Map<string, string>();
  if (g.parameters !== undefined && !isObj(g.parameters)) add("G-E006", "parameters", "parameters are an object, by name", '"parameters": { "speed": { "type": "number" } }');
  for (const [name, p] of Object.entries(isObj(g.parameters) ? g.parameters : {})) {
    const at = `parameters.${name}`;
    if (!NAME.test(name)) add("G-E006", at, `parameter name "${name}" is letters, digits, _ and -`);
    if (!isObj(p) || !["number", "bool", "trigger"].includes(p.type as string)) {
      add("G-E006", at, `parameter "${name}" has no type number, bool or trigger`, '{ "type": "number", "value": 0 }');
      continue;
    }
    unknown(p, ["type", "value"], at, add);
    params.set(name, p.type as string);
    if (p.value !== undefined && !(p.type === "number" ? isNum(p.value) : p.type === "bool" ? typeof p.value === "boolean" : false))
      add("G-E006", `${at}.value`, `parameter "${name}" is a ${p.type as string}: its value ${JSON.stringify(p.value)} isn't one`, p.type === "trigger" ? "a trigger has no value: leave it out" : p.type === "bool" ? '"value": false' : '"value": 0');
  }
  const base = isObj(g.states) && Array.isArray(g.transitions) && typeof g.start === "string";
  if (!isObj(g.states)) add("G-E001", "states", "a graph has states, by name", '"states": { "idle": { "clip": "SET/Idle" } }');
  if (!Array.isArray(g.transitions)) add("G-E001", "transitions", "a graph has a list of transitions (it may be empty)", '"transitions": []');
  if (typeof g.start !== "string") add("G-E001", "start", "a graph names the state it starts in", '"start": "idle"');
  if (g.layers !== undefined && !Array.isArray(g.layers)) add("G-E010", "layers", "layers are a list", '"layers": [{ "name": "upper", "mask": "upper", … }]');
  const names = new Set(["base"]);
  const layers = base ? layersOf(g as unknown as Graph) : [];
  if (!base) for (const L of Array.isArray(g.layers) ? (g.layers as GraphLayer[]) : []) layers.push(L);
  layers.forEach((L, li) => {
    const at = li === 0 && base ? "" : `layers.${li - (base ? 1 : 0)}.`;
    if (!isObj(L)) return add("G-E010", at.slice(0, -1), "a layer is an object", '{ "name": "upper", "start": "none", "states": { … }, "transitions": [ … ] }');
    if (at) {
      unknown(L as unknown as Record<string, unknown>, FIELDS.layer, at.slice(0, -1), add);
      if (typeof L.name !== "string" || !NAME.test(L.name)) add("G-E010", `${at}name`, "a layer has a name: letters, digits, _ and -", '"name": "upper"');
      else if (names.has(L.name)) add("G-E010", `${at}name`, `a second layer named "${L.name}"`, "a name of its own");
      else names.add(L.name);
      if (L.mask !== undefined) {
        const groups = typeof L.mask === "string" ? [L.mask] : Array.isArray(L.mask) ? L.mask : null;
        if (groups) for (const m of groups) if (!Object.hasOwn(GROUPS, m)) add("G-E010", `${at}mask`, `no body group "${String(m)}"`, `one of ${Object.keys(GROUPS).join(", ")}`);
        if (!groups && !(isObj(L.mask) && Object.values(L.mask).every((w) => isNum(w) && w >= 0 && w <= 1))) add("G-E010", `${at}mask`, "a mask is body groups or weights 0 to 1 by field", '"mask": "upper"');
      }
      if (L.weight !== undefined && !(isNum(L.weight) && L.weight >= 0 && L.weight <= 1)) add("G-E005", `${at}weight`, "a layer's weight is 0 to 1", '"weight": 1');
      if (L.additive !== undefined && typeof L.additive !== "boolean") add("G-E005", `${at}additive`, "additive is true or false");
      if (!isObj(L.states)) return add("G-E001", `${at}states`, "a layer has states, by name");
      if (!Array.isArray(L.transitions)) return add("G-E001", `${at}transitions`, "a layer has a list of transitions", '"transitions": []');
    }
    checkLayer(L, at, li === 0 && base, params, add, opts.clips);
  });
  return out;
}

function unknown(o: Record<string, unknown>, known: readonly string[], at: string, add: (code: string, field: string, message: string, fix?: string) => void): void {
  for (const k of Object.keys(o)) if (!known.includes(k)) {
    const n = near(k, known);
    add("G-E007", at ? `${at}.${k}` : k, `"${k}" is not a field here`, n ? `"${n}"` : known.join(", "));
  }
}

function checkLayer(L: GraphLayer, at: string, isBase: boolean, params: Map<string, string>, add: (code: string, field: string, message: string, fix?: string) => void, clips?: (id: string) => unknown): void {
  const states = Object.keys(L.states);
  if (!states.length) add("G-E001", `${at}states`, "a layer has at least one state");
  if (typeof L.start !== "string" || !Object.hasOwn(L.states, L.start)) add("G-E003", `${at}start`, `start "${String(L.start)}" is not one of its states`, states.length ? `one of ${states.join(", ")}` : undefined);
  for (const [name, s] of Object.entries(L.states)) checkState(name, s, `${at}states.${name}`, isBase, params, add, clips);
  const known = new Set(states);
  L.transitions.forEach((t, i) => checkTransition(t, `${at}transitions.${i}`, known, params, add));
  // every state the start reaches by some transition (conditions aside)
  if (typeof L.start === "string" && known.has(L.start)) {
    const seen = new Set([L.start]), todo = [L.start];
    while (todo.length) {
      const s = todo.pop()!;
      for (const t of L.transitions) {
        if (!isObj(t) || typeof t.to !== "string" || !known.has(t.to) || seen.has(t.to)) continue;
        const from = t.from === "*" ? states : typeof t.from === "string" ? [t.from] : Array.isArray(t.from) ? t.from : [];
        if (from.includes(s)) {
          seen.add(t.to);
          todo.push(t.to);
        }
      }
    }
    for (const s of states) if (!seen.has(s)) add("G-E008", `${at}states.${s}`, `state "${s}" can't be reached from "${L.start}"`, `a transition into it, or remove it`);
  }
}

function checkState(name: string, s: GraphState, at: string, isBase: boolean, params: Map<string, string>, add: (code: string, field: string, message: string, fix?: string) => void, clips?: (id: string) => unknown): void {
  if (!NAME.test(name)) add("G-E002", at, `state name "${name}" is letters, digits, _ and -`);
  if (!isObj(s)) return add("G-E002", at, "a state is an object", '{ "clip": "SET/Slug" }');
  unknown(s as Record<string, unknown>, FIELDS.state, at, add);
  const kinds = (["clip", "recipe", "blend", "pass"] as const).filter((k) => s[k] !== undefined);
  if (kinds.length !== 1) add("G-E002", at, `state "${name}" is ${kinds.length ? kinds.join(" and ") : "none"} of clip, recipe, blend and pass: it is exactly one`, '{ "clip": "SET/Slug" }');
  for (const k of ["clip", "recipe"] as const) if (s[k] !== undefined && (typeof s[k] !== "string" || !ID.test(s[k]))) add("G-E002", `${at}.${k}`, `${k} is an id, SET/Slug`, '"SET/Slug"');
  if (s.pass !== undefined && s.pass !== true) add("G-E002", `${at}.pass`, "pass is true", '"pass": true');
  if (s.pass === true && isBase) add("G-E002", `${at}.pass`, "the base layer has nothing below it to show through: a pass state belongs on a layer over it", "a clip, or move it to a layer");
  if (s.speed !== undefined && !(isNum(s.speed) && Math.abs(s.speed) <= 100)) add("G-E005", `${at}.speed`, "speed is a number, -100 to 100", '"speed": 1');
  if (s.at !== undefined && !(isNum(s.at) && s.at >= 0)) add("G-E005", `${at}.at`, "at is seconds, 0 or more", '"at": 0');
  if (s.at !== undefined && s.clip === undefined && s.recipe === undefined) add("G-E002", `${at}.at`, "only a clip state starts at a time", "leave it out");
  if (s.blend !== undefined) {
    const b = s.blend, bat = `${at}.blend`;
    if (!isObj(b)) return add("G-E002", bat, "a blend space is an object", '{ "param": "speed", "points": [ … ] }');
    unknown(b as Record<string, unknown>, FIELDS.blend, bat, add);
    const two = b.params !== undefined, names = two ? b.params : b.param !== undefined ? [b.param] : [];
    if ((b.param === undefined) === !two) add("G-E002", bat, "a blend space reads one parameter (param) or two (params)", '"param": "speed"');
    for (const p of Array.isArray(names) ? names : []) if (params.get(p as string) !== "number") add("G-E003", `${bat}.param`, `"${String(p)}" is not a number parameter`, "a parameter of type number");
    if (two && !(Array.isArray(b.params) && b.params.length === 2)) add("G-E002", `${bat}.params`, "params names two parameters", '"params": ["x", "y"]');
    if (b.sync !== undefined && typeof b.sync !== "boolean") add("G-E002", `${bat}.sync`, "sync is true or false");
    if (!Array.isArray(b.points) || b.points.length < 2) return add("G-E002", `${bat}.points`, "a blend space has two points or more", '[{ "at": 0, "clip": "SET/Walk" }, { "at": 3, "clip": "SET/Run" }]');
    const points = b.points as { at?: unknown; clip?: unknown }[];
    points.forEach((p, i) => {
      const pat = `${bat}.points.${i}`;
      if (!isObj(p)) return add("G-E002", pat, "a point is { at, clip }");
      unknown(p as Record<string, unknown>, ["at", "clip"], pat, add);
      if (typeof p.clip !== "string" || !ID.test(p.clip)) add("G-E002", `${pat}.clip`, "clip is an id, SET/Slug");
      const ok = two ? Array.isArray(p.at) && p.at.length === 2 && p.at.every(isNum) : isNum(p.at);
      if (!ok) add("G-E002", `${pat}.at`, two ? "at is [x, y]" : "at is a number", two ? '"at": [0, 1]' : '"at": 1.4');
      else if (!two && i > 0 && isNum(points[i - 1]!.at) && (p.at as number) <= (points[i - 1]!.at as number)) add("G-E002", `${pat}.at`, "points are in rising order of at, each its own", `more than ${String(points[i - 1]!.at)}`);
      else if (two && points.slice(0, i).some((q) => Array.isArray(q.at) && q.at[0] === (p.at as number[])[0] && q.at[1] === (p.at as number[])[1])) add("G-E002", `${pat}.at`, "each point is at its own place");
    });
  }
  if (clips) for (const id of clipsOf(s)) if (typeof id === "string" && ID.test(id) && !clips(id)) add("G-E009", at, `clip ${id} is not among the clips given`, "pass it in the clips, or name one there");
}

function checkTransition(t: GraphTransition, at: string, known: Set<string>, params: Map<string, string>, add: (code: string, field: string, message: string, fix?: string) => void): void {
  if (!isObj(t)) return add("G-E003", at, "a transition is an object", '{ "from": "idle", "to": "walk", "when": [ … ] }');
  unknown(t as Record<string, unknown>, FIELDS.transition, at, add);
  const from = t.from === "*" ? [] : typeof t.from === "string" ? [t.from] : Array.isArray(t.from) ? t.from : null;
  if (!from || (Array.isArray(t.from) && !t.from.length)) add("G-E003", `${at}.from`, "from is a state, a list of them, or * for any", '"from": "idle"');
  for (const f of from ?? []) if (!known.has(f)) add("G-E003", `${at}.from`, `no state "${String(f)}"`, `one of ${[...known].join(", ")}`);
  if (typeof t.to !== "string" || !known.has(t.to)) add("G-E003", `${at}.to`, `no state "${String(t.to)}"`, `one of ${[...known].join(", ")}`);
  if (t.when !== undefined && !Array.isArray(t.when)) add("G-E004", `${at}.when`, "when is a list of conditions", '"when": [{ "param": "speed", "op": ">", "value": 0.5 }]');
  (Array.isArray(t.when) ? t.when : []).forEach((c, i) => checkCondition(c, `${at}.when.${i}`, params, add));
  if (t.exit !== undefined && !(isNum(t.exit) && t.exit >= 0 && t.exit <= 1)) add("G-E005", `${at}.exit`, "exit is a share of the state's length, 0 to 1", '"exit": 1');
  if (t.window !== undefined && !(Array.isArray(t.window) && t.window.length === 2 && t.window.every(isNum) && t.window[0] >= 0 && t.window[1] > t.window[0])) add("G-E005", `${at}.window`, "window is [from, to] seconds, from 0, to after from", '"window": [0.2, 0.5]');
  if (t.fade !== undefined && !(isNum(t.fade) && t.fade >= 0 && t.fade <= 10)) add("G-E005", `${at}.fade`, "fade is seconds, 0 to 10", '"fade": 0.2');
  for (const k of ["sync", "interruptible"] as const) if (t[k] !== undefined && typeof t[k] !== "boolean") add("G-E005", `${at}.${k}`, `${k} is true or false`);
}

function checkCondition(c: Condition, at: string, params: Map<string, string>, add: (code: string, field: string, message: string, fix?: string) => void): void {
  if (!isObj(c)) return add("G-E004", at, "a condition is { param, op, value }", '{ "param": "speed", "op": ">", "value": 0.5 }');
  unknown(c as Record<string, unknown>, FIELDS.condition, at, add);
  const type = params.get(c.param);
  if (!type) return add("G-E004", `${at}.param`, `no parameter "${String(c.param)}"`, params.size ? `one of ${[...params.keys()].join(", ")}` : "declare it in parameters");
  if (type === "trigger") {
    if (c.op !== undefined || c.value !== undefined) add("G-E004", at, `"${c.param}" is a trigger: it is set or not, with no op or value`, `{ "param": "${c.param}" }`);
    return;
  }
  if (c.op === undefined && c.value === undefined) {
    if (type !== "bool") add("G-E004", at, `"${c.param}" is a number: a condition compares it`, `{ "param": "${c.param}", "op": ">", "value": 0 }`);
    return;
  }
  if (typeof c.op !== "string" || !OPS.includes(c.op)) add("G-E004", `${at}.op`, `op is one of ${OPS.join(" ")}`, '"op": ">"');
  if (type === "bool" && !(typeof c.value === "boolean" && (c.op === "==" || c.op === "!="))) add("G-E004", at, `"${c.param}" is a bool: it is == or != true or false`, `{ "param": "${c.param}", "op": "==", "value": true }`);
  if (type === "number" && !isNum(c.value)) add("G-E004", `${at}.value`, `"${c.param}" is a number: the value is one`, '"value": 0.5');
}
