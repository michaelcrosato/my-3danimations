// The solver (WP-2.4): on the reference body its joints are the decoder's within 1 mm; T, A and relaxed rests solve to
// the same joints and the same rotations; every bone's roll is continuous through any bend and mirrors with the pose;
// missing optional bones and twist bones are handled; a host's rest rotations give local rotations that rebuild the
// same joints; and a skeleton's naming doesn't matter. Other bodies are conformance tier 3
// (spec/conformance/tier3.test.ts).
import { describe, expect, it } from "vitest";
import { bind, decodeOn, decodePose, forward, IDX, keyAt, mirrorPose, quat, solve, toFormat, TABLES, type Bound, type KeyLike, type Quat, type Rest, type SkeletonIn, type Solved } from "./all.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { loadTier2, tier2Sets } from "../../../spec/conformance/runner/vectors.ts";

type V = [number, number, number];
const sets = tier2Sets().map((s) => loadTier2(s));
/** Every tier-2 clip's keys and in-betweens, as (key pose, the clip's own body). */
function* poses(step = 1) {
  for (const v of sets) for (const c of Object.values(v.clips)) for (const [i, s] of [...c.keys, ...c.between].entries()) if (i % step === 0) yield { k: keyAt(c.clip as never, s.t), SR: v.bodies[c.restSrc] as unknown as Rest, name: `${c.clip.clip}@${s.t}` };
}
/** The solved joints in the format's frame, by the body point at each mapped bone's joint. */
function joints(b: Bound, s: Solved): Record<string, V> {
  const fk = forward(b, s), out: Record<string, V> = {};
  for (const [h, pt] of Object.entries(b.jointPoint)) out[pt] = toFormat(b, fk[b.bones[h]!]!);
  return out;
}
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
/** The angle (degrees) between two orientations. */
const angleQ = (a: Quat, b: Quat) => (2 * Math.acos(Math.min(1, Math.abs(quat.dot(a, b)))) * 180) / Math.PI;
const point = (X: ArrayLike<number>, n: string): V => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
/** The skeleton with each arm chain turned down by `deg` about its shoulder joint (an A pose at 45, relaxed at 80). */
function armsDown(sk: SkeletonIn, deg: number): SkeletonIn {
  const kids = (n: string): string[] => sk.bones.filter((b) => b.parent === n).flatMap((b) => [b.name, ...kids(b.name)]);
  const out = structuredClone(sk);
  for (const s of ["l", "r"]) {
    const root = out.bones.find((b) => b.name === `upperarm_${s}`)!, o = root.head!;
    const a = ((s === "l" ? -deg : deg) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    for (const n of [`upperarm_${s}`, ...kids(`upperarm_${s}`)]) {
      const b = out.bones.find((x) => x.name === n)!, d = [b.head![0] - o[0], b.head![1] - o[1], b.head![2]];
      b.head = [o[0] + d[0]! * c - d[1]! * sn, o[1] + d[0]! * sn + d[1]! * c, d[2]!];
    }
  }
  return out;
}

describe("solve on the reference body", () => {
  const b = bind(rigSkeleton());
  it("recognizes the rig and measures it as tier 1a's rest", () => {
    expect([b.recognition.table, b.recognition.confidence, b.frame.kind]).toEqual(["unreal4", 1, "T"]);
    expect([b.rest.H0, b.rest.thigh, b.rest.shin, b.rest.up, b.rest.fore]).toEqual([950, 440, 430, 280, 250]);
  });
  it("puts every joint within 1 mm of the decoder's, at every key and in-between of tier 2", () => {
    let worst = 0, shared = 0, n = 0;
    for (const { k } of poses()) {
      const s = solve(k, b, { floor: false }), X = decodeOn(b, k), plain = decodePose(b.rest, k, new Array(108));
      for (const [pt, p] of Object.entries(joints(b, s))) {
        worst = Math.max(worst, dist(p, point(X, pt)));
        // a format-2 spine share on the lowest segment is carried by the hips (D36): the decoder alone turns that
        // segment with part of the chest's turn, which no hips bone that also carries the legs can do
        shared = Math.max(shared, dist(p, point(plain, pt)));
      }
      n++;
    }
    expect(n).toBeGreaterThan(7500);
    expect(worst).toBeLessThan(0.01);
    expect(shared).toBeLessThan(40);
  }, 30_000);
  it("lifts a pose whose sole would go below the floor, and leaves one standing on it alone", () => {
    const sunk = { ...keyAt(sets[0]!.clips[Object.keys(sets[0]!.clips)[0]!]!.clip as never, 0), hips: [0, 0, 90] };
    const s = solve(sunk, b), X = decodePose(b.rest, sunk, new Array(108));
    const sole = (Y: ArrayLike<number>) => Math.min(...["L", "R"].flatMap((S) => [point(Y, "ball" + S)[2], point(Y, "toe" + S)[2], point(Y, "ankle" + S)[2] - b.rest.ankleZ]));
    expect(sole(X)).toBeLessThan(-10);
    expect(sole(s.points)).toBeCloseTo(0, 9);
    const standing = { ...sunk, hips: [0, 0, 100] };
    expect(solve(standing, b).points).toEqual(Float64Array.from(decodePose(b.rest, standing, new Array(108))));
  });
});

describe("rests, missing bones, twist bones, names", () => {
  const T = bind(rigSkeleton());
  it("solves A and relaxed rests to the same joints and the same rotations as a T", () => {
    for (const [deg, kind] of [[45, "A"], [80, "relaxed"]] as const) {
      const b = bind(armsDown(rigSkeleton(), deg));
      expect(b.frame.kind).toBe(kind);
      // the turn (about glTF's forward, z) taking the T's arm onto this rest's, per side
      const Rz = (s: string): Quat => {
        const a = ((s === "l" ? -deg : deg) * Math.PI) / 180;
        return [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
      };
      let worst = 0, turn = 0;
      for (const { k } of poses(7)) {
        const sT = solve(k, T), sB = solve(k, b), a = joints(T, sT), z = joints(b, sB);
        for (const pt of Object.keys(a)) worst = Math.max(worst, dist(a[pt]!, z[pt]!));
        for (const n of Object.keys(sT.world)) {
          const arm = /^(upperarm|lowerarm|hand|index_01|middle_01|middle_02|pinky_01)_([lr])$/.exec(n);
          const q = arm ? quat.multiply([0, 0, 0, 1], sB.world[n]!, Rz(arm[2]!)) : sB.world[n]!;
          turn = Math.max(turn, angleQ(q, sT.world[n]!));
        }
      }
      expect(worst, kind).toBeLessThan(1e-3);
      expect(turn, kind).toBeLessThan(1e-4);
    }
  });
  it("solves a skeleton missing its neck, shoulders, toes and fingers, with no NaN and limbs as the clip's", () => {
    const sk = rigSkeleton();
    const drop = new Set(["neck_01", "clavicle_l", "clavicle_r", "ball_l", "ball_r", "ball_leaf_l", "ball_leaf_r", ...["index_01", "middle_01", "middle_02", "pinky_01"].flatMap((f) => [`${f}_l`, `${f}_r`])]);
    const parentOf = new Map(sk.bones.map((x) => [x.name, x.parent]));
    const up = (n: string | null | undefined): string | null => (n && drop.has(n) ? up(parentOf.get(n)) : (n ?? null));
    const lean = { ...sk, bones: sk.bones.filter((x) => !drop.has(x.name)).map((x) => ({ ...x, parent: up(x.parent) })) };
    const b = bind(lean);
    expect(b.bones.neck).toBeUndefined();
    expect(b.bones.leftToes).toBeUndefined();
    let reach = 0, limb = 0;
    const angle = (u: readonly number[], w: readonly number[]) => (Math.acos(Math.min(1, (u[0]! * w[0]! + u[1]! * w[1]! + u[2]! * w[2]!) / (Math.hypot(u[0]!, u[1]!, u[2]!) * Math.hypot(w[0]!, w[1]!, w[2]!)))) * 180) / Math.PI;
    const d = (a: readonly number[], c: readonly number[]) => a.map((x, i) => x - c[i]!);
    for (const { k, SR } of poses(5)) {
      // on its own spine shares the joints are where the decoder puts them on this body
      const own = solve(k, b);
      for (const [pt, p] of Object.entries(joints(b, own))) reach = Math.max(reach, dist(p, point(own.points, pt)));
      // on the clip's, no NaN, and its whole limbs point as the clip's do
      const s = solve(k, b, { source: SR });
      for (const q of Object.values(s.local)) expect(q.every((x) => x === x)).toBe(true);
      const src = decodePose(SR, k, new Array(108));
      for (const S of ["L", "R"]) {
        // the arm aims at the virtual fist: the wrist plus the forearm's direction times the fist's reach (MOTION.md §5.3)
        const vf = (X: ArrayLike<number>, R: Rest) => {
          const el = point(X, "elbow" + S), wr = point(X, "wrist" + S), f = d(wr, el), l = Math.hypot(f[0]!, f[1]!, f[2]!);
          return wr.map((x, i) => x + (f[i]! / l) * R.fist);
        };
        limb = Math.max(limb, angle(d(vf(s.points, b.rest), point(s.points, "sh" + S)), d(vf(src, SR), point(src, "sh" + S))));
        limb = Math.max(limb, angle(d(point(s.points, "ankle" + S), point(s.points, "hip" + S)), d(point(src, "ankle" + S), point(src, "hip" + S))));
      }
    }
    expect(reach).toBeLessThan(1e-6);
    expect(limb).toBeLessThan(9);
  });
  it("lets twist bones and other unmapped bones follow their parent", () => {
    const sk = rigSkeleton();
    const ua = sk.bones.find((x) => x.name === "upperarm_l")!, la = sk.bones.find((x) => x.name === "lowerarm_l")!;
    sk.bones.push({ name: "upperarm_twist_01_l", parent: "upperarm_l", head: [(ua.head![0] + la.head![0]) / 2, ua.head![1], ua.head![2]] });
    const b = bind(sk);
    expect(Object.values(b.bones)).not.toContain("upperarm_twist_01_l");
    const s = solve(keyAt(sets[0]!.clips[Object.keys(sets[0]!.clips)[3]!]!.clip as never, 0.2), b);
    expect(Math.abs(s.local.upperarm_twist_01_l![3])).toBeCloseTo(1, 12);
    const fk = forward(b, s);
    expect(dist(fk.upperarm_twist_01_l!, fk.upperarm_l!.map((x, i) => (x + fk.lowerarm_l![i]!) / 2))).toBeLessThan(1e-12);
  });
  it("gives a host's local rotations: with its rest rotations, parent × local rebuilds the same joints", () => {
    const sk = rigSkeleton();
    const r = (i: number): Quat => quat.normalize([0, 0, 0, 1], [Math.sin(i), Math.cos(i * 1.7), Math.sin(i * 0.3), 1.5]);
    const restWorld = Object.fromEntries(sk.bones.map((x, i) => [x.name, r(i)]));
    const b = bind(sk, { restWorld });
    const { k } = poses(97).next().value!;
    const s = solve(k, b);
    // a host's forward kinematics: world = parent's world × local; head = parent's head + parent's world × rest offset
    const world: Record<string, Quat> = {}, head: Record<string, V> = {};
    const fk = forward(b, s);
    for (const bone of b.order) {
      if (bone.parent < 0 || bone.name === b.bones.hips) {
        world[bone.name] = bone.parent < 0 ? s.local[bone.name]! : quat.multiply([0, 0, 0, 1], world[b.order[bone.parent]!.name]!, s.local[bone.name]!);
        head[bone.name] = fk[bone.name]!;
        continue;
      }
      const p = b.order[bone.parent]!;
      world[bone.name] = quat.multiply([0, 0, 0, 1], world[p.name]!, s.local[bone.name]!);
      const offLocal = quat.rotate([0, 0, 0], quat.conjugate([0, 0, 0, 1], restWorld[p.name]!), bone.head.map((x, i) => x - p.head[i]!) as V);
      const o = quat.rotate([0, 0, 0], world[p.name]!, offLocal);
      head[bone.name] = [head[p.name]![0] + o[0], head[p.name]![1] + o[1], head[p.name]![2] + o[2]];
    }
    for (const bone of b.order) {
      expect(dist(head[bone.name]!, fk[bone.name]!), bone.name).toBeLessThan(1e-9);
      expect(Math.abs(quat.dot(world[bone.name]!, s.world[bone.name]!)), bone.name).toBeCloseTo(1, 9);
    }
  });
  it("solves the same whatever the bones are called (the rig renamed to Mixamo's names)", () => {
    const sk = rigSkeleton();
    const ue = TABLES.find((t) => t.name === "unreal4")!, mx = TABLES.find((t) => t.name === "mixamo")!;
    const rename = new Map<string, string>();
    for (const [h, names] of Object.entries(ue.bones)) for (const n of names) if (sk.bones.some((x) => x.name === n) && mx.bones[h]) rename.set(n, `mixamorig:${mx.bones[h]![0]}`);
    const renamed = { ...sk, bones: sk.bones.map((x) => ({ ...x, name: rename.get(x.name) ?? x.name, parent: x.parent ? (rename.get(x.parent) ?? x.parent) : null })) };
    const b = bind(renamed);
    expect(b.recognition.table).toBe("mixamo");
    const { k } = poses(53).next().value!;
    const a = joints(T, solve(k, T)), z = joints(b, solve(k, b));
    for (const pt of Object.keys(a)) expect(dist(a[pt]!, z[pt]!), pt).toBeLessThan(1e-6);
  });
});

describe("bone roll", () => {
  const b = bind(rigSkeleton());
  const base = (): KeyLike => ({ t: 0, hips: [0, 0, 100], body: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], armL: [0, 100, 0, 0, 0], armR: [0, 100, 0, 0, 0], legL: [0, 0, -100, 0, 0], legR: [0, 0, -100, 0, 0] });
  /** The largest turn of the named bones' world rotations between consecutive keys of a sweep. */
  const sweep = (keys: KeyLike[], bones: string[]) => {
    let worst = 0, prev: Solved | null = null;
    for (const k of keys) {
      const s = solve(k, b, { floor: false });
      if (prev) for (const n of bones) worst = Math.max(worst, angleQ(s.world[n]!, prev.world[n]!));
      prev = s;
    }
    return worst;
  };
  const range = (a: number, z: number, step: number) => Array.from({ length: Math.round((z - a) / step) + 1 }, (_, i) => a + i * step);
  it("solves a T key on a T rest to the rest rotations of the arms and legs", () => {
    const s = solve(base(), b, { floor: false });
    for (const n of ["upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "thigh_l", "thigh_r", "calf_l", "calf_r"]) expect(angleQ(s.world[n]!, [0, 0, 0, 1]), n).toBeLessThan(1);
  });
  it("turns a pose's mirror into the mirror rotations, on both sides (glTF: x, y, z, w to x, −y, −z, w)", () => {
    let worst = 0, at = "", n = 0;
    for (const { k, name } of poses(3)) {
      if (k.blade) continue; // a blade is the right hand's alone: its mirror has none
      const sA = solve(k, b, { floor: false }), sB = solve(mirrorPose(k), b, { floor: false });
      for (const bone of Object.keys(sA.world)) {
        const other = bone.replace(/_l$/, "_R").replace(/_r$/, "_l").replace(/_R$/, "_r"), q = sB.world[other]!;
        const a = angleQ(sA.world[bone]!, [q[0], -q[1], -q[2], q[3]]);
        if (a > worst) [worst, at] = [a, `${name} ${bone}`];
      }
      n++;
    }
    expect(n).toBeGreaterThan(2000);
    expect(worst, at).toBeLessThan(0.5);
  });
  it("rolls the arms and legs continuously through every bend (no flip where the pole lines up with a bone)", () => {
    const elbow = range(100, 170, 0.05).map((bend) => ({ ...base(), armL: [0, 100, 0, bend, 0], armR: [0, 100, 0, bend, 0] }));
    expect(sweep(elbow, ["upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"])).toBeLessThan(0.5);
    const knee = range(140, 179, 0.05).map((bend) => ({ ...base(), legL: [0, 0, -100, bend, 0], legR: [0, 0, -100, bend, 0] }));
    expect(sweep(knee, ["thigh_l", "thigh_r", "calf_l", "calf_r"])).toBeLessThan(2);
  });
  it("rolls the feet continuously as they point down (no flip along the pelvis's up)", () => {
    const feet = range(55, 75, 0.05).map((down) => ({ ...base(), footL: [down, 5, 0], footR: [down, 5, 0] }));
    expect(sweep(feet, ["foot_l", "foot_r", "ball_l", "ball_r"])).toBeLessThan(0.5);
  });
  it("keeps a format-1 hand on its forearm, and curls fingers toward the palm whatever the hand's roll", () => {
    // format 1: the hand turns exactly as its forearm does (no twist at the wrist), and its fingers close
    for (const { k } of poses(11)) {
      if (k.hand || k.handL || k.handR || k.blade) continue;
      const s = solve(k, b, { floor: false });
      for (const sd of ["l", "r"]) {
        const fore = quat.multiply([0, 0, 0, 1], s.world[`lowerarm_${sd}`]!, quat.conjugate([0, 0, 0, 1], b.restWorld[`lowerarm_${sd}`]!));
        const hand = quat.multiply([0, 0, 0, 1], s.world[`hand_${sd}`]!, quat.conjugate([0, 0, 0, 1], b.restWorld[`hand_${sd}`]!));
        expect(angleQ(fore, hand)).toBeLessThan(1);
      }
    }
    // format 2: the middle finger's first bone bends as the decoder's knuckle-to-fist line does (80° of its 90°)
    for (const roll of [-90, -45, 0, 45, 90]) {
      for (const flex of [-40, 0, 40]) {
        const k = { ...base(), armL: [0, 100, 0, 30, 0], armR: [0, 100, 0, 30, 0], handL: [flex, 0, roll], handR: [flex, 0, roll], fingersL: [100, 100, 100, 100, 100], fingersR: [100, 100, 100, 100, 100] };
        const s = solve(k, b, { floor: false }), fk = forward(b, s);
        for (const [sd, S] of [["l", "L"], ["r", "R"]]) {
          const finger = toFormat(b, fk[`middle_02_${sd}`]!).map((x, i) => x - toFormat(b, fk[`middle_01_${sd}`]!)[i]!);
          const line = point(s.points, "fist" + S).map((x, i) => x - point(s.points, "knuck" + S)[i]!);
          const cos = (finger[0]! * line[0]! + finger[1]! * line[1]! + finger[2]! * line[2]!) / (Math.hypot(...finger) * Math.hypot(...line));
          expect((Math.acos(Math.min(1, cos)) * 180) / Math.PI, `${S} roll ${roll} flex ${flex}`).toBeLessThan(12);
        }
      }
    }
  });
});
