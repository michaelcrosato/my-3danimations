// The solver's public surface (PLAN.md WP-2.4): bind a skeleton, solve a pose onto it, and the joints it reaches.
export { bind, toSkeleton, toFormat, dirToSkeleton, type Bound, type BindOptions } from "./bind.ts";
export { solve, forward, type Solved, type SolveOptions } from "./solve.ts";
