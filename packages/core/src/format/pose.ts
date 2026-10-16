// Encode one key pose from 36 body points, and decode a key back to body points on a rest body (spec/MOTION.md §5,
// §6.3). Ported from my-3d2dge's readable.js:185-259 operation for operation, so format-1 keys encode and decode bit for
// bit (tiers 1a and 2). Format 2's optional fields (hand, fingers, spine) take separate branches that a key without
// them never enters.
import { bendOf, derived, hintFor, IDX, ik3, limbEnd, P, poleHint, poleOf, pt, reachOf, SG, unwrap, type Rest, type Side } from "./body.ts";
import { add, compose, cross, dot, DG, euler, frameFR, frameUF, fromEuler, len, loc, mul, norm, qconj, qmul, quatOf, qrot, qslerp, rel, sub, wld, type Frame, type Quat, type V3 } from "./math.ts";
import type { Key } from "./types.ts";
import { PORTABLE as PM } from "../math/portable.ts";

/** A key under construction or interpolated: named number arrays (and `t`, `yaw`). */
export type KeyLike = Partial<Key> & Record<string, unknown>;

const round = (v: number) => Math.round(v);
/** Below this bend (degrees) a limb is nearly straight: its twist barely moves a point (the baselines' "nearly straight" too). */
const STEADY_BEND = 25;
/** A twist that jumps this far (degrees) between keys of a nearly straight limb is noise winding it, not a turn. */
const STEADY_JUMP = 45;
const SIDES: Side[] = ["L", "R"];
const arr = (k: KeyLike, f: string) => k[f] as number[] | undefined;
/** Each side's key fields, named once: a name built per call ("arm" + s) costs a lookup by its hash every time. */
const NAMES = {
  L: { arm: "armL", leg: "legL", foot: "footL", hand: "handL", fingers: "fingersL", sh: "shL" },
  R: { arm: "armR", leg: "legR", foot: "footR", hand: "handR", fingers: "fingersR", sh: "shR" },
} as const;
/** A body point's offset in a body-point array (its index × 3). */
const at = (n: string) => IDX[n]! * 3;
/** Each side's body points' offsets, found once. */
const SIDE_AT = Object.fromEntries(SIDES.map((s) => [s, Object.fromEntries(["clav", "sh", "elbow", "wrist", "knuck", "fist", "index", "pinky", "hip", "knee", "ankle", "ball", "toe"].map((n) => [n, at(n + s)]))])) as Record<Side, Record<string, number>>;
const AT = { pelvis: at("pelvis"), pelvisF: at("pelvisF"), spine1: at("spine1"), spine2: at("spine2"), chest: at("chest"), chestF: at("chestF"), neck: at("neck"), head: at("head"), headTop: at("headTop"), faceF: at("faceF") };
/** Point v written into a body-point array at offset i. */
const put = (out: Float32Array | number[], i: number, v: readonly number[]) => {
  out[i] = v[0]!;
  out[i + 1] = v[1]!;
  out[i + 2] = v[2]!;
};

/** What a rest alone decides in `torso`, found once for each of its frames and its shoulders (by the objects the rest
 *  holds, which a rest copied with spread shares, as the solver's are), as `derived` is: a rest is read, never edited
 *  in place. The same operations on the same numbers as on every call: the same bits. */
const CONJ = new WeakMap<Frame, Quat>(), SHOULDERS = new WeakMap<Rest["cv"], Record<Side, { L: number; az: number; el: number }>>();
/** A rest frame's quaternion's conjugate (qFromTo's right-hand factor). */
function conjOf(F: Frame): Quat {
  let q = CONJ.get(F);
  if (!q) CONJ.set(F, (q = qconj(quatOf(F))));
  return q;
}
/** Each shoulder's rest swing: its length, azimuth and elevation (none for a body measured without shoulder bones). */
function shouldersOf(cv: Rest["cv"]): Record<Side, { L: number; az: number; el: number }> {
  let c = SHOULDERS.get(cv);
  if (!c) {
    const one = (s: Side) => {
      const v0 = cv[s], L = len(v0);
      return L === 0 ? { L, az: 0, el: 0 } : { L, az: PM.atan2(v0[0], v0[1] * SG[s]), el: PM.asin(v0[2] / L) };
    };
    SHOULDERS.set(cv, (c = { L: one("L"), R: one("R") }));
  }
  return c;
}

