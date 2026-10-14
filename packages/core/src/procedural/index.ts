// Procedural sources' public surface (PLAN.md WP-6.2, D71): moves (the my-3d2dge and shardfall move model, units
// reconciled in library/moves.json), gaits and idles, each made into a format-2 clip on any rest from any start pose.
export { moveState, placeMove, standing, ik3, PHASES, SOURCE, type Move, type MoveState, type MoveBody, type MoveJoints, type MoveStart, type MoveAim, type Phase } from "./move.ts";
export { moveClip, clipOfTrack, standingOn, bodyOf, STANDING, MIN_PHASE, PROCEDURAL_PRODUCER, type ProceduralOptions } from "./clip.ts";
export { gaitClip, fitGait, footAt, GAITS, type Gait } from "./gait.ts";
export { idleClip, IDLES, type Idle } from "./idle.ts";
export { Limbs, type End } from "./limbs.ts";
export { validateMoves, MOVES_RULES } from "./validate.ts";
