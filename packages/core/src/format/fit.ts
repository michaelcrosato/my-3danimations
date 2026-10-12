// Fitting a captured clip with as few key poses as keep it within budget (spec/MOTION.md §6.4): pose error,
// Ramer–Douglas–Peucker over whole poses, encoding chosen frames, and the fit loop that adds the worst-missed frame.
// Ported from my-3d2dge's readable.js:133-146 and :276-302 operation for operation (tier 1a, bit for bit). Per-group
// budgets are an extension that leaves the single-budget path unchanged, and so are format 2's options: a clip keeps
// its spine curl only when it moves the spine's points 5 mm or more nearer somewhere (every key then carries it, so
// in-betweening never mixes a key with it and one without), and its `yaw` only when its hips turn 20° or more.
import { P, POINTS, pt, type Rest } from "./body.ts";
import { compose, fromEuler, loc, norm, sub } from "./math.ts";
import { encodePose, spineGain, type EncodeOptions, type KeyLike } from "./pose.ts";
import { capSample, pose, type Capture } from "./sample.ts";
import { PORTABLE as PM } from "../math/portable.ts";

/** The body-point offsets error measures: every point but the finger helpers (index, pinky), which only aim a blade. */
const SHOWN = POINTS.map((p, i) => (/^(index|pinky)/.test(p) ? -1 : i * 3)).filter((i) => i >= 0);

/** The largest distance between matching body points of two poses (mm). */
export function error(A: ArrayLike<number>, B: ArrayLike<number>, shown: readonly number[] = SHOWN): number {
  let w = 0;
  for (const i of shown) w = Math.max(w, (A[i]! - B[i]!) ** 2 + (A[i + 1]! - B[i + 1]!) ** 2 + (A[i + 2]! - B[i + 2]!) ** 2);
  return Math.sqrt(w);
}
/** The average distance between matching body points (mm). */
export function meanError(A: ArrayLike<number>, B: ArrayLike<number>): number {
  let s = 0;
  for (const i of SHOWN) s += PM.hypot(A[i]! - B[i]!, A[i + 1]! - B[i + 1]!, A[i + 2]! - B[i + 2]!);
  return s / SHOWN.length;
}

/** Key frames by Ramer–Douglas–Peucker over whole poses: in-betweening the rest stays within tol mm of the capture. */
export function reduce(c: Capture, tol: number): number[] {
  const D = c.data;
  const n = c.n;
  const keep = [0, n - 1];
  const tmp = new Float32Array(P * 3);
  const off = (a: number, b: number, i: number) => {
    const t = (i - a) / (b - a);
    for (let j = 0; j < P * 3; j++) tmp[j] = D[a * P * 3 + j]! + (D[b * P * 3 + j]! - D[a * P * 3 + j]!) * t;
    return error(tmp, D.subarray(i * P * 3, (i + 1) * P * 3));
  };
  const go = (a: number, b: number): void => {
    if (b - a < 2) return;
    let wi = -1;
    let we = 0;
    for (let i = a + 1; i < b; i++) {
      const e = off(a, b, i);
      if (e > we) {
        we = e;
        wi = i;
      }
    }
    if (we > tol) {
      keep.push(wi);
      go(a, wi);
      go(wi, b);
    }
  };
  if (n > 1) go(0, n - 1);
  return [...new Set(keep)].sort((x, y) => x - y);
}

/** What an encoded clip carries besides keys: tags and a description, whether a blade is held, encoding options
 *  (`yaw`: format 2's root heading, for a clip that turns). */
export interface Extra extends EncodeOptions {
  tags?: string[];
  desc?: string;
  blade?: boolean;
  yaw?: boolean;
}

/** A clip's spine curl is kept when it brings a spine point this much nearer (mm) in some key. */
const SPINE_GAIN = 5;
/** A clip carries `yaw` when its hips end up facing this far (degrees) from where they started. */
const YAW_TURN = 20;

