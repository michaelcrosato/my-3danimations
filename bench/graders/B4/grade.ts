// B4's grader (PLAN.md §7, WP-6.6): the workspace's sneaker driven 6 s on its avatar (a VRM-named humanoid of unusual
// proportions), graded from the bones: it sneaks (the hips at most 85% of their standing height on average after the
// first second, travelling forward 15% of the hip height a second); it steps (each foot lifts 7% of the hip height and
// sets down again, three times or more between them); a foot stands still at times, and a standing foot stays where it
// stands (while the sensors read it standing, it moves at a quarter of the travel or less), its slide and skate under
// the sensors' limits on this body; the sensors' read of its bones fails on nothing; no transform goes non-finite. The
// avatar is the grader's parameter.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { checks } from "@m3a/sensors";
import type { Check, Grade } from "../B1/grade.ts";
import { bodyOf, jointsOf, pointsOf, type V3 } from "../bones.ts";

/** Frames driven (60 a second), and the first one judged. */
export const FRAMES = 360, FROM = 60;

/** Grades the sneaker in `workspace` (its src/sneak.ts, on its character.glb). */
export async function gradeB4(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const { core, bones } = await bodyOf(workspace), H0 = core.rest.H0;
  const { loadCharacter } = (await import(pathToFileURL(join(workspace, "src/character.ts")).href)) as { loadCharacter(): Promise<never> };
  const { createSneaker } = (await import(pathToFileURL(join(workspace, "src/sneak.ts")).href)) as { createSneaker(c: unknown): Promise<{ update(dt: number): void }> };
  const joints: Record<string, V3>[] = [];
  let nonFinite = 0, threw = "", frame = 0;
  try {
    const character: { updateMatrixWorld(f: boolean): void; traverse(f: (o: { matrixWorld: { elements: number[] } }) => void): void; getObjectByName(n: string): never } = await loadCharacter();
    const sneaker = await createSneaker(character);
    for (frame = 0; frame < FRAMES; frame++) {
      sneaker.update(1 / 60);
      character.updateMatrixWorld(true);
      character.traverse((o) => void (o.matrixWorld.elements.every(Number.isFinite) || nonFinite++));
      joints.push(jointsOf(character, bones));
    }
  } catch (err) {
    threw = `${frame ? `at frame ${frame}` : "creating the sneaker"}: ${String((err as Error).message).split("\n")[0]}`;
  }
  add("runs", !threw, threw || `${FRAMES} frames`);
  add("finite", !threw && nonFinite === 0, nonFinite ? `${nonFinite} non-finite transforms` : "every bone finite every frame");
  if (threw || nonFinite) return done();
  const judged = joints.slice(FROM), hips = judged.reduce((a, j) => a + j.pelvis![2], 0) / judged.length;
  const went = (judged.at(-1)!.pelvis![0] - judged[0]!.pelvis![0]) / ((judged.length - 1) / 60);
  add("it sneaks", hips <= 0.85 * H0 && went >= 0.15 * H0, `the hips at ${Math.round((100 * hips) / H0)}% of their standing height on average, travelling forward ${(went / H0).toFixed(2)} hip heights a second`);
  // a foot stands still at times: the lower foot's slowest tenth slower than the sensors' standing speed (a foot that
  // slides faster than that isn't read as standing at all, so the slide alone can't see it)
  const low = (j: Record<string, V3>, s: string) => ["ankle", "ball", "toe"].map((p) => j[p + s]).filter((p): p is V3 => !!p).reduce((a, b) => (b[2] < a[2] ? b : a));
  const v = judged.slice(1).map((j, k) => {
    const s = low(j, "L")[2] < low(j, "R")[2] ? "L" : "R", a = low(judged[k]!, s), b = low(j, s);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) * 60;
  }).sort((x, y) => x - y), p10 = v[Math.floor(0.1 * (v.length - 1))]!, still = H0 * checks.STANCE.speed;
  // it steps: each foot's sole rises 7% of the hip height above the lowest it goes and comes back within 4% (a crouched
  // idle slid or jumped along never does)
  const lifts = (["L", "R"] as const).map((s) => {
    const z = judged.map((j) => low(j, s)[2]), floor = Math.min(...z);
    let up = false, n = 0;
    for (const h of z) {
      if (!up && h > floor + 0.07 * H0) [up, n] = [true, n + 1];
      else if (up && h < floor + 0.04 * H0) up = false;
    }
    return n;
  });
  add("it steps", lifts[0]! >= 1 && lifts[1]! >= 1 && lifts[0]! + lifts[1]! >= 3, `the left foot lifted ${lifts[0]} times and the right ${lifts[1]} in ${((judged.length - 1) / 60).toFixed(0)} s (each at least once, three in all)`);
  add("a foot stands still at times", p10 < still, `the lower foot's slowest tenth moves ${(p10 / 1000).toFixed(2)} m/s or less (at most ${(still / 1000).toFixed(2)})`);
  const m = checks.motionOfFrames(judged.map((j) => pointsOf(j, core.rest)), core.rest, { id: "B4" }), slide = checks.slide(m), r = checks.measure(m);
  // a standing foot stays where it stands: while the sensors read it standing, the sole point lowest at each step moves
  // at a quarter of the body's travel or less (median), as a foot set down by a walk played at its own pace does
  const on: number[] = [];
  for (const s of ["L", "R"] as const)
    for (const [a, b] of m.contacts[`foot${s}`] ?? [])
      for (let k = Math.ceil(a * 60 - 1e-9) + 1; k <= Math.floor(b * 60 + 1e-9) && k < judged.length; k++) {
        const j0 = judged[k - 1]!, n = ["ankle", "ball", "toe"].filter((x) => j0[x + s]).reduce((x, y) => (j0[y + s]![2] < j0[x + s]![2] ? y : x)), p = j0[n + s]!, q = judged[k]![n + s]!;
        on.push(Math.hypot(q[0] - p[0], q[1] - p[1]) * 60);
      }
  const stays = on.sort((x, y) => x - y)[Math.floor(on.length / 2)];
  add("a standing foot stays", stays !== undefined && stays <= 0.25 * went, stays === undefined ? "the sensors never read a foot standing" : `a standing foot moves ${(stays / 1000).toFixed(2)} m/s (median), ${Math.round((100 * stays) / Math.max(went, 1e-9))}% of the travel (at most 25%)`);
  const lv = checks.levels(m, "slide"), ls = checks.levels(m, "skate");
  add("planted feet don't slide", slide.value < lv.fail && slide.skate.value < ls.fail, `slide ${slide.value.toFixed(0)} mm (fail ${lv.fail.toFixed(0)}), skate ${slide.skate.value.toFixed(1)} cm/s (fail ${ls.fail.toFixed(1)})`);
  const fails = r.findings.filter((f) => f.level === "fail");
  add("the sensors are green on its bones", fails.length === 0, fails.length ? fails.slice(0, 3).map((f) => f.message.split(":")[0]).join("; ") : r.verdict);
  return done();
}
