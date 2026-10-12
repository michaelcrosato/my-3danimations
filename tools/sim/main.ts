// `npm run sim -- <graph> --input <script>` (PLAN.md WP-6.5, D75; spec/SIM.md; `m3a sim` once WP-7.1 lands): runs a
// script of a game's input on a graph and writes, under check-output/sim/<script>/, the trace (trace.json), where the
// root went, the stride warping's rate and the sensors' read (result.json), and a filmstrip (film.png). With --expect
// it compares the trace with an expected one and fails on the first difference; --write saves the trace as expected.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { graph as G } from "@m3a/core";
import { writePng } from "@m3a/sensors/node";
import { sim } from "@m3a/tools";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { bodyOf, clipSource, readSpec } from "./load.ts";

if (import.meta.main) {
  const specs = [
    { name: "input", takesValue: true, help: "the script: a path, or SIMS/<Name> from spec/sims" },
    { name: "rig", takesValue: true, help: "the body: tiny, gen-<seed> or a cached rig's id (gen-0)" },
    { name: "expect", takesValue: true, help: "an expected trace to compare with (fails on the first difference)" },
    { name: "write", takesValue: true, help: "save the trace here, as an expected trace" },
    { name: "out", takesValue: true, help: "where the results go (check-output/sim/<script>)" },
  ];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    if (parsed.positionals.length !== 1 || typeof parsed.flags.input !== "string") throw new Error("give one graph and --input <script>: npm run sim -- GRAPHS/Locomotion --input SIMS/Walk_Run_Jump");
  } catch (err) {
    usage("sim", err, specs);
  }
  const t0 = performance.now(), steps: Step[] = [], warnings: string[] = [];
  const graph = readSpec<G.Graph>(parsed.positionals[0]!, "graphs"), script = readSpec<sim.SimScript>(parsed.flags.input as string, "sims");
  const issues = sim.validateScript(script, graph);
  steps.push({ name: "script", ok: issues.length === 0, ms: 0, summary: issues.length ? `${issues.length} issue(s)` : `${script.id}: ${script.dur} s, ${script.input.length} input rows, root ${script.root ?? "root"}${script.warp ? `, warped by ${script.warp}` : ""}`, detail: issues.map((i) => `${i.code} ${i.field}: ${i.message} (fix: ${i.fix})`) });
  if (!issues.length) {
    const rig = typeof parsed.flags.rig === "string" ? parsed.flags.rig : "gen-0", t1 = performance.now();
    const run = sim.simulate({ graph, script, body: await bodyOf(rig), clips: clipSource() }), tr = run.trace;
    const went = tr.states.filter((s) => s.from !== null).map((s) => `${s.layer === "base" ? "" : `${s.layer}:`}${s.state}`);
    steps.push({ name: "run", ok: true, ms: performance.now() - t1, summary: `${tr.steps} steps on ${rig}: ${["start", ...went].join(" > ")}; ${tr.events.length} events, ${tr.hits.length} hit window(s)`, detail: tr.hits.map((x) => `hit ${x.t0}-${x.t1} s ${x.layer}:${x.state} ${x.clip}`) });
    const s = run.sensors!, last = run.path.at(-1)!;
    steps.push({ name: "sensors", ok: true, ms: 0, summary: `${s.verdict}: slide ${s.slide} mm, skate ${s.skate} cm/s; the root went ${(last.forward / 1000).toFixed(2)} m${run.rates.length ? `, warped ${Math.min(...run.rates.map((r) => r.rate)).toFixed(2)}-${Math.max(...run.rates.map((r) => r.rate)).toFixed(2)}x` : ""}`, detail: s.findings.map((f) => `${f.level} ${f.metric}${f.where ? `@${f.where}` : ""} ${f.t0.toFixed(2)}-${f.t1.toFixed(2)} s: ${f.message}`) });
    warnings.push(...run.warnings);
    if (typeof parsed.flags.expect === "string") {
      const diff = sim.compareTraces(readSpec<sim.Trace>(parsed.flags.expect, "sims"), tr);
      steps.push({ name: "trace", ok: diff === null, ms: 0, summary: diff === null ? `matches ${parsed.flags.expect}` : `differs from ${parsed.flags.expect}`, detail: diff ? [diff] : [] });
    }
    const out = typeof parsed.flags.out === "string" ? parsed.flags.out : join(ROOT, "check-output/sim", script.id.split("/")[1]!);
    mkdirSync(out, { recursive: true });
    const text = sim.traceText(tr);
    writeFileSync(join(out, "trace.json"), text);
    writeFileSync(join(out, "result.json"), JSON.stringify({ path: run.path, rates: run.rates, sensors: run.sensors, warnings: run.warnings }, null, 1) + "\n");
    if ((script.film ?? 8) > 0) writePng(join(out, "film.png"), sim.filmstrip(run, script.film ?? 8));
    if (typeof parsed.flags.write === "string") writeFileSync(parsed.flags.write, text);
    warnings.push(`results in ${out.startsWith(ROOT) ? out.slice(ROOT.length + 1) : out}: trace.json, result.json${(script.film ?? 8) > 0 ? ", film.png" : ""}`);
  }
  const ok = steps.every((x) => x.ok), ms = performance.now() - t0;
  const report: Report = { tool: "sim", ok, verdict: `sim: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps, warnings, ms, next: ok ? "look at film.png; compare with --expect, or save a trace with --write" : "fix what the failing step names, then rerun" };
  finish(report, parsed);
}
