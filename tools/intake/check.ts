// The checker (PLAN.md §5.9, WP-9.1a): the submissions the queue holds as `submitted` (and any a run cut short left
// `checking`), each moved to `checking`, its clip read (a recipe compiled on the checkout's library), and every gate
// run: the platform-neutral ones of packages/tools/src/tools/library-submit.ts (schema, budgets, provenance, license,
// text, lint, sensors), then dedup (its motion hash against every library clip's and every submission's the owner has
// decided or is deciding, an archived or rejected one's kept so a resubmitted motion is recognized; near-duplicates of
// library clips by pose, tools/qa/census.ts, the whole batch read at once, and time-warped and mirror-aware against the
// library's DedupIndex, WP-9.3) and the retarget onto the reference rigs (the judge, packages/tools/src/tools/judge.ts:
// no fail finding the body adds). A failure is bounced with its reason;
// a pass gets its preview sheet, drawn by the sensors' raster, and waits for the owner (`awaiting review`). Submission
// text is data: no reason quotes it.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { format, type Bound, type Clip, type Rest } from "@m3a/core";
import { DedupIndex, hitText, LibraryError } from "@m3a/library";
import { metrics, sheet } from "@m3a/sensors";
import { png } from "@m3a/sensors/node";
import type { IntakeStore, Submission } from "../../packages/tools/src/intake/index.ts";
import type { LibraryAccess } from "../../packages/tools/src/registry/registry.ts";
import { onBody } from "../../packages/tools/src/tools/judge.ts";
import { bounceReason, clipGates, clipOf, gateInput, INTAKE_SETS, licenseRule, type Gate, type GateInput } from "../../packages/tools/src/tools/library-submit.ts";
import { census } from "../qa/census.ts";
import { libraryClips, type LibraryClip } from "../qa/qa.ts";
import { rigOf } from "../sweep/sweep.ts";
import { libraryAt, sha256 } from "./host.ts";

/** The checker's revision, in every report it writes. */
export const CHECKER = "m3a-intake-check@1";
/** The reference rigs a submission is retargeted onto: a generated test character and G4's two real CC0 rigs, of two
 *  authors and two rig conventions (`npm run fixtures -- fetch` caches them). */
export const REFERENCE_RIGS: readonly string[] = ["gen-0", "quaternius-mannequin-m", "kaykit-knight"];
/** The states of a submission the owner has decided or is deciding: a motion among them is no new submission. */
const PRIOR: readonly Submission["state"][] = ["awaiting review", "adopted", "archived", "rejected"];

/** cl100k tokens of a text, as the doctrine's budgets count catalog rows. */
export const cl100k = (t: string): number => encode(t).length;
/** A clip's motion hash (spec/MOTION.md §7.6) with Node's SHA-256: core's motionHash, faster. */
export const motionOf = (c: Clip): string => sha256(format.motionText(c));

/** What the checker reads a checkout by: its library at every shipped tier, its clips, the library clips of each
 *  motion hash (hashed on first use), the library's near-duplicate index (WP-9.3, built on first use), its CC0 sets,
 *  and the reference rigs bound. */
export interface Checker {
  lib: LibraryAccess;
  pool: LibraryClip[];
  motions(): Map<string, string[]>;
  near(): DedupIndex;
  cc0: ReadonlySet<string>;
  rigs: { id: string; bound: Bound }[];
}

/** A reference rig bound, by id. */
export type Rig = Checker["rigs"][number];

/** The reference rigs `ids` bound (a rig not cached is refused, naming the fetch that caches it). */
export const bindRigs = async (ids: readonly string[] = REFERENCE_RIGS): Promise<Rig[]> => Promise.all(ids.map(async (id) => ({ id, bound: (await rigOf(id)).core })));

/** The checker on the checkout whose library/sets/ is `sets`, with the reference rigs bound (or `rigs`, bound
 *  already). */
export async function openChecker(sets: string, rigs?: readonly Rig[]): Promise<Checker> {
  const lib = libraryAt(sets), pool = libraryClips(sets), cc0 = new Set(lib.library.sets().filter((s) => s.tier === "cc0").map((s) => s.set));
  let motions: Map<string, string[]> | undefined;
  const hashed = () => {
    if (motions) return motions;
    motions = new Map();
    for (const c of pool) {
      const m = motionOf(c.clip);
      motions.set(m, [...(motions.get(m) ?? []), c.clip.id]);
    }
    return motions;
  };
  let index: DedupIndex | undefined;
  const near = () => (index ??= DedupIndex.of(pool));
  return { lib, pool, motions: hashed, near, cc0, rigs: rigs ? [...rigs] : await bindRigs() };
}

/** What the checker records of a submission: its gates (the retarget only when every other one passed), its motion
 *  hash, the sensors' verdict, each rig's outcome, the set it would join, and its preview sheet (its path in the
 *  store's directory, SHA-256 and size; null when bounced or when the store keeps no files, the hosted one's bucket
 *  being G9's). */
