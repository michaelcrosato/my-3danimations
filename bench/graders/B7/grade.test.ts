// B7's grader (WP-6.6's Done-when): it passes the known-good graph and fails each planted bad one, naming the check it
// broke, on the default character (gen-1, of WP-4.2's set) and on a generator seed outside it (gen-37); T1 grades the
// first planted one, T2's full step (M3A_FULL=1, D74, D119) all of them. The planted graphs are the known-good one
// edited: a jump from the air, a landing that waits for the jump to end, a clip that isn't in the library, every state
// playing the idle, never running, the jump button kept for later.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import type { Grade } from "../B1/grade.ts";
import { gradeB7 } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), good = readFileSync(join(import.meta.dirname, "known-good/graph.json"), "utf8"), FULL = process.env.M3A_FULL === "1";
/** The known-good graph with one edit, which must take. */
const planted = (from: string, to: string) => {
  if (!good.includes(from)) throw new Error(`the planted edit's text isn't in the known-good graph: ${from}`);
  return good.replace(from, to);
};
const BAD: Record<string, { graph: string; fails: string }> = {
  "jumps from the air": { graph: planted('"to": "jump", "when": [{ "param": "jump" }, { "param": "grounded" }]', '"to": "jump", "when": [{ "param": "jump" }]'), fails: "jumps only when grounded" },
  "keeps the press": { graph: planted('"jump": { "type": "trigger", "buffer": 0.1 }', '"jump": { "type": "trigger" }'), fails: "jumps only when grounded" },
  "lands late": { graph: planted('{ "from": ["jump", "air"], "to": "land", "when": [{ "param": "grounded" }], "fade": 0.1 }', '{ "from": "air", "to": "land", "when": [{ "param": "grounded" }], "fade": 0.1 }'), fails: "lands on contact" },
  "a clip not in the library": { graph: planted("QUATERNIUS_3D2DGE/Jog_Fwd_Loop", "QUATERNIUS_3D2DGE/Jog_Loop"), fails: "the graph checks" },
  // every state the idle: it goes through the states in order, and stands (the verifier's)
  "every state idles": { graph: good.replace(/"clip": "QUATERNIUS_3D2DGE\/(Walk_Loop|Jog_Fwd_Loop|Jump_Start|Jump_Loop|Jump_Land)"/g, '"clip": "QUATERNIUS_3D2DGE/Idle_Loop"'), fails: "walk travels" },
  "never runs": { graph: planted('"to": "run", "when": [{ "param": "speed", "op": ">=", "value": 2.2 }], "fade": 0.25, "sync": true', '"to": "run", "when": [{ "param": "speed", "op": ">=", "value": 9 }], "fade": 0.25, "sync": true'), fails: "plays run at" },
};
/** Grades a graph in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, graph: string, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `B7-${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B7"), character, files: { "graph.json": graph } });
  return gradeB7(dir);
}
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");

describe("B7's grader", () => {
  // T1 grades on gen-1; T2 (M3A_FULL=1) on gen-37 too (D74)
  for (const character of (FULL ? [{ seed: 1 }, { seed: 37 }] : [{ seed: 1 }]) as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig;
    it(`passes the known-good graph on ${who}, and fails each planted bad one, naming the check it broke`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
      // T1 grades the first planted one; T2 (M3A_FULL=1) all of them (D74, D119: T1's margin)
      for (const [name, bad] of Object.entries(BAD).filter((_, i) => FULL || i === 0)) {
        const b = await grade(name, bad.graph, character);
        expect(b.pass, `${name}\n${text(b)}`).toBe(false);
        expect(b.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(b)}`).toBe(true);
      }
    }, 300_000);
  }
});
