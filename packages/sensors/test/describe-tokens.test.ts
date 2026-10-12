// Describe's token count (WP-3.4): on every library clip's text, with detail, no lower than o200k or cl100k counts it.
// Apart from describe.test.ts, since it reads the whole library, so the two run side by side.
import { encode } from "gpt-tokenizer";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { expect, it } from "vitest";
import { describe } from "../src/index.ts";
import { tokenCount } from "../src/describe/describe.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";

it("counts tokens no lower than o200k or cl100k does, on every clip's text", () => {
  for (const c of libraryClips()) {
    const text = describe(c.clip, c.rest, { detail: true }).text;
    expect(tokenCount(text), text).toBeGreaterThanOrEqual(Math.max(encode(text).length, cl100k(text).length));
  }
}, 60_000);
