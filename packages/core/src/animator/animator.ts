// The Animator (PLAN.md WP-2.6; §5.5, the runtime contract): plays clips on a bound skeleton. `step(dt)` advances a
// fixed-step clock: each layer's playhead, the events it passes (in order), and the root's motion. Everything it touches
// is plain data: `hash()` hashes it and `save()` returns it. `pose()` mixes the layers at the current time and solves
// them onto the skeleton, with planted feet, the ground and hand targets. It is presentation only: it may be skipped or
// run at lower detail, and it never feeds back into `step`. Every path runs on the portable math (D33). So the same
// script of steps gives the same hashes, and an exact pose gives the same joints bit for bit, in Node and in a browser.
import { events as eventsIn } from "../clip/events.ts";
import type { RootPose } from "../clip/sample.ts";
import { plant, type Ground, type HandTarget, type Motion } from "../contact/plant.ts";
import { contactRoot, type ContactRoot } from "../contact/root.ts";
import type { V3 } from "../format/math.ts";
import type { KeyLike } from "../format/pose.ts";
import { keyAt } from "../format/sample.ts";
import type { Clip, ClipEvent, Contacts } from "../format/types.ts";
import { hashValue } from "../math/hash.ts";
import { PORTABLE } from "../math/portable.ts";
import { addDelta, blend, delta, mask as maskOf, wrap180, type Mask } from "../ops/pose.ts";
import type { Bound } from "../solve/bind.ts";
import { decodeOn, forward, solve, type Solved } from "../solve/solve.ts";

/** A clip the Animator plays: a format-2 clip, or anything with its id, timing and keys (events and contacts optional). */
export type AnimClip = Pick<Clip, "id" | "dur" | "loop" | "keys"> & Partial<Pick<Clip, "events" | "contacts">>;

/** How an Animator runs: the fixed step (seconds, 1/60), the most steps one `step()` call takes, and the ground. */
export interface AnimatorOptions {
  /** Seconds per fixed step (1/60). A host with its own fixed tick passes that tick and steps once per tick. */
  step?: number;
  /** The most fixed steps one `step(dt)` call runs (no limit); time past it is dropped, so a long stall can't spiral. */
  maxSteps?: number;
  /** The ground's height (mm) under a world point, for planted feet (flat at 0 without one). */
  ground?: Ground;
}

/** One layer's settings: the clip it plays and how it mixes over the layers below it. Fields left out stay as they are. */
export interface LayerOptions {
  /** The clip to play; a new clip starts at `time` (0). `null` empties the layer. */
  clip?: AnimClip | null;
  /** How much of this layer goes over the layers below, 0 to 1 (1). The lowest playing layer is always taken whole. */
  weight?: number;
  /** Which fields it touches: a body group or groups (`"upper"`, `["armL", "head"]`), or weights by field; null: all. */
  mask?: Mask | string | readonly string[] | null;
  /** Add the clip's change from its first key over the layers below (a nod, a flinch) instead of blending toward it. */
  additive?: boolean;
  /** Playback speed (1); negative plays backward. */
  speed?: number;
  /** The clip time to play from now (seconds); a loop wraps it, a one-shot holds its ends. */
  time?: number;
}

/** A layer as plain data: its name, the clip it plays (by id and content hash), its settings and its playhead. */
export interface LayerState {
  name: string;
  clip: string | null;
  hash: string | null;
  weight: number;
  mask: Mask | null;
  additive: boolean;
  speed: number;
  /** The playhead: clip time in seconds (a loop's within its cycle). */
  time: number;
  /** Loop cycles completed since the clip started (back past its start: negative). */
  cycle: number;
}

/** Everything an Animator's later steps depend on, as JSON-safe data: what `save()` returns and `hash()` hashes. */
export interface AnimatorSave {
  format: "m3a-animator/1";
  /** The fixed step it ran at (seconds). */
  step: number;
  /** Fixed steps taken. */
  steps: number;
  /** Seconds carried to the next step. */
  carry: number;
  /** Where the root stands: forward and right in mm, heading in degrees. */
  root: RootPose;
  layers: LayerState[];
}

