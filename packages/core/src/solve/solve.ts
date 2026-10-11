// The solver (PLAN.md WP-2.4; spec/SKELETON.md; PLAN.md §5.5): a pose's numbers onto a bound skeleton, as each bone's
// rotation. The pose is decoded on the target's own measured body (the hips at its hip height, every limb at its own
// lengths, two-bone IK with the pole the key's bend and twist give), then each bone turns from its rest direction to
// the decoded one, rolled by a reference the parameters fix: the pelvis, chest and head frames, the limbs' poles (so a
// straight limb keeps its twist: no singular pose), the hand's knuckle line and the pelvis's up for the feet. The
// spine bones take the pelvis-to-chest turn by shares (the source library's when given, so a curl spreads as its
// animators spread it). A pose whose sole would go below the floor is lifted whole until it stands on it.
// Carried from my-3d2dge's Mocap.drive (src/mocap/mocap.js:165-262: directions at the rig's own lengths, two-bone IK,
// the sole on the floor), E.ik3 and readable.js's pole helpers, through the decoder that ports them.
import { hintFor, IDX, SG, type Rest, type Side } from "../format/body.ts";
import { loc, wld, type Frame, type V3 } from "../format/math.ts";
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
  /** The body points the bones reach (format frame, mm): the key decoded on `solveRest` (or the points given), feet
   *  lifted onto the floor. Forward kinematics of the solved bones gives these joints, to rounding. */
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
/** v carried by the shortest turn taking unit direction c onto unit direction d. */
function carry(c: readonly number[], d: readonly number[], v: readonly number[]): V3 {
  const ax = cross3(c, d), sn = Math.sqrt(dot3(ax, ax)), cs = dot3(c, d);
  if (sn < 1e-9) return cs > 0 ? [v[0]!, v[1]!, v[2]!] : turn(v, triad(c, [0, 0, 1])[1], 180);
  return turn(v, ax.map((x) => x / sn), (PORTABLE.atan2(sn, cs) * 180) / Math.PI);
}
/** v carried from triad A onto triad B (the rotation taking A's axes onto B's). */
function carryBy(A: readonly V3[], B: readonly V3[], v: readonly number[]): V3 {
  const a = [dot3(v, A[0]!), dot3(v, A[1]!), dot3(v, A[2]!)];
  return [0, 1, 2].map((i) => a[0]! * B[0]![i]! + a[1]! * B[1]![i]! + a[2]! * B[2]![i]!) as V3;
}
/**
 * The normal of a limb's plane at rest (its root-to-end direction × its pole): the pole the decoder gives a T arm (or
 * a straight-down leg) at twist 0, carried onto the rest limb by the shortest turn. A T, A or relaxed rest is the T
 * body with its arms turned in the body's plane, so each gets that same turn.
 */
function restNormal(limb: "arm" | "leg", s: Side, root: readonly number[], end: readonly number[], M: Frame): V3 {
  const d0 = unit(sub3(end, root)), cl: V3 = limb === "arm" ? [0, SG[s], 0] : [0, 0, -1];
  return cross3(d0, carry(wld(M, cl), d0, hintFor(limb, SG[s], M, cl)));
}

/**
 * The rest the solver decodes on: the target's body, with the source library's spine shares when given, and its lowest
 * spine segment (pelvis to spine1) carried by the hips. The hips bone also carries the legs, so it can't take a share of
 * the chest's turn; the turn goes to the segments above, and every decoded point is one the bones can reach.
 */
export function solveRest(b: Bound, source?: Pick<Rest, "spineW" | "neckW">): Rest {
  const w = source ? source.spineW : b.rest.spineW;
  return { ...b.rest, spineW: [0, w[1]!, w[2]!, w[3]!], neckW: source ? source.neckW : b.rest.neckW };
}
/** Key k as the solver decodes it: a format-2 `spine` share on the lowest segment carried by the hips (`solveRest`). */
export function reachable(k: KeyLike): KeyLike {
  const sp = k.spine as number[] | undefined;
  return sp && sp[0] !== 0 ? { ...k, spine: [0, sp[1]!, sp[2]!] } : k;
}
/** The target body points the solver turns bones toward for key k: decoded on `solveRest`, before any floor lift. */
export function decodeOn(b: Bound, k: KeyLike, source?: Pick<Rest, "spineW" | "neckW">): Float64Array {
  const X = new Float64Array(108);
  decodePose(solveRest(b, source), reachable(k), X as unknown as number[]);
  return X;
}

const SPINE_CHAIN = ["hips", "spine", "chest", "upperChest", "neck", "head"] as const;
/** Each spine point's index in the decoder's chain (pelvis, spine1, spine2, chest, neck). */
const CHAIN_INDEX: Readonly<Record<string, number>> = { pelvis: 0, spine1: 1, spine2: 2, chest: 3, neck: 4 };
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
const PHALANGES: Readonly<Record<string, readonly string[]>> = { Thumb: ["Metacarpal", "Proximal", "Distal"], Index: ["Proximal", "Intermediate", "Distal"], Middle: ["Proximal", "Intermediate", "Distal"], Ring: ["Proximal", "Intermediate", "Distal"], Little: ["Proximal", "Intermediate", "Distal"] };
/** Degrees each finger joint bends per 100% curl (thumb, then the fingers). */
const CURL: Readonly<Record<string, readonly number[]>> = { Thumb: [20, 40, 40], Index: [80, 100, 70], Middle: [80, 100, 70], Ring: [80, 100, 70], Little: [80, 100, 70] };

