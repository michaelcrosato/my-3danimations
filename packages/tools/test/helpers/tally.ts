// An edit-shaped demo tool for the durable store's tests (PLAN.md WP-7.2a), until `edit` lands: demo.tally adds to
// workshop/tally.txt, revisioned (its revision the count, "absent" before) and retry-safe. Run as a script, it is the
// m3a bin with this one tool: main() itself, so its store in the working directory's .m3a/requests/ is the bin's own.
import { main } from "../../src/node.ts";
import { defineTool } from "../../src/registry/registry.ts";

const FILE = "workshop/tally.txt";

/** demo.tally: workshop/tally.txt goes up by `by` (1). */
export const tally = defineTool({
  name: "demo.tally",
  description: "Add to a tally.",
  params: { type: "object", properties: { by: { type: "integer", minimum: 1, default: 1 } } },
  examples: [{ args: { request_id: "ex-1" } }],
  edit: { revision: async (_a, ctx) => (await ctx.tryRead(FILE)) ?? "absent" },
  async run(a: { by: number }, ctx) {
    const n = Number((await ctx.tryRead(FILE)) ?? 0) + a.by;
    return { verdict: `tally ${n}`, data: { n, path: ctx.write(FILE, String(n)) }, next: "add again", revision: String(n) };
  },
});

if (import.meta.main) process.exitCode = await main(process.argv.slice(2), [tally]);
