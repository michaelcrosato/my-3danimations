// Test characters (WP-4.2): skinned humanoids generated in code from a seed, written as GLB in memory; the test set of
// 20; and reading a character in three.js. Real CC0 rigs are fetched by `npm run fixtures` into .cache/fixtures/.
export { character, skeletonOf, type Build, type CharacterSpec, type GenBone, type Naming, type RestPose } from "./characters.ts";
export { TEST_SEEDS, variant } from "./variants.ts";
export { loadGlb, skeletonIn, withoutTextures, type Loaded } from "./load.ts";
