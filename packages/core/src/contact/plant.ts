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
import { legPoleOf, limbPoles, type KeyLike } from "../format/pose.ts";
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
  /** Seconds a sole takes to set onto the surface before a contact and to leave it after (0.05: three frames at 60 Hz). */
  blend?: number;
  /**
   * Seconds a hold takes to let go of the drift it undid after its contact ends (0.2; it needs none to engage), done
   * before the foot lands again: a long contact can hold a foot far from where the motion has it.
   */
  release?: number;
  hands?: Partial<Record<"L" | "R", HandTarget>>;
  /**
   * Whether the body settles onto the feet (true by default): lifted where a sole is under the surface and lowered by a
   * planted foot's float above it, so the legs keep their shape. False keeps the body at its height (lowered only where
   * a planted leg can't reach) and sets a planted foot on the surface with its leg alone, as a pose baked into a clip's
   * keys needs: there the settle would carry a capture's sole noise into the hips.
   */
  settle?: boolean;
  /**
   * Seconds the body's settle takes to ease in before a contact and out after it (0.2). Slower than a foot's own ease:
   * the body follows a foot's float onto the ground and back as a weight shift, not a drop in a frame, which a straight
   * planted leg would turn into a snap of its knee.
   */
  settleBlend?: number;
  /**
   * Seconds either side of a pose over which the body's settle is averaged (0.1; 0 follows the feet frame by frame):
   * the hips shift their weight, they don't track a planted sole's every millimetre.
   */
  settleSmooth?: number;
}

const DEG = Math.PI / 180;
/** How far the averaged settle and drop may be from a pose's own, as a share of H0. */
const SMOOTH_BAND = 0.02;
/** How far (mm) above the surface a planted foot may float while the body settles: the averaged settle's lag. */
const SOLE_TOUCH = 3;
/** How far (mm) a planted sole set by its averaged float may sit off the surface: the clip's own dip between keys. */
const SOLE_DIP = 2.5;
const FOOT = ["ankle", "ball", "toe"] as const;
/** Seconds: a foot off the floor for less than this between two of its contacts took no step; it stays planted. */
const BRIDGE = 0.1;
/** The format's own floor. */
const FLAT: Ground = () => 0;
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** Each side's body points' offsets (index × 3), by the point's name without its side: looked up as `OFF[s][p]`, not by
 *  a name built per call (`p + s`), whose lookup hashes it every time. */
const OFF = Object.fromEntries((["L", "R"] as const).map((s) => [s, Object.fromEntries(["clav", "sh", "elbow", "wrist", "index", "knuck", "pinky", "fist", "hip", "knee", "ankle", "ball", "toe"].map((p) => [p, IDX[p + s]! * 3]))])) as Record<"L" | "R", Record<string, number>>;
/** Point p of side s (p without its side: "ankle"), as a vector. */
const get = (X: ArrayLike<number>, p: string, s: "L" | "R"): V3 => {
  const i = OFF[s][p]!;
  return [X[i]!, X[i + 1]!, X[i + 2]!];
};
/** Point p of side s set to v. */
const put = (X: Float64Array, p: string, s: "L" | "R", v: readonly number[]) => {
  const i = OFF[s][p]!;
  X[i] = v[0]!;
  X[i + 1] = v[1]!;
  X[i + 2] = v[2]!;
};
/** A pose-frame point in the world, by the root whose heading's cosine and sine are c and sn. */
const worldBy = (root: RootPose, c: number, sn: number, p: readonly number[]): V3 => [root.forward + p[0]! * c - p[1]! * sn, root.right + p[0]! * sn + p[1]! * c, p[2]!];
/** A pose-frame point in the world, by the root. */
export function toWorld(root: RootPose, p: readonly number[]): V3 {
  return worldBy(root, PORTABLE.cos(root.yaw * DEG), PORTABLE.sin(root.yaw * DEG), p);
}
/** A world point in the pose's frame, by the root. */
export function toPose(root: RootPose, w: readonly number[]): V3 {
  const c = PORTABLE.cos(root.yaw * DEG), s = PORTABLE.sin(root.yaw * DEG), f = w[0]! - root.forward, r = w[1]! - root.right;
  return [f * c + r * s, -f * s + r * c, w[2]!];
}

const BRIDGED = new WeakMap<Contacts, { dur: number; loop: boolean; out: Contacts }>();
/**
 * The contacts with each foot's gaps shorter than BRIDGE closed (in a loop, the gap across its seam too: the last
 * contact then runs on into the next cycle to the first one's end). Letting a hold go and taking it again within a few
 * frames would move the foot by its whole drift in those frames.
 */
