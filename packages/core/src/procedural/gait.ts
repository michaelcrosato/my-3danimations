// The gait synthesizer (PLAN.md WP-6.2, D71), after riftlight's gaitClip (src/engine/animation/gait.ts, "zero foot
// slide by construction"): a walk or a run as a loop that travels, from its speed, cadence and stance. Each foot is
// planted in the world while it is in stance: in the root's frame it slides back at exactly the ground speed. In swing
// it rises straight up clear of the floor and sets straight down, still in the world, and travels forward between on a
// Hermite curve whose ends keep that speed, lifted on an arc that peaks before halfway: a foot near the floor never
// moves. The pelvis bobs twice a cycle and sways over the standing foot, the arms swing against the legs, and a limp
// shortens one leg's stance and drops the pelvis on it. Contacts are detected from the result. The root and pelvis are put on the format's grid before the feet are aimed, and the keys are fitted
// tight (2 mm), so a planted foot stays put through the rounding and the in-betweening too.
import { IDX, P, type Rest } from "../format/body.ts";
import { add, len, mul, qmul, qrot, sub, type Quat, type V3 } from "../format/math.ts";
import { decodePose, encodePose, type KeyLike } from "../format/pose.ts";
import type { Clip } from "../format/types.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import type { Pose } from "../ops/pose.ts";
import { quantize } from "../recipe/compile.ts";
import { frameTimes } from "../recipe/track.ts";
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
  /** How high the swinging ankle rises (% of the hip height, 12 by default). */
  lift?: number;
  /** The pelvis's bounce, twice a cycle, and how far it is lowered throughout (% of the hip height; 1.5, and 2 or as
   *  far as a leg needs to reach half a stride ahead and behind). */
  bounce?: number;
  dip?: number;
  /** The pelvis's sway over the standing foot (% of the hip height, 2 by default). */
  sway?: number;
  /** Forward lean of the torso, degrees (3 by default). */
  lean?: number;
  /** The arms' swing either way, degrees (25 by default). */
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

/** The shares of the swing a foot spends lifting off and setting down, still in the world. */
const OFF = 0.1, DOWN = 0.9;
/** How high it rises straight up then, % of the hip height: above the 4% the sensors read a foot as standing within. */
const CLEAR = 4.5;
/**
 * Where an ankle is at cycle phase v (0..1 from its touchdown): forward of its standing place and up, in mm. In stance
 * it slides back at the ground speed (in the root's frame: still in the world). In swing it first rises straight up
 * to `clear` while still in the world, then travels forward on a Hermite curve whose ends keep that speed, lifted on
 * an arc to `lift` that peaks before halfway, and sets straight down still in the world again: so it is never near
 * the floor while it moves, and a foot near the floor never drifts.
 */
export function footAt(v: number, stance: number, stride: number, lift: number, clear = 0): [number, number] {
  if (v < stance) return [stride / 2 - (stride * v) / stance, 0];
  const s = (v - stance) / (1 - stance), slope = (-stride * (1 - stance)) / stance, span = DOWN - OFF, w = Math.min(1, Math.max(0, (s - OFF) / span));
  const x = s < OFF ? -stride / 2 + slope * s : s > DOWN ? stride / 2 + slope * (s - 1) : hermite(w, -stride / 2 + slope * OFF, stride / 2 + slope * (DOWN - 1), slope * span, slope * span);
  const c = Math.min(clear, lift), ramp = s < OFF ? smooth(s / OFF) : s > DOWN ? smooth((1 - s) / (1 - DOWN)) : 1;
  return [x, c * ramp + (lift - c) * PM.sin(Math.PI * PM.pow(w, PEAK))];
}
/** The power that puts the lift's peak at 40% of the swing (0.4^PEAK = 0.5). */
const PEAK = PM.log(0.5) / PM.log(0.4);
/** 0 to 1 with zero slope and curvature at both ends (the foot's rise has no kick). */
const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/**
 * A pose rounded as a key is (quantize), its legs' numbers each chosen from the whole numbers either side to land the
 * ankles nearest where the points X have them: rounding a leg's direction and bend alone moves a planted foot up to
 * 6 mm a frame, which adds up over a contact.
 */
export function snapLegs(R: Rest, p: Pose, X: Float32Array): Pose {
  const out = quantize(p), Y = new Float32Array(P * 3);
  for (const s of ["L", "R"] as const) {
    const f = `leg${s}`, raw = p[f] as number[], goal = pt(X, `ankle${s}`), base = out[f] as number[];
    const miss = (v: number[]) => (decodePose(R, { ...out, [f]: v } as KeyLike, Y), len(sub(pt(Y, `ankle${s}`), goal)));
    let best = base, err = miss(base);
    // the four numbers that place the ankle (direction and bend), each its floor or its ceiling
    for (let m = 0; m < 16; m++) {
      const v = raw.map((x, i) => (i < 4 ? (m >> i) & 1 ? Math.ceil(x) : Math.floor(x) : base[i]!));
      const e = miss(v);
      if (e < err) [best, err] = [v, e];
    }
    out[f] = best;
  }
  return out;
}

