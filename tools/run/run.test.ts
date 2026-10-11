// Tests for the repo runners: the output contract's parsing and budgets, the header lint, versioning and the
// test:changed selection.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bump, check, write } from "../version.ts";
import { select } from "./changed.ts";
import { budget, closest, distance, parseArgs, UsageError } from "./cli.ts";
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