function bridged(c: Contacts, dur: number, loop: boolean): Contacts {
  const had = BRIDGED.get(c);
  if (had && had.dur === dur && had.loop === loop) return had.out;
  const out = { ...c } as Record<string, unknown>;
  for (const end of ["footL", "footR"] as const) {
    const iv = [...((c as unknown as Record<string, [number, number][] | undefined>)[end] ?? [])].sort((p, q) => p[0] - q[0]);
    if (!iv.length) continue;
    const kept: [number, number][] = [[iv[0]![0], iv[0]![1]]];
    for (const [a, b] of iv.slice(1)) {
      const last = kept[kept.length - 1]!;
      if (a - last[1] < BRIDGE) last[1] = Math.max(last[1], b);
      else kept.push([a, b]);
    }
    if (loop && dur > 0 && kept.length > 1) {
      const first = kept[0]!, last = kept[kept.length - 1]!, gap = first[0] + dur - last[1];
      if (gap < BRIDGE) {
        last[1] = Math.max(last[1], first[1] + dur);
        kept.shift();
      }
    }
    out[end] = kept;
  }
  BRIDGED.set(c, { dur, loop, out: out as unknown as Contacts });
  return out as unknown as Contacts;
}

/** The contact of `end` that `t` falls in or just after (within `tail` seconds), as absolute times [a, b], or null. */
function contactAt(m: Motion, end: keyof Contacts & string, t: number, tail: number): [number, number] | null {
  const iv = (m.contacts as unknown as Record<string, [number, number][] | undefined>)[end] ?? [];
  const loop = m.loop && m.dur > 0, kf = loop ? Math.floor(t / m.dur) : 0, cycles = loop ? 2 : 1;
  // in a loop, a contact running to the cycle's end and another starting at its start are one contact through the
  // seam (one contact the whole cycle long stays one a cycle)
  const last = loop ? iv.find(([a, b]) => b >= m.dur - 1e-6 && a > 1e-6) : undefined, first = last ? iv.find(([a]) => a <= 1e-6) : undefined;
  // the latest one: at a loop's seam, t is both the end of a cycle's contact and the start of the next's (the cycle
  // before t's and t's own in a loop, in that order; held as two numbers, not an array a candidate)
  let found = false, ba = 0, bb = 0;
  for (let c = 0; c < cycles; c++) {
    const k = loop ? (c === 0 ? kf - 1 : kf) : 0;
    for (const iv0 of iv) {
      if (iv0 === first) continue;
      const a0 = iv0[0], b0 = iv0[1], a = a0 + k * m.dur, b = (iv0 === last && first ? m.dur + first[1] : b0) + k * m.dur;
      if (t >= a && t <= b + tail && (!found || a > ba)) [found, ba, bb] = [true, a, b];
    }
  }
  return found ? [ba, bb] : null;
}

/** How fully `end` is held at t: 1 in a contact, easing out over `ease` seconds after it and in over `ease` before the next. */
function held(m: Motion, end: keyof Contacts & string, t: number, ease: number): number {
  const c = contactAt(m, end, t, ease);
  if (c && t <= c[1]) return 1;
  const next = startAhead(m, end, t, ease);
  return Math.max(c ? smooth(1 - (t - c[1]) / ease) : 0, next !== null ? smooth(1 - (next - t) / ease) : 0);
}

/** The start of end's next contact within `within` seconds after t (a loop's next cycle included), or null. */
function startAhead(m: Motion, end: keyof Contacts & string, t: number, within: number): number | null {
  const iv = (m.contacts as unknown as Record<string, [number, number][] | undefined>)[end] ?? [];
  const loop = m.loop && m.dur > 0, kf = loop ? Math.floor(t / m.dur) : 0, cycles = loop ? 2 : 1;
  let best: number | null = null;
  // (t's cycle and the next in a loop, in that order)
  for (let c = 0; c < cycles; c++) {
    const k = loop ? (c === 0 ? kf : kf + 1) : 0;
    for (const iv0 of iv) {
      const a = iv0[0] + k * m.dur;
      if (a > t && a <= t + within && (best === null || a < best)) best = a;
    }
  }
  return best;
}

/**
 * The body points at time t with the feet planted: each foot in a contact held at its contact point (eased out over
 * `blend` when the contact ends) with its sole on the ground (pitched to the surface under it), and the legs solved
 * again. The body is set onto the lower foot's ground (with a ground probe), lifted where a sole is under the surface,
 * lowered by the planted feet's float above it (both unless `settle` is false), and lowered where a planted leg can't
 * reach; hands drawn to targets.
 * Every correction eases in and out with the contacts, so none jumps as a contact starts or ends.
 */
