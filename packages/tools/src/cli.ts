// The m3a command line (PLAN.md §5.6), platform-neutral: `m3a <tool> [args] [--json] [--verbose]` and `m3a help [tool]`
// (or -h), parsed against the tool's schema. Flags are its parameter names (`--if-revision` or `--if_revision`,
// `--flag=value` or `--flag value`; a value starting with "--" takes the `=` form), given once unless an array; its
// positionals fill the parameters it names in order. An unknown flag, tool or help argument is a usage error naming the
// closest one; so is --request-id until the registry's store outlives a command (WP-7.2). The text is the reply, verdict
// first; --json also writes check-output/<tool>/report.json (the Reply, schema m3a.reply/1). Exit 0 ok, 1 findings or a
// failed tool, 2 usage error. The Node entry (./node.ts) supplies the IO.
import { VERSION } from "@m3a/core";
import { describeTool, reply, usage, type Host, type Registry, type Tool } from "./registry/registry.ts";
import { EXIT, render, type Reply } from "./registry/reply.ts";
import { didYouMean, quote, type Schema } from "./registry/schema.ts";

/** What the CLI needs from its platform: printing, writing a file (report.json) and the registry's host. */
export interface CliIo {
  print(text: string): void;
  write(path: string, text: string): void;
  host?: Host;
}

const flag = (param: string) => `--${param.replace(/_/g, "-")}`;
const shellWord = (a: string) => (/^[\w./:=@,+-]*$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`);
/** An argv as a shell line, each value quoted only where it needs it (`--text='{"a":1}'`). */
const shell = (argv: readonly string[]) => argv.map((a) => a.replace(/^(--[\w-]+=)?(.*)$/s, (_, f: string | undefined, v: string) => (f ?? "") + shellWord(v))).join(" ");

/** The argv that makes a call: positionals first (strings and numbers), then `--flag=value` for the rest. */
export function commandLine(tool: Tool, args: Record<string, unknown>): string[] {
  const out = [tool.name], rest = { ...args };
  for (const p of tool.positionals ?? []) {
    const v = rest[p];
    if (!(typeof v === "number" || (typeof v === "string" && !v.startsWith("-")))) break;
    out.push(String(v));
    delete rest[p];
  }
  for (const [k, v] of Object.entries(rest)) out.push(v === true ? flag(k) : `${flag(k)}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  return out;
}

function coerce(v: string, s: Schema = {}): unknown {
  if (s.type === "number" || s.type === "integer") return v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
  if (s.type === "boolean") return v === "true" ? true : v === "false" ? false : v;
  if (s.type !== "object" && s.type !== "array") return v;
  let j: unknown;
  try {
    j = JSON.parse(v);
  } catch {
    j = undefined;
  }
  if (s.type === "array") return Array.isArray(j) ? j : v.split(",").map((x) => coerce(x, s.items));
  return j ?? v;
}

/** Parses a tool's arguments from argv (without --json); returns them, or the usage error's message. */
export function parseCall(tool: Tool, argv: readonly string[]): Record<string, unknown> | string {
  const props = tool.schema.properties ?? {}, args: Record<string, unknown> = {}, pos = [...(tool.positionals ?? [])];
  const flags = [...Object.keys(props).map(flag), "--json", "--help"], takes = `(${tool.name} takes ${flags.join(" ")})`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    let name: string, v: unknown;
    if (/^-[^-\d.]/.test(a)) return `unknown flag ${quote(a)}: flags take two dashes${didYouMean(`-${a}`, flags)} ${takes}`;
    if (!a.startsWith("--")) {
      const p = pos.shift();
      if (p === undefined) return `${quote(a)} is one argument too many: ${tool.name} takes ${tool.positionals?.length ? `${tool.positionals.join(", ")} by position` : "flags only"} ${takes}`;
      [name, v] = [p, coerce(a, props[p])];
    } else {
      const eq = a.indexOf("="), raw = eq < 0 ? a : a.slice(0, eq);
      name = raw.slice(2).replace(/-/g, "_");
      const s = Object.hasOwn(props, name) ? props[name] : undefined;
      if (raw === "--json" || raw === "--help") return `${raw} takes no value; write ${raw} alone`;
      if (!s) return `unknown flag ${quote(raw)}${didYouMean(raw, flags)} ${takes}`;
      let value = eq < 0 ? undefined : a.slice(eq + 1);
      if (value === undefined && s.type !== "boolean" && !argv[i + 1]?.startsWith("--")) value = argv[++i];
      if (value === undefined && s.type !== "boolean") return `${raw} needs a value${s.description ? `: ${s.description}` : ""} (one starting with "--" is written ${raw}=<value>)`;
      v = value === undefined ? true : coerce(value, s);
    }
    const was = args[name], both = Array.isArray(was) && Array.isArray(v);
    if (Object.hasOwn(args, name) && !both) return `${flag(name)} is given twice; give it once (only an array flag repeats)`;
    args[name] = both ? [...(was as unknown[]), ...(v as unknown[])] : v;
  }
  return args;
}

