// B3's grader (WP-6.6's Done-when): it passes the known-good reactor and fails each planted bad one, naming the check it
// broke, on the default character (gen-1, of WP-4.2's set) and on a generator seed outside it (gen-37). The planted
// reactors are the known-good one edited: the light hit on the whole body, a heavy hit that gets up at once, one that
// never gets up, and a light hit that does nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { gradeB3 } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), good = readFileSync(join(import.meta.dirname, "known-good/src/reactor.ts"), "utf8");
/** The known-good reactor with one edit, which must take. */
const planted = (from: string, to: string) => {
  if (!good.includes(from)) throw new Error(`the planted edit's text isn't in the known-good reactor: ${from}`);
  return good.replace(from, to);
};
const BAD: Record<string, { reactor: string; fails: string }> = {
  "the whole body flinches": { reactor: planted('weight: 0, mask: "upper" }', "weight: 0 }"), fails: "a light hit moves the legs" },
  "gets up at once": { reactor: planted('down.phase === "lie" && down.t >= 1', 'down.phase === "lie" && down.t >= 0'), fails: "it lies down 1 s" },
  "never gets up": { reactor: planted('down.phase === "lie" && down.t >= 1', 'down.phase === "lie" && down.t >= 99'), fails: "it lies down 1 s" },
  "no flinch": { reactor: planted('animator.layer("flinch", { clip: flinch, time: 0, weight: 0, mask: "upper" });', "void flinch;"), fails: "a light hit moves the upper body" },
};
/** Grades a reactor in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, reactor: string, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `B3-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B3"), character, files: { "src/reactor.ts": reactor } });
  return gradeB3(dir);
}
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B3's grader", () => {
  // T1 grades on gen-1; T2 (M3A_FULL=1) on gen-37 too (D74)
  for (const character of (process.env.M3A_FULL === "1" ? [{ seed: 1 }, { seed: 37 }] : [{ seed: 1 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good reactor on ${who}, and fails each planted bad one, naming the check it broke`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
      for (const [name, bad] of Object.entries(BAD)) {
        const b = await grade(name, bad.reactor, character);
        expect(b.pass, `${name}\n${text(b)}`).toBe(false);
        expect(b.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(b)}`).toBe(true);
      }
    }, 300_000);
  }
});
