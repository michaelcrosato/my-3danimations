// The metrics (WP-3.3): each metric's unit fixture, a clean motion beside the same motion with one defect, found at
// its times and nowhere else; the stance the sliding metrics read; the profiles, the report's verdict in at most 20
// lines, the folding of a twist flip's swing, and the thresholds' records.
import { describe, expect, it } from "vitest";
import { format, type Key } from "@m3a/core";
import { checks, metrics, predicates } from "../src/index.ts";
import { testClip } from "./raster-pose.ts";

const { clip: idle, R } = testClip("Idle_Loop");
const still = format.pose(R, idle, 0);
/** One second of the idle's first pose at 60 Hz (n samples), edited per frame by `edit`. */
function frames(edit: (X: Float32Array, i: number) => void = () => {}, n = 61): Float32Array[] {
  return Array.from({ length: n }, (_, i) => {
    const X = Float32Array.from(still);
    edit(X, i);
    return X;
  });
}
const P = (n: string) => format.IDX[n]! * 3;
const move = (X: Float32Array, names: readonly string[], d: readonly number[]) => names.forEach((n) => [0, 1, 2].forEach((c) => (X[P(n) + c] = X[P(n) + c]! + d[c]!)));
const motion = (F: Float32Array[], loop = false, tags: string[] = [], rate = 60) => checks.motionOfFrames(F, R, { loop, id: "fixture", tags, rate });
const FOOT_L = ["ankleL", "ballL", "toeL"];
/** The findings of every metric on a motion. */
const found = (m: checks.Motion) => checks.measure(m).findings;
/** The idle's first key at time t, edited. */
const key = (t: number, edit: (k: Key) => void = () => {}): Key => {
  const k = structuredClone(idle.keys[0]!);
  k.t = t;
  edit(k);
  return k;
};
const clip = (keys: Key[], extra: object = {}) => ({ ...idle, id: "fixture", loop: false, dur: keys[keys.length - 1]!.t, keys, ...extra });
/** The idle standing still while its root glides `mm` forward over `dur` seconds. */
const glide = (mm: number, dur = 1) => clip([key(0, (k) => (k.root = [0, 0])), key(dur, (k) => (k.root = [(mm / R.H0) * 100, 0]))]);

