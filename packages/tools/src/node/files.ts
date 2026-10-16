// Where the Node host may read and write (PLAN.md WP-7.2, decision §8.3): reads under the working directory, writes
// only under its write roots (workshop/, .m3a/, imports/, check-output/: never library/), each checked by its name and
// by its real path, so no link leads out; every write atomic; and lock files, taken exclusively, so two m3a processes
// never write one clip at once. The host's own files (images, report.json, request records) go through the same checks
// as a tool's. A refusal names the working directory, never its absolute path.
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ToolError } from "../registry/registry.ts";
import { quote } from "../registry/schema.ts";

/** Where m3a writes in a project, under the working directory: its edited clips, its own state, imported sets and its
 *  check output. Nothing else, and never library/. */
export const WRITE_ROOTS: readonly string[] = ["workshop", ".m3a", "imports", "check-output"];

const inside = (base: string, p: string) => {
  const up = relative(base, p);
  return up !== ".." && !up.startsWith(`..${sep}`) && !isAbsolute(up);
};

/** A filesystem error's code (ENOENT, EACCES ...), or "unreadable". */
export const errno = (err: unknown): string => (err as NodeJS.ErrnoException).code ?? "unreadable";

/** The real path of `p`, or of its nearest existing ancestor when it isn't there yet; E_PATH when a link can't be followed. */
function real(p: string, path: string): string {
  for (let q = p; ; q = dirname(q)) {
    try {
      return realpathSync(q);
    } catch (err) {
      const missing = errno(err) === "ENOENT" || errno(err) === "ENOTDIR";
      if (!missing || dirname(q) === q) throw new ToolError("E_PATH", `can't follow ${quote(path)} (${errno(err)})`, true);
    }
  }
}

/** `path` resolved under `cwd` (absolute), refused (E_PATH) when it is empty or outside, by its name or through a link;
 *  `to` says what to do instead. */
export function under(cwd: string, path: string, to: string): string {
  const p = resolve(cwd, path);
  if (!path.trim() || !inside(cwd, p)) throw new ToolError("E_PATH", `${path.trim() ? `${quote(path)} is outside the working directory` : "the path is empty"}; ${to}`, true);
  if (!inside(realpathSync(cwd), real(p, path))) throw new ToolError("E_PATH", `${quote(path)} leads out of the working directory through a link; ${to}`, true);
  return p;
}

/** `path` resolved under one of `cwd`'s write roots, refused (E_PATH) elsewhere, at a root itself, or through a link out
 *  of its root (a root that is a link counts as one, wherever it points). */
export function writable(cwd: string, path: string): string {
  const roots = WRITE_ROOTS.map((r) => `${r}/`).join(", "), p = under(cwd, path, `m3a writes only under ${roots}`);
  const [root, ...rest] = relative(cwd, p).split(sep), top = realpathSync(cwd);
  if (!WRITE_ROOTS.includes(root!) || !rest.length) throw new ToolError("E_PATH", `${quote(path)} is not under m3a's write roots: it writes only under ${roots}, never library/`, true);
  // a root not there yet resolves to the working directory itself; one that is there must hold the file's real path
  const r = real(p, path), there = lstatSync(join(cwd, root!), { throwIfNoEntry: false });
  if (there ? !inside(join(top, root!), r) : r !== top) throw new ToolError("E_PATH", `${quote(path)} leads out of ${root}/ through a link; m3a writes only under ${roots}`, true);
  return p;
}

/** Writes a file atomically: its directory made, the data written to a new temporary file beside it (whatever sat at
 *  that name removed first, a link itself rather than its target, and the file created exclusively, so no link there
 *  is followed), then renamed over it. */
export function writeAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    rmSync(tmp, { force: true });
    writeFileSync(tmp, data, { flag: "wx" });
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

/** Whether process `pid` on this machine is running (one we may not signal is). */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return errno(err) === "EPERM";
  }
}

/** How long a lock is waited for, and when one is stale whatever its holder (ms): a lock is held across a revision's
 *  check and two file writes, so either is far past any real hold. */
export const LOCK_WAIT = 10_000, LOCK_STALE = 30_000;
let taken = 0;

/**
 * Takes lock file `path` under `cwd`'s write roots: created exclusively ("wx") holding this machine's name, this
 * process's pid and a count, so no two callers hold it, in this process or another; retried with a growing pause
 * while held. A lock is broken when stale: its process on this machine is gone, or it is older than `stale` ms; it is
 * removed only while it still holds what was judged stale. Resolves to the release, which removes the lock only
 * while it is still this one. E_LOCKED (an error) when it stays held `wait` ms.
 */
export async function lockFile(cwd: string, path: string, wait = LOCK_WAIT, stale = LOCK_STALE): Promise<() => void> {
  const p = writable(resolve(cwd), path), me = `${hostname()} ${process.pid} ${++taken}`;
  const held = () => readFileSync(p, "utf8"), drop = (was: string) => held() === was && rmSync(p, { force: true });
  mkdirSync(dirname(p), { recursive: true });
  for (let pause = 2, waited = 0; ; pause = Math.min(pause * 2, 100)) {
    try {
      writeFileSync(p, me, { flag: "wx" });
      return () => void tryIt(() => drop(me));
    } catch (err) {
      if (errno(err) !== "EEXIST") throw new ToolError("E_WRITE", `can't take ${quote(path)} (${errno(err)})`);
    }
    const was = tryIt(held), [host, pid] = (was ?? "").split(" "), age = tryIt(() => Date.now() - statSync(p).mtimeMs) ?? 0;
    if (was !== undefined && ((host === hostname() && Number(pid) > 0 && !alive(Number(pid))) || age > stale)) {
      tryIt(() => drop(was));
      continue;
    }
    if (waited >= wait) throw new ToolError("E_LOCKED", `${quote(path)} is held by another m3a process; nothing was changed`, false, { next: "call again when that edit is done" });
    await new Promise((ok) => setTimeout(ok, pause));
    waited += pause;
  }
}

/** `f()`, or undefined when it throws (a lock read or removed while another caller changes it). */
function tryIt<T>(f: () => T): T | undefined {
  try {
    return f();
  } catch {
    return undefined;
  }
}
