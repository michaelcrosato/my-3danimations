// The conformance kit's own tests (WP-10.2): the wire keeps every double and -0; the TypeScript sidecar passes a
// sample of every tier through the real transport, in the shapes protocol.schema.json gives, and refuses an unknown op
// by name; a tier whose ops an implementation doesn't answer is not claimed; and a deliberately broken implementation
// (one number rounded differently, two points swapped) fails with the vector, the case, the field and both values
// named. The full certification is `npm run conformance -- --impl ts`.
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handle } from "../adapters/ts.ts";
import { loadTier1a, tier2Sets } from "../runner/vectors.ts";
import { certify, type Ask } from "./kit.ts";
import { line, PROTOCOL, Sidecar } from "./wire.ts";

const ROOT = join(import.meta.dirname, "../../..");
const sidecar = (file: string, ...args: string[]) => new Sidecar(process.execPath, [join(import.meta.dirname, "../adapters", file), ...args], ROOT);
const schema = JSON.parse(readFileSync(join(import.meta.dirname, "../protocol.schema.json"), "utf8")) as { $id: string };
const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(schema);
const valid = (ref: string, data: unknown) => {
  const v = ajv.getSchema(`${schema.$id}#/$defs/${ref}`)!;
  return v(JSON.parse(line(data))) ? [] : v.errors!.map((e) => `${ref}${e.instancePath} ${e.message}`);
};

describe("the wire", () => {
  it("writes one line per message, -0 and every double kept, typed arrays as arrays, non-finite as null", () => {
    const text = line({ a: -0, b: new Float32Array([1.5, -0]), c: NaN, d: 0.1 + 0.2, s: "-0" });
    expect(text).toBe('{"a":-0,"b":[1.5,-0],"c":null,"d":0.30000000000000004,"s":"-0"}');
    expect(Object.is((JSON.parse(text) as { a: number }).a, -0)).toBe(true);
  });
});

describe("the TypeScript sidecar", () => {
  it("passes a sample of every tier through the transport, asking and answering in the protocol's shapes", async () => {
    const side = sidecar("ts.ts"), seen = new Map<string, string[]>();
    const ask: Ask = async (op, fields) => {
      const result = await side.ask(op, fields);
      if (!seen.has(op)) seen.set(op, [...valid("request", { id: 1, op, ...fields }), ...valid(`results/${op}`, result)]);
      return result;
    };
    const r = await certify(ask, undefined, 1);
    await expect(side.ask("nope")).rejects.toThrow(/unknown op "nope"; this implementation answers hello, reduce/);
    side.close();
    expect(r.impl).toMatchObject({ implementation: "@m3a/core", protocol: PROTOCOL });
    expect(r.tiers.map((t) => [t.tier, t.ok, t.failed])).toEqual([["1a", true, 0], ["1b", true, 0], ["2", true, 0], ["3", true, 0]]);
    expect(r.tiers.map((t) => t.cases)).toEqual([6, 6, tier2Sets().length * 4, 7 * tier2Sets().length]);
    expect([...seen.keys()].sort()).toEqual(["decode", "fit", "hello", "measure", "mirror", "parse", "readCmu", "readGltf", "reduce", "retarget", "text"]);
    expect([...seen.values()].flat()).toEqual([]);
    expect(valid("results/decode", [[0, 1, 2]])).toEqual(["results/decode/0 must NOT have fewer than 108 items"]);
  });
  it("leaves unclaimed a tier whose ops it doesn't answer, and format 2's vector when it reads format 1 alone", async () => {
    // a format-1 codec with no solver, the reference in-process behind the wire's JSON
    const ask: Ask = async (op, fields) => {
      const result = JSON.parse(line(handle({ id: 1, op, ...fields }))) as { ops?: string[] };
      return op === "hello" ? { ...result, ops: result.ops!.filter((o) => o !== "retarget"), formats: [1] } : result;
    };
    const [two, three] = (await certify(ask, ["2", "3"], 1)).tiers;
    expect(two).toMatchObject({ tier: "2", claimed: true, ok: true, cases: 12, skipped: ["tier2/FORMAT2.json (format 2)"] });
    expect(two!.vectors.map((v) => v.vector)).not.toContain("tier2/FORMAT2.json");
    expect(three).toMatchObject({ tier: "3", claimed: false, ok: false, cases: 0, missing: ["retarget"] });
  });
});

describe("a deliberately broken implementation", () => {
  it("rounding fit's mean to float32 fails tier 1a, naming each vector's first clip, the field and both values", async () => {
    const side = sidecar("broken.ts", "round"), [tier] = (await certify((op, f) => side.ask(op, f), ["1a"], 1)).tiers;
    side.close();
    const want = loadTier1a("rig").clips.A_TPose!.fit!.mean;
    expect(tier!.ok).toBe(false);
    expect(tier!.vectors.map((v) => [v.vector, v.failed, v.cases])).toEqual([["tier1a/rig.json", 1, 3], ["tier1a/cmu-09_02.json", 1, 3]]);
    expect(tier!.vectors[0]!.first).toEqual({ vector: "tier1a/rig.json", case: "A_TPose fit", field: "fit.mean", ours: Math.fround(want), want });
  });
  it("swapping the wrists fails tier 2's decode in every set, and only the decode", async () => {
    const side = sidecar("broken.ts", "swap"), [tier] = (await certify((op, f) => side.ask(op, f), ["2"], 1)).tiers;
    side.close();
    expect(tier!.vectors.map((v) => [v.vector, v.failed, v.cases])).toEqual(tier2Sets().map((s) => [`tier2/${s}.json`, 1, 4]));
    for (const v of tier!.vectors) {
      expect(v.first!.case).toMatch(/ decode$/);
      expect(v.first!.field).toMatch(/^decode t [\d.]+: wristL\[[012]\] \(mm\)$/);
      expect(Math.abs((v.first!.ours as number) - (v.first!.want as number))).toBeGreaterThan(0.001);
    }
  });
});
