// T2, `npm run e2e`: browser adapter checks under Playwright on the preinstalled Chromium, within 8 min (PLAN.md §6).
// Later WPs add the full library QA here.
import { playwrightSummary, runTier } from "./tiers.ts";

const argv = process.argv.slice(2);
runTier(
  {
    tool: "e2e",
    label: "T2",
    budgetMs: 8 * 60_000,
    steps: [{ name: "playwright", cmd: "node_modules/.bin/playwright", args: ["test", ...argv.filter((a) => !a.startsWith("--"))], summarize: playwrightSummary }],
    next: "push",
  },
  argv,
);
