// Pose operations' public surface (PLAN.md WP-2.3): blend, additive deltas, masks, mirror, retime, slice, loopify and
// synchronized blends.
export { blend, delta, addDelta, mask, mirrorPose, wrap180, GROUPS, POSE_FIELDS, type Pose, type Mask } from "./pose.ts";
export { retime, slice, loopify, type Retime, type Timeline } from "./time.ts";
export { phaseMap, syncBlend, type PhaseMap, type SyncedBlend, type SyncOptions } from "./sync.ts";
