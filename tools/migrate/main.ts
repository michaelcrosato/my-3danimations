// `npm run migrate [-- --check]` (WP-1.5): the seed sets in format 2 under library/sets/, from the pinned sources
// (`npm run pins -- fetch` first). With no flag it writes them; --check rebuilds in memory and fails on any byte that
// differs, a stale file, a validator error, or a migrated key that differs from its source. The sets WP-5.3 re-imports
// (tools/import/sets.ts) are the import's: the migrator neither checks nor writes them. A clip the owner adopted from the
// intake queue is kept as adopted (its keys its own, not its source's, on the rest its set recorded: a source measured
// otherwise since fails the set), and a clip's review is carried while its motion hash matches
// (tools/migrate/adopted.ts).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { IMPORTS } from "../import/sets.ts";
import { migrate } from "./migrate.ts";
import { SETS } from "./sets.ts";

const DIR = join(ROOT, "library/sets");

/** Every file under library/sets/, relative to it. */
function existing(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(DIR, p).split("\\").join("/"));
    }
  };
  walk(DIR);
  return out.sort();
}

if (import.meta.main) {
  const specs = [{ name: "check", help: "rebuild in memory and compare byte for byte" }];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    if (parsed.positionals.length) throw new Error(`unexpected argument "${parsed.positionals[0]}"`);
  } catch (err) {
    usage("migrate", err, specs);
  }
  if (!existsSync(join(ROOT, ".cache/src/my-3d2dge/src/mocap/sets")) || !existsSync(join(ROOT, ".cache/src/shardfall/anim"))) {
    finish({ tool: "migrate", ok: false, verdict: "migrate: FAIL, the pinned sources are not in .cache/src/", steps: [], warnings: [], ms: 0, next: "npm run pins -- fetch, then rerun" }, parsed);
  }
  const t0 = performance.now();
  // the sets WP-5.3 re-imports are the import's (npm run import -- --check covers them, the clips it keeps as migrated
  // included); the migrator checks and writes the rest
  const reimported = new Set(IMPORTS.map((s) => s.set)), all = migrate(ROOT, { disk: { dir: DIR, sets: SETS.map((s) => s.set).filter((s) => !reimported.has(s)) } }), files = new Map([...all.files].filter(([p]) => !reimported.has(p.split("/")[0]!)));
  const { report, clips } = all;
  const steps: Step[] = [];
  for (const s of report.sets) {
    steps.push({ name: s.set, ok: s.errors.length === 0, ms: 0, summary: `${s.clips} clips, ${s.warnings} warnings baselined${s.unresolvedOrig.length ? `, ${s.unresolvedOrig.length} orig unresolved` : ""}${s.adopted.length ? `, ${s.adopted.length} kept as the owner adopted them` : ""}`, detail: [...s.errors, ...s.unresolvedOrig.map((u) => `orig not found in either Quaternius import: ${u}`), ...s.adopted.map((a) => `${a.id}: ${a.why}`)] });
  }
  // the migrated keys are the source's keys, number for number (an adopted clip's are its own)
  const keyDiffs: string[] = [], adopted = new Set(report.sets.flatMap((s) => s.adopted.map((a) => a.id)));
  for (const [id, { source, clip }] of clips) {
    if (adopted.has(id)) continue;
    clip.keys.forEach((k, i) => {
      const s = source.keys[i] as Record<string, unknown>;
      for (const [f, v] of Object.entries(s)) if (JSON.stringify(v) !== JSON.stringify((k as unknown as Record<string, unknown>)[f])) keyDiffs.push(`${id} key ${i + 1} ${f}`);
    });
    if (clip.keys.length !== source.keys.length) keyDiffs.push(`${id}: ${clip.keys.length} keys, source ${source.keys.length}`);
  }
  steps.push({ name: "keys", ok: keyDiffs.length === 0, ms: 0, summary: keyDiffs.length ? `${keyDiffs.length} differ` : `${clips.size - adopted.size} clips' keys equal their sources'${adopted.size ? ` (${adopted.size} adopted, their own)` : ""}`, detail: keyDiffs.slice(0, 20) });
  if (parsed.flags.check) {
    const problems: string[] = [];
    for (const [p, s] of files) {
      const f = join(DIR, p);
      if (!existsSync(f)) problems.push(`${p} is missing: run npm run migrate`);
      else if (readFileSync(f, "utf8") !== s) problems.push(`${p} differs from what the migrator writes`);
    }
    for (const p of existing()) if (!files.has(p) && !reimported.has(p.split("/")[0]!)) problems.push(`${p} is stale: no set writes it`);
    steps.push({ name: "compare", ok: problems.length === 0, ms: 0, summary: problems.length ? `${problems.length} file(s) differ` : `${files.size} files byte for byte`, detail: problems.slice(0, 20) });
  } else if (steps.every((s) => s.ok)) {
    for (const p of existing()) if (!files.has(p) && !reimported.has(p.split("/")[0]!)) rmSync(join(DIR, p));
    for (const [p, s] of files) {
      mkdirSync(dirname(join(DIR, p)), { recursive: true });
      writeFileSync(join(DIR, p), s);
    }
    steps.push({ name: "write", ok: true, ms: 0, summary: `library/sets/: ${files.size} files` });
  }
  const ms = performance.now() - t0;
  const ok = steps.every((s) => s.ok);
  const report2: Report = { tool: "migrate", ok, verdict: `migrate: ${ok ? "PASS" : "FAIL"}${parsed.flags.check ? " (--check)" : ""} in ${fmtMs(ms)}: ${clips.size} clips in ${report.sets.length} sets`, steps, warnings: [], ms, next: ok ? "npm test -- library/migrated" : "fix the listed problems; migrated sets change only with the migrator" };
  finish(report2, parsed);
}
