// B3's grader (PLAN.md §7, WP-6.6): the workspace's reactor driven twice, walking, with a light hit at 3 s and a heavy
// one at 6 s, and once without the light hit, graded from the character's bones: walking (the second before the light
// hit, and the last second), it travels at the speed asked (±10%), a foot stands still at times, and a standing foot
// stays (the lower foot at 15% of the travel or less 40% of the time); during the light hit the legs (hips, knees,
// ankles against the pelvis) stay within 2% of the hip height of the walk without it while the hands or head move 5%
// from it; the heavy hit puts the hips below 45% of their standing height within 1.5 s and on the ground (under 15%)
// for 1.3 to 3.5 s (a second lying, the fall and the rise's start included), then back above 85% within 3 s, carried no
// more than 3.5 hip heights over the ground till then; the feet, pelvis and head never go 5% of the hip height under the
// floor (a foot 10% in the half second after the heavy hit); no transform goes non-finite. The character is the
// grader's parameter: the workspace's character.glb.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { checks } from "@m3a/sensors";
import type { Check, Grade } from "../B1/grade.ts";
import { bodyOf, jointsOf, len, sub, type BonePoint, type V3 } from "../bones.ts";

/** The frames (60 a second): walking from 1 s, the light hit at 3 s, the heavy one at 6 s, the run's end at 13 s. */
export const WALK = 60, LIGHT = 180, HEAVY = 360, FRAMES = 780;
const LEGS = ["hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"], UPPER = ["wristL", "wristR", "head"];
/** Of the hip height: the most a light hit may move the legs, and the least it moves the hands or head, from the walk
 *  without it; the farthest a heavy hit may carry the hips before it stands again. */
const LEGS_AT = 0.02, UPPER_AT = 0.05, THROWN = 3.5;
/** The most the lower foot may move walking, 40% of the time, of the body's travel. */
const STAYS = 0.15;

type Run = { joints: Record<string, V3>[]; nonFinite: number; threw: string };
/** Drives a reactor from the workspace (`light`: whether the light hit comes). */
async function drive(workspace: string, bones: readonly BonePoint[], floor: number, light: boolean): Promise<Run> {
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
      out.joints.push(jointsOf(character, bones, floor));
    }
  } catch (err) {
    out.threw = `at frame ${frame}: ${String((err as Error).message).split("\n")[0]}`;
  }
  return out;
}

