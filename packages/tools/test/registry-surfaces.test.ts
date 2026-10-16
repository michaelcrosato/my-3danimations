// The four surfaces of one registry (WP-7.1's Done-when): every tool shows the same name, description and schema, and
// every example (each one a test) gives the same reply through the TypeScript API, the m3a CLI (report.json and its exit
// code), the MCP server (structuredContent, valid against replySchema; isError for a failed tool only) and the
// console handle, and the same text on the CLI and MCP with and without verbose. It sweeps the WP-7.1 tools and demo
// tools; the m3a tools of WP-7.2 run on the cheaper runner of test/helpers/surfaces.ts. Then MCP itself: both eras, its errors
// against tool errors, images as image content; the Node host's paths; and the bin, as a process, on the CLI and stdio.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { raster } from "@m3a/sensors";
import { describe, expect, it } from "vitest";
import { commandLine, runCli } from "../src/cli.ts";
import { base64, mcpServer, mcpTool } from "../src/mcp.ts";
import { nodeHost } from "../src/node.ts";
import { consoleHandle, defineTool, describeTool, EXIT, memoryStore, Registry, replySchema, type Reply } from "../src/registry/index.ts";
import { validate, version } from "../src/tools/base.ts";

const ROOT = join(import.meta.dirname, "../../.."), BIN = join(ROOT, "packages/tools/src/node.ts"), host = nodeHost(ROOT);
const META = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
const swatch = defineTool({
  name: "demo.swatch",
  description: "Draw a swatch.",
  params: { type: "object", properties: { size: { type: "integer", minimum: 1, maximum: 64, default: 8 } } },
  examples: [{ args: { size: 4 } }],
  run: (a: { size: number }, ctx) => ({ verdict: "drawn", data: { ref: ctx.image("swatch", raster.image(a.size, a.size, [200, 40, 40])) }, next: "look at it" }),
});
let n = 0;
const note = defineTool({ name: "demo.note", description: "Count a note.", params: { type: "object", properties: {} }, examples: [{ args: { request_id: "ex-1" } }], edit: { revision: () => `r${n}` }, run: () => ({ verdict: `note ${++n}`, data: { n }, next: "again", revision: `r${n}` }) });
const long = defineTool({ name: "demo.long", description: "Many lines.", params: { type: "object", properties: { n: { type: "integer", minimum: 0, default: 30 } } }, examples: [{ args: {} }, { args: { n: 2, verbose: true } }], run: (a: { n: number }) => ({ verdict: `${a.n} lines`, data: {}, lines: Array.from({ length: a.n }, (_, i) => `line ${i + 1}`), next: "read them" }) });
const boom = defineTool({ name: "demo.boom", description: "Fail.", params: { type: "object", properties: {} }, examples: [{ args: {}, expect: "error" }], run: () => Promise.reject(new Error("no disk")) });
// runCli runs in this process here, so the store outlives each command, as WP-7.2's file will.
const reg = new Registry([version, validate, swatch, note, long, boom], { ...memoryStore(), durable: true });
const mcp = mcpServer(reg, { host }), handle = consoleHandle(reg, host);
const rpc = async (method: string, params: Record<string, unknown> = {}, meta: object | null = META) => (await mcp.handle({ jsonrpc: "2.0", id: 1, method, params: meta ? { ...params, _meta: meta } : params })) as { result?: Record<string, unknown>; error?: { code: number; message: string; data?: unknown } };
const ajv = new Ajv2020({ strict: false });

async function cli(argv: string[], json = ["--json"]): Promise<{ code: number; report: Reply; text: string }> {
  let report = "null", text = "";
  const code = await runCli(reg, [...argv, ...json], { print: (t) => void (text += t), write: (_p, t) => void (report = t), host });
  return { code, report: JSON.parse(report) as Reply, text };
}
/** A reply's text without the surface's own words for "ask for the rest". */
const said = (text: string) => text.replace(/(more lines?): .*/, "$1").trimEnd();

