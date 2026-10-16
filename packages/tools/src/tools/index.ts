// The m3a tools (PLAN.md §5.6, WP-7.2): every tool by group, in the order `m3a help` lists them, and the registry the
// API and the console handle serve, its retries kept in memory (the m3a bin keeps them in .m3a/requests/). Each group's
// tools come from its own file; WP-7.2b adds RETARGET, COMPOSE and EXCHANGE.
import { Registry, type Tool } from "../registry/registry.ts";
import { validate, version } from "./base.ts";
import { edit, fix } from "./change.ts";
import { diff, film, lint, metrics, sheet } from "./check.ts";
import { exportClip, importMotion } from "./exchange.ts";
import { describe, search, show } from "./find.ts";
import { licenseCheck } from "./ship.ts";

/** Find and read (find.ts): search, show, describe. */
export const FIND: readonly Tool[] = [search, show, describe];

/** Check (check.ts): metrics, sheet, film, diff, lint. */
export const CHECK: readonly Tool[] = [metrics, sheet, film, diff, lint];

/** Change (change.ts), the edit tools: fix, edit. */
export const CHANGE: readonly Tool[] = [fix, edit];

/** Ship (ship.ts): license.check. */
export const SHIP: readonly Tool[] = [licenseCheck];

/** Exchange (exchange.ts, WP-7.2b): import, export. */
export const EXCHANGE: readonly Tool[] = [importMotion, exportClip];

/** Kept from WP-7.1 (base.ts): version, validate. */
export const BASE: readonly Tool[] = [version, validate];

/** Every m3a tool in help order: the workflow's groups, then version and validate. */
export const TOOLS: readonly Tool[] = [...FIND, ...CHECK, ...CHANGE, ...SHIP, ...EXCHANGE, ...BASE];

/** The m3a tools as one registry, request_id results kept in memory: what the API and the console handle serve. */
export const tools = new Registry(TOOLS);
