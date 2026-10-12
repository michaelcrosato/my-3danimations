// Headless capture (PLAN.md WP-4.5): `capture` draws a played character in a browser (`@m3a/three/capture`), and
// `poseHash` is the proof hash of its bone transforms, the same in Node and in a browser.
export { capture, CaptureError, type Capture, type CaptureOptions } from "./capture.ts";
export { poseHash } from "./hash.ts";
