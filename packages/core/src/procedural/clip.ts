// A move as a format-2 clip (PLAN.md WP-6.2, D71): the move model's numbers at every frame placed on the body a rest
// describes, then applied to the start pose's points: the pelvis moved and turned as the hips' centre is, the upper
// body turned and leaned about the pelvis, each hand reaching (two-bone IK) for its aim relative to the shoulders, each
// ankle moved as the model moves its foot, the root turned for a spin. At the first frame nothing has moved, so the
// clip starts at its start pose, whatever it is; at the last, the recovery has let go, so it ends there too.
import { IDX, P, type Rest } from "../format/body.ts";
import { add, len, mul, qmul, qrot, sub, type Quat, type V3 } from "../format/math.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import { decodePose, encodePose, type KeyLike } from "../format/pose.ts";
import { error, meanError } from "../format/fit.ts";
import { keyAt } from "../format/sample.ts";
import { KEY_FIELDS, type Clip, type ClipEvent, type Contacts, type Key } from "../format/types.ts";
import { detectContacts, sole } from "../clip/contacts.ts";
import { blend, type Pose } from "../ops/pose.ts";
import { keysOf, quantize, tidyContacts } from "../recipe/compile.ts";
import { steady, unwrapped } from "../recipe/steps.ts";
import { frameTimes, ms } from "../recipe/track.ts";
import type { Root, Track } from "../recipe/types.ts";
import { validate } from "../validate/index.ts";
import { VERSION } from "../version.ts";
import { Limbs } from "./limbs.ts";
import { moveState, placeMove, standing, type Move, type MoveBody, type MoveState } from "./move.ts";

/** Standing easy, the knees and elbows a little bent (the hips' height set on each rest by `standingOn`). */
export const STANDING: Pose = { hips: [0, 0, 100], body: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 10, -100, 20, 0], armR: [0, 10, -100, 20, 0], legL: [2, 3, -100, 8, 0], legR: [2, 3, -100, 8, 0] };
/** STANDING on a rest: its hips lowered or raised until the lower sole is on the floor. */
export function standingOn(R: Rest): Pose {
  const X = new Float32Array(P * 3), p: Pose = { ...STANDING, hips: [...(STANDING.hips as number[])] };
  decodePose(R, p as KeyLike, X);
  const low = Math.min(...(["L", "R"] as const).flatMap((s) => sole(R, X, s).map((q) => q.p[2])));
  (p.hips as number[])[2] = 100 - (low / R.H0) * 100;
  return p;
}
/** The procedural sources' own revision in a clip's provenance. */
export const PROCEDURAL_PRODUCER = { tool: "m3a-procedural", version: VERSION };
/** Where the moves' numbers come from, as a generated clip credits them. */
const CREDIT = "m3a procedural sources, after the move model of my-3d2dge and shardfall (MIT)";

const pt = (X: ArrayLike<number>, n: string): V3 => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const put = (X: Float32Array, n: string, v: readonly number[]) => X.set(v, IDX[n]! * 3);
const mid = (a: V3, b: V3): V3 => mul(add(a, b), 0.5);
const turn = (axis: V3, a: number): Quat => [axis[0] * PM.sin(a / 2), axis[1] * PM.sin(a / 2), axis[2] * PM.sin(a / 2), PM.cos(a / 2)];
/** The pelvis's points, and the upper body's (everything the spine carries). */
const PELVIS = ["pelvis", "pelvisF", "hipL", "hipR"];
const UPPER = ["spine1", "spine2", "chest", "neck", "head", "headTop", "faceF", "chestF", ...["L", "R"].flatMap((s) => ["clav", "sh", "elbow", "wrist", "index", "knuck", "pinky", "fist"].map((n) => n + s))];

/** The lengths of the body in points X (a pose on its rest), in mm, as the move model reads a body. */
export function bodyOf(R: Rest, X: ArrayLike<number>): MoveBody {
  const hipC = mid(pt(X, "hipL"), pt(X, "hipR")), shC = mid(pt(X, "shL"), pt(X, "shR"));
  return {
    hipZ: hipC[2], hipHalf: len(sub(pt(X, "hipR"), pt(X, "hipL"))) / 2, footSpread: Math.abs(pt(X, "ankleR")[1] - pt(X, "ankleL")[1]) / 2,
    legUpper: len(sub(pt(X, "kneeR"), pt(X, "hipR"))), legLower: len(sub(pt(X, "ankleR"), pt(X, "kneeR"))), torso: len(sub(shC, hipC)),
    shoulderHalf: len(sub(pt(X, "shR"), pt(X, "shL"))) / 2, armUpper: len(sub(pt(X, "elbowR"), pt(X, "shR"))), armLower: len(sub(pt(X, "fistR"), pt(X, "elbowR"))), ref: R.H0,
  };
}

