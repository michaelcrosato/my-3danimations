// Describe (WP-3.4): on the 30 clips of describe-truth.json (labelled from their filmstrips and catalog lines, the
// labels reviewed by a verifier first) the timeline names the right phases in the right order for at least 27; the
// text is the same every run and within 150 tokens (a long clip's later items dropped and counted); landings, strikes
// and travel are read where they happen. The token count on every clip's text is describe-tokens.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encode } from "gpt-tokenizer";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { describe as suite, expect, it } from "vitest";
import type { Clip } from "@m3a/core";
import { describe } from "../src/index.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";

const truth = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/describe-truth.json"), "utf8")) as { clips: { clip: string; phases: string[] }[] };
const lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
const of = (id: string) => {
  const c = lib.get(id);
  if (!c) throw new Error(`no clip ${id} in the library`);
  return describe(c.clip, c.rest);
};

suite("the timeline against the ground truth", () => {
  it("names the right phases in the right order for at least 27 of the 30 clips", () => {
    expect(truth.clips).toHaveLength(30);
    const misses = truth.clips.map((t) => ({ clip: t.clip, want: t.phases.join(" "), got: of(t.clip).phases.map((p) => p.name).join(" ") })).filter((x) => x.want !== x.got);
    console.log(`describe: ${30 - misses.length} of 30 right${misses.length ? `; missed: ${misses.map((x) => `${x.clip} (want ${x.want}, got ${x.got})`).join("; ")}` : ""}`);
    expect(misses.length, JSON.stringify(misses)).toBeLessThanOrEqual(3);
  });
});

suite("the text", () => {
  it("is the same every run, and at most 150 tokens by default (more with detail)", () => {
    let most = 0;
    for (const t of truth.clips) {
      const a = of(t.clip), b = of(t.clip);
      expect(a).toEqual(b);
      most = Math.max(most, encode(a.text).length);
    }
    expect(most).toBeLessThanOrEqual(150);
    const c = lib.get("CMU_CURATED/Sit_Down_Get_Up")!;
    expect(describe(c.clip, c.rest, { detail: true }).text.length).toBeGreaterThanOrEqual(describe(c.clip, c.rest).text.length);
  });
  it("stays within 150 tokens on a long clip, saying how many items it left out and to when", () => {
    // Sit_Down_Get_Up played over and over: 6 and 10 times (25 and 41 phases)
    const { clip, rest } = lib.get("CMU_CURATED/Sit_Down_Get_Up")!;
    for (const n of [6, 10]) {
      const keys = Array.from({ length: n }, (_, r) => clip.keys.filter((k) => k.t < clip.dur).map((k) => ({ ...k, t: Math.round((k.t + r * clip.dur) * 1000) / 1000 }))).flat();
      const long = { ...clip, dur: Math.round(clip.dur * n * 1000) / 1000, keys, events: [] } as Clip, d = describe(long, rest);
      expect(Math.max(encode(d.text).length, cl100k(d.text).length), d.text).toBeLessThanOrEqual(150);
      expect(d.text).toMatch(new RegExp(`… \\d+ more to ${long.dur.toFixed(2)} s`));
    }
  });
  it("reads a landing where it happens, a strike by its limb, and travel in hip heights", () => {
    const land = of("MESH2MOTION/Jump_2");
    expect(land.moments.find((x) => x.name === "land")?.text).toMatch(/^lands on the (left|right) foot at 0\.\d\d s$/);
    expect(of("QUATERNIUS_3D2DGE/Roll").moments.find((x) => x.name === "land")?.text).toMatch(/^lands on the (back|front) at /);
    const punch = of("QUATERNIUS_3D2DGE/Punch_Jab");
    expect(punch.moments.some((x) => x.name === "strike" && /fist/.test(x.text))).toBe(true);
    const walk = of("CMU_CURATED/Walk_Loop");
    expect(walk.text).toMatch(/travels \d\.\d hip heights forward a cycle$/);
    expect(walk.text.startsWith("a 1.10 s loop; 0.00–")).toBe(true);
  });
});
