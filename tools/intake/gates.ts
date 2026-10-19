// The library's gates on a pull request (PLAN.md WP-9.1a, `.github/workflows/library-gates.yml`, `npm run gate --
// library-pr`): on a checkout, the library loads with every file as locked, the sets it touches pass the license check,
// and every clip it adds or changes under library/sets/ passes the intake's gates (packages/tools/src/tools/
// library-submit.ts). A clip that came through the intake (in an intake set, or carrying the intake's provenance) passes
// every one: its provenance whole, its license the tier's, no near-duplicate of another clip if it is new, and the
// retarget onto the reference rigs. Any other clip, written by the library's own tools, is read with the library's
// baselines (its set's accepted warnings, its tag exceptions and captured speed, its recorded QA reason), its retarget
// left to T2's sweep (D80), which lists each failure with its reason: every library clip passes so. With `--fixture
// all`, on a scratch copy of the library: each fixture's clip planted on its own as a pull request would add it (through
// the library's writer, the lock written), the bad ones expected to fail with the gate their fixture names, the clean
// ones to pass.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Clip } from "@m3a/core";
import { checkSets, tierOf } from "@m3a/library";
import { readTagsBaseline } from "../facts/facts.ts";
import { census } from "../qa/census.ts";
import { bounceReason, clipGates, INTAKE_SETS, lineage, licenseRule, type Gate } from "../../packages/tools/src/tools/library-submit.ts";
import { onBody } from "../../packages/tools/src/tools/judge.ts";
import { ROOT, type Step } from "../run/cli.ts";
import { cl100k, motionOf, nearDuplicates, openChecker, type Checker, type Rig } from "./check.ts";
import { fixtures } from "./fixtures.ts";
import { scratchCheckout, writeClip } from "./write.ts";

/** A clip a pull request adds or changes. */
export interface Changed {
  id: string;
  added: boolean;
}

/** The clips `git diff --name-status` lists as added (A) or changed (M) under library/sets/: clip files alone, not a
 *  set's manifest, catalog or baselines (each `_`-named, or no .json); a deleted one is the library's own business (ids
 *  are never reused, WP-9.3). */
export function clipsOf(nameStatus: string): Changed[] {
  return nameStatus.split("\n").map((l) => /^([AM])\tlibrary\/sets\/([A-Z][A-Z0-9_]*)\/([A-Za-z0-9][A-Za-z0-9_-]*)\.json$/.exec(l)).filter((m): m is RegExpExecArray => m !== null).map((m) => ({ id: `${m[2]}/${m[3]}`, added: m[1] === "A" }));
}

/** The clips the checkout at `root` adds or changes against `base` (git's merge base with it). */
export function changedClips(root: string, base: string): Changed[] {
  const r = spawnSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`, "--", "library/sets"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git diff against ${base} failed (${(r.stderr || "").trim().split("\n")[0]}): fetch it (git fetch origin main), or name another --base`);
  return clipsOf(r.stdout);
}

/** Whether a clip came through the intake: in an intake set, or carrying the intake's provenance. */
const fromIntake = (set: string, c: Clip) => Object.values(INTAKE_SETS).includes(set) || Boolean((c.provenance as { intake?: unknown }).intake);

/** The validator warnings set `set`'s _baseline.json accepts for its clip `name`. */
function accepted(sets: string, set: string, name: string): { code: string; at: string }[] {
  const f = join(sets, set, "_baseline.json");
  return existsSync(f) ? ((JSON.parse(readFileSync(f, "utf8")) as { clips?: Record<string, { code: string; at: string }[]> }).clips?.[name] ?? []) : [];
}

/** One changed clip's gates on checker `c`; `twins` holds the near-duplicates census found for the new ones. A clip
 *  that came through the intake passes every gate; any other, written by the library's own tools, is read with the
 *  library's baselines (its set's accepted warnings, its tag exceptions, its recorded QA reason), and its retarget is
 *  T2's sweep's (D80: 95% of clips on every skeleton, each failure listed with its reason). */
function gatesOf(x: Changed, c: Checker, sets: string, twins: Map<string, string[]>): Gate[] {
  const got = c.lib.library.clip(x.id), [set, name] = x.id.split("/") as [string, string], intake = fromIntake(set, got.clip), l = lineage(got.clip, c.lib.library, null);
  const tags = intake ? [] : Object.keys(readTagsBaseline(join(sets, "../baselines/tags.json")).conflicts[x.id] ?? {});
  const gates = clipGates({ clip: got.clip, rest: got.rest, kind: "clip", base: null, derived: l.derived, as: intake ? "adopted" : "library", accepted: accepted(sets, set, name), acceptedTags: tags, tokens: cl100k });
  if (!gates[0]!.ok) return gates;
  // its license is its set's tier: by the intake's rule for a clip that came through it, by D10's for any other
  const lic = gates.find((g) => g.gate === "license")!, rule = licenseRule(got.clip, l.derived), parts = got.clip.provenance.license.split(" AND ");
  lic.why = intake ? [rule.problem ?? (rule.tier !== got.tier ? `it is ${rule.tier} by the intake's rule, in a ${got.tier} set` : null)].filter((w): w is string => w !== null) : parts.filter((p) => tierOf(p) !== got.tier && tierOf(p) !== "cc0").map((p) => `its license ${p} doesn't fit its set's tier, ${got.tier} (D10)`);
  lic.ok = !lic.why.length;
  const others = (x.added && intake ? (c.motions().get(motionOf(got.clip)) ?? []) : []).filter((id) => id !== x.id), dup = x.added && intake ? [...others.map((id) => `it is the motion of ${id}, which the library has already`), ...(twins.get(x.id) ?? [])] : [];
  const all = [...gates, { gate: "dedup", ok: !dup.length, why: dup } as Gate];
  if (!intake || !all.every((g) => g.ok)) return all; // the retarget, the costliest, only for a clip that passes the rest
  const rigs = c.rigs.map((g) => onBody(got.clip, got.rest, g.bound, g.id)).filter((r) => !r.ok);
  return [...all, { gate: "retarget", ok: !rigs.length, why: rigs.map((r) => `on ${r.rig}: ${r.why.join("; ")}`) }];
}

