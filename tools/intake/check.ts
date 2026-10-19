// The checker (PLAN.md §5.9, WP-9.1a): the submissions the queue holds as `submitted` (and any a run cut short left
// `checking`), each moved to `checking`, its clip read (a recipe compiled on the checkout's library), and every gate
// run: the platform-neutral ones of packages/tools/src/tools/library-submit.ts (schema, budgets, provenance, license,
// text, lint, sensors), then dedup (its motion hash against every library clip's and every submission's the owner has
// decided or is deciding, an archived or rejected one's kept so a resubmitted motion is recognized; near-duplicates of
// library clips by pose, tools/qa/census.ts, the whole batch read at once; and time-warped and mirror-aware, WP-9.3's
// DedupIndex, against the library's clips and against the submissions decided, being decided or passed earlier in the
// run) and the retarget onto the reference rigs (the judge, packages/tools/src/tools/judge.ts: no fail finding the
// body adds). A failure is bounced with its reason; a pass gets its preview sheet, drawn by the sensors' raster, and
// waits for the owner (`awaiting review`). One submission's failure is its own: a gate that throws bounces it, a store
// that refuses its move leaves it for the next run, and the batch goes on. Submission text is data: no reason quotes
// it.
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
    const why = err instanceof LibraryError ? `--improves names ${/^[A-Z][A-Z0-9_]*\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(s.improves ?? "") ? s.improves : "a clip"}, which the library hasn't (${err.code}): improve a library clip, SET/Clip` : (err as Error).message;
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

/** The near-duplicate index of the submissions the owner has decided or is deciding (`prior`), each by its id in the
 *  census's set (INTAKE/<id>), as the library's index holds the library's clips. */
const submissionsIndex = (prior: readonly Read[], mine: (r: Read) => boolean): DedupIndex => DedupIndex.of(prior.filter(mine).map((r) => ({ clip: { ...r.clip!, id: `INTAKE/${r.s.id}` }, rest: r.input!.rest! })));

/** The dedup gate (WP-9.1, WP-9.3) on a batch: `problems` gives a submission's (its motion among the library's or a
 *  prior submission's; its poses within a library clip's or a prior submission's, census, the clip it improves and its
 *  kin aside; time-warped and mirror-aware, DedupIndex, against the library's clips and against the prior and earlier
 *  passed submissions, each queried by the submission's own id in the census's set, never the id its clip claims);
 *  `passed` adds one that waits for review to the submissions' index, so a later one in the run is held to it. */
