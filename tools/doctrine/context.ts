// The doctrine checks' shared context: the repository's files (tracked plus untracked, minus ignored), a reader,
// and the Finding type each check returns. Tests build a context over a temporary folder instead of git.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** One problem a check found, with the fix in the API's words. */
export interface Finding {
  check: string;
  message: string;
}

/** What every check reads: the root, the repository's files (relative, `/`-separated) and a text reader. */
export interface Ctx {
  root: string;
  files: string[];
  read(path: string): string;
  /** The text of `path` at the merge base with main, or null when there is no main or no such file there. */
  atMain(path: string): string | null;
}

/** Files git would commit: tracked plus untracked, minus ignored. */
function gitFiles(root: string): string[] | null {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\0").filter((f) => f && existsSync(join(root, f)));
  } catch {
    return null;
  }
}

/** Folders a commit never holds: git's own, dependencies, caches and outputs (as .gitignore has them). */
const SKIP = new Set([".git", "node_modules", ".cache", "check-output", "dist"]);

/**
 * Every file under `dir` a commit could hold (for contexts outside git): skipping git's own folder, dependencies,
 * caches and outputs, and the local lane's content (D10: library/local/ holds libraries that never ship, so no check
 * reads them; its README alone is the repository's).
 */
function walk(root: string, dir: string = root): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name), rel = relative(root, p).split("\\").join("/");
    if (rel.startsWith("library/local/") && rel !== "library/local/README.md") continue;
    if (statSync(p).isDirectory()) out.push(...walk(root, p));
    else out.push(rel);
  }
  return out;
}

/** The merge base of HEAD with main (or origin/main), or null. */
function mainBase(root: string): string | null {
  for (const ref of ["origin/main", "main"]) {
    try {
      return execFileSync("git", ["merge-base", "HEAD", ref], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      // try the next ref
    }
  }
  return null;
}

/** A context over `root`: git's view of the files when it is a checkout, otherwise every file under it. */
export function makeCtx(root: string, opts: { base?: string } = {}): Ctx {
  const files = (gitFiles(root) ?? walk(root)).sort();
  let base: string | null | undefined = opts.base;
  return {
    root,
    files,
    read: (p) => readFileSync(join(root, p), "utf8"),
    atMain(p) {
      if (base === undefined) base = mainBase(root);
      if (!base) return null;
      try {
        return execFileSync("git", ["show", `${base}:${p}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      } catch {
        return null;
      }
    },
  };
}
