// B3's grader (PLAN.md §7, WP-6.6): the workspace's reactor driven twice, walking, with a light hit at 3 s and a heavy
// one at 6 s, and once without the light hit, graded from the character's bones: during the light hit the legs (hips,
// knees, ankles against the pelvis) stay within 2 cm of the walk without it while the hands or head move 5 cm from it;
// the heavy hit puts the hips below 45% of their standing height within 1.5 s and on the ground (under 15%) for 1.3 to
// 3.5 s (a second lying, the fall and the rise's start included), then back above 85% within 3 s; it walks again by
// the end; the feet, pelvis and head never go 5% of the hip height under the floor; no transform goes non-finite. The
// character is the grader's parameter: the workspace's character.glb.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Check, Grade } from "../B1/grade.ts";
import { bodyOf, jointsOf, len, sub, type V3 } from "../bones.ts";

/** The frames (60 a second): walking from 1 s, the light hit at 3 s, the heavy one at 6 s, the run's end at 13 s. */
export const WALK = 60, LIGHT = 180, HEAVY = 360, FRAMES = 780;
const LEGS = ["hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"], UPPER = ["wristL", "wristR", "head"];

type Run = { joints: Record<string, V3>[]; nonFinite: number; threw: string };
/** Drives a reactor from the workspace (`light`: whether the light hit comes). */
async function drive(workspace: string, bones: readonly [string, string][], light: boolean): Promise<Run> {
  const v = `?run=${light ? "a" : "b"}`;
  const { loadCharacter } = (await import(pathToFileURL(join(workspace, "src/character.ts")).href + v)) as { loadCharacter(): Promise<never> };
  const { createReactor } = (await import(pathToFileURL(join(workspace, "src/reactor.ts")).href + v)) as { createReactor(c: unknown): Promise<{ update(dt: number, i: { speed: number; hit?: "light" | "heavy" }): void }> };
  const out: Run = { joints: [], nonFinite: 0, threw: "" };
  let frame = 0;
  try {
    const character: { updateMatrixWorld(f: boolean): void; traverse(f: (o: { matrixWorld: { elements: number[] } }) => void): void; getObjectByName(n: string): never } = await loadCharacter();
    const reactor = await createReactor(character);
    for (frame = 0; frame < FRAMES; frame++) {
      reactor.update(1 / 60, { speed: frame >= WALK ? 1.2 : 0, ...(frame === LIGHT && light ? { hit: "light" as const } : frame === HEAVY ? { hit: "heavy" as const } : {}) });
      character.updateMatrixWorld(true);
      character.traverse((o) => void (o.matrixWorld.elements.every(Number.isFinite) || out.nonFinite++));
      out.joints.push(jointsOf(character, bones));
    }
  } catch (err) {
    out.threw = `at frame ${frame}: ${String((err as Error).message).split("\n")[0]}`;
  }
  return out;
}

/** Grades the reactor in `workspace` (its src/reactor.ts, on its character.glb). */
export async function gradeB3(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const { core, bones } = await bodyOf(workspace), H0 = core.rest.H0;
  const a = await drive(workspace, bones, true), b = await drive(workspace, bones, false);
  add("runs", !a.threw && !b.threw, a.threw || b.threw || `${FRAMES} frames, twice`);
  add("finite", !a.threw && a.nonFinite + b.nonFinite === 0, a.nonFinite + b.nonFinite ? `${a.nonFinite + b.nonFinite} non-finite transforms` : "every bone finite every frame");
  if (a.threw || b.threw) return done();
  const rel = (j: Record<string, V3>, p: string) => sub(j.pelvis!, j[p]!);
  // the light hit: its 0.8 s against the walk without it
  let legs = 0, upper = 0;
  for (let i = LIGHT; i < LIGHT + 48; i++) {
    for (const p of LEGS) legs = Math.max(legs, len(sub(rel(a.joints[i]!, p), rel(b.joints[i]!, p))));
    for (const p of UPPER) upper = Math.max(upper, len(sub(rel(a.joints[i]!, p), rel(b.joints[i]!, p))));
  }
  add("a light hit moves the legs no more than 2 cm", legs <= 20, `the legs ${(legs / 10).toFixed(1)} cm at most from the walk without it`);
  add("a light hit moves the upper body", upper >= 50, `the hands and head ${(upper / 10).toFixed(1)} cm at most from the walk without it`);
  // the heavy hit: the hips' height, against their height standing (the rest's)
  const hip = (i: number) => a.joints[i]!.pelvis![2], downAt = a.joints.findIndex((_, i) => i >= HEAVY && hip(i) < 0.45 * H0);
  add("a heavy hit knocks it down", downAt >= 0 && downAt <= HEAVY + 90, downAt >= 0 ? `the hips below 45% ${((downAt - HEAVY) / 60).toFixed(2)} s after the hit` : `the hips never below 45% (lowest ${Math.round((100 * Math.min(...a.joints.slice(HEAVY).map((_, k) => hip(HEAVY + k)))) / H0)}%)`);
  if (downAt >= 0) {
    // lying: the hips under 15% of their standing height, from when they first get there to when they rise past it
    const lieAt = a.joints.findIndex((_, i) => i >= downAt && hip(i) < 0.15 * H0), upAt = lieAt < 0 ? -1 : a.joints.findIndex((_, i) => i > lieAt && hip(i) >= 0.15 * H0);
    const lay = lieAt < 0 ? 0 : upAt < 0 ? Infinity : (upAt - lieAt) / 60;
    add("it lies down 1 s, then gets up", lay >= 1.3 && lay <= 3.5, lieAt < 0 ? "it never lay on the ground (the hips under 15%)" : upAt < 0 ? "it never got up" : `lying ${lay.toFixed(2)} s, falling and rising included`);
    const standAt = upAt < 0 ? -1 : a.joints.findIndex((_, i) => i > upAt && hip(i) >= 0.85 * H0);
    add("it stands again", standAt >= 0 && standAt - upAt <= 180, standAt < 0 ? "the hips never back above 85%" : `the hips above 85% ${((standAt - upAt) / 60).toFixed(2)} s after it began to rise`);
  }
  const went = len(sub(a.joints[FRAMES - 61]!.pelvis!, a.joints[FRAMES - 1]!.pelvis!));
  add("it walks again", went > 0.5 * H0, `the hips went ${(went / H0).toFixed(2)} hip heights in the last second`);
  // the feet, the pelvis and the head (the arms may push against the floor getting up, as the sensors' lying profile
  // allows: touching it is the motion)
  const held = Object.keys(a.joints[0]!).filter((p) => /^(ankle|ball|toe)[LR]$|^pelvis$|^head$/.test(p));
  const sunk = Math.min(...a.joints.flatMap((j) => held.map((p) => j[p]![2])));
  add("nothing sinks through the floor", sunk >= -0.05 * H0, `the feet, pelvis and head ${(sunk / 10).toFixed(1)} cm at lowest (at most ${((0.05 * H0) / 10).toFixed(1)} cm under)`);
  return done();
}