describe("each metric finds its defect, at its times, and nothing on the clean motion", () => {
  const clean = found(motion(frames()));
  it("finds nothing on a still pose", () => expect(clean).toEqual([]));
  it("slide: a planted foot dragged 150 mm, measured as its drift from where it landed", () => {
    const m = motion(frames((X, i) => move(X, FOOT_L, [Math.min(i, 30) * 5, 0, 0])));
    const r = checks.slide(m);
    expect(r.value).toBeGreaterThan(140);
    expect(r.value).toBeLessThan(160);
    expect(r.findings.every((f) => f.where === "footL")).toBe(true);
    expect(checks.slide(motion(frames())).value).toBe(0);
    // dragged out and back: the drift is how far it got, not the path there and back
    expect(checks.slide(motion(frames((X, i) => move(X, FOOT_L, [(i <= 30 ? i : 60 - i) * 5, 0, 0])))).value).toBeCloseTo(150, -1);
    // marker noise of ±2 mm every sample adds up as a path (240 mm in a second), not as a drift
    expect(checks.slide(motion(frames((X, i) => move(X, FOOT_L, [i % 2 ? 2 : -2, 0, 0])))).value).toBeLessThan(5);
  });
  it("slide and skate: a body gliding on its root with the feet still on it, however fast", () => {
    for (const mm of [50, 190, 400, 800]) {
      const s = checks.slide(checks.motionOf(glide(mm), R));
      expect([Math.round(s.value), Math.round(s.skate.value)], `${mm} mm`).toEqual([mm, Math.round(mm / 10)]);
    }
    // 170 mm in half a second: under the slide's fail, a warning as skate
    const r = metrics(glide(170, 0.5), R);
    expect(r.findings.filter((f) => f.metric === "skate").map((f) => [f.where, f.level])).toEqual([["footL", "warn"], ["footR", "warn"]]);
    expect(predicates.check("no slide; slide < 50 mm; footL planted 0.1–0.4 s, slide < 10 mm", glide(400), R).map((o) => o.ok)).toEqual([false, false, false]);
    // a contact of 0.15 s sliding 45 mm (30 cm/s): a heel strike's settle, too short for skate to judge
    const short = motion(frames((X, i) => move(X, FOOT_L, [Math.min(Math.max(0, i - 20), 9) * 5, 0, i >= 20 && i <= 29 ? 0 : 150])));
    expect(short.contacts.footL).toEqual([[0.333, 0.483]]);
    expect(checks.slide(short).skate).toEqual({ value: 0, findings: [] });
  });
  it("slide: an in-place walk read on its treadmill stands its feet in turn and slides them little", () => {
    const { clip: walk } = testClip("Walk_Loop"), m = checks.motionOf(walk, R);
    expect(m.root.at(-1)!.forward).toBeGreaterThan(1000);
    for (const end of ["footL", "footR"] as const) expect((m.contacts[end] ?? []).reduce((a, [p, q]) => a + q - p, 0), end).toBeGreaterThan(0.5);
    expect(checks.slide(m).value).toBeLessThan(checks.THRESHOLDS.slide.warn);
  });
  it("slide: a loop's contact through its seam measures the part after the seam too", () => {
    // planted 0–0.35 s and 0.65–1 s (one contact through the seam), lifted between; it slides 100 mm only after the seam
    const m = motion(frames((X, i) => move(X, FOOT_L, [i <= 18 ? i * 5.5 : Math.max(0, 99 - (i - 18) * 4.95), 0, i > 21 && i < 39 ? 150 : 0])), true);
    expect(m.contacts.footL).toEqual([[0.65, 1.35]]);
    expect(checks.slide(m).value).toBeGreaterThan(95);
  });
  it("slide: a turn carried by the root's yaw, the pose already turned in clip space, doesn't move the feet", () => {
    // spec/MOTION.md §5.3: the clip-space pose carries the whole turn (body[0] = 90); yaw only tells a host to turn
    const turned = clip([key(0, (k) => ((k.root = [0, 0]), (k.yaw = [0] as never), (k.body = [90, k.body[1]!, k.body[2]!]))), key(1, (k) => ((k.root = [0, 0]), (k.yaw = [90] as never), (k.body = [90, k.body[1]!, k.body[2]!])))]);
    const m = checks.motionOf(turned, R);
    expect(m.contacts.footL).toEqual([[0, 1]]);
    expect(checks.slide(m).value).toBeLessThan(1);
  });
  it("penetration: the body sunk 140 mm under the floor for 0.2 s, named by its foot; a foot lying toes up isn't under it", () => {
    const m = motion(frames((X, i) => i >= 20 && i < 32 && move(X, format.POINTS as string[], [0, 0, -140])));
    const f = checks.penetration(m).soles;
    // the heel's sole point: the rest's ankleZ under the ankle (1.4 mm under the floor standing)
    expect(f.value).toBeGreaterThan(140);
    expect(f.value).toBeLessThan(142);
    expect(f.findings.map((x) => [x.level, x.where, +x.t0.toFixed(3), +x.t1.toFixed(3)])).toEqual([["fail", expect.stringMatching(/^foot[LR]$/), 0.333, 0.517]]);
    const hand = checks.penetration(motion(frames((X, i) => i === 40 && move(X, ["fistR", "wristR"], [0, 0, -X[P("fistR") + 2]! - 80])))).body.findings;
    expect(hand.map((x) => [x.where, +x.t0.toFixed(3)])).toEqual([["fistR", 0.667]]);
    // lying on the back: the left foot points up from an ankle 40 mm off the floor, its heel behind the ankle, not
    // 64 mm under the floor straight below it
    const lying = motion(frames((X) => {
      const a = [X[P("ankleL")]!, X[P("ankleL") + 1]!, 40];
      [["ankleL", [0, 0, 0]], ["ballL", [88, 0, 149]], ["toeL", [88, 0, 241]]].forEach(([n, d]) => [0, 1, 2].forEach((c) => (X[P(n as string) + c] = a[c]! + (d as number[])[c]!)));
    }));
    expect(checks.penetration(lying).soles.value).toBe(0);
  });
  it("intersection: a forearm through the belly, a shin through the other", () => {
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
    const legs = checks.intersection(motion(frames((X, i) => i >= 30 && ["knee", "ankle", "ball", "toe"].forEach((n) => [0, 1, 2].forEach((c) => (X[P(n + "L") + c] = X[P(n + "R") + c]!))))));
    expect(legs.findings.map((x) => x.where)).toEqual([expect.stringMatching(/^(shinL in shinR|footL in footR|shinL in footR|footL in shinR)$/)]);
  });
  it("jitter: a point shaking ±8 mm, not a single snap; on the key grid, a shake at the key rate", () => {
    const shake = checks.jitter(motion(frames((X, i) => i >= 20 && i < 40 && move(X, ["head"], [i % 2 ? 8 : -8, 0, 0]))));
    expect(shake.findings.map((f) => f.where)).toEqual(["head"]);
    expect(shake.findings[0]!.t0).toBeGreaterThanOrEqual(0.3);
    expect(shake.findings[0]!.t1).toBeLessThanOrEqual(0.7);
    expect(checks.jitter(motion(frames((X, i) => i === 30 && move(X, ["head"], [80, 0, 0])))).findings).toEqual([]);
    // a key out of place among a capture's ±1.5 mm noise: one big bend beside small ones of the other sign isn't a
    // shake (their geometric mean would read 35 mm on the keys either side)
    expect(checks.jitter(motion(frames((X, i) => move(X, ["head"], [(i % 2 ? 1.5 : -1.5) + (i === 31 ? 200 : 0), 0, 0])))).findings).toEqual([]);
    // keys 1/30 s apart, the right arm swinging ±5° from key to key: sampled at 60 Hz, two samples never both bend
    const keys = Array.from({ length: 31 }, (_, i) => key(i / 30, (k) => (k.armR = [k.armR[0]! + (i % 2 ? 9 : -9), k.armR[1]!, k.armR[2]!, k.armR[3]!, k.armR[4]!])));
    const j = checks.jitter(checks.motionOf(clip(keys), R));
    expect(j.findings.map((f) => [f.where, f.level])).toContainEqual([expect.stringMatching(/R$/), "fail"]);
    // a walk's sparse keys bend smoothly: no shake
    expect(checks.jitter(checks.motionOf(testClip("Walk_Loop").clip, R)).value).toBeLessThan(checks.THRESHOLDS.jitter.warn);
  });
  it("pop: a key out of place, a snap; not a smooth fast jab, nor a step only twice its neighbours", () => {
    const pop = checks.pops(motion(frames((X, i) => i === 30 && move(X, ["fistR"], [200, 0, 0]))));
    expect(pop.findings.map((f) => [f.where, f.level, +f.t0.toFixed(3), +f.t1.toFixed(3)])).toEqual([["fistR", "fail", 0.483, 0.517]]);
    // 5 m/s, steadily, the whole second
    expect(checks.pops(motion(frames((X, i) => move(X, ["fistR", "wristR"], [i * 83, 0, 0])))).findings).toEqual([]);
    // steps of 50 mm a sample (3 m/s), one of them three times that: a snap; twice that: not a pop
    const stepping = (k: number) => motion(frames((X, i) => move(X, ["fistR"], [i * 50 + (i > 30 ? (k - 1) * 50 : 0), 0, 0])));
    expect(checks.pops(stepping(3)).findings.map((f) => [f.where, +f.t0.toFixed(3)])).toEqual([["fistR", 0.5]]);
    expect(checks.pops(stepping(2)).findings).toEqual([]);
    // a key 9 ms past the end, the arm thrown up: never played when the last key is at the end, so nothing jumps
    const past = { ...idle, id: "fixture", loop: false, dur: 1, keys: [0, 0.5, 1, 1.009].map((t) => ({ ...structuredClone(idle.keys[0]!), t, ...(t > 1 ? { armR: [0, 0, 100, 0, 0] } : {}) })) };
    expect(checks.pops(checks.motionOf(past, R)).findings).toEqual([]);
    expect(checks.motionOf(past, R).grid.times).toEqual([0, 0.5, 1]);
    // with the last key short of the end, the key past it shapes the end: the grid ends on the pose at the end
    const short = { ...past, keys: past.keys.filter((k) => k.t !== 1) };
    expect(checks.motionOf(short, R).grid.times).toEqual([0, 0.5, 1]);
    // a minimum-jerk jab, 600 mm in 0.12 s at 30 fps (peak 7 m/s): its steps grow and shrink
    const mj = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
    expect(checks.pops(motion(frames((X, i) => move(X, ["fistR", "wristR"], [600 * mj((i / 30 - 0.4) / 0.12), 0, 0]), 31), false, [], 30)).findings).toEqual([]);
  });
  it("stretch: a shin 5% longer for 0.1 s, and one 5% shorter", () => {
    for (const k of [0.05, -0.05]) {
      const f = checks.stretch(motion(frames((X, i) => i >= 10 && i < 16 && move(X, ["ankleR", "ballR", "toeR"], [0, 0, -k * R.shin])))).findings;
      expect(f.map((x) => [x.where, x.level]), String(k)).toEqual([["kneeR–ankleR", "fail"]]);
      expect(f[0]!.t0).toBeCloseTo(10 / 60, 6);
    }
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
  /** The idle with its left leg bent `bend`° in every key. */
  const bent = (t: number, bend: number, twist = 0) => key(t, (k) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, bend, (k.legL[4] ?? 0) + twist]));
  it("twistFlip: a jump between close keys; at a straight limb whatever the spacing; a slow turn elsewhere isn't one", () => {
    const flips = (keys: Key[]) => checks.twistFlips(checks.motionOf(clip(keys), R)).findings.map((x) => [x.where, x.level, x.t0, x.t1]);
    expect(flips([bent(0, 45), bent(0.4, 45), bent(0.467, 45, 170), bent(1, 45, 170)])).toEqual([["legL", "fail", 0.4, 0.467]]);
    // half a second apart: 170° turns at 34° per 0.1 s where the knee is bent, but flips where the leg is straight
    expect(flips([bent(0, 45), bent(0.5, 45, 170), bent(1, 45, 170)])).toEqual([]);
    expect(flips([bent(0, 0), bent(0.5, 0, 170), bent(1, 0, 170)])).toEqual([["legL", "fail", 0, 0.5]]);
  });
  it("jointLimit: a bent knee pointing backwards, by its wrapped twist; the head turned 170°, in either reading", () => {
    const limits = (keys: Key[]) => checks.jointLimits(checks.motionOf(clip(keys), R)).findings.map((x) => [x.where, x.level, x.t0]);
    const knee = (bend: number, twist: number) => limits([key(0), key(0.5, (k) => (k.legR = [k.legR[0]!, k.legR[1]!, k.legR[2]!, bend, twist])), key(1)]);
    expect(knee(45, 175)).toEqual([["legR (the knee bends back)", "fail", 0.5]]);
    expect(knee(45, 175 + 360)).toEqual([["legR (the knee bends back)", "fail", 0.5]]);
    expect(knee(45, 360)).toEqual([]);
    // a straight leg's twist turns no knee
    expect(knee(10, 175)).toEqual([]);
    const head = (h: number[]) => limits([key(0), key(0.5, (k) => (k.head = h)), key(1)]);
    expect(head([170, 0, 0])[0]![0]).toMatch(/^head/);
    // [turn + 180, 180 − lean, tilt + 180] is the same pose (spec/MOTION.md §6.3): turned −11°, not 169°
    expect(head([169, 178, 180])).toEqual([]);
  });
  it("fit, nan and events: the clip's records", () => {
    expect(checks.fit(checks.motionOf(clip([key(0), key(1)], { quality: { fit: [45, 120], qa: "unchecked", qaVersion: "none" } }), R)).findings[0]!.level).toBe("fail");
    expect(checks.fit(checks.motionOf(clip([key(0), key(1)], { quality: { fit: [10, 350], qa: "unchecked", qaVersion: "none" } }), R)).findings[0]!.level).toBe("fail");
    const bad = checks.nan(checks.motionOf(clip([key(0), key(0.5, (k) => (k.head = [Number.NaN, 0, 0])), key(1)]), R));
    expect(bad.value).toBeGreaterThan(0);
    expect(bad.findings[0]!.t0).toBe(0.5);
    // captured points with no keys: a non-number in a sample
    expect(checks.nan(motion(frames((X, i) => i === 45 && (X[P("head")] = Number.NaN)))).findings.map((f) => f.t0)).toEqual([0.75]);
    const ev = checks.events(checks.motionOf(clip([key(0), key(1)], { events: [{ t: 0.6, name: "b" }, { t: 0.3, name: "a" }, { t: 2, name: "late" }, { t: 2.01, name: "" }] }), R));
    expect(ev.findings.map((f) => [f.t0, f.message.replace(/^.*: an event /, "").replace(/ \(.*$/, "")])).toEqual([[0.3, "comes before the event listed above it"], [2, "is outside the clip"], [2.01, "has no name"], [2.01, "is outside the clip"]]);
  });
});

describe("profiles, the report and the thresholds", () => {
  it("turns off what a profile doesn't judge: a lying clip's body on the floor", () => {
    expect(metrics({ ...idle, tags: ["death"] }, R).off).toContain("bodyPenetration");
    expect(checks.profilesOf(["swim"], "x")).toEqual(["swimming"]);
    expect(checks.profilesOf([], "Backflip")).toEqual(["acrobatics"]);
    expect(checks.profilesOf([], "MESH2MOTION/Dive_Roll")).toEqual(["acrobatics"]);
    expect(checks.profilesOf(["emote", "dance"], "MESH2MOTION/Dance_Body_Roll")).toEqual([]);
    expect(checks.profilesOf(["slide", "dodge"], "x")).toContain("sliding");
    const lying = frames((X) => move(X, ["pelvis", "spine1", "head", "headTop"], [0, 0, -X[P("pelvis") + 2]! - 40]));
    expect(found(motion(lying)).some((f) => f.metric === "bodyPenetration")).toBe(true);
    expect(found(motion(lying, false, ["death"])).some((f) => f.metric === "bodyPenetration")).toBe(false);
  });
  it("writes a verdict in at most 20 lines, failures first, each with its times and a repair", () => {
    const { clip: walk } = testClip("Walk_Loop"), r = metrics(walk, R);
    expect(r.text.split("\n").length).toBeLessThanOrEqual(20);
    expect(r.text.split("\n")[0]).toMatch(/^QUATERNIUS_3D2DGE\/Walk_Loop: (PASS|WARN|FAIL)/);
    const levels = r.findings.map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === "fail" ? -1 : 1)));
    for (const f of r.findings) expect(f.message).toMatch(/\d+\.\d\d(–\d+\.\d\d)? s: .+: .+/);
    expect(metrics(idle, R).verdict).toBe("pass");
    const warn = metrics(glide(170, 0.5), R);
    expect([warn.verdict, warn.findings.length]).toEqual(["warn", 4]);
    expect(metrics(glide(400), R).findings.slice(0, 2).map((f) => f.level)).toEqual(["fail", "fail"]);
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
    // the test body's levels are its own hip height's share of the reference's
    expect(checks.levels(checks.motionOfFrames(frames(), R), "slide").warn).toBeCloseTo((checks.THRESHOLDS.slide.warn * R.H0) / checks.REFERENCE_H0, 6);
  });
  describe("folds the jitter and pops a twist flip swings into the flip's finding", () => {
    // the left foot's heading jumps 130° (a warning) between keys 1/30 s apart, swinging its ball and toes (a failing
    // pop); the head snaps round at the same keys, which no foot swings
    // (and, with `toes`, the toes snap up later, by themselves)
    const flipped = (head: boolean, toes = false) => clip([0, 0.4, 0.433, 0.8, 0.833, 1].map((t) => key(t, (k) => {
      if (t > 0.42) k.footL = [k.footL![0]!, k.footL![1]! + 130, k.footL![2]! + (toes && t > 0.82 ? 60 : 0)];
      if (head && t > 0.42) k.head = [k.head[0]! + 60, k.head[1]!, k.head[2]!];
    })));
    it("the flip names what it swings and takes its worst level; the rest stays", () => {
      const r = metrics(flipped(true, true), R), flip = r.findings.find((f) => f.metric === "twistFlip")!;
      expect([flip.where, flip.level, flip.value]).toEqual(["footL", "fail", 130]);
      expect(flip.message).toMatch(/it swings .*toeL's pop \(fail\).*, so it fails$/);
      expect(r.findings.filter((f) => f.metric === "pop").map((f) => [f.where, f.t0])).toEqual([[expect.stringMatching(/^(head|headTop|faceF)$/), 0.4], ["toeL", 0.8]]);
      expect(r.folded.map((f) => [f.metric, f.where])).toContainEqual(["pop", "toeL"]);
    });
    it("a knee read as straight (bent 15°) still swings: its pop folds into its flip", () => {
      const knee = clip([0, 0.4, 0.433, 1].map((t) => key(t, (k) => (k.legL = [k.legL[0]!, k.legL[1]!, k.legL[2]!, 15, (k.legL[4] ?? 0) + (t > 0.42 ? 170 : 0)]))));
      const r = metrics(knee, R);
      expect(r.findings.filter((f) => f.metric === "twistFlip").map((f) => [f.where, f.message.includes("where the limb is straight")])).toEqual([["legL", true]]);
      expect(r.findings.some((f) => f.metric === "pop")).toBe(false);
      expect(r.folded.map((f) => [f.metric, f.where])).toContainEqual(["pop", "kneeL"]);
    });
    it("'no pop' reads the folded findings too", () => {
      expect(predicates.check("no pop", flipped(false), R)[0]!.ok).toBe(false);
      expect(metrics(flipped(false), R).findings.some((f) => f.metric === "pop")).toBe(false);
    });
  });
  it("mirrors with its pair: a clip mirrored is checked against the other", () => {
    const { clip: punch } = testClip("Punch_Jab");
    expect(metrics(punch, R, { mirrorOf: format.mirror(punch as never) as never }).values.symmetry).toBeLessThan(1);
    expect(metrics(punch, R, { mirrorOf: punch }).findings.some((f) => f.metric === "symmetry")).toBe(true);
  });
});

