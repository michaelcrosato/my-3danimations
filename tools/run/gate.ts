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
  G3: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["the sensors over every migrated clip within T2, as the committed baseline says", "qa", "--check"],
    ["planted defects: the fixtures rebuild byte for byte", "plant", "--check"],
    ["planted defects: 100% caught at their times", "test", "planted"],
    ["describe: the reviewed ground truth", "test", "describe"],
    ["lint and fix: each operator removes its planted defect", "test", "fix"],
    ["lint and fix over the library: no clip worse, every one valid", "qa", "--fix"],
    ["T2: browser checks and library QA", "e2e"],
  ],
  G4: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["the held-out run is fresh: no gate run used it, its rig's license pinned, the rig cached (D57)", "fixtures", "heldout", "G4"],
    ["the sweep: every migrated clip on the six skeletons, 95% together; the held-out rig apart", "sweep", "gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight", "--min-total", "95", "--heldout", "G4"],
    ["T2: the demo headless, its set on the six skeletons and the held-out rig, sheets", "e2e"],
    ["B1: at least 4 of 5 fresh agents; 2 discovery trials, reported (§7)", "bench", "B1", "--trials", "5", "--discovery", "2"],
    ["B1's held-out variant: at least 4 of 5 fresh agents", "bench", "B1", "--trials", "5", "--heldout", "G4"],
  ],
  G5: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["the re-imported sets rebuild byte for byte, within the fit limits, every clip valid", "import", "--check"],
    ["the migrated sets rebuild byte for byte, their keys the sources'", "migrate", "--check"],
    ["every clip's facts and contacts as measured; no tag its facts don't bear out", "facts", "--check"],
    ["library QA: every clip's verdict, 1,000 unique motions, the category floors, the CC0 pack's count", "qa", "library", "--check"],
    ["search: the 40 game moments and the held-out queries", "test", "search"],
    ["licenses: every shipped set", "license", "check", "library"],
    ["the library loads, every file as locked", "library", "check"],
    ["T2: browser checks and library QA", "e2e"],
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
