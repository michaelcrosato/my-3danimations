// `npm run corpora -- cmu --fetch | --survey [--check] | --import | --find WORD... | --ledger [WORD...]` and
// `npm run corpora -- 100style --fetch | --import [--check] [--only run,idle]` (PLAN.md WP-5.6): the large corpora on
// demand, into .cache/, never committed. `--fetch` downloads what the cache lacks, each file held to its lock in
// tools/corpora/; CMU's `--survey` converts every take and writes the ledger (tools/corpora/cmu-takes.tsv), or with
// `--check` regenerates it and compares byte for byte; CMU's `--import` writes every take as a set a subject
// (.cache/corpora/cmu); 100STYLE's `--import` cuts and fits the extras' six catalogs into sets (.cache/corpora/100style),
// with `--check` comparing each clip with shardfall's sets (the pinned source); `--find` and `--ledger` search CMU's
// index and ledger.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closest, finish, fmtMs, parseArgs, ROOT, usage, type Parsed, type Report, type Step } from "../run/cli.ts";
import { CMU_CACHE, fetchCmu, findTakes, LEDGER, ledgerText, queryLedger, readIndex, readLedger, readLock, survey, usedBy, type SubjectSet } from "./cmu.ts";
import { Archive, EXTRAS, fetch100style, import100, readStyles, STYLE100_CACHE, STYLE100_LOCK, STYLE100_OUT, type Style100Lock } from "./style100.ts";

const SPECS = [
  { name: "fetch", help: "download what the cache lacks, each file checked against the lock" },
  { name: "survey", help: "convert every take and write the ledger (fetching first if needed)" },
  { name: "check", help: "with cmu --survey: regenerate the ledger and compare it byte for byte, writing nothing; with 100style --import: compare each clip with shardfall's" },
  { name: "only", takesValue: true, help: "with 100style --import: only these catalogs (run,idle)" },
  { name: "import", help: "every take as a set a subject, into .cache/corpora/cmu" },
  { name: "find", help: "takes whose description has every word given" },
  { name: "ledger", help: "ledger rows matching every word given (a category or any word of the row)" },
  { name: "status", takesValue: true, help: "with --ledger: none, used, pick or skip" },
  { name: "top", takesValue: true, help: "with --find or --ledger: list at most this many" },
  { name: "subjects", takesValue: true, help: "with --survey or --import: only these subjects (5,13)" },
  { name: "tol", takesValue: true, help: "with --import: the fit's limit in mm (50)" },
  { name: "keep-zip", help: "with --fetch: keep the archive once unpacked" },
  { name: "dir", takesValue: true, help: "where the takes go (.cache/cmu)" },
];
const CORPORA = ["cmu", "100style"];

if (import.meta.main) {
  let parsed: Parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), SPECS);
    const c = parsed.positionals[0], verbs = ["fetch", "survey", "import", "find", "ledger"].filter((v) => parsed.flags[v]);
    if (!c || !CORPORA.includes(c)) throw new Error(`name a corpus: ${CORPORA.join(", ")}${c ? `; got "${c}", did you mean ${closest(c, CORPORA)}?` : ""}`);
    if (verbs.length !== 1) throw new Error(c === "cmu" ? "give one of --fetch, --survey, --import, --find, --ledger" : "give one of --fetch, --import");
    if (c === "100style" && !["fetch", "import"].includes(verbs[0]!)) throw new Error(`100style takes --fetch or --import, not --${verbs[0]}`);
    if (parsed.flags.check && !(c === "cmu" ? parsed.flags.survey : parsed.flags.import)) throw new Error(c === "cmu" ? "--check goes with --survey" : "--check goes with --import");
  } catch (err) {
    usage("corpora", err, SPECS);
  }
  finish(parsed.positionals[0] === "cmu" ? cmu(parsed) : style100(parsed), parsed);
}