export function plant(m0: Motion, t: number, opts: PlantOptions = {}): Float64Array {
  const m: Motion = { ...m0, contacts: bridged(m0.contacts, m0.dur, m0.loop) }, R = m.rest, blend = opts.blend ?? 0.05, ground = opts.ground, surface = ground ?? FLAT, settle = opts.settle ?? true;
  const settleBlend = Math.max(blend, opts.settleBlend ?? 0.2), release = Math.max(blend, opts.release ?? 0.2), settleSmooth = opts.settleSmooth ?? 0.1;
  const X = Float64Array.from(m.points(t));
  const k = m.key(t), root = m.root(t);
  const clipLegs = { L: legOf(X, "L"), R: legOf(X, "R") };
  const shift = (dz: number) => {
    for (let i = 2; i < X.length; i += 3) X[i] = X[i]! + dz;
  };
  // the body on the ground: lowered (or raised) onto the lower foot's ground, so both legs can reach theirs
  const onto = groundShift(X, root, ground);
  shift(onto);
  // each foot: held at its contact point while planted, and how fully its sole is set on the surface (`on`)
  const feet = {} as Record<"L" | "R", { foot: V3[]; planted: boolean; on: number }>, hold = holds(m, release, ground);
  for (const s of ["L", "R"] as const) {
    const end = `foot${s}` as const, c = contactAt(m, end, t, release), h = hold(t, s);
    // hold the contact point still in the world: undo the world drift of the foot's lowest sole point since the foot
    // landed (whichever point is lowest at each step: the heel at strike, the ball and toes at push-off)
    const foot = FOOT.map((p) => {
      const v = get(X, p, s);
      return [v[0] - h[0], v[1] - h[1], v[2]] as V3;
    });
    const planted = c !== null && t <= c[1];
    // the sole set on the surface eases in over `blend` before the contact starts and out over `blend` after it ends: a
    // foot the motion holds a little above the floor (another body's proportions) isn't snapped down to it and back
    const after = c !== null && !planted ? t - c[1] : Infinity, next = !planted && blend > 0 ? startAhead(m, end, t, blend) : null;
    const on = planted ? 1 : Math.max(blend > 0 && after <= blend ? smooth(1 - after / blend) : 0, next !== null ? smooth(1 - (next - t) / blend) : 0);
    feet[s] = { foot, planted, on };
  }
  // the body lifted where a sole is under the surface (as the solver lifts a pose it decodes alone: another body's
  // proportions can take a foot under it), then lowered by a planted foot's float above it, by how fully it is planted
  // (both planted: the higher one's, so the other leg bends to its ground rather than stretching past its reach);
  // without `settle` the body stays and each leg reaches its foot's place on the surface
  // the settle follows a foot's float with its own, slower ease (`settleBlend`): from a contact's end the body keeps the
  // float the foot had as it lifted, fading out; before a contact starts it takes the float the foot will land with,
  // fading in; so the body shifts its weight onto the next foot instead of dropping in a frame
  // The lift is a standing foot's: one in a contact, or easing into or out of one, whose sole is under the surface (a
  // swinging foot that dips under it comes up on its own leg; lifting the body after it would bounce the body)
  // The settle is averaged over `settleSmooth` either side of t (a triangle over the 60 Hz grid, so nearby times share
  // their samples), and so are each foot's float and the drop below: a planted foot's float that changes within a few
  // frames (a sole pitching at toe-off, a toe that dips between two keys as the foot's angles turn) shifts the hips
  // over a tenth of a second, not frame by frame, and the foot keeps the clip's own dip, as it does on its own body
  let dz = 0, drop = 0;
  const float = { L: 0, R: 0 };
  if (settle) {
    const memo = new Map<string, number>(), frozen = (s: "L" | "R", at: number, a: number) => {
      const key = `${s}${at}`;
      let v = memo.get(key);
      if (v === undefined) memo.set(key, (v = floatAt(m, s, at, a, ground) + onto));
      return v;
    };
    // at time u: each foot's float, the body's settle, and how far the pelvis must come down for a planted leg to reach
    const at = (u: number): { g: Record<"L" | "R", number>; settle: number; drop: number } => {
      // every sample's floats as if the body stood on the ground it stands on now (`onto`)
      const g = { L: floatHeld(m, "L", u, hold(u, "L"), ground) + onto, R: floatHeld(m, "R", u, hold(u, "R"), ground) + onto }, holding: [number, number][] = [];
      for (const s of ["L", "R"] as const) {
        const end = `foot${s}` as const, c = contactAt(m, end, u, settleBlend);
        if (c && u <= c[1]) holding.push([1, g[s]]);
        else {
          if (c) holding.push([smooth(1 - (u - c[1]) / settleBlend), frozen(s, c[1], c[0])]);
          const next = startAhead(m, end, u, settleBlend);
          if (next !== null) holding.push([smooth(1 - (next - u) / settleBlend), frozen(s, next, next)]);
        }
      }
      const up = Math.max(0, ...holding.map(([w, gg]) => -w * gg)), settled = up - Math.max(0, ...holding.map(([w, gg]) => w * (gg + up)));
      return { g, settle: settled, drop: dropAt(m, u, onto + settled, settled, g, hold, settleBlend) };
    };
    if (!(settleSmooth > 0)) ({ settle: dz, drop, g: { L: float.L, R: float.R } } = at(t));
    else {
      // a foot's float is averaged over the samples where it stands (in the air, or over other ground, it isn't the
      // float its sole is set by), the settle and the drop over all of them
      let weights = 0;
      const stood = { L: 0, R: 0 };
      for (let j = Math.ceil((t - settleSmooth) * STEPS); j <= Math.floor((t + settleSmooth) * STEPS); j++) {
        const u0 = j / STEPS, w = 1 - Math.abs(u0 - t) / settleSmooth;
        if (!(w > 0)) continue;
        const u = m.loop ? u0 : Math.min(Math.max(u0, 0), m.dur), a = at(u);
        dz += w * a.settle;
        drop += w * a.drop;
        weights += w;
        for (const s of ["L", "R"] as const) {
          const c = contactAt(m, `foot${s}`, u, 0);
          if (c && u <= c[1]) [float[s], stood[s]] = [float[s] + w * a.g[s], stood[s] + w];
        }
      }
      // within SMOOTH_BAND × H0 of this pose's own settle and drop: the average smooths a sole's few millimetres, it
      // doesn't anticipate a big move (a foot landing on a step lifts the body only as the foot on the low ground lets
      // go, as it does unsmoothed)
      const now = at(t), band = SMOOTH_BAND * R.H0;
      [dz, drop] = weights > 0 ? [dz / weights, drop / weights] : [now.settle, now.drop];
      [dz, drop] = [Math.min(now.settle + band, Math.max(now.settle - band, dz)), Math.min(now.drop + band, Math.max(now.drop - band, drop))];
      for (const s of ["L", "R"] as const) float[s] = stood[s] > 0 ? float[s] / stood[s] : NaN;
      // a planted foot touches: the body comes down at least far enough that it floats at most SOLE_TOUCH above the
      // surface (before its contact, by the float it will land with, eased in as the settle is); the average alone
      // lags a foot that lands on lower ground
      let pull = 0;
      for (const s of ["L", "R"] as const) {
        const end = `foot${s}` as const, c = contactAt(m, end, t, 0);
        if (c && t <= c[1]) pull = Math.max(pull, now.g[s] + dz - SOLE_TOUCH);
        else {
          const next = startAhead(m, end, t, settleBlend);
          if (next !== null) pull = Math.max(pull, smooth(1 - (next - t) / settleBlend) * (frozen(s, next, next) + dz - SOLE_TOUCH));
        }
      }
      dz -= pull;
    }
    shift(dz);
  }
  // each foot's target: moved with the body and brought up out of the surface (a planted one is on it now: the body
  // lowered to the higher one, the other came up), and a planted one turned to the surface's slope by `on`, at the
  // same height (so easing a contact in or out never stretches a leg: a nearly straight knee swings far for a little).
  // With `settle`, the drop is known already: the body comes down by it, and a foot by how little it is planted (a free
  // foot goes down with the body); a foot set on the surface is set by its averaged float, while a free one comes up
  // out of it by the frame (averaged, a foot swinging down fast would dip into it)
  if (settle && drop > 0) shift(-drop);
  const targets = {} as Record<"L" | "R", { foot: V3[]; planted: boolean; on: number }>;
  for (const s of ["L", "R"] as const) {
    const w = feet[s].on, down = settle ? drop * (1 - w) : 0, moved = feet[s].foot.map((v) => [v[0], v[1], v[2] + dz - down] as V3);
    // a planted sole keeps the clip's dip between keys (its averaged float against its own now) by at most SOLE_DIP
    // (WP-2.5: a planted sole stays within 5 mm of the surface)
    const exact = gapOf(moved, R, root, surface), dip = settle && Number.isFinite(float[s]) ? Math.min(SOLE_DIP, Math.max(-SOLE_DIP, float[s] + dz - down - exact)) : 0;
    const free = onGround(moved, R, root, surface, false);
    let foot = free;
    if (w > 0) {
      // turned to the slope with its sole on the surface, then raised by what it still floats above it (nothing once
      // fully planted: the body was lowered to it, or it was under; nothing without `settle`: the leg sets it down)
      const set = onGround(moved, R, root, surface, true, dip), up = settle ? Math.max(0, moved[0]![2] - set[0]![2]) : 0;
      foot = free.map((v, i) => [v[0] + (set[i]![0] - v[0]) * w, v[1] + (set[i]![1] - v[1]) * w, v[2] + (set[i]![2] + up - v[2]) * w] as V3);
    }
    targets[s] = { foot, planted: feet[s].planted, on: w };
  }
  // the pelvis lowered by the frame where a planted foot's ankle is out of its leg's reach now (as far as the drop
  // averaged above, with `settle`, falls short of it: a foot landing on a step up, a long stride), and a free foot goes
  // down with the body, kept out of the surface
  let more = 0;
  for (const s of ["L", "R"] as const) if (targets[s].on > 0) more = Math.max(more, targets[s].on * reachDrop(R, get(X, "hip", s), targets[s].foot[0]!));
  if (more > 0) {
    shift(-more);
    for (const s of ["L", "R"] as const) {
      if (targets[s].on >= 1) continue;
      const lowered = targets[s].foot.map((v) => [v[0], v[1], v[2] - more * (1 - targets[s].on)] as V3);
      targets[s].foot = onGround(lowered, R, root, surface, false);
    }
  }
  for (const s of ["L", "R"] as const) FOOT.forEach((p, i) => put(X, p, s, targets[s].foot[i]!));
  solveLegs(X, R, k, clipLegs);
  reachAll(X, R, root, opts.hands, () => limbPoles(R, k));
  return X;
}

