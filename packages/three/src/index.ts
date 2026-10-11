// @m3a/three: the three.js adapter: binding, playback, baking and capture (three is a peer dependency, r182: D45).
// The main entry stays runnable in a browser; Node built-ins go behind a `/node` entry (PLAN.md §5.1).

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "@m3a/core";

/** This package's name. */
export const PACKAGE = "@m3a/three";

/** Binds a three.js character: its skeleton recognized, its rest read, bound for the solver, with a report. */
export { bind } from "./bind/index.ts";
/** A bound three.js character. */
export type { ThreeBound } from "./bind/index.ts";
/** What binding found, with a patch to edit. */
export type { MappingReport } from "./bind/index.ts";
/** A mapping patch: each humanoid bone's source bone, or null. */
export type { MappingPatch } from "./bind/index.ts";
/** How to bind. */
export type { BindOptions } from "./bind/index.ts";
