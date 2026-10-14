// A simulation's input script (PLAN.md WP-6.5, D75; spec/SIM.md §1): what a game does to a graph over time, step by
// step: parameters set, triggers pressed, the ground speed it moves the character at, and how the root moves (by the
// animation's root motion, or in place by the game, its playback matched to the ground speed). Its checks give each
// issue a code, where it is and a fix, as the graph's do.
import type { graph as G } from "@m3a/core";

/** One row of input: at time `t` (s), parameters set, triggers pressed, and the ground speed from then on. */
export interface SimInput {
  t: number;
  set?: Record<string, number | boolean>;
  /** Seconds the row's numbers (its parameters and `move`) take to get there, linearly, as a game eases them (0). */
  over?: number;
  trigger?: string | string[];
  /** Ground speed forward, m/s (or hip heights a second, with `units: "H0"`), from `t` on. */
  move?: number;
}
/** A script: the graph it drives, how long, the root's mode, stride warping, and its input rows in time order. */
export interface SimScript {
  format: string;
  id: string;
  desc?: string;
  /** The graph it is written for (checked against the graph given, when it names one). */
  graph?: string;
  /** Seconds simulated. */
  dur: number;
  /** Fixed steps a second (60). */
  rate?: number;
  /** "root": the character goes where the animation's root motion takes it (default); "in-place": the game moves it at
   *  the ground speed `move` gives, the animation's root motion dropped. */
  root?: "root" | "in-place";
  /** In place, the number parameter (a state's `rate`) set each step to match playback to the ground speed. */
  warp?: string;
  /** What `move` is in: "m" (metres a second, default) or "H0" (the character's hip heights a second). */
  units?: "m" | "H0";
  /** Frames in the filmstrip (8). */
  film?: number;
  input: SimInput[];
}
/** An issue: its code, where, what is wrong and a fix. */
export interface SimIssue {
  code: string;
  field: string;
  message: string;
  fix: string;
}

/** The script rules: each code and what it catches. */
export const SIM_RULES: Readonly<Record<string, string>> = {
  "S-E001": "not a script: no format, id, dur or input, or one of the wrong kind",
  "S-E002": "an input row out of time order, outside the script's time, or doing nothing",
  "S-E003": "a parameter or trigger the graph doesn't have, or a value not of its type",
  "S-E004": "a value out of range: dur, rate, film, a ground speed, a ramp's seconds",
  "S-E005": "stride warping without a number parameter a state's rate reads, or not in place",
  "S-E006": "an unknown field",
  "S-E007": "a script written for another graph",
};

