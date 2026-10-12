// Library QA (WP-5.8): a clip's verdict as its writer records it (pass, or baselined with a reason that names the level
// and the metrics past it, then the hand reason for a metric, its set's, the warn level's, or how it stands to its
// source); the check names a recorded verdict the sensors no longer give and a reason whose finding is gone; the census
// reads a category from the tags and counts copies by `orig`, re-exports and near-duplicates by pose once; the record of
// the distributions may only improve, and a floor short is named.
import { describe, expect, it } from "vitest";
import { metrics, checks, type Report } from "@m3a/sensors";
import type { Clip } from "@m3a/core";
import { categoryOf, census, type Census } from "./census.ts";
import { againstRecord, checkVerdicts, floorsMissed, recordOf, type Recorded } from "./library.ts";
import { libraryClips, qa, sample, type LibraryClip } from "./qa.ts";
import { qualityOf, reasonOf, type QaReasons } from "./verdict.ts";

const lib = sample(libraryClips(), 24);
const reasons: QaReasons = { warn: "short of every fail level", sets: { SOME_SET: "the set's reason" }, clips: { "A_SET/Hang": { penetration: "it hangs" } } };
const finding = (metric: string, level: "warn" | "fail") => ({ metric, level }) as unknown as checks.Finding;
const report = (verdict: Report["verdict"], f: checks.Finding[]) => ({ verdict, findings: f }) as unknown as Report;
const stub = (id: string, method = "captured") => ({ id, provenance: { method }, quality: { fit: [12, 80], qa: "unchecked", qaVersion: "none" } }) as unknown as Clip;

describe("a clip's recorded verdict", () => {
  it("is pass when the sensors pass it, read with their revision, its fit kept", () => {
    const passing = lib.find((c) => metrics(c.clip, c.rest).verdict === "pass")!;
    expect(qualityOf(passing.clip, passing.rest, reasons)).toEqual({ fit: passing.clip.quality.fit, qa: "pass", qaVersion: checks.QA_VERSION });
  });
  it("is baselined with a reason: the level and the metrics past it, then why", () => {
    const r = report("fail", [finding("twistFlip", "fail"), finding("penetration", "fail"), finding("pop", "warn")]);
    // a hand reason for one metric, the source for the rest
    expect(reasonOf(stub("A_SET/Hang"), r, reasons, { unrepaired: "no step makes it better" })).toBe("fail on penetration, twistFlip: penetration: it hangs; twistFlip: as captured, fitted within 12 mm of it on average; the sensors' fix: no step makes it better");
    // its set's reason, ahead of the source's
    expect(reasonOf(stub("SOME_SET/X"), r, reasons)).toBe("fail on penetration, twistFlip: the set's reason");
    // a warn: short of every fail level
    expect(reasonOf(stub("OTHER/X"), report("warn", [finding("jitter", "warn")]), reasons)).toBe("warn on jitter: short of every fail level");
    // keyed, repaired and still failing; the migrated version kept
    expect(reasonOf(stub("OTHER/X", "keyed"), report("fail", [finding("pop", "fail")]), reasons, { repaired: ["jitter"] })).toBe("fail on pop: as keyed in its source, fitted within 12 mm of it on average; repaired (jitter), and still past it");
    expect(reasonOf(stub("OTHER/X"), report("fail", [finding("pop", "fail")]), reasons, { migrated: "the sensors judge the re-import worse (warn → fail)" })).toMatch(/; kept as migrated: the sensors judge the re-import worse \(warn → fail\)$/);
    const flagged = lib.find((c) => metrics(c.clip, c.rest).verdict !== "pass")!, q = qualityOf(flagged.clip, flagged.rest, reasons);
    expect([q.qa, q.baseline]).toEqual(["baselined", expect.stringMatching(/^(warn|fail) on \w+/)]);
  });
  it("is checked against the sensors: a verdict they no longer give, another revision, a reason whose finding is gone", () => {
    const rows = qa(lib);
    expect(checkVerdicts(lib, rows, { ...reasons, clips: {} })).toEqual({ problems: [], gone: [] });
    const i = rows.findIndex((r) => r.verdict !== "pass"), j = rows.findIndex((r) => r.verdict === "pass");
    const edited = lib.map((c, k): LibraryClip => (k === i ? { ...c, clip: { ...c.clip, quality: { ...c.clip.quality, qa: "pass", baseline: undefined } } } : k === j ? { ...c, clip: { ...c.clip, quality: { ...c.clip.quality, qaVersion: "m3a-sensors@0" } } } : c));
    const r = checkVerdicts(edited, rows, reasons);
    expect(r.problems.sort()).toEqual([`${lib[j]!.clip.id}: its verdict was read with m3a-sensors@0, not ${checks.QA_VERSION}`, `${lib[i]!.clip.id}: recorded pass, the sensors give ${rows[i]!.verdict}`].sort());
    expect(r.gone).toEqual(["A_SET/Hang penetration"]);
  });
});

