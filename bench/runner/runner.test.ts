// The benchmark runner (WP-4.7): the audit of a transcript (paths outside the workspace, files read past the manual),
// the legend quiz's prompt and scoring, a fake trial through the packed packages installed in a workspace outside the
// repository, agents run a few at once, each `claude` started in its workspace with a /tmp of its own and the
// repository hidden (D84), and a held-out variant given by path, whose known-good solution runs first. Every temporary
// directory a test makes is removed after it.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { audit, namespace, pathsOf, runAgent } from "./agent.ts";
import { commitOf, lanes, latestVariant, pool, runB1, variantOf } from "./main.ts";
import { pack } from "./pack.ts";
import { answersIn, QUIZ, quizPrompt, score } from "./quiz.ts";

const ROOT = join(import.meta.dirname, "../..");
/** A temporary directory, removed after this file's tests (they filled the disk when kept). */
const made: string[] = [];
const temp = (prefix: string) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
};
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

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
    expect(audit(lines, ws)).toEqual({ outside: [`${ROOT}/PLAN.md`, "/root/.claude"].sort(), scratch: [], pastManual: ["node_modules/@m3a/core/dist/animator/animator.js"] });
    // with a /tmp of its own, its scratch files there are its own, listed apart (D84)
    const scratch = [call("Write", { file_path: "/tmp/cat.mjs", content: "" }), call("Bash", { command: `node /tmp/cat.mjs && cat ${ROOT}/PLAN.md` })];
    expect(audit(scratch, ws, true)).toEqual({ outside: [`${ROOT}/PLAN.md`], scratch: ["/tmp/cat.mjs"], pastManual: [] });
    expect(audit(scratch, ws).outside).toEqual([`${ROOT}/PLAN.md`, "/tmp/cat.mjs"].sort());
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
    const base = temp("m3a-heldout-");
    expect(() => latestVariant("G4", "B1", base)).toThrow(/no held-out B1 variant for G4 yet/);
    for (const run of ["run-1", "run-2"]) {
      mkdirSync(join(base, "G4", run, "B1"), { recursive: true });
      writeFileSync(join(base, "G4", run, "B1", "character.json"), JSON.stringify({ seed: 41 }));
    }
    expect(latestVariant("G4", "B1", base)).toBe(join(base, "G4", "run-2", "B1"));
  });
  it("records the commit under test and whether the tree differs from it, a worktree's too (D57)", () => {
    const here = commitOf(ROOT);
    expect(here.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof here.dirty).toBe("boolean");
    expect(commitOf(temp("m3a-nogit-"))).toEqual({ commit: "unknown", dirty: null });
  });
});

describe("an agent's own /tmp (D84)", () => {
  // a stand-in for `claude`, first on the PATH the agent keeps: it says where it started, what its /tmp holds and how
  // much of the repository it sees, and writes a scratch file to /tmp by name, as agents do
  const stand = (home: string) => {
    mkdirSync(join(home, "bin"), { recursive: true });
    const sh = join(home, "bin", "claude");
    writeFileSync(sh, ["#!/bin/sh", "before=$(ls -A /tmp | tr '\\n' ' ')", 'echo "$PWD" > /tmp/cat.mjs', `repo=$(ls -A '${ROOT}' 2>/dev/null | wc -l)`, `printf '{"type":"result","subtype":"success","num_turns":1,"result":"%s|%s|%s|%s|%s"}\\n' "$PWD" "$TMPDIR" "$before" "$(cat /tmp/cat.mjs)" "$repo"`, ""].join("\n"));
    chmodSync(sh, 0o755);
    return join(home, "bin");
  };
  it("starts claude in its workspace with a /tmp of its own: two at once write /tmp/cat.mjs and never meet", async () => {
    expect(namespace(), "this machine can't make a mount namespace (unshare), so agents would share /tmp").not.toBeNull();
    const base = temp("m3a-own-tmp-"), path = process.env.PATH;
    const wss = ["A-1", "A-2"].map((n) => {
      mkdirSync(join(base, n), { recursive: true });
      return join(base, n);
    });
    process.env.PATH = `${wss.map((ws) => stand(`${ws}-home`)).join(":")}:${path}`;
    try {
      const runs = await pool(wss, 2, (ws) => runAgent(ws, "hello", `${ws}.jsonl`));
      for (const [i, r] of runs.entries()) {
        const ws = wss[i]!, [pwd, tmp, before, cat, repo] = r.reply.split("|");
        expect([r.ok, r.privateTmp, pwd, tmp, cat], r.error).toEqual([true, true, ws, "/tmp", ws]);
        // its /tmp held only the way to its own workspace and home, and the repository showed empty
        expect(before!.trim()).toBe(base.split("/")[2]);
        expect(repo!.trim()).toBe("0");
        // its scratch file landed in its own /tmp, beside its workspace
        expect(readFileSync(`${ws}-tmp/cat.mjs`, "utf8").trim()).toBe(ws);
      }
      expect(existsSync("/tmp/cat.mjs") && readFileSync("/tmp/cat.mjs", "utf8").trim().startsWith(base)).toBe(false);
    } finally {
      process.env.PATH = path;
    }
  });
  it("runs agents at once only where each gets its own /tmp; fakes always may", () => {
    expect(lanes(5)).toBe(namespace() ? 5 : 1);
    expect([lanes(5, true), lanes(0, true)]).toEqual([5, 1]);
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
  const base = temp("m3a-bench-test-"), packs = pack(join(base, "packs"));
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
