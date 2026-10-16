// The working directory a tool example runs in (PLAN.md WP-7.2a §6.5): fresh, under the OS's temp directory, seeded
// with the files examples name, so an example that writes (edit) leaves nothing in the repository. No test runner is
// imported here, so the e2e suite (Playwright) shares it with the unit tests (Vitest).
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The repository's root. */
export const ROOT = join(import.meta.dirname, "../../../..");

/** The files examples may name, copied into each example's working directory (about 220 kB). */
export const SEED: readonly string[] = ["spec/recipes", "spec/graphs", "spec/sims", ...["rig.gltf", "rigify.gltf", "rig-catalog.json", "rigify-expected.json"].map((f) => `spec/vectors/tier1b/${f}`), "library/sets/QUATERNIUS_3D2DGE/A_TPose.json"];

/** A fresh working directory under the OS's temp directory, seeded with SEED (none with `seed` false); `rm` deletes it. */
export function exampleCwd(seed = true): { cwd: string; rm(): void } {
  const cwd = mkdtempSync(join(tmpdir(), "m3a-ex-"));
  if (seed) for (const f of SEED) cpSync(join(ROOT, f), join(cwd, f), { recursive: true });
  return { cwd, rm: () => rmSync(cwd, { recursive: true, force: true }) };
}
