// A benchmark workspace (PLAN.md §7, WP-4.7): a starter copied into a directory with its brief, its character and the
// speeds the grader asks of it (speeds.json), and
// either the packed packages installed (a trial, outside the repository) or nothing installed (a grader test inside
// the repository, where the packages resolve to their sources). The character is a parameter: a generator seed, or a
// real rig from a fixtures manifest, fetched by its SHA-256.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { bind } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { scriptFor } from "../graders/B1/grade.ts";
import { rigBytes, type Manifest } from "../../tools/fixtures/fixtures.ts";

const ROOT = join(import.meta.dirname, "../..");

/** A starter character: a generator seed, or a rig from a fixtures manifest (fetched first). */
export type CharacterSpec = { seed: number } | { manifest: string; rig: string };
/** The default B1 character: a generated test character from WP-4.2's set. */
export const DEFAULT_CHARACTER: CharacterSpec = { seed: 1 };

/** The GLB bytes of a starter character. */
export function characterBytes(spec: CharacterSpec): Uint8Array {
  if ("seed" in spec) return character(variant(spec.seed)).glb;
  const m = JSON.parse(readFileSync(spec.manifest, "utf8")) as Manifest, bytes = rigBytes(spec.rig, m);
  if (!bytes) throw new Error(`bench: rig "${spec.rig}" isn't fetched: npm run fixtures -- fetch --manifest ${relative(ROOT, spec.manifest)}`);
  return bytes;
}

/** What a workspace holds. */
export interface WorkspaceSpec {
  /** The starter to copy (bench/starters/<name>). */
  starter: string;
  /** The brief, copied in as BRIEF.md. */
  brief?: string;
  character: CharacterSpec;
  /** A solution's files to lay over the starter (a known-good or planted one), by path in the workspace. */
  files?: Record<string, string>;
  /** Packed tarballs to install, by package (a trial); none inside the repository (a grader test). */
  packs?: Record<string, string>;
}

/** Builds a workspace in `dir` (emptied first); returns dir. Its speeds.json lists the speeds the grader asks of its
 *  character, in proportion to the character's hip height (its bound body's H0). */
export async function prepareWorkspace(dir: string, spec: WorkspaceSpec): Promise<string> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(spec.starter, dir, { recursive: true });
  if (spec.brief) cpSync(spec.brief, join(dir, "BRIEF.md"));
  const bytes = characterBytes(spec.character), H0 = bind((await loadGlb(bytes, { textures: false })).scene).core.rest.H0;
  writeFileSync(join(dir, "character.glb"), bytes);
  writeFileSync(join(dir, "speeds.json"), `${JSON.stringify({ about: "the speeds the game asks of this character (m/s) and for how long (s): for hips 1 m high, 0, 1.2, 3.5, 1.2 and 0, in proportion to its own", hips: Math.round(H0) / 1000, speeds: scriptFor(H0).map((p) => [p.speed, p.secs]) }, null, 1)}\n`);
  for (const [to, text] of Object.entries(spec.files ?? {})) {
    mkdirSync(join(dir, to, ".."), { recursive: true });
    writeFileSync(join(dir, to), text);
  }
  if (spec.packs) {
    // the packages from their tarballs, three at the pinned release; the npm cache serves what it holds
    mkdirSync(join(dir, "packs"), { recursive: true });
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")), pin = JSON.parse(readFileSync(join(ROOT, "packages/three/package.json"), "utf8")).peerDependencies.three;
    pkg.dependencies = { three: pin };
    for (const [name, tgz] of Object.entries(spec.packs)) {
      cpSync(tgz, join(dir, "packs", tgz.split("/").pop()!));
      pkg.dependencies[`@m3a/${name}`] = `file:packs/${tgz.split("/").pop()}`;
    }
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline", "--loglevel=error"], { cwd: dir, stdio: "pipe", timeout: 300_000 });
  }
  return dir;
}

/** Whether the workspace's installed packages hold the manual (a trial's starting point). */
export function manualIn(dir: string): string | null {
  const p = join(dir, "node_modules/@m3a/tools/MANUAL.md");
  return existsSync(p) ? p : null;
}
