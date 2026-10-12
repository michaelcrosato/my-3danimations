// The procedural idle (PLAN.md WP-6.2, D71), after shardfall's puppet (crates/pav_core/src/puppet.rs: a breath every
// 3.4 s, the weight shifting from foot to foot every 6.3 s) and my-3d2dge's rig: a loop on a start pose in which the
// body breathes (the chest lifting, leaning back a touch, and the shoulders rising on each breath in: the format holds
// the bones' directions, not their lengths, so a breath is drawn with those) and shifts its weight from
// one foot to the other (the pelvis swaying over the standing foot, dipping a touch, the chest leaning back against
// it), the feet planted throughout (the legs rounded to keep them there, the keys fitted within 2 mm). The loop holds
// whole breaths and one shift, so it closes without a seam.
import { IDX, P, type Rest } from "../format/body.ts";
import { add, qrot, sub, type Quat, type V3 } from "../format/math.ts";
import { decodePose, encodePose, type KeyLike } from "../format/pose.ts";
import type { Clip } from "../format/types.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import type { Pose } from "../ops/pose.ts";
import { frameTimes } from "../recipe/track.ts";
import type { Track } from "../recipe/types.ts";
import { clipOfTrack, standingOn, type ProceduralOptions } from "./clip.ts";
import { snapLegs } from "./gait.ts";
import { Limbs } from "./limbs.ts";

/** An idle: how long a weight shift and a breath take, and how much each moves the body. */
export interface Idle {
  name: string;
  about: string;
  /** One weight shift, from one foot to the other and back, in seconds: the loop's length (6.8 by default). */
  shift?: number;
  /** One breath, in seconds (3.4 by default); the loop holds a whole number of them. */
  breath?: number;
  /** How far the pelvis sways each way, % of the hip height (2 by default; the format keeps the pelvis's place in whole
   *  percents, so a fraction rounds). */
  sway?: number;
  /** How deep a breath is (1.2 by default): the chest leans back 1.5° and the shoulders rise 0.8% of the hip height for
   *  each 1. */
  depth?: number;
}

const pt = (X: ArrayLike<number>, n: string): V3 => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const put = (X: Float32Array, n: string, v: readonly number[]) => X.set(v, IDX[n]! * 3);
const turn = (axis: V3, a: number): Quat => [axis[0] * PM.sin(a / 2), axis[1] * PM.sin(a / 2), axis[2] * PM.sin(a / 2), PM.cos(a / 2)];
const D2R = Math.PI / 180;
const PELVIS = ["pelvis", "pelvisF", "hipL", "hipR"];
const UPPER = ["spine1", "spine2", "chest", "neck", "head", "headTop", "faceF", "chestF", ...["L", "R"].flatMap((s) => ["clav", "sh", "elbow", "wrist", "index", "knuck", "pinky", "fist"].map((n) => n + s))];
/** The points a breath turns with the chest about its base: all above it. */
const ABOVE = new Set(UPPER.filter((n) => !["spine1", "spine2", "chest"].includes(n)));
/** The points a breath lifts: the shoulders and what hangs from them (not the collarbones, so the shoulders shrug). */
const SHOULDERS = new Set(["L", "R"].flatMap((s) => ["sh", "elbow", "wrist", "index", "knuck", "pinky", "fist"].map((n) => n + s)));

/** The idles the library offers ready made: an easy one and a restless one. */
export const IDLES: readonly Idle[] = [
  { name: "breathe", about: "standing easy, breathing, the weight shifting slowly from foot to foot" },
  { name: "fidget", about: "standing restless, quicker breaths and a bigger shift of the weight", shift: 4, breath: 2, sway: 3, depth: 2 },
];

/** An idle as a loop on `rest`, from the standing pose (or `opts.start`), its feet where the start pose has them. */
export function idleClip(i: Idle, rest: Rest, opts: ProceduralOptions): Clip {
  const fps = opts.fps ?? 30, start = opts.start ?? standingOn(rest), S = new Float32Array(P * 3);
  decodePose(rest, start as KeyLike, S);
  const shift = i.shift ?? 6.8, breaths = Math.max(1, Math.round(shift / (i.breath ?? 3.4))), dur = Math.round(shift * 1000) / 1000;
  const pct = rest.H0 / 100, sway = (i.sway ?? 2) * pct, depth = (i.depth ?? 1.2) / 100, piv = pt(S, "pelvis"), limbs = new Limbs(S);
  const t: Track = { dur, loop: true, fps, times: frameTimes(dur, true, fps), poses: [], roots: [], events: [], rest, restSrc: opts.restSrc, sources: [], cycle: { forward: 0, right: 0, yaw: 0 } };
  let hint: Pose = start;
  for (const time of t.times) {
    const X = Float32Array.from(S), w = PM.sin((2 * Math.PI * time) / dur), b = 0.5 - 0.5 * PM.cos((2 * Math.PI * breaths * time) / dur);
    // the weight over one foot: the pelvis sways toward it and dips a touch; the chest leans back the other way (turned
    // about the forward axis so the shoulders tip away from the standing hip)
    const dHip: V3 = [0, sway * w, -0.25 * sway * w * w], q: Quat = turn([1, 0, 0], 0.01 * w);
    for (const n of PELVIS) put(X, n, add(pt(S, n), dHip));
    // a breath in: the chest lifts, leaning back about its base, and the shoulders rise
    const chest = pt(S, "chest"), lift = turn([0, 1, 0], -1.5 * depth * 100 * D2R * b);
    for (const n of UPPER) {
      const own = ABOVE.has(n) ? add(chest, qrot(lift, sub(pt(S, n), chest))) : pt(S, n), p = sub(own, piv);
      put(X, n, add(add(piv, qrot(q, [p[0], p[1], p[2] + (SHOULDERS.has(n) ? 0.8 * depth * b * rest.H0 : 0)])), dHip));
    }
    for (const s of ["L", "R"] as const) limbs.reach(X, `foot${s}`, pt(S, `ankle${s}`));
    for (const s of ["L", "R"] as const) limbs.reach(X, `hand${s}`, pt(X, `fist${s}`));
    const e = encodePose(rest, X, hint as KeyLike, { hands: hint.handL !== undefined || hint.handR !== undefined, round: false }), { t: _t, root: _r, yaw: _y, ...raw } = e;
    // the legs rounded to land the ankles where they stand (rounding alone moves a planted foot a few mm a frame)
    const pose = snapLegs(rest, raw, X);
    t.poses.push(pose);
    t.roots.push({ forward: 0, right: 0, yaw: 0 });
    hint = pose;
  }
  const name = i.name.charAt(0).toUpperCase() + i.name.slice(1);
  return clipOfTrack(t, { id: opts.id ?? `PROCEDURAL/${name}`, name, tags: ["idle", "loop"], desc: i.about.charAt(0).toUpperCase() + i.about.slice(1) }, opts.budget ?? 2);
}
