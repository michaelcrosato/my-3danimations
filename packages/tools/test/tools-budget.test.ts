// What the m3a tools cost a model to see (PLAN.md WP-7.2's Done-when): every tool's name, description and input schema
// as MCP's tools/list sends them (the registry's verbose, if_revision, request_id and first example included), counted
// in cl100k tokens with the repository's pinned gpt-tokenizer. WP-7.2a's tools (find, check, change, ship, version and
// validate) take at most 1,900, leaving 1,100 for 7.2b's (exchange's two at most 400); all of them at most 3,000; one
// tool at most 240. The table is printed, with the whole tools/list (annotations and titles too) for comparison,
// unasserted. The tools registered are exactly PLAN.md's, in help order.
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { describe, expect, it } from "vitest";
import { mcpName, mcpTool } from "../src/mcp.ts";
import type { Tool } from "../src/registry/index.ts";
import { BASE, CHANGE, CHECK, EXCHANGE, FIND, SHIP, TOOLS, tools } from "../src/tools/index.ts";

/** cl100k tokens of a value as JSON. */
const tokens = (v: unknown) => encode(JSON.stringify(v)).length;
/** What describing tools to a model costs: their names, descriptions and input schemas. */
const cost = (list: readonly Tool[]) => tokens(list.map((t) => ({ name: mcpName(t.name), description: t.description, inputSchema: t.schema })));

describe("the tools' token budget", () => {
  it("describes WP-7.2a's tools in at most 1,900 tokens, 7.2b's exchange in 400, all in at most 3,000, none over 240", () => {
    // 7.2b's groups: RETARGET and COMPOSE join EXCHANGE as their lanes merge
    const all = tools.list(), a = [...FIND, ...CHECK, ...CHANGE, ...SHIP, ...BASE], b = [...EXCHANGE];
    const rows = all.map((t) => `${t.name.padEnd(18)} ${String(cost([t])).padStart(5)}`), row = (n: string, v: number) => `${n.padEnd(18)} ${String(v).padStart(5)}`;
    console.log([...rows, row("7.2a", cost(a)), row("7.2b", cost(b)), row("all", cost(all)), row("tools/list", tokens(all.map(mcpTool)))].join("\n"));
    expect(cost(a)).toBeLessThanOrEqual(1900);
    expect(cost(EXCHANGE)).toBeLessThanOrEqual(400);
    expect([...a, ...b].map((t) => t.name).sort()).toEqual(all.map((t) => t.name).sort()); // each tool counted in 7.2a or 7.2b
    expect(cost(all)).toBeLessThanOrEqual(3000);
    for (const t of all) expect(cost([t]), t.name).toBeLessThanOrEqual(240);
  });
  it("registers exactly the tools PLAN.md names, in help order", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["search", "show", "describe", "metrics", "sheet", "film", "diff", "lint", "fix", "edit", "license.check", "import", "export", "version", "validate"]);
    expect(tools.list()).toEqual(TOOLS);
  });
  it("puts each tool's first example, a good call, in its schema, and only that; and gives each an output schema", () => {
    for (const t of tools.list()) {
      expect(t.output?.required?.length, t.name).toBeGreaterThan(0);
      expect([t.schema.examples, t.examples[0]!.expect ?? "ok"], t.name).toEqual([[t.examples[0]!.args], expect.stringMatching(/^(ok|findings)$/)]);
    }
  });
});
