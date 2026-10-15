// Procedural clips under the sensors (WP-6.2, D71), on three rests (Mesh2Motion, 100STYLE, CMU): the gaits slide at
// most 10 mm per contact and none fails, their loops closing off the frame grid too; the idles pass; and the moves hold their floor, none failing but those D71
// lists and for the reasons it gives (the hand or arm about two of its widths into the body where the source's arcs,
// drawn for a stick figure, cross it; knee and elbow pops; a two-handed grip's off arm flipping round), so a move that
// starts failing, or fails for another reason, shows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { format, parseClip, procedural as PR, validate, type Rest } from "@m3a/core";
import { bind } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { checks, metrics } from "../src/index.ts";
import { CHAIN, legsOf, POP_FAIL, SEAM_FAIL, SEAM_RATE } from "../../core/src/procedural/gait.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
const MOVES = (JSON.parse(readFileSync(join(ROOT, "library/moves.json"), "utf8")) as { moves: PR.Move[] }).moves;
/** A library clip's rest and its source entry. */
function restOf(id: string): { rest: Rest; restSrc: string } {
  const [set, slug] = id.split("/") as [string, string], clip = parseClip(readFileSync(join(LIB, set, `${slug}.json`), "utf8"));
  const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
  return { rest: manifest.sources[clip.restSrc]!.rest, restSrc: clip.restSrc };
}
const RESTS = ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop"].map((id) => [id, restOf(id)] as const);
/** A library source's rest by its set and source. */
const sourceRest = (set: string, src: string): Rest => (JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[src]!.rest;
/** A test character's rest. */
const characterRest = async (n: number) => bind((await loadGlb(character(variant(n)).glb, { textures: false })).scene).core.rest;
/** A rest's standing points. */
const standing = (rest: Rest) => format.decodePose(rest, PR.standingOn(rest) as never, new Float32Array(format.P * 3)) as Float32Array;
/** The legs' and torso's points gaitClip reads its seam at (seamOf's), and the hands'. */
const BODY = /^(pelvis|pelvisF|spine1|spine2|chest|chestF|neck|head|headTop|faceF|(clav|sh|hip|knee|ankle|ball|toe)[LR])$/, HANDS = /^(fist|index|pinky)[LR]$/;
/**
 * A clip's seam as the sensors read it (by parts or plainly, as the motion says), of the fail level, at the points `at`
 * matches: each point's change of velocity across it, and the pop rule at the clip's first and last steps (a step over
 * 2.5 times the one beside it, or a pair out and back over 2.5 times the one beyond); the worst, and where.
 */
function seamAt(m: ReturnType<typeof checks.motionOf>, at: RegExp): [number, string] {
  const F = m.frames, n = F.length - 1, GF = m.grid.frames, GT = m.grid.times, g = GF.length - 1, sv = checks.levels(m, "seamVelocity").fail, pf = checks.levels(m, "pop").fail;
  let worst: [number, string] = [0, ""];
  format.POINTS.forEach((name, j) => {
    if (!at.test(name)) return;
    const sc = checks.partScale(m, name), d = (A: Float32Array, B: Float32Array) => [0, 1, 2].map((c) => A[j * 3 + c]! - B[j * 3 + c]!);
    const end = d(F[n]!, F[n - 1]!), start = d(F[1]!, F[0]!), v = Math.hypot(...end.map((x, c) => x - start[c]!)) / m.dt / sc / sv;
    const step = (i: number) => d(GF[i + 1]!, GF[i]!), speed = (i: number) => Math.hypot(...step(i)) / (GT[i + 1]! - GT[i]!) / sc, dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    let pop = 0;
    for (const [i, k, l] of [[0, 1, 2], [g - 1, g - 2, g - 3]] as const) {
      if (speed(i) > 2.5 * speed(k)) pop = Math.max(pop, speed(i) - speed(k));
      if (dot(step(i), step(k)) < 0 && Math.min(speed(i), speed(k)) > 2.5 * speed(l)) pop = Math.max(pop, Math.min(speed(i), speed(k)) - speed(l));
    }
    if (Math.max(v, pop / pf) > worst[0]) worst = [Math.max(v, pop / pf), name];
  });
  return worst;
}
/** The moves D71 lists as failing on some rest, and each fail finding they may have (metric@where), with why. */
const KNOWN_FAILS: Record<string, [RegExp, string]> = {
  slash: [/^intersection@forearmR in (pelvis|hips|chest)$/, "the low arc's forearm through the hips"],
  backslash: [/^intersection@(upperArmR|forearmR) in (chest|belly)$/, "the backhand's arm across the chest at its start"],
  plunge: [/^(intersection@(forearmR|handR) in hips|pop@pinkyR)$/, "the blade driven down past the hips, the hand snapping round"],
  twohand: [/^(intersection@(forearmL|upperArmL|handL) in (chest|pecs|pelvis)|jitter@(elbowL|wristR)|pop@(elbowL|elbowR|indexL)|twistFlip@armL)$/, "the off hand's arm folded across the chest and flipping round as the grip swings over"],
  haymaker: [/^pop@kneeL$/, "the lead knee as the wide swing steps in"],
  bash: [/^(intersection@forearmL in pecs|pop@kneeL)$/, "the shield arm across the chest, the knee as it steps in"],
  stir: [/^intersection@forearmR in (chest|belly)$/, "the near side of the circle"],
  stir_back: [/^intersection@(forearmR|handR) in hips$/, "the near side of the circle"],
};

describe("procedural clips under the sensors", () => {
  it("gaits slide at most 10 mm per contact, and none fails, on the three rests", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const g of PR.GAITS) {
        const c = PR.gaitClip(g, rest, { restSrc }), r = metrics(c, rest);
        expect([id, g.name, r.values.slide <= 10, r.verdict === "fail"]).toEqual([id, g.name, true, false]);
      }
    }
    // and gaits off the presets, each within its bar (mm): the four that slid most when a foot lifted off lower (12.5 to
    // 13.5 mm, D71), and those that slide most when a foot is let go of where it landed (the verifier's mutants, as round
    // 7's arc has them: as it sets down, 10.9 to 11.4; with no second pass, 6.5 to 8.8; as it lifts off, 10.5). Each is
    // the format's rounding (a planted ankle wanders ±4 mm frame to frame), so the arc's change moved them by ±2 mm, two
    // past their bars (5.7 and 7.6 mm, from 3.7 and 5.3)
    for (const [id, g, bar] of [
      ["MESH2MOTION/Idle_A", { speed: 100, cycle: 1, stance: 0.6 }, 10],
      ["STYLE100/Neutral_Walk", { speed: 60, cycle: 1.3, stance: 0.58, limp: 0.2 }, 10],
      ["STYLE100/Neutral_Walk", { speed: 160, cycle: 0.9, stance: 0.6 }, 10],
      ["CMU_CURATED/Walk_Loop", { speed: 180, cycle: 1, stance: 0.6 }, 10],
      ["STYLE100/Neutral_Walk", { speed: 140, cycle: 1.1, stance: 0.65 }, 8],
      ["MESH2MOTION/Idle_A", { speed: 120, cycle: 1.3, stance: 0.58, limp: 1 }, 7],
      ["STYLE100/Neutral_Walk", { speed: 100, cycle: 0.9, stance: 0.55 }, 8],
      ["MESH2MOTION/Idle_A", { speed: 140, cycle: 0.9, stance: 0.65 }, 6.5],
      // (this limp in 1.389 s since round 14: in 1.3 s its right foot swung 0.281 s, and slid 7.5 mm)
      ["STYLE100/Neutral_Walk", { speed: 60, cycle: 1.389, stance: 0.7, limp: 0.4 }, 9],
      // swings of 0.3 s, the shortest taken (5.2 mm; 0.26 s until round 14, which slid 6.0 mm): their feet lift off
      // quicker to clear the height a lifted foot is read at (lifting off as a longer swing does, swings of 0.2 s slid
      // 500 to 690 mm: the verifier's round 3)
      ["STYLE100/Neutral_Walk", { speed: 140, cycle: 0.75, stance: 0.6 }, 8],
      // (this limp in 1.725 s since round 14: in 1.5 s its right foot swung 0.261 s, and slid 7.6 mm)
      ["STYLE100/Neutral_Walk", { speed: 50, cycle: 1.725, stance: 0.7, limp: 0.6 }, 10],
    ] as const) {
      const { rest, restSrc } = RESTS.find(([x]) => x === id)![1], r = metrics(PR.gaitClip({ name: "g", about: "a gait", ...g }, rest, { restSrc }), rest);
      expect([id, g, r.values.slide <= bar, r.verdict === "fail"]).toEqual([id, g, true, false]);
    }
  }, 60_000);
  /** The longest and shortest any leg is drawn in clip c on rest, hip to ankle, of its length, at 240 times a cycle. */
  const longest = (rest: Rest, c: ReturnType<typeof PR.gaitClip>) => {
    const S = new Float32Array(format.P * 3);
    format.decodePose(rest, PR.standingOn(rest) as never, S);
    const b = PR.bodyOf(rest, S), leg = b.legUpper + b.legLower, X = new Float32Array(format.P * 3), at = (n: string) => [0, 1, 2].map((i) => X[format.IDX[n]! * 3 + i]!);
    let most = 0, least = Infinity;
    for (let i = 0; i <= 240; i++) {
      format.decodePose(rest, format.keyAt(c, (i / 240) * c.dur) as never, X);
      for (const s of ["L", "R"]) {
        const d = Math.hypot(...at(`hip${s}`).map((v, k) => v - at(`ankle${s}`)[k]!)) / leg;
        [most, least] = [Math.max(most, d), Math.min(least, d)];
      }
    }
    return { most, least };
  };
  it("gaits at the reach bound with a bounce keep every leg bent: at most 98.5% of its length as the clip holds it, and none fails", () => {
    // a stance of a half at its fastest (fitGait: the reach bound), bouncing 6% twice a cycle while a foot reaches far
    // ahead: the pelvis lowered for the stance's ends alone drove a leg to 99.7% and its knee popped (D71, round 6); the
    // pelvis is lowered until none passes 98.5% at any phase, its bounce, sway and rounding to the format's grid counted
    // (with the rounding uncounted, the clip held legs at up to 98.9% here, 99.3% on the verifier's grid: round 7)
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const [cycle, stance, lift] of [[0.6, 0.5, 12], [0.6, 0.5, 25], [0.75, 0.5, 12], [0.7, 0.35, 25]] as const) {
        const g = PR.fitGait({ name: "g", about: "a gait", cycle, stance, lift, bounce: 6, speed: 1000 }, rest), c = PR.gaitClip(g, rest, { restSrc });
        expect([id, g, longest(rest, c).most <= 0.985, metrics(c, rest).verdict === "fail"]).toEqual([id, g, true, false]);
      }
    }
    // the verifier's case: lowered for the stance's ends alone it popped a knee (3.6 m/s, a leg at 99.7%); its swing of
    // 0.26 s is refused since round 14, and at the shortest swing taken now, fitted, it plays
    const { rest, restSrc } = RESTS[0]![1];
    expect(() => PR.gaitClip({ name: "g", about: "a gait", speed: 375, cycle: 0.52, stance: 0.5, bounce: 6 }, rest, { restSrc })).toThrow(/its feet swing for 0.260 s, under 0.3 s/);
    expect(metrics(PR.gaitClip(PR.fitGait({ name: "g", about: "a gait", speed: 375, cycle: 0.6, stance: 0.5, bounce: 6 }, rest), rest, { restSrc }), rest).verdict).not.toBe("fail");
    // and on Mocopi's rest swaying 2 and 4: with the pelvis's vertical rounding left out of the loop, a leg read 98.63%
    // here (the verifier's round 8; the core's test holds the sway's and the across rounding's share directly)
    const mocopi = restOf("MESH2MOTION/Cheer_One_arm");
    for (const sway of [2, 4]) {
      const g = PR.fitGait({ name: "g", about: "a gait", cycle: 1.2, stance: 0.6, lift: 12, bounce: 6, sway, speed: 1000 }, mocopi.rest), c = PR.gaitClip(g, mocopi.rest, { restSrc: mocopi.restSrc });
      expect([g, longest(mocopi.rest, c).most <= 0.985, metrics(c, mocopi.rest).verdict === "fail"]).toEqual([g, true, false]);
    }
  }, 60_000);
  it("gaits at a short stance lifting high and bouncing keep their knees from folding shut once fitted: none fails at 55, 60 or 75 frames a second", () => {
    // a stance of 0.2 lifting 35 and bouncing 6 at the reach bound swung its foot back and forward far past the stride's
    // ends, the pelvis lowered for a leg to reach them (to 46 to 50% of the hip height), and the lifted foot passed under
    // the hips within 5 to 9% of a leg: the knee flipped round, popping at 22 to 30 m/s (the verifier's round 8, at 582,
    // 474 and 485); fitGait now slows it until no leg folds under 25% of its length
    for (const [[id, { rest, restSrc }], cycle] of RESTS.map((r, i) => [r, i ? 0.75 : 0.65] as const)) {
      const g = PR.fitGait({ name: "g", about: "a run", cycle, stance: 0.2, lift: 35, bounce: 6, speed: 1000 }, rest);
      for (const fps of [55, 60, 75]) {
        const c = PR.gaitClip(g, rest, { restSrc, fps });
        expect([id, g.speed, fps, longest(rest, c).least >= 0.245, metrics(c, rest).verdict === "fail"]).toEqual([id, g.speed, fps, true, false]);
      }
    }
  }, 60_000);
  it("gaits at a short stance lifting low and bouncing keep their knees over the floor once fitted", () => {
    // a stance of 0.2 lifting 9, bouncing 6 and swaying 4 at the reach bound swung the foot back past the stride's end
    // barely lifted, under hips lowered to under half the hip height, and the knee bent forward under them went 80 mm
    // through the floor on CMU_91's rest (fitGait gave 309 then, at every rate; round 8's review): it is slowed until no
    // knee can go under the floor (289)
    const rest = sourceRest("CMU_CURATED", "CMU_91"), g = PR.fitGait({ name: "g", about: "a run", cycle: 1.2, stance: 0.2, lift: 9, bounce: 6, dip: 6, sway: 4, lean: 8, swing: 80, speed: 1000 }, rest), r = metrics(PR.gaitClip(g, rest, { restSrc: "CMU_91" }), rest);
    expect([g.speed, r.values.bodyPenetration, r.verdict === "fail"]).toEqual([289, 0, false]);
  }, 30_000);
  it("gaits at the shortest swing near the reach bound keep the leading knee from popping, at the fewest frames a second", () => {
    // near the reach bound the leading leg straightens as its foot comes farthest ahead and bends again as the hips come
    // on over the planted foot, and where a swing spans under 16 frames that falls within one key and the knee popped:
    // CMU_18's rest swinging 0.261 s, 15 frames at 57.5 frames a second, 104.6% of the fail level plainly (round 13's
    // review). A swing takes 0.3 s since round 14, 16 frames or more at 55 whatever the cycle: the review's gait at the
    // cycle its refusal names (0.639 s), fitted (299), and the worst the climbs found at that swing, on CMU_18's rest
    // (72.3% at 55, 34 frames: 16.1 a swing), read plainly on every grid from 55 to 60 frames a second, at 90% of the
    // fail level or under. (Round 14's worst, CMU_114's rest at 0.635 s, 75.5% at 55, swung 0.2997 s, which the swing's
    // rounding to the ms took then and is refused since its review: 0.3 s to within a float's error.)
    const r18 = sourceRest("CMU_CURATED", "CMU_18");
    const g18 = PR.fitGait({ name: "g", about: "a gait", cycle: 0.639, stance: 0.53, lift: 10, bounce: 5.3, dip: 5.7, sway: 1.7, lean: -6, swing: 17, speed: 1000 }, r18);
    const climbed = { name: "g", about: "a gait", cycle: 0.633, stance: 0.526, limp: 0, lift: 10.078, bounce: 5.18, dip: 5.7, sway: 1.7, lean: -6.105, swing: 17, speed: 303.5 };
    expect(g18.speed).toBe(299);
    for (const [rest, g] of [[r18, g18], [r18, climbed]] as const)
      for (const fps of [55, 58, 60]) {
        const m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "x", fps }), rest), r = checks.measure(m);
        expect([g.speed, fps, r.values.pop <= 0.9 * checks.levels(m, "pop").fail, r.verdict === "fail"]).toEqual([g.speed, fps, true, false]);
      }
  }, 30_000);
  it("gaits at a run's shortest cycles keep the knee from turning round on the loop's seam: fitted, read as the protocol reads them", async () => {
    // a run's left foot lands half a cycle after the right, so as the loop ends and begins it swings: at a cycle of 0.6 s
    // and a stance of about 0.4 it has just stopped going back with the ground and comes forward at its sharpest, and the
    // knee reversed across the seam. Test character 4's fitted run (366) failed seamVelocity@kneeL at 112% at 60 frames
    // a second read by parts, and CMU_80's (354) pop@kneeL at 113.5% at 75 read plainly (the knee going back fast in the
    // clip's first step, then still as it turns round: the pop rule reads the first step against the second alone).
    // fitGait now slows each until nothing of its body turns there past SEAM_TURN, read on the keys the clip holds there
    // (round 10's review; rounds 11 and 12: 340 and 324 in round 11)
    const r4 = await characterRest(4), cmu80 = sourceRest("CMU_CURATED", "CMU_80");
    const g4 = PR.fitGait({ name: "g", about: "a run", cycle: 0.6, stance: 0.394, lift: 11.962, bounce: 1.175, dip: 11.866, sway: 0.112, speed: 615.228 }, r4);
    const g80 = PR.fitGait({ name: "g", about: "a run", cycle: 0.6, stance: 0.426, lift: 9.507, bounce: 0.777, dip: 8.138, sway: 0.674, speed: 538.967 }, cmu80);
    for (const [rest, g, fps, parts] of [[r4, g4, 60, true], [cmu80, g80, 75, false]] as const) {
      const m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "x", fps }), rest);
      m.parts = parts;
      const r = checks.measure(m), legs = r.findings.filter((f) => (f.metric === "seamVelocity" || f.metric === "pop") && /^(knee|ankle|ball|toe)/.test(f.where ?? "")).map((f) => f.value / checks.levels(m, f.metric).fail);
      expect([g.speed, fps, Math.max(0, ...legs) <= 0.85, r.verdict === "fail"]).toEqual([g.speed, fps, true, false]);
    }
    expect([g4.speed, g80.speed]).toEqual([338, 331]);
  }, 30_000);
  it("gaits at a run's shortest cycle keep a knee's pop within the clip under the fail level, where it reads the most (recorded)", () => {
    // climbing on fitted runs at 0.6 s near the reach bound, round 14's second pass's review read a knee popping within
    // the clip at 91.1% of the fail level, plainly and by parts alike: M2M_ANIMATED's rest, fitted to 377 asked any speed
    // over it, at 73.333 frames a second (44 frames; the right knee at 0.545 s). It is past the 90% every bound keeps and
    // under the fail level, recorded rather than bounded (D71; gait.ts's MIN_RUN_CYCLE): this holds it under the fail
    // level, so a change that pushes it over shows
    const rest = sourceRest("MESH2MOTION", "M2M_ANIMATED");
    const g = PR.fitGait({ name: "g", about: "a run", cycle: 0.6, stance: 0.415, limp: 0, lift: 10.246, bounce: 1.12, dip: 6.819, sway: 2.833, lean: 3.407, swing: 62.979, speed: 1000 }, rest);
    expect(g.speed).toBe(377);
    for (const parts of [false, true]) {
      const m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "M2M_ANIMATED", fps: 73.333 }), rest);
      m.parts = parts;
      const r = checks.measure(m), knees = r.findings.filter((f) => f.metric === "pop" && /^knee[LR]$/.test(f.where ?? "")).map((f) => f.value / checks.levels(m, "pop").fail);
      expect([parts, Math.max(0, ...knees) < 1, r.verdict === "fail"]).toEqual([parts, true, false]);
    }
  }, 30_000);
  it("gaits keep their hands from turning round on the loop's seam past the bound: fitted, read by parts", async () => {
    // the arms turn round on the seam (as each foot lands): test character 9 swinging 69° in 0.527 s read seamVelocity@fist
    // at 98% of the fail level at 75 frames a second by parts (round 10's review), and its swing of 72.7° in 0.546 s, and
    // test character 21's limp swinging 68.3° in 0.628 s (173° for each second squared, under ARM_TURN), failed at 103%
    // (round 11's searches): their arms are short for their hip height, so read by parts the swing's turn counts for more,
    // and the chest turned a whole degree on the seam's frame alone, the pelvis's whole-% steps and the arm's own rounding
    // there add to it. Each is refused on its body and fitGait narrows its swing to the widest whole swing at which it and
    // every narrower one play (each swing's own reading rises and falls with it, round 11's 54, 61 and 64 read each swing
    // alone). Test character 9's two runs swung 0.26 and 0.27 s, refused since round 14: at the shortest swing taken now
    // (0.6 and 0.62 s at a stance of a half, at the speed its legs take) swinging 76 and 80 they are refused so too, and
    // narrowed to 73° and 78°; test character 21's limp to 60°
    const r9 = await characterRest(9), r21 = await characterRest(21);
    const gaits = [[r9, { cycle: 0.6, stance: 0.5, lift: 9, bounce: 0.55, dip: 7.303, sway: 0.128, lean: -8.432, swing: 76, speed: 309 }, 75], [r9, { cycle: 0.62, stance: 0.5, lift: 9, bounce: 0.55, dip: 7.303, sway: 0.128, lean: -8.432, swing: 80, speed: 302 }, 60], [r21, { cycle: 0.628, stance: 0.314, limp: 1, lift: 10.746, bounce: 0.527, dip: 10.511, sway: 2.632, lean: 4.78, swing: 68.331, speed: 324 }, 72.5]] as const;
    const swings: number[] = [];
    for (const [rest, g0, fps] of gaits) {
      const g = { name: "g", about: "a gait", ...g0 };
      expect(() => PR.gaitClip(g, rest, { restSrc: "x", fps })).toThrow(/hand turns round on the loop's seam .* its arms play swinging any whole number of degrees up to \d+ either way; narrow its swing so \(fitGait does\)/);
      const f = PR.fitGait(g, rest), m = checks.motionOf(PR.gaitClip(f, rest, { restSrc: "x", fps }), rest);
      m.parts = true;
      const r = checks.measure(m);
      swings.push(f.swing!);
      expect([f.swing, r.values.seamVelocity <= 0.85 * checks.levels(m, "seamVelocity").fail, r.verdict === "fail"]).toEqual([f.swing, true, false]);
    }
    expect(swings).toEqual([73, 78, 60]);
  }, 30_000);
  it("gaits read no more at their seam than gaitClip's own reading of it, and no more than SEAM_TURN", async () => {
    // gaitClip reads the seam on the keys the clip holds there, as the sensors read them (the pop rule counted
    // conservatively), on every grid of frames 55 to 75 a second give; round 11's model left out the format's rounding and
    // read up to 0.42 of the fail level under the sensors (round 11's review). CMU_144's run fitted (368) at 72.5 frames a
    // second read plainly, and test character 9's run at 62.4, 31's limp at 75 and 19's run fitted (363) at 70 by parts
    // (to a ten-thousandth of the level: the sensors read the clip's points as 32-bit floats, to about 0.1 µm at a
    // metre, and the change of velocity across the seam takes four of them over a 60th of a second). 31's limp swung
    // its right foot 0.26 s in 0.884 s, refused since round 14: in 1.021 s, the shortest swing taken now, 0.3 s
    const cmu144 = sourceRest("CMU_CURATED", "CMU_144"), [r9, r19, r31] = [await characterRest(9), await characterRest(19), await characterRest(31)];
    const cases = [
      [cmu144, { cycle: 0.6, stance: 0.402, limp: 0, lift: 11.002, bounce: 5.603, dip: 8.861, sway: 0.91, lean: -2.158, swing: 12.87, speed: 370.12 }, 72.5, false],
      [r9, { cycle: 0.622, stance: 0.448, limp: 0.003, lift: 12.727, bounce: 4.216, dip: 4.358, sway: 4, lean: 3.069, swing: 20, speed: 116.261 }, 62.397, true],
      [r31, { cycle: 1.021, stance: 0.543, limp: 1, lift: 26.783, bounce: 2.932, dip: 1.07, sway: 3.56, lean: 25, swing: 80, speed: 74.898 }, 75, true],
      [r19, { cycle: 0.609, stance: 0.36, limp: 0.285, lift: 12.058, bounce: 4.134, dip: 7.097, sway: 1.032, lean: 2.161, swing: 20.896, speed: 365.1 }, 70, true],
    ] as const;
    for (const [rest, g0, fps, parts] of cases) {
      const g = PR.fitGait({ name: "g", about: "a gait", ...g0 }, rest), m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "x", fps }), rest), nf = 2 * Math.round((g.cycle * fps) / 2);
      m.parts = parts;
      const seam = legsOf(g, rest, standing(rest), PR.standingOn(rest)).seam, [body, hands] = [seamAt(m, BODY), seamAt(m, HANDS)];
      expect([g.speed, fps, body[0] <= seam.body(nf).share + 1e-4, hands[0] <= seam.hands(g.swing ?? 25, nf).share + 1e-4, Math.max(body[0], hands[0]) <= 0.7 + 1e-4]).toEqual([g.speed, fps, true, true, true]);
    }
  }, 60_000);
  it("gaits keep the pelvis's whole-% steps either side of the seam from jolting a short spine, read by parts", async () => {
    // the pelvis on the format's whole-% grid steps every other frame where it rises or sways about a % a frame, and where
    // a step fell just before the seam and none just after, or across and up at once, a short spine read by parts read
    // up to 94% of the fail level across it (round 11's review: test character 19's run at 70 frames a second, 9's at
    // 62.4, 31's limp at 75: 0.938, 0.925 and 0.875). Where the torso then reads past SEAM_TURN, the pelvis's places about
    // the seam are taken again to change its velocity across it as little as they can (pelvisGrid): test character 2's
    // walk at 75 read 77% there (its pelvis's first step against its second, counted conservatively) and reads 16% now.
    // 31's limp in 1.021 s since round 14 (0.884 s swung its right foot 0.26 s, refused now)
    const [r2, r9, r19, r31] = [await characterRest(2), await characterRest(9), await characterRest(19), await characterRest(31)];
    const cases = [
      [r19, PR.fitGait({ name: "g", about: "a run", cycle: 0.609, stance: 0.36, limp: 0.285, lift: 12.058, bounce: 4.134, dip: 7.097, sway: 1.032, lean: 2.161, swing: 20.896, speed: 365.1 }, r19), 70],
      [r9, { name: "g", about: "a run", cycle: 0.622, stance: 0.448, limp: 0.003, lift: 12.727, bounce: 4.216, dip: 4.358, sway: 4, lean: 3.069, swing: 20, speed: 116.261 }, 62.397],
      [r31, { name: "g", about: "a limp", cycle: 1.021, stance: 0.543, limp: 1, lift: 26.783, bounce: 2.932, dip: 1.07, sway: 3.56, lean: 25, swing: 80, speed: 74.898 }, 75],
      [r2, PR.GAITS[0]!, 75],
    ] as const;
    for (const [rest, g, fps] of cases) {
      const m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "x", fps }), rest);
      m.parts = true;
      const torso = seamAt(m, /^(pelvis|pelvisF|spine1|spine2|chest|chestF|neck|head|headTop|faceF|(clav|sh|hip)[LR])$/);
      expect([fps, torso[0] <= 0.7]).toEqual([fps, true]);
    }
  }, 60_000);
  it("gaits keep the pelvis's whole-% steps the seam's reading moves from popping two frames in, read by parts", async () => {
    // where the pelvis's places about the seam are taken again (pelvisGrid's `seam`), round 12 weighed the seam's
    // reading alone, and the step it moved off the seam two frames in read there as a pop as high as it had at the seam:
    // test character 12's walk at 72.73 frames a second, 0.723 at the seam, 0.779 by the pop rule at its third key, and
    // 9's at 68.48, 0.764 at its third (round 12's review). The steps those frames make or stand beside are now weighed
    // by the pop rule too, and the torso's first and last four steps read no pop at all
    const [r9, r12] = [await characterRest(9), await characterRest(12)];
    const cases = [
      [r12, { cycle: 1.189, stance: 0.557, swing: 35, bounce: 1.444, sway: 2.942, dip: 0.649, lean: 5.376, speed: 145.853 }, 72.73],
      [r9, { cycle: 0.897, stance: 0.657, swing: 35, bounce: 1.613, sway: 1.266, dip: 3.806, lean: 7.549, speed: 149.55 }, 68.481],
    ] as const;
    const TORSO = /^(pelvis|pelvisF|spine1|spine2|chest|chestF|neck|head|headTop|faceF|(clav|sh|hip)[LR])$/;
    for (const [rest, g0, fps] of cases) {
      const m = checks.motionOf(PR.gaitClip({ name: "g", about: "a walk", ...g0 }, rest, { restSrc: "x", fps }), rest);
      m.parts = true;
      const GF = m.grid.frames, GT = m.grid.times, pf = checks.levels(m, "pop").fail, n = GF.length - 1;
      let near = 0;
      format.POINTS.forEach((name, j) => {
        if (!TORSO.test(name)) return;
        const sc = checks.partScale(m, name), v = Array.from({ length: n }, (_, i) => Math.hypot(...[0, 1, 2].map((c) => GF[i + 1]![j * 3 + c]! - GF[i]![j * 3 + c]!)) / (GT[i + 1]! - GT[i]!) / sc);
        for (const i of [1, 2, 3, n - 4, n - 3, n - 2]) {
          const around = Math.max(v[i - 1]!, v[i + 1]!);
          if (v[i]! > 2.5 * around) near = Math.max(near, (v[i]! - around) / pf);
        }
      });
      expect([fps, near, seamAt(m, TORSO)[0] <= 0.7]).toEqual([fps, 0, true]);
    }
    // and the pelvis along is kept at its nearest: taken a whole % either way too, it stepped along, across and up at
    // once (√3 %) where plain rounding never does (round 12's review; test character 14's brisk walk at 75, so taken)
    const r14 = await characterRest(14), c = PR.gaitClip({ name: "g", about: "a brisk walk", speed: 135.038, cycle: 1.208, stance: 0.642, swing: 35, bounce: 2.525, sway: 3.224, dip: 1.664, lean: 0.886 }, r14, { restSrc: "x", fps: 75 });
    const hips = c.keys.map((k) => (k as unknown as { hips: number[] }).hips);
    expect(hips.filter((h, i) => i > 0 && h.every((x, a) => x !== hips[i - 1]![a])).length).toBe(0);
  }, 30_000);
  it("fits a gait's swing so that every narrower whole swing plays too", async () => {
    // test character 9's run at 0.622 s swinging 70 was refused naming 69, which played, but 64 to 68 didn't, and
    // fitGait gave 69 from 70 and 63 from 68 (round 11's review): its hands are read at every whole swing up to its own,
    // and the widest at which all play is named and fitted (52), whatever wider swing is asked for
    const r9 = await characterRest(9), g = { name: "g", about: "a run", cycle: 0.622, stance: 0.448, limp: 0.003, lift: 12.727, bounce: 4.216, dip: 4.358, sway: 4, lean: 3.069, speed: 116.261 };
    expect(() => PR.gaitClip({ ...g, swing: 70 }, r9, { restSrc: "x" })).toThrow(/swinging 53°, narrower than its own swing, .* its arms play swinging any whole number of degrees up to 52 either way/);
    expect([70, 68, 53, 52, 30].map((swing) => PR.fitGait({ ...g, swing }, r9).swing)).toEqual([52, 52, 52, 52, 30]);
    for (const swing of [52, 40]) expect(PR.gaitClip({ ...g, swing }, r9, { restSrc: "x" }).dur).toBe(0.622);
  }, 30_000);
  it("holds core's copies of the sensors' seam levels and typical chains equal to theirs", () => {
    // gaitClip reads its loop's seam with the sensors' levels and a typical person's chains, copied: core imports nothing
    // outside itself
    expect([SEAM_FAIL, POP_FAIL, SEAM_RATE]).toEqual([(checks.THRESHOLDS.seamVelocity.fail * 100) / checks.REFERENCE_H0, (checks.THRESHOLDS.pop.fail * 100) / checks.REFERENCE_H0, checks.THRESHOLDS.seamVelocity.rate]);
    expect(Object.entries(CHAIN).map(([k, v]) => [k, v === checks.TYPICAL_CHAIN[k]])).toEqual(Object.keys(CHAIN).map((k) => [k, true]));
  });
  it("gaits keep the pelvis's whole-% steps from popping a short spine, read by parts", async () => {
    // the pelvis on the format's grid stepped two % in a frame beside still frames (a bob moving about a % a frame, and
    // the clip's first step, read against the one after it): read by parts, on a test character's short pelvis-to-spine,
    // test character 25's spine popped at 109% of the fail level at 75 frames a second (round 9's grid); pelvisGrid takes
    // one end of such a step a % toward the other
    const rest = await characterRest(25), c = PR.gaitClip({ name: "g", about: "a gait", cycle: 0.6, stance: 0.3, lift: 20, bounce: 5.5, dip: 0, sway: 4, lean: -10, swing: 0, limp: 1, speed: 309 }, rest, { restSrc: "GEN25", fps: 75 });
    const m = checks.motionOf(c, rest);
    m.parts = true;
    const r = checks.measure(m);
    expect([r.values.pop <= 0.85 * checks.levels(m, "pop").fail, r.verdict === "fail"]).toEqual([true, false]);
  }, 30_000);
  it("gaits leaning far keep their elbows from popping: read plainly on a library rest and by parts on a test character", async () => {
    // a hand aimed from the torso turned whole, not from the shoulder its key decodes, was past the arm's reach from
    // there through part of the swing: the key held the arm straight, and as it bent again the elbow stepped three times
    // as far as on either side. Quaternius's UAL1 walking leaning 25° and swinging 60 failed pop@elbowL at 109% of the
    // fail level at 75 frames a second, read plainly, and test character 15's fitted run failed pop@elbowL at 105% at 70,
    // read by parts (round 9's review); each hand is aimed from the shoulder its key puts it on (the walk at 0.75 s since
    // round 14, its swing the shortest taken, 0.3 s; it was 0.736 s)
    const ual1 = sourceRest("QUATERNIUS_3D2DGE", "UAL1"), r15 = await characterRest(15);
    const run = PR.fitGait({ name: "g", about: "a run", cycle: 0.711, stance: 0.2, limp: 0.403, lift: 9, bounce: 3, dip: 7.825, sway: 2, lean: 25, swing: 45, speed: 1000 }, r15);
    for (const [rest, g, fps, parts] of [[ual1, { name: "g", about: "a walk", speed: 130, cycle: 0.75, stance: 0.6, lean: 25, swing: 60 }, 75, false], [r15, run, 70, true]] as const) {
      const m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "x", fps }), rest);
      m.parts = parts;
      const r = checks.measure(m), elbows = r.findings.filter((f) => f.metric === "pop" && /^elbow/.test(f.where ?? ""));
      expect([g.speed, fps, elbows, r.values.pop <= 0.85 * checks.levels(m, "pop").fail, r.verdict === "fail"]).toEqual([g.speed, fps, [], true, false]);
    }
  }, 30_000);
  it("fits gaits on short legs so that they play: slower, or at the highest lift some speed plays where none plays at its own", async () => {
    const rest = characterRest;
    // test character 10's legs, lifting 35 under a pelvis dipped 12 and bouncing 6, fold to 24.6% of their length at 63%
    // of the hip height a second and at every speed under it (the verifier's corner grid, a pass then): fitGait lowers
    // the lift a whole % instead, and it plays
    const r10 = await rest(10), g = PR.fitGait({ name: "g", about: "a gait", cycle: 0.65, stance: 0.2, limp: 0.5, lift: 35, bounce: 6, dip: 12, sway: 0, lean: -10, swing: 80, speed: 63 }, r10);
    expect([g.speed, g.lift, metrics(PR.gaitClip(g, r10, { restSrc: "GEN10", fps: 55 }), r10).verdict === "fail"]).toEqual([63, 34, false]);
    // and test character 33's limp from the verifier's random grid: the fold is not quite monotone in the speed, and the
    // halving's whole speed (43) folded a leg, so the speed is taken down until it fits (1 of 7,744 fits on its grids)
    const r33 = await rest(33), h = PR.fitGait({ name: "g", about: "a gait", cycle: 3, stance: 0.6353223501471803, limp: 0.984651219798252, lift: 33.778545876499265, bounce: 1.541428820695728, dip: 9.256668255664408, sway: 2.994950328953564, lean: 0.9756551228929311, swing: 7.215953636914492, speed: 1000 }, r33);
    expect([h.speed, metrics(PR.gaitClip(h, r33, { restSrc: "GEN33" }), r33).verdict === "fail"]).toEqual([42, false]);
    // and test character 25's limp lifting 35 at a stance of 0.2: no speed plays lifting 35 (its legs fold), and fitGait
    // gave back the reach bound's 333 lifting 35, refused, though a slower speed lifting less plays (round 8's review);
    // then the fastest speed at which any lower lift played, 328 lifting 9, though asking 34 played at 215 lifting 34
    // (round 12's review): it takes the highest whole lift at which some speed plays, at the fastest speed there, so a
    // higher lift asked for is never fitted lower; the refusals name both
    const r25 = await rest(25), limp25 = { name: "g", about: "a gait", cycle: 0.759, stance: 0.2, limp: 1, lift: 35, bounce: 6, dip: 12, speed: 1000 }, j = PR.fitGait(limp25, r25);
    expect([j.speed, j.lift, metrics(PR.gaitClip(j, r25, { restSrc: "GEN25" }), r25).verdict === "fail"]).toEqual([215, 34, false]);
    expect([9, 12, 20, 30, 34, 35].map((lift) => PR.fitGait({ ...limp25, lift }, r25).lift)).toEqual([9, 12, 20, 30, 34, 34]);
    expect(() => PR.gaitClip(limp25, r25, { restSrc: "GEN25" })).toThrow(/reach 215\.7% of a leg .* past 72%: on these legs, at this cycle and stance, it plays at no speed lifting 35% of the hip height, and at 215% of the hip height a second \(\d+ mm\/s\) lifting 34%; slow it and lower its lift so \(fitGait does\), or shorten its cycle or stance$/);
    // and where a gait's own lift plays only between two speeds (slower, the lifted foot passes under the hips at the top
    // of its lift and the leg folds too), the halving found none at half its speed and below, so fitGait lowered the lift
    // and the refusal said it played at no speed lifting 35 (round 9's review; round 9's own test held test character
    // 25's at 320 so: 303 lifting 9, where 177 to 209 play lifting 35): where the halving finds none, each whole speed
    // down is tried. Test character 25's, and test character 15's limp at 204 (109 to 157 play)
    expect(() => PR.gaitClip({ name: "g", about: "a gait", cycle: 0.868, stance: 0.2, limp: 0.5, lift: 35, bounce: 6, dip: 12, speed: 320 }, r25, { restSrc: "GEN25" })).toThrow(/reach 74\.3% of a leg .* past 72%: on these legs, at this cycle and stance, it plays at 209% of the hip height a second \(\d+ mm\/s\); slow it so \(fitGait does\), or shorten its cycle or stance$/);
    const r15 = await rest(15), n = { name: "g", about: "a limp", stance: 0.21, limp: 1, lift: 35, cycle: 1.111, bounce: 5.502, dip: 12, sway: 4, speed: 204 }, k = PR.fitGait(n, r15);
    expect([k.speed, k.lift, metrics(PR.gaitClip(k, r15, { restSrc: "GEN15" }), r15).verdict === "fail"]).toEqual([157, 35, false]);
    expect(() => PR.gaitClip(n, r15, { restSrc: "GEN15" })).toThrow(/comes within 11\.1% of a leg of its hip, .*; on these legs, at this cycle and stance, it plays at 157% of the hip height a second \(\d+ mm\/s\); slow it so \(fitGait does\)/);
  }, 30_000);
  it("fits a gait to the fastest whole speed it plays at, so a faster speed asked is never fitted slower", async () => {
    // test character 1's limping run lifting 35: a leg's fold isn't monotone in the speed, and it plays at 215 and 217 but
    // not at 216 nor from 218 up to its reach's bound (368), so the halving stopped at 215: asking 218 to 368 fitted 215,
    // and asking 217 or 222 fitted 217 (round 13's review). fitGait now tries each whole speed above the halving's up to
    // its own (the reach, fold and knee first, the seam only where they fit) and takes the fastest that plays
    const r1 = await characterRest(1), g = { name: "g", about: "a limping run", cycle: 0.831, stance: 0.407, limp: 0.934, lift: 35, bounce: 1.435, dip: 6.432, sway: 2.357, lean: 2.853, swing: 13.608 };
    expect([214, 215, 216, 217, 218, 222, 300, 368, 1000].map((speed) => PR.fitGait({ ...g, speed }, r1).speed)).toEqual([214, 215, 215, 217, 217, 217, 217, 217, 217]);
    for (const fps of [55, 60, 75]) {
      const m = checks.motionOf(PR.gaitClip({ ...g, speed: 217 }, r1, { restSrc: "GEN1", fps }), r1);
      m.parts = true;
      expect([fps, checks.measure(m).verdict === "fail"]).toEqual([fps, false]);
    }
  }, 30_000);
  it("gaits lift and set their feet down without a hitch: the verifier's round-7 cases pass on the three rests", () => {
    // a run lifting 35 whose left foot starts its arc on the seam (at 60 frames a second the foot's height turned from
    // still to 9.6 m/s there: seam velocity 4.1 to 4.8 m/s); short swings just over a stance of a half lifting 30 and 35,
    // at 55, the fewest frames a second taken (at 50 their knees popped where the arc rose infinitely steeply; with the
    // arc mended these pass there too, but 7 of the verifier's 456 on 19 rests didn't; they swung 0.26 s, and swing the
    // shortest taken since round 14, 0.3 s, near the three rests' reach, 301 to 320); and a long stance bouncing 6 at 75,
    // the most taken (at 110 a knee popped on the pelvis's whole-% steps)
    for (const [g, fps] of [[{ speed: 250, cycle: 0.727, stance: 0.39, lift: 35 }, 60], [{ speed: 300, cycle: 0.625, stance: 0.52, lift: 30 }, 55], [{ speed: 300, cycle: 0.625, stance: 0.52, lift: 35 }, 55], [{ speed: 77, cycle: 1.2, stance: 0.75, bounce: 6 }, 75]] as const)
      for (const [id, { rest, restSrc }] of RESTS) {
        const r = metrics(PR.gaitClip({ name: "g", about: "a gait", ...g }, rest, { restSrc, fps }), rest);
        expect([id, g, fps, r.verdict === "fail", r.values.seamVelocity < 2750]).toEqual([id, g, fps, false, true]);
      }
  }, 60_000);
  it("gaits close their loops off the frame grid, and with the knees swung widest, on the three rests", () => {
    // a run of 0.705 s and a walk of 1.102 s, off the 60 fps grid, and a run lifting 35% and swaying 4%: their knees'
    // turn stepped at the seam, in a gap of a few ms off the grid, and popped (the verifier's round 3)
    const [walk, , run] = PR.GAITS;
    for (const [id, { rest, restSrc }] of RESTS)
      for (const g of [{ ...run!, cycle: 0.705 }, { ...walk!, cycle: 1.102 }, { ...run!, lift: 35, sway: 4 }]) {
        const r = metrics(PR.gaitClip(g, rest, { restSrc }), rest);
        expect([id, g, r.verdict, r.values.slide <= 10]).toEqual([id, g, "pass", true]);
      }
  }, 60_000);
  it("makes a gait, an idle and a move on a body measured without collarbones", async () => {
    // test character 3 leaves its shoulder bones out (seed % 6 == 3): its rest's collarbones are 0 mm long, and each
    // source made a NaN as the encoder took a shrug's elevation as 0 / 0 (the verifier's round 7); now it shrugs nothing,
    // as the decoder places it
    const { glb } = character(variant(3)), rest = bind((await loadGlb(glb, { textures: false })).scene).core.rest, restSrc = "GEN3";
    expect([rest.cv.L, rest.cv.R]).toEqual([[0, 0, 0], [0, 0, 0]]);
    const clips = [PR.gaitClip(PR.fitGait(PR.GAITS[0]!, rest), rest, { restSrc }), PR.idleClip(PR.IDLES[0]!, rest, { restSrc }), PR.moveClip(MOVES.find((m) => m.name === "jab")!, rest, { restSrc })];
    for (const c of clips) {
      const r = metrics(c, rest);
      expect([c.id, validate(c).errors, r.values.nan, (c.keys[0] as unknown as { shL: number[] }).shL, r.verdict === "fail"]).toEqual([c.id, [], 0, [0, 0], false]);
    }
  }, 30_000);
  it("idles pass on the three rests, their feet still", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const i of PR.IDLES) {
        const r = metrics(PR.idleClip(i, rest, { restSrc }), rest);
        expect([id, i.name, r.verdict, r.values.slide <= 5]).toEqual([id, i.name, "pass", true]);
      }
    }
  }, 30_000);
  it("moves are valid, and fail no more than D71 lists, for its reasons: at least 23 of 31 pass or warn on each of the three rests", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      let fails = 0;
      for (const m of MOVES) {
        const c = PR.moveClip(m, rest, { restSrc });
        expect([m.name, validate(c).errors]).toEqual([m.name, []]);
        const r = metrics(c, rest);
        if (r.verdict !== "fail") continue;
        fails++;
        const known = KNOWN_FAILS[m.name]?.[0], why = r.findings.filter((f) => f.level === "fail").map((f) => `${f.metric}@${f.where}`);
        expect([id, m.name, why.filter((w) => !known?.test(w))]).toEqual([id, m.name, []]);
      }
      expect(MOVES.length - fails).toBeGreaterThanOrEqual(23);
    }
  }, 60_000);
});
