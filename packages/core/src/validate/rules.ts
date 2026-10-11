// The validator's rules: every code, its severity and what it catches (spec/MOTION.md; WP-1.2). Errors are structural
// and fail a gate; warnings are semantic and are baselined per clip with a reason. Codes never change meaning; a
// retired rule keeps its code unused.

/** How bad a finding is. */
export type Severity = "error" | "warning";

/** One rule: its code, severity and a short description. */
export interface Rule {
  code: string;
  severity: Severity;
  what: string;
}

/** Every rule the validator applies, clips (E0xx, W0xx), then sets and catalog rows (E1xx). */
export const RULES: readonly Rule[] = [
  { code: "M2-E001", severity: "error", what: "not a JSON object" },
  { code: "M2-E002", severity: "error", what: "format missing, malformed, or a major this reader doesn't know" },
  { code: "M2-E003", severity: "error", what: "a required field is missing" },
  { code: "M2-E004", severity: "error", what: "a field has the wrong type" },
  { code: "M2-E005", severity: "error", what: "a number is NaN or infinite" },
  { code: "M2-E006", severity: "error", what: "a key field has the wrong number of values" },
  { code: "M2-E007", severity: "error", what: "a key number is not a whole number" },
  { code: "M2-E008", severity: "error", what: "key times don't increase, or two keys are less than 1 ms apart" },
  { code: "M2-E009", severity: "error", what: "a clip has no keys" },
  { code: "M2-E010", severity: "error", what: "over a limit: 4,096 keys, 600 s, 64 events, 256 contact intervals per end" },
  { code: "M2-E011", severity: "error", what: "more than one key past dur, or one more than 50 ms past it" },
  { code: "M2-E012", severity: "error", what: "a contact interval is outside the duration, reversed, unsorted or overlapping" },
  { code: "M2-E013", severity: "error", what: "events are out of order, outside the duration, or badly named" },
  { code: "M2-E014", severity: "error", what: "a value is outside its range" },
  { code: "M2-E015", severity: "error", what: "requires names a field this reader doesn't know" },
  { code: "M2-E016", severity: "error", what: "a value is not one of its field's allowed words" },
  { code: "M2-E017", severity: "error", what: "an id, name or date is malformed" },
  { code: "M2-E018", severity: "error", what: "an attribution license without a credit line" },
  { code: "M2-E019", severity: "error", what: "a limb or blade direction is all zeros" },
  { code: "M2-E020", severity: "error", what: "a time is not rounded to the millisecond" },
  { code: "M2-W001", severity: "warning", what: "an unknown field (lint mode only)" },
  { code: "M2-W002", severity: "warning", what: "format 1's pop: twist jumps more than 120 degrees while the bend is over 140" },
  { code: "M2-W003", severity: "warning", what: "the hips go below the floor" },
  { code: "M2-W004", severity: "warning", what: "a limb direction flips between two keys, so the in-between collapses" },
  { code: "M2-W005", severity: "warning", what: "an angle past ±540 degrees" },
  { code: "M2-W006", severity: "warning", what: "an optional key field in some keys but not all" },
  { code: "M2-E101", severity: "error", what: "a set manifest field is missing or has the wrong type" },
  { code: "M2-E102", severity: "error", what: "a set manifest value is malformed or not an allowed word" },
  { code: "M2-E110", severity: "error", what: "a catalog row doesn't have 7 tab-separated columns" },
  { code: "M2-E111", severity: "error", what: "a catalog row value is malformed" },
];

/** The rule for a code. */
export function rule(code: string): Rule {
  const r = RULES.find((x) => x.code === code);
  if (!r) throw new Error(`no validator rule ${code}`);
  return r;
}
