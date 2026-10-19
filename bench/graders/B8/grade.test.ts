// B8's and B8-ten's graders, from one file so the checker opens once: T1 runs the trial's checker and B8-ten's grader
// on stubs; T2's full step (M3A_FULL=1, D74) the rest, here and in planted.test.ts, planted-grader.test.ts and
// ten.full.test.ts. B8's known-good solution (WP-9.1b's Done-when):
// its recipe compiled and the clip it makes sent with `m3a library submit`, by its own calls (each exiting 0), on the
// default character (gen-1): the grader passes it, holds it to every gate the checker ran, and leaves it waiting for
// review. Every planted bad solution that only writes into the queue (solutions.ts's STORED), played together in one
// queue on gen-1 and each graded, failing the check it names, each of the verifier's probes on that check alone (a walk
// tagged emote, a person or another vendor's model named, the source's name and description, a report submit didn't
// measure, a bounced record edited to a good text); the two records written by hand are checked again from their
// text, which is the recheck path. The trial's checker (`checkEvery`) skipping a tick with nothing new, and logging a
// checker that fails beside the workspace. B8-ten's count of submissions passing every check, on stub checks (ten good; nine
// and a duplicate of one; ten with two bounced; twelve with two bounced), and its refusal of an empty queue.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { prepareWorkspace } from "../../runner/workspace.ts";
import type { Check } from "../B1/grade.ts";
import { B8_GATES, CHECK_EVERY, checkEvery, gradeQueue, queue } from "./grade.ts";
import { GOOD, PLANTED, play, sent, STORED, text } from "./solutions.ts";
import { gradeB8Ten, tally, TEN, type Tallied } from "./ten.ts";

const ROOT = join(import.meta.dirname, "../../.."), FULL = process.env.M3A_FULL === "1";
/** The planted solutions the verifier's probes found passing: each fails its check and nothing else. */
const PROBES = ["a walk", "made by a person", "made by another vendor's model", "its source's name and description", "a report submit didn't measure", "a record edited by hand"];

describe("B8's grader", () => {
  it.runIf(FULL)("passes the known-good solution on gen-1: its emote waits for review with every gate green", async () => {
    const { g, ws, ran } = await play("good", { files: { "emote.json": GOOD.recipe }, calls: GOOD.calls }, { seed: 1 });
    expect(ran.map((r) => [r.line.split(" ").slice(0, 5).join(" "), r.code])).toEqual([["npx m3a recipe.compile emote.json", 0], ["npx m3a library submit check-output/recipe.compile/Bow_Deep.clip.json", 0], ["npx m3a library status", 0]]);
    expect(g.pass, text(g)).toBe(true);
    // every gate the checker ran is one the grader holds it to, and the queue shows it waiting for review
    const [s] = await queue(ws).list();
    expect([s!.state, (s!.report as { gates: { gate: string }[] }).gates.map((x) => x.gate).sort()]).toEqual(["awaiting review", [...B8_GATES].sort()]);
    expect(g.checks.filter((c) => c.name.endsWith(" gate is green")).length).toBe(B8_GATES.length);
  }, 120_000);

  it.runIf(FULL)("fails each planted bad solution that only writes into the queue, played together in one queue, on the check it names", async () => {
    const ws = await prepareWorkspace(join(ROOT, ".cache/bench/test-ws/B8-stored-1"), { starter: join(ROOT, "bench/starters/B8"), character: { seed: 1 } }), whose = new Map<string, string>();
    for (const name of STORED) {
      const before = new Set((await queue(ws).list()).map((s) => s.id));
      await PLANTED[name]!.also!(ws);
      for (const s of await queue(ws).list()) if (!before.has(s.id)) whose.set(s.id, name);
    }
    expect([...whose.values()].sort()).toEqual([...STORED].sort());
    const q = await gradeQueue(ws), by = (name: string) => q.each.find((g) => whose.get(g.s.id) === name)!;
    expect(q.each.length).toBe(STORED.length);
    for (const { s, checks } of q.each) {
      const name = whose.get(s.id)!, failing = checks.filter((c) => !c.ok).map((c) => c.name), lines = checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");
      expect(failing.some((c) => c.startsWith(PLANTED[name]!.fails)), `${name}\n${lines}`).toBe(true);
      if (PROBES.includes(name)) expect(failing, `${name}\n${lines}`).toEqual([PLANTED[name]!.fails]);
    }
    // the records written by hand, checked again from their text: the queue's word against the checker's, which wins
    const detail = (name: string, check: string) => by(name).checks.find((c) => c.name === check)!.detail;
    expect(detail("a record written by hand", "it waits for review")).toMatch(/: awaiting review in the queue, but bounced when checked again from its text: dedup: a near-duplicate of QUATERNIUS_3D2DGE\/Idle_Loop/);
    expect(detail("a record edited by hand", "its queue record is its own text's")).toMatch(/^its content hash isn't its text's/);
    expect(detail("made by a person", "its provenance is complete")).toMatch(/who made it as the brief asks \(provenance\.intake\.by "Bob"/);
    expect(detail("a report submit didn't measure", "its provenance is complete")).toMatch(/report says \{"findings":0,"qaVersion":"m3a-sensors@0","sensors":"pass"\}, but submit measures \{"sensors":"pass","findings":0,"qaVersion":"m3a-sensors@1"\}/);
    expect(detail("its source's name and description", "its name and description are its own")).toBe("its name is QUATERNIUS_3D2DGE/Idle_Loop's; its description is QUATERNIUS_3D2DGE/Idle_Loop's: give it a name and a description that say what it does");
    expect(detail("a walk", "it stays in place")).toMatch(/^it walks from \d\.\d\d s; it travels \d\.\d\d hip heights a cycle, past 0\.25/);
  }, 120_000);
});

describe("the trial's checker", () => {
  it("runs nothing on a queue with nothing new, and logs a checker that fails beside the workspace", async () => {
    const ws = await prepareWorkspace(join(ROOT, ".cache/bench/test-ws/B8-ticks-1"), { starter: join(ROOT, "bench/starters/B8"), character: { seed: 1 } }), log = `${ws}.checker.log`;
    rmSync(log, { force: true });
    let opens = 0;
    const open = () => (opens++, Promise.reject(new Error("the reference rig gen-0 isn't cached")));
    // three ticks of its timer, then its stop: before a submission, after one
    const ticks = async (n: number) => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      try {
        const stop = checkEvery(ws, CHECK_EVERY, log, open);
        for (let k = 0; k < n; k++) {
          vi.advanceTimersByTime(CHECK_EVERY);
          await vi.waitFor(() => undefined);
        }
        await stop();
        return [...stop.failed];
      } finally {
        vi.useRealTimers();
      }
    };
    expect([await ticks(2), opens, existsSync(log)]).toEqual([[], 0, false]);
    await queue(ws, "local").submit({ kind: "clip", text: sent(GOOD.recipe) });
    const failed = await ticks(1);
    expect([failed, opens, readFileSync(log, "utf8")]).toEqual([["tick 1: the checker failed on .cache/intake: the reference rig gen-0 isn't cached"], 1, `${failed[0]}\n`]);
    expect((await queue(ws).list()).map((s) => s.state)).toEqual(["submitted"]);
  });
});

