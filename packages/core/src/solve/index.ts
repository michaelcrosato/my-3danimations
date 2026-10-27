// The solver's public surface (PLAN.md WP-2.4): bind a skeleton, solve a pose onto it, and the joints it reaches; a
// posed skeleton's body points read back (WP-F.18).
export { bind, toSkeleton, toFormat, dirToSkeleton, type Bound, type BindOptions } from "./bind.ts";
export { solve, forward, solveRest, reachable, decodeOn, type Solved, type SolveOptions } from "./solve.ts";
export { posedPoints, type PosedBone } from "./posed.ts";
