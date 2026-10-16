// Real rigs fetched by hash (PLAN.md WP-4.2): a manifest lists each rig's URL, SHA-256, license and license file; a
// fetch downloads what the cache lacks into .cache/fixtures/<id>.glb, keeps it only if its SHA-256 matches, reads its
// license file and keeps it only if it says the license recorded (and has the SHA-256 recorded, where the manifest pins
// one), and writes what it fetched to fetched.json. A check reads the cache alone (no network). Any manifest works the
// same way, so a gate's held-out rig is one more file.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../run/cli.ts";
import { TEST_SEEDS } from "../../packages/three/test-characters/variants.ts";

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
  /** The license file's SHA-256, when the manifest pins it (a gate's held-out rig does): a changed file isn't kept. */
  licenseSha256?: string;
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
    if (r.licenseSha256 !== undefined && !/^[0-9a-f]{64}$/.test(r.licenseSha256)) out.push(`${r.id}: licenseSha256 must be 64 hex digits`);
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

/** Why a license file's text isn't the one rig r records (it doesn't say its license, or its SHA-256 isn't pinned one), or null. */
function licenseWrong(r: Rig, text: string): string | null {
  if (!SAYS[r.license]!.test(text)) return `doesn't say ${r.license}`;
  const got = sha256(new TextEncoder().encode(text));
  return r.licenseSha256 !== undefined && got !== r.licenseSha256 ? `has SHA-256 ${got}, the manifest says ${r.licenseSha256}` : null;
}
/** Whether a cached rig matches its manifest entry (its hash, and a license file that says its license). */
function cached(r: Rig, dir: string): string | null {
  const glb = join(dir, `${r.id}.glb`), lic = join(dir, `${r.id}.LICENSE.txt`);
  if (!existsSync(glb)) return "not in the cache: npm run fixtures -- fetch";
  const got = sha256(readFileSync(glb));
  if (got !== r.sha256) return `its SHA-256 is ${got}, the manifest says ${r.sha256}`;
  if (!existsSync(lic)) return "its license file isn't in the cache: npm run fixtures -- fetch";
  const wrong = licenseWrong(r, readFileSync(lic, "utf8"));
  if (wrong) return `its license file ${wrong}`;
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
      const wrong = licenseWrong(r, text);
      if (wrong) throw new Error(`its license file (${r.licenseUrl}) ${wrong}: not kept`);
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

/** The gates whose sweep runs on the held-out run's rigs (its rig.json): the others' variants may use seeds alone. */
const RIG_GATES = new Set(["G4"]);
/**
 * The generator seeds a held-out variant may not use (PLAN.md §7): WP-4.2's test set, any a grader or runner test
 * grades on (`{ seed: n }` in bench/graders and bench/runner), and any another held-out run's variant used.
 */
export function usedSeeds(base = join(ROOT, "bench/results"), but?: string, tests = [join(ROOT, "bench/graders"), join(ROOT, "bench/runner")]): Set<number> {
  const out = new Set<number>(TEST_SEEDS), files = (d: string): string[] => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "known-good" ? [] : files(join(d, e.name))) : e.name.endsWith(".test.ts") ? [join(d, e.name)] : [])) : []);
  for (const f of tests.flatMap(files)) for (const m of readFileSync(f, "utf8").matchAll(/\bseed: (\d+)/g)) out.add(Number(m[1]));
  const held = join(base, "heldout");
  for (const gate of existsSync(held) ? readdirSync(held) : [])
    for (const run of readdirSync(join(held, gate)).filter((r) => /^run-\d+$/.test(r) && join(held, gate, r) !== but))
      for (const b of readdirSync(join(held, gate, run)).filter((d) => /^B\d+$/.test(d))) {
        const f = join(held, gate, run, b, "character.json"), c = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { seed?: number }) : {};
        if (typeof c.seed === "number") out.add(c.seed);
      }
  return out;
}

/** A gate's latest held-out run as `freshHeldout` checked it: the run, its problems (one line each), its rigs' ids (null
 *  where it has no rig.json: its variants use generator seeds only), each variant's seed checked against the seeds
 *  already used (`usedSeeds`), and how many those are. */
