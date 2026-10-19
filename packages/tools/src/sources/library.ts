// The library source (PLAN.md WP-9.2): the library's search behind the socket. The intent is searched at the tiers
// the library was opened at (WP-5.5's search, the core clips first among equals), the seed picks among the rows that
// score the best (core clips among themselves when the best is one), and the clip comes back on its own rest, with its own provenance and license (its set's tier: the
// terms are "inherit"). A picked clip is in the library already: play it by its id; sent to the intake queue it is a
// duplicate, which the checker bounces.
import { VERSION } from "@m3a/core";
import type { Library } from "@m3a/library";
import { fail, type MotionSource, type SourceOutput, type SourceRequest } from "./types.ts";

/** The library source over `library` (opened at the tiers the game opts in to), reading the best `among` rows (10). */
export function librarySource(library: Library, opts: { among?: number } = {}): MotionSource {
  return {
    name: "library",
    terms: { license: "inherit", version: VERSION },
    generate(req: SourceRequest): SourceOutput {
      const r = library.search(req.intent, { limit: opts.among ?? 10 });
      if (!r.rows.length) throw fail("E_NO_MATCH", `library: no clip at tiers ${library.tiers.join(", ")} matches ${JSON.stringify(req.intent)}${r.next ? `; ${r.next}` : ""}`);
      const top = r.rows[0]!, tied = r.rows.filter((h) => h.score === top.score && !h.core === !top.core), hit = tied[req.seed % tied.length]!, { clip, rest } = library.clip(hit.id);
      const warnings = [`${hit.id} is a library clip (tier ${hit.tier}): play it by its id; sent to the intake queue it is a duplicate`];
      if (tied.length > 1) warnings.push(`seed ${req.seed} picked it of ${tied.length} equal matches (${tied.map((h) => h.id).join(", ")})`);
      if (req.constraints?.length) warnings.push("a library clip keeps its own poses: constraints are measured, not followed");
      return { clip, rest, warnings };
    },
  };
}
