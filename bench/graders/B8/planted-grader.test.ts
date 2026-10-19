// B8's grader on the planted bad solutions only the grader fails (WP-9.1b's Done-when), each failing the check it
// names, on gen-1: a fix of a library clip (not new), missing provenance (a recipe sent as it is), and a record
// written into the queue by hand as awaiting review, which the grader checks again from its text (dedup). The rest:
// planted.test.ts; the solutions: solutions.ts.
import { describe, expect, it } from "vitest";
import { PLANTED, play, text } from "./solutions.ts";

describe("B8's grader", () => {
  it("fails each planted bad solution the checker passes or never sees, on gen-1, naming the check it broke", async () => {
    for (const name of ["a fix of a library clip", "missing provenance", "a record written by hand"]) {
      const bad = PLANTED[name]!, { g } = await play(name, bad, { seed: 1 });
      expect(g.pass, `${name}\n${text(g)}`).toBe(false);
      expect(g.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(g)}`).toBe(true);
      // the hand-written record: its queue's word against the checker's, and the checker's wins
      if (name === "a record written by hand") expect(g.checks.find((c) => c.name === "it waits for review")!.detail).toMatch(/: awaiting review in the queue, but bounced when checked again from its text: dedup: a near-duplicate of QUATERNIUS_3D2DGE\/Idle_Loop/);
    }
  }, 120_000);
});
