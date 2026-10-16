// What the m3a tools cost a model to see (PLAN.md WP-7.2's Done-when): every tool's name, description and input schema
// as MCP's tools/list sends them (the registry's verbose, if_revision, request_id and first example included), counted
// in cl100k tokens with the repository's pinned gpt-tokenizer. WP-7.2a's tools (find, check, change, ship, version and
// validate) take at most 1,900, leaving 1,100 for 7.2b's; all of them at most 3,000; one tool at most 240. The table is
// printed, with the whole tools/list (annotations and titles too) for comparison, unasserted.
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { describe, expect, it } from "vitest";
import { mcpName, mcpTool } from "../src/mcp.ts";
import type { Tool } from "../src/registry/index.ts";
import { BASE, CHANGE, CHECK, FIND, SHIP, tools } from "../src/tools/index.ts";

/** cl100k tokens of a value as JSON. */
const tokens = (v: unknown) => encode(JSON.stringify(v)).length;
/** What describing tools to a model costs: their names, descriptions and input schemas. */
const cost = (list: readonly Tool[]) => tokens(list.map((t) => ({ name: mcpName(t.name), description: t.description, inputSchema: t.schema })));

describe("the tools' token budget", () => {
  it("describes WP-7.2a's tools in at most 1,900 tokens, all in at most 3,000, none over 240", () => {
    const all = tools.list(), a = [...FIND, ...CHECK, ...CHANGE, ...SHIP, ...BASE];
    const rows = all.map((t) => `${t.name.padEnd(18)} ${String(cost([t])).padStart(5)}`);
    console.log([...rows, `${"7.2a".padEnd(18)} ${String(cost(a)).padStart(5)}`, `${"all".padEnd(18)} ${String(cost(all)).padStart(5)}`, `${"tools/list".padEnd(18)} ${String(tokens(all.map(mcpTool))).padStart(5)}`].join("\n"));
    expect(cost(a)).toBeLessThanOrEqual(1900);
    expect(cost(all)).toBeLessThanOrEqual(3000);
    for (const t of all) expect(cost([t]), t.name).toBeLessThanOrEqual(240);
  });
  it("puts each tool's first example, a good call, in its schema, and only that; and gives each an output schema", () => {
    for (const t of tools.list()) {
      expect(t.output?.required?.length, t.name).toBeGreaterThan(0);
      expect([t.schema.examples, t.examples[0]!.expect ?? "ok"], t.name).toEqual([[t.examples[0]!.args], expect.stringMatching(/^(ok|findings)$/)]);
    }
  });
});
