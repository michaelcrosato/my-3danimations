// The tool registry (PLAN.md §5.6, WP-7.1): `defineTool` checks one definition and a Registry calls it the same way for
// every surface (the TypeScript API, the m3a CLI, the MCP server, the console handle): arguments checked against the
// schema, edits' if_revision and request_id, images recorded with their size and token cost, one Reply. Platform-neutral:
// what a platform supplies (reading files, writing images) comes in as a Host; the Node entry has one.
import type { Image } from "@m3a/sensors";
import { REPLY_ID, imageTokens, type ImageRef, type Reply, type Status } from "./reply.ts";
import { check, didYouMean, quote, type Schema } from "./schema.ts";

/** One example call. It runs in the tests on every surface; `expect` is the status it replies with (ok by default). */
export interface Example {
  args: Record<string, unknown>;
  expect?: "ok" | "findings";
}

/** What a tool's run returns: a one-line verdict, its data (a JSON object), detail lines, whether it found problems, the
 *  next step and, for an edit, the new revision. */
export interface ToolOutput<D = unknown> {
  verdict: string;
  data: D;
  lines?: string[];
  findings?: boolean;
  next: string;
  revision?: string;
}

/** What a tool may ask of the surface running it. */
export interface ToolContext {
  /** Reads a text file, relative to the working directory; a surface without files refuses with E_HOST. */
  read(path: string): Promise<string>;
  /** Attaches an image to the reply (a PNG under check-output/<tool>/ in Node); returns its path or `image:<name>`. */
  image(name: string, img: Image): string;
}

/** What a platform supplies: file reading, and image storage returning the path and PNG bytes it wrote. */
export interface Host {
  read?(path: string): Promise<string>;
  image?(tool: string, name: string, img: Image): { path: string | null; png: Uint8Array | null };
}

/** One tool, defined once (PLAN.md §5.6). `positionals` lets the CLI fill those parameters in order; `edit` marks a tool
 *  that changes something: it takes `if_revision` and `request_id`, and `revision` (required) reads the target's current
 *  revision, so a stale if_revision is refused rather than ignored. */
export interface ToolDef<A extends object = Record<string, unknown>, D = unknown> {
  name: string;
  description: string;
  params: Schema;
  output?: Schema;
  examples: Example[];
  positionals?: string[];
  edit?: { revision(args: A, ctx: ToolContext): string | undefined | Promise<string | undefined> };
  run(args: A, ctx: ToolContext): ToolOutput<D> | Promise<ToolOutput<D>>;
}

/** A defined tool: its definition, and the schema every surface shows (reserved parameters and examples added). */
export interface Tool extends ToolDef {
  schema: Schema;
}

/** A tool's refusal: a code (E_...), a message in the API's words that says the fix, and whether the call was wrong
 *  (usage, exit 2) or the work failed (error, exit 1). */
export class ToolError extends Error {
  readonly code: string;
  readonly usage: boolean;
  constructor(code: string, message: string, usage = false) {
    super(message);
    this.code = code;
    this.usage = usage;
  }
}

/** Names kept for the surfaces: `m3a help`, `m3a mcp`, and the console handle's list, help and call. */
export const RESERVED: readonly string[] = ["help", "list", "call", "mcp"];
const NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const VERBOSE: Schema = { type: "boolean", description: "every detail line, not only the first 20" };
const EDIT: Record<string, Schema> = {
  if_revision: { type: "string", description: "apply only if the target is still at this revision" },
  request_id: { type: "string", description: "retry key: the same id and arguments return the first result" },
};