export interface Heldout {
  run: string | null;
  problems: string[];
  rigs: string[] | null;
  seeds: { brief: string; seed: number; used: boolean }[];
  used: number;
}
/**
 * Whether a gate's latest held-out run (bench/results/heldout/<gate>/run-<n>/) is fit for a gate run (PLAN.md §7,
 * §9.3, D57): no recorded gate run used it (bench/results/gates/<gate>-run-<n>/); its rig manifest (G4's sweep reads
 * one; another gate's run may have one) lints and pins each license file's SHA-256, each rig in the cache and
 * verified; each brief's variant has its brief and character, and a seed no test grades on and no other run used.
 */
export function freshHeldout(gate: string, base = join(ROOT, "bench/results"), dir = CACHE, tests?: string[]): Heldout {
  const runs = join(base, "heldout", gate), all = existsSync(runs) ? readdirSync(runs).filter((d) => /^run-\d+$/.test(d)) : [];
  const run = all.sort((a, b) => Number(a.slice(4)) - Number(b.slice(4))).pop() ?? null;
  if (!run) return { run, problems: [`no held-out run for ${gate}: a fresh subagent writes bench/results/heldout/${gate}/run-<n>/ first (PLAN.md §7)`], rigs: null, seeds: [], used: 0 };
  const problems: string[] = [], at = join(runs, run);
  let rigs: string[] | null = null;
  if (existsSync(join(base, "gates", `${gate}-${run}`))) problems.push(`${run} was used by a gate run already (bench/results/gates/${gate}-${run}/): a rerun writes fresh variants into run-${Number(run.slice(4)) + 1}`);
  if (!existsSync(join(at, "rig.json"))) {
    if (RIG_GATES.has(gate)) problems.push(`${run} has no rig.json`);
  } else {
    const m = JSON.parse(readFileSync(join(at, "rig.json"), "utf8")) as Manifest;
    rigs = m.rigs.map((r) => r.id);
    problems.push(...lintManifest(m));
    for (const r of m.rigs) if (r.licenseSha256 === undefined) problems.push(`${r.id}: its license file's SHA-256 isn't pinned (licenseSha256)`);
    for (const st of checkRigs(m, dir)) if (!st.ok) problems.push(`${st.id}: ${st.why}`);
  }
  const used = usedSeeds(base, at, tests), seeds: Heldout["seeds"] = [];
  for (const brief of readdirSync(at).filter((d) => /^B\d+$/.test(d))) {
    for (const f of ["brief.md", "character.json"]) if (!existsSync(join(at, brief, f))) problems.push(`${run}/${brief} has no ${f}`);
    const f = join(at, brief, "character.json"), c = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { seed?: number }) : {};
    if (typeof c.seed !== "number") continue;
    seeds.push({ brief, seed: c.seed, used: used.has(c.seed) });
    if (used.has(c.seed)) problems.push(`${run}/${brief}: seed ${c.seed} is WP-4.2's, a test's or another run's: a variant takes a character none used (PLAN.md §7)`);
  }
  return { run, problems, rigs, seeds, used: used.size };
}
/** What `npm run fixtures -- heldout` says of a held-out run: fresh, with its rigs or "no rig: seeds only", and each
 *  variant's seed against the seeds already used (D91); or its problems. */
export function heldoutStep(h: Heldout): { summary: string; detail: string[] } {
  if (h.problems.length) return { summary: `${h.problems.length} problem(s) with ${h.run ?? "the held-out run"}`, detail: h.problems };
  const seeds = h.seeds.length ? `; seeds ${h.seeds.map((s) => `${s.brief} ${s.seed}`).join(", ")}, none of the ${h.used} used (WP-4.2's, the tests', other runs')` : "";
  return { summary: `${h.run} is fresh: no gate run used it; ${h.rigs ? `its rigs pinned and cached (${h.rigs.join(", ")})` : "no rig: seeds only"}${seeds}`, detail: h.seeds.map((s) => `${s.brief}: seed ${s.seed}, not among the ${h.used} used`) };
}
