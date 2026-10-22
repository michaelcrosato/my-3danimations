// Tests for the repo runners: the output contract's parsing and budgets, the header lint, versioning, the
// test:changed selection (a rule for each kind of file a suite covers), a gate's report (the commit it ran at, D91),
// AGENTS.md's command table naming every script, the e2e runner's filters and its steps (the rate sweep on its
// sample), and the preview site's guard on the directory it empties.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bump, check, write } from "../version.ts";
import { select } from "./changed.ts";
import { RATE_RIGS } from "../sweep/rates.ts";
import { anchor, RATE_SAMPLE, t2Steps } from "./e2e.ts";
import { budget, closest, distance, parseArgs, ROOT, UsageError } from "./cli.ts";
import { GATES, G7_MODELS, gateReport, RECORDED } from "./gate.ts";
import { hasHeader, undocumentedExports } from "./headers.ts";

describe("the output contract", () => {
  it("names the closest valid flag for an unknown one", () => {
    expect(distance("verbos", "verbose")).toBe(1);
    expect(closest("jsn", ["json", "verbose"])).toBe("json");
    expect(() => parseArgs(["--jsn"], [])).toThrow(UsageError);
    expect(() => parseArgs(["--jsn"], [])).toThrow(/did you mean --json/);
  });
  it("parses flags with values and positionals", () => {
    const p = parseArgs(["G0", "--grep", "x", "--json"], [{ name: "grep", takesValue: true, help: "" }]);
    expect(p.positionals).toEqual(["G0"]);
    expect(p.flags).toEqual({ grep: "x", json: true });
    expect(parseArgs(["--grep=y"], [{ name: "grep", takesValue: true, help: "" }]).flags.grep).toBe("y");
  });
  it("warns over budget and fails at 1.5x", () => {
    expect(budget(10_000, 15_000)).toEqual({ fail: false });
    expect(budget(16_000, 15_000).fail).toBe(false);
    expect(budget(16_000, 15_000).warning).toMatch(/over budget/);
    expect(budget(23_000, 15_000).fail).toBe(true);
  });
});

describe("a gate's report", () => {
  it("records the commit it ran at and whether the tree differed from it (D91)", () => {
    const steps = [{ name: "check", ok: true, ms: 10 }, { name: "test", ok: false, ms: 20 }], commit = "a9731b1".padEnd(40, "0");
    expect(gateReport("G6", steps.slice(0, 1), 1500, { commit, dirty: false })).toMatchObject({ ok: true, verdict: "gate G6: PASS in 1.5 s (1/1 commands) at a9731b1", commit, dirty: false });
    expect(gateReport("G6", steps, 1500, { commit, dirty: true })).toMatchObject({ ok: false, verdict: "gate G6: FAIL in 1.5 s (1/2 commands) at a9731b1, the tree differing from it", commit, dirty: true });
  });
  it("reports a recorded step without gating on it (D98)", () => {
    const steps = [{ name: "check", ok: true, ms: 10 }, { name: `${RECORDED}B1 to B7 on a model`, ok: false, ms: 20 }], commit = "a9731b1".padEnd(40, "0");
    expect(gateReport("G7", steps, 1500, { commit, dirty: false })).toMatchObject({ ok: true, verdict: "gate G7: PASS in 1.5 s (1/1 commands, 1 recorded) at a9731b1", steps });
    expect(gateReport("G7", [{ ...steps[0]!, ok: false }, steps[1]!], 1500, { commit, dirty: false }).ok).toBe(false);
    expect(GATES.G7!.filter(([name]) => name.startsWith(RECORDED)).map(([, , , ...args]) => args.at(-1))).toEqual([...G7_MODELS]);
  });
  it("runs only the root package.json's scripts, G8's and G9's among them", () => {
    const scripts = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;
    for (const [gate, steps] of Object.entries(GATES)) for (const [name, script] of steps) expect(scripts[script], `${gate}: ${name}`).toBeDefined();
    expect(GATES.G8!.map(([, script]) => script)).toEqual(["check", "test", "doctrine", "vectors", "test", "e2e", "site", "m3a"]);
    expect(GATES.G9!.filter(([, script]) => script === "bench").map(([, , ...args]) => args.join(" "))).toEqual(["B8 --trials 5 --parallel 5", "B8-ten --trials 1", "B8 --trials 5 --parallel 5 --heldout G9"]);
  });
  it("certifies the TypeScript implementation in full and plays the consumer proof at G10", () => {
    expect(GATES.G10!.filter(([, script]) => script === "conformance" || script === "e2e").map(([, script, ...args]) => [script, ...args].join(" "))).toEqual(["conformance --impl ts", "e2e consumer-ts", "e2e"]);
  });
});