/** Each leg solved again from its hip to its ankle's target, the knee pointing the clip's way (legPole); the foot keeps
 *  its shape on the ankle the leg reaches. */
function solveLegs(X: Float64Array, R: Rest, k: KeyLike, clipLegs: Record<"L" | "R", { d: V3; o: V3 }>): void {
  for (const s of ["L", "R"] as const) {
    const foot = FOOT.map((p) => get(X, p, s)), hip = get(X, "hip", s);
    const [kn, an] = ik3(hip, foot[0]!, R.thigh, R.shin, legPole(clipLegs[s], R, k, s, hip, foot[0]!));
    const d = [an[0] - foot[0]![0], an[1] - foot[0]![1], an[2] - foot[0]![2]];
    put(X, "knee", s, kn);
    FOOT.forEach((p, i) => put(X, p, s, foot[i]!.map((x, j) => x + d[j]!)));
  }
}
/** The hands drawn to their targets, if any. */
function reachAll(X: Float64Array, R: Rest, root: RootPose, hands: PlantOptions["hands"], polesOf: () => ReturnType<typeof limbPoles>): void {
  // the arms' poles found only for a hand that reaches (the key's own: a pure function of it, so when is no matter)
  let poles: ReturnType<typeof limbPoles> | undefined;
  for (const s of ["L", "R"] as const) {
    const h = hands?.[s];
    if (h && h.weight > 0) reach(X, R, s, toPose(root, h.at), Math.min(1, h.weight), (poles ??= polesOf())[`arm${s}`]);
  }
}