/**
 * The hips' heading at every frame, relative to the first (degrees, + toward the right), read from the hip line and
 * averaged over a second (less near either end) so a gait's hip swing doesn't count; null unless the clip ends facing
 * 20° or more from where it began (its first and last half second averaged): a swing of the hips that comes back (a
 * blow, a sway) is the body's, not a turn.
 */
export function turning(cap: Capture): number[] | null {
  const X = new Float32Array(P * 3), raw: number[] = [];
  let wide = 0;
  for (let f = 0; f < cap.n; f++) {
    capSample(cap, f / cap.fps, X);
    // from the hip line, which stays level when the body bends over (the pelvis's own forward doesn't): forward is the
    // hips' left-to-right turned a quarter left. Only while the torso stands within 60° of upright: upside down or
    // lying (a cartwheel, a fall) the heading is held, and so it is while the line stands nearly upright
    const h = sub(pt(X, "hipR"), pt(X, "hipL")), u = sub(pt(X, "neck"), pt(X, "pelvis")), flat = PM.hypot(h[0]!, h[1]!), prev = raw[f - 1];
    wide = Math.max(wide, flat);
    if (prev !== undefined && (flat < 0.4 * wide || u[2]! < 0.5 * PM.hypot(u[0]!, u[1]!, u[2]!))) {
      raw.push(prev);
      continue;
    }
    const a = (PM.atan2(-h[0]!, h[1]!) * 180) / Math.PI, step = prev === undefined ? 0 : ((((a - prev) % 360) + 540) % 360) - 180;
    // a quarter turn or more between frames is the line coming level again, not a turn: held too
    raw.push(prev === undefined ? a : Math.abs(step) * (30 / cap.fps) >= 90 ? prev : prev + step);
  }
  // centred, its reach shrinking toward the clip's ends, so a steady turn keeps its every value
  const half = Math.max(1, Math.round(cap.fps / 2)), smooth = raw.map((_, f) => {
    const r = Math.min(half, f, cap.n - 1 - f);
    let s = 0;
    for (let j = f - r; j <= f + r; j++) s += raw[j]!;
    return s / (2 * r + 1);
  });
  const out = smooth.map((v) => v - smooth[0]!), ends = Math.min(half, Math.ceil(cap.n / 2));
  const mean = (a: number) => {
    let s = 0;
    for (let j = a; j < a + ends; j++) s += raw[j]!;
    return s / ends;
  };
  return Math.abs(mean(cap.n - ends) - mean(0)) >= YAW_TURN ? out : null;
}

/** A format-1 clip as encode writes it: name, dur, loop, optional tags and desc, keys. */
export interface Encoded {
  clip: string;
  dur: number;
  loop: boolean;
  tags?: string[];
  desc?: string;
  keys: KeyLike[];
}

const r0 = (v: number) => Math.round(v);

/** A readable clip from a captured one, keeping frames kf. */
export function encode(R: Rest, cap: Capture, kf: readonly number[], extra: Extra = {}): Encoded {
  const keys: KeyLike[] = [];
  const X = new Float32Array(P * 3);
  let prev: KeyLike | null = null, gain = 0;
  const turn = extra.yaw ? turning(cap) : null;
  for (const f of kf) {
    capSample(cap, f / cap.fps, X);
    const k: KeyLike = Object.assign({ t: Math.round((f / cap.fps) * 1000) / 1000 }, encodePose(R, X, prev, extra));
    if (extra.spine) gain = Math.max(gain, spineGain(R, k, X));
    if (extra.blade) k.blade = loc(compose(fromEuler(k.body!), fromEuler(k.chest!)), norm(sub(pt(X, "indexR"), pt(X, "pinkyR")))).map((x) => r0(x * 100));
    if (cap.move) k.root = [r0((cap.move[f * 2]! / R.H0) * 100), r0((cap.move[f * 2 + 1]! / R.H0) * 100)];
    if (turn) k.yaw = r0(turn[f]!);
    keys.push(k);
    prev = k;
  }
  // a spine curl that helps nowhere isn't kept: the clip is encoded again on the body's own shares
  if (extra.spine && gain < SPINE_GAIN) return encode(R, cap, kf, { ...extra, spine: false });
  return Object.assign({ clip: cap.name, dur: Math.round(cap.dur * 1000) / 1000, loop: cap.loop }, extra.tags ? { tags: extra.tags } : {}, extra.desc ? { desc: extra.desc } : {}, { keys });
}

