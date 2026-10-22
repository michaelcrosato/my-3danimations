// The root-motion rate sweep (D123; D106's follow-up): every locomotion loop in the library that has contacts, played
// as a game plays it to match a speed: core's Animator at a rate (0.5 to 2, the manual's range), the character moved by
// the root's travel (`player.travel`), on each test body, and the sensors run on what it plays in the world, as B1's
// grader reads it (bench/graders/B1/grade.ts): the planted feet's slide and skate against their fail levels on this
// body, and a foot that stands still. One loop at one rate on one body is a row; a row fails past a fail level, warns
// past a warn level only (rateVerdict). The sweep gates against a baseline of the rows that fail
// (library/baselines/rates.json, its shape rates.schema.json): a failing row not in it fails the sweep; a baselined row
// that passes now is reported, and the baseline may only shrink (`npm run sweep -- --rates --baseline` rewrites it, in
// a commit that says why). Every loop that fails a row is answered there (D127): its cause, one of the baseline's
// `causes`, and why, with the numbers; a failing loop with no answer fails the sweep, and an answer whose loop fails no
// row now is reported (againstRateAnswers).
// A row is played over one cycle in whole steps near 60 a second (the cycle's last sample its end, as the G4 sweep's
// judge plays a loop), read as a loop so every contact is whole once. The poses are the Animator's points, planted,
// without the solve onto the bones (playRates; a test holds them to `Animator.pose()`'s within a nanometre), read on
// the body's own floor: the ground its rest is measured on, where its soles are. B1's grader reads the bones (they carry
// these points) against y = 0, which on a generated test character stands 16 to 44 mm above its soles (D123).
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { clip as coreClip, contact, format, math, solver, type AnimClip, type Bound, type Clip, type Rest } from "@m3a/core";
import { checks } from "@m3a/sensors";
import { CATEGORIES } from "../qa/census.ts";
import { libraryClips, type LibraryClip } from "../qa/qa.ts";
import { ROOT } from "../run/cli.ts";
import { rigOf } from "./sweep.ts";

/** The rates a game asks of a loop (the manual's 0.5 to 2: its ends, its own rate, and a step either side of it). */
export const RATES: readonly number[] = [0.5, 0.75, 1, 1.5, 2];
/** The test bodies: the six skeletons gate G4 sweeps (generated gen-0 to gen-3, Quaternius' mannequin, KayKit's knight). */
export const RATE_RIGS: readonly string[] = ["gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight"];
/** The committed baseline: every row that fails, with its reasons (`npm run sweep -- --rates --baseline` writes it). */
export const RATE_BASELINE = join(ROOT, "library/baselines/rates.json");
/** The tags that make a clip locomotion (the census's category, tools/qa/census.ts). */
const MOVES = CATEGORIES.find((c) => c.name === "locomotion")!.tags;
/** A loop that travels slower than this (the facts' speed: hundredths of a hip height a second) plays on the spot: a
 *  game gives it no speed to match (0.05 H0/s, contact-data's floor, packages/core/test/contact-data.ts). */
const TRAVELS = 5;

/** Whether a library clip is a locomotion loop with contacts that travels: what a game plays by root motion at a rate. */
export function isRateLoop(clip: Clip): boolean {
  const feet = (clip.contacts?.footL?.length ?? 0) + (clip.contacts?.footR?.length ?? 0) > 0, speed = (clip.facts as { speed?: number } | undefined)?.speed ?? 0;
  return clip.loop && feet && speed >= TRAVELS && clip.tags.some((t) => MOVES.includes(t));
}

/** A library clip ready to play as `playable` gives it: its contacts (the library's are what `playable` measures, `npm
 *  run facts -- --check` holds them so) and its source's spine shares. */
export function rateClip({ clip, rest }: Pick<LibraryClip, "clip" | "rest">): AnimClip & Clip {
  return { ...clip, shares: { spineW: [...rest.spineW], neckW: rest.neckW } };
}

