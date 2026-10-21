// The cloud SessionStart hook's install step (.claude/hooks/session-start.sh, WP-F.1, D121): `npm ci` deletes
// node_modules before it installs, and the hook runs again on every resume, /clear and /compact while the m3a MCP
// server starts beside it, so it installs only when node_modules wasn't installed from this package-lock.json on this
// Node (its package.json files too, which npm ci holds the lockfile to). Run on a scratch project with a stand-in npm
// that logs its calls: a first run installs and stamps; a second skips; a changed lockfile or package.json, another
// Node's stamp or no node_modules install again; a failed install leaves no stamp.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const HOOK = resolve(import.meta.dirname, "../../.claude/hooks/session-start.sh");
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "m3a-session-start-"));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ engines: { node: ">=24.2" } }));
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  mkdirSync(join(dir, "packages/a"), { recursive: true });
  writeFileSync(join(dir, "packages/a/package.json"), JSON.stringify({ name: "a" }));
  // npm ci as npm does it: node_modules deleted, then made again (or a failure when NPM_FAIL is set)
  const npm = join(dir, "bin/npm");
  writeFileSync(npm, '#!/bin/sh\necho "$*" >> "$NPM_LOG"\nif [ "$1" = ci ]; then\n  [ -n "$NPM_FAIL" ] && exit 1\n  rm -rf node_modules && mkdir node_modules\nfi\nexit 0\n');
  chmodSync(npm, 0o755);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Runs the hook in the scratch project; resolves to its exit status, its output and the npm commands it ran. */
function hook(env: Record<string, string> = {}): { status: number | null; out: string; npm: string[] } {
  const log = join(dir, "npm.log");
  rmSync(log, { force: true });
  const r = spawnSync("bash", [HOOK], {
    encoding: "utf8",
    env: { PATH: `${join(dir, "bin")}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: dir, CLAUDE_CODE_REMOTE: "true", CLAUDE_PROJECT_DIR: dir, CLAUDE_ENV_FILE: join(dir, "env"), NPM_LOG: log, ...env },
  });
  return { status: r.status, out: r.stdout + r.stderr, npm: existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [] };
}

const installs = (npm: string[]) => npm.filter((c) => c.startsWith("ci ")).length;

describe("the SessionStart hook's install", () => {
  it("installs on a first run and stamps the lockfile's hash and the Node", () => {
    const r = hook();
    expect(r.status, r.out).toBe(0);
    expect(installs(r.npm)).toBe(1);
    expect(readFileSync(join(dir, "node_modules/.m3a-installed"), "utf8")).toMatch(new RegExp(`^[0-9a-f]{64} ${process.version.replace(/\./g, "\\.")}\\n$`));
  });

  it("skips npm ci when node_modules was installed from this lockfile on this Node, and still fetches the fixtures", () => {
    hook();
    const r = hook();
    expect(r.status, r.out).toBe(0);
    expect(installs(r.npm)).toBe(0);
    expect(r.out).toContain("npm ci skipped");
    expect(r.npm.some((c) => c.includes("fixtures -- fetch"))).toBe(true);
  });

  it("installs again when the lockfile or a package.json changed, the stamp names another Node, or node_modules is gone", () => {
    hook();
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {} } }));
    expect(installs(hook().npm)).toBe(1);
    // a dependency a workspace gained that the lockfile lacks: npm ci, not the stamp, says so
    writeFileSync(join(dir, "packages/a/package.json"), JSON.stringify({ name: "a", dependencies: { b: "1.0.0" } }));
    expect(installs(hook().npm)).toBe(1);
    expect(installs(hook().npm)).toBe(0);
    const stamp = join(dir, "node_modules/.m3a-installed");
    writeFileSync(stamp, readFileSync(stamp, "utf8").replace(/ v\S+/, " v22.22.0"));
    expect(installs(hook().npm)).toBe(1);
    rmSync(join(dir, "node_modules"), { recursive: true });
    expect(installs(hook().npm)).toBe(1);
  });

  it("fails on a failed install and leaves no stamp, so the next run installs", () => {
    const r = hook({ NPM_FAIL: "1" });
    expect(r.status).not.toBe(0);
    expect(existsSync(join(dir, "node_modules/.m3a-installed"))).toBe(false);
    expect(installs(hook().npm)).toBe(1);
  });
});
