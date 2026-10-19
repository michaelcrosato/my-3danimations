// The output contract for repo tools (PLAN.md §5.6): parse flags strictly, print the verdict first in at most
// 20 lines, write `report.json` under check-output/<tool>/ with --json (under $M3A_CHECK_OUTPUT/<tool>/ when that is
// set, so a test's run leaves the reports a person made alone), exit 0 ok / 1 findings / 2 usage error, and end every
// reply with a `next` hint. Also runs commands with timing, for the tier and gate runners.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

/** The repository root (tools/run/ is two levels down). */
export const ROOT = resolve(import.meta.dirname, "../..");

/** Exit codes shared by every repo tool. */
export const EXIT = { ok: 0, findings: 1, usage: 2 } as const;

/** A flag a tool accepts: boolean, or taking one value. */
export interface FlagSpec {
  name: string;
  takesValue?: boolean;
  help: string;
}

/** Parsed command line: flags by name, and positionals in order. */
export interface Parsed {
  flags: Record<string, string | boolean>;
  positionals: string[];
}

/** Edit distance between two strings, for "did you mean" hints. */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/** The candidate closest to `word`, by edit distance. */
export function closest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = distance(word, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** A usage error: the tool prints it with the closest valid choice and exits 2. */
export class UsageError extends Error {}

/**
 * Parse argv against the tool's flags. Every tool also accepts --json and --verbose. An unknown flag throws a
 * UsageError naming the closest valid one.
 */
export function parseArgs(argv: readonly string[], specs: readonly FlagSpec[]): Parsed {
  const all: FlagSpec[] = [
    ...specs,
    { name: "json", help: "also write check-output/<tool>/report.json" },
    { name: "verbose", help: "print every detail, not only the verdict" },
  ];
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split("=", 2) as [string, string | undefined];
    const spec = all.find((s) => s.name === name);
    if (!spec) {
      const near = closest(name, all.map((s) => s.name));
      throw new UsageError(`unknown flag --${name}${near ? `; did you mean --${near}?` : ""}`);
    }
    if (spec.takesValue) {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new UsageError(`--${name} needs a value`);
      flags[name] = value;
    } else {
      flags[name] = true;
    }
  }
  return { flags, positionals };
}

/** One step of a report: a named check with its outcome, time and optional detail lines. */
export interface Step {
  name: string;
  ok: boolean;
  ms: number;
  summary?: string;
  detail?: string[];
  log?: string;
}

/** A tool's reply, printed verdict-first and optionally written as report.json. */
export interface Report {
  tool: string;
  ok: boolean;
  verdict: string;
  steps: Step[];
  warnings: string[];
  next: string;
  ms: number;
}

const MAX_LINES = 20;

/** Print the report verdict-first (at most 20 lines unless --verbose), write report.json with --json, and exit. */
export function finish(report: Report, parsed: Parsed, exitCode?: number): never {
  const lines: string[] = [report.verdict];
  for (const s of report.steps) {
    lines.push(`  ${s.ok ? "ok  " : "FAIL"} ${s.name} ${fmtMs(s.ms)}${s.summary ? `: ${s.summary}` : ""}`);
  }
  for (const w of report.warnings) lines.push(`  warn ${w}`);
  const failed = report.steps.filter((s) => !s.ok);
  for (const s of failed) {
    const detail = s.detail ?? [];
    const room = parsed.flags.verbose ? detail.length : Math.max(0, MAX_LINES - lines.length - 3);
    if (detail.length) lines.push(`  -- ${s.name}:`);
    for (const d of detail.slice(-room)) lines.push(`     ${d}`);
    if (s.log) lines.push(`     full log: ${s.log}`);
  }
  if (parsed.flags.json) {
    const dir = resolve(process.env.M3A_CHECK_OUTPUT || join(ROOT, "check-output"), report.tool), file = join(dir, "report.json"), rel = relative(ROOT, file);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
    lines.push(`report: ${rel.startsWith("..") || isAbsolute(rel) ? file : rel}`);
  }
  lines.push(`next: ${report.next}`);
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(exitCode ?? (report.ok ? EXIT.ok : EXIT.findings));
}

/** Print a usage error with the tool's flags and exit 2. */
export function usage(tool: string, err: unknown, specs: readonly FlagSpec[]): never {
  const msg = err instanceof Error ? err.message : String(err);
  const flags = specs.map((s) => `  --${s.name}${s.takesValue ? " <value>" : ""}  ${s.help}`);
  process.stdout.write(
    [`${tool}: usage error: ${msg}`, ...flags, "  --json  also write report.json", "  --verbose  print every detail", `next: fix the command line and rerun`].join("\n") + "\n",
  );
  process.exit(EXIT.usage);
}

/** Format milliseconds as seconds with one decimal. */
export function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Run a command (no shell), capturing output to check-output/<tool>/<name>.log; stream it with --verbose. */
export function runStep(tool: string, name: string, cmd: string, args: readonly string[], verbose: boolean, env?: NodeJS.ProcessEnv): Step & { output: string } {
  const t0 = performance.now();
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: verbose ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", ...env },
    maxBuffer: 256 * 1024 * 1024,
  });
  const ms = performance.now() - t0;
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const dir = join(ROOT, "check-output", tool);
  mkdirSync(dir, { recursive: true });
  const log = join(dir, `${name}.log`);
  writeFileSync(log, output);
  const ok = r.status === 0;
  const detail = ok ? [] : output.split("\n").filter((l) => l.trim() !== "").slice(-40);
  return { name, ok, ms, detail, log: `check-output/${tool}/${name}.log`, output };
}

/** Compare a tier's time to its budget: warn when over, fail at 1.5x (PLAN.md §6). */
export function budget(ms: number, budgetMs: number): { warning?: string; fail: boolean } {
  if (ms > budgetMs * 1.5) return { warning: `over 1.5x its budget (${fmtMs(ms)} > ${fmtMs(budgetMs * 1.5)})`, fail: true };
  if (ms > budgetMs) return { warning: `over budget (${fmtMs(ms)} > ${fmtMs(budgetMs)})`, fail: false };
  return { fail: false };
}

/** The local binary for an npm dev dependency. */
export function bin(name: string): string {
  return join(ROOT, "node_modules", ".bin", name);
}
