// Doctrine check, principle 9: pinned versions and checksums.
// - Every dependency in every package.json is an exact version (no ^, ~, *, ranges or tags); @m3a ones equal the
//   repository version.
// - package-lock.json installs exactly the root's pinned versions.
// - tools/pins.json (WP-0.4), when present: each repo has an https URL and a full 40-hex SHA; each frozen fixture
//   matches its SHA-256; each fetched file that is in the cache matches its SHA-256.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx, Finding } from "./context.ts";

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The shape of tools/pins.json (WP-0.4 writes it). */
export interface Pins {
  repos: Record<string, { url: string; sha: string; files?: string[] }>;
  frozen?: { path: string; sha256: string; from: string }[];
  fetched?: { path: string; url: string; sha256: string; license?: string }[];
}

/** SHA-256 of a file, hex. */
export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Check exact pins in package.json files and the lockfile, and tools/pins.json's SHAs and checksums. */
export function checkPins(ctx: Ctx): { findings: Finding[]; lines: string[] } {
  const findings: Finding[] = [];
  const fail = (message: string) => findings.push({ check: "pins", message });
  const root = JSON.parse(ctx.read("package.json")) as { version: string; devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
  let deps = 0;
  for (const f of ctx.files.filter((p) => /^(package\.json|packages\/[^/]+\/package\.json)$/.test(p))) {
    const pkg = JSON.parse(ctx.read(f)) as Record<string, Record<string, string> | undefined>;
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, v] of Object.entries(pkg[field] ?? {})) {
        deps++;
        if (name.startsWith("@m3a/")) {
          if (v !== root.version) fail(`${f} ${field} ${name}@${v}: workspace dependencies use the repository version ${root.version}`);
        } else if (!EXACT.test(v)) fail(`${f} ${field} ${name}@${v} is not an exact version: pin it (principle 9)`);
      }
    }
  }
  if (ctx.files.includes("package-lock.json")) {
    const lock = JSON.parse(ctx.read("package-lock.json")) as { packages?: Record<string, { version?: string }> };
    for (const [name, v] of Object.entries({ ...root.dependencies, ...root.devDependencies })) {
      const got = lock.packages?.[`node_modules/${name}`]?.version;
      if (got !== v) fail(`package-lock.json installs ${name}@${got ?? "nothing"}, package.json pins ${v}: run npm install`);
    }
  }
  const lines = [`${deps} dependencies pinned exactly`];
  if (ctx.files.includes("tools/pins.json")) {
    const pins = JSON.parse(ctx.read("tools/pins.json")) as Pins;
    for (const [name, r] of Object.entries(pins.repos ?? {})) {
      if (!/^https:\/\//.test(r.url)) fail(`tools/pins.json repo ${name}: url must be public https`);
      if (!/^[0-9a-f]{40}$/.test(r.sha)) fail(`tools/pins.json repo ${name}: sha must be a full 40-hex commit`);
    }
    for (const fz of pins.frozen ?? []) {
      const p = join(ctx.root, fz.path);
      if (!existsSync(p)) fail(`frozen fixture ${fz.path} is missing`);
      else if (sha256File(p) !== fz.sha256) fail(`frozen fixture ${fz.path} does not match its SHA-256: frozen fixtures are never regenerated or edited`);
    }
    let cached = 0;
    for (const fe of pins.fetched ?? []) {
      const p = join(ctx.root, fe.path);
      if (!existsSync(p)) continue;
      cached++;
      if (sha256File(p) !== fe.sha256) fail(`fetched file ${fe.path} does not match its SHA-256: delete it and fetch again`);
    }
    lines.push(`${Object.keys(pins.repos ?? {}).length} repos, ${(pins.frozen ?? []).length} frozen fixtures, ${cached}/${(pins.fetched ?? []).length} fetched files cached`);
  } else lines.push("tools/pins.json pending (WP-0.4)");
  return { findings, lines };
}
