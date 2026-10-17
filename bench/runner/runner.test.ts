// The benchmark runner (WP-4.7): the audit of a transcript (paths outside the workspace, files read past the manual,
// a shell's relative paths among them, D88; what a file it writes names, and another process's /proc, D91), the legend
// quiz's prompt and scoring, a fake trial through the packed packages installed in a workspace outside the repository,
// agents run a few at once, each `claude` started in its workspace with a /tmp of its own, every checkout of the
// repository hidden, the CLI's account file empty, its processes alone in /proc and unable to unmount what hides the
// repository (D84, D91), as an unprivileged user with no capabilities whom /root, the raw disks and the covers refuse,
// its workspace and home its own (a link in them handed, never what it leads to), /var/tmp and /dev/shm its own too,
// and the proxy's CA copied into that home; and a held-out variant given by path, whose known-good solution runs first.
// m3a's wiring (WP-7.3): the agent's flags (the Skill tool, project settings, the CLI's own skills off, m3a's MCP server
// from the installed package, its tools allowed), the init event's skills each recorded, the skill in a trial's
// workspace as a regular file naming what the installed package holds, the packed m3a bin and MCP server answering there, an init event showing the server failed stopping the agent
// and failing its trial though its workspace grades, and the manual, the skill and llms.txt not counted as reads past
// the manual. No test spends: a stand-in `claude` plays the agent.
// Every temporary directory a test makes is removed after it.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { TOOLS } from "@m3a/tools";
import { agentArgs, agentUser, audit, capsDropped, CLOUD_CREDENTIALS, hidden, M3A_MCP, namespace, ONLY_M3A, ownScratch, pathsOf, runAgent, unwired, wiringOf } from "./agent.ts";
import { commitOf, knownGood, lanes, latestVariant, pool, runB1, variantOf } from "./main.ts";
import { pack } from "./pack.ts";
import { answersIn, QUIZ, quizPrompt, score } from "./quiz.ts";
import { SKILL } from "./workspace.ts";

const ROOT = join(import.meta.dirname, "../..");
/** The init event that opens a stream-json transcript, as the CLI writes it (claude 2.1.302), m3a's server `status`. */
const init = (status: string, skills = ["m3a"]) => JSON.stringify({ type: "system", subtype: "init", tools: ["Bash", "Skill"], mcp_servers: [{ name: "m3a", status, source: "dynamic" }], skills });
/** A stand-in `claude` in `home`'s bin/ (the agent's user reads it there), running `script`; returns that directory. */
const standIn = (home: string, script: readonly string[]) => {
  mkdirSync(join(home, "bin"), { recursive: true });
  writeFileSync(join(home, "bin", "claude"), ["#!/bin/sh", ...script, ""].join("\n"));
  chmodSync(join(home, "bin", "claude"), 0o755);
  return join(home, "bin");
};
/** The tools an MCP server lists, started as `config` gives it in `cwd`, after the legacy handshake, and its result for
 *  one tool call (`call`); it ends with its input. */
