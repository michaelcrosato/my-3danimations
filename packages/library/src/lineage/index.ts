// Lineage's surface (PLAN.md WP-9.3): the graph of every clip and what it was made from, resolved down to its sources,
// and deprecation without deletion over the lock's aliases.
export { Lineage, PROCEDURAL, type LineageEdge, type LineageNode, type LineageProblem, type Resolution } from "./graph.ts";
export { checkIds, clipIds, deprecate, successorOf, type IdProblem } from "./ids.ts";
