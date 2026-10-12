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
}

/** A skeleton by id: `gen-<seed>` for a generated test character, else a real rig fetched by `npm run fixtures`. */
export async function rigOf(id: string, manifest?: string): Promise<ThreeBound> {
  const gen = /^gen-(-?\d+)$/.exec(id);
  if (gen) return bind((await loadGlb(character(variant(Number(gen[1]))).glb)).scene);
  const m = JSON.parse(readFileSync(manifest ?? MANIFEST, "utf8")) as Manifest, bytes = rigBytes(id, m);
  if (!bytes) throw new Error(`sweep: no rig "${id}" in the cache: npm run fixtures -- fetch${manifest ? ` --manifest ${manifest}` : ""} (rigs: ${m.rigs.map((r) => r.id).join(", ")}, or gen-<seed>)`);
  return bind((await loadGlb(bytes, { textures: false })).scene);
}

/** A pose's body points in the world: the root's place added (its heading is in the pose already, D41). */
function world(points: ArrayLike<number>, root: { forward: number; right: number }): Float32Array {
  const g = Float32Array.from(points);
  for (let i = 0; i < g.length; i += 3) {
    g[i] = g[i]! + root.forward;
    g[i + 1] = g[i + 1]! + root.right;
  }
  return g;
}

/** The clip on its own body as the sensors read its keys: its decoded points every 1/60 s, in the world. */
export function ownFrames(clip: Clip, R: Rest): Float32Array[] {
  const m = checks.motionOf(clip, R);
  return m.frames.map((f, i) => world(f, m.root[i]!));
}

/**
 * The clip as the Animator plays it on skeleton b: its pose every 1/60 s or so (whole fixed steps of dur/n, n samples
 * over the clip; a loop's last sample its cycle's end, as the sensors take a loop's keys), the feet planted, in the
 * world; and the farthest any mapped bone's joint was from its body point (mm), with when.
 */
export function played(clip: Clip, b: ThreeBound, lod: 0 | 1 = 0): { frames: Float32Array[]; reach: number; at: number } {
  const n = Math.max(1, Math.ceil(clip.dur * RATE)), h = clip.dur / n, c = b.core, a = new Animator(c, { step: h });
  a.layer("clip", { clip });
  const joints = Object.entries(c.jointPoint), frames: Float32Array[] = [];
  let reach = 0, at = 0;
  for (let i = 0; i <= n; i++) {
    let p: AnimatorPose = a.pose(undefined, { lod });
    if (i === n && clip.loop) {
      const end = new Animator(c, { step: h });
      end.layer("clip", { clip, time: clip.dur * (1 - 1e-12) });
      p = { ...end.pose(undefined, { lod }), root: a.root };
    }
    frames.push(world(p.points, p.root));
    for (const [bone, point] of joints) {
      const aim = solver.toSkeleton(c, p.points, format.IDX[point]! * 3), got = p.joints[c.bones[bone]!];
      if (!got) continue;
      const d = Math.hypot(got[0] - aim[0], got[1] - aim[1], got[2] - aim[2]) / c.scale;
      if (!(d <= reach)) [reach, at] = [d, i * h];
      if (Number.isNaN(reach)) return { frames, reach, at };
    }
    if (i < n) a.step(h);
  }
  return { frames, reach, at };
}

const level = (m: checks.Motion, k: checks.MetricName, v: number) => (v >= checks.levels(m, k).fail ? 2 : v >= checks.levels(m, k).warn ? 1 : 0);
const num = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(1));

/** Plays one clip (on its own rest R) on one skeleton and judges what the skeleton added. */
export function sweepOne(clip: Clip, R: Rest, b: ThreeBound, rig: string): SweepRow {
  const why: string[] = [];
  let ownVerdict = "none", playedVerdict = "none", reach = 0;
  try {
    for (const f of metrics(clip, R).findings.filter((x) => DATA.includes(x.metric))) why.push(`${f.metric}: ${f.message}`);
    if (!why.length) {
      const opts = { loop: clip.loop, id: clip.id, tags: clip.tags ?? [] };
      const mo = checks.motionOfFrames(ownFrames(clip, R), R, opts), ro = checks.measure(mo);
      // played with its contacts, detected on its own body where it carries none (as WP-5.4 writes them into clips)
      const p = played(clip.contacts ? clip : { ...clip, contacts: measureFacts(clip, R).contacts }, b), mp = checks.motionOfFrames(p.frames, b.core.rest, opts), rp = checks.measure(mp);
      [ownVerdict, playedVerdict, reach] = [ro.verdict, rp.verdict, p.reach];
      for (const k of checks.METRICS) {
        if (DATA.includes(k) || rp.off.includes(k)) continue;
        const was = level(mo, k, ro.values[k]), now = level(mp, k, rp.values[k]);
        if (now > was) why.push(`${k} ${num(ro.values[k])} on its own body → ${num(rp.values[k])} played on this one, past its ${now === 2 ? "fail" : "warn"} level`);
      }
      if (!(p.reach <= REACH)) why.push(Number.isNaN(p.reach) ? `the solve isn't a number at ${p.at.toFixed(2)} s` : `a joint ${num(p.reach)} mm from its point at ${p.at.toFixed(2)} s (at most ${REACH})`);
    }
  } catch (err) {
    why.push(`threw: ${String((err as Error).message).split("\n")[0]}`);
  }
  return { clip: clip.id, rig, ok: why.length === 0, why, own: ownVerdict, played: playedVerdict, reach: Math.round(reach * 1000) / 1000 };
}
