// Simulation and gameplay sync (PLAN.md WP-6.5, D75; spec/SIM.md): a script of a game's input run on a graph, its
// trace, its sensors and a filmstrip. Browser-safe: `npm run sim` (tools/sim/main.ts) reads the files and writes the
// results.
export { simulate, type SimOptions, type SimResult, type SimFinding } from "./simulate.ts";
export { validateScript, SIM_RULES, type SimScript, type SimInput, type SimIssue } from "./script.ts";
export { compareTraces, traceText, type Trace, type TraceState, type TraceEvent, type TraceHit } from "./trace.ts";
export { filmstrip } from "./film.ts";