/** One layer of a mix as planting reads it: its own motion, its time, and its share of the legs (0 to 1). */
export interface PlantPart {
  m: Motion;
  t: number;
  w: number;
}
/**
 * Planting under a cross-fade or a blend: each layer planted on its own clip (its contacts, its feet held where its own
 * motion landed them), and the corrections each made to its own pose blended by the layers' shares onto the mixed
 * pose X (key k, the root at `root`), whose legs are then solved once and whose hands reach their targets. So a foot
 * held by the layer fading out hands over to the layer fading in without a jump, wherever their anchors are.
 */
export function plantMix(parts: readonly PlantPart[], X: ArrayLike<number>, k: KeyLike, root: RootPose, opts: PlantOptions = {}): Float64Array {
  const R = parts[0]!.m.rest, out = Float64Array.from(X), clipLegs = { L: legOf(X, "L"), R: legOf(X, "R") };
  const total = parts.reduce((a, p) => a + p.w, 0) || 1, { hands: _hands, ...rest } = opts;
  for (const p of parts) {
    const own = p.m.points(p.t), planted = plant(p.m, p.t, rest), w = p.w / total;
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + (planted[i]! - own[i]!) * w;
  }
  solveLegs(out, R, k, clipLegs);
  reachAll(out, R, root, opts.hands, () => limbPoles(R, k));
  return out;
}

