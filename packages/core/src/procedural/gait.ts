// The gait synthesizer (PLAN.md WP-6.2, D71), after riftlight's gaitClip (src/engine/animation/gait.ts, "zero foot
// slide by construction"): a walk or a run as a loop that travels, from its speed, cadence and stance, on any rest from
// its standing pose (a gait takes no other start pose: its legs, pelvis, torso and arms are its own). Each foot is
// planted in the world while it is in stance: in the root's frame it slides back at exactly the ground speed. In swing
// it lifts straight up past the height a lifted foot is read at, and sets straight down, still in the world, and
// travels forward between on a Hermite curve whose ends keep that speed, lifted on an arc that peaks before halfway,
// its height's slope continuous throughout: a foot near the floor never moves. The pelvis bobs twice a cycle and sways
// over the standing foot, lowered until no leg reaches past 98.5% of its length as the clip holds it (a gait whose
// swinging leg it would then fold under 25% of it, or whose knee it would put under the floor, is refused), the arms
// swing against the legs (each hand aimed from the shoulder its key decodes), and a limp shortens one leg's stance and
// drops the pelvis on it. The contacts are the model's own (each foot from its touchdown to its lift-off). The root and
// pelvis are put on the format's grid before the feet are aimed (the pelvis's step of two % beside still frames taken a
// frame early or late, which reads as a pop, and about the loop's seam taken again where its steps there jolt the
// torso), and each planted leg's rounded numbers are chosen to keep its ankle within the format's rounding (a leg's
// direction is held in hundredths: about 4 mm) of where it landed, through the in-betweening too. A gait it can't play
// (a stride past the legs' reach, a leg folded shut, a knee under the floor, a swing under 0.3 s or faster past the
// hips than 4 hip heights a second, a run's cycle under 0.6 s (0.65 lifting over 25%), anything of its body turning on
// the loop's seam as sharply as the sensors read a hitch, read on the very keys the clip holds there, a number past the
// range the sensors pass, a rate outside 55 to 75 frames a second, a key budget outside 0 to 2 mm, a start pose other
// than the standing one) is refused with what fitGait makes of it and what else to change; `fitGait` slows one to the
// fastest whole speed its pace and a body's legs take (lowering its lift where no speed does) and narrows its arms'
// swing to what its hands take at that swing and every narrower one. Every bound keeps the worst the sensors read of
// each kind of defect it bounds at 90% of the fail level or under, measured on fresh grids over all it takes (D71,
// round 14), but one, recorded: climbing on a run's shortest cycles, a knee popping within the clip read 91.1%, under
// the fail level (MIN_RUN_CYCLE). The frames are spread evenly over the cycle, an even number of them, and each knee's
// turn about its leg, carried on from frame to frame, is closed over it, so the loop meets itself; the frames about the
// seam are kept as keys.
import { bendOf, derived, IDX, limbEnd, P, reachOf, SG, type Rest, type Side } from "../format/body.ts";
import { add, dot, len, loc, mul, norm, qmul, qrot, sub, type Frame, type Quat, type V3 } from "../format/math.ts";
import { decodePose, encodePose, torso, type KeyLike } from "../format/pose.ts";
import { FIELDS } from "../format/sample.ts";
import { KEY_FIELDS, type Clip, type Contacts } from "../format/types.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import type { Pose } from "../ops/pose.ts";
import { nearestTo, quantize } from "../recipe/compile.ts";
import { REACH } from "../recipe/ik.ts";
import type { Root, Track } from "../recipe/types.ts";
import { Limbs } from "./limbs.ts";
import { bodyOf, clipOfTrack, standingOn, type ProceduralOptions } from "./clip.ts";

/**
 * A gait, in the format's units: speed and lengths in % of the hip height, angles in degrees, times in seconds. Besides
 * each number's range, `gaitClip` refuses a swing under 0.3 s (the cycle times the share a foot is up), a foot swinging
 * forward past the hips faster than 400% of the hip height a second, a run's (a stance under 0.5) cycle under 0.6 s
 * (0.65 lifting over 25), a rate outside 55 to 75 frames a second, a key budget outside 0 to 2 mm, a start pose other
 * than the standing one (it is made from `standingOn(rest)`, whose readings every bound below takes), and, on the rest
 * given, a stride past the legs' reach (72% of a leg ahead and behind), a swinging leg folded under 25% of its length,
 * a knee under the floor (the pelvis lowered for a far reach and the bounce) or anything of its legs or torso turning
 * on the loop's seam past 70% of the level the sensors fail it at, read on the keys the clip holds there (the refusals
 * name what fitGait makes of it: the fastest whole speed that plays, the highest whole lift some speed plays at where
 * none plays at its own, and the swing where its hands need it), and a hand turning round there so at its swing or a
 * narrower whole one (the refusal names the widest whole swing at which none does); `fitGait` fits a gait so; each with
 * what to change (D71).
 */
export interface Gait {
  /** Its clip is PROCEDURAL/<Name> unless given an id, so a word then (letters, digits, _ or -). */
  name: string;
  /** What it is, in a line: its clip's description. */
  about: string;
  /** Ground speed, % of the hip height per second. */
  speed: number;
  /** One cycle (two steps), seconds. */
  cycle: number;
  /** The share of the cycle each foot is down (a walk 0.6, a run 0.35). */
  stance: number;
  /** How high the swinging ankle rises (% of the hip height, 12 by default; 9 to 35: a foot that lifts less never
   *  reads as lifted, so it reads as dragged, and a run's knees pop lifting more). */
  lift?: number;
  /** The pelvis's bounce, twice a cycle, and how far it is lowered throughout (% of the hip height; 1.5 (0 to 6), and
   *  2 (0 to 12) or as far as a leg needs to reach half a stride ahead and behind). */
  bounce?: number;
  dip?: number;
  /** The pelvis's sway over the standing foot (% of the hip height, 2 by default; 0 to 4: a run's knee pops at 5). */
  sway?: number;
  /** Forward lean of the torso, degrees (3 by default; −10 to 25). */
  lean?: number;
  /** The arms' swing either way, degrees (25 by default; 0 to 80). */
  swing?: number;
  /** 0..1: the left leg's stance shortened by up to 30% and the pelvis dropped over it by up to 4% of the hip height;
   *  the left foot lands later and the right stands longer, so both are down together as long as in the plain gait. */
  limp?: number;
}

const pt = (X: ArrayLike<number>, n: string): V3 => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const put = (X: Float32Array, n: string, v: readonly number[]) => X.set(v, IDX[n]! * 3);
const turn = (axis: V3, a: number): Quat => [axis[0] * PM.sin(a / 2), axis[1] * PM.sin(a / 2), axis[2] * PM.sin(a / 2), PM.cos(a / 2)];
const D2R = Math.PI / 180;
const PELVIS = ["pelvis", "pelvisF", "hipL", "hipR"];
const UPPER = ["spine1", "spine2", "chest", "neck", "head", "headTop", "faceF", "chestF", ...["L", "R"].flatMap((s) => ["clav", "sh", "elbow", "wrist", "index", "knuck", "pinky", "fist"].map((n) => n + s))];
/** The torso's points as a key places them (the arms hang from its shoulders), and each arm's own, moved with them. */
const TORSO = ["spine1", "spine2", "chest", "neck", "head", "headTop", "faceF", "chestF", "clavL", "clavR", "shL", "shR"];
const ARM = ["elbow", "wrist", "index", "knuck", "pinky", "fist"];
/**
 * The torso in the points X put where its key decodes it (quantize's whole numbers, as the clip will hold it), each
 * arm moved with its shoulder, so the hands are aimed from the shoulders the key puts them on. The key spreads a lean
 * up the spine, so a torso turned whole about the pelvis decodes with its shoulders back where the spine bends less:
 * at a lean of 25° by a fifth to a quarter of an arm (an eighth to a sixth at 15, 3% at the default 3; on the UAL
 * rests and test characters), and a hand aimed at 94% of an arm from the turned shoulder was past the arm's reach from
 * the decoded one through part of the swing. The key then held that arm straight, its bend falling from 25° to 0
 * between two frames as the hand came within reach again, and the elbow stepped three times as far as on either side:
 * a pop at 70 to 75 frames a second where the frames fell so (leaning 25, swinging 39 to 60, on library rests and test
 * characters; round 9's review). From the decoded shoulder the hand is at 94% of an arm in every frame, so the arm the
 * key holds is bent alike throughout (37 to 39° on the 104 bodies, within 1° in any clip; 0 to 79 before). The torso
 * so placed encodes back to the same whole numbers (4,160 leans and turns on 104 bodies, round 10), so the key's
 * shoulders are these.
 */
function onKeyTorso(R: Rest, X: Float32Array, hint: Pose, T: Float32Array, hands = hint.handL !== undefined || hint.handR !== undefined): void {
  decodePose(R, quantize(encodePose(R, X, hint as KeyLike, { hands, round: false }) as Pose) as KeyLike, T);
  for (const s of ["L", "R"]) {
    const d = sub(pt(T, `sh${s}`), pt(X, `sh${s}`));
    for (const n of ARM) put(X, n + s, add(pt(X, n + s), d));
  }
  for (const n of TORSO) put(X, n, pt(T, n));
}
/** Gait g's torso in the points X (the start pose's, S) at cycle phase `phase`: leaning, the chest turning against the
 *  legs, turned whole about the pelvis's place `piv`, and the pelvis and torso moved by dHip. */
function placeTorso(g: Gait, S: Float32Array, piv: V3, X: Float32Array, phase: number, dHip: V3): void {
  const qUp = qmul(turn([0, 1, 0], (g.lean ?? 3) * D2R), turn([0, 0, 1], -6 * D2R * PM.cos(2 * Math.PI * phase)));
  for (const n of PELVIS) put(X, n, add(pt(S, n), dHip));
  for (const n of UPPER) put(X, n, add(add(piv, qrot(qUp, sub(pt(S, n), piv))), dHip));
}
/** Where gait g aims side s's hand at cycle phase `phase` from the shoulder `sh`: at 94% of an arm (`armLen` mm), swung
 *  against the legs (the left forward as the right foot is). */
const handAim = (g: Gait, s: Side, phase: number, sh: V3, armLen: number): V3 => {
  const sw = (g.swing ?? 25) * D2R * PM.cos(2 * Math.PI * (phase + (s === "R" ? 0.5 : 0))), side = s === "L" ? -1 : 1;
  return add(sh, mul([PM.sin(sw), side * 0.12, -PM.cos(sw)], armLen * 0.94));
};
/** Hermite on 0..1 between p0 and p1 with slopes m0 and m1. */
const hermite = (s: number, p0: number, p1: number, m0: number, m1: number) => {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
};

/** The least share of the swing a foot spends lifting off and setting down, still in the world, and the least time:
 *  a fast gait's swing is short, and a rise quicker than a couple of frames reads as the foot dragging forward. */
const OFF = 0.1, RISE = 0.05;
/** The farthest a foot may reach ahead of or behind the hips (half a stride, and the set-down's lead), of a leg: a
 *  longer stride needs the pelvis so low the knees pop (at 72.5 to 74.5%, lowered for the bounce too, a knee still
 *  popped on some bodies: D71, round 6). Just under it (round 14's second pass: 5,101 clips each a half or 0.99 under
 *  the next whole speed, which its reach refuses, on its two lowest, two highest and two other grids, every rest) a
 *  knee's pop reads 73.5% at most (100STYLE's side-run rest at 73.2 frames a second), the seam 69.5% and anything 82.3%
 *  (the pelvis's steps on test character 9); round 14 read 70.2% over 5,724, and its review's tuned searches 75.4%
 *  (CMU_54's run at 320.25, at 73.3). Round 14's second pass's review climbed a run's knee to 91.1% at 71.8% of a leg
 *  (M2M_ANIMATED's rest at 377, a run's shortest cycle: see MIN_RUN_CYCLE). */
const STRIDE_MAX = 0.72;
/** How high it sets down from, straight down, % of the hip height: above the 4% a foot is read as standing within. */
const CLEAR = 4.5;
/**
 * How high it lifts off to, straight up, % of the hip height, and in what time when the swing has it: past the 7% a
 * standing foot must lift through to be read as lifted (core's contact bands, the sensors' too), with the sole a little
 * below the ankle. It must be there before it moves on, however short the swing (then it rises quicker): as the swing
 * starts, the foot stops going back with the ground and comes forward, and for a moment it moves with the hips, which
 * reads as a dragged foot (standing) while it is that low.
 */
const UP = 9, RISE_UP = 0.08;
/** The farthest a lifting foot may trail behind the hips while it rises, of a leg: past that a fast gait's lift-off
 *  is quicker (as a run's is), so the trailing leg never sets how low the pelvis goes. */
const TRAIL = 0.7;
/**
 * Where an ankle is at cycle phase v (0..1 from its touchdown): forward of its standing place and up, in mm. In stance
 * it slides back at the ground speed (in the root's frame: still in the world). In swing it first rises straight up
 * to `clear` in the swing's first `off` while still in the world, then travels forward on a Hermite curve whose ends
 * keep that speed, lifted on an arc to `lift` that peaks 40% of the way, and sets straight down from `landClear` in
 * the last `landOff`, still in the world again: so it is never near the floor while it moves, and a foot near the
 * floor never drifts. Its height is one curve through the five (the floor, `clear`, `lift`, `landClear`, the floor),
 * its slope continuous through each (PCHIP's, so it never overshoots) and nothing at the floor: a slope that broke where
 * the rise met the arc (infinite there) and where the arc met the set-down read as a hitch, at a loop's seam or a knee
 * (D71, round 7).
 */
export function footAt(v: number, stance: number, stride: number, lift: number, clear = 0, off = OFF, landClear = clear, landOff = off): [number, number] {
  if (v < stance) return [stride / 2 - (stride * v) / stance, 0];
  const down = 1 - landOff, s = (v - stance) / (1 - stance), slope = (-stride * (1 - stance)) / stance, span = down - off, w = Math.min(1, Math.max(0, (s - off) / span));
  const x = s < off ? -stride / 2 + slope * s : s > down ? stride / 2 + slope * (s - 1) : hermite(w, -stride / 2 + slope * off, stride / 2 + slope * (down - 1), slope * span, slope * span);
  // the heights' knots and the rise's and set-down's slopes where they meet the arc (each its own way up from the floor)
  const up = Math.min(clear, lift), land = Math.min(landClear, lift), peak = off + 0.4 * span, a = peak - off, b = down - peak;
  const mUp = knot(off, a, up, lift - up), mDown = knot(landOff, b, land, lift - land);
  if (s < off) return [x, rise(s / off, up, mUp * off)];
  if (s > down) return [x, rise((1 - s) / landOff, land, mDown * landOff)];
  return [x, s < peak ? hermite((s - off) / a, up, lift, mUp * a, 0) : hermite((s - peak) / b, lift, land, 0, -mDown * b)];
}
/** 0 to 1 with zero slope and curvature at both ends. */
const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
/** From the floor at u = 0 (no slope, no curvature: the foot's rise has no kick) to h at u = 1 with slope m (a quintic
 *  Hermite; rising throughout for m up to 2.5 h). */
const rise = (u: number, h: number, m: number) => h * smooth(u) - m * u * u * u * (1 - u) * (4 - 3 * u);
/** The slope where a rise of `dh0` over `h0` from the floor meets an arc's of `dh1` over `h1` to the peak: PCHIP's
 *  (Fritsch and Butland's weighted harmonic mean of the two, none if either is flat), at most twice the rise's own, so
 *  neither piece overshoots. */
const knot = (h0: number, h1: number, dh0: number, dh1: number) => {
  const d0 = dh0 / h0, d1 = dh1 / h1;
  return d0 > 0 && d1 > 0 ? Math.min(2 * d0, (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1)) : 0;
};

/**
 * Where a leg's numbers `l` put its ankle, from `hip` in the pelvis's frame RP on rest R: decodePose's own steps for it
 * (the leg's end at its bend's reach, kept by ik3 within the leg's, as ik3 keeps it: the knee, which its twist turns, isn't
 * needed), as its Float32Array holds the point, bit for bit. snapLegs weighs 81 candidates a leg with it, where a whole
 * decode each took 85% of a gait's time (an idle's too) and made one in about 0.3 s.
 */
