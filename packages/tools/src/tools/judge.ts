// A clip judged on a body (D80; moved from G4's sweep, tools/sweep/sweep.ts, which imports it back): the clip played by
// core's Animator on a bound skeleton, its feet planted, solved onto the bones, the sensors (WP-3.3) run on what it
// plays. It passes on that body when the body adds no fail finding: its data is sound (no non-number, events in order),
// the sensors find no metric past its fail level that was under it on the clip's own body, read the same way (the
// clip's own defects are the clip's, not the body's), and the bones reach every mapped joint's point within 5 mm. A
// metric the body takes past its warn level only is listed with the row. retarget.apply judges each clip so.
import { Animator, format, measureFacts, solver, type AnimatorPose, type AnimClip, type Bound, type Clip, type Rest } from "@m3a/core";
import { checks, metrics } from "@m3a/sensors";

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
  /** Each metric past a level it was under on the clip's own body: the level, its value and levels there and here. */
  worse: { metric: string; level: "warn" | "fail"; own: number; ownLevels: [number, number]; played: number; playedLevels: [number, number] }[];
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
const num = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1));

/** Plays one clip (on its own rest R) on bound body b, named `rig` in the row, and judges what the body added (D80). */
export function onBody(clip: Clip, R: Rest, b: Bound, rig: string): OnBody {
  const why: string[] = [], warns: string[] = [], worse: OnBody["worse"] = [];
  let ownVerdict = "none", playedVerdict = "none", reach = 0;
  try {
    for (const f of metrics(clip, R).findings.filter((x) => DATA.includes(x.metric))) why.push(`${f.metric}: ${f.message}`);
    if (!why.length) {
      const opts = { loop: clip.loop, id: clip.id, tags: clip.tags ?? [], parts: true };
      const own = ownFrames(clip, R), mo = checks.motionOfFrames(own.frames, R, { ...opts, root: own.root }), verdict = checks.measure(mo).verdict;
      // played with its contacts, detected on its own body where it carries none (as WP-5.4 writes them into clips)
      const p = played({ ...clip, contacts: contactsFor(clip, R), shares: R }, b), mp = checks.motionOfFrames(p.frames, b.rest, { ...opts, root: p.root }), rp = checks.measure(mp);
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
          (now === 2 ? why : warns).push(`${k} ${num(ro.values[k])} on its own body → ${num(rp.values[k])} played on this one, past its ${now === 2 ? "fail" : "warn"} level`);
          const lo = checks.levels(mo, k), lp = checks.levels(mp, k), r3 = (x: number) => Math.round(x * 1000) / 1000;
          worse.push({ metric: k, level: now === 2 ? "fail" : "warn", own: r3(ro.values[k]), ownLevels: [r3(lo.warn), r3(lo.fail)], played: r3(rp.values[k]), playedLevels: [r3(lp.warn), r3(lp.fail)] });
        }
      }
      if (!(p.reach <= REACH)) why.push(Number.isNaN(p.reach) ? `the solve isn't a number at ${p.at.toFixed(2)} s` : `a joint ${num(p.reach)} mm from its point at ${p.at.toFixed(2)} s (at most ${REACH})`);
    }
  } catch (err) {
    why.push(`threw: ${String((err as Error).message).split("\n")[0]}`);
  }
  return { clip: clip.id, rig, ok: why.length === 0, why, warns, own: ownVerdict, played: playedVerdict, reach: Math.round(reach * 1000) / 1000, worse };
}
