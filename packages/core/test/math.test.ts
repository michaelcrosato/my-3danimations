// The math kernel (WP-2.1): the portable functions give native V8's bits (pow within one unit in the last place), on
// 200,000 inputs each, over the whole double range and at the special values; the helpers and the RNG match the frozen
// core.json bit for bit; the hashes, streams, vectors, quaternions and matrices hold their contracts. V8 against
// JavaScriptCore is `npm run test:cross-engine`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  angDiff, approach, approachAng, derive, easesWith, Fnv64, hash2, hashNumbers, hashValue, lerpAng, mat4, NATIVE, noise2, PORTABLE, quat, rng, Rng, RngStreams, smoothDamp, vec3,
  type MathLike, type Quat, type Vec3,
} from "./all.ts";
import { TWO_OVER_PI_HEX } from "../src/math/portable.ts";

const CORE = JSON.parse(readFileSync(join(import.meta.dirname, "../../../spec/vectors/frozen/core.json"), "utf8"));
const F = new Float64Array(1);
const B = new BigInt64Array(F.buffer);
const U = new Uint32Array(F.buffer);
const bits = (x: number) => ((F[0] = x), B[0]!);
/** Units in the last place between a and b (0 when they are the same bits, or both NaN). */
function ulps(a: number, b: number): number {
  if (Object.is(a, b) || (a !== a && b !== b)) return 0;
  if (a !== a || b !== b) return Infinity;
  const d = bits(a) - bits(b);
  return Number(d < 0n ? -d : d);
}
function lcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0), s / 4294967296);
}
type Fn = keyof MathLike;
/** Calls `name` of both maths on `n` generated inputs; the inputs where they differ, worst first, and the worst ulps. */
function compare(name: Fn, n: number, gen: () => number[]): { differ: number; worst: number; first?: number[] } {
  const p = PORTABLE[name] as (...a: number[]) => number, q = NATIVE[name] as (...a: number[]) => number;
  let differ = 0, worst = 0, first: number[] | undefined;
  for (let i = 0; i < n; i++) {
    const a = gen(), u = ulps(p(...a), q(...a));
    if (u) {
      differ++;
      first ??= a;
    }
    if (u > worst) worst = u;
  }
  return { differ, worst, ...(first ? { first } : {}) };
}

