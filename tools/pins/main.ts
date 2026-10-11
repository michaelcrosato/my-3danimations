// `npm run pins -- fetch | check | freeze` (WP-0.4): the pinned source repositories of tools/pins.json.
//   fetch   shallow-fetch each repo at its full SHA into .cache/src/<repo>/ (skipped when already there), then check
//   check   every repo is in the cache at its SHA with its listed files, and every frozen fixture matches its SHA-256
//   freeze  copy a missing frozen fixture from its repo in the cache (never overwrites one)
// Anonymous HTTPS works in cloud sessions and in CI; only the vectors' --check regeneration needs the network.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import type { Pins } from "../doctrine/pins.ts";

const CACHE = join(ROOT, ".cache/src");
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The SHA checked out in a cached repo, or null. */
export function cachedSha(repo: string): string | null {
  const dir = join(CACHE, repo);
  if (!existsSync(join(dir, ".git"))) return null;
  try {
    return git(dir, "rev-parse", "HEAD");
  } catch {
    return null;
  }
}

/** Shallow-fetch one repo at its SHA into the cache, replacing whatever was there. */
function fetchRepo(repo: string, url: string, sha: string): void {
  const dir = join(CACHE, repo);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q");
  git(dir, "fetch", "-q", "--depth", "1", url, sha);
  git(dir, "-c", "advice.detachedHead=false", "checkout", "-q", "FETCH_HEAD");
}

/** Problems with the cache and the frozen fixtures, one line each. */
function check(pins: Pins): string[] {
  const problems: string[] = [];
  for (const [repo, r] of Object.entries(pins.repos)) {
    const sha = cachedSha(repo);
    if (sha !== r.sha) {
      problems.push(`${repo}: ${sha ? `cached at ${sha.slice(0, 12)}` : "not cached"}, pinned at ${r.sha.slice(0, 12)}: npm run pins -- fetch`);
      continue;
    }
    for (const f of r.files ?? []) if (!existsSync(join(CACHE, repo, f))) problems.push(`${repo}: ${f} is listed but not in the pinned commit`);
  }
  for (const fz of pins.frozen ?? []) {
    const p = join(ROOT, fz.path);
    if (!existsSync(p)) problems.push(`${fz.path} is missing: npm run pins -- freeze`);
    else if (createHash("sha256").update(readFileSync(p)).digest("hex") !== fz.sha256) problems.push(`${fz.path} does not match its SHA-256: frozen fixtures are never edited`);
  }
  return problems;
}

if (import.meta.main) {
  const specs = [{ name: "only", takesValue: true, help: "fetch one repo by name" }];
  let parsed;
  const verbs = ["fetch", "check", "freeze"];
  try {
    parsed = parseArgs(process.argv.slice(2), specs);
    const v = parsed.positionals[0];
    if (!v || !verbs.includes(v)) throw new Error(`expected one of ${verbs.join(", ")}${v ? `, got "${v}"` : ""}`);
  } catch (err) {
    usage("pins", err, specs);
  }
  const verb = parsed.positionals[0]!;
  const pins = JSON.parse(readFileSync(join(ROOT, "tools/pins.json"), "utf8")) as Pins;
  const t0 = performance.now();
  const steps: Step[] = [];
  if (verb === "fetch") {
    for (const [repo, r] of Object.entries(pins.repos)) {
      if (parsed.flags.only && parsed.flags.only !== repo) continue;
      const s0 = performance.now();
      if (cachedSha(repo) === r.sha) {
        steps.push({ name: repo, ok: true, ms: 0, summary: `cached at ${r.sha.slice(0, 12)}` });
        continue;
      }
      try {
        fetchRepo(repo, r.url, r.sha);
        steps.push({ name: repo, ok: true, ms: performance.now() - s0, summary: `fetched ${r.sha.slice(0, 12)}` });
      } catch (err) {
        steps.push({ name: repo, ok: false, ms: performance.now() - s0, summary: "fetch failed", detail: [String((err as Error).message).split("\n")[0]!] });
      }
    }
  }
  if (verb === "freeze") {
    for (const fz of pins.frozen ?? []) {
      const p = join(ROOT, fz.path);
      if (existsSync(p)) {
        steps.push({ name: fz.path, ok: true, ms: 0, summary: "present (never overwritten)" });
        continue;
      }
      const [repo, ...rest] = fz.from.split(" ");
      const src = join(CACHE, repo!, rest[0]!);
      mkdirSync(dirname(p), { recursive: true });
      copyFileSync(src, p);
      steps.push({ name: fz.path, ok: true, ms: 0, summary: `copied from ${repo}` });
    }
  }
  const problems = check(pins);
  steps.push({ name: "check", ok: problems.length === 0, ms: 0, summary: problems.length ? `${problems.length} problem(s)` : `${Object.keys(pins.repos).length} repos at their SHAs, ${(pins.frozen ?? []).length} frozen fixtures match`, detail: problems });
  const ms = performance.now() - t0;
  const ok = steps.every((s) => s.ok);
  const report: Report = { tool: "pins", ok, verdict: `pins ${verb}: ${ok ? "PASS" : "FAIL"} in ${fmtMs(ms)}`, steps, warnings: [], ms, next: ok ? "npm run vectors -- --check" : "fix the listed problems, then rerun" };
  finish(report, parsed);
}
