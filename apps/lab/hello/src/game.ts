// The first-flight game (PLAN.md WP-4.6), with no DOM and no renderer: a character that idles, walks and runs by speed,
// jumps and attacks, driven by a stick and two buttons through core's Animator. The page (main.ts) draws it with three;
// Node runs the same script for the e2e test, so the page's hashes can be checked against Node's.
// Moves cross-fade on a second layer. Locomotion picks idle, walk or run by speed and plays it at the rate that speed
// asks. The character travels by the clip's root motion, which its planted feet imply. The attack's `hit` event is put
// at the strike time core measures, as a game would add it. Each clip is repaired at load by the sensors' fix, as a game
// would until WP-5.8 writes the repairs back into the library.
import { Animator, contact, math, measureFacts, playable, type AnimatorEvent, type Bound, type Clip, type Rest } from "@m3a/core";
import { fix } from "@m3a/sensors";

const { PORTABLE, hashValue } = math;

/** The moves the game plays. */
export const MOVES = ["idle", "walk", "run", "jumpStart", "jumpAir", "jumpLand", "attack"] as const;
/** A move's name. */
export type MoveName = (typeof MOVES)[number];
/**
 * The default clip for each move, all CC0: those that pass the sensors on their own body, or pass once `fix` has
 * repaired them (Walk_Loop's and Punch_Cross's twist flips; Mesh2Motion's jump through the floor). No run in the library
 * passes yet: the jog's twist flips are repaired and its seam's change of speed stays (WP-5.8 takes it up).
 */
export const DEFAULT_CLIPS: Readonly<Record<MoveName, string>> = {
  idle: "QUATERNIUS_3D2DGE/Idle_Loop",
  walk: "QUATERNIUS_3D2DGE/Walk_Loop",
  run: "QUATERNIUS_3D2DGE/Jog_Fwd_Loop",
  jumpStart: "MESH2MOTION/Jump_Start",
  jumpAir: "MESH2MOTION/Jump_air",
  jumpLand: "MESH2MOTION/Jump_Land",
  attack: "QUATERNIUS_3D2DGE/Punch_Jab",
};

/** A move ready to play: its clip with the contacts measured on its own body (and for an attack, a `hit` event at its
 *  strike), and how fast it travels on the character (mm/s; 0 in place). */
export interface Move {
  clip: Clip;
  speed: number;
}
/**
 * Prepares a clip for the game: repaired where the sensors' lint finds something `fix` can repair (each step kept only
 * if it makes the clip better), contacts and the strike measured on its own rest R, and how fast it travels on the
 * character's body (`body`: the root its planted feet imply there, as the Animator plays it).
 */
export function prepare(source: Clip, R: Rest, body: Rest, hit = false): Move {
  const clip = fix(source, R).clip, f = measureFacts(clip, R), events = [...(clip.events ?? [])];
  if (hit && f.strike?.length && !events.some((e) => e.name === "hit")) events.push({ t: f.strike[0]!, name: "hit" });
  const ready = { ...playable(clip, R), events: events.sort((a, b) => a.t - b.t) };
  return { clip: ready, speed: clip.loop ? contact.contactRoot(ready, body, ready.contacts).speed : 0 };
}

/** A key's hand fields (format 2): the wrists and the fingers. */
const HANDS = ["handL", "handR", "fingersL", "fingersR"] as const;
/**
 * The moves with their hands played only if every move has them: a set that mixes clips with hands and clips without
 * (the migrated Quaternius sets have none; Mesh2Motion's re-imported jumps close the fist) would clench and open the
 * hands within every cross-fade, fast enough to read as a pop. Without them all, the hands keep the rest's.
 */
export function handsAlike(moves: Record<MoveName, Move>): Record<MoveName, Move> {
  const has = MOVES.map((m) => moves[m].clip.keys.some((k) => HANDS.some((h) => (k as unknown as Record<string, unknown>)[h] !== undefined)));
  if (has.every((x) => x) || !has.some((x) => x)) return moves;
  const bare = (move: Move): Move => ({ ...move, clip: { ...move.clip, keys: move.clip.keys.map((k) => Object.fromEntries(Object.entries(k).filter(([f]) => !(HANDS as readonly string[]).includes(f))) as typeof k) } });
  return Object.fromEntries(MOVES.map((m) => [m, bare(moves[m])])) as Record<MoveName, Move>;
}

/** The stick and the buttons: x to the right and y forward, each −1 to 1; run held; jump and attack pressed. */
export interface Input {
  x: number;
  y: number;
  run?: boolean;
  jump?: boolean;
  attack?: boolean;
}
/** Where the game stands: as plain JSON (what `window.__m3a.state()` returns). */
export interface GameState {
  mode: MoveName;
  /** Ground speed, m/s. */
  speed: number;
  /** Facing, degrees (0: +y, clockwise). */
  heading: number;
  /** Where the character stands, m (x right, y forward). */
  position: [number, number];
  time: number;
  hits: number;
  layers: Pick<Animator["layers"][number], "name" | "clip" | "weight" | "time" | "speed">[];
}