/** One event a layer's playhead passed: the clip's event, where and when it was passed. */
export interface AnimatorEvent {
  name: string;
  layer: string;
  clip: string;
  /** The clip time it marks (seconds). */
  t: number;
  /** The loop cycle it fired in, counted from the clip's start (0 for a one-shot). */
  cycle: number;
  /** The Animator's time when the playhead passed it (seconds since it started). */
  at: number;
  /** The event as the clip has it, with its own fields. */
  event: ClipEvent;
}

/** What one `step(dt)` did: the fixed steps it ran, the events in the order they were passed, and the root's move. */
export interface StepResult {
  steps: number;
  events: AnimatorEvent[];
  /** The root's move over these steps, in the frame it had before them: forward and right in mm, turn in degrees. */
  root: RootPose;
}

/** How to pose: `exact` for gameplay hit tests (full detail always), `lod` 1 to skip planting, and hand targets. */
export interface PoseOptions {
  /** Full detail whatever `lod` says: the same joints bit for bit in every engine, however presentation was posed. */
  exact?: boolean;
  /** 0 (full: planted feet, ground, hands) or 1 (the key solved alone, lifted onto the floor). */
  lod?: 0 | 1;
  /** World targets the hands reach for (mm), by side. */
  hands?: Partial<Record<"L" | "R", HandTarget>>;
}

/** A posed character: the solve (bones' world and local rotations, the hips), where the root stands, the mixed key and
 *  every bone's head (skeleton space). */
export interface AnimatorPose extends Solved {
  root: RootPose;
  key: KeyLike;
  joints: Record<string, V3>;
}

/** What `restore` reads clips from: a map or a list of clips by id, or a lookup. */
export type ClipSource = Readonly<Record<string, AnimClip>> | readonly AnimClip[] | ((id: string) => AnimClip | undefined);

/** Why the Animator refused: a bad step or layer option, data that isn't a save, or a clip missing or changed. */
export type AnimatorErrorCode = "E_STEP" | "E_LAYER" | "E_SAVE" | "E_STEP_SIZE" | "E_CLIP_MISSING" | "E_CLIP_CHANGED";

/** An Animator's refusal: `code` says why, `clip` names the clip when one is to blame, the message says what to do. */
export class AnimatorError extends Error {
  readonly code: AnimatorErrorCode;
  readonly clip: string | undefined;
  constructor(code: AnimatorErrorCode, message: string, clip?: string) {
    super(message);
    this.name = "AnimatorError";
    this.code = code;
    this.clip = clip;
  }
}

interface Layer extends LayerState {
  src: AnimClip | null;
}

const FORMAT = "m3a-animator/1";
const DEG = Math.PI / 180;
const NONE: Contacts = { by: "detected" };
const STILL: ContactRoot = { root: () => ({ forward: 0, right: 0, yaw: 0 }), speed: 0 };
const HASHES = new WeakMap<AnimClip, string>();
/** A clip's content hash: what playing it reads (timing, keys, events, contacts), as its JSON text would give it. */
export function clipHash(c: AnimClip): string {
  let h = HASHES.get(c);
  if (!h) {
    h = hashValue(JSON.parse(JSON.stringify({ dur: c.dur, loop: c.loop, keys: c.keys, events: c.events ?? [], contacts: c.contacts ?? null })));
    HASHES.set(c, h);
  }
  return h;
}
/** a then b: b's move turned by a's heading, headings added (as the sampler composes root motion). */
function compose(a: RootPose, b: RootPose): RootPose {
  const c = PORTABLE.cos(a.yaw * DEG), s = PORTABLE.sin(a.yaw * DEG);
  return { forward: a.forward + b.forward * c - b.right * s, right: a.right + b.forward * s + b.right * c, yaw: a.yaw + b.yaw };
}
/** The move from a to b, in a's frame. */
function between(a: RootPose, b: RootPose): RootPose {
  const c = PORTABLE.cos(a.yaw * DEG), s = PORTABLE.sin(a.yaw * DEG), f = b.forward - a.forward, r = b.right - a.right;
  return { forward: f * c + r * s, right: -f * s + r * c, yaw: b.yaw - a.yaw };
}
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
/** A playhead kept in the clip: a loop wraps, a one-shot holds its ends. */
const wrapTime = (c: AnimClip, t: number): number => (c.loop && c.dur > 0 ? t - Math.floor(t / c.dur) * c.dur : Math.min(Math.max(t, 0), c.dur));

