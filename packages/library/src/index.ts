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
