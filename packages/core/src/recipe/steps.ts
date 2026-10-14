// The recipe operations on tracks (spec/RECIPE.md §2): sequence with crossfades (in step on the feet's plants when
// asked), time-warped blends, masked and additive layers, mirror, retime, pose deltas, and added events and contacts.
// Each makes a new track at the same rate from the tracks it reads; roots compose so travel never jumps.
import { P, type Rest } from "../format/body.ts";
import { decodePose, encodePose } from "../format/pose.ts";
import type { ClipEvent, Contacts } from "../format/types.ts";
import { CONTACT_ENDS } from "../format/types.ts";
import { KEY_FIELDS } from "../format/types.ts";
import { ease } from "../math/helpers.ts";
import { PORTABLE as PM } from "../math/portable.ts";
import { addDelta, blend, delta, mask as maskOf, mirrorPose, wrap180, type Mask, type Pose } from "../ops/pose.ts";
import { phaseMap, syncBlend } from "../ops/sync.ts";
import { compose, cycleOf, cyclic, frameTimes, invert, lerpRoot, ms, playable, poseAt, rootAt, shiftContacts, STILL } from "./track.ts";
import type { Root, Track } from "./types.ts";

/** A track of `dur` at `fps` whose frame at each time comes from `at`. */
export function build(base: Pick<Track, "rest" | "restSrc" | "fps" | "sources">, dur: number, loop: boolean, at: (time: number) => { pose: Pose; root: Root }, extra: Partial<Track> = {}): Track {
  const d = ms(dur), t: Track = { dur: d, loop, fps: base.fps, times: frameTimes(d, loop, base.fps), poses: [], roots: [], events: [], rest: base.rest, restSrc: base.restSrc, sources: base.sources, ...extra };
  for (const time of t.times) {
    const f = at(time), last = t.poses[t.poses.length - 1];
    t.poses.push(last ? unwrapped(f.pose, last) : f.pose);
    t.roots.push(f.root);
  }
  return t;
}
/** A pose with each angle at the whole turn nearest the frame before's (the same pose: a turn is no turn). */
export function unwrapped(p: Pose, before: Pose): Pose {
  const out = { ...p };
  for (const [f, spec] of Object.entries(KEY_FIELDS)) {
    const v = p[f] as number[] | undefined, w = before[f] as number[] | undefined;
    if (!spec.angles.length || !v || !w) continue;
    out[f] = v.map((x, i) => (spec.angles.includes(i) && w[i] !== undefined ? x + 360 * Math.round((w[i]! - x) / 360) : x));
  }
  return out;
}
/** A pose turned by `deg` about the vertical in clip space, as a root turned that much carries it: the pelvis's turn
 *  (`body[0]`, which carries the heading, MOTION.md §5.3) and its place relative to the root. */
export function turnPose(p: Pose, deg: number): Pose {
  if (Math.abs(deg) < 1e-9) return p;
  const out = { ...p }, c = PM.cos((deg * Math.PI) / 180), s = PM.sin((deg * Math.PI) / 180);
  if (Array.isArray(p.body)) out.body = [(p.body as number[])[0]! + deg, ...(p.body as number[]).slice(1)];
  if (Array.isArray(p.hips)) {
    const [f, r, ...up] = p.hips as number[];
    out.hips = [f! * c - r! * s, f! * s + r! * c, ...up];
  }
  return out;
}
/** Every source of these tracks once, in order. */
const sourcesOf = (...ts: readonly Track[]): string[] => [...new Set(ts.flatMap((t) => t.sources))];
/** 0 to 1 with zero slope at both ends. */
export const smoothstep = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** An envelope: 1 within from–to, fading in after `from` and out before `to` over `fade`, 0 outside. */
export function envelope(from: number, to: number, fade: number): (time: number) => number {
  return (time) => (time < from || time > to ? 0 : fade > 0 ? Math.min(smoothstep((time - from) / fade), smoothstep((to - time) / fade)) : 1);
}
/** A step's mask: named groups (feathered), field weights, or none (every field). */
export function maskFrom(m: unknown, feather = 0): Mask | undefined {
  if (m === undefined) return undefined;
  if (typeof m === "string" || Array.isArray(m)) return maskOf(m as string[], feather);
  return m as Mask;
}