/** The torso and head frames and the joints placed from them (shared by encode and decode, so rounding never drifts). */
export function torso(R: Rest, k: KeyLike) {
  const p = mul(k.hips!, R.H0 / 100);
  const RP = fromEuler(k.body!);
  const RC = compose(RP, fromEuler(k.chest!));
  const RH = compose(RC, fromEuler(k.head!));
  // qFromTo(R.Pr, RP) and so on: quatOf(RP) times the rest frame's conjugate, which the rest alone decides
  const qP = qmul(quatOf(RP), conjOf(R.Pr));
  const qC = qmul(quatOf(RC), conjOf(R.Cr));
  const qH = qmul(quatOf(RH), conjOf(R.Hr));
  const sp: V3[] = [p];
  const spine = k.spine;
  R.spineW.forEach((w0, i) => {
    const w = spine && i < 3 ? spine[i]! / 100 : w0;
    sp.push(add(sp[i]!, qrot(qslerp(qP, qC, w), R.spine[i]!)));
  });
  const neck = sp[4]!;
  const head = add(neck, qrot(qslerp(qC, qH, R.neckW), R.neckSeg));
  const sh = (s: Side): V3 => {
    const sv = arr(k, NAMES[s].sh) || [0, 0];
    const { L, az: az0, el: el0 } = shouldersOf(R.cv)[s];
    // a body measured without shoulder bones has its upper arm at the clavicle point: nothing to swing
    if (L === 0) return add(neck, wld(RC, R.clav[s]));
    const az = az0 + sv[0]! * DG;
    const el = el0 + sv[1]! * DG;
    const ce = PM.cos(el);
    return add(add(neck, wld(RC, R.clav[s])), wld(RC, [L * ce * PM.sin(az), SG[s] * L * ce * PM.cos(az), L * PM.sin(el)]));
  };
  return { p, RP, RC, RH, spine1: sp[1]!, spine2: sp[2]!, chest: sp[3]!, neck, head, sh, hip: (s: Side) => add(p, wld(RP, R.hip[s])) };
}

/** Options for encoding: `hands` also fits format 2's hand and finger fields from the hand's body points; `spine` its
 *  spine curl (`encode` keeps it only for a clip it helps, every key or none); `steadyTwist` keeps a nearly straight
 *  limb's twist (bent less than 25°) as the key before had it rather than jump 45° or more. */
export interface EncodeOptions {
  hands?: boolean;
  spine?: boolean;
  steadyTwist?: boolean;
  /** Whole numbers, as a file holds them (the default); false keeps the exact values, for blending in point space. */
  round?: boolean;
}