const STEP = 1 / 60, FADE = 0.25, QUICK = 0.12, AIR = 0.3, TURN = 540, ACCEL = 3000, DECEL = 5000, DEG = Math.PI / 180, G = 9810;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** The game: its Animator on a bound skeleton, the moves, and the state a stick drives. */
export class Hello {
  readonly animator: Animator;
  readonly moves: Readonly<Record<MoveName, Move>>;
  mode: MoveName = "idle";
  /** mm/s, degrees, mm. */
  speed = 0;
  heading = 0;
  x = 0;
  y = 0;
  /** Height off the floor (mm): a jump's arc, which the in-place jump clips leave to the game. */
  z = 0;
  hits = 0;
  #flight: number | null = null;
  #fade: { to: MoveName; t: number; dur: number } | null = null;
  #air = 0;
  #held: Input = { x: 0, y: 0 };
  #forced: MoveName | null = null;
  #viewing: string | null = null;

  constructor(bound: Bound, moves: Record<MoveName, Move>) {
    this.animator = new Animator(bound, { step: STEP });
    this.moves = handsAlike(moves);
    this.animator.layer("base", { clip: this.moves.idle.clip });
  }

  /** Plays a move from now (a console's `play`): locomotion moves stay until the stick moves; the others run once. */
  play(name: MoveName): void {
    this.#forced = name === "idle" || name === "walk" || name === "run" ? name : null;
    this.#start(name, QUICK);
  }

  /** Plays one clip alone from clip time t, looping or held at its end, the input ignored (a deep link's `?clip=`). */
  view(move: Move, t = 0): void {
    this.#viewing = move.clip.id;
    this.#fade = null;
    this.animator.remove("fade").layer("base", { clip: move.clip, time: t, speed: 1, weight: 1 });
  }

