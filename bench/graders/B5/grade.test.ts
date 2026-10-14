// B5's grader (WP-6.6's Done-when): it passes the known-good recipe and fails each planted bad one, naming the check it
// broke, on the default character (gen-1) and, in T2, on gen-37 (the made clip is graded on its own rest and played on
// the character). The planted recipes are the known-good one edited: no hop, one hand, 2 s, not looping, a clip the
// CC0 library doesn't have.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { gradeB5 } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), good = readFileSync(join(import.meta.dirname, "known-good/emote.json"), "utf8");
/** The known-good recipe with one edit, which must take. */
const planted = (from: string, to: string) => {
  if (!good.includes(from)) throw new Error(`the planted edit's text isn't in the known-good recipe: ${from}`);
  return good.replace(from, to);
};
const BAD: Record<string, { recipe: string; fails: string }> = {
  "no hop": { recipe: planted('"id": "MESH2MOTION/Victory"', '"id": "MESH2MOTION/Cheering_Two_Hands"'), fails: "its description reports a hop" },
  "one hand": { recipe: planted('"id": "MESH2MOTION/Help_Two_Arms"', '"id": "MESH2MOTION/Help_One_Arm"'), fails: "both hands above the head" },
  "2 s": { recipe: planted('"dur": 1.5', '"dur": 2'), fails: "1.5 s, looping" },
  "not looping": { recipe: planted('"id": "MESH2MOTION/Victory", "loop": 0.2,', '"id": "MESH2MOTION/Victory",'), fails: "1.5 s, looping" },
  "a clip not in the CC0 library": { recipe: planted('"id": "MESH2MOTION/Help_Two_Arms"', '"id": "MESH2MOTION/Help_Both_Arms"'), fails: "it compiles" },
};
/** Grades a recipe in a workspace inside the repository. */
async function grade(name: string, recipe: string, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `B5-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B5"), character, files: { "emote.json": recipe } });
  return gradeB5(dir);
}
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B5's grader", () => {
  // T1 grades on gen-1; T2 (M3A_FULL=1) on gen-37 too (D74)
  for (const character of (process.env.M3A_FULL === "1" ? [{ seed: 1 }, { seed: 37 }] : [{ seed: 1 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good recipe on ${who}, and fails each planted bad one, naming the check it broke`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
      for (const [name, bad] of Object.entries(BAD)) {
        const b = await grade(name, bad.recipe, character);
        expect(b.pass, `${name}\n${text(b)}`).toBe(false);
        expect(b.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(b)}`).toBe(true);
      }
    }, 120_000);
  }
});