/** One key pose from captured body points; `prev` (the key before) keeps angles continuous. */
export function encodePose(R: Rest, X: ArrayLike<number>, prev: KeyLike | null, opts: EncodeOptions = {}): KeyLike {
  const D = derived(R);
  const r0 = opts.round === false ? (v: number) => v : round;
  const p = (n: string) => pt(X, n);
  // a side's point by its name without the side (an offset found once, not a name built per call)
  const ps = (n: string, s: Side): V3 => {
    const i = SIDE_AT[s][n]!;
    return [X[i]!, X[i + 1]!, X[i + 2]!];
  };
  const k: KeyLike = {};
  const pr: KeyLike = prev || {};
  const uw = (a: number[], b: number[] | undefined) => a.map((v, i) => r0(unwrap(v, b ? b[i] : undefined)));
  // a turn, lean and tilt has a second reading (turn + 180, 180 − lean, tilt + 180): take whichever continues
  const ue = (e: number[], b: number[] | undefined) => {
    const a1 = uw(e, b);
    if (!b) return a1;
    const a2 = uw([e[0]! + 180, 180 - e[1]!, e[2]! + 180], b);
    const d = (a: number[]) => a.reduce((t, v, i) => t + Math.abs(v - b[i]!), 0);
    return d(a2) < d(a1) ? a2 : a1;
  };
  k.hips = p("pelvis").map((v) => r0((v / R.H0) * 100));
  const RPx = frameFR(sub(p("hipR"), p("hipL")), sub(p("pelvisF"), p("pelvis")));
  const RCx = frameUF(sub(p("neck"), p("chest")), sub(p("chestF"), p("chest")));
  const RHx = frameUF(sub(p("headTop"), p("head")), sub(p("faceF"), p("head")));
  k.body = ue(euler(RPx), arr(pr, "body"));
  k.chest = ue(euler(rel(fromEuler(k.body), RCx)), arr(pr, "chest"));
  const RC = compose(fromEuler(k.body), fromEuler(k.chest));
  k.head = ue(euler(rel(RC, RHx)), arr(pr, "head"));
  for (const s of SIDES) {
    const v = loc(RC, sub(ps("sh", s), ps("clav", s)));
    const v0 = R.cv[s];
    // a body measured without shoulder bones has nothing to swing (as torso's sh decodes it): no reach, no shrug, where
    // its elevation was 0 / 0
    if (len(v0) === 0) {
      k[NAMES[s].sh] = [0, 0];
      continue;
    }
    const az = (a: V3) => PM.atan2(a[0], a[1] * SG[s]) / DG;
    const el = (a: V3) => PM.asin(Math.max(-1, Math.min(1, a[2] / len(a)))) / DG;
    k[NAMES[s].sh] = [r0(az(v) - az(v0)), r0(el(v) - el(v0))];
  }
  // format 2's spine curl, before anything hangs off the chest: each share fitted in turn to the captured spine points
  if (opts.spine) k.spine = fitSpine(R, k, X);
  const tq = torso(R, k);
  for (const s of SIDES) {
    const limbs: [string, V3, Frame, string, string, number, number, string][] = [
      ["arm", tq.sh(s), tq.RC, "fist", "elbow", R.up, D.lower, NAMES[s].arm],
      ["leg", tq.hip(s), tq.RP, "ankle", "knee", R.thigh, R.shin, NAMES[s].leg],
    ];
    for (const [limb, root, M, end, mid, L1, L2, field] of limbs) {
      // with hands, the arm aims at the virtual fist: where a straight hand's fist would be (spec/MOTION.md §5.3)
      const endPt = opts.hands && limb === "arm" ? add(ps("wrist", s), mul(norm(sub(ps("wrist", s), ps("elbow", s))), R.fist)) : ps(end, s);
      let v = loc(M, sub(endPt, root));
      // a fist curled in past the shoulder: point the fully bent limb away from the elbow instead
      if (len(v) < Math.abs(L1 - L2) + 10) v = mul(norm(loc(M, sub(ps(mid, s), root))), -Math.abs(L1 - L2));
      const dir = norm([v[0], v[1] * SG[s], v[2]]).map((x) => r0(x * 100));
      const bend = r0(bendOf(len(v), L1, L2));
      const target = limbEnd(root, M, norm(dir), s, reachOf(bend, L1, L2));
      const dd = norm(sub(target, root));
      const tw = poleOf(dd, hintFor(limb as "arm" | "leg", SG[s], M, [dir[0]!, dir[1]! * SG[s], dir[2]!]), sub(ps(mid, s), root));
      const before = arr(pr, field);
      const prevT = before ? before[4] : undefined;
      // a nearly straight limb's twist barely shows and capture noise winds it: `steadyTwist` keeps the key before's
      // when it would jump 45° or more (small drifts are followed, so a loop's ends still meet)
      const twist = unwrap(tw, prevT);
      k[field] = [...dir, bend, opts.steadyTwist && prevT !== undefined && bend < STEADY_BEND && Math.abs(twist - prevT) >= STEADY_JUMP ? prevT : r0(twist)];
    }
    const fd = loc(tq.RP, norm(sub(ps("ball", s), ps("ankle", s))));
    const td = loc(tq.RP, norm(sub(ps("toe", s), ps("ball", s))));
    const pf = arr(pr, NAMES[s].foot);
    const down = PM.asin(Math.max(-1, Math.min(1, -fd[2]))) / DG;
    k[NAMES[s].foot] = [r0(down - R.abPitch), r0(unwrap(PM.atan2(fd[1] * SG[s], fd[0]) / DG, pf ? pf[1] : undefined)), r0(down - PM.asin(Math.max(-1, Math.min(1, -td[2]))) / DG - (R.abPitch - R.btPitch))];
  }
  if (opts.hands) for (const s of SIDES) encodeHand(R, X, k, tq, s, arr(pr, NAMES[s].hand), r0);
  return k;
}

/** The spine's points (spine1, spine2, chest) as key k's torso places them: its own shares, or the body's. */
function spinePoints(R: Rest, k: KeyLike, own: boolean): V3[] {
  const t = torso(R, own ? k : { ...k, spine: undefined });
  return [t.spine1, t.spine2, t.chest];
}

