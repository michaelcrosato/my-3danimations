// The MCP server (PLAN.md §5.6), platform-neutral: one JSON-RPC message in, its response out; the Node entry carries
// it over stdio. Dual-era, per the 2026-07-28 revision (modelcontextprotocol.io/specification/2026-07-28): a request
// carrying `_meta["io.modelcontextprotocol/protocolVersion"]` is served statelessly (server/discover, resultType,
// ttlMs and cacheScope, serverInfo in each result's _meta, -32022 for a version it lacks); an `initialize` selects the
// legacy handshake for the process (2025-11-25 back to 2024-11-05, with ping). Handles are ordinary tool arguments.
// A tool's name is its registry name with "_" for "." (clients such as the Claude API take only [a-zA-Z0-9_-]), and its
// title the registry name. Unknown tools are JSON-RPC errors; wrong arguments and failing tools are results with
// isError, so a model can correct itself. Each result's text is the reply verdict first (every line with `verbose: true`)
// and structuredContent the whole Reply (m3a.reply/1, replySchema); tools/list leaves outputSchema out, which MCP makes
// optional: it would cost a model about 250 tokens a tool (PLAN.md WP-7.2). Images come as image content and as files
// under check-output/.
import { VERSION } from "@m3a/core";
import { didYouMean, quote } from "./registry/schema.ts";
import type { Host, Registry, Tool } from "./registry/registry.ts";
import { render } from "./registry/reply.ts";

/** The protocol revisions served per request (the stateless era). */
export const MODERN: readonly string[] = ["2026-07-28"];
/** The revisions served after an initialize handshake, newest first. */
export const LEGACY: readonly string[] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const META = "io.modelcontextprotocol/";
const INSTRUCTIONS = "m3a: character animation for agents. Every tool replies verdict first with a next hint; structuredContent is the whole reply (m3a.reply/1). Images come as image content, each with its size and token cost.";
const TOOLS_TTL_MS = 3_600_000;

/** A tool's MCP name: its registry name with "_" for ".". */
export const mcpName = (name: string) => name.replace(/\./g, "_");

/** A tool as MCP's tools/list shows it: no outputSchema, though structuredContent follows replySchema(t.output). */
export function mcpTool(t: Tool) {
  const name = mcpName(t.name);
  return { name, title: t.name, description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: !t.edit, openWorldHint: false } };
}

/** A JSON-RPC response. */
export type RpcResponse = { jsonrpc: "2.0"; id: string | number | null } & ({ result: Record<string, unknown> } | { error: { code: number; message: string; data?: unknown } });

/** An MCP server: `handle` takes one parsed message and resolves to its response (undefined for a notification). */
export interface McpServer {
  handle(msg: unknown): Promise<RpcResponse | undefined>;
}

/** The registry as an MCP server; `host` is its platform's (the Node entry's reads files and writes PNGs). */
export function mcpServer(registry: Registry, opts: { host?: Host } = {}): McpServer {
  const info = { name: "m3a", title: "m3a: character animation for agents", version: VERSION };
  let legacy: string | undefined;

  async function call(params: Record<string, unknown>) {
    const args = (params.arguments ?? {}) as Record<string, unknown>, pngs = new Map<string, Uint8Array>(), r = await registry.call(params.name as string, args, { host: opts.host, pngs });
    const images = r.images.flatMap((i) => (pngs.has(i.name) ? [{ type: "image", data: base64(pngs.get(i.name)!), mimeType: "image/png" }] : []));
    const text = render(r, { verbose: args.verbose === true, more: "call again with verbose: true" });
    return { content: [{ type: "text", text }, ...images], structuredContent: r, isError: r.status === "usage" || r.status === "error" };
  }

  return {
    async handle(msg) {
      if (Array.isArray(msg)) return fail(null, -32600, "Invalid Request: batches are not supported; send one message per line");
      const m = (msg ?? {}) as Record<string, unknown>, id = m.id as string | number | null | undefined;
      if (typeof m.method !== "string" || m.jsonrpc !== "2.0" || (id !== undefined && typeof id !== "string" && typeof id !== "number")) {
        return "result" in m || "error" in m ? undefined : fail(typeof id === "string" || typeof id === "number" ? id : null, -32600, 'Invalid Request: a JSON-RPC 2.0 request has "jsonrpc": "2.0", a string method and a string or number id');
      }
      if (id === undefined) return undefined; // a notification: initialized, cancelled, ... need no answer
      const params = (m.params ?? {}) as Record<string, unknown>, meta = (params._meta ?? {}) as Record<string, unknown>;
      const asked = meta[`${META}protocolVersion`], method = m.method;
      try {
        if (method === "initialize") {
          const v = params.protocolVersion as string;
          legacy = LEGACY.includes(v) ? v : LEGACY[0]!;
          return ok(id, { protocolVersion: legacy, capabilities: { tools: { listChanged: false } }, serverInfo: info, instructions: INSTRUCTIONS });
        }
        const modern = asked !== undefined;
        if (modern && !MODERN.includes(asked as string)) return fail(id, -32022, "Unsupported protocol version", { supported: [...MODERN, ...LEGACY], requested: asked });
        if (modern && typeof meta[`${META}clientCapabilities`] !== "object") return fail(id, -32602, `Invalid params: _meta["${META}clientCapabilities"] is required on every request`);
        if (!modern && !legacy && method !== "ping") return fail(id, -32602, `Invalid params: send _meta["${META}protocolVersion"] (one of ${MODERN.join(", ")}) on every request, or initialize first (${LEGACY.join(", ")})`);
        const done = (result: Record<string, unknown>, cache = false) => ok(id, modern ? { resultType: "complete", ...result, ...(cache ? { ttlMs: TOOLS_TTL_MS, cacheScope: "public" } : {}), _meta: { [`${META}serverInfo`]: info } } : result);
        if (method === "server/discover") return done({ supportedVersions: [...MODERN, ...LEGACY], capabilities: { tools: { listChanged: false } }, instructions: INSTRUCTIONS }, true);
        if (method === "ping" && !modern) return ok(id, {});
        if (method === "tools/list") return done({ tools: registry.list().map(mcpTool) }, true);
        if (method === "tools/call") {
          if (typeof params.name !== "string") return fail(id, -32602, "Invalid params: tools/call needs a tool name");
          if (params.arguments !== undefined && (typeof params.arguments !== "object" || params.arguments === null || Array.isArray(params.arguments))) return fail(id, -32602, "Invalid params: arguments is an object");
          if (!registry.get(params.name)) return fail(id, -32602, `Unknown tool: ${quote(params.name)}${didYouMean(params.name, registry.list().map((t) => mcpName(t.name)))}`);
          return done(await call(params));
        }
        return fail(id, -32601, `Method not found: ${quote(method)}${method === "ping" ? " (removed in 2026-07-28)" : ""}`);
      } catch (err) {
        return fail(id, -32603, `Internal error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

const ok = (id: string | number, result: Record<string, unknown>): RpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: string | number | null, code: number, message: string, data?: unknown): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } });

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Bytes as base64, without Node's Buffer or the DOM's btoa. */
export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[n >> 18]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : "=") + (i + 2 < bytes.length ? B64[n & 63]! : "=");
  }
  return out;
}