describe("portable math: native V8's bits", () => {
  // the ranges of my-3d2dge's D15 check: angles ±1000, ratios ±10, unit values, positive values up to 50
  const r = lcg(7);
  const RANGES: [Fn, () => number[]][] = [
    ["sin", () => [(r() - 0.5) * 2000]], ["cos", () => [(r() - 0.5) * 2000]], ["tan", () => [(r() - 0.5) * 20]], ["atan", () => [(r() - 0.5) * 20]],
    ["atan2", () => [(r() - 0.5) * 2000, (r() - 0.5) * 20]], ["asin", () => [r() * 2 - 1]], ["acos", () => [r() * 2 - 1]], ["exp", () => [(r() - 0.5) * 20]],
    ["log", () => [r() * 50 + 1e-9]], ["log2", () => [r() * 50 + 1e-9]], ["log10", () => [r() * 50 + 1e-9]], ["hypot", () => [(r() - 0.5) * 2000, (r() - 0.5) * 20]], ["cbrt", () => [(r() - 0.5) * 2000]],
  ];
  for (const [name, gen] of RANGES) {
    it(`${name}: the same bits on 200,000 inputs`, () => {
      expect(compare(name, 200000, gen)).toEqual({ differ: 0, worst: 0 });
    });
  }
  it("all but pow: the same bits on 30,000 random bit patterns each, every exponent equally likely", () => {
    const rb = lcg(5);
    const any = () => {
      U[0] = (rb() * 4294967296) >>> 0;
      U[1] = (rb() * 4294967296) >>> 0;
      return F[0]!;
    };
    const out: Record<string, number> = {};
    for (const name of ["sin", "cos", "tan", "atan", "asin", "acos", "exp", "log", "log2", "log10", "cbrt"] as Fn[]) out[name] = compare(name, 30000, () => [any()]).differ;
    out.atan2 = compare("atan2", 30000, () => [any(), any()]).differ;
    out.hypot = compare("hypot", 30000, () => [any(), any(), any()]).differ;
    expect(out).toEqual(Object.fromEntries(Object.keys(out).map((k) => [k, 0])));
  });
  it("angles past 2^19·π/2 reduce exactly (Payne–Hanek), up to the largest double", () => {
    const rl = lcg(13);
    for (const name of ["sin", "cos", "tan"] as Fn[]) expect(compare(name, 20000, () => [Math.exp(13.6 + rl() * 696) * (rl() < 0.5 ? -1 : 1)]).differ, name).toBe(0);
    expect(PORTABLE.sin(1e22)).toBe(-0.8522008497671888);
  });
  it("its 2/π table is 2/π (checked against π from Machin's formula in big integers)", () => {
    const prec = 1700n, one = 1n << prec;
    const arctanInv = (x: bigint) => {
      let total = one / x, term = total, n = 1n, sign = -1n;
      while (term) {
        term /= x * x;
        total += (sign * term) / (2n * n + 1n);
        sign = -sign;
        n++;
      }
      return total;
    };
    const pi = 4n * (4n * arctanInv(5n) - arctanInv(239n));
    const twoOverPi = ((2n << (2n * prec)) / pi).toString(16).toUpperCase().padStart(Number(prec) / 4, "0");
    expect(twoOverPi.startsWith(TWO_OVER_PI_HEX)).toBe(true);
  });
  it("pow: within one unit of the native (glibc's, which V8 calls) on 200,000 inputs, exact where ECMAScript fixes it", () => {
    const rp = lcg(9);
    const c = compare("pow", 200000, () => [rp() * 50 + 1e-9, (rp() - 0.5) * 20]);
    expect(c.worst).toBeLessThanOrEqual(1);
    const neg = compare("pow", 20000, () => [-(rp() * 50 + 1e-9), Math.round((rp() - 0.5) * 60)]);
    expect(neg.worst).toBeLessThanOrEqual(1);
    for (const [x, y] of [[NaN, 0], [1, NaN], [1, Infinity], [-1, -Infinity], [0, -1], [-0, -3], [-0, -2], [Infinity, -1], [-Infinity, 3], [-8, 1 / 3], [2, 1024], [2, -1075], [10, 2], [7, 0.5], [-7, 0.5], [0.5, Infinity]]) {
      expect(Object.is(PORTABLE.pow(x!, y!), Math.pow(x!, y!)), `pow(${x}, ${y})`).toBe(true);
    }
  });
  it("special values: the native results exactly", () => {
    const S = [0, -0, Infinity, -Infinity, NaN, 1, -1, 2, 0.5, -0.5, 5e-324, -5e-324, 2.2250738585072014e-308, Number.MAX_VALUE, -Number.MAX_VALUE, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, 3, 1e22, 1000, 0.1, 823550, 1.7e12];
    const off: string[] = [];
    for (const name of ["sin", "cos", "tan", "atan", "asin", "acos", "exp", "log", "log2", "log10", "cbrt"] as Fn[]) for (const x of S) if (ulps((PORTABLE[name] as (x: number) => number)(x), (NATIVE[name] as (x: number) => number)(x))) off.push(`${name}(${x})`);
    for (const name of ["atan2", "hypot"] as Fn[]) for (const x of S) for (const y of S) if (ulps((PORTABLE[name] as (x: number, y: number) => number)(x, y), (NATIVE[name] as (x: number, y: number) => number)(x, y))) off.push(`${name}(${x}, ${y})`);
    for (const x of S) for (const y of S) if (ulps(PORTABLE.pow(x, y), Math.pow(x, y)) > 1) off.push(`pow(${x}, ${y})`);
    expect(off).toEqual([]);
    expect([PORTABLE.hypot(), PORTABLE.hypot(-3), PORTABLE.hypot(NaN, Infinity), PORTABLE.log10(1000), PORTABLE.log2(1024), PORTABLE.exp(1)]).toEqual([0, 3, Infinity, 3, 10, Math.E]);
  });
});

