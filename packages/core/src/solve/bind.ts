// Binding a skeleton for the solver (PLAN.md WP-2.4; spec/SKELETON.md): recognize its bones, measure its rest frame
// and its body (the format's rest, from its own bones: proportions, offsets, rest frames), and the linear map between
// the format's frame (forward, right, up; mm, the root on the ground under the hips) and the skeleton's own space
// (its axes and units). The map is a reflection for a right-handed skeleton (SKELETON.md §2); the solver builds every
// rotation from mapped triads, so it never has to reflect a quaternion.
import { IDX, POINTS, type Rest } from "../format/body.ts";
import type { Capture } from "../format/sample.ts";
import type { Quat } from "../math/quat.ts";
import { BODY_POINTS, HUMANOID_BONES } from "../skeleton/bones.ts";
import { measure, restPoints } from "../skeleton/measure.ts";
import { recognize, restFrame, type Recognition, type SkeletonIn } from "../skeleton/recognize.ts";

type V = [number, number, number];

/** A skeleton ready to solve onto. */
export interface Bound {
  skeleton: SkeletonIn;
  recognition: Recognition;
  /** The skeleton's rest frame (its forward, right and up, in its own axes) and its rest kind. */
  frame: ReturnType<typeof restFrame>;
  /** Skeleton units per mm: 1/1000 for glTF's metres. */
  scale: number;
  /** The body measured from the bones (the format's rest; spine shares 0, 0, 0, 1: a still pose shows none). */
  rest: Rest;
  /** The 36 body points at rest, format frame, mm. */
  restPts: Float64Array;
  /** Where the format's origin (the ground under the rest hips) sits in skeleton space. */
  origin: V;
  /** Bones in parent-first order, with their parent's index (−1 for a root) and their rest head (skeleton space). */
  order: { name: string; parent: number; head: V }[];
  /** Each humanoid bone's source bone. */
  bones: Readonly<Record<string, string>>;
  /** The body point at each mapped humanoid bone's joint, where one sits there. */
  jointPoint: Readonly<Record<string, string>>;
  /** Each bone's rest orientation in skeleton space (identity when the skeleton gives only positions). */
  restWorld: Readonly<Record<string, Quat>>;
}

/** How to bind: a recognition to use instead of recognizing again, units, and the rest orientations a host has. */
export interface BindOptions {
  recognition?: Recognition;
  /** mm per skeleton unit (1000 for metres, the default). */
  toMm?: number;
  /** Each bone's rest orientation in skeleton space; the solver's local rotations are then the host's own. */
  restWorld?: Record<string, Quat>;
}

/** Binds a skeleton: recognized, measured and mapped. Throws when a required bone is missing. */
export function bind(skeleton: SkeletonIn, opts: BindOptions = {}): Bound {
  const recognition = opts.recognition ?? recognize(skeleton);
  if (recognition.missing.length) throw new Error(`bind: ${recognition.missing.join(", ")} not mapped; patch the mapping (patchMapping) first`);
  const toMm = opts.toMm ?? 1000;
  const frame = restFrame(skeleton, recognition);
  const pts32 = restPoints(skeleton, recognition, frame, toMm);
  const cap: Capture = { name: "rest", n: 1, dur: 0, loop: false, fps: 30, data: pts32, move: null };
  const rest = measure({ rest: cap }, "rest");
  const restPts = Float64Array.from(pts32);
  const head = new Map(skeleton.bones.map((b) => [b.name, b.head as V]));
  const hips = head.get(recognition.bones.hips!)!;
  const base = restPts[IDX.pelvis! * 3 + 2]! / toMm;
  const U = frame.up;
  const origin: V = [hips[0] - U[0] * base, hips[1] - U[1] * base, hips[2] - U[2] * base];
  // parent-first order
  const index = new Map<string, number>();
  const order: Bound["order"] = [];
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
  const visit = (name: string) => {
    if (index.has(name)) return;
    const b = byName.get(name)!;
    if (b.parent && byName.has(b.parent)) visit(b.parent);
    index.set(name, order.length);
    order.push({ name, parent: b.parent && byName.has(b.parent) ? index.get(b.parent)! : -1, head: (b.head ?? [0, 0, 0]) as V });
  };
  for (const b of skeleton.bones) visit(b.name);
  // the body point at each mapped bone's joint: a point whose first available place is that bone's joint, the point
  // that names the bone first in its list winning (the shoulder point over the clavicle's fallback to the same joint).
  // The decoder's index, pinky and fist are points of its model hand, not joints, and stay out.
  const jointPoint: Record<string, string> = {};
  const primary: Record<string, boolean> = {};
  for (const name of POINTS) {
    if (/^(index|pinky|fist)[LR]$/.test(name)) continue;
    const list = BODY_POINTS[name]!, first = list.find((pl) => recognition.bones[pl.bone]);
    if (!first || first.at !== "joint") continue;
    const isPrimary = first === list[0];
    if (jointPoint[first.bone] === undefined || (isPrimary && !primary[first.bone])) {
      jointPoint[first.bone] = name;
      primary[first.bone] = isPrimary;
    }
  }
  const bones: Record<string, string> = {};
  for (const h of HUMANOID_BONES) if (recognition.bones[h]) bones[h] = recognition.bones[h]!;
  const restWorld: Record<string, Quat> = {};
  for (const b of skeleton.bones) restWorld[b.name] = opts.restWorld?.[b.name] ?? [0, 0, 0, 1];

  return { skeleton, recognition, frame, scale: 1 / toMm, rest, restPts, origin, order, bones, jointPoint, restWorld };
}

/** A point in the format's frame (mm) in skeleton space. */
export function toSkeleton(b: Bound, p: ArrayLike<number>, at = 0): V {
  const { forward: F, right: R, up: U } = b.frame;
  const f = p[at]! * b.scale, r = p[at + 1]! * b.scale, z = p[at + 2]! * b.scale;
  return [b.origin[0] + F[0] * f + R[0] * r + U[0] * z, b.origin[1] + F[1] * f + R[1] * r + U[1] * z, b.origin[2] + F[2] * f + R[2] * r + U[2] * z];
}

/** A point in skeleton space in the format's frame (mm). */
export function toFormat(b: Bound, p: ArrayLike<number>): V {
  const d = [p[0]! - b.origin[0], p[1]! - b.origin[1], p[2]! - b.origin[2]];
  const { forward: F, right: R, up: U } = b.frame;
  const dot = (a: readonly number[]) => (d[0]! * a[0]! + d[1]! * a[1]! + d[2]! * a[2]!) / b.scale;
  return [dot(F), dot(R), dot(U)];
}

/** A direction in the format's frame in skeleton space. */
export function dirToSkeleton(b: Bound, v: ArrayLike<number>): V {
  const { forward: F, right: R, up: U } = b.frame;
  return [F[0] * v[0]! + R[0] * v[1]! + U[0] * v[2]!, F[1] * v[0]! + R[1] * v[1]! + U[1] * v[2]!, F[2] * v[0]! + R[2] * v[1]! + U[2] * v[2]!];
}
