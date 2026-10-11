// Planted defects (PLAN.md WP-3.6): known defects planted into clean clips, each with the metric that must find it and
// the times it must be found at. Keys are edited where the defect lives in keys (a dragged foot, a sunk body, an arm
// through the torso, a pop, a twist flip, a loop seam, a non-number, events out of order, a pair that isn't mirrored);
// a stretched bone lives only in baked points, so it is planted in the clip's sampled frames. Every plant is a pure
// function of the clip and a seed, so the same fixtures plant the same defects every run.
import { clip as clipNs, format, math, type Clip, type Key, type Rest } from "@m3a/core";
import { checks } from "@m3a/sensors";

/** The defects, each with the metric that must find it. */
export const DEFECTS = {
  slide: "slide",
  sink: "penetration",
  armThroughTorso: "intersection",
  pop: "pop",
  twistFlip: "twistFlip",
  seam: "seam",
  stretch: "stretch",
  nan: "nan",
  eventsOrder: "events",
  wrongMirror: "symmetry",
} as const satisfies Record<string, checks.MetricName>;
/** A defect's name. */
export type Defect = keyof typeof DEFECTS;

/** A planted defect: the edited clip (or sampled frames), what must find it, when, and its mirrored pair if any. */
export interface Planted {
  defect: Defect;
  clip: Clip;
  /** For a defect in baked points: the clip's frames (60 Hz) with it. */
  frames?: Float32Array[];
  /** For a pair: the clip the edited one must mirror. */
  mirrorOf?: Clip;
  metric: checks.MetricName;
  t0: number;
  t1: number;
  /** The body part or end it must be found on, when there is one. */
  where?: string;
}

/** Whether a defect can be planted in a clip (a seam needs a loop; a drag, a planted foot of 0.3 s). */
export function fits(defect: Defect, clip: Clip, R: Rest): boolean {
  // a clip whose profile turns the defect's metric off can't show it (a slide in a death, an arm in a sitting clip)
  if (checks.profilesOf(clip.tags, clip.id).some((p) => checks.PROFILES[p]!.off.includes(DEFECTS[defect]))) return false;
  if (defect === "seam") return clip.loop && clip.keys.length >= 3;
  // an in-place loop that steps is read on a treadmill its feet set (D41), so a foot dragged there drags the ground
  // with it in part: its slide is planted where the ground is the clip's own (a one-shot, a loop that travels or stands)
  if (defect === "slide") {
    const end = checks.motionOf(clip, R).root.at(-1)!, treadmill = clip.loop && (clip.keys[0] as { root?: unknown }).root === undefined && (end.forward !== 0 || end.right !== 0);
    return !treadmill && longestContact(clip, R) !== null;
  }
  if (defect === "sink") return clip.dur >= 0.5 && soleOnFloor(clip, R, 0) !== 0 || (clip.dur >= 0.5 && lowestSole(clip, R, 0) < 30);
  // a pair that isn't mirrored shows only where the motion isn't symmetric: at least 50 mm somewhere
  if (defect === "wrongMirror") return clip.dur >= 0.5 && asymmetry(clip, R) > 50;
  return clip.dur >= 0.5 && clip.keys.length >= 2;
}
/** How far a clip is from its own mirror at worst (mm, every 0.1 s; index and pinky left out, as the metric does). */
function asymmetry(clip: Clip, R: Rest): number {
  let worst = 0;
  for (let t = 0; t <= clip.dur; t += 0.1) {
    const X = format.pose(R, clip, t);
    for (const n of format.POINTS) {
      if (/^(index|pinky)/.test(n)) continue;
      const m = n.endsWith("L") ? n.slice(0, -1) + "R" : n.endsWith("R") ? n.slice(0, -1) + "L" : n, i = format.IDX[n]! * 3, j = format.IDX[m]! * 3;
      worst = Math.max(worst, Math.hypot(X[i]! - X[j]!, X[i + 1]! + X[j + 1]!, X[i + 2]! - X[j + 2]!));
    }
  }
  return worst;
}