export interface CheckReport {
  checker: string;
  gates: Gate[];
  motion: string | null;
  sensors: { verdict: string; findings: number } | null;
  rigs: { rig: string; ok: boolean; why: string[] }[];
  joins: string | null;
  sheet: { path: string; sha256: string; width: number; height: number } | null;
}

/** One submission checked: its id, the state it moved to, the reason when bounced, and the report. */
export interface Checked {
  id: string;
  state: "bounced" | "awaiting review";
  reason: string | null;
  report: CheckReport;
}

/** A submission read for the gates: its clip (null when it is none: `problem` says why) and the gates' input. */
interface Read {
  s: Submission;
  clip: Clip | null;
  input: GateInput | null;
  problem: string | null;
}

/** A submission's clip and gate input, or why it has none (no JSON, a recipe that doesn't compile, an improves the
 *  library hasn't). A recipe's clip is the compiler's, its provenance the compiler's too. */
function read(s: Submission, c: Checker): Read {
  try {
    const clip = clipOf(s.kind, s.text, c.lib.library), i = gateInput(clip, s.kind, s.improves, c.lib, cl100k);
    if (i.lineage.length) return { s, clip, input: i, problem: i.lineage[0]! };
    return { s, clip, input: i, problem: null };
  } catch (err) {
    const why = err instanceof LibraryError ? `--improves names ${s.improves}, which the library hasn't (${err.code}): improve a library clip, SET/Clip` : (err as Error).message;
    return { s, clip: null, input: null, problem: why };
  }
}

/**
 * What census `same` says of `key`'s near-duplicates by pose among the clips `counts` keeps (named by `name`): one
 * line, the clips of its group, the one its own link names first, with that link's words; none when it has no group.
 * `improves` adds the hint to submit it as an improvement of a library clip instead.
 */