/** Runs one verb on 100STYLE: fetch the archive, or import the extras' catalogs (compared with shardfall's sets). */
function style100(parsed: Parsed): Report {
  const t0 = performance.now(), steps: Step[] = [], warnings: string[] = [], log = (l: string) => process.stderr.write(`${l}\n`);
  const done = (ok: boolean, verdict: string, next: string): Report => ({ tool: "corpora", ok, verdict: `corpora 100style ${verdict} in ${fmtMs(performance.now() - t0)}`, steps, warnings, ms: performance.now() - t0, next });
  const lock = JSON.parse(readFileSync(STYLE100_LOCK, "utf8")) as Style100Lock, f = fetch100style(STYLE100_CACHE, lock, log);
  steps.push({ name: "fetch", ok: !f.problems.length, ms: performance.now() - t0, summary: f.problems.length ? "the archive isn't the one pinned" : `${f.file}, ${(lock.archive.bytes / 1e9).toFixed(2)} GB, its SHA-256 as pinned`, detail: f.problems });
  if (f.problems.length || parsed.flags.fetch) return done(!f.problems.length, `fetch: ${f.problems.length ? "FAIL" : "PASS"}`, f.problems.length ? "rerun; if it persists, the archive on Zenodo changed: check the lock" : "npm run corpora -- 100style --import");
  const archive = new Archive(f.file);
  try {
    const list = archive.text("100STYLE/Dataset_List.csv"), cuts = archive.text("100STYLE/Frame_Cuts.csv");
    if (list === null || cuts === null) throw new Error("the archive lacks 100STYLE/Dataset_List.csv or Frame_Cuts.csv");
    const styles = readStyles(list, cuts), only = typeof parsed.flags.only === "string" ? parsed.flags.only.split(",") : Object.keys(EXTRAS);
    mkdirSync(STYLE100_OUT, { recursive: true });
    let all = true;
    for (const kind of only) {
      if (!EXTRAS[kind]) throw new Error(`no catalog "${kind}": ${Object.keys(EXTRAS).join(", ")}`);
      const s0 = performance.now(), r = import100(kind, archive, styles), left = r.log.filter((l) => l.startsWith("left out "));
      writeFileSync(join(STYLE100_OUT, `${r.set.set}.json`), `${JSON.stringify(r.set)}\n`);
      const fits = r.report.clips, mean = fits.reduce((a, c) => a + c.mean, 0) / Math.max(1, fits.length), worst = fits.reduce((a, c) => Math.max(a, c.max), 0);
      warnings.push(...r.report.warnings.map((w) => `${kind}: ${w}`));
      const detail = left.map((l) => `${kind}: ${l}`);
      let ok = true, same = "";
      if (parsed.flags.check) {
        const c = compare(kind, r.set);
        ok = c.problems.length === 0;
        same = `; against shardfall's ${c.theirs} clips: ${c.sameTake} cut at the same stretch, ${c.sameKeys} with the same keys`;
        detail.push(...c.problems);
      }
      all &&= ok;
      steps.push({ name: kind, ok, ms: performance.now() - s0, summary: `${fits.length} clips into ${r.set.set} (mean ${mean.toFixed(1)} mm, worst ${worst.toFixed(0)} mm), ${r.report.skipped.length} skipped, ${left.length} left out${same}`, detail });
    }
    return done(all, `import${parsed.flags.check ? " --check" : ""}: ${all ? "PASS" : "FAIL"}`, all ? `the sets are in ${STYLE100_OUT}` : "find why a clip is cut or fitted differently from shardfall's (the cutter in packages/io/src/takes.ts, the BVH reader)");
  } finally {
    archive.close();
  }
}

