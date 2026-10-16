// Catalog-driven import (PLAN.md WP-5.2; carried from my-3d2dge tools/anim-import.mjs's run section): libraries read
// as captures (any reader here), each measured from its own rest-pose clip, then every clip fitted with as few key
// poses as keep it within `tol` mm of the capture (core's codec), with a fit report per clip. A catalog, written by
// hand, drives it: `$sources` says where each library came from, `$pick` names the stretches of capture takes,
// `$skip` leaves clips out with the reason on record, and each clip's entry gives its tags (`loop` and `once` set
// whether it loops), what the body does and, for a copy of another set's clip, the clip it came from (`orig`). CMU's
// `$sources.CMU` becomes one record a subject (`CMU_NN`), and a pick that names only its take plays the stretch where
// the take moves, at its own rate, as the ledger measured it (tools/corpora). `subset` makes a smaller set from bigger
// ones (carried from my-3d2dge tools/anim-set.mjs): the clips a game adopts, with their libraries' records.
import { format, skeleton, type Rest } from "@m3a/core";
import { IoError } from "./bytes.ts";
import type { Capture, Look } from "./gltf/read.ts";
import type { Pick } from "./takes.ts";

/** Where a library came from, as the catalog's `$sources` says. */
export interface SourceInfo {
  label?: string;
  origin?: string;
  license?: string;
  url?: string;
  [k: string]: unknown;
}
/** A hand-written catalog: sources, picks, skips, and per clip [tags, what the body does, orig?]. */
export interface Catalog {
  $sources?: Record<string, SourceInfo>;
  /** Each clip's take and stretch: [take, from s, to s, a loop's shortest cycle s]. */
  $pick?: Record<string, [string, number?, number?, number?]>;
  /** Clips left out on purpose, each with why. */
  $skip?: Record<string, string>;
  [clip: string]: [string, string, string?] | Record<string, unknown> | undefined;
}
/** One library to import: its source id, its file, and its reader's result. */
export interface LibraryIn {
  id: string;
  file: string;
  rig: string;
  clips: Record<string, Capture>;
  body?: Look | null;
  /** The clip its rest pose comes from (else a T-pose or rest clip, else its first clip's first frame). */
  rest?: string;
  /** A CMU subject's line ("run"), named in its record when the catalog's `$sources.CMU` stands for every subject. */
  about?: string;
}
/** A clip as the importer writes it (format 1, its source and take, the fit's keys; a loop that travels, its speed). */
export interface ImportedClip {
  clip: string;
  src: string;
  take?: string;
  orig?: string;
  dur: number;
  loop: boolean;
  /** How fast a loop cut from a take travelled: percent of standing hip height a second (10 or more; shardfall's). */
  speed?: number;
  tags?: string[];
  desc?: string;
  keys: unknown[];
}
/** The imported set (format 1, as the migrator reads it) and its fit report. */
export interface Imported {
  set: { set: string; title?: string; format: 1; credit: string; fps: number; sources: Record<string, SourceInfo & { file: string; rig: string; rest: Rest }>; body: Look | null; fit: Record<string, [number, number]>; clips: Record<string, ImportedClip> };
  /** Per clip: its source, the fit's mean and worst error (mm) and its keys; what was left out and why; warnings. */
  report: { clips: { name: string; src: string; mean: number; max: number; keys: number }[]; skipped: { name: string; why: string }[]; warnings: string[] };
}

const REST_NAMES = ["A_TPose", "T-Pose", "TPose", "Rest Pose", "Rest_Pose", "_rest"];
const entry = (cat: Catalog, name: string): [string, string, string?] | undefined => {
  const e = name.startsWith("$") ? undefined : cat[name];
  return Array.isArray(e) ? (e as [string, string, string?]) : undefined;
};

/** What a ledger says of a take (tools/corpora/cmu-takes.tsv): the stretch where it moves ("1.2-16.1"), its rate. */
export interface TakeRow {
  active?: string;
  fps?: string | number;
}

/**
 * The catalog's picks as capture readers take them: a stretch of a take, looping when its tags say `loop`. A pick that
 * names only its take plays the stretch where the take moves, at the take's own rate, when `takes` (a ledger) has it;
 * else `fps`.
 */