/** How far a foot's ankle is above where setting its sole on the surface would put it (negative: under it), mm. */
function gapOf(foot: V3[], R: Rest, root: RootPose, surface: Ground): number {
  return foot[0]![2] - onGround(foot, R, root, surface, true)[0]![2];
}

/** How far the body is moved onto the ground: onto the lower foot's ground under a probe, so both legs reach theirs. */
function groundShift(X: ArrayLike<number>, root: RootPose, ground: Ground | undefined): number {
  if (!ground) return 0;
  const g = (["L", "R"] as const).map((s) => {
    const w = toWorld(root, get(X, "ankle", s));
    return ground(w[0], w[1]);
  });
  return Math.min(g[0]!, g[1]!);
}

/**
 * Foot s's float above the surface at time `at` of a contact that started at a, the body not yet moved onto the ground
 * (`plant` adds the move it makes now): the pose at that time, the foot held where it landed. What the body's settle
 * eases from or toward.
 */
function floatAt(m: Motion, s: "L" | "R", at: number, a: number, ground: Ground | undefined): number {
  const X = m.points(at), root = m.root(at), drift = ground && at > a ? slide(m, s, a, at, ground) : [0, 0];
  const foot = FOOT.map((p) => {
    const v = get(X, p, s);
    return [v[0] - drift[0]!, v[1] - drift[1]!, v[2]] as V3;
  });
  return gapOf(foot, m.rest, root, ground ?? FLAT);
}

/**
 * How far the pelvis must come down for a leg from `hip` to reach `ankle`, at most a tenth of H0 (a long stride, a step
 * down); 0 within reach. Once the ankle is past the leg's reach along the ground, down to the ankle's height, the
 * nearest the hip can come to it (the limit as the ankle reaches that distance, so the drop never jumps there).
 */
function reachDrop(R: Rest, hip: readonly number[], ankle: readonly number[]): number {
  const L = (R.thigh + R.shin) * 0.9995, d = PORTABLE.hypot(ankle[0]! - hip[0]!, ankle[1]! - hip[1]!);
  if (!(PORTABLE.hypot(d, ankle[2]! - hip[2]!) > L)) return 0;
  return Math.max(0, Math.min(0.1 * R.H0, hip[2]! - ankle[2]! - (d < L ? Math.sqrt(L * L - d * d) : 0)));
}
/**
 * The drop at time u (the body moved up by `up`, `settled` of it the settle, each foot floating `g` above the surface
 * before the settle): for each foot
 * held (in a contact, or easing into or out of one over `ease`), by how fully it is held, its ankle set down by its
 * float where that leaves it under the surface (a float above it stays: the drop is for it) and moved by its hold's
 * correction.
 */
function dropAt(m: Motion, u: number, up: number, settled: number, g: Record<"L" | "R", number>, hold: Hold, ease: number): number {
  const X = m.points(u);
  let out = 0;
  for (const s of ["L", "R"] as const) {
    const w = held(m, `foot${s}`, u, ease);
    if (!(w > 0)) continue;
    const hip = get(X, "hip", s), an = get(X, "ankle", s), h = hold(u, s);
    out = Math.max(out, w * reachDrop(m.rest, [hip[0], hip[1], hip[2] + up], [an[0] - h[0], an[1] - h[1], an[2] + up + Math.max(0, -(g[s] + settled))]));
  }
  return out;
}
/**
 * Foot s's float above the surface at time u, the foot moved by `off` (forward, right: the hold's correction then), the
 * body not yet moved onto the ground.
 */
function floatHeld(m: Motion, s: "L" | "R", u: number, off: readonly [number, number], ground: Ground | undefined): number {
  const X = m.points(u), root = m.root(u);
  return gapOf(FOOT.map((p) => {
    const v = get(X, p, s);
    return [v[0] - off[0], v[1] - off[1], v[2]] as V3;
  }), m.rest, root, ground ?? FLAT);
}

/** Leg s as the clip has it, before planting: the hip-to-ankle vector and the knee's offset from that line. */
function legOf(X: ArrayLike<number>, s: "L" | "R"): { d: V3; o: V3 } {
  const hip = get(X, "hip", s), d = sub(get(X, "ankle", s), hip), kn = sub(get(X, "knee", s), hip);
  const dd = dot(d, d), along = dd > 1e-18 ? dot(kn, d) / dd : 0;
  return { d, o: [kn[0] - d[0] * along, kn[1] - d[1] * along, kn[2] - d[2] * along] };
}

