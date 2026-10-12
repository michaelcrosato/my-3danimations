// A graph playing (PLAN.md WP-6.4, D73; spec/GRAPH.md §3): its parameters, each layer's state and the crossfade out of
// the one before, and, each fixed step, the transitions taken and the Animator layers that play the states: a clip
// state one layer, a blend space one per point (weighted by its parameters, kept in phase), a fade both states' at
// their shares. The Animator mixes and advances those layers as it does any; their playheads are the states' time.
// Plain arithmetic in a fixed order, so every engine takes the same transitions at the same steps.
import type { ClipEvent } from "../format/types.ts";
import { hashValue } from "../math/hash.ts";
import { mask as maskOf, type Mask } from "../ops/pose.ts";
import { weights1D, weights2D } from "./blend.ts";
import { clipsOf, layersOf, type Graph, type GraphLayer, type GraphState, type GraphTransition } from "./types.ts";

/** A clip as the graph plays it: what the Animator's layers take (an id, its length, whether it loops). */
export interface GraphClip {
  id: string;
  dur: number;
  loop: boolean;
}
/** One Animator layer of the plan: its name (`@layer/entry/point`), clip, weight over what is below, mask, whether it
 *  adds, its speed, and the clip time it starts at when it is new. */
export interface PlanLayer<C extends GraphClip = GraphClip> {
  name: string;
  clip: C;
  weight: number;
  mask: Mask | null;
  additive: boolean;
  speed: number;
  start: number;
}
/** A state a layer entered at a step: the layer, the state, the one it left, and where it started (s). */
export interface Entered {
  layer: string;
  state: string;
  from: string;
  clip: string;
  t: number;
  event: ClipEvent;
}
/** A playhead as the Animator holds it. */
export interface Playhead {
  time: number;
  held: "start" | "end" | null;
}
/** A graph's state as JSON-safe data: in the Animator's `save()` and `hash()`. */
export interface GraphSave {
  id: string;
  /** The graph's content hash: a restore refuses another graph. */
  hash: string;
  params: Record<string, number | boolean>;
  /** Triggers set and not yet used, in name order. */
  triggers: string[];
  layers: { name: string; state: string; entry: number; from: { state: string; entry: number } | null; fade: number; elapsed: number; interruptible: boolean; count: number }[];
}

interface Instance {
  state: string;
  entry: number;
}
interface Run {
  def: GraphLayer;
  mask: Mask | null;
  weight: number;
  state: string;
  entry: number;
  from: Instance | null;
  fade: number;
  elapsed: number;
  interruptible: boolean;
  /** States entered so far: each instance's layers are named by its entry, so a state entered again while its last
   *  entry still fades out plays apart from it. */
  count: number;
  /** The start time of each new instance's layers, by name, until the Animator has made them. */
  starts: Map<string, number>;
}

/** A graph made ready to play on clips: each state's clips found, the start states entered. */
export class GraphRun<C extends GraphClip = GraphClip> {
  readonly graph: Graph;
  readonly hash: string;
  readonly #clips: Map<string, C>;
  readonly #types = new Map<string, string>();
  readonly #params = new Map<string, number | boolean>();
  #triggers = new Set<string>();
  readonly #runs: Run[];

