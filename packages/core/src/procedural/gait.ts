// The gait synthesizer (PLAN.md WP-6.2, D71), after riftlight's gaitClip (src/engine/animation/gait.ts, "zero foot
// slide by construction"): a walk or a run as a loop that travels, from its speed, cadence and stance. Each foot is
// planted in the world while it is in stance: in the root's frame it slides back at exactly the ground speed. In swing
// it lifts straight up past the height a lifted foot is read at, and sets straight down, still in the world, and
// travels forward between on a Hermite curve whose ends keep that speed, lifted on an arc that peaks before halfway, its
// height's slope continuous throughout: a foot near the floor never moves. The pelvis bobs twice a cycle and sways over
// the standing foot, lowered until no leg reaches past 98.5% of its length as the clip holds it, the arms swing against
// the legs, and a limp shortens one leg's stance and drops the pelvis on it. The contacts are the model's own (each
// foot from its touchdown to its lift-off). The root and pelvis are put on the format's grid before the feet are aimed,
// and each planted leg's rounded numbers are chosen to keep its ankle within the format's rounding (a leg's direction is
// held in hundredths: about 4 mm) of where it landed, through the in-betweening too. A gait it can't play (a stride
// past the legs' reach, a swing under 0.26 s or faster past the hips than 4 hip heights a second, a run's cycle under
// 0.6 s (0.65 lifting over 25%), a number past the range the sensors pass, a rate outside 55 to 90 frames a second) is
// refused with what to change; `fitGait` slows one to the reach of a body's legs. The frames are spread evenly over the
// cycle, an even number of them, and each knee's turn about its leg, carried on from frame to frame, is closed over it,
// so the loop meets itself.
import { IDX, ik3, limbEnd, P, reachOf, type Rest, type Side } from "../format/body.ts";
import { add, len, mul, norm, qmul, qrot, sub, type Frame, type Quat, type V3 } from "../format/math.ts";
import { decodePose, encodePose, torso, type KeyLike } from "../format/pose.ts";
import type { Clip, Contacts } from "../format/types.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import type { Pose } from "../ops/pose.ts";
import { quantize } from "../recipe/compile.ts";
import type { Root, Track } from "../recipe/types.ts";
import { Limbs } from "./limbs.ts";
import { bodyOf, clipOfTrack, standingOn, type ProceduralOptions } from "./clip.ts";

/**
 * A gait, in the format's units: speed and lengths in % of the hip height, angles in degrees, times in seconds. Besides
 * each number's range, `gaitClip` refuses a swing under 0.26 s (the cycle times the share a foot is up), a foot
 * swinging forward past the hips faster than 400% of the hip height a second, a run's (a stance under 0.5) cycle under
 * 0.6 s (0.65 lifting over 25), a rate outside 55 to 90 frames a second, and, on the rest given, a stride past the
 * legs' reach (72% of a leg ahead and behind: the refusal names the fastest speed that fits, and `fitGait` slows a gait
 * to it); each with what to change (D71).
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
 *  popped on some bodies: D71, round 6). */
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
 * (the leg's end at its bend's reach, kept by ik3 within the leg's), as its Float32Array holds the point, bit for bit.
 * ik3's hint (from the twist) turns only the knee, so a fixed one serves (up). snapLegs weighs 81 candidates a leg
 * with it, where a whole decode each took 85% of a gait's time (an idle's too) and made one in about 0.3 s.
 */
export function ankleOf(R: Rest, hip: V3, RP: Frame, l: readonly number[], s: Side): V3 {
  const end = ik3(hip, limbEnd(hip, RP, norm(l), s, reachOf(l[3] || 0, R.thigh, R.shin)), R.thigh, R.shin, [0, 0, 1])[1];
  return [Math.fround(end[0]), Math.fround(end[1]), Math.fround(end[2])];
}

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
    const miss = (v: number[]) => len(sub(ankleOf(R, hip, tq.RP, v, s), goal));
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
 * (core's contact bands, the sensors' too), and in a swing under 0.19 s it is up above their 7% for less than that
 * (round 2); under 0.25 s a knee pops lifting more than 12, bouncing 6, or at a stance of 0.5 near the cap, on many
 * bodies (D71, rounds 4 and 5); at 0.25 to 0.257 s, a stance of 0.5 near the reach bound still did on some, the pelvis
 * lowered for the bounce (round 6).
 */
const MIN_SWING = 0.26;
/**
 * The fastest a swinging foot may come forward past the hips, % of the hip height a second (its stride over its swing:
 * the speed times its stance over its swing, whatever the cycle): at 420 a long stance's knee pops mid-swing on some
 * bodies (stance 0.75 at 140: 13 of 128 clips, on 12 rests); at 402 and under none did (D71, round 3). Measured on walks
 * and limps (stances of 0.62 to 0.75); a run's feet, standing under half the cycle, come forward slower than the body goes,
 * so it reaches the cap only past 400% of the hip height a second (at stance 0.3, past 930%), where no run was measured.
 */
