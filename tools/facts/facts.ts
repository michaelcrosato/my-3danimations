// The facts check (PLAN.md WP-5.4): every library clip's facts and contacts are what @m3a/library's `measure` gives on
// its rest today (written by the importer and the migrator, so a change to the measurement is a change to the clips),
// and every tag its facts don't bear out (a `loop` that doesn't close, a `run` that doesn't travel) is either resolved
// or baselined with a reason in library/baselines/tags.json.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { capturedSpeed, FACTS_BY, measureClipFacts, tagConflicts, type ClipFacts } from "../../packages/library/src/index.ts";
import { libraryClips, type LibraryClip } from "../qa/qa.ts";
import { ROOT } from "../run/cli.ts";

/** The tag conflicts accepted, each with its reason. */
export const TAGS_BASELINE = join(ROOT, "library/baselines/tags.json");

/** The baseline file: per clip id, per tag, why the tag stays though the facts don't bear it out. */
export interface TagsBaseline {
  about?: string;
  conflicts: Record<string, Record<string, string>>;
}
/** One conflict found, and its reason when baselined. */
export interface FoundConflict {
  id: string;
  tag: string;
  message: string;
  reason?: string;
}
/** What the check found. */
export interface FactsReport {
  clips: number;
  /** Clips whose written facts or contacts aren't what the measurement gives (or aren't this revision's). */
  stale: string[];
  conflicts: FoundConflict[];
  /** Baselined conflicts the facts no longer show. */
  gone: string[];
}

/** A value as JSON with every object's fields in order. */
const canon = (v: unknown): string => JSON.stringify(v, (_, x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** The baseline, or an empty one when there is none yet. */
export function readTagsBaseline(file = TAGS_BASELINE): TagsBaseline {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as TagsBaseline) : { conflicts: {} };
}

/** Every clip's facts and contacts measured afresh against what is written, and its tags against its facts. */
export function checkFacts(lib: readonly LibraryClip[] = libraryClips(), baseline: TagsBaseline = readTagsBaseline()): FactsReport {
  const stale: string[] = [], conflicts: FoundConflict[] = [], seen = new Set<string>();
  for (const { clip, rest } of lib) {
    const now = measureClipFacts(clip, rest, capturedSpeed(clip)), written = clip.facts as unknown as ClipFacts | undefined;
    if (written?.by !== FACTS_BY) stale.push(`${clip.id}: its facts are ${written ? `by ${written.by}` : "missing"}, not ${FACTS_BY}`);
    else if (canon(written) !== canon(now.facts)) stale.push(`${clip.id}: its facts ${canon(written)} measure ${canon(now.facts)}`);
    else if (canon(clip.contacts ?? null) !== canon(now.contacts)) stale.push(`${clip.id}: its contacts aren't what is detected`);
    for (const c of tagConflicts(clip, now.facts, rest)) {
      const reason = baseline.conflicts[clip.id]?.[c.tag];
      if (reason) seen.add(`${clip.id} ${c.tag}`);
      conflicts.push({ id: clip.id, tag: c.tag, message: c.message, ...(reason ? { reason } : {}) });
    }
  }
  const gone = Object.entries(baseline.conflicts).flatMap(([id, tags]) => Object.keys(tags).filter((t) => !seen.has(`${id} ${t}`)).map((t) => `${id} ${t}`));
  return { clips: lib.length, stale, conflicts, gone };
}
