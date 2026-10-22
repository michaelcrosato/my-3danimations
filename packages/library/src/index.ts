// @m3a/library: the library loader, search, facts, license tiers and dedup.
// The main entry stays runnable in a browser; Node built-ins go behind a `/node` entry (PLAN.md §5.1).

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "@m3a/core";

/** This package's name. */
export const PACKAGE = "@m3a/library";

/** The library: its sets, catalogs and clips as the tiers a game opted in to let it see (CC0 alone by default). */
export { Library } from "./load/index.ts";
/** The library's refusal: `code` says why (E_NO_CLIP, E_NO_SET, E_TIER, E_TAMPERED), `clip` names the clip. */
export { LibraryError } from "./load/index.ts";
/** Every license tier, the default pack's (cc0) first (D10). */
export { TIERS } from "./load/index.ts";
/** A set's content id from its clip files' hashes (spec/MOTION.md §9.2). */
export { contentId } from "./load/index.ts";
/** A license tier. */
export type { Tier } from "./load/index.ts";
/** Where the library's files come from. */
export type { LibrarySource } from "./load/index.ts";
/** The lock: each set's content id and clip hashes, and deprecated ids. */
export type { LibraryLock } from "./load/index.ts";
/** How to open the library: tiers, lock, SHA-256, warnings. */
export type { LibraryOptions } from "./load/index.ts";
/** A set as the library lists it. */
export type { SetInfo } from "./load/index.ts";
/** One catalog row. */
export type { CatalogRow } from "./load/index.ts";
/** A clip loaded with its rest, set and tier. */
export type { LoadedClip } from "./load/index.ts";
/** A set as its manifest describes it, whatever its tier (`Library#about`): legend and sources. */
export type { SetAbout } from "./load/index.ts";
/** A set's source: label, origin, license, terms, url, credit and rest. */
export type { SourceAbout } from "./load/index.ts";
/** The set writer: a set's files (its clips, catalog.tsv, and _set.json with its content id) from its manifest and
 *  clips; a manifest's text, a catalog row within its token budget, and a token count to give it. */
export { setFiles, setText, catalogRow, ROW_BUDGET, type Tokens } from "./write/sets.ts";
/** License compliance: sets checked against their tiers and texts, or a game's clips against the tiers it opts into. */
export { checkSets, checkGame, creditsBlock } from "./license/index.ts";
/** D10's tier rule: the tier a license fits, and whether a tier's clips are credited. */
export { tierOf, credited } from "./license/index.ts";
/** What a game uses: its tiers, its clips, whether it ships. */
export type { GameManifest } from "./license/index.ts";
/** A license check's outcome, one problem, and a credit owed. */
export type { LicenseReport, LicenseFinding, Credit } from "./license/index.ts";

/** The revision of the facts this package measures (`m3a-facts@N`). */
export { FACTS_BY } from "./facts/index.ts";
/** A clip's facts and contacts measured on its rest, a source's speed kept. */
export { measure as measureClipFacts } from "./facts/index.ts";
/** The clip with its facts and contacts measured. */
export { withFacts } from "./facts/index.ts";
/** The clip with its contacts written by a named reading of core's, labelled, and its facts measured from them (D129). */
export { withReading } from "./facts/index.ts";
/** The speed a clip's writer took from its source, if any. */
export { capturedSpeed } from "./facts/index.ts";
/** The tags a clip's facts don't bear out (`loop` that doesn't close, `run` that doesn't travel). */
export { tagConflicts } from "./facts/index.ts";
/** A clip's facts as written. */
export type { ClipFacts } from "./facts/index.ts";
/** A tag the facts don't bear out. */
export type { TagConflict } from "./facts/index.ts";

/** Searches catalog rows for a game moment in words and filters (`Library.search` does it over the library). */
export { search } from "./search/index.ts";
/** m/s on the reference body (0.95 m hips) from a catalog speed (% of the hip height a second), as search rows give it. */
export { mps } from "./search/index.ts";
/** The core list: the CC0 clips a game usually needs, read first. */
export { CORE } from "./search/index.ts";
/** The search's vocabulary as synonyms: a word as a game moment says it, and the words the library says it with. */
export { SYNONYMS } from "./search/index.ts";
/** The search's phrases: idioms and words written as one, each the word it means. */
export { PHRASES } from "./search/index.ts";
/** A query's words (stemmed) and filters, as the search reads them. */
export { parseQuery } from "./search/index.ts";
/** A catalog row with its set's tier: what the search reads. */
export type { SearchItem } from "./search/index.ts";
/** A CMU ledger row: a take that can be imported. */
export type { LedgerItem } from "./search/index.ts";
/** How to search: tiers, limit, the ledger. */
export type { SearchOptions } from "./search/index.ts";
/** One row found. */
export type { SearchHit } from "./search/index.ts";
/** What a search found: rows, the total, and what to try next. */
export type { SearchResult } from "./search/index.ts";
/** Near-duplicates (WP-9.3): a clip's motion features on its rest, the time-warped, mirror-aware distance between two,
 *  and an index that checks a submission against the library in milliseconds (`DedupIndex.check`). */
export { DedupIndex, NEAR, SHARE, nearFor, worthComparing, hitText, motionFeatures, motionDistance } from "./dedup/index.ts";
/** A near-duplicate's types: a hit, a check, a pair, a query, a clip's features, an alignment. */
export type { DedupHit, DedupCheck, DedupPair, DedupQuery, MotionFeatures, Alignment } from "./dedup/index.ts";
/** Lineage (WP-9.3): the graph from `orig`, recipe inputs and content ids (`Lineage`), resolved to source clips; ids
 *  deprecated, never reused or removed (`deprecate`, `checkIds`). */
export { Lineage, PROCEDURAL, checkIds, clipIds, deprecate, successorOf } from "./lineage/index.ts";
/** Lineage's types: an edge, a node, a problem, a resolution, an id's problem. */
export type { LineageEdge, LineageNode, LineageProblem, Resolution, IdProblem } from "./lineage/index.ts";
