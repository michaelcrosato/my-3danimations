// The move model (PLAN.md WP-6.2, D71): a strike, kick, throw or cast in three phases. Wind is the anticipation: the
// hand travels from where the start pose has it to the start of the arc and the body coils back. Active is the strike:
// the hand sweeps the arc at its reach while the body lunges, steps in with the lead foot, leans, twists with the swing
// and may hop or turn round. Recover follows through, holds the end, then eases back to the start pose. Carried from
// my-3d2dge's E.MOVES and Humanoid (engine/my-3d2dge.js:1836-1999, 2549-2581) and shardfall's anim/moves.toml, which
// is the same model in other units; library/moves.json holds the moves in one unit system: angles in degrees, reach in
// arm lengths, heights, lunges and hops in % of the hip height, times in seconds.
//
// `moveState` is the model's numbers at a moment; `placeMove` turns them into joint positions on a body, the way the
// source's rig does. The differential test runs both on the source's three builds against spec/vectors/frozen/
// moves.json; `moveClip` (clip.ts) runs them on a format-2 rest and encodes the result.
import { PORTABLE as PM } from "../math/portable.ts";
import { clamp, ease, lerp, TAU } from "../math/helpers.ts";

/** One move, as library/moves.json gives it. */
export interface Move {
  name: string;
  /** What it looks like, in a line: what a model picks a move by. */
  about: string;
  /** right, left, both (a two-handed grip), pair (both hands, mirrored) or kick (the right foot). */
  hand: "right" | "left" | "both" | "pair" | "kick";
  /** ground: a level arc round the shoulders (0 ahead, + to the right); side: an arc up and down in front (+ up). */
  plane: "ground" | "side";
  /** Where the arc starts and ends, in degrees. */
  from: number;
  to: number;
  /** [start, end] in % of the hip height: above the shoulders' centre for a hand on the ground plane, above the floor
   *  for a kick; the side plane has none. */
  height?: [number, number];
  /** [start, end] in arm lengths from the shoulders' centre (a kick: the foot from the hips' centre). */
  reach: [number, number];
  /** Where the wind starts the hand, in arm lengths (0.75 of the start reach by default). */
  windReach?: number;
  /** The phases' lengths in seconds. */
  wind: number;
  active: number;
  recover: number;
  /** The share of the recovery that holds the end pose: above 0, at most 0.95 (the rest eases back). */
  hold: number;
  /** The share of the strike where it connects. */
  hit: number;
  /** How far the body steps into the strike and jumps, in % of the hip height. */
  lunge: number;
  hop: number;
  /** How deep the body dips, 0 to 1. */
  crouch: number;
  /** The forward lean through the strike in degrees (back when negative). */
  lean: number;
  /** How much the torso turns with the swing's angle. */
  twist: number;
  /** The whole body turns once during the strike. */
  spin: boolean;
  /** A held weapon draws a trail (false for fists, throws and casts). */
  trail: boolean;
  /** The free hand guards the chin (a punch), rather than pulling back. */
  guard?: boolean;
  /** The move played on alternate swings. */
  alt?: string;
}

/** The phases, in order. */
export const PHASES = ["wind", "active", "recover"] as const;
/** A phase of a move. */
export type Phase = (typeof PHASES)[number];

/** The model's numbers at a moment of a move. */
export interface MoveState {
  /** The arc's angle, its height (% of the hip height) and its reach (arm lengths). */
  theta: number;
  height: number;
  reach: number;
  /** The body: lean (radians), lunge and hop (% of the hip height), crouch (0..1), twist (radians), and the turn of a
   *  spin (radians, clockwise from above). */
  lean: number;
  lunge: number;
  hop: number;
  crouch: number;
  twist: number;
  spin: number;
  /** How far the hands have come from the start pose toward the arc (wind), and how much the move holds the arm (1
   *  until the recovery lets go). */
  windK: number;
  arm: number;
  /** Settled, how far the lead foot's step has gone (0..1): over the wind and the strike, back with the recovery; the
   *  source's foot slides with the lunge instead. */
  step: number;
}

