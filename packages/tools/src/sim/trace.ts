// A simulation's trace (PLAN.md WP-6.5, D75; spec/SIM.md §2): the states each layer went through, the events, and the
// hit windows, each at the fixed step it happened in. It is what a scripted run is checked against: the same script,
// graph and clips give the same trace on any body when the root follows the animation, so an expected trace is
// written once and compared exactly.

/** A state entered: the step, its time (s), the graph layer, the state, and the one it left (null at the start). */
export interface TraceState {
  step: number;
  t: number;
  layer: string;
  state: string;
  from: string | null;
}
/** An event a clip (or a state's entry) fired: the step, its time, its name, the graph layer and state it came from,
 *  the clip and the clip time it marks. */
export interface TraceEvent {
  step: number;
  t: number;
  name: string;
  layer: string;
  state: string | null;
  clip: string;
  at: number;
}
/** A hit window: open from the step a `hit` event fired to the step it closed (a `hit_end`, its `dur`, or one step). */
export interface TraceHit {
  open: number;
  close: number;
  t0: number;
  t1: number;
  layer: string;
  state: string | null;
  clip: string;
}
/** A run's trace. */
export interface Trace {
  format: string;
  script: string;
  graph: string;
  /** Fixed steps a second, and how many were taken. */
  rate: number;
  steps: number;
  states: TraceState[];
  events: TraceEvent[];
  hits: TraceHit[];
}

/**
 * The first way `actual` differs from `expected` (a field, then the states, events and hits in order), as a line naming
 * it; null when they are the same.
 */
export function compareTraces(expected: Trace, actual: Trace): string | null {
  for (const k of ["script", "graph", "rate", "steps"] as const) if (expected[k] !== actual[k]) return `${k}: expected ${JSON.stringify(expected[k])}, got ${JSON.stringify(actual[k])}`;
  for (const k of ["states", "events", "hits"] as const) {
    const a = expected[k] as unknown[], b = actual[k] as unknown[];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = JSON.stringify(a[i] ?? null), y = JSON.stringify(b[i] ?? null);
      if (x !== y) return `${k}[${i}]: expected ${x}, got ${y}`;
    }
  }
  return null;
}

/** A trace as the file an expected trace is kept in: its fields, then each state, event and hit on a line of its own. */
export function traceText(t: Trace): string {
  const list = (xs: readonly unknown[]) => (xs.length ? `[\n${xs.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n ]` : "[]");
  return `{\n "format": ${JSON.stringify(t.format)},\n "script": ${JSON.stringify(t.script)},\n "graph": ${JSON.stringify(t.graph)},\n "rate": ${t.rate},\n "steps": ${t.steps},\n "states": ${list(t.states)},\n "events": ${list(t.events)},\n "hits": ${list(t.hits)}\n}\n`;
}
