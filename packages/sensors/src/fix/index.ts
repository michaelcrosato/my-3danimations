// Lint and fix (PLAN.md WP-3.5): the operators that repair a clip's keys (twist flips, jitter and pops, penetration,
// foot locks, a loop's seam, a re-fit to a budget), `tidy` that leaves a key as the format keeps it, `fix` that runs
// them with the metrics before and after each and reports every change, and `lint` that lists what it would change.
export { fix, lint, type FixReport, type FixStep, type Lint, type LintItem } from "./fix.ts";
export { FIXES, OPERATORS, twistFlips, jitter, penetration, footLocks, seam, refit, tidy, type FixName, type FixOptions, type Operator, type OpResult } from "./ops.ts";