/** Solves key pose k onto bound skeleton b. */
export function solve(key: KeyLike, b: Bound, opts: SolveOptions = {}): Solved {
  const R = solveRest(b, opts.source), k = reachable(key);
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
    // the limbs roll by the normal of the plane they bend in (the whole limb's direction × its pole), which is
    // perpendicular to both bones at every bend; at rest, by the T's natural pole carried onto the rest limb, so a
    // T, A or relaxed rest is the same body turned
    const vfist = (Y: ArrayLike<number>) => {
      const w = at(Y, "wrist" + s), f = unit(sub3(w, at(Y, "elbow" + s)));
      return [w[0] + f[0] * R.fist, w[1] + f[1] * R.fist, w[2] + f[2] * R.fist];
    };
    const arm = poles[`arm${s}`], leg = poles[`leg${s}`];
    const arm0 = restNormal("arm", s, at(P0, "sh" + s), vfist(P0), R.Cr), arm1 = cross3(unit(sub3(vfist(X), at(X, "sh" + s))), arm);
    const leg0 = restNormal("leg", s, at(P0, "hip" + s), at(P0, "ankle" + s), R.Pr), leg1 = cross3(unit(sub3(at(X, "ankle" + s), at(X, "hip" + s))), leg);
    aim(side + "Shoulder", "clav" + s, "sh" + s, R.Cr[0], tq.RC[0]);
    aim(side + "UpperArm", "sh" + s, "elbow" + s, arm0, arm1);
    aim(side + "LowerArm", "elbow" + s, "wrist" + s, arm0, arm1);
    aim(side + "UpperLeg", "hip" + s, "knee" + s, leg0, leg1);
    aim(side + "LowerLeg", "knee" + s, "ankle" + s, leg0, leg1);
    // the foot and toes roll by the axis they pitch about (level, across the foot's heading), never along them
    const f0 = loc(R.Pr, unit(sub3(at(P0, "ball" + s), at(P0, "ankle" + s)))), fl = Math.sqrt(f0[0] * f0[0] + f0[1] * f0[1]);
    const pitch0 = wld(R.Pr, fl > 1e-6 ? [-f0[1] / fl, f0[0] / fl, 0] : [0, 1, 0]);
    const yw = (((k["foot" + s] as number[] | undefined)?.[1] ?? 0) * Math.PI) / 180;
    const pitch1 = wld(tq.RP, [-SG[s] * PORTABLE.sin(yw), PORTABLE.cos(yw), 0]);
    aim(side + "Foot", "ankle" + s, "ball" + s, pitch0, pitch1);
    aim(side + "Toes", "ball" + s, "toe" + s, pitch0, pitch1);
    // the hand rolls by its knuckle line (index side): at rest the skeleton's own; posed, the decoder's thumb side l'
    // (spec/MOTION.md §5.3) when the key has a hand, the blade's line for a format-1 blade hand, else the rest line
    // carried by the forearm (format 1's hands carry no roll: the hand stays as its forearm holds it)
    const hand = k["hand" + s] as number[] | undefined, fingers = k["fingers" + s] as number[] | undefined;
    const el = at(X, "elbow" + s), wr = at(X, "wrist" + s), fore = unit(sub3(wr, el));
    const acr0 = sub3(at(P0, "index" + s), at(P0, "pinky" + s));
    let acr1: V3;
    if (hand || fingers) {
      const m = unit(sub3(fore.map((x) => x * dot3(arm, fore)), arm)), l = cross3(m, fore).map((x) => x * SG[s]!);
      const r = (((hand?.[2] ?? 0) * Math.PI) / 180), c = PORTABLE.cos(r), sn = PORTABLE.sin(r);
      acr1 = [l[0]! * c + m[0] * sn, l[1]! * c + m[1] * sn, l[2]! * c + m[2] * sn];
    } else if (s === "R" && k.blade) acr1 = sub3(at(X, "index" + s), at(X, "pinky" + s));
    else acr1 = carryBy(triad(sub3(at(P0, "wrist" + s), at(P0, "elbow" + s)), arm0), triad(fore, arm1), acr0);
    aim(side + "Hand", "wrist" + s, "knuck" + s, acr0, acr1);
    // fingers: each chain curls toward the palm, about the knuckle line, by its share of the key's curl (format 1's
    // hands are fists; a format-2 hand without fingers is open)
    if (H[side + "Hand"] && FINGERS.some((f) => H[side + f + PHALANGES[f]![0]])) {
      const curl = fingers ?? (hand ? [0, 0, 0, 0, 0] : [100, 100, 100, 100, 100]);
      const h0 = unit(sub3(at(P0, "knuck" + s), at(P0, "wrist" + s))), hp = unit(sub3(at(X, "knuck" + s), wr));
      // turning h about −SG·(knuckle line) turns it toward the palm normal n = −SG·(knuckle line × h)
      const axis = unit(sub3(acr1, hp.map((x) => x * dot3(acr1, hp)))).map((x) => -x * SG[s]!);
      FINGERS.forEach((f, fi) => {
        let deg = 0;
        PHALANGES[f]!.forEach((ph, j) => {
          deg += ((curl[fi] ?? 0) / 100) * CURL[f]![j]!;
          const name = side + f + ph;
          if (H[name]) D[name] = delta(b, triad(h0, acr0), triad(turn(hp, axis, deg), acr1));
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
