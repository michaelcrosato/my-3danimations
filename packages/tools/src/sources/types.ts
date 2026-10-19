// The motion-source socket's shapes as @m3a/tools' sources read them (PLAN.md WP-9.2): core's own, from its public
// `sources` namespace, under the names core gives them (one contract, written once: packages/core/src/sources/types.ts),
// and the refusal a tools source throws: an Error with a `code`, which the socket passes on as a SourceError with that
// code.
import type { sources } from "@m3a/core";

/** The terms a source's output comes under (core's sources.SourceTerms). */
export type SourceTerms = sources.SourceTerms;
/** A key pose or a root waypoint at a time (core's sources.Constraint). */
export type Constraint = sources.Constraint;
/** What a source is asked for (core's sources.SourceRequest). */
export type SourceRequest = sources.SourceRequest;
/** What a source gives back (core's sources.SourceOutput). */
export type SourceOutput = sources.SourceOutput;
/** A motion source (core's sources.MotionSource). */
export type MotionSource = sources.MotionSource;
/** The source's record in a clip's provenance, `provenance.source` (core's sources.SourceRecord). */
export type SourceRecord = sources.SourceRecord;
/** What the socket gives (core's sources.Sourced). */
export type Sourced = sources.Sourced;

/** A tools source's refusal: an Error carrying `code` (E_NO_MATCH, E_DISABLED, E_TRANSPORT, E_REPLY, E_LOCAL). */
export function fail(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}
