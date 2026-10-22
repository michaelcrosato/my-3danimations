// What a clip should show (WP-F.12): its words and its numbers as an agent reads them, said in plain words on each
// review card, so the reviewer checks the motion against them. An agent picks a clip by its name, tags and description
// and by its numbers (whether it loops, how long it is, which way and how fast it travels: the catalog's row,
// spec/MOTION.md §9.3, and search's hits); it never watches the clip play (at most it reads describe's summary or looks
// at a sheet's stills); the reviewer is the one who does. Pure: no DOM, no page.
// Distances and speeds are the clip's facts (spec/MOTION.md §7.3: `travel` [forward, right] over the clip and `speed`
// a second, in % of the body's standing hip height), said in metres on the library's reference body (0.95 m hips:
// @m3a/library's `mps`, the m/s search shows an agent), which way in the character's own frame (its left is its own),
// and a speed also as a grown-up's pace: a shuffle under 0.6 m/s, a slow walk to 1.1, a walk to 1.8, a brisk walk or
// slow jog to 2.4, a jog to 3.9, a run to 6, a sprint past. "Doesn't travel across the floor" says no more than that:
// a clip in place still moves its body (a frozen idle is the reviewer's to flag, D133).
import type { Clip } from "@m3a/core";
import { mps } from "@m3a/library";

/** What a card says its clip should show. */
export interface Shows {
  /** Its description as its file holds it, or null when it has none (an agent then has its name and tags alone). */
  desc: string | null;
  /** Its tags. */
  tags: string[];
  /** Whether it loops or plays once. */
  plays: "loop" | "once";
  /** Its length in seconds, as said ("1.27 s"). */
  length: string;
  /** How it plays, in words ("Loops: it repeats with no break, 1.27 s each time", "Plays once, 1.8 s long"). */
  playing: string;
  /** Whether it travels, which way and how fast, in words. */
  travel: string;
}

/** What a card says of a clip with no description. */
export const NO_DESC = "It has no description: an agent choosing it has only its name and tags to go on (worth a flag)";
/** What a card says of a clip that doesn't travel: nothing of whether its body moves. */
export const IN_PLACE = "Doesn't travel across the floor";
/** What a card says of a one-shot that ends about where it starts. */
export const ENDS_NEAR = "Ends about where it starts";

/** Under this speed (% of hip height a second) a loop doesn't travel: an idle's drift. */
export const STILL_SPEED = 10;
/** Under this distance (% of hip height) a one-shot ends about where it starts. */
export const STILL_TRAVEL = 25;

/** A grown-up's pace by speed (m/s on the reference body): each pace's upper bound, slowest first. */
export const PACES: readonly (readonly [number, string])[] = [
  [0.6, "a shuffle"],
  [1.1, "a slow walk"],
  [1.8, "a walk"],
  [2.4, "a brisk walk or a slow jog"],
  [3.9, "a jog"],
  [6, "a run"],
  [Infinity, "a sprint"],
];

/** A length in seconds as a card says it, to the hundredth: 1.267 is "1.27 s", 6 is "6 s". */
export const seconds = (dur: number): string => `${Math.round(dur * 100) / 100} s`;

const metre = (x: number) => `${x} metre${x === 1 ? "" : "s"}`;

/** A speed in % of hip height a second as metres a second on the reference body, as search shows it (to the
 *  hundredth): 110 is "1.05 metres a second". */
export const perSecond = (speed: number): string => `${metre(mps(speed)!)} a second`;

/** A distance in % of hip height as metres on the reference body, to the tenth: 50 is "0.5 metres", 105 is "1 metre". */
export const metres = (pct: number): string => metre(Math.round(mps(pct)! * 10) / 10);

/** A grown-up's pace at `v` m/s. */
export const pace = (v: number): string => PACES.find(([max]) => v < max)![1];

/** Which way a travel of `forward` and `right` goes, in the character's own frame, to the nearest eighth of a turn
 *  ("forward", "forward and to its left", "to its right", "backward" ...), or null for none. */
export function direction(forward: number, right: number): string | null {
  if (!(Math.hypot(forward, right) > 0)) return null;
  const a = (Math.atan2(right, forward) * 180) / Math.PI, side = a < 0 ? "left" : "right", b = Math.abs(a);
  if (b <= 22.5) return "forward";
  if (b >= 157.5) return "backward";
  if (b <= 67.5) return `forward and to its ${side}`;
  if (b < 112.5) return `to its ${side}`;
  return `backward and to its ${side}`;
}

/** A number fact, or null. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Whether a clip travels, which way and how fast, in words, from its facts (`travel`, `speed`): a loop by its speed
 *  (else its travel over its length), a one-shot by where it ends. No facts: not measured; no travel: none said. */
export function travelWords(facts: Readonly<Record<string, unknown>> | null | undefined, loop: boolean, dur: number): string {
  if (!facts) return "How far it travels isn't measured";
  const t = Array.isArray(facts.travel) && facts.travel.length === 2 && facts.travel.every((v) => num(v) !== null) ? (facts.travel as [number, number]) : null;
  const way = t ? direction(t[0], t[1]) : null, far = t ? Math.hypot(t[0], t[1]) : 0;
  if (loop) {
    const speed = num(facts.speed) ?? (dur > 0 ? far / dur : 0);
    if (speed < STILL_SPEED) return IN_PLACE;
    return `Travels ${way ? `${way} ` : ""}at about ${perSecond(speed)} (for a grown-up, ${pace(mps(speed)!)})`;
  }
  if (!(far > 0)) return IN_PLACE;
  if (far < STILL_TRAVEL) return ENDS_NEAR;
  return `Moves ${way}: it ends about ${metres(far)} from where it starts`;
}

/** What clip `clip` should show, from its words and `facts` (its own by default). */
export function shows(clip: Pick<Clip, "desc" | "tags" | "loop" | "dur" | "facts">, facts: Readonly<Record<string, unknown>> | null | undefined = clip.facts): Shows {
  const length = seconds(clip.dur);
  return {
    desc: typeof clip.desc === "string" && clip.desc.trim() ? clip.desc : null,
    tags: [...(clip.tags ?? [])],
    plays: clip.loop ? "loop" : "once",
    length,
    playing: clip.loop ? `Loops: it repeats with no break, ${length} each time` : `Plays once, ${length} long`,
    travel: travelWords(facts, clip.loop, clip.dur),
  };
}

/** A clip's tags as a card says them. */
export const tagWords = (tags: readonly string[]): string => (tags.length ? `Tagged: ${tags.join(", ")}` : "No tags");
