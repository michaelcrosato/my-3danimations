// A clip as the metrics read it (PLAN.md WP-3.3): its body points every 1/60 s on its rest, where the root stands in
// the world at each sample, the key grid (the key poses, or the samples of captured points), where each end stands on
// the floor, its events and keys. A clip that travels carries its own root; an in-place loop that steps is read on a
// treadmill at the speed its planted feet show (its measured travel per cycle), so a foot that slides against that
// speed shows as sliding; an in-place one-shot, or a loop whose feet never lift, stands still. Captured body points
// (frames at a rate, no keys) are read the same way, so a baked or imported motion is measured like a clip.
// Where an end stands is measured, not taken from the clip's contacts or core's: core's detection asks a planted end to
// be still in the world (it plants feet, so it needs where they stay), which leaves a sliding foot unplanted and its
// slide unmeasured. Here an end stands while its lowest point is on the floor and slower than a swing, or carried
// along with the body.
import { clip as clipNs, format, math, measureFacts, type Clip, type Rest } from "@m3a/core";
import { partScale } from "./checks.ts";

const { PORTABLE } = math;

/** A clip the metrics read: a format-2 clip, or its timing and keys with whatever else it has. */
export type MetricClip = Pick<Clip, "dur" | "loop" | "keys"> & Partial<Pick<Clip, "id" | "contacts" | "events" | "tags" | "quality" | "name">>;
/** An end that stands on the floor. */
export type End = "footL" | "footR" | "handL" | "handR";

/** The samples the metrics read. */
export interface Motion {
  id: string;
  dur: number;
  loop: boolean;
  /** Samples per second (60). */
  rate: number;
  /** Seconds between samples (dur / the number of intervals). */
  dt: number;
  /** Each sample's body points (36 × forward, right, up mm), on the root. */
  frames: Float32Array[];
  /** Each sample's time. */
  times: number[];
  /** Where the root stands in the world at each sample: forward and right mm (in the start frame), heading degrees. */
  root: { forward: number; right: number; yaw: number }[];
  /**
   * The key grid: each key's pose and time (a clip's keys, in-betweened linearly, change only there), or each sample
   * for captured points. Jitter and pops read it, so a defect at the key rate isn't averaged away by in-betweens.
   */
  grid: { times: number[]; frames: Float32Array[]; keys: Record<string, unknown>[] | null };
  /** The rest the points are on. */
  rest: Rest;
  /** Where each end stands on the floor (measured: on the floor and slower than a swing; a loop's past dur wraps). */
  contacts: NonNullable<Clip["contacts"]>;
  events: NonNullable<Clip["events"]>;
  /** The key poses, when the motion is a clip (twist flips and joint limits read them). */
  keys: MetricClip["keys"] | null;
  tags: string[];
  quality: MetricClip["quality"] | undefined;
  /**
   * Read each point against the size of the part it is on (`partScale`), not the hip height alone: for a body whose
   * proportions are far from a person's (a chibi's long arms and big torso over short legs). Off by default: the
   * library's thresholds and baselines read every point by H0.
   */
  parts?: boolean;
}