export function nearDuplicates(same: Record<string, { as: string; why: string }>, key: string, counts: (id: string) => boolean, name: (id: string) => string = (id) => id, improves = false): string[] {
  const root = same[key]?.as ?? key, why = same[key]?.why;
  const kin = [root, ...Object.keys(same).filter((id) => same[id]!.as === root)].filter((id) => id !== key && counts(id)).sort((a, b) => Number(why?.includes(b) ?? false) - Number(why?.includes(a) ?? false));
  if (!kin.length) return [];
  const how = (why ?? same[kin[0]!]?.why ?? "by pose").replace(/INTAKE\//g, ""), lib = kin.find((k) => !k.startsWith("INTAKE/"));
  return [`a near-duplicate of ${kin.slice(0, 2).map(name).join(" and ")}${kin.length > 2 ? ` and ${kin.length - 2} more` : ""} (${how})${improves && lib ? `; if it improves ${lib}, submit it with --improves ${lib}` : ""}`];
}

/** The census's name for a submission's clip: in a set of its own, its lineage cut, so only its poses join it. */
const pooled = (id: string, clip: Clip, rest: Rest): LibraryClip => ({ set: "INTAKE", clip: { ...clip, id: `INTAKE/${id}`, provenance: { ...clip.provenance, src: "INTAKE", orig: undefined } as Clip["provenance"] }, rest });

/** The dedup gate's problems for each submission read: its motion among the library's or a prior submission's, or its
 *  poses within a library clip's or a prior submission's (census), the clip it improves and its kin aside. */
function dedup(batch: readonly Read[], prior: readonly Read[], c: Checker): Map<string, string[]> {
  const out = new Map<string, string[]>(), mine = (r: Read) => r.clip !== null && r.input?.rest != null && !r.problem;
  const pool = [...c.pool, ...[...batch, ...prior].filter(mine).map((r) => pooled(r.s.id, r.clip!, r.input!.rest!))];
  const { same } = census(pool, c.cc0), rootOf = (id: string) => same[id]?.as ?? id, state = new Map(prior.map((r) => [`INTAKE/${r.s.id}`, r.s]));
  for (const r of batch.filter(mine)) {
    const why: string[] = [], m = motionOf(r.clip!), libs = c.motions().get(m) ?? [], base = r.s.improves ? (r.input!.base?.id ?? r.s.improves) : null;
    for (const id of libs.filter((x) => x !== base).slice(0, 2)) why.push(`it is the motion of ${id}, which the library has already`);
    if (base && libs.includes(base)) {
      const was = c.lib.library.clip(base).clip, now = r.clip!;
      if (was.name === now.name && was.desc === now.desc && was.tags.join(" ") === now.tags.join(" ")) why.push(`it is ${base} as the library has it: change what it improves`);
    }
    for (const p of prior.filter((x) => x.s.id !== r.s.id && x.clip && motionOf(x.clip) === m)) {
      const d = p.s.decision, note = d?.note.trim() ? `; the owner's note: ${d.note.replace(/\s+/g, " ").trim().slice(0, 120)}` : "";
      why.push(p.s.state === "archived" || p.s.state === "rejected" ? `it is the motion of ${p.s.id}, ${p.s.state} on ${d?.date ?? "a past review"}${note}: a resubmitted motion isn't reviewed again` : `it is the motion of ${p.s.id}, already ${p.s.state}`);
    }
    // by pose: the submission's census group, unless it is the group of the clip it improves
    const key = `INTAKE/${r.s.id}`, root = rootOf(key);
    // (a prior submission's exact motion said already, its near poses aren't said again)
    if (!base || root !== rootOf(base)) why.push(...nearDuplicates(same, key, (id) => !id.startsWith("INTAKE/") || (state.has(id) && !why.some((w) => w.includes(id.slice(7)))), (id) => (id.startsWith("INTAKE/") ? `${id.slice(7)} (${state.get(id)!.state})` : id), true));
    // time-warped and mirror-aware (WP-9.3): a library clip retimed, trimmed, mirrored or lightly edited, which the
    // census's pose match misses; the clip it improves and that clip's copies (its census group) aside, and said once
    // when the census named it already
    const kin = base ? c.pool.map((p) => p.clip.id).filter((id) => id === base || rootOf(id) === rootOf(base)) : [];
    const hit = c.near().check(r.clip!, r.input!.rest!, { except: kin }).duplicate;
    if (hit && !why.some((w) => w.includes(hit.id))) why.push(`a near-duplicate of ${hitText(hit)}; if it improves ${hit.id}, submit it with --improves ${hit.id}`);
    out.set(r.s.id, why);
  }
  return out;
}

/**
 * Checks every new submission in `store` (the checker's role) on checker `c`: each moved to `checking`, gated, then
 * bounced with its reason or moved to `awaiting review` with its report and preview sheet (a PNG in `sheets`, the local
 * store's directory, when given). One at a time, in id order; the batch's near-duplicates are read together.
 */
export async function check(store: IntakeStore, c: Checker, opts: { sheets?: string | null } = {}): Promise<Checked[]> {
  const all = await store.list(), todo = all.filter((s) => s.state === "submitted" || s.state === "checking");
  for (const s of todo) if (s.state === "submitted") await store.advance(s.id, "checking");
  const batch = todo.map((s) => read(s, c)), prior = all.filter((s) => PRIOR.includes(s.state)).map((s) => read(s, c)), twins = dedup(batch, prior, c), out: Checked[] = [];
  for (const r of batch) {
    const gates: Gate[] = r.input ? clipGates(r.input) : [{ gate: "schema", ok: false, why: [] }];
    if (r.problem) gates[0] = { ...gates[0]!, ok: false, why: [r.problem, ...gates[0]!.why] };
    const valid = gates[0]!.ok && r.input?.rest != null, report: CheckReport = { checker: CHECKER, gates, motion: null, sensors: null, rigs: [], joins: null, sheet: null };
    if (valid) {
      const clip = r.clip!, R = r.input!.rest!, lic = licenseRule(clip, r.input!.derived);
      const m = metrics(clip, R);
      [report.motion, report.sensors] = [motionOf(clip), { verdict: m.verdict, findings: m.findings.length }];
      gates.push({ gate: "dedup", ok: !twins.get(r.s.id)?.length, why: twins.get(r.s.id) ?? [] });
      // the costliest gate last, and only for a clip every other gate passes (a bounce says the first reason anyway)
      if (gates.every((g) => g.ok)) {
        report.rigs = c.rigs.map((g) => onBody(clip, R, g.bound, g.id)).map((x) => ({ rig: x.rig, ok: x.ok, why: x.why }));
        gates.push({ gate: "retarget", ok: report.rigs.every((x) => x.ok), why: report.rigs.filter((x) => !x.ok).map((x) => `on ${x.rig}: ${x.why.join("; ")}`) });
      }
      report.joins = r.s.improves ? (r.input!.base?.id.split("/")[0] ?? null) : lic.tier ? INTAKE_SETS[lic.tier] : null;
    }
    const reason = bounceReason(gates) ?? (valid ? null : "schema: it isn't a clip the library can read");
    if (!reason && opts.sheets) {
      const sh = sheet(r.clip!, r.input!.rest!, { title: `${r.s.id} ${r.clip!.dur.toFixed(2)} s` }), bytes = png(sh.image), path = join(opts.sheets, "sheets", `${r.s.id}.png`);
      mkdirSync(join(opts.sheets, "sheets"), { recursive: true });
      writeFileSync(path, bytes);
      report.sheet = { path: `sheets/${r.s.id}.png`, sha256: createHash("sha256").update(bytes).digest("hex"), width: sh.width, height: sh.height };
    }
    const state = reason ? "bounced" : "awaiting review";
    await store.advance(r.s.id, state, { ...(reason ? { reason } : {}), report, ...(report.motion ? { motion: report.motion } : {}) });
    out.push({ id: r.s.id, state, reason, report });
  }
  return out;
}
