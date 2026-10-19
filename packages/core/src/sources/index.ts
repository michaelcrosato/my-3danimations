// The motion-source socket's public surface (PLAN.md WP-9.2), core's `sources` namespace: the shapes (a request, its
// constraints, a source's terms and output, the record and what the socket gives), `sourceClip` that runs any source
// the same way, and the built-in sources that need nothing outside core: procedural (gaits, idles, moves) and recipes.
// The library source, the HTTP adapter for external generators and the way to the intake queue are @m3a/tools'.
export { sourceClip, checkRequest, POSE_TOLERANCE, ROOT_TOLERANCE, ROOT_TURN, MAX_CONSTRAINTS } from "./socket.ts";
export { proceduralSource, type ProceduralBook } from "./procedural.ts";
export { recipeSource, type RecipeBook } from "./recipe.ts";
export { pick, words, type Candidate } from "./match.ts";
export { SourceError, type MotionSource, type SourceRequest, type SourceSkeleton, type SourceTerms, type SourceOutput, type SourceRecord, type Sourced, type Constraint, type PoseConstraint, type RootConstraint } from "./types.ts";
