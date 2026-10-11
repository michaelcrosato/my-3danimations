// The metrics (WP-3.3): each metric's unit fixture, a clean motion beside the same motion with one defect, found at
// its times and nowhere else; the profiles, the report's verdict in at most 20 lines, and the thresholds' records.
import { describe, expect, it } from "vitest";
import { format, type Key } from "@m3a/core";
import { checks, metrics } from "../src/index.ts";
import { testClip } from "./raster-pose.ts";

const { clip: idle, R } = testClip("Idle_Loop");
const still = format.pose(R, idle, 0);
/** One second of the idle's first pose at 60 Hz, edited per frame by `edit`. */
function frames(edit: (X: Float32Array, i: number) => void = () => {}, n = 61): Float32Array[] {
  return Array.from({ length: n }, (_, i) => {
    const X = Float32Array.from(still);
    edit(X, i);
    return X;
  });
}
const P = (n: string) => format.IDX[n]! * 3;
const move = (X: Float32Array, names: string[], d: readonly number[]) => names.forEach((n) => [0, 1, 2].forEach((c) => (X[P(n) + c] = X[P(n) + c]! + d[c]!)));
const motion = (F: Float32Array[], loop = false) => checks.motionOfFrames(F, R, { loop, id: "fixture" });
const FOOT_L = ["ankleL", "ballL", "toeL"];
/** The findings of a metric on a motion. */
const found = (m: checks.Motion) => checks.measure(m).findings;

