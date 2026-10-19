// The duel's sim, shaped as my-3dge's (its PLAN.md §6.4, ADR-0005, ADR-0009; PLAN.md WP-10.1): a fixed 60 Hz step
// reads one intent, steps each fighter's Animator in id order (its graph, events and root motion: my-3dge's
// `anim.step`), moves each by its root motion (where my-3dge's character controller would take it), then runs the
// rules: a `hit` event lands on a fighter within reach in front, which loses hp and flinches (`hurt`, read next step).
// Places are SI as my-3dge's (metres, radians, +Y up, facing +Z, so right is −X), converted here from the package's
// mm and degrees. Posing is presentation (my-3dge's `anim.pose`): the sim never poses, so its hash is the same whether
// a view poses every step or never. No DOM and no renderer: Node and the page run this file alike.
import { Animator, math, type AnimClip, type Bound, type graph } from "@m3a/core";
import { HZ } from "./clock.ts";

const { PORTABLE, hashValue } = math;
const DEG = Math.PI / 180;

/** One step's input, as my-3dge's intents: the hero's speed parameter (0 stands, 1 walks, 3.5 jogs; its root motion
 *  sets how fast it goes) and an attack press (an edge: one step only). */
export interface Intent {
  speed: number;
  attack?: boolean;
}
/** A fighter: its Animator and where the sim has it (x and z in metres; heading in radians, 0 facing +Z, + turning right). */
export interface Fighter {
  readonly id: string;
  readonly animator: Animator;
  x: number;
  z: number;
  heading: number;
  hp: number;
}
/** A hit the rules landed: the step, who struck, who was struck and the hp left. */
export interface Hit {
  step: number;
  from: string;
  to: string;
  hp: number;
}
/** An event a step passed: the step, the fighter, its name and layer (a state entered names the state). */
export interface DuelEvent {
  step: number;
  fighter: string;
  name: string;
  layer: string;
  state?: string;
}
/** The lab's setup: the generated test characters' seeds (hero, dummy) and how far apart they start (m). */
export const SETUP = { hero: 1, dummy: 2, gap: 6 } as const;
/** The rules: how far a blade reaches (m), how wide in front of the striker (half angle, radians), what it takes off. */
export const RULES = { reach: 1.8, halfAngle: Math.PI / 3, damage: 25 } as const;

/** Two fighters on one graph: the hero at the origin facing +Z, the dummy `gap` metres ahead facing it. */
export class Duel {
  readonly fighters: readonly Fighter[];
  readonly hits: Hit[] = [];
  /** Fixed steps taken. */
  steps = 0;

  constructor(bodies: { hero: Bound; dummy: Bound }, graph: graph.Graph, clips: Readonly<Record<string, AnimClip>>, gap: number) {
    const fighter = (id: string, body: Bound, z: number, heading: number): Fighter => ({ id, animator: new Animator(body, { step: 1 / HZ }).play(graph, clips), x: 0, z, heading, hp: 100 });
    this.fighters = [fighter("dummy", bodies.dummy, gap, Math.PI), fighter("hero", bodies.hero, 0, 0)].sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  /** A fighter by id. */
  get(id: string): Fighter {
    const f = this.fighters.find((x) => x.id === id);
    if (!f) throw new Error(`duel: no fighter "${id}"; the fighters are ${this.fighters.map((x) => x.id).join(", ")}`);
    return f;
  }

  /** One fixed step under the hero's intent: intents, animation, root motion, rules; returns the events it passed. */
  step(intent: Intent): DuelEvent[] {
    const hero = this.get("hero").animator, out: DuelEvent[] = [], strikes: Fighter[] = [];
    hero.set("speed", intent.speed);
    if (intent.attack) hero.trigger("attack");
    for (const f of this.fighters) {
      const r = f.animator.step(1 / HZ), c = PORTABLE.cos(f.heading), s = PORTABLE.sin(f.heading);
      // root motion, in the frame the root had: forward along the heading, right along it turned a quarter right
      f.x += (-r.root.forward * s - r.root.right * c) / 1000;
      f.z += (r.root.forward * c - r.root.right * s) / 1000;
      f.heading += r.root.yaw * DEG;
      for (const e of r.events) {
        out.push({ step: this.steps, fighter: f.id, name: e.name, layer: e.layer, ...(e.name === "enter" ? { state: String(e.event.state) } : {}) });
        if (e.name === "hit") strikes.push(f);
      }
    }
    for (const a of strikes) for (const b of this.fighters) if (b !== a && this.#reaches(a, b)) {
      b.hp = Math.max(0, b.hp - RULES.damage);
      b.animator.trigger("hurt");
      this.hits.push({ step: this.steps, from: a.id, to: b.id, hp: b.hp });
    }
    this.steps++;
    return out;
  }

  /** Whether a's blade reaches b: within reach, and in front of a by at most the half angle. */
  #reaches(a: Fighter, b: Fighter): boolean {
    const dx = b.x - a.x, dz = b.z - a.z, d = PORTABLE.hypot(dx, dz);
    return d <= RULES.reach && (dx * -PORTABLE.sin(a.heading) + dz * PORTABLE.cos(a.heading)) >= d * PORTABLE.cos(RULES.halfAngle);
  }