/** A clip sampled for the metrics on rest R, at `rate` samples a second. */
export function motionOf(clip: MetricClip, R: Rest, rate = 60): Motion {
  const sampled = clipNs.sampleAll(clip as Clip, R, rate);
  const facts = measureFacts(clip as Clip, R, { fps: rate });
  const dt = sampled.dt, times = sampled.frames.map((_, i) => i * dt);
  const own = (clip.keys[0] as { root?: unknown }).root !== undefined, k = R.H0 / 100;
  // the treadmill an in-place loop runs on: its measured travel per cycle, in mm per second. Only a loop that steps
  // (a foot lifts and lands again in the cycle: a walk, a limp, a hop) has one; in a stance whose feet never lift, a
  // foot dragged out and back would carry the ground along with it
  const steps = (["footL", "footR"] as const).some((e) => (facts.contacts[e] ?? []).some(([a, b]) => b - a < 0.9 * clip.dur));
  const belt = !own && clip.loop && steps && facts.travel && clip.dur > 0 ? [(facts.travel[0] * k) / clip.dur, (facts.travel[1] * k) / clip.dur] : [0, 0];
  const root = times.map((t) => {
    if (!own) return { forward: belt[0]! * t, right: belt[1]! * t, yaw: 0 };
    const r = clipNs.rootAt(clip as Clip, clip.loop && t >= clip.dur ? clip.dur * (1 - 1e-12) : t);
    return { forward: r.forward * k, right: r.right * k, yaw: r.yaw };
  });
  // the key grid as played: each key up to the end decoded as it is (the in-betweens are straight lines between them),
  // and where the last of them falls short of the end, the pose at the end (a key past it shapes only that stretch,
  // and is never played)
  const all = [...clip.keys].sort((a, b) => a.t - b.t).filter((key, i, K) => i === 0 || key.t > K[i - 1]!.t + 1e-9);
  const keys = all.filter((key) => key.t <= clip.dur + 1e-9);
  if (keys.length < all.length && keys.at(-1)!.t < clip.dur - 1e-9) keys.push({ ...(format.keyAt(clip as Clip, clip.loop ? clip.dur * (1 - 1e-12) : clip.dur) as Record<string, unknown>), t: clip.dur } as never);
  const grid = { times: keys.map((key) => key.t), frames: keys.map((key) => format.decodePose(R, key as never, new Float32Array(format.P * 3)) as Float32Array), keys: keys as unknown as Record<string, unknown>[] };
  const m: Motion = { id: clip.id ?? clip.name ?? "clip", dur: clip.dur, loop: clip.loop, rate, dt, frames: sampled.frames, times, root, grid, rest: R, contacts: { by: "detected" }, events: clip.events ?? [], keys: clip.keys, tags: clip.tags ?? [], quality: clip.quality };
  m.contacts = stance(m);
  return m;
}

/**
 * Captured body points (frames at `rate`, on rest R) as a motion: no keys, the samples its grid. The points are on the
 * root, which stands still unless `root` gives where it stands at each frame (a played clip's root motion), so a loop's
 * seam is read on the body and its feet's slide in the world.
 */
export function motionOfFrames(frames: readonly ArrayLike<number>[], R: Rest, opts: { rate?: number; loop?: boolean; id?: string; tags?: string[]; root?: readonly { forward: number; right: number; yaw: number }[]; parts?: boolean } = {}): Motion {
  const rate = opts.rate ?? 60, dt = 1 / rate, dur = (frames.length - 1) * dt, F = frames.map((f) => Float32Array.from(f));
  if (opts.root && opts.root.length !== F.length) throw new Error(`motionOfFrames: ${opts.root.length} root places for ${F.length} frames; give one per frame`);
  const times = F.map((_, i) => i * dt), root = times.map((_, i) => ({ ...(opts.root?.[i] ?? { forward: 0, right: 0, yaw: 0 }) }));
  const m: Motion = { id: opts.id ?? "frames", dur, loop: opts.loop ?? false, rate, dt, frames: F, times, root, grid: { times, frames: F, keys: null }, rest: R, contacts: { by: "detected" }, events: [], keys: null, tags: opts.tags ?? [], quality: undefined, ...(opts.parts ? { parts: true } : {}) };
  m.contacts = stance(m);
  return m;
}

/** Body point n of a frame. */
export const at = (X: ArrayLike<number>, n: string): [number, number, number] => [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!];
/**
 * A root-frame point in the world. The root's place is added, not its heading: decoding in clip space already turns the
 * body by its `body` turn, the heading included (spec/MOTION.md §5.3: a host turns the character by `yaw` and plays
 * the pose with `body[0] − yaw`), so the world pose is the clip-space pose moved by the root.
 */
export function world(m: Motion, i: number, p: readonly number[]): [number, number, number] {
  const r = m.root[i]!;
  return [r.forward + p[0]!, r.right + p[1]!, p[2]!];
}

/** A foot's sole points (heel, ball, toe), core's: the heel turned with the foot from the standing rest's sole. */
export function sole(m: Motion, X: ArrayLike<number>, s: "L" | "R"): { name: string; p: [number, number, number] }[] {
  return clipNs.sole(m.rest, X, s);
}
const HAND = ["wrist", "knuck", "fist"];
/** An end's points that touch the floor: a foot's sole, a hand's wrist, knuckles and fist. */
export function endPoints(m: Motion, X: ArrayLike<number>, end: End): { name: string; p: [number, number, number] }[] {
  const s = end.slice(-1) as "L" | "R";
  return end.startsWith("foot") ? sole(m, X, s) : HAND.map((n) => ({ name: n, p: at(X, n + s) }));
}
/** An end's lowest point in sample i. */
export function lowest(m: Motion, i: number, end: End): { name: string; p: [number, number, number] } {
  return endPoints(m, m.frames[i]!, end).reduce((a, b) => (b.p[2] < a.p[2] ? b : a));
}

