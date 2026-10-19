// The hashes a decision is made on (PLAN.md §5.9, spec/MOTION.md §7.6): a submission's content hash (the SHA-256 of
// its text, every byte, so a changed description is a change too), a clip's motion hash (the SHA-256 of core's motion
// hash input, what plays), and a submission's id, from its contributor and content, so the same text sent twice is one
// submission. Core's SHA-256: the same bytes on every engine, no clock, no randomness.
import { format, recipe, type Clip } from "@m3a/core";
import type { Kind } from "./types.ts";

/** A submission's content hash: the SHA-256 of its text (UTF-8), 64 hex digits. */
export const contentHash = (text: string): string => recipe.sha256(text);

/** A clip's motion hash (spec/MOTION.md §7.6): the SHA-256 of its motion hash input. */
export const motionHash = (clip: Clip): string => recipe.sha256(format.motionText(clip));

/** The motion hash of a submission's text when it is a clip with keys, else null (a recipe's comes once it compiles). */
export function motionOfText(kind: Kind, text: string): string | null {
  if (kind !== "clip") return null;
  try {
    const c = JSON.parse(text) as Clip;
    return c && typeof c === "object" && Array.isArray(c.keys) ? motionHash(c) : null;
  } catch {
    return null;
  }
}

/** A submission's id: "s-" and the first 16 hex digits of the SHA-256 of its contributor, a newline and its content
 *  hash. The submit function (services/intake/functions/submit) makes the same. */
export const submissionId = (contributor: string, content: string): string => `s-${recipe.sha256(`${contributor}\n${content}`).slice(0, 16)}`;
