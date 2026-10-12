// Recipes' public surface (spec/RECIPE.md, PLAN.md WP-6.1): check a recipe, compile it into a clip, describe it, and
// the tracks and operations it is made of.
export { compile, quantize, licenseOf, RECIPE_PRODUCER, KEY_BUDGET, type Compiled } from "./compile.ts";
export { validateRecipe, formatRecipeIssue, RecipeError, RECIPE_RULES, OPS, type RecipeIssue } from "./validate.ts";
export { describeRecipe, tokenCount } from "./describe.ts";
export { trackOfClip, poseAt, rootAt, frameTimes, playable } from "./track.ts";
export { sha256, canonical } from "./sha256.ts";
export type { Recipe, Step, Resolved, Resolver, Track, Root } from "./types.ts";