export function ankleOf(R: Rest, hip: V3, RP: Frame, l: readonly number[], s: Side): V3 {
  return ankleAt(R, hip, RP, l, s, reachOf(l[3] || 0, R.thigh, R.shin));
}
/** ankleOf at the reach its bend gives (`reach`, reachOf's). */
function ankleAt(R: Rest, hip: V3, RP: Frame, l: readonly number[], s: Side, reach: number): V3 {
  // (ik3's end alone: the leg's end at its bend's reach, kept within the leg's, as ik3 keeps it)
  let end = limbEnd(hip, RP, norm(l), s, reach), d = sub(end, hip);
  const dist = len(d), max = R.thigh + R.shin - 0.01, min = Math.abs(R.thigh - R.shin);
  if (dist > max) {
    d = mul(d, max / dist);
    end = add(hip, d);
  } else if (dist < min - 1e-6 && dist > 1e-9) {
    d = mul(d, min / dist);
    end = add(hip, d);
  }
  return [Math.fround(end[0]), Math.fround(end[1]), Math.fround(end[2])];
}
/** A limb's numbers (an arm's or a leg's) rounded as a key holds them (quantize's for the field): the direction scaled to
 *  100, each number within its range and whole. */
function roundLimb(x: readonly number[]): number[] {
  const l = Math.sqrt(x[0]! * x[0]! + x[1]! * x[1]! + x[2]! * x[2]!), v = l > 1e-9 ? [x[0]! * (100 / l), x[1]! * (100 / l), x[2]! * (100 / l), ...x.slice(3)] : x;
  return v.map((n, i) => {
    const r = LIMB.ranges[i], c = r ? Math.min(r[1], Math.max(r[0], n)) : n;
    return Math.round(c) + 0;
  });
}
const LIMB = KEY_FIELDS.legL!;

/**
 * A pose rounded as a key is (quantize), its legs' numbers each chosen from the whole numbers about their roundings to
 * land the ankles nearest where the points X have them, or the `goals` given: a leg's direction is held in hundredths,
 * so a planted ankle can't land closer than about 4 mm to any one place; given where it landed, it stays within that
 * of it. Each candidate's ankle is the decoder's (ankleOf), from the hips the rounded pose places.
 */
export function snapLegs(R: Rest, p: Pose, X: Float32Array, goals: Partial<Record<"L" | "R", V3>> = {}): Pose {
  const out = quantize(p), tq = torso(R, out as KeyLike);
  for (const s of ["L", "R"] as const) {
    const f = `leg${s}`, raw = p[f] as number[], goal = goals[s] ?? pt(X, `ankle${s}`), base = out[f] as number[], hip = tq.hip(s);
    // (each candidate's miss weighed once: rounded to 100 again, many land on the same numbers; and each bend's reach)
    const reaches = new Map<number, number>(), seen = new Map<number, number>();
    const miss = (v: number[]) => {
      const key = ((v[0]! * 256 + v[1]!) * 256 + v[2]!) * 512 + v[3]!;
      let e = seen.get(key);
      if (e === undefined) {
        let reach = reaches.get(v[3]!);
        if (reach === undefined) reaches.set(v[3]!, (reach = reachOf(v[3] || 0, R.thigh, R.shin)));
        seen.set(key, (e = len(sub(ankleAt(R, hip, tq.RP, v, s, reach), goal))));
      }
      return e;
    };
    let best = base, err = miss(base);
    // the four numbers that place the ankle (direction and bend), each its rounding or a whole number either side
    // (each as a key holds it: quantize scales a direction to 100 again, so a candidate is judged as it will be written)
    const r = raw.map((x) => Math.round(x)), c = [0, 0, 0, 0, base[4]!];
    for (let m = 0; m < 81; m++) {
      for (let i = 0; i < 4; i++) c[i] = r[i]! + (Math.floor(m / [1, 3, 9, 27][i]!) % 3) - 1;
      const v = roundLimb(c), e = miss(v);
      if (e < err) [best, err] = [v, e];
    }
    out[f] = best;
  }
  return out;
}

/**
 * The ranges a gait's own numbers are taken in: those the sensors pass on every preset on three rests (D71); past them
 * a run's knees pop (a lift of 40, a sway of 5). The fresh grids draw each at its ends a quarter of the time (round 14
 * and its second pass), within the readings the bounds below state.
 */
const RANGES: readonly [keyof Gait, number, number, string][] = [
  ["lift", UP, 35, `a foot must lift past ${UP}% to read as lifted, and a run's knees pop lifting more than 35%`],
  ["bounce", 0, 6, ""],
  ["dip", 0, 12, ""],
  ["sway", 0, 4, "a run's knee pops swaying 5%"],
  ["lean", -10, 25, ""],
  ["swing", 0, 80, ""],
];
/**
 * The shortest swing a foot is given, s: the sensors read a foot lifted for under 0.1 s as never having left the floor
 * (core's contact bands, the sensors' too), and in a swing under 0.19 s it is up above their 7% for less than that
 * (round 2); under 0.25 s a knee pops lifting more than 12, bouncing 6, or at a stance of 0.5 near the cap, on many
 * bodies (D71, rounds 4 and 5); at 0.25 to 0.257 s, a stance of 0.5 near the reach bound still did on some (round 6).
 * Under 0.3 s, near the reach bound, the leading leg straightens as its foot comes farthest ahead, at the set-down's
 * lead, and bends again as the hips come on over the planted foot; where the swing spans under 16 frames that falls
 * within one key, and the knee's step there reads as a pop: every fail and near miss sat at 14.5 to 15.5 frames a swing
 * (round 13's review: CMU_18's rest swinging 0.261 s, 15 frames at 57.5 frames a second, 104.6% plainly; round 12's
 * review's searches 95.1%, CMU_91's 95.7%). The model can't read it from its own points (the keys' rounding moves the
 * knee's step by 3.6 mm on average and up to 24, and the pop rule's ratio of 2.5 turns that into readings of up to 89%
 * where the model's points read none: round 13), so the swing is bounded instead, whatever the rate: a cycle's grid
 * holds the even number of frames nearest it at 55 a second, as few as one fewer, and every cycle taken is 0.6 s or
 * more (this swing at a stance of a half; a run's shortest), so a swing of T s spans at least T × (55 − 1/0.6) frames:
 * 16 at 0.3 s (15.5 at 0.29). Measured on round 13's tree, every rest, library rests plainly and test characters by
 * parts, the worst reading a knee's pop: over swings of 0.26 to 0.34 s on every even grid from 55 to 75 frames a second
 * (2,492 gaits fitted at the reach bound and a fraction under it, 37,870 clips), by frames a swing 87.5% at 14.5 to
 * 15.5, 82.7% at 15.5 to 16, 72.7% at 16 to 16.5 and 71.5% at 16.5 to 17; at the worst grid alignment (the stance that
 * gives the fewest frames a swing at 55, jittered; 4,160 gaits, the three lowest grids, 27,213 clips), 78.7% at 0.285
 * to 0.29 s, 70.5% at 0.29 to 0.3 and 72.8% at 0.3 to 0.302 (CMU_114's rest, 16.06 frames a swing). It is 0.3 s to
 * within a float's error (swingsLong): rounds 7 to 14 took the swing to the ms, so 0.2995 s passed (a cycle of 0.599 s
 * at a stance of a half, 15.97 frames a swing at 55), and the worst round 14 read of this class sat there (its climbs,
 * CMU_114's rest swinging 0.2997 s, 75.5% at 55; round 14's review's, CMU_18's 76.4%, and its 9,760 fitted gaits
 * swinging 0.2995 s on the four lowest grids, 68.8%). At 0.3 s as taken since (round 14's second pass, on this tree,
 * every rest, the protocol's reading and everything by parts): the 2,080 gaits fitted from 1,000 at the shortest swings
 * near the reach bound (a stance of 0.5 to 0.53, swinging 0.3 to 0.32 s) read a knee's pop of 54.9% at most at 55 to 63
 * frames a second; all 3,932 clips of the fresh grids swinging under 0.32 s at 55 to 63 read a knee's or foot's pop of
 * 68.1% (test character 29 at 56.1), and the 3,621 tuned to the bounds 67.1% (CMU_16's rest by parts); and three climbs
 * on the class (750 steps from round 14's worst on CMU_18's and CMU_114's rests, moved to the bound, each step fitted
 * and read on every grid from 55 to 63) 72.3% at most: CMU_18's rest {0.633 s, a stance of 0.526, swinging 0.30004 s}
 * at 303.5, plainly at 55 (34 frames, 16.1 a swing; 67.2% by parts). Every preset swings 0.3 s or more (the limp's
 * right foot 0.3006 s, the shortest). It leaves every cycle 0.6 s or more, where an arm swing of 80 turns round on the
 * seam within what rounds 9 to 13 bounded it by, 250° for each second squared of the cycle (ARM_TURN, removed: 80 took
 * 0.566 s); the hands' own reading there is SEAM_TURN's.
 */
const MIN_SWING = 0.3;
/**
 * The fastest a swinging foot may come forward past the hips, % of the hip height a second (its stride over its swing:
 * the speed times its stance over its swing, whatever the cycle): at 420 a long stance's knee pops mid-swing on some
 * bodies (stance 0.75 at 140: 13 of 128 clips, on 12 rests); at 402 and under none did (D71, round 3). Measured on
 * walks and limps (stances of 0.62 to 0.75); a run's feet, standing under half the cycle, come forward slower than the
 * body goes, so it reaches the cap only past 400% of the hip height a second (at stance 0.3, past 930%), where no run
 * was measured. fitGait slows a gait to it as to the legs' bounds (paceSpeed: fitted to the legs alone it gave back the
 * limp asked 300 on 9 of the 104 rests, and 346 of 2,912 long stances asked 1,000 at the shortest cycles their swing
 * takes, coming forward at 403 to 426%, which gaitClip refused: round 14's review). On round 14's second pass's grids
 * (that scan again at the swing's exact bound, 2,912 fits all taken, 420 of them at this bound; 2,600 long stances and
 * limps at the shortest cycles their swing takes, asked 1,000 or within 3% under it; and the fresh grids asked up to
 * 1,000, past it too: every rest, 55 to 75 frames a second), the 2,733 clips coming forward past 360 read a knee's or
 * foot's pop of 69.9% at most (UAL2's rest by parts at 75, 394%), the 586 past 395 65.3%, and anything 81.5% (the
 * pelvis's steps on test character 19); the 4,991 tuned just under it (a fraction under the cap, or the fitted whole
 * speed where the cap set it) 67.1% (CMU_16's rest by parts). Round 14's review read 60.6% over 1,478 clips past 360,
 * and round 14 51.8% over 162.
 */
const SWING_SPEED = 400;
/**
 * A run's (a stance under half the cycle's) shortest cycle, s, and lifting over 25: under it its feet move too sharply
 * between frames, and its seam and knees pop (D71, round 4). It doesn't bound the knee's turn on the seam above it: at
 * 0.6 to about 0.63 s and a stance of about 0.37 to 0.44, a run's left foot comes forward on the seam at its sharpest,
 * and the knee read a hitch there at every rate from 55 to 75 (round 10's review: 33 of 2,600 fitted runs, to 113.5%;
 * round 6's "one run's seam at 0.6 s", recorded then as one case, was this class). SEAM_TURN bounds it on the body
 * given. Its runs' knees pop within the clip the most of any knees, and climbed, the most of anything, past the margin
 * every bound keeps (90% of the fail level: D71, round 14) once: climbing on fitted runs at the shortest cycles near
 * the reach bound, round 14's second pass's review read a knee's pop of 91.1% on M2M_ANIMATED's rest {0.6 s, a stance
 * of 0.415, lifting 10.246, bouncing 1.12, dipping 6.819, swaying 2.833, leaning 3.407, swinging 62.979}, which fitGait
 * gives back at 377 asked any speed over it, at 73.333 frames a second (44 frames; the right knee at 0.545 s), plainly
 * and by parts alike; 88.1% on CMU_140's {0.6 s, 0.41, lifting 9, bouncing 1.723} at 375.5, at 70.000 (42 frames), and
 * 87.2% on M2M_QUATERNIUS's {0.62 s, 0.406, a limp of 0.245, lifting 10.992, bouncing 1.881, dipping 11.07, swaying
 * 2.51, leaning 20.767, swinging 2.276} fitted to 359, at 70.968 (84.5% by parts). None fails; the case is older
 * than round 14, and recorded rather than bounded (another round to win the last point isn't worth its cost; the
 * sensors' test holds the first at what is recorded, 90 to 92%). On that review's grids its 3,026 fresh runs under
 * 0.65 s read a knee's pop of 71.6% at most (CMU_140's at 70), the 3,309 tuned to the bounds 68.2%, and 27,487 fitted runs
 * remade on every grid from 60 to 75 frames a second (12,133 under 0.65 s) 77.4% (CMU_141's at 73.333). Round 14's
 * second pass's own fresh grids (3,721 runs under 0.65 s, 0.7 lifting over 25) read 73.0% (test character 8 by parts at
 * 73.6), the 1,302 tuned 59.7%; round 14's review 74.4% on its fresh grids, 74.3% on 9,325 runs at their shortest cycle
 * on the four highest grids, 75.4% tuned and 79.7% climbed (CMU_54's rest {0.6 s, 0.418, lifting 12.583} at 380.5, at
 * 70); and round 14 69.2% on its own.
 */
const MIN_RUN_CYCLE = 0.6, MIN_HIGH_RUN_CYCLE = 0.65;
/**
 * The fewest and most frames a second a gait is made at: fewer, a fast gait's seam steps too far between them, and at
 * 50 a swing of 0.26 s just over a stance of a half, lifting 30 or 35, still popped a knee as the thigh swept through
 * (7 of 456 on 19 rests; at 55 and 60 none; D71, round 7). More, the format's grid reads as pops: it holds the pelvis's
 * and the root's places in whole % of the hip height, so a slow pelvis steps a whole % in one frame beside still ones
 * (across and up at once at worst), read the faster the more frames a second, and a planted leg takes each step at
 * once. A run's knee and a short-armed body's hands turning round on the loop's seam failed at every rate from 55 to 75
 * (rounds 10 and 11), and the pelvis's whole-% steps either side of it jolted a short spine to 94% (round 11's review):
 * SEAM_TURN bounds all three, read on the keys the clip holds at every rate from MIN_GAIT_FPS to MAX_GAIT_FPS. At the
 * slow end, the shortest swings near the reach bound straightened a leading knee within one key and popped it at 55 to
 * 60 (round 13's review, 104.6%): MIN_SWING bounds that whatever the rate. On round 14's fresh grids (as SEAM_TURN
 * gives them; and the presets, raw and fitted on every rest at 55, 60, 65, 70 and 75, 3,935 clips) none fails, and the
 * most any reading reaches, the protocol's and everything by parts alike, is 69.6% at 55 to 57.5 (the seam), 70.0% at
 * 57.5 to 62.5 (the seam), 71.3% at 62.5 to 65, 76.4% at 65 to 70, and 82.3% at 70 to 75 and at 75 itself (1,151 clips
 * there; the presets' 787 at 75 82.3% too): the pelvis's whole-% steps on test character 9's short spine (pelvisGrid),
 * the most any class reads on fresh grids. Tuned to the bounds (see SEAM_TURN; 6,917 made), 69.8% at 55 to 57.5 and
 * 82.3% at 70 to 75 and at 75. On round 14's second pass's fresh grids (17,880 clips, as SEAM_TURN gives them; 598 at
 * 55 and 1,859 at 75), the same: 69.5% at 55 to 57.5 (a knee at the seam), 69.6% at 57.5 to 62.5, 71.3% at 62.5 to 65,
 * 76.4% at 65 to 70 and 82.3% at 70 to 75 and at 75 (test character 9's pelvis); tuned to the bounds (10,515 made),
 * 69.9% at 55 to 57.5; the climbs' late-swing knee 72.3% at 55 (see MIN_SWING) and a run's knee 79.7% at 70 (round 14's
 * review's, see MIN_RUN_CYCLE). Round 14's review's 46,825 clips (3,692 at 55, 4,288 at 75) read 82.3% at most, the
 * same steps. Round 14's second pass's review's 18,815 fresh clips (1,165 at 55, 1,929 at 75) and 14,841 tuned to the
 * bounds read 70.0% at 55 to 57.5 (70.3% tuned, a toe's pop), 69.4% at 57.5 to 62.5, 71.3% at 62.5 to 65, 76.4% at 65
 * to 70 and 82.3% at 70 to 75 and at 75, the same steps; but its climbs on a run's knee popping within the clip read
 * more at 70 to 75: 88.1% at 70.000 (CMU_140's rest), 87.2% at 70.968 (M2M_QUATERNIUS's) and 91.1% at 73.333
 * (M2M_ANIMATED's), past the 90% every bound keeps and under the fail level: the most any class reads, recorded
 * (MIN_RUN_CYCLE). At 80 and 90 (1,400 of round 12's gaits, each made at both, round 12): at 80 none failed, the steps
 * reading 89.2% (test character 9) and the seam 69.8%; at 90 the steps failed once, test character 23's walk at 102.2%,
 * and read 97.3% on test character 9. (At 110 a planted knee failed on 7 of 64 rests, round 7; at 240 a walk failed on
 * every rest, and at 120 a brisk walk's elbows on 4, rounds 4 to 6.)
 */
