// A clip judged on a body (D80; moved from G4's sweep, tools/sweep/sweep.ts, which imports it back): the clip played by
// core's Animator on a bound skeleton, its feet planted, solved onto the bones, the sensors (WP-3.3) run on what it
// plays. It passes on that body when the body adds no fail finding: its data is sound (no non-number, events in order),
// the sensors find no metric past its fail level that was under it on the clip's own body, read the same way (the
// clip's own defects are the clip's, not the body's), and the bones reach every mapped joint's point within 5 mm (above
// a spine bone that spans format points the rig has no bones for, read bone by bone against each one's mapped parent,
// the torso's own miss reported: spannedSpine). A
// metric the body takes past its warn level only is listed with the row; a value that is no finite number is written
// "not finite" in the text and null in the data. retarget.apply judges each clip so. And the bound on what one call
// plays: a foot held past MAX_HOLD, as core's planter holds it (heldStretches), or feet whose holds the planter would
// reread past MAX_REREAD at a step (reread), is refused before anything plays (retarget.apply, export, graph.sim).
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
  /** The farthest a mapped joint was from its body point (mm); above a spanned spine, from its point against its mapped
   *  parent's (spannedSpine). */
  reach: number;
  /** The most a torso joint above a spanned spine missed its point (mm; 0 on a rig with every spine bone): what the
   *  missing bones can't follow, allowed within TORSO of H0. */
  spans: number;
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
 * the root, with the root's path; and the farthest any mapped bone's joint was from its body point (mm), with when
 * (above a spanned spine as spannedSpine says), and the most a torso joint there missed (`spans`).
 */
export function played(clip: Clip & Pick<AnimClip, "shares">, c: Bound, lod: 0 | 1 = 0): Played & { reach: number; at: number; spans: number } {
  const n = Math.max(1, Math.ceil(clip.dur * RATE)), h = clip.dur / n, a = new Animator(c, { step: h });
  a.layer("clip", { clip });
  const joints = Object.entries(c.jointPoint), frames: Float32Array[] = [], root: Played["root"] = [];
  const { torso, parent } = spannedSpine(c);
  let reach = 0, at = 0, most = 0;
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
      let d = Math.hypot(got[0] - aim[0], got[1] - aim[1], got[2] - aim[2]) / c.scale;
      // above a spanned spine: the torso's own joints miss by what the rig can't follow (reported, within TORSO of H0);
      // every other bone is read against its mapped parent, so a wrong mapping still shows
      if (torso.has(bone)) [most, d] = [Math.max(most, d), d <= TORSO * c.rest.H0 ? 0 : d];
      else if (parent.has(bone)) {
        const pa = parent.get(bone)!, ga = p.joints[c.bones[pa]!], aa = solver.toSkeleton(c, p.points, format.IDX[c.jointPoint[pa]!]! * 3);
        if (ga) d = Math.hypot(got[0] - ga[0] - (aim[0] - aa[0]), got[1] - ga[1] - (aim[1] - aa[1]), got[2] - ga[2] - (aim[2] - aa[2])) / c.scale;
      }
      if (!(d <= reach)) [reach, at] = [d, i * h];
      if (Number.isNaN(reach)) return { frames, root, reach, at, spans: most };
    }
    if (i < n) a.step(h);
  }
  return { frames, root, reach, at, spans: most };
}

/** The format's spine points, pelvis to head, in order. */
const SPINE_POINTS = ["pelvis", "spine1", "spine2", "chest", "neck", "head"];
/** How far, as a share of H0, a torso joint above a spanned spine may miss its point: what the missing bones can't
 *  follow is a curl's few centimetres; a bone mapped wrong misses by a bone's length. */
export const TORSO = 0.05;
/**
 * Where a bound rig's spine bones span format spine points it has no bones for (a rig without chest bones: its spine
 * bone reaches from spine1 to the neck), what reach reads above the lowest such span: the torso's own joints (each
 * whose nearest mapped parent bone is a spine bone), whose miss is the span's; and every other mapped bone there, with
 * its nearest mapped parent, against which it is read. Both empty on a rig with every spine bone.
 */
