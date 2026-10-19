// The motion-source socket's shapes (PLAN.md WP-9.2): what a source is asked for (an intent, constraints, the body
// to make the clip on, a duration and a seed), the constraints (key poses and root waypoints at times: the input shape
// of NVIDIA Kimodo's constraint-based generation), the terms a source's output comes under and their version, what a
// source gives back, and what the socket gives: the clip with the source's record in its provenance (the source's
// name, a lower-case word, and both terms when a clip was served under others than its source states), its license
// claim and its warnings. A source returns data and nothing else: it is handed no writer (WP-9.2: its clips go to the intake
// queue, or to library/local/ when its terms aren't on the allowlist).
import type { Rest } from "../format/body.ts";
import type { Clip } from "../format/types.ts";
import type { Pose } from "../ops/pose.ts";

/** A key pose the clip should pass through at `t` s: key fields as a clip's key holds them, without `t`, `root` and
 *  `yaw` (Kimodo's full-body keyframe). */
export interface PoseConstraint {
  kind: "pose";
  t: number;
  pose: Pose;
}
/** Where the root should be at `t` s: forward and right of where it starts, % of the hip height, and its heading in
 *  degrees if it matters (Kimodo's 2D root waypoint). */
export interface RootConstraint {
  kind: "root";
  t: number;
  forward: number;
  right: number;
  yaw?: number;
}
/** One constraint: a key pose or a root waypoint. */
export type Constraint = PoseConstraint | RootConstraint;

/** The body a source makes its clip on: a rest (mm and degrees, as a set manifest records it) and its source entry.
 *  The library's and a recipe's clips keep their own inputs' rest; every clip plays on any body the bind maps. */
export interface SourceSkeleton {
  rest: Rest;
  restSrc: string;
}

/** What a source is asked for: the moment in words, optional constraints, the body, the length in seconds and a seed
 *  (a whole number, 0 to 2^32 − 1). The same request and seed give the same clip, bit for bit. */
export interface SourceRequest {
  intent: string;
  constraints?: Constraint[];
  skeleton: SourceSkeleton;
  duration: number;
  seed: number;
}

/** The terms a source's output comes under: an SPDX id or a `LicenseRef-` (or "inherit": the clip keeps the license
 *  its library inputs force, D10), the terms' version or date as the source states them (vendors change terms: a
 *  built-in source states the package's version), and where they are written. */
export interface SourceTerms {
  license: string;
  version: string;
  url?: string;
}

/** What a source gives back: its clip, the rest the clip decodes on, the terms it was served under when the source
 *  reports them (a vendor's reply), and its own warnings. */
export interface SourceOutput {
  clip: Clip;
  rest: Rest;
  terms?: SourceTerms;
  warnings?: string[];
}

/** A source's name as its record holds it: a lower-case word (letters, digits and -, a letter first). */
export const SOURCE_NAME = /^[a-z][a-z0-9-]*$/;

/** A motion source: its name (SOURCE_NAME), its terms, and how it makes a clip for a request. */
export interface MotionSource {
  readonly name: string;
  readonly terms: SourceTerms;
  generate(req: SourceRequest): SourceOutput | Promise<SourceOutput>;
}

/** The record the socket writes into each clip's provenance as `source`: the source's name, the license and version
 *  of the terms it was served under, the terms the source states (`stated`: its own `terms`, recorded only when the
 *  clip was served under others, as a vendor's reply may say), the seed, and the SHA-256 of the intent (the prompt's
 *  hash). Where a clip may go reads both terms (D113): a vendor's reply never decides it alone. */
export interface SourceRecord {
  name: string;
  license: string;
  version: string;
  stated?: { license: string; version: string };
  seed: number;
  prompt: string;
}

/** What the socket gives: the clip (its provenance carrying `source`), its rest, the record, the clip's license claim
 *  and every warning (the source's, then the socket's). */
export interface Sourced {
  clip: Clip;
  rest: Rest;
  record: SourceRecord;
  license: string;
  warnings: string[];
}

/** The socket's refusal: `code` says why (E_REQUEST a malformed request, E_NO_MATCH nothing fits the intent,
 *  E_INVALID a clip that doesn't validate or terms served that aren't { license, version }, E_DISABLED a source that is
 *  off, E_TRANSPORT and E_REPLY a remote source's failure, E_SOURCE a source whose name or terms are malformed, or
 *  anything else a source threw), the message names the fix. */
export class SourceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SourceError";
    this.code = code;
  }
}