const MIN_GAIT_FPS = 55, MAX_GAIT_FPS = 75;
/**
 * A gait's key budget, mm, and the most it takes (`opts.budget`, 0 to this: 0 keeps every frame a key): its keys are
 * kept within it of every frame it draws (and the frames about the seam are keys whatever it is). Every bound here is
 * measured at it. Past it the sensors read what the keys leave out: at 150 to 300 mm the knees popped past the fail
 * level, at 1,000 (or a NaN or an infinite budget, which keep no key but the ends and the seam's) 8 or 9 keys failed
 * outright, and a negative one threw on the way (round 13's review). Under it a gait's frames are nearly all keys
 * anyway (68.6 keys on average at 2 mm, 69.1 at 1 and at 0, on the gaits below): the 1,200 gaits of round 14's fresh
 * grids that read the most and 1,200 more drawn at random (2,310 in all, as SEAM_TURN gives them), each made at 0, 1 and
 * 2 mm, read no more at 0 or 1 than at 2 (2,085 and 2,095 of them the same clip), none failing, 82.3% at most at each.
 */
const GAIT_BUDGET = 2;
/** What is wrong with a gait's own numbers, the first field refused (named and described, each a number in its range),
 *  or nothing: what `checkGait` refuses before it weighs them together, and `fitGait` gives back unfitted. */
function fieldProblem(g: Gait): string | undefined {
  // (its clip is named and described from them, after it is made)
  for (const k of ["name", "about"] as const) if (typeof g[k] !== "string" || !g[k].trim()) return `its ${k} is ${g[k] === undefined ? "missing" : JSON.stringify(g[k])}: give it a name (its clip is PROCEDURAL/<Name>) and an about line (the clip's description)`;
  for (const k of ["speed", "cycle", "stance", "limp", ...RANGES.map(([k]) => k)] as const) if (g[k] !== undefined && typeof g[k] !== "number") return `${k} ${JSON.stringify(g[k])} is not a number`;
  if (!(g.speed > 0 && g.speed <= 1000)) return `speed ${g.speed} is not above 0 and at most 1000 (% of the hip height a second)`;
  if (!(g.cycle >= 0.3 && g.cycle <= 3)) return `cycle ${g.cycle} is not 0.3 to 3 s`;
  if (!(g.stance >= 0.2 && g.stance <= 0.75)) return `stance ${g.stance} is not 0.2 to 0.75 of the cycle`;
  const limp = g.limp ?? 0;
  if (!(limp >= 0 && limp <= 1)) return `limp ${limp} is not 0 to 1`;
  for (const [k, lo, hi, why] of RANGES) {
    const v = g[k] as number | undefined;
    if (v !== undefined && !(v >= lo && v <= hi)) return `${k} ${v} is not ${lo} to ${hi}${k === "lean" || k === "swing" ? " degrees" : " (% of the hip height)"}${why ? `: ${why}` : ""}`;
  }
  return undefined;
}
/** The share of the cycle each foot of gait g stands (gaitClip's numbers: the right from 0 to its lift-off, the left for
 *  its shortened stance; the right stands at least as long as the left), and the least share either has to swing. */
function sidesOf(g: Gait): { right: number; left: number; free: number } {
  const limp = g.limp ?? 0, both = g.stance - 0.5, right = 1 - g.stance * (1 - 0.3 * limp) + 2 * both, left = g.stance * (1 - 0.3 * limp);
  return { right, left, free: Math.min(1 - right, 1 - left) };
}
/** How fast gait g's feet come forward past the hips, % of the hip height a second: its right foot's (it stands at least
 *  as long as the left, so it is the faster forward), its stride over its swing. */
const paceOf = (g: Gait) => {
  const { right } = sidesOf(g);
  return (g.speed * right) / (1 - right);
};
/** The fastest whole speed at which gait g's feet come forward past the hips at SWING_SPEED or slower, as checkGait reads
 *  it. */
function paceSpeed(g: Gait): number {
  const { right } = sidesOf(g);
  let v = Math.floor((SWING_SPEED * (1 - right)) / right) + 1;
  while (v > 0 && paceOf({ ...g, speed: v }) > SWING_SPEED) v--;
  return v;
}
/** Whether a foot swinging `free` of a cycle of `cycle` s swings MIN_SWING or more, to within a float's error: 0.9375 s at a
 *  stance of 0.68 swings 0.3 s, which a float makes 0.29999999999999993 (the verifier's round 7 saw 0.8 s at a stance of
 *  0.675 refused as "0.260 s, under 0.26 s"). Nothing shorter: to the ms, as rounds 7 to 14 took it, 0.2995 s passed, and
 *  so a cycle of 0.599 s at a stance of a half (round 14's review). */
const swingsLong = (free: number, cycle: number) => free * cycle >= MIN_SWING - 1e-9;
/** A gait's numbers checked: named and described, in range, each foot given time to swing (a limp's strong foot most of
 *  all), and no faster forward than SWING_SPEED. */
export function checkGait(g: Gait): void {
  const bad = (what: string) => {
    throw new Error(`gait${typeof g.name === "string" && g.name.trim() ? ` ${g.name}` : ""}: ${what}`);
  };
  const problem = fieldProblem(g);
  if (problem !== undefined) bad(problem);
  const limp = g.limp ?? 0, { right, free } = sidesOf(g);
  if (right > 0.85) bad(`a limp of ${limp} on a stance of ${g.stance} leaves the right foot ${Math.round((1 - right) * 100)}% of the cycle to swing: use a shorter stance or a lighter limp`);
  const foot = limp > 0 ? "its right foot swings" : "its feet swing";
  if (!swingsLong(free, g.cycle)) {
    // the shortest cycle (to the ms), and the longest stance at this cycle (to the thousandth), that swing long enough as
    // checked (the right foot's share of the cycle up being 1 - stance × (1 + 0.3 limp)): a run's cycle no shorter than a
    // run takes, and its stance only where it is in range, and a run's (under a half) only where the cycle is long enough
    // for one; the swing shown rounded down, so one just under the bound never reads as at it
    const run = (g.lift ?? 12) > 25 ? MIN_HIGH_RUN_CYCLE : MIN_RUN_CYCLE, runs = g.cycle >= run;
    let ms = Math.ceil((MIN_SWING * 1000) / free) + 1, th = Math.floor(((1 - MIN_SWING / g.cycle) / (1 + 0.3 * limp)) * 1000) - 1;
    while (swingsLong(free, (ms - 1) / 1000)) ms--;
    while (swingsLong(sidesOf({ ...g, stance: (th + 1) / 1000 }).free, g.cycle)) th++;
    const cycle = Math.max(ms / 1000, g.stance < 0.5 ? run : 0), stance = th / 1000;
    const ways = [...(cycle <= 3 ? [`a cycle of at least ${cycle} s`] : []), ...(stance >= 0.2 && (stance >= 0.5 || runs) ? [`a stance of at most ${stance}`] : []), ...(limp > 0 ? ["a lighter limp"] : [])];
    bad(`${foot} for ${(Math.floor(free * g.cycle * 1000 + 1e-6) / 1000).toFixed(3)} s, under ${MIN_SWING} s: a knee pops swinging faster (and a foot up for under 0.1 s reads as never leaving the floor); use ${ways.length > 1 ? `${ways.slice(0, -1).join(", ")} or ${ways.at(-1)}` : ways[0]}`);
  }
  const lift = g.lift ?? 12;
  const least = lift > 25 ? MIN_HIGH_RUN_CYCLE : MIN_RUN_CYCLE;
  if (g.stance < 0.5 && g.cycle < least) bad(`a run's cycle of ${g.cycle} s${lift > 25 ? `, lifting ${lift}% of the hip height,` : ""} is under ${least} s (over ${Math.round(120 / least)} steps a minute): its feet move too sharply between frames, and its seam and knees pop; use a longer cycle${lift > 25 ? " or a lift of 25 or less" : ""}`);
  // (shown rounded up, so a pace just over the cap never reads as at it; the speed named is the fastest whole one under
  // it, which fitGait slows to, or further where the body's legs need it)
  const pace = paceOf(g);
  if (pace > SWING_SPEED) bad(`${limp > 0 ? "its right foot comes" : "its feet come"} forward past the hips at ${Math.ceil(pace)}% of the hip height a second, over ${SWING_SPEED}: a knee pops mid-swing on some bodies; use a speed of at most ${paceSpeed(g)} (fitGait slows it so)${limp > 0 ? ", a shorter stance or a lighter limp" : " or a shorter stance"}`);
}

/** The gaits the library offers ready made: an easy walk, a brisk one, a run and a limp. */
export const GAITS: readonly Gait[] = [
  { name: "walk", about: "an easy walk, arms swinging a little", speed: 130, cycle: 1.1, stance: 0.6 },
  { name: "brisk", about: "a brisk walk, a longer stride and a bigger arm swing", speed: 170, cycle: 1.0, stance: 0.58, swing: 35 },
  { name: "run", about: "a run, leaning in, with a flight between steps", speed: 350, cycle: 0.7, stance: 0.35, lift: 25, bounce: 3, lean: 8, swing: 45 },
  { name: "limp", about: "a slow limp, favouring the left leg", speed: 90, cycle: 1.3, stance: 0.62, limp: 0.8 },
];

/**
 * Each foot's numbers for gait g on legs `leg` mm long (`pct` mm to 1% of the hip height): when the left lands (the right
 * at 0), each one's stance, stride (mm), set-down and lift-off shares of its swing, and the farthest a foot reaches ahead
 * of or behind the hips, mm: half its stride and how far the ground takes it on as it lifts off or sets down.
 */
function feetOf(g: Gait, pct: number, leg: number) {
  // the right foot lands at phase 0 and the left at landL; a limp's weak left leg stands for less, landing late enough
  // and the right standing long enough that each hand-over keeps the plain gait's double support (none in a run)
  const limp = g.limp ?? 0, both = g.stance - 0.5, stanceL = g.stance * (1 - 0.3 * limp), landL = 1 - stanceL + both, stanceOf = { L: stanceL, R: landL + both };
  const per = (f: (x: "L" | "R") => number) => ({ L: f("L"), R: f("R") });
  // each foot's rise and set-down: a tenth of its swing, and no less than RISE s
  const offOf = per((x) => Math.min(0.3, Math.max(OFF, RISE / ((1 - stanceOf[x]) * g.cycle))));
  // each foot covers the ground speed times its own stance while it stands
  const strideOf = per((x) => g.speed * pct * stanceOf[x] * g.cycle);
  // each foot's lift-off: up to UP in RISE_UP s, its share of the swing no more than a short swing or a trailing leg
  // allows (then up to UP quicker)
  const upOf = per((x) => Math.max(offOf[x], Math.min(0.3, RISE_UP / ((1 - stanceOf[x]) * g.cycle), ((TRAIL * leg - strideOf[x] / 2) * stanceOf[x]) / (strideOf[x] * (1 - stanceOf[x])))));
  const reach = Math.max(...(["L", "R"] as const).map((x) => strideOf[x] / 2 + (strideOf[x] * (1 - stanceOf[x]) * Math.max(offOf[x], upOf[x])) / stanceOf[x]));
  return { landL, stanceOf, offOf, strideOf, upOf, reach };
}
/**
 * A whole speed (% of the hip height a second) up to g's at which g `fits`, or 0 if the halving finds none: found by
 * halving (a faster gait strides longer, so its feet reach farther and its pelvis goes lower), then taken down a whole
 * % at a time until it fits. Where `fits` is monotone in the speed (the reach is) it is the fastest; a leg's fold and
 * knee aren't (slower, a foot can pass nearer under the hips, or under them at the top of a high lift, the pelvis
 * dipped and bouncing), so fitOf looks above it too.
 */
function fastest(g: Gait, fits: (g: Gait) => boolean): number {
  let lo = 0, hi = g.speed;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (fits({ ...g, speed: mid })) lo = mid;
    else hi = mid;
  }
  let v = Math.floor(lo);
  while (v > 0 && !fits({ ...g, speed: v })) v--;
  return v;
}
/**
 * The shortest a leg may be drawn at any phase, hip to ankle, of its length (a knee bent about 150°, past any
 * runner's). At a short stance the swing is long and its ends keep the ground speed, so the foot swings back past the
 * stride's end and forward past it again (at a stance of 0.2, 87% of a leg each way at the reach bound), the pelvis is
 * lowered for a leg to reach that far (to 44 to 56% of the hip height), and the foot, lifted, passes under the hips at
 * the bounce's lowest: legs drawn 2.3 to 8.3% long folded shut, their knees flipping round (popping at 18 to 50 m/s) or
 * bending back, and at 20.5% a knee popped (D71, round 8: the 45 of 2,832 gaits near the reach bound that failed so
 * were all under it). A leg folded to 24.2 to 26.7% while lifting low put its knee under the floor instead (round 8's
 * review): KNEE_FLOOR bounds that. The model's fold is the leg's before its own rounding (about 0.3%): on round 12's
 * fresh grids (11,129 clips) a clip's leg came within 24.92% of its length at the least (CMU_80's fitted run, the
 * model's 25.2%), and none failed. On round 14's fresh grids (15,792 clips, as SEAM_TURN gives them) the 1,323 whose
 * legs the model folds under 27% read a knee's or foot's pop of 51.4% at most (100STYLE's back-run rest, a fitted run
 * at 64.6 frames a second), a joint past its limit 33.9%, a twist flipping 3.8%, nothing stretched, and 82.3% of
 * anything (the pelvis's steps on test character 9); and of those grids' fitted gaits tuned to the bounds (see
 * SEAM_TURN), the 804 clips whose next half or whole speed folds a leg under this bound read a knee's or foot's pop of
 * 47.3% at most and 80.8% of anything. Round 14's review read more in the class, 66.7% (test character 18's run fitted
 * at {0.65 s, a stance of 0.436, lifting 35}, at 64.6 frames a second). On round 14's second pass's fresh grids (17,880
 * clips) the 1,328 whose legs the model folds under 27% read a knee's or foot's pop of 61.4% at most (CMU_16's run at
 * 73.8), a joint past its limit 32.7%, and 80.8% of anything (the pelvis's steps on test character 21); the 358 tuned
 * just under this bound 42.6%, and 81.5% of anything.
 */
const FOLD_MIN = 0.25;
/**
 * The lowest a knee may be drawn, mm over the floor: none under it (capture's knees never are; the sensors fail one 60
 * mm under on a 950 mm hip height). At a short stance near the reach bound the pelvis is lowered to under half the hip
 * height, and as the foot swings back past the stride's end lifted little, its knee, bent forward under the low hips,
 * went 61 to 85 mm under the floor (stances of 0.2, lifting 9 to 15 and bouncing 6: 13 of 83 such gaits on CMU's rests,
 * at every rate; round 8's review). Counted as `kneeLow` places it, the pelvis rounded down: over round 9's grids
 * (47,864 clips on 104 bodies) it read 0.04 to 6.6% of the hip height under the clip's lowest knee wherever that was
 * within 5% of the floor (4,194 clips), and over it only on knees a third of the hip height up, by 0.11% at most (a
 * leg's own rounding); no clip's knee went under the floor (D71, round 9). On round 12's fresh grids (11,129 clips) the
 * lowest knee stood 1.2 mm over the floor; where a clip's knee came within 60 mm of it (285 clips) the model read 0.4
 * to 56 mm under it, and it read over a clip's lowest knee once, by 0.4 mm, on a knee 277 mm up. On round 14's fresh
 * grids no knee went into the floor (the body's penetration 0 in all 15,792 clips; the feet's 4.7% at most); the 246
 * whose lowest knee the model puts within 40 mm of it (97 within 10) read a knee's or foot's pop of 47.3% at most and
 * 75.5% of anything (the pelvis's steps on test character 17); tuned to the bounds (see SEAM_TURN), the 68 clips whose
 * next half or whole speed puts a knee under the floor read 59.0% of anything at most, a knee's pop 42.7%. Round 14's
 * review read more in the class, a knee's pop of 68.5% by parts and 65.4% as the protocol reads it (CMU_81's run at 0.6
 * s, 455.5, at 60 frames a second). On round 14's second pass's fresh grids the body's penetration was 0 in all 17,880
 * clips (the feet's 5.2% at most), and the 126 whose lowest knee the model puts within 40 mm of the floor read a knee's
 * or foot's pop of 44.7% at most and 68.2% of anything (the pelvis's steps on test character 39); the 8 tuned just
 * under this bound 57.2% of anything, and no knee's pop.
 */