const SWING_SPEED = 400;
/** A run's (a stance under half the cycle's) shortest cycle, s, and lifting over 25: under it its feet move too sharply
 *  between frames, and its seam and knees pop (D71, round 4). */
const MIN_RUN_CYCLE = 0.6, MIN_HIGH_RUN_CYCLE = 0.65;
/**
 * The fewest and most frames a second a gait is made at: fewer, a fast gait's seam steps too far between them, and at 50
 * a swing of 0.26 s just over a stance of a half, lifting 30 or 35, still popped a knee as the thigh swept through (7
 * of 456 on 19 rests; at 55 and 60 none; D71, round 7); more, its keys, fitted to 2 mm, pop between frames (a walk at
 * 240 failed on every rest; at 120 a brisk walk with the ranges' high ends popped its elbows on 4 of 64; rounds 4 to 6).
 * And the format holds the pelvis's place in whole % of the hip height: past 90 a frame, a slow bouncing pelvis moves
 * less than that, so it steps every other frame and a planted leg takes each step at once, its knee jumping 30 mm and
 * still between, a pop (stances of 0.7 and 0.75 bouncing 6 at 110: 8 of 256 failed, on 7 of 64 rests, and 179 warned;
 * at 90 none failed and 35 warned; round 7).
 */
const MIN_GAIT_FPS = 55, MAX_GAIT_FPS = 90;
/** A gait's numbers checked: named and described, in range, and each foot given time to swing (a limp's strong foot most
 *  of all). */