export function picksOf(cat: Catalog, fps?: number, takes: Record<string, TakeRow> = {}): Pick[] {
  return Object.entries(cat.$pick ?? {}).map(([name, [take, from0, to0, minCycle]]) => {
    const row = takes[take], act = row && /^[\d.]+-[\d.]+$/.test(row.active ?? "") ? row.active!.split("-").map(Number) : null;
    const [from, to] = from0 === undefined && act ? act : [from0, to0], rate = row?.fps !== undefined && row.fps !== "" ? +row.fps : fps;
    return { name, take, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}), ...(rate !== undefined ? { fps: rate } : {}), ...(minCycle !== undefined ? { minCycle } : {}), loop: (entry(cat, name)?.[0] ?? "").split(" ").includes("loop") };
  });
}

/** The catalog's record for a library: its own, or for CMU subject NN the catalog's `CMU` record naming the subject. */
function sourceOf(cat: Catalog, L: LibraryIn): SourceInfo | undefined {
  const own = cat.$sources?.[L.id], cmu = cat.$sources?.CMU, m = /^CMU_0*(\d+)$/.exec(L.id);
  if (own || !cmu || !m) return own;
  return { ...cmu, label: `${cmu.label ?? "CMU motion capture"}, subject ${m[1]}${L.about ? ` (${L.about})` : ""}`, url: `http://mocap.cs.cmu.edu/search.php?subjectnumber=${m[1]}` };
}

/**
 * Fits libraries into one set as the catalog says. A clip name is taken once (a later library's clip of a taken name is
 * left out); `_`-named clips are a reader's rest pose, not clips. `tol` is the fit's limit in mm (30); `encode` asks
 * for format 2's hands, spine curl and root yaw, a steady twist and closed loops (core's `fit`).
 */
export function importSet(libs: readonly LibraryIn[], cat: Catalog, opts: { name: string; title?: string; credit: string; fps?: number; tol?: number; only?: readonly string[]; blade?: RegExp; encode?: { hands?: boolean; spine?: boolean; yaw?: boolean; steadyTwist?: boolean; closeLoop?: boolean } }): Imported {
  const fps = opts.fps ?? 30, tol = opts.tol ?? 30, blade = opts.blade ?? /Sword/, warnings: string[] = [], skipped: Imported["report"]["skipped"] = [], fits: Imported["report"]["clips"] = [];
  const named = Object.keys(cat).filter((k) => !k.startsWith("$")).length > 0, only = opts.only ? new Set(opts.only) : null;
  const set: Imported["set"] = { set: opts.name, ...(opts.title ? { title: opts.title } : {}), format: 1, credit: opts.credit, fps, sources: {}, body: null, fit: {}, clips: {} };
  for (const L of libs) {
    const restClip = [L.rest, ...REST_NAMES].find((n) => n && L.clips[n]);
    if (!Object.keys(L.clips).length) throw new IoError("E_MISSING", "no clips", { file: L.file });
    const rest = skeleton.measure(L.clips, restClip);
    const about = sourceOf(cat, L);
    if (named && !about) warnings.push(`no "$sources" entry for ${L.id}: the set won't say where its clips came from`);
    set.sources[L.id] = { file: L.file, rig: L.rig, ...(about ?? {}), rest };
    if (!set.body && L.body) set.body = L.body;
    for (const [name, cap0] of Object.entries(L.clips)) {
      if (set.clips[name] || (only && !only.has(name)) || name.startsWith("_")) continue;
      if (cat.$skip?.[name]) {
        skipped.push({ name, why: cat.$skip[name]! });
        continue;
      }
      const cap = { ...cap0 }, c = entry(cat, name), extra: format.Extra = { blade: blade.test(name), ...(opts.encode ?? {}) };
      if (c) {
        const tags = c[0].split(" ").filter(Boolean);
        if (tags.includes("loop")) cap.loop = true;
        if (tags.includes("once")) cap.loop = false;
        extra.tags = tags.filter((t) => t !== "loop" && t !== "once");
        extra.desc = c[1];
      } else if (named) warnings.push(`no catalog entry for ${name}`);
      const { clip, max, mean } = format.fit(rest, cap, tol, extra);
      // a loop that walks or runs in place keeps how fast it travelled, so a player can match it to the ground; one
      // that hardly moves has none
      const speed = cap.loop && cap.stride !== undefined && cap.dur > 0 ? Math.round(((cap.stride / rest.H0) * 100) / cap.dur) : 0;
      // a one-frame take (a rest pose) holds its pose a frame: a clip lasts more than 0 s (M2-E014); its key is the fit's
      const out: ImportedClip = { clip: clip.clip, src: L.id, ...(cap.take ? { take: cap.take } : {}), ...(c?.[2] ? { orig: c[2] } : {}), dur: clip.dur > 0 ? clip.dur : Math.round(1000 / fps) / 1000, loop: clip.loop, ...(speed >= 10 ? { speed } : {}), ...(clip.tags ? { tags: clip.tags } : {}), ...(clip.desc ? { desc: clip.desc } : {}), keys: clip.keys };
      set.clips[name] = out;
      set.fit[name] = [Math.round(mean), Math.round(max)];
      fits.push({ name, src: L.id, mean, max, keys: clip.keys.length });
    }
  }
  for (const name of Object.keys(cat.$skip ?? {})) if (!skipped.some((s) => s.name === name)) warnings.push(`$skip names ${name}, which no library has`);
  return { set, report: { clips: fits, skipped, warnings } };
}

