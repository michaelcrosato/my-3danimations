// The 20 example recipes (WP-6.1, spec/recipes/): each is the shape spec/schemas/recipe.schema.json gives and checks
// clean; compiled against the library, each is a valid format-2 clip the sensors pass, naming its inputs by the SHA-256
// of their files; and describe explains each in at most 100 tokens, as o200k and cl100k count them.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { encode } from "gpt-tokenizer";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { describe, expect, it } from "vitest";
import { parseClip, recipe as R, validate, type Rest } from "@m3a/core";
import { metrics } from "../src/index.ts";

const ROOT = join(import.meta.dirname, "../../.."), DIR = join(ROOT, "spec/recipes");
const examples = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, recipe: JSON.parse(readFileSync(join(DIR, f), "utf8")) as R.Recipe }));
// the clips the examples read, from their files (the whole library is the sensors' other tests' to load)
const LIB = join(ROOT, "library/sets");
const resolve: R.Resolver = Object.assign((id: string) => {
  const [set, slug] = id.split("/") as [string, string], file = join(LIB, set, `${slug}.json`);
  if (!existsSync(file)) return undefined;
  const text = readFileSync(file, "utf8"), clip = parseClip(text), manifest = JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
  return { clip, rest: manifest.sources[clip.restSrc]!.rest, contentId: createHash("sha256").update(text).digest("hex") };
}, { ids: () => readdirSync(LIB).flatMap((set) => readdirSync(join(LIB, set)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => `${set}/${f.slice(0, -5)}`)) });

describe("the example recipes", () => {
  it("are 20, each the schema's shape and checked clean, named as its file", () => {
    const schema = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(join(ROOT, "spec/schemas/recipe.schema.json"), "utf8")) as object);
    expect(examples).toHaveLength(20);
    for (const { file, recipe } of examples) {
      expect([file, schema(recipe) ? [] : schema.errors, R.validateRecipe(recipe)]).toEqual([file, [], []]);
      expect(recipe.id).toBe(`RECIPES/${file.replace(/\.json$/, "")}`);
    }
  });
  it("compile into valid clips the sensors pass, each naming its inputs", () => {
    for (const { file, recipe } of examples) {
      const out = R.compile(recipe, resolve), report = metrics(out.clip, out.rest);
      expect([file, validate(out.clip).errors]).toEqual([file, []]);
      expect([file, report.verdict, report.findings.map((f) => `${f.metric} ${f.where}`)]).toEqual([file, "pass", []]);
      const inputs = (out.clip.provenance as unknown as { recipe: { inputs: Record<string, string> } }).recipe.inputs;
      expect(Object.keys(inputs).sort()).toEqual([...new Set(recipe.steps.filter((s) => s.op === "clip").map((s) => s.id as string))].sort());
    }
  });
  it("are each explained in at most 100 tokens", () => {
    for (const { recipe } of examples) {
      const text = R.describeRecipe(recipe);
      expect(Math.max(encode(text).length, cl100k(text).length), text).toBeLessThanOrEqual(100);
    }
  });
});
