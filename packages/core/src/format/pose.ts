// Encode one key pose from 36 body points, and decode a key back to body points on a rest body (spec/MOTION.md §5,
// §6.3). Ported from my-3d2dge's readable.js:185-259 operation for operation, so format-1 keys encode and decode bit for
// bit (tiers 1a and 2). Format 2's optional fields (hand, fingers, spine) take separate branches that a key without
// them never enters.
import { bendOf, derived, hintFor, IDX, ik3, limbEnd, P, poleHint, poleOf, pt, reachOf, SG, unwrap, type Rest, type Side } from "./body.ts";
import { add, compose, cross, dot, DG, euler, frameFR, frameUF, fromEuler, len, loc, mul, norm, qFromTo, qrot, qslerp, rel, sub, wld, type Frame, type V3 } from "./math.ts";
import type { Key } from "./types.ts";
import { PORTABLE as PM } from "../math/portable.ts";

/** A key under construction or interpolated: named number arrays (and `t`, `yaw`). */
export type KeyLike = Partial<Key> & Record<string, unknown>;

const round = (v: number) => Math.round(v);
const SIDES: Side[] = ["L", "R"];
const arr = (k: KeyLike, f: string) => k[f] as number[] | undefined;

/** The torso and head frames and the joints placed from them (shared by encode and decode, so rounding never drifts). */
export function torso(R: Rest, k: KeyLike) {
  const p = mul(k.hips!, R.H0 / 100);
  const RP = fromEuler(k.body!);
  const RC = compose(RP, fromEuler(k.chest!));
  const RH = compose(RC, fromEuler(k.head!));
  const qP = qFromTo(R.Pr, RP);
  const qC = qFromTo(R.Cr, RC);
  const qH = qFromTo(R.Hr, RH);
  const sp: V3[] = [p];
  const spine = k.spine;
  R.spineW.forEach((w0, i) => {
    const w = spine && i < 3 ? spine[i]! / 100 : w0;
    sp.push(add(sp[i]!, qrot(qslerp(qP, qC, w), R.spine[i]!)));
  });
  const neck = sp[4]!;
  const head = add(neck, qrot(qslerp(qC, qH, R.neckW), R.neckSeg));
  const sh = (s: Side): V3 => {
    const sv = arr(k, "sh" + s) || [0, 0];
    const v0 = R.cv[s];
    const L = len(v0);
    const az = PM.atan2(v0[0], v0[1] * SG[s]) + sv[0]! * DG;
    const el = PM.asin(v0[2] / L) + sv[1]! * DG;
    return add(add(neck, wld(RC, R.clav[s])), wld(RC, [L * PM.cos(el) * PM.sin(az), SG[s] * L * PM.cos(el) * PM.cos(az), L * PM.sin(el)]));
  };
  return { p, RP, RC, RH, spine1: sp[1]!, spine2: sp[2]!, chest: sp[3]!, neck, head, sh, hip: (s: Side) => add(p, wld(RP, R.hip[s])) };
}

/** Options for encoding: `hands` also fits format 2's hand and finger fields from the hand's body points. */
export interface EncodeOptions {
  hands?: boolean;
  /** Whole numbers, as a file holds them (the default); false keeps the exact values, for blending in point space. */
  round?: boolean;
}

/** One key pose from captured body points; `prev` (the key before) keeps angles continuous. */
export function encodePose(R: Rest, X: ArrayLike<number>, prev: KeyLike | null, opts: EncodeOptions = {}): KeyLike {
  const D = derived(R);
  const r0 = opts.round === false ? (v: number) => v : round;
  const p = (n: string) => pt(X, n);
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
    const v = loc(RC, sub(p("sh" + s), p("clav" + s)));
    const v0 = R.cv[s];
    const az = (a: V3) => PM.atan2(a[0], a[1] * SG[s]) / DG;
    const el = (a: V3) => PM.asin(Math.max(-1, Math.min(1, a[2] / len(a)))) / DG;
    k["sh" + s] = [r0(az(v) - az(v0)), r0(el(v) - el(v0))];
  }
  const tq = torso(R, k);
  for (const s of SIDES) {
    const limbs: [string, V3, Frame, string, string, number, number][] = [
      ["arm", tq.sh(s), tq.RC, "fist", "elbow", R.up, D.lower],
      ["leg", tq.hip(s), tq.RP, "ankle", "knee", R.thigh, R.shin],
    ];
    for (const [limb, root, M, end, mid, L1, L2] of limbs) {
      // with hands, the arm aims at the virtual fist: where a straight hand's fist would be (spec/MOTION.md §5.3)
      const endPt = opts.hands && limb === "arm" ? add(p("wrist" + s), mul(norm(sub(p("wrist" + s), p("elbow" + s))), R.fist)) : p(end + s);
      let v = loc(M, sub(endPt, root));
      // a fist curled in past the shoulder: point the fully bent limb away from the elbow instead
      if (len(v) < Math.abs(L1 - L2) + 10) v = mul(norm(loc(M, sub(p(mid + s), root))), -Math.abs(L1 - L2));
      const dir = norm([v[0], v[1] * SG[s], v[2]]).map((x) => r0(x * 100));
      const bend = r0(bendOf(len(v), L1, L2));
      const target = limbEnd(root, M, norm(dir), s, reachOf(bend, L1, L2));
      const dd = norm(sub(target, root));
      const tw = poleOf(dd, hintFor(limb as "arm" | "leg", SG[s], M, [dir[0]!, dir[1]! * SG[s], dir[2]!]), sub(p(mid + s), root));
      const before = arr(pr, limb + s);
      const prevT = before ? before[4] : undefined;
      k[limb + s] = [...dir, bend, r0(unwrap(tw, prevT))];
    }
    const fd = loc(tq.RP, norm(sub(p("ball" + s), p("ankle" + s))));
    const td = loc(tq.RP, norm(sub(p("toe" + s), p("ball" + s))));
    const pf = arr(pr, "foot" + s);
    const down = PM.asin(Math.max(-1, Math.min(1, -fd[2]))) / DG;
    k["foot" + s] = [r0(down - R.abPitch), r0(unwrap(PM.atan2(fd[1] * SG[s], fd[0]) / DG, pf ? pf[1] : undefined)), r0(down - PM.asin(Math.max(-1, Math.min(1, -td[2]))) / DG - (R.abPitch - R.btPitch))];
  }
  if (opts.hands) for (const s of SIDES) encodeHand(R, X, k, tq, s, arr(pr, "hand" + s), r0);
  return k;
}