/**
 * Plays clips on a bound skeleton: layers (clip, weight, mask, additive, speed), a fixed-step `step(dt)` with events and
 * root motion, `hash()`, `save()` and `restore()`, and `pose()` for presentation or, with `{ exact: true }`, gameplay.
 */
export class Animator {
  /** The skeleton it poses. */
  readonly bound: Bound;
  readonly #h: number;
  readonly #max: number;
  readonly #ground: Ground | undefined;
  #layers: Layer[] = [];
  #steps = 0;
  #carry = 0;
  #root: RootPose = { forward: 0, right: 0, yaw: 0 };
  readonly #paths = new WeakMap<AnimClip, ContactRoot>();
  readonly #points = new WeakMap<AnimClip, Map<number, Float64Array>>();
  readonly #refs = new WeakMap<AnimClip, KeyLike>();

  /** An Animator for skeleton `bound` (from `bind`), with no layers yet. */
  constructor(bound: Bound, options: AnimatorOptions = {}) {
    const h = options.step ?? 1 / 60;
    if (!finite(h) || h <= 0) throw new AnimatorError("E_STEP", `step must be a positive number of seconds, not ${String(options.step)}: try { step: 1 / 60 }`);
    const max = options.maxSteps ?? Infinity;
    if (!(max >= 1)) throw new AnimatorError("E_STEP", `maxSteps must be at least 1, not ${String(options.maxSteps)}`);
    this.bound = bound;
    this.#h = h;
    this.#max = max;
    this.#ground = options.ground;
  }

