// @m3a/tools: the tool registry, the m3a CLI and the MCP server.
// The main entry stays runnable in a browser; Node built-ins go behind a `/node` entry (PLAN.md §5.1).

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "@m3a/core";

/** This package's name. */
export const PACKAGE = "@m3a/tools";

/** Simulation (spec/SIM.md): a script of a game's input run on a graph, its trace, its sensors and a filmstrip. */
export * as sim from "./sim/index.ts";

/** The tool registry (PLAN.md §5.6): defineTool, the Registry, the reply and its text, the console handle. */
export * as registry from "./registry/index.ts";
/** The m3a tools as one registry (retries kept in memory): what the API and the console handle serve. */
export { tools } from "./tools/index.ts";
/** Every m3a tool in help order; the m3a CLI and the MCP server serve them with retries kept in .m3a/requests/. */
export { TOOLS } from "./tools/index.ts";
/** Puts a registry's tools on a page as `__M3A_TOOLS__`, the console handle. */
export { installConsole } from "./registry/index.ts";
/** The m3a command line, platform-neutral: argv in; the reply's text, report.json and the exit code out. */
export { runCli } from "./cli.ts";
/** The MCP server, platform-neutral: one JSON-RPC message in, its response out (`m3a mcp` carries it over stdio). */
export { mcpServer } from "./mcp.ts";
/** The intake queue (PLAN.md §5.9): IntakeStore, its backends, the hashes, the queue and review formats, applyReview. */
export * as intake from "./intake/index.ts";