const D2R = Math.PI / 180;
/** 0 to 1 with zero slope at both ends, held outside 0..1. */
const smooth01 = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** The source's lengths: its default body's hip height and arm length (16 units to the metre). */
export const SOURCE = { hip: 11.6, arm: 9.2 } as const;

/**
 * The move at `u` (0..1) through `phase`. `settle` (the default) keeps the body continuous from the start pose to the end
 * of the move: the wind's lean and the strike's lean and lunge ease in, as shardfall bakes in its smoothing; without it,
 * the numbers are the source's raw targets (its rig eases them each frame), which moves.json records.
 */
export function moveState(m: Move, phase: Phase, u: number, opts: { settle?: boolean; from?: { theta: number; height: number; reach: number } } = {}): MoveState {
  const settle = opts.settle !== false, side = m.plane === "side", kick = m.hand === "kick";
  const a0 = m.from * D2R, a1 = m.to * D2R, lean = m.lean * D2R, [r0, r1] = m.reach;
  const rest = side ? -0.9 : 1.1, zRest = kick ? 10 : (-7 / SOURCE.hip) * 100;
  const [z0, z1] = m.height ?? [zRest, zRest];
  // a hand that guards (no weapon trail, or the left) starts from its arc's height; a weapon hand from the rest height
  const fists = !m.trail || m.hand === "left";
  const start = opts.from ?? { theta: rest, height: fists ? z0 : zRest, reach: m.windReach ?? r0 * 0.75 };
  const s: MoveState = { theta: 0, height: 0, reach: 0, lean: 0, lunge: 0, hop: 0, crouch: 0, twist: 0, spin: 0, windK: 1, arm: 1, step: 0 };
  // settled, every phase eases in and out, so nothing changes speed at once where the phases meet; raw, the source's
  // curves: the wind and the follow-through decelerate, the strike starts at full speed
  const io = ease.inOut;
  if (phase === "wind") {
    const k = settle ? io(u) : ease.outQuad(u);
    s.theta = lerp(start.theta, a0, k);
    s.height = lerp(start.height, z0, settle ? k : u);
    s.reach = lerp(start.reach, r0, k);
    s.lean = -Math.abs(lean) * 0.45 * (settle ? k : 1);
    s.lunge = -m.lunge * 0.3 * k;
    s.crouch = m.crouch * k;
    s.windK = k;
    s.step = 0.5 * smooth01(u);
  } else if (phase === "active") {
    const k = settle ? io(u) : ease.outCubic(u);
    s.theta = m.spin ? a0 : lerp(a0, a1, k);
    s.height = lerp(z0, z1, k);
    s.reach = lerp(r0, r1, k);
    const back = -Math.abs(lean) * 0.45;
    s.lean = settle ? back + (lean - back) * k : lean;
    s.lunge = settle ? -0.3 * m.lunge + 1.3 * m.lunge * k : m.lunge * k;
    s.hop = m.hop * PM.sin(k * Math.PI);
    s.crouch = m.crouch * (1 - k);
    s.step = 0.5 + 0.5 * k;
    if (m.spin) {
      if (side) s.theta = a0 - TAU * k;
      else s.spin = -TAU * k;
    }
  } else {
    // the hold kept inside the recovery, as shardfall keeps it (a hold of 0 or 1 would divide by nothing)
    const hold = clamp(m.hold, 0.01, 0.95), k = (settle ? io : ease.outQuad)(clamp(u / hold, 0, 1)), span = m.spin ? 0 : a1 - a0;
    s.theta = (m.spin ? a0 : a1) + span * 0.08 * k;
    s.height = z1;
    s.reach = r1;
    s.arm = u < hold ? 1 : 1 - ease.inOut((u - hold) / (1 - hold));
    s.lean = lean * s.arm;
    s.lunge = m.lunge * s.arm;
    s.step = s.arm;
    if (m.spin && !side) s.spin = -TAU;
  }
  s.twist = m.spin || m.hand === "pair" ? 0 : clamp(s.theta * (side ? 0.08 : 0.32) * m.twist * (m.hand === "left" ? -1 : 1), -0.7, 0.7);
  // settled, the twist comes in with the wind and lets go with the recovery (the source's follows the arc's angle
  // at once, its rig easing it in)
  if (settle) s.twist *= phase === "wind" ? s.windK : phase === "recover" ? s.arm : 1;
  return s;
}

