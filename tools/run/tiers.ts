// The test tiers (PLAN.md §6): what each runs and its budget. `check`, `test` and `e2e` are thin entries over
// `runTier`, which times the steps, applies the budget (warn over, fail at 1.5x) and prints the verdict first.
import { bin, budget, finish, fmtMs, parseArgs, runStep, runStepAsync, usage, type FlagSpec, type Report, type Step } from "./cli.ts";

/** A step in a tier: a command line, and how to summarize its output on success. */
export interface TierStep {
  name: string;
  cmd: string;
  args: string[];
  /** Variables added to the environment it runs in. */
  env?: Record<string, string>;
  /** Runs at the same time as the step before it (neither reads what the other writes). */
  together?: boolean;
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
    // beside the typecheck; its cache keys files by content, not mtime, so CI's fresh checkout reuses it (D118)
    { name: "lint", cmd: bin("eslint"), args: [".", "--cache", "--cache-location", ".cache/eslint/", "--cache-strategy", "content", "--max-warnings", "0"], together: true },
    { name: "headers", cmd: process.execPath, args: ["tools/run/headers.ts"] },
    { name: "version", cmd: process.execPath, args: ["tools/version.ts", "--check"] },
    { name: "doctrine", cmd: process.execPath, args: ["tools/doctrine/main.ts"] },
  ];
}

/** Run a tier's steps in order (a `together` step beside the one before it), stopping after the first failure, then
 *  report against its budget. */
export async function runTier(tier: Tier, argv: readonly string[], extra: readonly FlagSpec[] = []): Promise<never> {
  let parsed;
  try {
    parsed = parseArgs(argv, extra);
  } catch (err) {
    usage(tier.tool, err, extra);
  }
  const verbose = Boolean(parsed.flags.verbose);
  const steps: Step[] = [];
  const t0 = performance.now();
  const envOf = (s: TierStep) => (s.env ? { ...process.env, ...s.env } : undefined);
  for (let i = 0; i < tier.steps.length; ) {
    let j = i + 1;
    while (j < tier.steps.length && tier.steps[j]!.together) j++;
    const batch = tier.steps.slice(i, j);
    const done = batch.length === 1 ? [runStep(tier.tool, batch[0]!.name, batch[0]!.cmd, batch[0]!.args, verbose, envOf(batch[0]!))] : await Promise.all(batch.map((s) => runStepAsync(tier.tool, s.name, s.cmd, s.args, verbose, envOf(s))));
    for (const [k, r] of done.entries()) {
      const { output: _output, ...step } = r, s = batch[k]!;
      if (r.ok && s.summarize) step.summary = s.summarize(r.output);
      steps.push(step);
    }
    if (done.some((r) => !r.ok)) break;
    i = j;
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
