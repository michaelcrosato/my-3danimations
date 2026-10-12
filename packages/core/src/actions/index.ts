// Actions' public surface (spec/ACTION.md, PLAN.md WP-6.3, D72): check an action or a paired one, compile it on the
// library and its procedural parts, read its root curve and interrupt points, and cut it into another clip.
export { validateAction, validatePaired, recipeOf, isPaired, ACTION_RULES, type Action, type Beat, type Interrupt, type PairedAction, type Role } from "./action.ts";
export { compileAction, actionRootAt, interruptAt, interruptInto, compilePaired, pairAt, proceduralResolver, groundOf, type CompiledAction, type CompiledPair } from "./compile.ts";
