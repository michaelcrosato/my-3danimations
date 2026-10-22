// The library's gates on a pull request (PLAN.md WP-9.1a, `.github/workflows/library-gates.yml`, `npm run gate --
// library-pr`): on a checkout, the library loads with every file as locked, the sets it touches pass the license check,
// and every clip it adds or changes under library/sets/ passes the intake's gates (packages/tools/src/tools/
// library-submit.ts). A changed clip is held to what it was (the pull request's base, or the file the adopt bot wrote
// over): it keeps that version's license, credit and tier, and may keep its tag conflicts and failing metrics. A clip
// that came through the intake (in an intake set, or carrying the intake's provenance) passes every one: its provenance
// whole, its license the tier's, no near-duplicate of another clip if it is new, and the retarget onto the reference
// rigs. Any other clip is read with the library's baselines (its set's accepted warnings, its tag exceptions and
// captured speed), its retarget left to T2's sweep (D80), which lists each failure with its reason: a changed one with
// its writers' recorded QA reason, as every library clip passes; an added one (the library grows by adoption, so this
// is no maintenance change) also through dedup, with the failing metrics library/baselines/qa.json keeps for it by hand
// alone, and no review. A review holds only on the motion it was made on, and in a pull request (not the adopt bot's,
// whose pull requests start no workflow and which gates its own) a clip carrying an adoption record main hasn't fails.
// With `--fixture all`, on a scratch copy of the library: each fixture's clip planted on its own as a pull request
// would add it (through the library's writer, the lock written), and the bad ones also into an existing set without
// the intake's provenance; the bad ones expected to fail with the gate their fixture names, the clean ones to pass.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseClip, type Clip } from "@m3a/core";
import { checkSets, hitText, tierOf, type DedupIndex } from "@m3a/library";
import { readTagsBaseline } from "../facts/facts.ts";
import { census } from "../qa/census.ts";
import { readReasons, type QaReasons } from "../qa/verdict.ts";
import { restFor } from "../../packages/tools/src/tools/clips.ts";
import { bounceReason, clipGates, INTAKE_SETS, lineage, licenseRule, sourceProblem, type Derived, type Gate } from "../../packages/tools/src/tools/library-submit.ts";
import { onBody } from "../../packages/tools/src/tools/judge.ts";
import { ROOT, type Step } from "../run/cli.ts";
import { cl100k, motionOf, nearDuplicates, openChecker, type Checker, type Rig } from "./check.ts";
import { fixtures } from "./fixtures.ts";
import { sha256 } from "./host.ts";
import { scratchCheckout, writeClip } from "./write.ts";

/** A clip a pull request adds or changes, and a changed one's file as it was (the pull request's base), when known. */
export interface Changed {
  id: string;
  added: boolean;
  was?: string;
}

/** How the gates run: for a pull request (`pr`, library-gates.yml and the planted fixtures: no adoption record the
 *  base hasn't) or for the adopt bot's own (`bot`); and the library's near-duplicate index, built already (a clip's own
 *  id is never its own duplicate, so an index without the clips added serves), else built from the checkout. */
export interface GatesOptions {
  by?: "pr" | "bot";
  near?: DedupIndex;
}

/** The clips `git diff --name-status` lists as added (A) or changed (M) under library/sets/: clip files alone, not a
 *  set's manifest, catalog or baselines (each `_`-named, or no .json); a deleted one is the library's own business (ids
 *  are never reused, WP-9.3). */
export function clipsOf(nameStatus: string): Changed[] {
  return nameStatus.split("\n").map((l) => /^([AM])\tlibrary\/sets\/([A-Z][A-Z0-9_]*)\/([A-Za-z0-9][A-Za-z0-9_-]*)\.json$/.exec(l)).filter((m): m is RegExpExecArray => m !== null).map((m) => ({ id: `${m[2]}/${m[3]}`, added: m[1] === "A" }));
}

/** The clips the checkout at `root` adds or changes against `base` (git's merge base with it), each changed one with
 *  its file there. */
