// What the stage plays (PLAN.md WP-8.1): a clip, or a graph driven by a simulation script, on a bound character, with
// one time model for both: a time from 0 to the clip's or the script's length that playing advances (at any rate),
// stepping moves one frame at a time (a clip's 1/fps, a script's step) and scrubbing sets. A clip is posed at its time
// by core's Animator (its feet planted) and placed where its root path puts it (its own travel, or its planted feet's,
// cycle after cycle for a loop); a frame step lands on a whole frame. A graph is stepped by graph.sim's own stepper
// (@m3a/tools sim.SimStepper: the script's rows applied at their times, numbers eased, stride warping), from the start
// again when it goes back. Every path is deterministic: the same clip or script at the same time poses the same bones
// (`hash`, @m3a/three's poseHash).
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
  /** The cycles a loop has played (its root goes on by them), and the time in this one: kept apart, so the time a seek
   *  gives is the time posed, bit for bit, in any cycle. */
  #cycle = 0;
  #x = 0;

  constructor(bound: ThreeBound, clip: Clip, rest: Rest) {
    const c = playable(clip, rest), own = (c.keys[0] as { root?: unknown }).root !== undefined, feet = (c.contacts.footL?.length ?? 0) + (c.contacts.footR?.length ?? 0) > 0;
    [this.id, this.dur, this.loop, this.frame] = [c.id, c.dur, c.loop, 1 / (c.fps || 30)];
    this.animator = new Animator(bound.core).layer("base", { clip: c, time: 0 });
    this.#att = attach(this.animator, bound);
    this.#path = own || feet ? contact.contactRoot(c, bound.core.rest, c.contacts) : STILL;
  }
  get time(): number {
    return this.#x;
  }
  /** A loop's time put back into its cycle (counting the cycles crossed); a one-shot's held to 0 to dur. */
  #wrap(): void {
    if (!this.loop || this.dur <= 0) {
      this.#x = Math.min(Math.max(0, this.#x), this.dur);
      return;
    }
    while (this.#x >= this.dur || this.#x < 0) {
      const back = this.#x < 0;
      this.#x += back ? this.dur : -this.dur;
      this.#cycle += back ? -1 : 1;
    }
  }
  seek(t: number): void {
    this.#x = Math.min(Math.max(0, t), this.dur);
    this.#wrap();
  }
  advance(dt: number): void {
    this.#x += dt;
    if (!this.loop && this.#x > this.dur + 1e-9) this.#x = 0;
    this.#wrap();
  }
  nudge(n: number): void {
    // to the frame n from the nearest whole frame, so steps land on frames however many are taken
    this.#x = (Math.round(this.#x / this.frame) + n) * this.frame;
    this.#wrap();
  }
  root(): RootPose {
    return this.#path.root(this.#cycle * this.dur + this.#x);
  }
  apply(): void {
    this.animator.layer("base", { time: this.#x });
    this.#att.apply();
  }
  label(): string {
    return this.id;
  }
}

/** A graph stepped through a script on the character by graph.sim's own stepper (@m3a/tools sim.SimStepper). */
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
  #sim!: sim.SimStepper;
  /** Wall seconds played but not yet a whole step. */
  #carry = 0;

  readonly bound: ThreeBound;
  readonly graph: G.Graph;
  readonly script: sim.SimScript;
  readonly clips: (id: string) => AnimClip | undefined;

  constructor(bound: ThreeBound, graph: G.Graph, script: sim.SimScript, clips: (id: string) => AnimClip | undefined) {
    [this.bound, this.graph, this.script, this.clips] = [bound, graph, script, clips];
    const issues = sim.validateScript(script, graph);
    if (issues.length) throw new Error(`script ${script.id} doesn't check: ${issues.map((i) => `${i.code} ${i.field} ${i.message}`).join("; ")}`);
    this.#reset();
    [this.id, this.dur, this.frame] = [script.id, script.dur, this.#sim.h];
  }
  /** Back to the start: a new stepper (and its Animator) on the bound character. */
  #reset(): void {
    const st = (this.#sim = new sim.SimStepper({ graph: this.graph, script: this.script, body: this.bound.core, clips: this.clips }));
    this.animator = st.animator;
    this.#att = attach(this.animator, this.bound);
    this.entered = G.layersOf(this.graph).map((L) => ({ t: 0, layer: L.name, state: L.start, from: null }));
    this.animator.on("enter", (e) => void this.entered.push({ t: Math.round(st.step * st.h * 1e6) / 1e6, layer: e.layer, state: String(e.event.state), from: String(e.event.from) }));
  }
  get time(): number {
    return this.#sim.step * this.#sim.h;
  }
  seek(t: number): void {
    const want = Math.round(Math.min(Math.max(0, t), this.dur) / this.frame);
    if (want < this.#sim.step) this.#reset();
    while (this.#sim.step < want) this.#sim.tick();
    this.#carry = 0;
  }
  advance(dt: number): void {
    this.#carry += dt;
    while (this.#carry + this.frame * 1e-9 >= this.frame) {
      this.#carry -= this.frame;
      if (this.#sim.step >= this.#sim.steps) this.#reset();
      this.#sim.tick();
    }
  }
  nudge(n: number): void {
    this.seek(this.time + n * this.frame);
  }
  root(): RootPose {
    return { ...this.#sim.world };
  }
  apply(): void {
    this.#att.apply();
  }
  label(): string {
    return (this.animator.graph?.states ?? []).map((s) => (s.layer === "base" ? s.state : `${s.layer}:${s.state}`)).join(" + ");
  }
}
