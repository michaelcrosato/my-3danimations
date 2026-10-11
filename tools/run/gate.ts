// `npm run gate -- G<n>`: a gate's fixed command set (PLAN.md §8.5, §9.3), run in order with times. Every command
// runs even after a failure, so the report lists everything that failed. With --json the report lands in
// check-output/gate/report.json; the gate report for docs/PROGRESS.md and the PR is built from it.
import { closest, finish, fmtMs, parseArgs, runStep, usage, type Report, type Step } from "./cli.ts";

/** A gate's commands as [name, npm script, ...args]. A WP that reaches a gate's phase fills its set. */
export const GATES: Record<string, [string, string, ...string[]][]> = {
  G0: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["vectors --check", "vectors", "--check"],
  ],
  G1: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine: legend, catalogs, frozen spec", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["conformance tiers 1a and 2", "test", "conformance/tier1a", "conformance/tier2"],
    ["migrate --check", "migrate", "--check"],
    ["migrated clips validate and decode like their sources", "test", "library/migrated"],
  ],
  G2: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["conformance tiers 1a, 2 and 3", "test", "conformance/tier1a", "conformance/tier2", "conformance/tier3"],
    ["determinism: the Animator's hashes and exact poses, Node = Chromium", "e2e", "animator-parity"],
    ["portable math: V8 = JavaScriptCore (Bun)", "test:cross-engine"],
    ["property tests: mirror twice, blend ends, retime, solver roll", "test", "ops", "solve"],
  ],
};

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), []);
    const g = parsed.positionals[0];
    if (!g) throw new Error(`name a gate: ${Object.keys(GATES).join(", ")}`);
    if (!GATES[g]) throw new Error(`no gate ${g} yet; did you mean ${closest(g, Object.keys(GATES))}? (gates are filled in as their phase arrives)`);
  } catch (err) {
    usage("gate", err, []);
  }
  const gate = parsed.positionals[0]!;
  const steps: Step[] = [];
  const t0 = performance.now();
  for (const [name, script, ...args] of GATES[gate]!) {
    const { output, ...r } = runStep("gate", name.replace(/\W+/g, "-"), "npm", ["run", "--silent", script, ...(args.length ? ["--", ...args] : [])], Boolean(parsed.flags.verbose));
    r.name = name;
    const firstLine = output.split("\n").find((l) => l.trim() !== "");
    if (firstLine) r.summary = firstLine.trim().slice(0, 140);
    steps.push(r);
  }
  const ms = performance.now() - t0;
  const ok = steps.every((s) => s.ok);
  const report: Report = {
    tool: "gate",
    ok,
    verdict: `gate ${gate}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)} (${steps.filter((s) => s.ok).length}/${steps.length} commands)`,
    steps,
    warnings: [],
    ms,
    next: ok ? `write the ${gate} report in docs/PROGRESS.md and on the PR, then merge (PLAN.md §8.5)` : `fix forward; a gate that fails twice is checked against the kill criteria (PLAN.md §12)`,
  };
  finish(report, parsed);
}
