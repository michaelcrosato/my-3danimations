// The motion-source socket's shapes as @m3a/tools' sources read them (PLAN.md WP-9.2): core's `sources` types
// (packages/core/src/sources/types.ts) written again, the same shapes, because @m3a/tools reaches core only through
// its public entry and core's index doesn't list the `sources` namespace yet (the integrator adds it; then these can
// be `sources.X` from @m3a/core). test/sources.test.ts holds the two to each other both ways. Also the refusal a
// tools source throws: an Error with a `code`, which the socket passes on as a SourceError with that code.
import type { Clip, ops, Rest } from "@m3a/core";

/** The terms a source's output comes under (core's sources.SourceTerms). */
export interface SourceTerms {
  license: string;
  version: string;
  url?: string;
}
/** A key pose or a root waypoint at a time (core's sources.Constraint). */
export type Constraint = { kind: "pose"; t: number; pose: ops.Pose } | { kind: "root"; t: number; forward: number; right: number; yaw?: number };
/** What a source is asked for (core's sources.SourceRequest). */
export interface SourceRequest {
  intent: string;
  constraints?: Constraint[];
  skeleton: { rest: Rest; restSrc: string };
  duration: number;
  seed: number;
}
/** What a source gives back (core's sources.SourceOutput). */
export interface SourceOutput {
  clip: Clip;
  rest: Rest;
  terms?: SourceTerms;
  warnings?: string[];
}
/** A motion source (core's sources.MotionSource). */
export interface MotionSource {
  readonly name: string;
  readonly terms: SourceTerms;
  generate(req: SourceRequest): SourceOutput | Promise<SourceOutput>;
}
/** The source's record in a clip's provenance, `provenance.source` (core's sources.SourceRecord). */
export interface SourceRecord {
  name: string;
  license: string;
  version: string;
  seed: number;
  prompt: string;
}
/** What the socket gives (core's sources.Sourced). */
export interface Sourced {
  clip: Clip;
  rest: Rest;
  record: SourceRecord;
  license: string;
  warnings: string[];
}

/** A tools source's refusal: an Error carrying `code` (E_NO_MATCH, E_DISABLED, E_TRANSPORT, E_REPLY, E_LOCAL). */
export function fail(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
