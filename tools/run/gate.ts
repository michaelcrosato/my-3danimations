// `npm run gate -- G<n>`: a gate's fixed command set (PLAN.md §8.5, §9.3), run in order with times. Every command
// runs even after a failure, so the report lists everything that failed. The report records the commit it ran at and
// whether the tracked tree differed from it, read before the first command (D91, as the bench's records do). With
// --json the report lands in check-output/gate/report.json; the gate report for docs/PROGRESS.md and the PR is built
// from it. A step named "recorded: ..." runs and is reported but doesn't gate (G7's other models, D98).
import { commitOf } from "../../bench/runner/main.ts";
import { closest, finish, fmtMs, parseArgs, runStep, usage, type Report, type Step } from "./cli.ts";

/** The prefix of a step that is reported, not gating: its outcome is in the report, and the gate's verdict leaves it out. */
export const RECORDED = "recorded: ";
/** The briefs G7 runs (PLAN.md §7, §9.3). */
const G7_BRIEFS = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"] as const;
/** The models G7 records besides the CLI's default, one trial a brief, not gating (D98; O10: Claude models only). */
export const G7_MODELS = ["claude-opus-5-5", "claude-haiku-5-5", "claude-fable-5-1"] as const;

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
    ["the sweep: every library clip on the six skeletons, 95% together, no fail finding added (D80); the held-out rig apart", "sweep", "gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight", "--min-total", "95", "--heldout", "G4"],
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
  G6: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["the pinned sources, for the moves", "pins", "fetch"],
    ["vectors --check", "vectors", "--check"],
    ["library/moves.json as the pinned sources give it", "moves", "--check"],
    ["composed clips pass QA: the example recipes, the procedural sources, the actions and their cuts", "test", "recipe", "procedural", "actions"],
    ["graph simulations are deterministic: the expected traces exactly, a run the same twice, save and restore", "test", "graph", "sim"],
    ["T2: browser checks (graphs Node = Chromium), library QA and the sweeps T1 samples, in full", "e2e"],
    ["the held-out run is fresh: no gate run used it, each variant's character one no test or run used", "fixtures", "heldout", "G6"],
    ...(["B2", "B3", "B5", "B6", "B7"] as const).flatMap((b): [string, string, ...string[]][] => [
      [`${b}: at least 4 of 5 fresh agents (§7)`, "bench", b, "--trials", "5", "--parallel", "5"],
      [`${b}'s held-out variant: at least 4 of 5 fresh agents`, "bench", b, "--trials", "5", "--parallel", "5", "--heldout", "G6"],
    ]),
  ],
  G7: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine: the manual within its 8,000 tokens, the tools within 3,000", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["every tool example passes; the CLI, MCP, API and console reply the same", "test", "packages/tools"],
    ["the manual's code runs", "test", "manual"],
    ["the packaged CLI, MCP server and single file run the manual's example; licenses and QA of the bundle", "pack", "--check"],
    ["licenses: the single file's manifest", "license", "check", "tools/bundle/manifest.json"],
    ["T2: browser checks, the MCP Inspector on every example, library QA and the sweeps in full", "e2e"],
    ["the held-out run is fresh: no gate run used it, each variant's character one no test or run used", "fixtures", "heldout", "G7"],
    ["B1: at least 4 of 5 fresh agents; 2 discovery trials, reported (§7)", "bench", "B1", "--trials", "5", "--parallel", "5", "--discovery", "2"],
    ...G7_BRIEFS.filter((b) => b !== "B1").map((b): [string, string, ...string[]] => [`${b}: at least 4 of 5 fresh agents (§7)`, "bench", b, "--trials", "5", "--parallel", "5"]),
    ...G7_BRIEFS.map((b): [string, string, ...string[]] => [`${b}'s held-out variant: at least 4 of 5 fresh agents`, "bench", b, "--trials", "5", "--parallel", "5", "--heldout", "G7"]),
    ...G7_MODELS.map((m): [string, string, ...string[]] => [`${RECORDED}B1 to B7 on ${m}, one trial each`, "bench", G7_BRIEFS.join(","), "--trials", "1", "--parallel", "5", "--model", m]),
  ],
  // a pull request that touches library/sets/ (library-gates.yml, WP-9.1a): the clips it adds or changes through the
  // intake's gates; with --fixture all, a scratch copy of the library with each fixture's clip planted on its own, the
  // bad ones expected to fail (the step passes when they do, and the clean ones pass)
  "library-pr": [["the library gates on the clips it adds or changes: the library as locked, its sets' licenses, the intake's gates", "intake", "gates", "--base", "origin/main"]],
  // the owner's phone review of the batch is theirs (blocked-owner until it comes, §8.5): the gate proves the way
  // there; the notes and the threshold or task it brings back are read off its `m3a review ingest` line when it comes
  G8: [
    ["check", "check"],
    ["test", "test"],
    ["doctrine", "doctrine"],
    ["vectors --check", "vectors", "--check"],
    ["the intake store's contract on the local backend, the submit function, the review tool on four surfaces", "test", "review", "intake"],
    ["T2: the gallery (every set and clip by link at a phone viewport), the review queue (a 20-clip batch by touch, applied once, stale refused), previews (every page's stamp, the labs index), library QA, the sweeps", "e2e"],
    ["the preview site builds as Vercel builds it", "site"],
    ["the owner's batch exported for the review page (the sampled clips counted in its line)", "m3a", "review", "export"],
  ],
};

