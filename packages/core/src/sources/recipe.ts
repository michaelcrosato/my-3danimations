// The recipe source (PLAN.md WP-9.2): WP-6.1's compiler behind the socket. The intent picks a recipe from the book by
// its name (or its id's slug), tags and description (match.ts), the seed picks among equal matches, and it is compiled
// through the resolver given (the library's, `Library#resolver()`). Its clip keeps the license its inputs force (D10),
// so its terms are "inherit"; its provenance names the recipe's hash and its inputs' content ids, as compile writes it.
import { VERSION } from "../version.ts";
import { compile } from "../recipe/compile.ts";
import type { Recipe, Resolver } from "../recipe/types.ts";
import { pick } from "./match.ts";
import { SourceError, type MotionSource, type SourceOutput, type SourceRequest } from "./types.ts";

/** What the recipe source compiles: its recipes, the resolver that finds their clips, and the key budget (mm). */
export interface RecipeBook {
  recipes: readonly Recipe[];
  resolve: Resolver;
  budget?: number;
}

/** The recipe source: the book's recipe matching the intent, compiled. E_NO_MATCH (with the recipes' ids) when none
 *  matches; a recipe that doesn't compile comes back as compile's RecipeError, through the socket as E_SOURCE. */
export function recipeSource(book: RecipeBook): MotionSource {
  const cands = book.recipes.map((r) => ({ name: r.name ?? r.id.slice(r.id.indexOf("/") + 1), tags: r.tags ?? [], about: r.desc ?? "", value: r }));
  return {
    name: "recipe",
    terms: { license: "inherit", version: VERSION },
    generate(req: SourceRequest): SourceOutput {
      const hit = pick(req.intent, req.seed, cands);
      if (!hit) throw new SourceError("E_NO_MATCH", `recipe: no recipe matches ${JSON.stringify(req.intent)}; the book has ${book.recipes.map((r) => r.id).join(", ") || "none"}`);
      const warnings: string[] = [];
      if (hit.tied.length > 1) warnings.push(`seed ${req.seed} picked ${hit.chosen.value.id} of ${hit.tied.length} equal matches; another seed may pick another`);
      if (req.constraints?.length) warnings.push("a recipe makes its poses from its steps: constraints are measured, not followed");
      const { clip, rest } = compile(hit.chosen.value, book.resolve, book.budget === undefined ? {} : { budget: book.budget });
      return { clip, rest, warnings };
    },
  };
}
