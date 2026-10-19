// Near-duplicate detection (PLAN.md WP-9.3): an index of clips' motion features (features.ts) that a clip is checked
// against, the intake's dedup gate (WP-9.1), and every pair within it, the library's own sweep. Two motions within NEAR
// mm a point of each other along the best time-warped alignment (distance.ts), and a SHARE more of how much the stiller
// moves, are one motion: a retimed, eased, trimmed, mirrored or lightly edited copy of a clip lies within it, and the
// library's distinct clips lie apart (a walk and its style's run, a jab and a cross, a capture's sidesteps to either
// side). Pairs are skipped by cheap bounds first (lengths, mean poses, how much each moves), so a clip is checked
// against the whole library in well under a second.
import type { Clip, Rest } from "@m3a/core";
import { centreDistance, comparable, motionDistance } from "./distance.ts";
import { motionFeatures, type MotionFeatures } from "./features.ts";

export { motionFeatures, framesFor, poseDistance, RATE, FRAMES, HIP, type MotionFeatures } from "./features.ts";
export { motionDistance, centreDistance, comparable, BAND, SLACK, PHASES, RETIME, STILL, type Alignment } from "./distance.ts";

/** Two motions this close (mm a point on average, on a body 950 mm at the hips) are one: a 1° lean of the chest moves
 *  a clip about 4 mm, a 4° one about 14; the library's nearest distinct clips lie 15 mm apart (strafes, mirrored). */
export const NEAR = 12;
/** How much further two clips that move a lot may lie and still be one, as a share of how much the stiller moves (mm
 *  a point from its mean pose): a clip sweeping half a metre can't be retimed or refitted as closely as a still one. */
export const SHARE = 0.02;
/** A pair is compared in full only when its mean poses, and how much each moves, lie within this many times the
 *  distance asked for (over time or along the paths the poses trace). */
export const PREFILTER = 3;

/** The distance under which two motions are one: `base` (NEAR), and SHARE of how much the stiller one moves. */
export const nearFor = (a: MotionFeatures, b: MotionFeatures, base = NEAR): number => base + SHARE * Math.min(a.spread, b.spread);

/** A clip found near another: its id, how far (mm a point on average), whether mirrored, and the distance under
 *  which the two are one (nearFor). */
export interface DedupHit {
  id: string;
  mm: number;
  mirrored: boolean;
  under: number;
}
/** A clip checked against the index: the clip it duplicates (the nearest it is one motion with) or null, every clip it
 *  is one motion with, nearest first, how many were compared in full, and a sentence saying so. */
export interface DedupCheck {
  duplicate: DedupHit | null;
  near: DedupHit[];
  compared: number;
  message: string;
}
/** Two indexed clips that are one motion. */
export interface DedupPair {
  a: string;
  b: string;
  mm: number;
  mirrored: boolean;
  under: number;
}
/** How to search: how far (`base` of nearFor, NEAR by default), ids left out (the clip a submission improves), the
 *  most hits kept. */
export interface DedupQuery {
  within?: number;
  except?: readonly string[];
  limit?: number;
}

const order = (x: DedupHit, y: DedupHit) => x.mm - y.mm || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
/** What a hit says, as a gate's message reads it. */
export const hitText = (h: DedupHit): string => `${h.id}${h.mirrored ? " mirrored" : ""}, ${h.mm.toFixed(1)} mm a point from it on average (one motion under ${h.under.toFixed(1)})`;

/** An index of clips' motions to find near-duplicates in. */
export class DedupIndex {
  /** The distance under which two motions are one (nearFor's base). */
  readonly near: number;
  #entries: MotionFeatures[] = [];
  #at = new Map<string, number>();

  constructor(opts: { near?: number } = {}) {
    this.near = opts.near ?? NEAR;
  }

  /** An index of these clips (a LoadedClip has both: `library.clip(id)`). */
  static of(clips: Iterable<{ clip: Clip; rest: Rest }>, opts: { near?: number } = {}): DedupIndex {
    const index = new DedupIndex(opts);
    for (const { clip, rest } of clips) index.add(clip, rest);
    return index;
  }

  /** How many clips the index holds. */
  get size(): number {
    return this.#entries.length;
  }
  /** Whether the index holds clip `id`. */
  has(id: string): boolean {
    return this.#at.has(id);
  }
  /** An indexed clip's features. */
  get(id: string): MotionFeatures | undefined {
    const i = this.#at.get(id);
    return i === undefined ? undefined : this.#entries[i];
  }
  /** The indexed clips' ids, in the order they were added. */
  ids(): string[] {
    return this.#entries.map((e) => e.id);
  }

