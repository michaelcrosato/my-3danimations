// The validator's entry: `validate(data, { mode, kind })` for a clip, a set manifest or a catalog row, with coded
// findings of at most two lines each (WP-1.2). Errors fail a gate; warnings are baselined per clip with a reason.
import { validateClip, type ValidateOptions } from "./clip.ts";
import type { Result } from "./issues.ts";
import { validateCatalogRow, validateSet } from "./set.ts";

export { validateClip, KNOWN_REQUIRES, type ValidateOptions } from "./clip.ts";
export { validateSet, validateCatalogRow } from "./set.ts";
export { formatIssue, type Issue, type Result, type Where } from "./issues.ts";
export { RULES, rule, type Rule, type Severity } from "./rules.ts";

/** What to validate: a clip (the default), a set manifest, or one catalog row (a string). */
export interface ValidateKind extends ValidateOptions {
  kind?: "clip" | "set" | "catalog-row";
}

/** Validate parsed data as a clip, a set manifest or a catalog row. `read` mode accepts unknown fields; `lint` flags them. */
export function validate(data: unknown, opts: ValidateKind = {}): Result {
  if (opts.kind === "set") return validateSet(data, opts);
  if (opts.kind === "catalog-row") return validateCatalogRow(String(data));
  return validateClip(data, opts);
}
