// The gait synthesizer (PLAN.md WP-6.2, D71), after riftlight's gaitClip (src/engine/animation/gait.ts, "zero foot
// slide by construction"): a walk or a run as a loop that travels, from its speed, cadence and stance. Each foot is
// planted in the world while it is in stance: in the root's frame it slides back at exactly the ground speed. In swing
// it lifts straight up past the height a lifted foot is read at, and sets straight down, still in the world, and
// travels forward between on a Hermite curve whose ends keep that speed, lifted on an arc that peaks before halfway: a
// foot near the floor never moves. The pelvis bobs twice a cycle and sways over the standing foot, the arms swing
// against the legs, and a limp shortens one leg's stance and drops the pelvis on it. The contacts are the model's own
// (each foot from its touchdown to its lift-off). The root and pelvis are put on the format's grid before the feet are
// aimed, and each planted leg's rounded numbers are chosen to keep its ankle within the format's rounding (a leg's
// direction is held in hundredths: about 4 mm) of where it landed, through the in-betweening too. A gait it can't play
// (a stride past the legs' reach, a swing under 0.2 s, or under 0.25 s lifting over 12%, or faster past the hips than 4
// hip heights a second, a run's cycle under 0.6 s (0.65 lifting over 25%), a number past the range the sensors pass,
// under 50 frames a second) is refused with what to change. The frames are spread evenly over the cycle, an even number
// of them, and each knee's turn about its leg, carried on from frame to frame, is closed over it, so the loop meets
// itself.
import { IDX, P, type Rest } from "../format/body.ts";
import { add, len, mul, qmul, qrot, sub, type Quat, type V3 } from "../format/math.ts";
import { decodePose, encodePose, type KeyLike } from "../format/pose.ts";
import type { Clip, Contacts } from "../format/types.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import type { Pose } from "../ops/pose.ts";
import { quantize } from "../recipe/compile.ts";
import type { Root, Track } from "../recipe/types.ts";
import { Limbs } from "./limbs.ts";
import { bodyOf, clipOfTrack, standingOn, type ProceduralOptions } from "./clip.ts";

