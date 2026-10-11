// A scripted run of the Animator (WP-2.6), the same in Node and in a browser: a walk crossfaded into a jog, a masked
// punch over it (played back and forth across its ends), an additive flinch, speed changes and backward play through
// the loops' seams, stepped by irregular dt on a slope. It touches core only through the module it is handed (the
// public API), so the e2e parity test can load it into a page.
import type * as Core from "../src/index.ts";

/** What the script plays: the skeleton and the clips (walk, jog, punch, flinch), with contacts and events. */
export interface ScriptData {
  skeleton: Core.SkeletonIn;
  clips: Core.AnimClip[];
}
/** How to run it: how presentation poses are taken (none, every step, or alternating detail), and from where. */
export interface ScriptOptions {
  poses?: "none" | "every" | "lod";
  /** Run iterations [from, to) (0 and the script's length): a restored Animator picks the script up where it was. */
  from?: number;
  to?: number;
  /** An Animator to carry on with (restored); a new one otherwise. */
  animator?: Core.Animator;
  /** Called after each iteration with its index and the Animator (to save it, say). */
  each?: (i: number, a: Core.Animator) => void;
}
/** The run: the state hash after each iteration, every event fired, and exact-mode joints at fixed iterations. */
export interface ScriptRun {
  hashes: string[];
  events: string[];
  exact: Record<number, string>;
}

/** Iterations in the script. */
export const LENGTH = 480;
/** Iterations whose exact pose is taken. */
export const EXACT = [37, 150, 233, 301, 419];

/** The script's dt at iteration i: irregular, 0 to 1/30 s (a seeded LCG, so every engine gets the same). */
export function dtAt(i: number): number {
  let s = (i * 2654435761 + 12345) >>> 0;
  s = (Math.imul(s, 1103515245) + 12345) >>> 0;
  return i % 17 === 0 ? 0 : (s / 4294967296) * (1 / 30);
}

/** The Animator the script starts from. */
export function start(core: typeof Core, data: ScriptData): Core.Animator {
  return new core.Animator(core.bind(data.skeleton), { step: 1 / 60, ground: (f) => f * 0.03 });
}

/** Runs the script; each iteration's layer changes depend on its index alone, so a restored run continues it. */
export function runScript(core: typeof Core, data: ScriptData, opts: ScriptOptions = {}): ScriptRun {
  const [walk, jog, punch, flinch] = data.clips as [Core.AnimClip, Core.AnimClip, Core.AnimClip, Core.AnimClip];
  const a = opts.animator ?? start(core, data);
  const out: ScriptRun = { hashes: [], events: [], exact: {} };
  for (let i = opts.from ?? 0; i < (opts.to ?? LENGTH); i++) {
    if (i === 0) a.layer("base", { clip: walk });
    if (i >= 90 && i <= 150) a.layer("run", { clip: jog, weight: (i - 90) / 60 });
    if (i === 200) a.layer("upper", { clip: punch, mask: ["upper"], weight: 0.7 });
    if (i === 260) a.layer("flinch", { clip: flinch, additive: true, weight: 0.5, mask: ["upper", "head"] });
    if (i === 320) a.layer("run", { speed: -1 });
    if (i === 350) a.layer("run", { speed: 1.3 });
    if (i === 370) a.layer("upper", { speed: -1.5 });
    if (i === 395) a.layer("upper", { speed: 2 });
    if (i === 400) a.remove("upper");
    if (i === 430) a.layer("base", { time: 0.25 });
    const r = a.step(dtAt(i));
    for (const e of r.events) out.events.push(`${i} ${e.name} ${e.layer} ${e.clip} ${e.t} ${e.cycle} ${e.at}`);
    if (opts.poses === "every") a.pose();
    if (opts.poses === "lod") a.pose(undefined, { lod: (i % 2) as 0 | 1 });
    if (EXACT.includes(i)) {
      const p = a.pose(undefined, { exact: true });
      out.exact[i] = core.math.hashNumbers(a.bound.order.flatMap((b) => p.joints[b.name]!));
    }
    out.hashes.push(a.hash());
    opts.each?.(i, a);
  }
  return out;
}
