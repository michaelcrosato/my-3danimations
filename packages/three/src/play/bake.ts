// Baking a clip for three.js (PLAN.md WP-4.4): a THREE.AnimationClip of quaternion tracks (and the hips' position),
// solved from the clip's parameters onto the bound character, sampled densely enough that three's in-betweens stay
// within 0.5 mm of the live solve, the worst measured and recorded. The clip's loop, events, contacts and facts travel with it in `userData`,
// which three's GLTFExporter writes to the animation's `extras`.
import type { Bone } from "three";
import { AnimationClip, AnimationMixer, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from "three";
import { format, solve, type Clip } from "@m3a/core";
import type { ThreeBound } from "../bind/index.ts";
import { writer } from "./write.ts";

/** How to bake: the base rate (30 samples a second) and the tolerance (0.5 mm) samples are added to meet. */
export interface BakeOptions {
  fps?: number;
  tolerance?: number;
}
/** What a baked clip carries in `userData`: the source clip's own fields, and the bake's measured error. */
export interface BakedData {
  id: string;
  loop: boolean;
  events: Clip["events"];
  contacts: Clip["contacts"];
  facts: Clip["facts"];
  /** The worst distance (mm) of any mapped joint between the baked clip played back and the live solve, and when;
   *  how many samples the bake took. */
  error: { max: number; at: number; samples: number };
}

/** The key the clip plays at t (a loop's end is its last pose, not its first). */
const keyOf = (clip: Pick<Clip, "keys" | "dur" | "loop">, t: number) => format.keyAt(clip, clip.loop && t >= clip.dur ? clip.dur * (1 - 1e-12) : t);

/** One sample: every bone's local rotation, the hips' place, and the mapped joints' places in the root's space. */
interface Sample {
  q: Float32Array;
  hips: Float32Array;
  joints: Float32Array;
}

/**
 * Bakes `clip` onto the bound character as a THREE.AnimationClip (its tracks name the bones). Samples at the clip's keys
 * and 30 a second, then halves any stretch whose middle, as three in-betweens it, is more than 0.5 mm from the live solve
 * (down to 1/3840 s); the worst distance measured is recorded.
 */
export function bake(clip: Clip, b: ThreeBound, opts: BakeOptions = {}): AnimationClip {
  const fps = opts.fps ?? 30, tol = opts.tolerance ?? 0.5, bones = b.bones, hips = b.humanoid.hips!, joints = Object.values(b.humanoid);
  const w = writer(b), rest = snapshot(bones), toRoot = b.root.matrixWorld.clone().invert(), v = new Vector3();
  const read = (): Sample => {
    b.root.updateMatrixWorld(true);
    const q = new Float32Array(bones.length * 4), j = new Float32Array(joints.length * 3);
    bones.forEach((x, i) => x.quaternion.toArray(q, i * 4));
    joints.forEach((x, i) => v.setFromMatrixPosition(x.matrixWorld).applyMatrix4(toRoot).toArray(j, i * 3));
    return { q, hips: Float32Array.from(hips.position.toArray()), joints: j };
  };
  const live = (t: number): Sample => {
    w.write(solve(keyOf(clip, t), b.core));
    return read();
  };
  // the in-between three plays halfway between two samples: each rotation slerped, the hips lerped
  const qa = new Quaternion(), qb = new Quaternion();
  const between = (a: Sample, c: Sample): Sample => {
    bones.forEach((x, i) => x.quaternion.copy(qa.fromArray(a.q, i * 4).slerp(qb.fromArray(c.q, i * 4), 0.5)));
    hips.position.set((a.hips[0]! + c.hips[0]!) / 2, (a.hips[1]! + c.hips[1]!) / 2, (a.hips[2]! + c.hips[2]!) / 2);
    return read();
  };
  const apart = (a: Sample, c: Sample) => {
    let m = 0;
    for (let i = 0; i < a.joints.length; i += 3) m = Math.max(m, Math.hypot(a.joints[i]! - c.joints[i]!, a.joints[i + 1]! - c.joints[i + 1]!, a.joints[i + 2]! - c.joints[i + 2]!) * 1000);
    return m;
  };
  const start = [...new Set([...clip.keys.map((k) => k.t).filter((t) => t >= 0 && t <= clip.dur), ...Array.from({ length: Math.floor(clip.dur * fps + 1e-9) + 1 }, (_, i) => i / fps), clip.dur])].sort((x, y) => x - y);
  const samples = new Map<number, Sample>(start.map((t) => [t, live(t)]));
  let max = 0, at = 0;
  const stack: [number, number][] = start.slice(1).map((t, i) => [start[i]!, t]);
  while (stack.length) {
    const [t0, t1] = stack.pop()!, m = (t0 + t1) / 2, truth = live(m), e = apart(between(samples.get(t0)!, samples.get(t1)!), truth);
    if (e > tol && t1 - t0 > 1 / 3840) {
      samples.set(m, truth);
      stack.push([t0, m], [m, t1]);
    } else if (e > max) [max, at] = [e, m];
  }
  restore(bones, rest);
  const sorted = [...samples.keys()].sort((x, y) => x - y), times = Float32Array.from(sorted), all = sorted.map((t) => samples.get(t)!);
  const tracks = [
    ...bones.map((x, j) => new QuaternionKeyframeTrack(`${x.name}.quaternion`, times, Float32Array.from(all.flatMap((s) => [...s.q.subarray(j * 4, j * 4 + 4)])))),
    new VectorKeyframeTrack(`${hips.name}.position`, times, Float32Array.from(all.flatMap((s) => [...s.hips]))),
  ];
  const out = new AnimationClip(clip.id, clip.dur, tracks);
  const data: BakedData = { id: clip.id, loop: clip.loop, events: clip.events ?? [], contacts: clip.contacts, facts: clip.facts, error: { max, at, samples: times.length } };
  out.userData = data as unknown as Record<string, unknown>;
  return out;
}

/** Every bone's rest transform, to put back after baking. */
function snapshot(bones: Bone[]) {
  return bones.map((x) => [x.position.clone(), x.quaternion.clone()] as const);
}
function restore(bones: Bone[], rest: ReturnType<typeof snapshot>): void {
  bones.forEach((x, i) => {
    x.position.copy(rest[i]![0]);
    x.quaternion.copy(rest[i]![1]);
  });
}

/**
 * The baked clip's worst distance (mm) from the live solve, over every mapped joint, at each sample and halfway
 * between samples (where the baked clip in-betweens), played on the character through three's AnimationMixer.
 */
export function bakeError(baked: AnimationClip, clip: Clip, b: ThreeBound): { max: number; at: number } {
  const bones = Object.values(b.humanoid), rest = snapshot(b.bones), w = writer(b), mixer = new AnimationMixer(b.root), action = mixer.clipAction(baked);
  action.play();
  const live = bones.map(() => new Vector3()), v = new Vector3(), toRoot = b.root.matrixWorld.clone().invert(), times = baked.tracks[0]!.times;
  let max = 0, at = 0;
  for (let i = 0; i < times.length; i++) {
    for (const t of i + 1 < times.length ? [times[i]!, (times[i]! + times[i + 1]!) / 2] : [times[i]!]) {
      w.write(solve(keyOf(clip, t), b.core));
      b.root.updateMatrixWorld(true);
      bones.forEach((x, j) => live[j]!.setFromMatrixPosition(x.matrixWorld).applyMatrix4(toRoot));
      action.time = t;
      mixer.update(0);
      b.root.updateMatrixWorld(true);
      bones.forEach((x, j) => {
        const d = v.setFromMatrixPosition(x.matrixWorld).applyMatrix4(toRoot).distanceTo(live[j]!) * 1000;
        if (d > max) [max, at] = [d, t];
      });
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(b.root);
  restore(b.bones, rest);
  return { max, at };
}
