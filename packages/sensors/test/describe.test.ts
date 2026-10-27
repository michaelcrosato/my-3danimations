// Describe (WP-3.4): on the 30 clips of describe-truth.json (labelled from their filmstrips and catalog lines, the
// labels reviewed by a verifier first) the timeline names the right phases in the right order for at least 27; the
// text is the same every run and within 150 tokens (a long clip's later items dropped and counted); landings, strikes
// and travel are read where they happen; a turn by its side and size and a forward bend by the trunk's lean (WP-F.16),
// and no turn where a body only twists and comes back. The token count on every clip's text is describe-tokens.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encode } from "gpt-tokenizer";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { describe as suite, expect, it } from "vitest";
import { format, type Clip } from "@m3a/core";
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
  it("names a turn by its side and size, and a forward bend by the trunk's lean (WP-F.16)", () => {
    // [side, least, most]: the clips' own headings turn 102° left, 87° right, 180° left and 181° right (their keys' body)
    const turns: [string, string, number, number][] = [["MESH2MOTION/Turn_Left_90", "left", 85, 115], ["MESH2MOTION/Turn_Right_90", "right", 75, 100], ["MESH2MOTION/Turn_Left_180", "left", 165, 195], ["MESH2MOTION/Turn_Right_180", "right", 165, 195], ["CMU_CURATED/Stumble_Turn", "left", 340, 400]];
    for (const [id, side, least, most] of turns) {
      const t = of(id).moments.filter((x) => x.name === "turn");
      expect(t.length, id).toBe(1);
      const [, deg, way] = /turns (\d+)° to the (left|right)$/.exec(t[0]!.text)!;
      expect([id, way, +deg! >= least && +deg! <= most], t[0]!.text).toEqual([id, side, true]);
    }
    // the clip the owner saw spin round and walk back (D136): it walks up, bends to the basket, turns about half round to
    // its right, walks back and bends again; the text says each, in time order
    const basket = of("CMU_CURATED/Pick_Up_Basket");
    expect(basket.text).toMatch(/s bends over \(trunk \d+°\); [^;]*s turns 1[6-9]\d° to the right; [^;]*s bends over/);
    // mirrored, a turn goes the other way by as much
    const left = lib.get("MESH2MOTION/Turn_Left_90")!, mirrored = describe(format.mirror(left.clip as never) as never, left.rest).moments.find((x) => x.name === "turn")!;
    expect(mirrored.text.replace(/^.* s turns /, "")).toBe(of("MESH2MOTION/Turn_Left_90").moments.find((x) => x.name === "turn")!.text.replace(/^.* s turns /, "").replace("left", "right"));
  });
  it("names no turn where the body twists and comes back, nor a bend on a level push-up or a flip", () => {
    for (const id of ["CMU_CURATED/Walk_Loop", "STYLE100_IDLE/SwingShoulders_Idle", "STYLE100/KarateChop_Walk", "MESH2MOTION/Fighting_Right_Jab", "MESH2MOTION/Pushup"]) expect([id, of(id).moments.filter((x) => x.name === "turn").map((x) => x.text)]).toEqual([id, []]);
    for (const id of ["MESH2MOTION/Pushup", "CMU_CURATED/Walk_Loop"]) expect([id, of(id).moments.filter((x) => x.name === "bend").map((x) => x.text)]).toEqual([id, []]);
    for (const id of ["CMU_CURATED/Take_A_Bow", "CMU_CURATED/Bend_Lift", "STYLE100_IDLE/BentForward_Idle"]) expect([id, of(id).moments.some((x) => x.name === "bend")]).toEqual([id, true]);
    expect(of("CMU_CURATED/Dive_Roll").moments.filter((x) => x.name === "bend").every((x) => +/trunk (\d+)/.exec(x.text)![1]! <= 110)).toBe(true);
  });
});
