// The solver (PLAN.md WP-2.4; spec/SKELETON.md; PLAN.md §5.5): a pose's numbers onto a bound skeleton, as each bone's
// rotation. The pose is decoded on the target's own measured body (the hips at its hip height, every limb at its own
// lengths, two-bone IK with the pole the key's bend and twist give), then each bone turns from its rest direction to
// the decoded one, rolled by a reference the parameters fix: the pelvis, chest and head frames, the limbs' poles (so a
// straight limb keeps its twist: no singular pose), the hand's knuckle line and the pelvis's up for the feet. The
// spine bones take the pelvis-to-chest turn by shares (the source library's when given, so a curl spreads as its
// animators spread it). A pose whose sole would go below the floor is lifted whole until it stands on it.
// Carried from my-3d2dge's Mocap.drive (src/mocap/mocap.js:165-262: directions at the rig's own lengths, two-bone IK,
// the sole on the floor), E.ik3 and readable.js's pole helpers, through the decoder that ports them.
import { hintFor, IDX, poleHint, SG, type Rest, type Side } from "../format/body.ts";
import { loc, type Frame, type V3 } from "../format/math.ts";
import { decodePose, limbPoles, torso, type KeyLike } from "../format/pose.ts";
import { PORTABLE } from "../math/portable.ts";
import * as quat from "../math/quat.ts";
import type { Quat } from "../math/quat.ts";
import { dirToSkeleton, toSkeleton, type Bound } from "./bind.ts";

/** How to solve: the source body's spine shares (spread the turn as the clip's library does), and the floor. */
export interface SolveOptions {
  source?: Pick<Rest, "spineW" | "neckW">;
  /** The target body points to reach, already decoded and edited (planted feet, WP-2.5): the solver turns bones to them
   *  as they are (no floor lift: planting has set the soles on the ground). */
  points?: Float64Array;
  /** Keep the soles on or above the floor (true). */
  floor?: boolean;
}

/** A solved pose: the hips' place, every bone's rotation (world and local), and the target body points it reached. */
export interface Solved {
  /** The hips bone's head, in skeleton space. */
  hips: V3;
  /** Each bone's world orientation (its rest orientation turned by the pose). */
  world: Record<string, Quat>;
  /** Each bone's orientation relative to its parent's (a root's is its world one): what a host writes to its nodes. */
  local: Record<string, Quat>;
  /** The decoded body points the bones reach (format frame, mm), feet lifted onto the floor. */
  points: Float64Array;
}

const sub3 = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const dot3 = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross3 = (a: readonly number[], b: readonly number[]): V3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const unit = (a: readonly number[]): V3 => {
  const l = Math.sqrt(dot3(a, a));
  return l > 0 ? [a[0]! / l, a[1]! / l, a[2]! / l] : [0, 0, 0];
};
const at = (X: ArrayLike<number>, name: string): V3 => {
  const i = IDX[name]! * 3;
  return [X[i]!, X[i + 1]!, X[i + 2]!];
};
/** An orthonormal triad from a direction and a reference across it. */
function triad(d: readonly number[], ref: readonly number[]): [V3, V3, V3] {
  const e1 = unit(d);
  let r = sub3(ref, e1.map((x) => x * dot3(ref, e1)));
  if (dot3(r, r) < 1e-12) r = Math.abs(e1[0]) < 0.9 ? sub3([1, 0, 0], e1.map((x) => x * e1[0])) : sub3([0, 1, 0], e1.map((x) => x * e1[1]));
  const e2 = unit(r);
  return [e1, e2, cross3(e1, e2)];
}
/** The rotation (skeleton space) taking the rest triad onto the posed one, both given in the format's frame. */
function delta(b: Bound, rest: readonly V3[], posed: readonly V3[]): Quat {
  const m = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) {
    const p = dirToSkeleton(b, posed[i]!), r = dirToSkeleton(b, rest[i]!);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) m[row * 3 + col]! += p[row]! * r[col]!;
  }
  return quat.fromMat3([0, 0, 0, 1], m);
}
/** The rotation (format frame) taking rest frame A's axes onto posed frame B's, as a quaternion. */
function frameQuat(A: Frame, B: Frame): Quat {
  const m = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) m[row * 3 + col]! += B[i]![row]! * A[i]![col]!;
  return quat.fromMat3([0, 0, 0, 1], m);
}
/** v turned by angle (degrees) about the unit axis k (Rodrigues). */
function turn(v: readonly number[], k: readonly number[], deg: number): V3 {
  const a = (deg * Math.PI) / 180, c = PORTABLE.cos(a), s = PORTABLE.sin(a), kv = cross3(k, v), kd = dot3(k, v);
  return [v[0]! * c + kv[0] * s + k[0]! * kd * (1 - c), v[1]! * c + kv[1] * s + k[1]! * kd * (1 - c), v[2]! * c + kv[2] * s + k[2]! * kd * (1 - c)];
}

