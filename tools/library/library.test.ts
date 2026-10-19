// `npm run library -- check --since <ref>` (PLAN.md WP-9.3): the lock's ids against the lock a git ref holds. The
// ref is a commit made in a scratch object store (GIT_OBJECT_DIRECTORY, the repository's own objects as alternates),
// so the test writes nothing into the repository: its lock holds one more clip than today's, which today's lock
// neither holds nor deprecates.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { LibraryLock } from "../../packages/library/src/index.ts";
import { ROOT } from "../run/cli.ts";
import { LOCK } from "./main.ts";

const scratch = mkdtempSync(join(tmpdir(), "m3a-ids-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const git = (args: string[], env: NodeJS.ProcessEnv = {}, input?: string) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env }, input }).trim();
const common = git(["rev-parse", "--git-common-dir"]);
const objects = { GIT_OBJECT_DIRECTORY: join(scratch, "objects"), GIT_ALTERNATE_OBJECT_DIRECTORIES: join(isAbsolute(common) ? common : join(ROOT, common), "objects") };
mkdirSync(objects.GIT_OBJECT_DIRECTORY);

/** A commit in the scratch store whose library/sets.lock.json is `lock`, the rest of its tree HEAD's. */
function commitWith(lock: LibraryLock): string {
  const index = { ...objects, GIT_INDEX_FILE: join(scratch, "index") };
  git(["read-tree", "HEAD"], index);
  const blob = git(["hash-object", "-w", "--stdin"], objects, `${JSON.stringify(lock, null, 1)}\n`);
  git(["update-index", "--cacheinfo", `100644,${blob},library/sets.lock.json`], index);
  return git(["commit-tree", git(["write-tree"], index), "-p", "HEAD", "-m", "a lock with one more clip"], { ...objects, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" });
}

const check = (ref: string) => {
  const r = spawnSync(process.execPath, ["tools/library/main.ts", "check", "--since", ref], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...objects } });
  return { status: r.status, out: r.stdout + r.stderr };
};

describe("library check --since", () => {
  it("passes against HEAD, fails on an id the ref's lock held that today's neither holds nor deprecates", () => {
    expect(check("HEAD")).toMatchObject({ status: 0 });
    const now = JSON.parse(readFileSync(LOCK, "utf8")) as LibraryLock, [set, s] = Object.entries(now.sets)[0]!;
    const before: LibraryLock = { ...now, sets: { ...now.sets, [set]: { ...s, files: { ...s.files, "Gone_Since_Then.json": "0".repeat(64) } } } };
    const r = check(commitWith(before));
    expect(r.status).toBe(1);
    expect(r.out).toContain(`dropped: ${set}/Gone_Since_Then is gone`);
  });

  it("fails closed on a ref it can't read", () => {
    const r = check("no-such-ref-m3a");
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/ids .*unreadable ref[\s\S]*can't read library\/sets\.lock\.json at no-such-ref-m3a/);
  });

  it("refuses --since on another verb", () => {
    const r = spawnSync(process.execPath, ["tools/library/main.ts", "lock", "--since", "HEAD"], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("--since is check's");
  });
});
