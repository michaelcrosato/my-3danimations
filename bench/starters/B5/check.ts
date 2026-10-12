// `npm run check`: compiles emote.json against the CC0 library and prints what the grader reads: issues, the clip's
// length and loop, the sensors' verdict and findings, its description, and how high the hands go. It doesn't grade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, recipe as R, validate } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { checks, describe, metrics } from "@m3a/sensors";

const recipe = JSON.parse(readFileSync(join(import.meta.dirname, "emote.json"), "utf8")) as R.Recipe, issues = R.validateRecipe(recipe);
if (issues.length) {
  for (const i of issues) console.log(`${i.code} ${i.field ?? ""}: ${i.message}${i.fix ? ` (fix: ${i.fix})` : ""}`);
  process.exit(1);
}
const { clip, rest } = R.compile(recipe, openLibrary().resolver()), m = metrics(clip, rest);
console.log(`${clip.id}: ${clip.dur} s, ${clip.loop ? "a loop" : "not a loop"}; ${validate(clip).errors.length} validation errors`);
console.log(`sensors: ${m.text}`);
console.log(`describe: ${describe(clip, rest).text}`);
const frames = checks.motionOf(clip, rest).frames, P = (X: Float32Array, n: string) => X[format.IDX[n]! * 3 + 2]!;
console.log(`both wrists above the head in ${frames.filter((X) => P(X, "wristL") > P(X, "head") && P(X, "wristR") > P(X, "head")).length} of ${frames.length} frames`);
