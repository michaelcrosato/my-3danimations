// What the graders read of a character (PLAN.md §7): its body points from its bones each frame, in the sensors' axes
// and millimetres (the grader binds its own copy of the character for the mapping). A point on a bone's joint is that
// bone's place; a point off the joints (a bone's tip, a share along it, ahead of it: a toe-less foot's ball, a hand's
// knuckles, the head's top, a chest a missing bone leaves between joints) rides its bone from where it sits at rest. A
// character is graded by what its bones do, not by what its code says it does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, skeleton, solver, type Bound } from "@m3a/core";
import { bind } from "@m3a/three";
import { loadGlb } from "@m3a/three/test-characters";

type Node = { getObjectByName(n: string): { matrixWorld: { elements: number[] } } | undefined };
/** A point: forward, right, up mm. */
export type V3 = [number, number, number];
/** A body point and the bone it rides: on the bone's joint, or at `local`, its rest place in the bone's frame. */
export type BonePoint = [point: string, bone: string, local?: V3];

/** p in the frame of the bone whose world matrix (column-major, an affine) is e. */
function inFrame(e: readonly number[], p: readonly number[]): V3 {
  const [a, b, c, d, f, g, h, i, j] = [e[0]!, e[4]!, e[8]!, e[1]!, e[5]!, e[9]!, e[2]!, e[6]!, e[10]!], x = p[0]! - e[12]!, y = p[1]! - e[13]!, z = p[2]! - e[14]!;
  const det = a * (f * j - g * i) - b * (d * j - g * h) + c * (d * i - f * h);
  return [((f * j - g * i) * x - (b * j - c * i) * y + (b * g - c * f) * z) / det, (-(d * j - g * h) * x + (a * j - c * h) * y - (a * g - c * d) * z) / det, ((d * i - f * h) * x - (a * i - b * h) * y + (a * f - b * d) * z) / det];
}

/**
 * The grader's own bound copy of a workspace's character: its body (rest, H0), the bones its body points ride, its
 * floor (mm up from y = 0): the lowest sole point at rest, when that is more than 10% of the hip height off y = 0 (a
 * model authored off the floor: G4's held-out rig stands 1 m below its origin), else 0 (a toe's tip a few cm under it
 * at rest is the model's own), and its `sole`: the ground its rest is measured on (core's, where its soles are: the rest
 * pelvis's height less its height in the format), the floor its own feet stand on (B1 reads heights from it, D145: a
 * generated test character's soles stand 16 to 44 mm under y = 0, its toes' and balls' joints 20 mm over it).
 */
export async function bodyOf(workspace: string): Promise<{ core: Bound; bones: BonePoint[]; floor: number; sole: number }> {
  const scene = (await loadGlb(new Uint8Array(readFileSync(join(workspace, "character.glb"))), { textures: false })).scene, core = bind(scene).core, R = core.recognition.bones;
  const bones: BonePoint[] = Object.entries(core.jointPoint).map(([h, point]) => [point, R[h]!] as BonePoint).filter(([, bone]) => bone);
  const on = new Set(bones.map(([p]) => p));
  scene.updateMatrixWorld(true);
  for (const point of format.POINTS) {
    const place = skeleton.BODY_POINTS[point]?.find((pl) => R[pl.bone]);
    // a toe-less foot's toe falls back to the foot's tip, where its ball is: `pointsOf` extends the toe past the ball
    if (on.has(point) || !place || (point.startsWith("toe") && place.bone.endsWith("Foot"))) continue;
    const e = scene.getObjectByName(R[place.bone]!)?.matrixWorld.elements;
    if (e) bones.push([point, R[place.bone]!, inFrame(e, solver.toSkeleton(core, core.restPts, format.IDX[point]! * 3))]);
  }
  const rest = jointsOf(scene as never, bones), low = Math.min(...["ankle", "ball", "toe"].flatMap((p) => ["L", "R"].map((s) => rest[p + s]?.[2] ?? Infinity)));
  return { core, bones, floor: Math.abs(low) > 0.1 * core.rest.H0 ? low : 0, sole: rest.pelvis![2] - core.restPts[format.IDX.pelvis! * 3 + 2]! };
}
/** The body points of a character's scene as it stands (call updateMatrixWorld first), mm, forward (+Z), right (−X),
 *  up from `floor` (bodyOf's). */
export function jointsOf(scene: Node, bones: readonly BonePoint[], floor = 0): Record<string, V3> {
  const out: Record<string, V3> = {};
  for (const [point, bone, l] of bones) {
    const e = scene.getObjectByName(bone)?.matrixWorld.elements;
    if (!e) out[point] = [Number.NaN, Number.NaN, Number.NaN];
    else {
      const [x, y, z] = l ?? [0, 0, 0], at = [0, 1, 2].map((r) => e[r]! * x + e[4 + r]! * y + e[8 + r]! * z + e[12 + r]!);
      out[point] = [at[2]! * 1000, -at[0]! * 1000, at[1]! * 1000 - floor];
    }
  }
  return out;
}
/** b − a. */
export const sub = (a: V3, b: V3): V3 => [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
/** |v|. */
export const len = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

/**
 * The body points a frame of joints gives, as the sensors read them (format.P × 3, mm): the points the bones carry, a
 * toe-less foot's toe along the foot past its ball, and any point a skeleton has no bone for at its nearest (the
 * hand's points at the wrist, the torso and head at theirs).
 */
export function pointsOf(joints: Record<string, V3>, R: { bt: number }): Float32Array {
  const X = new Float32Array(format.P * 3);
  for (const [n, p] of Object.entries(joints)) if (format.IDX[n] !== undefined) X.set(p, format.IDX[n]! * 3);
  const g = (n: string): V3 => [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!], put = (n: string, v: readonly number[]) => X.set(v, format.IDX[n]! * 3);
  const has = (n: string) => n in joints;
  for (const s of ["L", "R"]) {
    const a = g("ankle" + s), b = g("ball" + s), k = R.bt / Math.max(1e-6, len(sub(a, b)));
    if (!has("toe" + s)) put("toe" + s, [b[0] + (b[0] - a[0]) * k, b[1] + (b[1] - a[1]) * k, b[2] + (b[2] - a[2]) * k]);
    for (const n of ["index", "knuck", "pinky", "fist"]) if (!has(n + s)) put(n + s, g("wrist" + s));
  }
  if (!has("spine2")) put("spine2", g("spine1"));
  if (!has("chest")) put("chest", g("spine2"));
  for (const [n, from] of [["chestF", "chest"], ["pelvisF", "pelvis"], ["headTop", "head"], ["faceF", "head"]] as const) if (!has(n)) put(n, g(from));
  return X;
}
