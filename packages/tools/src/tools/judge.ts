// A clip judged on a body (D80; moved from G4's sweep, tools/sweep/sweep.ts, which imports it back): the clip played by
// core's Animator on a bound skeleton, its feet planted, solved onto the bones, the sensors (WP-3.3) run on what it
// plays. It passes on that body when the body adds no fail finding: its data is sound (no non-number, events in order),
// the sensors find no metric past its fail level that was under it on the clip's own body, read the same way (the
// clip's own defects are the clip's, not the body's), and the bones reach every mapped joint's point within 5 mm. A
// metric the body takes past its warn level only is listed with the row; a value that is no finite number is written
// "not finite" in the text and null in the data. retarget.apply judges each clip so. And the bound on what one call
// plays: a foot held past MAX_HOLD, as core's planter holds it (heldStretches), is refused before anything plays
// (retarget.apply, export, graph.sim).
import { Animator, format, measureFacts, solver, type AnimatorPose, type AnimClip, type Bound, type Clip, type Rest } from "@m3a/core";
import { checks, metrics } from "@m3a/sensors";
import { ToolError } from "../registry/registry.ts";
import { sec } from "./common.ts";

/** How far a bone's joint may be from its body point, in mm. */
export const REACH = 5;
/** Samples a second. */
const RATE = 60;
/** Data a skeleton can't fix: a finding of these fails a clip on any skeleton. */
const DATA = ["nan", "events"];

/** One clip on one body (`rig` names it): whether it passes, why not, and the warns the body added. */
export interface OnBody {
  clip: string;
  rig: string;
  ok: boolean;
  why: string[];
  /** Each metric the body took past its warn level and no further (D80): listed, not failed. */
  warns: string[];
  /** The clip's verdict on its own body and as played on this one, read the same way. */
  own: string;
  played: string;
  /** The farthest a mapped joint was from its body point (mm). */
  reach: number;
  /** Each metric past a level it was under on the clip's own body: the level, its value and levels there and here (a
   *  value that is no finite number null, as the text says "not finite"). */
  worse: { metric: string; level: "warn" | "fail"; own: number | null; ownLevels: [number, number]; played: number | null; playedLevels: [number, number] }[];
}

/** Body points every 1/60 s on the root (its heading is in the pose already, D41), and where the root stands. */
export interface Played {
  frames: Float32Array[];
  root: { forward: number; right: number; yaw: number }[];
}

/** The clip on its own body as the sensors read its keys: its decoded points every 1/60 s, and its root's path. */
export function ownFrames(clip: Clip, R: Rest): Played {
  const m = checks.motionOf(clip, R);
  return { frames: m.frames, root: m.root };
}

/**
 * The clip as the Animator plays it on bound skeleton c: its pose every 1/60 s or so (whole fixed steps of dur/n, n
 * samples over the clip; a loop's last sample its cycle's end, as the sensors take a loop's keys), the feet planted, on
 * the root, with the root's path; and the farthest any mapped bone's joint was from its body point (mm), with when.
 */
export function played(clip: Clip & Pick<AnimClip, "shares">, c: Bound, lod: 0 | 1 = 0): Played & { reach: number; at: number } {
  const n = Math.max(1, Math.ceil(clip.dur * RATE)), h = clip.dur / n, a = new Animator(c, { step: h });
  a.layer("clip", { clip });
  const joints = Object.entries(c.jointPoint), frames: Float32Array[] = [], root: Played["root"] = [];
  let reach = 0, at = 0;
  for (let i = 0; i <= n; i++) {
    let p: AnimatorPose = a.pose(undefined, { lod });
    if (i === n && clip.loop) {
      const end = new Animator(c, { step: h });
      end.layer("clip", { clip, time: clip.dur * (1 - 1e-12) });
      p = { ...end.pose(undefined, { lod }), root: a.root };
    }
    frames.push(Float32Array.from(p.points));
    root.push({ ...p.root });
    for (const [bone, point] of joints) {
      const aim = solver.toSkeleton(c, p.points, format.IDX[point]! * 3), got = p.joints[c.bones[bone]!];
      if (!got) continue;
      const d = Math.hypot(got[0] - aim[0], got[1] - aim[1], got[2] - aim[2]) / c.scale;
      if (!(d <= reach)) [reach, at] = [d, i * h];
      if (Number.isNaN(reach)) return { frames, root, reach, at };
    }
    if (i < n) a.step(h);
  }
  return { frames, root, reach, at };
}