describe("the header lint", () => {
  it("wants a comment first, after an optional shebang", () => {
    expect(hasHeader("// what this holds\nexport {}")).toBe(true);
    expect(hasHeader("#!/usr/bin/env node\n/* holds */\n")).toBe(true);
    expect(hasHeader("export const x = 1;\n")).toBe(false);
  });
  it("wants a doc comment on every declared export, not on re-exports", () => {
    const text = ["/** Documented. */", "export const a = 1;", "export function b() {}", 'export { c } from "./c.ts";', "/** T. */", "export interface T {}"].join("\n");
    expect(undocumentedExports(text)).toEqual(["3: b"]);
  });
});

describe("versioning", () => {
  it("bumps minor and patch, or takes an explicit version", () => {
    expect(bump("0.1.0", "minor")).toBe("0.2.0");
    expect(bump("0.1.3", "patch")).toBe("0.1.4");
    expect(bump("0.1.3", "1.0.0")).toBe("1.0.0");
    expect(() => bump("0.1.0", "major-ish")).toThrow(/expected/);
  });
  it("writes every place and finds every disagreement", () => {
    const root = mkdtempSync(join(tmpdir(), "m3a-version-"));
    mkdirSync(join(root, "packages/core/src"), { recursive: true });
    mkdirSync(join(root, "packages/io"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.1.0" }));
    writeFileSync(join(root, "packages/core/package.json"), JSON.stringify({ version: "0.1.0" }));
    writeFileSync(join(root, "packages/io/package.json"), JSON.stringify({ version: "0.0.9", dependencies: { "@m3a/core": "0.1.0" } }));
    writeFileSync(join(root, "packages/core/src/version.ts"), 'export const VERSION = "0.1.0";\n');
    writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## 0.1.0 · 2026-10-11\n");
    expect(check(root)).toEqual(["packages/io/package.json: version 0.0.9, want 0.1.0"]);
    write("0.2.0", "2026-10-12", root);
    expect(check(root)).toEqual([]);
  });
});

describe("test:changed", () => {
  it("runs everything when the toolchain changes", () => {
    expect(select(["package.json"])).toBe("all");
    expect(select(["tools/run/cli.ts"])).toBe("all");
  });
  it("runs a package's suite and its dependents', with reasons", () => {
    const sel = select(["packages/core/src/index.ts"]);
    expect(sel).not.toBe("all");
    const suites = (sel as { suite: string; why: string }[]).map((c) => c.suite);
    expect(suites).toContain("packages/core/test");
    expect(suites).toContain("packages/tools/test");
    expect((sel as { why: string }[])[0]!.why).toMatch(/changed/);
  });
  it("runs nothing for docs alone", () => {
    expect(select(["docs/PROGRESS.md", "README.md"])).toEqual([]);
  });
  /** The suites `files` select, with no toolchain change among them. */
  const suites = (...files: string[]) => (select(files) as { suite: string }[]).map((c) => c.suite);
  it("runs the benchmark runner's suite for the runner, the briefs and the quiz", () => {
    for (const f of ["bench/runner/agent.ts", "bench/briefs/B1.md", "bench/quiz/legend.json"]) expect(suites(f), f).toContain("bench/runner");
  });
  it("runs a brief's grader for its grader and its starters, the discovery variant's among them", () => {
    expect(suites("bench/graders/B3/grade.ts")).toContain("bench/graders/B3");
    expect(suites("bench/starters/B4/src/main.ts")).toContain("bench/graders/B4");
    expect(suites("bench/starters/B1-discovery/src/main.ts")).toContain("bench/graders/B1");
  });
  it("runs every suite importing a shared file, through the files between", () => {
    expect(suites("bench/graders/bones.ts")).toEqual(expect.arrayContaining(["bench/graders/B1", "bench/graders/B8", "bench/runner"]));
    expect(suites("tools/doctrine/budgets.ts")).toEqual(expect.arrayContaining(["tools/doctrine", "tools/skill"]));
  });
  it("runs the intake's tests for the intake service: its function, its SQL, its schemas", () => {
    for (const f of ["services/intake/functions/submit/handler.ts", "services/intake/migrations/20261019120000_intake.sql", "services/intake/schemas/queue.schema.json"]) expect(suites(f), f).toContain("packages/tools/test");
  });
  it("runs the workflow tests for a workflow", () => {
    expect(suites(".github/workflows/ci.yml")).toEqual(["tools/intake", "tools/release"]);
  });
  it("runs the skill tests for either skill and llms.txt", () => {
    for (const f of ["skills/m3a/SKILL.md", ".claude/skills/m3a/SKILL.md", "llms.txt"]) expect(suites(f), f).toEqual(["tools/skill"]);
  });
  it("runs the library's and QA's tests for a clip or a baseline", () => {
    for (const f of ["library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json", "library/baselines/qa.json"]) expect(suites(f), f).toEqual(["packages/library/test", "tools/qa", "tools/sweep/rates.test.ts", "tools/sweep/rates-answers.test.ts", "tools/facts/readings.test.ts"]);
    expect(suites(".claude/hooks/session-start.sh")).toEqual(["tools/session"]);
  });
  it("runs the review queue's test for the feedback log", () => {
    expect(suites("docs/FEEDBACK-LOG.md")).toEqual(["packages/tools/test/review.test.ts"]);
  });
  it("runs the tools' and the benchmark's suites that import a changed package, or a package depending on it", () => {
    const sensors = select(["packages/sensors/src/index.ts"]) as { suite: string; why: string }[];
    expect(sensors.map((c) => c.suite)).toEqual(expect.arrayContaining(["packages/sensors/test", "packages/tools/test", "tools/qa", "bench/graders/B1"]));
    expect(sensors.find((c) => c.suite === "tools/qa")!.why).toMatch(/^its tests import @m3a\/(sensors|tools)\b/);
    // a package's test characters are not the package: the suites importing them, through the files between
    expect(suites("packages/three/test-characters/variants.ts")).toEqual(expect.arrayContaining(["packages/three/test", "packages/io/test", "bench/graders/B1"]));
  });
});

describe("the command table", () => {
  it("names every package.json script in AGENTS.md as npm run <name> (npm test as npm test)", () => {
    const scripts = Object.keys((JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts);
    const table = readFileSync(join(ROOT, "AGENTS.md"), "utf8").split("\n").filter((l) => l.startsWith("| `"));
    const named = new Set(table.flatMap((l) => [...l.split(" | ")[0]!.matchAll(/`npm (?:run ([\w:-]+)|(test))\b/g)].map((m) => m[1] ?? m[2]!)));
    expect(scripts.filter((s) => !named.has(s))).toEqual([]);
  });
});

describe("the e2e runner's filters", () => {
  it("anchors a bare name to its suite, so a checkout path holding the name doesn't match every suite", () => {
    expect(["gallery", "review.e2e", "previews.e2e.ts", "gallery:120"].map((f) => anchor(f))).toEqual(["tests/e2e/gallery.e2e.ts", "tests/e2e/review.e2e.ts", "tests/e2e/previews.e2e.ts", "tests/e2e/gallery.e2e.ts:120"]);
    // a name no suite has: the suites' file names alone; a path or a pattern as given
    expect([anchor("animator"), anchor("tests/e2e/gallery.e2e.ts"), anchor("/gall.ry/")]).toEqual(["tests/e2e/[^/]*animator[^/]*\\.e2e\\.ts", "tests/e2e/gallery.e2e.ts", "/gall.ry/"]);
    const re = new RegExp(anchor("animator"), "i");
    expect([re.test("/x/lane-animator/tests/e2e/animator-parity.e2e.ts"), re.test("/x/lane-animator/tests/e2e/hello.e2e.ts")]).toEqual([true, false]);
  });
});

describe("T2's rate sweep", () => {
  it("sweeps two of the six bodies whole against the baseline, a generated one and a real rig, a step of its own after the library sweeps (ci.yml's rates job all six, D126)", () => {
    const steps = t2Steps([]), step = steps.at(-1)!;
    expect(steps.map((s) => s.name)).toEqual(["playwright", "library QA", "library sweeps in full", "rate sweep on gen-0 and kaykit-knight"]);
    expect([step.cmd, step.args, step.env, step.together]).toEqual([process.execPath, ["tools/sweep/main.ts", "--rates", "gen-0", "kaykit-knight", "--check", "--out", "check-output/sweep/rates-t2.json"], undefined, undefined]);
    expect([RATE_SAMPLE.filter((r) => !RATE_RIGS.includes(r)), RATE_SAMPLE.length < RATE_RIGS.length]).toEqual([[], true]);
    // a filter runs the suites it names alone
    expect(t2Steps(["gallery"]).map((s) => [s.name, s.args])).toEqual([["playwright", ["test", "tests/e2e/gallery.e2e.ts"]]]);
    // its summary: the sweep's verdict line, wherever it prints it
    expect(step.summarize!("sweep --rates: PASS, 8110 rows (811 loops × 5 rates × 2 bodies) in 24.2 s: 7556 pass, 382 warn, 172 fail, 0 of them not baselined\n  ok   gen-0\n")).toBe("PASS, 8110 rows (811 loops × 5 rates × 2 bodies) in 24.2 s: 7556 pass, 382 warn, 172 fail, 0 of them not baselined");
  });
});

describe("the preview site's builder", () => {
  it("refuses an --out directory that holds files and no marker of its own, a labs/index.html there notwithstanding", () => {
    const dir = mkdtempSync(join(tmpdir(), "m3a-site-"));
    mkdirSync(join(dir, "labs"));
    writeFileSync(join(dir, "labs/index.html"), "<p>another site's page</p>\n");
    writeFileSync(join(dir, "keep.txt"), "someone's file\n");
    try {
      const r = spawnSync(process.execPath, [join(ROOT, "tools/run/site.ts"), "--out", dir], { cwd: ROOT, encoding: "utf8", timeout: 110_000 });
      expect([r.status, r.stdout.split("\n")[0]]).toEqual([2, `site: usage error: ${dir} holds files that aren't a site this tool wrote; name a new directory with --out`]);
      expect(readFileSync(join(dir, "keep.txt"), "utf8")).toBe("someone's file\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
