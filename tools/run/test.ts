// T1, `npm test [-- <path filters>]`: unit, conformance and tool tests under Vitest, within 90 s (PLAN.md §6).
// Positional arguments filter test files by path, as Vitest does (`npm test -- tools/doctrine`).
import { parseArgs } from "./cli.ts";
import { runTier, vitestSummary } from "./tiers.ts";

const argv = process.argv.slice(2);
const flags = [
  { name: "update", help: "update snapshots (vitest -u)" },
  { name: "grep", takesValue: true, help: "only tests whose name matches (vitest -t)" },
];
let vitestArgs: string[] = ["run"];
try {
  const p = parseArgs(argv, flags);
  vitestArgs = ["run", ...p.positionals, ...(p.flags.update ? ["-u"] : []), ...(typeof p.flags.grep === "string" ? ["-t", p.flags.grep] : [])];
} catch {
  // runTier reports the usage error.
}
await runTier(
  { tool: "test", label: "T1", budgetMs: 90_000, steps: [{ name: "vitest", cmd: "node_modules/.bin/vitest", args: vitestArgs, summarize: vitestSummary }], next: "npm run e2e before pushing" },
  argv,
  flags,
);