const { PORTABLE } = math;
const DEG = Math.PI / 180;
type RootPose = { forward: number; right: number; yaw: number };
/** a then b (the Animator's compose). */
const compose = (a: RootPose, b: RootPose): RootPose => {
  const c = PORTABLE.cos(a.yaw * DEG), s = PORTABLE.sin(a.yaw * DEG);
  return { forward: a.forward + b.forward * c - b.right * s, right: a.right + b.forward * s + b.right * c, yaw: a.yaw + b.yaw };
};
/** The move from a to b in a's frame (the Animator's between). */
const between = (a: RootPose, b: RootPose): RootPose => {
  const c = PORTABLE.cos(a.yaw * DEG), s = PORTABLE.sin(a.yaw * DEG), f = b.forward - a.forward, r = b.right - a.right;
  return { forward: f * c + r * s, right: -f * s + r * c, yaw: b.yaw - a.yaw };
};

/** One loop played at a rate on a body: its points every step (on the root), where the root stands, and the samples a
 *  second they were taken at (cycleSteps'). */
export interface AtRate {
  rate: number;
  frames: Float64Array[];
  root: RootPose[];
  hz: number;
}

/**
 * The steps one cycle of a loop `dur` s long is played in at `rate`: the whole number nearest to 1/60 s steps of the
 * world's time (within 1.5% of 60 a second over the library's loops), as the G4 sweep's judge plays a loop in whole
 * steps. Where two rates' steps fall on one clip time (0.5's on every other step, 1's and 2's) it is posed once.
 */