export function checkGait(g: Gait): void {
  const bad = (what: string) => {
    throw new Error(`gait${typeof g.name === "string" && g.name.trim() ? ` ${g.name}` : ""}: ${what}`);
  };
  // (its clip is named and described from them, after it is made)
  for (const k of ["name", "about"] as const) if (typeof g[k] !== "string" || !g[k].trim()) bad(`its ${k} is ${g[k] === undefined ? "missing" : JSON.stringify(g[k])}: give it a name (its clip is PROCEDURAL/<Name>) and an about line (the clip's description)`);
  for (const k of ["speed", "cycle", "stance", "limp", ...RANGES.map(([k]) => k)] as const) if (g[k] !== undefined && typeof g[k] !== "number") bad(`${k} ${JSON.stringify(g[k])} is not a number`);
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
  // to the ms, so a swing of 0.26 s isn't refused for a float's error (0.8 s at a stance of 0.675: 0.259999...)
  const swingMs = Math.round(Math.min(1 - right, 1 - left) * g.cycle * 1000);
  const foot = limp > 0 ? "its right foot swings" : "its feet swing";
  if (swingMs < Math.round(MIN_SWING * 1000)) bad(`${foot} for ${(swingMs / 1000).toFixed(3)} s, under ${MIN_SWING} s: a knee pops swinging faster (and a foot up for under 0.1 s reads as never leaving the floor); use a longer cycle, a shorter stance${limp > 0 ? " or a lighter limp" : ""}`);
  const lift = g.lift ?? 12;
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
/** The fastest whole speed (% of the hip height a second) up to g's at which its feet reach no farther than STRIDE_MAX of
 *  a leg `leg` mm long: the reach grows with the stride, so it is found by halving. */
function fastest(g: Gait, pct: number, leg: number): number {
  let lo = 0, hi = g.speed;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (feetOf({ ...g, speed: mid }, pct, leg).reach <= STRIDE_MAX * leg) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}
/**
 * A gait fitted to a body: its speed lowered, if it must be, to the fastest whole % of the hip height a second at which
 * its feet reach no farther ahead and behind than `gaitClip` takes on `rest`'s legs (72% of a leg); its other numbers as
 * given. The presets are drawn for a person's proportions: on a short-legged or heavy body the run and the brisk walk
 * reach past that (of the 20 test characters, the run fits only the tall ones and the brisk walk all but the chibis and
 * two bulky ones; the walk and the limp fit all), and this plays them there, a little slower (the run at 301 to 349,
 * brisk at 153 to 169; all 80 pass the sensors: D71, round 7): `gaitClip(fitGait(GAITS[2], rest), rest, opts)`. It
 * fits the speed alone; no other refusal depends on the body.
 */
export function fitGait(g: Gait, rest: Rest): Gait {
  const S = new Float32Array(P * 3);
  decodePose(rest, standingOn(rest) as KeyLike, S);
  const b = bodyOf(rest, S), leg = b.legUpper + b.legLower, pct = rest.H0 / 100;
  return feetOf(g, pct, leg).reach <= STRIDE_MAX * leg ? g : { ...g, speed: fastest(g, pct, leg) };
}

/** A gait as a travelling loop on `rest`, one cycle, from the standing pose (or `opts.start`). */
export function gaitClip(g: Gait, rest: Rest, opts: ProceduralOptions): Clip {
  checkGait(g);
  if (opts.fps !== undefined && !(typeof opts.fps === "number" && opts.fps >= MIN_GAIT_FPS && opts.fps <= MAX_GAIT_FPS)) throw new Error(`gait ${g.name}: made at ${JSON.stringify(opts.fps)} frames a second, not ${MIN_GAIT_FPS} to ${MAX_GAIT_FPS}: fewer, a fast gait's seam steps too far between its frames; more, its keys pop between them; use ${MIN_GAIT_FPS} to ${MAX_GAIT_FPS} (60 by default)`);
  const fps = opts.fps ?? 60, start = opts.start ?? standingOn(rest), S = new Float32Array(P * 3);
  decodePose(rest, start as KeyLike, S);
  // the frames spread evenly over the cycle (to the ms), so the last is as far from the seam as from the one before:
  // on the rate's grid, a cycle off it would leave its seam a step of a few ms, and any difference there reads as a pop;
  // an even number of them, so a plain gait's left foot, half a cycle on, is seen at the very phases its right is (with
  // an odd number its knee fell between frames: a run of 0.65 s, 39 frames, popped the left knee on 10 of 64 rests)
  const b = bodyOf(rest, S), pct = rest.H0 / 100, dur = Math.round(g.cycle * 1000) / 1000, nf = Math.max(2, 2 * Math.round((dur * fps) / 2));
  const times = Array.from({ length: nf }, (_, i) => Math.round((i * dur * 1000) / nf) / 1000);
  const lift = (g.lift ?? 12) * pct, limp = g.limp ?? 0, leg = b.legUpper + b.legLower;
  const { landL, stanceOf, offOf, strideOf, upOf, reach } = feetOf(g, pct, leg);
  const armLen = b.armUpper + b.armLower, piv = pt(S, "pelvis");
  if (reach > STRIDE_MAX * leg) {
    const v = fastest(g, pct, leg);
    throw new Error(`gait ${g.name}: its feet reach ${((100 * reach) / leg).toFixed(1)}% of a leg ahead and behind (half a stride and the set-down), past ${100 * STRIDE_MAX}%: on these legs, at this cycle and stance, it goes at most ${v}% of the hip height a second (${Math.round(v * pct)} mm/s); slow it (fitGait does), or shorten its cycle or stance`);
  }
  // the pelvis low enough for a leg to reach the stance's ends (half a stride ahead and behind) a little bent
  // (the stance's ends, and a little past them as the foot lifts off and sets down still in the world)
  const high = pt(S, "hipR")[2] - pt(S, "ankleR")[2], reachable = Math.sqrt(Math.max(0, (0.985 * leg) ** 2 - reach ** 2));
  // and low enough that no leg reaches past 98.5% of its length at any phase: the bounce lifts the pelvis twice a
  // cycle, and where it does with a foot far ahead or behind (a stance of a half, a fast stride), a leg lowered only for
  // the stance's ends was driven straight and its knee popped (D71, round 6). Counted as the clip will hold it: the
  // pelvis swaying, and put on the format's grid (whole % of H0), so up to half a % higher, further along and further
  // across than drawn (uncounted, a written leg read up to 99.3%; D71, round 7)
  let dip = Math.max((g.dip ?? 2) * pct, high - reachable);
  const legs = ([["R", 0], ["L", 1 - landL]] as const).map(([s, off]) => ({ s, off, ahead: pt(S, `ankle${s}`)[0] - pt(S, `hip${s}`)[0], side: pt(S, `ankle${s}`)[1] - pt(S, `hip${s}`)[1], under: pt(S, `hip${s}`)[2] - pt(S, `ankle${s}`)[2] }));
  for (let k = 0; k < 240; k++) {
    const phase = k / 240, raise = -(g.bounce ?? 1.5) * pct * PM.cos(4 * Math.PI * (phase - 0.08)), sway = (g.sway ?? 2) * pct * PM.cos(2 * Math.PI * (phase - g.stance / 2));
    for (const { s, off, ahead, side, under } of legs) {
      const [fwd, up] = footAt((phase + off) % 1, stanceOf[s], strideOf[s], lift, UP * pct, upOf[s], CLEAR * pct, offOf[s]);
      const along = Math.abs(ahead + fwd) + pct / 2, across = Math.abs(side - sway) + pct / 2;
      dip = Math.max(dip, under + raise + pct / 2 - up - Math.sqrt(Math.max(0, (0.985 * leg) ** 2 - along ** 2 - across ** 2)));
    }
  }
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
      const v = (phase + off) % 1, [fwd, up] = footAt(v, stanceOf[s], strideOf[s], lift, UP * pct, upOf[s], CLEAR * pct, offOf[s]), a = pt(S, `ankle${s}`);
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