const KNEE_FLOOR = 0;
/**
 * The most any point of a gait's legs, torso or hands may turn on its loop's seam (seamOf), of the level the sensors
 * fail it at. A run's left foot lands half a cycle after the right, so as the loop ends and begins it swings: at a
 * run's shortest cycles and a stance of about 0.35 to 0.45 it has just stopped going back with the ground and comes
 * forward, where the swing's forward travel is sharpest, and the knee reversed across the seam (round 10's review: 33
 * of 2,600 fitted runs at 0.6 to 0.63 s failed so, at every rate from 55 to 75, to 113.5%); the arms turn round there
 * too, and short-armed bodies read by parts failed at their hands (round 11's searches, to 103%); and the pelvis's
 * whole-% steps either side of it jolt a short spine (round 11's review: 0.938 by parts). Round 11 read the knees and
 * feet where they were aimed, before the format's rounding, and so read up to 0.21 of the level under the sensors'
 * change of velocity there and 0.42 under their pop rule, whose 2.5 times a few mm decide (round 11's review: CMU_144's
 * run, taken at 0.70, read 0.91), and its 0.7 was a margin for that, measured. seamOf reads the very keys the clip
 * holds about the seam as the sensors read them, the pop rule counted conservatively, so a clip made from the standing
 * pose (the only start gaitClip takes) reads no more there than it does, on any grid 55 to 75 frames a second give,
 * plainly or by parts: this bounds the reading itself (to 1e-5 of the level against the sensors' own: their points are
 * 32-bit; round 12). On round 14's fresh grids (17,238 gaits at 55 to 75 frames a second, reals and every even grid, on
 * the 64 library rests and test characters 0 to 39, 9,820 of them fitted, 15,792 made; seeds 1411 to 1418) none failed,
 * no clip read over its own seamOf reading (to the thousandth kept), and the seam read at most 70.0% at a knee or foot
 * (test character 18's fitted run at 58.3 frames a second), 69.7% at a hand and 69.9% at the torso, the protocol's
 * reading and everything by parts alike; the knuckles, which move with the fist, 67.5%, and the elbows and wrists,
 * which it doesn't read, 63.5% (60.7% as the protocol reads them). Tuned to the bounds (900 of those grids' fitted
 * gaits, each at its speed a half and 0.99 above its fitted whole one and its swing a half wider, at its two lowest,
 * two highest and two other grids: 13,872 jobs, 6,917 made just under a bound and 6,955 refused just over one), the
 * seam read at most 69.8% at a knee or foot, 69.8% at a hand and 69.9% at the torso. Round 14's second pass's fresh
 * grids (20,592 gaits on the same rests at 55 to 75, 14,069 fitted, asked up to 1,000 past the pace cap too, with 2,080
 * runs at their shortest cycle on the four highest grids and 2,080 shortest swings at the reach bound; 17,880 made;
 * seeds 1501 to 1512) read the seam at most 70.0% at a knee (CMU_90's run at 75), 69.9% at the torso, 69.3% at a hand
 * by parts (68.6% as the protocol reads it), the knuckles 67.2% and the elbows and wrists 64.3%, no clip over its own
 * seamOf reading; the 10,515 tuned to the bounds 69.9% at a knee or foot, 69.7% at a hand by parts, 69.0% at the torso,
 * the knuckles 67.9% and the elbows and wrists 64.4%; round 14's review's 46,825 clips 70.0%, 69.8%, 69.9%, 67.9% and
 * 65.1%; and its second pass's review's 18,815 fresh clips and 14,841 tuned to the bounds 70.0% at a knee or foot,
 * 70.0% at a hand (test character 31's, tuned, at 71.4; 69.9% fresh), 69.9% at the torso, the knuckles 68.0% and the
 * elbows and wrists 65.7% (by parts), the protocol's reading and everything by parts alike. The loop's origin at a calm
 * phase (round 4's other fix) isn't taken: a blend space keeps its clips in phase, so a walk and a run blend foot for
 * foot only where each begins at the right foot's touchdown.
 */
const SEAM_TURN = 0.7;
/** The sensors' seamVelocity (its fail level, % of the hip height a second: 4 m/s on a 950 mm hip height; the samples a
 *  second it reads a clip at) and pop (3.6 m/s), as their THRESHOLDS give them (the sensors' test holds them equal). */
export const SEAM_FAIL = 400000 / 950, SEAM_RATE = 60, POP_FAIL = 360000 / 950;
/** A typical person's chain from the pelvis to each point the seam is read at, of the hip height (the sensors'
 *  TYPICAL_CHAIN, which their test holds these equal to): read by parts, a point's level is scaled by its own chain over
 *  that, and a point without one (the pelvis's own) reads plainly. */
export const CHAIN: Readonly<Record<string, number>> = { spine1: 0.151, spine2: 0.286, chest: 0.44, chestF: 0.44, neck: 0.629, head: 0.719, headTop: 0.843, faceF: 0.85, clav: 0.726, sh: 0.967, knuck: 1.697, index: 1.697, pinky: 1.697, fist: 1.743, hip: 0.113, knee: 0.557, ankle: 1.019, ball: 1.218, toe: 1.294 };
/** Each point's chain from the pelvis on rest R, mm, as the sensors measure it (the left side's). */
function chainsOf(R: Rest): Record<string, number> {
  const c: Record<string, number> = {};
  c.spine1 = len(R.spine[0]!);
  c.spine2 = c.spine1 + len(R.spine[1]!);
  c.chest = c.chestF = c.spine2 + len(R.spine[2]!);
  c.neck = c.chest + len(R.spine[3]!);
  c.head = c.neck + len(R.neckSeg);
  c.headTop = c.head + len(R.topH);
  c.faceF = c.head + len(R.faceH);
  c.clav = c.neck + len(R.clav.L);
  c.sh = c.clav + len(R.cv.L);
  const wrist = c.sh + R.up + R.fore;
  c.knuck = c.index = c.pinky = wrist + R.knuck;
  c.fist = wrist + R.fist;
  c.hip = len(R.hip.L);
  c.knee = c.hip + R.thigh;
  c.ankle = c.knee + R.shin;
  c.ball = c.ankle + R.ab;
  c.toe = c.ball + R.bt;
  return c;
}
/**
 * The lowest a knee can be over the floor, mm, on a leg from a hip `hz` mm over it to an ankle (dx, dy, dz) from the hip
 * (thigh L1, shin L2), as ik3 places it: along the hip-to-ankle line to the triangle's apex and out from it, turned
 * about the line the lowest way a knee pointing forward can be (straight down where that is forward, a trailing leg's;
 * across, a leading leg's). The clip's knee turns about the leg as it is carried from frame to frame (by up to 50° on a
 * short stance), so its lowest turn is the one counted.
 */
function kneeLow(hz: number, dx: number, dy: number, dz: number, L1: number, L2: number): number {
  const far = Math.sqrt(dx * dx + dy * dy + dz * dz), k = 1 / Math.max(far, 1e-9), [nx, ny, nz] = [dx * k, dy * k, dz * k];
  const dist = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2), far, 0.01)), x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  const down = nx * nz >= 0 ? -Math.sqrt(Math.max(0, 1 - nz * nz)) : -Math.abs(ny) / Math.max(1e-9, Math.sqrt(ny * ny + nz * nz));
  return hz + nz * x + down * y;
}
/** The farthest a re-rounded pelvis is from where it is drawn, % of the hip height (`pelvisGrid`): half a % is the grid's
 *  own rounding. */
const Z_SLACK = 0.75;
/**
 * The pelvis's places on the format's grid (whole % of the hip height) at a loop's frames, from where it is drawn
 * (`want`, mm): each the nearest, but
 * - where that steps its height two % or more in one frame beside still frames, a step the sensors read as a pop, one
 *   end of the step is taken a % toward the other (the one nearer its drawn place first, no further than Z_SLACK from
 *   it, and only where that frame's legs still fit as the phase loop bounds them: `fits`). A bob moving about a % a
 *   frame, drawn just either side of a half, rounds so (75.4, 74.5, 73.5, 72.5: 75, 75, 73, 73), and a clip's first and
 *   last steps are read against the one step within it (the seam's, the bob slowing: 70, 68, 68); read by parts, on a
 *   body whose pelvis-to-spine is short (the test characters'), the spine popped at up to 136% of the fail level at 90
 *   frames a second, 104 to 121% at 75 and 80, and read 88 to 100% at 55 and 60 (D71, round 9);
 * - and, given the `seam` (the frames' times and the cycle's: seamOf asks where the gait's torso would otherwise turn
 *   on the loop's seam past SEAM_TURN), its places in the two frames either side of the seam and the seam's own are
 *   taken again, across and up either whole % about its drawn place (along, its nearest), the legs still fitting and no
 *   step of two made, so that its whole-% steps there turn it as little as they can as the sensors read it (its change
 *   of velocity across the seam, and the pop rule at the clip's first and last steps, counted as seamOf counts it, and
 *   the sensors' pop rule at the steps within the clip these frames make or stand beside, on the pelvis's own places,
 *   the closing frame's taken as the first's: a guide, which seamOf's reading of the keys then keeps only where it
 *   reads less). A pelvis rising or swaying about a % a frame steps every other frame, and where one step fell just
 *   before the seam and none just after, or across and up at once, a short spine read by parts read up to 94% of the
 *   fail level there (round 11's review: 0.938 at 70 frames a second, 0.925 at 62.4, 0.875 at 75; about 1.0 in theory).
 *   Within Z_SLACK alone the steps either side often can't be made alike (a sway of 0.3% a frame drawn at 0.14, 0.46
 *   and 0.77 rounds to 0, 0 or 1, 1: one step or the other), so the slack there is the whole % either side. Round 12
 *   left out the steps within: test character 12's walk at 72.73 read 72% at the seam and, its step taken two frames
 *   in, 78% there as a pop; and it took the pelvis along too, stepping it out and back and along, across and up at
 *   once. Of the 13 clips round 12's review found the pass kept on their own grid, 10 popped the torso within four keys
 *   of the seam (to 80.8%) and none now does.
 * The pelvis's whole-% steps within a clip are bounded by measurement only, the most any class of gait reads on fresh
 * grids (a run's knee popping within the clip has been climbed past it, to 91.1%: MIN_RUN_CYCLE): a whole % across and
 * up at once (√2 %) beside still frames, over a 13 ms key at 75 frames a second, on test character 9's short spine read
 * by parts is 1.414 × 76.92 / 378.95 / 0.3488 = 82.3% of the pop's fail level, and every grid since round 12 has met
 * that and no more (round 14's fresh grids, 15,792 clips, and the presets, 3,935, as SEAM_TURN and MAX_GAIT_FPS give
 * them: 82.3%, test character 9 at 70 to 75 frames a second; 81.5% on 19; round 14's second pass's 17,880 fresh and
 * 10,515 tuned clips, round 14's review's 46,825, and its second pass's review's 18,815 fresh and 14,841 tuned, 82.3%
 * too). Along, across and up at once (√3 %) it would read 1.008, and no clip steps so: none of round 14's, its second
 * pass's or that pass's review's, nor any of 2,554 slow gaits swaying and bobbing on the 13 short-spined test
 * characters at 66 to 75 frames a second searched for one (850 of them step on two axes at once) (round 12's review
 * found none; on round 13's tree one of 350 walks and brisk walks on test characters at 66 to 75 did with the pelvis
 * along taken either way about the seam, which is kept at its nearest since). The sway and the pelvis along (the root's
 * rounding made up) are otherwise each frame's nearest.
 */
function pelvisGrid(want: readonly V3[], pct: number, fits: (i: number, v: readonly number[]) => boolean, seam?: { times: readonly number[]; dur: number }): number[][] {
  const n = want.length, grid = want.map((w) => w.map((v) => Math.round(v / pct)));
  const step = (i: number) => {
    const a = grid[i]!, b = grid[(i + 1) % n]!;
    return Math.sqrt((b[0]! - a[0]!) ** 2 + (b[1]! - a[1]!) ** 2 + (b[2]! - a[2]!) ** 2);
  };
  // (a clip's first and last steps against their one neighbour, as the sensors read them)
  const bad = (i: number) => Math.abs(grid[(i + 1) % n]![2]! - grid[i]![2]!) >= 2 && step(i) > 2.5 * Math.max(i > 0 ? step(i - 1) : 0, i < n - 1 ? step(i + 1) : 0);
  const count = () => grid.reduce((c, _, i) => c + (bad(i) ? 1 : 0), 0);
  for (let pass = 0; pass < n; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      if (!bad(i)) continue;
      const k = (i + 1) % n, d = Math.sign(grid[k]![2]! - grid[i]![2]!), before = count();
      const options = [[i, grid[i]![2]! + d], [k, grid[k]![2]! - d]].map(([j, to]) => ({ j: j!, to: to!, off: Math.abs(want[j!]![2] / pct - to!) })).filter((o) => o.off <= Z_SLACK).sort((a, b) => a.off - b.off);
      for (const { j, to } of options) {
        const was = grid[j]![2]!;
        grid[j]![2] = to;
        if (count() < before && fits(j, grid[j]!)) {
          moved = true;
          break;
        }
        grid[j]![2] = was;
      }
    }
    if (!moved) break;
  }
  if (seam && n > 7) {
    // how sharply the pelvis turns on the seam, of the levels (whole % of the hip height a second over theirs) as the
    // sensors read it, its frames in-betweened and the closing one the first again: its change of velocity across it,
    // and the pop rule at the first and last steps counted as seamOf counts it
    const T = [...seam.times, seam.dur], dts = seam.dur / Math.ceil(seam.dur * SEAM_RATE), at = (i: number) => grid[i % n]!;
    const samples = [seam.dur, seam.dur - dts, dts, 0].map((t) => {
      let k = 0;
      while (k < n - 1 && T[k + 1]! <= t) k++;
      return { k, u: (t - T[k]!) / (T[k + 1]! - T[k]!) };
    });
    const value = ({ k, u }: { k: number; u: number }): number[] => {
      const a = at(k), b = at(k + 1);
      return [0, 1, 2].map((x) => a[x]! + (b[x]! - a[x]!) * u);
    };
    // (step k: from frame k to k + 1, the last to the closing frame)
    const stepOf = (k: number) => sub(at(k + 1) as V3, at(k) as V3), speedOf = (k: number) => len(stepOf(k)) / (T[k + 1]! - T[k]!);
    const cost = () => {
      const [e, B, s1, f] = samples.map(value) as [number[], number[], number[], number[]], change = [0, 1, 2].map((x) => e[x]! - B[x]! - (s1[x]! - f[x]!));
      const pops = (I: readonly number[]) => {
        const d = [0, 1, 2].map((k) => sub(at(I[k + 1]!) as V3, at(I[k]!) as V3)), v = d.map((x, k) => len(x) / Math.abs(T[I[k + 1]!]! - T[I[k]!]!));
        return Math.max(v[0]! - v[1]!, dot(d[0]!, d[1]!) < 0 ? Math.min(v[0]!, v[1]!) - v[2]! : 0);
      };
      // and the steps within the clip that these frames make or stand beside, by the sensors' pop rule (a step over 2.5
      // times the larger beside it, a pair out and back over 2.5 times the steps beyond it): taken without them, a step
      // moved off the seam two frames in read there as a pop as high as it had at the seam (round 12's review)
      let inside = 0;
      for (const k of [1, 2, 3, n - 4, n - 3, n - 2]) {
        const around = Math.max(speedOf(k - 1), speedOf(k + 1));
        if (speedOf(k) > 2.5 * around) inside = Math.max(inside, speedOf(k) - around);
      }
      for (const k of [1, 2, 3, n - 5, n - 4, n - 3]) {
        const pair = Math.min(speedOf(k), speedOf(k + 1)), around = Math.max(speedOf(k - 1), speedOf(k + 2));
        if (dot(stepOf(k), stepOf(k + 1)) < 0 && pair > 2.5 * around) inside = Math.max(inside, pair - around);
      }
      return Math.max(len(change) / dts / SEAM_FAIL, Math.max(0, pops([0, 1, 2, 3]), pops([n, n - 1, n - 2, n - 3]), inside) / POP_FAIL);
    };
    const was = cost();
    if (was > 0) {
      const idx = [n - 2, n - 1, 0, 1, 2], old = idx.map((i) => [...grid[i]!]), before = count();
      // each frame's places, across and up either whole % about its drawn place (along, its nearest: the drawn pelvis goes
      // on with the root, the root's rounding made up, so in the world it goes on a whole % at a time and never back;
      // taken either way too, it went out and back, and stepped along, across and up at once: round 12's review)
      const ways = idx.map((i) => {
        const axes = [0, 1, 2].map((a) => (a === 0 ? [grid[i]![a]!] : [0, -1, 1].map((e) => grid[i]![a]! + e).filter((v) => Math.abs(want[i]![a] / pct - v) < 1)));
        return axes[0]!.flatMap((x) => axes[1]!.flatMap((y) => axes[2]!.map((z) => [x, y, z])));
      });
      const tries: { pick: number[]; c: number; moves: number }[] = [];
      const walk = (k: number, pick: number[]) => {
        if (k === idx.length) {
          tries.push({ pick: [...pick], c: cost(), moves: idx.filter((i, j) => grid[i]!.some((v, a) => v !== old[j]![a])).length });
          return;
        }
        for (let w = 0; w < ways[k]!.length; w++) {
          grid[idx[k]!] = ways[k]![w]!;
          walk(k + 1, [...pick, w]);
        }
      };
      walk(0, []);
      idx.forEach((i, j) => (grid[i] = [...old[j]!]));
      tries.sort((p, q) => p.c - q.c || p.moves - q.moves);
      for (const t of tries) {
        if (t.c >= was) break;
        idx.forEach((i, j) => (grid[i] = [...ways[j]![t.pick[j]!]!]));
        if (count() <= before && idx.every((i, j) => grid[i]!.every((v, a) => v === old[j]![a]) || fits(i, grid[i]!))) break;
        idx.forEach((i, j) => (grid[i] = [...old[j]!]));
      }
    }
  }
  return grid;
}
/** A gait's legs as `drawnAt` and the seam's reading need them: each foot's numbers (feetOf), mm to 1% of the hip height,
 *  the lift (mm), the limp, how far the pelvis is lowered (mm), and the legs' and arms' lengths (mm). */
