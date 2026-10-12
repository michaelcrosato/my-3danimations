// The Animator (PLAN.md WP-2.6; §5.5, the runtime contract): plays clips on a bound skeleton. `step(dt)` advances a
// fixed-step clock: each layer's playhead, the events it passes (in order), and the root's motion. Everything it touches
// is plain data: `hash()` hashes it and `save()` returns it. `pose()` mixes the layers at the current time and solves
// them onto the skeleton, with planted feet, the ground and hand targets. It is presentation only: it may be skipped or
// run at lower detail, and it never feeds back into `step`. Every path runs on the portable math (D33). So the same
// script of steps gives the same hashes, and an exact pose gives the same joints bit for bit, in Node and in a browser.
import type { RootPose } from "../clip/sample.ts";
import { plant, plantMix, type Ground, type HandTarget, type Motion, type PlantPart } from "../contact/plant.ts";
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
  /** How much of this layer goes over the layers below, 0 to 1 (1; clamped). The lowest playing layer is always taken
   *  whole, and fires its events whatever its weight. */
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
  /** A one-shot's end the playhead rests on whose events have fired on arriving ("start" or "end"), else null. */
  held: "start" | "end" | null;
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
  /** The bound body's fingerprint (the hash of its measured rest): root motion scales with it. */
  body: string;
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
export type AnimatorErrorCode = "E_STEP" | "E_LAYER" | "E_SAVE" | "E_STEP_SIZE" | "E_BODY_CHANGED" | "E_CLIP_MISSING" | "E_CLIP_CHANGED";

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
/**
 * A clip's content hash: what playing it reads (timing, keys, events, contacts), as its JSON text would give it.
 * Cached by object for `layer()`, which reads clips as immutable (edit a copy and set that); `fresh` hashes again, as
 * `restore()` does, so a clip edited in place is still refused.
 */
