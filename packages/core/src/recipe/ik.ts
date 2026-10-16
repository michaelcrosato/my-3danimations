// The recipe's IK targets (spec/RECIPE.md §2): `look` turns the head toward a point, `pin` holds a hand or a foot on a
// path. Both work on the body points the pose decodes to and encode back only the fields they move, so the rest of
// the pose is left exactly as it was: the head's face turned the shortest way to the target (its turn and lean within
// what a neck does), a limb's end put on the path by two-bone IK with the elbow or knee kept on its side, the hand
// carried with the forearm, a foot keeping how it points.
import { IDX, P, type Rest } from "../format/body.ts";
import { add, cross, dot, len, mul, norm, qrot, sub, type Quat, type V3 } from "../format/math.ts";
import { decodePose, encodePose } from "../format/pose.ts";
import { blend, wrap180, type Pose } from "../ops/pose.ts";
import { build, envelope } from "./steps.ts";
import { poseAt, rootAt } from "./track.ts";
import type { Track } from "./types.ts";

const pt = (X: ArrayLike<number>, n: string): V3 => {
  const i = IDX[n]! * 3;
  return [X[i]!, X[i + 1]!, X[i + 2]!];
};
const put = (X: Float32Array, n: string, v: readonly number[]) => X.set(v, IDX[n]! * 3);
/** The rotation taking direction a to direction b the shortest way (a half turn about any perpendicular for opposites). */
function between(a: V3, b: V3): Quat {
  const u = norm(a), v = norm(b), c = dot(u, v);
  if (c < -0.999999) {
    const ax = norm(Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0]));
    return [ax[0], ax[1], ax[2], 0];
  }
  const x = cross(u, v), q: Quat = [x[0], x[1], x[2], 1 + c], l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/** The pose with `fields` taken from the points X, encoded with the pose itself as the reference for continuity. */
function encoded(R: Rest, X: Float32Array, p: Pose, fields: readonly string[]): Pose {
  const e = encodePose(R, X, p, { hands: p.handL !== undefined || p.handR !== undefined, round: false }), out = { ...p };
  for (const f of fields) if (e[f] !== undefined) out[f] = e[f];
  return out;
}

/** The head turned toward `at` (mm from the root), `weight` of the way, under the envelope from–to; the turn and lean
 *  it takes relative to the chest stay within 80° and 60°. */
export function look(t: Track, at: V3, from: number, to: number, fade: number, weight: number): Track {
  const env = envelope(from, to, fade), X = new Float32Array(P * 3);
  return build(t, t.dur, t.loop, (time) => {
    const p = poseAt(t, time), root = rootAt(t, time), w = env(time) * weight;
    if (w === 0) return { pose: p, root };
    decodePose(t.rest, p, X);
    const head = pt(X, "head"), q = between(sub(pt(X, "faceF"), head), sub(at, head));
    for (const n of ["faceF", "headTop"]) put(X, n, add(head, qrot(q, sub(pt(X, n), head))));
    const turned = encoded(t.rest, X, p, ["head"]), h = turned.head as number[], h0 = p.head as number[];
    // within what a neck does, relative to the chest
    const limited = [Math.max(-80, Math.min(80, h[0]!)), Math.max(-60, Math.min(60, h[1]!)), h[2]!];
    const toward = limited.map((v, i) => h0[i]! + wrap180(v - h0[i]!));
    return { pose: blend(p, { ...p, head: toward }, w, { head: 1 }), root };
  }, { events: t.events, ...(t.contacts ? { contacts: t.contacts } : {}), ...(t.cycle ? { cycle: t.cycle } : {}) });
}

/** The chain of each end: the joint it hangs from, the middle joint, its end point and what moves with the end. */
const CHAINS = {
  handL: { root: "shL", mid: "elbowL", end: "fistL", carried: ["wristL", "indexL", "knuckL", "pinkyL"], fields: ["armL", "handL"], rigid: true, bend: [-1, -0.7, -0.2] },
  handR: { root: "shR", mid: "elbowR", end: "fistR", carried: ["wristR", "indexR", "knuckR", "pinkyR"], fields: ["armR", "handR"], rigid: true, bend: [-1, 0.7, -0.2] },
  footL: { root: "hipL", mid: "kneeL", end: "ankleL", carried: ["ballL", "toeL"], fields: ["legL", "footL"], rigid: false, bend: [1, -0.15, 0.1] },
  footR: { root: "hipR", mid: "kneeR", end: "ankleR", carried: ["ballR", "toeR"], fields: ["legR", "footR"], rigid: false, bend: [1, 0.15, 0.1] },
} as const;