  /** The hash of everything later steps depend on: each fighter's Animator (graph included), place and hp. */
  hash(): string {
    return hashValue({ steps: this.steps, hits: this.hits.length, fighters: this.fighters.map((f) => ({ id: f.id, a: f.animator.save(), x: f.x, z: f.z, heading: f.heading, hp: f.hp })) });
  }

  /** The duel as plain JSON (what the console's `state()` returns). */
  state(): { steps: number; hits: Hit[]; fighters: { id: string; x: number; z: number; heading: number; hp: number; states: string[]; speed: number }[] } {
    const r = (v: number) => Math.round(v * 1000) / 1000;
    return {
      steps: this.steps, hits: [...this.hits],
      fighters: this.fighters.map((f) => ({ id: f.id, x: r(f.x), z: r(f.z), heading: r(f.heading / DEG), hp: f.hp, states: (f.animator.graph?.states ?? []).map((s) => `${s.layer}:${s.state}`), speed: Number(f.animator.graph?.params.speed ?? 0) })),
    };
  }
}

/** A script of the hero's input in m3a's sim format (spec/SIM.md): rows at `t` set `speed` (eased `over`) or trigger. */
export interface Script {
  dur: number;
  rate?: number;
  input: { t: number; set?: Record<string, number | boolean>; over?: number; trigger?: string | string[] }[];
}
/** The script as one intent per fixed step, its eased speed stepped as m3a's `sim.simulate` steps a row's `over`. */
export function intents(script: Script): Intent[] {
  const rate = script.rate ?? HZ, n = Math.round(script.dur * rate), rows = [...script.input], out: Intent[] = [];
  let speed = 0, ramp: { from: number; to: number; s0: number; s1: number } | null = null;
  for (let step = 0; step < n; step++) {
    let attack = false;
    while (rows.length && rows[0]!.t <= step / rate + 1e-9) {
      const r = rows.shift()!, v = r.set?.speed, steps = Math.round((r.over ?? 0) * rate);
      if (typeof v === "number") [speed, ramp] = steps > 0 ? [speed, { from: speed, to: v, s0: step, s1: step + steps }] : [v, null];
      attack ||= [r.trigger ?? []].flat().includes("attack");
    }
    if (ramp) {
      speed = step >= ramp.s1 ? ramp.to : ramp.from + ((ramp.to - ramp.from) * (step - ramp.s0)) / (ramp.s1 - ramp.s0);
      if (step >= ramp.s1) ramp = null;
    }
    out.push(attack ? { speed, attack } : { speed });
  }
  return out;
}

/** Where a fighter stood after a step: x and z (m), heading (radians), and its hp. */
export interface Place {
  x: number;
  z: number;
  heading: number;
  hp: number;
}
/** What a session played: the hash every `every` steps and at its end, the hits, the events, each fighter's place
 *  after every step (by id), how far the hero went (m), and whether every place (and every pose the view took) stayed
 *  finite. */
export interface Played {
  steps: number;
  hashes: string[];
  hits: Hit[];
  events: DuelEvent[];
  places: Record<string, Place>[];
  travel: number;
  finite: boolean;
}
/** Plays intents on the duel from where it stands; `view` runs after each step (a page's presentation, a test's
 *  posing) and returns false when it met a number that isn't finite. Hashes every `every` steps (60) and at the end. */
export function play(duel: Duel, list: readonly Intent[], opts: { every?: number; view?: (d: Duel) => boolean } = {}): Played {
  const every = opts.every ?? HZ, hero = duel.get("hero"), x0 = hero.x, z0 = hero.z, hits0 = duel.hits.length;
  const out: Played = { steps: list.length, hashes: [], hits: [], events: [], places: [], travel: 0, finite: true };
  list.forEach((intent, i) => {
    out.events.push(...duel.step(intent));
    out.places.push(Object.fromEntries(duel.fighters.map((f) => [f.id, { x: f.x, z: f.z, heading: f.heading, hp: f.hp }])));
    if (opts.view && !opts.view(duel)) out.finite = false;
    if (!duel.fighters.every((f) => Number.isFinite(f.x + f.z + f.heading))) out.finite = false;
    if ((i + 1) % every === 0 || i === list.length - 1) out.hashes.push(duel.hash());
  });
  out.hits = duel.hits.slice(hits0);
  out.travel = PORTABLE.hypot(hero.x - x0, hero.z - z0);
  return out;
}