const SPINE_CHAIN = ["hips", "spine", "chest", "upperChest", "neck", "head"] as const;
/** Each spine point's index in the decoder's chain (pelvis, spine1, spine2, chest, neck). */
const CHAIN_INDEX: Readonly<Record<string, number>> = { pelvis: 0, spine1: 1, spine2: 2, chest: 3, neck: 4 };
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
const PHALANGES: Readonly<Record<string, readonly string[]>> = { Thumb: ["Metacarpal", "Proximal", "Distal"], Index: ["Proximal", "Intermediate", "Distal"], Middle: ["Proximal", "Intermediate", "Distal"], Ring: ["Proximal", "Intermediate", "Distal"], Little: ["Proximal", "Intermediate", "Distal"] };
/** Degrees each finger joint bends per 100% curl (thumb, then the fingers). */
const CURL: Readonly<Record<string, readonly number[]>> = { Thumb: [20, 40, 40], Index: [80, 100, 70], Middle: [80, 100, 70], Ring: [80, 100, 70], Little: [80, 100, 70] };

/** Solves key pose k onto bound skeleton b. */
export function solve(k: KeyLike, b: Bound, opts: SolveOptions = {}): Solved {
  const R: Rest = opts.source ? { ...b.rest, spineW: opts.source.spineW, neckW: opts.source.neckW } : b.rest;
  const X = new Float64Array(108);
  if (opts.points) X.set(opts.points);
  else decodePose(R, k, X as unknown as number[]);
  const poles = limbPoles(R, k);
  // the soles on the floor: a pose whose lowest sole would go below it is lifted whole until it stands on it, as
  // my-3d2dge's Mocap.drive did, so every direction stays the source's (a deep crouch on longer legs, a rise from the
  // ground). Contacts and ground (WP-2.5) plant the feet on uneven ground.
  if (opts.floor !== false && !opts.points) {
    let low = 0;
    for (const s of ["L", "R"]) low = Math.min(low, X[IDX["ball" + s]! * 3 + 2]!, X[IDX["toe" + s]! * 3 + 2]!, X[IDX["ankle" + s]! * 3 + 2]! - R.ankleZ);
    if (low < 0) for (let i = 2; i < X.length; i += 3) X[i] = X[i]! - low;
  }
  const P0 = b.restPts;
  const tq = torso(R, k);
  const qP = frameQuat(R.Pr, tq.RP), qC = frameQuat(R.Cr, tq.RC), qH = frameQuat(R.Hr, tq.RH);
  const rot = (q: Quat, v: readonly number[]) => quat.rotate([0, 0, 0], q, v as V3);
  const D: Record<string, Quat> = {};
  const H = b.bones, J = b.jointPoint;
  // a bone aimed from point `from` to point `to`, rolled from rest reference `r0` onto posed reference `r1`
  const aim = (h: string, from: string, to: string, r0: readonly number[], r1: readonly number[]) => {
    if (!H[h]) return;
    D[h] = delta(b, triad(sub3(at(P0, to), at(P0, from)), r0), triad(sub3(at(X, to), at(X, from)), r1));
  };
  const frameDelta = (h: string, A: Frame, B: Frame) => {
    if (H[h]) D[h] = delta(b, A, B);
  };
  frameDelta("hips", R.Pr, tq.RP);
  // the spine: each bone turns as the decoder turns its segment (to the next mapped bone's joint), rolled by its share
  // of the pelvis-to-chest turn, so the chest faces exactly where the clip's does. The hips turn with the pelvis (they
  // carry the legs), so where a library's lowest segment takes a share of the chest's turn, the joints above sit a
  // little off the decoder's while every bone keeps its turn.
  for (let i = 1; i < SPINE_CHAIN.length - 1; i++) {
    const h = SPINE_CHAIN[i]!;
    if (!H[h] || !J[h]) continue;
    const next = SPINE_CHAIN.slice(i + 1).find((n) => H[n] && J[n]);
    if (!next) continue;
    const to = J[next]!;
    if (h === "neck") aim(h, J[h]!, to, R.Cr[0], rot(quat.slerp([0, 0, 0, 1], qC, qH, R.neckW, PORTABLE), R.Cr[0]));
    else {
      // the key's own spine shares (format 2) as the decoder takes them, else the body's
      const seg = to in CHAIN_INDEX ? CHAIN_INDEX[to]! - 1 : 3, ks = k.spine as number[] | undefined;
      const w = ks && seg < 3 ? ks[seg]! / 100 : R.spineW[seg]!;
      aim(h, J[h]!, to, R.Pr[0], rot(quat.slerp([0, 0, 0, 1], qP, qC, w, PORTABLE), R.Pr[0]));
    }
  }
  frameDelta("head", R.Hr, tq.RH);
  for (const s of ["L", "R"] as Side[]) {
    const side = s === "L" ? "left" : "right";
    // the poles at rest: the natural ones for each limb's rest direction, untwisted
    const restPole = (limb: "arm" | "leg", root: string, end: string, M: Frame) => {
      const d = unit(sub3(at(P0, end), at(P0, root)));
      const l = loc(M, d);
      return poleHint(d, hintFor(limb, SG[s], M, [l[0], l[1] * SG[s], l[2]]), 0);
    };
    aim(side + "Shoulder", "clav" + s, "sh" + s, R.Cr[0], tq.RC[0]);
    const armRest = restPole("arm", "sh" + s, "elbow" + s, R.Cr), arm = poles[`arm${s}`];
    aim(side + "UpperArm", "sh" + s, "elbow" + s, armRest, arm);
    aim(side + "LowerArm", "elbow" + s, "wrist" + s, armRest, arm);
    aim(side + "Hand", "wrist" + s, "knuck" + s, R.Cr[1], sub3(at(X, "index" + s), at(X, "pinky" + s)));
    const legRest = restPole("leg", "hip" + s, "knee" + s, R.Pr), leg = poles[`leg${s}`];
    aim(side + "UpperLeg", "hip" + s, "knee" + s, legRest, leg);
    aim(side + "LowerLeg", "knee" + s, "ankle" + s, legRest, leg);
    aim(side + "Foot", "ankle" + s, "ball" + s, R.Pr[2], tq.RP[2]);
    aim(side + "Toes", "ball" + s, "toe" + s, R.Pr[2], tq.RP[2]);
    // fingers: each chain curls toward the palm about the hand's across axis, by its share of the key's curl
    const hand = H[side + "Hand"];
    if (hand && FINGERS.some((f) => H[side + f + PHALANGES[f]![0]])) {
      const curl = (k["fingers" + s] as number[] | undefined) ?? [100, 100, 100, 100, 100]; // format 1's hands are fists
      const h0 = unit(sub3(at(P0, "knuck" + s), at(P0, "wrist" + s))), hp = unit(sub3(at(X, "knuck" + s), at(X, "wrist" + s)));
      const r0 = R.Cr[1], r1 = sub3(at(X, "index" + s), at(X, "pinky" + s));
      // the palm faces the inside of the elbow (spec/MOTION.md §5.3): its normal, and the axis a curl turns about
      const el = at(X, "elbow" + s), wr = at(X, "wrist" + s), a = unit(sub3(wr, el)), pole = arm;
      const m = unit(sub3(a.map((x) => x * dot3(pole, a)), pole));
      const axis = unit(cross3(hp, m));
      FINGERS.forEach((f, fi) => {
        let deg = 0;
        PHALANGES[f]!.forEach((ph, j) => {
          deg += ((curl[fi] ?? 0) / 100) * CURL[f]![j]!;
          const name = side + f + ph;
          if (H[name]) D[name] = delta(b, triad(h0, r0), triad(turn(hp, axis, deg), turn(r1, axis, deg)));
        });
      });
    }
  }
  // every bone: its own rotation if solved, else its parent's (twist bones, leaves and unmapped bones follow)
  const world: Record<string, Quat> = {}, local: Record<string, Quat> = {};
  const byHumanoid = new Map(Object.entries(H).map(([h, src]) => [src, h]));
  const deltaOf: Quat[] = [];
  b.order.forEach((bone) => {
    const h = byHumanoid.get(bone.name);
    const d = (h && D[h]) || (bone.parent >= 0 ? deltaOf[bone.parent]! : ([0, 0, 0, 1] as Quat));
    deltaOf.push(d);
    const w = quat.multiply([0, 0, 0, 1], d, b.restWorld[bone.name]!);
    world[bone.name] = w;
    local[bone.name] = bone.parent >= 0 ? quat.multiply([0, 0, 0, 1], quat.conjugate([0, 0, 0, 1], world[b.order[bone.parent]!.name]!), w) : w;
  });
  return { hips: toSkeleton(b, X, IDX.pelvis! * 3), world, local, points: X };
}

/** Every bone's head after a solve, in skeleton space: the hips where the solve put them, the rest by their parents. */
export function forward(b: Bound, s: Solved): Record<string, V3> {
  const out: Record<string, V3> = {};
  const hips = b.bones.hips;
  const deltaOf = (name: string) => quat.multiply([0, 0, 0, 1], s.world[name]!, quat.conjugate([0, 0, 0, 1], b.restWorld[name]!));
  // a bone the hips descend from stays at rest; the hips go where the solve put them
  for (const bone of b.order) {
    if (bone.name === hips) out[bone.name] = s.hips;
    else if (bone.parent < 0) out[bone.name] = bone.head;
    else {
      const p = b.order[bone.parent]!;
      const v = quat.rotate([0, 0, 0], deltaOf(p.name), sub3(bone.head, p.head));
      const ph = out[p.name]!;
      out[bone.name] = [ph[0] + v[0], ph[1] + v[1], ph[2] + v[2]];
    }
  }
  return out;
}