/** Budgets per body region (mm): the torso and head, the arms, the legs. */
export interface GroupBudget {
  torso: number;
  arms: number;
  legs: number;
}

const GROUPS: Record<keyof GroupBudget, number[]> = { torso: [], arms: [], legs: [] };
for (const i of SHOWN) {
  const name = POINTS[i / 3]!;
  const g = /^(clav|sh|elbow|wrist|knuck|fist)/.test(name) ? "arms" : /^(hip|knee|ankle|ball|toe)[LR]$/.test(name) ? "legs" : "torso";
  GROUPS[g].push(i);
}

/**
 * A readable clip within `tol` mm of the capture: from the RDP key frames, add the frame the in-betweening misses most
 * until every frame is within tol of what the format can hold at all (the frame encoded as its own key). `tol` may be
 * one budget or one per region. Returns the clip and the worst and mean body-point error over its frames (mm).
 */
export function fit(R: Rest, cap: Capture, tol: number | GroupBudget, extra: Extra = {}): { clip: Encoded; max: number; mean: number } {
  if (typeof tol !== "number") return fitGroups(R, cap, tol, extra);
  const kf = reduce(cap, tol);
  const X = new Float32Array(P * 3);
  const Y = new Float32Array(P * 3);
  const t = (f: number) => f / cap.fps;
  const floor = Array.from({ length: cap.n }, (_, f) => error(capSample(cap, t(f), X), pose(R, encode(R, cap, [f], extra), t(f), Y)));
  for (let guard = 0; ; guard++) {
    const o = encode(R, cap, kf, extra);
    let worst = 0;
    let wf = -1;
    let max = 0;
    let sum = 0;
    for (let f = 0; f < cap.n; f++) {
      capSample(cap, t(f), X);
      pose(R, o, t(f), Y);
      const e = error(X, Y);
      const over = e - floor[f]!;
      max = Math.max(max, e);
      sum += meanError(X, Y);
      if (over > worst) {
        worst = over;
        wf = f;
      }
    }
    if (worst <= tol || kf.includes(wf) || guard > cap.n) return { clip: o, max, mean: sum / cap.n };
    kf.push(wf);
    kf.sort((a, b) => a - b);
  }
}

/** fit with a budget per region: a frame's excess is its largest (error − floor − budget) over the regions. */
function fitGroups(R: Rest, cap: Capture, tol: GroupBudget, extra: Extra) {
  const regions = Object.keys(GROUPS) as (keyof GroupBudget)[];
  const kf = reduce(cap, Math.min(tol.torso, tol.arms, tol.legs));
  const X = new Float32Array(P * 3);
  const Y = new Float32Array(P * 3);
  const t = (f: number) => f / cap.fps;
  const floors = Array.from({ length: cap.n }, (_, f) => {
    capSample(cap, t(f), X);
    pose(R, encode(R, cap, [f], extra), t(f), Y);
    return regions.map((g) => error(X, Y, GROUPS[g]));
  });
  for (let guard = 0; ; guard++) {
    const o = encode(R, cap, kf, extra);
    let worst = 0;
    let wf = -1;
    let max = 0;
    let sum = 0;
    for (let f = 0; f < cap.n; f++) {
      capSample(cap, t(f), X);
      pose(R, o, t(f), Y);
      max = Math.max(max, error(X, Y));
      sum += meanError(X, Y);
      const excess = Math.max(...regions.map((g, gi) => error(X, Y, GROUPS[g]) - floors[f]![gi]! - tol[g]));
      if (excess > worst) {
        worst = excess;
        wf = f;
      }
    }
    if (worst <= 0 || kf.includes(wf) || guard > cap.n) return { clip: o, max, mean: sum / cap.n };
    kf.push(wf);
    kf.sort((a, b) => a - b);
  }
}
