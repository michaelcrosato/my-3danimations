// B7's grader (PLAN.md §7, WP-6.6): the workspace's graph.json simulated on its character (the m3a simulation, the
// root following the animation) with the grader's own script (bench/starters/B7/script.json: speeds in hip heights a
// second, so any body is asked the same), and graded from the trace and the body: the graph checks with the
// library's clips; the motion asked plays 0.2 s before each change of speed and at the end, and travels as it should
// where the speed holds (idle stands, walk walks, run runs: a graph whose states all play one clip fails); the base
// layer's states, in order without repeats, are the expected ones (a fall when `grounded` goes without a jump allowed);
// the jump comes within 0.1 s of the grounded press and never from one in the air or while not grounded, and leaves
// the ground; the landing within 0.1 s of touching down; no joint goes NaN. (The feet are B1's to grade: a graph's
// transitions between library clips slide on some test characters past the sensors' limit.)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, graph as G, playable, type AnimClip } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { bind } from "@m3a/three";
import { loadGlb } from "@m3a/three/test-characters";
import { sim } from "@m3a/tools";
import type { Check, Grade } from "../B1/grade.ts";

/** The grader's script (its own copy: the workspace's is the agent's to read, not to change). */
export const SCRIPT = JSON.parse(readFileSync(join(import.meta.dirname, "../../starters/B7/script.json"), "utf8")) as sim.SimScript;
/** The states the brief names, and the orders the base layer may go through them in: a graph that falls when
 *  `grounded` goes at 11.5 s without a jump lands again at 12.2 s. */
export const NAMES = ["idle", "walk", "run", "jump", "land"], EXPECTED = ["idle", "walk", "run", "jump", "land", "run", "walk", "idle"];
const ORDERS = [EXPECTED, [...EXPECTED, "land", "idle"]];
/** The motion asked before each change of speed (s), and at the end. */
const BEFORE: [number, string][] = [[1.3, "idle"], [3.3, "walk"], [5.3, "run"], [8.3, "run"], [9.8, "walk"], [13.8, "idle"]];
/** Each motion's travel (hip heights a second) where the speed asked holds: [motion, from s, to s, least, most]. */
const PACES: [string, number, number, number, number][] = [["idle", 0.5, 1.3, 0, 0.3], ["walk", 2.5, 3.3, 0.6, 2], ["run", 4.5, 5.3, 2, Infinity], ["run", 7.5, 8.3, 2, Infinity], ["walk", 9, 9.8, 0.6, 2], ["idle", 13, 13.8, 0, 0.3]];

/** The library's clips by id, each playable on its own rest. */
export function libraryClips(): (id: string) => AnimClip | undefined {
  const library = openLibrary(), cache = new Map<string, AnimClip | undefined>();
  return (id) => {
    if (!cache.has(id)) {
      try {
        const { clip, rest } = library.clip(id);
        cache.set(id, playable(clip, rest));
      } catch {
        cache.set(id, undefined);
      }
    }
    return cache.get(id);
  };
}

/** Grades the graph in `workspace` (its graph.json, on its character.glb). */
export async function gradeB7(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  let graph: G.Graph;
  try {
    graph = JSON.parse(readFileSync(join(workspace, "graph.json"), "utf8")) as G.Graph;
  } catch (err) {
    add("the graph is JSON", false, String((err as Error).message).split("\n")[0]!);
    return done();
  }
  const clips = libraryClips(), issues = G.validateGraph(graph, { clips });
  add("the graph checks", issues.length === 0, issues.length ? issues.slice(0, 3).map((i) => `${i.code} ${i.field ?? ""} ${i.message}`).join("; ") : "no issues, every clip in the library");
  const params = graph.parameters ?? {}, want = { speed: "number", grounded: "bool", jump: "trigger" } as Record<string, string>;
  const missing = Object.entries(want).filter(([k, t]) => params[k]?.type !== t).map(([k, t]) => `${k} (${t})`);
  add("the game's parameters", missing.length === 0, missing.length ? `missing or of another type: ${missing.join(", ")}` : "speed, grounded and jump");
  if (issues.length || missing.length) return done();
  const body = bind((await loadGlb(new Uint8Array(readFileSync(join(workspace, "character.glb"))), { textures: false })).scene).core;
  let run: sim.SimResult;
  try {
    run = sim.simulate({ graph, script: { ...SCRIPT, graph: graph.id }, body, clips });
  } catch (err) {
    add("it runs", false, String((err as Error).message).split("\n")[0]!);
    return done();
  }
  const base = run.trace.states.filter((s) => s.layer === "base"), rate = run.trace.rate;
  const at = (t: number) => base.filter((s) => s.step <= Math.round(t * rate)).at(-1)!.state;
  for (const [t, motion] of BEFORE) add(`plays ${motion} at ${t} s`, at(t) === motion, `the base layer is in ${at(t)}`);
  const seq = base.map((s) => s.state).filter((s) => NAMES.includes(s)).filter((s, i, a) => i === 0 || s !== a[i - 1]);
  add("the states in order", ORDERS.some((o) => JSON.stringify(seq) === JSON.stringify(o)), seq.join(" > "));
  // each motion travels as it should where the speed asked holds: idle stands, walk walks, run runs (a graph whose
  // states all play one clip goes through them all in order)
  const H0 = body.rest.H0, near = (t: number) => run.path.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
  for (const [motion, a, b, lo, hi] of PACES) {
    const v = Math.hypot(near(b).forward - near(a).forward, near(b).right - near(a).right) / (b - a) / H0;
    add(`${motion} travels as ${motion === "idle" ? "standing" : `a ${motion}`} does, ${a} to ${b} s`, v >= lo && v <= hi, `${v.toFixed(2)} hip heights a second (${hi === Infinity ? `over ${lo}` : lo ? `${lo} to ${hi}` : `under ${hi}`})`);
  }
  // the jump leaves the ground: both feet off it (5% of the hip height) at some step while it plays or the graph is in
  // the air, before landing
  const jumped = base.find((s) => s.state === "jump"), landed = base.find((s) => s.state === "land" && jumped && s.step > jumped.step);
  const sole = (f: Float32Array, s: string) => Math.min(...["ankle", "ball", "toe"].map((n) => f[format.IDX[n + s]! * 3 + 2]!));
  let up = 0;
  if (jumped) for (let i = jumped.step; i < (landed?.step ?? run.frames.length) && i < run.frames.length; i++) up = Math.max(up, Math.min(sole(run.frames[i]!, "L"), sole(run.frames[i]!, "R")));
  add("the jump leaves the ground", up > 0.05 * H0, `both feet ${(up / 10).toFixed(1)} cm off the ground at most while jumping (more than ${((0.05 * H0) / 10).toFixed(1)})`);
  const jumps = base.filter((s) => s.state === "jump"), press = Math.round(5.5 * rate);
  add("jumps only when grounded", jumps.length === 1 && jumps[0]!.step >= press && jumps[0]!.step <= press + Math.round(0.1 * rate), jumps.length ? `jump entered at ${jumps.map((j) => `${j.t.toFixed(2)} s`).join(", ")} (pressed at 5.5 s grounded, 6.0 s in the air, 11.7 s not grounded)` : "never jumped");
  const down = Math.round(6.8 * rate), land = base.find((s) => s.state === "land" && s.step >= press);
  add("lands on contact", !!land && land.step >= down && land.step <= down + Math.round(0.1 * rate), land ? `land entered at ${land.t.toFixed(2)} s (grounded at 6.8 s)` : "never landed");
  add("finite", run.frames.every((f) => f.every(Number.isFinite)), "every joint finite every step");
  return done();
}
