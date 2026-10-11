// @m3a/core: the format codec, profiles, sampler, pose ops, solver, contacts, recipes, graphs and sources.
// Imports nothing outside itself: no DOM, no `node:` modules, no renderer (DOCTRINE.md, principle 6).

export { VERSION } from "./version.ts";
export * from "./math/index.ts";
export * from "./format/index.ts";
export * from "./skeleton/index.ts";
export { validate, validateClip, validateSet, validateCatalogRow, formatIssue, RULES, rule, KNOWN_REQUIRES } from "./validate/index.ts";
export type { Issue, Result, Where, Rule, Severity, ValidateOptions, ValidateKind } from "./validate/index.ts";

/** This package's name. */
export const PACKAGE = "@m3a/core";
