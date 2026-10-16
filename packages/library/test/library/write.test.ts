// The set writer (WP-7.2b, D93; moved from tools/migrate, which imports it back): a committed set written again from its
// manifest and clips, byte for byte (the clips by core's serializer, catalog.tsv's rows within their 40 cl100k tokens,
// _set.json with its content id), with Node's SHA-256 or core's; and, with the rough token count, rows that fit.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { describe, expect, it } from "vitest";
import { parseClip } from "@m3a/core";
import { catalogRow, ROW_BUDGET, setFiles } from "../../src/index.ts";
import { sha256 } from "../../src/node.ts";

const DIR = join(import.meta.dirname, "../../../../library/sets/QUATERNIUS_3D2DGE"), read = (f: string) => readFileSync(join(DIR, f), "utf8");

describe("the set writer", () => {
  it("writes a migrated set's clips, catalog.tsv and _set.json byte for byte", () => {
    const ids = read("catalog.tsv").trim().split("\n").map((l) => l.split("\t")[0]!), clips = ids.map((id) => parseClip(read(`${id.split("/")[1]}.json`)));
    const manifest = JSON.parse(read("_set.json")) as Record<string, unknown> & { content: Record<string, unknown> }, cl100k = (t: string) => encode(t).length;
    const files = setFiles(manifest, clips, { sha256, tokens: cl100k });
    expect([...files.keys()].sort()).toEqual([...ids.map((id) => `${id.split("/")[1]}.json`), "_set.json", "catalog.tsv"].sort());
    for (const [f, text] of files) expect(text, f).toBe(read(f));
    expect(setFiles(manifest, clips, { tokens: cl100k }).get("_set.json")).toBe(read("_set.json")); // core's SHA-256 is Node's
    // without a tokenizer, a token every two bytes: more than cl100k counts, so a row stays in its budget
    for (const c of clips) expect(encode(catalogRow(c)).length, c.id).toBeLessThanOrEqual(ROW_BUDGET);
  });
});
