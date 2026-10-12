// Takes cut into clips (PLAN.md WP-5.2; carried from my-3d2dge tools/asf-amc.mjs readCmu, bit for bit, and shared by
// every capture format: CMU's ASF/AMC, BVH). A take is frames of the 36 body points in the world (metres, y up); a pick
// names its stretch. Each clip starts at the origin facing forward; a loop is cut at its best cycle (poses and speeds
// matching at its ends), faces the way it travels with its root on the straight line through the cycle, and what its
// last frame still differs from its first is spread over the cycle so it closes exactly. The rest pose is stood on
// the floor the takes stand on: the height the lowest foot point keeps most often.
// A pick may also find its own stretch (WP-5.6; shardfall's takes.rs, for a database of long takes like 100STYLE's):
// the longest straight run of the hips, the longest pass going a way of where the hips face (a loop then cut from the
// pass whose cycle is cleanest, facing forward), the longest stretch where the hips stay put, or the stretch as given.
// A pick that finds nothing changes nothing for a pick that doesn't ask: those cut exactly as before.
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
  /** With no stretch given (or within `from`-`to`): find one. `straight`, the longest run where the hips travel
   *  straight and steadily; a way (`forward`, `back`, `left`, `right`), the longest pass going that way of where the
   *  hips face, never doubling back; `still`, the longest stretch where the hips stay put; `whole`, the stretch as
   *  given, a loop as it is. */
  find?: Find;
}
/** How a pick finds its stretch (`Pick.find`). */
export type Find = "straight" | "still" | "whole" | Way;
/** Which way a stretch travels, seen from the hips. */
export type Way = "forward" | "right" | "back" | "left";
const WAYS: Readonly<Record<Way, number>> = { forward: 0, right: 1, back: 2, left: -1 };
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
/** An angle brought into −π..π. */
const wrap = (a: number) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
/** A sample of the hips on the floor: seconds, x, z, and the way they face (x, z). */
type Hip = [number, number, number, number, number];

/** The hips on the floor every tenth of a second. */
function hipsPath(T: Take, src: number): Hip[] {
  const I = format.POINTS.indexOf("pelvis"), J = format.POINTS.indexOf("pelvisF"), step = Math.max(1, Math.round(src / 10)), out: Hip[] = [];
  for (let f = 0; f < T.frames; f += step) {
    const W = T.points(f), p = W[I]!, h = sub(W[J]!, p);
    out.push([f / src, p[0]!, p[2]!, h[0]!, h[2]!]);
  }
  return out;
}
/** The hips' path within `window` (else all but the first and last 3 s, for a stretch that moves: a performer walks
 *  in and out of the capture area at an ordinary pace before and after taking up a style). */
function pathIn(T: Take, src: number, still: boolean, window: [number, number] | null): Hip[] {
  const p = hipsPath(T, src);
  if (window) return p.filter((q) => q[0] >= window[0] && q[0] <= window[1]);
  if (!still && p.length > 1) {
    const last = p[p.length - 1]![0];
    return p.filter((q) => q[0] >= 3 && q[0] <= last - 3);
  }
  return p;
}
/** Every straight run of the path: for each sample, the furthest one it runs straight to (`way`: going that way of
 *  where the hips face, never doubling back). */