function mcpTools(config: { command: string; args: readonly string[] }, cwd: string, call: { name: string; arguments: object }): { status: number | null; stderr: string; tools: string[]; called: { isError?: boolean; content?: { text?: string }[] } } {
  const messages = [{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "runner.test", version: "0" } } }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }, { jsonrpc: "2.0", id: 3, method: "tools/call", params: call }];
  const r = spawnSync(config.command === "node" ? process.execPath : config.command, config.args, { cwd, input: messages.map((m) => `${JSON.stringify(m)}\n`).join(""), encoding: "utf8", timeout: 60_000 });
  const replies = r.stdout.trim().split("\n").map((l) => JSON.parse(l) as { id?: number; result?: { tools?: { name: string }[]; isError?: boolean; content?: { text?: string }[] } });
  return { status: r.status, stderr: r.stderr, tools: replies.find((m) => m.id === 2)?.result?.tools?.map((t) => t.name) ?? [], called: replies.find((m) => m.id === 3)?.result ?? {} };
}
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
    // so are its files in /var/tmp and /dev/shm, each its own where its namespace covers it (a directory, not a link),
    // and outside where it has none (other agents share them); the directories themselves, and /dev/null, are ordinary
    const shared = [call("Bash", { command: "ls /var/tmp /dev/shm > /dev/null && echo x > /var/tmp/v.mjs" }), call("Write", { file_path: "/dev/shm/s.mjs", content: "" })];
    const own = ownScratch().filter((d) => d !== "/tmp"), files = ["/dev/shm/s.mjs", "/var/tmp/v.mjs"];
    expect(own).toEqual(["/var/tmp", "/dev/shm"].filter((d) => existsSync(d) && lstatSync(d).isDirectory()));
    expect(audit(shared, ws, true)).toEqual({ outside: files.filter((f) => !own.some((d) => f.startsWith(`${d}/`))), scratch: files.filter((f) => own.some((d) => f.startsWith(`${d}/`))), pastManual: [] });
    expect(audit(shared, ws)).toEqual({ outside: files, scratch: [], pastManual: [] });
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
      // a JS template literal's path
      call("Write", { file_path: "src/read.ts", content: "readFileSync(`" + ROOT + "/DOCTRINE.md`, \"utf8\");" }),
    ];
    const named = [`${ROOT}/DOCTRINE.md`, `${ROOT}/PLAN.md`, `${ROOT}/bench/graders/B7/grade.ts`];
    expect(audit(lines, ws, true)).toEqual({ outside: named, scratch: [`${base}/B7-1/src`, "/tmp/cat.mjs"].sort(), pastManual: [] });
    expect(audit(lines, ws).outside).toEqual([...named, `${base}/B7-1/src`, "/tmp/cat.mjs"].sort());
    // a heredoc a command runs is a script it reads, and its output written to a file doesn't make it one (nor `2>`)
    const run = [call("Bash", { command: `node <<'E' > out.txt 2>/tmp/err\nconsole.log(readFileSync("${lib}", "utf8"))\nE` })];
    expect(audit(run, ws, true).pastManual).toEqual(["node_modules/@m3a/library/dist/node.js"]);
    expect(pathsOf("Bash", { command: `tee -a /tmp/t.mjs <<E\n"${lib}"\nE` }).find((n) => n.path === lib)).toEqual({ path: lib, lists: false, names: true });
    // another process's root, cwd or environment is outside, by PID, glob or shell variable (a loop's over `$(...)`
    // too), and /proc/self/root/<p> is /<p>; its own /proc entries aren't (self, thread-self, the shell's `$$`)
    const proc = [
      call("Bash", { command: `ls /proc/1/root/home; cat /proc/42/environ /proc/self/status /proc/cpuinfo /proc/self/root${ROOT}/PLAN.md` }),
      call("Bash", { command: `cat /proc/*/environ "/proc/$pid/cmdline" /proc/$$/status /proc/thread-self/status /proc/$$/root${ROOT}/AGENTS.md` }),
      call("Bash", { command: "for p in $(pgrep node); do ls /proc/$p/root/home; done" }),
    ];
    expect(audit(proc, ws, true).outside).toEqual(["/proc/$p/root/home", "/proc/$pid/cmdline", "/proc/*/environ", "/proc/1/root/home", "/proc/42/environ", `${ROOT}/AGENTS.md`, `${ROOT}/PLAN.md`].sort());
  });
  it("counts reading the manual, the skill and llms.txt as reading the manual, not past it (WP-7.3)", () => {
    const ws = "/tmp/m3a-bench/run/B1-1", read = (file_path: string) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path } }] } });
    const lines = [
      // the skill the runner copies into the workspace, and the Skill tool loading it (no path)
      read(`${ws}/.claude/skills/m3a/SKILL.md`),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "m3a" } }] } }),
      // the manual, and the skill and llms.txt where a package will ship them
      ...["tools/MANUAL.md", "tools/llms.txt", "tools/skills/m3a/SKILL.md", "core/llms.txt"].map((f) => read(`${ws}/node_modules/@m3a/${f}`)),
      // past it: the packages' code, and a file of the same name elsewhere in one
      ...["tools/dist/node.js", "tools/dist/llms.txt", "core/MANUAL.md"].map((f) => read(`${ws}/node_modules/@m3a/${f}`)),
    ];
    expect(audit(lines, ws)).toEqual({ outside: [], scratch: [], pastManual: ["core/MANUAL.md", "tools/dist/llms.txt", "tools/dist/node.js"].map((f) => `node_modules/@m3a/${f}`) });
  });
});

