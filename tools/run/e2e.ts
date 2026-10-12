// T2, `npm run e2e`: browser adapter checks under Playwright on the preinstalled Chromium, then the sensors over the
// whole library against the committed baseline (WP-3.3) and the library's QA as a whole: recorded verdicts, G5's
// floors, distributions, docs/LIBRARY.md (`npm run qa -- library --check`, WP-5.8), within 8 min (PLAN.md §6).
// Naming tests (`npm run e2e -- <filter>`) runs those alone.
import { playwrightSummary, runTier } from "./tiers.ts";

const argv = process.argv.slice(2), filtered = argv.some((a) => !a.startsWith("--"));
runTier(
  {
    tool: "e2e",
    label: "T2",
    budgetMs: 8 * 60_000,
    steps: [
      { name: "playwright", cmd: "node_modules/.bin/playwright", args: ["test", ...argv.filter((a) => !a.startsWith("--"))], summarize: playwrightSummary },
      ...(filtered ? [] : [{ name: "library QA", cmd: process.execPath, args: ["tools/qa/main.ts", "library", "--check"], summarize: (out: string) => out.split("\n").find((l) => l.startsWith("qa:"))?.slice(4) }]),
    ],
    next: "push",
  },
  argv,
);
