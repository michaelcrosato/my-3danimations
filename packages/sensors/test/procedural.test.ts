// Procedural clips under the sensors (WP-6.2, D71), on three rests (Mesh2Motion, 100STYLE, CMU): the gaits slide at
// most 10 mm per contact and none fails; the idles pass; and the moves hold their floor, none failing but those D71
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
  it("gaits slide at most 10 mm per contact, and none fails, on every rest", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const g of PR.GAITS) {
        const c = PR.gaitClip(g, rest, { restSrc }), r = metrics(c, rest);
        expect([id, g.name, r.values.slide <= 10, r.verdict === "fail"]).toEqual([id, g.name, true, false]);
      }
    }
    // and the four gaits off the presets that slid most when a foot lifted off lower (12.5 to 13.5 mm, D71)
    for (const [id, g] of [
      ["MESH2MOTION/Idle_A", { speed: 100, cycle: 1, stance: 0.6 }],
      ["STYLE100/Neutral_Walk", { speed: 60, cycle: 1.3, stance: 0.58, limp: 0.2 }],
      ["STYLE100/Neutral_Walk", { speed: 160, cycle: 0.9, stance: 0.6 }],
      ["CMU_CURATED/Walk_Loop", { speed: 180, cycle: 1, stance: 0.6 }],
    ] as const) {
      const { rest, restSrc } = RESTS.find(([x]) => x === id)![1], r = metrics(PR.gaitClip({ name: "g", about: "a gait", ...g }, rest, { restSrc }), rest);
      expect([id, g, r.values.slide <= 10, r.verdict === "fail"]).toEqual([id, g, true, false]);
    }
  }, 30_000);
  it("idles pass on every rest, their feet still", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const i of PR.IDLES) {
        const r = metrics(PR.idleClip(i, rest, { restSrc }), rest);
        expect([id, i.name, r.verdict, r.values.slide <= 5]).toEqual([id, i.name, "pass", true]);
      }
    }
  }, 30_000);
  it("moves are valid, and fail no more than D71 lists, for its reasons: at least 23 of 31 pass or warn on every rest", () => {
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
