#!/usr/bin/env node
// @m3a/tools/node: the tools' Node entry (PLAN.md §5.1), the only module here that imports Node built-ins, and the `m3a`
// bin. It supplies the Node host (files read under the working directory, never outside it, images written as PNG under
// check-output/<tool>/), runs the CLI on process.argv, and serves MCP over stdio with `m3a mcp`: one JSON-RPC message
// per line each way, nothing else on stdout, and an exit when stdin ends.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { png } from "@m3a/sensors/node";
import { runCli } from "./cli.ts";
import { mcpServer, type McpServer } from "./mcp.ts";
import { ToolError, type Host, type Registry } from "./registry/registry.ts";
import { tools } from "./registry/tools.ts";

function write(cwd: string, path: string, data: string | Uint8Array): void {
  const p = resolve(cwd, path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
}

/** The Node host: reads text files and writes images as PNG, both relative to `cwd`; a path outside it is refused. */
export function nodeHost(cwd: string = process.cwd()): Host {
  return {
    async read(path) {
      const p = resolve(cwd, path), up = relative(cwd, p);
      if (!path.trim() || up === ".." || up.startsWith(`..${sep}`) || isAbsolute(up)) throw new ToolError("E_PATH", `${path.trim() ? `${path} is outside ${cwd}` : "the path is empty"}; give a file under the working directory, or pass its text`, true);
      try {
        return readFileSync(p, "utf8");
      } catch (err) {
        throw new ToolError("E_PATH", `can't read ${path} (${(err as NodeJS.ErrnoException).code ?? "unreadable"}); paths are relative to ${cwd}`, true);
      }
    },
    image(tool, name, img) {
      const path = `check-output/${tool}/${name}.png`, bytes = png(img);
      write(cwd, path, bytes);
      return { path, png: bytes };
    },
  };
}

/** Serves MCP over a line stream (stdin and stdout by default) until the input ends, one message at a time. */
export async function serveStdio(server: McpServer, input: Readable = process.stdin, output: Writable = process.stdout): Promise<void> {
  const send = (m: unknown) => output.write(`${JSON.stringify(m)}\n`);
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: each line is one JSON-RPC message" } });
      continue;
    }
    const res = await server.handle(msg);
    if (res) send(res);
  }
}

/** The m3a command: `m3a mcp` serves MCP over stdio; anything else is the CLI. Resolves to the exit code. */
export async function main(argv: readonly string[], registry: Registry = tools, cwd: string = process.cwd()): Promise<number> {
  const host = nodeHost(cwd);
  if (argv[0] !== "mcp") return runCli(registry, argv, { print: (t) => process.stdout.write(t), write: (p, t) => write(cwd, p, t), host });
  if (argv.length > 1) {
    process.stdout.write(`m3a mcp: usage error: it takes no arguments, not ${argv.slice(1).join(" ")}\nnext: have the MCP client run "m3a mcp" (stdio)\n`);
    return 2;
  }
  await serveStdio(mcpServer(registry, { host }));
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
