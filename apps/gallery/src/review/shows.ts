// What a clip should show (WP-F.12): its words and its numbers as an agent reads them, said in plain words on each
// review card, so the reviewer checks the motion against them. An agent picks a clip by its name, tags and description
// and by its numbers (whether it loops, how long it is, which way and how fast it travels: the catalog's row,
// spec/MOTION.md §9.3) and never sees the motion; the reviewer is the one who does. Pure: no DOM, no library.
// Distances and speeds are the clip's facts (spec/MOTION.md §7.3: `travel` [forward, right] over the clip and `speed`
// a second, in % of the body's standing hip height), said in hip heights, which way in the character's own frame (its
// left is its own), and a speed also as a grown-up's pace: with a grown-up's hip height about 0.93 m, a shuffle under
// 0.6 m/s, a slow walk to 1.1, a walk to 1.8, a brisk walk or slow jog to 2.4, a jog to 3.9, a run to 6, a sprint past.
import type { Clip } from "@m3a/core";

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

/** Under this speed (% of hip height a second) a loop stays in place: an idle's drift. */
export const STILL_SPEED = 10;
/** Under this distance (% of hip height) a one-shot ends about where it starts. */
export const STILL_TRAVEL = 25;

/** A grown-up's pace by speed (% of hip height a second): each pace's upper bound, slowest first. */
export const PACES: readonly (readonly [number, string])[] = [
  [60, "a shuffle"],
  [120, "a slow walk"],
  [190, "a walk"],
  [260, "a brisk walk or a slow jog"],
  [420, "a jog"],
  [650, "a run"],
  [Infinity, "a sprint"],
];

/** A length in seconds as a card says it, to the hundredth: 1.267 is "1.27 s", 6 is "6 s". */
export const seconds = (dur: number): string => `${Math.round(dur * 100) / 100} s`;

/** A distance in % of hip height as hip heights, to the tenth: 47 is "0.5 hip heights", 100 is "1 hip height". */
export function hips(pct: number): string {
  const x = Math.round(pct / 10) / 10;
  return `${x} hip height${x === 1 ? "" : "s"}`;
}

/** A grown-up's pace at `speed` (% of hip height a second). */
export const pace = (speed: number): string => PACES.find(([max]) => speed < max)![1];

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
 *  (else its travel over its length), a one-shot by where it ends. No facts: not measured; no travel: in place. */
export function travelWords(facts: Readonly<Record<string, unknown>> | null | undefined, loop: boolean, dur: number): string {
  if (!facts) return "How far it travels isn't measured";
  const t = Array.isArray(facts.travel) && facts.travel.length === 2 && facts.travel.every((v) => num(v) !== null) ? (facts.travel as [number, number]) : null;
  const way = t ? direction(t[0], t[1]) : null, far = t ? Math.hypot(t[0], t[1]) : 0;
  if (loop) {
    const speed = num(facts.speed) ?? (dur > 0 ? far / dur : 0);
    if (speed < STILL_SPEED) return "Stays in place";
    return `Travels ${way ? `${way} ` : ""}at about ${hips(speed)} a second (for a grown-up, ${pace(speed)})`;
  }
  if (!(far > 0)) return "Stays in place";
  if (far < STILL_TRAVEL) return "Stays about in place";
  return `Moves ${way}: it ends about ${hips(far)} from where it starts`;
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
