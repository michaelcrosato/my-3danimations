// BioVision hierarchy written (PLAN.md WP-7.2b, D93): a clip played on a bound skeleton, sampled as the VRMA writer
// samples it (`sampleNodes`), as a .bvh. Every bone is a joint, nested depth first, its offset its head's from its
// parent's at rest, so the zero pose (every channel 0) is the skeleton's rest with each joint's axes the world's; each
// frame turns every joint by its turn from rest against its parent's (Z, X, Y degrees, as the reader applies them) and
// places the joints that move (the roots, the root's travel and turn in them, and the hips), their position channels
// replacing their offsets, as the reader reads them. Units are the file's (centimetres unless `units` says, in metres a
// unit); a name's spaces and braces, which would split it, become "_" (a name taken then gets "_" more), and a leaf
// ends in an end site a quarter of its bone on. `bvhGap` reads a written file back (`parseBvh`, `bvhPose`) and
// measures how far each joint lands from where the Animator put its bone.
import { math, type AnimClip, type Bound } from "@m3a/core";
import { sampleNodes, worldAt } from "../vrma/vrma.ts";
import { bvhPose, parseBvh } from "./read.ts";

const { quat, PORTABLE } = math;
type Q = [number, number, number, number];
const q = (a: ArrayLike<number>): Q => [a[0]!, a[1]!, a[2]!, a[3]!];
const qmul = (a: ArrayLike<number>, b: ArrayLike<number>): Q => q(quat.multiply([0, 0, 0, 1], q(a), q(b)));
const conj = (a: ArrayLike<number>): Q => [-a[0]!, -a[1]!, -a[2]!, a[3]!];

/** Each bone's joint name in a .bvh: spaces and braces, which would split it, as "_", and one another bone took already
 *  given "_" more, so each joint is its own. */
function jointNames(b: Bound): string[] {
  const taken = new Set<string>();
  return b.order.map((o) => {
    let n = o.name.replace(/[\s{}]/g, "_") || "_";
    while (taken.has(n)) n += "_";
    taken.add(n);
    return n;
  });
}

/** ZXY Euler angles (degrees) of a rotation, as the BVH reader turns a joint: Z, then X, then Y, each about the axes the
 *  turns before it left (R = Rz Rx Ry). At X's ±90° the Y turn is taken as 0. */
function zxy(r: Q): [number, number, number] {
  const l = PORTABLE.hypot(r[0], r[1], r[2], r[3]) || 1, [x, y, z, w] = r.map((v) => v / l) as Q, deg = 180 / Math.PI;
  const m01 = 2 * (x * y - w * z), m11 = 1 - 2 * (x * x + z * z), m21 = Math.max(-1, Math.min(1, 2 * (y * z + w * x))), m20 = 2 * (x * z - w * y), m22 = 1 - 2 * (x * x + y * y);
  if (Math.abs(m21) < 1 - 1e-12) return [PORTABLE.atan2(-m01, m11) * deg, PORTABLE.asin(m21) * deg, PORTABLE.atan2(-m20, m22) * deg];
  return [PORTABLE.atan2(2 * (x * y + w * z), 1 - 2 * (y * y + z * z)) * deg, PORTABLE.asin(m21) * deg, 0];
}

/** A number as the file writes it: 4 decimals, never "-0.0000". */
const num = (v: number): string => {
  const t = v.toFixed(4);
  return /^-0\.0+$/.test(t) ? t.slice(1) : t;
};

/** A clip played on bound skeleton `b` as a .bvh's text, sampled every 1/`fps` s or so (30), in `units` metres a file
 *  unit (0.01: centimetres). */
export function writeBvh(clip: AnimClip, b: Bound, opts: { fps?: number; units?: number } = {}): string {
  const s = sampleNodes(clip, b, opts), units = opts.units ?? 0.01, order = b.order, kids = order.map(() => [] as number[]), lines = ["HIERARCHY"], nest: number[] = [], names = jointNames(b);
  order.forEach((o, k) => o.parent >= 0 && kids[o.parent]!.push(k));
  const offset = (k: number) => order[k]!.head.map((v, i) => (v - (order[k]!.parent < 0 ? 0 : order[order[k]!.parent]!.head[i]!)) / units);
  const joint = (k: number, pad: string): void => {
    nest.push(k);
    lines.push(`${pad}${order[k]!.parent < 0 ? "ROOT" : "JOINT"} ${names[k]}`, `${pad}{`, `${pad}  OFFSET ${offset(k).map(num).join(" ")}`, `${pad}  CHANNELS ${s.pos.has(k) ? "6 Xposition Yposition Zposition" : "3"} Zrotation Xrotation Yrotation`);
    if (!kids[k]!.length) lines.push(`${pad}  End Site`, `${pad}  {`, `${pad}    OFFSET ${offset(k).map((v) => num(v / 4)).join(" ")}`, `${pad}  }`);
    for (const c of kids[k]!) joint(c, `${pad}  `);
    lines.push(`${pad}}`);
  };
  order.forEach((o, k) => o.parent < 0 && joint(k, ""));
  const n = s.times.length - 1, rest = order.map((o) => conj(b.restWorld[o.name] ?? [0, 0, 0, 1]));
  lines.push("MOTION", `Frames: ${n + 1}`, `Frame Time: ${(clip.dur / n).toFixed(7)}`);
  for (let i = 0; i <= n; i++) {
    // each joint's turn from rest in the world (the zero pose's axes are the world's), then against its parent's
    const w = worldAt(s, i), turn = w.r.map((r, k) => qmul(r, rest[k]!)), row: string[] = [];
    for (const k of nest) {
      const up = order[k]!.parent, against = up < 0 ? ([0, 0, 0, 1] as Q) : conj(turn[up]!);
      if (s.pos.has(k)) {
        const p = w.p[k]!, at = up < 0 ? p : quat.rotate([0, 0, 0], against, [p[0] - w.p[up]![0], p[1] - w.p[up]![1], p[2] - w.p[up]![2]]);
        row.push(...[at[0]!, at[1]!, at[2]!].map((v) => num(v / units)));
      }
      row.push(...zxy(qmul(against, turn[k]!)).map(num));
    }
    lines.push(row.join(" "));
  }
  return `${lines.join("\n")}\n`;
}

/** How far (mm) the joints of a .bvh that `writeBvh` wrote land from where the Animator puts their bones, read back
 *  through io (`parseBvh`, `bvhPose`): the most at any sample. */
export function bvhGap(text: string, clip: AnimClip, b: Bound, opts: { fps?: number; units?: number } = {}): number {
  const s = sampleNodes(clip, b, opts), back = parseBvh(text), units = opts.units ?? 0.01, at = new Map(back.names.map((n, j) => [n, j])), names = jointNames(b);
  let worst = 0;
  for (let i = 0; i < s.times.length; i++) {
    const w = worldAt(s, i), pose = bvhPose(back, i);
    b.order.forEach((o, k) => {
      const j = at.get(names[k]!), p = j === undefined ? null : pose[j]![1];
      if (p) worst = Math.max(worst, PORTABLE.hypot(p[0]! * units - w.p[k]![0], p[1]! * units - w.p[k]![1], p[2]! * units - w.p[k]![2]));
    });
  }
  return worst / b.scale;
}
