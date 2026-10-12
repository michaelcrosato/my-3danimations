// Tracks (spec/RECIPE.md §1): what every recipe step makes. A track holds frames on its rate's grid (every 1/fps s
// from 0, so they fall on the keys of a clip fitted at that rate; a once track ends with a frame at `dur`, a loop's last
// interval runs to `dur`, where its first frame comes round again), each a pose and the root relative to the start;
// a loop also knows its cycle's travel, so a longer read continues where the last cycle ended. Reading a track between
// frames blends the two either side (angles the short way round), as a clip in-betweens its keys.
import { keyAt } from "../format/sample.ts";
import type { Rest } from "../format/body.ts";
import type { KeyLike } from "../format/pose.ts";
import type { Clip, Contacts, Key } from "../format/types.ts";
import { rootAt as clipRootAt, type Playable } from "../clip/sample.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import { blend, type Pose } from "../ops/pose.ts";
import { loopify, slice } from "../ops/time.ts";
import type { Root, Track } from "./types.ts";

/** The frame times of a track of `dur` seconds at `fps`: every 1/fps s from 0 (to the ms), and `dur` for a once track. */
export function frameTimes(dur: number, loop: boolean, fps: number): number[] {
  const out: number[] = [];
  for (let i = 0; ; i++) {
    const t = ms(i / fps);
    if (t > dur - 0.0005) break;
    out.push(t);
  }
  if (!out.length) out.push(0);
  if (!loop && dur > out[out.length - 1]! + 0.0005) out.push(dur);
  return out;
}

const DEG = Math.PI / 180;
/** a then b: b's travel turned by a's heading, the headings added (the format's frame). */
export function compose(a: Root, b: Root): Root {
  const c = PM.cos(a.yaw * DEG), s = PM.sin(a.yaw * DEG);
  return { forward: a.forward + b.forward * c - b.right * s, right: a.right + b.forward * s + b.right * c, yaw: a.yaw + b.yaw };
}
/** The inverse of a root. */
export function invert(a: Root): Root {
  const c = PM.cos(a.yaw * DEG), s = PM.sin(a.yaw * DEG);
  return { forward: -(a.forward * c + a.right * s), right: -(-a.forward * s + a.right * c), yaw: -a.yaw };
}
/** a toward b by w, each number linearly. */
export const lerpRoot = (a: Root, b: Root, w: number): Root => ({ forward: a.forward + (b.forward - a.forward) * w, right: a.right + (b.right - a.right) * w, yaw: a.yaw + (b.yaw - a.yaw) * w });
/** The root that doesn't move. */
export const STILL: Root = { forward: 0, right: 0, yaw: 0 };

/** Where a time falls between frames: the frame before, the one after (a loop's first, past its last) and how far. */
function between(t: Track, time: number): [number, number, number] {
  const n = t.times.length;
  if (n === 1 && !t.loop) return [0, 0, 0];
  const u = t.loop ? ((time % t.dur) + t.dur) % t.dur : Math.min(Math.max(0, time), t.dur);
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t.times[mid]! <= u) lo = mid;
    else hi = mid - 1;
  }
  if (lo === n - 1) return t.loop ? [lo, 0, (u - t.times[lo]!) / Math.max(1e-9, t.dur - t.times[lo]!)] : [lo, lo, 0];
  return [lo, lo + 1, (u - t.times[lo]!) / Math.max(1e-9, t.times[lo + 1]! - t.times[lo]!)];
}
/** The pose at a time (a loop wraps, a once track holds its ends). */
export function poseAt(t: Track, time: number): Pose {
  const [i, j, w] = between(t, time);
  return w === 0 ? { ...t.poses[i]! } : blend(t.poses[i]!, t.poses[j]!, w);
}
/** The loop's travel over one cycle (none for a once track). */
export function cycleOf(t: Track): Root {
  return t.loop ? (t.cycle ?? STILL) : STILL;
}
/** The root at a time: a loop's cycles compose, a once track holds its ends. A loop whose first root isn't the start's
 *  (a pose step's turn) repeats its cycle in that frame: at k cycles on, r0 ∘ cycleᵏ ∘ r0⁻¹ ∘ root. */
export function rootAt(t: Track, time: number): Root {
  if (!t.loop) {
    const [i, j, w] = between(t, time);
    return lerpRoot(t.roots[i]!, t.roots[j]!, w);
  }
  const k = Math.floor(time / t.dur), u = time - k * t.dur, cyc = cycleOf(t), r0 = t.roots[0]!;
  let acc = STILL;
  const step = k >= 0 ? cyc : invert(cyc);
  for (let c = 0; c < Math.abs(k); c++) acc = compose(acc, step);
  // past the last frame the root goes on to where the next cycle starts
  const [i, j, w] = between(t, u), next = compose(r0, cyc), at = lerpRoot(t.roots[i]!, j === 0 && i !== 0 ? next : t.roots[j]!, w);
  return k === 0 ? at : compose(compose(r0, acc), compose(invert(r0), at));
}
/** Where a loop's next cycle starts: its first root carried round one cycle. */
export const nextCycle = (t: Track): Root => compose(t.roots[0]!, cycleOf(t));

