// The contact reading a loop could carry, chosen by D108's bar and its captured speed (D129): core's twelve named
// readings of an in-place loop's contacts (`clip.CONTACT_READINGS`: six measureFacts and its fallbacks take, six more
// of the same parts D122 weighed and the chain never takes) and the one its file holds (measureFacts' default chain,
// `file`), each held to D108's bar: both feet plant, a foot is down a fifth of the loop or more, and the
// planter holds both ankles within 10% of H0 at every sample over two cycles (clip.test.ts's pull, core's `holds`), on
// the loop as the library plays it and retimed at 0.5, 0.75, 1.5 and 2 as `playable` reads it (D127). A named reading
// is held there twice: read afresh on the retimed loop, and as the loop's own reading moved with its keys (core's
// retime, what a labelled reading plays). Of the readings that pass, the one whose ground speed (contactRoot's, to a
// tenth of a percent of H0 a second, the facts' precision) is nearest the loop's captured speed; a tie keeps the
// file's, then the earlier name; a loop with no captured speed, or no reading that passes, keeps its file's. The rule
// reads the loop, its rest and its captured speed alone, never the rate sweep's rows.
import { clip as coreClip, contact, format, math, measureFacts, ops, type Clip, type Rest } from "@m3a/core";

const { PORTABLE } = math, { decodePose, keyAt, IDX } = format;
type Contacts = NonNullable<Clip["contacts"]>;
type ContactReading = coreClip.ContactReading;
/** A reading's name: core's, or `file` for the one the loop's file holds (measureFacts' default chain). */
export type ReadingName = "file" | ContactReading;
/** The speeds a game retimes a loop to besides its own (the rate sweep's, D123). */
export const RETIMES: readonly number[] = [0.5, 0.75, 1.5, 2];
/** D108's bar: the planter's largest ankle pull, of H0. */
export const PULL_BAR = 0.1;
/** D108's bar: the share of the loop's samples a foot must be down. */
export const DOWN_BAR = 0.2;

/** One reading of a loop held to D108's bar. */
export interface ReadingCheck {
  reading: ReadingName;
  /** At the loop's own speed: its contacts, the feet they plant, the share of the samples a foot is down, and the
   *  ground speed contactRoot reads from them (% of H0 a second, the facts' unit, to a tenth). */
  contacts: Contacts;
  feet: number;
  down: number;
  ground: number;
  /** The planter's largest ankle pull (of H0) at each speed held, and how each was read ("1", "0.5", "0.5 moved"). */
  pulls: Record<string, number>;
  /** Why it fails the bar, the first reason found; none when it passes. */
  fails?: string;
}
/** The rule's verdict on a loop: every reading held to the bar, and the one chosen with why. */
export interface ReadingChoice {
  id: string;
  captured?: number;
  checks: ReadingCheck[];
  chosen: ReadingName;
  why: string;
}

/** The share of `clip`'s samples (sampleAll's, 60 a second) with a foot down by `contacts`. */
function downShare(clip: Pick<Clip, "dur" | "loop">, contacts: Contacts): number {
  const n = Math.max(1, Math.ceil(clip.dur * 60)), dt = clip.dur / n;
  let down = 0;
  for (let i = 0; i <= n; i++) {
    const at = coreClip.contactsAt({ ...clip, keys: [], contacts } as never, i * dt);
    if (at.footL || at.footR) down++;
  }
  return down / (n + 1);
}

/** The planter's largest ankle pull (mm) planting `contacts` on `clip` over two cycles, 60 samples a second, under the
 *  root contactRoot reads from them: core's `holds`, measured. */
