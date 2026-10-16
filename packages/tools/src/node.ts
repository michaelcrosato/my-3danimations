#!/usr/bin/env node
// @m3a/tools/node: the tools' Node entry (PLAN.md §5.1), with src/node/ the only modules here that import Node
// built-ins, and the `m3a` bin. It supplies the Node host: files read under the working directory and written only under
// its write roots (workshop/, .m3a/, imports/, check-output/: never library/), atomically, a link out of either refused;
// the library at game.json's tiers; images written as PNG under check-output/<tool>/. It runs the CLI on process.argv,
// and serves MCP over stdio with `m3a mcp`: one JSON-RPC message per line each way, nothing else on stdout, and an exit
// when stdin ends. Both keep an edit's request_id results in .m3a/requests/, so a retry in another process applies once.
import { readFileSync, realpathSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { png } from "@m3a/sensors/node";
import { runCli } from "./cli.ts";
import { mcpServer, type McpServer } from "./mcp.ts";
import { libraryAccess } from "./node/library.ts";
import { fileStore, writeAtomic } from "./node/store.ts";
import { Registry, ToolError, type Host } from "./registry/registry.ts";
import { quote } from "./registry/schema.ts";
import { TOOLS } from "./tools/index.ts";

/** Where m3a writes in a project, under the working directory: its edited clips, its own state, imported sets and its
 *  check output. Nothing else, and never library/. */
export const WRITE_ROOTS: readonly string[] = ["workshop", ".m3a", "imports", "check-output"];

const inside = (base: string, p: string) => {
  const up = relative(base, p);
  return up !== ".." && !up.startsWith(`..${sep}`) && !isAbsolute(up);
};
const errno = (err: unknown) => (err as NodeJS.ErrnoException).code ?? "unreadable";

/** The real path of `p`, or of its nearest existing ancestor when it isn't there yet. */
function real(p: string): string {
  for (let q = p; ; q = dirname(q)) {
    try {
      return realpathSync(q);
    } catch (err) {
      if (dirname(q) === q) throw err;
    }
  }
}

/** `path` under `cwd`, refused (E_PATH) when it is empty or outside, by its name or through a link. */
function under(cwd: string, path: string, to: string): string {
  const p = resolve(cwd, path);
  if (!path.trim() || !inside(cwd, p)) throw new ToolError("E_PATH", `${path.trim() ? `${quote(path)} is outside ${cwd}` : "the path is empty"}; ${to}`, true);
  if (!inside(realpathSync(cwd), real(p))) throw new ToolError("E_PATH", `${quote(path)} leads outside ${cwd} through a link; ${to}`, true);
  return p;
}

/** `path` under one of the write roots, refused (E_PATH) elsewhere or through a link out of its root. */
function writable(cwd: string, path: string): string {
  const roots = WRITE_ROOTS.map((r) => `${r}/`).join(", "), p = under(cwd, path, `m3a writes only under ${roots}`);
  const [root, ...rest] = relative(cwd, p).split(sep), top = realpathSync(cwd);
  if (!WRITE_ROOTS.includes(root!) || !rest.length) throw new ToolError("E_PATH", `${quote(path)} is not under m3a's write roots: it writes only under ${roots}, never library/`, true);
  const r = real(p);
  if (r !== top && !inside(join(top, root!), r)) throw new ToolError("E_PATH", `${quote(path)} leads out of ${root}/ through a link; m3a writes only under ${roots}`, true);
  return p;
}

/** The Node host, relative to `cwd`: text files read (a missing one null to tryRead), files written atomically and
 *  removed under the write roots, the library at game.json's tiers, and images written as PNG. */
export function nodeHost(cwd: string = process.cwd()): Host {
  const base = resolve(cwd), toRead = "give a file under the working directory, or pass its text";
  const read = (path: string, missing: boolean) => {
    const p = under(base, path, toRead);
    try {
      return readFileSync(p, "utf8");
    } catch (err) {
      if (missing && (errno(err) === "ENOENT" || errno(err) === "ENOTDIR")) return null;
      throw new ToolError("E_PATH", `can't read ${quote(path)} (${errno(err)}); paths are relative to ${cwd}`, true);
    }
  };
  return {
    read: async (path) => read(path, false)!,
    tryRead: async (path) => read(path, true),
    write(path, data) {
      const p = writable(base, path);
      try {
        writeAtomic(p, data);
      } catch (err) {
        throw new ToolError("E_WRITE", `can't write ${quote(path)} (${errno(err)})`);
      }
      return relative(base, p).split(sep).join("/");
    },
    remove(path) {
      const p = writable(base, path);
      try {
        unlinkSync(p);
      } catch (err) {
        if (errno(err) !== "ENOENT") throw new ToolError("E_WRITE", `can't remove ${quote(path)} (${errno(err)})`);
      }
    },
    library: (tiers) => libraryAccess(base, tiers),
    image(tool, name, img) {
      const path = `check-output/${tool}/${name}.png`, bytes = png(img);
      writeAtomic(resolve(base, path), bytes);
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

/** The m3a command: `m3a mcp` serves MCP over stdio; anything else is the CLI. Resolves to the exit code. The registry
 *  is the m3a tools with their request_id results kept in `cwd`'s .m3a/requests/ unless one is given. */
export async function main(argv: readonly string[], registry?: Registry, cwd: string = process.cwd()): Promise<number> {
  const host = nodeHost(cwd);
  registry ??= new Registry(TOOLS, fileStore(cwd));
  if (argv[0] !== "mcp") return runCli(registry, argv, { print: (t) => process.stdout.write(t), write: (p, t) => writeAtomic(resolve(cwd, p), t), host });
  if (argv.length > 1) {
    process.stdout.write(`m3a mcp: usage error: it takes no arguments, not ${quote(argv.slice(1).join(" "))}\nnext: have the MCP client run "m3a mcp" (stdio)\n`);
    return 2;
  }
  await serveStdio(mcpServer(registry, { host }));
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
