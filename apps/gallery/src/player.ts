// What the stage plays (PLAN.md WP-8.1): a clip, or a graph driven by a simulation script, on a bound character, with
// one time model for both: a time from 0 to the clip's or the script's length that playing advances (at any rate),
// stepping moves one frame at a time (a clip's 1/fps, a script's step) and scrubbing sets. A clip is posed at its time
// by core's Animator (its feet planted) and placed where its root path puts it (its own travel, or its planted feet's,
// cycle after cycle for a loop). A graph is stepped as graph.sim steps it (@m3a/tools sim/simulate.ts: the script's
// rows applied at their times, numbers eased, stride warping in place), from the start again when it goes back. Every
// path is deterministic: the same clip or script at the same time poses the same bones (`hash`, @m3a/three's poseHash).
import { Animator, contact, graph as G, playable, type AnimClip, type Clip, type Rest } from "@m3a/core";
import { attach, type Attached, type ThreeBound } from "@m3a/three";
import { poseHash } from "@m3a/three/capture";
import { sim } from "@m3a/tools";
import type { RootPose } from "./stage.ts";

/** A clip or a graph playing on the stage. */
export interface Player {
  readonly kind: "clip" | "graph";
  /** The clip's id, or the script's. */
  readonly id: string;
  /** Seconds from start to end. */
  readonly dur: number;
  readonly loop: boolean;
  /** One frame's seconds. */
  readonly frame: number;
  /** The time now, 0 to dur. */
  readonly time: number;
  /** Goes to time t (clamped to 0 to dur). */
  seek(t: number): void;
  /** Plays on by dt seconds: past the end, a loop goes on and a one-shot or script plays again from the start. */
  advance(dt: number): void;
  /** Moves n frames (back when negative): a loop goes on into the next cycle or the last, the others stop at an end. */
  nudge(n: number): void;
  /** Where the root stands now (mm, degrees). */
  root(): RootPose;
  /** Poses the character at the time now and writes its bones. */
  apply(): void;
  /** What plays now: the clip, or the graph's states. */
  label(): string;
}

/** The proof hash of the bones as posed: the same in Node and in any browser for the same pose. */
export const bonesHash = (bound: ThreeBound): string => poseHash(bound.bones);

const STILL = { root: () => ({ forward: 0, right: 0, yaw: 0 }), speed: 0 };

/** A clip played at a time of its own: posed by an Animator moved by time alone, placed by its root path. */
export class ClipPlayer implements Player {
  readonly kind = "clip";
  readonly id: string;
  readonly dur: number;
  readonly loop: boolean;
  readonly frame: number;
  readonly animator: Animator;
  readonly #att: Attached;
  readonly #path: contact.ContactRoot | typeof STILL;
  /** The time unwrapped: a loop's cycles counted, so its root goes on. */
  #u = 0;

  constructor(bound: ThreeBound, clip: Clip, rest: Rest) {
    const c = playable(clip, rest), own = (c.keys[0] as { root?: unknown }).root !== undefined, feet = (c.contacts.footL?.length ?? 0) + (c.contacts.footR?.length ?? 0) > 0;
    [this.id, this.dur, this.loop, this.frame] = [c.id, c.dur, c.loop, 1 / (c.fps || 30)];
    this.animator = new Animator(bound.core).layer("base", { clip: c, time: 0 });
    this.#att = attach(this.animator, bound);
    this.#path = own || feet ? contact.contactRoot(c, bound.core.rest, c.contacts) : STILL;
  }
  get time(): number {
    return this.loop && this.dur > 0 ? this.#u - Math.floor(this.#u / this.dur) * this.dur : this.#u;
  }
  seek(t: number): void {
    const x = Math.min(Math.max(0, t), this.dur);
    this.#u = this.loop && this.dur > 0 ? Math.floor(this.#u / this.dur) * this.dur + x : x;
  }
  advance(dt: number): void {
    this.#u += dt;
    if (!this.loop && this.#u > this.dur + 1e-9) this.#u = 0;
  }
  nudge(n: number): void {
    this.#u += n * this.frame;
    if (!this.loop) this.#u = Math.min(Math.max(0, this.#u), this.dur);
  }
  root(): RootPose {
    return this.#path.root(this.#u);
  }
  apply(): void {
    this.animator.layer("base", { time: this.time });
    this.#att.apply();
  }
  label(): string {
    return this.id;
  }
}

/** A graph stepped through a script, as graph.sim steps it, on the character. */
export class GraphPlayer implements Player {
  readonly kind = "graph";
  readonly id: string;
  readonly dur: number;
  readonly loop = false;
  readonly frame: number;
  /** The states each layer entered, as the trace lists them (t, layer, state, from). */
  entered: { t: number; layer: string; state: string; from: string | null }[] = [];
  animator!: Animator;
  #att!: Attached;
  #rows: sim.SimInput[] = [];
  #ramps = new Map<string, { from: number; to: number; s0: number; s1: number }>();
  #ground = 0;
  #world: RootPose = { forward: 0, right: 0, yaw: 0 };
  #step = 0;
  #carry = 0;
  readonly #n: number;
  readonly #speeds = new Map<string, number>();

  readonly bound: ThreeBound;
  readonly graph: G.Graph;
  readonly script: sim.SimScript;
  readonly clips: (id: string) => AnimClip | undefined;