const copy = (c: Clip): Clip => JSON.parse(JSON.stringify(c)) as Clip;
/** A seeded time in [a, b]: the same for the same clip, defect and seed. */
function timeIn(id: string, defect: string, seed: number, a: number, b: number): number {
  const next = math.rng(math.derive(seed, id, defect));
  return Math.round((a + (b - a) * next()) * 60) / 60;
}
/**
 * A key at time t (the clip's in-betweened), added in time order unless one is within 5 ms (the nearest; two keys that
 * close read as a snap). Times are kept to the millisecond, as the format keeps them (spec/MOTION.md §6.2).
 */
function keyAt(c: Clip, at: number): Key {
  const t = Math.round(at * 1000) / 1000, near = c.keys.filter((k) => Math.abs(k.t - t) < 0.005 + 1e-9).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t));
  if (near.length) return near[0]!;
  const k = { ...(format.keyAt(c, t) as Key), t };
  c.keys.push(k);
  c.keys.sort((a, b) => a.t - b.t);
  return k;
}
/** The longest stance of a foot of at least 0.3 s, as the sensors measure it, within the clip (a loop's first cycle). */
function longestContact(clip: Clip, R: Rest): { end: "footL" | "footR"; a: number; b: number } | null {
  const contacts = checks.motionOf(clip, R).contacts;
  let best: { end: "footL" | "footR"; a: number; b: number } | null = null;
  for (const end of ["footL", "footR"] as const) for (const [a, b] of contacts[end] ?? []) if (Math.min(b, clip.dur) - a >= 0.3 && (!best || Math.min(b, clip.dur) - a > best.b - best.a)) best = { end, a, b: Math.min(b, clip.dur) };
  return best;
}
/** The keys after `dur` (a capture's last frame, up to 50 ms past it: spec/MOTION.md §6.1), which an edit to the end carries. */
const pastEnd = (c: Clip) => c.keys.filter((k) => k.t > c.dur + 1e-9);

/** The smoothstep of u in [0, 1]. */
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/**
 * Keys every 1/30 s or less over [a − ramp, b + ramp] (a clip's key within 5 ms taken as it is), each edited by `edit(key, w)`: w eases from 0 to 1 over the ramp in,
 * holds 1 over [a, b], and eases back to 0 over the ramp out, so the defect comes and goes without a jump.
 */
function eased(c: Clip, a: number, b: number, ramp: number, edit: (k: Key, w: number) => void): void {
  const from = Math.max(0, a - ramp), to = Math.min(c.dur, b + ramp), n = Math.max(1, Math.ceil((to - from) * 30));
  for (let i = 0; i <= n; i++) keyAt(c, from + ((to - from) * i) / n);
  const weight = (t: number) => (t < a ? ease((t - (a - ramp)) / ramp) : t > b ? ease((b + ramp - t) / ramp) : 1);
  for (const k of c.keys) {
    if (k.t < from - 1e-9 || k.t > to + 1e-9) continue;
    const w = weight(k.t);
    if (w > 0) edit(k, w);
  }
  // an edit that reaches the end carries to the keys past it, as the pose at the end has it
  const w = weight(c.dur);
  if (to >= c.dur - 1e-9 && w > 0) for (const k of pastEnd(c)) edit(k, w);
}

/** The lowest sole point's height (mm) at time t. */
function lowestSole(c: Clip, R: Rest, t: number): number {
  const X = format.pose(R, c, t), z = (n: string) => X[format.IDX[n]! * 3 + 2]!;
  return Math.min(z("ankleL") - R.ankleZ, z("ballL"), z("toeL"), z("ankleR") - R.ankleZ, z("ballR"), z("toeR"));
}
/** The first time from t on (then from the start) when a sole is within 30 mm of the floor, every 1/60 s. */
function soleOnFloor(c: Clip, R: Rest, t: number): number {
  const times = Array.from({ length: Math.floor(c.dur * 60) + 1 }, (_, i) => i / 60).filter((x) => x <= c.dur - 0.3);
  return [...times.filter((x) => x >= t), ...times.filter((x) => x < t)].find((x) => lowestSole(c, R, x) < 30) ?? t;
}

