// Events in a window of playback (PLAN.md WP-2.2; spec/MOTION.md §7.2): each event of a clip, at each time the
// playhead passes it, in order. A window is [t0, t1) on the playback timeline, so consecutive windows fire each
// occurrence exactly once. A loop repeats its events every cycle; an event at a loop's end (t = dur) is the same moment
// as its start and fires once per cycle. Played backwards (t1 < t0) the window is (t1, t0], newest first.
import type { ClipEvent } from "../format/types.ts";
import type { Playable } from "./sample.ts";

/** One occurrence: the event, when on the playback timeline, and in which cycle of a loop (0 for a one-shot). */
export interface Fired {
  t: number;
  cycle: number;
  event: ClipEvent;
}

/** The events the playhead passes going from t0 to t1, in the order it passes them. */
export function events(clip: Playable & { events?: ClipEvent[] }, t0: number, t1: number): Fired[] {
  const list = clip.events ?? [];
  if (!list.length || t0 === t1) return [];
  const lo = Math.min(t0, t1), hi = Math.max(t0, t1), forward = t1 > t0;
  const inside = (s: number) => (forward ? s >= lo && s < hi : s > lo && s <= hi);
  const out: Fired[] = [];
  const dur = clip.dur;
  if (clip.loop && dur > 0) {
    for (let k = Math.floor(lo / dur) - 1; k * dur <= hi; k++) {
      for (const e of list) {
        const s = (e.t >= dur ? e.t - dur : e.t) + k * dur;
        if (inside(s)) out.push({ t: s, cycle: k, event: e });
      }
    }
  } else for (const e of list) if (inside(e.t)) out.push({ t: e.t, cycle: 0, event: e });
  out.sort((a, b) => (forward ? a.t - b.t : b.t - a.t));
  return out;
}
