// A clip's facts and contacts, measured (PLAN.md WP-5.4, spec/MOTION.md §7.1 and §7.3): every fact core measures from
// the motion on the clip's own rest (speed, travel, height range, a loop's seam, an attack's strikes) and the planted
// intervals it detects, written into the clip by the tool that writes it (the importer, the migrator), marked with this
// module's revision. A speed the source gave (a capture's own travel over its cycle) is kept, and named in `captured`:
// feet planted on a decoded clip estimate it within 5% at the median but miss an odd gait's by half. A loop whose set's
// import spec names one of core's contact readings carries that reading's contacts, labelled (`withReading`, D129). And
// the tags read against the facts: a clip tagged `loop` must close, and a `run` must travel or be marked `inplace`.
import { clip as coreClip, measureFacts, type Clip, type Rest } from "@m3a/core";

type Contacts = NonNullable<Clip["contacts"]>;

/** Who measures the facts, and the revision: a change to what they say is a change to this. */
export const FACTS_BY = "m3a-facts@1";

/** A clip's facts as written (spec/MOTION.md §7.3): by whom, and what was measured. */
export interface ClipFacts {
  by: string;
  /** % of H0 a second a loop travels (as captured where `captured` names it). */
  speed?: number;
  /** [forward, right] % of H0 over the clip: its root's travel, or a loop's planted feet's. */
  travel?: [number, number];
  /** The hips' lowest and highest up, % of H0. */
  height: [number, number];
  /** A loop's jump from its last pose to its first (mm, the fingers aside). */
  seam?: number;
  /** When an attack's hand or foot moves fastest toward its target (s). */
  strike?: number[];
  /** The named reading of core's (`clip.CONTACT_READINGS`) that gave a loop's labelled contacts (spec §7.1, §7.3, D129). */
  reading?: string;
  /** The facts the source gave rather than this module (`speed`). */
  captured?: string[];
}

/** A tag the facts don't bear out. */
export interface TagConflict {
  tag: string;
  /** What the facts say, and what the tag needs. */
  message: string;
}

const ms = (t: number) => Math.round(t * 1000) / 1000 + 0;
/** A number as its file holds it: no negative zero (JSON writes −0 as 0). */
const z = (x: number) => x + 0;
const ENDS = ["footL", "footR", "handL", "handR"] as const;

/** The speed a clip's writer took from its source, if any: its facts' `speed` when another tool wrote them, or one
 *  this module kept as captured. */
export function capturedSpeed(clip: Pick<Clip, "facts">): number | undefined {
  const f = clip.facts as Partial<ClipFacts> | undefined;
  if (!f || typeof f.speed !== "number") return undefined;
  return f.by !== FACTS_BY || f.captured?.includes("speed") ? f.speed : undefined;
}

/**
 * A clip's facts and contacts on its rest R, measured afresh (labelled contacts are kept as written, a source's or a
 * named reading's, whose name `facts.reading` keeps; detected ones are detected again). `speed`: the source's, kept in place of the one planted feet give.
 */
export function measure(clip: Clip, R: Rest, speed?: number): { facts: ClipFacts; contacts: Contacts } {
  const own = clip.contacts?.by === "labelled" ? clip.contacts : undefined, f = measureFacts({ ...clip, contacts: own }, R);
  const contacts: Contacts = { by: own ? "labelled" : "detected" };
  for (const end of ENDS) {
    const list = f.contacts[end];
    if (list?.length) contacts[end] = list.map(([a, b]) => [ms(a), ms(b)] as [number, number]);
  }
  const facts: ClipFacts = { by: FACTS_BY, height: [z(f.height[0]), z(f.height[1])] };
  if (speed !== undefined) [facts.speed, facts.captured] = [speed, ["speed"]];
  else if (f.speed !== undefined) facts.speed = z(f.speed);
  if (f.travel) facts.travel = [z(f.travel[0]), z(f.travel[1])];
  if (f.seam !== undefined) facts.seam = z(f.seam);
  if (f.strike?.length) facts.strike = f.strike.map(ms);
  // the named reading that gave labelled contacts is part of their record (spec §7.1, §7.3, D129)
  const reading = own ? (clip.facts as { reading?: unknown } | undefined)?.reading : undefined;
  if (typeof reading === "string") facts.reading = reading;
  return { facts, contacts };
}