export function cycleSteps(dur: number, rate: number): number {
  return Math.max(1, Math.round((60 * dur) / rate));
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/**
 * Loop `c` (a `rateClip`) played on bound body b at each of `rates` over one cycle (cycleSteps' samples; the last is the
 * cycle's end, as the G4 sweep's judge plays a loop), as `Animator.pose()` poses it with its one layer at that speed:
 * the key decoded on b with the clip's shares, the feet planted by its contacts along its path on b, anchored where the
 * root stands; the solve onto the bones left out (the points are what it reaches). Planting depends on the clip time
 * alone (core's plant.ts), so a clip time two rates share is posed once. The root moves as the Animator moves it, which
 * is where `player.travel` takes the character; `moved` (mm/s forward) moves it at a speed of the game's own instead
 * (B1's planted skater: the feet slide by the difference).
 */
export function playRates(c: AnimClip & Clip, b: Bound, rates: readonly number[] = RATES, moved?: number): AtRate[] {
  // what the Animator's pose reads of its one layer (animator.ts: #path, #keyOf, #decoded, rootFrom); at the playhead it
  // decodes the key with the body's spine shares and the clip's neck, which the key's own spine shares make the clip's
  // decoding (a test holds the two to a nanometre)
  const path = contact.contactRoot(c, b.rest, c.contacts!), w = c.shares!.spineW;
  const keyOf = (t: number) => {
    const k = format.keyAt(c, t);
    return k.spine !== undefined ? k : { ...k, spine: [w[0]! * 100, w[1]! * 100, w[2]! * 100] };
  };
  const decoded = new Map<number, Float64Array>(), points = (t: number) => {
    let X = decoded.get(t);
    if (!X) decoded.set(t, (X = solver.decodeOn(b, keyOf(t), c.shares)));
    return X;
  };
  const pose = (tL: number, at: RootPose): Float64Array => {
    const k = keyOf(tL), X = points(tL), now = path.root(tL), memo = new Map<number, RootPose>();
    const m: contact.Motion = {
      rest: b.rest, dur: c.dur, loop: c.loop, contacts: c.contacts!,
      key: (t) => (t === tL ? k : keyOf(t)),
      points: (t) => (t === tL ? X : points(t)),
      root: (t) => {
        let r = memo.get(t);
        if (!r) memo.set(t, (r = compose(at, between(now, path.root(t)))));
        return r;
      },
    };
    return contact.plant(m, tL, {});
  };
  // each clip time once, by its share of the cycle (i / n, lowest terms): the root where the Animator's steps take it
  // from the start, and the pose there (at the cycle's end, the root a cycle on and the playhead just before it wraps)
  const p0 = path.root(0), posed = new Map<string, { X: Float64Array; root: RootPose }>();
  const at = (i: number, n: number) => {
    const g = gcd(i, n), key = `${i / g}/${n / g}`;
    let x = posed.get(key);
    if (!x) {
      const root = between(p0, path.root((c.dur * (i / g)) / (n / g)));
      posed.set(key, (x = { X: pose(i === n ? c.dur * (1 - 1e-12) : (c.dur * (i / g)) / (n / g), root), root }));
    }
    return x;
  };
  return rates.map((rate) => {
    const n = cycleSteps(c.dur, rate), h = c.dur / (rate * n), frames: Float64Array[] = [], root: RootPose[] = [];
    for (let i = 0; i <= n; i++) {
      const x = at(i, n);
      frames.push(x.X);
      root.push(moved === undefined ? { ...x.root } : { forward: moved * i * h, right: 0, yaw: 0 });
    }
    return { rate, frames, root, hz: 1 / h };
  });
}

/**
 * How still the stiller foot stands: at each step, the slower of the two feet in the world (each foot's lowest sole point
 * then, the sensors' heel, ball and toe, and the same point a step on, as their slide reads it), and that speed (mm/s)
 * at the slowest tenth of the steps. B1's grader reads the lower foot so; the slower one is the same foot wherever the
 * standing foot is the lower, and not a swinging toe that rides lower than it (KayKit's knight's, 205 mm past the
 * ball). A player that moves the body at one speed and the feet at another has none that stands, its feet too fast to
 * read as standing at all (so the slide and skate find no contact to read).
 */
export function stillest(m: checks.Motion): number {
  const v: number[] = [];
  for (let i = 1; i < m.frames.length; i++) {
    let slow = Infinity;
    for (const s of ["L", "R"] as const) {
      const here = coreClip.sole(m.rest, m.frames[i - 1]!, s), low = here.reduce((a, b) => (b.p[2] < a.p[2] ? b : a)), next = coreClip.sole(m.rest, m.frames[i]!, s).find((x) => x.name === low.name)!;
      // in the world: the root's place added (the sensors' reading, metrics/motion.ts world)
      const r0 = m.root[i - 1]!, r1 = m.root[i]!;
      slow = Math.min(slow, Math.hypot(r1.forward + next.p[0] - r0.forward - low.p[0], r1.right + next.p[1] - r0.right - low.p[1]) / m.dt);
    }
    v.push(slow);
  }
  v.sort((x, y) => x - y);
  return v[Math.floor(0.1 * (v.length - 1))] ?? 0;
}

/** One loop at one rate on one body: its verdict (rateVerdict), why it fails or warns, and what was read. */
export interface RateRow {
  clip: string;
  rig: string;
  rate: number;
  verdict: "pass" | "warn" | "fail";
  /** Each reading past its fail level (the verdict's reasons when it fails). */
  why: string[];
  /** Each past its warn level and no further. */
  warns: string[];
  /** The worst contact's slide (mm) and skate (cm/s), the stiller foot's slowest tenth (mm/s, stillest), each with its
   *  [warn, fail] levels on this body (`still` has one bar, both levels). */
  slide: number;
  skate: number;
  still: number;
  levels: { slide: [number, number]; skate: [number, number]; still: [number, number] };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
/**
 * A row's verdict from what it played (`played` on body R): fail when the planted feet slide or skate past their fail
 * levels on this body (B1's "planted feet don't slide"), or no foot stands still (B1's "a foot stands still": the
 * stiller foot's slowest tenth at or past half an H0 a second, the sensors' bar for standing, stillest); warn when the
 * slide or the skate is past its warn level only; else pass. Every rate is judged alike (D123).
 */
export function rateVerdict(clip: string, rig: string, played: AtRate, R: Rest): RateRow {
  const rate = played.rate;
  const m = checks.motionOfFrames(played.frames, R, { rate: played.hz, loop: true, root: played.root, id: clip }), s = checks.slide(m);
  const L = { slide: checks.levels(m, "slide"), skate: checks.levels(m, "skate") }, bar = R.H0 * checks.STANCE.speed, still = stillest(m);
  const why: string[] = [], warns: string[] = [];
  const read = (name: "slide" | "skate", v: number, unit: string) => {
    if (v >= L[name].fail) why.push(`${name} ${v.toFixed(1)} ${unit} at ${rate}, past its fail level ${L[name].fail.toFixed(1)}`);
    else if (v >= L[name].warn) warns.push(`${name} ${v.toFixed(1)} ${unit} at ${rate}, past its warn level ${L[name].warn.toFixed(1)}`);
  };
  read("slide", s.value, "mm");
  read("skate", s.skate.value, "cm/s");
  if (!(still < bar)) why.push(`no foot stands still at ${rate}: the stiller foot's slowest tenth moves ${(still / 1000).toFixed(2)} m/s (at most ${(bar / 1000).toFixed(2)})`);
  return {
    clip, rig, rate, verdict: why.length ? "fail" : warns.length ? "warn" : "pass", why, warns,
    slide: r3(s.value), skate: r3(s.skate.value), still: r3(still),
    levels: { slide: [r3(L.slide.warn), r3(L.slide.fail)], skate: [r3(L.skate.warn), r3(L.skate.fail)], still: [r3(bar), r3(bar)] },
  };
}

/** One loop (a library clip) at each rate on bound body b, named `rig`: a row each. */
export function rateRows(lc: Pick<LibraryClip, "clip" | "rest">, b: Bound, rig: string, rates: readonly number[] = RATES): RateRow[] {
  const c = rateClip(lc);
  return playRates(c, b, rates).map((p) => rateVerdict(c.id, rig, p, b.rest));
}

/** Some of a sweep's work: loops by id at the rates on one body (rigOf's id, from `manifest` when it isn't
 *  tools/fixtures/rigs.json's). */
export interface RateTask {
  rig: string;
  ids: string[];
  rates: number[];
  manifest?: string;
}
let library: Map<string, LibraryClip> | undefined;
const bodies = new Map<string, Promise<Bound>>();
/** A task's rows, its loops in the order given, each at its rates (the library read and each body bound once a
 *  thread). */
export async function playTask(t: RateTask): Promise<RateRow[]> {
  library ??= new Map(libraryClips().map((c) => [c.clip.id, c]));
  const key = `${t.manifest ?? ""} ${t.rig}`;
  if (!bodies.has(key)) bodies.set(key, rigOf(t.rig, t.manifest).then((x) => x.core));
  const b = await bodies.get(key)!;
  return t.ids.flatMap((id) => {
    const lc = library!.get(id);
    if (!lc) throw new Error(`sweep: no clip "${id}" in the library`);
    return rateRows(lc, b, t.rig, t.rates);
  });
}

/**
 * Loops `ids` at `rates` on each body of `rigs`, in `jobs` worker threads (rates-worker.ts; the work cut into a few
 * tasks a thread, so they finish together), or here with one job: the rows by body, then loop, then rate, as given.
 */
export async function sweepRates(ids: readonly string[], rigs: readonly string[], opts: { rates?: readonly number[]; jobs?: number; manifest?: string } = {}): Promise<RateRow[]> {
  const rates = [...(opts.rates ?? RATES)], jobs = Math.max(1, Math.min(opts.jobs ?? availableParallelism(), ids.length * rigs.length));
  const per = Math.max(1, Math.ceil((ids.length * rigs.length) / (4 * jobs))), tasks: RateTask[] = [];
  for (const rig of rigs) for (let i = 0; i < ids.length; i += per) tasks.push({ rig, ids: ids.slice(i, i + per), rates, ...(opts.manifest ? { manifest: opts.manifest } : {}) });
  if (jobs === 1) {
    const out: RateRow[] = [];
    for (const t of tasks) out.push(...(await playTask(t)));
    return out;
  }
  const done: RateRow[][] = new Array<RateRow[]>(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, () => new Promise<void>((resolve, reject) => {
    const w = new Worker(new URL("./rates-worker.ts", import.meta.url));
    let at = -1;
    const give = () => {
      if (next >= tasks.length) return void w.terminate().then(() => resolve(), reject);
      at = next++;
      w.postMessage(tasks[at]);
    };
    w.on("message", (rows: RateRow[]) => {
      done[at] = rows;
      give();
    });
    w.on("error", reject);
    give();
  })));
  return done.flat();
}

/** A row's key in the baseline: the clip, the body and the rate. */
export const rowKey = (r: Pick<RateRow, "clip" | "rig" | "rate">): string => `${r.clip} ${r.rig} ${r.rate}`;

/** Why a loop that fails a row fails (D127): its cause, a name from the baseline's `causes`, and what in its motion
 *  slides or skates at which rates, with the numbers. */
export interface RateAnswer {
  cause: string;
  why: string;
}
/** The committed baseline: every failing row by key, with its reasons, and every loop that fails a row answered. */
export interface RateBaseline {
  about: string;
  rates: number[];
  rigs: string[];
  /** How many loops were swept. */
  loops: number;
  /** The causes the answers name, each with what it means. */
  causes: Record<string, string>;
  /** Each loop (`<set>/<clip>`) that fails a row: its cause and why. */
  answers: Record<string, RateAnswer>;
  failing: Record<string, string[]>;
}
/** A row key's loop: `<set>/<clip>`. */
export const loopOf = (key: string): string => key.slice(0, key.indexOf(" "));
const byKey = <T>(xs: [string, T][]): [string, T][] => xs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
/**
 * The baseline of a sweep's rows (every rate and body of `rigs` and `rates`, over `loops` loops), the answers `kept`
 * carried for each loop that still fails a row (an answer whose loop fails none is dropped) and the causes they name.
 */
export function rateBaselineOf(rows: readonly RateRow[], loops: number, rigs: readonly string[] = RATE_RIGS, rates: readonly number[] = RATES, kept: Pick<RateBaseline, "causes" | "answers"> = { causes: {}, answers: {} }): RateBaseline {
  const about = "The rows of the root-motion rate sweep that fail (D123; npm run sweep -- --rates --baseline): each locomotion loop with contacts played at each rate on each body, moved by its root's travel, failing on the sensors' slide or skate past its fail level or no foot that stands still. Keyed `<clip> <body> <rate>`, with its reasons. Each loop that fails a row is answered (D127): its cause, one of `causes`, and why, with the numbers. npm run sweep -- --rates --check fails on a failing row not here or a failing loop with no answer, and reports each row here that passes and each answered loop that fails no row; the baseline may only shrink, rewritten in a commit that says why (--baseline carries the answers of the loops that still fail).";
  const failing = Object.fromEntries(byKey(rows.filter((r) => r.verdict === "fail").map((r) => [rowKey(r), r.why])));
  const still = new Set(Object.keys(failing).map(loopOf)), answers = Object.fromEntries(byKey(Object.entries(kept.answers).filter(([id]) => still.has(id))));
  const named = new Set(Object.values(answers).map((a) => a.cause)), causes = Object.fromEntries(byKey(Object.entries(kept.causes).filter(([c]) => named.has(c))));
  return { about, rates: [...rates], rigs: [...rigs], loops, causes, answers, failing };
}
/** The baseline's text: one cause, answer and failing row a line, so a change reads as the rows and answers it moved. */
export function rateBaselineText(b: RateBaseline): string {
  const block = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  const answers = Object.fromEntries(Object.entries(b.answers).map(([id, a]) => [id, { cause: a.cause, why: a.why }]));
  return `{\n "about": ${JSON.stringify(b.about)},\n "rates": ${JSON.stringify(b.rates)},\n "rigs": ${JSON.stringify(b.rigs)},\n "loops": ${b.loops},\n "causes": {\n${block(b.causes)}\n },\n "answers": {\n${block(answers)}\n },\n "failing": {\n${block(b.failing)}\n }\n}\n`;
}
/** A cause's name: lower-case words joined by hyphens. */
const CAUSE = /^[a-z]+(-[a-z]+)*$/;
/** What is wrong with a baseline's shape (tools/sweep/rates.schema.json), none when it is right. */
export function rateBaselineProblems(b: unknown): string[] {
  const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v), out: string[] = [];
  const text = (v: unknown) => typeof v === "string" && v !== "";
  if (!obj(b)) return ["the baseline is a JSON object"];
  for (const k of Object.keys(b)) if (!["about", "rates", "rigs", "loops", "causes", "answers", "failing"].includes(k)) out.push(`"${k}" is not a field of the baseline (about, rates, rigs, loops, causes, answers, failing)`);
  if (b.about !== undefined && typeof b.about !== "string") out.push("about says what the baseline holds, as a text");
  if (!Array.isArray(b.rates) || !b.rates.length || !b.rates.every((r) => typeof r === "number" && r > 0)) out.push("rates lists the rates swept, each above 0");
  if (!Array.isArray(b.rigs) || !b.rigs.length || !b.rigs.every((r) => typeof r === "string" && r !== "")) out.push("rigs lists the bodies swept by id");
  if (!Number.isInteger(b.loops) || (b.loops as number) < 0) out.push("loops counts the loops swept");
  if (!obj(b.causes) || !Object.entries(b.causes).every(([k, v]) => CAUSE.test(k) && text(v))) out.push("causes maps a cause's name (lower-case words joined by hyphens) to what it means, a text");
  if (!obj(b.answers) || !Object.entries(b.answers).every(([k, a]) => /^[^\s/]+\/\S+$/.test(k) && obj(a) && Object.keys(a).every((f) => f === "cause" || f === "why") && text(a.why) && typeof a.cause === "string" && (!obj(b.causes) || Object.hasOwn(b.causes, a.cause)))) out.push("answers maps a loop `<set>/<clip>` to its cause, one of causes, and why it fails, a text");
  if (!obj(b.failing) || !Object.entries(b.failing).every(([k, why]) => /^\S+\/\S+ \S+ \d+(\.\d+)?$/.test(k) && Array.isArray(why) && why.length > 0 && why.every((w) => typeof w === "string" && w !== ""))) out.push("failing maps `<clip> <body> <rate>` to its reasons, each a text");
  return out;
}
/** The committed baseline (checked: a bad file throws, naming what is wrong). */
export function readRateBaseline(file = RATE_BASELINE): RateBaseline {
  const b = JSON.parse(readFileSync(file, "utf8")) as unknown, bad = rateBaselineProblems(b);
  if (bad.length) throw new Error(`${file}: ${bad.join("; ")}`);
  return b as RateBaseline;
}