describe("the census", () => {
  it("reads a clip's category from its tags, the first that takes it", () => {
    expect(["walk hurt", "hurt", "sword idle", "throw sport", "jump run", "idle style", "reference"].map((t) => categoryOf(t.split(" ")))).toEqual(["locomotion", "reactions", "combat", "work", "traversal", "idles", "other"]);
  });
  it("counts a copy by orig, a re-export and a near-duplicate by pose once, and the CC0 pack's apart", () => {
    const [a, b] = [lib[0]!, lib.find((c) => c.clip.dur > lib[0]!.clip.dur * 1.5 || c.clip.dur < lib[0]!.clip.dur / 1.5)!];
    const as = (c: LibraryClip, set: string, edit: (x: Clip) => Clip = (x) => x): LibraryClip => ({ ...c, set, clip: edit({ ...c.clip, id: `${set}/${c.clip.id.split("/")[1]}` }) });
    const copy = as(a, "COPIES", (x) => ({ ...x, provenance: { ...x.provenance, orig: a.clip.id } }));
    const exported = as(a, "EXPORTS");
    const near = as(a, "NEAR", (x) => ({ ...x, id: "NEAR/Other_Name", provenance: { ...x.provenance, src: "ELSEWHERE" }, keys: x.keys.map((k) => ({ ...k, hips: [k.hips[0]! + 0.5, k.hips[1]!, k.hips[2]!] })) as never }));
    const c = census([a, b, copy, exported, near], new Set(["NEAR"]));
    expect([c.clips, c.unique, c.cc0]).toEqual([5, 2, 1]);
    expect(c.same[copy.clip.id]!.why).toMatch(/a copy of .* \(its orig\)/);
    expect(c.same[exported.clip.id]!.why).toBe(`the same animation of ${a.clip.provenance.src} as ${a.clip.id}`);
    // the near-duplicate in the CC0 set is the one that counts
    expect([c.same["NEAR/Other_Name"], c.same[a.clip.id]!.as]).toEqual([undefined, "NEAR/Other_Name"]);
  });
  it("names a floor short", () => {
    const c = { unique: 900, categories: Object.fromEntries(["reactions", "combat", "traversal", "locomotion", "work", "gestures", "idles"].map((k) => [k, { unique: k === "combat" ? 10 : 500 }])) } as unknown as Census;
    expect(floorsMissed(c)).toEqual(["900 unique motions, G5 asks 1000", "combat: 10 unique, its floor 60"]);
  });
});

describe("the recorded distributions", () => {
  it("may only improve: more fails or a higher spread is worse, the opposite better", () => {
    const now = recordOf(qa(lib)), worse: Recorded = { ...now, verdicts: { ...now.verdicts, fail: now.verdicts.fail + 1 }, metrics: { ...now.metrics, slide: { ...now.metrics.slide!, max: now.metrics.slide!.max / 2 } } };
    expect(againstRecord(now, now)).toEqual({ worse: [], better: [] });
    expect(againstRecord(now, worse).worse).toEqual([`${now.verdicts.fail + 1} clips fail, ${now.verdicts.fail} recorded`, `${now.verdicts.warn + now.verdicts.fail + 1} clips flagged, ${now.verdicts.warn + now.verdicts.fail} recorded`]);
    expect(againstRecord(worse, now).worse).toEqual([`slide max ${now.metrics.slide!.max / 2} → ${now.metrics.slide!.max}`]);
  });
});
