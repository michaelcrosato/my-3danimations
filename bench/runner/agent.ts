// A fresh agent on a benchmark workspace (PLAN.md §7, WP-4.7). Isolation level 1: the `claude` CLI in print mode,
// started in the workspace with a clean environment (the proxy and its certificates, nothing of this session's: no
// tokens, no repository) and a fresh home (no settings, skills or memory), its tools limited to files and a shell.
// Where the machine allows a mount namespace (`unshare`), each agent gets a /tmp of its own, holding only its workspace
// and home, and every checkout of the repository (each worktree, with the graders, the known-good solutions and the
// held-out originals), its git directory and this session's Claude home are hidden from it (D84, D91): agents write
// scratch files to /tmp by name, so agents run at once no longer meet there. Where the machine allows a PID namespace
// too, /proc shows only the agent's own processes, so no /proc/<pid>/root reaches the machine's view (D91).
// Why hide, not allow: every copy of the graders outside /tmp on this machine lies in a worktree (`find /`, 2026-10-15),
// and covering directories keeps D84's mechanism, tested as root and through a user namespace on CI; a fresh root
// holding only what an agent needs would have to carry everything the CLI reaches for (the node installs, the resolver's
// files, the proxy's CA), and a miss would show only as failed trials at a gate. Neither would stop an agent running as
// root from unmounting what covers the repository (or leaving a fresh root): the audit below lists any path outside.
// The transcript (stream-json) is kept; the run records its time, tokens, cost and turns, and the audit lists every
// path it touched outside the workspace (and its own /tmp's scratch files apart) and every file it read past the
// manual (the packages' code in node_modules), a shell command's relative paths resolved as its shell would (D88).
// The audit's known limits (D88, D91):
// - over-reports: a grep pattern or a here-string naming a package path counts as a read; so does a path in a script
//   a command runs as it is given (`node -e`, a heredoc fed to `node` or `python3`), whether or not the script reads it;
// - under-reports: brace expansion, a subshell's `cd`, `pushd`, `cd` through a variable and `cd -` are missed, and
//   xargs and `$(...)` approximate; a path named in a file the agent writes (a Write's content, an Edit's new string, a
//   heredoc that `cat` or `tee` writes) is scanned for `outside` and `scratch` but isn't a read, so a script that later
//   runs and reads it isn't counted (G6's B7-2 on the variant only named a package's Node entry in an import line it
//   wrote, and replaced it before running anything); relative paths in such a file are taken only as `./` or `../`
//   strings, from its directory, and only when they exist.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";

/** What one agent run did. */
export interface AgentRun {
  isolation: 1 | 3;
  /** Whether it ran with a /tmp of its own, the repository hidden (D84). */
  privateTmp: boolean;
  /** Whether its processes ran in a PID namespace of their own, /proc showing only them (D91). */
  ownPids: boolean;
  ok: boolean;
  ms: number;
  model: string;
  turns: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  costUsd: number;
  /** Paths it touched outside its workspace (an isolation breach to read about in the transcript). */
  outside: string[];
  /** Paths in its own /tmp outside its workspace: its scratch files, which no other agent sees (D84). */
  scratch: string[];
  /** Files it read inside the workspace past the manual and the starter: the packages' own code and data. */
  pastManual: string[];
  transcript: string;
  /** Its last message's text. */
  reply: string;
  error?: string;
}
/** How to run the agent. */
export interface AgentOptions {
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
  /** The tools it may use. */
  tools?: string;
}