type Drawn = ReturnType<typeof feetOf> & { pct: number; lift: number; limp: number; dip: number; leg: number; thigh: number; shin: number; armLen: number };
/**
 * Where gait g draws the pelvis at `time` (s) of a cycle `dur` s long, from its standing place `piv` (mm), and the root,
 * and where it aims each foot: lowered, bouncing twice a cycle (lowest just after each touchdown), swaying over the
 * standing foot, dropping over the weak leg while it stands; the root on the format's grid (whole % of H0), its rounding
 * made up in the root's frame (`behind`); each foot from its standing place, the right touching down at phase 0 and the
 * left at landL (a half, without a limp).
 */
function drawnAt(g: Gait, d: Drawn, piv: V3, dur: number, time: number) {
  const { pct, dip, landL, stanceOf, strideOf, upOf, offOf, lift, limp } = d;
  const phase = time / dur, vL = (phase + 1 - landL) % 1, bob = -dip - ((g.bounce ?? 1.5) * pct * PM.cos(4 * Math.PI * (phase - 0.08)));
  const sway = (g.sway ?? 2) * pct * PM.cos(2 * Math.PI * (phase - g.stance / 2)), drop = vL < stanceOf.L ? -4 * limp * pct * PM.sin((Math.PI * vL) / stanceOf.L) : 0;
  const rootF = Math.round(g.speed * time), behind = (g.speed * time - rootF) * pct;
  const aim = (s: Side) => footAt((phase + (s === "R" ? 0 : 1 - landL)) % 1, stanceOf[s], strideOf[s], lift, UP * pct, upOf[s], CLEAR * pct, offOf[s]);
  return { phase, rootF, behind, want: add(piv, [behind, sway, bob + drop]), aim: { R: aim("R"), L: aim("L") } };
}
/**
 * Gait g's frames on a grid of nf of them, as gaitClip times and draws them on the body whose points S are: their times
 * (to the ms, spread evenly over the cycle), where the pelvis is drawn, the root and each foot aimed (drawnAt; `at` for
 * any time), and the pelvis on the format's grid (pelvisGrid, each frame's legs still fitting: none past 98.5% of its
 * length or folded under FOLD_MIN, no knee under the floor; and with `seam`, its places about the loop's seam taken again
 * to change its velocity across it as little as they can); `hip(i)` is frame i's pelvis moved from its standing place,
 * mm (frame nf: the seam's, after the last, at the first one's height), and `places` the pelvis's places, which given
 * (`places`, as a grid of these frames found them) are taken as they are.
 */
function gridOf(g: Gait, S: Float32Array, d: Drawn, nf: number, seam = false, places?: number[][]) {
  const pct = d.pct, dur = Math.round(g.cycle * 1000) / 1000, piv = pt(S, "pelvis");
  const times = Array.from({ length: nf }, (_, i) => Math.round((i * dur * 1000) / nf) / 1000);
  const at = (time: number) => drawnAt(g, d, piv, dur, time), drawn = times.map(at);
  const off = (v: readonly number[]): V3 => sub([v[0]! * pct, v[1]! * pct, v[2]! * pct], piv);
  const grid = places ?? pelvisGrid(drawn.map((p) => p.want), pct, (i, v) => {
    const p = drawn[i]!, dHip = off(v);
    return (["R", "L"] as const).every((s) => {
      const hip = add(pt(S, `hip${s}`), dHip), a = pt(S, `ankle${s}`), [fwd, up] = p.aim[s], w = sub([a[0] + fwd + p.behind, a[1], a[2] + up], hip), l = len(w);
      return l <= 0.985 * d.leg && l >= FOLD_MIN * d.leg && kneeLow(hip[2], w[0], w[1], w[2], d.thigh, d.shin) >= KNEE_FLOOR;
    });
  }, seam ? { times, dur } : undefined);
  const last = at(dur);
  const hip = (i: number): V3 => off(i < nf ? grid[i]! : [Math.round(last.want[0] / pct), Math.round(last.want[1] / pct), grid[0]![2]!]);
  return { nf, dur, times, drawn, at, hip, piv, places: grid };
}
type Grid = ReturnType<typeof gridOf>;
/** The frames either side of a loop's seam that a gait's clip keeps as keys whatever the budget (gaitClip), and the seam's
 *  reading reads: the sensors read its change of velocity from the in-betweens a sample either side of it, and its pops
 *  at the clip's first and last three steps. */
const SEAM_KEYS = 3;
/** Points named for each side, as a refusal names them (`%` the side). */
const SIDED = (m: Record<string, string>): Record<string, string> => Object.fromEntries((["L", "R"] as const).flatMap((s) => Object.entries(m).map(([n, w]) => [n + s, w.replace("%", s === "L" ? "left" : "right")])));
/**
 * The points the seam is read at: the body's (legs and torso), and the hands' (each fist, and the index and pinky
 * points beside it). The elbows, wrists and knuckles aren't: their turn about the arm is carried from frame to frame from
 * where the start pose has it, which the reading doesn't follow (the knuckles move with the fist, but for their twentieth
 * of the forearm).
 */
const BODY_AT = { pelvis: "pelvis", pelvisF: "pelvis", spine1: "pelvis", spine2: "pelvis", chest: "chest", chestF: "chest", neck: "chest", head: "head", headTop: "head", faceF: "head", ...SIDED({ hip: "pelvis", clav: "% shoulder", sh: "% shoulder", knee: "% knee", ankle: "% foot", ball: "% foot", toe: "% foot" }) };
const HANDS_AT = SIDED({ fist: "% hand", index: "% hand", pinky: "% hand" });
/** A key's numbers in-betweened as a clip plays them (keyAt): each field from a to b by u. */
const between = (a: Pose, b: Pose, u: number): Pose => {
  const k: Pose = {};
  for (const f of FIELDS) {
    const av = a[f] as number[] | undefined;
    if (av) {
      const bv = (b[f] as number[] | undefined) || av;
      k[f] = av.map((v, j) => v + (bv[j]! - v) * u);
    }
  }
  return k;
};
/**
 * How sharply a point turns on a loop's seam on one grid, of the level the sensors fail it at, `scale` mm a %: its place
 * at the clip's first four keys (`head`, at times `headT`) and its last four (`tail`, to the closing key, the first
 * again), and at the samples the sensors take a step (`dt`) after the first key and before the end (`after`, `before`,
 * and `end`, the last). The sensors read its change of velocity across the seam (seamVelocity) and the pop rule at the
 * first and last steps, which have no neighbour across it; the pop is counted conservatively: a step's speed above the
 * one beside it counts whatever their ratio, and a pair of steps out and back above the one beyond it, where the sensors
 * count them only past 2.5 times (a few mm decide whether a knee turning round there reads as a pop at all).
 */
function turnOf(head: readonly V3[], tail: readonly V3[], after: V3, before: V3, end: V3, headT: readonly number[], tailT: readonly number[], dt: number, scale: number): number {
  const sv = len(sub(sub(end, before), sub(after, head[0]!))) / dt / (SEAM_FAIL * scale);
  const pops = (P: readonly V3[], T: readonly number[]) => {
    const d = [0, 1, 2].map((i) => sub(P[i + 1]!, P[i]!)), v = d.map((x, i) => len(x) / Math.abs(T[i + 1]! - T[i]!));
    return Math.max(v[0]! - v[1]!, dot(d[0]!, d[1]!) < 0 ? Math.min(v[0]!, v[1]!) - v[2]! : 0);
  };
  return Math.max(sv, Math.max(0, pops(head, headT), pops([...tail].reverse(), [...tailT].reverse())) / (POP_FAIL * scale));
}
/** A grid's hands' footing about the seam (seamOf's handsBase): each of the seven frames' turns and shoulders, the
 *  closing key's, and the torso at each sample about the seam, between which keys and how far. */
type Footing = { nf: number; headT: number[]; tailT: number[]; frames: { i: number; phase: number; RC: Frame; keyRC: Frame; shX: Record<Side, V3>; shRaw: Record<Side, V3>; shKey: Record<Side, V3> }[]; closing: { RC: Frame; sh: Record<Side, V3> }; after: FootingAt; before: FootingAt; end: FootingAt };
type FootingAt = { i: number; u: number; RC: Frame; sh: Record<Side, V3> };
/** A grid's hands' footing as one run of 341 numbers, as seamOf keeps it (its 104 points and turns each an array of
 *  their own, with their records, held about four times the bytes: some 11 KB a grid against 2.7). */
function packed(B: Footing): Float64Array {
  const out: number[] = [B.nf, ...B.headT, ...B.tailT], side = (o: Record<Side, V3>) => out.push(...o.L, ...o.R), turn = (RC: Frame) => out.push(...RC[0], ...RC[1], ...RC[2]);
  for (const f of B.frames) {
    out.push(f.i, f.phase);
    turn(f.RC);
    turn(f.keyRC);
    side(f.shX);
    side(f.shRaw);
    side(f.shKey);
  }
  turn(B.closing.RC);
  side(B.closing.sh);
  for (const a of [B.after, B.before, B.end]) {
    out.push(a.i, a.u);
    turn(a.RC);
    side(a.sh);
  }
  return Float64Array.from(out);
}
/** A grid's hands' footing from its packed numbers, every number as it was. */
function unpacked(F: Float64Array): Footing {
  let k = 0;
  const n = () => F[k++]!, v3 = (): V3 => [n(), n(), n()], turn = (): Frame => [v3(), v3(), v3()], side = () => ({ L: v3(), R: v3() }), at = (): FootingAt => ({ i: n(), u: n(), RC: turn(), sh: side() });
  const nf = n(), headT = [n(), n(), n(), n()], tailT = [n(), n(), n(), n()];
  const frames = Array.from({ length: 7 }, () => ({ i: n(), phase: n(), RC: turn(), keyRC: turn(), shX: side(), shRaw: side(), shKey: side() }));
  return { nf, headT, tailT, frames, closing: { RC: turn(), sh: side() }, after: at(), before: at(), end: at() };
}
/** The footing unpacked of the gait whose hands were read last, by grid: handsOf reads every whole swing in turn, each
 *  over every grid, and unpacking each grid's footing again at each swing made fitGait about 4% slower. One gait's at
 *  most (some 0.34 MB at a 3 s cycle's 31 grids, and that gait's readings while this holds it). */
let unpackedFeet: { of: object; feet: Map<number, Footing> } = { of: {}, feet: new Map() };
/**
 * Gait g about its loop's seam, as gaitClip makes it on the body S from the standing pose `start` (D71, round 12): on each
 * grid of frames a rate from MIN_GAIT_FPS to MAX_GAIT_FPS gives, the keys the clip holds there (the SEAM_KEYS either side
 * of the seam, which it keeps whatever its budget, the seam's own and the closing one), each as gaitClip makes it: the
 * pelvis where pelvisGrid puts it, the torso where its key decodes it, each knee carried on from the start frame by frame
 * and its turn about the leg closed over the cycle, each leg's numbers snapped as the clip snaps them (a planted foot to
 * where it landed), each arm aimed from the shoulder its key decodes, and every number rounded as the key holds it; read
 * as the sensors read the clip (turnOf), plainly and by parts, whichever reads more. `body()` reads the legs and the torso
 * at every grid (BODY_AT), `hands(swing)` the hands at that swing (HANDS_AT). From the standing pose (no hand fields:
 * the only start gaitClip takes) it reads the clip's own keys exactly. (From a start with hand fields the clip's hands
 * read 0.03 to 0.07 of the level more than this placed them in the two cases round 12's review read: gaitClip refuses
 * such a start.)
 */