/** Format 2's spine shares for key k (whole percents, −100..200): each fitted in turn, from the hips up, to bring its
 *  point nearest the captured one (a coarse pass, then the percents around the best). */
function fitSpine(R: Rest, k: KeyLike, X: ArrayLike<number>): number[] {
  const want = ["spine1", "spine2", "chest"].map((n) => pt(X, n)), out = R.spineW.slice(0, 3).map((w) => Math.round(w * 100));
  for (let i = 0; i < 3; i++) {
    const err = (w: number) => {
      out[i] = w;
      return len(sub(spinePoints(R, { ...k, spine: out }, true)[i]!, want[i]!));
    };
    let best = out[i]!, e = err(best);
    for (let w = -100; w <= 200; w += 10) {
      const x = err(w);
      if (x < e) [best, e] = [w, x];
    }
    for (let w = Math.max(-100, best - 9); w <= Math.min(200, best + 9); w++) {
      const x = err(w);
      if (x < e) [best, e] = [w, x];
    }
    out[i] = best;
  }
  return out;
}

/** How much nearer key k's own spine shares bring the spine's points to the captured ones than the body's do (mm, the
 *  worst point's gain): what `encode` weighs to keep a clip's `spine`. */
export function spineGain(R: Rest, k: KeyLike, X: ArrayLike<number>): number {
  if (!k.spine) return 0;
  const want = ["spine1", "spine2", "chest"].map((n) => pt(X, n)), own = spinePoints(R, k, true), body = spinePoints(R, k, false);
  let worstOwn = 0, worstBody = 0;
  for (let i = 0; i < 3; i++) {
    worstOwn = Math.max(worstOwn, len(sub(own[i]!, want[i]!)));
    worstBody = Math.max(worstBody, len(sub(body[i]!, want[i]!)));
  }
  return worstBody - worstOwn;
}

/** The decoded arm for side s of key k: shoulder, elbow, the IK's end, and the pole the elbow bends toward. */
function arm(R: Rest, k: KeyLike, tq: ReturnType<typeof torso>, s: Side) {
  const D = derived(R);
  const RC = tq.RC;
  const sh = tq.sh(s);
  const a = arr(k, NAMES[s].arm)!;
  const aN = norm(a);
  const fT = limbEnd(sh, RC, aN, s, reachOf(a[3] || 0, R.up, D.lower));
  const ad = norm(sub(fT, sh));
  const pole = poleHint(ad, hintFor("arm", SG[s], RC, [aN[0], aN[1] * SG[s], aN[2]]), a[4] || 0);
  const [el, fist] = ik3(sh, fT, R.up, D.lower, pole);
  return { sh, el, fist, pole };
}

/** The poles the limbs bend toward in key k on rest R (the decoder's own, for a solver's roll): arms and legs by side. */
export function limbPoles(R: Rest, k: KeyLike): Record<"armL" | "armR" | "legL" | "legR", V3> {
  const tq = torso(R, k);
  const out = {} as Record<"armL" | "armR" | "legL" | "legR", V3>;
  for (const s of SIDES) {
    out[`arm${s}`] = arm(R, k, tq, s).pole;
    const hip = tq.hip(s);
    const l = arr(k, NAMES[s].leg)!;
    const ln = norm(l);
    const ld = norm(sub(limbEnd(hip, tq.RP, ln, s, reachOf(l[3] || 0, R.thigh, R.shin)), hip));
    out[`leg${s}`] = poleHint(ld, hintFor("leg", SG[s], tq.RP, [ln[0], ln[1] * SG[s], ln[2]]), l[4] || 0);
  }
  return out;
}

/**
 * The pole leg s bends toward in key k on rest R: `limbPoles(R, k)["leg" + s]`, the same operations on the same numbers,
 * from the pelvis alone (the hip it hangs from is the pelvis's place and frame: torso's `p`, `RP` and `hip`), for a
 * caller that needs one leg's pole (core's planting re-solves each leg toward its own).
 */
export function legPoleOf(R: Rest, k: KeyLike, s: Side): V3 {
  const p = mul(k.hips!, R.H0 / 100), RP = fromEuler(k.body!), hip = add(p, wld(RP, R.hip[s]));
  const l = arr(k, NAMES[s].leg)!;
  const ln = norm(l);
  const ld = norm(sub(limbEnd(hip, RP, ln, s, reachOf(l[3] || 0, R.thigh, R.shin)), hip));
  return poleHint(ld, hintFor("leg", SG[s], RP, [ln[0], ln[1] * SG[s], ln[2]]), l[4] || 0);
}