/**
 * A sweep's rows against the baseline: `failures`, each row that fails and isn't baselined (the sweep fails on any);
 * `better`, each baselined row the sweep played that passes or warns now (reported: rewrite the baseline with
 * --baseline). Rows the sweep didn't play (a sample) are neither.
 */
export function againstRateBaseline(base: Pick<RateBaseline, "failing">, rows: readonly RateRow[]): { failures: RateRow[]; better: RateRow[] } {
  return { failures: rows.filter((r) => r.verdict === "fail" && !base.failing[rowKey(r)]), better: rows.filter((r) => r.verdict !== "fail" && base.failing[rowKey(r)]) };
}

/**
 * A sweep's rows against the baseline's answers (D127): `unanswered`, each loop that fails a row the sweep played and
 * has no answer (the sweep fails on any); `passing`, each answered loop that fails no row now, judged where it can be:
 * the baseline holds no failing row of it, or the sweep played every row the baseline holds failing for it and failed
 * none of its rows (reported: --baseline drops its answer). A loop a sample didn't play every failing row of is neither.
 */
export function againstRateAnswers(base: Pick<RateBaseline, "failing" | "answers">, rows: readonly RateRow[]): { unanswered: string[]; passing: string[] } {
  const played = new Set(rows.map(rowKey)), failed = new Set(rows.filter((r) => r.verdict === "fail").map((r) => r.clip)), held = new Map<string, string[]>();
  for (const k of Object.keys(base.failing)) held.set(loopOf(k), [...(held.get(loopOf(k)) ?? []), k]);
  const unanswered = [...failed].filter((id) => !Object.hasOwn(base.answers, id)).sort();
  const passing = Object.keys(base.answers).filter((id) => !failed.has(id) && (held.get(id) ?? []).every((k) => played.has(k))).sort();
  return { unanswered, passing };
}
