// The sweep (PLAN.md WP-4.5): every migrated clip played on each given skeleton (bound by WP-4.3, played by core's
// Animator in Node with its feet planted, solved onto the bones), the sensors (WP-3.3) run on what it plays, and a
// clip-by-skeleton result with every failure and its reason. A clip passes on a skeleton when the skeleton adds nothing
// wrong: its data is sound (no non-number, events in order), the sensors find no metric past a level it was under on
// the clip's own body, read the same way (the clip's own defects are the clip's, not the skeleton's: 29% of the library
// fails on its own body), and the bones reach every mapped joint's point within 5 mm.
import { readFileSync } from "node:fs";
import { Animator, format, measureFacts, solver, type AnimatorPose, type Clip, type Rest } from "@m3a/core";
import { checks, metrics } from "@m3a/sensors";
import { bind, type ThreeBound } from "../../packages/three/src/index.ts";
import { character, loadGlb, variant } from "../../packages/three/test-characters/index.ts";
import { MANIFEST, rigBytes, type Manifest } from "../fixtures/fixtures.ts";

/** How far a bone's joint may be from its body point, in mm. */
export const REACH = 5;
/** Samples a second. */
const RATE = 60;
/** Data a skeleton can't fix: a finding of these fails a clip on any skeleton. */
const DATA = ["nan", "events"];

/** One clip on one skeleton: whether it passes, and why not. */
export interface SweepRow {
  clip: string;
  rig: string;
  ok: boolean;
  why: string[];
  /** The clip's verdict on its own body and as played on the skeleton, read the same way. */
  own: string;
  played: string;
  /** The farthest a mapped joint was from its body point (mm). */
  reach: number;
  /** Each metric past a level it was under on the clip's own body: its value and levels there and as played here. */
  worse: { metric: string; own: number; ownLevels: [number, number]; played: number; playedLevels: [number, number] }[];
}

/** A skeleton by id: `gen-<seed>` for a generated test character, else a real rig fetched by `npm run fixtures`. */
export async function rigOf(id: string, manifest?: string): Promise<ThreeBound> {
  const gen = /^gen-(-?\d+)$/.exec(id);
  if (gen) return bind((await loadGlb(character(variant(Number(gen[1]))).glb)).scene);
  const m = JSON.parse(readFileSync(manifest ?? MANIFEST, "utf8")) as Manifest, bytes = rigBytes(id, m);
  if (!bytes) throw new Error(`sweep: no rig "${id}" in the cache: npm run fixtures -- fetch${manifest ? ` --manifest ${manifest}` : ""} (rigs: ${m.rigs.map((r) => r.id).join(", ")}, or gen-<seed>)`);
  return bind((await loadGlb(bytes, { textures: false })).scene);
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
 * The clip as the Animator plays it on skeleton b: its pose every 1/60 s or so (whole fixed steps of dur/n, n samples
 * over the clip; a loop's last sample its cycle's end, as the sensors take a loop's keys), the feet planted, on the
 * root, with the root's path; and the farthest any mapped bone's joint was from its body point (mm), with when.
 */
export function played(clip: Clip, b: ThreeBound, lod: 0 | 1 = 0): Played & { reach: number; at: number } {
  const n = Math.max(1, Math.ceil(clip.dur * RATE)), h = clip.dur / n, c = b.core, a = new Animator(c, { step: h });
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

/** Plays one clip (on its own rest R) on one skeleton and judges what the skeleton added. */
export function sweepOne(clip: Clip, R: Rest, b: ThreeBound, rig: string): SweepRow {
  const why: string[] = [], worse: SweepRow["worse"] = [];
  let ownVerdict = "none", playedVerdict = "none", reach = 0;
  try {
    for (const f of metrics(clip, R).findings.filter((x) => DATA.includes(x.metric))) why.push(`${f.metric}: ${f.message}`);
    if (!why.length) {
      const opts = { loop: clip.loop, id: clip.id, tags: clip.tags ?? [], parts: true };
      const own = ownFrames(clip, R), mo = checks.motionOfFrames(own.frames, R, { ...opts, root: own.root }), verdict = checks.measure(mo).verdict;
      // played with its contacts, detected on its own body where it carries none (as WP-5.4 writes them into clips)
      const p = played({ ...clip, contacts: contactsFor(clip, R) }, b), mp = checks.motionOfFrames(p.frames, b.core.rest, { ...opts, root: p.root }), rp = checks.measure(mp);
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
          why.push(`${k} ${num(ro.values[k])} on its own body → ${num(rp.values[k])} played on this one, past its ${now === 2 ? "fail" : "warn"} level`);
          const lo = checks.levels(mo, k), lp = checks.levels(mp, k), r3 = (x: number) => Math.round(x * 1000) / 1000;
          worse.push({ metric: k, own: r3(ro.values[k]), ownLevels: [r3(lo.warn), r3(lo.fail)], played: r3(rp.values[k]), playedLevels: [r3(lp.warn), r3(lp.fail)] });
        }
      }
      if (!(p.reach <= REACH)) why.push(Number.isNaN(p.reach) ? `the solve isn't a number at ${p.at.toFixed(2)} s` : `a joint ${num(p.reach)} mm from its point at ${p.at.toFixed(2)} s (at most ${REACH})`);
    }
  } catch (err) {
    why.push(`threw: ${String((err as Error).message).split("\n")[0]}`);
  }
  return { clip: clip.id, rig, ok: why.length === 0, why, own: ownVerdict, played: playedVerdict, reach: Math.round(reach * 1000) / 1000, worse };
}
