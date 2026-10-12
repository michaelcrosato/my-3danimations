// Procedural clips under the sensors (WP-6.2, D71), on three rests (Mesh2Motion, 100STYLE, CMU): the gaits slide at
// most 10 mm per contact and none fails, their loops closing off the frame grid too; the idles pass; and the moves hold their floor, none failing but those D71
// lists and for the reasons it gives (the hand or arm about two of its widths into the body where the source's arcs,
// drawn for a stick figure, cross it; knee and elbow pops; a two-handed grip's off arm flipping round), so a move that
// starts failing, or fails for another reason, shows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, procedural as PR, validate, type Rest } from "@m3a/core";
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
    // 13.5 mm, D71), and those that slide most when a foot is let go of where it landed (the verifier's mutants: as it
    // sets down, 10.7 to 11.9; with no second pass, 7.2 to 9.0; as it lifts off, 11.0)
    for (const [id, g, bar] of [
      ["MESH2MOTION/Idle_A", { speed: 100, cycle: 1, stance: 0.6 }, 10],
      ["STYLE100/Neutral_Walk", { speed: 60, cycle: 1.3, stance: 0.58, limp: 0.2 }, 10],
      ["STYLE100/Neutral_Walk", { speed: 160, cycle: 0.9, stance: 0.6 }, 10],
      ["CMU_CURATED/Walk_Loop", { speed: 180, cycle: 1, stance: 0.6 }, 10],
      ["STYLE100/Neutral_Walk", { speed: 140, cycle: 1.1, stance: 0.65 }, 8],
      ["MESH2MOTION/Idle_A", { speed: 120, cycle: 1.3, stance: 0.58, limp: 1 }, 7],
      ["STYLE100/Neutral_Walk", { speed: 100, cycle: 0.9, stance: 0.55 }, 7],
      ["MESH2MOTION/Idle_A", { speed: 140, cycle: 0.9, stance: 0.65 }, 5],
      ["STYLE100/Neutral_Walk", { speed: 60, cycle: 1.3, stance: 0.7, limp: 0.4 }, 9],
      // swings of 0.25 s, the shortest taken: their feet lift off quicker to clear the height a lifted foot is read at
      // (lifting off as a longer swing does, swings of 0.2 s slid 500 to 690 mm: the verifier's round 3)
      ["STYLE100/Neutral_Walk", { speed: 140, cycle: 0.625, stance: 0.6 }, 12],
      ["STYLE100/Neutral_Walk", { speed: 50, cycle: 1.44, stance: 0.7, limp: 0.6 }, 8],
    ] as const) {
      const { rest, restSrc } = RESTS.find(([x]) => x === id)![1], r = metrics(PR.gaitClip({ name: "g", about: "a gait", ...g }, rest, { restSrc }), rest);
      expect([id, g, r.values.slide <= bar, r.verdict === "fail"]).toEqual([id, g, true, false]);
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
