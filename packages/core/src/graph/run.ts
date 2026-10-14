// A graph playing (PLAN.md WP-6.4, D73; spec/GRAPH.md §2): its parameters, each layer's state and the crossfade out of
// the states before it, and, each fixed step, the transitions taken and the Animator layers that play the states: a
// clip state one layer, a blend space one per point (weighted by its parameters, kept in phase), a fade the states
// fading out at their shares and the one fading in at its. The Animator mixes and advances those layers as it does
// any; their playheads are the states' time. Plain arithmetic in a fixed order, so every engine takes the same
// transitions at the same steps.
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
/** A playhead as the Animator holds it: its clip time, the end it rests on, its loop cycles and its speed. */
export interface Playhead {
  time: number;
  held: "start" | "end" | null;
  cycle: number;
  speed: number;
}
/** A state entered (the `entry`-th of its layer) and, fading out, its share of what fades out. */
export interface Instance {
  state: string;
  entry: number;
}
/** A graph's state as JSON-safe data: in the Animator's `save()` and `hash()`. */
export interface GraphSave {
  id: string;
  /** The graph's content hash: a restore refuses another graph. */
  hash: string;
  /** The content hash of each clip the graph names, by id: a restore refuses a clip edited since. */
  clips: Record<string, string>;
  params: Record<string, number | boolean>;
  /** Triggers set and not yet used, each with how long it has waited (s). */
  triggers: Record<string, number>;
  layers: { name: string; state: string; entry: number; out: (Instance & { w: number })[]; fade: number; elapsed: number; interruptible: boolean; count: number }[];
}

/** Fades are done, and shares reached, to a billionth of a second (as the Animator's steps are). */
const EPS = 1e-9;
/** The most states one layer fades out at once: a fade cut while another is cut drops the faintest past this. */
const MAX_OUT = 4;
interface Run {
  def: GraphLayer;
  mask: Mask | null;
  weight: number;
  state: string;
  entry: number;
  /** The states fading out, each with its share of what fades out (summing to 1): the state left, and when a fade was
   *  cut, the states it was fading out too. Empty when no fade plays. */
  out: (Instance & { w: number })[];
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
  /** The graph it plays. */
  readonly graph: Graph;
  /** The graph's content hash. */
  readonly hash: string;
  /** Each clip's content hash, by id (from `hashOf`; none without it). */
  readonly clipHashes: Record<string, string>;
  readonly #clips: Map<string, C>;
  readonly #types = new Map<string, string>();
  readonly #buffers = new Map<string, number>();
  readonly #params = new Map<string, number | boolean>();
  /** Triggers set and not yet used, and how long each has waited (s). */
  #triggers = new Map<string, number>();
  readonly #runs: Run[];