describe("the helpers match core.json bit for bit", () => {
  const same = (got: number, want: number) => Object.is(got, want);
  it("hash2, noise2, the angle helpers, approach and smoothDamp", () => {
    const misses: unknown[] = [];
    for (const [x, y, w] of CORE.hash2) if (!same(hash2(x, y), w)) misses.push(["hash2", x, y]);
    for (const [x, y, w] of CORE.noise2) if (!same(noise2(x, y), w)) misses.push(["noise2", x, y]);
    for (const [a, b, w] of CORE.angDiff) if (!same(angDiff(a, b), w)) misses.push(["angDiff", a, b]);
    for (const [a, b, t, w] of CORE.lerpAng) if (!same(lerpAng(a, b, t), w)) misses.push(["lerpAng", a, b]);
    for (const [a, b, s, w] of CORE.approachAng) if (!same(approachAng(a, b, s), w)) misses.push(["approachAng", a, b]);
    for (const [a, b, s, w] of CORE.approach) if (!same(approach(a, b, s), w)) misses.push(["approach", a, b]);
    for (const [c, t, v, st, dt, w0, w1] of CORE.smoothDamp) {
      const [x, vel] = smoothDamp(c, t, v, st, dt);
      if (!same(x, w0) || !same(vel, w1)) misses.push(["smoothDamp", c, t, v, st, dt]);
    }
    expect(misses).toEqual([]);
    expect([CORE.hash2.length, CORE.noise2.length, CORE.angDiff.length, CORE.smoothDamp.length]).toEqual([55, 149, 144, 48]);
  });
  it("the eases, with the portable pow and with the native one", () => {
    for (const M of [PORTABLE, NATIVE]) {
      const E = easesWith(M) as unknown as Record<string, (u: number) => number>;
      for (const name of Object.keys(CORE.ease)) for (const [u, w] of CORE.ease[name]) expect(E[name]!(u), `${name}(${u})`).toBe(w);
    }
  });
  it("the RNG, for every seed form (negative, fractional, past 32 bits)", () => {
    expect(CORE.rng.length).toBe(11);
    for (const { seed, values } of CORE.rng) {
      const next = rng(seed);
      expect(values.map(() => next()), `seed ${seed}`).toEqual(values);
    }
  });
});

describe("seeded streams", () => {
  it("draws within range, picks, shuffles, and resumes exactly from its state", () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const x = r.range(-2, 3), n = r.int(1, 6);
      expect(x >= -2 && x < 3 && Number.isInteger(n) && n >= 1 && n <= 6).toBe(true);
    }
    expect([r.chance(0), r.chance(1), r.pick([])]).toEqual([false, true, undefined]);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    const saved = r.state, a = [r.next(), r.next()];
    r.state = saved;
    expect([r.next(), r.next()]).toEqual(a);
  });
  it("derives unrelated seeds from keys, and named streams never shift each other", () => {
    expect(derive(1, "a")).not.toBe(derive(1, "b"));
    expect(derive(1, "a", 2)).not.toBe(derive(1, 2, "a"));
    expect(derive(1, "a")).toBe(derive(1, "a"));
    const one = new RngStreams(7), two = new RngStreams(7);
    two.stream("other").next();
    expect([one.stream("ai").next(), one.stream("ai").next()]).toEqual([two.stream("ai").next(), two.stream("ai").next()]);
  });
  it("lists only streams that drew, and restores them (others back at their seeds) through JSON", () => {
    const s = new RngStreams(3);
    s.stream("idle");
    expect(s.state()).toEqual({});
    s.stream("blend", 2).next();
    const saved = JSON.parse(JSON.stringify(s.state()));
    expect(Object.keys(saved)).toEqual(['["blend",2]']);
    const want = [s.stream("blend", 2).next(), s.stream("idle").next()];
    s.setState(saved);
    expect([s.stream("blend", 2).next(), s.stream("idle").next()]).toEqual(want);
    const fresh = new RngStreams(3);
    fresh.setState(saved);
    expect([fresh.stream("blend", 2).next(), fresh.stream("idle").next()]).toEqual(want);
  });
});

describe("state hashes", () => {
  it("is FNV-1a 64 (the published vectors), over float64 bits", () => {
    expect([new Fnv64().hex(), new Fnv64().string("a").hex(), new Fnv64().string("foobar").hex()]).toEqual(["cbf29ce484222325", "af63dc4c8601ec8c", "85944171f73967e8"]);
    expect(hashNumbers([0])).not.toBe(hashNumbers([-0]));
    expect(hashNumbers([NaN])).toBe(hashNumbers([-NaN]));
    expect(hashNumbers([1, 2, 3])).toBe(hashNumbers(new Float32Array([1, 2, 3])));
    expect(hashNumbers([0.1])).not.toBe(hashNumbers([Math.fround(0.1)]));
    expect(new Fnv64().string("é😀\ud800").hex()).toBe(new Fnv64().string("é😀�").hex());
  });
  it("hashes plain data canonically and refuses what isn't plain", () => {
    expect(hashValue({ b: [1, -0], a: "x" })).toBe(hashValue({ a: "x", b: [1, -0] }));
    expect(hashValue([1, [2]])).not.toBe(hashValue([[1], 2]));
    expect(hashValue({ a: "bc" })).not.toBe(hashValue({ ab: "c" }));
    expect(() => hashValue({ a: undefined })).toThrow(/undefined is not plain data/);
    expect(() => hashValue(new Map())).toThrow(/a Map is not plain data/);
    const cyc: unknown[] = [];
    cyc.push(cyc);
    expect(() => hashValue(cyc)).toThrow(/deeper than 100/);
  });
});

