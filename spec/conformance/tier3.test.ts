// Conformance tier 3 (spec/conformance/tiers.md): clips retargeted onto bodies of other proportions. Every clip of
// tier 2, at four times, is solved onto each generated body of tier3/bodies.json (seven, at least six required):
// every limb points within 9 degrees of the source (shoulder to virtual fist, hip to ankle), the chest faces where the
// source's does (within 9, 14 on a curled spine), bone lengths are unchanged, no sole goes below the floor, and no
// number is NaN.
import { bind, decodePose, dirToSkeleton, forward, IDX, keyAt, quat, solve, toFormat, torso, type Rest } from "@m3a/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rigSkeleton } from "./runner/skeleton.ts";
import { loadTier2, tier2Sets, TOLERANCE } from "./runner/vectors.ts";

const bodies = JSON.parse(readFileSync(join(import.meta.dirname, "../vectors/tier3/bodies.json"), "utf8")).bodies as Record<string, { proportions?: Record<string, number>; rest: Rest }>;
const generated = Object.entries(bodies).filter(([, b]) => b.proportions);
const sub = (a: readonly number[], b: readonly number[]) => a.map((x, i) => x - b[i]!);
const angle = (a: readonly number[], b: readonly number[]) => {
  const d = (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) / (Math.hypot(a[0]!, a[1]!, a[2]!) * Math.hypot(b[0]!, b[1]!, b[2]!));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};
const point = (X: ArrayLike<number>, n: string) => [X[IDX[n]! * 3]!, X[IDX[n]! * 3 + 1]!, X[IDX[n]! * 3 + 2]!];
const sets = tier2Sets().map((s) => loadTier2(s));

describe("tier 3: other bodies", () => {
  it("has at least six bodies of different proportions", () => {
    expect(generated.length).toBeGreaterThanOrEqual(6);
    expect(new Set(generated.map(([, b]) => b.rest.H0)).size).toBeGreaterThanOrEqual(4);
  });
  for (const [name, body] of generated) {
    it(`${name}: limbs within 9°, the chest within 9° (14° curled), lengths kept, soles on the floor, no NaN`, () => {
      const b = bind(rigSkeleton(body.proportions));
      // the bound body is the one tier 3 records
      for (const k of ["H0", "hipZ", "up", "fore", "thigh", "shin", "fist"] as const) expect(Math.abs(b.rest[k] - body.rest[k]), k).toBeLessThan(0.01);
      const worst = { limb: 0, chest: 0, curled: 0, sole: Infinity, length: 0 };
      let poses = 0;
      for (const v of sets) {
        for (const c of Object.values(v.clips)) {
          const SR = v.bodies[c.restSrc] as unknown as Rest;
          for (const t of [0, c.dur * 0.31, c.dur * 0.62, c.dur * 0.93]) {
            const k = keyAt(c.clip as never, t);
            const src = decodePose(SR, k, new Array(108));
            const s = solve(k, b, { source: SR });
            const fk = forward(b, s);
            const J = (h: string) => toFormat(b, fk[b.bones[h]!]!);
            for (const side of ["left", "right"]) {
              const S = side === "left" ? "L" : "R";
              // an arm aims at its virtual fist: the wrist plus the forearm's direction times the fist's reach (MOTION.md §5.3)
              const vf = (el: number[], wr: number[], fist: number) => {
                const d = sub(wr, el), l = Math.hypot(d[0]!, d[1]!, d[2]!);
                return wr.map((x, i) => x + (d[i]! / l) * fist);
              };
              const target = vf(J(side + "LowerArm"), J(side + "Hand"), b.rest.fist), source = vf(point(src, "elbow" + S), point(src, "wrist" + S), SR.fist);
              worst.limb = Math.max(worst.limb, angle(sub(target, J(side + "UpperArm")), sub(source, point(src, "sh" + S))));
              worst.limb = Math.max(worst.limb, angle(sub(J(side + "Foot"), J(side + "UpperLeg")), sub(point(src, "ankle" + S), point(src, "hip" + S))));
              worst.sole = Math.min(worst.sole, s.points[IDX["ball" + S]! * 3 + 2]!, s.points[IDX["toe" + S]! * 3 + 2]!, s.points[IDX["ankle" + S]! * 3 + 2]! - b.rest.ankleZ);
            }
            // the chest: the solved top spine bone's facing against the clip's chest frame
            const tq = torso(SR, k), m = new Array<number>(9).fill(0);
            for (let i = 0; i < 3; i++) {
              const p = dirToSkeleton(b, tq.RC[i]!), r = dirToSkeleton(b, b.rest.Cr[i]!);
              for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) m[row * 3 + col]! += p[row]! * r[col]!;
            }
            const want = quat.fromMat3([0, 0, 0, 1], m), dq = (q: number[]) => (2 * Math.acos(Math.min(1, Math.abs(quat.dot(want, q as never)))) * 180) / Math.PI;
            const chest = dq(s.world[b.bones.upperChest!]!), curl = dq(s.world[b.bones.hips!]!);
            if (curl > 30) worst.curled = Math.max(worst.curled, chest);
            else worst.chest = Math.max(worst.chest, chest);
            for (const bone of b.order) {
              if (bone.parent < 0 || bone.name === b.bones.hips) continue;
              const p = b.order[bone.parent]!;
              worst.length = Math.max(worst.length, Math.abs(Math.hypot(...sub(fk[bone.name]!, fk[p.name]!)) - Math.hypot(...sub(bone.head, p.head))));
            }
            for (const q of Object.values(s.local)) if (q.some((x) => x !== x)) throw new Error(`NaN solving ${c.clip.clip} at ${t}`);
            poses++;
          }
        }
      }
      expect(poses).toBeGreaterThan(1000);
      expect(worst.limb).toBeLessThanOrEqual(TOLERANCE.tier3deg);
      expect(worst.chest).toBeLessThanOrEqual(TOLERANCE.tier3deg);
      expect(worst.curled).toBeLessThanOrEqual(TOLERANCE.tier3curledDeg);
      expect(worst.length).toBeLessThan(1e-9);
      expect(worst.sole).toBeGreaterThanOrEqual(-1e-9);
    });
  }
});