  /** `clips` finds each clip a state names (the graph checked and its clips found by the caller); `hashOf` hashes one. */
  constructor(graph: Graph, clips: (id: string) => C, hashOf?: (c: C) => string) {
    // the run reads its own copy: the caller's graph may change after play without changing (or breaking) the run, and
    // a -0 in it is 0, as it is in a save that went through JSON
    this.graph = JSON.parse(JSON.stringify(graph)) as Graph;
    this.hash = hashValue(this.graph);
    this.#clips = new Map();
    for (const L of layersOf(this.graph)) for (const s of Object.values(L.states)) for (const id of clipsOf(s)) this.#clips.set(id, clips(id));
    this.clipHashes = Object.fromEntries([...this.#clips.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, c]) => [id, hashOf ? hashOf(c) : ""]));
    for (const [name, p] of Object.entries(this.graph.parameters ?? {})) {
      this.#types.set(name, p.type);
      if (p.type !== "trigger") this.#params.set(name, p.type === "bool" ? (p.value ?? false) : ((p.value ?? 0) as number) + 0);
      else if (p.buffer !== undefined) this.#buffers.set(name, p.buffer);
    }
    this.#runs = layersOf(this.graph).map((def, i) => {
      const r: Run = { def, mask: i === 0 || def.mask === undefined ? null : typeof def.mask === "string" || Array.isArray(def.mask) ? maskOf(def.mask) : { ...def.mask }, weight: i === 0 ? 1 : (def.weight ?? 1), state: def.start, entry: 1, out: [], fade: 0, elapsed: 0, interruptible: false, count: 1, starts: new Map() };
      this.#enter(r, def.start, 1, this.#startOf(def.states[def.start]!));
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
  /** Sets a trigger: it stays set until a transition reading it is taken, or for its `buffer` seconds. */
  trigger(name: string): void {
    this.#triggers.set(name, 0);
  }
  /** Clears a trigger set and not yet used. */
  reset(name: string): void {
    this.#triggers.delete(name);
  }
  /** The parameters' values, and the triggers set. */
  get params(): Record<string, number | boolean> {
    return Object.fromEntries([...this.#params.entries(), ...[...this.#triggers.keys()].map((t) => [t, true] as const)]);
  }
  /** Each layer's state, the one it left (if it still fades out) and how far the fade is (0 to 1). */
  get states(): { layer: string; state: string; from: string | null; fade: number }[] {
    return this.#runs.map((r) => ({ layer: r.def.name, state: r.state, from: r.out.at(-1)?.state ?? null, fade: share(r) }));
  }

  /**
   * One fixed step of `h` s: each layer lets a finished fade go and takes the first transition that holds (unless it is
   * fading and the fade may not be interrupted); the fades move on, and the plan of Animator layers is made for the
   * step, each state at its share as the step ends (a state faded into plays, and fires its events, from its first
   * step). `read` gives a planned layer's playhead. A trigger not used ages by the step, and goes past its buffer.
   */
  step(h: number, read: (name: string) => Playhead | undefined): { plan: PlanLayer<C>[]; entered: Entered[] } {
    const entered: Entered[] = [];
    for (const r of this.#runs) {
      if (r.out.length && r.elapsed >= r.fade - EPS) r.out = [];
      if (r.out.length && !r.interruptible) continue;
      const t = r.def.transitions.find((x) => this.#holds(r, x, read, h));
      if (t) entered.push(this.#take(r, t, read));
    }
    for (const r of this.#runs) if (r.out.length) r.elapsed += h;
    for (const [name, age] of [...this.#triggers]) {
      const buffer = this.#buffers.get(name);
      if (buffer !== undefined && age + h > buffer + EPS) this.#triggers.delete(name);
      else this.#triggers.set(name, age + h);
    }
    return { plan: this.plan(), entered };
  }

  /** The Animator layers that play the graph now, bottom first, without moving on. */
  plan(): PlanLayer<C>[] {
    const out: PlanLayer<C>[] = [];
    this.#runs.forEach((r, li) => {
      const f = share(r);
      const parts = [...r.out.flatMap((o) => this.#members(r, o, o.w * (1 - f))), ...this.#members(r, { state: r.state, entry: r.entry }, f)];
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
      id: this.graph.id, hash: this.hash, clips: { ...this.clipHashes }, params: Object.fromEntries(this.#params), triggers: Object.fromEntries(this.#triggers),
      layers: this.#runs.map((r) => ({ name: r.def.name, state: r.state, entry: r.entry, out: r.out.map((o) => ({ ...o })), fade: r.fade, elapsed: r.elapsed, interruptible: r.interruptible, count: r.count })),
    };
  }
  /**
   * Why saved state can't be carried on from (a state, parameter or trigger the graph doesn't have, or a malformed
   * fade), or null; `restore` takes it only when null.
   */
  misfit(s: GraphSave): string | null {
    const layers = layersOf(this.graph), finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
    if (!Array.isArray(s.layers) || s.layers.length !== layers.length) return `it has ${Array.isArray(s.layers) ? s.layers.length : "no"} layers, the graph ${layers.length}`;
    for (const [i, x] of s.layers.entries()) {
      const L = layers[i]!, has = (st: unknown) => typeof st === "string" && Object.hasOwn(L.states, st);
      if (!x || x.name !== L.name || !has(x.state) || ![x.entry, x.fade, x.elapsed, x.count].every(finite) || typeof x.interruptible !== "boolean") return `its layer ${i} isn't one of the graph's layers in a state it has`;
      if (!Array.isArray(x.out) || !x.out.every((o) => o && has(o.state) && finite(o.entry) && finite(o.w))) return `its layer "${L.name}" fades out of states the graph doesn't have`;
    }
    if (!s.params || typeof s.params !== "object") return "it has no parameters";
    for (const [k, v] of Object.entries(s.params)) if (this.#types.get(k) !== (typeof v === "boolean" ? "bool" : finite(v) ? "number" : "")) return `its parameter "${k}" isn't one of the graph's, of its type`;
    if (!s.triggers || typeof s.triggers !== "object" || Array.isArray(s.triggers)) return "its triggers aren't by name";
    for (const [k, v] of Object.entries(s.triggers)) if (this.#types.get(k) !== "trigger" || !finite(v)) return `its trigger "${k}" isn't one of the graph's`;
    return null;
  }
  /** Carries on from saved state (the caller checked the hashes and `misfit`). */
  restore(s: GraphSave): void {
    this.#params.clear();
    for (const [k, v] of Object.entries(s.params)) this.#params.set(k, typeof v === "number" ? v + 0 : v);
    this.#triggers = new Map(Object.entries(s.triggers).map(([k, v]) => [k, v + 0]));
    s.layers.forEach((x, i) => {
      const r = this.#runs[i]!;
      Object.assign(r, { state: x.state, entry: x.entry, out: x.out.map((o) => ({ state: o.state, entry: o.entry, w: o.w + 0 })), fade: x.fade + 0, elapsed: x.elapsed + 0, interruptible: x.interruptible, count: x.count, starts: new Map() });
    });
  }
  /** Forgets the start times of layers the Animator has made. */
  made(names: readonly string[]): void {
    for (const r of this.#runs) for (const n of names) r.starts.delete(n);
  }

  /** A state's length: a clip's, or a blend space's by its weights now (its cycle at the speed that keeps it in phase). */
  /** Where a state starts on its own (`phaseAt`), its clip a loop or not. */
  #startOf(s: GraphState): number {
    const ids = clipsOf(s);
    return phaseAt(s, this.#len(s), ids.length > 0 && this.#clips.get(ids[0]!)?.loop === true);
  }
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
    const s = r.def.states[inst.state]!, ids = clipsOf(s), speed = (s.speed ?? 1) * (s.rate !== undefined ? Number(this.#params.get(s.rate) ?? 1) : 1);
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
    return this.#lead(r, inst, read)?.phase ?? 0;
  }
  /**
   * An instance's leading point (a blend's heaviest, the first of equals; in phase with the rest when it syncs): its
   * phase, 0 to 1, and the share of its length the last step moved it (to tell a loop's step past its cycle's end).
   */
  #lead(r: Run, inst: Instance, read: (name: string) => Playhead | undefined): { phase: number; moved: number; loop: boolean; cycle: number } | null {
    const s = r.def.states[inst.state]!, ids = clipsOf(s);
    if (!ids.length) return null;
    const w = s.blend ? this.#weights(s) : [1];
    let k = 0;
    for (let i = 1; i < w.length; i++) if (w[i]! > w[k]!) k = i;
    const c = this.#clips.get(ids[k]!)!, p = read(nameOf(r, inst, k));
    if (!p || !(c.dur > 0)) return null;
    return { phase: p.held === "end" ? 1 : Math.min(1, p.time / c.dur), moved: p.speed / c.dur, loop: c.loop, cycle: p.cycle };
  }
  /**
   * Whether a transition's exit share allows it now: the state has played that share of its length (of this cycle, for
   * a loop), or, a loop, its last step carried it over that share into the next cycle (a share within a step of the
   * end is never stepped over).
   */
  #exited(r: Run, exit: number, read: (name: string) => Playhead | undefined, h: number): boolean {
    const l = this.#lead(r, { state: r.state, entry: r.entry }, read);
    if (!l) return exit <= EPS;
    if (l.phase >= exit - EPS) return true;
    const before = l.phase - l.moved * h;
    return l.loop && l.cycle >= 1 && before < 0 && before + 1 < exit - EPS;
  }
  /** Whether a transition holds now for a layer. */
  #holds(r: Run, t: GraphTransition, read: (name: string) => Playhead | undefined, h: number): boolean {
    const named = t.from === "*" ? false : (typeof t.from === "string" ? [t.from] : t.from).includes(r.state);
    if (!(named || t.from === "*")) return false;
    // into the state it is in only when the transition names it: "*" never restarts a state
    if (t.to === r.state && !named) return false;
    for (const c of t.when ?? []) if (!this.#test(c.param, c.op, c.value)) return false;
    if (t.exit !== undefined && !this.#exited(r, t.exit, read, h)) return false;
    if (t.window) {
      // open while the state's time is within it, or when its last step carried it over it (a window narrower than a
      // step is never stepped over, as an exit share isn't)
      const len = this.#len(r.def.states[r.state]!), secs = this.#phase(r, { state: r.state, entry: r.entry }, read) * len;
      const l = this.#lead(r, { state: r.state, entry: r.entry }, read), before = l ? secs - l.moved * h * len : secs;
      if (secs < t.window[0] - 1e-9 || before > t.window[1] + 1e-9) return false;
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
  /**
   * Takes a transition: the triggers it read used up, the state it leaves fading out (with what a fade it cuts was
   * fading out, each at its share now, so the pose carries on), the new one entered.
   */
  #take(r: Run, t: GraphTransition, read: (name: string) => Playhead | undefined): Entered {
    for (const c of t.when ?? []) if (this.#types.get(c.param) === "trigger") this.#triggers.delete(c.param);
    const prev = r.state, phase = t.sync ? this.#phase(r, { state: r.state, entry: r.entry }, read) : undefined, to = r.def.states[t.to]!;
    const f = share(r), out = [...r.out.map((o) => ({ ...o, w: o.w * (1 - f) })), { state: r.state, entry: r.entry, w: r.out.length ? f : 1 }].filter((o) => o.w > EPS);
    // past MAX_OUT the faintest go, the rest scaled up to make up their share
    while (out.length > MAX_OUT) out.splice(out.reduce((m, o, i) => (o.w < out[m]!.w ? i : m), 0), 1);
    const sum = out.reduce((a, o) => a + o.w, 0);
    r.fade = (t.fade ?? 0.2) + 0;
    r.out = r.fade > 0 ? out.map((o) => ({ ...o, w: o.w / sum })) : [];
    r.elapsed = 0;
    r.interruptible = t.interruptible === true;
    r.count++;
    const start = this.#enter(r, t.to, r.count, phase ?? this.#startOf(to));
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

/** How far a layer's fade is, 0 to 1 (1 when none plays): linear over its length, done to a billionth of a second. */
const share = (r: Run) => (!r.out.length || !(r.fade > 0) || r.elapsed >= r.fade - EPS ? 1 : r.elapsed / r.fade);
/** An instance's layer for point i: `@layer/entry/i`. */
const nameOf = (r: Run, inst: Instance, i: number) => `@${r.def.name}/${inst.entry}/${i}`;
/** Where a state starts on its own, 0 to 1: a clip state's `at` over its length (round a loop's cycle, held at a
 *  one-shot's end), else its start. */
const phaseAt = (s: GraphState, len: number, loop: boolean) => (s.at !== undefined && len > 0 ? (loop ? (s.at / len) % 1 : Math.min(1, s.at / len)) : 0);