/** The shortest wind and recovery a clip plays: a move's own are its shape for a game that stretches it round the hit
 *  (shardfall's stir winds up in 0.05 s), and a hand can't leave the start pose and get back in a frame or two. */
export const MIN_PHASE = { wind: 0.25, active: 0.2, recover: 0.45 } as const;
/** A move's phases as a clip plays them. */
const timing = (m: Move) => ({ wind: Math.max(m.wind, MIN_PHASE.wind), active: Math.max(m.active, MIN_PHASE.active), recover: Math.max(m.recover, MIN_PHASE.recover) });
/** Which phase a time falls in, and how far through it. */
function phaseAt(m: Move, time: number): { phase: "wind" | "active" | "recover"; u: number } {
  const p = timing(m);
  if (time < p.wind) return { phase: "wind", u: time / p.wind };
  if (time < p.wind + p.active) return { phase: "active", u: (time - p.wind) / p.active };
  return { phase: "recover", u: Math.min(1, (time - p.wind - p.active) / p.recover) };
}

/** The pose of a move's state on the start pose's points S: as clip.ts's header says. */
function posed(m: Move, st: MoveState, R: Rest, b: MoveBody, S: Float32Array, hint: Pose, guard: boolean, limbs: Limbs): { pose: Pose; root: Root } {
  const canon = standing(b), J = placeMove(m, st, b, canon, { guard }), J0 = placeMove(m, REST_STATE, b, canon, { guard });
  const X = Float32Array.from(S), piv = pt(S, "pelvis"), dHip = sub(J.hipC, J0.hipC), hands = hint.handL !== undefined || hint.handR !== undefined, spine = hint.spine !== undefined;
  const qPel = turn([0, 0, 1], st.twist * 0.4), qUp = qmul(turn([0, 1, 0], st.lean + st.crouch * 0.22), turn([0, 0, 1], st.twist));
  for (const n of PELVIS) put(X, n, add(add(piv, qrot(qPel, sub(pt(S, n), piv))), dHip));
  for (const n of UPPER) put(X, n, add(add(piv, qrot(qUp, sub(pt(S, n), piv))), dHip));
  // the body as the format holds it: a torso turned and leaned that far is held by the chest's and shoulders' parts
  // within their ranges, so the shoulders the limbs hang from are the decoded ones (the points' can be 13 cm away)
  const first = encodePose(R, X, hint, { hands, spine, round: false }), Y = new Float32Array(P * 3);
  decodePose(R, first, Y);
  // the hands: each aim relative to the shoulders' centre, reached for from where the start pose's hand is carried, and
  // kept clear of the torso as the wind comes in (the source's rig is a stick figure: its hands cross where a body is)
  const shC = mid(pt(Y, "shL"), pt(Y, "shR")), pel = pt(Y, "pelvis");
  for (const s of ["L", "R"] as const) {
    const aim = J.aims[`hand${s}`], from = pt(S, `fist${s}`), carried = pt(Y, `fist${s}`), at = add(shC, sub(aim.at, J.shC));
    const goal = aim.fromStart ? add(from, mul(sub(at, from), st.windK)) : at;
    const target = add(carried, mul(sub(goal, carried), aim.w));
    limbs.reach(Y, `hand${s}`, add(target, mul(sub(clear(target, pel, shC, b.shoulderHalf * 1.3), target), st.windK)));
  }
  // the feet: each ankle moved as the model moves its foot
  for (const s of ["L", "R"] as const) limbs.reach(Y, `foot${s}`, add(pt(S, `ankle${s}`), sub(J[`foot${s}`], J0[`foot${s}`])));
  const e = encodePose(R, Y, hint, { hands, spine, round: false });
  const { t: _t, root: _r, yaw: _y, ...pose } = e;
  return { pose, root: { forward: 0, right: 0, yaw: (st.spin * 180) / Math.PI } };
}
/** A point pushed out of a vertical-ish cylinder of radius r round the line from the pelvis to the shoulders' centre,
 *  between their heights (the torso), along the way it already is from the line. */
