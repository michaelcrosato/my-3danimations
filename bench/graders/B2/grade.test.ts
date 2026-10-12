// B2's grader (WP-6.6's Done-when): it passes the known-good fighter and fails each planted bad one, naming the check it
// broke, on the default character (gen-1, of WP-4.2's set) and on a generator seed outside it (gen-37). The planted
// fighters are the known-good one edited: damage when the button is pressed, when the punch ends, twice per punch, an
// idle held still, and a fighter that never punches (damage on a timer).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { gradeB2 } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), good = readFileSync(join(import.meta.dirname, "known-good/src/fighter.ts"), "utf8");
/** The known-good fighter with one edit, which must take. */
const planted = (from: string, to: string) => {
  if (!good.includes(from)) throw new Error(`the planted edit's text isn't in the known-good fighter: ${from}`);
  return good.replace(from, to);
};
const HIT = 'for (const e of player.update(dt).events) if (e.name === "hit") game.damage(10);';
const BAD: Record<string, { fighter: string; fails: string }> = {
  "damage on the press": { fighter: planted("        punching = true;", "        punching = true;\n        game.damage(10);").replace(HIT, "player.update(dt);"), fails: "damage when the punch" },
  "damage as the punch ends": { fighter: planted(HIT, "player.update(dt);").replace("if (L && L.held === \"end\") {", "if (L && L.held === \"end\") {\n        if (L.weight === 1) game.damage(10);"), fails: "damage when the punch" },
  "damage twice": { fighter: planted(HIT, 'for (const e of player.update(dt).events) if (e.name === "hit") [game.damage(10), game.damage(10)];'), fails: "damage once per punch" },
  // the idle held still: a stance, not an idle (the verifier's)
  "a held pose for an idle": { fighter: planted('layer("base", { clip: playable(idle.clip, idle.rest) })', 'layer("base", { clip: playable(idle.clip, idle.rest), speed: 0 })'), fails: "it idles" },
  "never punches": { fighter: planted("animator.layer(\"punch\", { weight: Math.min(1, L.weight + dt / 0.1) });", "void L;"), fails: "punches after the press" },
};
/** Grades a fighter in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, fighter: string, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `B2-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B2"), character, files: { "src/fighter.ts": fighter } });
  return gradeB2(dir);
}
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B2's grader", () => {
  // T1 grades on gen-1; T2 (M3A_FULL=1) on gen-37 too (D74)
  for (const character of (process.env.M3A_FULL === "1" ? [{ seed: 1 }, { seed: 37 }] : [{ seed: 1 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good fighter on ${who}, and fails each planted bad one, naming the check it broke`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
      for (const [name, bad] of Object.entries(BAD)) {
        const b = await grade(name, bad.fighter, character);
        expect(b.pass, `${name}\n${text(b)}`).toBe(false);
        expect(b.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(b)}`).toBe(true);
      }
    }, 300_000);
  }
});
