// @m3a/core: the format codec, profiles, sampler, pose ops, solver, contacts, recipes, graphs and sources.
// Imports nothing outside itself: no DOM, no `node:` modules, no renderer (DOCTRINE.md, principle 6).
// The public API, all of it (PLAN.md WP-2.6): every export is listed here, one per statement, each with a doc comment,
// at most 40 (`npm run doctrine` counts them). The everyday names are top-level; each module's whole surface is one
// namespace (`format.keyAt`, `ops.blend`, `math.quat`, ...).

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "./version.ts";
/** This package's name. */
export const PACKAGE = "@m3a/core";

/** Plays clips on a bound skeleton: layers, a fixed-step clock with events and root motion, save, restore and poses. */
export { Animator } from "./animator/index.ts";
/** The Animator's refusal: `code` says why (E_CLIP_CHANGED, ...), `clip` names the clip to blame. */
export { AnimatorError } from "./animator/index.ts";
/** How an Animator runs: the fixed step, the most steps per call, and the ground. */
export type { AnimatorOptions } from "./animator/index.ts";
/** One layer's settings: clip, weight, mask, additive, speed and time. */
export type { LayerOptions } from "./animator/index.ts";
/** A clip as the Animator plays it: a format-2 clip, or its id, timing and keys. */
export type { AnimClip } from "./animator/index.ts";
/** What one `step(dt)` did: steps run, events passed in order, the root's move. */
export type { StepResult } from "./animator/index.ts";
/** One event a playhead passed: its name, layer, clip, clip time and when it fired. */
export type { AnimatorEvent } from "./animator/index.ts";
/** An Animator's state as JSON-safe data: what `save()` returns and `restore()` takes. */
export type { AnimatorSave } from "./animator/index.ts";
/** How to pose: exact, a level of detail, hand targets. */
export type { PoseOptions } from "./animator/index.ts";
/** A posed character: bone rotations, the hips, the root, the mixed key and the joints. */
export type { AnimatorPose } from "./animator/index.ts";

/** Binds a skeleton: recognized, measured and mapped, ready to solve onto. */
export { bind } from "./solve/index.ts";
/** A skeleton ready to solve onto. */
export type { Bound } from "./solve/index.ts";
/** Solves a key pose onto a bound skeleton: each bone's world and local rotation, and the hips' place. */
export { solve } from "./solve/index.ts";
/** A solved pose. */
export type { Solved } from "./solve/index.ts";
/** Every bone's head after a solve (forward kinematics), in skeleton space. */
export { forward } from "./solve/index.ts";
/** Recognizes a skeleton's bones as the humanoid profile's (spec/SKELETON.md). */
export { recognize } from "./skeleton/index.ts";
/** A skeleton as bind and recognize read it: bones with names, parents and rest heads. */
export type { SkeletonIn } from "./skeleton/index.ts";

/** Parses a clip file's text (format 2, or format 1 upgraded). */
export { parseClip } from "./format/index.ts";
/** Writes a clip as canonical text: the only way clip files are written. */
export { serialize } from "./format/index.ts";
/** A format-2 clip. */
export type { Clip } from "./format/index.ts";
/** A key pose: `t` and named arrays of numbers. */
export type { Key } from "./format/index.ts";
/** A rest body, as a set manifest records it (mm and degrees). */
export type { Rest } from "./format/index.ts";
/** Validates parsed data as a clip, a set manifest or a catalog row. */
export { validate } from "./validate/index.ts";
/** What `validate` returns: the issues found, and whether there were errors. */
export type { Result } from "./validate/index.ts";
/** One issue: its rule, severity, place and message. */
export type { Issue } from "./validate/index.ts";
/** Measures a clip's facts: speed, travel, height, strike, contacts. */
export { measureFacts } from "./clip/index.ts";
/** A clip's measured facts. */
export type { Facts } from "./clip/index.ts";

/** The portable math (the same bits in every engine), vectors, quaternions, matrices, hashes and seeded streams. */
export * as math from "./math/index.ts";
/** The format codec: types, decode and encode, sampling keys, the text lens, mirroring, fitting, the serializer. */
export * as format from "./format/index.ts";
/** Playing a clip: sampling, root motion, events, contact detection and facts. */
export * as clip from "./clip/index.ts";
/** Pose operations: blend, deltas, masks, mirror, retime, slice, loop, contact-phase sync. */
export * as ops from "./ops/index.ts";
/** The skeleton profile: humanoid bones, naming tables, recognition and measurement. */
export * as skeleton from "./skeleton/index.ts";
/** The solver: bind, solve, forward, the frame maps and the decode the solver reaches. */
export * as solver from "./solve/index.ts";
/** Contacts and ground: planting feet, ground probes, hand targets, the root a clip's feet imply. */
export * as contact from "./contact/index.ts";
/** The validator: its rules, its kinds (clip, set, catalog row) and issue formatting. */
export * as validation from "./validate/index.ts";
/** The Animator's whole surface: its types, errors and the clip content hash. */
export * as animator from "./animator/index.ts";
