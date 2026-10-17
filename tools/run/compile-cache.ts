// The compile cache the Node processes a test starts share (T1's cost, D89): each `node` a test starts (the m3a CLI
// and its MCP server, a starter's `npm run sheet` or check, a tool's main.ts, tsc) strips and compiles the same
// TypeScript and JavaScript again; with NODE_COMPILE_CACHE set they reuse V8's code cache under .cache/node-compile/,
// which Node keys by each file's content and its own version, so a changed file is compiled afresh and what a process
// prints or does is unchanged. An environment that names its own cache keeps it. The test's own process is not
// affected: Node reads the setting as a process starts.
import { join } from "node:path";
import { ROOT } from "./cli.ts";

/** Where the processes a test starts keep their compile cache. */
export const COMPILE_CACHE = join(ROOT, ".cache/node-compile");

/** Points every Node process this one starts from now on at the shared compile cache, unless the environment names
 *  one already; returns the directory they use. */
export function cacheChildren(): string {
  return (process.env.NODE_COMPILE_CACHE ||= COMPILE_CACHE);
}
