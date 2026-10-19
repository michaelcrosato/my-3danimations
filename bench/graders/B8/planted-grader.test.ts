// B8's grader in T2's full step only (M3A_FULL=1, D74): each planted bad solution that only writes into the queue
// (solutions.ts's STORED: a false license claim, a defect, a walk tagged emote, a person or another vendor's model
// named, the source's name and description, a report submit didn't measure, records written or edited by hand), each in
// a workspace of its own on gen-1 and graded whole (`gradeB8`, the agent's best submission), failing the check it
// names. T1 plays them together in one queue (grade.test.ts); those that run m3a's calls: planted.test.ts. The
// grader's modules load only when the file runs (T1 imports and skips it).
import { describe, expect, it } from "vitest";

const FULL = process.env.M3A_FULL === "1";
const { PLANTED, play, STORED, text } = FULL ? await import("./solutions.ts") : ({} as typeof import("./solutions.ts"));

describe.runIf(FULL)("B8's grader in full", () => {
  it("fails each planted bad solution that only writes into the queue, each in its own workspace, naming the check it broke", async () => {
    for (const name of STORED) {
      const bad = PLANTED[name]!, { g } = await play(name, bad, { seed: 1 });
      expect(g.pass, `${name}\n${text(g)}`).toBe(false);
      expect(g.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(g)}`).toBe(true);
    }
  }, 300_000);
});
