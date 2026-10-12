// The benchmark runner (WP-4.7): the audit of a transcript (paths outside the workspace, files read past the manual),
// the legend quiz's prompt and scoring, a fake trial through the packed packages installed in a workspace outside the
// repository, agents run a few at once, and a held-out variant given by path, whose known-good solution runs first.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audit, pathsOf } from "./agent.ts";
import { latestVariant, pool, runB1, variantOf } from "./main.ts";
import { pack } from "./pack.ts";
import { answersIn, QUIZ, quizPrompt, score } from "./quiz.ts";

const ROOT = join(import.meta.dirname, "../..");

describe("the agent's audit", () => {
  it("lists paths touched outside the workspace and files read past the manual", () => {
    const ws = "/tmp/m3a-bench/run/B1-1", call = (name: string, input: object) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
    const lines = [
      call("Read", { file_path: `${ws}/node_modules/@m3a/tools/MANUAL.md` }),
      call("Read", { file_path: `${ws}/node_modules/@m3a/core/dist/animator/animator.js` }),
      call("Bash", { command: `cat ${ROOT}/PLAN.md && ls /usr/bin && node check.ts` }),
      call("Grep", { pattern: "x", path: "/root/.claude" }),
      call("Write", { file_path: "src/player.ts", content: "" }),
      "not json",
    ];
    expect(audit(lines, ws)).toEqual({ outside: [`${ROOT}/PLAN.md`, "/root/.claude"].sort(), pastManual: ["node_modules/@m3a/core/dist/animator/animator.js"] });
    expect(pathsOf("Bash", { command: "ls -la && cat '/etc/hosts' x=/home/me" })).toEqual(["/etc/hosts", "/home/me"]);
    // a glob, a bare root, a regex in a script and a word whose first directory isn't here are not paths
    expect(pathsOf("Bash", { command: "find / -name '/**' ; node -e 'x.filter((o) => /foot/i.test(o.name))' ; grep /export a.ts > /tmp/s/out" })).toEqual(["/tmp/s/out"]);
  });
});

describe("the legend quiz", () => {
  it("gives the legend and the clip as they are, and scores numbers within 0.01 and words without case", () => {
    const p = quizPrompt();
    expect(p).toContain("# Legend 2.0");
    expect(p).toMatch(/"id":\s*"QUATERNIUS_3D2DGE\/Punch_Cross"/);
    expect(QUIZ.questions).toHaveLength(10);
    const right = Object.fromEntries(QUIZ.questions.map((q, i) => [String(i + 1), q.answer]));
    expect(score(right).right).toBe(10);
    expect(score({ ...right, "4": 133.004, "6": "Backward" }).right).toBe(10);
    expect(score({ ...right, "5": 25 })).toEqual({ right: 9, of: 10, wrong: ['5: 25 (expected 24)'] });
    expect(answersIn('Here: {"1": "no", "2": 1} done')).toEqual({ "1": "no", "2": 1 });
    expect(answersIn("no json")).toEqual({});
  });
});

describe("held-out variants", () => {
  it("takes a brief's variant from a gate's latest run, and says so when there is none", () => {
    const base = mkdtempSync(join(tmpdir(), "m3a-heldout-"));
    expect(() => latestVariant("G4", "B1", base)).toThrow(/no held-out B1 variant for G4 yet/);
    for (const run of ["run-1", "run-2"]) {
      mkdirSync(join(base, "G4", run, "B1"), { recursive: true });
      writeFileSync(join(base, "G4", run, "B1", "character.json"), JSON.stringify({ seed: 41 }));
    }
    expect(latestVariant("G4", "B1", base)).toBe(join(base, "G4", "run-2", "B1"));
  });
});

describe("trials", () => {
  it("run at most N agents at once, their records in order", async () => {
    let now = 0, most = 0;
    const r = await pool([30, 10, 20, 5, 15], 2, async (ms) => {
      most = Math.max(most, ++now);
      await new Promise((d) => setTimeout(d, ms));
      now--;
      return ms * 2;
    });
    expect([r, most]).toEqual([[60, 20, 40, 10, 30], 2]);
  });
  const base = mkdtempSync(join(tmpdir(), "m3a-bench-test-")), packs = pack(join(base, "packs"));
  it("installs the packed packages outside the repository, and grades the known-good solution there (a fake trial)", async () => {
    const r = await runB1({ trials: 1, discovery: 0, base, packs, fake: true });
    expect(r.trials.map((t) => [t.trial, t.pass, t.failed])).toEqual([["B1-1", true, []]]);
  }, 300_000);
  it("runs a variant given by path, its known-good solution first: on a character from a seed outside the test set", async () => {
    const dir = join(base, "variant");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "brief.md"), "# B1, reworded\nMake the character idle, walk and run by speed (see the starter).\n");
    writeFileSync(join(dir, "character.json"), JSON.stringify({ seed: 41 }));
    expect(variantOf(dir).character).toEqual({ seed: 41 });
    const r = await runB1({ trials: 1, discovery: 0, base: join(base, "v"), packs, fake: true, variant: dir });
    expect(r.check?.pass, r.check?.failed.join("\n")).toBe(true);
    expect(r.trials[0]!.pass).toBe(true);
    // a variant whose rig isn't fetched stops before any trial, naming how to fetch it
    writeFileSync(join(dir, "character.json"), JSON.stringify({ manifest: "rigs.json", rig: "nowhere" }));
    writeFileSync(join(dir, "rigs.json"), JSON.stringify({ rigs: [] }));
    await expect(runB1({ trials: 1, discovery: 0, base: join(base, "w"), packs, fake: true, variant: dir })).rejects.toThrow(/npm run fixtures -- fetch --manifest/);
  }, 300_000);
});