describe("one definition, four surfaces", () => {
  const listed = rpc("tools/list").then((r) => r.result!.tools as ReturnType<typeof mcpTool>[]);
  for (const t of reg.list()) {
    it(`${t.name}: the same name, description and schema everywhere`, async () => {
      const api = describeTool(t), m = (await listed).find((x) => x.title === t.name)!;
      expect((await cli(["help", t.name])).report.data).toEqual(api);
      expect({ name: m.title, description: m.description, params: m.inputSchema, edit: !m.annotations.readOnlyHint }).toEqual(api);
      expect(m.name).toBe(t.name.replace(/\./g, "_"));
      expect(handle.help(t.name)).toEqual(api);
    });
    for (const [i, ex] of t.examples.entries()) {
      it(`${t.name} example ${i + 1} replies the same on every surface`, async () => {
        const api = await reg.call(t.name, ex.args, { host });
        expect(api.status).toBe(ex.expect ?? "ok");
        const c = await cli(commandLine(t, ex.args));
        expect([c.report, c.code]).toEqual([api, EXIT[api.status]]);
        const m = (await rpc("tools/call", { name: t.name.replace(/\./g, "_"), arguments: ex.args })).result!;
        expect([m.structuredContent, m.isError]).toEqual([api, api.status === "error"]);
        expect(ajv.validate(replySchema(t.output), m.structuredContent), ajv.errorsText()).toBe(true);
        expect(await (handle[t.name] as (a: object) => Promise<Reply>)(ex.args)).toEqual(api);
        for (const verbose of [false, true]) {
          const args = { ...ex.args, verbose }, mt = (await rpc("tools/call", { name: t.name.replace(/\./g, "_"), arguments: args })).result!;
          expect(said((await cli(commandLine(t, args), [])).text)).toBe(said((mt.content as { text: string }[])[0]!.text));
        }
      });
    }
  }
  it("help --json writes a report valid against m3a.reply/1", async () => {
    for (const argv of [["help"], ["help", "version"]]) expect(ajv.validate(replySchema(), (await cli(argv)).report), ajv.errorsText()).toBe(true);
  });
});

