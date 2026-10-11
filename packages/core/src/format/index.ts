// The format codec's public surface (WP-1.3): types, body points and rests, encode and decode, sampling, fit, the
// text lenses, mirroring, the canonical file, and reading format 1.
export * from "./types.ts";
export { POINTS, IDX, P, SG, derived, type Rest, type Side } from "./body.ts";
export { encodePose, decodePose, torso, bodyPoints, type KeyLike, type EncodeOptions } from "./pose.ts";
export { keyAt, pose, moveAt, capSample, FIELDS, type Timed, type Capture } from "./sample.ts";
export { error, meanError, reduce, encode, fit, type Extra, type Encoded, type GroupBudget } from "./fit.ts";
export { text1, parse1, keyLens, keyLines, mirror, GROUPS_1, GROUPS_2, KEY_FIELD_NAMES, type Lensed } from "./text.ts";
export { serialize, parseClip, slug, slugs, motionText, fromFormat1, type Clip1, type From1 } from "./serialize.ts";
