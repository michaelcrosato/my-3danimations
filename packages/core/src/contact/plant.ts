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
  const loop = m.loop && m.dur > 0, cycles = loop ? [Math.floor(t / m.dur) - 1, Math.floor(t / m.dur)] : [0];
  // in a loop, a contact running to the cycle's end and another starting at its start are one contact through the
  // seam (one contact the whole cycle long stays one a cycle)
  const last = loop ? iv.find(([a, b]) => b >= m.dur - 1e-6 && a > 1e-6) : undefined, first = last ? iv.find(([a]) => a <= 1e-6) : undefined;
  // the latest one: at a loop's seam, t is both the end of a cycle's contact and the start of the next's
  let best: [number, number] | null = null;
  for (const k of cycles) for (const iv0 of iv) {
    if (iv0 === first) continue;
    const [a0, b0] = iv0, a = a0 + k * m.dur, b = (iv0 === last && first ? m.dur + first[1] : b0) + k * m.dur;
    if (t >= a && t <= b + tail && (!best || a > best[0])) best = [a, b];
  }
  return best;
}

/** The start of end's next contact within `within` seconds after t (a loop's next cycle included), or null. */
function startAhead(m: Motion, end: keyof Contacts & string, t: number, within: number): number | null {
  const iv = (m.contacts as unknown as Record<string, [number, number][] | undefined>)[end] ?? [];
  const loop = m.loop && m.dur > 0, cycles = loop ? [Math.floor(t / m.dur), Math.floor(t / m.dur) + 1] : [0];
  let best: number | null = null;
  for (const k of cycles) for (const [a0] of iv) {
    const a = a0 + k * m.dur;
    if (a > t && a <= t + within && (best === null || a < best)) best = a;
  }
  return best;
}

/**
 * The body points at time t with the feet planted: each foot in a contact held at its contact point (eased out over
 * `blend` when the contact ends) with its sole on the ground (pitched to the surface under it), and the legs solved
 * again. The body is set onto the lower foot's ground (with a ground probe), lifted where a sole is under the surface,
 * lowered by the planted feet's float above it, and lowered where a planted leg can't reach; hands drawn to targets.
 * Every correction eases in and out with the contacts, so none jumps as a contact starts or ends.
 */