/**
 * How standing is read: on the floor within a band (fractions of H0), and slower than a swing (H0 per second). Set on
 * the library and capture (docs/DECISIONS.md D41): a walk's swinging foot skims the floor at two to four times the
 * walking speed and in big strides lower than the band, so standing is read by speed, not by height alone.
 */
export const STANCE = {
  /** An end comes down within 4% of H0 of the floor (above or below), and lifts past 7% (core's bands). */
  enter: 0.04,
  exit: 0.07,
  /** It stands while slower than half an H0 a second in the world (a slide or a creeping glide runs tens of cm/s)... */
  speed: 0.5,
  /** ...or while it moves with the pelvis within a tenth of an H0 a second (a glide or a dragged foot, however fast). */
  body: 0.1,
  /** Contacts shorter than 0.05 s are dropped, gaps up to 0.1 s closed (a foot rolling from heel to toes). */
  minTime: 0.05,
  mergeTime: 0.1,
};
/**
 * Where each end stands on the floor, measured from the motion in the world (a loop's contact through its seam wraps).
 * With `heights`, by height alone: where an end is down, however it moves (describe counts steps so, since a foot
 * that slides back on an in-place loop without a treadmill still lands and lifts).
 */
export function stance(m: Motion, heights = false): NonNullable<Clip["contacts"]> {
  // read by parts, the bands are the feet's (the hip height of a typical person with this body's chain to the ball)
  const H = m.parts ? m.rest.H0 * partScale(m, "ballL") : m.rest.H0, n = m.frames.length - 1, out: NonNullable<Clip["contacts"]> = { by: "detected" };
  const minF = Math.max(1, Math.round(STANCE.minTime / m.dt)), mergeF = Math.round(STANCE.mergeTime / m.dt), ms = (x: number) => Math.round(x * 1000) / 1000;
  for (const end of ["footL", "footR", "handL", "handR"] as const) {
    const on: boolean[] = [];
    let down = false;
    for (let i = 0; i <= n; i++) {
      const lo = lowest(m, i, end), h = Math.abs(lo.p[2]);
      // the world speed of the lowest point, across the samples either side
      const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1), find = (j: number) => endPoints(m, m.frames[j]!, end).find((x) => x.name === lo.name)!.p;
      const w0 = world(m, i0, find(i0)), w1 = world(m, i1, find(i1)), v = i1 > i0 ? PORTABLE.hypot(w1[0] - w0[0], w1[1] - w0[1]) / ((i1 - i0) * m.dt) : 0;
      // and its speed against the pelvis: a foot carried along with the body (a glide, a dragged foot) stands however fast
      const p0 = world(m, i0, at(m.frames[i0]!, "pelvis")), p1 = world(m, i1, at(m.frames[i1]!, "pelvis"));
      const rel = i1 > i0 ? PORTABLE.hypot(w1[0] - w0[0] - (p1[0] - p0[0]), w1[1] - w0[1] - (p1[1] - p0[1])) / ((i1 - i0) * m.dt) : 0;
      down = (down ? h <= STANCE.exit * H : h <= STANCE.enter * H) && (heights || v <= STANCE.speed * H || rel <= STANCE.body * H);
      on.push(down);
    }
    let runs: [number, number][] = [];
    for (let i = 0; i <= n; i++) if (on[i] && (i === 0 || !on[i - 1])) runs.push([i, i]);
    else if (on[i]) runs[runs.length - 1]![1] = i;
    const merged: [number, number][] = [];
    for (const r of runs) {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] - 1 <= mergeF) last[1] = r[1];
      else merged.push([...r]);
    }
    runs = merged.filter(([a, b]) => b - a + 1 >= minF);
    if (!runs.length) continue;
    let iv: [number, number][] = runs.map(([a, b]) => [ms(m.times[a]!), ms(m.times[b]!)]);
    if (m.loop && iv.length > 1 && runs[0]![0] === 0 && runs[runs.length - 1]![1] === n) {
      const first = iv.shift()!;
      iv[iv.length - 1] = [iv[iv.length - 1]![0], ms(m.dur + first[1])];
    }
    iv = iv.filter(([a, b]) => b > a);
    if (iv.length) out[end] = iv;
  }
  return out;
}
/** Whether end `end` stands on the floor at time t. */
export const planted = (m: Motion, end: End, t: number): boolean => clipNs.contactsAt({ dur: m.dur, loop: m.loop, keys: [], contacts: m.contacts } as never, t)[end];
