// @m3a/tools: the tool registry, the m3a CLI and the MCP server.
// The main entry stays runnable in a browser; Node built-ins go behind a `/node` entry (PLAN.md §5.1).

/** The version every `@m3a` package and the spec share. */
export { VERSION } from "@m3a/core";

/** This package's name. */
export const PACKAGE = "@m3a/tools";

/** Simulation (spec/SIM.md): a script of a game's input run on a graph, its trace, its sensors and a filmstrip. */
export * as sim from "./sim/index.ts";