export function pullOf(clip: Clip, R: Rest, contacts: Contacts): number {
  const memo = new Map<number, Float64Array>(), ankles = [IDX.ankleL! * 3, IDX.ankleR! * 3];
  const points = (t: number) => {
    let X = memo.get(t);
    if (!X) memo.set(t, (X = Float64Array.from(decodePose(R, keyAt(clip, t), new Array<number>(108)))));
    return X;
  };
  const m: contact.Motion = { rest: R, dur: clip.dur, loop: clip.loop, contacts, key: (t) => keyAt(clip, t), points, root: contact.contactRoot(clip, R, contacts).root };
  let most = 0;
  for (let i = 0; i <= 120 * clip.dur; i++) {
    const t = i / 60, X = contact.plant(m, t), Y = points(t);
    for (const a of ankles) most = Math.max(most, PORTABLE.hypot(X[a]! - Y[a]!, X[a + 1]! - Y[a + 1]!, X[a + 2]! - Y[a + 2]!));
  }
  return most;
}
/** `name`'s contacts on `clip` (the file's: measureFacts', as `playable` reads them). */
const readingOf = (clip: Clip, R: Rest, name: ReadingName): Contacts => (name === "file" ? measureFacts(clip, R).contacts : coreClip.readContacts(clip, R, name));

/** One reading of a loop held to D108's bar at its own speed and retimed (RETIMES). */
export function checkReading(clip: Clip, R: Rest, name: ReadingName): ReadingCheck {
  const own = readingOf(clip, R, name), feet = [own.footL, own.footR].filter((x) => x?.length).length;
  const check: ReadingCheck = { reading: name, contacts: own, feet, down: round3(downShare(clip, own)), ground: round1((contact.contactRoot(clip, R, own).speed * 100) / R.H0), pulls: {} };
  const bar = (label: string, c: Clip, cs: Contacts): string | undefined => {
    const f = [cs.footL, cs.footR].filter((x) => x?.length).length, d = downShare(c, cs);
    if (f < 2) return `${label}: ${f ? "one foot" : "no foot"} plants`;
    if (d < DOWN_BAR) return `${label}: a foot is down ${pct(d)} of the loop, under a fifth`;
    const p = pullOf(c, R, cs) / R.H0;
    check.pulls[label] = round3(p);
    return p >= PULL_BAR ? `${label}: the planter pulls an ankle ${pct(p)} of H0` : undefined;
  };
  const reasons: (string | undefined)[] = [bar("1", clip, own)];
  for (const s of RETIMES) {
    if (reasons.some(Boolean)) break;
    const at = ops.retime(clip, { speed: s });
    reasons.push(bar(String(s), at, readingOf(at, R, name)));
    // a named reading written as the loop's own moves with its keys when a game retimes it
    if (name !== "file" && !reasons.some(Boolean)) reasons.push(bar(`${s} moved`, at, ops.retime({ ...clip, contacts: { ...own, by: "labelled" } }, { speed: s }).contacts!));
  }
  const fails = reasons.find(Boolean);
  return fails ? { ...check, fails } : check;
}

/**
 * The rule (D129): every reading of the loop held to D108's bar (checkReading); of those that pass, the one whose
 * ground speed (to a tenth) is nearest `captured` (% of H0 a second), a tie keeping the file's, then the earlier name
 * in CONTACT_READINGS (the order decides between readings whose contacts differ); with no captured speed, or none that
 * passes, the file's. It reads the loop, its rest and its captured speed alone.
 */
export function chooseReading(clip: Clip, R: Rest, captured: number | undefined): ReadingChoice {
  if ((clip.keys[0] as { root?: unknown }).root !== undefined || !clip.loop) return { id: clip.id, ...(captured === undefined ? {} : { captured }), checks: [], chosen: "file", why: "not an in-place loop: its file's reading stands" };
  if (captured === undefined) return { id: clip.id, checks: [], chosen: "file", why: "no captured speed: its file's reading stands" };
  const checks = (["file", ...coreClip.CONTACT_READINGS] as ReadingName[]).map((n) => checkReading(clip, R, n)), ok = checks.filter((c) => !c.fails);
  if (!ok.length) return { id: clip.id, captured, checks, chosen: "file", why: "no reading passes D108's bar: its file's stands" };
  const best = ok.reduce((a, b) => (Math.abs(b.ground - captured) < Math.abs(a.ground - captured) ? b : a));
  return { id: clip.id, captured, checks, chosen: best.reading, why: `of ${ok.length} reading(s) that pass, its ground speed ${best.ground} is nearest the captured ${captured}` };
}

const round1 = (x: number) => Math.round(x * 10) / 10, round3 = (x: number) => Math.round(x * 1000) / 1000;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
