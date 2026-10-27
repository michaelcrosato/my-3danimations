// T2, `npm run e2e`: browser adapter checks under Playwright on the preinstalled Chromium, then the sensors over the
// whole library against the committed baseline (WP-3.3) and the library's QA as a whole: recorded verdicts, G5's
// floors, distributions, docs/LIBRARY.md (`npm run qa -- library --check`, WP-5.8), and the library-wide sweeps T1
// samples, in full (every locomotion loop planted, the actions on the six skeletons, describe's token count on every
// clip, the briefs' graders on a second character, the dedup sweep over the library, the procedural grids on all three
// rests, the solver on every tier-2 pose and the Animator restored at every step, each fix
// on every planted run: M3A_FULL=1, D74, WP-F.15), then the rate
// sweep on two of its six bodies, every locomotion loop at every rate on each against its baseline (D123), a step of
// its own since its worker threads take every CPU (beside the sweeps' workers they starved a 5 s test on CI's 4); CI
// sweeps all six on every pull request in a job of its own beside T2 (ci.yml's `rates`, D126). Within 8 min (PLAN.md
// §6). Naming tests (`npm run e2e -- <filter>`) runs those alone: a bare name is its suite, tests/e2e/<name>.e2e.ts
// (`anchor`).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { bin, ROOT } from "./cli.ts";
import { playwrightSummary, runTier, vitestSummary, type TierStep } from "./tiers.ts";

/** The T1 test files that sample the library, run in full here. */
const SWEEPS = ["packages/core/test/contact.test.ts", "packages/core/test/contact-gaits.test.ts", "packages/core/test/contact-sidesteps.test.ts", "packages/core/test/contact-siderun.test.ts", "tools/sweep/actions.test.ts", "packages/sensors/test/describe-tokens.test.ts", "bench/graders/B1", "bench/graders/B2", "bench/graders/B3", "bench/graders/B4", "bench/graders/B5", "bench/graders/B6", "bench/graders/B7", "bench/graders/B8", "bench/runner/briefs.test.ts", "bench/runner/runner.test.ts", "tools/sweep/sweep.test.ts", "packages/library/test/dedup/dedup.test.ts", "tools/intake/check.test.ts", "tools/intake/adopt.test.ts", "apps/gallery/src/playback.test.ts", "packages/core/test/procedural.test.ts", "packages/sensors/test/procedural.test.ts", "packages/core/test/solve.test.ts", "packages/core/test/animator.test.ts", "packages/sensors/test/fix.test.ts"];

/** The rate sweep's bodies T2 sweeps whole (D126): a generated one and the real rig whose feet fail the most rows, each
 *  with every locomotion loop at every rate, against the baseline. CI's `rates` job sweeps all six on every pull
 *  request (tools/sweep/rates.test.ts in full, D123). */
export const RATE_SAMPLE: readonly string[] = ["gen-0", "kaykit-knight"];

/** A filter as Playwright gets it. Playwright matches a filter against each suite's absolute path, so a bare name
 *  (`gallery`, `review.e2e`, `gallery:120`) would also match every suite in a checkout whose path holds it: it becomes
 *  its suite's path, tests/e2e/<name>.e2e.ts, or, when no suite has that name, a pattern on the suites' file names
 *  alone. A path or any other pattern passes as given. */
export function anchor(filter: string, root = ROOT): string {
  const m = /^([\w-]+?)(?:\.e2e)?(?:\.ts)?((?::\d+){0,2})$/.exec(filter);
  if (!m) return filter;
  const [, name, at] = m as unknown as [string, string, string], file = `tests/e2e/${name}.e2e.ts`;
  return existsSync(join(root, file)) ? `${file}${at}` : `tests/e2e/[^/]*${name}[^/]*\\.e2e\\.ts${at}`;
}

/** T2's steps: Playwright on every suite, or on those the filters name alone; with no filter, then the library's QA,
 *  the sweeps T1 samples in full, and the rate sweep on RATE_SAMPLE with --check (D126), its rows to a file of T2's
 *  own (check-output/sweep/rates.json may hold a whole run). */
export function t2Steps(filters: readonly string[]): TierStep[] {
  return [
    { name: "playwright", cmd: "node_modules/.bin/playwright", args: ["test", ...filters.map((f) => anchor(f))], summarize: playwrightSummary },
    ...(filters.length
      ? []
      : [
          { name: "library QA", cmd: process.execPath, args: ["tools/qa/main.ts", "library", "--check"], summarize: (out: string) => out.split("\n").find((l) => l.startsWith("qa:"))?.slice(4) },
          { name: "library sweeps in full", cmd: bin("vitest"), args: ["run", ...SWEEPS], env: { M3A_FULL: "1" }, summarize: vitestSummary },
          { name: `rate sweep on ${RATE_SAMPLE.join(" and ")}`, cmd: process.execPath, args: ["tools/sweep/main.ts", "--rates", ...RATE_SAMPLE, "--check", "--out", "check-output/sweep/rates-t2.json"], summarize: (out: string) => out.split("\n").find((l) => l.startsWith("sweep --rates: "))?.slice(15) },
        ]),
  ];
}

if (import.meta.main) {
  const argv = process.argv.slice(2), filters = argv.filter((a) => !a.startsWith("--"));
  await runTier(
    {
      tool: "e2e",
      label: "T2",
      budgetMs: 8 * 60_000,
      steps: t2Steps(filters),
      next: "push",
    },
    argv,
  );
}