/** A body's lengths for placing a move (any one unit): its hip height and its segments. `ref` is the length 100% of
 *  the hip height means: the body's own hip height, or the source's 11.6 for its builds, whose lengths are absolute. */
export interface MoveBody {
  hipZ: number;
  hipHalf: number;
  footSpread: number;
  legUpper: number;
  legLower: number;
  torso: number;
  shoulderHalf: number;
  armUpper: number;
  armLower: number;
  ref: number;
}
type V3 = [number, number, number];
/** The joints a move places, in the body's frame (forward, right, up from the floor under the hips at rest). */
export interface MoveJoints {
  hipC: V3;
  hipL: V3;
  hipR: V3;
  footL: V3;
  footR: V3;
  kneeL: V3;
  kneeR: V3;
  shC: V3;
  shL: V3;
  shR: V3;
  elbowL: V3;
  elbowR: V3;
  handL: V3;
  handR: V3;
  /** Where a held weapon points, and the body's turn about the vertical (radians, clockwise from above). */
  bladeDir: V3;
  spin: number;
  /** Where each hand is aimed, before the arm reaches for it. */
  aims: Record<"handL" | "handR", MoveAim>;
}
/** A hand's aim: the point, how much of the way from where the shoulder carries it (`w`), and whether it gets there
 *  from the start pose's hand over the wind. */
export interface MoveAim {
  at: V3;
  w: number;
  fromStart: boolean;
}
/** Where the move starts from: the hands, the feet (standing) and the weapon's direction, in the body's frame. */
export interface MoveStart {
  handL: V3;
  handR: V3;
  footL: V3;
  footR: V3;
  bladeDir: V3;
}

const add = (a: readonly number[], b: readonly number[]): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const mul = (a: readonly number[], k: number): V3 => [a[0]! * k, a[1]! * k, a[2]! * k];
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const vlen = (a: readonly number[]) => PM.hypot(a[0]!, a[1]!, a[2]!);
const vnorm = (a: readonly number[]): V3 => {
  const l = vlen(a) || 1;
  return [a[0]! / l, a[1]! / l, a[2]! / l];
};
const vlerp = (a: readonly number[], b: readonly number[], t: number): V3 => [lerp(a[0]!, b[0]!, t), lerp(a[1]!, b[1]!, t), lerp(a[2]!, b[2]!, t)];
/** v turned by a about the vertical. */
const rz = (v: readonly number[], a: number): V3 => {
  const c = PM.cos(a), s = PM.sin(a);
  return [v[0]! * c - v[1]! * s, v[0]! * s + v[1]! * c, v[2]!];
};
/** Two-bone IK: the middle joint and the end for a chain from a toward b (held `eps` short of full reach), bending
 *  toward `hint`. */
export function ik3(a: V3, b: V3, L1: number, L2: number, hint: V3, eps = 0.01): [V3, V3] {
  let d = sub(b, a), dist = vlen(d);
  const max = L1 + L2 - eps;
  if (dist > max) {
    d = mul(d, max / dist);
    b = add(a, d);
    dist = max;
  }
  dist = Math.max(dist, eps);
  const n = mul(d, 1 / dist);
  let h = sub(hint, mul(n, dot(hint, n)));
  const hl = vlen(h);
  h = hl < 1e-4 ? [n[1], -n[0], 0] : mul(h, 1 / hl);
  const x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  return [add(add(a, mul(n, x)), mul(h, y)), b];
}

