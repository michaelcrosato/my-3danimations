// Pose operations on key numbers (PLAN.md WP-2.3): blend, additive deltas, masks by body group with feathering, and
// mirror. A pose here is a key's numbers (`KeyLike`, without `t`); decoding it onto a rest body gives the points.
// Angles blend the short way round (two clips unwrap independently, so 350 and -10 are 20 degrees apart), every other
// number linearly; a limb's direction blends as numbers and the decoder normalizes it.
import { mirror, type Lensed } from "../format/text.ts";
import type { KeyLike } from "../format/pose.ts";
import { KEY_FIELDS } from "../format/types.ts";

/** A pose: a key's numbers, by field (`t` ignored). */
export type Pose = KeyLike;

/** What an optional field means when a pose leaves it out (spine and blade have no numeric stand-in). */
const DEFAULTS: Readonly<Record<string, readonly number[]>> = {
  shL: [0, 0], shR: [0, 0], footL: [0, 0, 0], footR: [0, 0, 0], root: [0, 0], handL: [0, 0, 0], handR: [0, 0, 0],
  fingersL: [0, 0, 0, 0, 0], fingersR: [0, 0, 0, 0, 0], yaw: [0],
};
/** The pose fields an operation walks: the key fields and yaw. */
export const POSE_FIELDS: readonly string[] = [...Object.keys(KEY_FIELDS), "yaw"];
/** Which components of a field are angles (and blend the short way round). */
const ANGLES: Readonly<Record<string, readonly number[]>> = { ...Object.fromEntries(Object.entries(KEY_FIELDS).map(([f, s]) => [f, s.angles])), yaw: [0] };

/** d folded into (−180, 180]. */
export const wrap180 = (d: number): number => {
  const f = ((((d + 180) % 360) + 360) % 360) - 180;
  return f === -180 ? 180 : f;
};
/** A field's numbers (yaw as a one-number list), its default when absent, or undefined. */
function values(p: Pose, f: string, fill: boolean): number[] | undefined {
  const v = f === "yaw" ? (typeof p.yaw === "number" ? [p.yaw] : undefined) : (p[f] as number[] | undefined);
  if (v) return f === "armL" || f === "armR" || f === "legL" || f === "legR" ? [v[0]!, v[1]!, v[2]!, v[3] ?? 0, v[4] ?? 0] : v;
  return fill ? (DEFAULTS[f] as number[] | undefined)?.slice() : undefined;
}
function put(p: Pose, f: string, v: number[]): void {
  if (f === "yaw") p.yaw = v[0]!;
  else p[f] = v;
}

/** Weights by field, 0 to 1; a field not listed weighs 0. */
export type Mask = Readonly<Record<string, number>>;

/**
 * a blended toward b by w (0 gives a exactly, 1 gives b, angles up to whole turns), each field by w × its mask weight
 * (all 1 without a mask). A field only one pose has blends from its default (shoulders, feet, hands, fingers at rest);
 * spine and blade, which have none, come from whichever side weighs more.
 */
export function blend(a: Pose, b: Pose, w: number, mask?: Mask): Pose {
  const out: Pose = {};
  for (const f of POSE_FIELDS) {
    // a field neither pose has stays out: a hand present changes how the arm reads (spec/MOTION.md §5.3)
    if (values(a, f, false) === undefined && values(b, f, false) === undefined) continue;
    const k = w * (mask ? (mask[f] ?? 0) : 1);
    const va = values(a, f, true), vb = values(b, f, true);
    if (!va || !vb) {
      const v = k >= 0.5 ? vb : va;
      if (v) put(out, f, v.slice());
      continue;
    }
    const ang = ANGLES[f] ?? [];
    // an angle goes to b's value nearest a's (whole turns apart), so the pose blends the short way round
    put(out, f, va.map((x, i) => lerpTo(x, ang.includes(i) ? vb[i]! + 360 * Math.round((x - vb[i]!) / 360) : vb[i]!, k)));
  }
  return out;
}

