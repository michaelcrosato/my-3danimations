// Facts and auto-labels (WP-5.4): a library clip's facts and contacts are what `measure` gives on its rest, so writing
// them again changes nothing; a source's speed is kept and named captured; labelled contacts are kept; and the tags are
// read against the facts: a `loop` that doesn't close, a `run` that doesn't travel unless it is tagged `inplace`.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capturedSpeed, FACTS_BY, measureClipFacts, TIERS, tagConflicts, withFacts, type ClipFacts } from "../../src/index.ts";
import { openLibrary } from "../../src/node.ts";

const lib = openLibrary({ dir: join(import.meta.dirname, "../../../../library/sets"), tiers: TIERS });
const ids = ["QUATERNIUS_3D2DGE/Walk_Loop", "STYLE100/Neutral_Walk", "CMU_CURATED/Boxing_Jab", "MESH2MOTION/Jump_Start", "STYLE100_IDLE/Neutral_Idle"];

describe("a clip's facts", () => {
  it("are what the measurement gives on its rest, so measuring again changes nothing", () => {
    for (const id of ids) {
      const { clip, rest } = lib.clip(id), m = measureClipFacts(clip, rest, capturedSpeed(clip));
      expect((clip.facts as { by: string }).by, id).toBe(FACTS_BY);
      expect(m.facts, id).toEqual(clip.facts);
      expect(m.contacts, id).toEqual(clip.contacts);
      expect(withFacts(clip, rest), id).toEqual(clip);
    }
    // a walk loop travels, an attack strikes, every clip has its hips' height range
    expect((lib.clip("STYLE100/Neutral_Walk").clip.facts as unknown as ClipFacts).speed).toBeGreaterThan(50);
    expect((lib.clip("CMU_CURATED/Boxing_Jab").clip.facts as unknown as ClipFacts).strike?.length).toBeGreaterThan(0);
  });
  it("keep a source's speed and name it captured; without one, the planted feet's", () => {
    const { clip, rest } = lib.clip("STYLE100/Neutral_Walk");
    const given = withFacts({ ...clip, facts: { by: "m3a-import@1", speed: 123 } }, rest).facts as unknown as ClipFacts;
    expect([given.speed, given.captured]).toEqual([123, ["speed"]]);
    const own = withFacts({ ...clip, facts: undefined }, rest).facts as unknown as ClipFacts;
    expect(own.captured).toBeUndefined();
    expect(Math.abs(own.speed! - (clip.facts as unknown as ClipFacts).speed!)).toBeLessThan(0.3 * own.speed!);
    // written again, a kept speed stays the source's
    expect(capturedSpeed({ facts: given as never })).toBe(123);
    expect(capturedSpeed({ facts: own as never })).toBeUndefined();
  });
  it("keep a source's labelled contacts, and detect the others again", () => {
    const { clip, rest } = lib.clip("QUATERNIUS_3D2DGE/Walk_Loop"), labelled = { by: "labelled" as const, footL: [[0, 0.5]] as [number, number][] };
    expect(measureClipFacts({ ...clip, contacts: labelled }, rest).contacts).toEqual(labelled);
    expect(measureClipFacts({ ...clip, contacts: { by: "detected", footL: [[0, 0.5]] } }, rest).contacts).toEqual(clip.contacts);
  });
});

describe("tags against facts", () => {
  const facts = (f: Partial<ClipFacts>): ClipFacts => ({ by: FACTS_BY, height: [90, 100], ...f }), R = { H0: 950 };
  it("a loop must close", () => {
    expect(tagConflicts({ tags: ["walk", "loop"], loop: true }, facts({ seam: 80, speed: 100 }), R).map((c) => c.tag)).toEqual(["loop"]);
    expect(tagConflicts({ tags: ["walk", "loop"], loop: true }, facts({ seam: 30, speed: 100 }), R)).toEqual([]);
    // the limit scales with the body: 80 mm closes a loop on a body twice as tall
    expect(tagConflicts({ tags: ["walk", "loop"], loop: true }, facts({ seam: 80, speed: 100 }), { H0: 1900 })).toEqual([]);
  });
  it("a run must travel, or be tagged inplace", () => {
    expect(tagConflicts({ tags: ["run", "loop"], loop: true }, facts({ seam: 0, speed: 0 }), R).map((c) => c.tag)).toEqual(["run"]);
    expect(tagConflicts({ tags: ["run", "loop"], loop: true }, facts({ seam: 0 }), R).map((c) => c.tag)).toEqual(["run"]);
    expect(tagConflicts({ tags: ["run", "inplace", "loop"], loop: true }, facts({ seam: 0, speed: 0 }), R)).toEqual([]);
    expect(tagConflicts({ tags: ["run", "loop"], loop: true }, facts({ seam: 0, speed: 180 }), R)).toEqual([]);
    // a run that doesn't loop is read by its travel elsewhere (its root), not by a loop's speed
    expect(tagConflicts({ tags: ["run"], loop: false }, facts({}), R)).toEqual([]);
  });
});
