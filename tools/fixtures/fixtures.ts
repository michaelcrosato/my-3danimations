// Real rigs fetched by hash (PLAN.md WP-4.2): a manifest lists each rig's URL, SHA-256, license and license file; a
// fetch downloads what the cache lacks into .cache/fixtures/<id>.glb, keeps it only if its SHA-256 matches, reads its
// license file and keeps it only if it says the license recorded, and writes what it fetched to fetched.json. A check
// reads the cache alone (no network). Any manifest works the same way, so a gate's held-out rig is one more file.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../run/cli.ts";

/** One rig: where it comes from, its hash, its license and the file that says so. */
export interface Rig {
  id: string;
  author: string;
  source: string;
  rig?: string;
  url: string;
  sha256: string;
  license: string;
  licenseUrl: string;
}
/** A manifest of rigs. */
export interface Manifest {
  about?: string;
  rigs: Rig[];
}

/** The committed manifest and the cache. */
export const MANIFEST = join(ROOT, "tools/fixtures/rigs.json");
export const CACHE = join(ROOT, ".cache/fixtures");

/** What a license file must say for each license a manifest may record. */
const SAYS: Readonly<Record<string, RegExp>> = { "CC0 1.0": /CC0|Creative Commons Zero|publicdomain\/zero/i };

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
/** Downloads a URL to a file (curl: it honours the proxy, and reads file:// too). */
function download(url: string, to: string): void {
  execFileSync("curl", ["-fsSL", "--retry", "3", "--max-time", "120", "-o", to, url], { stdio: ["ignore", "ignore", "pipe"] });
}
/** Problems with a manifest's own fields, one line each. */
export function lintManifest(m: Manifest): string[] {
  const out: string[] = [], ids = new Set<string>();
  for (const r of m.rigs ?? []) {
    if (!/^[a-z0-9-]+$/.test(r.id ?? "") || ids.has(r.id)) out.push(`rig "${r.id}": an id of lower-case letters, digits and dashes, used once`);
    ids.add(r.id);
    if (!/^[0-9a-f]{64}$/.test(r.sha256 ?? "")) out.push(`${r.id}: sha256 must be 64 hex digits`);
    if (!SAYS[r.license]) out.push(`${r.id}: license "${r.license}" isn't one a fetch can check (${Object.keys(SAYS).join(", ")})`);
    for (const k of ["url", "licenseUrl"] as const) if (!/^(https|file):\/\//.test(r[k] ?? "")) out.push(`${r.id}: ${k} must be https (or file:// in a test)`);
    if (!r.author || !r.source) out.push(`${r.id}: author and source are recorded`);
  }
  return out;
}

/** One rig's state in a cache: fetched and verified, or why not. */
export interface RigState {
  id: string;
  ok: boolean;
  how: "cached" | "fetched" | "missing" | "failed";
  why?: string;
}

/** Whether a cached rig matches its manifest entry (its hash, and a license file that says its license). */
function cached(r: Rig, dir: string): string | null {
  const glb = join(dir, `${r.id}.glb`), lic = join(dir, `${r.id}.LICENSE.txt`);
  if (!existsSync(glb)) return "not in the cache: npm run fixtures -- fetch";
  const got = sha256(readFileSync(glb));
  if (got !== r.sha256) return `its SHA-256 is ${got}, the manifest says ${r.sha256}`;
  if (!existsSync(lic)) return "its license file isn't in the cache: npm run fixtures -- fetch";
  if (!SAYS[r.license]!.test(readFileSync(lic, "utf8"))) return `its license file doesn't say ${r.license}`;
  return null;
}

/** Fetches what the cache lacks of a manifest's rigs, verifying each by hash and license. */
export function fetchRigs(m: Manifest, dir = CACHE): RigState[] {
  mkdirSync(dir, { recursive: true });
  const record = join(dir, "fetched.json"), fetched = existsSync(record) ? (JSON.parse(readFileSync(record, "utf8")) as Record<string, unknown>) : {};
  const out = m.rigs.map((r): RigState => {
    if (cached(r, dir) === null) return { id: r.id, ok: true, how: "cached" };
    const glb = join(dir, `${r.id}.glb`), lic = join(dir, `${r.id}.LICENSE.txt`), tmp = `${glb}.part`, ltmp = `${lic}.part`;
    try {
      download(r.url, tmp);
      const got = sha256(readFileSync(tmp));
      if (got !== r.sha256) throw new Error(`its SHA-256 is ${got}, the manifest says ${r.sha256}: not kept`);
      download(r.licenseUrl, ltmp);
      const text = readFileSync(ltmp, "utf8");
      if (!SAYS[r.license]!.test(text)) throw new Error(`its license file (${r.licenseUrl}) doesn't say ${r.license}: not kept`);
      renameSync(tmp, glb);
      renameSync(ltmp, lic);
      fetched[r.id] = { url: r.url, sha256: r.sha256, license: r.license, licenseUrl: r.licenseUrl, licenseSha256: sha256(new TextEncoder().encode(text)), author: r.author, source: r.source };
      return { id: r.id, ok: true, how: "fetched" };
    } catch (err) {
      rmSync(tmp, { force: true });
      rmSync(ltmp, { force: true });
      return { id: r.id, ok: false, how: "failed", why: String((err as Error).message).split("\n")[0]! };
    }
  });
  writeFileSync(record, JSON.stringify(fetched, null, 1) + "\n");
  return out;
}

/** Checks the cache against a manifest, without the network. */
export function checkRigs(m: Manifest, dir = CACHE): RigState[] {
  return m.rigs.map((r) => {
    const why = cached(r, dir);
    return why === null ? { id: r.id, ok: true, how: "cached" } : { id: r.id, ok: false, how: "missing", why };
  });
}

/** A rig's bytes from the cache, or null when it isn't there and verified. */
export function rigBytes(id: string, m: Manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest, dir = CACHE): Uint8Array | null {
  const r = m.rigs.find((x) => x.id === id);
  return r && cached(r, dir) === null ? new Uint8Array(readFileSync(join(dir, `${r.id}.glb`))) : null;
}