/** x moved k of the way to y, exactly x at 0 and exactly y at 1. */
const lerpTo = (x: number, y: number, k: number): number => (k === 0 ? x : k === 1 ? y : x + (y - x) * k);

/** The additive delta that takes `ref` to `p`: differences per number, angles the short way round. */
export function delta(p: Pose, ref: Pose): Pose {
  const out: Pose = {};
  for (const f of POSE_FIELDS) {
    const v = values(p, f, true), r = values(ref, f, true);
    if (!v || !r) continue;
    const ang = ANGLES[f] ?? [];
    put(out, f, v.map((x, i) => (ang.includes(i) ? wrap180(x - r[i]!) : x - r[i]!)));
  }
  return out;
}

/** `base` with `d` added at weight w (× the mask's weight per field): a nod over a walk, a flinch over an idle. */
export function addDelta(base: Pose, d: Pose, w = 1, mask?: Mask): Pose {
  const out: Pose = {};
  for (const f of POSE_FIELDS) {
    const v = values(base, f, false), dv = values(d, f, false);
    if (!v) continue;
    const k = w * (mask ? (mask[f] ?? 0) : 1);
    put(out, f, dv ? v.map((x, i) => x + (dv[i] ?? 0) * k) : v.slice());
  }
  return out;
}

/** The named body groups a mask can start from. */
export const GROUPS: Readonly<Record<string, readonly string[]>> = {
  upper: ["chest", "head", "spine", "shL", "shR", "armL", "armR", "handL", "handR", "fingersL", "fingersR", "blade"],
  lower: ["hips", "body", "root", "yaw", "legL", "legR", "footL", "footR"],
  armL: ["shL", "armL", "handL", "fingersL"],
  armR: ["shR", "armR", "handR", "fingersR", "blade"],
  legs: ["legL", "legR", "footL", "footR"],
  head: ["head"],
  spine: ["chest", "spine"],
};
/** Which fields touch which along the body, for feathering. */
const LINKS: readonly [string, string][] = [
  ["root", "hips"], ["yaw", "hips"], ["hips", "body"], ["body", "chest"], ["body", "legL"], ["body", "legR"], ["legL", "footL"], ["legR", "footR"],
  ["chest", "spine"], ["chest", "head"], ["chest", "shL"], ["chest", "shR"], ["shL", "armL"], ["shR", "armR"], ["armL", "handL"], ["armR", "handR"],
  ["handL", "fingersL"], ["handR", "fingersR"], ["armR", "blade"],
];

/**
 * A mask from named groups: their fields weigh 1, and with `feather` (0 to 1) the fields one link outside weigh
 * `feather`, two links feather², and so on, so an upper-body layer fades through the pelvis instead of cutting at it.
 */
export function mask(groups: string | readonly string[], feather = 0): Mask {
  const names = typeof groups === "string" ? [groups] : groups;
  const out: Record<string, number> = {};
  let ring: string[] = [];
  for (const g of names) {
    if (!GROUPS[g]) throw new Error(`no body group "${g}": use ${Object.keys(GROUPS).join(", ")}`);
    for (const f of GROUPS[g]!) {
      if (out[f] !== undefined) continue;
      out[f] = 1;
      ring.push(f);
    }
  }
  for (let w = feather; w > 1e-6 && ring.length; w *= feather) {
    const next: string[] = [];
    for (const f of ring) {
      for (const [a, b] of LINKS) {
        const other = a === f ? b : b === f ? a : null;
        if (other === null || out[other] !== undefined) continue;
        out[other] = w;
        next.push(other);
      }
    }
    ring = next;
  }
  return out;
}

/** The pose on the other side (L and R swap; turns, tilts, twists and yaw change sign), as the codec mirrors clips. */
export function mirrorPose(p: Pose): Pose {
  const { t: _t, ...rest } = mirror({ keys: [{ t: 0, ...p }] } as unknown as Lensed).keys[0] as KeyLike;
  return rest;
}
