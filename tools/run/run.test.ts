// Tests for the repo runners: the output contract's parsing and budgets, the header lint, versioning, the
// test:changed selection, a gate's report (the commit it ran at, D91) and the e2e runner's filters.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bump, check, write } from "../version.ts";
import { select } from "./changed.ts";
import { anchor } from "./e2e.ts";
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