/** The hand frame at the wrist (spec/MOTION.md §5.3): forearm a, palm side m′, thumb side l′, after roll ρ. */
function handFrame(el: V3, wr: V3, pole: V3, s: Side, rollDeg: number) {
  const a = norm(sub(wr, el));
  const m = norm(mul(sub(pole, mul(a, dot(pole, a))), -1));
  const l = mul(cross(m, a), SG[s]);
  const r = rollDeg * DG;
  return { a, m: sub(mul(m, PM.cos(r)), mul(l, PM.sin(r))), l: add(mul(l, PM.cos(r)), mul(m, PM.sin(r))) };
}

/** Every body point rebuilt from one key pose, on the rest body's proportions, into `out` (mm). */
export function decodePose(R: Rest, k: KeyLike, out: Float32Array | number[]): Float32Array | number[] {
  const tq = torso(R, k);
  const { p, RP, RC, RH, neck, head } = tq;
  put(out, AT.pelvis, p);
  put(out, AT.pelvisF, add(p, mul(RP[0], 120)));
  put(out, AT.spine1, tq.spine1);
  put(out, AT.spine2, tq.spine2);
  put(out, AT.chest, tq.chest);
  put(out, AT.chestF, add(tq.chest, mul(RC[0], 120)));
  put(out, AT.neck, neck);
  put(out, AT.head, head);
  put(out, AT.headTop, add(head, wld(RH, R.topH)));
  put(out, AT.faceF, add(head, wld(RH, R.faceH)));
  const bladeK = arr(k, "blade");
  const blade = bladeK ? norm(wld(RC, bladeK)) : null;
  for (const s of SIDES) {
    const I = SIDE_AT[s], F = NAMES[s];
    const { sh, el, fist, pole } = arm(R, k, tq, s);
    const fd = norm(sub(fist, el));
    const wr = add(el, mul(fd, R.fore));
    put(out, I.clav, add(neck, wld(RC, R.clav[s])));
    put(out, I.sh, sh);
    put(out, I.elbow, el);
    put(out, I.wrist, wr);
    const hand = arr(k, F.hand);
    const fingers = arr(k, F.fingers);
    if (!hand && !fingers) {
      put(out, I.knuck, add(wr, mul(fd, R.knuck)));
      put(out, I.fist, fist);
      const acr = s === "R" && blade ? blade : RC[1];
      put(out, I.index, add(fist, mul(acr, 20)));
      put(out, I.pinky, add(fist, mul(acr, -20)));
    } else {
      const [flex, side, roll] = hand ?? [0, 0, 0];
      const f = handFrame(el, wr, pole, s, roll!);
      const ph = flex! * DG;
      const ps = side! * DG;
      const h = norm(add(mul(add(mul(f.a, PM.cos(ph)), mul(f.m, PM.sin(ph))), PM.cos(ps)), mul(f.l, PM.sin(ps))));
      const knuck = add(wr, mul(h, R.knuck));
      let fistPt = add(wr, mul(h, R.fist));
      if (fingers) {
        // the palm normal: perpendicular to h for any flex and side
        const n = sub(mul(f.m, PM.cos(ph)), mul(f.a, PM.sin(ph)));
        const th = 0.9 * fingers[2]! * DG;
        fistPt = add(knuck, mul(add(mul(h, PM.cos(th)), mul(n, PM.sin(th))), R.fist - R.knuck));
      }
      put(out, I.knuck, knuck);
      put(out, I.fist, fistPt);
      const acr = s === "R" && blade ? blade : norm(sub(f.l, mul(h, dot(f.l, h))));
      put(out, I.index, add(fistPt, mul(acr, 20)));
      put(out, I.pinky, add(fistPt, mul(acr, -20)));
    }
    legInto(R, k, tq.hip(s), RP, s, out);
  }
  return out;
}

/** Leg s's points (hip, knee, ankle, ball, toe) of key k into `out`, from its hip and the pelvis's frame RP: decodePose's
 *  own steps for them (it decodes each leg with this). */
