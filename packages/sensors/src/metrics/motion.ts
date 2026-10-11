// A clip as the metrics read it (PLAN.md WP-3.3): its body points every 1/60 s on its rest, where the root stands in
// the world at each sample, its contacts, events and keys. A clip that travels carries its own root; an in-place loop
// is read on a treadmill at the speed its planted feet show (its measured travel per cycle), so a foot that slides
// against that speed shows as sliding; an in-place one-shot stands still. Captured body points (frames at a rate, no
// keys) are read the same way, so a baked or imported motion is measured like a clip.
import { clip as clipNs, format, math, measureFacts, type Clip, type Rest } from "@m3a/core";

const { PORTABLE } = math;

/** A clip the metrics read: a format-2 clip, or its timing and keys with whatever else it has. */
export type MetricClip = Pick<Clip, "dur" | "loop" | "keys"> & Partial<Pick<Clip, "id" | "contacts" | "events" | "tags" | "quality" | "name">>;

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
  /** Where the root stands in the world at each sample: forward and right mm, heading degrees. */
  root: { forward: number; right: number; yaw: number }[];
  /** The rest the points are on. */
  rest: Rest;
  /** Planted intervals per end (the clip's, or detected). */
  contacts: NonNullable<Clip["contacts"]>;
  events: NonNullable<Clip["events"]>;
  /** The key poses, when the motion is a clip (twist flips and joint limits read them). */
  keys: MetricClip["keys"] | null;
  tags: string[];
  quality: MetricClip["quality"] | undefined;
}

/** A clip sampled for the metrics on rest R, at `rate` samples a second. */
export function motionOf(clip: MetricClip, R: Rest, rate = 60): Motion {
  const sampled = clipNs.sampleAll(clip as Clip, R, rate);
  const facts = measureFacts(clip as Clip, R, { fps: rate });
  const dt = sampled.dt, times = sampled.frames.map((_, i) => i * dt);
  const own = (clip.keys[0] as { root?: unknown }).root !== undefined, k = R.H0 / 100;
  // the treadmill an in-place loop runs on: its measured travel per cycle, in mm per second
  const belt = !own && clip.loop && facts.travel && clip.dur > 0 ? [(facts.travel[0] * k) / clip.dur, (facts.travel[1] * k) / clip.dur] : [0, 0];
  const root = times.map((t) => {
    if (!own) return { forward: belt[0]! * t, right: belt[1]! * t, yaw: 0 };
    const r = clipNs.rootAt(clip as Clip, clip.loop && t >= clip.dur ? clip.dur * (1 - 1e-12) : t);
    return { forward: r.forward * k, right: r.right * k, yaw: r.yaw };
  });
  return { id: clip.id ?? clip.name ?? "clip", dur: clip.dur, loop: clip.loop, rate, dt, frames: sampled.frames, times, root, rest: R, contacts: facts.contacts, events: clip.events ?? [], keys: clip.keys, tags: clip.tags ?? [], quality: clip.quality };
}

/** Captured body points (frames at `rate`, on rest R) as a motion: no keys, contacts detected, standing still. */
export function motionOfFrames(frames: readonly ArrayLike<number>[], R: Rest, opts: { rate?: number; loop?: boolean; id?: string; tags?: string[] } = {}): Motion {
  const rate = opts.rate ?? 60, dt = 1 / rate, dur = (frames.length - 1) * dt, F = frames.map((f) => Float32Array.from(f));
  const times = F.map((_, i) => i * dt), root = times.map(() => ({ forward: 0, right: 0, yaw: 0 }));
  const contacts = clipNs.detectContacts({ dur, loop: opts.loop ?? false, keys: [] } as never, R, { fps: rate }, { frames: F, dt } as never);
  return { id: opts.id ?? "frames", dur, loop: opts.loop ?? false, rate, dt, frames: F, times, root, rest: R, contacts, events: [], keys: null, tags: opts.tags ?? [], quality: undefined };
}

/** Body point n of a frame. */
export const at = (X: ArrayLike<number>, n: string): [number, number, number] => [X[format.IDX[n]! * 3]!, X[format.IDX[n]! * 3 + 1]!, X[format.IDX[n]! * 3 + 2]!];
/** A root-frame point in the world. */
export function world(m: Motion, i: number, p: readonly number[]): [number, number, number] {
  const r = m.root[i]!, c = PORTABLE.cos((r.yaw * Math.PI) / 180), s = PORTABLE.sin((r.yaw * Math.PI) / 180);
  return [r.forward + p[0]! * c - p[1]! * s, r.right + p[0]! * s + p[1]! * c, p[2]!];
}
/** A foot's sole points (the heel below the ankle, the ball, the toe) and which is lowest. */
export function sole(m: Motion, X: ArrayLike<number>, s: "L" | "R"): { name: string; p: [number, number, number] }[] {
  const heel = at(X, "ankle" + s);
  return [{ name: "heel", p: [heel[0], heel[1], heel[2] - m.rest.ankleZ] as [number, number, number] }, { name: "ball", p: at(X, "ball" + s) }, { name: "toe", p: at(X, "toe" + s) }];
}
/** Whether end `end` is planted at time t. */
export const planted = (m: Motion, end: "footL" | "footR" | "handL" | "handR", t: number): boolean => clipNs.contactsAt({ dur: m.dur, loop: m.loop, keys: [], contacts: m.contacts } as never, t)[end];
