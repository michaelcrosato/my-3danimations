// The style operators (spec/RECIPE.md §2): exaggerate, smooth, overshoot and stiffen, each over every number of the
// masked fields across a track's frames (a loop's frames wrap round). Numbers stay within their fields' ranges; the
// root is left as it is.
import { KEY_FIELDS } from "../format/types.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import type { Mask, Pose } from "../ops/pose.ts";
import type { Track } from "./types.ts";

/** The fields a mask moves and how much (all of them without a mask). */
const weightOf = (m: Mask | undefined, f: string): number => (m ? (m[f] ?? 0) : 1);
/** A number kept within its field's range (angles unbounded but for the format's own bound). */
function clampTo(f: string, i: number, v: number): number {
  const r = KEY_FIELDS[f]?.ranges[i];
  return r ? Math.min(r[1], Math.max(r[0], v)) : v;
}

/** A track's poses with every masked number replaced: `map` gets a field, a component and the series over frames. */
function each(t: Track, m: Mask | undefined, map: (f: string, i: number, series: number[], w: number) => number[]): Track {
  const n = t.poses.length, out: Pose[] = t.poses.map((p) => ({ ...p }));
  const fields = Object.keys(t.poses[0] ?? {}).filter((f) => Array.isArray(t.poses[0]![f]) && weightOf(m, f) > 0);
  for (const f of fields) {
    const width = (t.poses[0]![f] as number[]).length;
    for (let i = 0; i < width; i++) {
      const s = t.poses.map((p) => ((p[f] as number[] | undefined)?.[i] ?? 0)), next = map(f, i, s, weightOf(m, f));
      for (let k = 0; k < n; k++) {
        const v = (out[k]![f] as number[] | undefined)?.slice();
        if (!v) continue;
        v[i] = clampTo(f, i, next[k]!);
        out[k]![f] = v;
      }
    }
  }
  return { ...t, poses: out };
}
const mean = (s: readonly number[]) => s.reduce((a, b) => a + b, 0) / s.length;

/** Every pose further from the track's mean pose: `amount` 1.25 moves a quarter further, 0.5 half as far. */
export function exaggerate(t: Track, amount: number, m?: Mask): Track {
  return each(t, m, (_f, _i, s, w) => {
    const c = mean(s), k = 1 + (amount - 1) * w;
    return s.map((v) => c + (v - c) * k);
  });
}

/** A series smoothed by a Gaussian of `window` seconds (σ half of it); a loop wraps, a once track holds its ends. */
function gaussian(s: readonly number[], window: number, fps: number, loop: boolean): number[] {
  const sigma = Math.max(1e-6, (window / 2) * fps), r = Math.ceil(3 * sigma), n = s.length, kern: number[] = [];
  for (let d = -r; d <= r; d++) kern.push(PM.exp(-(d * d) / (2 * sigma * sigma)));
  const total = kern.reduce((a, b) => a + b, 0);
  return s.map((_, i) => {
    let acc = 0;
    for (let d = -r; d <= r; d++) acc += kern[d + r]! * s[loop ? (((i + d) % n) + n) % n : Math.min(n - 1, Math.max(0, i + d))]!;
    const v = acc / total;
    // a once track's ends stay where they were, easing into the smoothed motion over the kernel's reach
    if (loop) return v;
    const edge = Math.min(i, n - 1 - i) / Math.max(1, r);
    return s[i]! + (v - s[i]!) * Math.min(1, edge);
  });
}
/** Each masked number averaged over `window` seconds. */
export function smooth(t: Track, window: number, m?: Mask): Track {
  return each(t, m, (_f, _i, s, w) => gaussian(s, window, t.fps, t.loop).map((v, k) => s[k]! + (v - s[k]!) * w));
}

/** A spring that follows a series (4 Hz, damping ζ), integrated in quarter frames; a loop's second pass. */
function follow(s: readonly number[], fps: number, zeta: number, loop: boolean): number[] {
  const omega = 2 * Math.PI * 4, dt = 1 / fps / 4, n = s.length, out = new Array<number>(n);
  let y = s[0]!, v = 0;
  for (let pass = 0; pass < (loop ? 2 : 1); pass++) {
    for (let k = 0; k < n; k++) {
      for (let sub = 0; sub < 4; sub++) {
        v += (omega * omega * (s[k]! - y) - 2 * zeta * omega * v) * dt;
        y += v * dt;
      }
      out[k] = y;
    }
  }
  return out;
}
/** Where a masked part stops it carries on and settles back: the ringing of an underdamped spring over a critically
 *  damped one that follow the same motion, `amount` of it. */
export function overshoot(t: Track, amount: number, m?: Mask): Track {
  return each(t, m, (_f, _i, s, w) => {
    const ring = follow(s, t.fps, 0.3, t.loop), calm = follow(s, t.fps, 1, t.loop);
    return s.map((v, k) => v + (ring[k]! - calm[k]!) * amount * w);
  });
}

/** The masked parts (the upper body by default) move less about their mean and smoother: smoothed over up to 0.4 s and
 *  their range cut by up to a half, by `amount`. */
export function stiffen(t: Track, amount: number, m: Mask): Track {
  return exaggerate(smooth(t, 0.1 + 0.3 * amount, Object.fromEntries(Object.entries(m).map(([f, w]) => [f, w * amount]))), 1 - 0.5 * amount, m);
}
