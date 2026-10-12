// Scripted runs of the two example graphs (WP-6.4), the same in Node and in a browser: the locomotion graph driven
// from standing through a walk, a jog and a sprint into a jump and its landing, a jab thrown over it from the waist up,
// and back to standing; the sword combo pressed on inside its cancel windows and outside them. Stepped by irregular dt,
// saved and restored halfway. It touches core only through the module it is handed (the public API), so the e2e
// parity test can load it into a page.
import type * as Core from "../src/index.ts";

/** What the scripts play: the skeleton, the clips the graphs name, and the graphs. */
export interface GraphScriptData {
  skeleton: Core.SkeletonIn;
  clips: Core.AnimClip[];
  locomotion: Core.graph.Graph;
  combo: Core.graph.Graph;
}
/** A run: each step's state hash, every event, the states each layer went through, and exact joints at a few steps. */
export interface GraphRun {
  hashes: string[];
  events: string[];
  states: string[];
  exact: Record<number, string>;
}

/** Steps in each script. */
export const LENGTH = 600;
/** Steps whose exact pose is taken. */
export const EXACT = [75, 200, 260, 380, 590];

/** The script's dt at step i: irregular, 0 to 1/30 s (a seeded LCG, so every engine gets the same). */
export function dtAt(i: number): number {
  let s = (i * 2246822519 + 3266489917) >>> 0;
  s = (Math.imul(s, 1103515245) + 12345) >>> 0;
  return i % 23 === 0 ? 0 : (s / 4294967296) * (1 / 30);
}

/** What the locomotion script does at step i. */
function locomotion(a: Core.Animator, i: number): void {
  if (i === 30) a.set("speed", 1);
  if (i === 90) a.set("speed", 3);
  if (i === 160) a.set("speed", 5.5);
  if (i === 220) a.trigger("jump");
  if (i === 232) a.set("grounded", false);
  if (i === 330) a.set("grounded", true);
  if (i === 360 || i === 470) a.trigger("punch");
  if (i === 420) a.set("speed", 0);
  if (i === 520) a.set("speed", 2);
}
/** What the combo script does at step i: presses inside and outside the windows. */
function combo(a: Core.Animator, i: number): void {
  if ([20, 40, 62, 200, 300, 318, 420, 480].includes(i)) a.trigger("attack");
}

/** Runs one graph's script, saving and restoring the Animator (as JSON) at step `restoreAt` when it is given; `onStep`
 *  sees the Animator after each step. */
export function runGraph(core: typeof Core, data: GraphScriptData, which: "locomotion" | "combo", opts: { restoreAt?: number; poses?: "none" | "every"; onStep?: (a: Core.Animator, i: number) => void } = {}): GraphRun {
  const g = which === "locomotion" ? data.locomotion : data.combo, drive = which === "locomotion" ? locomotion : combo;
  let a = new core.Animator(core.bind(data.skeleton), { step: 1 / 60 });
  const out: GraphRun = { hashes: [], events: [], states: [], exact: {} };
  const listen = (x: Core.Animator) => x.on("*", (e) => out.events.push(`${e.name} ${e.layer} ${e.clip} ${e.t} ${e.cycle} ${e.at}${e.name === "enter" ? ` ${String(e.event.from)}>${String(e.event.state)}` : ""}`));
  a.play(g, data.clips);
  listen(a);
  let last = "";
  for (let i = 0; i < LENGTH; i++) {
    if (i === opts.restoreAt) {
      const saved = JSON.parse(JSON.stringify(a.save())) as Core.AnimatorSave;
      a = new core.Animator(core.bind(data.skeleton), { step: 1 / 60 }).restore(saved, data.clips, g);
      listen(a);
    }
    drive(a, i);
    a.step(dtAt(i));
    const now = a.graph!.states.map((s) => `${s.layer}:${s.state}${s.from ? `<${s.from}` : ""}`).join(" ");
    if (now !== last) out.states.push(`${i} ${now}`);
    last = now;
    if (opts.poses === "every") a.pose();
    if (EXACT.includes(i)) {
      const p = a.pose(undefined, { exact: true });
      out.exact[i] = core.math.hashNumbers(a.bound.order.flatMap((b) => p.joints[b.name]!));
    }
    out.hashes.push(a.hash());
    opts.onStep?.(a, i);
  }
  return out;
}
