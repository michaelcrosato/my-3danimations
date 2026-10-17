// The tool registry's surface (PLAN.md §5.6, WP-7.1): defineTool and the Registry, the JSON Schema checker, the reply
// and its text, and the console handle. The m3a tools are in ../tools/; the CLI (../cli.ts) and the MCP server
// (../mcp.ts) serve them.
export { defineTool, describeTool, memoryStore, reply, usage, Registry, ToolError, RESERVED, type CallOptions, type Description, type Example, type Host, type LibraryAccess, type RequestStore, type Tool, type ToolContext, type ToolDef, type ToolOutput } from "./registry.ts";
export { check, closest, didYouMean, type Schema, type SchemaType } from "./schema.ts";
export { EXIT, MAX_LINES, REPLY_ID, imageLine, imageTokens, render, replySchema, type ImageRef, type Reply, type Status } from "./reply.ts";
export { CONSOLE_KEY, consoleHandle, installConsole, type ConsoleHandle } from "./console.ts";
