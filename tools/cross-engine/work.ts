// The cross-engine workload (PLAN.md WP-2.1): the same computations, run once in V8 (Node) and once in JavaScriptCore
// (Bun), hashed bit for bit, plus each portable function's cost against the engine's own. `main.ts` compares the two
// runs; run alone (`bun tools/cross-engine/work.ts`) it prints its JSON. Core is used through its public API; the
// Animator's script and its data are core's own test helpers.
import * as core from "../../packages/core/src/index.ts";
import { scriptData } from "../../packages/core/test/animator-data.ts";
import { runScript } from "../../packages/core/test/animator-script.ts";

const { math } = core;
const { easesWith, Fnv64, NATIVE, noise2, PORTABLE, quat, RngStreams, smoothDamp, angDiff, vec3 } = math;
type MathLike = core.math.MathLike;
type Quat = core.math.Quat;
type Vec3 = core.math.Vec3;

/** The functions compared and timed, with how many arguments each takes. */
export const FUNCTIONS = ["sin", "cos", "tan", "atan", "atan2", "asin", "acos", "exp", "log", "log2", "log10", "pow", "hypot", "cbrt"] as const;

/** A seeded LCG for inputs, the same in every engine (my-3d2dge's cross-engine-math.cjs uses it too). */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/** The inputs of the origin's check: 200,000 rounds of each function, 2.8 million results. */
export function mathHash(M: MathLike, rounds = 200000): string {
  const h = new Fnv64(), rnd = lcg(7);
  for (let i = 0; i < rounds; i++) {
    const x = (rnd() - 0.5) * 2000, y = (rnd() - 0.5) * 20, u = rnd() * 2 - 1, p = rnd() * 50 + 1e-9;
    h.number(M.sin(x)).number(M.cos(x)).number(M.tan(y)).number(M.atan(y)).number(M.atan2(x, y)).number(M.asin(u)).number(M.acos(u));
    h.number(M.exp(y)).number(M.log(p)).number(M.log2(p)).number(M.log10(p)).number(M.pow(p, y * 0.1)).number(M.hypot(x, y)).number(M.cbrt(x));
  }
  return h.hex();
}

/**
 * A chain of quaternion steps fed back into themselves (each turn's axis and angle come from the last state), as a
 * solver's would be: one bit of difference anywhere grows until the hash differs.
 */
export function chainHash(M: MathLike, steps = 100000): string {
  const h = new Fnv64();
  const q: Quat = [0, 0, 0, 1], t: Quat = [0, 0, 0, 1], sw: Quat = [0, 0, 0, 1], tw: Quat = [0, 0, 0, 1];
  const v: Vec3 = [1, 0, 0], axis: Vec3 = [0, 0, 1];
  for (let i = 0; i < steps; i++) {
    vec3.normalize(axis, vec3.set(axis, M.sin(i * 0.01 + v[0]), M.cos(i * 0.013 + v[1]), M.atan2(v[2], v[0] + 2)));
    quat.fromAxisAngle(t, axis, M.exp(-M.hypot(v[0], v[1], v[2])) * 3 + M.log(1 + (i % 7)), M);
    quat.slerp(q, q, quat.multiply(t, t, q), 0.3, M);
    quat.rotate(v, q, v);
    vec3.scale(v, v, M.cbrt(1 + M.pow(Math.abs(v[2]), 1.5)) / vec3.length(v));
    const twist = quat.swingTwist(q, [0, 1, 0], sw, tw, M);
    h.numbers(q).numbers(v).number(twist);
  }
  return h.hex();
}

/** The helpers, the eases (portable) and the named streams over 20,000 inputs. */
export function helperHash(): string {
  const h = new Fnv64(), E = easesWith(PORTABLE), S = new RngStreams(2026);
  let x = 0, vel = 0;
  for (let i = 0; i < 20000; i++) {
    const u = S.stream("u").next(), a = S.stream("angle", i % 3).range(-10, 10);
    [x, vel] = smoothDamp(x, a, vel, 0.2, 1 / 60);
    h.number(E.outCubic(u)).number(E.inOut(u)).number(E.outBack(u)).number(noise2(a, u * 9)).number(angDiff(a, x)).number(x).number(vel);
  }
  return h.value(S.state()).hex();
}

/** Nanoseconds per call of each function, portable and native, over `n` calls on fixed inputs. */
export function costs(n = 200000): Record<string, { portable: number; native: number }> {
  const rnd = lcg(3), xs = Float64Array.from({ length: 1024 }, () => (rnd() - 0.5) * 40), ps = Float64Array.from({ length: 1024 }, () => rnd() * 50 + 1e-6);
  const out: Record<string, { portable: number; native: number }> = {};
  const time = (f: (i: number) => number) => {
    let sink = 0;
    for (let i = 0; i < 20000; i++) sink += f(i & 1023); // warm up
    const t0 = performance.now();
    for (let i = 0; i < n; i++) sink += f(i & 1023);
    const ns = ((performance.now() - t0) * 1e6) / n;
    return sink === 0.123456789 ? -1 : ns;
  };
  for (const name of FUNCTIONS) {
    const run = (M: MathLike) => {
      const f = M[name] as (...a: number[]) => number;
      if (name === "atan2" || name === "pow" || name === "hypot") return time((i) => f(ps[i]!, xs[i]! * 0.1));
      if (name === "asin" || name === "acos") return time((i) => f(xs[i]! / 20));
      if (name === "log" || name === "log2" || name === "log10") return time((i) => f(ps[i]!));
      return time((i) => f(xs[i]!));
    };
    out[name] = { portable: run(PORTABLE), native: run(NATIVE) };
  }
  return out;
}

/** Everything one engine reports. */
export interface EngineRun {
  engine: string;
  nativeMath: string;
  portableMath: string;
  chainNative: string;
  chainPortable: string;
  helpers: string;
  /** The Animator's scripted run (WP-2.6): every step's state hash, its events and its exact poses, hashed together. */
  animator: string;
  costs: Record<string, { portable: number; native: number }>;
}

/** The engine this runs in, by name and version. */
export function engineName(): string {
  const g = globalThis as { Bun?: { version: string }; process?: { versions: { node: string } } };
  return g.Bun ? `JavaScriptCore (Bun ${g.Bun.version})` : `V8 (Node ${g.process!.versions.node})`;
}

export function run(): EngineRun {
  return { engine: engineName(), nativeMath: mathHash(NATIVE), portableMath: mathHash(PORTABLE), chainNative: chainHash(NATIVE), chainPortable: chainHash(PORTABLE), helpers: helperHash(), animator: animatorHash(), costs: costs() };
}

/** The Animator's 480-step script with presentation poses at alternating detail: its run hashed (core's own test data). */
export function animatorHash(): string {
  return math.hashValue(runScript(core, scriptData(), { poses: "lod" }) as never);
}

if (import.meta.main) process.stdout.write(JSON.stringify(run()) + "\n");
