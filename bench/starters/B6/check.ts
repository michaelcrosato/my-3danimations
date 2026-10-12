// `npm run check`: compiles punch.json against the CC0 library and prints what the grader reads: issues, the clip's
// length, its strike and the fist that strikes, how far that fist draws back first, and the sensors' verdict, beside
// the original's (MESH2MOTION/Punch_Cross). It doesn't grade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, measureFacts, recipe as R, validate, type Clip, type Rest } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { checks, metrics } from "@m3a/sensors";

const recipe = JSON.parse(readFileSync(join(import.meta.dirname, "punch.json"), "utf8")) as R.Recipe, issues = R.validateRecipe(recipe);
if (issues.length) {
  for (const i of issues) console.log(`${i.code} ${i.field ?? ""}: ${i.message}${i.fix ? ` (fix: ${i.fix})` : ""}`);
  process.exit(1);
}
const library = openLibrary(), edit = R.compile(recipe, library.resolver()), orig = library.clip("MESH2MOTION/Punch_Cross");
/** The strike, the fist moving forward fastest against the pelvis then, and how far it draws back before it. */
function punch(clip: Clip, rest: Rest): string {
  const strike = (measureFacts(clip, rest).strike as number[])[0]!, F = checks.motionOf(clip, rest).frames, i = Math.min(F.length - 2, Math.max(1, Math.round(strike * 60)));
  const fwd = (s: string) => F.map((X) => X[format.IDX[`fist${s}`]! * 3]! - X[format.IDX.pelvis! * 3]!);
  const [L, Rt] = [fwd("L"), fwd("R")], side = L[i + 1]! - L[i - 1]! > Rt[i + 1]! - Rt[i - 1]! ? "left" : "right", f = side === "left" ? L : Rt;
  const back = Math.max(0, ...f.slice(0, i).map((x) => f[0]! - x));
  return `${clip.dur} s, strikes at ${strike} s with the ${side} fist, which draws back ${Math.round(back)} mm first (hips ${Math.round(rest.H0)} mm up); sensors ${metrics(clip, rest).verdict}`;
}
console.log(`the original: ${punch(orig.clip, orig.rest)}`);
console.log(`your edit:    ${punch(edit.clip, edit.rest)}; ${validate(edit.clip).errors.length} validation errors`);
