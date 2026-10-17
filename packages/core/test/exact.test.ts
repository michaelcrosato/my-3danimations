// The speed lane's copies held to the functions they copy, bit for bit (D89's way, for t1-speed's D97): legPoleOf to
// limbPoles's legs, decodeLegs to decodePose's pelvis and legs, sampleLegs to sampleAll's; on library clips (keys and
// in-betweens) on their own rests, the tier-3 bodies' rests and rests without shoulders, and on seeded legs. And
// measureFacts's `sampled`: read as given, its count and step checked.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measureFacts, parseClip, type Clip, type Rest } from "../src/index.ts";
import { P, POINTS } from "../src/format/body.ts";
import { decodeLegs, decodePose, legPoleOf, limbPoles, type KeyLike } from "../src/format/pose.ts";
import { keyAt } from "../src/format/sample.ts";
import { sampleAll, sampleLegs } from "../src/clip/contacts.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
/** Every 100th library clip (14, from every set, 9 loops) on its own rest. */
const CLIPS = readdirSync(LIB).sort().flatMap((set) => {
  const rests = (JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources;
  return readdirSync(join(LIB, set)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort().map((f) => ({ set, f, rests }));
}).filter((_, i) => i % 100 === 0).map(({ set, f, rests }) => {
  const clip = parseClip(readFileSync(join(LIB, set, f), "utf8"));
  return { clip, R: rests[clip.restSrc]!.rest };
});
const OTHER = Object.values((JSON.parse(readFileSync(join(ROOT, "spec/vectors/tier3/bodies.json"), "utf8")) as { bodies: Record<string, { rest: Rest }> }).bodies).map((b) => b.rest);
/** A rest measured without shoulder bones (its upper arms at the clavicle points). */
const noShoulders = (R: Rest): Rest => ({ ...R, cv: { L: [0, 0, 0], R: [0, 0, 0] } });
/** A clip's keys and the halfway points between them, its last moment, past its end and before its start. */
const times = (clip: Clip) => [...clip.keys.flatMap((k, i, K) => (K[i + 1] ? [k.t, (k.t + K[i + 1]!.t) / 2] : [k.t])), clip.dur * 0.999, clip.dur + 0.1, -0.05];
/** Each clip on its own rest, a tier-3 body's in turn and its own without shoulders. */
const CASES = CLIPS.flatMap(({ clip, R }, i) => [R, OTHER[i % OTHER.length]!, noShoulders(R)].map((rest) => ({ clip, rest })));
/** Whether each number of a pose is one decodeLegs writes (the pelvis's, and each leg's hip, knee, ankle, ball, toe). */
const LEG = Array.from({ length: P * 3 }, (_, j) => ["pelvis", ...["hip", "knee", "ankle", "ball", "toe"].flatMap((p) => [`${p}L`, `${p}R`])].includes(POINTS[Math.floor(j / 3)]!));
/** The first number where `got` differs from `want` by a bit (Object.is: -0 and NaN count), or -1. */
function differ(got: ArrayLike<number>, want: (j: number) => number): number {
  for (let j = 0; j < got.length; j++) if (!Object.is(got[j], want(j))) return j;
  return -1;
}

describe("the speed lane's copies, to the bit", () => {
  it("legPoleOf is limbPoles's leg: library keys and in-betweens, twists zeroed as planting asks, seeded and edge legs", () => {
    let seed = 11, n = 0;
    const draw = (lo: number, hi: number) => lo + Math.round(((seed = (seed * 48271) % 2147483647) / 2147483647) * (hi - lo));
    const bad: string[] = [];
    const check = (rest: Rest, k: KeyLike, what: string) => {
      const poles = limbPoles(rest, k);
      for (const s of ["L", "R"] as const) {
        const got = legPoleOf(rest, k, s), want = poles[`leg${s}`];
        if (differ(got, (j) => want[j]!) >= 0) bad.push(`${what} leg${s} ${JSON.stringify(k[`leg${s}`])}: ${got} vs ${want}`);
        n++;
      }
    };
    for (const { clip, rest } of CASES) {
      times(clip).forEach((t, i) => {
        const k = keyAt(clip, t), at = `${clip.id} t ${t}`, zero = (l: number[]) => [l[0]!, l[1]!, l[2]!, l[3] ?? 0, 0];
        check(rest, k, at);
        // the twist zeroed (plant's legPole), and legs drawn across their ranges
        check(rest, { ...k, legL: zero(k.legL as number[]), legR: zero(k.legR as number[]) }, `${at} untwisted`);
        check(rest, { ...k, legL: [draw(-100, 100), draw(-100, 100), draw(-100, 100), draw(0, 180), draw(-180, 180)], legR: [draw(-100, 100), draw(-100, 100), draw(-100, 100), draw(0, 180), draw(-180, 180)] }, `${at} drawn`);
        // straight, folded shut, past its reach, pointing nowhere (on each case's first pose)
        if (i === 0) for (const l of [[0, 0, -100, 0, 0], [0, 0, -100, 180, 40], [40, 0, -60, -30, 0], [0, 0, 0, 30, 0]]) check(rest, { ...k, legL: l, legR: l }, `${at} edge`);
      });
    }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(12_000);
  });
  it("decodeLegs puts decodePose's pelvis and legs and leaves every other point as it was", () => {
    const A = new Float32Array(P * 3), B = new Float32Array(P * 3), bad: string[] = [];
    let n = 0;
    for (const { clip, rest } of CASES)
      for (const t of times(clip)) {
        const k = keyAt(clip, t);
        decodePose(rest, k, A);
        // the legs' points decodePose's, the others untouched (NaN as filled)
        const j = differ(decodeLegs(rest, k, B.fill(Number.NaN)), (j) => (LEG[j] ? A[j]! : Number.NaN));
        if (j >= 0) bad.push(`${clip.id} t ${t}: ${POINTS[Math.floor(j / 3)]}[${j % 3}]`);
        n++;
      }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(2000);
  });
  it("sampleLegs takes sampleAll's times and step, its pelvis and legs, the other points 0, at 60 and 75 a second", () => {
    const bad: string[] = [];
    let n = 0;
    for (const { clip, R } of CLIPS)
      for (const fps of [60, 75]) {
        const all = sampleAll(clip, R, fps), legs = sampleLegs(clip, R, fps);
        if (!Object.is(all.dt, legs.dt) || all.frames.length !== legs.frames.length) bad.push(`${clip.id} at ${fps}: dt ${legs.dt}, ${legs.frames.length} frames`);
        all.frames.forEach((X, f) => {
          const j = differ(legs.frames[f]!, (j) => (LEG[j] ? X[j]! : 0));
          if (j >= 0) bad.push(`${clip.id} at ${fps}, frame ${f}: ${POINTS[Math.floor(j / 3)]}[${j % 3}]`);
          n++;
        });
      }
    expect(bad).toEqual([]);
    expect(n).toBeGreaterThan(3500);
  });
});

describe("measureFacts's samples", () => {
  const { clip, R } = CLIPS.find((c) => c.clip.loop)!;
  it("reads sampleAll's samples as given: the same facts as sampling them itself", () => {
    for (const fps of [30, 60, 75]) expect(measureFacts(clip, R, { fps }, sampleAll(clip, R, fps))).toEqual(measureFacts(clip, R, { fps }));
    expect(measureFacts(clip, R, {}, sampleAll(clip, R))).toEqual(measureFacts(clip, R));
  });
  it("refuses samples at another rate, or of a clip as many samples long at another step, naming sampleAll's", () => {
    expect(() => measureFacts(clip, R, {}, sampleAll(clip, R, 30))).toThrow(/^measureFacts: \d+ samples [\d.]+ s apart, not sampleAll\(clip, R, 60\)'s \d+ samples [\d.]+ s apart for this clip: /);
    expect(() => measureFacts(clip, R, { fps: 75 }, sampleAll(clip, R))).toThrow(/^measureFacts: .* not sampleAll\(clip, R, 75\)'s \d+ samples /);
    // 0.99 s and 1 s at 60 a second: 61 samples each, 1/60 s and 0.0165 s apart
    const one = { ...clip, dur: 1 }, near = { ...clip, dur: 0.99 };
    expect(sampleAll(near, R).frames.length).toBe(sampleAll(one, R).frames.length);
    expect(() => measureFacts(one, R, {}, sampleAll(near, R))).toThrow(/^measureFacts: 61 samples 0\.0165 s apart, not sampleAll\(clip, R, 60\)'s 61 samples 0\.0167 s apart for this clip: /);
  });
});
