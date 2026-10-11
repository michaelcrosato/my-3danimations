// The skeleton profile's public surface (WP-1.4): VRM 1.0's humanoid, the mapping tables, recognize() with its
// topology fallback, the rest frame, rest measurement and the body points on a recognized skeleton.
export { HUMANOID_BONES, REQUIRED_BONES, HUMANOID_PARENT, BODY_POINTS, CENTER_BONES, SIDE_PARTS, type Place } from "./bones.ts";
export { TABLES, normalizeName, type Table } from "./tables.ts";
export { recognize, patchMapping, restFrame, type BoneIn, type SkeletonIn, type Recognition } from "./recognize.ts";
export { measure, restPoints } from "./measure.ts";
