// T0, `npm run check`: typecheck, lint, source headers and versions, within 15 s (PLAN.md §6).
import { runTier, t0Steps } from "./tiers.ts";

runTier({ tool: "check", label: "T0", budgetMs: 15_000, steps: t0Steps(), next: "npm test" }, process.argv.slice(2));