function seamOf(g: Gait, rest: Rest, S: Float32Array, start: Pose | undefined, d: Drawn) {
  const dur = Math.round(g.cycle * 1000) / 1000, pct = d.pct, piv = pt(S, "pelvis"), chains = chainsOf(rest), lower = derived(rest).lower;
  const hint0 = (start ?? null) as KeyLike | null;
  const scale = (n: string) => {
    const name = /[LR]$/.test(n) ? n.slice(0, -1) : n, typ = CHAIN[name];
    return pct * (typ ? Math.min(1, chains[name]! / (typ * rest.H0)) : 1);
  };
  // the sensors' samples: a step after the first key, a step before the end, and the end (a loop's last sample)
  const steps = Math.ceil(dur * SEAM_RATE), dts = dur / steps, tB = (steps - 1) * dts, tE = dur * (1 - 1e-12);
  const nfs: number[] = [];
  for (let nf = Math.max(2, 2 * Math.round((dur * MIN_GAIT_FPS) / 2)); nf <= Math.max(2, 2 * Math.round((dur * MAX_GAIT_FPS) / 2)); nf += 2) nfs.push(nf);
  // each grid's frames about the seam with their torsos as their keys hold them (the arms hang from those shoulders); the
  // pelvis's places on it, where already found, as they are
  const T = new Float32Array(P * 3);
  function torsoOf(nf: number, again: boolean, places?: number[][]) {
    const grid = gridOf(g, S, d, nf, again, places), idx = [nf - 3, nf - 2, nf - 1, 0, 1, 2, 3];
    const frames = idx.map((i) => {
      const p = grid.drawn[i]!, X = Float32Array.from(S), hint = i === 0 ? hint0 : null;
      placeTorso(g, S, piv, X, p.phase, grid.hip(i));
      onKeyTorso(rest, X, (hint ?? {}) as Pose, T, false);
      const raw = encodePose(rest, X, hint, { hands: false, round: false }) as Pose, key = quantize(quantize(raw));
      return { i, p, X, raw, key, tq: torso(rest, raw as KeyLike), tk: torso(rest, key as KeyLike) };
    });
    return { grid, idx, frames };
  }
  // each grid's frames and how sharply the body turns there; where its torso turns past SEAM_TURN, the pelvis's places
  // about the seam taken again (pelvisGrid's `seam`), the grid kept that reads less (gaitClip makes its clip on the one
  // kept). Once read, a grid keeps only its reading, the pelvis's places (gridOf draws the rest of its frames again
  // from them, as cheap as it is exact) and its hands' footing (handsBase, packed): its frames and keys (31 grids of up
  // to 226 frames at a cycle of 3 s) held 4.8 MB a gait (round 14's second pass's review)
  const stages = new Map<number, { read: { share: number; where: string }; places: Float64Array; hands: Float64Array }>();
  let bytes = 0;
  const stageAt = (nf: number) => {
    let st = stages.get(nf);
    if (!st) {
      let G = torsoOf(nf, false), read = readBody(G);
      // (where the torso turns past it: a knee or a foot is the gait's, which slowing it answers)
      if (read.share > SEAM_TURN && !/knee|foot/.test(read.where)) {
        const H = torsoOf(nf, true), again = readBody(H);
        if (again.share < read.share) [G, read] = [H, again];
      }
      st = { read, places: Float64Array.from(G.grid.places.flat()), hands: handsBase(G) };
      stages.set(nf, st);
      bytes += st.places.byteLength + st.hands.byteLength + STAGE_BYTES;
    }
    return st;
  };
  /** The pelvis's places on a grid of nf frames, as its stage kept them. */
  const placesAt = (nf: number) => {
    const p = stageAt(nf).places;
    return Array.from({ length: nf }, (_, i) => [p[3 * i]!, p[3 * i + 1]!, p[3 * i + 2]!]);
  };
  // each grid's hands' footing whatever the swing: each frame's shoulders as its points hold them (the arm reaches from
  // there), as its unrounded numbers place them (the encoder reads the arm from there) and as its key's do (the decoder
  // hangs it there), with those torsos' turns, the closing key's torso, and the torso at each sample, between which keys
  // and how far
  const lengths = Object.fromEntries((["L", "R"] as const).map((s) => [s, [len(sub(pt(S, `elbow${s}`), pt(S, `sh${s}`))), len(sub(pt(S, `fist${s}`), pt(S, `elbow${s}`)))]])) as Record<Side, [number, number]>;
  function handsBase(G: ReturnType<typeof torsoOf>) {
    const nf = G.grid.nf, { headT, tailT } = timesOf(G), both = (f: (s: Side) => V3) => ({ L: f("L"), R: f("R") });
    const frames = G.frames.map((f) => ({ i: f.i, phase: f.p.phase, RC: f.tq.RC, keyRC: f.tk.RC, shX: both((s) => pt(f.X, `sh${s}`)), shRaw: both((s) => f.tq.sh(s)), shKey: both((s) => f.tk.sh(s)) }));
    const key = (i: number) => G.frames.find((f) => f.i === i)!.key, closingKey = quantize(nearestTo(key(0), key(nf - 1))), cq = torso(rest, closingKey as KeyLike);
    const head = [0, 1, 2, 3].map(key), tail = [key(nf - 3), key(nf - 2), key(nf - 1), closingKey];
    const at = (K: readonly Pose[], KT: readonly number[], t: number) => {
      let i = 0;
      while (i < K.length - 2 && KT[i + 1]! <= t) i++;
      const u = KT[i + 1]! > KT[i]! ? Math.min(1, Math.max(0, (t - KT[i]!) / (KT[i + 1]! - KT[i]!))) : 0, tq = torso(rest, between(K[i]!, K[i + 1]!, u) as KeyLike);
      return { i, u, RC: tq.RC, sh: both((s) => tq.sh(s)) };
    };
    return packed({ nf, headT, tailT, frames, closing: { RC: cq.RC, sh: both((s) => cq.sh(s)) }, after: at(head, headT, dts), before: at(tail, tailT, tB), end: at(tail, tailT, tE) });
  }
  // the keys' times about the seam (the closing one at the cycle's end), and each sample's place among them
  const timesOf = (G: ReturnType<typeof torsoOf>) => ({ headT: [0, 1, 2, 3].map((i) => G.grid.times[i]!), tailT: [...[3, 2, 1].map((k) => G.grid.times[G.grid.nf - k]!), dur] });
  const sampleIn = (K: readonly Pose[], KT: readonly number[], t: number) => {
    let i = 0;
    while (i < K.length - 2 && KT[i + 1]! <= t) i++;
    return between(K[i]!, K[i + 1]!, KT[i + 1]! > KT[i]! ? Math.min(1, Math.max(0, (t - KT[i]!) / (KT[i + 1]! - KT[i]!))) : 0);
  };
  /** A grid's keys about the seam as the clip holds them, legs and all: [the seam's, 1, 2, 3], [nf-3, nf-2, nf-1, the closing one]. */
  function keysAbout(G: ReturnType<typeof torsoOf>): { head: Pose[]; tail: Pose[] } {
    const { grid, idx, frames } = G, { nf, times, drawn, hip } = grid;
    // whether a foot is still in the world at frame i (standing, rising or setting down), and where its run of such
    // frames starts (where it landed)
    const stand = (i: number, s: Side) => {
      const v = (drawn[i]!.phase + (s === "R" ? 0 : 1 - d.landL)) % 1, ws = (v - d.stanceOf[s]) / (1 - d.stanceOf[s]);
      return v < d.stanceOf[s] || ws < d.upOf[s] || ws > 1 - d.offOf[s];
    };
    const run = (j: number, s: Side) => {
      let i = j;
      for (let k = 0; k < nf && stand((i + nf - 1) % nf, s); k++) i = (i + nf - 1) % nf;
      return i;
    };
    const need = new Set<number>([0, nf, ...idx]);
    for (const j of idx) for (const s of ["L", "R"] as const) if (stand(j, s)) need.add(run(j, s));
    // each knee carried on frame to frame from the start pose's (gaitClip's Limbs), over the cycle and the seam's frame
    const limbs = new Limbs(S), Y = new Float32Array(P * 3), legPts = new Map<number, Float32Array>();
    for (let i = 0; i <= nf; i++) {
      const p = i < nf ? drawn[i]! : grid.at(grid.dur), dHip = hip(i);
      Y.set(S);
      for (const n of PELVIS) put(Y, n, add(pt(S, n), dHip));
      for (const s of ["R", "L"] as const) {
        const [fwd, up] = p.aim[s], a = pt(S, `ankle${s}`);
        limbs.reach(Y, `foot${s}`, [a[0] + fwd + p.behind, a[1], a[2] + up]);
      }
      if (need.has(i)) legPts.set(i, Float32Array.from(Y));
    }
    // each frame's numbers unrounded: about the seam the whole frame (its torso, legs and arms), elsewhere its legs
    const raws = new Map<number, Pose>(), full = new Map<number, Float32Array>();
    for (const f of frames) {
      const X = Float32Array.from(f.X), L = legPts.get(f.i)!, arms = new Limbs(S);
      for (const s of ["L", "R"]) for (const n of ["knee", "ankle", "ball", "toe"]) put(X, n + s, pt(L, n + s));
      for (const s of ["R", "L"] as const) arms.reach(X, `hand${s}`, handAim(g, s, f.p.phase, pt(X, `sh${s}`), d.armLen));
      raws.set(f.i, encodePose(rest, X, f.i === 0 ? hint0 : null, { hands: false, round: false }) as Pose);
      full.set(f.i, X);
    }
    for (const i of need) if (!raws.has(i)) raws.set(i, encodePose(rest, legPts.get(i)!, null, { round: false }) as Pose);
    // each knee's turn about its leg closed over the cycle, as gaitClip closes it
    const turned = (x: number) => x - 360 * Math.round(x / 360);
    const drift = (["legL", "legR"] as const).map((l) => [l, turned((raws.get(nf)![l] as number[])[4]! - (raws.get(0)![l] as number[])[4]!)] as const).filter(([, x]) => Math.abs(x) > 1e-6);
    const closed = (i: number): Pose => {
      const r: Pose = { ...raws.get(i)! };
      for (const [l, x] of drift) {
        const v = [...(r[l] as number[])];
        v[4] = v[4]! - (x * times[i]!) / grid.dur;
        r[l] = v;
      }
      return r;
    };
    // each leg snapped as the clip snaps it: a foot still in the world to where it landed, in the world
    const Z = new Float32Array(P * 3), world = (i: number, q: readonly number[], laps: number): V3 => [q[0]! + (drawn[i]!.rootF + laps * (g.speed * g.cycle)) * pct, q[1]!, q[2]!];
    const finals = new Map<number, Pose>();
    for (const j of idx) {
      const goals: Partial<Record<Side, V3>> = {};
      for (const s of ["L", "R"] as const) {
        const i0 = stand(j, s) ? run(j, s) : j;
        if (i0 === j) continue;
        decodePose(rest, snapLegs(rest, closed(i0), legPts.get(i0)!) as KeyLike, Z);
        const landed = world(i0, pt(Z, `ankle${s}`), 0), here = world(j, [0, 0, 0], j < i0 ? 1 : 0);
        goals[s] = [landed[0] - here[0], landed[1], pt(legPts.get(j)!, `ankle${s}`)[2]];
      }
      finals.set(j, goals.L || goals.R ? snapLegs(rest, closed(j), full.get(j)!, goals) : snapLegs(rest, closed(j), full.get(j)!));
    }
    const key = (i: number) => quantize(finals.get(i)!);
    return { head: [0, 1, 2, 3].map(key), tail: [key(nf - 3), key(nf - 2), key(nf - 1), quantize(nearestTo(finals.get(0)!, finals.get(nf - 1)!))] };
  }
  const worst = (into: { share: number; where: string }, at: Record<string, string>, share: (n: string) => number) => {
    for (const n of Object.keys(at)) {
      const x = share(n);
      if (x > into.share) [into.share, into.where] = [x, at[n]!];
    }
  };
  /** How sharply the legs and the torso turn on one grid's seam, and which. */
  function readBody(G: ReturnType<typeof torsoOf>): { share: number; where: string } {
    const out = { share: 0, where: "" }, X = new Float32Array(P * 3), { head, tail } = keysAbout(G), { headT, tailT } = timesOf(G);
    const pts = (k: Pose) => Float32Array.from(decodePose(rest, k as KeyLike, X));
    const H = head.map(pts), L = tail.map(pts), A = pts(sampleIn(head, headT, dts)), B = pts(sampleIn(tail, tailT, tB)), E = pts(sampleIn(tail, tailT, tE));
    worst(out, BODY_AT, (n) => turnOf(H.map((x) => pt(x, n)), L.map((x) => pt(x, n)), pt(A, n), pt(B, n), pt(E, n), headT, tailT, dts, scale(n)));
    return out;
  }
  let body: { share: number; where: string } | undefined;
  const handsRead = new Map<number, { share: number; where: string }>();
  return {
    /** How sharply the legs and the torso turn on the seam, the worst at any grid (or on the grid of `only` frames), and
     *  which. */
    body(only?: number): { share: number; where: string } {
      if (body && only === undefined) return body;
      const out = { share: 0, where: "" };
      for (const nf of only === undefined ? nfs : [only]) {
        const r = stageAt(nf).read;
        if (r.share > out.share) [out.share, out.where] = [r.share, r.where];
      }
      if (only === undefined) body = out;
      return out;
    },
    /** Whether nothing of the body turns on the seam past SEAM_TURN at any grid (body's, stopping at the first that does:
     *  the faster grids first, where the pelvis's whole-% steps read more). */
    fits(): boolean {
      return body ? body.share <= SEAM_TURN : [...nfs].reverse().every((nf) => stageAt(nf).read.share <= SEAM_TURN);
    },
    /** How sharply the hands turn on the seam swinging `swing` degrees either way, the worst at any grid (or on the grid
     *  of `only` frames), and which. */
    hands(swing: number, only?: number): { share: number; where: string } {
      const known = only === undefined ? handsRead.get(swing) : undefined;
      if (known) return known;
      const out = { share: 0, where: "" }, h = { ...g, swing };
      if (unpackedFeet.of !== stages) unpackedFeet = { of: stages, feet: new Map() };
      if (only === undefined) {
        handsRead.set(swing, out);
        bytes += READ_BYTES;
      }
      for (const nf of only === undefined ? nfs : [only]) {
        let B = unpackedFeet.feet.get(nf);
        if (!B) unpackedFeet.feet.set(nf, (B = unpacked(stageAt(nf).hands)));
        const { headT, tailT } = B;
        // each frame's arms at this swing as its key holds them: aimed from the shoulder the key decodes, the fist where
        // the arm reaches it (as reachTo does, to the float a clip's points hold), its direction and bend rounded twice
        // (snapLegs' rounding, then the key's), from the fist as the encoder reads it
        const arms = new Map<number, Record<Side, number[]>>(), pts = new Map<number, Record<string, V3>>();
        for (const f of B.frames) {
          const a = {} as Record<Side, number[]>;
          for (const s of ["L", "R"] as const) {
            const sh = f.shX[s], [la, lb] = lengths[s], toT = sub(handAim(h, s, f.phase, sh, d.armLen), sh), dT = Math.max(1e-6, len(toT));
            const reach = add(sh, mul(mul(toT, 1 / dT), Math.min(Math.max(dT, Math.abs(la - lb) + 1e-3), (la + lb) * REACH))), fist = reach.map((x) => Math.fround(x));
            const v = loc(f.RC, sub(fist, f.shRaw[s]));
            a[s] = roundLimb(roundLimb([...norm([v[0], v[1] * SG[s], v[2]]).map((x) => x * 100), bendOf(len(v), rest.up, lower), 0]));
          }
          arms.set(f.i, a);
        }
        // the hands' points as the decoder places them (a key without hand fields): each fist where its arm reaches, the
        // index and pinky points 20 mm either side of it across the chest (RC: the chest's turn)
        const place = (RC: Frame, sh: Record<Side, V3>, a: Record<Side, number[]>): Record<string, V3> => {
          const o: Record<string, V3> = {};
          for (const s of ["L", "R"] as const) {
            const fist = limbEnd(sh[s], RC, norm(a[s]), s, reachOf(a[s][3] || 0, rest.up, lower));
            o[`fist${s}`] = fist;
            o[`index${s}`] = add(fist, mul(RC[1], 20));
            o[`pinky${s}`] = add(fist, mul(RC[1], -20));
          }
          return o;
        };
        const nfG = B.nf, headI = [0, 1, 2, 3], tailI = [nfG - 3, nfG - 2, nfG - 1, 0];
        for (const f of B.frames) pts.set(f.i, place(f.keyRC, f.shKey, arms.get(f.i)!));
        const lerp = (K: number[], at: { i: number; u: number; RC: Frame; sh: Record<Side, V3> }) => {
          const a = arms.get(K[at.i]!)!, b = arms.get(K[at.i + 1]!)!;
          return place(at.RC, at.sh, { L: a.L.map((x, j) => x + (b.L[j]! - x) * at.u), R: a.R.map((x, j) => x + (b.R[j]! - x) * at.u) });
        };
        const H = headI.map((i) => pts.get(i)!), L = [...tailI.slice(0, 3).map((i) => pts.get(i)!), place(B.closing.RC, B.closing.sh, arms.get(0)!)];
        const [A, Bf, E] = [lerp(headI, B.after), lerp(tailI, B.before), lerp(tailI, B.end)];
        worst(out, HANDS_AT, (n) => turnOf(H.map((x) => x[n]!), L.map((x) => x[n]!), A[n]!, Bf[n]!, E[n]!, headT, tailT, dts, scale(n)));
      }
      return out;
    },
    /** Gait g's frames on a grid of nf (gridOf), the one the clip is made on among them. */
    grid: (nf: number): Grid => (nfs.includes(nf) ? gridOf(g, S, d, nf, false, placesAt(nf)) : gridOf(g, S, d, nf)),
    /** The keys about the seam on a grid of nf, as the clip holds them (its arms' twist aside, and its arms as the gait
     *  this was first made for swings them): the seam's and the three after it, the three before it and the closing one. */
    keys: (nf: number): { head: Pose[]; tail: Pose[] } => keysAbout(torsoOf(nf, false, placesAt(nf))),
    /** About how many bytes what has been read so far holds, on the heap and in array buffers: each grid's places and
     *  hands' footing as kept, STAGE_BYTES more for each grid read, and READ_BYTES for each swing's hands read. */
    bytes: (): number => bytes,
  };
}
/**
 * seamOf's readings kept, on any rest, while what they hold comes to SEAM_BYTES or less (each its bytes(), within 10%
 * over what it holds on the heap and in array buffers after a forced gc: a 3 s gait's 0.26 MB, a preset's about 0.07),
 * the one read longest ago dropped first: fitGait reads a gait's seam and gaitClip reads it again, at each rate it is
 * made at, and fitting tries a speed and its swings more than once. Each is found by the rest (each rest object its own
 * number), the gait's numbers but its swing (which only the hands' reading takes, as asked), and the start pose's. A
 * reading is the same however often it is made, so what is kept changes only the time. Round 12 kept 32 a rest for as
 * long as the rest lived, with each grid's frames and keys: 40 gaits of 3 s on one rest held 157 MB (heap and array
 * buffers), the presets fitted and made on the 64 library rests 298 MB, and a process making them on about 100 rests
 * ran out of a 3 GB heap (round 14's second pass's review). The close-out kept the 32 read last on any rest, each grid
 * only what is read again (19, 12, and 15 MB on all 104 bodies in one process: the presets fitted, asked at their speed
 * and at 1,000, and made at 55, 65 and 75, and four 3 s gaits each, 2,904 clips), but a gait made after more than 32
 * other readings since its fit was read again: the four presets asked 1,000 fitted on 31 library rests, then the 124
 * made at 60, 74 ms a make against 23 before the close-out (its review). Kept by what they hold (16 MB: some 225
 * presets' readings, or 57 of 3 s gaits), each grid's hands' footing packed (handsBase), they hold 13, 23 and 19 MB;
 * that order makes at 23 ms (23 before the close-out; rest by rest 25 against 24); every clip and refusal is the same
 * to the hash (the presets' 5,824 makes on the 104 bodies, 7,072 grid gaits); and fitGait and gaitClip are 8% quicker
 * than before the close-out (75.1 against 81.6 ms a fit and 49.6 against 54.0 a make over those grid gaits, four
 * processes at once, run base, new, new, base) and as quick as its first bound. A gait made after more than 16 MB of
 * other readings since its fit (more than about 225 presets fitted, or 57 gaits of 3 s, before any is made) is still
 * read again, and in that order each reading read again drops the next one wanted: the 64 library rests' 256 presets so
 * made at 76 ms a make against 25 before the close-out.
 */