/** The clip with its facts and contacts measured (`measure`), its source's speed kept. */
export function withFacts(clip: Clip, R: Rest): Clip {
  const { facts, contacts } = measure(clip, R, capturedSpeed(clip));
  return { ...clip, facts: facts as unknown as Clip["facts"], contacts };
}

/**
 * The clip with its contacts written by a named reading of core's (`clip.readContacts`, D129) and its facts measured
 * from them, its source's speed kept: the contacts `labelled`, which every reader plays as written (`playable`,
 * `measure`), moves with the keys when a game retimes the loop and never detects again, and `facts.reading` naming the
 * reading, as spec/MOTION.md §7.1 and §7.3 record a tool's chosen reading. Only a reading D108 would keep is written: a
 * one-shot, a clip tagged off its feet (core's OFF_FEET), a clip with a root of its own, and a reading that doesn't
 * stand (both feet plant, a foot down a fifth of the loop's samples, core's `stands`) throw.
 */
export function withReading(clip: Clip, R: Rest, reading: coreClip.ContactReading): Clip {
  if (!clip.loop) throw new Error(`${clip.id}: a named contact reading reads a loop; a one-shot keeps its detected contacts (D108)`);
  const off = clip.tags.find((t) => (coreClip.OFF_FEET as readonly string[]).includes(t));
  if (off) throw new Error(`${clip.id}: tagged ${off}, off its feet: it keeps the strict reading, no named one (D108)`);
  const contacts = coreClip.readContacts(clip, R, reading);
  if (!stands(clip, contacts)) throw new Error(`${clip.id}: the reading "${reading}" doesn't stand (both feet plant, a foot down a fifth of the loop: D108), so it isn't written`);
  return withFacts({ ...clip, contacts: { ...contacts, by: "labelled" }, facts: { ...(clip.facts ?? { by: FACTS_BY }), reading } as Clip["facts"] }, R);
}

/** Whether `contacts` hold a loop up as core's `stands` reads them (D108): both feet plant, and a foot is down at least
 *  a fifth of sampleAll's samples (its grid at 60 a second). */
function stands(clip: Clip, contacts: Contacts): boolean {
  if (!contacts.footL?.length || !contacts.footR?.length) return false;
  const n = Math.max(1, Math.ceil(clip.dur * 60)), dt = clip.dur / n, c = { ...clip, contacts };
  let down = 0;
  for (let i = 0; i <= n; i++) {
    const at = coreClip.contactsAt(c, i * dt);
    if (at.footL || at.footR) down++;
  }
  return down >= 0.2 * (n + 1);
}

/** A loop is open when its seam is past the sensors' seam fail level (60 mm at a hip height of 950 mm, scaled). */
const OPEN_SEAM = 60;
/** A run travels when it covers at least this much of its hip height a second (the importer's least speed). */
const RUN_SPEED = 10;

/** The tags a clip's facts don't bear out: `loop` on a loop that doesn't close; `run` on a loop that doesn't travel
 *  (unless it is tagged `inplace` too). */
export function tagConflicts(clip: Pick<Clip, "tags" | "loop">, facts: ClipFacts, R: Pick<Rest, "H0">): TagConflict[] {
  const out: TagConflict[] = [], open = (OPEN_SEAM * R.H0) / 950;
  if (clip.tags.includes("loop") && (facts.seam ?? 0) > open) out.push({ tag: "loop", message: `its last pose is ${facts.seam} mm from its first (a loop closes within ${Math.round(open)} mm)` });
  if (clip.tags.includes("run") && clip.loop && !clip.tags.includes("inplace") && !((facts.speed ?? 0) >= RUN_SPEED)) out.push({ tag: "run", message: `it travels ${facts.speed ?? 0}% of its hip height a second (a run travels ${RUN_SPEED}% or more, or is tagged inplace)` });
  return out;
}
