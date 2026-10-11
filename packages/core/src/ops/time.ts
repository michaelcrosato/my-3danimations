// Clip operations in time (PLAN.md WP-2.3): retime by speed, to a duration or along an ease curve; slice a stretch;
// and close a loop's seam. Each returns a new clip whose keys, events and contacts move together, so events keep their
// order and contacts their place in the motion. Keys stay whole numbers at millisecond times (spec/MOTION.md §5), so a
// result is a valid clip; measured facts are dropped, to be measured again.
import { keyAt } from "../format/sample.ts";
import type { KeyLike } from "../format/pose.ts";
import type { Clip, ClipEvent, Contacts, Key } from "../format/types.ts";
import { CONTACT_ENDS } from "../format/types.ts";
import type { Ease } from "../math/helpers.ts";
import { PORTABLE } from "../math/portable.ts";
import { delta, POSE_FIELDS } from "./pose.ts";

/** A clip as these operations read and write it. */
export type Timeline = Pick<Clip, "dur" | "loop" | "keys"> & Partial<Pick<Clip, "events" | "contacts" | "facts">>;

const ms = (t: number) => Math.round(t * 1000) / 1000;
/** Keys at the times `map` gives, merging any two that land within a millisecond. */
function moveKeys(keys: readonly Key[], map: (t: number) => number): Key[] {
  const out: Key[] = [];
  for (const k of keys) {
    const t = ms(map(k.t));
    if (out.length && t - out[out.length - 1]!.t < 0.001) continue;
    out.push({ ...k, t });
  }
  return out;
}
function moveEvents(ev: readonly ClipEvent[] | undefined, map: (t: number) => number): ClipEvent[] | undefined {
  return ev?.map((e) => ({ ...e, t: ms(map(e.t)) }));
}
function moveContacts(c: Contacts | undefined, map: (t: number) => number, dur: number, newDur: number): Contacts | undefined {
  if (!c) return undefined;
  const out: Contacts = { by: c.by };
  // a loop's interval past dur is mapped through the cycle: dur + map(t − dur)
  const m = (t: number) => (t > dur ? newDur + map(t - dur) : map(t));
  for (const end of CONTACT_ENDS) if (c[end]) out[end] = c[end]!.map(([a, b]) => [ms(m(a)), ms(m(b))]);
  return out;
}
function without<T extends Timeline>(clip: T): T {
  const out = { ...clip };
  delete out.facts;
  return out;
}

/** How to retime: play `speed` times as fast, last `dur` seconds, or run the clip's time through an ease curve. */
export type Retime = { speed: number } | { dur: number } | { ease: Ease };

/**
 * The clip retimed. By speed or duration every time scales. Along an ease E (increasing, E(0) = 0, E(1) = 1) the
 * result at time t shows the clip at dur·E(t/dur): a key at s moves to dur·E⁻¹(s/dur). Throws when E isn't increasing.
 */
export function retime<T extends Timeline>(clip: T, how: Retime): T {
  const dur = clip.dur;
  let map: (t: number) => number, newDur = dur;
  if ("speed" in how || "dur" in how) {
    const k = "speed" in how ? 1 / how.speed : how.dur / dur;
    if (!(k > 0) || !Number.isFinite(k)) throw new Error(`retime: ${"speed" in how ? `speed ${how.speed}` : `dur ${how.dur}`} must be positive`);
    map = (t) => t * k;
    newDur = ms(dur * k);
  } else {
    const E = how.ease;
    let last = E(0);
    for (let i = 1; i <= 1000; i++) {
      const y = E(i / 1000);
      if (!(y > last)) throw new Error("retime: the ease curve must increase from 0 to 1 (outBack overshoots; use outCubic, inOut or your own)");
      last = y;
    }
    // invert by bisection: the u in [0, 1] with E(u) = s/dur
    map = (s) => {
      const target = s / dur;
      let lo = 0, hi = 1;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (E(mid) < target) lo = mid;
        else hi = mid;
      }
      return ((lo + hi) / 2) * dur;
    };
  }
  const out = without(clip);
  out.dur = newDur;
  out.keys = moveKeys(clip.keys, map);
  out.events = moveEvents(clip.events, map);
  out.contacts = moveContacts(clip.contacts, map, dur, newDur);
  if (!out.events) delete out.events;
  if (!out.contacts) delete out.contacts;
  return out;
}

/** A key's numbers rounded to whole numbers, as a file holds them. */
function whole(k: KeyLike, t: number): Key {
  const out: Record<string, unknown> = { t: ms(t) };
  for (const [f, v] of Object.entries(k)) if (f !== "t") out[f] = Array.isArray(v) ? v.map((x) => Math.round(x) + 0) : Math.round(v as number) + 0;
  return out as unknown as Key;
}

/**
 * The stretch from `from` to `to` (seconds; a loop may run past its end, a one-shot not) as a one-shot clip starting at
 * 0: the keys inside, with keys in-betweened at both ends, and the events and contacts inside. A clip that travels
 * starts its root again from where it stands at `from` (the turn taken away from `body` too).
 */