type Contacts = checks.Motion["contacts"];
/** The parts of intervals a that b covers too. */
function overlap(a: readonly [number, number][] = [], b: readonly [number, number][] = []): [number, number][] {
  const out: [number, number][] = [];
  for (const [p, q] of a) for (const [r, s] of b) if (Math.min(q, s) > Math.max(p, r)) out.push([Math.max(p, r), Math.min(q, s)]);
  return out;
}
/** The feet's stretches to read the clip's own slide over: where the played body stands and its own foot is down too; the hands' as its own. */
export function likeFor(played: Contacts, down: Contacts, own: Contacts): Contacts {
  const out: Contacts = { by: "detected" };
  for (const e of ["footL", "footR"] as const) {
    const iv = overlap(played[e], down[e]);
    if (iv.length) out[e] = iv;
  }
  for (const e of ["handL", "handR"] as const) if (own[e]) out[e] = own[e];
  return out;
}

/** The contacts a clip is played with: its own, or detected on its own body (as WP-5.4 writes them into clips). */
export function contactsFor(clip: Clip, R: Rest): Contacts {
  return clip.contacts ?? measureFacts(clip, R).contacts;
}

const level = (m: checks.Motion, k: checks.MetricName, v: number) => (v >= checks.levels(m, k).fail ? 2 : v >= checks.levels(m, k).warn ? 1 : 0);
/** A metric's value as a row's text (why, warns) writes it: "not finite" for NaN or an infinity, as worse[] holds null
 *  for one (valueData). */
export const valueText = (v: number): string => (!Number.isFinite(v) ? "not finite" : Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1));
/** A metric's value as worse[] holds it: to 3 decimals, null when it is no finite number (JSON has none), so the text
 *  and the data agree. */
export const valueData = (x: number): number | null => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/** Plays one clip (on its own rest R) on bound body b, named `rig` in the row, and judges what the body added (D80);
 *  `seen` is given what it played, when it played (retarget.apply draws it). */
export function onBody(clip: Clip, R: Rest, b: Bound, rig: string, seen?: (p: Played) => void): OnBody {
  const why: string[] = [], warns: string[] = [], worse: OnBody["worse"] = [];
  let ownVerdict = "none", playedVerdict = "none", reach = 0;
  try {
    for (const f of metrics(clip, R).findings.filter((x) => DATA.includes(x.metric))) why.push(`${f.metric}: ${f.message}`);
    if (!why.length) {
      const opts = { loop: clip.loop, id: clip.id, tags: clip.tags ?? [], parts: true };
      const own = ownFrames(clip, R), mo = checks.motionOfFrames(own.frames, R, { ...opts, root: own.root }), verdict = checks.measure(mo).verdict;
      // played with its contacts, detected on its own body where it carries none (as WP-5.4 writes them into clips)
      const p = played({ ...clip, contacts: contactsFor(clip, R), shares: R }, b);
      seen?.(p);
      const mp = checks.motionOfFrames(p.frames, b.rest, { ...opts, root: p.root }), rp = checks.measure(mp);
      // slide and skate like for like: on the clip's own body over the stretches the played body stands on, where its
      // foot is down too (by height: a foot the clip drags along the floor too fast to read as standing still slides
      // there, and that slide is the clip's)
      mo.contacts = likeFor(mp.contacts, checks.stance(mo, true), mo.contacts);
      const ro = checks.measure(mo);
      [ownVerdict, playedVerdict, reach] = [verdict, rp.verdict, p.reach];
      for (const k of checks.METRICS) {
        if (DATA.includes(k) || rp.off.includes(k)) continue;
        const was = level(mo, k, ro.values[k]), now = level(mp, k, rp.values[k]);
        if (now > was) {
          // an added fail fails the pair; an added warn is listed with it (D80)
          (now === 2 ? why : warns).push(`${k} ${valueText(ro.values[k])} on its own body → ${valueText(rp.values[k])} played on this one, past its ${now === 2 ? "fail" : "warn"} level`);
          const lo = checks.levels(mo, k), lp = checks.levels(mp, k), lv = (x: number) => Math.round(x * 1000) / 1000;
          worse.push({ metric: k, level: now === 2 ? "fail" : "warn", own: valueData(ro.values[k]), ownLevels: [lv(lo.warn), lv(lo.fail)], played: valueData(rp.values[k]), playedLevels: [lv(lp.warn), lv(lp.fail)] });
        }
      }
      if (!(p.reach <= REACH)) why.push(Number.isNaN(p.reach) ? `the solve isn't a number at ${p.at.toFixed(2)} s` : `a joint ${valueText(p.reach)} mm from its point at ${p.at.toFixed(2)} s (at most ${REACH})`);
    }
  } catch (err) {
    why.push(`threw: ${String((err as Error).message).split("\n")[0]}`);
  }
  return { clip: clip.id, rig, ok: why.length === 0, why, warns, own: ownVerdict, played: playedVerdict, reach: Math.round(reach * 1000) / 1000, worse };
}