const A = new Float32Array(P * 3), B = new Float32Array(P * 3), X = new Float32Array(P * 3);
/** a toward b by w with the pelvis and legs blended as points (a foot both plant stays where they put it, the knee
 *  bending to keep it there) and the rest as numbers, the feet's angles among them. */
export function blendLegs(a: Pose, b: Pose, w: number, rest: Rest): Pose {
  const k = blend(a, b, w);
  return w <= 0 || w >= 1 ? k : pointLegs(a, b, w, rest, k, LEGS);
}
/** The pelvis and legs. */
const LEGS = ["hips", "body", "legL", "legR"] as const;
/** The pelvis, legs and feet. */
const LEGS_AND_FEET = [...LEGS, "footL", "footR"] as const;
/** `numbers` (a toward b by w as numbers) with `fields` taken from a and b blended as points, `numbers` choosing
 *  between the readings the points allow. */
function pointLegs(a: Pose, b: Pose, w: number, rest: Rest, numbers: Pose, fields: readonly string[]): Pose {
  decodePose(rest, a, A);
  decodePose(rest, b, B);
  for (let i = 0; i < X.length; i++) X[i] = A[i]! + (B[i]! - A[i]!) * w;
  const e = encodePose(rest, X, numbers, { round: false }), out = { ...numbers };
  for (const f of fields) if (e[f] !== undefined) out[f] = e[f];
  return out;
}

/**
 * A blend of two tracks read frame by frame in order, its angles kept steady: each angle takes b's value at the whole
 * turn nearest the gap it had from a on the frame before (the first frame's the short way round), so the result never
 * flips half a turn where the two clips' angles come 180° apart (a foot pointing down, a hand rolled over), as a blend
 * that takes the short way on every frame does.
 */
export function steady(): (a: Pose, b: Pose, w: number, m?: Mask) => Pose {
  const gaps = new Map<string, number>();
  return (a, b, w, m) => {
    const out = blend(a, b, w, m);
    for (const [f, spec] of Object.entries(KEY_FIELDS)) {
      // a field one pose leaves out blends from its default, zero for a hand's or foot's angles
      const pa = a[f] as number[] | undefined, pb = b[f] as number[] | undefined, o = out[f] as number[] | undefined;
      if (!spec.angles.length || !o || (!pa && !pb)) continue;
      const va = pa ?? pb!.map(() => 0), vb = pb ?? pa!.map(() => 0);
      const k = w * (m ? (m[f] ?? 0) : 1), v = o.slice();
      for (const i of spec.angles) {
        if (va[i] === undefined || vb[i] === undefined) continue;
        const raw = vb[i]! - va[i]!, last = gaps.get(f + i) ?? wrap180(raw), gap = raw + 360 * Math.round((last - raw) / 360);
        gaps.set(f + i, gap);
        v[i] = k === 0 ? va[i]! : va[i]! + gap * k;
      }
      out[f] = v;
    }
    return out;
  };
}

/** The latest plant start of either foot at or before `end` in a track's contacts. A loop's are read round its seam
 *  (`loop` its length): a plant that wraps and still holds at `end` began a cycle earlier, before 0. */
function lastPlant(c: Contacts | undefined, end: number, loop?: number): { foot: "footL" | "footR"; t: number } | null {
  let best: { foot: "footL" | "footR"; t: number } | null = null;
  for (const foot of ["footL", "footR"] as const) for (const [a, b] of c?.[foot] ?? []) {
    const starts = loop && b > loop + 1e-9 && end < b - loop ? [a - loop] : [a];
    for (const s of starts) if (s <= end && (!best || s > best.t)) best = { foot, t: s };
  }
  return best;
}

/**
 * The items one after another. Each next item fades in over `fade` where the last one ends; with `sync`, it starts at
 * the same point of its step as the last one is then (as long after its first plant of the foot the last one planted
 * last), so the feet go on in step. The next item's root starts where the last one's stands at that moment, so travel
 * and turn carry on.
 */
