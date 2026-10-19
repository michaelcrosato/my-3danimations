// What the intake and review tests share (WP-8.2a): the repository's root, a library clip read from it, and a scratch
// checkout: a fresh directory holding one library set (QUATERNIUS_3D2DGE, its lock alone) and a copy of the feedback
// log, so a review writes clips, the lock and the docs there and never in the repository. Its host is the Node host
// with the review host's clock fixed.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clip } from "@m3a/core";
import { lockLibrary } from "@m3a/library/node";
import { localStore, type IntakeStore, type Role } from "../src/intake/index.ts";
import { nodeHost } from "../src/node.ts";
import { intakeFiles, nodeReviewHost } from "../src/node/intake.ts";
import type { Host } from "../src/registry/index.ts";

/** The repository's root. */
export const ROOT = join(import.meta.dirname, "../../..");
/** The set a scratch checkout holds. */
export const SET = "QUATERNIUS_3D2DGE";
/** The date the review host's clock says. */
export const TODAY = "2026-10-19";

/** Library clip `id` as the repository holds it. */
export const libraryClip = (id: string): Clip => JSON.parse(readFileSync(join(ROOT, "library/sets", `${id}.json`), "utf8")) as Clip;

/** A scratch checkout: its directory, its host, a store over its .cache/intake/ as `role`, a file's text, and `rm`. */
export interface Checkout {
  cwd: string;
  host: Host;
  store(role: Role, id?: string): IntakeStore;
  file(path: string): string;
  rm(): void;
}

/** A fresh scratch checkout (with no library, `bare`: a directory that is no checkout). */
export function checkout(bare = false): Checkout {
  const cwd = mkdtempSync(join(tmpdir(), "m3a-review-"));
  if (!bare) {
    cpSync(join(ROOT, "library/sets", SET), join(cwd, "library/sets", SET), { recursive: true });
    writeFileSync(join(cwd, "library/sets.lock.json"), `${JSON.stringify(lockLibrary(join(cwd, "library/sets")), null, 1)}\n`);
    mkdirSync(join(cwd, "docs"));
    cpSync(join(ROOT, "docs/FEEDBACK-LOG.md"), join(cwd, "docs/FEEDBACK-LOG.md"));
  }
  const host: Host = { ...nodeHost(cwd), intake: () => nodeReviewHost(cwd, { today: () => TODAY }) };
  return {
    cwd,
    host,
    store: (role, id) => localStore({ files: intakeFiles(join(cwd, ".cache/intake")), role, ...(id ? { id } : {}), today: () => TODAY }),
    file: (p) => readFileSync(join(cwd, p), "utf8"),
    rm: () => rmSync(cwd, { recursive: true, force: true }),
  };
}
