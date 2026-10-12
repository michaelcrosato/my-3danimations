// Contacts and ground (WP-2.5): on every locomotion loop in the library (100STYLE's other gaits are in contact-gaits,
// contact-sidesteps and contact-siderun.test.ts, so they run side by side) and on synced walk–run blends a planted foot
// slides at most 10 mm per contact; on a 10° slope and a 0.2 m step the planted soles stay within 5 mm of the surface
// and no sole goes under it; without settling the body keeps its height but where a leg can't reach; hands reach their
// targets; and planting depends on the time alone, so skipped poses change nothing. On another body (D51): the body
// settles as a weight shift, re-solved knees don't snap, a free leg is the clip's, and a cross-fade hands a planted
// foot over.
import { describe, expect, it } from "vitest";
import {
  Animator, bind, contactsAt, derived, IDX, measureFacts, phaseMap, plant, syncBlend, toWorld,
  type AnimClip, type Ground, type Key,
} from "./all.ts";
import { ik3 } from "../src/format/body.ts";
import { scriptData } from "./animator-data.ts";
import { library, locomotionSlides, lowest, motionOf, P, worstSlide, SAMPLE } from "./contact-data.ts";

// the sets the library held before WP-5.3 (100STYLE's other gaits have their own files)
const lib = library((set) => !set.startsWith("STYLE100_"));
const byId = (id: string) => lib.find((x) => x.id === id)!;

describe("planted feet don't slide", () => {
  it("on every locomotion loop (every third in T1) of the sets from before 100STYLE's other gaits: at most 10 mm per contact (unplanted, they slide up to tens of mm)", () => {
    const { clips, worst, at, worstFree } = locomotionSlides(lib);
    expect(clips).toBeGreaterThan(120 / SAMPLE);
    expect(worst, at).toBeLessThanOrEqual(10);
    expect(worstFree).toBeGreaterThan(30);
  }, 60_000);
  it("on synced walk–run blends, their contacts the inputs' weighted", () => {
    for (const run of ["Jog_Fwd_Loop", "Sprint_Loop"]) {
      const A = byId("QUATERNIUS_3D2DGE/Walk_Loop"), B = byId(`QUATERNIUS_3D2DGE/${run}`);
      const ma = phaseMap(A.clip, measureFacts(A.clip, A.R).contacts), mb = phaseMap(B.clip, measureFacts(B.clip, B.R).contacts);
      for (const w of [0.25, 0.5, 0.75]) {
        const sb = syncBlend(A.clip, ma, B.clip, mb, w, { rest: A.R });
        const n = Math.ceil(sb.dur * 60), keys: Key[] = [];
        for (let i = 0; i <= n; i++) keys.push({ t: (sb.dur * i) / n, ...(sb.at(i / n) as object) } as Key);
        const m = motionOf({ dur: sb.dur, loop: true, keys }, A.R, sb.contacts);
        expect(sb.contacts.footL ?? sb.contacts.footR, `${run} ${w}`).toBeDefined();
        expect(worstSlide(m, (t) => plant(m, t)), `${run} ${w}`).toBeLessThanOrEqual(10);
      }
    }
  });
  it("lowers the pelvis where a leg can't reach, by at most a tenth of H0", () => {
    for (const id of ["CMU_CURATED/Zombie_Walk_Loop", "STYLE100/BigSteps_Walk", "QUATERNIUS_3D2DGE/Walk_Loop"]) {
      const { clip, R } = byId(id), m = motionOf(clip, R, measureFacts(clip, R).contacts);
      for (let t = 0; t < clip.dur; t += 1 / 30) expect(m.points(t)[IDX.pelvis! * 3 + 2]! - plant(m, t)[IDX.pelvis! * 3 + 2]!).toBeLessThanOrEqual(0.1 * R.H0 + 1e-9);
    }
  });
});