/** Checks a definition and returns the tool; throws, naming the fix, when it is malformed. */
export function defineTool<A extends object, D>(def: ToolDef<A, D>): Tool {
  const fail = (why: string): never => {
    throw new Error(`defineTool ${JSON.stringify(def.name)}: ${why}`);
  };
  if (!NAME.test(def.name)) fail('a name is lower-case words joined by "-", in "."-separated groups (search, retarget.inspect)');
  if (RESERVED.includes(def.name)) fail(`${RESERVED.join(", ")} are kept for the surfaces; pick another name`);
  if (!def.description.trim()) fail("give it a description");
  if (def.params.type !== "object") fail('params is a JSON Schema with type "object"');
  if (!def.examples.length) fail("give it an example; every example runs in the tests");
  if (def.edit && typeof def.edit.revision !== "function") fail("an edit reads its target's revision: give edit.revision(args, ctx), so if_revision is checked");
  const own = def.params.properties ?? {}, reserved = ["verbose", "json", "help", ...(def.edit ? Object.keys(EDIT) : [])];
  for (const k of reserved) if (Object.hasOwn(own, k)) fail(`"${k}" is kept by the registry and the CLI (--${k}); rename yours`);
  for (const p of def.positionals ?? []) if (!Object.hasOwn(own, p)) fail(`positional "${p}" is not one of its parameters`);
  const schema: Schema = { ...def.params, properties: { ...own, ...(def.edit ? EDIT : {}), verbose: VERBOSE }, additionalProperties: false, examples: def.examples.map((e) => e.args) };
  return { ...(def as unknown as ToolDef), schema };
}

/** A tool as every surface describes it: the same name, description, schema (with its examples) and edit flag. */
export interface Description {
  name: string;
  description: string;
  params: Schema;
  edit: boolean;
}

/** A tool's description. */
export function describeTool(t: Tool): Description {
  return { name: t.name, description: t.description, params: t.schema, edit: Boolean(t.edit) };
}

/** Where an edit's request_id results are kept: the first reply per tool and id, with the arguments it came from. */
export interface RequestStore {
  get(key: string): { args: string; reply: Reply } | undefined;
  set(key: string, entry: { args: string; reply: Reply }): void;
}

/** A RequestStore in memory, keeping the latest `max` ids. */
export function memoryStore(max = 256): RequestStore {
  const m = new Map<string, { args: string; reply: Reply }>();
  return {
    get: (k) => m.get(k),
    set(k, e) {
      m.delete(k);
      m.set(k, e);
      if (m.size > max) m.delete(m.keys().next().value!);
    },
  };
}

/** Arguments as canonical JSON (keys sorted, undefined ones left out), to compare a retry with the first call. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  if (v && typeof v === "object") return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

/** A reply from its parts; `error` is set for usage and error replies. The verdict is kept to one line (newlines in it
 *  become spaces) and each detail to one line (split at newlines), so the 20-line count holds. */
export function reply(tool: string, status: Status, out: ToolOutput<unknown> | { verdict: string; next: string }, images: ImageRef[] = [], error: { code: string; message: string } | null = null): Reply {
  const o = out as Partial<ToolOutput<unknown>>, verdict = out.verdict.replace(/\s*\n\s*/g, " ");
  return { schema: REPLY_ID, tool, status, verdict, lines: (o.lines ?? []).flatMap((l) => l.split("\n")), data: o.data ?? null, images, revision: o.revision ?? null, error, next: out.next };
}

/** A usage reply: the call was wrong; `message` says how, `next` how to find the right one. */
export function usage(tool: string, code: string, message: string, next: string): Reply {
  return reply(tool, "usage", { verdict: `${tool}: usage error: ${message}`, next }, [], { code, message });
}

/** How a surface calls: its platform's host, and a map that receives each image's PNG bytes (MCP sends them). */
export interface CallOptions {
  host?: Host;
  pngs?: Map<string, Uint8Array>;
}

/** A set of tools, called the same way by every surface. */
export class Registry {
  readonly #tools = new Map<string, Tool>();
  /** Where edits' request_id results are kept. */
  readonly requests: RequestStore;

