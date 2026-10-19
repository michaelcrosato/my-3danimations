// B8's grader on the known-good solution (WP-9.1b's Done-when): its recipe compiled and the clip it makes sent with
// `m3a library submit`, by its own calls (each exiting 0), on the default character (gen-1) and on gen-53, a generator
// seed outside WP-4.2's set (a Mixamo-named body without chest bones): the grader passes it, holds it to every gate the
// checker ran, and leaves it waiting for review in the workspace's queue. On gen-53 the trial's checker moves it first
// (`checkEvery`, its 30 s timer faked), so the grader checks it again from its text. The planted bad ones:
// planted.test.ts and planted-grader.test.ts.
import { describe, expect, it, vi } from "vitest";
import type { CharacterSpec } from "../../runner/workspace.ts";
import { B8_GATES, CHECK_EVERY, checkEvery, queue } from "./grade.ts";
import { GOOD, play, text } from "./solutions.ts";

describe("B8's grader", () => {
  for (const character of [{ seed: 1 }, { seed: 53 }] as CharacterSpec[]) {
    const who = "seed" in character ? `gen-${character.seed}` : character.rig, trial = who === "gen-53";
    it(`passes the known-good solution on ${who}: its emote waits for review with every gate green${trial ? ", moved there by the trial's checker" : ""}`, async () => {
      const moved: string[] = [];
      // the trial's checker, as the runner runs it while the agent works: one tick of its timer, then its stop
      const tick = async (ws: string) => {
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
        try {
          const stop = checkEvery(ws);
          vi.advanceTimersByTime(CHECK_EVERY);
          await stop();
        } finally {
          vi.useRealTimers();
        }
        moved.push(...(await queue(ws).list()).map((s) => s.state));
      };
      const { g, ws, ran } = await play("good", { files: { "emote.json": GOOD.recipe }, calls: GOOD.calls, ...(trial ? { also: tick } : {}) }, character);
      expect(ran.map((r) => [r.line.split(" ").slice(0, 5).join(" "), r.code])).toEqual([["npx m3a recipe.compile emote.json", 0], ["npx m3a library submit check-output/recipe.compile/Bow_Deep.clip.json", 0], ["npx m3a library status", 0]]);
      expect(moved).toEqual(trial ? ["awaiting review"] : []);
      expect(g.pass, text(g)).toBe(true);
      // every gate the checker ran is one the grader holds it to, and the queue shows it waiting for review
      const [s] = await queue(ws).list();
      expect([s!.state, (s!.report as { gates: { gate: string }[] }).gates.map((x) => x.gate).sort()]).toEqual(["awaiting review", [...B8_GATES].sort()]);
      expect(g.checks.filter((c) => c.name.endsWith(" gate is green")).length).toBe(B8_GATES.length);
    }, 120_000);
  }
});