/** A track as a playable clip: its frames as keys (a loop closed by its first pose at `dur`). */
export function playable(t: Track): Playable {
  const keys = t.poses.map((p, i) => ({ ...p, t: t.times[i]! }) as unknown as Key);
  if (t.loop) keys.push({ ...t.poses[0]!, t: t.dur } as unknown as Key);
  return { dur: t.dur, loop: t.loop, keys };
}

/** A pose without the root's fields. */
function bodyOf(k: KeyLike): Pose {
  const { t: _t, root: _r, yaw: _y, ...rest } = k;
  return rest;
}

/**
 * A library clip as a track at `fps`: sliced to `from`–`to` when given, closed into a loop when `loop` asks (true
 * closes a once clip over 0.25 s, a number over that many seconds; a loop stays one).
 */
export function trackOfClip(clip: Clip, rest: Rest, fps: number, opts: { from?: number; to?: number; loop?: boolean | number } = {}): Track {
  let c: Clip = clip;
  if (opts.from !== undefined || opts.to !== undefined) c = slice(c, opts.from ?? 0, opts.to ?? c.dur);
  if (opts.loop !== undefined && opts.loop !== false && (!c.loop || typeof opts.loop === "number")) c = loopify(c, typeof opts.loop === "number" ? opts.loop : Math.min(0.25, c.dur / 3));
  const t: Track = { dur: c.dur, loop: c.loop, fps, times: frameTimes(c.dur, c.loop, fps), poses: [], roots: [], events: [...(c.events ?? [])], rest, restSrc: c.restSrc, sources: [clip.id], ...(c.contacts ? { contacts: c.contacts } : {}) };
  for (const time of t.times) {
    t.poses.push(bodyOf(keyAt(c, time) as KeyLike));
    const r = clipRootAt(c, time);
    t.roots.push({ forward: r.forward, right: r.right, yaw: r.yaw });
  }
  if (c.loop) {
    const r = clipRootAt(c, c.dur);
    t.cycle = { forward: r.forward, right: r.right, yaw: r.yaw };
  }
  return t;
}

/**
 * A track's contacts moved by `map` and kept within 0–dur. A loop's are read round its cycle: an interval past `from`'s
 * end (`to > oldDur`) is the same contact carried over the seam, mapped as its two parts, and the result written the
 * format's way (§7.1): sorted, merged, the last one wrapping past `dur` where it carries over to the start.
 */
export function shiftContacts(c: Contacts | undefined, map: (time: number) => number, dur: number, loop = false, oldDur = dur): Contacts | undefined {
  if (!c) return undefined;
  const out: Contacts = { by: c.by };
  for (const end of ["footL", "footR", "handL", "handR"] as const) {
    let iv = c[end] ?? [];
    if (loop) iv = iv.flatMap(([a, b]): [number, number][] => (b > oldDur + 1e-9 ? [[a, oldDur], [0, b - oldDur]] : [[a, b]]));
    const mapped = iv.map(([a, b]): [number, number] => [ms(map(a)), ms(map(b))]).filter(([a, b]) => b > a && a < dur && b > 0).map(([a, b]): [number, number] => [Math.max(0, a), Math.min(dur, b)]);
    const written = loop ? cyclic(mapped, dur) : mapped;
    if (written.length) out[end] = written;
  }
  return out;
}
/** Intervals on a loop of length dur (each within 0–dur), sorted and merged, the one ending at dur joined to the one
 *  starting at 0 as a last interval that wraps. */
export function cyclic(iv: readonly [number, number][], dur: number): [number, number][] {
  const merged: [number, number][] = [];
  for (const [a, b] of [...iv].sort((x, y) => x[0] - y[0])) {
    const l = merged[merged.length - 1];
    if (l && a <= l[1] + 1e-9) l[1] = Math.max(l[1], b);
    else merged.push([a, b]);
  }
  const first = merged[0], last = merged[merged.length - 1];
  if (merged.length > 1 && first && last && first[0] <= 1e-9 && last[1] >= dur - 1e-9) {
    merged.shift();
    last[1] = ms(dur + first[1]);
  }
  return merged;
}
/** A time rounded to the millisecond. */
export const ms = (t: number): number => Math.round(t * 1000) / 1000;
