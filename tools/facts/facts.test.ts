// `npm run facts` (WP-5.4): over a sample of the library every clip's facts and contacts are as measured and no tag
// conflicts; a fact edited by hand is named stale; a conflict is listed with its reason when the baseline gives one, and
// a reason whose conflict is gone is named.
import { describe, expect, it } from "vitest";
import { libraryClips, sample } from "../qa/qa.ts";
import { checkFacts } from "./facts.ts";

const lib = sample(libraryClips(), 60);

describe("npm run facts", () => {
  it("finds a sample of the library as measured, with no tag its facts don't bear out", () => {
    const r = checkFacts(lib, { conflicts: {} });
    expect(r.clips).toBe(60);
    expect(r.stale).toEqual([]);
    expect(r.conflicts).toEqual([]);
  });
  it("names a fact edited by hand, a conflict with its reason, and a reason whose conflict is gone", () => {
    // a loop that stays on the spot (an idle) tagged run: a conflict, here given a reason; another clip's fact edited
    const idle = lib.find((c) => c.clip.loop && ((c.clip.facts as { speed?: number }).speed ?? 0) < 10)!, other = lib.find((c) => c !== idle)!;
    const tagged = { ...idle, clip: { ...idle.clip, tags: [...idle.clip.tags, "run"] } }, edited = { ...other, clip: { ...other.clip, facts: { ...(other.clip.facts as object), height: [1, 2] } as never } };
    const r = checkFacts([tagged, edited], { conflicts: { [idle.clip.id]: { run: "a test's reason" }, "NO_SET/Gone": { loop: "a conflict that went" } } });
    expect(r.stale).toEqual([expect.stringContaining(`${other.clip.id}: its facts`)]);
    expect(r.conflicts).toEqual([{ id: idle.clip.id, tag: "run", message: expect.stringContaining("travels"), reason: "a test's reason" }]);
    expect(r.gone).toEqual(["NO_SET/Gone loop"]);
    // without the reason, the conflict stands open
    expect(checkFacts([tagged], { conflicts: {} }).conflicts[0]!.reason).toBeUndefined();
  });
});
