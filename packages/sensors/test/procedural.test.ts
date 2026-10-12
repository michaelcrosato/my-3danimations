// Procedural clips under the sensors (WP-6.2, D71), on three rests (Mesh2Motion, 100STYLE, CMU): the gaits slide at
// most 10 mm per contact and none fails; the idles pass; and the moves hold their floor, none failing but those D71
// lists (a forearm a couple of mm into the body where the source's arcs, drawn for a stick figure, cross it, and
// three pops), so a change that breaks another shows.
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
/** The moves D71 lists as failing on some rest, and why. */
const KNOWN_FAILS: Record<string, string> = {
  slash: "the forearm 2 mm into the pelvis as the low arc crosses it",
  backslash: "the upper arm 2 mm into the chest at the start of the backhand",
  plunge: "the forearm 2 mm into the hips as the blade drives down",
  twohand: "the off hand's elbow pops as the two-handed grip swings over",
  haymaker: "the lead knee pops as the wide swing steps in",
  bash: "the forearm 2 mm into the chest as the shield arm comes across",
  stir: "the forearm 2 mm into the chest on the near side of the circle",
  stir_back: "the forearm 2 mm into the hips on the near side of the circle",
};

describe("procedural clips under the sensors", () => {
  it("gaits slide at most 10 mm per contact, and none fails, on every rest", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const g of PR.GAITS) {
        const c = PR.gaitClip(g, rest, { restSrc }), r = metrics(c, rest);
        expect([id, g.name, r.values.slide <= 10, r.verdict === "fail"]).toEqual([id, g.name, true, false]);
      }
    }
  });
  it("idles pass on every rest, their feet still", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      for (const i of PR.IDLES) {
        const r = metrics(PR.idleClip(i, rest, { restSrc }), rest);
        expect([id, i.name, r.verdict, r.values.slide <= 5]).toEqual([id, i.name, "pass", true]);
      }
    }
  });
  it("moves are valid, and fail no more than D71 lists: at least 23 of 31 pass or warn on every rest", () => {
    for (const [id, { rest, restSrc }] of RESTS) {
      const fails: string[] = [];
      for (const m of MOVES) {
        const c = PR.moveClip(m, rest, { restSrc });
        expect([m.name, validate(c).errors]).toEqual([m.name, []]);
        if (metrics(c, rest).verdict === "fail") fails.push(m.name);
      }
      expect([id, fails.filter((n) => !Object.hasOwn(KNOWN_FAILS, n))]).toEqual([id, []]);
      expect(MOVES.length - fails.length).toBeGreaterThanOrEqual(23);
    }
  });
});