/** A gait, in the format's units: speed and lengths in % of the hip height, angles in degrees, times in seconds. */
export interface Gait {
  name: string;
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
/** Hermite on 0..1 between p0 and p1 with slopes m0 and m1. */
const hermite = (s: number, p0: number, p1: number, m0: number, m1: number) => {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
};

/** The least share of the swing a foot spends lifting off and setting down, still in the world, and the least time:
 *  a fast gait's swing is short, and a rise quicker than a couple of frames reads as the foot dragging forward. */
const OFF = 0.1, RISE = 0.05;
/** The farthest a foot may reach ahead of or behind the hips (half a stride, and the set-down's lead), of a leg: a
 *  longer stride needs the pelvis so low the knees pop. */
const STRIDE_MAX = 0.75;
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
 * keep that speed, lifted on an arc to `lift` that peaks before halfway, and sets straight down from `landClear` in
 * the last `landOff`, still in the world again: so it is never near the floor while it moves, and a foot near the
 * floor never drifts.
 */
export function footAt(v: number, stance: number, stride: number, lift: number, clear = 0, off = OFF, landClear = clear, landOff = off): [number, number] {
  if (v < stance) return [stride / 2 - (stride * v) / stance, 0];
  const down = 1 - landOff, s = (v - stance) / (1 - stance), slope = (-stride * (1 - stance)) / stance, span = down - off, w = Math.min(1, Math.max(0, (s - off) / span));
  const x = s < off ? -stride / 2 + slope * s : s > down ? stride / 2 + slope * (s - 1) : hermite(w, -stride / 2 + slope * off, stride / 2 + slope * (down - 1), slope * span, slope * span);
  const up = Math.min(clear, lift), land = Math.min(landClear, lift);
  if (s < off) return [x, up * smooth(s / off)];
  if (s > down) return [x, land * smooth((1 - s) / landOff)];
  const c = up + (land - up) * smooth(w);
  return [x, c + (lift - c) * PM.sin(Math.PI * PM.pow(w, PEAK))];
}
/** The power that puts the lift's peak at 40% of the swing (0.4^PEAK = 0.5). */
const PEAK = PM.log(0.5) / PM.log(0.4);
/** 0 to 1 with zero slope and curvature at both ends (the foot's rise has no kick). */
const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/**
 * A pose rounded as a key is (quantize), its legs' numbers each chosen from the whole numbers about their roundings to
 * land the ankles nearest where the points X have them, or the `goals` given: a leg's direction is held in hundredths,
 * so a planted ankle can't land closer than about 4 mm to any one place; given where it landed, it stays within that
 * of it.
 */
export function snapLegs(R: Rest, p: Pose, X: Float32Array, goals: Partial<Record<"L" | "R", V3>> = {}): Pose {
  const out = quantize(p), Y = new Float32Array(P * 3);
  for (const s of ["L", "R"] as const) {
    const f = `leg${s}`, raw = p[f] as number[], goal = goals[s] ?? pt(X, `ankle${s}`), base = out[f] as number[];
    const miss = (v: number[]) => (decodePose(R, { ...out, [f]: v } as KeyLike, Y), len(sub(pt(Y, `ankle${s}`), goal)));
    let best = base, err = miss(base);
    // the four numbers that place the ankle (direction and bend), each its rounding or a whole number either side
    // (each as a key holds it: quantize scales a direction to 100 again, so a candidate is judged as it will be written)
    for (let m = 0; m < 81; m++) {
      const v = quantize({ [f]: raw.map((x, i) => (i < 4 ? Math.round(x) + (Math.floor(m / [1, 3, 9, 27][i]!) % 3) - 1 : base[i]!)) })[f] as number[];
      const e = miss(v);
      if (e < err) [best, err] = [v, e];
    }
    out[f] = best;
  }
  return out;
}

/**
 * The ranges a gait's own numbers are taken in: those the sensors pass on every preset on three rests (D71); past them
 * a run's knees pop (a lift of 40, a sway of 5).
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
 * (core's contact bands, the sensors' too), and in a swing under 0.19 s it is up above their 7% for less than that.
 */
const MIN_SWING = 0.2;
/**
 * The fastest a swinging foot may come forward past the hips, % of the hip height a second (its stride over its swing:
 * the speed times its stance over its swing, whatever the cycle): at 420 a long stance's knee pops mid-swing on some
 * bodies (stance 0.75 at 140: 13 of 128 clips, on 12 rests); at 402 and under none did (D71, round 3). Measured on walks
 * and limps (stances of 0.62 to 0.75); a run's feet, standing under half the cycle, come forward slower than the body goes,
 * so it reaches the cap only past 400% of the hip height a second (at stance 0.3, past 930%), where no run was measured.
 */
const SWING_SPEED = 400;
/** A lift over 12 (% of the hip height) needs a swing this long, s: lifting 20 or more in 0.2 to 0.22 s, a knee pops on
 *  most bodies; at 0.25 s and longer none did, up to 35 (D71, round 4). */
const HIGH_LIFT_SWING = 0.25;
/** A run's (a stance under half the cycle's) shortest cycle, s, and lifting over 25: under it its feet move too sharply
 *  between frames, and its seam and knees pop (D71, round 4). */
const MIN_RUN_CYCLE = 0.6, MIN_HIGH_RUN_CYCLE = 0.65;
/** The fewest frames a second a gait is made at: fewer, a fast gait's seam steps too far between them (D71, round 4). */
const MIN_GAIT_FPS = 50;
/** A gait's numbers checked: in range, and each foot given time to swing (a limp's strong foot most of all). */
export function checkGait(g: Gait): void {
  const bad = (what: string) => {
    throw new Error(`gait ${g.name}: ${what}`);
  };
  if (!(g.speed > 0 && g.speed <= 1000)) bad(`speed ${g.speed} is not above 0 and at most 1000 (% of the hip height a second)`);
  if (!(g.cycle >= 0.3 && g.cycle <= 3)) bad(`cycle ${g.cycle} is not 0.3 to 3 s`);
  if (!(g.stance >= 0.2 && g.stance <= 0.75)) bad(`stance ${g.stance} is not 0.2 to 0.75 of the cycle`);
  const limp = g.limp ?? 0;
  if (!(limp >= 0 && limp <= 1)) bad(`limp ${limp} is not 0 to 1`);
  for (const [k, lo, hi, why] of RANGES) {
    const v = g[k] as number | undefined;
    if (v !== undefined && !(v >= lo && v <= hi)) bad(`${k} ${v} is not ${lo} to ${hi}${k === "lean" || k === "swing" ? " degrees" : " (% of the hip height)"}${why ? `: ${why}` : ""}`);
  }
  // the right foot stands from 0 to its lift-off, the left for its shortened stance (gaitClip's numbers)
  const both = g.stance - 0.5, right = 1 - g.stance * (1 - 0.3 * limp) + 2 * both, left = g.stance * (1 - 0.3 * limp);
  if (right > 0.85) bad(`a limp of ${limp} on a stance of ${g.stance} leaves the right foot ${Math.round((1 - right) * 100)}% of the cycle to swing: use a shorter stance or a lighter limp`);
  const swingT = Math.min(1 - right, 1 - left) * g.cycle;
  const foot = limp > 0 ? "its right foot swings" : "its feet swing";
  if (swingT < MIN_SWING) bad(`${foot} for ${swingT.toFixed(3)} s, under ${MIN_SWING} s: a foot up for under 0.1 s reads as never leaving the floor; use a longer cycle, a shorter stance${limp > 0 ? " or a lighter limp" : ""}`);
  const lift = g.lift ?? 12;
  if (lift > 12 && swingT < HIGH_LIFT_SWING) bad(`${foot} for ${swingT.toFixed(3)} s, lifting ${lift}% of the hip height: a lift over 12 needs a swing of ${HIGH_LIFT_SWING} s or more (a knee pops lifting higher in less); use a lower lift, a longer cycle or a shorter stance`);
  const least = lift > 25 ? MIN_HIGH_RUN_CYCLE : MIN_RUN_CYCLE;
  if (g.stance < 0.5 && g.cycle < least) bad(`a run's cycle of ${g.cycle} s${lift > 25 ? `, lifting ${lift}% of the hip height,` : ""} is under ${least} s (over ${Math.round(120 / least)} steps a minute): its feet move too sharply between frames, and its seam and knees pop; use a longer cycle${lift > 25 ? " or a lift of 25 or less" : ""}`);
  // (the right foot stands at least as long as the left, so it is the faster forward)
  const pace = (g.speed * right) / (1 - right);
  if (pace > SWING_SPEED) bad(`${limp > 0 ? "its right foot comes" : "its feet come"} forward past the hips at ${Math.round(pace)}% of the hip height a second, over ${SWING_SPEED}: a knee pops mid-swing on some bodies; use a lower speed or a shorter stance${limp > 0 ? " or a lighter limp" : ""}`);
}

/** The gaits the library offers ready made: an easy walk, a brisk one, a run and a limp. */
export const GAITS: readonly Gait[] = [
  { name: "walk", about: "an easy walk, arms swinging a little", speed: 130, cycle: 1.1, stance: 0.6 },
  { name: "brisk", about: "a brisk walk, a longer stride and a bigger arm swing", speed: 170, cycle: 1.0, stance: 0.58, swing: 35 },
  { name: "run", about: "a run, leaning in, with a flight between steps", speed: 350, cycle: 0.7, stance: 0.35, lift: 25, bounce: 3, lean: 8, swing: 45 },
  { name: "limp", about: "a slow limp, favouring the left leg", speed: 90, cycle: 1.3, stance: 0.62, limp: 0.8 },
];

/** A gait as a travelling loop on `rest`, one cycle, from the standing pose (or `opts.start`). */
export function gaitClip(g: Gait, rest: Rest, opts: ProceduralOptions): Clip {
  checkGait(g);
  if (opts.fps !== undefined && !(opts.fps >= MIN_GAIT_FPS)) throw new Error(`gait ${g.name}: made at ${opts.fps} frames a second, under ${MIN_GAIT_FPS}: a fast gait's seam steps too far between its frames; use ${MIN_GAIT_FPS} or more (60 by default)`);
  const fps = opts.fps ?? 60, start = opts.start ?? standingOn(rest), S = new Float32Array(P * 3);
  decodePose(rest, start as KeyLike, S);
  // the frames spread evenly over the cycle (to the ms), so the last is as far from the seam as from the one before:
  // on the rate's grid, a cycle off it would leave its seam a step of a few ms, and any difference there reads as a pop;
  // an even number of them, so a plain gait's left foot, half a cycle on, is seen at the very phases its right is (with
  // an odd number its knee fell between frames: a run of 0.65 s, 39 frames, popped the left knee on 10 of 64 rests)
  const b = bodyOf(rest, S), pct = rest.H0 / 100, dur = Math.round(g.cycle * 1000) / 1000, nf = Math.max(2, 2 * Math.round((dur * fps) / 2));
  const times = Array.from({ length: nf }, (_, i) => Math.round((i * dur * 1000) / nf) / 1000);
  const lift = (g.lift ?? 12) * pct, limp = g.limp ?? 0;
  // the right foot lands at phase 0 and the left at landL; a limp's weak left leg stands for less, landing late enough
  // and the right standing long enough that each hand-over keeps the plain gait's double support (none in a run)
  const both = g.stance - 0.5, stanceL = g.stance * (1 - 0.3 * limp), landL = 1 - stanceL + both, stanceOf = { L: stanceL, R: landL + both };
  // each foot's rise and set-down: a tenth of its swing, and no less than RISE s
  const offOf = { L: Math.min(0.3, Math.max(OFF, RISE / ((1 - stanceOf.L) * g.cycle))), R: Math.min(0.3, Math.max(OFF, RISE / ((1 - stanceOf.R) * g.cycle))) };
  // each foot covers the ground speed times its own stance while it stands
  const strideOf = { L: g.speed * pct * stanceOf.L * g.cycle, R: g.speed * pct * stanceOf.R * g.cycle };
  // each foot's lift-off: up to UP in RISE_UP s, its share of the swing no more than a short swing or a trailing leg
  // allows (then up to UP quicker)
  const leg = b.legUpper + b.legLower;
  const upFor = (x: "L" | "R") => {
    const swingT = (1 - stanceOf[x]) * g.cycle, trail = ((TRAIL * leg - strideOf[x] / 2) * stanceOf[x]) / (strideOf[x] * (1 - stanceOf[x]));
    return { off: Math.max(offOf[x], Math.min(0.3, RISE_UP / swingT, trail)), clear: UP };
  };
  const upL = upFor("L"), upR = upFor("R"), upOf = { L: upL.off, R: upR.off }, upClear = { L: upL.clear, R: upR.clear };
  const armLen = b.armUpper + b.armLower, piv = pt(S, "pelvis");
  // the pelvis low enough for a leg to reach the stance's ends (half a stride ahead and behind) a little bent
  // (the stance's ends, and a little past them as the foot lifts off and sets down still in the world)
  const reach = Math.max(...(["L", "R"] as const).map((x) => strideOf[x] / 2 + (strideOf[x] * (1 - stanceOf[x]) * Math.max(offOf[x], upOf[x])) / stanceOf[x]));
  const high = pt(S, "hipR")[2] - pt(S, "ankleR")[2], reachable = Math.sqrt(Math.max(0, (0.985 * leg) ** 2 - reach ** 2));
  if (reach > STRIDE_MAX * leg) throw new Error(`gait ${g.name}: its feet reach ${Math.round((100 * reach) / leg)}% of a leg ahead and behind (half a stride and the set-down), past ${100 * STRIDE_MAX}%: slow it, or shorten its cycle or stance`);
  const dip = Math.max((g.dip ?? 2) * pct, high - reachable);
  const t: Track = { dur, loop: true, fps, times, poses: [], roots: [], events: [], rest, restSrc: opts.restSrc, sources: [], cycle: { forward: g.speed * g.cycle, right: 0, yaw: 0 } };
  const limbs = new Limbs(S);
  /** The points, unrounded pose and root of the frame at `time`, and whether each foot is still in the world. */
  const frameAt = (time: number, hint: Pose) => {
    const phase = time / dur, X = Float32Array.from(S), stand = { L: false, R: false };
    // the pelvis: lowered, bouncing twice a cycle (lowest just after each touchdown), swaying over the standing foot,
    // dropping over the weak leg while it stands
    const vL = (phase + 1 - landL) % 1, bob = -dip - ((g.bounce ?? 1.5) * pct * PM.cos(4 * Math.PI * (phase - 0.08)));
    const sway = (g.sway ?? 2) * pct * PM.cos(2 * Math.PI * (phase - g.stance / 2)), drop = vL < stanceOf.L ? -4 * limp * pct * PM.sin((Math.PI * vL) / stanceOf.L) : 0;
    // the root and the pelvis on the format's grid (whole % of H0) before the feet are aimed, so rounding the keys
    // moves no planted foot: the root's rounding is made up in the root's frame
    const rootF = Math.round(g.speed * time), behind = (g.speed * time - rootF) * pct;
    const want = add(piv, [behind, sway, bob + drop]), dHip = sub(want.map((v) => Math.round(v / pct) * pct) as V3, piv);
    const qUp = qmul(turn([0, 1, 0], (g.lean ?? 3) * D2R), turn([0, 0, 1], -6 * D2R * PM.cos(2 * Math.PI * phase)));
    for (const n of PELVIS) put(X, n, add(pt(S, n), dHip));
    for (const n of UPPER) put(X, n, add(add(piv, qrot(qUp, sub(pt(S, n), piv))), dHip));
    // the feet: the right touches down at phase 0, the left at landL (a half, without a limp)
    for (const [s, off] of [["R", 0], ["L", 1 - landL]] as const) {
      const v = (phase + off) % 1, [fwd, up] = footAt(v, stanceOf[s], strideOf[s], lift, upClear[s] * pct, upOf[s], CLEAR * pct, offOf[s]), a = pt(S, `ankle${s}`);
      // still in the world: standing, or rising or setting down straight
      const ws = (v - stanceOf[s]) / (1 - stanceOf[s]);
      stand[s] = v < stanceOf[s] || ws < upOf[s] || ws > 1 - offOf[s];
      // (a foot never reaches past STRIDE_MAX of a leg from the hips, so its knee never snaps straight)
      limbs.reach(X, `foot${s}`, [a[0] + fwd + behind, a[1], a[2] + up]);
    }
    // the arms swing against the legs: the left forward as the right foot is
    for (const [s, off] of [["R", 0.5], ["L", 0]] as const) {
      const sh = pt(X, `sh${s}`), sw = (g.swing ?? 25) * D2R * PM.cos(2 * Math.PI * (phase + off)), side = s === "L" ? -1 : 1;
      limbs.reach(X, `hand${s}`, add(sh, mul([PM.sin(sw), side * 0.12, -PM.cos(sw)], armLen * 0.94)));
    }
    const e = encodePose(rest, X, hint as KeyLike, { hands: hint.handL !== undefined || hint.handR !== undefined, round: false }), { t: _t, root: _r, yaw: _y, ...raw } = e;
    return { X, raw: raw as Pose, stand, rootF };
  };
  // each frame's points, unrounded pose and whether each foot is still in the world, for the second pass
  const frames: { X: Float32Array; raw: Pose; stand: Record<"L" | "R", boolean> }[] = [];
  let hint: Pose = start;
  for (const time of times) {
    const f = frameAt(time, hint), pose = snapLegs(rest, f.raw, f.X);
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
  const after = frameAt(dur, hint).raw, turned = (d: number) => d - 360 * Math.round(d / 360);
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
  return clipOfTrack(t, { id: opts.id ?? `PROCEDURAL/${name}`, name, tags: [g.stance < 0.5 ? "run" : "walk", "loop"], desc: g.about.charAt(0).toUpperCase() + g.about.slice(1), contacts }, opts.budget ?? 2);
}

