// The tool registry's surface (PLAN.md §5.6, WP-7.1): defineTool and the Registry, the JSON Schema checker, the reply
// and its text, the console handle, and the m3a tools. The CLI (../cli.ts) and the MCP server (../mcp.ts) serve it.
export { defineTool, describeTool, memoryStore, reply, usage, Registry, ToolError, RESERVED, type CallOptions, type Description, type Example, type Host, type RequestStore, type Tool, type ToolContext, type ToolDef, type ToolOutput } from "./registry.ts";
export { check, closest, didYouMean, type Schema, type SchemaType } from "./schema.ts";
export { EXIT, MAX_LINES, REPLY_ID, imageLine, imageTokens, render, replySchema, type ImageRef, type Reply, type Status } from "./reply.ts";
export { CONSOLE_KEY, consoleHandle, installConsole, type ConsoleHandle } from "./console.ts";
export { tools, validate, version } from "./tools.ts";
