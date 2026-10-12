// B1's grader (WP-4.7's Done-when): it passes the known-good solution and fails each planted bad one, with the check it
// broke, on the default character (gen-1, of WP-4.2's set) and, in T2's full step (M3A_FULL=1, D74), on a generator
// seed outside it (gen-37). The planted
// solutions are the known-good one edited: never running, skating (moving at the asked speed with walk and run at
// their own rate), a bone gone NaN, no sheet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import { gradeB1, type Grade } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), GOOD = join(import.meta.dirname, "known-good/src");
const good = { player: readFileSync(join(GOOD, "player.ts"), "utf8"), sheet: readFileSync(join(GOOD, "sheet.ts"), "utf8") };
/** The known-good solution with one edit, which must take. */
const planted = (from: string, to: string, file: "player" | "sheet" = "player") => {
  if (!good[file].includes(from)) throw new Error(`the planted edit's text isn't in the known-good ${file}: ${from}`);
  return { ...good, [file]: good[file].replace(from, to) };
};
const BAD: Record<string, { files: typeof good; fails: string }> = {
  "never runs": { files: planted("RUN_FROM = 2.2", "RUN_FROM = 99"), fails: "plays run at" },
  // walk and run at their own rate, the character moved at the speed asked: the feet slide by the difference
  skates: {
    files: { ...good, player: good.player.replace("character.position.z += player.moved.forward / 1000;", "character.position.z += speed * dt;").replace("Math.min(2, Math.max(0.5, (speed * 1000) / moves[m].speed))", "1") },
    fails: "a foot stands still at",
  },
  "a bone gone NaN": { files: planted("player.update(dt);", "player.update(dt);\n      if (animator.time > 5) bound.bones[0]!.position.x = Number.NaN;"), fails: "finite" },
  "no sheet": { files: planted('writePng("sheet.png", raster.join(sheets, { down: true }));', "void writePng;", "sheet"), fails: "a sheet is produced" },
};
/** Grades a solution in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, files: typeof good, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B1"), character, files: { "src/player.ts": files.player, "src/sheet.ts": files.sheet } });
  return gradeB1(dir);
}
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B1's grader", () => {
  it("asks a character speeds in proportion to its hip height: the known-good passes on a chibi (D56)", async () => {
    // generator seed 935, hips 0.44 m up: asked 1.2 and 3.5 m/s, the walk travelled 0.84 m/s at twice its own rate
    // and the running foot never stood still (G4's first held-out draw)
    const g = await grade("good", good, { seed: 935 });
    expect(g.pass, text(g)).toBe(true);
    expect(g.checks.find((c) => c.name.startsWith("plays walk at"))!.name).toBe("plays walk at 0.53 m/s");
  }, 120_000);
  for (const character of (process.env.M3A_FULL === "1" ? [{ seed: 1 }, { seed: 37 }] : [{ seed: 1 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good solution on ${who}`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
    }, 180_000);
    it(`fails each planted bad solution on ${who}, naming the check it broke`, async () => {
      for (const [name, bad] of Object.entries(BAD)) {
        const g = await grade(name, bad.files, character);
        expect(g.pass, `${name}\n${text(g)}`).toBe(false);
        expect(g.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(g)}`).toBe(true);
      }
    }, 600_000);
  }
});