export function sequence(items: readonly Track[], fade: number, sync: boolean): Track {
  // each item's start on the sequence's clock, the time of its own it starts at, where it ends, and where its crossfade
  // into the next begins; a loop plays one whole cycle from where it starts, a once item to its end
  const t0: number[] = [0], from: number[] = [0], end: number[] = [items[0]!.dur], cross: number[] = [], len: number[] = [], base: Root[] = [STILL];
  const local = (k: number, time: number) => time - t0[k]! + from[k]!;
  for (let k = 0; k + 1 < items.length; k++) {
    const a = items[k]!, b = items[k + 1]!, f = Math.min(fade, (end[k]! - t0[k]!) / 2, b.dur / 2), c = end[k]! - f;
    let off = 0;
    if (sync) {
      // a's own time when the crossfade starts, its last plant before it, and the same moment of b's step
      // only a step to keep in: a foot planted since its clip began, or one the next item never lifts, sets no phase
      // (a loop's plant across its seam began before 0, which is a step)
      const at = local(k, c), wrapped = a.loop ? ((at % a.dur) + a.dur) % a.dur : at, p = lastPlant(a.contacts, wrapped, a.loop ? a.dur : undefined), q = p ? (b.contacts?.[p.foot] ?? [])[0] : undefined;
      if (p && q && (p.t > 1e-3 || p.t < -1e-3) && !(q[0] <= 1e-3 && q[1] >= b.dur - 1e-3)) {
        const o = q[0] + (wrapped - p.t);
        off = b.loop ? o % b.dur : o + f > b.dur ? 0 : o;
      }
    }
    cross.push(c);
    len.push(f);
    t0.push(c);
    from.push(off);
    end.push(c + (b.loop ? b.dur : b.dur - off));
    // b's root at its start goes where a's stands, turned as b's first root is (a pose step's yaw on b turns it from there)
    base.push(compose(compose(compose(base[k]!, rootAt(a, local(k, c))), { ...STILL, yaw: b.roots[0]!.yaw }), invert(rootAt(b, off))));
  }
  const last = items.length - 1, dur = end[last]!;
  const at = (time: number) => {
    // the item playing, and the next one while their crossfade runs
    let k = 0;
    while (k < last && time >= cross[k]! + len[k]!) k++;
    // each item's poses turned by the heading the sequence has reached when it starts, as its root is
    const self = { pose: turnPose(poseAt(items[k]!, local(k, time)), base[k]!.yaw), root: compose(base[k]!, rootAt(items[k]!, local(k, time))) };
    if (k === last || time < cross[k]!) return self;
    const w = smoothstep((time - cross[k]!) / Math.max(len[k]!, 1e-9)), nx = items[k + 1]!;
    return { pose: blendLegs(self.pose, turnPose(poseAt(nx, local(k + 1, time)), base[k + 1]!.yaw), w, items[0]!.rest), root: lerpRoot(self.root, compose(base[k + 1]!, rootAt(nx, local(k + 1, time))), w) };
  };
  const events: ClipEvent[] = [], contacts: Contacts = { by: "detected" };
  items.forEach((it, k) => {
    // what an item holds at its own time t falls at t − from + t0 (a loop's earlier part a cycle on)
    const lo = k ? cross[k - 1]! : 0, hi = k < last ? cross[k]! + len[k]! / 2 : dur, shifts = it.loop ? [t0[k]! - from[k]! - it.dur, t0[k]! - from[k]!, t0[k]! - from[k]! + it.dur] : [t0[k]! - from[k]!];
    for (const d of shifts) {
      for (const e of it.events) if (e.t + d >= lo && e.t + d <= hi) events.push({ ...e, t: ms(e.t + d) });
      const moved = shiftContacts(it.contacts, (x) => x + d, dur);
      for (const e of CONTACT_ENDS) for (const [a, b] of moved?.[e] ?? []) if (b > lo && a < hi) (contacts[e] ??= []).push([ms(Math.max(a, lo)), ms(Math.min(b, hi))]);
    }
  });
  events.sort((x, y) => x.t - y.t);
  for (const e of CONTACT_ENDS) if (contacts[e]) contacts[e] = cyclic(contacts[e]!, Infinity);
  return build(items[0]!, dur, false, at, { events, contacts, sources: sourcesOf(...items) });
}