export function spannedSpine(c: Pick<Bound, "jointPoint" | "bones" | "order">): { torso: Set<string>; parent: Map<string, string> } {
  const chain = Object.entries(c.jointPoint).filter(([b, pt]) => SPINE_POINTS.includes(pt) && c.bones[b] !== undefined).sort((x, y) => SPINE_POINTS.indexOf(x[1]) - SPINE_POINTS.indexOf(y[1]));
  const span = chain.findIndex(([, pt], i) => i > 0 && SPINE_POINTS.indexOf(pt) - SPINE_POINTS.indexOf(chain[i - 1]![1]) > 1);
  const torso = new Set<string>(), parent = new Map<string, string>();
  if (span < 0) return { torso, parent };
  const lowest = SPINE_POINTS.indexOf(chain[span - 1]![1]), legs = /^(hip|knee|ankle|ball|toe|heel)[LR]$/;
  const index = new Map(c.order.map((b, i) => [b.name, i])), human = new Map(Object.entries(c.bones).filter(([h]) => c.jointPoint[h]).map(([h, src]) => [src, h]));
  const spine = new Set(chain.map(([b]) => b));
  for (const [b, pt] of Object.entries(c.jointPoint)) {
    if (c.bones[b] === undefined || legs.test(pt) || (SPINE_POINTS.includes(pt) && SPINE_POINTS.indexOf(pt) <= lowest)) continue;
    // the nearest ancestor in the rig that a mapped humanoid bone sits on
    let i = c.order[index.get(c.bones[b]!) ?? -1]?.parent ?? -1, up: string | undefined;
    while (i >= 0 && !(up = human.get(c.order[i]!.name))) i = c.order[i]!.parent;
    if (!up || spine.has(up)) torso.add(b);
    else parent.set(b, up);
  }
  return { torso, parent };
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
  let ownVerdict = "none", playedVerdict = "none", reach = 0, spans = 0;
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
      [ownVerdict, playedVerdict, reach, spans] = [verdict, rp.verdict, p.reach, p.spans];
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
  return { clip: clip.id, rig, ok: why.length === 0, why, warns, own: ownVerdict, played: playedVerdict, reach: Math.round(reach * 1000) / 1000, spans: Math.round(spans * 1000) / 1000, worse };
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
 * vrma 1.1 s, glb 1.7 s) and 1.8 s in graph.sim on a short script. Over a long one such a clip costs graph.sim about
 * twice a walk's (37.5 s on one layer over 600 s, a walk 18.4 s; 118 s on 4 layers), which compose.ts's MAX_CLIP_STEPS
 * is measured with. A foot's stretch alone is not all the cache keeps: both feet's, from different starts, are read at
 * once (MAX_REREAD), and so is one clip played at several times at once (compose.ts charges that). The library's
 * longest bridged stretch is 12.1 s (CMU_CURATED/Drink_Soda).
 */
export const MAX_HOLD = 15;
/**
 * The most held ground (s) one call has core's planter reread from one clip at a step (reread), in a clip one call
 * plays. The planter reads every stretch a step's settle touches (a foot's stretch now, one ended within its release,
 * one starting within the settle) again from the stretch's start, at 60 poses a second, from the Animator's cache of
 * that clip, which clears at 1,024 poses (animator.ts:692); past about 1,000 a step it clears every step and decodes
 * every pose again (about 22 µs each here). MAX_HOLD bounds one stretch; this bounds them together, a stretch counted
 * once when both feet start it together (the same poses). 16 s is 960 poses plus at most about 30 of the settle's own.
 * Measured on tiny (retarget.apply, a 60 s clip of QUATERNIUS_3D2DGE/Idle_Loop's keys): its feet held 14.9 s each
 * from starts 7.6 s apart off the 1/60 grid (22.9 s reread at once) took 33.9 s against 4.7 to 5.2 s with the feet's
 * stretches starting together (15.2 s), the cache cleared 1,518 times against 5; at this limit (both feet 7.8 s from
 * starts 0.013 s apart, 16.0 s) 4.6 s, 8 clears. Starts on one 1/60 grid share some poses, which this doesn't count
 * (their feet 15 s from starts 2 s apart reread 28.4 s and took 4.7 s): it errs on the safe side. Idle_Loop retimed to
 * 15 s rereads 15.4 s (its last cycle's stretch in the 0.3 s after the seam); the library's most is 12.1 s
 * (CMU_CURATED/Drink_Soda).
 */
export const MAX_REREAD = 16;
/** Seconds either side of a step the planter's settle reads (contact/plant.ts settleSmooth), and how long after a
 *  stretch ends its hold is still read (its release, and the settle's blend). */
const SETTLE = 0.1, RELEASE = 0.2;
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