describe("the ground", () => {
  const surfaces: [string, Ground][] = [
    ["a 10° slope up", (f) => f * Math.tan((10 * Math.PI) / 180)],
    ["a 10° slope down", (f) => -f * Math.tan((10 * Math.PI) / 180)],
    ["a 0.2 m step up", (f) => (f > 800 ? 200 : 0)],
    ["a 0.2 m step down", (f) => (f > 800 ? -200 : 0)],
  ];
  for (const [label, ground] of surfaces) {
    it(`on ${label}, planted soles stay within 5 mm of the surface and no sole goes under it`, () => {
      for (const id of ["QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Jog_Fwd_Loop", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop"]) {
        const { clip, R } = byId(id), contacts = measureFacts(clip, R).contacts, m = motionOf(clip, R, contacts);
        let planted = 0, under = 0;
        for (let t = 0; t <= 3 * clip.dur; t += 1 / 60) {
          const X = plant(m, t, { ground }), root = m.root(t), c = contactsAt({ ...clip, contacts }, t);
          for (const s of ["L", "R"] as const) {
            const gap = Math.min(...[[...P(X, "ankle" + s)].map((x, i) => (i === 2 ? x - R.ankleZ : x)), P(X, "ball" + s), P(X, "toe" + s)].map((p) => {
              const w = toWorld(root, p);
              return p[2]! - ground(w[0], w[1]);
            }));
            if (c[`foot${s}`]) planted = Math.max(planted, Math.abs(gap));
            under = Math.max(under, -gap);
          }
        }
        expect(planted, id).toBeLessThanOrEqual(5);
        expect(under, id).toBeLessThanOrEqual(5);
      }
    });
  }
  it("sets the sole, not the ankle, on flat ground: a planted contact point touches the floor", () => {
    // within the clip's own dip between keys, which a planted sole keeps by up to 4 mm (D55); the ankle sits ankleZ up
    const { clip, R } = byId("QUATERNIUS_3D2DGE/Walk_Loop"), contacts = measureFacts(clip, R).contacts, m = motionOf(clip, R, contacts);
    for (let t = 0; t < clip.dur; t += 1 / 60) {
      const X = plant(m, t), c = contactsAt({ ...clip, contacts }, t);
      for (const s of ["L", "R"] as const) if (c[`foot${s}`]) expect(Math.abs(lowest(X, s, R).z)).toBeLessThanOrEqual(4 + 1e-9);
    }
    expect(R.ankleZ).toBeGreaterThan(40);
  });
  it("without settling, keeps the body at its height but where a leg can't reach, the planted soles on the floor", () => {
    for (const id of ["QUATERNIUS_3D2DGE/Walk_Loop", "MESH2MOTION/Zombie_Scratch"]) {
      const { clip, R } = byId(id), contacts = measureFacts(clip, R).contacts, m = motionOf(clip, R, contacts);
      let moved = 0;
      for (let t = 0; t < clip.dur; t += 1 / 30) {
        const X = plant(m, t, { settle: false }), c = contactsAt({ ...clip, contacts }, t), dz = P(X, "pelvis")[2] - P(m.points(t), "pelvis")[2];
        expect(dz, `${id} ${t}`).toBeLessThanOrEqual(0);
        expect(dz, `${id} ${t}`).toBeGreaterThanOrEqual(-0.1 * R.H0 - 1e-9);
        for (const s of ["L", "R"] as const) if (c[`foot${s}`]) expect(Math.abs(lowest(X, s, R).z), `${id} ${t}`).toBeLessThan(1e-6);
        moved = Math.max(moved, Math.abs(P(plant(m, t), "pelvis")[2] - P(m.points(t), "pelvis")[2]));
      }
      // settled (the default), the body follows its planted soles
      expect(moved, id).toBeGreaterThan(0.5);
    }
  });
});

describe("hands and statelessness", () => {
  const { clip, R } = byId("QUATERNIUS_3D2DGE/Idle_Loop");
  const m = motionOf(clip, R, measureFacts(clip, R).contacts);
  it("draws a hand to its target by its weight, and leaves it at weight 0", () => {
    const free = m.points(0.5), sh = P(free, "shR"), at: [number, number, number] = [sh[0] + 350, sh[1] + 100, sh[2] - 150];
    const world = toWorld(m.root(0.5), at);
    const full = plant(m, 0.5, { hands: { R: { at: world, weight: 1 } } });
    const d = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    expect(d(P(full, "fistR"), at)).toBeLessThan(1);
    expect(d(P(plant(m, 0.5, { hands: { R: { at: world, weight: 0.5 } } }), "fistR"), at)).toBeCloseTo(d(P(free, "fistR"), at) / 2, -1);
    expect(plant(m, 0.5, { hands: { R: { at: world, weight: 0 } } })).toEqual(plant(m, 0.5));
    // out of reach: the arm stretches straight toward it
    const far = plant(m, 0.5, { hands: { R: { at: toWorld(m.root(0.5), [sh[0] + 3000, sh[1], sh[2]]), weight: 1 } } });
    expect(d(P(far, "shR"), P(far, "fistR"))).toBeCloseTo(R.up + derived(R).lower, 0);
  });
  it("depends on the time alone: a pose is the same however many were skipped before it", () => {
    const { clip: walk, R: Rw } = byId("QUATERNIUS_3D2DGE/Walk_Loop");
    const a = motionOf(walk, Rw, measureFacts(walk, Rw).contacts), b = motionOf(walk, Rw, measureFacts(walk, Rw).contacts);
    for (let t = 0; t < 2 * walk.dur; t += 1 / 60) plant(a, t);
    for (const t of [0.4, 1.1, 2.2]) expect(plant(a, t)).toEqual(plant(b, t));
  });
});

describe("on another body, and under a cross-fade (D51)", () => {
  const data = scriptData(), rig = bind(data.skeleton), [walk, jog] = data.clips as [AnimClip, AnimClip];
  /** The worst move in one 1/60 s step of `points` (by name), playing clip `id` on the test rig, planted and not. */
  const speeds = (id: string, points: string[]) => {
    const { clip, R } = byId(id), a = new Animator(rig).layer("b", { clip: { ...clip, contacts: measureFacts(clip, R).contacts } });
    let prev: [Float64Array, Float64Array] | null = null;
    const worst = { planted: 0, free: 0 };
    for (let i = 0; i <= clip.dur * 60; i++) {
      const now: [Float64Array, Float64Array] = [Float64Array.from(a.pose().points), Float64Array.from(a.pose(undefined, { lod: 1 }).points)];
      if (prev) for (const n of points) for (const k of [0, 1] as const) {
        const d = Math.hypot(...P(now[k], n).map((x, j) => x - P(prev![k], n)[j]!));
        if (k === 0) worst.planted = Math.max(worst.planted, d);
        else worst.free = Math.max(worst.free, d);
      }
      prev = now;
      a.step(1 / 60);
    }
    return worst;
  };
  const CLIPS = ["CMU_CURATED/Block_Combo", "CMU_CURATED/Robot", "MESH2MOTION/Walk_Female", "STYLE100/Morris_Walk", "CMU_CURATED/Run_Loop"];
  it("lets the body settle onto its feet as a weight shift: the planted pelvis rises or falls at most 14 mm a step more than the unplanted one", () => {
    // a 0.05 s settle that followed the higher foot's float in a frame moved it up to 32 mm more (Robot)
    for (const id of CLIPS) {
      const { clip, R } = byId(id), a = new Animator(rig).layer("b", { clip: { ...clip, contacts: measureFacts(clip, R).contacts } });
      let prev: [number, number] | null = null, worst = 0;
      for (let i = 0; i <= clip.dur * 60; i++) {
        const z: [number, number] = [a.pose().points[2]!, a.pose(undefined, { lod: 1 }).points[2]!];
        if (prev) worst = Math.max(worst, Math.abs(z[0] - prev[0]) - Math.abs(z[1] - prev[1]));
        prev = z;
        a.step(1 / 60);
      }
      expect(worst, id).toBeLessThan(14);
    }
  });
  it("doesn't carry a planted sole's every millimetre into the hips: the pelvis jerks at most 12 mm a step² more than unplanted", () => {
    // the settle followed a planted toe dipping between two keys frame by frame: Sprint's pelvis jerked 37 mm more (D55)
    const { clip, R } = byId("MESH2MOTION/Sprint"), a = new Animator(rig).layer("b", { clip: { ...clip, contacts: measureFacts(clip, R).contacts } });
    const z: [number, number][] = [];
    for (let i = 0; i <= clip.dur * 60; i++) {
      z.push([a.pose().points[2]!, a.pose(undefined, { lod: 1 }).points[2]!]);
      a.step(1 / 60);
    }
    let worst = 0;
    for (let i = 1; i + 1 < z.length; i++) worst = Math.max(worst, Math.abs(z[i + 1]![0] - 2 * z[i]![0] + z[i - 1]![0]) - Math.abs(z[i + 1]![1] - 2 * z[i]![1] + z[i - 1]![1]));
    expect(worst).toBeLessThan(12);
  });
  it("never folds a planted knee backward where the clip's isn't: a leg held a little past straight bends forward", () => {
    // Chop_Wood's feet held all along: the knee followed the clip's offset behind the line, 273 frames, up to 33 mm (D55)
    const { clip } = byId("CMU_CURATED/Chop_Wood"), a = new Animator(rig).layer("b", { clip: { ...clip, contacts: { by: "labelled", footL: [[0, clip.dur]], footR: [[0, clip.dur]] } } });
    const behind = (X: ArrayLike<number>, s: string) => {
      const h = P(X, "hip" + s), d = P(X, "ankle" + s).map((x, i) => x - h[i]!), u = P(X, "knee" + s).map((x, i) => x - h[i]!), f = P(X, "pelvisF").map((x, i) => x - P(X, "pelvis")[i]!);
      const al = u.reduce((t, x, i) => t + x * d[i]!, 0) / d.reduce((t, x) => t + x * x, 0), fl = Math.hypot(...f);
      return u.reduce((t, x, i) => t + ((x - d[i]! * al) * f[i]!) / fl, 0);
    };
    let frames = 0, deepest = 0;
    for (let i = 0; i <= clip.dur * 60; i++) {
      const p = a.pose().points, free = a.pose(undefined, { lod: 1 }).points;
      for (const s of ["L", "R"]) {
        const extra = behind(p, s) - Math.min(0, behind(free, s));
        if (extra < -5) [frames, deepest] = [frames + 1, Math.min(deepest, extra)];
      }
      a.step(1 / 60);
    }
    expect(frames).toBeLessThanOrEqual(20);
    expect(deepest).toBeGreaterThan(-15);
  });
  it("holds a foot through a gap of under 0.1 s between its contacts: no step was taken (D58)", () => {
    // Zombie_Walk_Loop's left foot stood 0.45–1.4 s, lifted for 33 ms across the seam and stood again (as detected on the
    // migrated clip, given here as labelled so a re-import's detection can't move them): letting its hold go and taking
    // it again there moved the ankle 31 mm in a frame
    const { clip } = byId("CMU_CURATED/Zombie_Walk_Loop"), contacts = { by: "labelled" as const, footL: [[0.033, 0.117], [0.45, 1.4]] as [number, number][], footR: [[1.033, 2.15]] as [number, number][] };
    const a = new Animator(rig).layer("b", { clip: { ...clip, contacts }, time: 1.3 });
    let prev: number[] | null = null, worst = 0;
    for (let i = 0; i <= 14; i++) {
      const p = a.pose(), w = toWorld(p.root, P(p.points, "ankleL"));
      if (prev) worst = Math.max(worst, Math.hypot(w[0]! - prev[0]!, w[1]! - prev[1]!));
      prev = w;
      a.step(1 / 60);
    }
    expect(worst).toBeLessThan(15);
  });
  it("keeps a re-solved knee from snapping: a planted knee moves at most 16 mm a step more than the unplanted one", () => {
    // a knee held straight and let go, or turned round by a nearly straight leg's twist, moved up to 37 mm more
    for (const id of CLIPS) {
      const w = speeds(id, ["kneeL", "kneeR"]);
      expect(w.planted - w.free, id).toBeLessThan(16);
    }
  });
  it("keeps the clip's knee where it doesn't move the foot: a leg with nothing planted is the clip's leg", () => {
    let kept = 0;
    for (const id of ["QUATERNIUS_3D2DGE/Idle_Loop", "CMU_CURATED/Wave_Hello", "MESH2MOTION/Idle_Talking"]) {
      const { clip, R } = byId(id), m = motionOf(clip, R, { by: "detected" });
      for (let t = 0; t < clip.dur; t += 0.1) for (const s of ["L", "R"]) {
        const X = plant(m, t), free = m.points(t), d = (n: string) => Math.hypot(...P(X, n + s).map((x, j) => x - P(free, n + s)[j]!));
        // a foot under the floor is brought up (and its knee with it); elsewhere the leg is the clip's
        if (d("ankle") - Math.abs(P(X, "pelvis")[2] - P(free, "pelvis")[2]) > 1e-9) continue;
        expect(d("knee") - Math.abs(P(X, "pelvis")[2] - P(free, "pelvis")[2]), `${id} ${t.toFixed(1)} ${s}`).toBeLessThan(1e-6);
        kept++;
      }
    }
    expect(kept).toBeGreaterThan(50);
  });
  it("hands a planted foot from the layer fading out to the one fading in: no ankle jumps further in a step than the clips' own fastest", () => {
    // the layer that most decided the legs planted alone; at half way it changed, and an ankle jumped up to 462 mm
    for (const start of [0.2, 0.5, 0.8, 1.1]) {
      const a = new Animator(rig).layer("base", { clip: walk, time: start }).layer("fade", { clip: jog, weight: 0 });
      let prev: number[][] | null = null, during = 0, outside = 0;
      for (let i = 0; i < 40; i++) {
        const u = Math.min(1, Math.max(0, (i - 10) / 15));
        a.layer("fade", { weight: u * u * (3 - 2 * u) });
        const p = a.pose(), world = ["ankleL", "ankleR"].map((n) => toWorld(p.root, P(p.points, n)));
        if (prev) {
          const d = Math.max(...world.map((q, k) => Math.hypot(q[0]! - prev![k]![0]!, q[1]! - prev![k]![1]!, q[2]! - prev![k]![2]!)));
          if (i > 10 && i < 26) during = Math.max(during, d);
          else outside = Math.max(outside, d);
        }
        prev = world;
        a.step(1 / 60);
      }
      expect(during, `from ${start} s`).toBeLessThanOrEqual(outside);
    }
  });
  it("solves a limb whose end is inside its fold: the lengths kept, the limb folded toward it", () => {
    const [knee, ankle] = ik3([0, 0, 0], [0, 0, -40], 400, 300, [1, 0, 0]);
    expect(Math.hypot(...knee)).toBeCloseTo(400, 6);
    expect(Math.hypot(...ankle.map((x, j) => x - knee[j]!))).toBeCloseTo(300, 6);
    expect(ankle[2]).toBeCloseTo(-100, 6);
    // a fully folded limb, as a decoded bend of 180° places it, stays as it is
    expect(ik3([0, 0, 0], [0, 0, -100], 400, 300, [1, 0, 0])[1]).toEqual([0, 0, -100]);
  });
});
