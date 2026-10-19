// The conformance kit's wire (spec/conformance/PROTOCOL.md): one JSON message a line, numbers as the shortest
// round-trip decimal with -0 kept; `Sidecar`, the kit's side, spawns an implementation's command and asks it one request
// at a time; `serve`, an implementation's side, answers requests on stdin with responses on stdout.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

/** The protocol's name and version: the kit sends it in `hello`, and an implementation answers with it. */
export const PROTOCOL = "m3a-conformance/1";

/** A request: a fresh id, the op, and the op's fields beside them. */
export type Request = { id: number; op: string } & Record<string, unknown>;

/** A response: the request's id, then the op's result, or an error saying why there is none. */
export type Response = { id: number; ok: true; result: unknown } | { id: number | null; ok: false; error: string };

const NEG0 = "~m3a-negative-zero~";

/** One message as one line of JSON: typed arrays as arrays, -0 kept (JSON.stringify writes 0), non-finite as null. */
export function line(value: unknown): string {
  const json = JSON.stringify(value, (_k, x: unknown) => {
    if (typeof x === "number") return Object.is(x, -0) ? NEG0 : Number.isFinite(x) ? x : null;
    return ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x;
  });
  return json.replaceAll(`"${NEG0}"`, "-0");
}

/** An op's answer was an error, or the sidecar broke the protocol: the case fails with this message. */
export class AnswerError extends Error {}

/** An implementation's sidecar: a command whose stdin takes requests and whose stdout gives responses, in order. */
export class Sidecar {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private readonly stderr: string[] = [];
  private next = 1;
  private gone: string | null = null;

  /** Spawn `command` (through the shell when `args` is omitted, so `cargo run -p x --bin sidecar` works) in `cwd`. */
  constructor(command: string, args?: readonly string[], cwd?: string) {
    this.child = args ? spawn(command, args, { cwd, stdio: "pipe" }) : spawn(command, { cwd, stdio: "pipe", shell: true });
    createInterface({ input: this.child.stdout, crlfDelay: Infinity }).on("line", (l) => this.answer(l));
    createInterface({ input: this.child.stderr, crlfDelay: Infinity }).on("line", (l) => this.stderr.push(l.slice(0, 400)) > 8 && this.stderr.shift());
    this.child.stdin.on("error", () => {});
    this.child.on("error", (e) => this.fail(`it did not start: ${e.message}`));
    this.child.on("exit", (code, signal) => this.fail(`it exited (${signal ?? `code ${code}`})`));
  }

  /** Ask `op` with `fields`: the result, or an AnswerError naming the op and the implementation's error. */
  ask(op: string, fields: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      if (this.gone) return reject(new AnswerError(this.gone));
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(line({ id, op, ...fields }) + "\n");
    });
  }

  /** Close its stdin and end the process. */
  close(): void {
    this.gone ??= "the kit closed it";
    this.child.stdin.end();
    this.child.kill();
  }

  private answer(text: string): void {
    let r: Response;
    try {
      r = JSON.parse(text) as Response;
    } catch {
      return this.fail(`it wrote a line that isn't JSON: ${text.slice(0, 120)}`);
    }
    const p = typeof r.id === "number" ? this.pending.get(r.id) : undefined;
    if (!p) return this.fail(`it answered id ${String(r.id)}, which no request is waiting for${r.ok ? "" : ` (${r.error})`}`);
    this.pending.delete(r.id!);
    if (r.ok) p.resolve(r.result);
    else p.reject(new AnswerError(`it answered an error: ${r.error}`));
  }

  private fail(why: string): void {
    if (this.gone) return;
    this.gone = `the sidecar broke off: ${why}${this.stderr.length ? `; its stderr ends: ${this.stderr.join(" | ")}` : ""}`;
    for (const p of this.pending.values()) p.reject(new AnswerError(this.gone));
    this.pending.clear();
  }
}

/** Answer requests on stdin until it closes: each line a request, each answer `handle`'s result or the error it threw. */
export async function serve(handle: (req: Request) => unknown): Promise<void> {
  for await (const text of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (!text.trim()) continue;
    let id: number | null = null, res: Response;
    try {
      const req = JSON.parse(text) as Request;
      id = typeof req.id === "number" ? req.id : null;
      if (id === null || typeof req.op !== "string") throw new Error('a request needs a numeric "id" and a string "op"');
      res = { id, ok: true, result: handle(req) };
    } catch (e) {
      res = { id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (!process.stdout.write(line(res) + "\n")) await new Promise((r) => process.stdout.once("drain", r));
  }
}
