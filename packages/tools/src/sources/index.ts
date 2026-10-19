// @m3a/tools' side of the motion-source socket (PLAN.md WP-9.2): the library source, the HTTP adapter template for
// external generators (off by default, its transport injected), and where a source's clip may go: the gate, the
// license allowlist, the intake queue's door and the local lane. Core's `sources` holds the socket itself
// (`sourceClip`) and the procedural and recipe sources. Platform-neutral: the host gives the store and the files.
export { librarySource } from "./library.ts";
export { httpSource, kimodoBody, type HttpSourceOptions, type HttpRequest, type HttpReply, type Transport } from "./http.ts";
export { deliver, allowlisted, sourceGate, intakeSubmit, localPath, LOCAL, ALLOWED_TERMS, type Delivered, type Gate, type LocalLane, type Submit } from "./deliver.ts";
export { fail, type MotionSource, type SourceRequest, type SourceOutput, type SourceTerms, type SourceRecord, type Sourced, type Constraint } from "./types.ts";
