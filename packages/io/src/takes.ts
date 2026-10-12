// Takes cut into clips (PLAN.md WP-5.2; carried from my-3d2dge tools/asf-amc.mjs readCmu, bit for bit, and shared by
// every capture format: CMU's ASF/AMC, BVH). A take is frames of the 36 body points in the world (metres, y up); a pick
// names its stretch. Each clip starts at the origin facing forward; a loop is cut at its best cycle (poses and speeds
// matching at its ends), faces the way it travels with its root on the straight line through the cycle, and what its
// last frame still differs from its first is spread over the cycle so it closes exactly. The rest pose is stood on
// the floor the takes stand on: the height the lowest foot point keeps most often.
import { format, math } from "@m3a/core";
import { IoError, LIMITS } from "./bytes.ts";
import type { Capture } from "./gltf/read.ts";

const { PORTABLE } = math;
const MM = 1000;
/** A point or direction (x, y, z). */
export type V3 = number[];

/** A stretch of a take to import: its clip name, the take, seconds from and to, the take's rate, whether it loops. */
export interface Pick {
  name: string;
  take: string;
  from?: number;
  to?: number;
  /** The take's frames a second (CMU's are 120; a BVH file says its own). */
  fps?: number;
  /** Cut at its best cycle, played in place. */
  loop?: boolean;
  /** The shortest cycle a loop may cut (s; 0.5): a gait whose feet meet between steps matches itself after one step. */
  minCycle?: number;
}
/** A take: how many frames it has and each frame's 36 body points in the world (metres, y up). */
export interface Take {
  frames: number;
  points(frame: number): V3[];
}
/** The rig's own frame on the floor: forward and right (unit, horizontal, world). */
export interface Facing {
  fwd: V3;
  right: V3;
}

const sub = (a: V3, b: V3): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const dot = (a: V3, b: V3) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/** A point in the rig's frame (forward, right, up; metres) from the world, about origin o on the floor. */
export function localTo(f: Facing, p: V3, o: V3): V3 {
  const d = [p[0]! - o[0]!, p[1]!, p[2]! - o[2]!];
  return [d[0]! * f.fwd[0]! + d[2]! * f.fwd[2]!, d[0]! * f.right[0]! + d[2]! * f.right[2]!, d[1]!];
}