/** A loop's time t read on from `from`: a time before it is one a cycle on. */
const unwrapAfter = (t: number, from: number, dur: number) => (t < from - 1e-9 ? t + dur : t);
/** A blend's cycle: where its roots go over one, from the blended start to the blended start of the next. Lerping the
 *  two loops' cycles instead reads each in its own frame, which jumps at the seam when the two start facing apart. */
function blendedCycle(a: Track, b: Track, a0: number, b0: number, a1: number, b1: number, k: number): Root {
  return compose(invert(lerpRoot(rootAt(a, a0), rootAt(b, b0), k)), lerpRoot(rootAt(a, a1), rootAt(b, b1), k));
}

/** A weight that is a number or a curve [[t, w], …] read at a time (linear between its points, held past its ends). */
export function weightAt(w: number | [number, number][], time: number): number {
  if (typeof w === "number") return w;
  if (time <= w[0]![0]) return w[0]![1];
  for (let i = 1; i < w.length; i++) if (time <= w[i]![0]) return w[i - 1]![1] + ((w[i]![1] - w[i - 1]![1]) * (time - w[i - 1]![0])) / Math.max(1e-9, w[i]![0] - w[i - 1]![0]);
  return w[w.length - 1]![1];
}

/**
 * a blended toward b by w. Warped (the default), each is read at the same phase of its own time, two loops by their
 * contacts (the legs blended as points, so a foot both plant stays down), and the result lasts between their durations
 * by w (its mean, for a curve); unwarped, both at the same time over a's duration.
 */
export function blendTracks(a: Track, b: Track, w: number | [number, number][], warp: boolean): Track {
  const mean = typeof w === "number" ? w : w.reduce((s, p) => s + p[1], 0) / w.length, mix = steady(), sources = sourcesOf(a, b);
  // a curve's times are a's, stretched with the result: at the result's time u of dur it reads a's u × a.dur / dur
  const kAt = (time: number, dur: number) => weightAt(w, (time / dur) * a.dur);
  // a blend of two loops loops only where it closes: its weight the same at both ends, and read in step or as long
  const closes = Math.abs(weightAt(w, 0) - weightAt(w, a.dur)) < 1e-6;
  if (warp && a.loop && b.loop) {
    const ma = phaseMap(playable(a), a.contacts), mb = phaseMap(playable(b), b.contacts), s = syncBlend(playable(a), ma, playable(b), mb, mean, { rest: a.rest });
    // each loop's own time from where the blend's cycle starts in it, carried on past its seam (not wrapped), so a
    // travelling loop's root goes on rather than jumping back a cycle mid-blend
    const ua = (p: number) => unwrapAfter(ma.time(p), ma.time(0), a.dur), ub = (p: number) => unwrapAfter(mb.time(p), mb.time(0), b.dur);
    const rootOf = (p: number) => lerpRoot(rootAt(a, ua(p) + (p >= 1 ? a.dur : 0)), rootAt(b, ub(p) + (p >= 1 ? b.dur : 0)), mean), loop = closes;
    return build(a, s.dur, loop, (time) => {
      // the pelvis, legs and feet blended as points (a foot both plant stays down, and a foot's heading, which a foot
      // pointing down leaves loose, comes out as its points show it), the rest as numbers held steady
      const p = time / s.dur, pa = poseAt(a, ma.time(p)), pb = poseAt(b, mb.time(p)), k = kAt(time, s.dur);
      return { pose: pointLegs(pa, pb, k, a.rest, mix(pa, pb, k), LEGS_AND_FEET), root: rootOf(p) };
    }, { ...(loop ? { cycle: compose(invert(rootOf(0)), rootOf(1)) } : {}), contacts: loop ? s.contacts : shiftContacts(s.contacts, (x) => x, ms(s.dur), false, ms(s.dur), true), events: a.events.map((e) => ({ ...e, t: ms((ma.phase(e.t) * s.dur)) })), sources });
  }
  const dur = warp ? a.dur + (b.dur - a.dur) * mean : a.dur, loop = a.loop && b.loop && closes && (warp || Math.abs(a.dur - b.dur) < 1e-3);
  const ta = (time: number) => (warp ? (time / dur) * a.dur : time), tb = (time: number) => (warp ? (time / dur) * b.dur : time);
  return build(a, dur, loop, (time) => {
    const k = kAt(time, dur);
    return { pose: mix(poseAt(a, ta(time)), poseAt(b, tb(time)), k), root: lerpRoot(rootAt(a, ta(time)), rootAt(b, tb(time)), k) };
  }, { events: a.events.map((e) => ({ ...e, t: ms(warp ? (e.t / a.dur) * dur : e.t) })).filter((e) => e.t <= dur), ...(a.contacts ? { contacts: shiftContacts(a.contacts, (x) => (warp ? (x / a.dur) * dur : x), dur, loop, a.dur, a.loop)! } : {}), ...(loop ? { cycle: blendedCycle(a, b, ta(0), tb(0), ta(dur), tb(dur), kAt(0, dur)) } : {}), sources });
}

