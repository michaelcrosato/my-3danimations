// The test tiers (PLAN.md §6): what each runs and its budget. `check`, `test` and `e2e` are thin entries over
// `runTier`, which times the steps, applies the budget (warn over, fail at 1.5x) and prints the verdict first.
import { bin, budget, finish, fmtMs, parseArgs, runStep, usage, type FlagSpec, type Report, type Step } from "./cli.ts";

/** A step in a tier: a command line, and how to summarize its output on success. */
export interface TierStep {
  name: string;
  cmd: string;
  args: string[];
  summarize?: (output: string) => string | undefined;
}

/** A tier: its name, budget, steps and the next hint on success. */
export interface Tier {
  tool: string;
  label: string;
  budgetMs: number;
  steps: TierStep[];
  next: string;
}

/** Summarize vitest's output as "N files, M tests". */
export function vitestSummary(output: string): string | undefined {
  const files = /Test Files\s+(.+?)\s*\(/.exec(output)?.[1];
  const tests = /Tests\s+(.+?)\s*\(/.exec(output)?.[1];
  return files && tests ? `files ${files}; tests ${tests}` : undefined;
}

/** Summarize Playwright's line reporter as "N passed". */
export function playwrightSummary(output: string): string | undefined {
  const m = output.match(/(\d+) passed/);
  return m ? `${m[1]} passed` : undefined;
}

/** The T0 steps: typecheck, lint, source headers, versions and the doctrine's static checks. */
export function t0Steps(): TierStep[] {
  return [
    { name: "typecheck", cmd: bin("tsc"), args: ["-b"] },
    { name: "lint", cmd: bin("eslint"), args: [".", "--cache", "--cache-location", ".cache/eslint/", "--max-warnings", "0"] },
    { name: "headers", cmd: process.execPath, args: ["tools/run/headers.ts"] },
    { name: "version", cmd: process.execPath, args: ["tools/version.ts", "--check"] },
    { name: "doctrine", cmd: process.execPath, args: ["tools/doctrine/main.ts"] },
  ];
}

/** Run a tier's steps in order, stopping at the first failure, then report against its budget. */
export function runTier(tier: Tier, argv: readonly string[], extra: readonly FlagSpec[] = []): never {
  let parsed;
  try {
    parsed = parseArgs(argv, extra);
  } catch (err) {
    usage(tier.tool, err, extra);
  }
  const verbose = Boolean(parsed.flags.verbose);
  const steps: Step[] = [];
  const t0 = performance.now();
  for (const s of tier.steps) {
    const r = runStep(tier.tool, s.name, s.cmd, s.args, verbose);
    const { output: _output, ...step } = r;
    if (r.ok && s.summarize) step.summary = s.summarize(r.output);
    steps.push(step);
    if (!r.ok) break;
  }
  const ms = performance.now() - t0;
  const ran = steps.length === tier.steps.length;
  const allOk = ran && steps.every((s) => s.ok);
  const b = budget(ms, tier.budgetMs);
  const warnings = b.warning ? [`${tier.label} ${b.warning}`] : [];
  const ok = allOk && !b.fail;
  const failedStep = steps.find((s) => !s.ok);
  const verdict = ok
    ? `${tier.tool}: PASS (${tier.label}) in ${fmtMs(ms)}, budget ${fmtMs(tier.budgetMs)}`
    : failedStep
      ? `${tier.tool}: FAIL (${tier.label}) at ${failedStep.name}, after ${fmtMs(ms)}`
      : `${tier.tool}: FAIL (${tier.label}): over 1.5x the budget, ${fmtMs(ms)}`;
  const report: Report = {
    tool: tier.tool,
    ok,
    verdict,
    steps,
    warnings,
    ms,
    next: ok ? tier.next : failedStep ? `fix ${failedStep.name} (see its log), then rerun npm run ${tier.tool}` : `make ${tier.label} faster or split it; the budget is PLAN.md §6`,
  };
  finish(report, parsed);
}
