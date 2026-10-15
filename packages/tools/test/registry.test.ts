// The tool registry (WP-7.1): definitions refused with their fix, arguments checked with "did you mean" (own names
// only), defaults filled, edits' request_id (a retry applies once; the same id with other arguments is refused) and
// if_revision, failures as replies, the one-line verdict and 20-line text, and the CLI's parsing and exit codes.
import { describe, expect, it } from "vitest";
import { commandLine, parseCall, runCli } from "../src/cli.ts";
import { CONSOLE_KEY, defineTool, EXIT, imageTokens, installConsole, Registry, render, reply, ToolError } from "../src/registry/index.ts";

const noop = { verdict: "ok", data: {}, next: "nothing" };
const tool = (over: Record<string, unknown> = {}) => defineTool({ name: "demo", description: "A demo.", params: { type: "object", properties: {} }, examples: [{ args: {} }], run: () => noop, ...over });

/** A counter behind an edit tool: each applied edit sets `value` and moves the revision on. */
function counter() {
  const state = { n: 0, value: 0 };
  const edit = defineTool<{ value: number; tags?: string[]; request_id?: string; if_revision?: string }, { value: number }>({
    name: "demo.set",
    description: "Set the counter's value.",
    params: { type: "object", properties: { value: { type: "integer", minimum: 0, description: "the new value" }, tags: { type: "array", items: { type: "string", enum: ["a", "b"] } } }, required: ["value"] },
    examples: [{ args: { value: 1 } }],
    positionals: ["value"],
    edit: { revision: () => `r${state.n}` },
    run(a) {
      state.n++;
      state.value = a.value;
      return { verdict: `set to ${a.value}`, data: { value: a.value }, next: "read it back", revision: `r${state.n}` };
    },
  });
  return { state, edit, reg: new Registry([edit]) };
}

describe("defineTool", () => {
  it("refuses a malformed definition, naming the fix", () => {
    expect(() => tool({ name: "Bad_Name" })).toThrow(/lower-case words/);
    expect(() => tool({ name: "help" })).toThrow(/kept for the surfaces/);
    expect(() => tool({ examples: [] })).toThrow(/give it an example/);
    expect(() => tool({ params: { type: "object", properties: { verbose: { type: "boolean" } } } })).toThrow(/kept by the registry and the CLI/);
    for (const p of ["path", "constructor"]) expect(() => tool({ positionals: [p] })).toThrow(/not one of its parameters/);
    expect(() => tool({ edit: {} })).toThrow(/give edit.revision\(args, ctx\), so if_revision is checked/);
    expect(() => new Registry([tool(), tool()])).toThrow(/defined twice/);
  });
  it("adds verbose (and an edit's if_revision and request_id) and the examples to the schema", () => {
    const { edit } = counter();
    expect(Object.keys(edit.schema.properties!)).toEqual(["value", "tags", "if_revision", "request_id", "verbose"]);
    expect(edit.schema).toMatchObject({ additionalProperties: false, examples: [{ value: 1 }] });
  });
});

