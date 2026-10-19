// The JSON Schemas in spec/schemas/ agree with the validator: the base fixtures pass both, and every structural
// failure the validator raises is a schema failure too. (Ordering, limits and contact ranges are the validator's
// alone: JSON Schema can't say them.)
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validate } from "../src/validate/index.ts";
import { BAD_RECORDS, baseClip, baseSet, withRecords } from "./fixtures.ts";

const schema = (name: string) => JSON.parse(readFileSync(new URL(`../../../spec/schemas/${name}.schema.json`, import.meta.url), "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: false });
const clipSchema = ajv.compile(schema("clip"));
const setSchema = ajv.compile(schema("set"));
const rowSchema = ajv.compile(schema("catalog-row"));

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const mut = (f: (c: J) => void): J => {
  const c = baseClip();
  f(c);
  return c;
};

describe("the JSON Schemas", () => {
  it("accept the base fixtures", () => {
    expect(clipSchema(baseClip()), JSON.stringify(clipSchema.errors)).toBe(true);
    expect(setSchema(baseSet()), JSON.stringify(setSchema.errors)).toBe(true);
    expect(rowSchema("TEST/Walk_Loop\t1.333\tloop\t\twalk\trelaxed walk\tUAL1".split("\t"))).toBe(true);
    for (const s of ["recipe", "graph", "moves"]) expect(ajv.validateSchema(schema(s))).toBe(true);
  });
  const structural: [string, () => J][] = [
    ["M2-E002", () => mut((c) => (c.format = "3.0"))],
    ["M2-E003", () => mut((c) => delete c.keys[1].armL)],
    ["M2-E004", () => mut((c) => (c.loop = "yes"))],
    ["M2-E006", () => mut((c) => (c.keys[0].legL = [1, 2, 3]))],
    ["M2-E007", () => mut((c) => (c.keys[0].head[0] = 2.5))],
    ["M2-E009", () => mut((c) => (c.keys = []))],
    ["M2-E014", () => mut((c) => (c.keys[1].armL[3] = 191))],
    ["M2-E016", () => mut((c) => (c.provenance.method = "dreamed"))],
    ["M2-E017", () => mut((c) => (c.id = "test walk"))],
    ["M2-E018", () => mut((c) => (c.provenance.license = "CC-BY-4.0"))],
    ["M2-E019", () => mut((c) => (c.keys[0].armR = [0, 0, 0, 10, 0]))],
  ];
  it("accept provenance's two records in full, and a partial intake record (who made it alone)", () => {
    for (const c of [withRecords(), withRecords((r) => ((r.intake = { by: "a person" }), delete r.source.stated))]) expect(clipSchema(c), JSON.stringify(clipSchema.errors)).toBe(true);
  });
  it("reject an intake record without who made it, as the validator does (M2-E003 at provenance.intake.by, D119)", () => {
    const c = withRecords((r) => (r.intake = {}));
    expect(validate(c).errors.map((i) => `${i.code} ${i.field}`)).toEqual(["M2-E003 provenance.intake.by"]);
    expect([clipSchema(c), clipSchema.errors?.map((e) => `${e.instancePath} ${e.keyword} ${(e.params as { missingProperty?: string }).missingProperty}`)]).toEqual([false, ["/provenance/intake required by"]]);
  });
  for (const [code, field, f] of BAD_RECORDS) {
    it(`reject a record the validator refuses: ${code} at ${field}`, () => {
      const c = withRecords(f);
      expect(validate(c).errors.map((i) => i.code)).toContain(code);
      expect(clipSchema(c)).toBe(false);
    });
  }
  for (const [code, make] of structural) {
    it(`reject what the validator calls ${code}`, () => {
      const c = make();
      expect(validate(c).errors.map((i) => i.code)).toContain(code);
      expect(clipSchema(c)).toBe(false);
    });
  }
});