export function changedClips(root: string, base: string): Changed[] {
  const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
  const r = git(["diff", "--name-status", "--no-renames", `${base}...HEAD`, "--", "library/sets"]), at = git(["merge-base", base, "HEAD"]);
  if (r.status !== 0 || at.status !== 0) throw new Error(`git diff against ${base} failed (${(r.stderr || at.stderr || "").trim().split("\n")[0]}): fetch it (git fetch origin main), or name another --base`);
  return clipsOf(r.stdout).map((x) => {
    if (x.added) return x;
    const was = git(["show", `${at.stdout.trim()}:library/sets/${x.id}.json`]);
    return was.status === 0 ? { ...x, was: was.stdout } : x;
  });
}

/** Whether a clip came through the intake: in an intake set, or carrying the intake's provenance. */
const fromIntake = (set: string, c: Clip) => Object.values(INTAKE_SETS).includes(set) || Boolean((c.provenance as { intake?: unknown }).intake);
/** The adoption a clip records (`provenance.intake.submission`), which the adopt bot alone writes. */
const adoptionIn = (c: Clip | null) => (c?.provenance as { intake?: { submission?: unknown } } | undefined)?.intake?.submission;

/** The validator warnings set `set`'s _baseline.json accepts for its clip `name`. */
function accepted(sets: string, set: string, name: string): { code: string; at: string }[] {
  const f = join(sets, set, "_baseline.json");
  return existsSync(f) ? ((JSON.parse(readFileSync(f, "utf8")) as { clips?: Record<string, { code: string; at: string }[]> }).clips?.[name] ?? []) : [];
}

/** What gatesOf reads once a run: the checker, the checkout's sets, the census's near-duplicates of the added clips,
 *  the near-duplicate index, the QA reasons and the run's mode. */
interface Run {
  c: Checker;
  sets: string;
  twins: Map<string, string[]>;
  near: () => DedupIndex;
  reasons: () => QaReasons;
  fresh: readonly string[];
  by: "pr" | "bot";
}

/** One changed clip's gates. A changed one is held to what it was (`x.was`: its license, credit and tier kept, its tag
 *  conflicts and failing metrics allowed, and its never moving if it never moved), or to itself when that is unknown.
 *  One that came through the intake passes every gate; any other is read with the library's baselines (its set's
 *  accepted warnings, its tag exceptions, its writers' recorded QA reason when changed, the reasons
 *  library/baselines/qa.json gives it by hand when added, and that file's answer when it never moves), and its
 *  retarget is T2's sweep's (D80: 95% of clips on every skeleton, each failure listed with its reason). Every added clip
 *  goes through dedup. */