describe("each metric finds its defect, at its times, and nothing on the clean motion", () => {
  const clean = found(motion(frames()));
  it("finds nothing on a still pose", () => expect(clean).toEqual([]));
  it("slide: a planted foot dragged 150 mm", () => {
    const m = motion(frames((X, i) => move(X, FOOT_L, [Math.min(i, 30) * 5, 0, 0])));
    const r = checks.slide(m);
    expect(r.value).toBeGreaterThan(140);
    expect(r.value).toBeLessThan(160);
    expect(r.findings.every((f) => f.where === "footL")).toBe(true);
    expect(checks.slide(motion(frames())).value).toBe(0);
  });
  it("penetration: the body sunk 140 mm under the floor for 0.2 s, and a hand through it", () => {
    const m = motion(frames((X, i) => i >= 20 && i < 32 && move(X, format.POINTS as string[], [0, 0, -140])));
    const f = checks.penetration(m).soles.findings;
    expect(f).toHaveLength(1);
    expect([f[0]!.level, f[0]!.t0, f[0]!.t1].map((x) => (typeof x === "number" ? +x.toFixed(3) : x))).toEqual(["fail", 0.333, 0.517]);
    const hand = checks.penetration(motion(frames((X, i) => i === 40 && move(X, ["fistR", "wristR"], [0, 0, -X[P("fistR") + 2]! - 80])))).body.findings;
    expect(hand.map((x) => [x.where, +x.t0.toFixed(3)])).toEqual([["fistR", 0.667]]);
  });
  it("intersection: a forearm through the belly", () => {
    const m = motion(frames((X, i) => {
      if (i < 30) return;
      const sp = [X[P("spine1")]!, X[P("spine1") + 1]!, X[P("spine1") + 2]!];
      // the right forearm laid across the belly, from its right side to its left
      [["elbowR", 150], ["wristR", -100], ["knuckR", -180], ["fistR", -220]].forEach(([n, r]) => [sp[0]!, sp[1]! + (r as number), sp[2]!].forEach((v, c) => (X[P(n as string) + c] = v)));
    }));
    const f = checks.intersection(m).findings;
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]!.where).toMatch(/^(forearmR|handR) in /);
    expect(f[0]!.t0).toBeCloseTo(0.5, 2);
  });
  it("jitter: a point shaking ±8 mm, not a single snap", () => {
    const shake = checks.jitter(motion(frames((X, i) => i >= 20 && i < 40 && move(X, ["head"], [i % 2 ? 8 : -8, 0, 0]))));
    expect(shake.findings.map((f) => f.where)).toEqual(["head"]);
    expect(shake.findings[0]!.t0).toBeGreaterThanOrEqual(0.3);
    expect(shake.findings[0]!.t1).toBeLessThanOrEqual(0.7);
    expect(checks.jitter(motion(frames((X, i) => i === 30 && move(X, ["head"], [80, 0, 0])))).findings).toEqual([]);
  });
  it("pop: a point jumping 200 mm for one sample, not a steady fast sweep", () => {
    const pop = checks.pops(motion(frames((X, i) => i === 30 && move(X, ["fistR"], [200, 0, 0]))));
    expect(pop.findings.map((f) => [f.where, f.level])).toContainEqual(["fistR", "fail"]);
    expect(pop.findings.every((f) => f.t0 >= 0.49 && f.t1 <= 0.52)).toBe(true);
    // 5 m/s, steadily, the whole second
    expect(checks.pops(motion(frames((X, i) => move(X, ["fistR", "wristR"], [i * 83, 0, 0])))).findings).toEqual([]);
  });
  it("stretch: a shin 5% longer for 0.1 s", () => {
    const m = motion(frames((X, i) => i >= 10 && i < 16 && move(X, ["ankleR", "ballR", "toeR"], [0, 0, -0.05 * R.shin])));
    const f = checks.stretch(m).findings;
    expect(f.map((x) => [x.where, x.level])).toEqual([["kneeR–ankleR", "fail"]]);
    expect(f[0]!.t0).toBeCloseTo(10 / 60, 6);
  });
  it("seam: a loop whose last pose is 80 mm from its first", () => {
    const m = motion(frames((X, i) => move(X, ["fistL", "wristL"], [i * 1.33, 0, 0])), true);
    const s = checks.seam(m);
    expect(s.pose.value).toBeGreaterThan(75);
    expect(s.pose.findings[0]!.level).toBe("fail");
    expect(checks.seam(motion(frames(), true)).pose.findings).toEqual([]);
  });
  it("seamVelocity: a loop whose poses meet at the seam but whose hand leaves at 6 m/s and arrives still", () => {
    // out and back: still at the end, fast at the start, the same pose at both
    const m = motion(frames((X, i) => move(X, ["fistL", "wristL"], [i <= 10 ? i * 100 : Math.max(0, 1000 - (i - 10) * 20), 0, 0])), true);
    const s = checks.seam(m);
    expect(s.pose.value).toBeLessThan(1);
    expect(s.velocity.value).toBeGreaterThan(5000);
    expect(s.velocity.findings.map((f) => [f.where, f.level])).toEqual([["fistL", "fail"]]);
  });
  it("symmetry: a pair that isn't the other's mirror", () => {
    const { clip: punch } = testClip("Punch_Jab"), mirrored = format.mirror(punch as never) as never;
    const a = checks.motionOf(punch, R), b = checks.motionOf(mirrored as never, R), c = checks.motionOf(punch, R);
    expect(checks.symmetry(a, b).value).toBeLessThan(1);
    expect(checks.symmetry(a, c).findings.length).toBeGreaterThan(0);
  });
});

describe("the metrics that read keys and the clip's records", () => {
  const key = (t: number, edit: (k: Key) => void = () => {}): Key => {
    const k = structuredClone(idle.keys[0]!);
    k.t = t;
    edit(k);
    return k;
  };
  const clip = (keys: Key[], extra: object = {}) => ({ ...idle, id: "fixture", loop: false, dur: keys[keys.length - 1]!.t, keys, ...extra });
  it("twistFlip: a knee's twist jumping 170° between keys 1/15 s apart", () => {
    const c = clip([key(0), key(0.4), key(0.467, (k) => (k.legL[4] = (k.legL[4] ?? 0) + 170)), key(1, (k) => (k.legL[4] = (k.legL[4] ?? 0) + 170))]);
    const f = checks.twistFlips(checks.motionOf(c, R)).findings;
    expect(f.map((x) => [x.where, x.level, x.t0, x.t1])).toEqual([["legL", "fail", 0.4, 0.467]]);
  });
  it("jointLimit: a bent knee pointing backwards, and the head turned 170°", () => {
    const knee = checks.jointLimits(checks.motionOf(clip([key(0), key(0.5, (k) => (k.legR = [k.legR[0]!, k.legR[1]!, k.legR[2]!, 45, 175])), key(1)]), R)).findings;
    expect(knee.map((x) => [x.where, x.level, x.t0])).toEqual([["legR (the knee bends back)", "fail", 0.5]]);
    const head = checks.jointLimits(checks.motionOf(clip([key(0), key(0.5, (k) => (k.head = [170, 0, 0])), key(1)]), R)).findings;
    expect(head[0]!.where).toMatch(/^head/);
  });
  it("fit, nan and events: the clip's records", () => {
    expect(checks.fit(checks.motionOf(clip([key(0), key(1)], { quality: { fit: [45, 120], qa: "unchecked", qaVersion: "none" } }), R)).findings[0]!.level).toBe("fail");
    expect(checks.fit(checks.motionOf(clip([key(0), key(1)], { quality: { fit: [10, 350], qa: "unchecked", qaVersion: "none" } }), R)).findings[0]!.level).toBe("fail");
    const bad = checks.nan(checks.motionOf(clip([key(0), key(0.5, (k) => (k.head = [Number.NaN, 0, 0])), key(1)]), R));
    expect(bad.value).toBeGreaterThan(0);
    expect(bad.findings[0]!.t0).toBe(0.5);
    const ev = checks.events(checks.motionOf(clip([key(0), key(1)], { events: [{ t: 0.6, name: "b" }, { t: 0.3, name: "a" }, { t: 2, name: "late" }] }), R));
    expect(ev.findings.map((f) => f.t0)).toEqual([0.3, 2]);
  });
});

