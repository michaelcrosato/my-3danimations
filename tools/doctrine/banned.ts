// Doctrine check, principle 9: banned APIs, the stale calls agents reach for out of habit, and the three.js pin.
// tools/doctrine/banned-three.json (WP-4.1, docs/THREE.md) holds the pin and the WebGL-era APIs that break under
// WebGPURenderer; any WP may add a ban with its reason.
import { readFileSync } from "node:fs";
import type { Ctx, Finding } from "./context.ts";

/** A banned API: a pattern, where it is banned (path prefixes; empty means everywhere), and what to use instead. */
export interface Ban {
  pattern: RegExp;
  where: string[];
  use: string;
}

/** tools/doctrine/banned-three.json: the pinned packages and the banned APIs. */
export interface BannedFile {
  pin: Record<string, string>;
  banned: { pattern: string; where?: string[]; use: string }[];
}

const FILE = JSON.parse(readFileSync(new URL("./banned-three.json", import.meta.url), "utf8")) as BannedFile;

/** The three.js pin: package name to exact version, as `packages/three/package.json` must declare it. */
export const PIN: Record<string, string> = FILE.pin;

/** The banned APIs. */
export const BANNED: Ban[] = FILE.banned.map((b) => ({ pattern: new RegExp(b.pattern), where: b.where ?? [], use: b.use }));

/** Every use of a banned API in source and Markdown files (the manual's examples count). */
export function checkBanned(ctx: Ctx, bans: Ban[] = BANNED): Finding[] {
  const findings: Finding[] = [];
  const files = ctx.files.filter((f) => /\.(ts|js|mjs|tsx|md|html)$/.test(f) && !f.startsWith("tools/doctrine/") && f !== "PLAN.md" && !f.startsWith("docs/") && !f.startsWith("research_notes/") && !f.startsWith("reports/"));
  for (const ban of bans) {
    for (const f of files) {
      if (ban.where.length && !ban.where.some((w) => f.startsWith(w))) continue;
      const lines = ctx.read(f).split("\n");
      lines.forEach((line, i) => {
        if (ban.pattern.test(line)) findings.push({ check: "banned", message: `${f}:${i + 1} uses ${ban.pattern.source}: ${ban.use}` });
      });
    }
  }
  return findings;
}

/**
 * `packages/three/package.json` declares each pinned package at its version (as a peer, and wherever else it names it),
 * and package-lock.json installs it.
 */
export function checkPin(ctx: Ctx, pin: Record<string, string> = PIN): Finding[] {
  const findings: Finding[] = [], at = "packages/three/package.json";
  if (!ctx.files.includes(at)) return findings;
  const pkg = JSON.parse(ctx.read(at)) as Record<string, Record<string, string> | undefined>;
  const lock = ctx.files.includes("package-lock.json") ? (JSON.parse(ctx.read("package-lock.json")) as { packages?: Record<string, { version?: string }> }) : undefined;
  for (const [name, v] of Object.entries(pin)) {
    const fields = ["peerDependencies", "dependencies", "devDependencies"].filter((f) => pkg[f]?.[name] !== undefined);
    for (const f of fields.length ? fields : ["peerDependencies"]) {
      const declared = pkg[f]?.[name];
      if (declared !== v) findings.push({ check: "banned", message: `${at} ${f} declares ${name}@${declared ?? "nothing"}, the pin is ${v} (tools/doctrine/banned-three.json, docs/THREE.md)` });
    }
    const locked = lock?.packages?.[`packages/three/node_modules/${name}`]?.version ?? lock?.packages?.[`node_modules/${name}`]?.version;
    if (lock && locked !== v) findings.push({ check: "banned", message: `package-lock.json installs ${name}@${locked ?? "nothing"}, the pin is ${v}: run npm install` });
  }
  return findings;
}