/**
 * The way leg s's knee points, to solve it again from hip to ankle: the clip's own knee (its offset from the hip-to-ankle
 * line) wherever the leg bends no further than the clip bends it, so a leg that keeps its shape keeps its knee; where
 * the new ankle bends it further, easing into the knee's natural way (the key's leg with no twist) by how small the
 * clip's offset is against the new one. A nearly straight leg's twist places its knee nowhere in particular (it can wind
 * round in a few frames), and a foot set on the ground bends the leg along it.
 */
function legPole(clip: { d: V3; o: V3 }, R: Rest, k: KeyLike, s: "L" | "R", hip: V3, ankle: V3): V3 {
  const leg = k[`leg${s}`] as number[] | undefined;
  const natural = legPoleOf(R, { ...k, [`leg${s}`]: leg ? [leg[0]!, leg[1]!, leg[2]!, leg[3] ?? 0, 0] : leg } as KeyLike, s);
  const ol = Math.sqrt(dot(clip.o, clip.o)), dist = Math.sqrt(dot(sub(ankle, hip), sub(ankle, hip)));
  // the knee's offset the solve gives at this reach (ik3's), clamped to the leg's
  const r = Math.min(R.thigh + R.shin, Math.max(Math.abs(R.thigh - R.shin), dist)), x = r > 1e-9 ? (R.thigh * R.thigh - R.shin * R.shin + r * r) / (2 * r) : 0;
  const off = Math.sqrt(Math.max(0, R.thigh * R.thigh - x * x));
  // bending a leg further than the clip does, after a knee the clip points backward (a straight leg a capture holds a
  // little past straight, its knee behind the line) would fold it the wrong way: there the clip's way fades out, by how
  // much further the leg bends (none at the clip's own bend, so a knee the clip winds round is the clip's) and by how
  // far back it points (none pointing sideways, all pointing half backward)
  const nl = Math.sqrt(dot(natural, natural)), cos = ol > 1e-9 && nl > 1e-9 ? dot(clip.o, natural) / (ol * nl) : 1;
  const back = (1 - smooth((cos + 0.5) / 0.5)) * smooth((off - ol) / (0.03 * (R.thigh + R.shin)));
  const w = (off <= ol ? 1 : smooth(ol / off)) * (1 - back);
  if (w <= 0 || ol < 1e-9) return natural;
  return [(clip.o[0] / ol) * w + natural[0] * (1 - w), (clip.o[1] / ol) * w + natural[1] * (1 - w), (clip.o[2] / ol) * w + natural[2] * (1 - w)];
}
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** Steps per second when following a planted foot's drift. */
const STEPS = 60;
/** The world move (forward, right; mm) of foot s's lowest sole point (lowest at t0, against the ground) from t0 to t1. */
function step(m: Motion, s: "L" | "R", t0: number, t1: number, ground?: Ground): [number, number] {
  const X0 = m.points(t0), r0 = m.root(t0), X1 = m.points(t1), r1 = m.root(t1), c0 = PORTABLE.cos(r0.yaw * DEG), s0 = PORTABLE.sin(r0.yaw * DEG);
  let low = "ankle", lz = Infinity;
  for (const p of FOOT) {
    const q = get(X0, p, s);
    let z = p === "ankle" ? q[2] - m.rest.ankleZ : q[2];
    // the point in the world only to read the ground under it (flat: z − 0 is z)
    if (ground) {
      const w = worldBy(r0, c0, s0, q);
      z -= ground(w[0], w[1]);
    }
    if (z < lz) [low, lz] = [p, z];
  }
  const w0 = worldBy(r0, c0, s0, get(X0, low, s)), w1 = toWorld(r1, get(X1, low, s));
  return [w1[0] - w0[0], w1[1] - w0[1]];
}
/** The world drift (mm) to turn into the frame the pose has at t. */
function inFrame(m: Motion, t: number, d: readonly [number, number]): [number, number] {
  const root = m.root(t), c = PORTABLE.cos(root.yaw * DEG), sn = PORTABLE.sin(root.yaw * DEG);
  return [d[0] * c + d[1] * sn, -d[0] * sn + d[1] * c];
}
/**
 * How far foot s's contact point drifts in the world (forward, right; pose frame at the end, mm) from time a to t: at
 * each step the lowest sole point's horizontal move, summed. A foot planted with no slide drifts 0. The steps lie on
 * a fixed grid from a (whole 1/STEPS steps, then the part to t), so a host that caches poses by time decodes each
 * step once however often it plants.
 */
