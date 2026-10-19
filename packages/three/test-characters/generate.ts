// The test characters without three.js (D119): a seed's character built as a GLB in memory, for code that reads it as
// a file does (@m3a/tools' `gen-<seed>`, which the single m3a.js bundles). ./index.ts adds the loader, which needs three.

/** A test character as a glTF binary (GLB), with its skeleton; its spec, and a generated bone. */
export { character, type CharacterSpec, type GenBone } from "./characters.ts";
/** The test set's seeds, and the character a seed gives. */
export { TEST_SEEDS, variant } from "./variants.ts";