/** Plants `defect` into `clip` (on rest R), at a time the seed picks. */
export function plant(defect: Defect, clip: Clip, R: Rest, seed = 1): Planted {
  const c = copy(clip), metric = DEFECTS[defect], dur = c.dur;
  const t = timeIn(c.id, defect, seed, Math.min(0.25, dur * 0.25), Math.max(Math.min(0.25, dur * 0.25), dur - 0.25));
  switch (defect) {
    case "slide": {
      // the foot dragged outward over its longest stance, at a steady 0.4 hip heights a second and at most 250 mm (its
      // leg swung out by the angle that moves its ankle so far, at the span it has: a bent leg reaches less than its
      // length), so it stays on the floor (it rises at most 38 mm) and slower than a swing: a foot sliding as it
      // stands. After the stance the leg eases back over 0.25 s, in the air, so letting go isn't a pop
      const k = longestContact(c, R)!, legKey = k.end === "footL" ? "legL" : "legR", far = Math.min(250, 0.4 * R.H0 * (k.b - k.a));
      const out = Math.min(dur, k.b + 0.25);
      // keys on the 1/30 s grid (the library's key rate) over the stance and the release
      for (let j = Math.ceil(k.a * 30 - 1e-6); j / 30 <= out + 1e-6; j++) keyAt(c, j / 30);
      keyAt(c, k.a);
      keyAt(c, k.b);
      const drag = (t: number) => (t <= k.b ? Math.max(0, (t - k.a) / (k.b - k.a)) : out > k.b ? 1 - ease((t - k.b) / (out - k.b)) : 1);
      for (const key of c.keys) {
        // the keys past the end carry the drag the end has
        if (key.t < k.a - 1e-9 || (key.t > out + 1e-9 && !(out >= dur - 1e-9 && key.t > dur))) continue;
        const leg = key[legKey], u = drag(Math.min(key.t, dur)), L = Math.hypot(leg[0]!, leg[1]!, leg[2]!), dir = [leg[0]! / L, leg[1]! / L, leg[2]! / L];
        const span = Math.sqrt(Math.max(1, R.thigh ** 2 + R.shin ** 2 + 2 * R.thigh * R.shin * Math.cos(((leg[3] ?? 0) * Math.PI) / 180))), th = (far * u) / span;
        const e = [0 - dir[0]! * dir[1]!, 1 - dir[1]! * dir[1]!, 0 - dir[2]! * dir[1]!], el = Math.hypot(e[0]!, e[1]!, e[2]!) || 1;
        for (let j = 0; j < 3; j++) leg[j] = L * (dir[j]! * Math.cos(th) + (e[j]! / el) * Math.sin(th));
      }
      return { defect, clip: c, metric, t0: k.a, t1: k.b, where: k.end };
    }
    case "sink": {
      // where a sole is on the floor, the body lowered so it goes 150 mm under, eased in and out over 0.25 s (so the
      // drop isn't a pop) and held 0.3 s
      const ts = soleOnFloor(c, R, t), d = ((lowestSole(c, R, ts) + 150) * 100) / R.H0, t1 = Math.min(dur, ts + 0.3);
      eased(c, ts, t1, 0.25, (k, w) => (k.hips = [k.hips[0]!, k.hips[1]!, k.hips[2]! - d * w]));
      return { defect, clip: c, metric, t0: ts, t1 };
    }
    case "armThroughTorso": {
      // the right arm straight from its shoulder at the belly's middle (in the chest's frame at each key), held 0.3 s
      // and swung in and out over 0.3 s (so the swing isn't a pop)
      const t1 = Math.min(dur, t + 0.3);
      eased(c, t, t1, 0.3, (k, w) => {
        const X = format.decodePose(R, k as never, new Array(108)), tq = format.torso(R, k as never), P = (n: string) => [0, 1, 2].map((j) => X[format.IDX[n]! * 3 + j]!);
        const sh = P("shR"), mid = P("spine1").map((v, j) => (v + P("spine2")[j]!) / 2), d = mid.map((v, j) => v - sh[j]!);
        const local = tq.RC.map((axis) => axis[0]! * d[0]! + axis[1]! * d[1]! + axis[2]! * d[2]!), l = Math.hypot(...local);
        const across = local.map((v) => (v / l) * 100), now = k.armR;
        k.armR = [now[0]! + (across[0]! - now[0]!) * w, now[1]! + (across[1]! - now[1]!) * w, now[2]! + (across[2]! - now[2]!) * w, (now[3] ?? 0) * (1 - w), now[4] ?? 0];
      });
      return { defect, clip: c, metric, t0: t, t1, where: "upperArmR" };
    }
    case "pop": {
      // one key the left fist jumps 250 mm out to, between keys a sample either side that hold the clean pose
      const [before, key, after] = [t - 1 / 60, t, t + 1 / 60].map((x) => keyAt(c, x)) as [Key, Key, Key];
      // the arm turned about 45° toward the axis it points along least, so the fist moves wherever the arm points
      const arm = key.armL, L = Math.hypot(arm[0]!, arm[1]!, arm[2]!);
      const axis = [0, 1, 2].reduce((a, b) => (Math.abs(arm[b]!) < Math.abs(arm[a]!) ? b : a));
      key.armL = arm.map((v, i) => (i === axis ? v + L : v)) as number[];
      return { defect, clip: c, metric, t0: before.t, t1: after.t };
    }
    case "twistFlip": {
      // the left knee's twist jumps 170° in one 1/30 s key interval and stays flipped
      const k0 = keyAt(c, t), k1 = keyAt(c, Math.min(dur, t + 1 / 30));
      void k0;
      for (const key of c.keys) if (key.t >= k1.t - 1e-9) key.legL = [key.legL[0]!, key.legL[1]!, key.legL[2]!, key.legL[3]!, (key.legL[4] ?? 0) + 170];
      return { defect, clip: c, metric, t0: t, t1: k1.t, where: "legL" };
    }
    case "seam": {
      // the right arm drifting up and out over the loop's last 0.3 s, so the cycle doesn't close (eased, so the drift
      // itself isn't a pop: the jump is at the seam)
      eased(c, dur, dur, 0.3, (k, w) => (k.armR = [k.armR[0]!, k.armR[1]! + 40 * w, k.armR[2]! + 80 * w, k.armR[3]!, k.armR[4] ?? 0]));
      return { defect, clip: c, metric, t0: dur, t1: dur };
    }
    case "stretch": {
      // baked points: the right shin 6% longer for 0.25 s (the ankle and foot moved down along it)
      const sampled = clipNs.sampleAll(c, R, 60), t1 = Math.min(dur, t + 0.25), frames = sampled.frames.map((X) => Float32Array.from(X));
      frames.forEach((X, i) => {
        const time = i * sampled.dt;
        if (time < t - 1e-9 || time > t1 + 1e-9) return;
        const P = (n: string) => format.IDX[n]! * 3, kn = [0, 1, 2].map((j) => X[P("kneeR") + j]!), an = [0, 1, 2].map((j) => X[P("ankleR") + j]!);
        const d = [0, 1, 2].map((j) => (an[j]! - kn[j]!) * 0.06);
        for (const n of ["ankleR", "ballR", "toeR"]) for (let j = 0; j < 3; j++) X[P(n) + j] = X[P(n) + j]! + d[j]!;
      });
      return { defect, clip: c, frames, metric, t0: t, t1, where: "kneeR–ankleR" };
    }
    case "nan": {
      const key = keyAt(c, t);
      key.head = [Number.NaN, key.head[1]!, key.head[2]!];
      return { defect, clip: c, metric, t0: t, t1: t };
    }
    case "eventsOrder": {
      c.events = [{ t: Math.min(dur, t + 0.2), name: "second" }, { t, name: "first" }];
      return { defect, clip: c, metric, t0: t, t1: t };
    }
    case "wrongMirror": {
      // a pair whose "mirror" is the clip itself, not mirrored: the wrong side
      return { defect, clip: c, mirrorOf: copy(clip), metric, t0: 0, t1: dur };
    }
  }
}