function dedup(batch: readonly Read[], prior: readonly Read[], c: Checker): { problems(r: Read): string[]; passed(r: Read): void } {
  const mine = (r: Read) => r.clip !== null && r.input?.rest != null && !r.problem, pool = (rs: readonly Read[]) => [...c.pool, ...rs.filter(mine).map((r) => pooled(r.s.id, r.clip!, r.input!.rest!))];
  // the census over the whole batch at once; if it can't be read so, each submission's own with the prior ones
  let whole: ReturnType<typeof census>["same"] | null;
  try {
    whole = census(pool([...batch, ...prior]), c.cc0).same;
  } catch {
    whole = null;
  }
  // the prior submissions by their census id (the census names those), and the run's own passed ones (the index does)
  const state = new Map(prior.map((r) => [`INTAKE/${r.s.id}`, r.s.state])), passed = new Set<string>(), subs = submissionsIndex(prior, mine), improving = new Map(prior.map((r) => [`INTAKE/${r.s.id}`, r.s.improves]));
  const named = (id: string) => (id.startsWith("INTAKE/") ? `${id.slice(7)} (${state.get(id) ?? (passed.has(id) ? "awaiting review" : "a submission")})` : id);
  return {
    problems(r) {
      if (!mine(r)) return [];
      const same = whole ?? census(pool([r, ...prior]), c.cc0).same, rootOf = (id: string) => same[id]?.as ?? id;
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
      if (!base || root !== rootOf(base)) why.push(...nearDuplicates(same, key, (id) => !id.startsWith("INTAKE/") || (state.has(id) && !why.some((w) => w.includes(id.slice(7)))), named, true));
      // time-warped and mirror-aware (WP-9.3): a clip retimed, trimmed, mirrored or lightly edited, which the census's
      // pose match misses; queried as the submission (INTAKE/<id>), so a clip claiming a library clip's id is no copy of
      // itself. The clip it improves stands aside with its kin: its census group and the clips the index finds one
      // motion with it (a mirrored twin, which the census reads apart); and so do the submissions improving it too.
      const self = { ...r.clip!, id: key }, kin = base ? [base, ...c.pool.map((p) => p.clip.id).filter((id) => rootOf(id) === rootOf(base))] : [];
      if (base && r.input!.base) kin.push(...c.near().query(r.input!.base.clip, r.input!.base.rest).hits.map((h) => h.id));
      const hits = [c.near().check(self, r.input!.rest!, { except: kin }).duplicate, subs.check(self, r.input!.rest!, { except: base ? [...improving].filter(([, b]) => b === base).map(([id]) => id) : [] }).duplicate];
      for (const hit of hits) if (hit && !why.some((w) => w.includes(hit.id.replace(/^INTAKE\//, "")))) why.push(`a near-duplicate of ${hitText({ ...hit, id: named(hit.id) })}${hit.id.startsWith("INTAKE/") ? "" : `; if it improves ${hit.id}, submit it with --improves ${hit.id}`}`);
      return why;
    },
    passed(r) {
      if (!mine(r) || subs.has(`INTAKE/${r.s.id}`)) return;
      subs.add({ ...r.clip!, id: `INTAKE/${r.s.id}` }, r.input!.rest!);
      improving.set(`INTAKE/${r.s.id}`, r.s.improves);
      passed.add(`INTAKE/${r.s.id}`);
    },
  };
}

/** What the checker records of a submission it couldn't gate (a gate threw on it): no submission text, only what to
 *  do. */
const CANT = "schema: the checker's gates couldn't read it (one threw on it): send a clip the validator and m3a lint pass, made on a library rest";

/**
 * Checks every new submission in `store` (the checker's role) on checker `c`: each moved to `checking`, gated, then
 * bounced with its reason or moved to `awaiting review` with its report and preview sheet (a PNG in `sheets`, the local
 * store's directory, when given). One at a time, in id order; the batch's near-duplicates are read together, and one
 * that waits for review holds the later ones to it. A gate that throws on a submission bounces it; a store that
 * refuses a move leaves that one (it is taken again next run) and goes on.
 */
export async function check(store: IntakeStore, c: Checker, opts: { sheets?: string | null } = {}): Promise<Checked[]> {
  const all = await store.list(), todo = all.filter((s) => s.state === "submitted" || s.state === "checking"), moved: Submission[] = [];
  for (const s of todo) {
    if (s.state === "checking") moved.push(s);
    else
      await store.advance(s.id, "checking").then(
        () => moved.push(s),
        () => {}, // left for the next run
      );
  }
  const batch = moved.map((s) => read(s, c)), prior = all.filter((s) => PRIOR.includes(s.state)).map((s) => read(s, c)), twins = dedup(batch, prior, c), out: Checked[] = [];
  for (const r of batch) {
    let got: Checked;
    try {
      got = gated(r, c, twins, opts.sheets ?? null);
    } catch {
      got = { id: r.s.id, state: "bounced", reason: CANT, report: { checker: CHECKER, gates: [{ gate: "schema", ok: false, why: [CANT.slice(8)] }], motion: null, sensors: null, rigs: [], joins: null, sheet: null } };
    }
    const move = (x: Checked, report: unknown) => store.advance(r.s.id, x.state, { ...(x.reason ? { reason: x.reason } : {}), report, ...(x.report.motion ? { motion: x.report.motion } : {}) }).then(() => true, () => false);
    // a store that refuses the move (what it won't hold): a bounce sent again with the plain reason and no report;
    // anything else left in `checking`, taken again next run
    let sent = await move(got, got.report);
    if (!sent && got.state === "bounced") sent = await move((got = { ...got, reason: CANT }), null);
    if (!sent) continue;
    if (got.state === "awaiting review") twins.passed(r);
    out.push(got);
  }
  return out;
}

/** One submission through every gate on checker `c`: its outcome, report and preview sheet (in `sheets`, when given). */
function gated(r: Read, c: Checker, twins: ReturnType<typeof dedup>, sheets: string | null): Checked {
  const gates: Gate[] = r.input ? clipGates(r.input) : [{ gate: "schema", ok: false, why: [] }];
  if (r.problem) gates[0] = { ...gates[0]!, ok: false, why: [r.problem, ...gates[0]!.why] };
  const valid = gates[0]!.ok && r.input?.rest != null, report: CheckReport = { checker: CHECKER, gates, motion: null, sensors: null, rigs: [], joins: null, sheet: null };
  if (valid) {
    const clip = r.clip!, R = r.input!.rest!, lic = licenseRule(clip, r.input!.derived);
    const m = metrics(clip, R), why = twins.problems(r);
    [report.motion, report.sensors] = [motionOf(clip), { verdict: m.verdict, findings: m.findings.length }];
    gates.push({ gate: "dedup", ok: !why.length, why });
    // the costliest gate last, and only for a clip every other gate passes (a bounce says the first reason anyway)
    if (gates.every((g) => g.ok)) {
      report.rigs = c.rigs.map((g) => onBody(clip, R, g.bound, g.id)).map((x) => ({ rig: x.rig, ok: x.ok, why: x.why }));
      gates.push({ gate: "retarget", ok: report.rigs.every((x) => x.ok), why: report.rigs.filter((x) => !x.ok).map((x) => `on ${x.rig}: ${x.why.join("; ")}`) });
    }
    report.joins = r.s.improves ? (r.input!.base?.id.split("/")[0] ?? null) : lic.tier ? INTAKE_SETS[lic.tier] : null;
  }
  const reason = bounceReason(gates) ?? (valid ? null : "schema: it isn't a clip the library can read");
  if (!reason && sheets) {
    const sh = sheet(r.clip!, r.input!.rest!, { title: `${r.s.id} ${r.clip!.dur.toFixed(2)} s` }), bytes = png(sh.image), path = join(sheets, "sheets", `${r.s.id}.png`);
    mkdirSync(join(sheets, "sheets"), { recursive: true });
    writeFileSync(path, bytes);
    report.sheet = { path: `sheets/${r.s.id}.png`, sha256: createHash("sha256").update(bytes).digest("hex"), width: sh.width, height: sh.height };
  }
  return { id: r.s.id, state: reason ? "bounced" : "awaiting review", reason, report };
}
