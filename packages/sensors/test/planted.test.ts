// Planted defects (WP-3.6): each of the 100 runs in fixtures/planted/runs.json plants its defect into a clean library
// clip again (the same times as written), and the sensors must flag it with its metric at those times: a finding
// within the planted stretch (a sliding foot's slide or skate within 0.1 s of the stance it was planted on, which
// starts and ends within the clip). The false
// positives, findings the plant brought that aren't the planted defect or a consequence it implies, are measured and
// stated (D43), and held to at most 10 runs in 100.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clip as clipNs, format, validate } from "@m3a/core";
import { checks, metrics } from "../src/index.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { plant, type Defect, type Planted } from "../../../tools/plant/plant.ts";

const runs = (JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/planted/runs.json"), "utf8")) as { runs: { clip: string; defect: Defect; seed: number; metric: string; t0: number; t1: number; where?: string }[] }).runs;
const lib = new Map(libraryClips().map((c) => [c.clip.id, c]));
/** The sensors' findings on a planted run, and on the same clip clean, read the same way. */
function measure(p: Planted, clean: (typeof lib extends Map<string, infer V> ? V : never)): { planted: checks.Finding[]; clean: checks.Finding[] } {
  const { clip, rest } = clean;
  if (p.frames) {
    const opts = { loop: clip.loop, id: clip.id, tags: clip.tags };
    return { planted: checks.measure(checks.motionOfFrames(p.frames, rest, opts)).findings, clean: checks.measure(checks.motionOfFrames(clipNs.sampleAll(clip, rest, 60).frames, rest, opts)).findings };
  }
  if (p.mirrorOf) return { planted: metrics(p.clip, rest, { mirrorOf: p.mirrorOf }).findings, clean: metrics(clip, rest, { mirrorOf: format.mirror(clip as never) as never }).findings };
  return { planted: metrics(p.clip, rest).findings, clean: metrics(clip, rest).findings };
}
const same = (a: checks.Finding, b: checks.Finding) => a.metric === b.metric && a.where === b.where && a.t0 <= b.t1 + 0.05 && a.t1 >= b.t0 - 0.05;
/** The metrics that find a defect: a sliding foot shows as its slide (mm) or its skate (cm/s), whichever it reaches. */
const finds = (metric: string) => (metric === "slide" ? ["slide", "skate"] : [metric]);

describe("planted defects", () => {
  it("are 100 runs over 100 clean clips, each defect planted about 10 times, a slide on a stance within the clip", () => {
    expect(runs).toHaveLength(100);
    expect(new Set(runs.map((r) => r.clip)).size).toBe(100);
    // the library's clean clips with a still stance within the clip are few (9): a slide takes each
    const by: Record<string, typeof runs> = {};
    for (const r of runs) (by[r.defect] ??= []).push(r);
    expect([Object.keys(by).length, Math.min(...Object.values(by).map((x) => x.length))]).toEqual([10, 9]);
    // a planted clip is a valid clip with one defect: whole numbers within their ranges (but for the defects that are
    // invalid data, a non-number and events out of order)
    for (const r of runs.filter((x) => x.defect !== "nan" && x.defect !== "eventsOrder")) {
      const c = lib.get(r.clip)!, errors = validate(JSON.parse(JSON.stringify(plant(r.defect, c.clip, c.rest, r.seed).clip))).errors;
      expect(errors.map((e) => `${e.code} ${e.message}`), `${r.clip} ${r.defect}`).toEqual([]);
    }
    for (const r of by.slide!) expect(r.t0 >= 0.1 && r.t1 <= lib.get(r.clip)!.clip.dur - 0.25, `${r.clip} ${r.t0}–${r.t1}`).toBe(true);
  });
  it("are all flagged by their metric, at the times they were planted, and the false positives are stated", () => {
    const missed: string[] = [], extra: Record<string, number> = {};
    let withExtra = 0, withConsequence = 0;
    for (const r of runs) {
      const c = lib.get(r.clip)!, p = plant(r.defect, c.clip, c.rest, r.seed);
      expect([p.t0, p.t1].map((x) => Math.round(x * 1e6) / 1e6), `${r.clip} ${r.defect}: planted where the fixture says`).toEqual([r.t0, r.t1]);
      const f = measure(p, c);
      // found at its times: within the planted stretch, give or take the ramps a plant eases in and out over (0.3 s);
      // a slide's finding is its contact, so within 0.1 s of the stance it was planted on
      const near = r.defect === "slide" ? 0.1 : 0.35;
      const hit = f.planted.filter((x) => finds(r.metric).includes(x.metric) && x.t0 >= r.t0 - near && x.t1 <= r.t1 + near && (!r.where || r.metric === "intersection" || x.where === r.where));
      if (!hit.length) missed.push(`${r.clip} ${r.defect} at ${r.t0}–${r.t1}: ${f.planted.map((x) => `${x.metric} ${x.where ?? ""} ${x.t0.toFixed(2)}–${x.t1.toFixed(2)}`).join(", ") || "nothing found"}`);
      // a finding the clean clip doesn't have, of another metric than the planted one's: a consequence the defect
      // implies (a flipped bent knee bends backwards; a body sunk into the floor takes its knees and hands under it
      // too; a defect lasting to a loop's end breaks its seam), or a false positive
      const brought = f.planted.filter((x) => !finds(r.metric).includes(x.metric) && !f.clean.some((y) => same(x, y)));
      const implied = (x: checks.Finding) => (r.defect === "twistFlip" && x.metric === "jointLimit") || (r.defect === "sink" && x.metric === "bodyPenetration") || ((x.metric === "seam" || x.metric === "seamVelocity") && c.clip.loop);
      if (brought.some(implied)) withConsequence++;
      if (brought.some((x) => !implied(x))) withExtra++;
      for (const x of brought.filter((y) => !implied(y))) extra[`${r.defect} → ${x.metric}`] = (extra[`${r.defect} → ${x.metric}`] ?? 0) + 1;
    }
    console.log(`planted: ${100 - missed.length} of 100 flagged at their times; ${withConsequence} runs with a consequence the defect implies; false positives in ${withExtra} runs (${withExtra}%): ${JSON.stringify(extra)}`);
    expect(missed, missed.join("\n")).toEqual([]);
    expect(withExtra).toBeLessThanOrEqual(10);
  }, 120_000);
});
