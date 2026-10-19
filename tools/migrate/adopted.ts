// What the library's writers keep of a clip on disk when they rewrite its set from its sources (PLAN.md §5.9,
// WP-9.1): `npm run import` and `npm run migrate` give each clip as its source gives it, except a clip the owner
// adopted from the intake queue (its provenance names the submission it came from, and its review is the owner's
// approval, made on its motion as it is: as tools/intake/adopt.ts writes it), which they keep over its source's; and a
// clip's review (WP-8.2), which they carry over the rewrite while its motion hash matches the rewritten clip's, and
// drop otherwise (the clip back to unreviewed).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClip, type Clip } from "@m3a/core";
import { motionHash } from "../../packages/tools/src/intake/hash.ts";

/** An intake adoption a clip records: the submission it came from (`id@content hash`) and the owner's approval. */
export interface Adoption {
  submission: string;
  by: string;
  date: string;
  motion: string;
}

/** The intake adoption `clip` records, or null: none, not approved, or approved on another motion than its own. */
export function adoptionOf(clip: Clip): Adoption | null {
  const sub = (clip.provenance as { intake?: { submission?: unknown } }).intake?.submission, r = clip.review;
  if (typeof sub !== "string" || !sub || r?.state !== "approved" || !r.by || r.motion !== motionHash(clip)) return null;
  return { submission: sub, by: r.by, date: r.date, motion: r.motion };
}

/** Why a writer keeps an adopted clip over its source's version, in the words its record gives. */
export const adoptedWhy = (a: Adoption): string => `adopted from the intake queue (${a.submission.replace(/@(.{12}).*$/, "@$1")}) by the owner (${a.by}) on ${a.date}: kept over its source's version while that approval holds for its motion (${a.motion.slice(0, 12)})`;

/** The clip a set's directory `dir` holds as `<slug>.json`, or null. */
export function onDisk(dir: string, slug: string): Clip | null {
  const f = join(dir, `${slug}.json`);
  return existsSync(f) ? parseClip(readFileSync(f, "utf8")) : null;
}

/** The validator warnings a set's `_baseline.json` in `dir` accepts, per clip (none without the file). */
export function baselineOn(dir: string): Record<string, { code: string; at: string; reason: string }[]> {
  const f = join(dir, "_baseline.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { clips: Record<string, { code: string; at: string; reason: string }[]> }).clips : {};
}

/** `made`, a writer's clip, with the review of `was` (the clip on disk it rewrites) while its motion hash is `made`'s;
 *  otherwise without one. */
export function carryReview(made: Clip, was: Clip | null): Clip {
  const { review: _, ...out } = made;
  return was?.review && was.review.motion === motionHash(made) ? { ...out, review: was.review } : out;
}
