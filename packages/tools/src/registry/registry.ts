// The tool registry (PLAN.md §5.6, WP-7.1): `defineTool` checks one definition and a Registry calls it the same way for
// every surface (the TypeScript API, the m3a CLI, the MCP server, the console handle): arguments checked against the
// schema, edits' if_revision and request_id, images recorded with their size and token cost, one Reply. Platform-neutral:
// what a platform supplies (files read and written, the library, images) comes in as a Host; the Node entry has one.
import type { Library, LibrarySource, Tier } from "@m3a/library";
import type { Image } from "@m3a/sensors";
import { REPLY_ID, imageTokens, type ImageRef, type Reply, type Status } from "./reply.ts";
import { check, closed, didYouMean, quote, type Schema } from "./schema.ts";

/** One example call. It runs in the tests on every surface; `expect` is the status it replies with (ok by default). Only
 *  a tool's first example goes into its schema (a good call: ok or findings); `m3a help` lists them all. */
export interface Example {
  args: Record<string, unknown>;
  expect?: "ok" | "findings" | "error";
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

/** The library as a host opens it for one call: the library at its tiers, its files' source (every set, any tier), each
 *  license's text, the tiers, and the warnings it gave (a deprecated id), which the registry adds to the reply's lines. */
export interface LibraryAccess {
  library: Library;
  source: LibrarySource;
  licenseText(id: string): string | null;
  tiers: readonly Tier[];
  warnings: string[];
}

/** What a tool may ask of the surface running it; a surface without files or a library refuses with E_HOST (usage). */
export interface ToolContext {
  /** Reads a text file, relative to the working directory. */
  read(path: string): Promise<string>;
  /** Reads a text file as `read` does, or null when it doesn't exist. */
  tryRead(path: string): Promise<string | null>;
  /** Writes a file atomically under the write roots (workshop/, .m3a/, imports/, check-output/); returns its path. */
  write(path: string, data: string | Uint8Array): string;
  /** Deletes a file under the write roots; one that isn't there is no error. */
  remove(path: string): void;
  /** The library at the game's tiers (game.json in the working directory, else cc0), or at `tiers`; once per call. */
  library(tiers?: readonly Tier[]): LibraryAccess;
  /** Attaches an image to the reply (a PNG under check-output/<tool>/ in Node); returns its path or `image:<name>`. */
  image(name: string, img: Image): string;
  /** Takes the lock file `path` (under the write roots) against every other caller, waiting while one holds it;
   *  resolves to its release. Callers in one process take it one at a time whatever the host (the registry's own lock,
   *  by path); the host's lock, when it has one, keeps other processes out too. */
  lock(path: string): Promise<() => void>;
}

/** What a platform supplies, each part optional: files read, written and removed (ToolContext says how), the library,
 *  and image storage returning the path and PNG bytes it wrote. */
export interface Host {
  read?(path: string): Promise<string>;
  tryRead?(path: string): Promise<string | null>;
  write?(path: string, data: string | Uint8Array): string;
  remove?(path: string): void;
  library?(tiers?: readonly Tier[]): LibraryAccess;
  image?(tool: string, name: string, img: Image): { path: string | null; png: Uint8Array | null };
  /** ToolContext's lock across processes (a lock file in Node), taken after the registry's own in this process; without
   *  it, edits from two processes may race. */
  lock?(path: string): Promise<() => void>;
}

/** One tool, defined once (PLAN.md §5.6). Parameter names are a letter, then letters, digits or "_"; `output` is its
 *  data's schema, checked on every reply; `positionals` lets the CLI fill those parameters in order; `edit` marks a tool
 *  that changes something: it takes `if_revision` and `request_id` (names no tool declares itself), and `revision`
 *  (required) reads the target's current revision, so a stale if_revision is refused rather than ignored. */
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

/** A defined tool: its definition, and the schema every surface shows (reserved parameters and its first example added). */
export interface Tool extends ToolDef {
  schema: Schema;
}

/** A tool's refusal: a code (E_...), a message in the API's words that says the fix, whether the call was wrong (usage,
 *  exit 2) or the work failed (error, exit 1), and optionally the reply's `next` (the registry's own otherwise) and the
 *  target's current revision (an edit's E_CONFLICT). */
export class ToolError extends Error {
  readonly code: string;
  readonly usage: boolean;
  readonly next?: string;
  readonly revision?: string;
  constructor(code: string, message: string, usage = false, more: { next?: string; revision?: string } = {}) {
    super(message);
    this.code = code;
    this.usage = usage;
    if (more.next !== undefined) this.next = more.next;
    if (more.revision !== undefined) this.revision = more.revision;
  }
}

/** The lock paths taken in this process, each to the promise its latest taker's release resolves; a taker waits for the
 *  one before it, so callers in one process hold a path one at a time, whatever their host (two hosts on one working
 *  directory too: the path alone is the key). */
const held = new Map<string, Promise<void>>();

/** Takes lock `path` in this process (once its taker before lets go), then the host's (other processes) when it has
 *  one; resolves to the release of both, which does nothing a second time. */
async function locked(path: string, host: Host): Promise<() => void> {
  const before = held.get(path) ?? Promise.resolve();
  let free!: () => void;
  const mine = new Promise<void>((ok) => (free = ok)), tail = before.then(() => mine);
  held.set(path, tail);
  const done = () => {
    free();
    if (held.get(path) === tail) held.delete(path);
  };
  await before;
  let outer: () => void;
  try {
    outer = host.lock ? await host.lock(path) : () => {};
  } catch (err) {
    done();
    throw err;
  }
  let once = false;
  return () => {
    if (once) return;
    once = true;
    try {
      outer();
    } finally {
      done();
    }
  };
}

/** Names kept for the surfaces: `m3a help`, `m3a mcp`, and the console handle's list, help and call. */
export const RESERVED: readonly string[] = ["help", "list", "call", "mcp"];
const NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/, PARAM = /^[a-z][a-z0-9_]*$/i;
// Short descriptions: every tool carries them, and a model reads each word (the budget of PLAN.md WP-7.2)
const VERBOSE: Schema = { type: "boolean", description: "all lines" };
const EDIT: Record<string, Schema> = {
  if_revision: { type: "string", description: "expected revision" },
  request_id: { type: "string", description: "retry key" },
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
  // if_revision and request_id are kept on every tool, edit or not, so they mean the same on every surface
  const own = def.params.properties ?? {};
  for (const k of ["verbose", "json", "help", ...Object.keys(EDIT)]) {
    if (Object.hasOwn(own, k)) fail(`"${k}" is kept by the registry and the CLI (--${k.replace(/_/g, "-")}); rename yours`);
  }
  for (const k of Object.keys(own)) if (!PARAM.test(k)) fail(`parameter ${quote(k)} is out of the CLI's reach: a name is a letter, then letters, digits or "_" (rename it ${quote(k.replace(/\W/g, "_"))}, which the CLI spells --${k.replace(/[\W_]/g, "-")})`);
  for (const p of def.positionals ?? []) if (!Object.hasOwn(own, p)) fail(`positional "${p}" is not one of its parameters`);
  const schema = closed({ ...def.params, properties: { ...own, ...(def.edit ? EDIT : {}), verbose: VERBOSE }, additionalProperties: false, examples: [def.examples[0]!.args] });
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

/** Where an edit's request_id results are kept: the first reply per tool and id, with the arguments it came from.
 *  `durable` says it outlives the process (a file); the CLI, one process per command, takes --request-id only then.
 *  A `set` that throws (a file it can't write) costs only the retry: the registry replies, with a warning line. */
export interface RequestStore {
  get(key: string): { args: string; reply: Reply } | undefined;
  set(key: string, entry: { args: string; reply: Reply }): void;
  durable?: boolean;
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
    return usage("m3a", "E_TOOL", `no tool ${quote(name)}${didYouMean(name, [...this.#tools.keys()])}`, `m3a help lists the ${this.#tools.size} tools`);
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
    const images: ImageRef[] = [], host = opts.host ?? {}, libs = new Map<string, LibraryAccess>();
    const lacks = (what: string, p?: string) => new ToolError("E_HOST", `this surface ${what}${p === undefined ? "" : ` (${quote(p)})`}; ${what.startsWith("reads") ? "pass the text instead" : "run it through m3a (the CLI or MCP) or the API with a Node host"}`, true);
    const ctx: ToolContext = {
      read: (p) => (host.read ? host.read(p) : Promise.reject(lacks("reads no files", p))),
      tryRead: (p) => (host.tryRead ? host.tryRead(p) : Promise.reject(lacks("reads no files", p))),
      write(p, d) {
        if (!host.write) throw lacks("writes no files", p);
        return host.write(p, d);
      },
      remove(p) {
        if (!host.remove) throw lacks("writes no files", p);
        host.remove(p);
      },
      library(tiers) {
        const k = tiers ? `=${tiers.join(",")}` : "game.json";
        let l = libs.get(k);
        if (!l) {
          if (!host.library) throw lacks("opens no library");
          libs.set(k, (l = host.library(tiers)));
        }
        return l;
      },
      image(n, img) {
        const safe = n.replace(/[^\w.-]/g, "_"), kept = host.image?.(tool.name, safe, img) ?? { path: null, png: null };
        if (kept.png) opts.pngs?.set(safe, kept.png);
        images.push({ name: safe, width: img.width, height: img.height, tokens: imageTokens(img.width, img.height), bytes: kept.png?.length ?? null, path: kept.path });
        return kept.path ?? `image:${safe}`;
      },
      lock: (p) => locked(p, host),
    };
    let key: string | undefined, sent: string | undefined;
    // the call's library warnings (a deprecated id), first among the lines so the 20-line cut keeps them
    const warned = () => [...new Set([...libs.values()].flatMap((l) => l.warnings))].map((w) => `warning: ${w}`);
    // an applied edit's reply kept for its retries; a store that can't keep it leaves the reply standing, warned
    const keep = (r: Reply): Reply => {
      try {
        this.requests.set(key!, { args: sent!, reply: structuredClone(r) });
        return r;
      } catch (err) {
        const why = (err instanceof Error ? err.message : String(err)).replace(/\s*\n\s*/g, " ");
        return { ...r, lines: [`warning: request_id ${quote(a.request_id)} was not kept (${why}); a retry would apply it again`, ...r.lines] };
      }
    };
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
    let out: ToolOutput<unknown> | undefined;
    try {
      if (tool.edit && typeof a.if_revision === "string") {
        const now = await tool.edit.revision(a, ctx);
        if (now !== a.if_revision) {
          const message = `the target is at revision ${now ?? "none"}, not ${quote(a.if_revision)}; nothing was changed`;
          return reply(tool.name, "error", { verdict: `${tool.name}: conflict: ${message}`, next: `read it again, then retry with \`--if_revision ${now}\``, revision: now }, [], { code: "E_CONFLICT", message });
        }
      }
      out = await tool.run(a, ctx);
      const r = reply(tool.name, out.findings ? "findings" : "ok", { ...out, lines: [...warned(), ...(out.lines ?? [])] }, images);
      if (typeof r.data !== "object" || Array.isArray(r.data)) throw new Error(`${tool.name} replied with data that is not a JSON object`);
      const off = r.data !== null && tool.output ? check(r.data, tool.output, "data") : undefined;
      if (off) throw new Error(`${tool.name} replied with data off its output schema (${off})`);
      return key ? keep(r) : r;
    } catch (err) {
      const e = err instanceof ToolError ? err : new ToolError("E_RUN", err instanceof Error ? err.message : String(err));
      const next = e.next ?? (e.usage ? fixArgs : e.code === "E_RUN" ? "if the arguments are right, this is a bug in the tool: report the call and this message" : "fix what the message names, then call again");
      if (e.usage) return { ...usage(tool.name, e.code, e.message, next), lines: warned() };
      const r = reply(tool.name, "error", { verdict: `${tool.name}: error: ${e.message}`, next, revision: e.revision ?? out?.revision, lines: warned() }, images, { code: e.code, message: e.message });
      // run() returned, so an edit applied though its data failed the checks: kept, so a retry does not apply it again
      return key && out ? keep(r) : r;
    }
  }
}
