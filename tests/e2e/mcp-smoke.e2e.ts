// e2e `mcp-smoke` (WP-7.1): the official MCP Inspector (@modelcontextprotocol/inspector, pinned; its CLI mode) drives
// `m3a mcp` over stdio as a client does: tools/list with --strict (no schema portability problem), tools/call on every
// example of every tool, each in a fresh seeded working directory so the ones that write leave nothing here (PLAN.md
// WP-7.2a §6.5; structuredContent equal to the API's reply; exit 5, isError, for one that expects an error), an
// unknown tool and a wrong argument refused. The inspector opens with the legacy initialize (2025-11-25); the
// stateless era is unit-tested in packages/tools/test/.
// Then the console handle in Chromium: the main entry, bundled by Vite, puts __M3A_TOOLS__ on a page and replies as Node.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { build, type Rollup } from "vite";
import { tools } from "../../packages/tools/src/index.ts";
import { nodeHost } from "../../packages/tools/src/node.ts";
import { exampleCwd } from "../../packages/tools/test/helpers/cwd.ts";

const ROOT = join(import.meta.dirname, "../..");
/** The inspector's CLI on `m3a mcp` in `cwd`; its catalog goes to check-output/, never the home directory. */
function inspector(cwd: string, ...args: string[]) {
  const env = { ...process.env, MCP_CATALOG_PATH: join(ROOT, "check-output/mcp-smoke/catalog.json") };
  const r = spawnSync(join(ROOT, "node_modules/.bin/mcp-inspector"), ["--cli", process.execPath, join(ROOT, "packages/tools/src/node.ts"), "mcp", ...args], { cwd, env, encoding: "utf8", timeout: 60_000 });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test("the MCP Inspector lists every tool with portable schemas", () => {
  const r = inspector(ROOT, "--method", "tools/list", "--strict");
  expect([r.code, r.err], r.err).toEqual([0, ""]);
  const listed = (JSON.parse(r.out) as { tools: { name: string; title: string; inputSchema: unknown }[] }).tools;
  expect(listed.map((t) => [t.title, t.inputSchema])).toEqual(tools.list().map((t) => [t.name, t.schema]));
});

test("the MCP Inspector calls every example and gets the API's reply", async () => {
  for (const t of tools.list()) {
    for (const ex of t.examples) {
      const { cwd, rm } = exampleCwd();
      try {
        const r = inspector(cwd, "--method", "tools/call", "--tool-name", t.name.replace(/\./g, "_"), "--tool-args-json", JSON.stringify(ex.args));
        expect(r.code, r.out + r.err).toBe(ex.expect === "error" ? 5 : 0); // the inspector exits 5 on isError
        expect((JSON.parse(r.out) as { structuredContent: unknown }).structuredContent).toEqual(await tools.call(t.name, ex.args, { host: nodeHost(cwd) }));
      } finally {
        rm();
      }
    }
  }
  const unknown = inspector(ROOT, "--method", "tools/call", "--tool-name", "valdate");
  expect([unknown.code, unknown.out + unknown.err]).toEqual([5, expect.stringContaining("tool_not_found")]);
  const wrong = inspector(ROOT, "--method", "tools/call", "--tool-name", "validate", "--tool-args-json", '{"pth":"x"}');
  expect([wrong.code, wrong.out + wrong.err]).toEqual([5, expect.stringContaining('unknown argument \\"pth\\"; did you mean \\"path\\"?')]);
});

test("the console handle runs in Chromium and replies as Node does", async ({ page }) => {
  const entry = "\0m3a-console";
  const bundle = (await build({
    configFile: false,
    logLevel: "error",
    plugins: [{ name: "m3a-console", resolveId: (id) => (id === "m3a-console" ? entry : undefined), load: (id) => (id === entry ? 'import { installConsole, tools } from "@m3a/tools"; installConsole(tools);' : undefined) }],
    build: { write: false, minify: false, rollupOptions: { input: "m3a-console" } },
  })) as Rollup.RollupOutput;
  await page.setContent("<!doctype html><title>m3a console</title>");
  await page.addScriptTag({ type: "module", content: (bundle.output[0] as Rollup.OutputChunk).code });
  await page.waitForFunction(() => "__M3A_TOOLS__" in window);
  const text = '{"format":"2.0","id":"DEMO/Bad","dur":0}';
  const got = await page.evaluate(async (t) => {
    const h = (window as unknown as { __M3A_TOOLS__: Record<string, (a?: object) => Promise<unknown>> }).__M3A_TOOLS__;
    return [await h.version!(), await h.validate!({ text: t }), await h.validate!({ path: "x.json" })];
  }, text);
  expect(got.slice(0, 2)).toEqual([await tools.call("version"), await tools.call("validate", { text })]);
  expect(got[2]).toMatchObject({ status: "usage", error: { code: "E_HOST" } });
});
