// Fitting a captured clip with as few key poses as keep it within budget (spec/MOTION.md §6.4): pose error,
// Ramer–Douglas–Peucker over whole poses, encoding chosen frames, and the fit loop that adds the worst-missed frame.
// Ported from my-3d2dge's readable.js:133-146 and :276-302 operation for operation (tier 1a, bit for bit). Per-group
// budgets are an extension that leaves the single-budget path unchanged.
import { P, POINTS, pt, type Rest } from "./body.ts";
import { compose, fromEuler, loc, norm, sub } from "./math.ts";
import { encodePose, type EncodeOptions, type KeyLike } from "./pose.ts";
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

/** What an encoded clip carries besides keys: tags and a description, whether a blade is held, encoding options. */
export interface Extra extends EncodeOptions {
  tags?: string[];
  desc?: string;
  blade?: boolean;
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
  let prev: KeyLike | null = null;
  for (const f of kf) {
    capSample(cap, f / cap.fps, X);
    const k: KeyLike = Object.assign({ t: Math.round((f / cap.fps) * 1000) / 1000 }, encodePose(R, X, prev, extra));
    if (extra.blade) k.blade = loc(compose(fromEuler(k.body!), fromEuler(k.chest!)), norm(sub(pt(X, "indexR"), pt(X, "pinkyR")))).map((x) => r0(x * 100));
    if (cap.move) k.root = [r0((cap.move[f * 2]! / R.H0) * 100), r0((cap.move[f * 2 + 1]! / R.H0) * 100)];
    keys.push(k);
    prev = k;
  }
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
