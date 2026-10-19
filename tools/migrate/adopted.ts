// What the library's writers keep of a clip on disk when they rewrite its set from its sources (PLAN.md §5.9,
// WP-9.1): `npm run import` and `npm run migrate` give each clip as its source gives it, except a clip the owner
// adopted from the intake queue (its provenance names the submission it came from, and its review is the owner's
// approval, made on its motion as it is and naming that submission: as tools/intake/adopt.ts writes it), which they
// keep over its source's, on the rest its set recorded when it was adopted (a source that measures that rest otherwise
// since is the writer's error: the owner adopts it again on the new rest); and a clip's review (WP-8.2), which they
// carry over the rewrite while its motion hash matches the rewritten clip's, and drop otherwise (the clip back to
// unreviewed). Only the adopt bot writes an adoption record: the library's gates fail any other pull request that adds
// one (tools/intake/gates.ts), so a record here is the bot's.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseClip, type Clip, type Rest } from "@m3a/core";
import { motionHash } from "../../packages/tools/src/intake/hash.ts";

/** An intake adoption a clip records: the submission it came from (`id@content hash`) and the owner's approval. */
export interface Adoption {
  submission: string;
  by: string;
  date: string;
  motion: string;
}

/** The intake adoption `clip` records, or null: none, not approved, approved on another motion than its own, or an
 *  approval that isn't the adopt bot's for that submission (its note opens "adopted from <id>@<12 of its hash>"). */
export function adoptionOf(clip: Clip): Adoption | null {
  const sub = (clip.provenance as { intake?: { submission?: unknown } }).intake?.submission, r = clip.review;
  if (typeof sub !== "string" || !/^s-[0-9a-f]{16}@[0-9a-f]{64}$/.test(sub) || r?.state !== "approved" || !r.by || r.motion !== motionHash(clip)) return null;
  const said = `adopted from ${sub.slice(0, 31)}`;
  if (r.note !== said && !r.note?.startsWith(`${said}: `)) return null;
  return { submission: sub, by: r.by, date: r.date, motion: r.motion };
}

/** Why a writer keeps an adopted clip over its source's version, in the words its record gives. */
export const adoptedWhy = (a: Adoption): string => `adopted from the intake queue (${a.submission.replace(/@(.{12}).*$/, "@$1")}) by the owner (${a.by}) on ${a.date}: kept over its source's version while that approval holds for its motion (${a.motion.slice(0, 12)})`;

/** The clip a set's directory `dir` holds as `<slug>.json`, or null. */
export function onDisk(dir: string, slug: string): Clip | null {
  const f = join(dir, `${slug}.json`);
  return existsSync(f) ? parseClip(readFileSync(f, "utf8")) : null;
}

/** The rest a set's `_set.json` in `dir` records for source `src` (the body its clips on disk were written on), or
 *  undefined when it has no such source or no manifest. */
export function restOn(dir: string, src: string): Rest | undefined {
  const f = join(dir, "_set.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { sources?: Record<string, { rest?: Rest }> }).sources?.[src]?.rest : undefined;
}

/** A value as JSON with every object's fields in order (a rest's fields come in either order). */
const canon = (v: unknown): string => JSON.stringify(v, (_, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** Whether two rests are the same body, number for number, whatever order their fields come in. */
export const sameRest = (a: Rest, b: Rest): boolean => canon(a) === canon(b);

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