/**
 * `over` laid on `base` in the masked fields at `weight`; additive: over's change from its first pose added on. Over
 * base's duration: two loops loop, the over stretched to the base's cycle so the seam stays whole; otherwise it plays
 * once, the over from the start (held at its end).
 */
export function layer(base: Track, over: Track, m: Mask | undefined, weight: number, additive: boolean): Track {
  const ref = over.poses[0]!, both = base.loop && over.loop, at = (time: number) => (both ? (time / base.dur) * over.dur : time), mix = steady();
  return build(base, base.dur, both, (time) => {
    const b = poseAt(base, time), o = poseAt(over, at(time));
    return { pose: additive ? addDelta(b, delta(o, ref), weight, m) : mix(b, o, Math.min(1, weight), m), root: rootAt(base, time) };
  }, { events: [...base.events, ...over.events.map((e) => ({ ...e, t: ms(both ? (e.t / over.dur) * base.dur : e.t) })).filter((e) => e.t <= base.dur)].sort((x, y) => x.t - y.t), ...(base.contacts ? { contacts: both ? base.contacts : shiftContacts(base.contacts, (x) => x, base.dur, false, base.dur, base.loop)! } : {}), ...(both ? { cycle: cycleOf(base) } : {}), sources: sourcesOf(base, over) });
}

/** Left and right swapped: poses, the root's sideways travel and turn, and the contacts. */
export function mirror(t: Track): Track {
  const flip = (r: Root): Root => ({ forward: r.forward, right: -r.right, yaw: -r.yaw });
  const contacts = t.contacts ? ({ by: t.contacts.by, ...(t.contacts.footR ? { footL: t.contacts.footR } : {}), ...(t.contacts.footL ? { footR: t.contacts.footL } : {}), ...(t.contacts.handR ? { handL: t.contacts.handR } : {}), ...(t.contacts.handL ? { handR: t.contacts.handL } : {}) } as Contacts) : undefined;
  return { ...t, poses: t.poses.map(mirrorPose), roots: t.roots.map(flip), ...(t.cycle ? { cycle: flip(t.cycle) } : {}), ...(contacts ? { contacts } : {}) };
}

/** The ease curves `retime` takes by name. */
const EASES = { in: ease.inQuad, out: ease.outQuad, inOut: ease.inOut } as const;
/** Retimed: `speed` times as fast, to `dur` seconds, or through an ease (the result at u shows the track at E(u); an
 *  eased loop plays once). */
