// The benchmark runner (WP-4.7): the audit of a transcript (paths outside the workspace, files read past the manual,
// a shell's relative paths among them, D88; what a file it writes names, and another process's /proc, D91), the legend
// quiz's prompt and scoring, a fake trial through the packed packages installed in a workspace outside the repository,
// agents run a few at once, each `claude` started in its workspace with a /tmp of its own, every checkout of the
// repository hidden and its processes alone in /proc (D84, D91), and a held-out variant given by path, whose
// known-good solution runs first. Every temporary directory a test makes is removed after it.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { audit, hidden, namespace, pathsOf, runAgent } from "./agent.ts";
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
    // with a /tmp of its own, its scratch files there are its own, listed apart (D84); the repository is outside
    // wherever it lives, a checkout under /tmp too (its own /tmp covers that path, but the name is the repository's)
    const scratch = [call("Write", { file_path: "/tmp/cat.mjs", content: "" }), call("Bash", { command: `node /tmp/cat.mjs && cat ${ROOT}/PLAN.md` })];
    expect(audit(scratch, ws, true)).toEqual({ outside: [`${ROOT}/PLAN.md`], scratch: ["/tmp/cat.mjs"], pastManual: [] });
    expect(audit(scratch, ws).outside).toEqual([`${ROOT}/PLAN.md`, "/tmp/cat.mjs"].sort());
    const paths = (command: string) => pathsOf("Bash", { command }).map((n) => n.path);
    expect(pathsOf("Bash", { command: "ls -la /root && cat '/etc/hosts' x=/home/me" })).toEqual([{ path: "/root", lists: true }, { path: "/etc/hosts", lists: false }, { path: "/home/me", lists: false }]);
    // a glob over the root, a bare root, a regex in a script and a word whose first directory isn't here are not paths
    expect(paths("find / -name '/**' ; node -e 'x.filter((o) => /foot/i.test(o.name))' ; grep /export a.ts > /tmp/s/out")).toEqual(["/tmp/s/out"]);
  });
  it("resolves a shell's relative paths from its directory, as G4 run 2's agents named them (D88)", () => {
    // a workspace under /tmp itself (a private /tmp holds what's beside it, D84), with the packages' directories
    const base = mkdtempSync("/tmp/m3a-audit-"), ws = join(base, "B1-1"), bash = (command: string) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command } }] } });
    made.push(base);
    for (const d of ["src", "node_modules/@m3a/tools", "node_modules/@m3a/three/dist", "node_modules/@m3a/core/dist", "node_modules/@m3a/sensors/dist", "node_modules/@m3a/library"]) mkdirSync(join(ws, d), { recursive: true });
    const lines = [
      // B1-1: a glob as written; the manual, and listing the packages, aren't reads past it
      bash(`cd ${ws}; cat node_modules/@m3a/tools/MANUAL.md; ls node_modules/@m3a/*`),
      bash(`cd ${ws}; grep -n "pose\\|root" node_modules/@m3a/three/dist/*.d.ts | head -20`),
      // B1-3
      bash(`cd ${ws}; sed -n 10,60p node_modules/@m3a/three/dist/index.d.ts; sed -n 40,75p node_modules/@m3a/sensors/dist/metrics/motion.d.ts`),
      // B1-discovery-1: a for loop's variable, and a read after a heredoc (whose body is a script, not the shell's)
      bash(`cd ${ws}; ls packs; for d in node_modules/@m3a/*; do echo == $d; ls $d; cat $d/README* 2>/dev/null | head -60; done`),
      bash(`cd ${ws}; python3 - <<'E'\ns=open('../src/player.ts').read()\nE\nnode check.ts | sed -n '4,8p'; sed -n 1,400p node_modules/@m3a/sensors/dist/index.d.ts | grep -n "sheet\\|measure"`),
      // B1-discovery-2: after a cd into the packages (a grep's pattern isn't a path), and in the next call, whose
      // shell starts where this one ended
      bash(`cd ${ws}/node_modules/@m3a; cat library/sets.lock.json | head -50; ls three/dist/play sensors/dist/sheet; grep -n "contactRoot" -r core/dist/contact/*.d.ts | head`),
      bash("cat sensors/dist/sheet/*.d.ts | head -60; cd /tmp"),
      // B1-2: a file written beside the workspace, from the workspace again (a shell that left it is put back there)
      bash(`cat > /tmp/probe.ts <<'EOF'\nimport { loadCharacter } from "${ws}/src/character.ts";\nEOF\ncp /tmp/probe.ts ./../probe_tmp.ts 2>/dev/null; rm -f ../probe_tmp.ts; echo ok`),
    ];
    const pastManual = ["*/README*", "core/dist/contact/*.d.ts", "library/sets.lock.json", "sensors/dist/index.d.ts", "sensors/dist/metrics/motion.d.ts", "sensors/dist/sheet/*.d.ts", "three/dist/*.d.ts", "three/dist/index.d.ts"].map((p) => `node_modules/@m3a/${p}`);
    expect(audit(lines, ws, true)).toEqual({ outside: [], scratch: [`${base}/probe_tmp.ts`, "/tmp/probe.ts"].sort(), pastManual });
    // without a /tmp of its own, what it wrote beside its workspace is outside it
    expect(audit(lines, ws).outside).toEqual([`${base}/probe_tmp.ts`, "/tmp/probe.ts"].sort());
  });
  it("scans the files it writes for what they name, without counting a read, and takes another process's /proc as outside (D91)", () => {
    const base = mkdtempSync("/tmp/m3a-audit-"), ws = join(base, "B7-2"), lib = `${ws}/node_modules/@m3a/library/dist/node.js`;
    const call = (name: string, input: object) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
    made.push(base);
    for (const d of ["src", "node_modules/@m3a/library/dist", "../B7-1/src"]) mkdirSync(join(ws, d), { recursive: true });
    writeFileSync(lib, "");
    const lines = [
      // G6's B7-2 on the variant: the library's Node entry named in an import line a heredoc writes, replaced before it ran
      call("Bash", { command: `cd ${ws}; cat > /tmp/cat.mjs <<'E'\nimport { openLibrary } from "${lib}";\nE\nls node_modules/@m3a/library` }),
      // a Write's content and an Edit's new string: absolute paths, and a relative one from the written file's directory
      call("Write", { file_path: "src/probe.ts", content: `import x from "../../B7-1/src";\nimport "${lib}";\nreadFileSync("${ROOT}/PLAN.md");` }),
      call("Edit", { file_path: `${ws}/src/probe.ts`, old_string: "x", new_string: `y from "${ROOT}/bench/graders/B7/grade.ts"` }),
    ];
    expect(audit(lines, ws, true)).toEqual({ outside: [`${ROOT}/PLAN.md`, `${ROOT}/bench/graders/B7/grade.ts`], scratch: [`${base}/B7-1/src`, "/tmp/cat.mjs"].sort(), pastManual: [] });
    expect(audit(lines, ws).outside).toEqual([`${ROOT}/PLAN.md`, `${ROOT}/bench/graders/B7/grade.ts`, `${base}/B7-1/src`, "/tmp/cat.mjs"].sort());
    // a heredoc a command runs is a script it reads, and its output written to a file doesn't make it one (nor `2>`)
    const run = [call("Bash", { command: `node <<'E' > out.txt 2>/tmp/err\nconsole.log(readFileSync("${lib}", "utf8"))\nE` })];
    expect(audit(run, ws, true).pastManual).toEqual(["node_modules/@m3a/library/dist/node.js"]);
    expect(pathsOf("Bash", { command: `tee -a /tmp/t.mjs <<E\n"${lib}"\nE` }).find((n) => n.path === lib)).toEqual({ path: lib, lists: false, names: true });
    // another process's root, cwd or environment is outside, and /proc/self/root/<p> is /<p>; its own /proc entries aren't
    const proc = [call("Bash", { command: `ls /proc/1/root/home; cat /proc/42/environ /proc/self/status /proc/cpuinfo /proc/self/root${ROOT}/PLAN.md` })];
    expect(audit(proc, ws, true).outside).toEqual(["/proc/1/root/home", "/proc/42/environ", `${ROOT}/PLAN.md`].sort());
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
  // every checkout of the repository (`git worktree list`, ROOT among them) and what `hidden` covers: a sibling worktree
  // with the graders shows nothing either (D91)
  const checkouts = [...new Set([...execFileSync("git", ["-C", ROOT, "worktree", "list", "--porcelain"], { encoding: "utf8" }).split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9)), ...hidden()])];
  // a stand-in for `claude`, first on the PATH the agent keeps: it says where it started, what its /tmp holds, how much
  // of the repository and of its other checkouts it sees, and what /proc shows (how many processes, whether PID 1 is
  // itself, whether the test's own process and PID 1's view of the repository can be reached), and writes a scratch
  // file to /tmp by name, as agents do
  const stand = (home: string) => {
    mkdirSync(join(home, "bin"), { recursive: true });
    const sh = join(home, "bin", "claude");
    writeFileSync(sh, [
      "#!/bin/sh",
      "before=$(ls -A /tmp | tr '\\n' ' ')",
      'echo "$PWD" > /tmp/cat.mjs',
      `repo=$(ls -A '${ROOT}' 2>/dev/null | wc -l)`,
      `others=$(for d in ${checkouts.map((d) => `'${d}'`).join(" ")}; do ls -A "$d" 2>/dev/null; done | wc -l)`,
      "pids=$(ls /proc | grep -c '^[0-9]')",
      "one=$(tr '\\0' '\\n' < /proc/1/cmdline | grep -c '/bin/claude$')",
      `host=$(ls -A /proc/${process.pid}/root/ 2>/dev/null | wc -l)`,
      `root=$(ls -A '/proc/1/root${ROOT}' 2>/dev/null | wc -l)`,
      `printf '{"type":"result","subtype":"success","num_turns":1,"result":"%s|%s|%s|%s|%s|%s|%s|%s|%s|%s"}\\n' "$PWD" "$TMPDIR" "$before" "$(cat /tmp/cat.mjs)" "$repo" "$others" "$pids" "$one" "$host" "$root"`,
      "",
    ].join("\n"));
    chmodSync(sh, 0o755);
    return join(home, "bin");
  };
  it("hides every worktree of the repository, its git directory and the Claude home, a worktree inside another's checkout under it (D91)", () => {
    const base = temp("m3a-worktrees-"), main = join(base, "main"), git = (...a: string[]) => execFileSync("git", ["-C", main, ...a], { stdio: "ignore" });
    mkdirSync(main);
    git("init", "-q");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "t");
    git("worktree", "add", "-q", "--detach", join(base, "sibling"));
    git("worktree", "add", "-q", "--detach", join(main, ".claude/worktrees/lane"));
    const want = [main, join(base, "sibling"), join(homedir(), ".claude")].sort();
    expect([hidden(main), hidden(join(base, "sibling")), hidden(join(main, ".claude/worktrees/lane"))]).toEqual([want, want, want]);
    expect(hidden(temp("m3a-nogit-"))).toContain(join(homedir(), ".claude"));
  });
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
        const ws = wss[i]!, [pwd, tmp, before, cat, repo, others, pids, one, host, root] = r.reply.split("|").map((x) => x.trim());
        expect([r.ok, r.privateTmp, pwd, tmp, cat], r.error).toEqual([true, true, ws, "/tmp", ws]);
        // its /tmp held only the way to its own workspace and home, and the repository and its other checkouts showed
        // empty (D91)
        expect(before).toBe(base.split("/")[2]);
        expect([repo, others]).toEqual(["0", "0"]);
        // alone in /proc: PID 1 is itself, a handful of processes, the test's own process and PID 1's view of the
        // repository out of reach (D91)
        expect(r.ownPids, "this machine can't make a PID namespace (unshare --pid), so /proc would show its processes").toBe(true);
        expect([one, host, root, Number(pids) < 10]).toEqual(["1", "0", "0", true]);
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
