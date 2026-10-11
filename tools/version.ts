// One version for every package and the spec (PLAN.md §8.3 item 9; WP-0.2).
//   node tools/version.ts X.Y.Z | minor | patch   write the version everywhere and open a CHANGELOG.md section
//   node tools/version.ts --check                 fail when any place disagrees or the changelog has no section
// While the major number is 0: minor for features, patch for fixes. The places are listed in PLACES; a WP that
// adds a place where the version lives (the spec, a manual) appends it there.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

/** A text file holding the version, found and replaced by a regex whose first group is the version. */
export interface Place {
  path: string;
  pattern: RegExp;
}

/** Text places outside package.json files. */
export const PLACES: Place[] = [{ path: "packages/core/src/version.ts", pattern: /export const VERSION = "(\d+\.\d+\.\d+)";/ }];

/** The workspace package.json paths, relative to the root. */
export function packageJsons(root: string = ROOT): string[] {
  const dirs = readdirSync(join(root, "packages")).filter((d) => existsSync(join(root, "packages", d, "package.json")));
  return ["package.json", ...dirs.sort().map((d) => `packages/${d}/package.json`)];
}

/** Next version from the current one and an argument: an explicit X.Y.Z, `minor` or `patch`. */
export function bump(current: string, arg: string): string {
  if (SEMVER.test(arg)) return arg;
  const [maj, min, pat] = current.split(".").map(Number) as [number, number, number];
  if (arg === "minor") return `${maj}.${min + 1}.0`;
  if (arg === "patch") return `${maj}.${min}.${pat + 1}`;
  throw new Error(`expected X.Y.Z, minor or patch, got "${arg}"`);
}

/** Every disagreement with the root package.json version, as readable lines. */
export function check(root: string = ROOT): string[] {
  const want = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  const problems: string[] = [];
  for (const p of packageJsons(root)) {
    const pkg = JSON.parse(readFileSync(join(root, p), "utf8")) as { version: string; dependencies?: Record<string, string> };
    if (pkg.version !== want) problems.push(`${p}: version ${pkg.version}, want ${want}`);
    for (const [dep, v] of Object.entries(pkg.dependencies ?? {})) {
      if (dep.startsWith("@m3a/") && v !== want) problems.push(`${p}: dependency ${dep}@${v}, want ${want}`);
    }
  }
  for (const place of PLACES) {
    const m = place.pattern.exec(readFileSync(join(root, place.path), "utf8"));
    if (!m) problems.push(`${place.path}: no version found`);
    else if (m[1] !== want) problems.push(`${place.path}: version ${m[1]}, want ${want}`);
  }
  const log = existsSync(join(root, "CHANGELOG.md")) ? readFileSync(join(root, "CHANGELOG.md"), "utf8") : "";
  if (!new RegExp(`^## ${want.replace(/\./g, "\\.")} `, "m").test(log)) problems.push(`CHANGELOG.md: no section "## ${want} · <date>"`);
  return problems;
}

/** Write `version` into every place and open its changelog section dated `date` (YYYY-MM-DD). */
export function write(version: string, date: string, root: string = ROOT): void {
  for (const p of packageJsons(root)) {
    const file = join(root, p);
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { version: string; dependencies?: Record<string, string> };
    pkg.version = version;
    for (const dep of Object.keys(pkg.dependencies ?? {})) if (dep.startsWith("@m3a/")) pkg.dependencies![dep] = version;
    writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  }
  for (const place of PLACES) {
    const file = join(root, place.path);
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.replace(place.pattern, (whole, old: string) => whole.replace(old, version)));
  }
  const logPath = join(root, "CHANGELOG.md");
  const log = readFileSync(logPath, "utf8");
  if (!log.includes(`## ${version} `)) {
    const at = log.search(/^## /m);
    const section = `## ${version} · ${date}\n\n`;
    writeFileSync(logPath, at < 0 ? `${log.trimEnd()}\n\n${section}` : log.slice(0, at) + section + log.slice(at));
  }
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (arg === "--check") {
    const problems = check();
    if (problems.length) {
      process.stdout.write(`version: ${problems.length} disagreement(s)\n${problems.join("\n")}\nnext: node tools/version.ts <the version> to rewrite every place\n`);
      process.exit(1);
    }
    process.stdout.write("version: ok\n");
  } else if (arg && !arg.startsWith("--")) {
    const current = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version;
    let next: string;
    try {
      next = bump(current, arg);
    } catch (err) {
      process.stdout.write(`version: usage error: ${(err as Error).message}\nnext: node tools/version.ts X.Y.Z | minor | patch | --check\n`);
      process.exit(2);
    }
    write(next, new Date().toISOString().slice(0, 10));
    execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "ignore" });
    process.stdout.write(`version: ${current} -> ${next}; CHANGELOG.md has a section to fill\nnext: add one line per change under ## ${next}\n`);
  } else {
    process.stdout.write("version: usage error: expected X.Y.Z, minor, patch or --check\nnext: node tools/version.ts minor\n");
    process.exit(2);
  }
}
