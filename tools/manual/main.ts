// The manual's tool list, rewritten or checked (PLAN.md §6 "Docs drift", WP-7.3):
//   node tools/manual/main.ts           rewrite the list between the markers in packages/tools/MANUAL.md
//   node tools/manual/main.ts --check   exit 1 when the list differs from the registry's tools
// packages/tools/test/manual.test.ts runs the same check in T1.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "../../packages/tools/src/tools/index.ts";
import { withToolList } from "./toollist.ts";

/** The manual's path. */
export const MANUAL = join(import.meta.dirname, "../../packages/tools/MANUAL.md");

if (import.meta.main) {
  const check = process.argv.includes("--check"), odd = process.argv.slice(2).find((a) => a !== "--check");
  if (odd !== undefined) {
    console.log(`manual: usage error: unknown argument "${odd}"\nnext: node tools/manual/main.ts [--check]`);
    process.exit(2);
  }
  const now = readFileSync(MANUAL, "utf8"), want = withToolList(now, TOOLS);
  if (check) {
    console.log(now === want ? `manual: PASS, the tool list matches the registry's ${TOOLS.length} tools` : "manual: FAIL, the tool list differs from the registry\nnext: node tools/manual/main.ts rewrites it");
    process.exit(now === want ? 0 : 1);
  }
  if (now !== want) writeFileSync(MANUAL, want);
  console.log(`manual: ${now === want ? "the tool list was current" : "rewrote the tool list"} (${TOOLS.length} tools)`);
}