function clear(p: V3, pelvis: V3, shC: V3, r: number): V3 {
  const axis = sub(shC, pelvis), l2 = axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2], k = Math.max(0, Math.min(1, ((p[0] - pelvis[0]) * axis[0] + (p[1] - pelvis[1]) * axis[1] + (p[2] - pelvis[2]) * axis[2]) / l2));
  if (k <= 0 || k >= 1) return p;
  const on = add(pelvis, mul(axis, k)), off = sub(p, on), d = len(off);
  return d >= r ? p : d < 1e-6 ? add(on, [r, 0, 0]) : add(on, mul(off, r / d));
}
/** How long a move takes to leave its start pose and to come back to it exactly, s. */
const ENDS = 0.1;
/** 0 to 1 with zero slope at both ends. */
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** The fields a move brings home through its recovery: the arms, and a kick's leg too. */
const ARMS_HOME = { armL: 1, armR: 1, handL: 1, handR: 1 }, KICK_HOME = { ...ARMS_HOME, legR: 1, footR: 1 };
/** The model's state with nothing moved: the body as the start pose has it. */
const REST_STATE: MoveState = { theta: 0, height: 0, reach: 0, lean: 0, lunge: 0, hop: 0, crouch: 0, twist: 0, spin: 0, windK: 1, arm: 0, step: 0 };

/** What generating a clip takes. */
export interface ProceduralOptions {
  /** The clip's id, SET/Slug (PROCEDURAL/<Name> by default). */
  id?: string;
  /** The rest's source entry, `restSrc`. */
  restSrc: string;
  /** A move's or an idle's pose to start from (and end at): a key's fields, `standingOn` the rest by default. A gait is
   *  made from the standing pose only, and refuses any other: its legs, pelvis, torso and arms are its own, and every
   *  bound it is fitted and measured to is read from there. */
  start?: Pose;
  /** The rate frames are sampled at before keys are fitted, and the key budget in mm: a move's 30 and 30, a gait's 60
   *  and 2, an idle's 30 and 2. A gait's cycle is split evenly into the even number of frames nearest cycle × fps, so its
   *  loop meets itself and a plain gait's feet are seen at the same phases (a 0.705 s cycle at 60 is 42 frames, 59.57 a
   *  second). A gait takes a rate of 55 to 75 and a budget of 0 (every frame a key) to 2, and refuses any other: every
   *  bound it is fitted to is measured over those, the worst of each kind of defect at 90% of the sensors' fail level or
   *  under (D71, round 14). */
  fps?: number;
  budget?: number;
}

/**
 * A track written as a format-2 clip: keys fitted within the budget, and the frames `keep` keys too (a gait's about its
 * loop's seam, where the sensors read the keys themselves), contacts detected, procedural provenance.
 */
export function clipOfTrack(t: Track, meta: { id: string; name: string; tags: string[]; desc: string; events?: ClipEvent[]; contacts?: Contacts }, budget = 30, keep: readonly number[] = []): Clip {
  // contacts are detected on the keys, which carry the root's travel (a planted foot is still in the world, not in
  // the root's frame)
  const { keys, fit } = withFrames(t, keysOf(t, budget), keep), contacts = tidyContacts(meta.contacts ?? CONTACT_ENDS_OF(detectContacts({ dur: t.dur, loop: t.loop, keys }, t.rest)), t.dur, t.loop);
  const clip: Clip = {
    format: "2.0", id: meta.id, name: meta.name, legend: "2.0", dur: t.dur, loop: t.loop, fps: t.fps, tags: meta.tags, desc: meta.desc, skeleton: "humanoid", restSrc: t.restSrc,
    ...(contacts ? { contacts } : {}), ...(meta.events?.length ? { events: meta.events } : {}),
    provenance: { src: "PROCEDURAL", method: "procedural", producer: PROCEDURAL_PRODUCER, license: "CC0-1.0", credit: CREDIT, ai: "algorithmicMedia" } as Clip["provenance"],
    quality: { fit, qa: "unchecked", qaVersion: "none" },
    keys,
  };
  const v = validate(clip, { mode: "read" });
  if (v.errors.length) throw new Error(`${meta.id}: the generated clip is invalid: ${v.errors.map((x) => `${x.code} ${x.message}`).join("; ")}`);
  return clip;
}
/**
 * Keys `fitted` (keysOf's) with the track's frames `keep` among them, each written as keysOf writes a frame (rounded,
 * the root's whole % where the keys carry it), and their fit measured again as keysOf measures it: every frame, and a
 * loop's closing one, against the keys' in-betweens. Where they already are, `fitted` is given back as it is.
 */
