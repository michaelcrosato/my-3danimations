// The surface runner for the m3a tools (PLAN.md WP-7.2): each example of a group, in a fresh working directory seeded
// with the files examples name, through four surfaces of one registry, all equal: the API, the CLI in-process (its
// report.json and exit code), MCP (structuredContent valid against replySchema, isError) and the console handle; and the
// CLI's and MCP's text each the API reply as render() writes it. Four calls an example, where WP-7.1's sweep makes
// eight: its own suite proves the verbose rendering.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, it } from "vitest";
import { commandLine, help, runCli } from "../../src/cli.ts";
import { mcpName, mcpServer, mcpTool } from "../../src/mcp.ts";
import { nodeHost } from "../../src/node.ts";
import { consoleHandle, describeTool, EXIT, memoryStore, Registry, render, replySchema, type Reply, type Tool } from "../../src/registry/index.ts";

/** The repository's root. */
export const ROOT = join(import.meta.dirname, "../../../..");

/** The files examples may name, copied into each example's working directory (about 220 kB). */
export const SEED: readonly string[] = ["spec/recipes", "spec/graphs", "spec/sims", ...["rig.gltf", "rigify.gltf", "rig-catalog.json", "rigify-expected.json"].map((f) => `spec/vectors/tier1b/${f}`), "library/sets/QUATERNIUS_3D2DGE/A_TPose.json"];

/** A fresh working directory under the OS's temp directory, seeded with SEED (none with `seed` false); `rm` deletes it. */
export function exampleCwd(seed = true): { cwd: string; rm(): void } {
  const cwd = mkdtempSync(join(tmpdir(), "m3a-ex-"));
  if (seed) for (const f of SEED) cpSync(join(ROOT, f), join(cwd, f), { recursive: true });
  return { cwd, rm: () => rmSync(cwd, { recursive: true, force: true }) };
}

const META = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
const ajv = new Ajv2020({ strict: false });

/** Registers the group's tests: every tool described the same on every surface, then one test per example. */
export function runExamples(group: readonly Tool[]): void {
  it(`${group.map((t) => t.name).join(", ")}: the same name, description and schema on every surface`, () => {
    const reg = new Registry(group), handle = consoleHandle(reg);
    for (const t of group) {
      const api = describeTool(t), m = mcpTool(t);
      expect({ name: m.title, description: m.description, params: m.inputSchema, edit: !m.annotations.readOnlyHint }).toEqual(api);
      expect([m.name, help(reg, t.name).data, handle.help(t.name)]).toEqual([mcpName(t.name), api, api]);
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
