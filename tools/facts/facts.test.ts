// `npm run facts` (WP-5.4): over a sample of the library every clip's facts and contacts are as measured and no tag
// conflicts; a fact edited by hand is named stale; a conflict is listed with its reason when the baseline gives one, and
// a reason whose conflict is gone is named; a loop that names a contact reading (facts.reading, D129) is held to that
// reading and to its set's import record, so an edit to its labelled contacts is named stale even with its facts
// measured again.
import { describe, expect, it } from "vitest";
import { withFacts, withReading } from "../../packages/library/src/index.ts";
import { libraryClips, sample } from "../qa/qa.ts";
import { checkFacts, namedReadings } from "./facts.ts";

const all = libraryClips(), lib = sample(all, 60);

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
  it("holds a loop that names a contact reading to that reading: an edit, another reading or one foot, its facts measured again, is stale (D129)", () => {
    const named = namedReadings(), bw = all.find((c) => c.clip.id === "STYLE100/Balance_Walk")!, own = bw.clip.contacts!;
    expect([named.size, named.get(bw.clip.id), own.by, (bw.clip.facts as { reading?: string }).reading]).toEqual([45, "planted-quarter", "labelled", "planted-quarter"]);
    expect(checkFacts([bw], { conflicts: {} }).stale).toEqual([]);
    // each edit's facts measured from the edited contacts (withFacts takes labelled contacts as given and keeps the
    // reading's name), so only the reading tells it from the file: the clip's own name, with or without the record's
    const edits: [string, NonNullable<typeof own>][] = [
      ["footL ends 0.1 s sooner", { ...own, footL: own.footL!.map(([a, b]) => [a, b - 0.1] as [number, number]) }],
      ["another reading", withReading(bw.clip, bw.rest, "planted").contacts!],
      ["one foot", { by: "labelled", footL: own.footL! }],
    ];
    for (const [what, contacts] of edits) {
      const clip = withFacts({ ...bw.clip, contacts }, bw.rest);
      expect(JSON.stringify(clip.contacts), what).not.toBe(JSON.stringify(own));
      for (const readings of [named, new Map()]) expect(checkFacts([{ ...bw, clip }], { conflicts: {} }, readings).stale, what).toEqual([`${bw.clip.id}: its contacts aren't the reading "planted-quarter" its facts.reading names (D129)`]);
    }
    // the reading's name edited or dropped: the record disagrees; without the record, the contacts aren't the name's
    const renamed = (reading?: string) => ({ ...bw, clip: { ...bw.clip, facts: { ...(bw.clip.facts as object), reading } as never } });
    expect(checkFacts([renamed("planted")], { conflicts: {} }).stale).toEqual([`${bw.clip.id}: its facts.reading "planted" isn't the reading "planted-quarter" its set's import record names (D129)`]);
    expect(checkFacts([renamed("planted")], { conflicts: {} }, new Map()).stale).toEqual([`${bw.clip.id}: its contacts aren't the reading "planted" its facts.reading names (D129)`]);
    const unnamed = Object.fromEntries(Object.entries(bw.clip.facts as object).filter(([k]) => k !== "reading"));
    expect(checkFacts([{ ...bw, clip: { ...bw.clip, facts: unnamed as never } }], { conflicts: {} }).stale).toEqual([`${bw.clip.id}: its facts.reading null isn't the reading "planted-quarter" its set's import record names (D129)`]);
  });
});