/** A gate's report from its steps' outcomes: its verdict, with the commit it ran at and whether the tracked tree
 *  differed from it (`commitOf`, read before the first command), recorded beside the steps (D91). */
export function gateReport(gate: string, steps: Step[], ms: number, at: ReturnType<typeof commitOf>): Report & ReturnType<typeof commitOf> {
  const gating = steps.filter((s) => !s.name.startsWith(RECORDED)), ok = gating.every((s) => s.ok);
  return {
    tool: "gate",
    ok,
    verdict: `gate ${gate}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)} (${gating.filter((s) => s.ok).length}/${gating.length} commands${gating.length < steps.length ? `, ${steps.length - gating.length} recorded` : ""}) at ${at.commit.slice(0, 7)}${at.dirty ? ", the tree differing from it" : ""}`,
    steps,
    warnings: [],
    ms,
    next: ok ? `write the ${gate} report in docs/PROGRESS.md and on the PR, then merge (PLAN.md §8.5)` : `fix forward; a gate that fails twice is checked against the kill criteria (PLAN.md §12)`,
    ...at,
  };
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), [{ name: "fixture", takesValue: true, help: "library-pr: the intake's fixtures (all, or one) planted in a scratch copy of the library" }]);
    const g = parsed.positionals[0];
    if (!g) throw new Error(`name a gate: ${Object.keys(GATES).join(", ")}`);
    if (!GATES[g]) throw new Error(`no gate ${g} yet; did you mean ${closest(g, Object.keys(GATES))}? (gates are filled in as their phase arrives)`);
    if (parsed.flags.fixture !== undefined && g !== "library-pr") throw new Error("--fixture is library-pr's");
  } catch (err) {
    usage("gate", err, []);
  }
  const gate = parsed.positionals[0]!;
  const steps: Step[] = [];
  const t0 = performance.now(), at = commitOf();
  for (const [name, script, ...given] of GATES[gate]!) {
    const args = typeof parsed.flags.fixture === "string" && script === "intake" ? [given[0]!, "--fixture", parsed.flags.fixture] : given;
    const { output, ...r } = runStep("gate", name.replace(/\W+/g, "-"), "npm", ["run", "--silent", script, ...(args.length ? ["--", ...args] : [])], Boolean(parsed.flags.verbose));
    r.name = name;
    const firstLine = output.split("\n").find((l) => l.trim() !== "");
    if (firstLine) r.summary = firstLine.trim().slice(0, 140);
    steps.push(r);
  }
  finish(gateReport(gate, steps, performance.now() - t0, at), parsed);
}
