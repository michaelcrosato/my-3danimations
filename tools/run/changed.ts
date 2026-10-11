// `npm run test:changed [-- --which]`: T0, then only the test suites that cover files changed against main
// (committed, staged, unstaged and untracked), saying why each suite ran. --which shows the choice without running.
// A change to the toolchain (package.json, the lockfile, tsconfig, the test configs, tools/run/) runs every suite.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bin, finish, fmtMs, parseArgs, ROOT, runStep, usage, type Report, type Step } from "./cli.ts";
import { sourceFiles } from "./headers.ts";
import { t0Steps, vitestSummary } from "./tiers.ts";

/** A selected suite (a test file or folder) and why it was chosen. */
export interface Choice {
  suite: string;
  why: string;
}

const TOOLCHAIN = /^(package\.json|package-lock\.json|\.npmrc|tsconfig[^/]*\.json|vitest\.config\.ts|eslint\.config\.js|tools\/run\/)/;

/** Files changed against the merge base with main, plus the working tree's changes. */
export function changedFiles(): string[] {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  let base = "";
  for (const ref of ["origin/main", "main"]) {
    try {
      base = execFileSync("git", ["merge-base", "HEAD", ref], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      break;
    } catch {
      // try the next ref
    }
  }
  const files = new Set<string>();
  if (base) for (const f of git("diff", "--name-only", base).split("\n")) if (f) files.add(f);
  for (const line of git("status", "--porcelain", "--untracked-files=all").split("\n")) {
    const f = line.slice(3).split(" -> ").pop();
    if (f) files.add(f);
  }
  return [...files].sort();
}

/** The workspaces that depend on `pkg` (by their package.json dependencies). */
function dependents(pkg: string): string[] {
  const out: string[] = [];
  for (const dir of ["core", "sensors", "io", "library", "three", "tools"]) {
    const p = join(ROOT, "packages", dir, "package.json");
    if (!existsSync(p)) continue;
    const deps = (JSON.parse(readFileSync(p, "utf8")) as { dependencies?: Record<string, string> }).dependencies ?? {};
    if (`@m3a/${pkg}` in deps) out.push(dir);
  }
  return out;
}

/** Map changed files to suites, each with its reason. An empty list means only T0 runs. */
export function select(files: readonly string[]): Choice[] | "all" {
  const picks = new Map<string, string>();
  const add = (suite: string, why: string) => {
    if (!picks.has(suite)) picks.set(suite, why);
  };
  for (const f of files) {
    if (TOOLCHAIN.test(f)) return "all";
    const pkg = /^packages\/([^/]+)\//.exec(f)?.[1];
    if (pkg) {
      add(`packages/${pkg}/test`, `${f} changed`);
      for (const d of dependents(pkg)) add(`packages/${d}/test`, `@m3a/${d} depends on @m3a/${pkg} (${f})`);
      continue;
    }
    const tool = /^tools\/([^/]+)\//.exec(f)?.[1];
    if (tool) {
      add(`tools/${tool}`, `${f} changed`);
      continue;
    }
    if (f.startsWith("spec/")) {
      add("spec", `${f} changed`);
      add("packages/core/test", `the core is checked against the spec (${f})`);
      continue;
    }
    if (/\.test\.ts$/.test(f)) add(f, `${f} changed`);
  }
  return [...picks].map(([suite, why]) => ({ suite, why })).filter((c) => existsSync(join(ROOT, c.suite)) && sourceFiles(join(ROOT, c.suite)).some((s) => s.endsWith(".test.ts")) || c.suite.endsWith(".test.ts"));
}

if (import.meta.main) {
  const specs = [{ name: "which", help: "show the selection without running it" }];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
  } catch (err) {
    usage("test:changed", err, specs);
  }
  const files = changedFiles();
  const sel = select(files);
  const choices: Choice[] = sel === "all" ? [{ suite: "(every suite)", why: "the toolchain changed" }] : sel;
  const lines = choices.map((c) => `${c.suite}  <- ${c.why}`);
  if (parsed.flags.which) {
    process.stdout.write(`test:changed: ${files.length} changed file(s), ${choices.length} suite(s)\n${lines.map((l) => `  ${l}`).join("\n")}\nnext: npm run test:changed\n`);
    process.exit(0);
  }
  const verbose = Boolean(parsed.flags.verbose);
  const t0 = performance.now();
  const steps: Step[] = [];
  for (const s of t0Steps()) {
    const { output: _o, ...r } = runStep("test-changed", s.name, s.cmd, s.args, verbose);
    steps.push(r);
    if (!r.ok) break;
  }
  if (steps.every((s) => s.ok) && choices.length) {
    const args = sel === "all" ? ["run"] : ["run", ...choices.map((c) => c.suite)];
    const r = runStep("test-changed", "vitest", bin("vitest"), args, verbose);
    const { output, ...step } = r;
    if (r.ok) step.summary = vitestSummary(output);
    steps.push(step);
  }
  const ms = performance.now() - t0;
  const ok = steps.every((s) => s.ok);
  const report: Report = {
    tool: "test-changed",
    ok,
    verdict: `test:changed: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}; ${files.length} changed file(s), ${choices.length} suite(s)${lines.length ? "\n  " + lines.slice(0, 8).join("\n  ") : ""}`,
    steps,
    warnings: [],
    ms,
    next: ok ? "commit; run npm run e2e before pushing" : "fix the failing step, then rerun npm run test:changed",
  };
  finish(report, parsed);
}
