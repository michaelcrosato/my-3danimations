// State hashes (PLAN.md WP-2.1, §5.5): 64-bit FNV-1a over the float64 bits of numbers (`hashNumbers`) and over a
// canonical walk of plain data (`hashValue`), in two 32-bit lanes because JavaScript has no fast 64-bit integers. Pure
// integer arithmetic, so the same in every engine. A number feeds its 8 float64 bytes little-endian: 0 and -0 differ and
// every last bit counts; every NaN feeds the one canonical NaN. Strings feed their UTF-8 bytes, so
// `new Fnv64().string("a").hex()` is FNV's published "af63dc4c8601ec8c".
// Ported from my-3dge engine/core/hash.ts (its Fnv64), itself my-3d2dge's `hashNumbers` widened to float64 and 64 bits.

const OFFSET_HI = 0xcbf29ce4;
const OFFSET_LO = 0x84222325;
/** The low word of the FNV-64 prime 0x100000001b3; its high word, 0x100, is a shift by 8. */
const PRIME_LO = 0x1b3;
const TWO_32 = 4294967296;
const F = new Float64Array(1);
const U = new Uint32Array(F.buffer);
const LITTLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
/** Type tags of the canonical stream, one byte before each value, so [1, [2]] and [[1], 2] differ. */
const TAG = { null: 0, false: 1, true: 2, number: 3, string: 4, array: 5, object: 6 } as const;

/** The 64-bit FNV-1a hash, fed piece by piece: `new Fnv64().number(x).string(id).hex()`. */
export class Fnv64 {
  /** The running hash's high and low 32 bits. */
  hi = OFFSET_HI;
  lo = OFFSET_LO;

  /** Feeds one byte (0 to 255). */
  byte(b: number): this {
    const lo = (this.lo ^ b) >>> 0;
    const product = lo * PRIME_LO; // under 2^41: exact
    this.hi = (Math.imul(this.hi, PRIME_LO) + (lo << 8) + ((product / TWO_32) >>> 0)) >>> 0;
    this.lo = product >>> 0;
    return this;
  }

  /** Feeds an unsigned 32-bit integer as 4 bytes, little-endian. */
  uint32(n: number): this {
    return this.byte(n & 0xff).byte((n >>> 8) & 0xff).byte((n >>> 16) & 0xff).byte(n >>> 24);
  }

  /** Feeds a number's 8 float64 bytes, little-endian; every NaN feeds 0x7ff8000000000000. */
  number(x: number): this {
    if (x !== x) return this.uint32(0).uint32(0x7ff80000);
    F[0] = x;
    return LITTLE ? this.uint32(U[0]!).uint32(U[1]!) : this.uint32(U[1]!).uint32(U[0]!);
  }

  /** Feeds each number of a list or typed array, in order. */
  numbers(values: ArrayLike<number>): this {
    for (let i = 0; i < values.length; i++) this.number(values[i]!);
    return this;
  }

  /** Feeds a string's UTF-8 bytes (a lone surrogate as U+FFFD, as TextEncoder writes it). */
  string(s: string): this {
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
      else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
      if (c < 0x80) this.byte(c);
      else if (c < 0x800) this.byte(0xc0 | (c >> 6)).byte(0x80 | (c & 63));
      else if (c < 0x10000) this.byte(0xe0 | (c >> 12)).byte(0x80 | ((c >> 6) & 63)).byte(0x80 | (c & 63));
      else this.byte(0xf0 | (c >> 18)).byte(0x80 | ((c >> 12) & 63)).byte(0x80 | ((c >> 6) & 63)).byte(0x80 | (c & 63));
    }
    return this;
  }

  /**
   * Feeds plain data canonically: null, booleans, numbers, strings, arrays and typed arrays, and plain objects with
   * their keys sorted (insertion order never counts). Each value is tagged and each string and list length-prefixed.
   * Anything else (undefined, functions, class instances, cycles) throws: nothing is skipped silently.
   */
  value(v: unknown, depth = 0): this {
    if (depth > 100) throw new TypeError("hashValue: nested deeper than 100 levels (a cycle?)");
    if (v === null) return this.byte(TAG.null);
    if (v === true || v === false) return this.byte(v ? TAG.true : TAG.false);
    if (typeof v === "number") return this.byte(TAG.number).number(v);
    if (typeof v === "string") return this.byte(TAG.string).uint32(v.length).string(v);
    if (Array.isArray(v) || (ArrayBuffer.isView(v) && !(v instanceof DataView))) {
      const list = v as ArrayLike<unknown>;
      this.byte(TAG.array).uint32(list.length);
      for (let i = 0; i < list.length; i++) this.value(list[i], depth + 1);
      return this;
    }
    if (typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) {
      const keys = Object.keys(v).sort();
      this.byte(TAG.object).uint32(keys.length);
      for (const k of keys) this.uint32(k.length).string(k).value((v as Record<string, unknown>)[k], depth + 1);
      return this;
    }
    return fail(v);
  }

  /** The digest so far, 16 hex digits; the stream goes on. */
  hex(): string {
    return this.hi.toString(16).padStart(8, "0") + this.lo.toString(16).padStart(8, "0");
  }
}

function fail(v: unknown): never {
  const what = v === undefined ? "undefined" : typeof v !== "object" ? `a ${typeof v}` : `a ${(v as object).constructor?.name ?? "prototype-less object"}`;
  throw new TypeError(`hashValue: ${what} is not plain data; hash its id or its numbers instead`);
}

/** The hash of a list of numbers, 16 hex digits: the state hash of a typed array or a pose. */
export const hashNumbers = (values: ArrayLike<number>): string => new Fnv64().numbers(values).hex();

/** The hash of plain data, 16 hex digits; equal for equal data whatever the key order. */
export const hashValue = (v: unknown): string => new Fnv64().value(v).hex();

/** Murmur3's 32-bit finalizer: spreads every input bit over the output. */
export function mix32(h0: number): number {
  let h = h0 | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
