// A fresh agent on a benchmark workspace (PLAN.md §7, WP-4.7). Isolation level 1: the `claude` CLI in print mode,
// started in the workspace with a clean environment (the proxy and its certificates, nothing of this session's: no
// tokens, no repository) and a fresh home (no settings, skills or memory), its tools limited to files and a shell.
// Where the machine allows a mount namespace (`unshare`), each agent gets a /tmp of its own, holding only its workspace
// and home, and the repository and this session's Claude home are hidden from it (D84): agents write scratch files to
// /tmp by name, so agents run at once no longer meet there.
// The transcript (stream-json) is kept; the run records its time, tokens, cost and turns, and the audit lists every
// path it touched outside the workspace (and its own /tmp's scratch files apart) and every file it read past the
// manual (the packages' code in node_modules).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve } from "node:path";

/** What one agent run did. */
export interface AgentRun {
  isolation: 1 | 3;
  /** Whether it ran with a /tmp of its own, the repository hidden (D84). */
  privateTmp: boolean;
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

/**
 * The paths a tool call names: a file tool's path, and the absolute paths in a shell command (a word of path characters
 * standing alone, whose first directory exists here: not a glob, nor a regex like `/foot/i.test(`).
 */
export function pathsOf(tool: string, input: Record<string, unknown>): string[] {
  if (tool === "Bash") {
    return [...String(input.command ?? "").matchAll(/(?:^|[\s'"=:(])(\/[\w.@+~-]+(?:\/[\w.@+~-]*)*)(?=$|[\s'"`;|&)<>])/g)].map((m) => m[1]!).filter((p) => existsSync(`/${p.split("/")[1]}`));
  }
  return ["file_path", "path", "notebook_path"].map((k) => input[k]).filter((p): p is string => typeof p === "string");
}
/**
 * The audit of a transcript's tool calls: paths outside the workspace (system and tool paths a shell names as a matter
 * of course, like /usr/bin or /tmp, aside), and files read past the manual (in node_modules/@m3a/, other than the
 * manual itself).
 */
export function audit(lines: readonly string[], workspace: string, privateTmp = false): { outside: string[]; scratch: string[]; pastManual: string[] } {
  const outside = new Set<string>(), scratch = new Set<string>(), past = new Set<string>(), ws = normalize(workspace);
  const ordinary = /^\/(usr|bin|sbin|lib|lib64|etc|proc|dev|sys|opt\/node|tmp\/?$|var\/tmp\/?$)/;
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
      for (const p of pathsOf(c.name, c.input)) {
        const abs = isAbsolute(p) ? normalize(p) : resolve(ws, p);
        if (!abs.startsWith(ws)) {
          if (privateTmp && abs.startsWith("/tmp/")) scratch.add(abs);
          else if (!ordinary.test(abs)) outside.add(abs);
        } else if (/node_modules\/@m3a\//.test(abs) && !/node_modules\/@m3a\/tools\/MANUAL\.md$/.test(abs) && c.name !== "Glob") past.add(abs.slice(ws.length + 1));
      }
    }
  }
  return { outside: [...outside].sort(), scratch: [...scratch].sort(), pastManual: [...past].sort() };
}

/** The repository the runner runs from: hidden from the agents (D84). */
const REPO = join(import.meta.dirname, "../..");
let probed: string[] | null | undefined;
/**
 * The `unshare` arguments that give a process a mount namespace of its own (as root, or through a user namespace
 * mapping this user to root), or null where the machine allows neither. Probed once, by bind-mounting a directory.
 */
export function namespace(): string[] | null {
  if (probed !== undefined) return probed;
  probed = null;
  const dir = mkdtempSync("/tmp/m3a-ns-");
  for (const args of [...(process.getuid?.() === 0 ? [["-m"]] : []), ["-r", "-m"]]) {
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
/**
 * The command that starts `cmd args` in `workspace` with a /tmp of its own, `tmp` (a directory outside the workspace):
 * in a mount namespace, the workspace and `home` are bound into `tmp` at their own paths, `tmp` is bound over /tmp,
 * and the repository and this session's Claude home are covered by empty directories. Null where no namespace can be
 * made (the agent then shares the machine's /tmp).
 */
export function privateTmp(workspace: string, home: string, tmp: string, cmd: string, args: readonly string[]): { cmd: string; args: string[] } | null {
  const ns = namespace();
  if (!ns) return null;
  const binds = [workspace, home].filter((d) => d.startsWith("/tmp/"));
  for (const d of binds) mkdirSync(join(tmp, d.slice(4)), { recursive: true });
  const hide = [REPO, join(homedir(), ".claude")].filter((d) => existsSync(d) && !d.startsWith("/tmp/") && !workspace.startsWith(d));
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
  return { cmd: "unshare", args: [...ns, "--propagation", "private", "sh", "-c", script, "sh", workspace, tmp, binds.join("\n"), hide.join("\n"), cmd, ...args] };
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
    const timer = setTimeout(() => child.kill("SIGTERM"), opts.timeoutMs ?? 30 * 60_000);
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
        isolation: 1, privateTmp: own !== null, ok: code === 0 && result?.subtype === "success", ms: performance.now() - t0, model: Object.keys(result?.modelUsage ?? {})[0] ?? opts.model ?? "default",
        turns: result?.num_turns ?? 0, tokens: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 },
        costUsd: result?.total_cost_usd ?? 0, outside: a.outside, scratch: a.scratch, pastManual: a.pastManual, transcript, reply: result?.result ?? "",
        ...(code === 0 && result?.subtype === "success" ? {} : { error: (result?.subtype ?? `exit ${code}`) + (err ? `: ${err.trim().split("\n").slice(-1)[0]}` : "") }),
      });
    });
  });
}
