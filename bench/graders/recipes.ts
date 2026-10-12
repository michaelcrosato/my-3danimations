// What the making briefs' graders read (PLAN.md §7, WP-6.6): a workspace's recipe, checked and compiled against the
// CC0 library (the default pack an agent sees), and the clip it makes sampled on its own rest: a body point's track,
// and the fist that strikes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Animator, format, measureFacts, playable, recipe as R, validate, type Clip, type Rest } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { checks, metrics } from "@m3a/sensors";
import type { Check } from "./B1/grade.ts";
import { bodyOf } from "./bones.ts";

/** A recipe from a workspace, checked and compiled (its clip and rest), or the checks that stopped it. */
export function compiled(workspace: string, file: string, add: (name: string, ok: boolean, detail: string) => void): { recipe: R.Recipe; clip: Clip; rest: Rest } | null {
  let recipe: R.Recipe;
  try {
    recipe = JSON.parse(readFileSync(join(workspace, file), "utf8")) as R.Recipe;
  } catch (err) {
    add("the recipe is JSON", false, `${file}: ${String((err as Error).message).split("\n")[0]}`);
    return null;
  }
  const issues = R.validateRecipe(recipe);
  add("the recipe checks", issues.length === 0, issues.length ? issues.slice(0, 3).map((i) => `${i.code} ${i.field ?? ""} ${i.message}`).join("; ") : "no issues");
  if (issues.length) return null;
  let out: { clip: Clip; rest: Rest };
  try {
    out = R.compile(recipe, openLibrary().resolver());
  } catch (err) {
    add("it compiles against the CC0 library", false, String((err as Error).message).split("\n")[0]!);
    return null;
  }
  const errors = validate(out.clip).errors;
  add("its clip is valid", errors.length === 0, errors.length ? errors.slice(0, 3).map((e) => `${e.code} ${e.message}`).join("; ") : `${out.clip.id}, ${out.clip.dur} s${out.clip.loop ? ", a loop" : ""}`);
  return errors.length ? null : { recipe, clip: out.clip, rest: out.rest };
}

/** A body point's track (forward, right, up mm on the root) every 1/60 s of a clip on its rest. */
export function track(clip: Clip, rest: Rest, point: string): [number, number, number][] {
  return checks.motionOf(clip, rest).frames.map((X) => [X[format.IDX[point]! * 3]!, X[format.IDX[point]! * 3 + 1]!, X[format.IDX[point]! * 3 + 2]!]);
}

/** A punch's strike (its facts: when the fastest end moves fastest), the fist that strikes (the one moving forward
 *  fastest against the pelvis then), and how far that fist first goes back from where it starts (the wind-up, mm). */
export function punchOf(clip: Clip, rest: Rest): { strike: number; side: "L" | "R"; windup: number } {
  const strike = (measureFacts(clip, rest).strike as number[] | undefined)?.[0] ?? 0, n = checks.motionOf(clip, rest).frames.length;
  const pel = track(clip, rest, "pelvis"), i = Math.min(n - 2, Math.max(1, Math.round(strike * 60)));
  const fwd = (s: "L" | "R") => track(clip, rest, `fist${s}`).map((p, k) => p[0] - pel[k]![0]);
  const [L, Rt] = [fwd("L"), fwd("R")], side = L[i + 1]! - L[i - 1]! > Rt[i + 1]! - Rt[i - 1]! ? "L" : "R", f = side === "L" ? L : Rt;
  let windup = 0;
  for (let k = 0; k < i; k++) windup = Math.max(windup, f[0]! - f[k]!);
  return { strike, side, windup };
}
/** The sensors' verdict on a clip on its rest, green when nothing fails. */
export function sensorsCheck(clip: Clip, rest: Rest): Check {
  const r = metrics(clip, rest), fails = r.findings.filter((f) => f.level === "fail");
  return { name: "the sensors are green (nothing fails)", ok: r.verdict !== "fail", detail: fails.length ? fails.slice(0, 3).map((f) => f.message.split(":")[0]).join("; ") : `${r.verdict}` };
}
/** The clip played on the workspace's character (the grader's bound copy) for 3 s: every joint finite. */
export async function playsOn(workspace: string, clip: Clip, rest: Rest): Promise<Check> {
  const { core } = await bodyOf(workspace), a = new Animator(core).layer("made", { clip: playable(clip, rest) });
  let bad = 0;
  for (let i = 0; i < 180; i++) {
    a.step(1 / 60);
    if (i % 6 === 5) bad += Object.values(a.pose().joints).filter((j) => !j.every(Number.isFinite)).length;
  }
  return { name: "it plays on the character", ok: bad === 0, detail: bad ? `${bad} non-finite joints` : `3 s on the workspace's character (hips ${Math.round(core.rest.H0)} mm up), every joint finite` };
}