/** Grades the reactor in `workspace` (its src/reactor.ts, on its character.glb). */
export async function gradeB3(workspace: string): Promise<Grade> {
  const t0 = performance.now(), out: Check[] = [], add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail }), done = () => ({ pass: out.every((c) => c.ok), checks: out, ms: performance.now() - t0 });
  const { core, bones, floor } = await bodyOf(workspace), H0 = core.rest.H0;
  const a = await drive(workspace, bones, floor, true), b = await drive(workspace, bones, floor, false);
  add("runs", !a.threw && !b.threw, a.threw || b.threw || `${FRAMES} frames, twice`);
  add("finite", !a.threw && a.nonFinite + b.nonFinite === 0, a.nonFinite + b.nonFinite ? `${a.nonFinite + b.nonFinite} non-finite transforms` : "every bone finite every frame");
  if (a.threw || b.threw) return done();
  // walking, before the light hit and again at the end (each its last second): at the speed asked, 1.2 hip heights a
  // second (±10%), its feet stepping: the lower foot's slowest tenth slower than the sensors' standing speed (an idle
  // slid along isn't), and a standing foot staying where it stands: the lower foot at 15% of the travel or less at
  // least 40% of the time (a walk moved by its feet: 0%; played at the rate the speed needs while the character moves
  // at it, as the manual's stride warping does: 7 to 13%; slid at half its rate: 48%)
  const low = (j: Record<string, V3>, s: string) => ["ankle", "ball", "toe"].map((p) => j[p + s]).filter((p): p is V3 => !!p).reduce((x, y) => (y[2] < x[2] ? y : x));
  const walking = (end: number, when: string) => {
    const J = a.joints.slice(end - 60, end), pace = (J[59]!.pelvis![0] - J[0]!.pelvis![0]) / (59 / 60) / H0;
    add(`it walks at the speed asked, ${when}`, Math.abs(pace - 1.2) <= 0.12, `the hips travel ${pace.toFixed(2)} hip heights a second (asked 1.2, ±0.12)`);
    const v = J.slice(1).map((j, k) => {
      const s = low(j, "L")[2] < low(j, "R")[2] ? "L" : "R", p = low(J[k]!, s), q = low(j, s);
      return Math.hypot(q[0] - p[0], q[1] - p[1]) * 60;
    }).sort((x, y) => x - y), p10 = v[Math.floor(0.1 * (v.length - 1))]!, still = H0 * checks.STANCE.speed;
    add(`a foot stands still walking, ${when}`, p10 < still, `the lower foot's slowest tenth moves ${(p10 / 1000).toFixed(2)} m/s or less (at most ${(still / 1000).toFixed(2)})`);
    const went = Math.max(pace * H0, 1e-9), p40 = v[Math.floor(0.4 * (v.length - 1))]!;
    add(`a standing foot stays, ${when}`, p40 <= STAYS * went, `the lower foot moves at ${Math.round((100 * p40) / went)}% of the travel or less 40% of the time (at most ${100 * STAYS}%)`);
  };
  walking(LIGHT, "before the hits");
  const rel = (j: Record<string, V3>, p: string) => sub(j.pelvis!, j[p]!);
  // the light hit: its 0.8 s against the walk without it
  let legs = 0, upper = 0;
  for (let i = LIGHT; i < LIGHT + 48; i++) {
    for (const p of LEGS) legs = Math.max(legs, len(sub(rel(a.joints[i]!, p), rel(b.joints[i]!, p))));
    for (const p of UPPER) upper = Math.max(upper, len(sub(rel(a.joints[i]!, p), rel(b.joints[i]!, p))));
  }
  add("a light hit leaves the legs", legs <= LEGS_AT * H0, `the legs ${(legs / H0 * 100).toFixed(1)}% of the hip height at most from the walk without it (at most ${100 * LEGS_AT}%)`);
  add("a light hit moves the upper body", upper >= UPPER_AT * H0, `the hands and head ${(upper / H0 * 100).toFixed(1)}% of the hip height at most from the walk without it (at least ${100 * UPPER_AT}%)`);
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
    // thrown, not flung: from the hit until it stands again, the hips travel no more than THROWN hip heights over the
    // ground (a knockback carried on at its take-off speed slid the body 7 hip heights while it lay)
    const to = standAt >= 0 ? standAt : FRAMES - 1, P = a.joints[HEAVY]!.pelvis!;
    let far = 0;
    for (let i = HEAVY; i <= to; i++) far = Math.max(far, Math.hypot(a.joints[i]!.pelvis![0] - P[0], a.joints[i]!.pelvis![1] - P[1]));
    add("a heavy hit throws it, no further", far <= THROWN * H0, `the hips ${(far / H0).toFixed(2)} hip heights from where the hit found them before it stands again (at most ${THROWN})`);
  }
  walking(FRAMES, "again at the end");
  // the feet, the pelvis and the head (the arms may push against the floor getting up, as the sensors' lying profile
  // allows: touching it is the motion)
  // (a foot by its joints, the ankle and the ball where it has toes, as a capture's bones would give it: a toe's tip, or
  // a toe-less foot's, digs in a little as a lying body's feet point down, as the library's get-ups' do)
  const onJoints = new Set(bones.filter(([, , local]) => !local).map(([p]) => p));
  // (the half second after the heavy hit, a cross-fade from a step into the knockback may dip a foot: there 10%)
  const held = Object.keys(a.joints[0]!).filter((p) => onJoints.has(p) && /^(ankle|ball)[LR]$|^pelvis$|^head$/.test(p));
  const under = (j: Record<string, V3>, i: number) => Math.max(...held.map((p) => -j[p]![2] / (i >= HEAVY && i < HEAVY + 30 && p !== "pelvis" && p !== "head" ? 2 : 1)));
  const sunk = Math.max(...a.joints.map(under));
  add("nothing sinks through the floor", sunk <= 0.05 * H0, `the feet, pelvis and head ${(Math.max(0, sunk) / 10).toFixed(1)} cm under it at most (at most ${((0.05 * H0) / 10).toFixed(1)}; a foot twice that in the half second after the heavy hit)`);
  return done();
}
