// B8-ten's grader on the real checker, in T2's full step only (M3A_FULL=1, D74; T1 runs its count on stub checks in
// grade.test.ts): its known-good (ten emotes compiled from recipes on the CC0 library and sent by its own m3a calls,
// each exiting 0) passes, all ten waiting for review with every check green; nine good and a duplicate of one of them,
// sent at once, fail with nine passing, the later copy bounced in turn (dedup): one checker run lets both copies reach
// review (it reads a batch against the library and the decided, not against itself), and the grader doesn't. Ten
// with two bounced: T1's stub checks (grade.test.ts), the checker's bounces being B8's planted cases'. The grader's
// modules load only when the file runs (T1 imports and skips it).
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FULL = process.env.M3A_FULL === "1", none = {} as never;
const { prepareWorkspace } = FULL ? await import("../../runner/workspace.ts") : (none as typeof import("../../runner/workspace.ts"));
const { queue } = FULL ? await import("./grade.ts") : (none as typeof import("./grade.ts"));
const { sent, TEN_RECIPES, text } = FULL ? await import("./solutions.ts") : (none as typeof import("./solutions.ts"));
const { gradeB8Ten, solveB8Ten, TEN } = FULL ? await import("./ten.ts") : (none as typeof import("./ten.ts"));

const ROOT = join(import.meta.dirname, "../../..");
const workspace = (name: string) => prepareWorkspace(join(ROOT, ".cache/bench/test-ws", `B8-ten-${name}-1`), { starter: join(ROOT, "bench/starters/B8"), character: { seed: 1 } });
/** Sends each text with the store's own submit as contributor `local` (each made as `m3a library submit` makes it). */
const send = async (ws: string, texts: readonly string[]) => {
  const ids: string[] = [];
  for (const t of texts) ids.push((await queue(ws, "local").submit({ kind: "clip", text: t })).id);
  return ids;
};
const names = FULL ? Object.keys(TEN_RECIPES) : [];

describe.runIf(FULL)("B8-ten's grader", () => {
  it("passes the known-good: ten emotes from the CC0 library, sent by its own calls, all waiting for review with every check green", async () => {
    const ws = await workspace("good");
    solveB8Ten(ws);
    const g = await gradeB8Ten(ws);
    expect(g.pass, text(g)).toBe(true);
    expect(g.checks.map((c) => [c.name, c.detail])).toEqual([["10 submissions reached the queue", "10 in .cache/intake/"], ["10 of them pass every check", "10 of 10 pass every check"]]);
    expect((await queue(ws).list()).map((s) => s.state)).toEqual(Array(TEN).fill("awaiting review"));
  }, 600_000);

  it("fails nine good and a duplicate of one of them sent at once: nine pass, the later copy bounced in turn (dedup)", async () => {
    const ws = await workspace("dup"), copy = TEN_RECIPES.Arms_V!.replace(/Arms_V/g, "Hands_Up").replace("raises both arms overhead in a V, holds them up and lowers them", "throws both hands up high and holds them there");
    const ids = await send(ws, [...names.slice(0, 9).map((n) => sent(TEN_RECIPES[n]!)), sent(copy)]), [a, b] = [ids[0]!, ids[9]!].sort();
    const g = await gradeB8Ten(ws);
    expect(g.pass, text(g)).toBe(false);
    // (the checker at 08d0fdd reads one run's batch against the library and the decided only, so both copies wait for
    // review in the queue and the grader's reading in turn bounces the later one; a checker that held a batch apart
    // would bounce it in the queue)
    expect(g.checks[1]!.detail).toMatch(new RegExp(`^9 of 10 pass every check; the other: ${b} \\(clip\\) fails it waits for review: (awaiting review in the queue, but bounced when checked again from its text|bounced): dedup: [^|]*${a}`));
  }, 600_000);
});
