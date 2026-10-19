// `npm run test:changed [-- --which]`: T0, then only the test suites that cover files changed against main
// (committed, staged, unstaged and untracked), saying why each suite ran. --which shows the choice without running.
// A change to the toolchain (package.json, the lockfile, tsconfig, the test configs, tools/run/) runs every suite. A
// changed source file runs every suite whose tests import it, directly or through other files; a changed package runs
// its own tests, its dependents' and every suite that imports any of them; data a suite reads (the library, the
// benchmark's briefs and starters, the intake service, the workflows, the skills, the feedback log) has a rule each.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { specifiers } from "../doctrine/boundaries.ts";
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

const WORKSPACES = ["core", "sensors", "io", "library", "three", "tools"];
/** A package's own code, not its tests or test characters: a change there is a change to the package. */
const PACKAGE_CODE = /^packages\/([^/]+)\/(?!test)/;

/** The workspaces that depend on `pkg` (by their package.json dependencies), directly or through another. */
function dependents(pkg: string): string[] {
  const out: string[] = [];
  for (let todo = [pkg], p = todo.pop(); p; p = todo.pop()) {
    for (const dir of WORKSPACES) {
      const file = join(ROOT, "packages", dir, "package.json");
      if (out.includes(dir) || dir === pkg || !existsSync(file)) continue;
      const deps = (JSON.parse(readFileSync(file, "utf8")) as { dependencies?: Record<string, string> }).dependencies ?? {};
      if (`@m3a/${p}` in deps) {
        out.push(dir);
        todo.push(dir);
      }
    }
  }
  return out;
}

/** Every suite a changed source file can reach: each package's tests, each tool's, the benchmark runner's, each
 *  grader's, and the spec's. */
function suites(): string[] {
  const dirs = (d: string) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `${d}/${e.name}`) : []);
  return [...WORKSPACES.map((p) => `packages/${p}/test`), ...dirs("tools"), "bench/runner", ...dirs("bench/graders"), "spec"];
}

const reached = new Map<string, { files: Set<string>; packages: Set<string> }>();

/** What a suite's tests import (repository-relative files, and @m3a packages), following relative imports wherever
 *  they go; a package's own code counts as that package, and the walk stops there. */
function reach(suite: string): { files: Set<string>; packages: Set<string> } {
  const known = reached.get(suite);
  if (known) return known;
  const files = new Set<string>(), packages = new Set<string>(), todo = sourceFiles(join(ROOT, suite)).filter((f) => f.endsWith(".test.ts"));
  for (let file = todo.pop(); file; file = todo.pop()) {
    const rel = relative(ROOT, file);
    // (a specifier that names no file, as a string in a test's fixture may, is skipped)
    if (files.has(rel) || !existsSync(file) || !statSync(file).isFile()) continue;
    files.add(rel);
    const pkg = PACKAGE_CODE.exec(rel)?.[1];
    if (pkg) {
      packages.add(pkg);
      continue;
    }
    for (const s of specifiers(readFileSync(file, "utf8"))) {
      const m3a = /^@m3a\/([^/]+)/.exec(s)?.[1];
      if (m3a) packages.add(m3a);
      else if (s.startsWith(".")) todo.push(resolve(dirname(file), s));
    }
  }
  const r = { files, packages };
  reached.set(suite, r);
  return r;
}

/** Data a suite reads rather than imports: the changed paths it covers, the suites, and why they cover it. */
const READS: [RegExp, (m: RegExpExecArray) => string[], string][] = [
  [/^bench\/(briefs|quiz)\//, () => ["bench/runner"], "the runner's tests read the briefs and the quiz"],
  [/^bench\/starters\/(B\d+)/, (m) => [`bench/graders/${m[1]}`], "its grader's tests grade the starter"],
  [/^services\/intake\//, () => ["packages/tools/test"], "the intake tests run its function, its SQL and its schemas"],
  [/^\.github\/workflows\//, () => ["tools/intake", "tools/release"], "their tests read the workflows"],
  [/^(skills\/|\.claude\/skills\/|llms\.txt$)/, () => ["tools/skill"], "the skill tests read the skills and llms.txt"],
  [/^library\//, () => ["packages/library/test", "tools/qa"], "the library's and QA's tests read the clips"],
  [/^docs\/FEEDBACK-LOG\.md$/, () => ["packages/tools/test/review.test.ts"], "the review queue's test appends to a copy of it"],
];

/** Map changed files to suites, each with its reason. An empty list means only T0 runs. */
export function select(files: readonly string[]): Choice[] | "all" {
  const picks = new Map<string, string>();
  const add = (suite: string, why: string) => {
    if (!picks.has(suite)) picks.set(suite, why);
  };
  for (const f of files) {
    if (TOOLCHAIN.test(f)) return "all";
    const pkg = PACKAGE_CODE.exec(f)?.[1];
    if (pkg) {
      // its tests, its dependents', and every suite that imports one of them
      const touched = [pkg, ...dependents(pkg)];
      add(`packages/${pkg}/test`, `${f} changed`);
      for (const d of touched.slice(1)) add(`packages/${d}/test`, `@m3a/${d} depends on @m3a/${pkg} (${f})`);
      for (const s of suites()) {
        const p = touched.find((t) => reach(s).packages.has(t));
        if (p) add(s, `its tests import @m3a/${p}${p === pkg ? "" : `, which depends on @m3a/${pkg}`} (${f})`);
      }
      continue;
    }
    // a suite's own folder: a package's tests (or its test characters), a tool's, the benchmark runner's, a grader's
    const own = /^(packages\/[^/]+\/test|(?:tools\/[^/]+|bench\/runner|bench\/graders\/B\d+)(?=\/))/.exec(f)?.[1];
    if (own) add(own, `${f} changed`);
    else if (f.startsWith("spec/")) {
      add("spec", `${f} changed`);
      add("packages/core/test", `the core is checked against the spec (${f})`);
    }
    for (const [re, to, why] of READS) {
      const m = re.exec(f);
      if (m) for (const s of to(m)) add(s, `${why} (${f})`);
    }
    if (/\.test\.ts$/.test(f)) add(f, `${f} changed`);
    for (const s of suites()) if (reach(s).files.has(f)) add(s, `its tests import ${f}`);
  }
  const chosen = [...picks].map(([suite, why]) => ({ suite, why }));
  // a test file runs on its own only when no chosen folder holds it
  return chosen.filter((c) => existsSync(join(ROOT, c.suite)) && (c.suite.endsWith(".test.ts") ? !chosen.some((d) => c.suite.startsWith(`${d.suite}/`)) : sourceFiles(join(ROOT, c.suite)).some((s) => s.endsWith(".test.ts"))));
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