/** The variables a trial keeps from this process: the network's proxy and certificates, a PATH; nothing else. */
const KEEP = ["PATH", "ANTHROPIC_BASE_URL", "HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "LANG"];

/** The repository the runner runs from. */
const REPO = join(import.meta.dirname, "../..");
/** Whether `path` is `dir` or under it. */
const within = (path: string, dir: string) => path === dir || path.startsWith(`${dir}/`);

/**
 * What the agents must not see (D84, D91): every checkout of the repository `repo` (`git worktree list`: the one the
 * runner runs from, the main one and every other worktree, each with the graders, the known-good solutions and the
 * held-out originals), its git directory (every commit's files) and this session's Claude home. A directory inside
 * another is left out, the outer one's cover hiding it (a worktree under .claude/worktrees/ of the main checkout). Where
 * `repo` isn't a git checkout, the repository alone.
 */
export function hidden(repo = REPO): string[] {
  const dirs = [resolve(repo), join(homedir(), ".claude")];
  try {
    const git = (...a: string[]) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    for (const line of git("worktree", "list", "--porcelain").split("\n")) if (line.startsWith("worktree ")) dirs.push(resolve(line.slice(9)));
    dirs.push(resolve(repo, git("rev-parse", "--path-format=absolute", "--git-common-dir").trim()));
  } catch {
    // not a git checkout (an unpacked copy): the repository alone
  }
  const all = [...new Set(dirs.map((d) => normalize(d)))];
  return all.filter((d) => !all.some((o) => o !== d && within(d, o))).sort();
}

/** A path a tool call names (absolute; a glob as written), and whether the call only lists it (`ls`, Glob) or reads it. */
export interface Named {
  path: string;
  lists: boolean;
  /** Named only in the text of a file the call writes (a Write's content, an Edit's new string, a heredoc `cat` or `tee`
   *  writes): not read by the call, though a script that later runs may read it (D91). */
  names?: true;
}
/**
 * Where a tool call runs: its workspace, and its shell's directory, which a command's `cd`s move and the next command
 * starts from (the CLI's shell keeps it from call to call, and puts it back at the workspace when a call leaves it).
 * `exists` says whether a path is there as the agent sees it (with a /tmp of its own, D84, in `<trial>-tmp`).
 */
export interface Where {
  workspace: string;
  cwd: string;
  exists?: (path: string) => boolean;
}
/** Commands that name paths without reading them: what they list, enter, make or remove is touched, not read (as Glob). */
const LISTS = new Set(["ls", "cd", "find", "tree", "du", "stat", "mkdir", "rmdir", "rm", "touch", "echo", "printf", "test", "[", "realpath", "readlink", "dirname", "basename", "for"]);
/** Words that open a command without being it. */
const LEADS = new Set(["do", "then", "else", "elif", "if", "while", "until", "!", "{", "time"]);
/** A word of path characters, a glob's among them. */
const PATHLIKE = /^[\w.@+~*?[\]/-]+$/;
/** An absolute path in a script, a pattern or a heredoc: path characters standing alone (no glob). */
const ABSOLUTE = /(?:^|[\s'"=:(])(\/[\w.@+~-]+(?:\/[\w.@+~-]*)*)(?=$|[\s'"`;|&)<>])/g;
/** A relative path in a file's text, as a module names one: a quoted string starting `./` or `../`. */
const RELATIVE = /(["'`])(\.\.?\/[\w.@+~/-]*)\1/g;

/** A heredoc: its body, the command it feeds (its words, as `commands` holds them) and the file it is written to, when
 *  that command is `cat` with its output to a file, or `tee` (a word as written, from the shell's directory). */
interface Heredoc {
  body: string;
  of: string[];
  to: string | null;
}
/**
 * A shell command's simple commands (split at newlines, `;`, `&&`, `||`, `|`, `&`, parentheses and `$(`), each its
 * words with the quotes taken off, a redirection's file kept as a word and its descriptors (`2>&1`) dropped; and its
 * heredocs apart, their bodies as text. A sketch of the shell's grammar: enough to tell which words a command names.
 */
function shellWords(command: string): { commands: string[][]; heredocs: Heredoc[] } {
  const commands: string[][] = [], heredocs: Heredoc[] = [], pending: { end: string; tabs: boolean; of: string[] }[] = [];
  // each command whose output goes to a file, and that file's word's place among its words
  const out = new Map<string[], number>();
  let words: string[] = [], word = null as string | null, i = 0, toFile = false;
  const add = (s: string) => void (word = (word ?? "") + s);
  const end = () => {
    if (word !== null) {
      if (toFile) out.set(words, words.length);
      words.push(word);
      toFile = false;
    }
    word = null;
  };
  const cut = () => {
    end();
    if (words.length) commands.push(words);
    words = [];
    toFile = false;
  };
  while (i < command.length) {
    const ch = command[i]!, next = command[i + 1] ?? "";
    if (ch === "'") {
      const j = command.indexOf("'", i + 1);
      add(command.slice(i + 1, j < 0 ? undefined : j));
      i = j < 0 ? command.length : j + 1;
    } else if (ch === '"') {
      let s = "";
      for (i++; i < command.length && command[i] !== '"'; i++) s += command[i] === "\\" && /["\\$`\n]/.test(command[i + 1] ?? "") ? command[++i]! : command[i]!;
      add(s);
      i++;
    } else if (ch === "\\") {
      if (next !== "\n") add(next);
      i += 2;
    } else if (ch === "#" && word === null) {
      while (i < command.length && command[i] !== "\n") i++;
    } else if (ch === "\n") {
      cut();
      i++;
      // the heredocs opened on that line: their bodies, each up to its delimiter's line
      for (const h of pending.splice(0)) {
        const body: string[] = [];
        while (i < command.length) {
          const nl = command.indexOf("\n", i), line = command.slice(i, nl < 0 ? undefined : nl);
          i = nl < 0 ? command.length : nl + 1;
          if ((h.tabs ? line.replace(/^\t+/, "") : line) === h.end) break;
          body.push(line);
        }
        heredocs.push({ body: body.join("\n"), of: h.of, to: null });
      }
    } else if (ch === " " || ch === "\t") {
      end();
      i++;
    } else if (ch === "<" && next === "<" && command[i + 2] !== "<") {
      end();
      i += 2;
      const tabs = command[i] === "-";
      if (tabs) i++;
      while (command[i] === " " || command[i] === "\t") i++;
      let d = "";
      for (; i < command.length && !/[\s;|&<>()]/.test(command[i]!); i++) if (!`'"\\`.includes(command[i]!)) d += command[i];
      pending.push({ end: d, tabs, of: words });
    } else if (ch === "<" || ch === ">" || (ch === "&" && next === ">")) {
      // a redirection (`>`, `>>`, `&>`, `<<<`): the next word is its file; a descriptor's number before it isn't a word
      const fd = word !== null && /^\d+$/.test(word) ? word : null;
      if (fd !== null) word = null;
      end();
      for (i++; /[<>|]/.test(command[i] ?? ""); i++);
      if (command[i] === "&") for (i++; /[\d-]/.test(command[i] ?? ""); i++);
      // the command's output to a file (not a descriptor's copy, `2>&1`, nor its errors')
      else toFile = ch !== "<" && (fd === null || fd === "1");
    } else if (";|&()`".includes(ch) || (ch === "$" && next === "(")) {
      cut();
      i += ch === "$" ? 2 : 1;
    } else {
      add(ch);
      i++;
    }
  }
  cut();
  // a heredoc `cat` writes to a file (`cat > f <<E`), or `tee` does: the file
  for (const h of heredocs) {
    const k = h.of.findIndex((w) => !LEADS.has(w) && !/^\w+=/.test(w)), at = out.get(h.of);
    h.to = h.of[k] === "cat" && at !== undefined ? h.of[at]! : h.of[k] === "tee" ? (h.of.slice(k + 1).find((a) => !a.startsWith("-")) ?? null) : null;
  }
  return { commands, heredocs };
}

/**
 * The paths named in the text of a file a call writes, `file` (absolute; relative or null where the call's directory
 * isn't known): its absolute paths whose first directory exists, and its `./` and `../` strings from the file's
 * directory, as a module's imports resolve, where they exist. Named, not read (D91).
 */
function namedIn(text: string, file: string | null, exists: (path: string) => boolean): Named[] {
  const out: Named[] = [];
  for (const m of text.matchAll(ABSOLUTE)) if (exists(`/${m[1]!.split("/")[1]}`)) out.push({ path: normalize(m[1]!), lists: false, names: true });
  if (file !== null && isAbsolute(file))
    for (const m of text.matchAll(RELATIVE)) {
      const p = resolve(dirname(file), m[2]!);
      if (exists(p)) out.push({ path: p, lists: false, names: true });
    }
  return out;
}
/**
 * The paths a tool call names: a file tool's path (and Glob's pattern, which lists), from the workspace; and in a shell
 * command, each word that names a path, absolute or relative (from the shell's directory, following the command's `cd`s
 * and a `for` loop's variable; a glob as written), whose first directory exists (not a regex like `/foot/i.test(`, a
 * grep pattern or a sed script), and the absolute paths in its scripts and heredocs. A command that only lists (`ls`,
 * `cd`, `find` without `-exec`...) lists its paths. The text of a file the call writes (a Write's content, an Edit's
 * new string, a heredoc `cat` or `tee` writes) names its paths (`namedIn`): they aren't read by the call (D91). Without
 * `at`, a shell command's relative paths are left out and a file tool's left as they are; with it, `at.cwd` moves to
 * where the next command starts.
 */
export function pathsOf(tool: string, input: Record<string, unknown>, at?: Where): Named[] {
  const ws = at?.workspace ?? "", exists = at?.exists ?? existsSync, from = (p: string, dir: string | null) => (isAbsolute(p) ? normalize(p) : dir === null ? p : resolve(dir, p));
  if (tool !== "Bash") {
    const named = ["file_path", "path", "notebook_path"].map((k) => input[k]).filter((p): p is string => typeof p === "string").map((p) => ({ path: from(p, at ? ws : null), lists: tool === "Glob" }));
    if (tool === "Glob" && typeof input.pattern === "string") named.push({ path: from(input.pattern, at ? (named[0]?.path ?? ws) : null), lists: true });
    const body = tool === "Write" ? input.content : tool === "Edit" ? input.new_string : undefined;
    if (typeof body === "string") named.push(...namedIn(body, named[0]?.path ?? null, exists));
    return named;
  }
  const out: Named[] = [], vars = new Map<string, string[]>(), { commands, heredocs } = shellWords(String(input.command ?? ""));
  let cwd: string | null = at?.cwd ?? null;
  const inText = (text: string) => {
    for (const m of text.matchAll(ABSOLUTE)) if (exists(`/${m[1]!.split("/")[1]}`)) out.push({ path: normalize(m[1]!), lists: false });
  };
  const home = (w: string) => (at && (w === "~" || w.startsWith("~/")) ? `${ws}-home${w.slice(1)}` : w);
  // a word with a `for` loop's variable put in, once per value (any other variable leaves it a word of text)
  const expand = (w: string): string[] => {
    const m = /\$\{?(\w+)\}?/.exec(w), values = m ? vars.get(m[1]!) : undefined;
    return m && values ? values.flatMap((v) => expand(w.slice(0, m.index) + v + w.slice(m.index + m[0].length))) : [w];
  };
  const named = (word: string, lists: boolean) => {
    const w = home(word);
    if (!PATHLIKE.test(w) || w.startsWith("-")) return inText(w);
    const first = w.split("/")[isAbsolute(w) ? 1 : 0]!;
    if (isAbsolute(w) ? first && exists(`/${first}`) : cwd !== null && (/[*?[]/.test(first) || exists(resolve(cwd, first)))) out.push({ path: from(w, cwd), lists });
  };
  for (const raw of commands) {
    const words = raw.flatMap(expand);
    let k = 0;
    for (; k < words.length && (LEADS.has(words[k]!) || /^\w+=/.test(words[k]!)); k++) inText(words[k]!);
    const cmd = words[k] ?? "", args = words.slice(k + 1), lists = LISTS.has(cmd) && !args.some((a) => /^-(exec|execdir|ok)$/.test(a));
    if (cmd === "for") vars.set(args[0] ?? "", args[1] === "in" ? args.slice(2).filter((v) => !v.includes("$")) : []);
    for (const w of cmd === "for" ? args.slice(2) : [...(cmd.includes("/") ? [cmd] : []), ...args]) named(w, lists);
    // its heredocs: a script it runs (read), or a file's text `cat` or `tee` writes (named)
    for (const h of heredocs.filter((x) => x.of === raw)) {
      if (h.to === null) inText(h.body);
      else out.push(...namedIn(h.body, from(home(h.to), cwd), exists));
    }
    if (cmd === "cd") {
      const to = home(args.find((a) => !a.startsWith("-")) ?? "~");
      cwd = args.includes("-") || to.includes("$") ? null : isAbsolute(to) ? normalize(to) : cwd === null ? null : resolve(cwd, to);
    }
  }
  for (const h of heredocs) if (!h.of.length) inText(h.body);
  if (at) at.cwd = cwd !== null && within(cwd, ws) ? cwd : ws;
  return out;
}
/**
 * The audit of a transcript's tool calls: paths outside the workspace (system and tool paths a shell names as a matter
 * of course, like /usr/bin or /tmp, aside; with a /tmp of its own, the paths in it are its `scratch`, but never the
 * repository's or the Claude home's, wherever they live; another process's entries in /proc, its root, cwd,
 * environment or files, are outside, and /proc/self/root/<p> is /<p>, D91), and files read past the manual (under
 * node_modules/@m3a/, other than the manual itself; a listing isn't a read, nor a path named in a file it writes).
 */
export function audit(lines: readonly string[], workspace: string, privateTmp = false): { outside: string[]; scratch: string[]; pastManual: string[] } {
  const outside = new Set<string>(), scratch = new Set<string>(), past = new Set<string>(), ws = resolve(workspace);
  const ordinary = /^\/(usr|bin|sbin|lib|lib64|etc|proc|dev|sys|opt\/node|tmp\/?$|var\/tmp\/?$)/, other = /^\/proc\/\d+\/./, hide = hidden();
  const at: Where = { workspace: ws, cwd: ws, exists: (p) => existsSync(p) || (privateTmp && p.startsWith("/tmp/") && existsSync(`${ws}-tmp${p.slice(4)}`)) };
  for (const line of lines) {
    let j: { type?: string; message?: { content?: { type: string; name?: string; input?: Record<string, unknown> }[] } };
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (j.type !== "assistant") continue;
    for (const c of j.message?.content ?? []) {
      if (c.type !== "tool_use" || !c.name || !c.input) continue;
      for (const n of pathsOf(c.name, c.input, at)) {
        const path = n.path.replace(/^\/proc\/(self|thread-self)\/root(?=\/.)/, ""), rel = path.slice(ws.length + 1);
        if (!within(path, ws)) {
          if (privateTmp && path.startsWith("/tmp/") && !hide.some((d) => within(path, d))) scratch.add(path);
          else if (other.test(path) || !ordinary.test(path)) outside.add(path);
        } else if (!n.lists && !n.names && /^node_modules\/@m3a(\/|$)/.test(rel) && rel !== "node_modules/@m3a/tools/MANUAL.md") past.add(rel);
      }
    }
  }
  return { outside: [...outside].sort(), scratch: [...scratch].sort(), pastManual: [...past].sort() };
}

let probed: string[] | null | undefined;
/** The `unshare` flags for a PID namespace with a /proc of its own; `--kill-child` ends every process in it when unshare
 *  ends (D91). */
const PIDS = ["--pid", "--fork", "--mount-proc", "--kill-child"];
/**
 * The `unshare` arguments that give a process a mount namespace of its own (as root, or through a user namespace
 * mapping this user to root), with a PID namespace and a /proc of its own where the machine allows it (D91), or null
 * where the machine allows no mount namespace. Probed once, by bind-mounting a directory.
 */
export function namespace(): string[] | null {
  if (probed !== undefined) return probed;
  probed = null;
  const dir = mkdtempSync("/tmp/m3a-ns-"), ways = [...(process.getuid?.() === 0 ? [["-m"]] : []), ["-r", "-m"]];
  for (const args of [...ways.map((w) => [...w, ...PIDS]), ...ways]) {
    try {
      execFileSync("unshare", [...args, "--propagation", "private", "mount", "--bind", dir, dir], { stdio: "ignore", timeout: 10_000 });
      probed = args;
      break;
    } catch {
      // not allowed here: try the next way, or run agents without one
    }
  }
  rmSync(dir, { recursive: true, force: true });
  return probed;
}
/** Whether the agents' processes get a PID namespace of their own, /proc showing only them (D91). */
export function ownPids(): boolean {
  return namespace()?.includes("--pid") ?? false;
}
/**
 * The command that starts `cmd args` in `workspace` with a /tmp of its own, `tmp` (a directory outside the workspace):
 * in a mount namespace, the workspace and `home` are bound into `tmp` at their own paths, `tmp` is bound over /tmp,
 * and every checkout of the repository, its git directory and this session's Claude home (`hidden`) are covered by
 * empty directories; in a PID namespace where the machine allows one (`pids`). Null where no namespace can be made
 * (the agent then shares the machine's /tmp).
 */
export function privateTmp(workspace: string, home: string, tmp: string, cmd: string, args: readonly string[]): { cmd: string; args: string[]; pids: boolean } | null {
  const ns = namespace();
  if (!ns) return null;
  const binds = [workspace, home].filter((d) => d.startsWith("/tmp/"));
  for (const d of binds) mkdirSync(join(tmp, d.slice(4)), { recursive: true });
  const hide = hidden().filter((d) => existsSync(d) && !d.startsWith("/tmp/") && !workspace.startsWith(d));
  // $1 the workspace, $2 the private /tmp, $3 the binds and $4 the hidden directories (each joined by newlines)
  const script = [
    "set -e",
    "IFS='\n'",
    'for d in $3; do mount --bind "$d" "$2${d#/tmp}"; done',
    'mount --rbind "$2" /tmp',
    'for d in $4; do mount -t tmpfs -o size=64k,mode=0755 m3a-hidden "$d"; done',
    'cd "$1"',
    "shift 4",
    'exec "$@"',
  ].join("\n");
  return { cmd: "unshare", args: [...ns, "--propagation", "private", "sh", "-c", script, "sh", workspace, tmp, binds.join("\n"), hide.join("\n"), cmd, ...args], pids: ownPids() };
}

/** Runs a fresh agent in `workspace` on `prompt`; the transcript goes to `transcript`. */
export function runAgent(workspace: string, prompt: string, transcript: string, opts: AgentOptions = {}): Promise<AgentRun> {
  const name = workspace.split("/").pop(), home = join(workspace, "..", `${name}-home`), tmp = join(workspace, "..", `${name}-tmp`), t0 = performance.now();
  mkdirSync(home, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  const tools = opts.tools ?? "Bash,Read,Write,Edit,Glob,Grep";
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--max-turns", String(opts.maxTurns ?? 80), "--tools", tools, "--allowedTools", tools, "--strict-mcp-config", ...(opts.model ? ["--model", opts.model] : [])];
  // its own /tmp where a namespace can be made (D84); else its own temporary directory for the tools that ask for one
  // (an agent may still name /tmp itself: the audit lists it)
  const own = privateTmp(workspace, home, tmp, "claude", args), env: Record<string, string> = { HOME: home, TMPDIR: own ? "/tmp" : tmp };
  for (const k of KEEP) if (process.env[k]) env[k] = process.env[k]!;
  return new Promise((done) => {
    const child = spawn(own?.cmd ?? "claude", own?.args ?? args, { cwd: workspace, env, stdio: ["ignore", "pipe", "pipe"] }), out: string[] = [];
    let buf = "", err = "";
    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      const parts = buf.split("\n");
      buf = parts.pop()!;
      out.push(...parts.filter((l) => l.trim()));
    });
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    // unshare --fork holds SIGTERM back; killed, it takes every process in the agent's PID namespace with it
    const timer = setTimeout(() => child.kill(own?.pids ? "SIGKILL" : "SIGTERM"), opts.timeoutMs ?? 30 * 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (buf.trim()) out.push(buf);
      writeFileSync(transcript, `${out.join("\n")}\n`);
      const result = out.map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return {};
        }
      }).findLast((j) => j.type === "result") as { subtype?: string; num_turns?: number; total_cost_usd?: number; usage?: Record<string, number>; modelUsage?: Record<string, unknown>; is_error?: boolean; result?: string } | undefined;
      const u = result?.usage ?? {}, a = audit(out, workspace, own !== null);
      done({
        isolation: 1, privateTmp: own !== null, ownPids: own?.pids ?? false, ok: code === 0 && result?.subtype === "success", ms: performance.now() - t0, model: Object.keys(result?.modelUsage ?? {})[0] ?? opts.model ?? "default",
        turns: result?.num_turns ?? 0, tokens: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 },
        costUsd: result?.total_cost_usd ?? 0, outside: a.outside, scratch: a.scratch, pastManual: a.pastManual, transcript, reply: result?.result ?? "",
        ...(code === 0 && result?.subtype === "success" ? {} : { error: (result?.subtype ?? `exit ${code}`) + (err ? `: ${err.trim().split("\n").slice(-1)[0]}` : "") }),
      });
    });
  });
}