/** The decoded arm for side s of key k: shoulder, elbow, the IK's end, and the pole the elbow bends toward. */
function arm(R: Rest, k: KeyLike, tq: ReturnType<typeof torso>, s: Side) {
  const D = derived(R);
  const RC = tq.RC;
  const sh = tq.sh(s);
  const a = arr(k, "arm" + s)!;
  const aN = norm(a);
  const fT = limbEnd(sh, RC, aN, s, reachOf(a[3] || 0, R.up, D.lower));
  const ad = norm(sub(fT, sh));
  const pole = poleHint(ad, hintFor("arm", SG[s], RC, [aN[0], aN[1] * SG[s], aN[2]]), a[4] || 0);
  const [el, fist] = ik3(sh, fT, R.up, D.lower, pole);
  return { sh, el, fist, pole };
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
  const set = (n: string, v: readonly number[]) => {
    const i = IDX[n]! * 3;
    out[i] = v[0]!;
    out[i + 1] = v[1]!;
    out[i + 2] = v[2]!;
  };
  const { p, RP, RC, RH, neck, head } = tq;
  set("pelvis", p);
  set("pelvisF", add(p, mul(RP[0], 120)));
  set("spine1", tq.spine1);
  set("spine2", tq.spine2);
  set("chest", tq.chest);
  set("chestF", add(tq.chest, mul(RC[0], 120)));
  set("neck", neck);
  set("head", head);
  set("headTop", add(head, wld(RH, R.topH)));
  set("faceF", add(head, wld(RH, R.faceH)));
  const bladeK = arr(k, "blade");
  const blade = bladeK ? norm(wld(RC, bladeK)) : null;
  for (const s of SIDES) {
    const { sh, el, fist, pole } = arm(R, k, tq, s);
    const fd = norm(sub(fist, el));
    const wr = add(el, mul(fd, R.fore));
    set("clav" + s, add(neck, wld(RC, R.clav[s])));
    set("sh" + s, sh);
    set("elbow" + s, el);
    set("wrist" + s, wr);
    const hand = arr(k, "hand" + s);
    const fingers = arr(k, "fingers" + s);
    if (!hand && !fingers) {
      set("knuck" + s, add(wr, mul(fd, R.knuck)));
      set("fist" + s, fist);
      const acr = s === "R" && blade ? blade : RC[1];
      set("index" + s, add(fist, mul(acr, 20)));
      set("pinky" + s, add(fist, mul(acr, -20)));
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
      set("knuck" + s, knuck);
      set("fist" + s, fistPt);
      const acr = s === "R" && blade ? blade : norm(sub(f.l, mul(h, dot(f.l, h))));
      set("index" + s, add(fistPt, mul(acr, 20)));
      set("pinky" + s, add(fistPt, mul(acr, -20)));
    }
    const hip = tq.hip(s);
    const l = arr(k, "leg" + s)!;
    const ln = norm(l);
    const aT = limbEnd(hip, RP, ln, s, reachOf(l[3] || 0, R.thigh, R.shin));
    const ld = norm(sub(aT, hip));
    const [kn, an] = ik3(hip, aT, R.thigh, R.shin, poleHint(ld, hintFor("leg", SG[s], RP, [ln[0], ln[1] * SG[s], ln[2]]), l[4] || 0));
    set("hip" + s, hip);
    set("knee" + s, kn);
    set("ankle" + s, an);
    const ft = arr(k, "foot" + s) || [0, 0, 0];
    const pa = (ft[0]! + R.abPitch) * DG;
    const pb = (ft[0]! + R.btPitch - (ft[2] || 0)) * DG;
    const yw = ft[1]! * DG;
    const dir = (q: number) => wld(RP, [PM.cos(q) * PM.cos(yw), SG[s] * PM.cos(q) * PM.sin(yw), -PM.sin(q)]);
    const ball = add(an, mul(dir(pa), R.ab));
    set("ball" + s, ball);
    set("toe" + s, add(ball, mul(dir(pb), R.bt)));
  }
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
  const side = PM.asin(Math.max(-1, Math.min(1, dot(h, f.l)))) / DG;
  const flex = PM.atan2(dot(h, f.m), dot(h, f.a)) / DG;
  k["hand" + s] = [r0(flex), r0(side), r0(roll)];
  const hd = norm(sub(p("fist" + s), p("knuck" + s)));
  const ph = flex * DG;
  const n = sub(mul(f.m, PM.cos(ph)), mul(f.a, PM.sin(ph)));
  const curl = PM.atan2(dot(hd, n), dot(hd, h)) / DG / 0.9;
  // the body points hold the middle finger only: the others are taken to close with it
  const c = Math.max(0, Math.min(100, r0(curl)));
  k["fingers" + s] = [c, c, c, c, c];
}

/** A fresh body-point array (f32, as the reference stores points). */
export const bodyPoints = (): Float32Array => new Float32Array(P * 3);
