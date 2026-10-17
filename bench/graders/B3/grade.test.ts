// B3's grader (WP-6.6's Done-when): it passes the known-good reactor and fails each planted bad one, naming the check it
// broke, on the default character (gen-1, of WP-4.2's set) and on generator seeds outside it (gen-37; gen-29, a spine
// without chest bones). The planted reactors are the known-good one edited: the light hit on the whole body, a heavy
// hit that gets up at once, one that never gets up, the idle slid along for the walk, a light hit that does nothing,
// a knockdown flung, the idle slid along after getting up, the body sliding as it lies, and the walk skating at half
// its rate. On a rigify character (gen-7: DEF- bones, none named hips or pelvis) the known-good passes too, and the
// starter's check finds the hips with bind() and prints their height (by name it printed NaN, D91).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { cacheChildren } from "../../../tools/run/compile-cache.ts";
import { gradeB3 } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), good = readFileSync(join(import.meta.dirname, "known-good/src/reactor.ts"), "utf8");
/** The known-good reactor with one edit, which must take. */
const planted = (from: string, to: string) => {
  if (!good.includes(from)) throw new Error(`the planted edit's text isn't in the known-good reactor: ${from}`);
  return good.replace(from, to);
};
const BAD: Record<string, { reactor: string; fails: string }> = {
  "the whole body flinches": { reactor: planted('weight: 0, mask: "upper" }', "weight: 0 }"), fails: "a light hit leaves the legs" },
  "gets up at once": { reactor: planted('down.phase === "lie" && down.t >= 1', 'down.phase === "lie" && down.t >= 0'), fails: "it lies down 1 s" },
  "never gets up": { reactor: planted('down.phase === "lie" && down.t >= 1', 'down.phase === "lie" && down.t >= 99'), fails: "it lies down 1 s" },
  // the idle slid along by the game for the walk (the verifier's): its feet never stand
  "slides an idle": { reactor: planted("const want = speed * H0 > 0.3 * H0 ? walk : idle,", "const want = idle,").replace("character.position.z += player.moved.forward / 1000;", "character.position.z += player.moved.forward / 1000 + (down ? 0 : (speed * H0 * dt) / 1000);"), fails: "a foot stands still walking" },
  "no flinch": { reactor: planted('animator.layer("flinch", { clip: flinch, time: 0, weight: 0, mask: "upper" });', "void flinch;"), fails: "a light hit moves the upper body" },
  // the knockdown flung: carried on backward at 8 hip heights a second while it falls and lies (the verifier's, as a
  // take-off speed held to the knockback's end gave)
  "flung": { reactor: planted("character.position.z += player.moved.forward / 1000;", 'character.position.z += player.moved.forward / 1000 - (down && down.phase !== "rise" ? (8 * H0 * dt) / 1000 : 0);'), fails: "a heavy hit throws it, no further" },
  // after getting up, the idle slid along at the speed asked (the verifier's): it never walks again
  "idles after": { reactor: planted("const want = speed * H0 > 0.3 * H0 ? walk : idle,", "const want = speed * H0 > 0.3 * H0 && !rose ? walk : idle,").replace("else if (down.phase === \"rise\" && L.held === \"end\") down = null;", "else if (down.phase === \"rise\" && L.held === \"end\") [down, rose] = [null, true];").replace("character.position.z += player.moved.forward / 1000;", "character.position.z += player.moved.forward / 1000 + (rose ? (speed * H0 * dt) / 1000 : 0);").replace("let ", "let rose = false, "), fails: "a foot stands still walking, again at the end" },
  // the walk played at half the rate the speed needs while the character moves at the speed asked: its feet skate
  // the body carried on along the floor while it lies (the verifier's round 3: a game that keeps moving it while down)
  "slides as it lies": { reactor: planted("character.position.z += player.moved.forward / 1000;", 'character.position.z += player.moved.forward / 1000 + (down && down.phase === "lie" ? (0.8 * H0 * dt) / 1000 : 0);'), fails: "it stays where it lies" },
  "skates": { reactor: planted("character.position.z += player.moved.forward / 1000;", "character.position.z += down ? player.moved.forward / 1000 : (speed * H0 * dt) / 1000;").replace("speed: want === walk ? Math.min(2, Math.max(0.5, (speed * H0) / own)) : 1", "speed: want === walk ? 0.5 * Math.min(2, Math.max(0.5, (speed * H0) / own)) : 1"), fails: "a standing foot stays, before the hits" },
};
/** Grades a reactor in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, reactor: string, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `B3-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B3"), character, files: { "src/reactor.ts": reactor } });
  return gradeB3(dir);
}
// the starter's check compiles through one cache (tools/run/compile-cache.ts)
cacheChildren();
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B3's grader", () => {
  // T1 grades on gen-1; T2 (M3A_FULL=1) on gen-37 and gen-29 (no chest bones: its spine one bone) too (D74)
  for (const character of (process.env.M3A_FULL === "1" ? [{ seed: 1 }, { seed: 37 }, { seed: 29 }] : [{ seed: 1 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good reactor on ${who}, and fails each planted bad one, naming the check it broke`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
      // T1 grades every other planted one; T2 (M3A_FULL=1) all of them (D74)
      for (const [name, bad] of Object.entries(BAD).filter((_, i) => process.env.M3A_FULL === "1" || i % 2 === 0)) {
        const b = await grade(name, bad.reactor, character);
        expect(b.pass, `${name}\n${text(b)}`).toBe(false);
        expect(b.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(b)}`).toBe(true);
      }
    }, 300_000);
  }
  it("passes the known-good reactor on a rigify character (gen-7), whose hips the starter's check finds as the grader does", async () => {
    const g = await grade("good", good, { seed: 7 });
    expect(g.pass, text(g)).toBe(true);
    // the starter's `npm run check` in that workspace: the hips' height every half second, standing, down after the
    // heavy hit (7 s) and up again at the end
    const out = execFileSync(process.execPath, ["check.ts"], { cwd: join(ROOT, ".cache/bench/test-ws/B3-good-7"), encoding: "utf8" });
    const hips = [...out.matchAll(/hips (\S+) m up/g)].map((m) => Number(m[1]));
    expect([hips.length, hips.every(Number.isFinite)]).toEqual([26, true]);
    expect([hips[14]! < 0.3 * hips[0]!, hips[25]! > 0.8 * hips[0]!]).toEqual([true, true]);
  }, 300_000);
});
