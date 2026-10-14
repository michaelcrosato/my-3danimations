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
import { metrics } from "../src/index.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
const MOVES = (JSON.parse(readFileSync(join(ROOT, "library/moves.json"), "utf8")) as { moves: PR.Move[] }).moves;
/** A library clip's rest and its source entry. */
function restOf(id: string): { rest: Rest; restSrc: string } {
  const [set, slug] = id.split("/") as [string, string], clip = parseClip(readFileSync(join(LIB, set, `${slug}.json`), "utf8"));
  const manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
  return { rest: manifest.sources[clip.restSrc]!.rest, restSrc: clip.restSrc };
}
const RESTS = ["MESH2MOTION/Idle_A", "STYLE100/Neutral_Walk", "CMU_CURATED/Walk_Loop"].map((id) => [id, restOf(id)] as const);
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
  it("gaits at the reach bound with a bounce keep every leg bent: at most 99% of its length as the clip holds it, and none fails", () => {
    // a stance of a half at its fastest (fitGait: the reach bound), bouncing 6% twice a cycle while a foot reaches far
    // ahead: the pelvis lowered for the stance's ends alone drove a leg to 99.7% and its knee popped (D71, round 6); the
    // pelvis is lowered until none passes 98.5% at any phase, its bounce, sway and rounding to the format's grid counted
    for (const [id, { rest, restSrc }] of RESTS) {
      const S = new Float32Array(format.P * 3);
      format.decodePose(rest, PR.standingOn(rest) as never, S);
      const b = PR.bodyOf(rest, S), leg = b.legUpper + b.legLower, X = new Float32Array(format.P * 3), at = (n: string) => [0, 1, 2].map((i) => X[format.IDX[n]! * 3 + i]!);
      for (const [cycle, stance, lift] of [[0.52, 0.5, 12], [0.6, 0.5, 25], [0.75, 0.5, 12], [0.7, 0.35, 25]] as const) {
        const g = PR.fitGait({ name: "g", about: "a gait", cycle, stance, lift, bounce: 6, speed: 1000 }, rest), c = PR.gaitClip(g, rest, { restSrc });
        let most = 0;
        for (let i = 0; i <= 240; i++) {
          format.decodePose(rest, format.keyAt(c, (i / 240) * c.dur) as never, X);
          for (const s of ["L", "R"]) most = Math.max(most, Math.hypot(...at(`hip${s}`).map((v, k) => v - at(`ankle${s}`)[k]!)) / leg);
        }
        expect([id, g, most <= 0.99, metrics(c, rest).verdict === "fail"]).toEqual([id, g, true, false]);
      }
    }
    // the verifier's case: lowered for the stance's ends alone it popped a knee (3.6 m/s, a leg at 99.7%)
    const { rest, restSrc } = RESTS[0]![1];
    expect(metrics(PR.gaitClip({ name: "g", about: "a gait", speed: 375, cycle: 0.52, stance: 0.5, bounce: 6 }, rest, { restSrc }), rest).verdict).not.toBe("fail");
  }, 60_000);
  it("gaits lift and set their feet down without a hitch: the verifier's round-7 cases pass on the three rests", () => {
    // a run lifting 35 whose left foot starts its arc on the seam (at 60 frames a second the foot's height turned from
    // still to 9.6 m/s there: seam velocity 4.1 to 4.8 m/s); short swings just over a stance of a half lifting 30 and 35,
    // at 55, the fewest frames a second taken (at 50 their knees popped where the arc rose infinitely steeply; with the
    // arc mended these pass there too, but 7 of the verifier's 456 on 19 rests didn't); and a long stance bouncing 6 at
    // 90, the most taken (at 110 a knee popped on the pelvis's whole-% steps)
    for (const [g, fps] of [[{ speed: 250, cycle: 0.727, stance: 0.39, lift: 35 }, 60], [{ speed: 283, cycle: 0.542, stance: 0.52, lift: 30 }, 55], [{ speed: 276, cycle: 0.542, stance: 0.52, lift: 35 }, 55], [{ speed: 77, cycle: 1.2, stance: 0.75, bounce: 6 }, 90]] as const)
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
