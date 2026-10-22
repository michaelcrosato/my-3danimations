// The facts check (PLAN.md WP-5.4): every library clip's facts and contacts are what @m3a/library's `measure` gives on
// its rest today (written by the importer and the migrator, so a change to the measurement is a change to the clips),
// and every tag its facts don't bear out (a `loop` that doesn't close, a `run` that doesn't travel) is either resolved
// or baselined with a reason in library/baselines/tags.json. A loop whose contacts are one of core's named readings
// carries them labelled, which `measure` takes as given, and names the reading in `facts.reading` (spec/MOTION.md §7.1,
// §7.3, D129); so it is held to that reading instead: its contacts must be what core's reading gives on its motion today
// (@m3a/library's `withReading`), and the reading its set's import record names (`_import.json`'s `contacts`) must be it.
import type { clip as coreClip } from "@m3a/core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { capturedSpeed, FACTS_BY, measureClipFacts, tagConflicts, withReading, type ClipFacts } from "../../packages/library/src/index.ts";
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
  /** Clips whose written facts or contacts aren't what the measurement gives (or aren't this revision's), or whose contacts
   *  aren't the reading they name (facts.reading) or the one their set's import record names. */
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

/** Per clip id, the contact reading its set's import record names (`_import.json`'s `contacts`, D129). */
export function namedReadings(dir = join(ROOT, "library/sets")): Map<string, coreClip.ContactReading> {
  const out = new Map<string, coreClip.ContactReading>();
  for (const set of readdirSync(dir).sort()) {
    const file = join(dir, set, "_import.json");
    if (!existsSync(file)) continue;
    const { clips } = JSON.parse(readFileSync(file, "utf8")) as { clips?: Record<string, { contacts?: coreClip.ContactReading }> };
    for (const [slug, rec] of Object.entries(clips ?? {})) if (rec.contacts) out.set(`${set}/${slug}`, rec.contacts);
  }
  return out;
}

/** Why `clip`'s contacts aren't the reading `name` (its facts.reading) gives on its motion today (withReading's), or
 *  nothing when they are. */
function offReading(clip: LibraryClip["clip"], rest: LibraryClip["rest"], name: coreClip.ContactReading): string | undefined {
  try {
    return canon(clip.contacts ?? null) === canon(withReading({ ...clip, contacts: undefined }, rest, name).contacts) ? undefined : `its contacts aren't the reading "${name}" its facts.reading names (D129)`;
  } catch (err) {
    return `its facts.reading names "${name}", which it can't carry: ${(err as Error).message}`;
  }
}

/** Every clip's facts and contacts measured afresh against what is written (a loop that names a contact reading held
 *  to that reading, and to its set's import record), and its tags against its facts. */
export function checkFacts(lib: readonly LibraryClip[] = libraryClips(), baseline: TagsBaseline = readTagsBaseline(), readings: ReadonlyMap<string, coreClip.ContactReading> = namedReadings()): FactsReport {
  const stale: string[] = [], conflicts: FoundConflict[] = [], seen = new Set<string>();
  for (const { clip, rest } of lib) {
    const now = measureClipFacts(clip, rest, capturedSpeed(clip)), written = clip.facts as unknown as ClipFacts | undefined, named = readings.get(clip.id);
    // the reading the clip names (facts.reading, spec §7.3) holds its contacts; its set's import record must agree
    const own = written?.reading as coreClip.ContactReading | undefined, off = own && offReading(clip, rest, own);
    if (written?.by !== FACTS_BY) stale.push(`${clip.id}: its facts are ${written ? `by ${written.by}` : "missing"}, not ${FACTS_BY}`);
    else if (canon(written) !== canon(now.facts)) stale.push(`${clip.id}: its facts ${canon(written)} measure ${canon(now.facts)}`);
    else if (named && named !== own) stale.push(`${clip.id}: its facts.reading ${JSON.stringify(own ?? null)} isn't the reading "${named}" its set's import record names (D129)`);
    else if (off) stale.push(`${clip.id}: ${off}`);
    else if (!own && canon(clip.contacts ?? null) !== canon(now.contacts)) stale.push(`${clip.id}: its contacts aren't what is detected`);
    for (const c of tagConflicts(clip, now.facts, rest)) {
      const reason = baseline.conflicts[clip.id]?.[c.tag];
      if (reason) seen.add(`${clip.id} ${c.tag}`);
      conflicts.push({ id: clip.id, tag: c.tag, message: c.message, ...(reason ? { reason } : {}) });
    }
  }
  const gone = Object.entries(baseline.conflicts).flatMap(([id, tags]) => Object.keys(tags).filter((t) => !seen.has(`${id} ${t}`)).map((t) => `${id} ${t}`));
  return { clips: lib.length, stale, conflicts, gone };
}