describe("vectors, quaternions and matrices", () => {
  const close = (a: readonly number[], b: readonly number[], eps = 1e-12) => a.every((x, i) => Math.abs(x - b[i]!) <= eps);
  it("vec3: the basics, and a zero vector normalizes to zero", () => {
    const v = vec3.create(3, 4, 0);
    expect([vec3.length(v), vec3.dot(v, [1, 1, 1]), vec3.distance(v, [0, 0, 0])]).toEqual([5, 7, 5]);
    expect(vec3.cross(vec3.create(), [1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(vec3.normalize(vec3.create(), [0, 0, 0])).toEqual([0, 0, 0]);
    expect(vec3.reject(vec3.create(), [1, 2, 3], [0, 0, 1])).toEqual([1, 2, 0]);
    expect(vec3.lerp(vec3.create(), [0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });
  it("quat: turns, composes, inverts, and turns one vector onto another", () => {
    const q = quat.fromAxisAngle(quat.identity(), [0, 0, 1], Math.PI / 2);
    expect(close(quat.rotate(vec3.create(), q, [1, 0, 0]), [0, 1, 0])).toBe(true);
    const qq = quat.multiply(quat.identity(), q, q);
    expect(close(quat.rotate(vec3.create(), qq, [1, 0, 0]), [-1, 0, 0])).toBe(true);
    expect(close(quat.multiply(quat.identity(), q, quat.conjugate(quat.identity(), q)), [0, 0, 0, 1])).toBe(true);
    expect(quat.angle(qq)).toBeCloseTo(Math.PI, 12);
    const a: Vec3 = [1, 0, 0], b = vec3.normalize(vec3.create(), [1, 2, 3]);
    expect(close(quat.rotate(vec3.create(), quat.fromUnitVectors(quat.identity(), a, b), a), b)).toBe(true);
    expect(close(quat.rotate(vec3.create(), quat.fromUnitVectors(quat.identity(), a, [-1, 0, 0]), a), [-1, 0, 0])).toBe(true);
  });
  it("quat: slerp keeps its ends and constant speed; swing·twist rebuilds the rotation", () => {
    const a = quat.fromAxisAngle(quat.identity(), [0, 1, 0], 0.2), b = quat.fromAxisAngle(quat.identity(), [0, 1, 0], 1.4);
    expect(close(quat.slerp(quat.identity(), a, b, 0), a)).toBe(true);
    expect(close(quat.slerp(quat.identity(), a, b, 1), b)).toBe(true);
    expect(quat.angle(quat.multiply(quat.identity(), quat.conjugate(quat.identity(), a), quat.slerp(quat.identity(), a, b, 0.25)))).toBeCloseTo(0.3, 12);
    const r = lcg(4);
    for (let i = 0; i < 200; i++) {
      const q = quat.normalize(quat.identity(), [r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5] as Quat);
      const sw = quat.identity(), tw = quat.identity();
      const angle = quat.swingTwist(q, [0, 1, 0], sw, tw);
      expect(close(quat.multiply(quat.identity(), sw, tw), q, 1e-12)).toBe(true);
      expect(Math.abs(sw[1])).toBeLessThan(1e-12); // the swing turns about an axis perpendicular to y
      expect(angle > -Math.PI && angle <= Math.PI).toBe(true);
    }
  });
  it("quat: portable and native agree to rounding, and portable is what it says", () => {
    const q = quat.fromAxisAngle(quat.identity(), [0, 1, 0], 1.234, PORTABLE), n = quat.fromAxisAngle(quat.identity(), [0, 1, 0], 1.234, NATIVE);
    expect(close(q, n, 1e-15)).toBe(true);
    expect(q[3]).toBe(PORTABLE.cos(0.617));
  });
  it("mat4: compose, invert and transform", () => {
    const q = quat.fromAxisAngle(quat.identity(), [0, 0, 1], Math.PI / 2);
    const m = mat4.compose(mat4.identity(), [1, 2, 3], q, [2, 2, 2]);
    expect(close(mat4.transformPoint(vec3.create(), m, [1, 0, 0]), [1, 4, 3])).toBe(true);
    expect(close(mat4.transformDirection(vec3.create(), m, [1, 0, 0]), [0, 2, 0])).toBe(true);
    const inv = mat4.invert(mat4.identity(), m)!;
    expect(close(mat4.multiply(mat4.identity(), m, inv), mat4.identity())).toBe(true);
    expect(close(mat4.transformPoint(vec3.create(), inv, [1, 4, 3]), [1, 0, 0])).toBe(true);
    expect(mat4.invert(mat4.identity(), new Array(16).fill(0))).toBeNull();
  });
});
