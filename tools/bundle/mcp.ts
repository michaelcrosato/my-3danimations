// `m3a mcp` asked for its tools (PLAN.md WP-7.4), for `npm run pack -- --check` (./main.ts): the bin a scratch project
// installed from the packed tarballs, started as an MCP client starts it, initialized and asked tools/list. A bin npm
// didn't link (a "bin" naming a file the tarball lacks: the stopgap's defect), one that can't start, exits or writes
// what isn't JSON-RPC before answering, or doesn't answer within the timeout is an error that says so, the server
// stopped: the check reports it as that step's failure and goes on, never crashing or hanging (G7 has no time budget).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** How long `m3a mcp` has to answer tools/list before the check stops it and fails the step. */
export const MCP_TIMEOUT_MS = 30_000;

/** `m3a mcp` in `cwd` (its node_modules/.bin/m3a) asked to initialize and list its tools: the tool names it answers
 *  with. Rejects, the server stopped, when there is no bin, it can't start, it exits or writes a line that isn't
 *  JSON-RPC before answering, or it doesn't answer within `timeoutMs`. */
export async function mcpTools(cwd: string, timeoutMs: number = MCP_TIMEOUT_MS): Promise<string[]> {
  const bin = join(cwd, "node_modules/.bin/m3a");
  if (!existsSync(bin)) throw new Error(`m3a mcp could not start: ${bin} isn't there, or leads to no file (npm links no bin whose file the tarball lacks: is packages/tools' "bin" ./dist/node.js?)`);
  const child = spawn(bin, ["mcp"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  let buf = "", err = "", timer: ReturnType<typeof setTimeout> | undefined;
  const said = () => (err.trim() ? `: ${err.trim()}` : "");
  child.stderr.on("data", (d) => (err += String(d)));
  child.stdin.on("error", () => {}); // writing to a server that died: its own error or exit says why
  const listed = new Promise<string[]>((ok, fail) => {
    timer = setTimeout(() => fail(new Error(`m3a mcp didn't answer tools/list within ${timeoutMs / 1000} s${said()}`)), timeoutMs);
    child.on("error", (e) => fail(new Error(`m3a mcp could not start: ${e.message}`)));
    // on close, not exit: its stdout and stderr read to the end, so what it said is in the error
    child.on("close", (code, signal) => fail(new Error(`m3a mcp exited (${code ?? signal}) before answering tools/list${said()}`)));
    child.stdout.on("data", (d) => {
      const lines = (buf + String(d)).split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        let m: { id?: number; result?: { tools?: { name: string }[] } };
        try {
          m = JSON.parse(line) as typeof m;
        } catch {
          return fail(new Error(`m3a mcp wrote a line that isn't JSON-RPC: ${line}`));
        }
        if (m.id === 2) return m.result?.tools ? ok(m.result.tools.map((t) => t.name)) : fail(new Error(`tools/list answered ${line}`));
      }
    });
  });
  const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "m3a-pack", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  try {
    return await listed;
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    child.kill();
  }
}
