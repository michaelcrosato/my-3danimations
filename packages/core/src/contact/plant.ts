// Contacts and ground (PLAN.md WP-2.5): a planted foot pinned where it landed, a sole set on the ground, slopes and
// steps through a ground probe, and hands reaching weighted targets. It edits a pose's decoded body points (the
// target body's, as the solver reads them) before the solver turns bones toward them.
// Stateless by design: a foot planted over [a, b] keeps its contact point (its lowest sole point: the heel at strike,
// the ball at push-off) still in the world, by undoing that point's drift in the motion since a, found by evaluating the
// motion between a and t. The result at any time is a function of that time alone: a host may skip or thin out
// presentation poses (PLAN.md §5.5) and every pose it does take is the same.
// Carried from riftlight's foot placement and zero-slide gait (docs/ANIMATION.md:234-244): a planted foot locked in the
// world while the leg re-solves, released over a few frames.
import { derived, IDX, ik3, type Rest } from "../format/body.ts";
import type { V3 } from "../format/math.ts";
import { limbPoles, type KeyLike } from "../format/pose.ts";
import type { Contacts } from "../format/types.ts";
import type { RootPose } from "../clip/sample.ts";
import { PORTABLE } from "../math/portable.ts";

/** The surface's height (mm) at a world point (forward, right in mm). */
export type Ground = (forward: number, right: number) => number;

/** A world target a hand reaches for, and how strongly (0 to 1). */
export interface HandTarget {
  at: V3;
  weight: number;
}

/** What planting reads: the motion at any time on the target body, where its root stands, and its contacts. */
export interface Motion {
  rest: Rest;
  dur: number;
  loop: boolean;
  contacts: Contacts;
  /** The key at time t (any playback time: a loop wraps). */
  key(t: number): KeyLike;
  /** The decoded body points at time t, on `rest` (pose frame: forward, right, up; mm, the root at the origin). */
  points(t: number): Float64Array;
  /** Where the root stands in the world at time t: its place (mm) and heading (degrees). */
  root(t: number): RootPose;
}

/** How to plant: the ground (flat at 0 without one), the blend in and out, and hand targets. */
export interface PlantOptions {
  ground?: Ground;
  /** Seconds a hold takes to ease out after its contact ends (0.05: three frames at 60 Hz); it needs none to engage. */
  blend?: number;
  hands?: Partial<Record<"L" | "R", HandTarget>>;
}

const DEG = Math.PI / 180;
const FOOT = ["ankle", "ball", "toe"] as const;
/** The format's own floor. */
const FLAT: Ground = () => 0;
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const get = (X: ArrayLike<number>, n: string): V3 => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const put = (X: Float64Array, n: string, v: readonly number[]) => {
  const i = IDX[n]! * 3;
  X[i] = v[0]!;
  X[i + 1] = v[1]!;
  X[i + 2] = v[2]!;
};
/** A pose-frame point in the world, by the root. */
export function toWorld(root: RootPose, p: readonly number[]): V3 {
  const c = PORTABLE.cos(root.yaw * DEG), s = PORTABLE.sin(root.yaw * DEG);
  return [root.forward + p[0]! * c - p[1]! * s, root.right + p[0]! * s + p[1]! * c, p[2]!];
}
/** A world point in the pose's frame, by the root. */
export function toPose(root: RootPose, w: readonly number[]): V3 {
  const c = PORTABLE.cos(root.yaw * DEG), s = PORTABLE.sin(root.yaw * DEG), f = w[0]! - root.forward, r = w[1]! - root.right;
  return [f * c + r * s, -f * s + r * c, w[2]!];
}

/** The contact of `end` that `t` falls in or just after (within `tail` seconds), as absolute times [a, b], or null. */
function contactAt(m: Motion, end: keyof Contacts & string, t: number, tail: number): [number, number] | null {
  const iv = (m.contacts as unknown as Record<string, [number, number][] | undefined>)[end] ?? [];
  const cycles = m.loop && m.dur > 0 ? [Math.floor(t / m.dur) - 1, Math.floor(t / m.dur)] : [0];
  // the latest one: at a loop's seam, t is both the end of a cycle's contact and the start of the next's
  let best: [number, number] | null = null;
  for (const k of cycles) for (const [a0, b0] of iv) {
    const a = a0 + k * m.dur, b = b0 + k * m.dur;
    if (t >= a && t <= b + tail && (!best || a > best[0])) best = [a, b];
  }
  return best;
}

/**
 * The body points at time t with the feet planted: each foot in a contact held at its contact point (eased out over
 * `blend` when the contact ends) with its sole on the ground (pitched to the surface under it), the pelvis lowered where
 * a leg can't reach, and the legs solved again; the body set onto the lower foot's ground; hands drawn to targets.
 */