function gatesOf(x: Changed, run: Run): Gate[] {
  const { c, sets } = run, got = c.lib.library.clip(x.id), [set, name] = x.id.split("/") as [string, string], intake = fromIntake(set, got.clip);
  const prev = x.was === undefined ? null : parseClip(x.was), then = prev ?? got.clip;
  // a changed clip derives from what it was, whatever its orig names: an improvement keeps its set's tier
  const own: Derived[] = x.added ? [] : [{ id: x.id, tier: got.tier, license: then.provenance.license, credit: then.provenance.credit ?? null }];
  const derived = [...lineage(got.clip, c.lib.library, null).derived.filter((d) => x.added || d.id !== x.id), ...own];
  const base = prev ? { id: x.id, sha256: sha256(x.was!), clip: prev, rest: restFor(c.lib, prev)?.rest ?? got.rest } : null;
  const tags = intake ? [] : Object.keys(readTagsBaseline(join(sets, "../baselines/tags.json")).conflicts[x.id] ?? {});
  // (a library clip that never moves passes the lint gate where library/baselines/qa.json answers it, as the library's QA
  // passes it; an intake clip's never does)
  const still = !intake && Boolean(run.reasons().still?.[x.id]);
  const qa = intake ? { recorded: !x.added && !prev } : x.added ? { byHand: Object.keys(run.reasons().clips[x.id] ?? {}), still } : { recorded: true, still };
  const gates = clipGates({ clip: got.clip, rest: got.rest, kind: "clip", base, derived, as: intake ? "adopted" : "library", added: x.added, qa, accepted: accepted(sets, set, name), acceptedTags: tags, tokens: cl100k });
  if (!gates[0]!.ok) return gates;
  // only the adopt bot records an adoption, and it gates its own pull requests: in any other, a new record fails
  const prov = gates.find((g) => g.gate === "provenance")!;
  if (run.by === "pr" && adoptionIn(got.clip) !== undefined && adoptionIn(got.clip) !== adoptionIn(prev)) {
    prov.why.push("it records an adoption from the intake queue (provenance.intake.submission) that main hasn't: only the adopt bot writes one, gating its own pull request, so leave it as main has it and send the clip with m3a library submit");
    prov.ok = false;
  }
  // its license is its set's tier: by the intake's rule for a clip that came through it, by D10's for any other; and a
  // motion source's terms on the allowlist either way
  const lic = gates.find((g) => g.gate === "license")!, rule = licenseRule(got.clip, derived), parts = got.clip.provenance.license.split(" AND ");
  lic.why = [...(intake ? [rule.problem ?? (rule.tier !== got.tier ? `it is ${rule.tier} by the intake's rule, in a ${got.tier} set` : null)].filter((w): w is string => w !== null) : parts.filter((p) => tierOf(p) !== got.tier && tierOf(p) !== "cc0").map((p) => `its license ${p} doesn't fit its set's tier, ${got.tier} (D10)`)), ...[sourceProblem(got.clip)].filter((w): w is string => w !== null)];
  lic.ok = !lic.why.length;
  // an added clip: its motion, its poses (census) and its time-warped, mirror-aware distance (WP-9.3) against every other
  // library clip, the pull request's other added ones aside
  const dup: string[] = [];
  if (x.added) {
    dup.push(...(c.motions().get(motionOf(got.clip)) ?? []).filter((id) => id !== x.id).map((id) => `it is the motion of ${id}, which the library has already`), ...(run.twins.get(x.id) ?? []));
    const hit = run.near().check(got.clip, got.rest, { except: run.fresh }).duplicate;
    if (hit && !dup.some((w) => w.includes(hit.id))) dup.push(`a near-duplicate of ${hitText(hit)}: send a change of it as an improvement of ${hit.id}, through the intake`);
  }
  const all = [...gates, { gate: "dedup", ok: !dup.length, why: dup } as Gate];
  if (!intake || !all.every((g) => g.ok)) return all; // the retarget, the costliest, only for a clip that passes the rest
  const rigs = c.rigs.map((g) => onBody(got.clip, got.rest, g.bound, g.id)).filter((r) => !r.ok);
  return [...all, { gate: "retarget", ok: !rigs.length, why: rigs.map((r) => `on ${r.rig}: ${r.why.join("; ")}`) }];
}

/** The library's gates on the checkout at `root` for the clips `changed`: the library and its lock, the touched sets'
 *  licenses, and each clip's gates; one step each. */