  /** `clips` finds each clip a state names (the graph checked and its clips found by the caller). */
  constructor(graph: Graph, clips: (id: string) => C) {
    this.graph = graph;
    this.hash = hashValue(JSON.parse(JSON.stringify(graph)));
    this.#clips = new Map();
    for (const L of layersOf(graph)) for (const s of Object.values(L.states)) for (const id of clipsOf(s)) this.#clips.set(id, clips(id));
    for (const [name, p] of Object.entries(graph.parameters ?? {})) {
      this.#types.set(name, p.type);
      if (p.type !== "trigger") this.#params.set(name, p.value ?? (p.type === "bool" ? false : 0));
    }
    this.#runs = layersOf(graph).map((def, i) => {
      const r: Run = { def, mask: i === 0 || def.mask === undefined ? null : typeof def.mask === "string" || Array.isArray(def.mask) ? maskOf(def.mask) : { ...def.mask }, weight: i === 0 ? 1 : (def.weight ?? 1), state: def.start, entry: 1, from: null, fade: 0, elapsed: 0, interruptible: false, count: 1, starts: new Map() };
      this.#enter(r, def.start, 1, phaseAt(def.states[def.start]!, this.#len(def.states[def.start]!)));
      return r;
    });
  }

  /** A parameter's type, or undefined if the graph has none of that name. */
  typeOf(name: string): string | undefined {
    return this.#types.get(name);
  }
  /** Sets a number or bool parameter (the caller checks the type). */
  set(name: string, value: number | boolean): void {
    this.#params.set(name, value);
  }
  /** Sets a trigger: it stays set until a transition reading it is taken. */
  trigger(name: string): void {
    this.#triggers.add(name);
  }
  /** The parameters' values, and the triggers set. */
  get params(): Record<string, number | boolean> {
    return Object.fromEntries([...this.#params.entries(), ...[...this.#triggers].map((t) => [t, true] as const)]);
  }
  /** Each layer's state, the one fading out (if any) and how far the fade is (0 to 1). */
  get states(): { layer: string; state: string; from: string | null; fade: number }[] {
    return this.#runs.map((r) => ({ layer: r.def.name, state: r.state, from: r.from?.state ?? null, fade: r.from ? Math.min(1, r.elapsed / r.fade) : 1 }));
  }

  /**
   * One fixed step of `h` s: each layer takes the first transition that holds (unless it is fading and the fade may not
   * be interrupted), then the plan of Animator layers for this step; the fades then move on. `read` gives a planned
   * layer's playhead.
   */
  step(h: number, read: (name: string) => Playhead | undefined): { plan: PlanLayer<C>[]; entered: Entered[] } {
    const entered: Entered[] = [];
    for (const r of this.#runs) {
      if (r.from && r.elapsed >= r.fade) r.from = null;
      if (r.from && !r.interruptible) continue;
      const t = r.def.transitions.find((x) => this.#holds(r, x, read));
      if (t) entered.push(this.#take(r, t, read));
    }
    const plan = this.plan();
    for (const r of this.#runs) if (r.from) r.elapsed += h;
    return { plan, entered };
  }

  /** The Animator layers that play the graph now, bottom first, without moving on. */
  plan(): PlanLayer<C>[] {
    const out: PlanLayer<C>[] = [];
    this.#runs.forEach((r, li) => {
      const f = r.from ? (r.fade > 0 ? Math.min(1, r.elapsed / r.fade) : 1) : 1;
      const parts = [...(r.from ? this.#members(r, r.from, 1 - f) : []), ...this.#members(r, { state: r.state, entry: r.entry }, f)];
      // the parts that show first, so the layer at the bottom (taken whole) is one that does
      const shown = [...parts.filter((p) => p.w > 0), ...parts.filter((p) => !(p.w > 0))], total = shown.reduce((a, p) => a + p.w, 0);
      let sum = 0;
      for (const p of shown) {
        sum += p.w;
        // each layer's weight over the ones below, so the stack gives each part its share: in the base, of the
        // parts so far; over it, also of what is below at (1 − weight × the layer's total)
        const w = r.def.additive ? r.weight * p.w : li === 0 ? (sum > 0 ? p.w / sum : 0) : (r.weight * p.w) / Math.max(1e-12, 1 - r.weight * total + r.weight * sum);
        out.push({ name: p.name, clip: p.clip, weight: w, mask: r.mask, additive: r.def.additive === true, speed: p.speed, start: r.starts.get(p.name) ?? 0 });
      }
    });
    return out;
  }

  /** The graph's state as plain data. */
  save(): GraphSave {
    return {
      id: this.graph.id, hash: this.hash, params: Object.fromEntries(this.#params), triggers: [...this.#triggers].sort(),
      layers: this.#runs.map((r) => ({ name: r.def.name, state: r.state, entry: r.entry, from: r.from ? { ...r.from } : null, fade: r.fade, elapsed: r.elapsed, interruptible: r.interruptible, count: r.count })),
    };
  }
  /** Carries on from saved state (the caller checked the hash). */
  restore(s: GraphSave): void {
    this.#params.clear();
    for (const [k, v] of Object.entries(s.params)) this.#params.set(k, v);
    this.#triggers = new Set(s.triggers);
    s.layers.forEach((x, i) => {
      const r = this.#runs[i]!;
      Object.assign(r, { state: x.state, entry: x.entry, from: x.from ? { ...x.from } : null, fade: x.fade, elapsed: x.elapsed, interruptible: x.interruptible, count: x.count, starts: new Map() });
    });
  }
  /** Forgets the start times of layers the Animator has made. */
  made(names: readonly string[]): void {
    for (const r of this.#runs) for (const n of names) r.starts.delete(n);
  }

  /** A state's length: a clip's, or a blend space's by its weights now (its cycle at the speed that keeps it in phase). */
  #len(s: GraphState): number {
    const ids = clipsOf(s);
    if (!ids.length) return 0;
    if (!s.blend) return this.#clips.get(ids[0]!)!.dur;
    const w = this.#weights(s);
    return ids.reduce((a, id, i) => a + w[i]! * this.#clips.get(id)!.dur, 0);
  }
  /** A blend space's weights now. */
  #weights(s: GraphState): number[] {
    const b = s.blend!, num = (p: string) => Number(this.#params.get(p) ?? 0);
    return b.params ? weights2D(b.points.map((p) => p.at as [number, number]), [num(b.params[0]), num(b.params[1])]) : weights1D(b.points.map((p) => p.at as number), num(b.param!));
  }
  /** An instance's layers: each point of a blend (or the clip), its share of `scale`, its speed. */
  #members(r: Run, inst: Instance, scale: number): { name: string; clip: C; w: number; speed: number }[] {
    const s = r.def.states[inst.state]!, ids = clipsOf(s), speed = s.speed ?? 1;
    if (!ids.length) return [];
    if (!s.blend) return [{ name: nameOf(r, inst, 0), clip: this.#clips.get(ids[0]!)!, w: scale, speed }];
    const w = this.#weights(s), len = this.#len(s), sync = s.blend.sync !== false;
    return ids.map((id, i) => {
      const c = this.#clips.get(id)!;
      return { name: nameOf(r, inst, i), clip: c, w: w[i]! * scale, speed: sync && len > 0 ? (speed * c.dur) / len : speed };
    });
  }
  /** Where an instance is in its length, 0 to 1 (a loop's within its cycle; a one-shot at its end 1). */
  #phase(r: Run, inst: Instance, read: (name: string) => Playhead | undefined): number {
    const s = r.def.states[inst.state]!, ids = clipsOf(s);
    if (!ids.length) return 0;
    // a blend's leading point: the heaviest (the first of equals); in phase with the rest when it syncs
    const w = s.blend ? this.#weights(s) : [1];
    let k = 0;
    for (let i = 1; i < w.length; i++) if (w[i]! > w[k]!) k = i;
    const c = this.#clips.get(ids[k]!)!, p = read(nameOf(r, inst, k));
    if (!p || !(c.dur > 0)) return 0;
    return p.held === "end" ? 1 : Math.min(1, p.time / c.dur);
  }
  /** Whether a transition holds now for a layer. */
  #holds(r: Run, t: GraphTransition, read: (name: string) => Playhead | undefined): boolean {
    const named = t.from === "*" ? false : (typeof t.from === "string" ? [t.from] : t.from).includes(r.state);
    if (!(named || t.from === "*")) return false;
    // into the state it is in only when the transition names it: "*" never restarts a state
    if (t.to === r.state && !named) return false;
    for (const c of t.when ?? []) if (!this.#test(c.param, c.op, c.value)) return false;
    if (t.exit !== undefined && this.#phase(r, { state: r.state, entry: r.entry }, read) < t.exit - 1e-9) return false;
    if (t.window) {
      const secs = this.#phase(r, { state: r.state, entry: r.entry }, read) * this.#len(r.def.states[r.state]!);
      if (secs < t.window[0] - 1e-9 || secs > t.window[1] + 1e-9) return false;
    }
    return true;
  }
  #test(param: string, op: string | undefined, value: number | boolean | undefined): boolean {
    if (this.#types.get(param) === "trigger") return this.#triggers.has(param);
    const v = this.#params.get(param);
    if (op === undefined) return v === true;
    switch (op) {
      case "==": return v === value;
      case "!=": return v !== value;
      case "<": return (v as number) < (value as number);
      case "<=": return (v as number) <= (value as number);
      case ">": return (v as number) > (value as number);
      default: return (v as number) >= (value as number);
    }
  }
  /** Takes a transition: the triggers it read used up, the state it leaves fading out, the new one entered. */
  #take(r: Run, t: GraphTransition, read: (name: string) => Playhead | undefined): Entered {
    for (const c of t.when ?? []) if (this.#types.get(c.param) === "trigger") this.#triggers.delete(c.param);
    const prev = r.state, phase = t.sync ? this.#phase(r, { state: r.state, entry: r.entry }, read) : undefined, to = r.def.states[t.to]!;
    r.from = { state: r.state, entry: r.entry };
    r.fade = t.fade ?? 0.2;
    r.elapsed = 0;
    r.interruptible = t.interruptible === true;
    if (!(r.fade > 0)) r.from = null;
    r.count++;
    const start = this.#enter(r, t.to, r.count, phase ?? phaseAt(to, this.#len(to)));
    const ids = clipsOf(to);
    return { layer: r.def.name, state: t.to, from: prev, clip: ids[0] ?? "", t: start, event: { t: start, name: "enter", state: t.to, from: prev } };
  }
  /** Enters a state as entry `entry` at a phase (0 to 1): its layers' start times. Returns the first one's (s). */
  #enter(r: Run, state: string, entry: number, phase: number): number {
    r.state = state;
    r.entry = entry;
    const s = r.def.states[state]!, ids = clipsOf(s);
    ids.forEach((id, i) => r.starts.set(nameOf(r, { state, entry }, i), phase * this.#clips.get(id)!.dur));
    return ids.length ? phase * this.#clips.get(ids[0]!)!.dur : 0;
  }
}

/** An instance's layer for point i: `@layer/entry/i`. */
const nameOf = (r: Run, inst: Instance, i: number) => `@${r.def.name}/${inst.entry}/${i}`;
/** Where a state starts on its own, 0 to 1: a clip state's `at` over its length, else its start. */
const phaseAt = (s: GraphState, len: number) => (s.at !== undefined && len > 0 ? Math.min(1, s.at / len) : 0);
