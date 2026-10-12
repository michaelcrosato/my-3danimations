// B4's grader (WP-6.6's Done-when): it passes the known-good sneaker and fails each planted bad one, naming the check it
// broke, on the default avatar (gen-40, a VRM-named chibi outside WP-4.2's set) and, in T2, on gen-44 (a tall one with
// twist bones). The planted sneakers are the known-good one edited: an upright walk, a crouch that doesn't travel, a
// sneak moved at its own pace by the game (skating), a bone gone NaN.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { gradeB4 } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), good = readFileSync(join(import.meta.dirname, "known-good/src/sneak.ts"), "utf8");
/** The known-good sneaker with one edit, which must take. */
const planted = (from: string, to: string) => {
  if (!good.includes(from)) throw new Error(`the planted edit's text isn't in the known-good sneaker: ${from}`);
  return good.replace(from, to);
};
const BAD: Record<string, { sneak: string; fails: string }> = {
  "upright": { sneak: planted('"MESH2MOTION/Crouch_Walk"', '"QUATERNIUS_3D2DGE/Walk_Loop"'), fails: "it sneaks" },
  "in place": { sneak: planted('"MESH2MOTION/Crouch_Walk"', '"MESH2MOTION/Crouch_Idle"'), fails: "it sneaks" },
  "skates": { sneak: planted("character.position.z += player.moved.forward / 1000;", "character.position.z += (3 * player.moved.forward) / 1000;"), fails: "a foot stands still" },
  "a bone gone NaN": { sneak: planted("player.update(dt);", "player.update(dt);\n      if (player.animator.time > 3) bound.bones[0]!.position.x = Number.NaN;"), fails: "finite" },
};
/** Grades a sneaker in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, sneak: string, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `B4-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B4"), character, files: { "src/sneak.ts": sneak } });
  return gradeB4(dir);
}
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B4's grader", () => {
  // T1 grades on gen-40; T2 (M3A_FULL=1) on gen-44 too (D74)
  for (const character of (process.env.M3A_FULL === "1" ? [{ seed: 40 }, { seed: 44 }] : [{ seed: 40 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good sneaker on ${who}, and fails each planted bad one, naming the check it broke`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
      for (const [name, bad] of Object.entries(BAD)) {
        const b = await grade(name, bad.sneak, character);
        expect(b.pass, `${name}\n${text(b)}`).toBe(false);
        expect(b.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(b)}`).toBe(true);
      }
    }, 300_000);
  }
});
