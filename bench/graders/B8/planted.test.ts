// B8's grader in T2's full step only (M3A_FULL=1, D74; T1's cases are grade.test.ts's, from one file so the checker
// opens once): the known-good solution on gen-53, a generator seed outside WP-4.2's set (a Mixamo-named body without
// chest bones), its emote moved to review by the trial's checker first (`checkEvery`, its 30 s timer faked), so the
// grader checks it again from its text; and each planted bad solution that runs m3a's calls (never submitted, bounced,
// a fix of a library clip, missing provenance), in a workspace of its own on gen-1, failing the check it names. Those
// that only write into the queue, each in a workspace of its own: planted-grader.test.ts. The grader's modules load
// only when the file runs (T1 imports and skips it).
import { describe, expect, it, vi } from "vitest";

const FULL = process.env.M3A_FULL === "1";
const { B8_GATES, CHECK_EVERY, checkEvery, queue } = FULL ? await import("./grade.ts") : ({} as typeof import("./grade.ts"));
const { GOOD, PLANTED, play, STORED, text } = FULL ? await import("./solutions.ts") : ({} as typeof import("./solutions.ts"));

describe.runIf(FULL)("B8's grader in full", () => {
  it("passes the known-good solution on gen-53: its emote waits for review with every gate green, moved there by the trial's checker", async () => {
    const moved: string[] = [];
    // the trial's checker, as the runner runs it while the agent works: one tick of its timer, then its stop
    const tick = async (ws: string) => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      try {
        const stop = checkEvery(ws);
        vi.advanceTimersByTime(CHECK_EVERY);
        await stop();
        expect(stop.failed).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
      moved.push(...(await queue(ws).list()).map((s) => s.state));
    };
    const { g, ws, ran } = await play("good", { files: { "emote.json": GOOD.recipe }, calls: GOOD.calls, also: tick }, { seed: 53 });
    expect(ran.map((r) => r.code)).toEqual([0, 0, 0]);
    expect(moved).toEqual(["awaiting review"]);
    expect(g.pass, text(g)).toBe(true);
    const [s] = await queue(ws).list();
    expect([s!.state, (s!.report as { gates: { gate: string }[] }).gates.map((x) => x.gate).sort()]).toEqual(["awaiting review", [...B8_GATES].sort()]);
  }, 120_000);

  it("fails each planted bad solution that runs m3a's calls, on gen-1, naming the check it broke", async () => {
    for (const name of Object.keys(PLANTED).filter((k) => !STORED.includes(k))) {
      const bad = PLANTED[name]!, { g } = await play(name, bad, { seed: 1 });
      expect(g.pass, `${name}\n${text(g)}`).toBe(false);
      expect(g.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(g)}`).toBe(true);
    }
  }, 300_000);
});
