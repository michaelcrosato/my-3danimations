// The durable RequestStore (PLAN.md WP-7.2): an edit's request_id results kept as files under .m3a/requests/ in the
// working directory, one per tool and id, so a retry from another m3a process (the CLI is one process a command; an MCP
// server restarts) replies the first result instead of applying again. Synchronous, as the registry calls it; every
// record written atomically, as the host writes (a .m3a/ linked out of the working directory refused); past `max` records
// the oldest go (housekeeping: no reply depends on it). A record it can't write throws; the registry then replies anyway.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RequestStore } from "../registry/registry.ts";
import type { Reply } from "../registry/reply.ts";
import { writable, writeAtomic } from "./files.ts";

/**
 * A RequestStore in files under `<cwd>/.m3a/requests/`: each record `{key, args, reply}` named by the first 32 hex
 * digits of its key's SHA-256, the newest `max` kept (by modification time). A record that won't parse, or holds
 * another key, reads as missing and is overwritten.
 */
export function fileStore(cwd: string, max = 256): RequestStore {
  const base = resolve(cwd), dir = join(base, ".m3a", "requests"), name = (key: string) => `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`;
  return {
    durable: true,
    get(key) {
      try {
        const r = JSON.parse(readFileSync(join(dir, name(key)), "utf8")) as { key?: unknown; args?: unknown; reply?: unknown };
        if (r.key === key && typeof r.args === "string" && typeof r.reply === "object" && r.reply !== null) return { args: r.args, reply: r.reply as Reply };
      } catch {
        // missing or unreadable: no record
      }
      return undefined;
    },
    set(key, entry) {
      const f = writable(base, `.m3a/requests/${name(key)}`);
      writeAtomic(f, `${JSON.stringify({ key, args: entry.args, reply: entry.reply })}\n`);
      const names = readdirSync(dir).filter((n) => n.endsWith(".json"));
      if (names.length <= max) return;
      const age = (p: string) => statSync(p, { throwIfNoEntry: false })?.mtimeMs ?? 0;
      const old = names.map((n) => join(dir, n)).filter((p) => p !== f).map((p) => [p, age(p)] as const).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
      for (const [p] of old.slice(0, names.length - max)) rmSync(p, { force: true });
    },
  };
}
