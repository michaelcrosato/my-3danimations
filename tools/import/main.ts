// `npm run import [-- --set NAME] [--check]` (PLAN.md WP-5.3): the sets tools/import/sets.ts names, re-imported from
// their sources (fetched into .cache/, each held to its lock) with format 2's hands, spine curl and root yaw, each clip
// kept in whichever version is better against its migrated one, with the reason in the set's `_import.json`. With no
// flag it writes library/sets/<SET>/ and locks the library (library/sets.lock.json); --check rebuilds in memory and fails
// on any byte that differs or any stale file. Either way it fails on a clip or set past the fit limits, a validator
// error, or a warning no baseline reason covers.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lockLibrary } from "../../packages/library/src/node.ts";
import type { LibraryLock } from "../../packages/library/src/index.ts";
import { closest, finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { importLibrary } from "./import.ts";
import { IMPORTS } from "./sets.ts";

const DIR = join(ROOT, "library/sets"), LOCK = join(ROOT, "library/sets.lock.json");

if (import.meta.main) {
  const specs = [
    { name: "set", takesValue: true, help: "only this set" },
    { name: "check", help: "rebuild in memory and compare with library/sets/, writing nothing" },
  ];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const names = IMPORTS.map((s) => s.set), want = parsed.flags.set;
    if (typeof want === "string" && !names.includes(want)) throw new Error(`no set "${want}" re-imports; did you mean ${closest(want, names)}? (${names.join(", ")})`);
  } catch (err) {
    usage("import", err, specs);
  }
  const t0 = performance.now(), only = typeof parsed.flags.set === "string" ? IMPORTS.filter((s) => s.set === parsed.flags.set) : IMPORTS;
  const sets = importLibrary(only), steps: Step[] = [], warnings: string[] = [];
  for (const s of sets) {
    const c = Object.values(s.choices), n = (k: string) => c.filter((x) => x.kept === k).length;
    warnings.push(...s.warnings.map((w) => `${s.set}: ${w}`));
    steps.push({ name: s.set, ok: s.errors.length === 0, ms: 0, summary: `${c.length} clips (${n("import")} re-imported, ${n("migrated")} kept as migrated, ${n("new")} new), ${s.mean.toFixed(1)} mm on average${s.props ? `; hands on the ${s.props.clips} clips that hold a prop ${s.props.migrated} → ${s.props.import} mm` : ""}; ${s.skipped.length} skipped${s.dropped.length ? `, ${s.dropped.length} gone: ${s.dropped.join(", ")}` : ""}`, detail: s.errors });
  }
  const ok = steps.every((s) => s.ok);
  if (parsed.flags.check) {
    const problems: string[] = [];
    for (const s of sets) {
      const dir = join(DIR, s.set);
      for (const [f, text] of s.files) {
        const at = join(dir, f);
        if (!existsSync(at)) problems.push(`${s.set}/${f} is missing: npm run import`);
        else if (readFileSync(at, "utf8") !== text) problems.push(`${s.set}/${f} differs from what the import writes`);
      }
      if (existsSync(dir)) for (const f of readdirSync(dir)) if (!s.files.has(f)) problems.push(`${s.set}/${f} is stale: the import doesn't write it`);
    }
    steps.push({ name: "compare", ok: problems.length === 0, ms: 0, summary: problems.length ? `${problems.length} file(s) differ` : `${sets.reduce((a, s) => a + s.files.size, 0)} files byte for byte`, detail: problems.slice(0, 20) });
  } else if (ok) {
    for (const s of sets) {
      const dir = join(DIR, s.set);
      mkdirSync(dir, { recursive: true });
      for (const f of readdirSync(dir)) if (!s.files.has(f)) rmSync(join(dir, f));
      for (const [f, text] of s.files) writeFileSync(join(dir, f), text);
    }
    const previous = existsSync(LOCK) ? (JSON.parse(readFileSync(LOCK, "utf8")) as LibraryLock) : undefined;
    writeFileSync(LOCK, `${JSON.stringify(lockLibrary(DIR, previous), null, 1)}\n`);
    steps.push({ name: "write", ok: true, ms: 0, summary: `${sets.length} set(s) written to library/sets/, the library locked` });
  }
  const ms = performance.now() - t0, all = steps.every((s) => s.ok);
  const report: Report = { tool: "import", ok: all, verdict: `import: ${all ? "PASS" : "FAIL"}${parsed.flags.check ? " (--check)" : ""} in ${fmtMs(ms)}: ${sets.length} set(s)`, steps, warnings, ms, next: all ? "npm run qa -- library, then npm test -- library" : "fix each listed problem: a clip past the limits gets a reason in its catalog's $skip, or a fix" };
  finish(report, parsed);
}