describe("Registry.call", () => {
  it("refuses wrong arguments and unknown tools with the closest valid name", async () => {
    const { reg } = counter(), err = async (args: unknown) => (await reg.call("demo.set", args)).error?.message;
    expect(await err({ valeu: 2 })).toBe('unknown argument "valeu"; did you mean "value"? (takes value, tags, if_revision, request_id, verbose)');
    expect(await err({})).toBe("value is required: the new value");
    expect(await err({ value: "2" })).toBe('value should be an integer, not "2"');
    expect(await err({ value: -1 })).toBe("value is -1, below its minimum 0");
    expect(await err({ value: 1, tags: ["a", "bb"] })).toBe('tags[1] is "bb", not one of a, b; did you mean "b"?');
    expect(await err({ value: "x".repeat(500) })).toBe(`value should be an integer, not "${"x".repeat(55)}...`);
    expect(await err({ value: 1, constructor: 1 })).toMatch(/^unknown argument "constructor"; did you mean/); // own names only
    expect(await err(JSON.parse('{"value":1,"__proto__":{}}'))).toMatch(/^unknown argument "__proto__"/);
    const r = await reg.call("demo_sett");
    expect(r).toMatchObject({ tool: "m3a", status: "usage", error: { code: "E_TOOL", message: 'no tool "demo_sett"; did you mean "demo.set"?' } });
    expect((await reg.call("demo_set", { value: 3 })).status).toBe("ok"); // MCP's spelling of the name
  });

  it("applies a retried request_id once and refuses the same id with other arguments", async () => {
    const { state, reg } = counter();
    const first = await reg.call("demo.set", { value: 5, request_id: "r-1" });
    expect(await reg.call("demo.set", { value: 5, request_id: "r-1", verbose: true })).toEqual(first);
    expect(state).toEqual({ n: 1, value: 5 });
    const other = await reg.call("demo.set", { value: 6, request_id: "r-1" });
    expect(other).toMatchObject({ status: "usage", error: { code: "E_REQUEST_ID" } });
    expect(other.error!.message).toBe('request_id "r-1" was first used with other arguments (they differ in value)');
    expect(state).toEqual({ n: 1, value: 5 });
    expect((await reg.call("demo.set", { value: -1, request_id: "r-2" })).status).toBe("usage"); // refused calls are not kept
    expect((await reg.call("demo.set", { value: 7, request_id: "r-2" })).revision).toBe("r2");
  });

  it("fills defaults, so a call without one is the call with it, also for a retried request_id", async () => {
    const seen: object[] = [], mode = { type: "string", enum: ["a", "b"], default: "a" } as const;
    const reg = new Registry([tool({ name: "demo.mode", params: { type: "object", properties: { mode } }, edit: { revision: () => "r0" }, run: (a: object) => (seen.push(a), noop) })]);
    expect(await reg.call("demo.mode", {})).toEqual(await reg.call("demo.mode", { mode: "a" }));
    const first = await reg.call("demo.mode", { request_id: "q" });
    expect(await reg.call("demo.mode", { mode: "a", request_id: "q" })).toEqual(first);
    expect(seen).toEqual([{ mode: "a" }, { mode: "a" }, { mode: "a", request_id: "q" }]);
  });

  it("checks if_revision before an edit and replies with the current revision on a conflict", async () => {
    const { state, reg } = counter();
    const stale = await reg.call("demo.set", { value: 2, if_revision: "r9" });
    expect(stale).toMatchObject({ status: "error", revision: "r0", error: { code: "E_CONFLICT" }, next: 'read it again, then retry with if_revision "r0"' });
    expect(state.n).toBe(0);
    expect(await reg.call("demo.set", { value: 2, if_revision: "r0" })).toMatchObject({ status: "ok", revision: "r1" });
  });

  it("turns a failing tool into a reply: ToolError usage (2), any other throw an error (1), data must be an object", async () => {
    const reg = new Registry([
      tool({ name: "a", run: () => { throw new ToolError("E_X", "give x", true); } }),
      tool({ name: "b", run: () => { throw new Error("boom"); } }),
      tool({ name: "c", run: () => ({ ...noop, data: [1] }) }),
    ]);
    expect(await reg.call("a")).toMatchObject({ status: "usage", error: { code: "E_X", message: "give x" } });
    expect(await reg.call("b")).toMatchObject({ status: "error", verdict: "b: error: boom", error: { code: "E_RUN" } });
    expect((await reg.call("c")).error?.message).toBe("c replied with data that is not a JSON object");
    expect((await reg.call("a", {}, {})).next).toMatch(/schema lists its arguments/);
    expect((await new Registry([tool({ name: "d", run: async (_a: object, ctx: { read(p: string): Promise<string> }) => ({ ...noop, verdict: await ctx.read("x") }) })]).call("d")).error?.code).toBe("E_HOST");
  });
});