function runs(p: Hip[], way: Way | null, facing: Facing): [number, number][] {
  const n = p.length, { fwd, right } = facing;
  // every hip position within 12 cm of the line from the run's start to its end (a sway or a lurch stays inside; a
  // turn does not), covering at least 10 cm a second
  const off = (i: number, j: number, k: number) => {
    const ax = p[i]![1], az = p[i]![2], dx = p[j]![1] - ax, dz = p[j]![2] - az, l = Math.max(Math.sqrt(dx * dx + dz * dz), 1e-9);
    return Math.abs((p[k]![1] - ax) * dz - (p[k]![2] - az) * dx) / l;
  };
  // going a way: never more than 5 cm back along the line, heading that way of where the hips face on average (45°)
  const onward = (i: number, j: number) => {
    const dx = p[j]![1] - p[i]![1], dz = p[j]![2] - p[i]![2], l = Math.max(Math.sqrt(dx * dx + dz * dz), 1e-9);
    let most = -Infinity;
    for (let k = i; k <= j; k++) {
      const along = ((p[k]![1] - p[i]![1]) * dx + (p[k]![2] - p[i]![2]) * dz) / l;
      most = Math.max(most, along);
      if (along < most - 0.05) return false;
    }
    return true;
  };
  const headingOk = (i: number, j: number, w: Way) => {
    const ang = (x: number, z: number) => PORTABLE.atan2(x * right[0]! + z * right[2]!, x * fwd[0]! + z * fwd[2]!);
    let hx = 0, hz = 0;
    for (let k = i; k <= j; k++) {
      const l = Math.max(Math.sqrt(p[k]![3] * p[k]![3] + p[k]![4] * p[k]![4]), 1e-9);
      hx += p[k]![3] / l;
      hz += p[k]![4] / l;
    }
    return Math.abs(wrap(ang(p[j]![1] - p[i]![1], p[j]![2] - p[i]![2]) - ang(hx, hz) - (Math.PI / 2) * WAYS[w])) < Math.PI / 4;
  };
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let j = i;
    const straight = (j2: number) => {
      for (let k = i; k <= j2; k++) if (!(off(i, j2, k) < 0.12)) return false;
      return true;
    };
    while (j + 1 < n && straight(j + 1) && (way === null || onward(i, j + 1))) j++;
    const fast = (k: number) => Math.sqrt((p[k]![1] - p[i]![1]) ** 2 + (p[k]![2] - p[i]![2]) ** 2) >= 0.1 * (p[k]![0] - p[i]![0]);
    while (j > i && !fast(j)) j--;
    if (j > i && (way === null || headingOk(i, j, way))) out.push([i, j]);
  }
  return out;
}
/** Every pass of a take going `way` (seconds, within `window`), longest first: a performer crossing a capture area
 *  again and again, a second or more each time once the steps into and out of the turns are left out. */
function passes(T: Take, src: number, way: Way, window: [number, number] | null, facing: Facing): [number, number][] {
  const p = pathIn(T, src, false, window), all = runs(p, way, facing).sort((x, y) => y[1] - y[0] - (x[1] - x[0]) || x[0] - y[0]), kept: [number, number][] = [];
  for (const [i, j] of all) if (kept.every(([a, b]) => j < a || i > b)) kept.push([i, j]);
  return kept.map(([i, j]): [number, number] => [p[i]![0] + 0.3, p[j]![0] - 0.3]).filter(([a, b]) => b - a >= 1);
}
/** A stretch (seconds) of a take found as `how` asks, within `window` when given. */
function findStretch(T: Take, src: number, how: Find, window: [number, number] | null, facing: Facing): [number, number] | null {
  if (how === "whole") return window;
  if (how in WAYS) return passes(T, src, how as Way, window, facing)[0] ?? null;
  const p = pathIn(T, src, how === "still", window), n = p.length;
  let best: [number, number] | null = null;
  const longer = (i: number, j: number) => !best || j - i > best[1] - best[0];
  if (how === "straight") {
    for (const [i, j] of runs(p, null, facing)) if (longer(i, j)) best = [i, j];
    if (!best) return null;
    // less the steps into and out of the turns at either end
    const a = p[best[0]]![0] + 0.3, b = p[best[1]]![0] - 0.3;
    return b - a >= 1.5 ? [a, b] : null;
  }
  // still: the hips within 15 cm of where the stretch began
  for (let i = 0; i < n; i++) {
    let j = i;
    while (j + 1 < n && Math.sqrt((p[j + 1]![1] - p[i]![1]) ** 2 + (p[j + 1]![2] - p[i]![2]) ** 2) < 0.15) j++;
    if (longer(i, j)) best = [i, j];
  }
  if (!best) return null;
  const a = p[best[0]]![0] + 0.2, b = p[best[1]]![0] - 0.2;
  return b - a >= 1 ? [a, b] : null;
}

