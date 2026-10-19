#!/usr/bin/env node
// @m3a/tools/node: the tools' Node entry (PLAN.md §5.1), with src/node/ the only modules here that import Node
// built-ins, and the `m3a` bin. It supplies the Node host: files read (as text, or a character's bytes, a file past
// io's size limit for either refused before it is read) under the working directory and written only under its write roots
// (workshop/, .m3a/, imports/, check-output/: never library/), atomically, a link out of either refused
// (./node/files.ts); the library at game.json's tiers; images written as PNG under check-output/<tool>/ by the same
// rules, as are report.json and the request records. It runs the CLI on process.argv, and serves MCP over stdio with
// `m3a mcp`: one JSON-RPC message per line each way, nothing else on stdout, and an exit when stdin ends. Both keep an
// edit's request_id results in .m3a/requests/, so a retry in another process applies once. `m3a review` gets its intake
// store under .cache/intake/ and the checkout's writer from ./node/intake.ts (WP-8.2a); a source's clips that may not
// enter the intake are written under library/local/ by ./node/local-lane.ts (WP-9.2).
import { readFileSync, statSync, unlinkSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { LIMITS } from "@m3a/io";
import { png } from "@m3a/sensors/node";
import { runCli } from "./cli.ts";
import { mcpServer, type McpServer } from "./mcp.ts";
import { errno, lockFile, shown, under, writable, writeAtomic } from "./node/files.ts";
import { nodeContributor, nodeReviewHost } from "./node/intake.ts";
import { libraryAccess } from "./node/library.ts";
import { fileStore } from "./node/store.ts";
import { Registry, ToolError, type Host, type Tool } from "./registry/registry.ts";
import { quote } from "./registry/schema.ts";
import { TOOLS } from "./tools/index.ts";

/** The local intake store's record files under .cache/intake/ (INTAKE_DIR), for a contributor's `intake.localStore`
 *  until WP-9.1's `m3a library submit`. */
export { INTAKE_DIR, intakeFiles } from "./node/intake.ts";

/** The local lane on disk, for `sourcing.deliver`: library/local/'s sets, written atomically under its lock, no link
 *  leading out (WP-9.2). */
export { localLane } from "./node/local-lane.ts";

/** The Node host, relative to `cwd`: files read as text (a missing one null to tryRead) or bytes, files written
 *  atomically and removed under the write roots, the library at game.json's tiers, and images written as PNG. */
export function nodeHost(cwd: string = process.cwd()): Host {
  const base = resolve(cwd), toRead = "give a file under the working directory";
  const put = (path: string, data: string | Uint8Array) => {
    const p = writable(base, path);
    try {
      writeAtomic(p, data);
    } catch (err) {
      throw new ToolError("E_WRITE", `can't write ${shown(path)} (${errno(err)})`);
    }
    return relative(base, p).split(sep).join("/");
  };
  // a file under the working directory read as `how` reads it: null for a missing one when `missing` allows it
  const read = <T>(path: string, missing: boolean, how: (p: string) => T): T | null => {
    const p = under(base, path, toRead);
    try {
      return how(p);
    } catch (err) {
      if (err instanceof ToolError) throw err;
      if (missing && (errno(err) === "ENOENT" || errno(err) === "ENOTDIR")) return null;
      throw new ToolError("E_PATH", `can't read ${shown(path)} (${errno(err)}); paths are relative to the working directory`, true);
    }
  };
  // a file's text, refused unread (E_LIMIT, as io would refuse it read) past the most io takes as text: read whole, a
  // 300 MB file would be decoded before io refused it, and one past V8's longest string would read as unreadable
  const text = (p: string, path: string) => {
    const n = statSync(p).size;
    if (n > LIMITS.text) throw new ToolError("E_LIMIT", `${shown(path)}: ${n} bytes, over the ${LIMITS.text}-byte limit for a text file`);
    return readFileSync(p, "utf8");
  };
  // a file's bytes, refused unread (E_LIMIT, as io would refuse them read) past the most io takes in one file
  const bytes = (p: string, path: string) => {
    const n = statSync(p).size;
    if (n > LIMITS.file) throw new ToolError("E_LIMIT", `${shown(path)}: ${n} bytes, over the ${LIMITS.file}-byte limit`);
    return new Uint8Array(readFileSync(p));
  };
  return {
    read: async (path) => read(path, false, (p) => text(p, path))!,
    tryRead: async (path) => read(path, true, (p) => text(p, path)),
    bytes: async (path) => read(path, false, (p) => bytes(p, path))!,
    write: put,
    remove(path) {
      const p = writable(base, path);
      try {
        unlinkSync(p);
      } catch (err) {
        if (errno(err) !== "ENOENT") throw new ToolError("E_WRITE", `can't remove ${shown(path)} (${errno(err)})`);
      }
    },
    library: (tiers) => libraryAccess(base, tiers),
    lock: (path) => lockFile(base, path), // an edit's, across m3a processes (./node/files.ts)
    intake: () => nodeReviewHost(base), // m3a review's store under .cache/intake/ and the checkout (./node/intake.ts)
    contributor: () => nodeContributor(base), // m3a library's: the local store as M3A_CONTRIBUTOR, or a contributor key
    image(tool, name, img) {
      const bytes = png(img);
      return { path: put(`check-output/${tool}/${name}.png`, bytes), png: bytes };
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

/** The m3a command: `m3a mcp` serves MCP over stdio; anything else is the CLI. Resolves to the exit code. Its registry
 *  holds `tools` (the m3a tools) with their request_id results kept in `cwd`'s .m3a/requests/; report.json is written
 *  as a tool's files are. */
export async function main(argv: readonly string[], tools: readonly Tool[] = TOOLS, cwd: string = process.cwd()): Promise<number> {
  const host = nodeHost(cwd), registry = new Registry(tools, fileStore(cwd));
  if (argv[0] !== "mcp") return runCli(registry, argv, { print: (t) => process.stdout.write(t), write: (p, t) => void host.write!(p, t), host });
  if (argv.length > 1) {
    process.stdout.write(`m3a mcp: usage error: it takes no arguments, not ${quote(argv.slice(1).join(" "))}\nnext: have the MCP client run "m3a mcp" (stdio)\n`);
    return 2;
  }
  await serveStdio(mcpServer(registry, { host }));
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
