// The conformance kit's wire (spec/conformance/PROTOCOL.md): one JSON message a line, numbers as the shortest
// round-trip decimal with -0 kept; `Sidecar`, the kit's side, spawns an implementation's command and asks it one request
// at a time, each within a deadline, and treats any line that isn't a response object as a protocol break; `serve`, an
// implementation's side, answers requests on stdin with responses on stdout.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

/** The protocol's name and version: the kit sends it in `hello`, and an implementation answers with it. */
export const PROTOCOL = "m3a-conformance/1";

/** A request: a fresh id, the op, and the op's fields beside them. */
export type Request = { id: number; op: string } & Record<string, unknown>;

/** How long the kit waits for each answer by default, in seconds (`--timeout` changes it; PROTOCOL.md "Transport"). */
export const TIMEOUT_S = 60;

/** A response: the request's id, then the op's result, or an error saying why there is none. */
export type Response = { id: number; ok: true; result: unknown } | { id: number | null; ok: false; error: string };

/** -0 as JSON.stringify writes a value given as raw JSON text (`JSON.rawJSON`, in Node since 21; TypeScript's lib
 *  doesn't declare it yet). A raw value, not a sentinel string: no string a message holds can turn into a number. */
const NEG0 = (JSON as unknown as { rawJSON(text: string): object }).rawJSON("-0");

/** One message as one line of JSON: typed arrays as arrays, -0 kept (JSON.stringify writes 0), non-finite as null,
 *  every string as it is. */
export function line(value: unknown): string {
  return JSON.stringify(value, (_k, x: unknown) => {
    if (typeof x === "number") return Object.is(x, -0) ? NEG0 : Number.isFinite(x) ? x : null;
    return ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x;
  });
}

/** An op's answer was an error, or the sidecar broke the protocol: the case fails with this message. */
export class AnswerError extends Error {}

/** An implementation's sidecar: a command whose stdin takes requests and whose stdout gives responses, in order. */
export class Sidecar {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private readonly stderr: string[] = [];
  private readonly timeoutMs: number;
  private next = 1;
  private gone: string | null = null;

  /** Spawn `command` (through the shell when `args` is omitted, so `cargo run -p x --bin sidecar` works) in `cwd`;
   *  `timeoutS` is how long each request may wait for its answer (hello's includes the start) before the sidecar is
   *  ended as broken. */
  constructor(command: string, args?: readonly string[], cwd?: string, { timeoutS = TIMEOUT_S }: { timeoutS?: number } = {}) {
    this.timeoutMs = timeoutS * 1000;
    this.child = args ? spawn(command, args, { cwd, stdio: "pipe" }) : spawn(command, { cwd, stdio: "pipe", shell: true });
    createInterface({ input: this.child.stdout, crlfDelay: Infinity }).on("line", (l) => this.answer(l));
    createInterface({ input: this.child.stderr, crlfDelay: Infinity }).on("line", (l) => this.stderr.push(l.slice(0, 400)) > 8 && this.stderr.shift());
    this.child.stdin.on("error", () => {});
    this.child.on("error", (e) => this.fail(`it did not start: ${e.message}`));
    this.child.on("exit", (code, signal) => this.fail(`it exited (${signal ?? `code ${code}`})`));
  }

  /** Ask `op` with `fields`: the result, or an AnswerError naming the op and the implementation's error. No answer
   *  within the deadline breaks the sidecar off: the kit ends it, and this and every later request fail. */
  ask(op: string, fields: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      if (this.gone) return reject(new AnswerError(this.gone));
      const timer = setTimeout(() => {
        this.fail(`no answer to ${op} within ${this.timeoutMs / 1000} s (flush each answer, or raise --timeout)`);
        this.child.kill();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(line({ id, op, ...fields }) + "\n");
    });
  }

  /** Close its stdin and end the process; a request still waiting fails. */
  close(): void {
    this.fail("the kit closed it");
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
    // a response is an object with an id and ok (PROTOCOL.md "Messages"); null, a number, a string or an array breaks off
    if (!r || typeof r !== "object" || Array.isArray(r)) return this.fail(`it wrote a line that isn't a response object: ${text.slice(0, 120)}`);
    const p = typeof r.id === "number" ? this.pending.get(r.id) : undefined;
    if (!p) return this.fail(`it answered id ${String(r.id)}, which no request is waiting for${r.ok ? "" : ` (${r.error})`}`);
    const ok: unknown = r.ok;
    if (ok !== true && ok !== false) return this.fail(`its answer to id ${r.id} has "ok" ${String(ok)}, not true or false: ${text.slice(0, 120)}`);
    clearTimeout(p.timer);
    this.pending.delete(r.id!);
    if (r.ok) p.resolve(r.result);
    else p.reject(new AnswerError(`it answered an error: ${r.error}`));
  }

  private fail(why: string): void {
    if (this.gone) return;
    this.gone = `the sidecar broke off: ${why}${this.stderr.length ? `; its stderr ends: ${this.stderr.join(" | ")}` : ""}`;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new AnswerError(this.gone));
    }
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