export function retime(t: Track, how: { speed?: number; dur?: number; ease?: keyof typeof EASES }): Track {
  const dur = how.speed ? t.dur / how.speed : how.dur ?? t.dur, E = how.ease ? EASES[how.ease] : null;
  const src = (time: number) => (E ? E(Math.min(1, Math.max(0, time / dur))) * t.dur : (time / dur) * t.dur);
  // an event or contact at s moves to where src reaches s
  const inverse = (s: number) => {
    if (!E) return (s / t.dur) * dur;
    let lo = 0, hi = dur;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (src(mid) < s) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  // an ease starts and ends at rest, so an eased loop would stall at its seam: it plays once
  const loop = t.loop && !E;
  return build(t, dur, loop, (time) => ({ pose: poseAt(t, src(time)), root: rootAt(t, src(time)) }), { events: t.events.map((e) => ({ ...e, t: ms(inverse(e.t)) })), ...(t.contacts ? { contacts: shiftContacts(t.contacts, inverse, ms(dur), loop, t.dur, t.loop)! } : {}), ...(loop && t.cycle ? { cycle: t.cycle } : {}) });
}

/** The parts a pose step moves: per field, per part index, the amount. */
export type Parts = Record<string, Record<string, number> | number>;
/**
 * A track's roots with the character turned by `turn(time)` degrees: its heading, and its travel from each moment on
 * (each frame's step taken in the direction it then faces), so a turned walk walks the way it faces. A loop's last step
 * runs to where its next cycle starts, which gives the turned cycle.
 */
function turnedRoots(t: Track, turn: (time: number) => number): { roots: Root[]; cycle?: Root } {
  const roots: Root[] = [];
  const step = (prev: Root, from: Root, to: Root, deg: number, yaw: number): Root => {
    const c = PM.cos((deg * Math.PI) / 180), s = PM.sin((deg * Math.PI) / 180), df = to.forward - from.forward, dr = to.right - from.right;
    return { forward: prev.forward + df * c - dr * s, right: prev.right + df * s + dr * c, yaw };
  };
  t.roots.forEach((r, i) => {
    const time = t.times[i]!;
    roots.push(i === 0 ? { ...r, yaw: r.yaw + turn(time) } : step(roots[i - 1]!, t.roots[i - 1]!, r, (turn(t.times[i - 1]!) + turn(time)) / 2, r.yaw + turn(time)));
  });
  if (!t.loop) return { roots };
  const n = t.roots.length - 1, next = compose(t.roots[0]!, cycleOf(t));
  const end = step(roots[n]!, t.roots[n]!, next, (turn(t.times[n]!) + turn(t.dur)) / 2, next.yaw + turn(t.dur));
  return { roots, cycle: compose(invert(roots[0]!), end) };
}
/** Each named part moved by its amount, under the envelope from–to faded over `fade`; `yaw` turns the character. */
export function poseDeltas(t: Track, parts: Parts, from: number, to: number, fade: number): Track {
  const env = envelope(from, to, fade), yaw = typeof parts.yaw === "number" ? parts.yaw : 0;
  // a yaw turns the character: in clip space its body (MOTION.md §5.3), and its root's heading and travel
  const turned = yaw ? turnedRoots(t, (time) => yaw * env(time)) : null, at = new Map(t.times.map((time, i) => [time, i]));
  return build(t, t.dur, t.loop, (time) => {
    const e = env(time), p = poseAt(t, time), i = at.get(time), r = turned && i !== undefined ? turned.roots[i]! : rootAt(t, time);
    if (e === 0) return { pose: p, root: r };
    for (const [f, by] of Object.entries(parts)) {
      if (f === "yaw") continue;
      const spec = KEY_FIELDS[f]!, v = (p[f] as number[] | undefined)?.slice() ?? spec.parts.map(() => 0);
      for (const [part, amount] of Object.entries(by as Record<string, number>)) v[spec.parts.indexOf(part)]! += amount * e;
      p[f] = v;
    }
    return { pose: yaw ? turnPose(p, yaw * e) : p, root: r };
  }, { events: t.events, ...(t.contacts ? { contacts: t.contacts } : {}), ...(turned?.cycle ? { cycle: turned.cycle } : t.cycle ? { cycle: t.cycle } : {}) });
}

/** Events added, in time order. */
export function addEvents(t: Track, add: readonly ClipEvent[]): Track {
  return { ...t, events: [...t.events, ...add.map((e) => ({ ...e, t: ms(e.t) }))].sort((a, b) => a.t - b.t) };
}
/** Contacts added as labelled, merged with the track's where they overlap. */
export function addContacts(t: Track, add: Partial<Record<(typeof CONTACT_ENDS)[number], [number, number][]>>): Track {
  const out: Contacts = { by: "labelled" };
  for (const end of CONTACT_ENDS) {
    // a loop's contact over its seam is read as its two parts, then written the format's way again
    const all = [...(t.contacts?.[end] ?? []), ...(add[end] ?? [])].flatMap(([a, b]): [number, number][] => (t.loop && b > t.dur + 1e-9 ? [[a, t.dur], [0, b - t.dur]] : [[a, b]])).map(([a, b]): [number, number] => [ms(a), ms(b)]);
    const merged = cyclic(all, t.loop ? t.dur : Infinity);
    if (merged.length) out[end] = merged;
  }
  return { ...t, contacts: out };
}
