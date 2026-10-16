// The durable RequestStore (PLAN.md WP-7.2): an edit's request_id results kept as files under .m3a/requests/ in the
// working directory, one per tool and id, so a retry from another m3a process (the CLI is one process a command; an MCP
// server restarts) replies the first result instead of applying again. Synchronous, as the registry calls it; every
// record written atomically; past `max` records the oldest go (housekeeping: no reply depends on it).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RequestStore } from "../registry/registry.ts";
import type { Reply } from "../registry/reply.ts";

/** Writes a file atomically: its directory made, the data written to a temporary file beside it, then renamed over it. */
export function writeAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

/**
 * A RequestStore in files under `<cwd>/.m3a/requests/`: each record `{key, args, reply}` named by the first 32 hex
 * digits of its key's SHA-256, the newest `max` kept (by modification time). A record that won't parse, or holds
 * another key, reads as missing and is overwritten.
 */
export function fileStore(cwd: string, max = 256): RequestStore {
  const dir = join(cwd, ".m3a", "requests"), file = (key: string) => join(dir, `${createHash("sha256").update(key).digest("hex").slice(0, 32)}.json`);
  return {
    durable: true,
    get(key) {
      try {
        const r = JSON.parse(readFileSync(file(key), "utf8")) as { key?: unknown; args?: unknown; reply?: unknown };
        if (r.key === key && typeof r.args === "string" && typeof r.reply === "object" && r.reply !== null) return { args: r.args, reply: r.reply as Reply };
      } catch {
        // missing or unreadable: no record
      }
      return undefined;
    },
    set(key, entry) {
      const f = file(key);
      writeAtomic(f, `${JSON.stringify({ key, args: entry.args, reply: entry.reply })}\n`);
      const names = readdirSync(dir).filter((n) => n.endsWith(".json"));
      if (names.length <= max) return;
      const age = (p: string) => statSync(p, { throwIfNoEntry: false })?.mtimeMs ?? 0;
      const old = names.map((n) => join(dir, n)).filter((p) => p !== f).map((p) => [p, age(p)] as const).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
      for (const [p] of old.slice(0, names.length - max)) rmSync(p, { force: true });
    },
  };
}