describe("captured frames with their root's path, and reading by parts (D51)", () => {
  it("reads a travelling loop's seam on the body: frames on the root with its path have none, the same frames in the world do", () => {
    const n = 61, step = 1200 / (n - 1), still3 = frames(() => {}, n), root = still3.map((_, i) => ({ forward: i * step, right: 0, yaw: 0 }));
    const world = still3.map((X, i) => X.map((x, j) => (j % 3 === 0 ? x + root[i]!.forward : x)));
    expect(checks.seam(checks.motionOfFrames(still3, R, { loop: true, root })).pose.value).toBe(0);
    expect(checks.seam(checks.motionOfFrames(world, R, { loop: true })).pose.value).toBeCloseTo(1200, 0);
    // its feet still stand in the world where the root carries them
    expect(checks.motionOfFrames(still3, R, { root }).root.at(-1)!.forward).toBeCloseTo(1200, 6);
    expect(() => checks.motionOfFrames(still3, R, { root: root.slice(1) })).toThrow(/root places for 61 frames/);
  });
  it("reads each point against its part's size only when asked: arms twice a person's read an arm's shake against their length", () => {
    const long = { ...R, up: R.up * 2, fore: R.fore * 2 }, shake = frames((X, i) => move(X, ["elbowL", "wristL", "fistL", "knuckL", "indexL", "pinkyL"], [i % 2 ? 6 : -6, 0, 0]));
    const plain = checks.motionOfFrames(shake, long), parts = checks.motionOfFrames(shake, long, { parts: true });
    expect(checks.partScale(plain, "elbowL")).toBe(1);
    expect(checks.partScale(parts, "pelvis")).toBe(1);
    const typical = checks.partScale(checks.motionOfFrames(shake, R, { parts: true }), "wristL");
    // the wrist's chain runs from the pelvis up the spine and out along the arm: its arm doubled, it is 1.38 times as long
    const ratio = checks.partScale(parts, "wristL") / typical;
    expect(ratio).toBeGreaterThan(1.3);
    // the same shake reads smaller against the longer arm: each point by its own chain's scale
    const scaleOf = (n: string) => checks.partScale(parts, n);
    expect(checks.jitter(parts).value).toBeLessThan(checks.jitter(plain).value / Math.min(scaleOf("elbowL"), scaleOf("fistL")) + 1e-9);
    expect(checks.jitter(parts).value).toBeLessThan(checks.jitter(plain).value / 1.2);
    expect(checks.TYPICAL_CHAIN.toe).toBeGreaterThan(checks.TYPICAL_CHAIN.ankle!);
  });
});