export async function runGates(root: string, changed: readonly Changed[], rigs?: readonly Rig[], opts: GatesOptions = {}): Promise<Step[]> {
  const sets = join(root, "library/sets"), steps: Step[] = [], t0 = performance.now(), c = await openChecker(sets, rigs);
  try {
    c.lib.library.verify();
    steps.push({ name: "the library loads, every file as locked", ok: true, ms: performance.now() - t0, summary: `${c.lib.library.sets().length} sets, ${c.pool.length} clips` });
  } catch (err) {
    steps.push({ name: "the library loads, every file as locked", ok: false, ms: performance.now() - t0, summary: (err as Error).message.replace(/^library: /, "").slice(0, 200) });
  }
  const touched = [...new Set(changed.map((x) => x.id.split("/")[0]!))].sort(), lic = checkSets(c.lib.source, touched, c.lib.licenseText), bad = lic.findings.filter((f) => f.level === "fail");
  steps.push({ name: "licenses: the sets it touches", ok: lic.ok, ms: 0, summary: bad.length ? `${bad[0]!.where}: ${bad[0]!.message}` : `${touched.length ? touched.join(", ") : "none"}`, detail: bad.map((f) => `${f.where}: ${f.message}`) });
  // the added clips, by pose against the rest of the library, read together: their lineage cut, as the checker reads a
  // submission, so only their poses join them to another clip (a clip not in the library is its own step's failure)
  const fresh = changed.filter((x) => x.added && c.pool.some((p) => p.clip.id === x.id)).map((x) => x.id), twins = new Map<string, string[]>();
  if (fresh.length) {
    const pool = c.pool.map((p) => (fresh.includes(p.clip.id) ? { ...p, clip: { ...p.clip, provenance: { ...p.clip.provenance, src: "INTAKE", orig: undefined } as Clip["provenance"] } } : p));
    const { same } = census(pool, c.cc0);
    for (const id of fresh) twins.set(id, nearDuplicates(same, id, (k) => !fresh.includes(k)));
  }
  let reasons: QaReasons | undefined;
  const run: Run = { c, sets, twins, fresh, by: opts.by ?? "pr", near: () => opts.near ?? c.near(), reasons: () => (reasons ??= readReasons(join(sets, "../baselines/qa.json"))) };
  for (const x of changed) {
    const t = performance.now();
    try {
      const reason = bounceReason(gatesOf(x, run));
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
 *  request would add it (into its tier's intake set, or over the clip it improves, that clip's file its base), and each
 *  bad one again into an existing set (BARE_SET) without the intake's provenance, as a pull request outside the intake
 *  would; the gates run on each: one step each, ok when the gates fail a bad one with its fixture's gate and pass a
 *  clean one. The library's near-duplicate index is built once (or `index`, the library's, given). */
export async function plantedGates(only: string, root: string = ROOT, rigs?: readonly Rig[], index?: DedupIndex): Promise<{ steps: Step[] }> {
  const dir = scratchCheckout(root), steps: Step[] = [];
  try {
    const c = await openChecker(join(dir, "library/sets"), rigs), near = index ?? c.near(), fileOf = (id: string) => c.lib.source.read(id.split("/")[0]!, `${id.split("/")[1]!}.json`);
    for (const f of fixtures(c.lib, only)) {
      const clip = JSON.parse(f.text) as Clip, tier = licenseRule(clip, lineage(clip, c.lib.library, f.improves).derived).tier ?? "cc0";
      const plants: [string, Clip, string | undefined][] = [[f.name, { ...clip, id: f.improves ?? `${INTAKE_SETS[tier]}/${clip.id.split("/")[1]}` }, f.improves ? fileOf(f.improves) : undefined]];
      if (f.bare) plants.push([`${f.name}, outside the intake`, JSON.parse(f.bare) as Clip, undefined]);
      for (const [name, planted, was] of plants) {
        const t = performance.now(), w = writeClip(dir, planted);
        try {
          const out = await runGates(dir, [{ id: planted.id, added: was === undefined, ...(was === undefined ? {} : { was }) }], c.rigs, { near }), failed = out.filter((s) => !s.ok), reason = failed.map((s) => s.summary ?? s.name).join("; ");
          const want = f.expect === "bounced" ? `fail on ${f.gate}` : "pass", ok = f.expect === "bounced" ? failed.some((s) => s.summary?.startsWith(`${f.gate}: `)) : !failed.length;
          steps.push({ name: `${name} (${planted.id})`, ok, ms: performance.now() - t, summary: ok ? (failed.length ? `failed as it must: ${reason.slice(0, 110)}` : "passed as it must") : `it must ${want}: ${failed.length ? reason.slice(0, 110) : "every gate passed"}` });
        } finally {
          w.restore();
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { steps };
}