export function plant(m: Motion, t: number, opts: PlantOptions = {}): Float64Array {
  const R = m.rest, blend = opts.blend ?? 0.05, ground = opts.ground, surface = ground ?? FLAT;
  const X = Float64Array.from(m.points(t));
  const k = m.key(t), poles = limbPoles(R, k), root = m.root(t);
  const legPoles = { L: legPole(X, R, k, "L"), R: legPole(X, R, k, "R") };
  const shift = (dz: number) => {
    for (let i = 2; i < X.length; i += 3) X[i] = X[i]! + dz;
  };
  // the body on the ground: lowered (or raised) onto the lower foot's ground, so both legs can reach theirs
  if (ground) {
    const g = ["L", "R"].map((s) => {
      const w = toWorld(root, get(X, "ankle" + s));
      return ground(w[0], w[1]);
    });
    shift(Math.min(g[0]!, g[1]!));
  }
  // each foot: held at its contact point while planted, and how fully its sole is set on the surface (`on`)
  const feet = {} as Record<"L" | "R", { foot: V3[]; planted: boolean; on: number }>;
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
    // the sole set on the surface eases in over `blend` before the contact starts and out over `blend` after it ends, as
    // the drift does: a foot the motion holds a little above the floor (another body's proportions) isn't snapped down
    // to it and back
    const next = c === null && blend > 0 ? startAhead(m, `foot${s}`, t, blend) : null;
    const on = c !== null ? (planted ? 1 : blend > 0 ? smooth(1 - (t - c[1]) / blend) : 0) : next !== null ? smooth(1 - (next - t) / blend) : 0;
    feet[s] = { foot, planted, on };
  }
  // the body lifted where a sole is under the surface (as the solver lifts a pose it decodes alone: another body's
  // proportions can take a foot under it), then lowered by a planted foot's float above it, by how fully it is planted
  // (both planted: the higher one's, so the other leg bends to its ground rather than stretching past its reach)
  const gap = { L: gapOf(feet.L.foot, R, root, surface), R: gapOf(feet.R.foot, R, root, surface) };
  const up = Math.max(0, -Math.min(gap.L, gap.R));
  const dz = up - Math.max(feet.L.on * (gap.L + up), feet.R.on * (gap.R + up));
  shift(dz);
  // each foot's target: moved with the body and brought up out of the surface (a planted one is on it now: the body
  // lowered to the higher one, the other came up), and a planted one turned to the surface's slope by `on`, at the
  // same height (so easing a contact in or out never stretches a leg: a nearly straight knee swings far for a little)
  const targets = {} as Record<"L" | "R", { foot: V3[]; planted: boolean; on: number }>;
  for (const s of ["L", "R"] as const) {
    const w = feet[s].on, moved = feet[s].foot.map((v) => [v[0], v[1], v[2] + dz] as V3), free = onGround(moved, R, root, surface, false);
    let foot = free;
    if (w > 0) {
      // turned to the slope with its sole on the surface, then raised by what it still floats above it (nothing once
      // fully planted: the body was lowered to it, or it was under)
      const set = onGround(moved, R, root, surface, true), up = Math.max(0, moved[0]![2] - set[0]![2]);
      foot = free.map((v, i) => [v[0] + (set[i]![0] - v[0]) * w, v[1] + (set[i]![1] - v[1]) * w, v[2] + (set[i]![2] + up - v[2]) * w] as V3);
    }
    targets[s] = { foot, planted: feet[s].planted, on: w };
  }
  // the pelvis lowered where a planted foot's ankle is out of its leg's reach (a long stride, a step down), by at most
  // a tenth of H0 and by how fully the foot is planted; a free foot goes down with the body, kept out of the surface
  let drop = 0;
  for (const s of ["L", "R"] as const) {
    if (!(targets[s].on > 0)) continue;
    const hip = get(X, "hip" + s), an = targets[s].foot[0]!, L = (R.thigh + R.shin) * 0.9995;
    const d = PORTABLE.hypot(an[0] - hip[0], an[1] - hip[1]);
    if (PORTABLE.hypot(d, an[2] - hip[2]) > L && d < L) drop = Math.max(drop, targets[s].on * (hip[2] - (an[2] + Math.sqrt(L * L - d * d))));
  }
  drop = Math.min(drop, 0.1 * R.H0);
  if (drop > 0) {
    shift(-drop);
    for (const s of ["L", "R"] as const) {
      if (targets[s].on >= 1) continue;
      const lowered = targets[s].foot.map((v) => [v[0], v[1], v[2] - drop * (1 - targets[s].on)] as V3);
      targets[s].foot = onGround(lowered, R, root, surface, false);
    }
  }
  for (const s of ["L", "R"] as const) {
    // the leg solved again to the foot's ankle; the foot keeps its shape on the ankle the leg reaches
    const foot = targets[s].foot;
    const [kn, an] = ik3(get(X, "hip" + s), foot[0]!, R.thigh, R.shin, legPoles[s]);
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

/** How far a foot's ankle is above where setting its sole on the surface would put it (negative: under it), mm. */
function gapOf(foot: V3[], R: Rest, root: RootPose, surface: Ground): number {
  return foot[0]![2] - onGround(foot, R, root, surface, true)[0]![2];
}

/**
 * The way leg s's knee points, to solve the leg again: the clip's own knee where the leg bends enough to place it (its
 * offset from the hip-to-ankle line), easing into the knee's natural way (the key's leg with no twist) as the leg
 * straightens, where the twist places the knee nowhere in particular (a straight leg's twist can wind round in a few
 * frames, and a foot set on the ground bends the leg along it).
 */
function legPole(X: ArrayLike<number>, R: Rest, k: KeyLike, s: "L" | "R"): V3 {
  const hip = get(X, "hip" + s), d = sub(get(X, "ankle" + s), hip), kn = sub(get(X, "knee" + s), hip);
  const dl = Math.sqrt(dot(d, d)), along = dl > 1e-9 ? dot(kn, d) / (dl * dl) : 0;
  const o: V3 = [kn[0] - d[0] * along, kn[1] - d[1] * along, kn[2] - d[2] * along], ol = Math.sqrt(dot(o, o));
  const leg = k[`leg${s}`] as number[] | undefined;
  const natural = limbPoles(R, { ...k, [`leg${s}`]: leg ? [leg[0]!, leg[1]!, leg[2]!, leg[3] ?? 0, 0] : leg } as KeyLike)[`leg${s}`];
  // fully the clip's own knee from an offset of a tenth of the thigh (a bend of about 12°)
  const w = smooth(ol / (0.1 * R.thigh));
  if (w <= 0) return natural;
  return [(o[0] / ol) * w + natural[0] * (1 - w), (o[1] / ol) * w + natural[1] * (1 - w), (o[2] / ol) * w + natural[2] * (1 - w)];
}
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

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