function legInto(R: Rest, k: KeyLike, hip: V3, RP: Frame, s: Side, out: Float32Array | number[]): void {
  const I = SIDE_AT[s], F = NAMES[s];
  const l = arr(k, F.leg)!;
  const ln = norm(l);
  const aT = limbEnd(hip, RP, ln, s, reachOf(l[3] || 0, R.thigh, R.shin));
  const ld = norm(sub(aT, hip));
  const [kn, an] = ik3(hip, aT, R.thigh, R.shin, poleHint(ld, hintFor("leg", SG[s], RP, [ln[0], ln[1] * SG[s], ln[2]]), l[4] || 0));
  put(out, I.hip, hip);
  put(out, I.knee, kn);
  put(out, I.ankle, an);
  const ft = arr(k, F.foot) || [0, 0, 0];
  const pa = (ft[0]! + R.abPitch) * DG;
  const pb = (ft[0]! + R.btPitch - (ft[2] || 0)) * DG;
  const yw = ft[1]! * DG;
  // (each cosine and sine taken once: the same numbers)
  const cy = PM.cos(yw), sy = PM.sin(yw);
  const dir = (q: number) => {
    const cq = PM.cos(q);
    return wld(RP, [cq * cy, SG[s] * cq * sy, -PM.sin(q)]);
  };
  const ball = add(an, mul(dir(pa), R.ab));
  put(out, I.ball, ball);
  put(out, I.toe, add(ball, mul(dir(pb), R.bt)));
}

/**
 * The pelvis's and the legs' points of key k (pelvis; hip, knee, ankle, ball and toe each side) into `out`, as
 * decodePose puts them, bit for bit (the pelvis's place and frame as torso finds them, each leg by decodePose's own
 * steps); the other points are left as they were. For a reader of the feet alone: the root a clip's planted feet
 * imply (contactRoot) reads nothing else.
 */
export function decodeLegs(R: Rest, k: KeyLike, out: Float32Array | number[]): Float32Array | number[] {
  const p = mul(k.hips!, R.H0 / 100), RP = fromEuler(k.body!);
  put(out, AT.pelvis, p);
  for (const s of SIDES) legInto(R, k, add(p, wld(RP, R.hip[s])), RP, s, out);
  return out;
}

/** Fit format 2's hand and finger fields from the captured hand points, against the arm as it decodes. */
function encodeHand(R: Rest, X: ArrayLike<number>, k: KeyLike, tq: ReturnType<typeof torso>, s: Side, prev: number[] | undefined, r0: (v: number) => number = round): void {
  const p = (n: string) => pt(X, n);
  const { el, fist, pole } = arm(R, k, tq, s);
  const wr = add(el, mul(norm(sub(fist, el)), R.fore));
  const base = handFrame(el, wr, pole, s, 0);
  const h = norm(sub(p("knuck" + s), p("wrist" + s)));
  // the decoder lays the knuckle line along the thumb side l′ made perpendicular to h, so l′ lies in the plane of the
  // knuckle line and h, perpendicular to the forearm: l′ ∝ kc − h (kc·a) / (h·a)
  const kc = sub(p("index" + s), p("pinky" + s));
  const ha = dot(h, base.a);
  const lp = Math.abs(ha) > 1e-6 ? sub(kc, mul(h, dot(kc, base.a) / ha)) : sub(kc, mul(base.a, dot(kc, base.a)));
  // roll unwraps against the key before, like a twist (spec/MOTION.md §6.3)
  const roll = unwrap(PM.atan2(dot(lp, base.m), dot(lp, base.l)) / DG, prev ? prev[2] : undefined);
  const f = handFrame(el, wr, pole, s, roll);
  // within the spec's ranges (flex −90..90, side −45..45): a hand bent further is held at the edge
  const side = Math.max(-45, Math.min(45, PM.asin(Math.max(-1, Math.min(1, dot(h, f.l)))) / DG));
  const flex = Math.max(-90, Math.min(90, PM.atan2(dot(h, f.m), dot(h, f.a)) / DG));
  k["hand" + s] = [r0(flex), r0(side), r0(roll)];
  const hd = norm(sub(p("fist" + s), p("knuck" + s)));
  const ph = r0(flex) * DG;
  const n = sub(mul(f.m, PM.cos(ph)), mul(f.a, PM.sin(ph)));
  const curl = PM.atan2(dot(hd, n), dot(hd, h)) / DG / 0.9;
  // the body points hold the middle finger only: the others are taken to close with it
  const c = Math.max(0, Math.min(100, r0(curl)));
  k["fingers" + s] = [c, c, c, c, c];
}

/** A fresh body-point array (f32, as the reference stores points). */
export const bodyPoints = (): Float32Array => new Float32Array(P * 3);