const FIELDS = { script: ["format", "id", "desc", "graph", "dur", "rate", "root", "warp", "units", "film", "input"], input: ["t", "set", "over", "trigger", "move"] };
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Every issue in a script, in order (none: it can run); with `graph`, its parameters and triggers are checked too. */
export function validateScript(data: unknown, graph?: G.Graph): SimIssue[] {
  const out: SimIssue[] = [], add = (code: string, field: string, message: string, fix: string) => void out.push({ code, field, message, fix });
  if (!isObj(data)) return [{ code: "S-E001", field: "", message: "a script is a JSON object", fix: '{ "format": "2.0", "id": "SIMS/Name", "dur": 5, "input": [ … ] }' }];
  const s = data;
  for (const k of Object.keys(s)) if (!FIELDS.script.includes(k)) add("S-E006", k, `"${k}" is not a field of a script`, FIELDS.script.join(", "));
  if (typeof s.format !== "string" || !/^2\.\d+$/.test(s.format)) add("S-E001", "format", "format is 2.x", '"format": "2.0"');
  if (typeof s.id !== "string" || !/^[A-Z0-9_]+\/[A-Za-z0-9_]+$/.test(s.id)) add("S-E001", "id", "id is SET/Slug", '"id": "SIMS/Walk_Run_Jump"');
  if (!isNum(s.dur) || s.dur <= 0 || s.dur > 600) add("S-E004", "dur", "dur is seconds, above 0 and at most 600", '"dur": 5');
  if (s.rate !== undefined && !(Number.isInteger(s.rate) && (s.rate as number) >= 10 && (s.rate as number) <= 240)) add("S-E004", "rate", "rate is whole steps a second, 10 to 240", '"rate": 60');
  if (s.film !== undefined && !(Number.isInteger(s.film) && (s.film as number) >= 0 && (s.film as number) <= 32)) add("S-E004", "film", "film is how many frames, 0 to 32", '"film": 8');
  if (s.root !== undefined && s.root !== "root" && s.root !== "in-place") add("S-E001", "root", 'root is "root" or "in-place"', '"root": "in-place"');
  if (s.units !== undefined && s.units !== "m" && s.units !== "H0") add("S-E001", "units", 'units is "m" or "H0"', '"units": "m"');
  if (graph && s.graph !== undefined && s.graph !== graph.id) add("S-E007", "graph", `the script is for ${String(s.graph)}, not ${graph.id}`, `"graph": "${graph.id}", or run it with ${String(s.graph)}`);
  const params = graph?.parameters ?? {}, typeOf = (n: string) => params[n]?.type;
  if (s.warp !== undefined) {
    const states = graph ? [graph.states, ...(graph.layers ?? []).map((L) => L.states)].flatMap((x) => Object.values(x)) : [];
    if (typeof s.warp !== "string") add("S-E005", "warp", "warp names a number parameter", '"warp": "warp"');
    else if (s.root !== "in-place") add("S-E005", "warp", "stride warping matches playback to a ground speed the game moves at: in place only", '"root": "in-place"');
    else if (graph && (typeOf(s.warp) !== "number" || !states.some((x) => x.rate === s.warp))) add("S-E005", "warp", `"${s.warp}" isn't a number parameter a state's rate reads`, `give the moving state "rate": "${s.warp}", and the graph a number parameter "${s.warp}"`);
  }
  if (!Array.isArray(s.input)) return [...out, { code: "S-E001", field: "input", message: "input is a list of rows in time order", fix: '"input": [{ "t": 0.5, "set": { "speed": 1.4 } }]' }];
  let last = 0;
  (s.input as unknown[]).forEach((r, i) => {
    const at = `input.${i}`;
    if (!isObj(r)) return add("S-E002", at, "a row is { t, set, trigger, move }", '{ "t": 1, "trigger": "jump" }');
    for (const k of Object.keys(r)) if (!FIELDS.input.includes(k)) add("S-E006", `${at}.${k}`, `"${k}" is not a field of a row`, FIELDS.input.join(", "));
    if (!isNum(r.t) || r.t < last || (isNum(s.dur) && r.t > s.dur)) add("S-E002", `${at}.t`, `t is seconds in time order, ${last} to the script's dur`, `"t": ${last}`);
    else last = r.t;
    if (r.set === undefined && r.trigger === undefined && r.move === undefined) add("S-E002", at, "the row does nothing", '"set", "trigger" or "move"');
    if (r.set !== undefined && !isObj(r.set)) add("S-E003", `${at}.set`, "set is parameters by name", '"set": { "speed": 1.4 }');
    for (const [k, v] of Object.entries(isObj(r.set) ? r.set : {})) {
      const type = typeOf(k);
      if (graph && (type === undefined || type === "trigger")) add("S-E003", `${at}.set.${k}`, `${graph.id} has no number or bool parameter "${k}"`, Object.keys(params).filter((n) => typeOf(n) !== "trigger").join(", ") || "none: set nothing");
      else if (type === "number" ? !isNum(v) : type === "bool" ? typeof v !== "boolean" : !(isNum(v) || typeof v === "boolean")) add("S-E003", `${at}.set.${k}`, `"${k}" is ${type ? `a ${type}` : "a number or a bool"}, not ${JSON.stringify(v)}`, type === "bool" ? "true or false" : "a number");
    }
    const triggers = r.trigger === undefined ? [] : Array.isArray(r.trigger) ? r.trigger : [r.trigger];
    for (const t of triggers) if (typeof t !== "string" || (graph && typeOf(t) !== "trigger")) add("S-E003", `${at}.trigger`, `${graph ? `${graph.id} has no trigger` : "a trigger is named by"} ${JSON.stringify(t)}`, graph ? Object.keys(params).filter((n) => typeOf(n) === "trigger").join(", ") || "none" : '"jump"');
    if (r.move !== undefined && !(isNum(r.move) && r.move >= 0 && r.move <= 50)) add("S-E004", `${at}.move`, "move is a ground speed forward, 0 to 50", '"move": 1.4');
    if (r.over !== undefined && !(isNum(r.over) && r.over >= 0 && r.over <= 60)) add("S-E004", `${at}.over`, "over is seconds, 0 to 60", '"over": 0.5');
  });
  return out;
}