export function plant(m: Motion, t: number, opts: PlantOptions = {}): Float64Array {
  const R = m.rest, blend = opts.blend ?? 0.05, ground = opts.ground;
  const X = Float64Array.from(m.points(t));
  const k = m.key(t), poles = limbPoles(R, k), root = m.root(t);
  // the body on the ground: lowered (or raised) onto the lower foot's ground, so both legs can reach theirs
  const lift = (Y: Float64Array, at: RootPose) => {
    if (!ground) return 0;
    const g = ["L", "R"].map((s) => {
      const w = toWorld(at, get(Y, "ankle" + s));
      return ground(w[0], w[1]);
    });
    const dz = Math.min(g[0]!, g[1]!);
    for (let i = 2; i < Y.length; i += 3) Y[i] = Y[i]! + dz;
    return dz;
  };
  lift(X, root);
  // each foot's target: held at its contact point while planted, set on the ground
  const targets = {} as Record<"L" | "R", { foot: V3[]; planted: boolean }>;
  for (const s of ["L", "R"] as const) {
    let foot = FOOT.map((p) => get(X, p + s));
    const c = contactAt(m, `foot${s}`, t, blend);
    if (c) {
      const [a, b] = c;
      // the hold starts from no correction (no drift yet at a), so it engages at once without a pop; letting go at b
      // drops the whole drift, so it eases out over `blend`
      const w = t <= b ? 1 : smooth(1 - (t - b) / blend);
      if (w > 0) {
        // hold the contact point still in the world: undo the world drift of the foot's lowest sole point since the
        // foot landed (whichever point is lowest at each step: the heel at strike, the ball and toes at push-off)
        const drift = slide(m, s, a, Math.min(t, b), ground);
        foot = foot.map((v) => [v[0] - drift[0] * w, v[1] - drift[1] * w, v[2]] as V3);
      }
    }
    const planted = c !== null && t <= c[1];
    targets[s] = { foot: onGround(foot, R, root, ground ?? FLAT, planted), planted };
  }
  // the pelvis lowered where a planted foot's ankle is out of its leg's reach (a long stride, a step down), by at most
  // a tenth of H0; a free foot goes down with the body, kept out of the surface
  let drop = 0;
  for (const s of ["L", "R"] as const) {
    if (!targets[s].planted) continue;
    const hip = get(X, "hip" + s), an = targets[s].foot[0]!, L = (R.thigh + R.shin) * 0.9995;
    const d = PORTABLE.hypot(an[0] - hip[0], an[1] - hip[1]);
    if (PORTABLE.hypot(d, an[2] - hip[2]) > L && d < L) drop = Math.max(drop, hip[2] - (an[2] + Math.sqrt(L * L - d * d)));
  }
  drop = Math.min(drop, 0.1 * R.H0);
  if (drop > 0) {
    for (let i = 2; i < X.length; i += 3) X[i] = X[i]! - drop;
    for (const s of ["L", "R"] as const) {
      if (targets[s].planted) continue;
      const lowered = targets[s].foot.map((v) => [v[0], v[1], v[2] - drop] as V3);
      targets[s].foot = onGround(lowered, R, root, ground ?? FLAT, false);
    }
  }
  for (const s of ["L", "R"] as const) {
    // the leg solved again to the foot's ankle; the foot keeps its shape on the ankle the leg reaches
    const foot = targets[s].foot;
    const [kn, an] = ik3(get(X, "hip" + s), foot[0]!, R.thigh, R.shin, poles[`leg${s}`]);
    const d = [an[0] - foot[0]![0], an[1] - foot[0]![1], an[2] - foot[0]![2]];
    put(X, "knee" + s, kn);
    FOOT.forEach((p, i) => put(X, p + s, foot[i]!.map((x, j) => x + d[j]!)));
  }
  for (const s of ["L", "R"] as const) {
    const h = opts.hands?.[s];
    if (h && h.weight > 0) reach(X, R, s, toPose(root, h.at), Math.min(1, h.weight), poles[`arm${s}`]);
  }
  return X;
}

/** Steps per second when following a planted foot's drift. */
const STEPS = 60;
/**
 * How far foot s's contact point drifts in the world (forward, right; pose frame at the end, mm) from time a to t: at
 * each step the lowest sole point's horizontal move, summed. A foot planted with no slide drifts 0.
 */
