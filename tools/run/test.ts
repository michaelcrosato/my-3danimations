// T1, `npm test [-- <path filters>] [--shard k/n]`: unit, conformance and tool tests under Vitest, within 90 s (PLAN.md
// §6). Positional arguments filter test files by path, as Vitest does (`npm test -- tools/doctrine`); `--shard k/n`
// runs the k-th of n parts of its files, as CI runs T1: two jobs side by side, 1/2 and 2/2 (WP-F.15, D148).
import { parseArgs, usage, UsageError, type FlagSpec } from "./cli.ts";
import { runTier, vitestSummary } from "./tiers.ts";

/** T1's flags, beside every tool's `--json` and `--verbose`. */
export const T1_FLAGS: FlagSpec[] = [
  { name: "update", help: "update snapshots (vitest -u)" },
  { name: "grep", takesValue: true, help: "only tests whose name matches (vitest -t)" },
  { name: "shard", takesValue: true, help: "only the k-th of n parts of T1's files, as k/n (vitest --shard): CI runs 1/2 and 2/2 side by side" },
];

/**
 * Vitest's arguments for T1's command line, and the tier's label: `T1`, or `T1 k/n` for a part. A shard that isn't k/n
 * with 1 <= k <= n is a usage error.
 */
export function t1Run(argv: readonly string[]): { args: string[]; label: string } {
  const p = parseArgs(argv, T1_FLAGS), shard = typeof p.flags.shard === "string" ? p.flags.shard : undefined;
  const m = shard === undefined ? undefined : /^([1-9]\d*)\/([1-9]\d*)$/.exec(shard);
  if (shard !== undefined && (!m || +m[1]! > +m[2]!)) throw new UsageError(`--shard takes k/n with 1 <= k <= n, as 1/2; got "${shard}"`);
  return {
    args: ["run", ...p.positionals, ...(p.flags.update ? ["-u"] : []), ...(typeof p.flags.grep === "string" ? ["-t", p.flags.grep] : []), ...(shard ? [`--shard=${shard}`] : [])],
    label: shard ? `T1 ${shard}` : "T1",
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  let run: ReturnType<typeof t1Run>;
  try {
    run = t1Run(argv);
  } catch (err) {
    usage("test", err, T1_FLAGS);
  }
  await runTier(
    { tool: "test", label: run.label, budgetMs: 90_000, steps: [{ name: "vitest", cmd: "node_modules/.bin/vitest", args: run.args, summarize: vitestSummary }], next: "npm run e2e before pushing" },
    argv,
    T1_FLAGS,
  );
}
