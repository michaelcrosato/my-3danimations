// `npm run library -- lock | check [--since <ref>] | list [--tiers cc0,cc-by,...]` (PLAN.md WP-5.1): `lock` writes
// library/sets.lock.json (each set's content id and each clip file's SHA-256); `check` loads every set, in every tier,
// and verifies its files against its manifest and the lock, naming each file that changed, then the lock's ids
// (WP-9.3's checkIds: every deprecated id leads to a clip that stands, and with `--since`, no id the lock at that git
// ref held is gone, deleted or given to another clip; a ref it can't read fails the check); `list` lists the sets a
// game sees under the tiers given (CC0 alone by default, D10).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkIds, LibraryError, TIERS, type LibraryLock, type Tier } from "../../packages/library/src/index.ts";
import { lockLibrary, openLibrary } from "../../packages/library/src/node.ts";
import { closest, finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";

/** The repository's lock file. */
export const LOCK = join(ROOT, "library/sets.lock.json");

/** The lock as git ref `ref` holds it; an unreadable ref or lock throws, so a check against it fails closed. */
function lockAt(ref: string): LibraryLock {
  let text: string;
  try {
    text = execFileSync("git", ["show", `${ref}:library/sets.lock.json`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
  } catch (err) {
    throw new Error(`can't read library/sets.lock.json at ${ref} (${String((err as { stderr?: string }).stderr ?? err).trim().split("\n")[0]}): fetch it (git fetch origin) or name a ref that holds it`, { cause: err });
  }
  return JSON.parse(text) as LibraryLock;
}

if (import.meta.main) {
  const specs = [
    { name: "tiers", takesValue: true, help: "the tiers a game opts in to, comma-separated (cc0 alone by default)" },
    { name: "since", takesValue: true, help: "check: the git ref whose lock no id may be dropped from or reused against (e.g. origin/main)" },
  ];
  const verbs = ["lock", "check", "list"];
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const v = parsed.positionals[0];
    if (!v || !verbs.includes(v)) throw new Error(`expected one of ${verbs.join(", ")}${v ? `, got "${v}"; did you mean ${closest(v, verbs)}?` : ""}`);
    if (parsed.flags.since !== undefined && v !== "check") throw new Error("--since is check's");
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
      const t1 = performance.now(), since = typeof parsed.flags.since === "string" ? parsed.flags.since : undefined;
      let previous: LibraryLock | undefined, unread: string | undefined;
      try {
        previous = since === undefined ? undefined : lockAt(since);
      } catch (err) {
        unread = (err as Error).message;
      }
      const lock = JSON.parse(readFileSync(LOCK, "utf8")) as LibraryLock, problems = unread === undefined ? checkIds(lock, previous).map((p) => `${p.code}: ${p.message}`) : [unread];
      const ids = Object.values(lock.sets).reduce((a, s) => a + Object.keys(s.files).length, 0), aliases = Object.keys(lock.aliases ?? {}).length;
      steps.push({ name: "ids", ok: problems.length === 0, ms: performance.now() - t1, summary: unread !== undefined ? "unreadable ref" : problems.length ? `${problems.length} id problems` : `${ids} ids and ${aliases} deprecated: every one resolves${since === undefined ? "" : `, none of ${since}'s dropped or reused`}`, detail: problems });
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