describe("MCP", () => {
  it("serves a request statelessly when it carries the 2026-07-28 _meta", async () => {
    const d = (await rpc("server/discover")).result!;
    expect(d).toMatchObject({ resultType: "complete", supportedVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"], capabilities: { tools: { listChanged: false } }, cacheScope: "public" });
    expect(d._meta).toEqual({ "io.modelcontextprotocol/serverInfo": expect.objectContaining({ name: "m3a" }) });
    expect((await rpc("tools/list")).result).toMatchObject({ resultType: "complete", ttlMs: 3_600_000, cacheScope: "public" });
    expect((await rpc("tools/call", { name: "version" })).result).toMatchObject({ resultType: "complete", _meta: { "io.modelcontextprotocol/serverInfo": { name: "m3a" } } });
    expect((await rpc("tools/list", {}, { ...META, "io.modelcontextprotocol/protocolVersion": "2099-01-01" })).error).toMatchObject({ code: -32022, data: { requested: "2099-01-01" } });
    expect((await rpc("tools/list", {}, { "io.modelcontextprotocol/protocolVersion": "2026-07-28" })).error?.code).toBe(-32602);
    expect((await rpc("ping")).error?.code).toBe(-32601);
  });

  it("speaks the legacy handshake after initialize, negotiating the version", async () => {
    const legacy = mcpServer(reg, { host }), send = (method: string, params = {}) => legacy.handle({ jsonrpc: "2.0", id: 7, method, params }) as Promise<{ result?: Record<string, unknown>; error?: { code: number } }>;
    expect((await send("tools/list")).error?.code).toBe(-32602);
    expect((await send("ping")).result).toEqual({});
    expect((await send("initialize", { protocolVersion: "2099-01-01" })).result).toMatchObject({ protocolVersion: "2025-11-25", serverInfo: { name: "m3a" } });
    expect((await send("initialize", { protocolVersion: "2025-06-18" })).result!.protocolVersion).toBe("2025-06-18");
    expect(await legacy.handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeUndefined();
    const list = (await send("tools/list")).result!;
    expect(list.resultType).toBeUndefined();
    expect((list.tools as unknown[]).length).toBe(reg.list().length);
  });

  it("answers a wrong request with a JSON-RPC error and a wrong call with isError, naming the closest", async () => {
    expect((await rpc("tools/call", { name: "valdate" })).error).toEqual({ code: -32602, message: 'Unknown tool: "valdate"; did you mean "validate"?' });
    expect((await rpc("tools/call", { name: "version", arguments: [] })).error?.code).toBe(-32602);
    expect((await rpc("resources/list")).error?.code).toBe(-32601);
    expect(await mcp.handle([{ jsonrpc: "2.0", id: 1, method: "ping" }])).toMatchObject({ id: null, error: { code: -32600 } });
    expect(await mcp.handle({ id: 2, method: "ping" })).toMatchObject({ id: 2, error: { code: -32600 } });
    const r = (await rpc("tools/call", { name: "validate", arguments: { pth: "x" } })).result!;
    expect(r.isError).toBe(true);
    expect((r.content as { text: string }[])[0]!.text).toMatch(/^validate: usage error: unknown argument "pth"; did you mean "path"\?/);
    const proto = (await rpc("tools/call", { name: "version", arguments: JSON.parse('{"constructor":1,"__proto__":{}}') })).result!;
    expect([proto.isError, (proto.structuredContent as Reply).error?.message]).toEqual([true, expect.stringMatching(/^unknown argument "constructor"/)]);
  });

  it("cuts a result's text to 20 lines and gives every line with verbose: true", async () => {
    const text = async (verbose: boolean) => ((await rpc("tools/call", { name: "demo_long", arguments: { verbose } })).result!.content as { text: string }[])[0]!.text.split("\n");
    const [cut, all] = [await text(false), await text(true)];
    expect([cut.length, cut[18], all.length]).toEqual([20, "... 13 more lines: call again with verbose: true", 32]);
  });

  it("returns images as image content with their size and token cost, and writes them to check-output/", async () => {
    const r = (await rpc("tools/call", { name: "demo_swatch", arguments: { size: 16 } })).result!, content = r.content as { type: string; text?: string; data?: string }[];
    const file = readFileSync(join(ROOT, "check-output/demo.swatch/swatch.png"));
    expect(content[1]).toEqual({ type: "image", data: base64(file), mimeType: "image/png" });
    expect(base64(file)).toBe(file.toString("base64"));
    expect(content[0]!.text).toContain(`image swatch: 16x16, ${file.length} B PNG, ~1 tokens: check-output/demo.swatch/swatch.png`);
  });
});

describe("the m3a bin", () => {
  it("reads files under the working directory only", async () => {
    for (const path of ["", "/etc/hostname", "../x.json", "library/../../x.json"]) expect((await reg.call("validate", { path }, { host })).error?.code, path).toBe("E_PATH");
    expect((await reg.call("validate", { path: "" }, { host })).verdict).toBe("validate: usage error: the path is empty; give a file under the working directory, or pass its text");
    const far = (await reg.call("validate", { path: `/${"x".repeat(100)}` }, { host })).error?.message; // quoted, cut to 60
    expect(far).toBe(`"/${"x".repeat(54)}... is outside ${ROOT}; give a file under the working directory, or pass its text`);
  });

  it("runs the CLI: a report.json with the API's reply, and exit 2 naming the closest flag", () => {
    const run = (...a: string[]) => spawnSync(process.execPath, [BIN, ...a], { cwd: ROOT, encoding: "utf8" });
    const ok = run("validate", "library/sets/QUATERNIUS_3D2DGE/A_TPose.json", "--json");
    expect([ok.status, ok.stdout.split("\n")[0]]).toEqual([0, "validate library/sets/QUATERNIUS_3D2DGE/A_TPose.json: PASS, 0 errors, 0 warnings"]);
    expect(JSON.parse(readFileSync(join(ROOT, "check-output/validate/report.json"), "utf8"))).toMatchObject({ status: "ok", data: { ok: true } });
    const bad = run("validate", "--pth", "x");
    expect([bad.status, bad.stdout]).toEqual([2, expect.stringContaining('unknown flag "--pth"; did you mean "--path"?')]);
  });

  it("serves MCP over stdio, one message per line, and exits when stdin ends", () => {
    const lines = ["{oops", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "version", _meta: META } })].join("\n");
    const r = spawnSync(process.execPath, [BIN, "mcp"], { cwd: ROOT, input: `${lines}\n`, encoding: "utf8" });
    const out = r.stdout.trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(r.status).toBe(0);
    expect(out[0]).toMatchObject({ id: null, error: { code: -32700 } });
    expect(out[1]).toMatchObject({ id: 1, result: { isError: false, structuredContent: { tool: "version", status: "ok" } } });
  });
});
