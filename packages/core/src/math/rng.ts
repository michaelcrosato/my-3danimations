// Seeded randomness (PLAN.md WP-2.1; DOCTRINE.md principle 5): Mulberry32 streams, bit for bit my-3d2dge's `rng`
// (engine/my-3d2dge.js:88; the frozen vectors in spec/vectors/frozen/core.json), seeds derived from a seed and keys, and
// named streams whose states are plain numbers that a save holds and a hash covers. Core never calls Math.random.
// A stream's whole state is one int32, so reading it and setting it back resumes the exact sequence; a stream depends
// only on its seed and keys, so adding a stream never shifts another. Pure int32 arithmetic: the same in every engine.
import { Fnv64, mix32 } from "./hash.ts";

const TWO_32 = 4294967296;

/** One Mulberry32 stream: `next()` and the helpers built on it, each drawing from `next()` in order. */
export class Rng {
  #state: number;

  /** A stream from `seed` (any number; taken as an int32 with `| 0`, as my-3d2dge's `rng` does). */
  constructor(seed: number) {
    this.#state = seed | 0;
  }

  /** The next number in [0, 1), with 32 bits of randomness. */
  next(): number {
    const s = (this.#state + 0x6d2b79f5) | 0;
    this.#state = s;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / TWO_32;
  }

  /** A number in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** A whole number from min to max, both included. */
  int(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** One element of `list`, uniformly; undefined when it is empty. */
  pick<T>(list: readonly T[]): T | undefined {
    return list[Math.floor(this.next() * list.length)];
  }

  /** `list` shuffled in place (Fisher–Yates) and returned. */
  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  }

  /** The whole state, an int32; setting it resumes exactly, in this stream or another. */
  get state(): number {
    return this.#state;
  }
  set state(value: number) {
    this.#state = value | 0;
  }
}

/** my-3d2dge's `rng(seed)`: a function returning the stream's next number. */
export function rng(seed: number): () => number {
  const r = new Rng(seed);
  return () => r.next();
}

/** A seed, an unsigned 32-bit integer, derived from `seed` and `keys`: unrelated seeds for different keys, in order. */
export function derive(seed: number, ...keys: readonly (string | number)[]): number {
  const h = new Fnv64().value([seed, ...keys]);
  return mix32(h.hi ^ h.lo);
}

/**
 * Named streams from one seed: `stream("blend")`, `stream("layer", 2)`. Each is made on first use from
 * `derive(seed, ...keys)`, so streams never depend on each other or on the order they were first used. `state()` lists
 * only the streams that have drawn (a stream at its derived seed is the same as none), so making a stream without
 * drawing changes no hash; `setState` puts every other stream back at its derived seed.
 */
export class RngStreams {
  readonly seed: number;
  #streams = new Map<string, { rng: Rng; start: number }>();

  constructor(seed: number) {
    this.seed = seed | 0;
  }

  /** The stream named by `keys`, made on first use. */
  stream(...keys: readonly (string | number)[]): Rng {
    const name = JSON.stringify(keys);
    let s = this.#streams.get(name);
    if (!s) {
      const start = derive(this.seed, ...keys) | 0;
      s = { rng: new Rng(start), start };
      this.#streams.set(name, s);
    }
    return s.rng;
  }

  /** Every stream that has drawn, by name (the JSON of its keys), as its int32 state; plain data. */
  state(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const name of [...this.#streams.keys()].sort()) {
      const s = this.#streams.get(name)!;
      if (s.rng.state !== s.start) out[name] = s.rng.state;
    }
    return out;
  }

  /** Restores `state()`'s data: the streams it lists take their states, every other stream its derived seed. */
  setState(data: Readonly<Record<string, number>>): void {
    for (const s of this.#streams.values()) s.rng.state = s.start;
    for (const [name, value] of Object.entries(data)) this.stream(...(JSON.parse(name) as (string | number)[])).state = value;
  }
}