function slide(m: Motion, s: "L" | "R", a: number, t: number, ground?: Ground): [number, number] {
  let df = 0, dr = 0, t0 = a;
  for (let i = 1; a + i / STEPS < t - 1e-9; i++) {
    const d = step(m, s, t0, a + i / STEPS, ground);
    [df, dr, t0] = [df + d[0], dr + d[1], a + i / STEPS];
  }
  if (t > a) {
    const d = step(m, s, t0, t, ground);
    [df, dr] = [df + d[0], dr + d[1]];
  }
  return inFrame(m, t, [df, dr]);
}
/** A foot's hold at time u: the correction (forward, right; pose frame, mm) that keeps its contact point still. */
type Hold = (u: number, s: "L" | "R") => [number, number];
/**
 * Each foot's hold at any time of one `plant` call: in a contact, its drift since the contact began undone; after it,
 * that drift let go over `release` (done before the foot lands again). Each contact's drift is followed once along
 * the grid from its start and kept as running sums, so the poses either side of t (the settle's window) each read
 * their own hold at the cost of one.
 */
function holds(m: Motion, release: number, ground: Ground | undefined): Hold {
  const paths = { L: new Map<number, [number, number][]>(), R: new Map<number, [number, number][]>() };
  /** The world drift from a to x along the grid from a, the sums kept (by side, then by a). */
  const drift = (s: "L" | "R", a: number, x: number): [number, number] => {
    let sums = paths[s].get(a);
    if (!sums) paths[s].set(a, (sums = [[0, 0]]));
    const k = Math.max(0, Math.ceil((x - a) * STEPS - 1e-6) - 1);
    while (sums.length <= k) {
      const i = sums.length - 1, d = step(m, s, a + i / STEPS, a + (i + 1) / STEPS, ground);
      sums.push([sums[i]![0] + d[0], sums[i]![1] + d[1]]);
    }
    if (!(x > a)) return [0, 0];
    const d = step(m, s, a + k / STEPS, x, ground);
    return [sums[k]![0] + d[0], sums[k]![1] + d[1]];
  };
  return (u, s) => {
    const end = `foot${s}` as const, c = contactAt(m, end, u, release);
    if (!c) return [0, 0];
    const [a, b] = c, again = startAhead(m, end, b, release), out = again === null ? release : Math.min(release, again - b);
    // the hold starts from no correction (no drift yet at a), so it engages at once without a pop; letting go at b drops
    // the whole drift, so it eases out over `release`, as the foot swings, and is gone before the foot lands again
    const w = u <= b ? 1 : out > 0 ? smooth(1 - (u - b) / out) : 0;
    if (!(w > 0)) return [0, 0];
    const d = inFrame(m, Math.min(u, b), drift(s, a, Math.min(u, b)));
    return [d[0] * w, d[1] * w];
  };
}

/**
 * A foot (ankle, ball, toe) set on the ground: pitched about its heel to the surface's slope along it (within ±45°),
 * then moved so its lowest sole point touches the surface when planted (`dip` above it: the clip's own dip between keys,
 * kept by a sole set by its averaged float), or comes up out of it when not.
 */
function onGround(foot: V3[], R: Rest, root: RootPose, ground: Ground, planted: boolean, dip = 0): V3[] {
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
  const dz = planted ? dip - gap : Math.max(0, -gap);
  return pts.slice(1).map((p) => [p[0], p[1], p[2] + dz]);
}

/** Draws arm s toward a target (pose frame) by weight w: the arm solved to reach it, blended with the pose's. */
function reach(X: Float64Array, R: Rest, s: "L" | "R", target: V3, w: number, pole: V3): void {
  const D = derived(R), sh = get(X, "sh", s);
  const [el, fist] = ik3(sh, target, R.up, D.lower, pole);
  const fd = [fist[0] - el[0], fist[1] - el[1], fist[2] - el[2]], l = PORTABLE.hypot(fd[0]!, fd[1]!, fd[2]!) || 1;
  const solved: Record<string, V3> = { elbow: el, fist, wrist: [el[0] + (fd[0]! / l) * R.fore, el[1] + (fd[1]! / l) * R.fore, el[2] + (fd[2]! / l) * R.fore] };
  solved.knuck = [solved.wrist![0] + (fd[0]! / l) * R.knuck, solved.wrist![1] + (fd[1]! / l) * R.knuck, solved.wrist![2] + (fd[2]! / l) * R.knuck];
  const shift = (n: string) => {
    const v = get(X, n, s), to = solved[n]!;
    put(X, n, s, v.map((x, i) => x + (to[i]! - x) * w));
  };
  // index and pinky move with the fist
  const f0 = get(X, "fist", s);
  for (const n of ["elbow", "wrist", "knuck", "fist"]) shift(n);
  const f1 = get(X, "fist", s);
  for (const n of ["index", "pinky"]) put(X, n, s, get(X, n, s).map((x, i) => x + f1[i]! - f0[i]!));
}
