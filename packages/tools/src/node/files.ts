// Where the Node host may read and write (PLAN.md WP-7.2, decision §8.3): reads under the working directory, writes
// only under its write roots (workshop/, .m3a/, imports/, check-output/: never library/), each checked by its name and
// by its real path, so no link leads out; and every write atomic. The host's own files (images, report.json, request
// records) go through the same checks as a tool's.
import { lstatSync, mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
  if (!path.trim() || !inside(cwd, p)) throw new ToolError("E_PATH", `${path.trim() ? `${quote(path)} is outside ${cwd}` : "the path is empty"}; ${to}`, true);
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
