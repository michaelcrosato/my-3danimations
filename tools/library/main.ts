// `npm run library -- lock | check | list [--tiers cc0,cc-by,...]` (PLAN.md WP-5.1): `lock` writes
// library/sets.lock.json (each set's content id and each clip file's SHA-256); `check` loads every set, in every tier,
// and verifies its files against its manifest and the lock, naming each file that changed; `list` lists the sets a game
// sees under the tiers given (CC0 alone by default, D10).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LibraryError, TIERS, type LibraryLock, type Tier } from "../../packages/library/src/index.ts";
import { lockLibrary, openLibrary } from "../../packages/library/src/node.ts";
import { closest, finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";

/** The repository's lock file. */
export const LOCK = join(ROOT, "library/sets.lock.json");

if (import.meta.main) {
  const specs = [{ name: "tiers", takesValue: true, help: "the tiers a game opts in to, comma-separated (cc0 alone by default)" }];
  const verbs = ["lock", "check", "list"];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const v = parsed.positionals[0];
    if (!v || !verbs.includes(v)) throw new Error(`expected one of ${verbs.join(", ")}${v ? `, got "${v}"; did you mean ${closest(v, verbs)}?` : ""}`);
  } catch (err) {
    usage("library", err, specs);
  }
  const verb = parsed.positionals[0]!, t0 = performance.now(), steps: Step[] = [], dir = join(ROOT, "library/sets");
  const tiers = (typeof parsed.flags.tiers === "string" ? parsed.flags.tiers.split(",") : ["cc0"]) as Tier[];
  try {
    if (verb === "lock") {
      const previous = existsSync(LOCK) ? (JSON.parse(readFileSync(LOCK, "utf8")) as LibraryLock) : undefined, lock = lockLibrary(dir, previous);
      writeFileSync(LOCK, `${JSON.stringify(lock, null, 1)}\n`);
      steps.push({ name: "lock", ok: true, ms: performance.now() - t0, summary: `${Object.keys(lock.sets).length} sets, ${Object.values(lock.sets).reduce((a, s) => a + Object.keys(s.files).length, 0)} clip files locked in library/sets.lock.json` });
    } else if (verb === "check") {
      const lib = openLibrary({ dir, tiers: TIERS }), sets = lib.sets();
      lib.verify();
      steps.push({ name: "check", ok: true, ms: performance.now() - t0, summary: `${sets.length} sets, ${sets.reduce((a, s) => a + s.clips, 0)} clips: every content id and every file as locked` });
    } else {
      const lib = openLibrary({ dir, tiers }), sets = lib.sets();
      steps.push({ name: "list", ok: true, ms: performance.now() - t0, summary: `${sets.length} sets under ${tiers.join(", ")}, ${sets.reduce((a, s) => a + s.clips, 0)} clips`, detail: sets.map((s) => `${s.set} (${s.tier}, ${s.clips} clips): ${s.title}`) });
    }
  } catch (err) {
    steps.push({ name: verb, ok: false, ms: performance.now() - t0, summary: err instanceof LibraryError ? err.code : "error", detail: [String((err as Error).message)] });
  }
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok);
  const report: Report = { tool: "library", ok, verdict: `library ${verb}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps, warnings: [], ms, next: ok ? "npm test -- library/load" : "restore the named files, or write them through the library's writer and lock again (npm run library -- lock)" };
  finish(report, parsed);
}