/** The standing pose a body's moves start from when no other is given: the source rig's stance and guard-down arms. */
export function standing(b: MoveBody): MoveStart {
  const u = b.ref / SOURCE.hip, hipC: V3 = [0, 0, b.hipZ], armLen = b.armUpper + b.armLower, out = {} as MoveStart;
  for (const s of [-1, 1]) {
    const hip = add(hipC, [0, s * b.hipHalf, 0]), sh = add(add(hipC, [0, 0, b.torso]), [0, s * b.shoulderHalf, 0]);
    const [, foot] = ik3(hip, [(s > 0 ? 0.8 : -0.6) * u, s * b.footSpread, 0], b.legUpper, b.legLower, [1, s * 0.15, 0.1], 0.01 * u);
    const [, hand] = ik3(sh, add(sh, [0.5 * u, s * 0.9 * u, -armLen * 0.86]), b.armUpper, b.armLower, [-1, s * 0.7, -0.2], 0.01 * u);
    out[s > 0 ? "footR" : "footL"] = foot;
    out[s > 0 ? "handR" : "handL"] = hand;
  }
  out.bladeDir = vnorm([0.55, 0.35, -0.75]);
  return out;
}

/**
 * The joints of a body at a move's state, from the start pose (`start`, standing by default) as the source's rig places
 * them: the hips' centre forward by the lunge and down by the crouch, up by the hop; the hips turned by 0.4 of the
 * twist and the shoulders by all of it; the torso leaning; the lead foot stepping in; the striking hand on the arc (on
 * the way from the start pose during the wind), the other pulling back (with `guard`, up by the chin), mirroring it
 * (pair) or on the grip (both); a kick's foot on the arc; both limbs by two-bone IK. `settle` as moveState's: the
 * free hand without it goes all the way in the wind and 85% after, as the source's rig has it.
 */
