// The tool registry (WP-7.1): definitions refused with their fix, arguments checked with "did you mean" (own names
// only), defaults filled, edits' request_id (a retry applies once, even when its data then fails the checks; the same id
// with other arguments is refused) and if_revision, nested objects closed, output schemas enforced, failures as replies,
// the one-line verdict and 20-line text (many images folded), and the CLI's parsing, help (the index uncut), exit codes
// and --request-id refusal.
import { describe, expect, it } from "vitest";
import { commandLine, parseCall, runCli } from "../src/cli.ts";
import { CONSOLE_KEY, defineTool, EXIT, imageTokens, installConsole, memoryStore, Registry, render, reply, ToolError } from "../src/registry/index.ts";

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
    const id = { type: "object", properties: { request_id: { type: "string" } } } as const;
    expect(() => tool({ params: id })).toThrow('"request_id" is kept by the registry and the CLI (--request-id)'); // read-only too
    for (const p of ["path", "constructor"]) expect(() => tool({ positionals: [p] })).toThrow(/not one of its parameters/);
    expect(() => tool({ edit: {} })).toThrow(/give edit.revision\(args, ctx\), so if_revision is checked/);
    expect(() => tool({ params: { type: "object", properties: { "dry-run": { type: "boolean" } } } })).toThrow('rename it "dry_run", which the CLI spells --dry-run');
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
    const first = await reg.call("demo.set", { value: 5, tags: ["a"], request_id: "r-1" });
    expect(await reg.call("demo.set", { request_id: "r-1", tags: ["a"], value: 5, verbose: true })).toEqual(first); // key order aside
    expect(state).toEqual({ n: 1, value: 5 });
    const other = await reg.call("demo.set", { value: 6, tags: ["a"], request_id: "r-1" });
    expect(other).toMatchObject({ status: "usage", error: { code: "E_REQUEST_ID" } });
    expect(other.error!.message).toBe('request_id "r-1" was first used with other arguments (they differ in value)');
    expect(state).toEqual({ n: 1, value: 5 });
    expect((await reg.call("demo.set", { value: -1, request_id: "r-2" })).status).toBe("usage"); // refused calls are not kept
    expect((await reg.call("demo.set", { value: 7, request_id: "r-2" })).revision).toBe("r2");
  });

  it("keeps request_ids per tool, and only replies that applied", async () => {
    let calls = 0;
    const flaky = tool({ name: "demo.flaky", edit: { revision: () => "r0" }, run: () => (++calls === 1 ? Promise.reject(new Error("busy")) : noop) });
    const reg = new Registry([counter().edit, flaky]), again = async () => (await reg.call("demo.flaky", { request_id: "same" })).status;
    expect((await reg.call("demo.set", { value: 1, request_id: "same" })).status).toBe("ok");
    expect([await again(), await again(), calls]).toEqual(["error", "ok", 2]);
    let n = 0; // an edit that applied, though its data is off its output schema: kept, with its revision
    const output = { type: "object", properties: { n: { type: "integer" } } }, run = () => ({ ...noop, data: { n: String(++n) }, revision: `r${n}` });
    const once = new Registry([tool({ name: "demo.bump", output, edit: { revision: () => `r${n}` }, run })]);
    const first = await once.call("demo.bump", { request_id: "q" });
    expect(first).toMatchObject({ status: "error", revision: "r1", error: { code: "E_RUN" } });
    expect([await once.call("demo.bump", { request_id: "q" }), n]).toEqual([first, 1]);
  });

  it("closes nested objects unless they say otherwise, and checks ranges and forms", async () => {
    const fps = { type: "integer", maximum: 120 }, open = { type: "object", properties: { fps }, additionalProperties: true };
    const opts = { type: "object", properties: { fps } }, n = { anyOf: [{ type: "integer" }, { type: "null" }] };
    const keys = { type: "array", items: { type: "object", properties: { t: fps } } }, pick = { anyOf: [opts, { type: "string" }] };
    const reg = new Registry([tool({ name: "demo.opts", params: { type: "object", properties: { opts, open, n, keys, pick } } })]);
    const err = async (args: object) => (await reg.call("demo.opts", args)).error?.message;
    expect(await err({ opts: { fsp: 30 } })).toBe('unknown field in opts "fsp"; did you mean "fps"? (takes fps)');
    expect(await err({ keys: [{ t: 1 }, { tt: 1 }] })).toBe('unknown field in keys[1] "tt"; did you mean "t"? (takes t)');
    expect([await err({ pick: { fsp: 1 } }), await err({ pick: { fps: 1 } })]).toEqual(["pick matches none of its 2 forms", undefined]);
    expect(await err({ opts: { fps: 121 } })).toBe("opts.fps is 121, above its maximum 120");
    expect(await err({ open: { fsp: 1 }, n: null })).toBeUndefined();
    expect(await err({ n: "1" })).toBe("n matches none of its 2 forms");
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
      tool({ name: "e", output: { type: "object", properties: { n: { type: "integer" } } }, run: () => ({ ...noop, data: { n: "x" } }) }),
    ]);
    expect(await reg.call("a")).toMatchObject({ status: "usage", error: { code: "E_X", message: "give x" } });
    expect(await reg.call("b")).toMatchObject({ status: "error", verdict: "b: error: boom", error: { code: "E_RUN" } });
    expect((await reg.call("c")).error?.message).toBe("c replied with data that is not a JSON object");
    expect((await reg.call("e")).error).toEqual({ code: "E_RUN", message: 'e replied with data off its output schema (data.n should be an integer, not "x")' });
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
  it("folds more than 10 images into one line unless verbose", () => {
    const img = (i: number) => ({ name: `i${i}`, width: 100, height: 100, tokens: 14, bytes: null, path: `check-output/demo/i${i}.png` });
    const imgs = (k: number) => reply("demo", "ok", { ...noop, lines: ["a", "b", "c"] }, Array.from({ length: k }, (_, i) => img(i)));
    const all = "25 images, ~350 tokens in all: check-output/demo/ (to list each: rerun with --verbose)";
    expect(render(imgs(25), { more: "rerun with --verbose" }).split("\n")).toEqual(["ok", "a", "b", "c", all, "next: nothing"]);
    expect(render(imgs(25), { verbose: true }).split("\n")).toHaveLength(30);
    expect([10, 11].map((k) => render(imgs(k)).split("\n").length)).toEqual([15, 6]); // 10 listed, 11 folded
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
  const cliOf = (reg: Registry) => async (...argv: string[]) => {
    const { out, io: x } = io();
    return { code: await runCli(reg, argv, x), ...out };
  };
  it("parses positionals, flags in both spellings, booleans, numbers and repeated arrays", () => {
    const { edit } = counter();
    expect(parseCall(edit, ["3", "--tags", "a,b", '--tags=["b"]', "--request-id", "x", "--verbose"])).toEqual({ value: 3, tags: ["a", "b", "b"], request_id: "x", verbose: true });
    expect(parseCall(edit, ["--value=4", "--if_revision", "r0"])).toEqual({ value: 4, if_revision: "r0" });
    expect(parseCall(edit, ["3", "4"])).toMatch(/"4" is one argument too many/);
    expect(parseCall(edit, ["--valeu", "4"])).toMatch(/^unknown flag "--valeu"; did you mean "--value"\?/);
    expect(parseCall(edit, ["--value"])).toBe('--value needs a value: the new value (one starting with "--" is written --value=<value>)');
    expect(parseCall(edit, ["--value", "--verbose"])).toMatch(/^--value needs a value/);
    expect(parseCall(edit, ["-1"])).toEqual({ value: -1 });
    expect(parseCall(edit, ["-v", "3"])).toMatch(/^unknown flag "-v": flags take two dashes; did you mean "--value"\? \(demo.set takes --value/);
    expect(parseCall(edit, ["3", "--value=4"])).toBe("--value is given twice; give it once (only an array flag repeats)");
    expect(parseCall(edit, ["--json=true"])).toBe("--json takes no value; write --json alone");
    for (const f of ["--constructor", "--__proto__", "--toString"]) expect(parseCall(edit, [f, "x"])).toMatch(new RegExp(`^unknown flag "${f}";`));
    expect(commandLine(edit, { value: 3, tags: ["a"], verbose: true })).toEqual(["demo.set", "3", '--tags=["a"]', "--verbose"]);
  });
  it("exits 0 ok, 1 findings, 2 usage, writes report.json with --json, and refuses what it can't honour", async () => {
    const run = cliOf(counter().reg);
    const ok = await run("demo.set", "2", "--json");
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.files["check-output/demo.set/report.json"]!)).toMatchObject({ schema: "m3a.reply/1", status: "ok", data: { value: 2 } });
    expect(ok.text).toBe("set to 2\nreport: check-output/demo.set/report.json\nnext: read it back\n");
    expect((await run("demo.set", "--value", "x")).code).toBe(2);
    expect((await run("demo.sett")).text).toContain('no tool "demo.sett"; did you mean "demo.set"?');
    expect((await run()).text).toMatch(/^m3a .*: 1 tools;/);
    expect((await run("demo.set", "-h")).text).toContain("  m3a demo.set 1\n");
    expect([(await run("--verbose")).code, (await run("help", "--help")).code]).toEqual([0, 0]);
    expect((await run("help", "--verbos")).text).toMatch(/^help: usage error: unknown flag "--verbos"; did you mean "--verbose"\?/);
    expect((await run("help", "demo.set", "bogus")).text).toMatch(/^help: usage error: "bogus" is one argument too many/);
    expect((await run("demo.set", "2", "--request-id", "x")).text).toMatch(/^demo.set: usage error: --request-id is not kept between m3a commands yet/);
  });
  it("help lists every tool uncut, names a tool for a stray flag, and marks --request-id until m3a keeps it", async () => {
    const many = cliOf(new Registry([...Array.from({ length: 24 }, (_, i) => tool({ name: `demo.t${i}` })), tool({ name: "version" })]));
    const list = await many("help");
    expect([list.code, list.text.trimEnd().split("\n").length, list.text]).toEqual([0, 27, expect.stringMatching(/^m3a .*: 25 tools;/)]);
    expect((await many("--version")).text).toMatch(/^help: usage error: unknown flag "--version"; did you mean "version"\?/);
    expect((await many("-v")).text).toMatch(/^help: usage error: unknown flag "-v"; did you mean "--verbose"\?/);
    const mark = "--request-id <string>  retry key: the same id and arguments return the first result (MCP and the API only: ";
    const durable = new Registry([counter().edit], { ...memoryStore(), durable: true });
    const helpOf = async (reg: Registry) => (await cliOf(reg)("help", "demo.set")).text;
    expect([await helpOf(counter().reg), await helpOf(durable)]).toEqual([expect.stringContaining(mark), expect.not.stringContaining(mark)]);
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