/** A stub submission's checks as B8's grader names them, every one passing but those in `bad` (name to detail). */
function stub(n: number, bad: Record<string, string> = {}): Tallied {
  const id = `s-${String(n).padStart(16, "0")}`, names = ["it waits for review", "its queue record is its own text's", ...B8_GATES.map((g) => `the ${g} gate is green`), "its provenance is complete", "its name and description are its own", "it is tagged emote", "it stays in place", "it is new, not a fix of a library clip", "it plays on the character"];
  const checks: Check[] = names.map((name) => ({ name, ok: !(name in bad), detail: name === "it waits for review" && name in bad ? `${id} (clip): ${bad[name]}` : (bad[name] ?? "ok") }));
  return { s: { id, kind: "clip" }, checks };
}
const goods = (n: number, from = 1) => Array.from({ length: n }, (_, k) => stub(from + k));
const dup = stub(10, { "it waits for review": "awaiting review in the queue, but bounced when checked again from its text: dedup: it is the motion of s-0000000000000001, already awaiting review", "the dedup gate is green": "it is the motion of s-0000000000000001, already awaiting review", "the retarget gate is green": "not run: the checker runs it only once the gates before it pass" });
const bounced = (n: number) => stub(n, { "it waits for review": "bounced: sensors: the sensors fail it", "the sensors gate is green": "the sensors fail it: ground penetration", "the retarget gate is green": "not run: the checker runs it only once the gates before it pass" });

describe("B8-ten's grader", () => {
  it("passes ten submissions each passing every check, and names how many passed and what failed for the others", () => {
    expect(tally(goods(TEN))).toEqual({ name: "10 of them pass every check", ok: true, detail: "10 of 10 pass every check" });
    expect(tally([...goods(TEN), bounced(11), bounced(12)])).toMatchObject({ ok: true, detail: expect.stringMatching(/^10 of 12 pass every check; the 2 others: s-0000000000000011 \(clip\) fails it waits for review: bounced: sensors/) });
  });
  it("fails nine good submissions and a duplicate of one of them (nine pass), and ten with two bounced (eight pass)", () => {
    expect(tally([...goods(9), dup])).toEqual({ name: "10 of them pass every check", ok: false, detail: "9 of 10 pass every check; the other: s-0000000000000010 (clip) fails it waits for review: awaiting review in the queue, but bounced when checked again from its text: dedup: it is the motion of s-0000000000000001, already awaiting review; and the dedup gate is green, the retarget gate is green" });
    const two = tally([...goods(8), bounced(9), bounced(10)]);
    expect([two.ok, two.detail.split(";")[0], two.detail.split(" | ").length]).toEqual([false, "8 of 10 pass every check", 2]);
  });
  it("fails a workspace whose queue holds no submission, before opening the checker", async () => {
    const ws = await prepareWorkspace(join(ROOT, ".cache/bench/test-ws/B8-ten-empty-1"), { starter: join(ROOT, "bench/starters/B8"), character: { seed: 1 } }), g = await gradeB8Ten(ws);
    expect([g.pass, g.checks]).toEqual([false, [{ name: "10 submissions reached the queue", ok: false, detail: "0 in .cache/intake/: send 10 more emotes with m3a library submit" }]]);
  });
});