/** A path's point at a time: linear between its points, held at its ends. */
function pathAt(path: readonly (readonly number[])[], time: number): V3 {
  if (time <= path[0]![0]!) return [path[0]![1]!, path[0]![2]!, path[0]![3]!];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    if (time <= b[0]!) {
      const u = (time - a[0]!) / Math.max(1e-9, b[0]! - a[0]!);
      return [a[1]! + (b[1]! - a[1]!) * u, a[2]! + (b[2]! - a[2]!) * u, a[3]! + (b[3]! - a[3]!) * u];
    }
  }
  const l = path[path.length - 1]!;
  return [l[1]!, l[2]!, l[3]!];
}

/**
 * In the points X, `end` put at T by two-bone IK (held within REACH of an arm's length, LEG_REACH of a leg's), the
 * elbow or knee on the side it was: its offset
 * from the limb, turned as the limb swings from its end to the target, and as the limb nears straight (that offset
 * under a twentieth of the upper bone, about 6° of bend), the way an elbow or a knee bends (back and out, forward). A hand's points turn with the forearm; a foot's move with the
 * ankle, keeping how it points. With T where the end already is and the limb bent, X is unchanged. `prev`, the joint and
 * end the last frame put (relative to the same root joint), takes the side from there instead, for a limb swung far;
 * `lengths`, the upper and lower bones', for points whose root joint has moved since the limb was last solved.
 */
export function reachTo(X: Float32Array, end: keyof typeof CHAINS, T: V3, prev?: { mid: V3; end: V3 }, lengths?: readonly [number, number]): void {
  const c = CHAINS[end], S = pt(X, c.root), E = pt(X, c.mid), F = pt(X, c.end);
  const [a, b] = lengths ?? [len(sub(E, S)), len(sub(F, E))], toT = sub(T, S), dT = Math.max(1e-6, len(toT)), u = mul(toT, 1 / dT);
  // short of full reach by a little: a limb pulled straight has no side to bend to, and its twist no reference
  const d = Math.min(Math.max(dT, Math.abs(a - b) + 1e-3), (a + b) * (c.rigid ? REACH : LEG_REACH));
  // the side the joint bends to: where it is, turned with the limb's swing to the target (a knee kicked forward points
  // up, not down), and as the limb straightens, the way an elbow or a knee bends
  // (given the joint where the last frame left it, frame after frame, from there: a big swing turns it the short way)
  const perp = (v: readonly number[]) => sub(v, mul(u, dot(v, u))), from = prev ? [prev.mid, prev.end] : [E, F], swing = between(sub(from[1]!, S), toT);
  const own = perp(qrot(swing, sub(from[0]!, S))), hint = perp(c.bend), lean = Math.max(0, 0.05 * a - len(own));
  let side = add(own, mul(norm(hint), lean));
  if (len(side) < 1e-6) side = cross(u, [0, 0, 1]);
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const E2 = add(add(S, mul(u, x)), mul(norm(side), h)), F2 = add(S, mul(u, d));
  const q = between(sub(F, E), sub(F2, E2));
  for (const n of c.carried) put(X, n, c.rigid ? add(E2, qrot(q, sub(pt(X, n), E))) : add(pt(X, n), sub(F2, F)));
  put(X, c.mid, E2);
  put(X, c.end, F2);
}
/** The most of an arm's length IK reaches out to: about 20° short of straight. */
export const REACH = 0.985;
/** A leg's: a standing leg is nearly straight, its knee kept forward by the bend direction. */
export const LEG_REACH = 0.998;
/** The fields an end's chain moves. */
export const chainFields = (end: keyof typeof CHAINS): readonly string[] => CHAINS[end].fields;

/** `end` held on `path` ([[t, forward, right, up], …] mm from the root) over the path's span, faded in and out. */
export function pin(t: Track, end: keyof typeof CHAINS, path: readonly (readonly number[])[], fade: number): Track {
  const c = CHAINS[end], env = envelope(path[0]![0]!, path[path.length - 1]![0]!, fade), X = new Float32Array(P * 3);
  return build(t, t.dur, t.loop, (time) => {
    const p = poseAt(t, time), root = rootAt(t, time), w = env(time);
    if (w === 0) return { pose: p, root };
    decodePose(t.rest, p, X);
    reachTo(X, end, pathAt(path, time));
    const solved = encoded(t.rest, X, p, c.fields), mask = Object.fromEntries(c.fields.map((f) => [f, 1]));
    return { pose: blend(p, solved, w, mask), root };
  }, { events: t.events, ...(t.contacts ? { contacts: t.contacts } : {}), ...(t.cycle ? { cycle: t.cycle } : {}) });
}