/** Each pick cut from its take as a clip, and the takes' lowest foot points (where the floor is). */
export function cutPicks(takeOf: (take: string) => Take, facing: Facing, picks: readonly Pick[], FPS: number, file?: string): { clips: Record<string, Capture>; lows: number[]; log: string[] } {
  const POINTS = format.POINTS, P = format.P, { fwd: fwd0, right: RIGHT } = facing, log: string[] = [];
  const I = POINTS.indexOf("pelvis"), J = POINTS.indexOf("pelvisF");
  const local = (p: V3, o: V3) => localTo(facing, p, o);
  const heading = (W: V3[]) => {
    const h = sub(W[J]!, W[I]!);
    return PORTABLE.atan2(dot([h[0]!, 0, h[2]!], RIGHT), dot([h[0]!, 0, h[2]!], fwd0));
  };
  /** The best cycle in [from, to] (seconds): frames i < j, `min` to 2.5 s apart, whose poses (from the hips, facing the
   *  same way) and speeds match best, among spans that keep moving (half as fast as the stretch's typical frame). */
  const cycle = (T: Take, src: number, from: number, to: number, min = 0.5): [number, number, number] => {
    const a = Math.round(from * src), b = Math.min(T.frames - 1, Math.round(to * src)), F: Float64Array[] = [];
    for (let k = a; k <= b; k++) {
      const W = T.points(k), g = -heading(W), c = PORTABLE.cos(g), s = PORTABLE.sin(g), o = W[I]!, v = new Float64Array(P * 3);
      W.forEach((p, i) => {
        const d = [p[0]! - o[0]!, p[2]! - o[2]!], f = d[0]! * fwd0[0]! + d[1]! * fwd0[2]!, r = d[0]! * RIGHT[0]! + d[1]! * RIGHT[2]!;
        v[i * 3] = f * c - r * s;
        v[i * 3 + 1] = f * s + r * c;
        v[i * 3 + 2] = p[1]!;
      });
      F.push(v);
    }
    const rms = (x: Float64Array, y: Float64Array, z?: Float64Array, w?: Float64Array) => {
      let e = 0;
      for (let k = 0; k < x.length; k++) {
        const d = w ? x[k]! - y[k]! - (z![k]! - w[k]!) : x[k]! - y[k]!;
        e += d * d;
      }
      return Math.sqrt(e / x.length);
    };
    // how far the pose travels, frame to frame (summed, so any span's motion is a subtraction)
    const step = F.map((v, k) => (k ? rms(v, F[k - 1]!) : 0)), sum = [0];
    step.forEach((d, k) => sum.push(sum[k]! + d));
    const typical = step.slice(1).sort((x, y) => x - y)[Math.floor((step.length - 1) / 2)] || 0;
    let best: { cost: number; i: number; j: number } | null = null;
    for (let i = 1; i < F.length - 1; i++)
      for (let j = i + Math.round(src * min); j < Math.min(F.length - 1, i + 2.5 * src); j++) {
        if ((sum[j + 1]! - sum[i + 1]!) / (j - i) < typical / 2) continue;
        const cost = rms(F[i]!, F[j]!) + (0.1 * rms(F[i + 1]!, F[i - 1]!, F[j + 1]!, F[j - 1]!) * src) / 2 + (0.002 * (j - i)) / src;
        if (!best || cost < best.cost) best = { cost, i, j };
      }
    if (!best) throw new IoError("E_FORMAT", `no cycle of ${min} s or more between ${from} s and ${to} s`, { file });
    return [(a + best.i) / src, (a + best.j) / src, best.cost];
  };
  const takes: Record<string, Take> = {}, clips: Record<string, Capture> = {}, lows: number[] = [];
  const low = (W: V3[]) => Math.min(...["toeL", "toeR", "ballL", "ballR"].map((k) => W[POINTS.indexOf(k)]![1]!));
  for (const pk of picks) {
    if (!takes[pk.take]) {
      // a new take: its lowest foot point, frame by frame (where the floor is)
      const T = (takes[pk.take] = takeOf(pk.take));
      for (let k = 0; k < T.frames; k += Math.max(1, Math.round((pk.fps || 120) / 30))) lows.push(low(T.points(k)));
    }
    const T = takes[pk.take]!, src = pk.fps || 120;
    let from = pk.from || 0, to = Math.min(pk.to === undefined ? Infinity : pk.to, (T.frames - 1) / src);
    if (!(to > from) && !(T.frames === 1 && from === 0)) throw new IoError("E_FORMAT", `${pk.name}: ${pk.take} has no frames from ${from} s to ${pk.to} s (it lasts ${((T.frames - 1) / src).toFixed(2)} s)`, { file });
    let seam = 0;
    if (pk.loop) [from, to, seam] = cycle(T, src, from, to, pk.minCycle);
    // a loop's frames are spaced to end exactly on its cycle (a stretch of a few milliseconds at most)
    const n = Math.max(1, Math.round((to - from) * FPS) + 1), step = pk.loop && n > 1 ? (to - from) / (n - 1) : 1 / FPS, world: V3[][] = [];
    if (n > LIMITS.frames) throw new IoError("E_LIMIT", `${pk.name}: ${n} frames, over the limit`, { file });
    for (let f = 0; f < n; f++) world.push(T.points(Math.min(T.frames - 1, Math.round((from + f * step) * src))));
    // facing forward and starting at the origin: turned about the vertical so the hips face forward at the first frame
    // (a loop: the way it travels, when it travels), slid so the root starts at 0
    const travel = sub(world[n - 1]![I]!, world[0]![I]!), far = PORTABLE.hypot(travel[0]!, travel[2]!) > 0.2;
    const ang = pk.loop && far ? PORTABLE.atan2(dot([travel[0]!, 0, travel[2]!], RIGHT), dot([travel[0]!, 0, travel[2]!], fwd0)) : heading(world[0]!);
    const c = PORTABLE.cos(ang), s = PORTABLE.sin(ang), o = world[0]![I]!;
    const spin = (p: V3): V3 => {
      const d = [p[0]! - o[0]!, p[2]! - o[2]!], f = d[0]! * fwd0[0]! + d[1]! * fwd0[2]!, r = d[0]! * RIGHT[0]! + d[1]! * RIGHT[2]!, f2 = f * c + r * s, r2 = -f * s + r * c;
      return [fwd0[0]! * f2 + RIGHT[0]! * r2, p[1]!, fwd0[2]! * f2 + RIGHT[2]! * r2];
    };
    const data = new Float32Array(n * P * 3), move = new Float32Array(n * 2), Wn = world[n - 1]!.map(spin);
    let moved = false;
    world.forEach((W, f) => {
      // the root: the hips (a loop: the straight line from its first frame's hips to its last's, so it plays in place)
      const Wr = W.map(spin), u = n > 1 ? f / (n - 1) : 0, root = pk.loop ? [Wn[I]![0]! * u, 0, Wn[I]![2]! * u] : Wr[I]!, rl = local(root, [0, 0, 0]);
      move[f * 2] = rl[0]! * MM;
      move[f * 2 + 1] = rl[1]! * MM;
      if (!pk.loop && Math.abs(rl[0]!) + Math.abs(rl[1]!) > 0.01) moved = true;
      Wr.forEach((p, i) => {
        const q = local(p, root);
        data[(f * P + i) * 3] = q[0]! * MM;
        data[(f * P + i) * 3 + 1] = q[1]! * MM;
        data[(f * P + i) * 3 + 2] = q[2]! * MM;
      });
    });
    // a loop closes exactly: what its last frame still differs from its first is spread over the cycle (the last frame
    // corrected last)
    if (pk.loop && n > 2) {
      const L = (n - 1) * P * 3;
      for (let f = 1; f < n; f++) for (let k = 0; k < P * 3; k++) data[f * P * 3 + k] -= ((data[L + k]! - data[k]!) * f) / (n - 1);
    }
    clips[pk.name] = { name: pk.name, n, dur: (n - 1) / FPS, loop: !!pk.loop, fps: FPS, data, move: moved ? move : null, take: `${pk.take} ${from.toFixed(2)}-${to.toFixed(2)}` };
    if (pk.loop) log.push(`${pk.name}: a ${(to - from).toFixed(2)} s cycle at ${from.toFixed(2)}-${to.toFixed(2)} s of ${pk.take} (its seam is off by ${Math.round(seam * MM)} mm)`);
  }
  return { clips, lows, log };
}