  /** Adds a clip on its rest (or its features), and returns its features. An id is indexed once. */
  add(clip: Clip | MotionFeatures, rest?: Rest): MotionFeatures {
    const f = featuresOf(clip, rest);
    if (this.#at.has(f.id)) throw new Error(`dedup: ${f.id} is in the index already; an id names one clip`);
    this.#at.set(f.id, this.#entries.length);
    this.#entries.push(f);
    return f;
  }

  /** The indexed clips one motion with a clip (within nearFor, `within` its base), nearest first, and how many were
   *  compared in full. */
  query(clip: Clip | MotionFeatures, rest?: Rest, opts: DedupQuery = {}): { hits: DedupHit[]; compared: number } {
    const f = featuresOf(clip, rest), base = opts.within ?? this.near, skip = new Set([f.id, ...(opts.except ?? [])]), hits: DedupHit[] = [];
    let compared = 0;
    for (const e of this.#entries) {
      const under = nearFor(f, e, base);
      if (skip.has(e.id) || !worthComparing(f, e, under)) continue;
      compared++;
      const d = motionDistance(f, e);
      if (d.mm < under) hits.push({ id: e.id, mm: d.mm, mirrored: d.mirrored, under });
    }
    return { hits: hits.sort(order).slice(0, opts.limit ?? Infinity), compared };
  }

  /** A clip checked against the index (the intake's dedup gate): the nearest indexed clip it is one motion with is the
   *  one it duplicates. `except` leaves out the clip a submission improves (`--improves`), which it is meant to lie
   *  near. */
  check(clip: Clip | MotionFeatures, rest?: Rest, opts: Omit<DedupQuery, "within"> = {}): DedupCheck {
    const { hits, compared } = this.query(clip, rest, opts), dup = hits[0] ?? null, id = clip.id;
    const message = dup
      ? `${id} is a near-duplicate of ${hitText(dup)}: send a change of it as an improvement (--improves ${dup.id}), or change it more`
      : `${id} is no near-duplicate: no indexed clip of ${this.size} lies within ${this.near} mm a point of it, or ${SHARE * 100}% more of how much it moves (${compared} compared in full)`;
    return { duplicate: dup, near: hits, compared, message };
  }

  /** Every pair of indexed clips one motion (within nearFor, `within` its base), each once and nearest first; `of`
   *  picks the clips whose pairs are sought (all by default: a sweep can sample them). */
  pairs(opts: { within?: number; of?: (id: string) => boolean } = {}): DedupPair[] {
    const base = opts.within ?? this.near, out: DedupPair[] = [], E = this.#entries;
    for (let x = 0; x < E.length; x++)
      for (let y = x + 1; y < E.length; y++) {
        const a = E[x]!, b = E[y]!, under = nearFor(a, b, base);
        if ((opts.of && !opts.of(a.id) && !opts.of(b.id)) || !worthComparing(a, b, under)) continue;
        const d = motionDistance(a, b), [p, q] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
        if (d.mm < under) out.push({ a: p, b: q, mm: d.mm, mirrored: d.mirrored, under });
      }
    return out.sort((x, y) => x.mm - y.mm || (x.a < y.a ? -1 : x.a > y.a ? 1 : x.b < y.b ? -1 : 1));
  }
}

/** Whether two motions are worth comparing in full for a distance `under` (nearFor by default): one skeleton,
 *  comparable lengths, and how much each moves and their mean poses within PREFILTER times it, over time or along
 *  their paths. */
export function worthComparing(a: MotionFeatures, b: MotionFeatures, under = nearFor(a, b)): boolean {
  const bound = PREFILTER * under;
  if (a.skeleton !== b.skeleton || !comparable(a, b) || (Math.abs(a.spread - b.spread) >= bound && Math.abs(a.pathSpread - b.pathSpread) >= bound)) return false;
  return centreDistance(a, b) < bound || centreDistance(a, b, true) < bound;
}

/** A clip's features, or the features given. */
function featuresOf(clip: Clip | MotionFeatures, rest?: Rest): MotionFeatures {
  if ("frames" in clip) return clip;
  if (!rest) throw new Error(`dedup: ${clip.id} needs the rest it decodes on (library.clip(id).rest, or its set's source's rest)`);
  return motionFeatures(clip, rest);
}
