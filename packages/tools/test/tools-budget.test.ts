// What the m3a tools cost a model to see (PLAN.md WP-7.2's Done-when): every tool's name, description and input schema
// as MCP's tools/list sends them (the registry's verbose, if_revision, request_id and first example included), counted
// in cl100k tokens with the repository's pinned gpt-tokenizer. WP-7.2a's tools (find, check, change, ship, version and
// validate) take at most 1,900, leaving 1,100 for 7.2b's groups (compose at most 420, exchange at most 400); all of
// them at most 3,000 with WP-8.2a's review (about 90), and 3,200 with WP-9.1a's library (about 135, D112); one tool
// at most 240. The table is printed, with the whole
// tools/list (annotations and titles too) for comparison, unasserted. The registered names are pinned, in help order.
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { describe, expect, it } from "vitest";
import { mcpName, mcpTool } from "../src/mcp.ts";
import type { Tool } from "../src/registry/index.ts";
import { BASE, CHANGE, CHECK, COMPOSE, EXCHANGE, FIND, LIBRARY, RETARGET, REVIEW, SHIP, TOOLS, tools } from "../src/tools/index.ts";

/** cl100k tokens of a value as JSON. */
const tokens = (v: unknown) => encode(JSON.stringify(v)).length;
/** What describing tools to a model costs: their names, descriptions and input schemas. */
const cost = (list: readonly Tool[]) => tokens(list.map((t) => ({ name: mcpName(t.name), description: t.description, inputSchema: t.schema })));

describe("the tools' token budget", () => {
  it("describes WP-7.2a's tools in at most 1,900 tokens, compose in 420, exchange in 400, all in at most 3,200, none over 240", () => {
    const all = tools.list(), a = [...FIND, ...CHECK, ...CHANGE, ...SHIP, ...BASE], b = [...RETARGET, ...COMPOSE, ...EXCHANGE];
    const rows = all.map((t) => `${t.name.padEnd(18)} ${String(cost([t])).padStart(5)}`), sum = (k: string, n: number) => `${k.padEnd(18)} ${String(n).padStart(5)}`;
    console.log([...rows, sum("7.2a", cost(a)), sum("7.2b", cost(b)), sum("8.2a", cost(REVIEW)), sum("all", cost(all)), sum("tools/list", tokens(all.map(mcpTool)))].join("\n"));
    expect([...a, ...b, ...REVIEW, ...LIBRARY].map((t) => t.name).sort()).toEqual(all.map((t) => t.name).sort()); // each tool counted in 7.2a, 7.2b, 8.2a or 9.1a
    expect(cost(a)).toBeLessThanOrEqual(1900);
    expect(cost(COMPOSE)).toBeLessThanOrEqual(420);
    expect(cost(EXCHANGE)).toBeLessThanOrEqual(400);
    expect(cost(all)).toBeLessThanOrEqual(3200); // 3,000 to 8.2a's review; 3,200 from 9.1a's library (135 tokens), D112
    for (const t of all) expect(cost([t]), t.name).toBeLessThanOrEqual(240);
  });
  it("registers exactly the tools PLAN.md names, in help order", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["search", "show", "describe", "metrics", "sheet", "film", "diff", "lint", "fix", "edit", "retarget.inspect", "retarget.apply", "recipe.compile", "graph.validate", "graph.sim", "license.check", "import", "export", "review", "library", "version", "validate"]);
    expect(tools.list()).toEqual(TOOLS);
  });
  it("puts each tool's first example, a good call, in its schema, and only that; and gives each an output schema", () => {
    for (const t of tools.list()) {
      expect(t.output?.required?.length, t.name).toBeGreaterThan(0);
      expect([t.schema.examples, t.examples[0]!.expect ?? "ok"], t.name).toEqual([[t.examples[0]!.args], expect.stringMatching(/^(ok|findings)$/)]);
    }
  });
});