/** A value as JSON with every object's fields in order (a key's fields come in either order). */
function canon(v: unknown): string {
  return JSON.stringify(v, (_, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
}

/** A set compared with shardfall's (the pinned source): every clip there, cut at the same stretch, with the same keys. */
function compare(kind: string, set: { clips: Record<string, { take?: string; keys: unknown[] }> }): { theirs: number; sameTake: number; sameKeys: number; problems: string[] } {
  const file = join(ROOT, `.cache/src/shardfall/anim/100style/style100_${kind}.json`);
  if (!existsSync(file)) return { theirs: 0, sameTake: 0, sameKeys: 0, problems: [`${file} is missing: npm run pins -- fetch`] };
  const theirs = (JSON.parse(readFileSync(file, "utf8")) as { clips: Record<string, { take?: string; keys: unknown[] }> }).clips, problems: string[] = [];
  let sameTake = 0, sameKeys = 0;
  for (const [name, c] of Object.entries(theirs)) {
    const mine = set.clips[name];
    if (!mine) {
      problems.push(`${kind}: ${name} is in shardfall's set, not here`);
      continue;
    }
    if (mine.take === c.take) sameTake++;
    else problems.push(`${kind}: ${name} cut at ${mine.take}; shardfall's at ${c.take}`);
    if (canon(mine.keys) === canon(c.keys)) sameKeys++;
    else problems.push(`${kind}: ${name}'s keys differ from shardfall's`);
  }
  for (const name of Object.keys(set.clips)) if (!theirs[name]) problems.push(`${kind}: ${name} is here, not in shardfall's set`);
  return { theirs: Object.keys(theirs).length, sameTake, sameKeys, problems };
}

/** Runs one verb on the CMU corpus. */
function cmu(parsed: Parsed): Report {
  const t0 = performance.now(), dir = typeof parsed.flags.dir === "string" ? parsed.flags.dir : CMU_CACHE, words = parsed.positionals.slice(1), steps: Step[] = [];
  const top = typeof parsed.flags.top === "string" ? +parsed.flags.top : Infinity, subjects = typeof parsed.flags.subjects === "string" ? parsed.flags.subjects.split(",").map(Number) : null;
  const log = (l: string) => process.stderr.write(`${l}\n`), lock = readLock(), done = (ok: boolean, verdict: string, next: string, warnings: string[] = []): Report => ({ tool: "corpora", ok, verdict: `corpora cmu ${verdict} in ${fmtMs(performance.now() - t0)}`, steps, warnings, ms: performance.now() - t0, next });
  if (parsed.flags.find || parsed.flags.ledger) {
    if (parsed.flags.find && !existsSync(join(dir, "index.tsv"))) fetchStep(dir, lock, false, log, steps);
    const lines = parsed.flags.find
      ? findTakes(readIndex(readFileSync(join(dir, "index.tsv"), "utf8")), words).map((t) => `${t.id}\t${t.fps} fps\t${t.desc}\t(${t.about})`)
      : queryLedger(readLedger(readFileSync(LEDGER, "utf8")), words, typeof parsed.flags.status === "string" ? parsed.flags.status : undefined).map((r) => [r.id, `${r.sec} s`, r.category, `active ${r.active}`, `fit ${r.fit}`, r.flags, r.used ? `USED: ${r.used}` : "", r.note, r.desc].filter(Boolean).join("\t"));
    process.stdout.write(lines.slice(0, top).map((l) => `${l}\n`).join(""));
    steps.push({ name: parsed.flags.find ? "find" : "ledger", ok: true, ms: performance.now() - t0, summary: `${lines.length} take(s)` });
    return done(true, `${parsed.flags.find ? "find" : "ledger"} ${words.join(" ")}: ${lines.length} take(s)`, "npm run corpora -- cmu --ledger <category> --status none: takes nobody has looked at yet");
  }
  const got = fetchStep(dir, lock, !!parsed.flags["keep-zip"], log, steps);
  if (!got.ok || parsed.flags.fetch) return done(got.ok, `fetch: ${got.ok ? "PASS" : "FAIL"}`, got.ok ? "npm run corpora -- cmu --survey --check" : "the site changed or a download broke: rerun; if it persists, check the lock against the site");
  const index = readIndex(readFileSync(join(dir, "index.tsv"), "utf8")), old = readLedger(existsSync(LEDGER) ? readFileSync(LEDGER, "utf8") : null), s0 = performance.now();
  if (parsed.flags.import) {
    const out = join(ROOT, ".cache/corpora/cmu"), tol = typeof parsed.flags.tol === "string" ? +parsed.flags.tol : 50, parts: Record<string, number> = {}, about: Record<number, string> = {};
    mkdirSync(out, { recursive: true });
    for (const t of index) about[t.subject] = t.about;
    let bytes = 0;
    const set = (s: SubjectSet) => {
      const text = `${JSON.stringify(s)}\n`;
      writeFileSync(join(out, `${s.set}.json`), text);
      bytes += text.length;
      for (const c of Object.values(s.clips)) parts[c.take.split(" ")[0]!] = (parts[c.take.split(" ")[0]!] ?? 0) + 1;
    };
    const r = survey(dir, index, { subjects, old, log, lib: { tol, set } });
    // the library's list: every take as [id, subject, category, seconds, description, parts]
    const takes = Object.entries(parts).map(([id, k]) => [id, +r.rows[id]!.subject!, r.rows[id]!.category!, +r.rows[id]!.sec!, r.rows[id]!.desc ?? "", k]);
    const subjectsOf = Object.fromEntries([...new Set(takes.map((t) => t[1] as number))].map((s) => [s, about[s] ?? ""]));
    writeFileSync(join(out, "index.json"), `${JSON.stringify({ tol, subjects: subjectsOf, takes })}\n`);
    steps.push({ name: "import", ok: true, ms: performance.now() - s0, summary: `${r.done} takes (${(r.secs / 3600).toFixed(1)} h of motion) into ${(bytes / 1e6).toFixed(1)} MB of sets in ${out}` });
    return done(true, "import: PASS", "each subject's takes are a format-1 set to browse; a set's clips are cut from takes the ledger picks (a catalog's $pick, WP-5.3)");
  }
  const r = survey(dir, index, { subjects, old, used: usedBy(), log }), text = ledgerText(r.rows), was = existsSync(LEDGER) ? readFileSync(LEDGER, "utf8") : "";
  const changed = Object.values(r.rows).filter((row) => ledgerText({ [row.id!]: row }) !== ledgerText(old[row.id!] ? { [row.id!]: old[row.id!]! } : {})).map((row) => row.id!);
  const same = text === was;
  if (parsed.flags.check) {
    steps.push({ name: "survey", ok: same, ms: performance.now() - s0, summary: same ? `${r.done} takes (${(r.secs / 3600).toFixed(1)} h) regenerate the ledger's ${Object.keys(r.rows).length} rows byte for byte` : `the ledger differs from the committed one${changed.length ? ` in ${changed.length} row(s)` : ""}`, detail: changed.length ? changed.slice(0, 40).map((id) => `${id}: ${measured(r.rows[id])} (was ${measured(old[id])})`) : same ? [] : ["the ledger's comment lines differ from the survey's (cmu.ts LEDGER_HEAD)"] });
    return done(same, `survey --check: ${same ? "PASS" : "FAIL"}`, same ? "npm run doctrine" : "find why the take converts differently (@m3a/io, core's fit); if the change is meant, npm run corpora -- cmu --survey and record why");
  }
  writeFileSync(LEDGER, text);
  steps.push({ name: "survey", ok: true, ms: performance.now() - s0, summary: `${r.done} takes (${(r.secs / 3600).toFixed(1)} h of motion); the ledger has ${Object.keys(r.rows).length} takes, ${same ? "unchanged" : `${changed.length} row(s) changed`}` });
  return done(true, "survey: PASS", "npm run corpora -- cmu --survey --check");
}

/** A row's measured columns, for a difference. */
function measured(r: Record<string, string> | undefined): string {
  return r ? [r.sec, r.category, r.active, r.fit, r.travel, r.hips, r.flags, r.used].join(" ") : "none";
}

/** Fetches what the cache lacks as a step. */
function fetchStep(dir: string, lock: ReturnType<typeof readLock>, keepZip: boolean, log: (l: string) => void, steps: Step[]): { ok: boolean } {
  const s0 = performance.now(), f = fetchCmu(dir, lock, { keepZip, log }), ok = f.problems.length === 0;
  steps.push({ name: "fetch", ok, ms: performance.now() - s0, summary: `${f.takes} takes in ${dir}${f.unpacked ? `, ${f.unpacked} files unpacked` : ""}${f.fetched.length ? `, ${f.fetched.length} fetched alone` : ""}`, detail: f.problems });
  return { ok };
}