export function placeMove(m: Move, s: MoveState, b: MoveBody, start: MoveStart = standing(b), opts: { settle?: boolean; guard?: boolean } = {}): MoveJoints {
  const u = b.ref / SOURCE.hip, pct = b.ref / 100, side = m.plane === "side", kick = m.hand === "kick", rest = standing(b), settle = opts.settle !== false;
  const sA = m.hand === "left" ? -1 : 1, armLen = b.armUpper + b.armLower, lunge = s.lunge * pct, hop = s.hop * pct, cr = s.crouch;
  const hipC: V3 = [lunge * 0.55, 0, b.hipZ - cr * b.hipZ * 0.32 + hop];
  const J = { hipC, spin: s.spin, aims: {} } as MoveJoints;
  J.hipL = add(hipC, rz([0, -b.hipHalf, 0], s.twist * 0.4));
  J.hipR = add(hipC, rz([0, b.hipHalf, 0], s.twist * 0.4));
  const reach = s.reach * armLen, kickReach = s.reach * armLen + 3 * u;
  for (const sd of [-1, 1]) {
    const key = sd > 0 ? "footR" : "footL", stand = start[key];
    // the rest stance's feet as the source moves them, applied to the start pose's
    let foot: V3 = [...rest[key]];
    if (cr > 0) foot = vlerp(foot, [(sd > 0 ? 1.6 : -1.4) * u, sd * (b.footSpread + 0.7 * u), foot[2] * (1 - cr)], cr);
    const lead = sd === (m.hand === "left" ? 1 : -1);
    if (settle) {
      // a step: settled, the lead foot lifts (a tenth of the hip height, or a third of the step), moves only while it is
      // up and sets down; the back foot stays (the source slides both, the lead 1.3 of the lunge, the back 0.15 back)
      // (a kick's lead foot is the one it stands on; a step under a twentieth of the hip height isn't taken)
      const d = m.lunge * pct * 1.3;
      if (lead && !kick && d >= 0.05 * b.ref) {
        const x = s.step, up = Math.max(0.35 * d, 0.1 * b.ref);
        foot[0] += d * smooth01((x - 0.25) / 0.5);
        foot[2] += up * Math.min(smooth01(x / 0.25), smooth01((1 - x) / 0.25), 1);
      }
    } else if (lunge > 0) foot[0] += lead ? lunge * 1.3 : -lunge * 0.15;
    if (hop) foot[2] += hop;
    foot = add(stand, sub(foot, rest[key]));
    if (sd > 0 && kick) foot = vlerp(foot, [PM.cos(s.theta) * kickReach, PM.sin(s.theta) * kickReach, (s.height / 100) * b.hipZ + hop], s.arm * (settle ? s.windK : 1));
    const [knee, f2] = ik3(sd > 0 ? J.hipR : J.hipL, foot, b.legUpper, b.legLower, [1, sd * 0.15, 0.1], 0.01 * u);
    J[sd > 0 ? "kneeR" : "kneeL"] = knee;
    J[key] = f2;
  }
  const leanF = s.lean + cr * 0.22, dir = vnorm([PM.sin(leanF), 0, PM.cos(leanF)]);
  J.shC = add(hipC, mul(dir, b.torso));
  J.shL = add(J.shC, rz([0, -b.shoulderHalf, 0], s.twist));
  J.shR = add(J.shC, rz([0, b.shoulderHalf, 0], s.twist));
  const aT = side ? add(J.shC, [PM.cos(s.theta) * reach, sA * 0.8 * u, PM.sin(s.theta) * reach]) : add(J.shC, [PM.cos(s.theta) * reach, PM.sin(s.theta) * reach, s.height * pct]);
  const aDir = side ? vnorm([PM.cos(s.theta), 0.05, PM.sin(s.theta)]) : vnorm([PM.cos(s.theta), PM.sin(s.theta), -0.12]);
  // a hand the move doesn't hold stays where the start pose has it, carried with its shoulder; a held one goes to its
  // target (in the wind, on the way there from the start pose); the free hand of a one-handed move goes most of the way
  const wk = s.windK, guard = opts.guard ?? false, top = b.hipZ + b.torso;
  for (const sd of [-1, 1]) {
    const key = sd > 0 ? "handR" : "handL", sh = sd > 0 ? J.shR : J.shL, from = start[key], carried = add(from, sub(sh, [0, sd * b.shoulderHalf, top]));
    let aim: MoveAim;
    // a kick's arms out for balance: the source's tuck by the shoulders (its build's short arms), settled out to the
    // sides at half an arm, on the way there over the wind
    if (kick) aim = settle ? { at: add(sh, mul([0.25, sd * 0.5, -0.2], b.armUpper + b.armLower)), w: s.arm * 0.85, fromStart: true } : { at: add(J.shC, [1.8 * u, sd * 2.2 * u, (0.6 - (sd > 0 ? 1.5 : 0)) * u]), w: s.arm * 0.85, fromStart: false };
    else if (sd === sA || m.hand === "pair") aim = { at: sd === sA ? aT : [aT[0], 2 * J.shC[1] - aT[1], aT[2]], w: s.arm, fromStart: true };
    else if (m.hand === "both") aim = { at: add(aT, mul(aDir, -1.7 * u)), w: s.arm, fromStart: false };
    else {
      const at = guard ? add(J.shC, sd < 0 ? [3.8 * u, -1 * u, 0.4 * u] : [2.3 * u, 1.5 * u, -0.6 * u]) : add(J.shC, [1.6 * u, sd * 1.6 * u, -1.6 * u]);
      aim = settle || wk < 1 ? { at, w: s.arm * (settle ? 0.85 : 1), fromStart: true } : { at, w: s.arm * 0.85, fromStart: false };
    }
    // settled, every hand gets to its aim from where the start pose has it, over the wind
    if (settle) aim.fromStart = true;
    J.aims[key] = aim;
    const hand = vlerp(carried, aim.fromStart ? vlerp(from, aim.at, wk) : aim.at, aim.w);
    const [elbow, h2] = ik3(sh, hand, b.armUpper, b.armLower, [-1, sd * 0.7, -0.2], 0.01 * u);
    J[sd > 0 ? "elbowR" : "elbowL"] = elbow;
    J[key] = h2;
  }
  let bd = vlerp(start.bladeDir, aDir, kick || sA < 0 ? 0 : s.arm);
  if (wk < 1 && !kick && sA > 0) bd = vlerp(start.bladeDir, bd, wk);
  J.bladeDir = vnorm(bd);
  return J;
}
