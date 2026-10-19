// `npm run license -- check <library | SET | game.json>` (PLAN.md WP-5.7; the CLI's `m3a license.check`):
// every set, one set, or a game manifest checked against the library's terms (packages/library/src/license). It fails
// on a source without an SPDX id, a license that doesn't fit its set's tier, a license text not kept in
// library/LICENSES/, a credited set without its credit, a clip from a tier the game didn't opt into, and local content
// in a shipped game; it warns on an open license question; and it prints the credits block the game shows.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkGame, checkSets, type GameManifest } from "../../packages/library/src/index.ts";
import { directory, licenseText } from "../../packages/library/src/node.ts";
import { closest, finish, fmtMs, parseArgs, ROOT, usage, type Report } from "../run/cli.ts";

if (import.meta.main) {
  const verbs = ["check"];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), []);
    const v = parsed.positionals[0];
    if (!v || !verbs.includes(v)) throw new Error(`expected one of ${verbs.join(", ")}${v ? `, got "${v}"; did you mean ${closest(v, verbs)}?` : ""}`);
    if (!parsed.positionals[1]) throw new Error("name what to check: library (every set), a set, or a game manifest (.json)");
  } catch (err) {
    usage("license", err, []);
  }
  const what = parsed.positionals[1]!, t0 = performance.now(), dir = join(ROOT, "library/sets"), src = directory(dir), text = licenseText(dir);
  const sets = src.sets().sort();
  if (what !== "library" && !what.endsWith(".json") && !sets.includes(what)) usage("license", new Error(`no set "${what}"; did you mean ${closest(what, sets)}? (or library, or a game manifest .json)`), []);
  const r = what === "library" ? checkSets(src, sets, text) : what.endsWith(".json") ? checkGame(src, readGame(what), text) : checkSets(src, [what], text);
  const ms = performance.now() - t0, fails = r.findings.filter((f) => f.level === "fail"), warns = r.findings.filter((f) => f.level === "warn");
  const report: Report = {
    tool: "license",
    ok: r.ok,
    verdict: `license check ${what}: ${r.ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`,
    steps: [
      { name: "terms", ok: fails.length === 0, ms, summary: `${fails.length} failing, ${warns.length} open question(s)`, detail: fails.map((f) => `${f.where}: ${f.message}`) },
      { name: "credits", ok: true, ms: 0, summary: r.credits.length ? `${r.credits.length} set(s) to credit` : "no credit owed", detail: r.block.split("\n") },
    ],
    warnings: warns.map((f) => `${f.where}: ${f.message}`),
    ms,
    next: r.ok ? `show this block where the game credits its assets:\n${r.block.split("\n").map((l) => `  ${l}`).join("\n")}` : "fix each listed set or clip (a set's terms live in its _set.json; texts in library/LICENSES/)",
  };
  finish(report, parsed);
}

/** A game manifest from its file. */
function readGame(file: string): GameManifest {
  const path = resolve(file);
  if (!existsSync(path)) usage("license", new Error(`no game manifest at ${path}`), []);
  return JSON.parse(readFileSync(path, "utf8")) as GameManifest;
}
