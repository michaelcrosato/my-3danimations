// The graph's shapes (PLAN.md WP-6.4, D73; spec/GRAPH.md): parameters a host sets, a base layer of states and the
// transitions between them, and layers over it. A state plays a clip (a library clip, a compiled recipe or action, a
// procedural part: whatever the host's clips hold), or a blend space of clips by one or two parameters, or nothing
// (`pass`, on a layer over the base, so what is below shows through). After PlayCanvas's anim state graph and Godot's
// AnimationTree, which agents may already know, and Emberdeep's clip moves (fade, mask, a start time, chaining).

/** A parameter: a number, a true or false, or a trigger (set by the host, used up by the transition it fires). */
export interface GraphParameter {
  type: "number" | "bool" | "trigger";
  /** Its value before the host sets it (0, false). A trigger starts unset. */
  value?: number | boolean;
  /** A trigger only: how long a press waits to be used, seconds (until it is, without one): input buffering. */
  buffer?: number;
}

/** A blend point: where on the parameter (or the two) the clip plays alone. */
export interface BlendPoint {
  at: number | [number, number];
  clip: string;
}
/** A blend space: clips weighted by one parameter (`param`, points in rising order) or two (`params`). */
export interface BlendSpace {
  param?: string;
  params?: [string, string];
  points: BlendPoint[];
  /** The clips kept at the same phase of their cycles, each playing at the speed that keeps it there (true). */
  sync?: boolean;
}

/** A state: exactly one of `clip`, `recipe`, `blend` or `pass`. */
export interface GraphState {
  clip?: string;
  /** A compiled recipe's clip by its id: played as a clip, named as made from a recipe. */
  recipe?: string;
  blend?: BlendSpace;
  /** Nothing plays (a layer over the base only): what is below shows through. */
  pass?: true;
  /** Playback speed (1; a one-shot's is above 0). */
  speed?: number;
  /** A number parameter the speed is multiplied by, each step: a host matching playback to its ground speed (stride
   *  warping) sets it. */
  rate?: string;
  /** Where a clip state starts, seconds (0), unless its transition syncs it. */
  at?: number;
}

/** One test a transition makes of a parameter: a trigger or a bool alone is "set" or "true". */
export interface Condition {
  param: string;
  op?: "==" | "!=" | "<" | "<=" | ">" | ">=";
  value?: number | boolean;
}

/** A way from a state (or several, or any: "*") to another, taken when its conditions hold. */
export interface GraphTransition {
  from: string | string[];
  to: string;
  /** All must hold (none: always). The triggers it reads are used up when it is taken. */
  when?: Condition[];
  /** Taken only once the state it leaves has played this share of its length (of each cycle, for a loop): 1 at a
   *  one-shot's end. */
  exit?: number;
  /** Taken only while the state it leaves is within these seconds of its own time: a cancel window. */
  window?: [number, number];
  /** The crossfade, seconds (0.2). */
  fade?: number;
  /** The state it goes to starts at the phase the one it leaves is at (a walk into a run in step), not its start. */
  sync?: boolean;
  /** While it fades, the state it goes to may be left by its own transitions (false: it plays the fade out first). */
  interruptible?: boolean;
}

/** A layer of states: the base (the graph's own fields), or one over it with a mask, a weight, or added. */
export interface GraphLayer {
  name: string;
  start: string;
  states: Record<string, GraphState>;
  transitions: GraphTransition[];
  /** Body groups (`"upper"`, `["armL", "head"]`) or weights by field: what it touches (all). */
  mask?: string | string[] | Record<string, number>;
  /** How much of it goes over the layers below, 0 to 1 (1). */
  weight?: number;
  /** Its states' changes from their first keys added over the layers below (false). */
  additive?: boolean;
}

/** A graph: its parameters, its base layer (`start`, `states`, `transitions`) and the layers over it. */
export interface Graph {
  format: string;
  id: string;
  name?: string;
  desc?: string;
  tags?: string[];
  parameters?: Record<string, GraphParameter>;
  start: string;
  states: Record<string, GraphState>;
  transitions: GraphTransition[];
  layers?: GraphLayer[];
}

/** The graph's layers, the base first: its own fields as the layer named "base". */
export function layersOf(g: Graph): GraphLayer[] {
  return [{ name: "base", start: g.start, states: g.states, transitions: g.transitions }, ...(g.layers ?? [])];
}
/** A state's clips: one, or a blend space's points (none for `pass`). */
export function clipsOf(s: GraphState): string[] {
  return s.clip !== undefined ? [s.clip] : s.recipe !== undefined ? [s.recipe] : s.blend ? s.blend.points.map((p) => p.clip) : [];
}