/** The gaits the library offers ready made: an easy walk, a brisk one, a run and a limp. */
export const GAITS: readonly Gait[] = [
  { name: "walk", about: "an easy walk, arms swinging a little", speed: 130, cycle: 1.1, stance: 0.6 },
  { name: "brisk", about: "a brisk walk, a longer stride and a bigger arm swing", speed: 170, cycle: 1.0, stance: 0.58, swing: 35 },
  { name: "run", about: "a run, leaning in, with a flight between steps", speed: 380, cycle: 0.7, stance: 0.35, lift: 25, bounce: 3, lean: 8, swing: 45 },
  { name: "limp", about: "a slow limp, favouring the left leg", speed: 90, cycle: 1.3, stance: 0.62, limp: 0.8 },
];

/** A gait as a travelling loop on `rest`, one cycle, from the standing pose (or `opts.start`). */
export function gaitClip(g: Gait, rest: Rest, opts: ProceduralOptions): Clip {
  const fps = opts.fps ?? 30, start = opts.start ?? standingOn(rest), S = new Float32Array(P * 3);
  decodePose(rest, start as KeyLike, S);
  const b = bodyOf(rest, S), pct = rest.H0 / 100, dur = Math.round(g.cycle * 1000) / 1000, times = frameTimes(dur, true, fps);
  const lift = (g.lift ?? 12) * pct, limp = g.limp ?? 0;
  // the right foot lands at phase 0 and the left at landL; a limp's weak left leg stands for less, landing late enough
  // and the right standing long enough that each hand-over keeps the plain gait's double support (none in a run)
  const both = g.stance - 0.5, stanceL = g.stance * (1 - 0.3 * limp), landL = 1 - stanceL + both, stanceOf = { L: stanceL, R: landL + both };
  // each foot covers the ground speed times its own stance while it stands
  const strideOf = { L: g.speed * pct * stanceOf.L * g.cycle, R: g.speed * pct * stanceOf.R * g.cycle }, stride = Math.max(strideOf.L, strideOf.R);
  const armLen = b.armUpper + b.armLower, piv = pt(S, "pelvis");
  // the pelvis low enough for a leg to reach the stance's ends (half a stride ahead and behind) a little bent
  const leg = b.legUpper + b.legLower, high = pt(S, "hipR")[2] - pt(S, "ankleR")[2], reachable = Math.sqrt(Math.max(0, (0.985 * leg) ** 2 - (stride / 2) ** 2));
  const dip = Math.max((g.dip ?? 2) * pct, high - reachable);
  const t: Track = { dur, loop: true, fps, times, poses: [], roots: [], events: [], rest, restSrc: opts.restSrc, sources: [], cycle: { forward: g.speed * g.cycle, right: 0, yaw: 0 } };
  const limbs = new Limbs(S);
  let hint: Pose = start;
  for (const time of times) {
    const phase = time / dur, X = Float32Array.from(S);
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
      const [fwd, up] = footAt((phase + off) % 1, stanceOf[s], strideOf[s], lift, CLEAR * pct), a = pt(S, `ankle${s}`);
      limbs.reach(X, `foot${s}`, [a[0] + fwd + behind, a[1], a[2] + up]);
    }
    // the arms swing against the legs: the left forward as the right foot is
    for (const [s, off] of [["R", 0.5], ["L", 0]] as const) {
      const sh = pt(X, `sh${s}`), sw = (g.swing ?? 25) * D2R * PM.cos(2 * Math.PI * (phase + off)), side = s === "L" ? -1 : 1;
      limbs.reach(X, `hand${s}`, add(sh, mul([PM.sin(sw), side * 0.12, -PM.cos(sw)], armLen * 0.94)));
    }
    const e = encodePose(rest, X, hint as KeyLike, { hands: hint.handL !== undefined || hint.handR !== undefined, round: false }), { t: _t, root: _r, yaw: _y, ...raw } = e;
    const pose = snapLegs(rest, raw, X);
    t.poses.push(pose);
    t.roots.push({ forward: rootF, right: 0, yaw: 0 } satisfies Root);
    hint = pose;
  }
  const name = g.name.charAt(0).toUpperCase() + g.name.slice(1);
  return clipOfTrack(t, { id: opts.id ?? `PROCEDURAL/${name}`, name, tags: [g.stance < 0.5 ? "run" : "walk", "loop"], desc: g.about.charAt(0).toUpperCase() + g.about.slice(1) }, opts.budget ?? 2);
}