const SEAMS = new Map<string, ReturnType<typeof seamOf>>(), SEAM_BYTES = 16e6, STAGE_BYTES = 1500, READ_BYTES = 150, REST_IDS = new WeakMap<Rest, number>();
let restIds = 0;
function seamAt(g: Gait, rest: Rest, S: Float32Array, start: Pose | undefined, d: Drawn): ReturnType<typeof seamOf> {
  let id = REST_IDS.get(rest);
  if (id === undefined) REST_IDS.set(rest, (id = restIds++));
  const key = JSON.stringify([id, g.speed, g.cycle, g.stance, g.lift, g.bounce, g.dip, g.sway, g.lean, g.limp, start ?? null]);
  let m = SEAMS.get(key);
  if (m) SEAMS.delete(key);
  else m = seamOf(g, rest, S, start, d);
  SEAMS.set(key, m);
  let kept = 0;
  for (const x of SEAMS.values()) kept += x.bytes();
  for (const [k, x] of SEAMS) {
    if (kept <= SEAM_BYTES || x === m) break;
    kept -= x.bytes();
    SEAMS.delete(k);
  }
  return m;
}
/**
 * How gait g stands on the body whose points S are (its start pose, `start`; the standing one by default): each foot's
 * numbers (feetOf), the lift (mm), how far the pelvis is lowered (mm), the shortest any leg is drawn at any phase, hip to
 * ankle, of its length (`fold`), the lowest any knee can be over the floor, mm (`knee`), and how sharply its points turn
 * on the loop's seam (`seam`: seamOf; its body's, and its hands' at any swing).
 */
export function legsOf(g: Gait, rest: Rest, S: Float32Array, start?: Pose) {
  const b = bodyOf(rest, S), pct = rest.H0 / 100, leg = b.legUpper + b.legLower, lift = (g.lift ?? 12) * pct, limp = g.limp ?? 0;
  const feet = feetOf(g, pct, leg), { landL, stanceOf, offOf, strideOf, upOf, reach } = feet;
  // the pelvis low enough for a leg to reach the stance's ends (half a stride ahead and behind) a little bent
  // (the stance's ends, and a little past them as the foot lifts off and sets down still in the world)
  const high = pt(S, "hipR")[2] - pt(S, "ankleR")[2], reachable = Math.sqrt(Math.max(0, (0.985 * leg) ** 2 - reach ** 2));
  // and low enough that no leg reaches past 98.5% of its length at any phase: the bounce lifts the pelvis twice a
  // cycle, and where it does with a foot far ahead or behind (a stance of a half, a fast stride), a leg lowered only for
  // the stance's ends was driven straight and its knee popped (D71, round 6). Counted as the clip will hold it: the
  // pelvis swaying, and put on the format's grid (whole % of H0), so up to half a % higher, further along and further
  // across than drawn (uncounted, a written leg read up to 99.3%; D71, round 7)
  let dip = Math.max((g.dip ?? 2) * pct, high - reachable);
  const legs = ([["R", 0], ["L", 1 - landL]] as const).map(([s, off]) => ({ s, off, ahead: pt(S, `ankle${s}`)[0] - pt(S, `hip${s}`)[0], side: pt(S, `ankle${s}`)[1] - pt(S, `hip${s}`)[1], under: pt(S, `hip${s}`)[2] - pt(S, `ankle${s}`)[2], hip: pt(S, `hip${s}`)[2], ankle: pt(S, `ankle${s}`)[2] }));
  // each phase's leg, for its fold and knee once the dip is known: how far the ankle is ahead or behind and across, the
  // grid's half % taken off each, and the hip's height over it but for the dip, the limp's drop counted (it lowers the
  // pelvis while the right foot swings); and the same signed, with the hip's and the ankle's heights over the floor
  const near: [number, number, number][] = [], knees: [number, number, number, number][] = [];
  for (let k = 0; k < 240; k++) {
    const phase = k / 240, raise = -(g.bounce ?? 1.5) * pct * PM.cos(4 * Math.PI * (phase - 0.08)), sway = (g.sway ?? 2) * pct * PM.cos(2 * Math.PI * (phase - g.stance / 2));
    const vL = (phase + 1 - landL) % 1, drop = vL < stanceOf.L ? -4 * limp * pct * PM.sin((Math.PI * vL) / stanceOf.L) : 0;
    for (const { s, off, ahead, side, under, hip, ankle } of legs) {
      const [fwd, up] = footAt((phase + off) % 1, stanceOf[s], strideOf[s], lift, UP * pct, upOf[s], CLEAR * pct, offOf[s]);
      const along = Math.abs(ahead + fwd) + pct / 2, across = Math.abs(side - sway) + pct / 2;
      dip = Math.max(dip, under + raise + pct / 2 - up - Math.sqrt(Math.max(0, (0.985 * leg) ** 2 - along ** 2 - across ** 2)));
      near.push([Math.max(0, along - pct), Math.max(0, across - pct), under + raise + drop - up]);
      knees.push([ahead + fwd, side - sway, hip + raise + drop, ankle + up]);
    }
  }
  // and no leg folded shut: the shortest, counted as the clip will hold it (the pelvis up to half a % lower, nearer
  // along and across than drawn)
  let fold = Infinity;
  for (const [along, across, over] of near) {
    const vertical = Math.max(0, Math.abs(over - dip) - pct / 2);
    fold = Math.min(fold, Math.sqrt(along * along + across * across + vertical * vertical) / leg);
  }
  // and the lowest knee: the pelvis half a % lower, and half a % either way along and across; weighed when first asked
  // for (legsFit asks only where the reach and the fold fit)
  let knee: number | undefined;
  const kneeOf = () => {
    let low = Infinity;
    for (const [ax, ay, hz, az] of knees) {
      const h = hz - dip - pct / 2;
      for (let ex = -1; ex <= 1; ex++) for (let ey = -1; ey <= 1; ey += 2) low = Math.min(low, kneeLow(h, ax + (ex * pct) / 2, ay + (ey * pct) / 2, az - h, b.legUpper, b.legLower));
    }
    return low;
  };
  // and how sharply its points turn on the loop's seam, weighed when first asked for (legsFit asks only where the rest
  // fits)
  const drawn: Drawn = { ...feet, pct, lift, limp, dip, leg, thigh: b.legUpper, shin: b.legLower, armLen: b.armUpper + b.armLower };
  let seam: ReturnType<typeof seamOf> | undefined;
  return {
    ...drawn, fold,
    get knee(): number {
      return (knee ??= kneeOf());
    },
    get seam(): ReturnType<typeof seamOf> {
      return (seam ??= seamAt(g, rest, S, start, drawn));
    },
  };
}
/** Whether gait g plays on the body S (from `start`) as far as its legs and torso go: its feet reach no farther than
 *  STRIDE_MAX of a leg, no leg folds under FOLD_MIN of its length, no knee goes under KNEE_FLOOR, and (unless `seam` is
 *  false) nothing of its body turns on the loop's seam past SEAM_TURN of the level the sensors fail it at. */
const legsFit = (g: Gait, rest: Rest, S: Float32Array, start?: Pose, seam = true) => {
  const l = legsOf(g, rest, S, start);
  return l.reach <= STRIDE_MAX * l.leg && l.fold >= FOLD_MIN && l.knee >= KNEE_FLOOR && (!seam || l.seam.fits());
};
/** The highest whole lift (% of the hip height) up to g's at which g plays on the body S as far as its legs go
 *  (legsFit), or under UP (9) if none does. */
function highestLift(g: Gait, rest: Rest, S: Float32Array, start?: Pose): number {
  let lift = Math.floor(g.lift ?? 12);
  while (lift >= UP && !legsFit({ ...g, lift }, rest, S, start)) lift--;
  return lift;
}
/**
 * How `fitGait` fits gait g's legs to the body S: at its own lift, then at each whole lift under it, the fastest whole
 * speed up to its own at which it plays there: the fastest its reach takes (the reach is monotone in the speed, so
 * halved) and its pace (checkGait's SWING_SPEED, the body's and the lift's alike: fitted to the legs alone, the limp
 * asked 300 on CMU_91's rest was given back at 121, where its feet come forward at 403%, and refused, as it was asked
 * 300 or 1,000 on 9 of the 104 rests, and 346 of 2,912 long stances' fits asked 1,000: round 14's review), then under
 * that the fastest its fold and knee take, found by halving, and each whole speed above that one tried too, the reach,
 * fold and knee first and the seam only where they fit (the fold and the knee aren't monotone in the speed: test
 * character 1's limping run lifting 35 plays at 215 and 217 but not 216 nor 218 to 368, and the halving, stopping at
 * 215, fitted asking 218 to 368 to 215: round 13's review; and a gait may play only between two speeds, test character
 * 15 lifting 35 at 109 to 157, where the halving finds none: round 9's review), then from the halving's speed each
 * whole speed down until nothing of its body turns on the loop's seam past SEAM_TURN (that share rises and falls with
 * the speed, as a knee turns round between two keys of a grid or doesn't). The first lift at which some speed plays is
 * taken, with that speed, or nothing where none from 9 up to its own does. So the speed is the fastest whole one at or
 * under the one asked that plays at that lift (gaitClip taking it: its pace too), and the lift the highest whole one at
 * which the gait plays at all: asking a faster speed or a higher lift never gives back a slower one or a lower one
 * (round 12's review: test character 25's limp asking 34 played at 215 lifting 34 but asking 35 at 328 lifting 9). A
 * halving that stops under a faster whole speed that plays is rare: round 14's fresh grids' 9,820 fits (9,476 slowed,
 * 637 swings narrowed, no lift lowered) and ladders of 16 asked speeds for 150 limping runs lifting 28 to 35 on test
 * characters (2,400 fits) fit as round 13's did, each ladder never falling, at 65 ms a fit on average against 64 (0.77
 * s at most, a 2.1 s cycle, four grids running at once on four cores); test character 1's is the review's.
 */
function fitOf(g: Gait, rest: Rest, S: Float32Array, start?: Pose): { speed: number; lift?: number } | undefined {
  const pct = rest.H0 / 100, b = bodyOf(rest, S), leg = b.legUpper + b.legLower, own = g.lift ?? 12;
  // the reach first (it needs no phase sampled, nor the lift), and the pace (checkGait's: neither the body's nor the
  // lift's), each monotone in the speed, then the rest of legsFit under them
  const inReach = feetOf(g, pct, leg).reach <= STRIDE_MAX * leg ? g : { ...g, speed: fastest(g, (x) => feetOf(x, pct, leg).reach <= STRIDE_MAX * leg) };
  const reached = paceOf(inReach) <= SWING_SPEED ? inReach : { ...g, speed: paceSpeed(g) };
  const cheap = (x: Gait) => legsFit(x, rest, S, start, false), plays = (x: Gait) => legsFit(x, rest, S, start);
  for (let lift = own; lift >= UP; lift = lift > Math.floor(lift) ? Math.floor(lift) : lift - 1) {
    const at = lift === own ? reached : { ...reached, lift }, v0 = cheap(at) ? at.speed : fastest(at, cheap), done = (v: number) => (lift === own ? { speed: v } : { speed: v, lift });
    // any faster whole speed up to its own at which it plays (the reach, fold and knee first, the seam only where they
    // fit): the fold and the knee aren't monotone in the speed, so the halving can stop under a speed that plays (test
    // character 1's limping run lifting 35 plays at 217 but not 216 nor 218 to 368, and was fitted to 215 asking 218 to
    // 368: round 13's review), or find none where it plays only between two speeds (test character 15 lifting 35: 109 to
    // 157)
    for (let w = Math.floor(at.speed); w > v0; w--) if (cheap({ ...at, speed: w }) && plays({ ...at, speed: w })) return done(w);
    // the seam's turn rises and falls with the speed (where a knee turns round between two keys of a grid), so from the
    // fastest the rest takes, each whole speed down is tried
    let v = v0;
    if (v > 0 && !plays({ ...at, speed: v })) for (v = Math.ceil(v0) - 1; v > 0 && !plays({ ...at, speed: v }); ) v--;
    if (v > 0) return done(v);
  }
  return undefined;
}
/**
 * How sharply gait g's hands turn on the loop's seam on the body S at its swing, read so that a narrower swing never
 * reads more: the most at any whole swing from 0 up to its own, and its own (seamOf's hands at each). Each swing's own
 * reading rises and falls with it (the arm's direction, held in hundredths, rounds one way or the other on the seam's
 * frames): test character 9's run at 0.622 s played swinging 69 and 69.5° and was refused at 64 to 68 (round 11's
 * review), so a refusal's "at most 69" was false. The count ends at the first whole swing past SEAM_TURN; `widest` is the
 * whole swing before it.
 */
function handsOf(g: Gait, l: ReturnType<typeof legsOf>): { share: number; where: string; widest?: number } {
  const swing = g.swing ?? 25;
  let worst = { share: 0, where: "" }, widest: number | undefined;
  for (let w = 0; w <= swing; w++) {
    const h = l.seam.hands(w);
    if (h.share > worst.share) worst = h;
    if (worst.share > SEAM_TURN) return { ...worst, widest };
    widest = w;
  }
  if (swing !== Math.floor(swing)) {
    const h = l.seam.hands(swing);
    if (h.share > worst.share) worst = h;
  }
  return { ...worst, widest };
}
/**
 * How fitGait fits gait g to the body S (from `start`): its legs (fitOf: its speed, and its lift where no speed plays at
 * its own), then its hands at that speed (the widest whole swing up to its own at which they, and every narrower whole
 * swing, keep from turning on the seam past SEAM_TURN). `gait` is g itself where nothing needs changing (and where no
 * speed and lift play); `legs` is false where no speed and lift play, `swing` true where its swing was narrowed, and
 * `plays` false where its hands turn past it at every swing (its legs fitted, its swing as given).
 */
function fitWith(g: Gait, rest: Rest, S: Float32Array, start?: Pose): { gait: Gait; legs: boolean; swing: boolean; plays: boolean } {
  const legs = paceOf(g) <= SWING_SPEED && legsFit(g, rest, S, start) ? g : fitOf(g, rest, S, start);
  if (legs === undefined) return { gait: g, legs: false, swing: false, plays: false };
  const f = legs === g ? g : { ...g, ...legs }, h = handsOf(f, legsOf(f, rest, S, start));
  if (h.share <= SEAM_TURN) return { gait: f, legs: true, swing: false, plays: true };
  return h.widest === undefined ? { gait: f, legs: true, swing: false, plays: false } : { gait: { ...f, swing: h.widest }, legs: true, swing: true, plays: true };
}
/** What fits gait g to the body S, as a refusal says it: the whole of what fitGait would make of it (its speed, its lift
 *  where lowered, its swing where narrowed), which plays; and what else to change (`or`). */