  /** Advances by dt seconds under the input; returns the events passed (the attack's `hit` among them). */
  step(dt: number, input: Input): AnimatorEvent[] {
    if (this.#viewing) return this.animator.step(dt).events;
    const press = (k: "jump" | "attack") => input[k] === true && this.#held[k] !== true;
    const busy = this.mode === "jumpStart" || this.mode === "jumpAir" || this.mode === "jumpLand" || this.mode === "attack";
    if (!busy && press("jump")) this.#start("jumpStart", QUICK);
    else if (!busy && press("attack")) this.#start("attack", QUICK);
    this.#held = { ...input };
    const mag = Math.min(1, PORTABLE.hypot(input.x, input.y));
    if (mag > 0.15) this.#forced = null;
    // the speed asked: walking at full stick, running with run held; it eases toward it
    const walk = this.moves.walk.speed, run = this.moves.run.speed, busyNow = this.#busy();
    const want = busyNow || mag <= 0.15 ? 0 : input.run ? run : walk * mag;
    this.speed = want > this.speed ? Math.min(want, this.speed + ACCEL * dt) : Math.max(want, this.speed - DECEL * dt);
    if (mag > 0.15 && !busyNow) {
      const aim = PORTABLE.atan2(input.x, input.y) / DEG, d = ((((aim - this.heading) % 360) + 540) % 360) - 180;
      this.heading += clamp(d, -TURN * dt, TURN * dt);
    }
    if (!busyNow) {
      const loco: MoveName = this.#forced ?? (this.speed < 0.25 * walk ? "idle" : this.speed < (walk + run) / 2 ? "walk" : "run");
      if (loco !== this.#target()) this.#start(loco, FADE);
    }
    this.#rates();
    const r = this.animator.step(dt);
    // travel: the root's whole move (forward, right and turn, in the frame it had), along the character's facing, so a
    // foot the Animator holds still stays still where the game puts the character
    const { forward: f, right: rt, yaw } = r.root, h = this.heading * DEG, c = PORTABLE.cos(h), sn = PORTABLE.sin(h);
    this.x += f * sn + rt * c;
    this.y += f * c - rt * sn;
    this.heading += yaw;
    this.#advance(dt);
    // the flight: from the take-off (the jump's start ending) through the hang and the fade into the landing, a
    // ballistic arc; the feet touch down as the landing clip takes over whole, so they don't skid on the ground from the
    // hang's pose to the landing's
    if (this.#flight !== null) {
      const T = QUICK + AIR + QUICK, u = (this.#flight = Math.min(T, this.#flight + dt));
      this.z = (G * T * u) / 2 - (G * u * u) / 2;
      if (u >= T) [this.z, this.#flight] = [0, null];
    }
    const hits = r.events.filter((e) => e.name === "hit");
    this.hits += hits.length;
    return r.events;
  }

  /**
   * A pose's body points (on the Animator's root, mm) placed where the game has the character: turned to its facing and
   * lifted by its jump, with the root at its place (forward, right), as the sensors read a motion in the world.
   */
  placed(points: ArrayLike<number>): { points: number[]; root: { forward: number; right: number; yaw: number } } {
    const c = PORTABLE.cos(this.heading * DEG), sn = PORTABLE.sin(this.heading * DEG), out: number[] = [];
    for (let i = 0; i < points.length; i += 3) out.push(points[i]! * c - points[i + 1]! * sn, points[i]! * sn + points[i + 1]! * c, points[i + 2]! + this.z);
    return { points: out, root: { forward: this.y, right: this.x, yaw: 0 } };
  }

  /** The clip a deep link plays alone, if one does. */
  get viewing(): string | null {
    return this.#viewing;
  }

  /** The game's state as JSON. */
  state(): GameState {
    const r = (x: number, k = 1000) => Math.round(x * k) / k;
    return {
      mode: this.mode, speed: r(this.speed / 1000), heading: r(this.heading, 10), position: [r(this.x / 1000), r(this.y / 1000)], time: r(this.animator.time), hits: this.hits,
      layers: this.animator.layers.map((l) => ({ name: l.name, clip: l.clip, weight: r(l.weight), time: r(l.time), speed: r(l.speed) })),
    };
  }

  /** The hash of everything later steps depend on: the Animator's state and the game's. */
  hash(): string {
    return hashValue({ a: this.animator.save(), mode: this.mode, speed: this.speed, heading: this.heading, x: this.x, y: this.y, z: this.z, hits: this.hits, fade: this.#fade, air: this.#air, flight: this.#flight });
  }

  /** The move playing or fading in. */
  #target(): MoveName {
    return this.#fade?.to ?? this.mode;
  }
  #busy(): boolean {
    const m = this.#target();
    return m === "jumpStart" || m === "jumpAir" || m === "jumpLand" || m === "attack";
  }
  /** Starts a move, faded in over `dur` on the top layer; a locomotion loop starts at the phase the last one was at. */
  #start(name: MoveName, dur: number): void {
    const a = this.animator;
    if (this.#fade) this.#settle();
    const base = a.layers.find((l) => l.name === "base")!, from = this.moves[this.mode].clip, clip = this.moves[name].clip;
    const loops = from.loop && clip.loop && name !== "idle" && this.mode !== "idle";
    a.layer("fade", { clip, weight: 0, time: loops && from.dur > 0 ? (base.time / from.dur) * clip.dur : 0 });
    this.#fade = { to: name, t: 0, dur };
    this.#air = 0;
  }
  /** The fade done: its move becomes the base, at its playhead. */
  #settle(): void {
    const a = this.animator, f = this.#fade!, top = a.layers.find((l) => l.name === "fade");
    a.layer("base", { clip: this.moves[f.to].clip, time: top?.time ?? 0, speed: top?.speed ?? 1 });
    a.remove("fade");
    this.mode = f.to;
    this.#fade = null;
  }
  /** Playback rates: walk and run at the rate the speed asks (0.6 to 1.5 of their own), the rest at 1. */
  #rates(): void {
    for (const l of this.animator.layers) {
      const m = l.name === "fade" ? this.#fade!.to : this.mode, own = this.moves[m].speed;
      const rate = (m === "walk" || m === "run") && own > 0 ? clamp(this.speed / own, 0.6, 1.5) : 1;
      this.animator.layer(l.name, { speed: rate });
    }
  }
  /** The fade's weight, and the one-shot moves' ends: a jump starts, hangs, lands; an attack ends back on its feet. */
  #advance(dt: number): void {
    const a = this.animator;
    if (this.#fade) {
      this.#fade.t += dt;
      a.layer("fade", { weight: smooth(this.#fade.t / this.#fade.dur) });
      if (this.#fade.t >= this.#fade.dur) this.#settle();
      return;
    }
    const base = a.layers.find((l) => l.name === "base")!;
    if (this.mode === "jumpAir") {
      this.#air += dt;
      if (this.#air >= AIR) this.#start("jumpLand", QUICK);
    } else if ((this.mode === "jumpStart" || this.mode === "jumpLand" || this.mode === "attack") && base.held === "end") {
      if (this.mode === "jumpStart") this.#flight = 0;
      this.#start(this.mode === "jumpStart" ? "jumpAir" : "idle", this.mode === "jumpStart" ? QUICK : FADE);
    }
  }
}
