// `npm run test:cross-engine`: the portable math, a quaternion chain built on it, and the helpers and streams, run in V8
// (Node) and in JavaScriptCore (Bun, Safari's engine) and compared bit for bit (PLAN.md WP-2.1; carried from
// my-3d2dge's tools/cross-engine-math.cjs). Node and Chromium are both V8, so only a second engine can catch a
// difference. The native math runs too, to show what the portable math is for, and each function's cost is reported.
// Exit 1 when a portable result differs between the engines, or when no Bun is found (the check can't be skipped).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { FUNCTIONS, run, type EngineRun } from "./work.ts";

/** Bun: $BUN, then the PATH, then ~/.bun/bin/bun. */
function findBun(): string | null {
  if (process.env.BUN) return process.env.BUN;
  try {
    return execFileSync("sh", ["-c", "command -v bun"], { encoding: "utf8" }).trim() || null;
  } catch {
    const home = join(homedir(), ".bun/bin/bun");
    return existsSync(home) ? home : null;
  }
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), []);
  } catch (err) {
    usage("cross-engine", err, []);
  }
  const t0 = performance.now();
  const steps: Step[] = [];
  const bun = findBun();
  if (!bun) {
    const ms = performance.now() - t0;
    const report: Report = { tool: "cross-engine", ok: false, verdict: "cross-engine: FAIL, no Bun found: JavaScriptCore not checked", steps, warnings: [], ms, next: "install Bun (npm i -g bun) or set BUN=/path/to/bun, then rerun" };
    finish(report, parsed);
  }
  const ta = performance.now();
  const v8 = run();
  const v8ms = performance.now() - ta;
  const tb = performance.now();
  const jsc = JSON.parse(execFileSync(bun, [join(ROOT, "tools/cross-engine/work.ts")], { encoding: "utf8", maxBuffer: 1 << 20 })) as EngineRun;
  const jscms = performance.now() - tb;
  const compare = (key: keyof EngineRun, what: string, must: boolean) => {
    const same = v8[key] === jsc[key];
    steps.push({ name: what, ok: same || !must, ms: 0, summary: `${same ? "same" : must ? "DIFFERENT" : "different, as expected"}: ${v8[key]} in V8, ${jsc[key]} in JavaScriptCore` });
  };
  compare("portableMath", "portable math, 2.8 million results", true);
  compare("chainPortable", "a 100,000-step quaternion chain on the portable math", true);
  compare("helpers", "eases, noise, springs and named streams, 140,000 results", true);
  compare("animator", "the Animator's 480-step script: state hashes, events, exact poses", true);
  compare("nativeMath", "native math, the same 2.8 million results", false);
  compare("chainNative", "the same chain on native math", false);
  const line = (r: EngineRun, f: string) => `${r.costs[f]!.portable.toFixed(1)} ns vs ${r.costs[f]!.native.toFixed(1)} (${(r.costs[f]!.portable / r.costs[f]!.native).toFixed(1)}×)`;
  const worst = (r: EngineRun) => Math.max(...FUNCTIONS.map((f) => r.costs[f]!.portable / r.costs[f]!.native));
  steps.push({ name: "cost per call, portable vs native", ok: true, ms: v8ms + jscms, summary: `at most ${worst(v8).toFixed(1)}× native in V8, ${worst(jsc).toFixed(1)}× in JavaScriptCore`, detail: FUNCTIONS.map((f) => `${f}: V8 ${line(v8, f)}; JavaScriptCore ${line(jsc, f)}`) });
  const ok = steps.every((s) => s.ok);
  const ms = performance.now() - t0;
  const report: Report = {
    tool: "cross-engine",
    ok,
    verdict: `cross-engine: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}: ${v8.engine} and ${jsc.engine} ${ok ? "give the same portable bits" : "differ on the portable math"}`,
    steps,
    warnings: [],
    ms,
    next: ok ? "npm test" : "find the first function whose bits differ (packages/core/test/math.test.ts) and fix packages/core/src/math/portable.ts",
  };
  finish(report, parsed);
}