export function slice<T extends Timeline>(clip: T, from: number, to: number): T {
  const dur = clip.dur;
  if (!(from >= 0 && to > from && (clip.loop ? to - from <= dur + 1e-9 : to <= dur + 1e-9))) throw new Error(`slice: ${from} to ${to} isn't within the clip (dur ${dur}${clip.loop ? ", a loop may run one cycle past its end" : ""})`);
  // the times to key: both ends and every key between, unrolled over a loop's cycles
  const times = [from];
  for (let c = Math.floor(from / dur); c * dur < to; c++) for (const k of clip.keys) if (k.t + c * dur > from + 0.0005 && k.t + c * dur < to - 0.0005) times.push(k.t + c * dur);
  times.push(to);
  times.sort((a, b) => a - b);
  const at = (t: number): KeyLike => (clip.loop && t > 0 && Math.abs(t - Math.round(t / dur) * dur) < 1e-9 && t >= dur ? keyAt({ ...clip, loop: false }, dur) : keyAt(clip, t));
  const start = at(from);
  const r0 = (start.root as number[] | undefined) ?? null, y0 = typeof start.yaw === "number" ? start.yaw : 0;
  const c = PORTABLE.cos((y0 * Math.PI) / 180), s = PORTABLE.sin((y0 * Math.PI) / 180);
  const keys: Key[] = [];
  for (const t of times) {
    const k = at(t);
    if (r0 && k.root) {
      // the root's travel since `from`, in the frame it faces at `from`; a loop's later cycle carries the cycle's travel
      const cyc = clip.loop ? Math.floor((t - 1e-9) / dur) - Math.floor(from / dur) : 0;
      const end = keyAt({ ...clip, loop: false }, dur).root as number[], first = clip.keys[0]!.root as number[];
      const df = (k.root as number[])[0]! - r0[0]! + cyc * (end[0]! - first[0]!), dr = (k.root as number[])[1]! - r0[1]! + cyc * (end[1]! - first[1]!);
      k.root = [df * c + dr * s, -df * s + dr * c];
    }
    if (typeof k.yaw === "number") {
      k.yaw = k.yaw - y0;
      (k.body as number[])[0] = (k.body as number[])[0]! - y0;
    }
    keys.push(whole(k, t - from));
  }
  const out = without(clip);
  out.dur = ms(to - from);
  out.loop = false;
  out.keys = moveKeys(keys, (t) => t);
  const inside = (t: number) => t >= from - 1e-9 && t <= to + 1e-9;
  if (clip.events) {
    const ev: ClipEvent[] = [];
    for (let cyc = clip.loop ? Math.floor(from / dur) : 0; clip.loop ? cyc * dur <= to : cyc === 0; cyc++) for (const e of clip.events) if (inside(e.t + cyc * dur)) ev.push({ ...e, t: ms(e.t + cyc * dur - from) });
    out.events = ev;
  }
  if (clip.contacts) {
    const ct: Contacts = { by: clip.contacts.by };
    for (const end of CONTACT_ENDS) {
      const iv: [number, number][] = [];
      for (let cyc = clip.loop ? Math.floor(from / dur) - 1 : 0; clip.loop ? cyc * dur <= to : cyc === 0; cyc++) {
        for (const [a, b] of clip.contacts[end] ?? []) {
          const lo = Math.max(a + cyc * dur, from), hi = Math.min(b + cyc * dur, to);
          if (hi > lo) iv.push([ms(lo - from), ms(hi - from)]);
        }
      }
      iv.sort((x, y) => x[0] - y[0]);
      if (iv.length) ct[end] = iv;
    }
    out.contacts = ct;
  }
  return out;
}

/**
 * The clip as a seamless loop: over its last `blend` seconds every number but the root's eases toward where the clip
 * began (smoothstep), so the last key is the first pose (angles the short way round, so whole turns stay) and the seam
 * disappears. Root travel and yaw keep accumulating: each cycle continues where the last ended.
 */
export function loopify<T extends Timeline>(clip: T, blend: number): T {
  const dur = clip.dur;
  if (!(blend > 0 && blend <= dur)) throw new Error(`loopify: blend ${blend} must be within (0, ${dur}]`);
  const first = clip.keys[0]! as unknown as KeyLike, last = keyAt({ ...clip, loop: false }, dur);
  const d = delta(first, last);
  delete d.root;
  delete d.yaw;
  const t0 = dur - blend;
  const times = [...clip.keys.map((k) => k.t).filter((t) => t > t0 && t < dur - 0.0005)];
  // a key where the blend starts, so the ramp begins from the clip's own motion
  const keys: Key[] = clip.keys.filter((k) => k.t <= t0 + 0.0005).map((k) => ({ ...k }));
  if (!keys.length || keys[keys.length - 1]!.t < t0 - 0.0005) keys.push(whole(keyAt({ ...clip, loop: false }, t0), t0));
  for (const t of [...times, dur]) {
    const u = (t - t0) / blend, w = u * u * (3 - 2 * u);
    const k = keyAt({ ...clip, loop: false }, t);
    for (const f of POSE_FIELDS) {
      const dv = f === "yaw" ? undefined : (d[f] as number[] | undefined);
      if (dv && k[f]) k[f] = (k[f] as number[]).map((x, i) => x + (dv[i] ?? 0) * w);
    }
    keys.push(whole(k, t));
  }
  const out = without(clip);
  out.loop = true;
  out.keys = moveKeys(keys, (t) => t);
  return out;
}