  /** The fixed step (seconds). */
  get stepSize(): number {
    return this.#h;
  }
  /** Seconds played: fixed steps taken times the step. */
  get time(): number {
    return this.#steps * this.#h;
  }
  /** Where the root stands: forward and right in mm, heading in degrees. */
  get root(): RootPose {
    return { ...this.#root };
  }
  /** The layers, bottom first, as plain data. */
  get layers(): LayerState[] {
    return this.#layers.map(stateOf);
  }

  /**
   * Adds layer `name` on top, or changes it: the options given change, the rest stay. A new clip starts at `time`
   * (0); the playhead moves only by `step` or by `time`, and moving it by `time` fires no events.
   */
  layer(name: string, opts: LayerOptions = {}): this {
    // every option checked before anything changes, so a refused call leaves the Animator as it was
    const bad = (what: string) => new AnimatorError("E_LAYER", `layer "${name}": ${what}`);
    if (opts.weight !== undefined && !finite(opts.weight)) throw bad(`weight must be a number from 0 to 1, not ${String(opts.weight)}`);
    if (opts.speed !== undefined && !finite(opts.speed)) throw bad(`speed must be a finite number, not ${String(opts.speed)}`);
    if (opts.time !== undefined && !finite(opts.time)) throw bad(`time must be a finite number of seconds, not ${String(opts.time)}`);
    let mask: Mask | null | undefined;
    if (opts.mask !== undefined) {
      try {
        mask = opts.mask === null ? null : typeof opts.mask === "string" || Array.isArray(opts.mask) ? maskOf(opts.mask as string | readonly string[]) : { ...(opts.mask as Mask) };
      } catch (err) {
        throw bad((err as Error).message);
      }
    }
    const c = opts.clip;
    if (c && (!Array.isArray(c.keys) || c.keys.length === 0 || !(c.dur >= 0))) throw new AnimatorError("E_LAYER", `layer "${name}": clip "${String(c.id)}" has no keys or no duration; parse it with parseClip first`, c.id);
    let L = this.#layers.find((x) => x.name === name);
    if (!L) {
      L = { name, clip: null, hash: null, src: null, weight: 1, mask: null, additive: false, speed: 1, time: 0, cycle: 0 };
      this.#layers.push(L);
    }
    if (opts.weight !== undefined) L.weight = Math.min(1, Math.max(0, opts.weight));
    if (opts.speed !== undefined) L.speed = opts.speed;
    if (opts.additive !== undefined) L.additive = opts.additive === true;
    if (mask !== undefined) L.mask = mask;
    if (c !== undefined) {
      // the same clip (same id and content) carries on; another starts from the beginning
      const same = c === null ? L.src === null : L.src !== null && c.id === L.clip && clipHash(c) === L.hash;
      if (!same) {
        L.clip = c ? c.id : null;
        L.hash = c ? clipHash(c) : null;
        L.time = 0;
        L.cycle = 0;
      }
      L.src = c;
    }
    if (opts.time !== undefined) L.time = opts.time;
    if (L.src) L.time = wrapTime(L.src, L.time);
    return this;
  }

  /** Removes layer `name` (nothing if there is none). */
  remove(name: string): this {
    this.#layers = this.#layers.filter((x) => x.name !== name);
    return this;
  }

  /** Advances by dt seconds: as many fixed steps as fit (the rest carries over), each firing its events in order. */
  step(dt: number): StepResult {
    if (!finite(dt) || dt < 0) throw new AnimatorError("E_STEP", `step(dt) takes the seconds since the last step (0 or more), not ${String(dt)}`);
    const h = this.#h, start = this.#root, fired: AnimatorEvent[] = [];
    this.#carry += dt;
    let n = 0;
    // a step is due once the carried time reaches it (to a billionth of a step, so 1/120 twice makes one 1/60 step)
    while (this.#carry + h * 1e-9 >= h) {
      if (n >= this.#max) {
        this.#carry -= Math.floor(this.#carry / h) * h;
        break;
      }
      this.#carry -= h;
      this.#tick(fired);
      n++;
    }
    return { steps: n, events: fired, root: between(start, this.#root) };
  }

  /** One fixed step: every playhead moves, the events it passes fire, and the root moves as the layers mix it. */
  #tick(fired: AnimatorEvent[]): void {
    const h = this.#h, here: (AnimatorEvent & { f: number; i: number })[] = [];
    let moved: RootPose | null = null;
    this.#layers.forEach((L, i) => {
      const c = L.src;
      if (!c) return;
      const t0 = L.time, t1 = t0 + L.speed * h;
      if (L.weight > 0) {
        // a one-shot's end fires once, as the playhead reaches it
        let to = t1;
        if (!c.loop && L.speed > 0) to = t0 >= c.dur ? t0 : t1 >= c.dur ? Infinity : t1;
        if (!c.loop && L.speed < 0) to = t0 <= 0 ? t0 : t1 <= 0 ? -Infinity : t1;
        for (const e of eventsIn(c, t0, to)) {
          const f = Math.min(1, Math.max(0, (e.t - t0) / (t1 - t0)));
          here.push({ name: e.event.name, layer: L.name, clip: c.id, t: e.t - e.cycle * c.dur, cycle: L.cycle + e.cycle, at: (this.#steps + f) * h, event: e.event, f, i });
        }
      }
      if (!L.additive) {
        const p = this.#path(c), d = between(p.root(c.loop ? t0 : wrapTime(c, t0)), p.root(c.loop ? t1 : wrapTime(c, t1)));
        if (moved === null) moved = d;
        else {
          const w = L.weight * (L.mask ? (L.mask.root ?? 0) : 1), wy = L.weight * (L.mask ? (L.mask.yaw ?? 0) : 1);
          const m: RootPose = moved;
          moved = { forward: m.forward + (d.forward - m.forward) * w, right: m.right + (d.right - m.right) * w, yaw: m.yaw + (d.yaw - m.yaw) * wy };
        }
      }
      if (c.loop && c.dur > 0) {
        const k = Math.floor(t1 / c.dur);
        L.cycle += k;
        L.time = t1 - k * c.dur;
      } else L.time = wrapTime(c, t1);
    });
    // in the order the playheads passed them; a tie in the order of the layers
    here.sort((a, b) => a.f - b.f || a.i - b.i);
    for (const { f: _f, i: _i, ...e } of here) fired.push(e);
    if (moved) {
      const r = compose(this.#root, moved);
      this.#root = { forward: r.forward, right: r.right, yaw: wrap180(r.yaw) };
    }
    this.#steps++;
  }

  /** The layers mixed at their playheads: the lowest playing layer whole, then each blended or added over it. */
  key(): KeyLike | null {
    let acc: KeyLike | null = null;
    for (const L of this.#layers) {
      const c = L.src;
      if (!c) continue;
      const k = keyAt(c, L.time);
      if (L.additive) {
        if (acc && L.weight > 0) acc = addDelta(acc, delta(k, this.#ref(c)), L.weight, L.mask ?? undefined);
      } else acc = acc === null ? k : L.weight > 0 ? blend(acc, k, L.weight, L.mask ?? undefined) : acc;
    }
    return acc;
  }

  /**
   * The pose now, solved onto the skeleton (into `out` when given). Presentation only: skipping it, or running it at
   * `lod` 1, changes nothing `step` does. `{ exact: true }` runs full detail whatever `lod` says. Throws E_LAYER when
   * no layer plays a clip.
   */
  pose(out?: AnimatorPose, opts: PoseOptions = {}): AnimatorPose {
    const b = this.bound, k = this.key();
    if (!k) throw new AnimatorError("E_LAYER", "nothing to pose: no layer plays a clip; add one with animator.layer(name, { clip })");
    let s: Solved;
    const P = opts.exact || (opts.lod ?? 0) === 0 ? this.#planter() : null;
    if (!P) s = solve(k, b);
    else {
      // feet planted by the layer that most decides the legs: its clip's contacts and path, anchored where the root
      // stands now; at its playhead the mixed pose stands in for the clip's
      const c = P.src!, tL = P.time, path = this.#path(c), now = path.root(tL), at = this.#root, X = decodeOn(b, k);
      const m: Motion = {
        rest: b.rest, dur: c.dur, loop: c.loop, contacts: c.contacts ?? NONE,
        key: (t) => (t === tL ? k : keyAt(c, t)),
        points: (t) => (t === tL ? X : this.#decoded(c, t)),
        root: (t) => compose(at, between(now, path.root(t))),
      };
      s = solve(k, b, { points: plant(m, tL, { ...(this.#ground ? { ground: this.#ground } : {}), ...(opts.hands ? { hands: opts.hands } : {}) }) });
    }
    const res: AnimatorPose = { ...s, root: { ...this.#root }, key: k, joints: forward(b, s) };
    return out ? Object.assign(out, res) : res;
  }

  /** The hash of everything later steps depend on (`save()`'s data), 16 hex digits. */
  hash(): string {
    return hashValue(this.save());
  }

  /** Everything later steps depend on, as plain JSON-safe data; each clip named by its id and its content's hash. */
  save(): AnimatorSave {
    return { format: FORMAT, step: this.#h, steps: this.#steps, carry: this.#carry, root: { ...this.#root }, layers: this.#layers.map(stateOf) };
  }

  /**
   * Continues from saved data exactly: the same later hashes and events, none fired twice. Clips come from `clips` by
   * id; each must have the content it had when saved (E_CLIP_MISSING, E_CLIP_CHANGED name the clip).
   */
  restore(data: AnimatorSave, clips: ClipSource): this {
    const d = data as Partial<AnimatorSave> | null;
    if (!d || d.format !== FORMAT || !Array.isArray(d.layers) || !finite(d.steps) || !finite(d.carry) || !d.root) throw new AnimatorError("E_SAVE", `not an Animator save (format "${FORMAT}"): pass what animator.save() returned, after JSON if need be`);
    if (d.step !== this.#h) throw new AnimatorError("E_STEP_SIZE", `the save ran at step ${String(d.step)} s but this Animator steps ${this.#h} s: construct it with { step: ${String(d.step)} }`);
    const find = typeof clips === "function" ? clips : Array.isArray(clips) ? (id: string) => (clips as readonly AnimClip[]).find((c) => c.id === id) : (id: string) => (clips as Readonly<Record<string, AnimClip>>)[id];
    const layers: Layer[] = d.layers.map((x) => {
      let src: AnimClip | null = null;
      if (x.clip !== null) {
        src = find(x.clip) ?? null;
        if (!src) throw new AnimatorError("E_CLIP_MISSING", `layer "${x.name}" plays clip "${x.clip}", which restore wasn't given: pass it in clips`, x.clip);
        const now = clipHash(src);
        if (now !== x.hash) throw new AnimatorError("E_CLIP_CHANGED", `clip "${x.clip}" changed since the save (content hash ${String(x.hash)}, now ${now}): restore with the clip as it was saved, or start the layer again`, x.clip);
      }
      return { name: x.name, clip: x.clip, hash: x.hash, src, weight: x.weight, mask: x.mask ? { ...x.mask } : null, additive: x.additive, speed: x.speed, time: x.time, cycle: x.cycle };
    });
    this.#layers = layers;
    this.#steps = d.steps;
    this.#carry = d.carry;
    this.#root = { forward: d.root.forward, right: d.root.right, yaw: d.root.yaw };
    return this;
  }

  /** The root path a clip implies on this body (its own travel, or its planted feet's), mm and degrees; cached. */
  #path(c: AnimClip): ContactRoot {
    let p = this.#paths.get(c);
    if (!p) {
      const own = (c.keys[0] as { root?: unknown }).root !== undefined, feet = (c.contacts?.footL?.length ?? 0) + (c.contacts?.footR?.length ?? 0) > 0;
      p = own || feet ? contactRoot(c, this.bound.rest, c.contacts ?? NONE) : STILL;
      this.#paths.set(c, p);
    }
    return p;
  }
  /** A clip's body points at time t on this body, as the solver decodes them; cached by time (a pure function). */
  #decoded(c: AnimClip, t: number): Float64Array {
    let m = this.#points.get(c);
    if (!m) this.#points.set(c, (m = new Map()));
    let X = m.get(t);
    if (!X) {
      if (m.size >= 1024) m.clear();
      m.set(t, (X = decodeOn(this.bound, keyAt(c, t))));
    }
    return X;
  }
  /** The key an additive clip's changes are measured from: its first. */
  #ref(c: AnimClip): KeyLike {
    let r = this.#refs.get(c);
    if (!r) this.#refs.set(c, (r = keyAt(c, 0)));
    return r;
  }
  /** The non-additive layer whose clip most decides the legs (its share after the layers above), if it plays one. */
  #planter(): Layer | null {
    let best: Layer | null = null, bw = -1, above = 1;
    for (let i = this.#layers.length - 1; i >= 0; i--) {
      const L = this.#layers[i]!;
      if (!L.src || L.additive) continue;
      const lowest = !this.#layers.slice(0, i).some((x) => x.src && !x.additive);
      const legs = L.mask ? ((L.mask.legL ?? 0) + (L.mask.legR ?? 0)) / 2 : 1, w = (lowest ? 1 : L.weight) * legs;
      if (w * above > bw) [best, bw] = [L, w * above];
      above *= 1 - w;
    }
    return best;
  }
}

/** A layer's plain data. */
function stateOf(L: LayerState): LayerState {
  return { name: L.name, clip: L.clip, hash: L.hash, weight: L.weight, mask: L.mask ? { ...L.mask } : null, additive: L.additive, speed: L.speed, time: L.time, cycle: L.cycle };
}
