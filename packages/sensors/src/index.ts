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
/** A clip's contact sheet: its frames at their times, one scale, with contacts, trails, flags and a timeline. */
export { sheet } from "./sheet/index.ts";
/** Where two images differ: A, B, and A with every changed pixel marked. */
export { diff } from "./sheet/index.ts";
/** Sheets, filmstrips, diffs between clips or builds, and token costs. */
export * as sheets from "./sheet/index.ts";
/** Every metric over a clip on its rest: the report (values, findings with their times) and its verdict. */
export { metrics } from "./metrics/index.ts";
/** A clip's metrics report. */
export type { Report } from "./metrics/index.ts";
/** The metrics one by one, the sampled motion they read, their thresholds and the tag profiles. */
export * as checks from "./metrics/index.ts";
/** Assertions about a clip's motion ("footL planted 0.33–0.60 s, slide < 10 mm"), checked, failing as repairs. */
export * as predicates from "./predicates/index.ts";
