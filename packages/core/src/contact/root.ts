// The root an in-place clip implies (PLAN.md WP-2.5; riftlight's zero-slide gait, docs/ANIMATION.md:234-244): while
// a foot is planted it slides back under the body exactly as fast as the body moves, so the body's path is the planted
// foot's contact point's, reversed. Sampled once per clip: at each sample the weight-bearing foot (of the planted ones,
// the one nearest under the pelvis), its lowest sole point's velocity; flight phases in-betweened (a one-shot that ends
// off its feet spends its speed over the time a body falls its hip height); summed over loop cycles. A clip with its own
// root travel keeps it.
import { PORTABLE } from "../math/portable.ts";
import { IDX, type Rest } from "../format/body.ts";
import type { Contacts } from "../format/types.ts";
import { rootAt, type Playable, type RootPose } from "../clip/sample.ts";
import { sampleLegs } from "../clip/contacts.ts";

/** Gravity, mm/s². */
const G = 9810;
/** A clip's root over time in millimetres (world: forward, right; heading in degrees), and its mean speed (mm/s). */
export interface ContactRoot {
  root(t: number): RootPose;
  speed: number;
}

/** The root a clip implies: its own root travel (in mm), or, in place, the path its planted feet show. */
export function contactRoot(clip: Playable, R: Rest, contacts: Contacts, fps = 60): ContactRoot {
  if ((clip.keys[0] as { root?: unknown }).root !== undefined) {
    const k = R.H0 / 100;
    const end = rootAt(clip, clip.dur);
    return { root: (t) => {
      const r = rootAt(clip, t);
      return { forward: r.forward * k, right: r.right * k, yaw: r.yaw };
    }, speed: clip.dur > 0 ? (PORTABLE.hypot(end.forward, end.right) * k) / clip.dur : 0 };
  }
  // (the feet and the pelvis are all it reads: sampleAll's points for them, the rest of the body left undecoded)
  const { frames, dt } = sampleLegs(clip, R, fps);
  const n = frames.length - 1, dur = clip.dur;
  const planted = (end: "footL" | "footR", t: number) => (contacts[end] ?? []).some(([a, b]) => (t >= a && t <= b) || (clip.loop && b > dur && t <= b - dur));
  const vel: (number[] | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i * dt, X = frames[i]!;
    let best: string | null = null, bd = Infinity;
    for (const s of ["L", "R"] as const) {
      if (!planted(`foot${s}`, t)) continue;
      // the foot's lowest sole point, and how far it is from under the pelvis
      let low = "ankle" + s, lz = Infinity;
      for (const p of ["ankle", "ball", "toe"]) {
        const z = X[IDX[p + s]! * 3 + 2]! - (p === "ankle" ? R.ankleZ : 0);
        if (z < lz) [low, lz] = [p + s, z];
      }
      const d = PORTABLE.hypot(X[IDX[low]! * 3]! - X[IDX.pelvis! * 3]!, X[IDX[low]! * 3 + 1]! - X[IDX.pelvis! * 3 + 1]!);
      if (d < bd) [best, bd] = [low, d];
    }
    if (!best) {
      vel.push(null);
      continue;
    }
    const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1), j = IDX[best]! * 3, A = frames[i0]!, B = frames[i1]!;
    vel.push([-(B[j]! - A[j]!) / ((i1 - i0) * dt), -(B[j + 1]! - A[j + 1]!) / ((i1 - i0) * dt)]);
  }
  // flight: in-between the velocities either side (round the cycle for a loop); no contact at all: standing still
  const velAt = (i: number) => (clip.loop ? vel[((i % n) + n) % n] : i >= 0 && i <= n ? vel[i] : null) ?? null;
  const v = vel.map((x, i) => {
    if (x) return x;
    let prev = 0, next = 0;
    for (let d = 1; d <= n && !(prev && next); d++) {
      if (!prev && velAt(i - d)) prev = d;
      if (!next && velAt(i + d)) next = d;
    }
    const pv = prev ? velAt(i - prev)! : null, nv = next ? velAt(i + next)! : null;
    if (pv && nv) return [pv[0]! + ((nv[0]! - pv[0]!) * prev) / (prev + next), pv[1]! + ((nv[1]! - pv[1]!) * prev) / (prev + next)];
    // a one-shot that ends off its feet (thrown, falling): its speed is spent over the time a body falls its hip height
    // (held to the clip's end, a knockback's take-off flung the body 7 to 9 hip heights)
    if (pv && !nv) {
      const s = Math.max(0, 1 - (prev * dt) / PORTABLE.sqrt((2 * R.H0) / G));
      return [pv[0]! * s, pv[1]! * s];
    }
    return nv ?? [0, 0];
  });
  // the path: the velocities summed (trapezoids)
  const pos: [number, number][] = [[0, 0]];
  for (let i = 1; i <= n; i++) pos.push([pos[i - 1]![0] + ((v[i - 1]![0]! + v[i]![0]!) / 2) * dt, pos[i - 1]![1] + ((v[i - 1]![1]! + v[i]![1]!) / 2) * dt]);
  const at = (u: number): [number, number] => {
    const f = Math.min(n, Math.max(0, u / dt)), i0 = Math.floor(f), i1 = Math.min(n, i0 + 1), w = f - i0;
    return [pos[i0]![0] + (pos[i1]![0] - pos[i0]![0]) * w, pos[i0]![1] + (pos[i1]![1] - pos[i0]![1]) * w];
  };
  const cycle = pos[n]!;
  return {
    root: (t) => {
      if (!clip.loop || !(dur > 0)) {
        const p = at(Math.min(Math.max(0, t), dur));
        return { forward: p[0], right: p[1], yaw: 0 };
      }
      const k = Math.floor(t / dur), p = at(t - k * dur);
      return { forward: p[0] + k * cycle[0], right: p[1] + k * cycle[1], yaw: 0 };
    },
    speed: dur > 0 ? PORTABLE.hypot(cycle[0], cycle[1]) / dur : 0,
  };
}
