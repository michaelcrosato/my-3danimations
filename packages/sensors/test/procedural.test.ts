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
      ["STYLE100/Neutral_Walk", { speed: 60, cycle: 1.3, stance: 0.7, limp: 0.4 }, 9],
      // swings of 0.26 s, the shortest taken: their feet lift off quicker to clear the height a lifted foot is read at
      // (lifting off as a longer swing does, swings of 0.2 s slid 500 to 690 mm: the verifier's round 3)
      ["STYLE100/Neutral_Walk", { speed: 140, cycle: 0.65, stance: 0.6 }, 8],
      ["STYLE100/Neutral_Walk", { speed: 50, cycle: 1.5, stance: 0.7, limp: 0.6 }, 10],
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
      for (const [cycle, stance, lift] of [[0.52, 0.5, 12], [0.6, 0.5, 25], [0.75, 0.5, 12], [0.7, 0.35, 25]] as const) {
        const g = PR.fitGait({ name: "g", about: "a gait", cycle, stance, lift, bounce: 6, speed: 1000 }, rest), c = PR.gaitClip(g, rest, { restSrc });
        expect([id, g, longest(rest, c).most <= 0.985, metrics(c, rest).verdict === "fail"]).toEqual([id, g, true, false]);
      }
    }
    // the verifier's case: lowered for the stance's ends alone it popped a knee (3.6 m/s, a leg at 99.7%)
    const { rest, restSrc } = RESTS[0]![1];
    expect(metrics(PR.gaitClip({ name: "g", about: "a gait", speed: 375, cycle: 0.52, stance: 0.5, bounce: 6 }, rest, { restSrc }), rest).verdict).not.toBe("fail");
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
    // read by parts (round 9's review); each hand is aimed from the shoulder its key puts it on
    const ual1 = sourceRest("QUATERNIUS_3D2DGE", "UAL1"), r15 = await characterRest(15);
    const run = PR.fitGait({ name: "g", about: "a run", cycle: 0.711, stance: 0.2, limp: 0.403, lift: 9, bounce: 3, dip: 7.825, sway: 2, lean: 25, swing: 45, speed: 1000 }, r15);
    for (const [rest, g, fps, parts] of [[ual1, { name: "g", about: "a walk", speed: 130, cycle: 0.736, stance: 0.6, lean: 25, swing: 60 }, 75, false], [r15, run, 70, true]] as const) {
      const m = checks.motionOf(PR.gaitClip(g, rest, { restSrc: "x", fps }), rest);
      m.parts = parts;
      const r = checks.measure(m), elbows = r.findings.filter((f) => f.metric === "pop" && /^elbow/.test(f.where ?? ""));
      expect([g.speed, fps, elbows, r.values.pop <= 0.85 * checks.levels(m, "pop").fail, r.verdict === "fail"]).toEqual([g.speed, fps, [], true, false]);
    }
  }, 30_000);
  it("fits gaits on short legs so that they play: slower, or lifting less where no slower speed keeps a leg from folding", async () => {
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
    // gave back the reach bound's 333 lifting 35, refused, though a slower speed lifting less plays (round 8's review):
    // it takes the fastest speed at which a lower lift plays, with the highest lift there; the refusals name both
    const r25 = await rest(25), limp25 = { name: "g", about: "a gait", cycle: 0.759, stance: 0.2, limp: 1, lift: 35, bounce: 6, dip: 12, speed: 1000 }, j = PR.fitGait(limp25, r25);
    expect([j.speed, j.lift, metrics(PR.gaitClip(j, r25, { restSrc: "GEN25" }), r25).verdict === "fail"]).toEqual([328, 9, false]);
    expect(() => PR.gaitClip(limp25, r25, { restSrc: "GEN25" })).toThrow(/reach 215\.7% of a leg .* past 72%: on these legs, at this cycle and stance, it plays at no speed lifting 35% of the hip height, and at most 328% of the hip height a second \(\d+ mm\/s\) lifting 9%; slow it and lower its lift \(fitGait does\), or shorten its cycle or stance$/);
    // and where a gait's own lift plays only between two speeds (slower, the lifted foot passes under the hips at the top
    // of its lift and the leg folds too), the halving found none at half its speed and below, so fitGait lowered the lift
    // and the refusal said it played at no speed lifting 35 (round 9's review; round 9's own test held test character
    // 25's at 320 so: 303 lifting 9, where 177 to 209 play lifting 35): where the halving finds none, each whole speed
    // down is tried. Test character 25's, and test character 15's limp at 204 (109 to 157 play)
    expect(() => PR.gaitClip({ name: "g", about: "a gait", cycle: 0.868, stance: 0.2, limp: 0.5, lift: 35, bounce: 6, dip: 12, speed: 320 }, r25, { restSrc: "GEN25" })).toThrow(/reach 74\.3% of a leg .* past 72%: on these legs, at this cycle and stance, it goes at most 209% of the hip height a second \(\d+ mm\/s\); slow it \(fitGait does\), or shorten its cycle or stance$/);
    const r15 = await rest(15), n = { name: "g", about: "a limp", stance: 0.21, limp: 1, lift: 35, cycle: 1.111, bounce: 5.502, dip: 12, sway: 4, speed: 204 }, k = PR.fitGait(n, r15);
    expect([k.speed, k.lift, metrics(PR.gaitClip(k, r15, { restSrc: "GEN15" }), r15).verdict === "fail"]).toEqual([157, 35, false]);
    expect(() => PR.gaitClip(n, r15, { restSrc: "GEN15" })).toThrow(/comes within 11\.1% of a leg of its hip, .*; on these legs, at this cycle and stance, it goes at most 157% of the hip height a second \(\d+ mm\/s\); slow it \(fitGait does\)/);
  }, 30_000);
  it("gaits lift and set their feet down without a hitch: the verifier's round-7 cases pass on the three rests", () => {
    // a run lifting 35 whose left foot starts its arc on the seam (at 60 frames a second the foot's height turned from
    // still to 9.6 m/s there: seam velocity 4.1 to 4.8 m/s); short swings just over a stance of a half lifting 30 and 35,
    // at 55, the fewest frames a second taken (at 50 their knees popped where the arc rose infinitely steeply; with the
    // arc mended these pass there too, but 7 of the verifier's 456 on 19 rests didn't); and a long stance bouncing 6 at
    // 75, the most taken (at 110 a knee popped on the pelvis's whole-% steps)
    for (const [g, fps] of [[{ speed: 250, cycle: 0.727, stance: 0.39, lift: 35 }, 60], [{ speed: 283, cycle: 0.542, stance: 0.52, lift: 30 }, 55], [{ speed: 276, cycle: 0.542, stance: 0.52, lift: 35 }, 55], [{ speed: 77, cycle: 1.2, stance: 0.75, bounce: 6 }, 75]] as const)
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