/** A point in the rig's frame (forward, right, up; metres) from the world, about origin o on the floor. */
export function localTo(f: Facing, p: V3, o: V3): V3 {
  const d = [p[0]! - o[0]!, p[1]!, p[2]! - o[2]!];
  return [d[0]! * f.fwd[0]! + d[2]! * f.fwd[2]!, d[0]! * f.right[0]! + d[2]! * f.right[2]!, d[1]!];
}

/**
 * Each pick cut from its take as a clip, and the takes' lowest foot points (where the floor is). `lenient`: a pick that
 * can't be cut (no stretch going its way, no cycle) is left out with the reason logged, rather than failing them all
 * (a catalog of a hundred styles).
 */
export function cutPicks(takeOf: (take: string) => Take, facing: Facing, picks: readonly Pick[], FPS: number, file?: string, opts: { lenient?: boolean } = {}): { clips: Record<string, Capture>; lows: number[]; log: string[] } {
  const POINTS = format.POINTS, P = format.P, { fwd: fwd0, right: RIGHT } = facing, log: string[] = [];
  const I = POINTS.indexOf("pelvis"), J = POINTS.indexOf("pelvisF");
  const local = (p: V3, o: V3) => localTo(facing, p, o);
  const heading = (W: V3[]) => {
    const h = sub(W[J]!, W[I]!);
    return PORTABLE.atan2(dot([h[0]!, 0, h[2]!], RIGHT), dot([h[0]!, 0, h[2]!], fwd0));
  };
  /** The best cycle in [from, to] (seconds): frames i < j, `min` to `longest` s apart (2.5 s; a pick that finds its
   *  stretch, `min` + 1.5 s when longer: an idle's breathing and weight shifts), whose poses (from the hips, facing the
   *  same way) and speeds match best, among spans that keep moving (half as fast as the stretch's typical frame).
   *  `steady`: a cycle that turns the body costs too (20 cm a radian: just after a turn a performer can match their
   *  own pose while still coming round). */
  const cycle = (T: Take, src: number, from: number, to: number, min = 0.5, longest = 2.5, steady = false): [number, number, number] => {
    const a = Math.round(from * src), b = Math.min(T.frames - 1, Math.round(to * src)), F: Float64Array[] = [], heads: number[] = [];
    for (let k = a; k <= b; k++) {
      const W = T.points(k), g = -heading(W), c = PORTABLE.cos(g), s = PORTABLE.sin(g), o = W[I]!, v = new Float64Array(P * 3);
      heads.push(-g);
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
      for (let j = i + Math.round(src * min); j < Math.min(F.length - 1, i + longest * src); j++) {
        if ((sum[j + 1]! - sum[i + 1]!) / (j - i) < typical / 2) continue;
        let cost = rms(F[i]!, F[j]!) + (0.1 * rms(F[i + 1]!, F[i - 1]!, F[j + 1]!, F[j - 1]!) * src) / 2 + (0.002 * (j - i)) / src;
        if (steady) cost += 0.2 * Math.abs(wrap(heads[j]! - heads[i]!));
        if (!best || cost < best.cost) best = { cost, i, j };
      }
    if (!best) throw new IoError("E_FORMAT", `no cycle of ${min} s or more between ${from} s and ${to} s`, { file });
    return [(a + best.i) / src, (a + best.j) / src, best.cost];
  };
  const takes: Record<string, Take> = {}, clips: Record<string, Capture> = {}, lows: number[] = [];
  const low = (W: V3[]) => Math.min(...["toeL", "toeR", "ballL", "ballR"].map((k) => W[POINTS.indexOf(k)]![1]!));
  for (const pk of picks) {
    try {
      cutOne(pk);
    } catch (err) {
      if (!opts.lenient || !(err instanceof IoError)) throw err;
      log.push(`left out ${pk.name}: ${err.message}`);
    }
  }
  return { clips, lows, log };

  /** One pick cut into `clips`. */
  function cutOne(pk: Pick): void {
    if (!takes[pk.take]) {
      // a new take: its lowest foot point, frame by frame (where the floor is)
      const T = (takes[pk.take] = takeOf(pk.take));
      for (let k = 0; k < T.frames; k += Math.max(1, Math.round((pk.fps || 120) / 30))) lows.push(low(T.points(k)));
    }
    const T = takes[pk.take]!, src = pk.fps || 120, last = (T.frames - 1) / src, how = pk.find;
    // a stretch found: a loop going a way, cut from the pass that holds the cleanest cycle; else as `how` asks
    let found: [number, number] | null = null;
    if (how) {
      const window: [number, number] | null = pk.from === undefined && pk.to === undefined ? null : [pk.from ?? 0, pk.to ?? last];
      if (how in WAYS && pk.loop) {
        const all = passes(T, src, how as Way, window, facing);
        let best: { cost: number; at: [number, number] } | null = null;
        for (const at of all) {
          try {
            const [, , cost] = cycle(T, src, at[0], at[1], pk.minCycle, Math.max(2.5, (pk.minCycle ?? 0.5) + 1.5), true);
            if (!best || cost < best.cost) best = { cost, at };
          } catch {
            // no cycle in this pass: another may hold one
          }
        }
        if (all.length) log.push(`${pk.name}: ${all.length} passes of ${pk.take} going ${how}`);
        found = best?.at ?? null;
      } else found = findStretch(T, src, how, window, facing);
      if (how in WAYS && !found) throw new IoError("E_FORMAT", `${pk.name}: ${pk.take} has no straight stretch going ${how}`, { file });
      if (found && how !== "whole") log.push(`${pk.name}: ${how === "still" ? "a still" : "a straight"} stretch of ${pk.take} at ${found[0].toFixed(2)}-${found[1].toFixed(2)} s`);
    }
    let from = found ? found[0] : pk.from || 0, to = Math.min(found ? found[1] : pk.to === undefined ? Infinity : pk.to, last);
    if (!(to > from) && !(T.frames === 1 && from === 0)) throw new IoError("E_FORMAT", `${pk.name}: ${pk.take} has no frames from ${from} s to ${pk.to} s (it lasts ${last.toFixed(2)} s)`, { file });
    let seam = 0;
    if (pk.loop && how !== "whole") [from, to, seam] = how ? cycle(T, src, from, to, pk.minCycle, Math.max(2.5, (pk.minCycle ?? 0.5) + 1.5), how in WAYS) : cycle(T, src, from, to, pk.minCycle);
    // a loop's frames are spaced to end exactly on its cycle (a stretch of a few milliseconds at most)
    const n = Math.max(1, Math.round((to - from) * FPS) + 1), step = pk.loop && n > 1 ? (to - from) / (n - 1) : 1 / FPS, world: V3[][] = [];
    if (n > LIMITS.frames) throw new IoError("E_LIMIT", `${pk.name}: ${n} frames, over the limit`, { file });
    for (let f = 0; f < n; f++) world.push(T.points(Math.min(T.frames - 1, Math.round((from + f * step) * src))));
    // facing forward and starting at the origin: turned about the vertical so the hips face forward at the first frame
    // (a loop: the way it travels, when it travels), slid so the root starts at 0
    // (a loop going a way faces the way the hips face over the cycle, so a backward walk or a sidestep faces forward)
    const travel = sub(world[n - 1]![I]!, world[0]![I]!), far = PORTABLE.hypot(travel[0]!, travel[2]!) > 0.2;
    let ang: number;
    if (pk.loop && how && how in WAYS) {
      const h = [0, 0, 0];
      for (const W of world) {
        const d = sub(W[J]!, W[I]!), l = Math.max(Math.sqrt(d[0]! * d[0]! + d[2]! * d[2]!), 1e-9);
        h[0] += d[0]! / l;
        h[2] += d[2]! / l;
      }
      ang = PORTABLE.atan2(dot(h, RIGHT), dot(h, fwd0));
    } else ang = pk.loop && far ? PORTABLE.atan2(dot([travel[0]!, 0, travel[2]!], RIGHT), dot([travel[0]!, 0, travel[2]!], fwd0)) : heading(world[0]!);
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
    if (pk.loop && how !== "whole") log.push(`${pk.name}: a ${(to - from).toFixed(2)} s cycle at ${from.toFixed(2)}-${to.toFixed(2)} s of ${pk.take} (its seam is off by ${Math.round(seam * MM)} mm)`);
  }
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