function slide(m: Motion, s: string, a: number, t: number, ground?: Ground): [number, number] {
  // steps on a fixed grid from a (whole 1/STEPS steps, then the part to t), so a host that caches poses by time
  // decodes each step once however often it plants
  const times = [a];
  for (let i = 1; a + i / STEPS < t - 1e-9; i++) times.push(a + i / STEPS);
  if (t > a) times.push(t);
  let df = 0, dr = 0;
  let X0 = m.points(a), r0 = m.root(a);
  for (let i = 1; i < times.length; i++) {
    const X1 = m.points(times[i]!), r1 = m.root(times[i]!);
    // the lowest sole point at the step's start, measured against the ground under it
    let low = "ankle", lz = Infinity;
    for (const p of ["ankle", "ball", "toe"]) {
      const q = get(X0, p + s), w = toWorld(r0, q), z = (p === "ankle" ? q[2] - m.rest.ankleZ : q[2]) - (ground ? ground(w[0], w[1]) : 0);
      if (z < lz) [low, lz] = [p, z];
    }
    const w0 = toWorld(r0, get(X0, low + s)), w1 = toWorld(r1, get(X1, low + s));
    df += w1[0] - w0[0];
    dr += w1[1] - w0[1];
    X0 = X1;
    r0 = r1;
  }
  // the drift is in the world; turn it into the frame the pose has now
  const root = m.root(t), c = PORTABLE.cos(root.yaw * DEG), sn = PORTABLE.sin(root.yaw * DEG);
  return [df * c + dr * sn, -df * sn + dr * c];
}

/**
 * A foot (ankle, ball, toe) set on the ground: pitched about its heel to the surface's slope along it (within ±45°),
 * then moved so its lowest sole point touches the surface when planted, or comes up out of it when not.
 */
function onGround(foot: V3[], R: Rest, root: RootPose, ground: Ground, planted: boolean): V3[] {
  const heel: V3 = [foot[0]![0], foot[0]![1], foot[0]![2] - R.ankleZ];
  const g = (p: readonly number[]) => {
    const w = toWorld(root, p);
    return ground(w[0], w[1]);
  };
  let pts: V3[] = [heel, ...foot];
  if (planted) {
    // the slope along the foot, heel to ball, turned onto the foot about the heel
    const ball = foot[1]!, dx = ball[0] - heel[0], dy = ball[1] - heel[1], run = PORTABLE.hypot(dx, dy);
    if (run > 1e-6) {
      // the foot keeps its own pitch relative to the surface: it turns by the surface's slope
      const pitch = Math.max(-45 * DEG, Math.min(45 * DEG, PORTABLE.atan2(g(ball) - g(heel), run)));
      // rotate every point about the heel in the vertical plane along the foot by `pitch`
      const ux = dx / run, uy = dy / run, cp = PORTABLE.cos(pitch), sp = PORTABLE.sin(pitch);
      pts = pts.map((p) => {
        const along = (p[0] - heel[0]) * ux + (p[1] - heel[1]) * uy, side = [p[0] - heel[0] - along * ux, p[1] - heel[1] - along * uy], up = p[2] - heel[2];
        const a2 = along * cp - up * sp, u2 = along * sp + up * cp;
        return [heel[0] + side[0]! + a2 * ux, heel[1] + side[1]! + a2 * uy, heel[2] + u2];
      });
    }
  }
  // the lowest sole point (heel, ball, toe) against the surface under it: a planted foot's touches it (the sole, not
  // the ankle, on the ground), a free one only comes up out of it
  let gap = Infinity;
  for (const p of [pts[0]!, pts[2]!, pts[3]!]) gap = Math.min(gap, p[2] - g(p));
  const dz = planted ? -gap : Math.max(0, -gap);
  return pts.slice(1).map((p) => [p[0], p[1], p[2] + dz]);
}

/** Draws arm s toward a target (pose frame) by weight w: the arm solved to reach it, blended with the pose's. */
function reach(X: Float64Array, R: Rest, s: "L" | "R", target: V3, w: number, pole: V3): void {
  const D = derived(R), sh = get(X, "sh" + s);
  const [el, fist] = ik3(sh, target, R.up, D.lower, pole);
  const fd = [fist[0] - el[0], fist[1] - el[1], fist[2] - el[2]], l = PORTABLE.hypot(fd[0]!, fd[1]!, fd[2]!) || 1;
  const solved: Record<string, V3> = { elbow: el, fist, wrist: [el[0] + (fd[0]! / l) * R.fore, el[1] + (fd[1]! / l) * R.fore, el[2] + (fd[2]! / l) * R.fore] };
  solved.knuck = [solved.wrist![0] + (fd[0]! / l) * R.knuck, solved.wrist![1] + (fd[1]! / l) * R.knuck, solved.wrist![2] + (fd[2]! / l) * R.knuck];
  const shift = (n: string) => {
    const v = get(X, n + s), to = solved[n]!;
    put(X, n + s, v.map((x, i) => x + (to[i]! - x) * w));
  };
  // index and pinky move with the fist
  const f0 = get(X, "fist" + s);
  for (const n of ["elbow", "wrist", "knuck", "fist"]) shift(n);
  const f1 = get(X, "fist" + s);
  for (const n of ["index", "pinky"]) put(X, n + s, get(X, n + s).map((x, i) => x + f1[i]! - f0[i]!));
}