function withFrames(t: Track, fitted: { keys: Key[]; fit: [number, number] }, keep: readonly number[]): { keys: Key[]; fit: [number, number] } {
  const have = new Set(fitted.keys.map((k) => k.t)), add = [...new Set(keep)].filter((i) => i >= 0 && i < t.poses.length && !have.has(ms(t.times[i]!)));
  if (!add.length) return fitted;
  const like = fitted.keys[0] as unknown as Record<string, unknown>, root = like.root !== undefined, yaw = like.yaw !== undefined;
  const more = add.map((i) => {
    const r = t.roots[i]!;
    return { t: ms(t.times[i]!), ...quantize(t.poses[i]!), ...(root ? { root: [Math.round(r.forward) + 0, Math.round(r.right) + 0] } : {}), ...(yaw ? { yaw: Math.round(r.yaw) + 0 } : {}) } as unknown as Key;
  });
  const keys = [...fitted.keys, ...more].sort((a, b) => a.t - b.t), clip = { dur: t.dur, loop: false, keys };
  const n = t.poses.length + (t.loop ? 1 : 0), X = new Float32Array(P * 3), Y = new Float32Array(P * 3), data = new Float32Array(n * P * 3);
  t.poses.forEach((p, i) => data.set(decodePose(t.rest, p as KeyLike, X) as Float32Array, i * P * 3));
  if (t.loop) data.set(data.subarray(0, P * 3), (n - 1) * P * 3);
  let worst = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    decodePose(t.rest, keyAt(clip, i < t.poses.length ? ms(t.times[i]!) : ms(t.dur)) as KeyLike, Y);
    const frame = data.subarray(i * P * 3, (i + 1) * P * 3);
    worst = Math.max(worst, error(frame, Y));
    sum += meanError(frame, Y);
  }
  return { keys, fit: [Math.round(sum / n), Math.round(worst)] };
}
/** A pose with its angles (a limb's bend and twist, a turn) rounded to the whole degrees a key holds them in. */
function anglesRounded(p: Pose): Pose {
  const out: Pose = { ...p };
  for (const [f, v] of Object.entries(p)) {
    const spec = KEY_FIELDS[f];
    if (spec?.angles.length && Array.isArray(v)) out[f] = (v as number[]).map((x, i) => (spec.angles.includes(i) ? Math.round(x) : x));
  }
  return out;
}
/** Detected contacts as the format keeps them (by: detected). */
const CONTACT_ENDS_OF = (c: Contacts): Contacts => ({ ...c, by: "detected" });

/**
 * A move from library/moves.json as a clip on `rest`: wind, strike and recovery sampled at `fps` from the start pose and
 * back to it (the wind and recovery at least MIN_PHASE long), the hit an event at the moment it connects. A punch's free
 * hand guards the chin.
 */
export function moveClip(m: Move, rest: Rest, opts: ProceduralOptions): Clip {
  const fps = opts.fps ?? 30, start = opts.start ?? standingOn(rest), S = new Float32Array(P * 3);
  decodePose(rest, start as KeyLike, S);
  const p = timing(m), b = bodyOf(rest, S), dur = Math.round((p.wind + p.active + p.recover) * 1000) / 1000, times = frameTimes(dur, false, fps);
  const t: Track = { dur, loop: false, fps, times, poses: [], roots: [], events: [], rest, restSrc: opts.restSrc, sources: [] };
  let hint: Pose = start;
  // a hand's roll the start pose has half a turn from where the strike left it comes home the way it started round
  const limbs = new Limbs(S), mix = steady();
  for (const time of times) {
    const { phase, u } = phaseAt(m, time), st = moveState(m, phase, u), f = posed(m, st, rest, b, S, hint, m.guard === true, limbs);
    // as the recovery lets go, the arms (and a kick's leg) come home: the hands return to where they started, and the
    // elbows and knee, which the reach left wherever the strike turned them, return with them, all the way at the end
    // (a stepping foot comes back lifted, on its own clock)
    const home = phase === "recover" ? (1 - st.arm) ** 2 : 0, homed = home > 0 ? mix(f.pose, start, home, m.hand === "kick" ? KICK_HOME : ARMS_HOME) : f.pose;
    // and over its first and last moments the whole body is the start pose's, whatever the reach makes of a straight
    // limb or the encoding of a pose's spine: a move begins and ends exactly where it was given
    const ends = Math.min(smooth((time + 1e-9) / ENDS), smooth((dur - time + 1e-9) / ENDS));
    // (the very first and last frames the start pose itself, its angles rounded before they are unwrapped, and the
    // fields it leaves out at their defaults: a blend by a hair, or a twist a turn on, rounds a field ending in .5 the
    // other way, 3 mm off)
    const before = t.poses[t.poses.length - 1], pose = ends < 1e-6 ? { ...blend(start, homed, 0), ...anglesRounded(start) } : ends < 1 ? blend(start, homed, ends) : homed;
    t.poses.push(before ? unwrapped(pose, before) : pose);
    t.roots.push(f.root);
    hint = f.pose;
  }
  const name = m.name.charAt(0).toUpperCase() + m.name.slice(1), hit = Math.round((p.wind + m.hit * p.active) * 1000) / 1000;
  return clipOfTrack(t, { id: opts.id ?? `PROCEDURAL/${name}`, name, tags: [m.hand === "kick" ? "kick" : "attack"], desc: m.about.charAt(0).toUpperCase() + m.about.slice(1), events: [{ t: hit, name: "hit" }] }, opts.budget);
}
