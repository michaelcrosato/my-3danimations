// T2, `npm run e2e`: browser adapter checks under Playwright on the preinstalled Chromium, then the sensors over the
// whole library against the committed baseline (WP-3.3) and the library's QA as a whole: recorded verdicts, G5's
// floors, distributions, docs/LIBRARY.md (`npm run qa -- library --check`, WP-5.8), and the library-wide sweeps T1
// samples, in full (every locomotion loop planted, the actions on the six skeletons, describe's token count on every
// clip, the briefs' graders on a second character: M3A_FULL=1, D74), within 8 min
// (PLAN.md §6). Naming tests (`npm run e2e -- <filter>`) runs those alone.
import { bin } from "./cli.ts";
import { playwrightSummary, runTier, vitestSummary } from "./tiers.ts";

/** The T1 test files that sample the library, run in full here. */
const SWEEPS = ["packages/core/test/contact.test.ts", "packages/core/test/contact-gaits.test.ts", "packages/core/test/contact-sidesteps.test.ts", "packages/core/test/contact-siderun.test.ts", "tools/sweep/actions.test.ts", "packages/sensors/test/describe-tokens.test.ts", "bench/graders/B1", "bench/graders/B2", "bench/graders/B3", "bench/graders/B4", "bench/graders/B5", "bench/graders/B6", "bench/graders/B7", "bench/runner/briefs.test.ts"];

const argv = process.argv.slice(2), filtered = argv.some((a) => !a.startsWith("--"));
runTier(
  {
    tool: "e2e",
    label: "T2",
    budgetMs: 8 * 60_000,
    steps: [
      { name: "playwright", cmd: "node_modules/.bin/playwright", args: ["test", ...argv.filter((a) => !a.startsWith("--"))], summarize: playwrightSummary },
      ...(filtered
        ? []
        : [
            { name: "library QA", cmd: process.execPath, args: ["tools/qa/main.ts", "library", "--check"], summarize: (out: string) => out.split("\n").find((l) => l.startsWith("qa:"))?.slice(4) },
            { name: "library sweeps in full", cmd: bin("vitest"), args: ["run", ...SWEEPS], env: { M3A_FULL: "1" }, summarize: vitestSummary },
          ]),
    ],
    next: "push",
  },
  argv,
);
