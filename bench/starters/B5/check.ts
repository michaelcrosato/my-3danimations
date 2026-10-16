// `npm run check`: compiles emote.json against the CC0 library and prints what the grader reads: issues, the clip's
// length and loop, the sensors' verdict and findings, its description, how high the hands go and how they wave. It
// doesn't grade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, recipe as R, validate } from "@m3a/core";
import { LibraryError } from "@m3a/library";
import { openLibrary } from "@m3a/library/node";
import { checks, describe, metrics } from "@m3a/sensors";

/** Prints each issue (its code, field, what is wrong and the fix) and stops. */
function stop(issues: readonly R.RecipeIssue[]): never {
  for (const i of issues) console.log(`${i.code} ${i.field ?? ""}: ${i.message}${i.fix ? ` (fix: ${i.fix})` : ""}`);
  process.exit(1);
}
const recipe = JSON.parse(readFileSync(join(import.meta.dirname, "emote.json"), "utf8")) as R.Recipe, issues = R.validateRecipe(recipe);
if (issues.length) stop(issues);
// the CC0 library, as the grader compiles against it: a clip of a tier past CC0 is one it lacks (R-E008)
const library = openLibrary(), all = library.resolver(), cc0: R.Resolver = Object.assign((id: string) => {
  try {
    return all(id);
  } catch (err) {
    if (err instanceof LibraryError && err.code === "E_TIER") return undefined;
    throw err;
  }
}, { ids: all.ids });
/** The recipe compiled, or its issues printed. */
function compiled(): ReturnType<typeof R.compile> {
  try {
    return R.compile(recipe, cc0);
  } catch (err) {
    if (err instanceof R.RecipeError) stop(err.issues);
    throw err;
  }
}
const { clip, rest } = compiled(), m = metrics(clip, rest);
console.log(`${clip.id}: ${clip.dur} s, ${clip.loop ? "a loop" : "not a loop"}; ${validate(clip).errors.length} validation errors`);
console.log(`sensors: ${m.text}`);
console.log(`describe: ${describe(clip, rest).text}`);
const frames = checks.motionOf(clip, rest).frames, P = (X: Float32Array, n: string) => X[format.IDX[n]! * 3 + 2]!;
console.log(`both wrists above the head in ${frames.filter((X) => P(X, "wristL") > P(X, "head") && P(X, "wristR") > P(X, "head")).length} of ${frames.length} frames`);
// each hand's wave as the grader reads it: how far it goes side to side (of the hip height) and how often it turns back
for (const s of ["L", "R"]) {
  const side = frames.map((X) => X[format.IDX[`wrist${s}`]! * 3 + 1]!), span = Math.max(...side) - Math.min(...side);
  let turns = 0;
  for (let i = 2; i < side.length; i++) if ((side[i]! - side[i - 1]!) * (side[i - 1]! - side[i - 2]!) < 0 && Math.abs(side[i]! - side[i - 2]!) > 0.002 * rest.H0) turns++;
  console.log(`the ${s === "L" ? "left" : "right"} hand goes side to side ${((100 * span) / rest.H0).toFixed(0)}% of the hip height, turning ${turns} times`);
}
