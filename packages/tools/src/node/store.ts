// The durable RequestStore (PLAN.md WP-7.2): an edit's request_id results kept as files under .m3a/requests/ in the
// working directory, one per tool and id, so a retry from another m3a process (the CLI is one process a command; an MCP
// server restarts) replies the first result instead of applying again. Synchronous, as the registry calls it; each
// record read and written only where the host may write (a .m3a/ linked out of the working directory refused), and
// written atomically; past `max` records the oldest go (housekeeping: no reply depends on it, so a failure there is
// ignored). A record it can't write throws, naming it by its relative path; the registry then replies anyway.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ToolError, type RequestStore } from "../registry/registry.ts";
import type { Reply } from "../registry/reply.ts";
import { quote } from "../registry/schema.ts";
import { errno, writable, writeAtomic } from "./files.ts";

/**
 * A RequestStore in files under `<cwd>/.m3a/requests/`: each record `{key, args, reply}` named by the first 32 hex
 * digits of its key's SHA-256, the newest `max` kept (by modification time). A record that won't parse, holds another
 * key or is reached through a link out of the working directory reads as missing (and a link out is never written).
 */
export function fileStore(cwd: string, max = 256): RequestStore {
  const base = resolve(cwd), dir = join(base, ".m3a", "requests"), name = (key: string) => `.m3a/requests/${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`;
  return {
    durable: true,
    get(key) {
      try {
        const r = JSON.parse(readFileSync(writable(base, name(key)), "utf8")) as { key?: unknown; args?: unknown; reply?: unknown };
        if (r.key === key && typeof r.args === "string" && typeof r.reply === "object" && r.reply !== null) return { args: r.args, reply: r.reply as Reply };
      } catch {
        // missing, unreadable or linked out of the working directory: no record
      }
      return undefined;
    },
    set(key, entry) {
      const f = writable(base, name(key));
      try {
        writeAtomic(f, `${JSON.stringify({ key, args: entry.args, reply: entry.reply })}\n`);
      } catch (err) {
        throw new ToolError("E_WRITE", `can't write ${quote(name(key))} (${errno(err)})`);
      }
      try {
        const names = readdirSync(dir).filter((n) => n.endsWith(".json"));
        if (names.length <= max) return;
        const age = (p: string) => statSync(p, { throwIfNoEntry: false })?.mtimeMs ?? 0;
        const old = names.map((n) => join(dir, n)).filter((p) => p !== f).map((p) => [p, age(p)] as const).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
        for (const [p] of old.slice(0, names.length - max)) rmSync(p, { force: true });
      } catch {
        // pruning is housekeeping: the record is kept, and the next set tries again
      }
    },
  };
}
