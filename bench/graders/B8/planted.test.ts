// B8's grader on the planted bad solutions the checker bounces in the queue (WP-9.1b's Done-when), each failing the
// check it names, on gen-1: never submitted, bounced (dedup), a false license claim (license), a defect (sensors). The
// rest: planted-grader.test.ts; the solutions: solutions.ts.
import { describe, expect, it } from "vitest";
import { PLANTED, play, text } from "./solutions.ts";

describe("B8's grader", () => {
  it("fails each planted bad solution the checker bounces, on gen-1, naming the check it broke", async () => {
    for (const name of ["never submitted", "bounced", "a false license claim", "a defect the checker bounces"]) {
      const bad = PLANTED[name]!, { g } = await play(name, bad, { seed: 1 });
      expect(g.pass, `${name}\n${text(g)}`).toBe(false);
      expect(g.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(g)}`).toBe(true);
    }
  }, 120_000);
});