describe("m3a's wiring (WP-7.3)", () => {
  const value = (args: string[], flag: string) => args[args.indexOf(flag) + 1];
  it("gives the agent the Skill tool, settings from its workspace alone, no skill but m3a's and m3a's MCP server from the installed package", () => {
    const args = agentArgs("hello");
    expect([value(args, "--tools"), value(args, "--allowedTools"), value(args, "--setting-sources")]).toEqual(["Bash,Read,Write,Edit,Glob,Grep,Skill", "Bash,Read,Write,Edit,Glob,Grep,Skill,mcp__m3a__*", "project"]);
    expect(JSON.parse(value(args, "--mcp-config")!)).toEqual({ mcpServers: { m3a: { command: "node", args: ["node_modules/@m3a/tools/dist/node.js", "mcp"] } } });
    expect(JSON.parse(value(args, "--mcp-config")!)).toEqual(M3A_MCP);
    expect(args).toContain("--strict-mcp-config");
    // the CLI's own skills off, so m3a's is the only one offered: its bundled ones, and those claude 2.1.302 lists past
    expect(JSON.parse(value(args, "--settings")!)).toEqual({ disableBundledSkills: true, skillOverrides: { design: "off", doctor: "off", "plugin-authoring": "off" } });
    expect(JSON.parse(value(args, "--settings")!)).toEqual(ONLY_M3A);
    // turned off (the legend quiz, no tools and no package): no Skill, no server, still no server but those given
    const quiz = agentArgs("q", { tools: "", m3a: false });
    expect([value(quiz, "--tools"), value(quiz, "--allowedTools"), quiz.includes("--mcp-config"), quiz.includes("--strict-mcp-config")]).toEqual(["", "", false, true]);
    expect(value(agentArgs("q", { tools: "" }), "--tools")).toBe("Skill");
  });
  it("reads the init event: the server connected and the skill loaded, or why not", () => {
    expect(wiringOf(["not json", JSON.stringify({ type: "system", subtype: "hook_started" }), init("connected")])).toEqual({ server: "connected", skill: true, skills: ["m3a"] });
    // every skill the event lists is kept: one a later CLI adds past ONLY_M3A shows in the run, though the wiring holds
    expect(wiringOf([init("connected", ["m3a", "deep-research"])])).toEqual({ server: "connected", skill: true, skills: ["m3a", "deep-research"] });
    expect(unwired(wiringOf([init("connected", ["m3a", "deep-research"])]))).toBeNull();
    expect(unwired(wiringOf([init("connected")]))).toBeNull();
    expect(unwired(wiringOf([init("failed")]))).toMatch(/^m3a's wiring failed: its MCP server is failed, not connected/);
    expect(unwired(wiringOf([init("pending", [])]))).toMatch(/its MCP server is pending, not connected; its skill isn't loaded/);
    expect(unwired(wiringOf([JSON.stringify({ type: "system", subtype: "init", mcp_servers: [], skills: ["m3a"] })]))).toMatch(/its MCP server is missing/);
    expect([wiringOf([]), unwired(null)]).toEqual([null, "m3a's wiring went unchecked: the stream had no init event"]);
  });
  it("runs an agent whose server connected to the end, and stops one whose server failed at its init event", async () => {
    const base = temp("m3a-wiring-"), path = process.env.PATH, wss = ["W-1", "W-2"].map((n) => join(base, n));
    for (const ws of wss) mkdirSync(ws);
    // the first connects; the second's server failed, and it would wait for ever if it weren't stopped
    const bins = [
      standIn(`${wss[0]}-home`, [`printf '%s\\n' '${init("connected")}'`, `printf '%s\\n' '{"type":"result","subtype":"success","num_turns":1,"result":"done"}'`]),
      standIn(`${wss[1]}-home`, [`printf '%s\\n' '${init("failed")}'`, "exec tail -f /dev/null"]),
    ];
    process.env.PATH = `${bins.join(":")}:${path}`;
    try {
      const [ok, dead] = await pool(wss, 2, (ws) => runAgent(ws, "hello", `${ws}.jsonl`, { timeoutMs: 120_000 }));
      const failed = { server: "failed", skill: true, skills: ["m3a"] };
      expect([ok!.ok, ok!.m3a, ok!.unwired, ok!.error, ok!.reply]).toEqual([true, { server: "connected", skill: true, skills: ["m3a"] }, undefined, undefined, "done"]);
      expect([dead!.ok, dead!.m3a, dead!.unwired, dead!.error]).toEqual([false, failed, unwired(failed), unwired(failed)]);
      // stopped at its init event: its transcript holds that alone
      expect(readFileSync(`${wss[1]}.jsonl`, "utf8").trim().split("\n")).toEqual([init("failed")]);
    } finally {
      process.env.PATH = path;
    }
  }, 60_000);
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
  // the CLI's account file beside the Claude home, and what covers the repository
  const conf = join(homedir(), ".claude.json"), cover = hidden().find((d) => ROOT === d || ROOT.startsWith(`${d}/`))!;
  // a stand-in for `claude`, first on the PATH the agent keeps: it says where it started, what its /tmp holds, how much
  // of the repository and of its other checkouts it sees and how many of them open, and what /proc shows (how many
  // processes, whether PID 1 is itself, whether the test's own process and PID 1's view of the repository can be
  // reached), how much of the CLI's account file it reads, whether it can unmount what covers the repository, who it is
  // and with what capabilities, whether /root and the raw disks open, whether it can write its workspace and home,
  // where its CA is and whose the CLI's credentials are (a cloud session's: it doesn't read them); and writes a scratch
  // file to /tmp, /var/tmp and /dev/shm by name, as agents do, after saying what the last two held. Its stream opens
  // with an init event showing m3a's wiring held (WP-7.3), and it replies name=value pairs.
  const stand = (home: string) => {
    mkdirSync(join(home, "bin"), { recursive: true });
    const sh = join(home, "bin", "claude"), all = checkouts.map((d) => `'${d}'`).join(" ");
    const lines = [
      "before=$(ls -A /tmp | tr '\\n' ' ')",
      'echo "$PWD" > /tmp/cat.mjs',
      "cat=$(cat /tmp/cat.mjs)",
      "shared=$(ls -A /var/tmp /dev/shm 2>/dev/null | grep -v ':$' | grep -c .)",
      'echo "$PWD" > /var/tmp/cat.mjs; echo "$PWD" > /dev/shm/cat.mjs',
      "vcat=$(cat /var/tmp/cat.mjs /dev/shm/cat.mjs | sort -u)",
      `repo=$(ls -A '${ROOT}' 2>/dev/null | wc -l)`,
      `others=$(for d in ${all}; do ls -A "$d" 2>/dev/null; done | wc -l)`,
      `opened=$(for d in ${all}; do ls -A "$d" >/dev/null 2>&1 && echo "$d"; done | wc -l)`,
      "pids=$(ls /proc | grep -c '^[0-9]')",
      "one=$(tr '\\0' '\\n' < /proc/1/cmdline | grep -c '/bin/claude$')",
      `host=$(ls -A /proc/${process.pid}/root/ 2>/dev/null | wc -l)`,
      `viaPid1=$(ls -A '/proc/1/root${ROOT}' 2>/dev/null | wc -l)`,
      `conf=$(cat '${conf}' 2>/dev/null | wc -c)`,
      `um=$(umount '${cover}' 2>/dev/null && echo unmounted || echo refused)`,
      "uid=$(id -u)",
      "caps=$(sed -n 's/^CapEff:[[:space:]]*//p' /proc/self/status)",
      "rootHome=$(ls -A /root >/dev/null 2>&1 && echo read || echo refused)",
      'disks=$(for d in /dev/[hsv]d[a-z] /dev/xvd[a-z] /dev/nvme[0-9]n[0-9]; do [ -b "$d" ] && head -c 1 "$d" >/dev/null 2>&1 && echo "$d"; done | wc -l)',
      'wrote=$(touch "$PWD/written" "$HOME/written" && echo yes || echo no)',
      'ca=$(if [ -z "$NODE_EXTRA_CA_CERTS" ]; then echo unset; elif [ -r "$NODE_EXTRA_CA_CERTS" ]; then echo "$NODE_EXTRA_CA_CERTS"; else echo unreadable; fi)',
      `creds=$(if [ -d '${CLOUD_CREDENTIALS}' ]; then [ -O '${CLOUD_CREDENTIALS}' ] && echo own || echo other; else echo none; fi)`,
    ];
    const names = ["pwd=$PWD", "tmp=$TMPDIR", ...lines.filter((l) => /^\w+=\$\(/.test(l)).map((l) => l.split("=")[0]!).map((n) => `${n}=$${n}`)];
    writeFileSync(sh, ["#!/bin/sh", `printf '%s\\n' '${init("connected")}'`, ...lines, `printf '{"type":"result","subtype":"success","num_turns":1,"result":"%s"}\\n' "${names.join("|")}"`, ""].join("\n"));
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
  it("starts claude in its workspace with a /tmp of its own, as an unprivileged user: two at once write /tmp/cat.mjs and never meet", async () => {
    expect(namespace(), "this machine can't make a mount namespace (unshare), so agents would share /tmp").not.toBeNull();
    const base = temp("m3a-own-tmp-"), path = process.env.PATH;
    const wss = ["A-1", "A-2"].map((n) => {
      mkdirSync(join(base, n), { recursive: true });
      return join(base, n);
    });
    process.env.PATH = `${wss.map((ws) => stand(`${ws}-home`)).join(":")}:${path}`;
    // a directory link in each workspace to a directory outside it, the runner's: handing the workspace to its user
    // hands the link alone, never what it leads to nor anything through it
    const outside = join(base, "outside"), me = process.getuid?.() ?? 0;
    mkdirSync(join(outside, "sub"), { recursive: true });
    writeFileSync(join(outside, "sub", "kept"), "");
    for (const ws of wss) symlinkSync("../outside", join(ws, "link"));
    try {
      const runs = await pool(wss, 2, (ws) => runAgent(ws, "hello", `${ws}.jsonl`));
      for (const [i, r] of runs.entries()) {
        const ws = wss[i]!, s = Object.fromEntries(r.reply.split("|").map((x) => [x.split("=")[0]!, x.slice(x.indexOf("=") + 1).trim()]));
        expect([r.ok, r.privateTmp, s.pwd, s.tmp, s.cat], r.error).toEqual([true, true, ws, "/tmp", ws]);
        // its /tmp held only the way to its own workspace and home, and the repository and its other checkouts showed
        // empty (D91)
        expect(s.before).toBe(base.split("/")[2]);
        expect([s.repo, s.others]).toEqual(["0", "0"]);
        // alone in /proc: PID 1 is itself, a handful of processes, the test's own process and PID 1's view of the
        // repository out of reach (D91)
        expect(r.ownPids, "this machine can't make a PID namespace (unshare --pid), so /proc would show its processes").toBe(true);
        expect([s.one, s.host, s.viaPid1, Number(s.pids) < 10]).toEqual(["1", "0", "0", true]);
        // the CLI's account file reads empty (covered, or out of its reach), and where setpriv works it starts with no
        // capabilities, so what covers the repository stays (D91)
        expect(s.conf).toBe("0");
        expect(r.capsDropped).toBe(capsDropped());
        if (r.capsDropped) expect([s.caps, s.um]).toEqual(["0000000000000000", "refused"]);
        // an unprivileged user: nobody where the runner is root (every checkout refuses it, not just shows empty), the
        // runner where it isn't (root only in its user namespace); /root and the raw disks refuse it either way
        const u = agentUser();
        expect([r.uid, r.unprivileged], "this machine can't start agents as an unprivileged user (setpriv, nobody), so /root and the raw disks would be open to them").toEqual([u.uid, true]);
        expect([s.uid, s.rootHome, s.disks]).toEqual([u.switched ? String(u.uid) : "0", "refused", "0"]);
        if (u.switched) expect(s.opened).toBe("0");
        // it wrote its workspace and its home, and read the proxy's CA from a copy in that home
        expect([s.wrote, existsSync(join(ws, "written")), existsSync(`${ws}-home/written`)]).toEqual(["yes", true, true]);
        expect(s.ca).toBe(process.env.NODE_EXTRA_CA_CERTS ? `${ws}-home/.ca/NODE_EXTRA_CA_CERTS.pem` : "unset");
        // in a cloud session, the CLI's credentials are its own user's in its namespace, a copy: the session's stay root's
        // (a runner that isn't root can't read them, nor hand them on)
        expect(s.creds).toBe(!existsSync(CLOUD_CREDENTIALS) ? "none" : process.getuid?.() === 0 ? "own" : "other");
        if (existsSync(CLOUD_CREDENTIALS)) expect(statSync(CLOUD_CREDENTIALS).uid).toBe(0);
        // the link in its workspace is its user's; what the link leads to, and what lies through it, stayed the runner's
        expect([lstatSync(join(ws, "link")).uid, ...["", "sub", "sub/kept"].map((f) => statSync(join(outside, f)).uid)]).toEqual([r.uid, me, me, me]);
        // its scratch file landed in its own /tmp, beside its workspace, which the runner reads after it; /var/tmp and
        // /dev/shm were empty and its own too (two at once never meet there), gone with its namespace
        expect(readFileSync(`${ws}-tmp/cat.mjs`, "utf8").trim()).toBe(ws);
        expect([s.shared, s.vcat]).toEqual(["0", ws]);
      }
      for (const f of ["/tmp/cat.mjs", "/var/tmp/cat.mjs", "/dev/shm/cat.mjs"]) expect(existsSync(f) && readFileSync(f, "utf8").trim().startsWith(base), f).toBe(false);
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
    // the skill the package will ship, as regular files where Claude Code reads a project's skills: a link would lead into
    // the repository, which the agent can't see (WP-7.3)
    const ws = join(base, "B1-1"), skill = join(ws, SKILL.to, "SKILL.md");
    for (const d of [".claude", ".claude/skills", SKILL.to]) expect(lstatSync(join(ws, d)).isDirectory(), d).toBe(true);
    expect([lstatSync(skill).isFile(), readFileSync(skill, "utf8")]).toEqual([true, readFileSync(join(ROOT, "skills/m3a/SKILL.md"), "utf8")]);
    // every installed file it names is there
    const named = [...readFileSync(skill, "utf8").matchAll(/node_modules\/@m3a\/[\w./-]+/g)].map((m) => m[0]);
    expect(named).toContain("node_modules/@m3a/tools/MANUAL.md");
    for (const f of named) expect(existsSync(join(ws, f)), f).toBe(true);
    // the packed m3a runs there: its bin from dist/ (the skill's `npx m3a` commands), and its MCP server as the agent's
    // --mcp-config starts it, listing every tool
    expect(JSON.parse(readFileSync(join(ws, "node_modules/@m3a/tools/package.json"), "utf8")).bin).toEqual({ m3a: "./dist/node.js" });
    expect(execFileSync(join(ws, "node_modules/.bin/m3a"), ["version"], { cwd: ws, encoding: "utf8" })).toMatch(/^m3a \d+\.\d+\.\d+, clip format/);
    const mcp = mcpTools(M3A_MCP.mcpServers.m3a, ws, { name: "search", arguments: { query: "walk", limit: 1 } });
    expect([mcp.status, mcp.stderr, mcp.tools]).toEqual([0, "", TOOLS.map((t) => t.name.replace(/\./g, "_"))]);
    // and its tools work on the installed library, the CC0 default pack: a search finds a clip there
    expect([mcp.called.isError, mcp.called.content?.[0]?.text]).toEqual([false, expect.stringMatching(/^search "walk": 1 of \d+ clips \(tiers cc0\)\n(QUATERNIUS_3D2DGE|QUATERNIUS_SHARDFALL|MESH2MOTION)\//)]);
  }, 300_000);
  it("runs a variant given by path, its known-good solution first: on a character from a seed outside the test set; there a trial whose agent's MCP server failed fails, though it grades", async () => {
    const dir = join(base, "variant");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "brief.md"), "# B1, reworded\nMake the character idle, walk and run by speed (see the starter).\n");
    writeFileSync(join(dir, "character.json"), JSON.stringify({ seed: 41 }));
    expect(variantOf(dir).character).toEqual({ seed: 41 });
    // the trial's agent (no fake): a stand-in that writes the known-good solution, then shows m3a's MCP server failed at
    // its init event, and would wait for ever after if it weren't stopped
    const path = process.env.PATH, write = Object.entries(knownGood("B1")).flatMap(([f, text]) => [`mkdir -p "$(dirname '${f}')"`, `cat > '${f}' <<'M3A_EOF'`, text.replace(/\n$/, ""), "M3A_EOF"]);
    process.env.PATH = `${standIn(join(base, "v", "B1-1-home"), [...write, `printf '%s\\n' '${init("failed")}'`, "exec tail -f /dev/null"])}:${path}`;
    let r: Awaited<ReturnType<typeof runB1>>;
    try {
      r = await runB1({ trials: 1, discovery: 0, base: join(base, "v"), packs, variant: dir });
    } finally {
      process.env.PATH = path;
    }
    expect(r.check?.pass, r.check?.failed.join("\n")).toBe(true);
    // its workspace grades (the known-good solution), and the trial fails on the wiring alone, saying so
    const t = r.trials[0]!;
    const failed = { server: "failed", skill: true, skills: ["m3a"] };
    expect([t.pass, t.failed]).toEqual([false, [unwired(failed)]]);
    expect(t.agent).toMatchObject({ ok: false, m3a: failed, unwired: t.failed[0] });
    // a variant whose rig isn't fetched stops before any trial, naming how to fetch it
    writeFileSync(join(dir, "character.json"), JSON.stringify({ manifest: "rigs.json", rig: "nowhere" }));
    writeFileSync(join(dir, "rigs.json"), JSON.stringify({ rigs: [] }));
    await expect(runB1({ trials: 1, discovery: 0, base: join(base, "w"), packs, fake: true, variant: dir })).rejects.toThrow(/npm run fixtures -- fetch --manifest/);
  }, 300_000);
});
