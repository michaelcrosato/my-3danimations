// @m3a/sensors: motion metrics, describe, lint and fix, a software raster, sheets, films and diffs.
// The main entry stays runnable in a browser; Node built-ins go behind a `/node` entry (PLAN.md §5.1). The public API is
// this file, one export per statement, each with a doc comment.

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "@m3a/core";

/** This package's name. */
export const PACKAGE = "@m3a/sensors";

/** A pose drawn as the capsule mannequin in one view (front, side, back, top, three-quarter, or any azimuth). */
export { render } from "./raster/index.ts";
/** A pose from n azimuths side by side, at one scale. */
export { turntable } from "./raster/index.ts";
/** An RGBA image. */
export type { Image } from "./raster/index.ts";
/** The software raster: images, the bitmap font, views and cameras, the mannequin's capsules, PNG bytes. */
export * as raster from "./raster/index.ts";