/** An imported set (format 1), as `importSet` writes it and `subset` reads it. */
export type SetFile = Imported["set"] & { from?: string | string[] };

/**
 * A smaller set from bigger ones: the clips named (`SET:Clip` where two sets have it), with the records of the
 * libraries they came from. The first set's first library leads (its proportions), and its look and rate are kept.
 */
export function subset(sets: readonly SetFile[], wants: readonly string[], opts: { name: string; title?: string; credit?: string }): SetFile {
  if (!sets.length) throw new IoError("E_MISSING", "no sets to pick from");
  const clips: SetFile["clips"] = {}, fit: SetFile["fit"] = {}, used = new Set<string>(), from: string[] = [];
  for (const want of wants) {
    const [setName, clipName] = want.includes(":") ? (want.split(":") as [string, string]) : [null, want];
    const hits = sets.filter((S) => (!setName || S.set === setName) && S.clips[clipName]);
    if (!hits.length) throw new IoError("E_MISSING", `no clip ${want} in ${sets.map((S) => S.set).join(", ")}`);
    if (hits.length > 1) throw new IoError("E_FORMAT", `${clipName} is in ${hits.map((S) => S.set).join(" and ")}: pick one as SET:${clipName}`);
    const S = hits[0]!, c = S.clips[clipName]!;
    if (clips[clipName]) throw new IoError("E_FORMAT", `${clipName} is picked twice`);
    if (!S.sources[c.src]) throw new IoError("E_MISSING", `${S.set} ${clipName}: its library ${c.src} is not on record`);
    clips[clipName] = c;
    if (S.fit[clipName]) fit[clipName] = S.fit[clipName]!;
    used.add(`${S.set}/${c.src}`);
    if (!from.includes(S.set)) from.push(S.set);
  }
  // the libraries the picked clips came from, with their records; the first set's first library leads
  const first = sets[0]!, lead = Object.keys(first.sources)[0], sources: SetFile["sources"] = {};
  if (lead) sources[lead] = first.sources[lead]!;
  for (const S of sets) for (const [id, rec] of Object.entries(S.sources)) if (used.has(`${S.set}/${id}`)) {
    if (sources[id] && JSON.stringify(sources[id]) !== JSON.stringify(rec)) throw new IoError("E_FORMAT", `two sets name a library ${id} with different records: rename one`);
    sources[id] = rec;
  }
  return { set: opts.name, ...(opts.title ? { title: opts.title } : {}), format: first.format, credit: opts.credit ?? first.credit, from: from.length === 1 ? from[0]! : from, fps: first.fps, sources, body: first.body, fit, clips };
}
