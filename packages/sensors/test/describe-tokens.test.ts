// Describe's token count (WP-3.4): on every library clip's text, with detail, no lower than o200k or cl100k counts it;
// T1 reads every third clip, T2's full step (M3A_FULL=1) all of them (D74). Apart from describe.test.ts, since it reads
// the whole library, so the two run side by side.
import { encode } from "gpt-tokenizer";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { expect, it } from "vitest";
import { describe } from "../src/index.ts";
import { tokenCount } from "../src/describe/describe.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";

const FULL = process.env.M3A_FULL === "1";

it(`counts tokens no lower than o200k or cl100k does, on ${FULL ? "every" : "every third"} clip's text`, () => {
  for (const [i, c] of libraryClips().entries()) {
    if (!FULL && i % 3 !== 0) continue;
    const text = describe(c.clip, c.rest, { detail: true }).text;
    expect(tokenCount(text), text).toBeGreaterThanOrEqual(Math.max(encode(text).length, cl100k(text).length));
  }
}, 60_000);