/** The library's gates on the checkout at `root` for the clips `changed`: the library and its lock, the touched sets'
 *  licenses, and each clip's gates; one step each. */
export async function runGates(root: string, changed: readonly Changed[], rigs?: readonly Rig[]): Promise<Step[]> {
  const sets = join(root, "library/sets"), steps: Step[] = [], t0 = performance.now(), c = await openChecker(sets, rigs);
  try {
    c.lib.library.verify();
    steps.push({ name: "the library loads, every file as locked", ok: true, ms: performance.now() - t0, summary: `${c.lib.library.sets().length} sets, ${c.pool.length} clips` });
  } catch (err) {
    steps.push({ name: "the library loads, every file as locked", ok: false, ms: performance.now() - t0, summary: (err as Error).message.replace(/^library: /, "").slice(0, 200) });
  }
  const touched = [...new Set(changed.map((x) => x.id.split("/")[0]!))].sort(), lic = checkSets(c.lib.source, touched, c.lib.licenseText), bad = lic.findings.filter((f) => f.level === "fail");
  steps.push({ name: "licenses: the sets it touches", ok: lic.ok, ms: 0, summary: bad.length ? `${bad[0]!.where}: ${bad[0]!.message}` : `${touched.length ? touched.join(", ") : "none"}`, detail: bad.map((f) => `${f.where}: ${f.message}`) });
  // the new clips that came through the intake, by pose against the rest of the library, read together
  const fresh = changed.filter((x) => x.added && fromIntake(x.id.split("/")[0]!, c.lib.library.clip(x.id).clip)), twins = new Map<string, string[]>();
  if (fresh.length) {
    // their lineage cut, as the checker reads a submission: only their poses join them to another clip
    const pool = c.pool.map((p) => (fresh.some((x) => x.id === p.clip.id) ? { ...p, clip: { ...p.clip, provenance: { ...p.clip.provenance, src: "INTAKE", orig: undefined } as Clip["provenance"] } } : p));
    const { same } = census(pool, c.cc0);
    for (const x of fresh) twins.set(x.id, nearDuplicates(same, x.id, (id) => !fresh.some((f) => f.id === id)));
  }
  for (const x of changed) {
    const t = performance.now();
    try {
      const reason = bounceReason(gatesOf(x, c, sets, twins));
      steps.push({ name: x.id, ok: reason === null, ms: performance.now() - t, summary: reason ?? `every gate green (${x.added ? "added" : "changed"})` });
    } catch (err) {
      steps.push({ name: x.id, ok: false, ms: performance.now() - t, summary: (err as Error).message.slice(0, 200) });
    }
  }
  return steps;
}

/** The gates on a pull request: the clips the checkout at `root` adds or changes against `base`. */
export async function libraryGates(root: string = ROOT, base = "origin/main"): Promise<{ steps: Step[] }> {
  return { steps: await runGates(root, changedClips(root, base)) };
}

/** The fixtures' clips (all, or the one named) each planted on its own into a scratch copy of the library, as a pull
 *  request would add it (into its tier's intake set, or over the clip it improves), and the gates run on it: one step
 *  each, ok when the gates fail a bad one with its fixture's gate and pass a clean one. */
export async function plantedGates(only: string, root: string = ROOT, rigs?: readonly Rig[]): Promise<{ steps: Step[] }> {
  const dir = scratchCheckout(root), steps: Step[] = [];
  try {
    const c = await openChecker(join(dir, "library/sets"), rigs);
    for (const f of fixtures(c.lib, only)) {
      const t = performance.now(), clip = JSON.parse(f.text) as Clip, tier = licenseRule(clip, lineage(clip, c.lib.library, f.improves).derived).tier ?? "cc0";
      const id = f.improves ?? `${INTAKE_SETS[tier]}/${clip.id.split("/")[1]}`, w = writeClip(dir, { ...clip, id });
      try {
        const out = await runGates(dir, [{ id, added: !f.improves }], c.rigs), failed = out.filter((s) => !s.ok), reason = failed.map((s) => s.summary ?? s.name).join("; ");
        const want = f.expect === "bounced" ? `fails on ${f.gate}` : "passes", ok = f.expect === "bounced" ? failed.some((s) => s.summary?.startsWith(`${f.gate}: `)) : !failed.length;
        steps.push({ name: `${f.name} (${id})`, ok, ms: performance.now() - t, summary: ok ? (failed.length ? `failed as it must: ${reason.slice(0, 110)}` : "passed as it must") : `it must ${want}: ${failed.length ? reason.slice(0, 110) : "every gate passed"}` });
      } finally {
        w.restore();
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { steps };
}
