// The 20 example recipes (WP-6.1, spec/recipes/): each is the shape spec/schemas/recipe.schema.json gives and checks
// clean; compiled against the library, each is a valid format-2 clip the sensors pass, naming its inputs by the SHA-256
// of their files; and describe explains each in at most 100 tokens, as o200k and cl100k count them.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { encode } from "gpt-tokenizer";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { describe, expect, it } from "vitest";
import { recipe as R, serialize, validate } from "@m3a/core";
import { metrics } from "../src/index.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";

const ROOT = join(import.meta.dirname, "../../.."), DIR = join(ROOT, "spec/recipes");
const examples = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, recipe: JSON.parse(readFileSync(join(DIR, f), "utf8")) as R.Recipe }));
const lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
const resolve: R.Resolver = Object.assign((id: string) => {
  const c = lib.get(id);
  return c ? { clip: c.clip, rest: c.rest, contentId: createHash("sha256").update(serialize(c.clip)).digest("hex") } : undefined;
}, { ids: () => [...lib.keys()] });

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