describe("profiles, the report and the thresholds", () => {
  it("turns off what a profile doesn't judge: a lying clip's body on the floor", () => {
    expect(metrics({ ...idle, tags: ["death"] }, R).off).toContain("bodyPenetration");
    expect(checks.profilesOf(["swim"], "x")).toEqual(["swimming"]);
    expect(checks.profilesOf([], "Backflip")).toEqual(["acrobatics"]);
  });
  it("writes a verdict in at most 20 lines, failures first, each with its times and a repair", () => {
    const { clip: walk } = testClip("Walk_Loop"), r = metrics(walk, R);
    expect(r.text.split("\n").length).toBeLessThanOrEqual(20);
    expect(r.text.split("\n")[0]).toMatch(/^QUATERNIUS_3D2DGE\/Walk_Loop: (PASS|WARN|FAIL)/);
    const levels = r.findings.map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === "fail" ? -1 : 1)));
    for (const f of r.findings) expect(f.message).toMatch(/\d+\.\d\d(–\d+\.\d\d)? s: .+: .+/);
    expect(metrics(idle, R).verdict).toBe("pass");
  });
  it("records every threshold with its unit, rate, scaling and reason, and scales lengths with hip height", () => {
    for (const [name, t] of Object.entries(checks.THRESHOLDS)) {
      expect(t.fail, name).toBeGreaterThanOrEqual(t.warn);
      expect(t.reason.length, name).toBeGreaterThan(40);
      expect(t.unit, name).not.toBe("");
    }
    const tall = { ...checks.motionOfFrames(frames(), { ...R, H0: 2 * checks.REFERENCE_H0 }), rest: { ...R, H0: 2 * checks.REFERENCE_H0 } };
    expect(checks.levels(tall, "slide").warn).toBe(2 * checks.THRESHOLDS.slide.warn);
    expect(checks.levels(tall, "intersection").warn).toBe(checks.THRESHOLDS.intersection.warn);
  });
  it("folds the jitter and pops a twist flip causes into the flip's finding", () => {
    const f = metrics(testClip("Walk_Loop").clip, R).findings;
    const flips = f.filter((x) => x.metric === "twistFlip" && x.where?.startsWith("foot"));
    expect(flips.length).toBeGreaterThan(0);
    for (const x of flips) expect(f.filter((y) => (y.metric === "jitter" || y.metric === "pop") && y.where?.startsWith("toe" + x.where!.slice(-1)) && y.t0 <= x.t1 && y.t1 >= x.t0)).toEqual([]);
  });
  it("mirrors with its pair: a clip mirrored is checked against the other", () => {
    const { clip: punch } = testClip("Punch_Jab");
    expect(metrics(punch, R, { mirrorOf: format.mirror(punch as never) as never }).values.symmetry).toBeLessThan(1);
    expect(metrics(punch, R, { mirrorOf: punch }).findings.some((f) => f.metric === "symmetry")).toBe(true);
  });
});