/** `m3a help` (every tool) or `m3a help <tool>` (its usage, parameters and examples) as a reply; `data` is
 *  `{ tools: Description[] }` or the tool's Description. */
export function help(registry: Registry, name?: string): Reply {
  if (name === undefined) {
    const list = registry.list(), w = Math.max(...list.map((t) => t.name.length));
    const lines = list.map((t) => `  ${t.name.padEnd(w)}  ${t.description}`);
    return reply("help", "ok", { verdict: `m3a ${VERSION}: ${list.length} tools; m3a <tool> [args] [--json] [--verbose]; m3a mcp serves them over MCP (stdio)`, data: { tools: list.map(describeTool) }, lines, next: "m3a help <tool> shows its arguments and examples" });
  }
  const t = registry.get(name);
  if (!t) return registry.unknown(name);
  const req = new Set(t.schema.required ?? []), props = Object.entries(t.schema.properties ?? {});
  const lines = [`usage: m3a ${t.name}${(t.positionals ?? []).map((p) => ` [${p}]`).join("")} [flags]`];
  for (const [k, s] of props) lines.push(`  ${flag(k)}${s.type === "boolean" ? "" : ` <${s.type ?? "json"}>`}  ${s.description ?? ""}${s.enum ? ` (${s.enum.join(" | ")})` : ""}${s.default !== undefined ? ` (default ${JSON.stringify(s.default)})` : ""}${req.has(k) ? " (required)" : ""}`.trimEnd());
  lines.push("examples:", ...t.examples.map((e) => `  m3a ${shell(commandLine(t, e.args))}`));
  return reply("help", "ok", { verdict: `m3a ${t.name}: ${t.description}`, data: describeTool(t), lines, next: `run an example: m3a ${shell(commandLine(t, t.examples[0]!.args))}` });
}

/** `m3a help [tool] [--verbose]` from its arguments: anything else is refused, naming the closest. */
function helpCall(registry: Registry, argv: readonly string[]): Reply {
  const names = argv.filter((a) => !a.startsWith("-")), odd = argv.find((a) => a.startsWith("-") && a !== "--help" && a !== "--verbose");
  const next = "m3a help [tool] [--verbose] [--json]; a tool's own flags follow its name (m3a <tool> [args] --verbose)";
  if (odd !== undefined) return usage("help", "E_ARGS", `unknown flag ${quote(odd)}${didYouMean(odd, ["--verbose", "--json", "--help"])} (help takes a tool name, --verbose and --json)`, next);
  return names.length > 1 ? usage("help", "E_ARGS", `${quote(names[1])} is one argument too many: help takes one tool name`, next) : help(registry, names[0]);
}

/** Runs one m3a command line; prints the reply, writes report.json with --json, and returns the exit code. */
export async function runCli(registry: Registry, argv: readonly string[], io: CliIo): Promise<number> {
  const json = argv.includes("--json"), rest = argv.filter((a) => a !== "--json").map((a) => (a === "-h" ? "--help" : a));
  const [first, ...more] = rest;
  let r: Reply, verbose = rest.includes("--verbose");
  if (first === undefined || first === "help" || first.startsWith("-")) r = helpCall(registry, first === "help" ? more : rest);
  else if (!registry.get(first)) r = registry.unknown(first);
  else if (more.includes("--help")) r = help(registry, first);
  else {
    const tool = registry.get(first)!, args = parseCall(tool, more);
    verbose = typeof args !== "string" && args.verbose === true; // the parsed flag, as MCP's argument
    if (typeof args === "string") r = usage(tool.name, "E_ARGS", args, `m3a help ${tool.name} shows its arguments and examples`);
    else if (Object.hasOwn(args, "request_id") && !registry.requests.durable) r = usage(tool.name, "E_REQUEST_ID", "--request-id is not kept between m3a commands yet, so a retried edit would apply twice", "leave it out, or retry through the MCP server or the API, which keep it");
    else r = await registry.call(tool.name, args, { host: io.host });
  }
  const report = json ? `check-output/${r.tool}/report.json` : undefined;
  if (report) io.write(report, `${JSON.stringify(r, null, 2)}\n`);
  io.print(`${render(r, { verbose, more: "rerun with --verbose", report })}\n`);
  return EXIT[r.status];
}
