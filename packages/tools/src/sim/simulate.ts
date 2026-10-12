// A graph simulated as a game would drive it (PLAN.md WP-6.5, D75; spec/SIM.md): the script's input applied at its
// times, one fixed step at a time, the Animator stepping the graph; the trace (states, events, hit windows), where the
// root went, the body every step, and the sensors' read of the whole run in the world. The root follows the
// animation's root motion, or stays where the game puts it (in place: the ground speed the script gives), and then
// stride warping sets the warped states' rate each step so playback matches the ground speed and the feet don't slide.
import { Animator, contact, graph as G, type animator as A, type AnimatorEvent, type Bound } from "@m3a/core";
import { checks } from "@m3a/sensors";
import type { SimScript } from "./script.ts";
import { validateScript } from "./script.ts";
import type { Trace, TraceEvent, TraceHit, TraceState } from "./trace.ts";

/** What a simulation takes: the graph, the script, the body (core's `bind`), the clips (each `playable`). */
export interface SimOptions {
  graph: G.Graph;
  script: SimScript;
  body: Bound;
  clips: A.ClipSource;
  /** Pose the body every step, for the sensors and a filmstrip (true). */
  poses?: boolean;
}
/** A finding of the sensors on the run, with its times (s). */
export interface SimFinding {
  metric: string;
  level: "warn" | "fail";
  t0: number;
  t1: number;
  where?: string;
  message: string;
}
/** A run: its trace, where the root went, the stride warping's rate, the body's points and the sensors' read. */
export interface SimResult {
  trace: Trace;
  /** Where the root stood every 0.25 s and at the end, in the world: forward and right mm, heading degrees. */
  path: { t: number; forward: number; right: number; yaw: number }[];
  /** The warped states' rate every 0.25 s (stride warping only). */
  rates: { t: number; rate: number }[];
  /** The body's points (on the root) after each step, and the root in the world (with poses). */
  frames: Float32Array[];
  root: { forward: number; right: number; yaw: number }[];
  /** The sensors on the whole run, read in the world (with poses). */
  sensors: { verdict: "pass" | "warn" | "fail"; slide: number; skate: number; findings: SimFinding[] } | null;
  /** What the run did that a game would want to know: a strike that has no hit event to open a window. */
  warnings: string[];
}

/** The fewest mm/s the playing clips must travel for stride warping to match them to the ground; and its bounds. */
const STILL = 1, RATE_MIN = 0.25, RATE_MAX = 4;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6, r1 = (x: number) => Math.round(x * 10) / 10;

/** A clip by id from a clip source (a map, a list, or a lookup). */
function finder(clips: A.ClipSource): (id: string) => A.AnimClip | undefined {
  if (typeof clips === "function") return clips;
  const m = new Map((Array.isArray(clips) ? clips : Object.values(clips)).map((c) => [c.id, c]));
  return (id) => m.get(id);
}