export function clipHash(c: AnimClip, fresh = false): string {
  let h = fresh ? undefined : HASHES.get(c);
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
/** x with −0 made +0: JSON writes −0 as 0, so state keeps no −0 and a restored Animator hashes the same. */
const z = (x: number): number => x + 0;
/** The shortest loop that wraps (shorter ones play as still: their playhead stays at 0 and fires nothing). */
const MIN_DUR = 1e-6;
/** A playhead set by `time`: a loop's wrapped into its cycle (the cycles it crossed counted), a one-shot's held in it. */
function place(c: AnimClip, t: number): { time: number; cycles: number } {
  if (!c.loop) return { time: z(Math.min(Math.max(t, 0), c.dur)), cycles: 0 };
  if (!(c.dur >= MIN_DUR)) return { time: 0, cycles: 0 };
  const k = Math.floor(t / c.dur), u = t - k * c.dur;
  return u >= c.dur ? { time: 0, cycles: k + 1 } : { time: z(Math.max(0, u)), cycles: k };
}

/** An event a playhead passed: the event, the clip time it marks, its cycle, and how far into the move (0 to 1). */
interface Passed {
  e: ClipEvent;
  t: number;
  cycle: number;
  f: number;
}
/**
 * Moves a playhead `d` seconds of clip time and lists the events it passes, in order. A window takes the point it
 * leaves and not the point it reaches, so consecutive windows share their boundary exactly and nothing fires twice.
 * A loop goes cycle by cycle on exact boundaries (an event at its end is the moment of its start), so a step that
 * covers several cycles fires each once a cycle; its playhead may rest at `dur`, the moment before the seam, after
 * passing the seam backward. A one-shot stops at its ends: an end's events fire on arriving there, once (`held`
 * remembers it, so turning round at an end doesn't fire it again).
 */
function advance(c: AnimClip, time: number, cycle: number, held: LayerState["held"], d: number): { passed: Passed[]; time: number; cycle: number; held: LayerState["held"] } {
  const dur = c.dur, list = c.events ?? [], passed: Passed[] = [], span = Math.abs(d);
  if (d === 0) return { passed, time, cycle, held };
  if (c.loop) {
    if (!(dur >= MIN_DUR)) return { passed, time: 0, cycle, held: null };
    // an event's moment in the cycle: one at the loop's end (or past it) is the moment of its start
    const fold = (e: ClipEvent) => (e.t >= dur ? e.t - Math.floor(e.t / dur) * dur : e.t);
    let u = time, k = cycle, rem = span, done = 0;
    // a step crosses at most this many cycles' events (a loop far shorter than a step); the rest only count
    for (let piece = 0; rem > 0; piece++) {
      if (piece > 2000) {
        const n = Math.floor(rem / dur);
        k += d > 0 ? n : -n;
        rem -= n * dur;
      }
      if (d > 0) {
        const end = u + rem;
        if (end < dur) {
          if (piece <= 2000) for (const e of list) if (fold(e) >= u && fold(e) < end) passed.push({ e, t: fold(e), cycle: k, f: (done + fold(e) - u) / span });
          u = end;
          break;
        }
        if (piece <= 2000) for (const e of list) if (fold(e) >= u) passed.push({ e, t: fold(e), cycle: k, f: (done + fold(e) - u) / span });
        rem -= dur - u;
        done += dur - u;
        [u, k] = [0, k + 1];
      } else {
        const start = u - rem;
        if (start >= 0) {
          if (piece <= 2000) for (const e of [...list].reverse()) if (fold(e) > start && fold(e) <= u) passed.push({ e, t: fold(e), cycle: k, f: (done + u - fold(e)) / span });
          u = start;
          break;
        }
        if (piece <= 2000) for (const e of [...list].reverse()) if (fold(e) <= u) passed.push({ e, t: fold(e), cycle: k, f: (done + u - fold(e)) / span });
        rem -= u;
        done += u;
        [u, k] = [dur, k - 1];
      }
    }
    passed.sort((a, b) => a.f - b.f);
    return { passed, time: z(u), cycle: k, held: null };
  }
  // a one-shot: forward the window is [time, end), backward (end, time]; arriving at an end takes the end
  if (d > 0) {
    if (time >= dur) return { passed, time: dur, cycle: 0, held };
    const end = time + d, arrive = end >= dur, skip0 = held === "start" && time === 0;
    for (const e of list) if (e.t >= time && (arrive || e.t < end) && !(skip0 && e.t === 0)) passed.push({ e, t: e.t, cycle: 0, f: Math.min(1, (e.t - time) / span) });
    return { passed, time: arrive ? dur : z(end), cycle: 0, held: arrive ? "end" : null };
  }
  if (time <= 0) return { passed, time: 0, cycle: 0, held };
  const start = time + d, arrive = start <= 0, skipEnd = held === "end" && time === dur;
  for (const e of [...list].reverse()) if (e.t <= time && (arrive || e.t > start) && !(skipEnd && e.t >= dur)) passed.push({ e, t: e.t, cycle: 0, f: Math.min(1, (time - e.t) / span) });
  return { passed, time: arrive ? 0 : z(start), cycle: 0, held: arrive ? "start" : null };
}

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
  readonly #body: string;
  readonly #paths = new WeakMap<AnimClip, ContactRoot>();
  readonly #points = new WeakMap<AnimClip, Map<number, Float64Array>>();
  readonly #refs = new WeakMap<AnimClip, KeyLike>();

  /** An Animator for skeleton `bound` (from `bind`), with no layers yet. */
  constructor(bound: Bound, options: AnimatorOptions = {}) {
    const h = options.step ?? 1 / 60;
    if (!finite(h) || h <= 0) throw new AnimatorError("E_STEP", `step must be a positive number of seconds, not ${String(options.step)}: try { step: 1 / 60 }`);
    const max = options.maxSteps ?? Infinity;
    if (!(max >= 1)) throw new AnimatorError("E_STEP", `maxSteps must be at least 1, not ${String(options.maxSteps)}: try { maxSteps: 8 }, or leave it out for no limit`);
    this.bound = bound;
    this.#body = hashValue(bound.rest);
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
    if (c && (typeof c.id !== "string" || c.id === "")) throw bad("its clip has no id; give it one (a format-2 clip's \"SET/Name\")");
    if (c && (!Array.isArray(c.keys) || c.keys.length === 0 || !(c.dur >= 0))) throw new AnimatorError("E_LAYER", `layer "${name}": clip "${c.id}" has no keys or no duration; parse it with parseClip first`, c.id);
    if (mask) for (const [f, w] of Object.entries(mask)) {
      if (!finite(w)) throw bad(`mask weight for "${f}" must be a number from 0 to 1, not ${String(w)}`);
      (mask as Record<string, number>)[f] = z(w);
    }
    let L = this.#layers.find((x) => x.name === name);
    if (!L) {
      L = { name, clip: null, hash: null, src: null, weight: 1, mask: null, additive: false, speed: 1, time: 0, cycle: 0, held: null };
      this.#layers.push(L);
    }
    if (opts.weight !== undefined) L.weight = z(Math.min(1, Math.max(0, opts.weight)));
    if (opts.speed !== undefined) L.speed = z(opts.speed);
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
        L.held = null;
      }
      L.src = c;
    }
    if (opts.time !== undefined) {
      const p = L.src ? place(L.src, opts.time) : { time: z(opts.time), cycles: 0 };
      [L.time, L.cycle, L.held] = [p.time, L.cycle + p.cycles, null];
    }
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
    const h = this.#h, fired: AnimatorEvent[] = [];
    let moved: RootPose = { forward: 0, right: 0, yaw: 0 };
    this.#carry += dt;
    let n = 0;
    // a step is due once the carried time reaches it (to a billionth of a step, so 1/120 twice makes one 1/60 step)
    while (this.#carry + h * 1e-9 >= h) {
      if (n >= this.#max) {
        this.#carry = z(this.#carry - Math.floor(this.#carry / h) * h);
        break;
      }
      this.#carry = z(this.#carry - h);
      // each step's move composed in turn, so a heading crossing ±180 never jumps a whole turn
      moved = compose(moved, this.#tick(fired));
      n++;
    }
    return { steps: n, events: fired, root: moved };
  }

  /** One fixed step: every playhead moves, the events it passes fire, and the root moves as the layers mix it. */
  #tick(fired: AnimatorEvent[]): RootPose {
    const h = this.#h, here: (AnimatorEvent & { f: number; i: number })[] = [];
    let moved: RootPose | null = null;
    const base = this.#layers.findIndex((x) => x.src && !x.additive);
    this.#layers.forEach((L, i) => {
      const c = L.src;
      if (!c) return;
      const d = L.speed * h, t0 = L.time, a = advance(c, L.time, L.cycle, L.held, d);
      // the lowest playing layer is taken whole, so it fires its events whatever its weight
      if (L.weight > 0 || i === base) for (const p of a.passed) here.push({ name: p.e.name, layer: L.name, clip: c.id, t: p.t, cycle: p.cycle, at: (this.#steps + p.f) * h, event: p.e, f: p.f, i });
      if (!L.additive) {
        // the root's move along the clip's path, on the unwrapped timeline from the playhead (a one-shot's held)
        const p = this.#path(c), t1 = c.loop ? t0 + d : Math.min(Math.max(t0 + d, 0), c.dur), dm = between(p.root(t0), p.root(t1));
        if (moved === null) moved = dm;
        else {
          const w = L.weight * (L.mask ? (L.mask.root ?? 0) : 1), wy = L.weight * (L.mask ? (L.mask.yaw ?? 0) : 1);
          const m: RootPose = moved;
          moved = { forward: m.forward + (dm.forward - m.forward) * w, right: m.right + (dm.right - m.right) * w, yaw: m.yaw + (dm.yaw - m.yaw) * wy };
        }
      }
      [L.time, L.cycle, L.held] = [a.time, a.cycle, a.held];
    });
    // in the order the playheads passed them; a tie in the order of the layers
    here.sort((a, b) => a.f - b.f || a.i - b.i);
    for (const { f: _f, i: _i, ...e } of here) fired.push(e);
    const m: RootPose = moved ?? { forward: 0, right: 0, yaw: 0 };
    if (moved) {
      const r = compose(this.#root, m);
      this.#root = { forward: z(r.forward), right: z(r.right), yaw: z(wrap180(r.yaw)) };
    }
    this.#steps++;
    return m;
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
    const full = opts.exact || (opts.lod ?? 0) === 0, shares = full ? this.#shares() : [], P = full ? this.#planter() : null;
    const plantOpts = { ...(this.#ground ? { ground: this.#ground } : {}), ...(opts.hands ? { hands: opts.hands } : {}) };
    if (!P) s = solve(k, b);
    else if (shares.length > 1) {
      // a cross-fade or blend: each layer plants its own clip, and their corrections blend by their shares of the legs
      const at = this.#root, parts: PlantPart[] = shares.map(({ L, w }) => {
        const c = L.src!, path = this.#path(c), now = path.root(L.time);
        return { w, t: L.time, m: { rest: b.rest, dur: c.dur, loop: c.loop, contacts: c.contacts ?? NONE, key: (t) => keyAt(c, t), points: (t) => this.#decoded(c, t), root: (t) => compose(at, between(now, path.root(t))) } };
      });
      s = solve(k, b, { points: plantMix(parts, decodeOn(b, k), k, at, plantOpts) });
    } else {
      // feet planted by the layer that most decides the legs: its clip's contacts and path, anchored where the root
      // stands now; at its playhead the mixed pose stands in for the clip's
      const c = P.src!, tL = P.time, path = this.#path(c), now = path.root(tL), at = this.#root, X = decodeOn(b, k);
      const m: Motion = {
        rest: b.rest, dur: c.dur, loop: c.loop, contacts: c.contacts ?? NONE,
        key: (t) => (t === tL ? k : keyAt(c, t)),
        points: (t) => (t === tL ? X : this.#decoded(c, t)),
        root: (t) => compose(at, between(now, path.root(t))),
      };
      s = solve(k, b, { points: plant(m, tL, plantOpts) });
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
    return { format: FORMAT, step: this.#h, steps: this.#steps, carry: this.#carry, root: { ...this.#root }, body: this.#body, layers: this.#layers.map(stateOf) };
  }

  /**
   * Continues from saved data exactly: the same later hashes and events, none fired twice. Clips come from `clips` by
   * id; each must have the content it had when saved (E_CLIP_MISSING, E_CLIP_CHANGED name the clip).
   */
  restore(data: AnimatorSave, clips: ClipSource): this {
    const d = data as Partial<AnimatorSave> | null, notSave = (why: string) => new AnimatorError("E_SAVE", `not an Animator save (format "${FORMAT}"): ${why}; pass what animator.save() returned, after JSON if need be`);
    if (!d || d.format !== FORMAT || !Array.isArray(d.layers) || !finite(d.steps) || !finite(d.carry) || !d.root || ![d.root.forward, d.root.right, d.root.yaw].every(finite)) throw notSave("its format, steps, carry or root is missing");
    if (d.step !== this.#h) throw new AnimatorError("E_STEP_SIZE", `the save ran at step ${String(d.step)} s but this Animator steps ${this.#h} s: construct it with { step: ${String(d.step)} }`);
    if (d.body !== this.#body) throw new AnimatorError("E_BODY_CHANGED", `the save was made on another body (rest ${String(d.body)}, this one ${this.#body}): root motion scales with the body, so restore into an Animator bound to the same skeleton`);
    const find = typeof clips === "function" ? clips : Array.isArray(clips) ? (id: string) => (clips as readonly AnimClip[]).find((c) => c.id === id) : (id: string) => (Object.hasOwn(clips, id) ? (clips as Readonly<Record<string, AnimClip>>)[id] : undefined);
    const layers: Layer[] = d.layers.map((x, i) => {
      const ok = x && typeof x.name === "string" && (x.clip === null || typeof x.clip === "string") && (x.hash === null || typeof x.hash === "string") && [x.weight, x.speed, x.time, x.cycle].every(finite) && typeof x.additive === "boolean" && (x.held === null || x.held === "start" || x.held === "end") && (x.mask === null || (typeof x.mask === "object" && Object.values(x.mask).every(finite)));
      if (!ok) throw notSave(`layer ${i} is malformed`);
      let src: AnimClip | null = null;
      if (x.clip !== null) {
        src = find(x.clip) ?? null;
        if (!src) throw new AnimatorError("E_CLIP_MISSING", `layer "${x.name}" plays clip "${x.clip}", which restore wasn't given: pass it in clips`, x.clip);
        // hashed afresh: a clip edited in place since it was first played is refused too
        const now = clipHash(src, true);
        if (now !== x.hash) throw new AnimatorError("E_CLIP_CHANGED", `clip "${x.clip}" changed since the save (content hash ${String(x.hash)}, now ${now}): restore with the clip as it was saved, or start the layer again`, x.clip);
      }
      return { name: x.name, clip: x.clip, hash: x.hash, src, weight: z(x.weight), mask: x.mask ? Object.fromEntries(Object.entries(x.mask).map(([k, v]) => [k, z(v)])) : null, additive: x.additive, speed: z(x.speed), time: z(x.time), cycle: z(x.cycle), held: x.held };
    });
    this.#layers = layers;
    this.#steps = d.steps;
    this.#carry = z(d.carry);
    this.#root = { forward: z(d.root.forward), right: z(d.root.right), yaw: z(d.root.yaw) };
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
  /** Each non-additive layer's share of the legs (after the layers above it), those with any, top first. */
  #shares(): { L: Layer; w: number }[] {
    const out: { L: Layer; w: number }[] = [];
    let above = 1;
    for (let i = this.#layers.length - 1; i >= 0; i--) {
      const L = this.#layers[i]!;
      if (!L.src || L.additive) continue;
      const lowest = !this.#layers.slice(0, i).some((x) => x.src && !x.additive);
      const legs = L.mask ? ((L.mask.legL ?? 0) + (L.mask.legR ?? 0)) / 2 : 1, w = (lowest ? 1 : L.weight) * legs;
      if (w * above > 1e-9) out.push({ L, w: w * above });
      above *= 1 - w;
    }
    return out;
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
  return { name: L.name, clip: L.clip, hash: L.hash, weight: L.weight, mask: L.mask ? { ...L.mask } : null, additive: L.additive, speed: L.speed, time: L.time, cycle: L.cycle, held: L.held };
}