/**
 * The longest a foot may hold the ground (s), in one stretch as core's planter holds it (heldStretches), in a clip one
 * call plays (retarget.apply, export, graph.sim). The planter (contact/plant.ts) is superlinear in a stretch's length
 * and can't be made linear bit for bit (K5, deferred), so a clip holding a foot longer is refused before anything plays.
 * Measured on this container (4 CPUs), each call's start-up included: retarget.apply on tiny, of
 * QUATERNIUS_3D2DGE/Idle_Loop retimed so both feet hold throughout: 12 s took 1.8 s; 17 s took 2.6 s (3.1 s with the
 * contact off the 1/60 grid); 24 s took 23.7 s; 30 s took 44.6 s; 60 s took 233.7 s. export (bvh): 17 s took 2.0 s;
 * 24 s took 21.9 s. The jump past about 17 s is the Animator's pose cache, which clears at 1,024 poses (animator.ts:692).
 * At the limit, re-measured: 15 s took 2.1 s in retarget.apply (1.9 s at 14.99 s, off the grid), 1.8 s in export (bvh;
 * vrma 1.1 s, glb 1.7 s) and 1.8 s in graph.sim. The library's longest bridged stretch is 12.1 s
 * (CMU_CURATED/Drink_Soda).
 */
export const MAX_HOLD = 15;
/** Seconds: a foot off the floor for less than this between two of its contacts stays planted (core's planter's BRIDGE,
 *  contact/plant.ts). */
const BRIDGE = 0.1;

/** A stretch a foot holds the ground, as core's planter holds it: which foot, from and to (s; past the clip's end when it
 *  runs on through a loop's seam). */
export interface Held {
  foot: "footL" | "footR";
  from: number;
  to: number;
}

/**
 * Each foot's stretches on the ground as core's planter holds them (contact/plant.ts `bridged`): its contacts sorted,
 * a gap under BRIDGE closed; in a loop with more than one stretch for a foot, the seam closed when its gap is under
 * BRIDGE, the last stretch then running on to the first one's end a cycle later. Longest first (ties: the left foot's,
 * then the earlier).
 */
export function heldStretches(clip: Pick<AnimClip, "contacts" | "dur" | "loop">): Held[] {
  const out: Held[] = [];
  for (const foot of ["footL", "footR"] as const) {
    const iv = [...(clip.contacts?.[foot] ?? [])].sort((p, q) => p[0] - q[0]);
    if (!iv.length) continue;
    const kept: [number, number][] = [[iv[0]![0], iv[0]![1]]];
    for (const [a, b] of iv.slice(1)) {
      const last = kept[kept.length - 1]!;
      if (a - last[1] < BRIDGE) last[1] = Math.max(last[1], b);
      else kept.push([a, b]);
    }
    if (clip.loop && clip.dur > 0 && kept.length > 1) {
      const first = kept[0]!, last = kept[kept.length - 1]!;
      if (first[0] + clip.dur - last[1] < BRIDGE) {
        last[1] = Math.max(last[1], first[1] + clip.dur);
        kept.shift();
      }
    }
    for (const [from, to] of kept) out.push({ foot, from, to });
  }
  return out.sort((x, y) => y.to - y.from - (x.to - x.from));
}

/** Refuses (usage E_ARGS) clip `title` as played (its contacts the ones the planter takes) when a foot of it holds the
 *  ground past MAX_HOLD in one stretch, naming the foot, the stretch and the limit, and how to cut it. */
export function boundHolds(clip: Pick<AnimClip, "contacts" | "dur" | "loop">, title: string): void {
  const [h] = heldStretches(clip);
  if (!h || !(h.to - h.from > MAX_HOLD)) return;
  const foot = h.foot === "footL" ? "left" : "right", seam = h.to > clip.dur ? ", on through its loop's seam" : "";
  throw new ToolError("E_ARGS", `${title}: its ${foot} foot holds the ground ${sec(h.to - h.from)} (${round3(h.from)}–${sec(h.to)}${seam}), past the ${MAX_HOLD} s one call plays a held foot for; cut it into clips whose feet hold under ${MAX_HOLD} s (a recipe's or edit's slice), and call again`, true);
}
/** A time with 3 decimals and no unit. */
const round3 = (t: number): string => sec(t).slice(0, -2);
