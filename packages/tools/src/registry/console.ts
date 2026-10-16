// The console handle (DOCTRINE.md principle 2): a registry's tools as functions on one global object, for a browser's
// devtools or a page driven by Playwright, as riftlight's pages carry `window.__<TOOL>__`. `__M3A_TOOLS__.validate({
// text })` resolves to the same Reply as the API, the CLI's report.json and MCP's structuredContent.
import { describeTool, type Description, type Host, type Registry } from "./registry.ts";
import type { Reply } from "./reply.ts";

/** The handle's global name. */
export const CONSOLE_KEY = "__M3A_TOOLS__";

/** The console handle: `list()` and `help(name)` describe the tools; `call(name, args)` and one function per tool,
 *  under its name (`handle["retarget.inspect"]`), run them. */
export interface ConsoleHandle {
  list(): Description[];
  help(name: string): Description | Reply;
  call(name: string, args?: Record<string, unknown>): Promise<Reply>;
  [tool: string]: unknown;
}

/** A registry as a console handle; the page's host (file reading, images), if it has one, comes in as `host`. */
export function consoleHandle(registry: Registry, host?: Host): ConsoleHandle {
  const call = (name: string, args: Record<string, unknown> = {}) => registry.call(name, args, { host });
  const handle: ConsoleHandle = {
    list: () => registry.list().map(describeTool),
    help: (name) => {
      const t = registry.get(name);
      return t ? describeTool(t) : registry.unknown(name);
    },
    call,
  };
  for (const t of registry.list()) handle[t.name] = (args?: Record<string, unknown>) => call(t.name, args);
  return handle;
}

/** Puts a registry's handle on `target` (globalThis by default) as `__M3A_TOOLS__`, and returns it. */
export function installConsole(registry: Registry, host?: Host, target: object = globalThis): ConsoleHandle {
  const handle = consoleHandle(registry, host);
  (target as Record<string, unknown>)[CONSOLE_KEY] = handle;
  return handle;
}