/** What one play of a clip has core's planter reread at a step (s of held ground, 60 poses a second), at its most. */
export interface Reread {
  /** The most it rereads at one step, a stretch once when both feet start it together: what the clip's pose cache must
   *  keep. */
  held: number;
  /** When (s, the clip's own time), and each stretch read then: its foot, its start (the clip's own time) and how much
   *  of it is read. */
  at: number;
  stretches: { foot: Held["foot"]; from: number; span: number }[];
  /** The most it reads at one step with each foot's stretches counted on their own (s): what it decodes again at a step
   *  when its cache can't keep them. */
  each: number;
}

/**
 * What one play of a clip (its contacts the ones the planter takes) has core's planter reread at a step, at its most
 * (contact/plant.ts: `holds` sums each stretch's drift from its start on a 1/60 grid, for the step and for each
 * settle sample within SETTLE of it). A stretch is read at playhead t while some sample u within SETTLE of t is in it
 * or within RELEASE after it, from its start to the latest such u (or its end); a loop's stretches a cycle either side
 * too, a once clip's samples within it. Between the times a stretch stops being read the sum only grows, so its most
 * is just before one of those times, or at the end.
 */
export function reread(clip: Pick<AnimClip, "contacts" | "dur" | "loop">): Reread {
  const loop = clip.loop && clip.dur > 0, end = clip.dur;
  const all = heldStretches(clip).flatMap((h) => (loop ? [-2, -1, 0, 1] : [0]).map((k) => ({ foot: h.foot, from: h.from + k * clip.dur, to: h.to + k * clip.dur })));
  const read = (t: number): Reread => {
    const lo = loop ? t - SETTLE : Math.max(0, t - SETTLE), hi = loop ? t + SETTLE : Math.min(end, t + SETTLE);
    const on = all.filter((h) => h.from <= hi && h.to + RELEASE >= lo).map((h) => ({ foot: h.foot, from: h.from, span: Math.min(hi, h.to) - h.from }));
    const starts = new Map<number, number>();
    for (const s of on) starts.set(s.from, Math.max(starts.get(s.from) ?? 0, s.span));
    return { held: [...starts.values()].reduce((a, b) => a + b, 0), at: t, stretches: on, each: on.reduce((a, s) => a + s.span, 0) };
  };
  let best = read(0), each = best.each;
  for (const t of [...all.map((h) => h.to + RELEASE + SETTLE - 1e-9), loop ? end - 1e-9 : end]) {
    if (!(t >= 0 && t <= end)) continue;
    const r = read(t);
    if (r.held > best.held) best = r;
    each = Math.max(each, r.each);
  }
  // a loop's stretch from the cycle before (or after) named by its start in the clip's own time
  const own = (x: number) => (loop ? ((x % end) + end) % end : x);
  return { ...best, stretches: best.stretches.map((s) => ({ ...s, from: own(s.from) })), each };
}

/** Refuses (usage E_ARGS) clip `title` as played (its contacts the ones the planter takes) when a foot of it holds the
 *  ground past MAX_HOLD in one stretch, naming the foot, the stretch and the limit, and how to cut it; or when the
 *  planter would reread past MAX_REREAD of it at a step (reread), naming when and the stretches read then. Gives what
 *  the clip has the planter reread (graph.sim charges a clip played at several times at once by it). */
export function boundHolds(clip: Pick<AnimClip, "contacts" | "dur" | "loop">, title: string): Reread {
  const [h] = heldStretches(clip), side = (f: Held["foot"]) => (f === "footL" ? "left" : "right");
  if (h && h.to - h.from > MAX_HOLD) {
    const seam = h.to > clip.dur ? ", on through its loop's seam" : "";
    throw new ToolError("E_ARGS", `${title}: its ${side(h.foot)} foot holds the ground ${sec(h.to - h.from)} (${round3(h.from)}–${sec(h.to)}${seam}), past the ${MAX_HOLD} s one call plays a held foot for; cut it into clips whose feet hold under ${MAX_HOLD} s (a recipe's or edit's slice), and call again`, true);
  }
  const r = reread(clip);
  if (!(r.held > MAX_REREAD)) return r;
  const read = r.stretches.filter((s) => s.span > 0).sort((x, y) => y.span - x.span).slice(0, 3).map((s) => `${side(s.foot)} ${sec(s.span)} from ${round3(s.from)} s`);
  throw new ToolError("E_ARGS", `${title}: at ${sec(r.at)} the planter rereads ${sec(r.held)} of its feet's holds (${read.join(", ")}), past the ${MAX_REREAD} s one call rereads at a step; cut it into clips whose feet's holds add up to under ${MAX_REREAD} s at any time (a recipe's or edit's slice), and call again`, true);
}
/** A time with 3 decimals and no unit. */
const round3 = (t: number): string => sec(t).slice(0, -2);