  constructor(bound: ThreeBound, graph: G.Graph, script: sim.SimScript, clips: (id: string) => AnimClip | undefined) {
    [this.bound, this.graph, this.script, this.clips] = [bound, graph, script, clips];
    const issues = sim.validateScript(script, graph);
    if (issues.length) throw new Error(`script ${script.id} doesn't check: ${issues.map((i) => `${i.code} ${i.field} ${i.message}`).join("; ")}`);
    [this.id, this.dur, this.frame, this.#n] = [script.id, script.dur, 1 / (script.rate ?? 60), Math.round(script.dur * (script.rate ?? 60))];
    this.#reset();
  }
  #reset(): void {
    this.animator = new Animator(this.bound.core, { step: this.frame }).play(this.graph, this.clips);
    this.#att = attach(this.animator, this.bound);
    this.entered = G.layersOf(this.graph).map((L) => ({ t: 0, layer: L.name, state: L.start, from: null }));
    this.animator.on("enter", (e) => void this.entered.push({ t: Math.round(this.#step * this.frame * 1e6) / 1e6, layer: e.layer, state: String(e.event.state), from: String(e.event.from) }));
    [this.#rows, this.#ground, this.#world, this.#step, this.#carry] = [[...this.script.input], 0, { forward: 0, right: 0, yaw: 0 }, 0, 0];
    this.#ramps.clear();
  }
  get time(): number {
    return this.#step * this.frame;
  }
  /** A clip's own speed on this body (mm/s), as the Animator moves the root by it (stride warping reads it). */
  #speedOf(id: string): number {
    let v = this.#speeds.get(id);
    if (v === undefined) {
      const c = this.clips(id), own = c && (c.keys[0] as { root?: unknown }).root !== undefined, feet = c && (c.contacts?.footL?.length ?? 0) + (c.contacts?.footR?.length ?? 0) > 0;
      this.#speeds.set(id, (v = c && (own || feet) ? contact.contactRoot(c as never, this.bound.core.rest, c.contacts ?? { by: "detected" }).speed : 0));
    }
    return v;
  }
  /** One fixed step: the rows due applied, numbers eased, the warp set, the Animator stepped, the root placed. */
  #tick(): void {
    const a = this.animator, s = this.script, h = this.frame, rate = 1 / h, step = this.#step, unit = s.units === "H0" ? this.bound.core.rest.H0 : 1000;
    const num = (k: string) => (k === "move" ? this.#ground : Number(a.graph!.params[k] ?? 0)), put = (k: string, v: number) => (k === "move" ? (this.#ground = v) : a.set(k, v));
    while (this.#rows.length && this.#rows[0]!.t <= step * h + 1e-9) {
      const r = this.#rows.shift()!, steps = Math.round((r.over ?? 0) * rate);
      const numbers: [string, number][] = [...Object.entries(r.set ?? {}).filter((e): e is [string, number] => typeof e[1] === "number"), ...(r.move !== undefined ? [["move", r.move * unit] as [string, number]] : [])];
      for (const [k, v] of Object.entries(r.set ?? {})) if (typeof v === "boolean") a.set(k, v);
      for (const [k, v] of numbers) {
        this.#ramps.delete(k);
        if (steps > 0) this.#ramps.set(k, { from: num(k), to: v, s0: step, s1: step + steps });
        else put(k, v);
      }
      for (const t of r.trigger === undefined ? [] : Array.isArray(r.trigger) ? r.trigger : [r.trigger]) a.trigger(t);
    }
    for (const [k, q] of [...this.#ramps]) {
      put(k, step >= q.s1 ? q.to : q.from + ((q.to - q.from) * (step - q.s0)) / (q.s1 - q.s0));
      if (step >= q.s1) this.#ramps.delete(k);
    }
    if (s.warp) {
      const layers = a.layers, lowest = layers.findIndex((x) => x.clip && !x.additive);
      let v = 0, rest = 1;
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i]!;
        if (!L.clip || L.additive) continue;
        const share = i === lowest ? rest : rest * L.weight * (L.mask ? (L.mask.root ?? 0) : 1);
        v += share * L.speed * this.#speedOf(L.clip);
        rest -= share;
      }
      const now = Number(a.graph!.params[s.warp] ?? 1);
      a.set(s.warp, v > 1 && this.#ground > 0 ? Math.min(4, Math.max(0.25, (now * this.#ground) / v)) : 1);
    }
    a.step(h);
    this.#world = s.root === "in-place" ? { forward: this.#world.forward + this.#ground * h, right: 0, yaw: 0 } : a.root;
    this.#step++;
  }
  seek(t: number): void {
    const want = Math.round(Math.min(Math.max(0, t), this.dur) / this.frame);
    if (want < this.#step) this.#reset();
    while (this.#step < want) this.#tick();
    this.#carry = 0;
  }
  advance(dt: number): void {
    this.#carry += dt;
    while (this.#carry + this.frame * 1e-9 >= this.frame) {
      this.#carry -= this.frame;
      if (this.#step >= this.#n) this.#reset();
      this.#tick();
    }
  }
  nudge(n: number): void {
    this.seek(this.time + n * this.frame);
  }
  root(): RootPose {
    return { ...this.#world };
  }
  apply(): void {
    this.#att.apply();
  }
  label(): string {
    return (this.animator.graph?.states ?? []).map((s) => (s.layer === "base" ? s.state : `${s.layer}:${s.state}`)).join(" + ");
  }
}