function fitText(g: Gait, rest: Rest, S: Float32Array, start: Pose | undefined, or: string): string {
  const { gait: f, legs, swing, plays } = fitWith(g, rest, S, start), at = (v: number) => `${v}% of the hip height a second (${Math.round((v * rest.H0) / 100)} mm/s)`;
  const own = g.lift ?? 12, lowered = (f.lift ?? 12) !== own, lead = "on these legs, at this cycle and stance,";
  if (!legs) return `${lead} it plays at no speed lifting ${own}% of the hip height or anything down to ${UP}%; ${or}`;
  const speed = lowered ? `at no speed lifting ${own}% of the hip height, and at ${at(f.speed)} lifting ${f.lift}%` : `at ${at(f.speed)}`;
  if (!plays) return `${lead} its legs play ${speed}, but its hands turn round on the loop's seam there at any swing; ${or}`;
  const what = ["slow it", ...(lowered ? ["lower its lift"] : []), ...(swing ? ["narrow its swing"] : [])];
  return `${lead} it plays ${speed}${swing ? `, its arms swinging ${f.swing}° either way` : ""}; ${what.length > 1 ? `${what.slice(0, -1).join(", ")} and ${what.at(-1)}` : what[0]} so (fitGait does), or ${or}`;
}
/**
 * A gait fitted to a body: its speed lowered, if it must be, to the fastest whole % of the hip height a second at which
 * `gaitClip` takes it on `rest`'s legs, standing: its feet come forward past the hips no faster than 400% of the hip
 * height a second (on any body: checkGait's), reach no farther ahead and behind than 72% of a leg, no leg folds under
 * 25% of its length (a run at a short stance, lifting high and bouncing, folded shut at the reach bound), no knee goes
 * under the floor (the same lifting low: a trailing knee bent down through it), and nothing of its body turns on the
 * loop's seam past SEAM_TURN (a run's knee as its left foot comes forward there, the pelvis's whole-% steps); its other
 * numbers as given. The presets are drawn for a person's proportions: on a short-legged or heavy body the run and the
 * brisk walk reach past that (of the 20 test characters, the run fits only the tall ones and the brisk walk all but the
 * chibis and two bulky ones; the walk and the limp fit all), and this plays them there, a little slower (the run at 301
 * to 349, brisk at 153 to 169; all 80 pass the sensors: D71, round 7): `gaitClip(fitGait(GAITS[2], rest), rest, opts)`.
 * Where no speed plays at the lift given (a short-legged body lifting high, bouncing and dipping folds a leg at any
 * speed) it lowers the lift to the highest whole one at which some speed plays, at the fastest speed there; then, where
 * its hands turn round on the seam past SEAM_TURN at that speed, it narrows the arms' swing to the widest whole degree
 * at which they and every narrower whole swing don't. So where any speed and lift from 9 up to the gait's play, and a
 * swing from 0 up to its own, it gives back one that does; a lower whole lift or a narrower whole swing asked for is
 * never fitted higher or wider, and a slower whole speed never faster (at each lift the fastest whole speed up to the
 * one asked that plays: see fitOf). That holds over whole numbers: a gait that fits is given back as it is, a
 * fractional speed, lift or swing among them, so where one asked a fraction more doesn't fit, it can be given back the
 * whole number under it, below the fraction that did (CMU_128's run asking 377.5 plays at 377.5, and asking 377.9 is
 * fitted to 377: round 12's review). One whose own numbers `gaitClip` refuses (a missing speed, a NaN) is given back as
 * it is, for it to refuse by the field, and so is one no speed and lift play, for it to say why.
 */
export function fitGait(g: Gait, rest: Rest): Gait {
  if (fieldProblem(g) !== undefined) return g;
  const start = standingOn(rest), S = new Float32Array(P * 3);
  decodePose(rest, start as KeyLike, S);
  const b = bodyOf(rest, S);
  if (!(b.legUpper + b.legLower > 0)) return g;
  return fitWith(g, rest, S, start).gait;
}

/** Whether pose p is pose q, field for field (anything but a pose, null among them, is not). */
const samePose = (p: unknown, q: Pose) => typeof p === "object" && p !== null && !Array.isArray(p) && [...new Set([...Object.keys(p), ...Object.keys(q)])].every((f) => JSON.stringify((p as Pose)[f]) === JSON.stringify(q[f]));
/**
 * A gait as a travelling loop on `rest`, one cycle, from the standing pose (`standingOn(rest)`): its legs, pelvis, torso
 * and arms are the gait's own, drawn on that body. A start pose other than the standing one is refused (`opts.start` is
 * a move's and an idle's): the frames took the start's points for the body's and carried its elbows, knees and hands'
 * articulation on, so a start with an arm bent or a hand turned put a forearm into the hips or a fist into the body as
 * the arms swung, or popped a wrist (8 of 227 library clips' first keys, each on its own rest, failed so; D71, round
 * 12's review), and nothing of a gait (fitGait, the bounds and their measurements) was ever fitted or measured from one.
 */
export function gaitClip(g: Gait, rest: Rest, opts: ProceduralOptions): Clip {
  checkGait(g);
  if (opts.fps !== undefined && !(typeof opts.fps === "number" && opts.fps >= MIN_GAIT_FPS && opts.fps <= MAX_GAIT_FPS)) throw new Error(`gait ${g.name}: made at ${typeof opts.fps === "number" ? String(opts.fps) : JSON.stringify(opts.fps)} frames a second, not ${MIN_GAIT_FPS} to ${MAX_GAIT_FPS}: fewer, a fast gait's seam steps too far between its frames; more, the pelvis's whole-% steps between them read as pops; use ${MIN_GAIT_FPS} to ${MAX_GAIT_FPS} (60 by default)`);
  if (opts.budget !== undefined && !(typeof opts.budget === "number" && opts.budget >= 0 && opts.budget <= GAIT_BUDGET)) throw new Error(`gait ${g.name}: a key budget of ${typeof opts.budget === "number" ? String(opts.budget) : JSON.stringify(opts.budget)} mm, not 0 to ${GAIT_BUDGET}: a gait's keys are kept within ${GAIT_BUDGET} mm of every frame it draws, the budget every bound it is fitted to is measured at, and with fewer the knees' swing and the pelvis's steps between them read as pops; leave it out (${GAIT_BUDGET}), or use 0 (every frame a key) to ${GAIT_BUDGET}`);
  const fps = opts.fps ?? 60, start = standingOn(rest), S = new Float32Array(P * 3);
  if (opts.start !== undefined && !samePose(opts.start, start)) throw new Error(`gait ${g.name}: given a start pose other than the standing one: a gait is made from the standing pose (standingOn(rest)), its legs, pelvis, torso and arms its own, and from another the start's bent arms and turned hands swing into the body; give it no start, and blend into it from another pose`);
  decodePose(rest, start as KeyLike, S);
  // the frames spread evenly over the cycle (to the ms), so the last is as far from the seam as from the one before:
  // on the rate's grid, a cycle off it would leave its seam a step of a few ms, and any difference there reads as a pop;
  // an even number of them, so a plain gait's left foot, half a cycle on, is seen at the very phases its right is (with
  // an odd number its knee fell between frames: a run of 0.65 s, 39 frames, popped the left knee on 10 of 64 rests)
  const pct = rest.H0 / 100, dur = Math.round(g.cycle * 1000) / 1000, nf = Math.max(2, 2 * Math.round((dur * fps) / 2));
  const legs = legsOf(g, rest, S, start), { leg, landL, stanceOf, offOf, upOf, reach, armLen } = legs;
  if (!(leg > 0)) throw new Error(`gait ${g.name}: the rest's legs have no length (${leg} mm, hip to ankle, standing): a gait needs legs to walk on`);
  // (the reach shown rounded up, and the fold and the knee down, so a number just past its bound never reads as at it;
  // each names what fitGait would make of it)
  if (reach > STRIDE_MAX * leg) throw new Error(`gait ${g.name}: its feet reach ${(Math.ceil((1000 * reach) / leg) / 10).toFixed(1)}% of a leg ahead and behind (half a stride and the set-down), past ${100 * STRIDE_MAX}%: ${fitText(g, rest, S, start, "shorten its cycle or stance")}`);
  if (legs.fold < FOLD_MIN) {
    const most = highestLift(g, rest, S, start), lifts = most >= UP ? ` (at this speed it lifts at most ${most}%)` : "";
    throw new Error(`gait ${g.name}: its swinging foot comes within ${(Math.floor(legs.fold * 1000) / 10).toFixed(1)}% of a leg of its hip, under ${100 * FOLD_MIN}%: the pelvis lowered for its stride and bounce, the leg folds shut and its knee pops or bends back as it swings through; ${fitText(g, rest, S, start, `lower its lift${lifts}, bounce or dip`)}`);
  }
  if (legs.knee < KNEE_FLOOR) throw new Error(`gait ${g.name}: a knee goes ${(Math.ceil((10 * -legs.knee) / pct) / 10).toFixed(1)}% of the hip height under the floor: the pelvis lowered for its stride and bounce, a leg trailing far behind bends its knee down through the floor as the foot swings back; ${fitText(g, rest, S, start, "shorten its cycle, or lower its bounce")}`);
  const body = legs.seam.body();
  if (body.share > SEAM_TURN) {
    const torsoed = !/knee|foot/.test(body.where);
    throw new Error(`gait ${g.name}: its ${body.where} ${torsoed ? "jolts" : "turns round"} on the loop's seam ${Math.ceil(100 * body.share)}% as sharply as the sensors read a hitch there, over ${100 * SEAM_TURN}% (${torsoed ? "the pelvis's whole-% steps either side of it" : "a run's left foot coming forward as the cycle ends and begins"}): ${fitText(g, rest, S, start, "use a longer cycle or another stance")}`);
  }
  const hands = handsOf(g, legs), failed = (hands.widest ?? -1) + 1;
  if (hands.share > SEAM_TURN) throw new Error(`gait ${g.name}: its ${hands.where} turns round on the loop's seam ${Math.ceil(100 * hands.share)}% as sharply as the sensors read a hitch there${(g.swing ?? 25) > failed ? ` swinging ${failed}°, narrower than its own swing` : ""}, over ${100 * SEAM_TURN}% (its arms turning round as the cycle ends and begins): ${hands.widest === undefined ? "on this body, at this cycle, it does so at any swing; use a longer cycle, or a lower bounce or sway" : `on this body, at this cycle, its arms play swinging any whole number of degrees up to ${hands.widest} either way; narrow its swing so (fitGait does), or use a longer cycle`}`);
  const grid = legs.seam.grid(nf), { times, drawn, hip } = grid;
  const t: Track = { dur, loop: true, fps, times, poses: [], roots: [], events: [], rest, restSrc: opts.restSrc, sources: [], cycle: { forward: g.speed * g.cycle, right: 0, yaw: 0 } };
  const limbs = new Limbs(S), T = new Float32Array(P * 3), piv = pt(S, "pelvis");
  /** The points, unrounded pose and root of frame i (the frame after the last: the seam's), and whether each foot is
   *  still in the world. */
  const frameAt = (i: number, hint: Pose) => {
    const p = i < nf ? drawn[i]! : grid.at(dur), { phase, rootF, behind } = p, X = Float32Array.from(S), stand = { L: false, R: false };
    // the pelvis on the format's grid before the feet are aimed, so rounding the keys moves no planted foot
    placeTorso(g, S, piv, X, phase, hip(i));
    onKeyTorso(rest, X, hint, T);
    // the feet
    for (const [s, off] of [["R", 0], ["L", 1 - landL]] as const) {
      const v = (phase + off) % 1, [fwd, up] = p.aim[s], a = pt(S, `ankle${s}`);
      // still in the world: standing, or rising or setting down straight
      const ws = (v - stanceOf[s]) / (1 - stanceOf[s]);
      stand[s] = v < stanceOf[s] || ws < upOf[s] || ws > 1 - offOf[s];
      // (a foot never reaches past STRIDE_MAX of a leg from the hips, so its knee never snaps straight)
      limbs.reach(X, `foot${s}`, [a[0] + fwd + behind, a[1], a[2] + up]);
    }
    // the arms swing against the legs: the left forward as the right foot is
    for (const s of ["R", "L"] as const) limbs.reach(X, `hand${s}`, handAim(g, s, phase, pt(X, `sh${s}`), armLen));
    const e = encodePose(rest, X, hint as KeyLike, { hands: hint.handL !== undefined || hint.handR !== undefined, round: false }), { t: _t, root: _r, yaw: _y, ...raw } = e;
    return { X, raw: raw as Pose, stand, rootF };
  };
  // each frame's points, unrounded pose and whether each foot is still in the world, for the second pass
  const frames: { X: Float32Array; raw: Pose; stand: Record<"L" | "R", boolean> }[] = [];
  let hint: Pose = start;
  for (let i = 0; i < nf; i++) {
    const f = frameAt(i, hint), pose = snapLegs(rest, f.raw, f.X);
    t.poses.push(pose);
    t.roots.push({ forward: f.rootF, right: 0, yaw: 0 } satisfies Root);
    frames.push(f);
    hint = pose;
  }
  // the loop closed: each knee is carried on from the frame before, so over a cycle its turn about the line from the
  // hip to the ankle drifts (3° on a walk, 8° on a run, 22° on a run lifting 35%), and the first frame, from the start
  // pose, doesn't meet the last. The frame after the last (the seam's, the knees carried on) says how far each leg's
  // twist drifted, and it is taken back a share at a time over the cycle: a turn about that line moves no ankle, so a
  // planted foot stays where it is (whole turns aside: they move nothing). The elbows come back: their swing retraces
  // itself.
  const after = frameAt(nf, hint).raw, turned = (d: number) => d - 360 * Math.round(d / 360);
  const drift = ["legL", "legR"].map((l) => [l, turned((after[l] as number[])[4]! - (frames[0]!.raw[l] as number[])[4]!)] as const).filter(([, d]) => Math.abs(d) > 1e-6);
  if (drift.length)
    frames.forEach((f, i) => {
      for (const [l, d] of drift) {
        const v = [...(f.raw[l] as number[])];
        v[4] = v[4]! - (d * times[i]!) / dur;
        f.raw[l] = v;
      }
      t.poses[i] = snapLegs(rest, f.raw, f.X);
    });
  // the second pass: while each foot is still in the world (set down, standing, lifting off), its ankle snapped to where
  // it was first rounded to over the floor (in the world, so in the root's frame it goes back as the root comes on),
  // not to where it ideally is: its rounding then wanders half as far over the contact
  const n = frames.length, Y = new Float32Array(P * 3), world = (i: number, p: V3, laps: number): V3 => [p[0] + (t.roots[i]!.forward + laps * t.cycle!.forward) * pct, p[1], p[2]];
  const goals: Partial<Record<"L" | "R", V3>>[] = frames.map(() => ({}));
  for (const s of ["L", "R"] as const)
    for (let i0 = 0; i0 < n; i0++) {
      if (!frames[i0]!.stand[s] || frames[(i0 + n - 1) % n]!.stand[s]) continue;
      decodePose(rest, t.poses[i0]! as KeyLike, Y);
      const landed = world(i0, pt(Y, `ankle${s}`), 0);
      for (let k = 1; k < n && frames[(i0 + k) % n]!.stand[s]; k++) {
        const j = (i0 + k) % n, lap = i0 + k >= n ? 1 : 0, here = world(j, [0, 0, 0], lap);
        goals[j]![s] = [landed[0] - here[0], landed[1], pt(frames[j]!.X, `ankle${s}`)[2]];
      }
    }
  frames.forEach((f, i) => {
    if (goals[i]!.L || goals[i]!.R) t.poses[i] = snapLegs(rest, f.raw, f.X, goals[i]);
  });
  const name = g.name.charAt(0).toUpperCase() + g.name.slice(1);
  // the contacts are the model's own: each foot down from its touchdown for its stance (the left's wrapping the seam)
  const at = (x: number) => Math.round(x * dur * 1000) / 1000, contacts: Contacts = { by: "labelled", footL: [[at(landL), at(landL + stanceOf.L)]], footR: [[0, at(stanceOf.R)]] };
  // (the frames about the seam kept as keys whatever the budget, so the sensors read there what seamOf reads)
  const seamKeys = Array.from({ length: SEAM_KEYS }, (_, k) => [k + 1, nf - 1 - k]).flat();
  return clipOfTrack(t, { id: opts.id ?? `PROCEDURAL/${name}`, name, tags: [g.stance < 0.5 ? "run" : "walk", "loop"], desc: g.about.charAt(0).toUpperCase() + g.about.slice(1), contacts }, opts.budget ?? GAIT_BUDGET, seamKeys);
}