describe("the reply's text", () => {
  const long = reply("demo", "findings", { verdict: "demo: FAIL", data: {}, next: "fix it", lines: Array.from({ length: 30 }, (_, i) => `line ${i + 1}`) }, [{ name: "sheet", width: 1000, height: 1000, tokens: imageTokens(1000, 1000), bytes: 20480, path: "check-output/demo/sheet.png" }]);
  it("puts the verdict first, cuts the details to 20 lines with how to see the rest, and ends with next", () => {
    const lines = render(long, { more: "rerun with --verbose" }).split("\n");
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe("demo: FAIL");
    expect(lines.slice(-3)).toEqual(["... 14 more lines: rerun with --verbose", "image sheet: 1000x1000, 20.0 kB PNG, ~1334 tokens: check-output/demo/sheet.png", "next: fix it"]);
    expect(render(long, { verbose: true }).split("\n")).toHaveLength(33);
    expect(reply("demo", "ok", { verdict: "not JSON:\n  a\nb", data: {}, lines: ["c\nd"], next: "n" })).toMatchObject({ verdict: "not JSON: a b", lines: ["c", "d"] });
  });
  it("prices an image as a model sees it, downscaled to 1568 px and about 1.15 megapixels", () => {
    expect(imageTokens(1000, 1000)).toBe(1334);
    expect(imageTokens(4000, 3000)).toBeLessThan(1600);
    expect(EXIT).toEqual({ ok: 0, findings: 1, error: 1, usage: 2 });
  });
});

describe("the CLI", () => {
  const io = () => {
    const out = { text: "", files: {} as Record<string, string> };
    return { out, io: { print: (t: string) => void (out.text += t), write: (p: string, t: string) => void (out.files[p] = t) } };
  };
  it("parses positionals, flags in both spellings, booleans, numbers and repeated arrays", () => {
    const { edit } = counter();
    expect(parseCall(edit, ["3", "--tags", "a", "--tags=b", "--request-id", "x", "--verbose"])).toEqual({ value: 3, tags: ["a", "b"], request_id: "x", verbose: true });
    expect(parseCall(edit, ["--value=4", "--if_revision", "r0"])).toEqual({ value: 4, if_revision: "r0" });
    expect(parseCall(edit, ["3", "4"])).toMatch(/"4" is one argument too many/);
    expect(parseCall(edit, ["--valeu", "4"])).toMatch(/^unknown flag --valeu; did you mean "--value"\?/);
    expect(parseCall(edit, ["--value"])).toBe('--value needs a value: the new value (one starting with "--" is written --value=<value>)');
    expect(parseCall(edit, ["--value", "--verbose"])).toMatch(/^--value needs a value/);
    expect(parseCall(edit, ["-1"])).toEqual({ value: -1 });
    expect(parseCall(edit, ["-v", "3"])).toMatch(/^unknown flag -v: flags take two dashes; did you mean "--value"\? \(demo.set takes --value/);
    expect(parseCall(edit, ["3", "--value=4"])).toBe("--value is given twice; give it once (only an array flag repeats)");
    expect(parseCall(edit, ["--json=true"])).toBe("--json takes no value; write --json alone");
    for (const f of ["--constructor", "--__proto__", "--toString"]) expect(parseCall(edit, [f, "x"])).toMatch(new RegExp(`^unknown flag ${f};`));
    expect(commandLine(edit, { value: 3, tags: ["a"], verbose: true })).toEqual(["demo.set", "3", '--tags=["a"]', "--verbose"]);
  });
  it("exits 0 ok, 1 findings, 2 usage, and writes report.json with --json", async () => {
    const { reg } = counter(), run = async (...argv: string[]) => {
      const { out, io: x } = io();
      return { code: await runCli(reg, argv, x), ...out };
    };
    const ok = await run("demo.set", "2", "--json");
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.files["check-output/demo.set/report.json"]!)).toMatchObject({ schema: "m3a.reply/1", status: "ok", data: { value: 2 } });
    expect(ok.text).toBe("set to 2\nreport: check-output/demo.set/report.json\nnext: read it back\n");
    expect((await run("demo.set", "--value", "x")).code).toBe(2);
    expect((await run("demo.sett")).text).toContain('no tool "demo.sett"; did you mean "demo.set"?');
    expect((await run()).text).toMatch(/^m3a .*: 1 tools;/);
    expect((await run("demo.set", "-h")).text).toContain("  m3a demo.set 1\n");
  });
});

describe("the console handle", () => {
  it("puts every tool on the page under __M3A_TOOLS__", async () => {
    const { reg } = counter(), page: Record<string, unknown> = {};
    const h = installConsole(reg, undefined, page);
    expect(page[CONSOLE_KEY]).toBe(h);
    expect(await (h["demo.set"] as (a: object) => Promise<unknown>)({ value: 1 })).toMatchObject({ status: "ok" });
    expect(h.help("demo.st")).toMatchObject({ status: "usage" });
    expect(h.list().map((d) => d.name)).toEqual(["demo.set"]);
  });
});

