// Untrusted input (PLAN.md WP-5.2): every reader takes its file as bytes or text it doesn't trust. Reads go through
// bounds-checked views that name the offset they failed at, sizes are capped before anything is allocated for them, and
// nothing is ever evaluated. An `IoError` says what failed (`code`), where (`offset`, when a byte position applies) and
// in which file (`file`), so a broken import names its cause.

/** Why a reader refused its input. */
export type IoCode = "E_FORMAT" | "E_LIMIT" | "E_BOUNDS" | "E_RIG" | "E_MISSING";

/** A reader's refusal: what failed, where in the input, and in which file. */
export class IoError extends Error {
  readonly code: IoCode;
  readonly offset: number | undefined;
  readonly file: string | undefined;
  constructor(code: IoCode, message: string, at: { offset?: number; file?: string } = {}) {
    super(`${at.file ? `${at.file}: ` : ""}${message}${at.offset !== undefined ? ` (at byte ${at.offset})` : ""}`);
    this.name = "IoError";
    this.code = code;
    this.offset = at.offset;
    this.file = at.file;
  }
}

/** Size limits for untrusted input; a reader refuses anything larger before allocating for it. */
export const LIMITS = Object.freeze({
  /** A whole input file. */
  file: 512 * 1024 * 1024,
  /** A glTF's JSON chunk, or a text format's text. */
  text: 64 * 1024 * 1024,
  /** Values one accessor may hold (count × components). */
  values: 64 * 1024 * 1024,
  /** Frames one file may give in all: every clip a library is sampled into together, or one take's frames (36 minutes
   *  at 120 frames a second; a hostile file can't ask for more by naming a long clip). */
  frames: 1 << 18,
  /** Joint transforms one file may be posed into in all: the frames sampled, times the joints posed in each. */
  work: 1 << 24,
  /** Nodes or bones in one skeleton. */
  nodes: 100_000,
});

/**
 * A reader that lets only an IoError out: anything else its input provokes (a TypeError from a field of the wrong
 * shape, a RangeError) is refused as E_FORMAT, named, with the file `fileOf` finds in the arguments.
 */
export function guard<A extends unknown[], R>(f: (...a: A) => R, fileOf: (args: unknown[]) => unknown = () => undefined): (...a: A) => R {
  return (...a: A): R => {
    try {
      return f(...a);
    } catch (err) {
      if (err instanceof IoError) throw err;
      let file: string | undefined;
      try {
        const named = fileOf(a);
        file = typeof named === "string" ? named : undefined;
      } catch {
        file = undefined;
      }
      throw new IoError("E_FORMAT", `the input broke the reader (${err instanceof Error ? `${err.name}: ${err.message}` : String(err)})`, { file });
    }
  };
}

/** Fails once `used` passes a budget of `limit`: the work a file asks for, summed as it is done. */
export function spend(used: number, limit: number, what: string, file?: string): void {
  if (!(used <= limit)) throw new IoError("E_LIMIT", `${what}: over the limit of ${limit} for one file`, { file });
}

/** A read-only view of bytes whose every read is checked against its length, naming the offset when it isn't. */
export class Bytes {
  readonly length: number;
  #dv: DataView;
  #u8: Uint8Array;
  readonly file: string | undefined;
  constructor(u8: Uint8Array, file?: string) {
    if (u8.length > LIMITS.file) throw new IoError("E_LIMIT", `${u8.length} bytes, over the ${LIMITS.file}-byte limit`, { file });
    this.#u8 = u8;
    this.#dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    this.length = u8.length;
    this.file = file;
  }
  /** Fails unless n bytes from offset o lie inside the view. */
  check(o: number, n: number, what = "a read"): void {
    if (!Number.isInteger(o) || !Number.isInteger(n) || o < 0 || n < 0 || o + n > this.length) throw new IoError("E_BOUNDS", `${what} of ${n} byte(s) runs past the end (${this.length} bytes)`, { offset: o, file: this.file });
  }
  u8(o: number): number {
    this.check(o, 1);
    return this.#dv.getUint8(o);
  }
  u16(o: number): number {
    this.check(o, 2);
    return this.#dv.getUint16(o, true);
  }
  u32(o: number): number {
    this.check(o, 4);
    return this.#dv.getUint32(o, true);
  }
  f32(o: number): number {
    this.check(o, 4);
    return this.#dv.getFloat32(o, true);
  }
  /** n bytes from offset o, as a view (no copy). */
  sub(o: number, n: number, what?: string): Bytes {
    this.check(o, n, what);
    return new Bytes(this.#u8.subarray(o, o + n), this.file);
  }
  /** n bytes from offset o as UTF-8 text. */
  text(o: number, n: number, what?: string): string {
    this.check(o, n, what);
    if (n > LIMITS.text) throw new IoError("E_LIMIT", `${what ?? "text"} of ${n} bytes, over the ${LIMITS.text}-byte limit`, { offset: o, file: this.file });
    return new TextDecoder("utf-8", { fatal: false }).decode(this.#u8.subarray(o, o + n));
  }
  /** The bytes themselves (a view: don't change them). */
  raw(): Uint8Array {
    return this.#u8;
  }
}

/** Fails unless a text input is within the text limit. */
export function checkText(text: string, file?: string): void {
  if (typeof text !== "string") throw new IoError("E_FORMAT", "expected text", { file });
  if (text.length > LIMITS.text) throw new IoError("E_LIMIT", `${text.length} characters, over the ${LIMITS.text} limit`, { file });
}