  constructor(tools: readonly Tool[], requests: RequestStore = memoryStore()) {
    for (const t of tools) {
      if (this.#tools.has(t.name)) throw new Error(`tool "${t.name}" is defined twice; each name is one tool`);
      this.#tools.set(t.name, t);
    }
    this.requests = requests;
  }

  /** Every tool, in definition order. */
  list(): Tool[] {
    return [...this.#tools.values()];
  }

  /** The tool called `name`, or written in MCP's form ("_" for "."). */
  get(name: string): Tool | undefined {
    return this.#tools.get(name) ?? this.#tools.get(name.replace(/_/g, "."));
  }

  /** A usage reply for a name that is no tool, naming the closest. */
  unknown(name: string): Reply {
    return usage("m3a", "E_TOOL", `no tool "${name}"${didYouMean(name, [...this.#tools.keys()])}`, `m3a help lists the ${this.#tools.size} tools`);
  }

  /** Calls a tool and replies; a wrong call replies with status usage and a failing tool with status error, never a throw. */
  async call(name: string, args: unknown = {}, opts: CallOptions = {}): Promise<Reply> {
    const tool = this.get(name);
    if (!tool) return this.unknown(name);
    const problem = check(args, tool.schema);
    const fixArgs = `${tool.name}'s schema lists its arguments and examples (m3a help ${tool.name})`;
    if (problem) return usage(tool.name, "E_ARGS", problem, fixArgs);
    const a: Record<string, unknown> = { ...(args as Record<string, unknown>) };
    delete a.verbose;
    for (const [k, s] of Object.entries(tool.schema.properties ?? {})) if ((!Object.hasOwn(a, k) || a[k] === undefined) && s.default !== undefined) a[k] = structuredClone(s.default);
    const images: ImageRef[] = [], host = opts.host ?? {};
    const ctx: ToolContext = {
      read: (p) => (host.read ? host.read(p) : Promise.reject(new ToolError("E_HOST", `this surface reads no files (${p}); pass the text instead`, true))),
      image(n, img) {
        const safe = n.replace(/[^\w.-]/g, "_"), kept = host.image?.(tool.name, safe, img) ?? { path: null, png: null };
        if (kept.png) opts.pngs?.set(safe, kept.png);
        images.push({ name: safe, width: img.width, height: img.height, tokens: imageTokens(img.width, img.height), bytes: kept.png?.length ?? null, path: kept.path });
        return kept.path ?? `image:${safe}`;
      },
    };
    let key: string | undefined, sent: string | undefined;
    if (tool.edit && typeof a.request_id === "string") {
      const { request_id: _id, ...rest } = a;
      [key, sent] = [`${tool.name} ${a.request_id}`, canonical(rest)];
      const first = this.requests.get(key);
      if (first && first.args !== sent) {
        const was = JSON.parse(first.args) as Record<string, unknown>, differ = Object.keys({ ...was, ...rest }).filter((k) => canonical(was[k]) !== canonical(rest[k]));
        return usage(tool.name, "E_REQUEST_ID", `request_id ${quote(a.request_id)} was first used with other arguments (they differ in ${differ.join(", ")})`, "a retry repeats the first arguments exactly; a new edit takes a new request_id");
      }
      if (first) return structuredClone(first.reply);
    }
    try {
      if (tool.edit && typeof a.if_revision === "string") {
        const now = await tool.edit.revision(a, ctx);
        if (now !== a.if_revision) {
          const message = `the target is at revision ${now ?? "none"}, not ${a.if_revision}; nothing was changed`;
          return reply(tool.name, "error", { verdict: `${tool.name}: conflict: ${message}`, next: `read it again, then retry with if_revision "${now}"`, revision: now }, [], { code: "E_CONFLICT", message });
        }
      }
      const out = await tool.run(a, ctx), r = reply(tool.name, out.findings ? "findings" : "ok", out, images);
      if (typeof r.data !== "object" || Array.isArray(r.data)) throw new Error(`${tool.name} replied with data that is not a JSON object`);
      if (key) this.requests.set(key, { args: sent!, reply: structuredClone(r) });
      return r;
    } catch (err) {
      const e = err instanceof ToolError ? err : new ToolError("E_RUN", err instanceof Error ? err.message : String(err));
      const next = e.usage ? fixArgs : e.code === "E_RUN" ? "if the arguments are right, this is a bug in the tool: report the call and this message" : "fix what the message names, then call again";
      return e.usage ? usage(tool.name, e.code, e.message, next) : reply(tool.name, "error", { verdict: `${tool.name}: error: ${e.message}`, next }, images, { code: e.code, message: e.message });
    }
  }
}
