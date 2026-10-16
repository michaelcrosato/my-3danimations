// The surface runner for the m3a tools (PLAN.md WP-7.2): each example of a group, in a fresh working directory seeded
// with the files examples name, through four surfaces of one registry, all equal: the API, the CLI in-process (its
// report.json and exit code), MCP (structuredContent valid against replySchema, isError; tools/list without
// outputSchema) and the console handle; and the
// CLI's and MCP's text each the API reply as render() writes it; and each call its next names (in backticks, the one
// form of common.ts call) parsed as the m3a command parses it, within its tool's schema. Four calls an example, where
// WP-7.1's sweep makes eight: its own suite proves the verbose rendering.
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, it } from "vitest";
import { commandLine, help, parseCall, runCli } from "../../src/cli.ts";
import { mcpName, mcpServer, mcpTool } from "../../src/mcp.ts";
import { nodeHost } from "../../src/node.ts";
import { check, consoleHandle, describeTool, EXIT, memoryStore, Registry, render, replySchema, type Reply, type Tool } from "../../src/registry/index.ts";
import { tools } from "../../src/tools/index.ts";
import { exampleCwd } from "./cwd.ts";

export { exampleCwd, ROOT, SEED } from "./cwd.ts";

const META = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
const ajv = new Ajv2020({ strict: false });

/** A command line's words as a POSIX shell splits them: '...' kept whole, "..." with \\ and \" escapes, \ escaping
 *  outside quotes. */
export function words(line: string): string[] {
  const out: string[] = [];
  let w: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (/\s/.test(ch)) {
      if (w !== null) out.push(w);
      w = null;
      continue;
    }
    w ??= "";
    if (ch === "'") {
      const end = line.indexOf("'", i + 1);
      w += line.slice(i + 1, end);
      i = end;
    } else if (ch === '"') {
      for (i++; line[i] !== '"'; i++) w += line[i] === "\\" && /["\\]/.test(line[i + 1]!) ? line[++i] : line[i];
    } else w += ch === "\\" ? line[++i] : ch;
  }
  if (w !== null) out.push(w);
  return out;
}

/** Each call `next` names, in backticks: its tool and the arguments the m3a command parses from it, or why not. */
export function hintedCalls(next: string): { call: string; tool?: string; args?: Record<string, unknown>; problem?: string }[] {
  return [...next.matchAll(/`([^`]+)`/g)].map(([, c]) => {
    const [name = "", ...argv] = words(c!), t = tools.get(name);
    if (!t) return { call: c!, problem: `no tool ${JSON.stringify(name)}` };
    const args = parseCall(t, argv), problem = typeof args === "string" ? args : check(args, t.schema);
    return { call: c!, tool: t.name, ...(typeof args === "string" ? {} : { args }), ...(problem ? { problem } : {}) };
  });
}

/** Registers the group's tests: every tool described the same on every surface, then one test per example. */
export function runExamples(group: readonly Tool[]): void {
  it(`${group.map((t) => t.name).join(", ")}: the same name, description and schema on every surface`, () => {
    const reg = new Registry(group), handle = consoleHandle(reg);
    for (const t of group) {
      const api = describeTool(t), m = mcpTool(t);
      expect({ name: m.title, description: m.description, params: m.inputSchema, edit: !m.annotations.readOnlyHint }).toEqual(api);
      expect([m.name, help(reg, t.name).data, handle.help(t.name)]).toEqual([mcpName(t.name), api, api]);
      expect(Object.keys(m).sort(), "tools/list sends no outputSchema (decision §8.2)").toEqual(["annotations", "description", "inputSchema", "name", "title"]);
    }
  });
  for (const t of group) {
    for (const [i, ex] of t.examples.entries()) {
      it(`${t.name} example ${i + 1} replies the same on every surface`, async () => {
        const { cwd, rm } = exampleCwd();
        try {
          const reg = new Registry(group, { ...memoryStore(), durable: true }), host = nodeHost(cwd), verbose = ex.args.verbose === true;
          const api = await reg.call(t.name, ex.args, { host });
          expect(api.status, api.verdict).toBe(ex.expect ?? "ok");
          expect(hintedCalls(api.next).filter((h) => h.problem), api.next).toEqual([]); // each runs as written
          let report = "null", text = "";
          const code = await runCli(reg, [...commandLine(t, ex.args), "--json"], { print: (x) => void (text += x), write: (_p, x) => void (report = x), host });
          expect([JSON.parse(report), code]).toEqual([api, EXIT[api.status]]);
          expect(text).toBe(`${render(api, { verbose, more: "rerun with --verbose", report: `check-output/${t.name}/report.json` })}\n`);
          const m = ((await mcpServer(reg, { host }).handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: mcpName(t.name), arguments: ex.args, _meta: META } })) as { result: Record<string, unknown> }).result;
          expect([m.structuredContent, m.isError]).toEqual([api, api.status === "usage" || api.status === "error"]);
          expect(ajv.validate(replySchema(t.output), m.structuredContent), ajv.errorsText()).toBe(true);
          expect((m.content as { text: string }[])[0]!.text).toBe(render(api, { verbose, more: "call again with verbose: true" }));
          expect(await (consoleHandle(reg, host)[t.name] as (a: object) => Promise<Reply>)(ex.args)).toEqual(api);
        } finally {
          rm();
        }
      });
    }
  }
}