/** Runs a script on a graph. Throws, naming each issue, when the script doesn't check against the graph. */
export function simulate(opts: SimOptions): SimResult {
  const { graph, script, body } = opts, issues = validateScript(script, graph);
  if (issues.length) throw new Error(`sim: script ${JSON.stringify(script?.id ?? null)} doesn't check: ${issues.slice(0, 4).map((i) => `${i.code} ${i.field} ${i.message} (${i.fix})`).join("; ")}`);
  const rate = script.rate ?? 60, h = 1 / rate, n = Math.round(script.dur * rate), inPlace = script.root === "in-place", find = finder(opts.clips);
  const unit = script.units === "H0" ? body.rest.H0 : 1000, poses = opts.poses !== false;
  const a = new Animator(body, { step: h }).play(graph, opts.clips);
  // each graph layer's entries, so a clip's layer (`@layer/entry/point`) names its state
  const entries = new Map(G.layersOf(graph).map((L) => [L.name, new Map([[1, L.start]])]));
  const stateOf = (layer: string): { layer: string; state: string | null } => {
    const m = /^@([^/]+)\/(\d+)\/\d+$/.exec(layer);
    return m ? { layer: m[1]!, state: entries.get(m[1]!)?.get(Number(m[2])) ?? null } : { layer, state: null };
  };
  const trace: Trace = { format: "2.0", script: script.id, graph: graph.id, rate, steps: n, states: G.layersOf(graph).map((L) => ({ step: 0, t: 0, layer: L.name, state: L.start, from: null })), events: [], hits: [] };
  const open = new Map<string, TraceHit & { until: number }>(), warned = new Set<string>(), warnings: string[] = [];
  let step = 0;
  a.on("*", (e: AnimatorEvent) => {
    if (e.name === "enter") {
      const m = entries.get(e.layer)!;
      m.set(m.size + 1, String(e.event.state));
      trace.states.push({ step, t: r6(step * h), layer: e.layer, state: String(e.event.state), from: String(e.event.from) } satisfies TraceState);
      return;
    }
    const where = stateOf(e.layer);
    trace.events.push({ step, t: r6(step * h), name: e.name, layer: where.layer, state: where.state, clip: e.clip, at: e.t } satisfies TraceEvent);
    // a hit opens a window on its layer: for its own dur (clip seconds), or until the clip's hit_end after it, or for
    // its step; it closes sooner if its state's layer goes
    if (e.name === "hit") {
      // (dur is clip time: played faster, it passes sooner)
      const dur = typeof e.event.dur === "number" && e.event.dur > 0 ? e.event.dur : 0, end = find(e.clip)?.events?.some((x) => x.name === "hit_end" && x.t > e.t);
      const speed = Math.abs(a.layers.find((L) => L.name === e.layer)?.speed ?? 1) || 1;
      open.set(e.layer, { open: step, close: step + 1, t0: 0, t1: 0, ...where, clip: e.clip, until: dur ? step + Math.max(1, Math.round((dur * rate) / speed)) : end ? Infinity : step + 1 });
    } else if (e.name === "hit_end" && open.has(e.layer)) close(e.layer, step);
  });
  const close = (layer: string, at: number) => {
    const w = open.get(layer)!;
    open.delete(layer);
    const { until: _u, ...hit } = w;
    trace.hits.push({ ...hit, close: Math.max(at, w.open + 1), t0: r6(w.open * h), t1: r6(Math.max(at, w.open + 1) * h) });
  };
  // each clip's own speed on this body (mm/s), as the Animator moves the root by it
  const speeds = new Map<string, number>();
  const speedOf = (id: string) => {
    let v = speeds.get(id);
    if (v === undefined) {
      const c = find(id), own = c && (c.keys[0] as { root?: unknown }).root !== undefined, feet = c && (c.contacts?.footL?.length ?? 0) + (c.contacts?.footR?.length ?? 0) > 0;
      v = c && (own || feet) ? contact.contactRoot(c as never, body.rest, c.contacts ?? { by: "detected" }).speed : 0;
      speeds.set(id, v);
    }
    return v;
  };
  const rows = [...script.input], frames: Float32Array[] = [], root: SimResult["root"] = [], path: SimResult["path"] = [], rates: SimResult["rates"] = [];
  let ground = 0, world = { forward: 0, right: 0, yaw: 0 };
  // numbers on their way (a row's `over`): each from where it was, by the step it gets there
  const ramps = new Map<string, { from: number; to: number; s0: number; s1: number }>();
  const num = (k: string) => (k === "move" ? ground : Number(a.graph!.params[k] ?? 0));
  const put = (k: string, v: number) => (k === "move" ? (ground = v) : a.set(k, v));
  for (step = 0; step < n; step++) {
    while (rows.length && rows[0]!.t <= step * h + 1e-9) {
      const r = rows.shift()!, steps = Math.round((r.over ?? 0) * rate);
      const numbers: [string, number][] = [...Object.entries(r.set ?? {}).filter((e): e is [string, number] => typeof e[1] === "number"), ...(r.move !== undefined ? [["move", r.move * unit] as [string, number]] : [])];
      for (const [k, v] of Object.entries(r.set ?? {})) if (typeof v === "boolean") a.set(k, v);
      for (const [k, v] of numbers) {
        ramps.delete(k);
        if (steps > 0) ramps.set(k, { from: num(k), to: v, s0: step, s1: step + steps });
        else put(k, v);
      }
      for (const t of r.trigger === undefined ? [] : Array.isArray(r.trigger) ? r.trigger : [r.trigger]) a.trigger(t);
    }
    for (const [k, q] of [...ramps]) {
      put(k, step >= q.s1 ? q.to : q.from + ((q.to - q.from) * (step - q.s0)) / (q.s1 - q.s0));
      if (step >= q.s1) ramps.delete(k);
    }
    if (script.warp) {
      // the root's speed as the layers mix it now (each clip's own speed at its layer's, by its share of the root),
      // and the warped states' rate scaled so it is the ground's
      // (top first, each its weight of what is left; the lowest playing layer takes the rest)
      const layers = a.layers, lowest = layers.findIndex((x) => x.clip && !x.additive);
      let v = 0, rest = 1;
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i]!;
        if (!L.clip || L.additive) continue;
        const share = i === lowest ? rest : rest * L.weight * (L.mask ? (L.mask.root ?? 0) : 1);
        v += share * L.speed * speedOf(L.clip);
        rest -= share;
      }
      const now = Number(a.graph!.params[script.warp] ?? 1);
      a.set(script.warp, v > STILL && ground > 0 ? Math.min(RATE_MAX, Math.max(RATE_MIN, (now * ground) / v)) : 1);
    }
    a.step(h);
    const playing = new Set(a.layers.map((L) => L.name));
    for (const [layer, w] of [...open]) if (step + 1 >= w.until || !playing.has(layer)) close(layer, Math.min(step + 1, w.until));
    world = inPlace ? { forward: world.forward + ground * h, right: 0, yaw: 0 } : a.root;
    if (poses) {
      frames.push(Float32Array.from(a.pose().points));
      root.push({ ...world });
    }
    if ((step + 1) % Math.max(1, Math.round(rate / 4)) === 0 || step === n - 1) {
      path.push({ t: r6((step + 1) * h), forward: r1(world.forward), right: r1(world.right), yaw: r1(world.yaw) });
      if (script.warp) rates.push({ t: r6((step + 1) * h), rate: r6(Number(a.graph!.params[script.warp] ?? 1)) });
    }
    // an attack clip whose measured strike has no hit event: no window opens
    for (const L of a.layers) {
      const c = L.clip && L.weight > 0 ? find(L.clip) : undefined, strike = (c as { facts?: { strike?: number[] } } | undefined)?.facts?.strike;
      if (c && strike?.length && !c.events?.some((e) => e.name === "hit") && !warned.has(c.id)) {
        warned.add(c.id);
        warnings.push(`${c.id} plays (${stateOf(L.name).state ?? L.name}) with a measured strike at ${strike[0]} s and no hit event, so no hit window opens: add one (a recipe's events step)`);
      }
    }
  }
  for (const layer of [...open.keys()]) close(layer, n);
  trace.hits.sort((x, y) => x.open - y.open || (x.layer < y.layer ? -1 : 1));
  let sensors: SimResult["sensors"] = null;
  if (poses && frames.length > 1) {
    const r = checks.measure(checks.motionOfFrames(frames, body.rest, { rate, root, id: script.id }));
    sensors = { verdict: r.verdict, slide: r1(r.values.slide), skate: r1(r.values.skate), findings: r.findings.slice(0, 12).map((f) => ({ metric: f.metric, level: f.level, t0: r6(f.t0), t1: r6(f.t1), ...(f.where ? { where: f.where } : {}), message: f.message })) };
  }
  return { trace, path, rates, frames, root, sensors, warnings };
}