/**
 * The rest pose as a one-frame capture (`_rest`), stood where the takes stand: its lowest foot point on the floor the
 * lowest foot points keep most often (the most common centimetre among the lower half of `lows`), the pelvis over 0.
 */
export function restCapture(R: V3[], lows: number[], facing: Facing, FPS: number): Capture {
  const POINTS = format.POINTS, P = format.P;
  const low = (W: V3[]) => Math.min(...["toeL", "toeR", "ballL", "ballR"].map((k) => W[POINTS.indexOf(k)]![1]!));
  const lowR = low(R);
  let floor = 0;
  if (lows.length) {
    const half = lows.sort((a, b) => a - b).slice(0, Math.ceil(lows.length / 2)), bins = new Map<number, number>();
    for (const v of half) {
      const b = Math.round(v * 100);
      bins.set(b, (bins.get(b) || 0) + 1);
    }
    floor = [...bins].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0] / 100;
  }
  const rd = new Float32Array(P * 3), lift = floor - lowR, pel = R[POINTS.indexOf("pelvis")]!;
  R.forEach((p, i) => {
    const q = localTo(facing, [p[0]!, p[1]! + lift, p[2]!], [pel[0]!, 0, pel[2]!]);
    rd[i * 3] = q[0]! * MM;
    rd[i * 3 + 1] = q[1]! * MM;
    rd[i * 3 + 2] = q[2]! * MM;
  });
  return { name: "_rest", n: 1, dur: 0, loop: false, fps: FPS, data: rd, move: null };
}
