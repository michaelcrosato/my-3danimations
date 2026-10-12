// The re-import's choices (WP-5.3, WP-5.8, D66): a repair is held back when it takes the clip more than CLOSE mm
// further from its source on average, past the fit limits, or moves a point more than WORST mm further at worst; a
// clip keeps its re-import unless it fits worse or the sensors judge it worse, and a re-import they judge better may fit
// up to CLOSE mm worse on average, and then WORST mm at worst.
import { describe, expect, it } from "vitest";
import { choose, CLOSE, LIMITS, repairGuard, WORST } from "./import.ts";

describe("a repair", () => {
  it("is kept within CLOSE mm on average and WORST mm at worst, and the fit limits", () => {
    expect(repairGuard([10, 80], [10 + CLOSE, 80 + WORST], ["jitter"])).toBeNull();
    expect(repairGuard([10, 80], [10 + CLOSE + 1, 80], ["jitter"])).toBe(`jitter would take it ${CLOSE + 1} mm further from its source on average`);
    expect(repairGuard([10, 80], [10, 80 + WORST + 1], ["twistFlips", "seam"])).toBe(`twistFlips, seam would move a point ${WORST + 1} mm further from its source at worst`);
    expect(repairGuard([39, 280], [40, LIMITS.clipWorst + 1], ["jitter"])).toBe(`jitter would take it 1 mm further from its source on average, ${LIMITS.clipWorst + 1} mm at worst`);
  });
});

describe("the version a clip keeps", () => {
  it("is the re-import when it fits as close or closer and the sensors judge it no worse", () => {
    expect(choose("warn", "warn", [9, 90], [10, 80])).toEqual(["import", "fits its source closer (10 → 9 mm on average), though further at its worst (80 → 90 mm), and the sensors judge it the same (warn)"]);
    expect(choose("pass", "warn", [10, 80], [10, 80])[0]).toBe("import");
  });
  it("is the migrated one when the re-import fits worse, unless the sensors judge it better within CLOSE and WORST", () => {
    expect(choose("warn", "warn", [11, 80], [10, 80])).toEqual(["migrated", "the re-import fits its source worse (11 mm on average against 10)"]);
    expect(choose("pass", "fail", [10 + CLOSE, 80 + WORST], [10, 80])).toEqual(["import", `fits its source within ${CLOSE} mm (10 → ${10 + CLOSE} mm on average), though further at its worst (80 → ${80 + WORST} mm), and the sensors judge it better (pass)`]);
    expect(choose("pass", "fail", [10 + CLOSE + 1, 80], [10, 80])[1]).toMatch(/more than 2 mm worse though the sensors judge it better/);
    expect(choose("pass", "fail", [11, 80 + WORST + 1], [10, 80])).toEqual(["migrated", `the re-import fits its source worse (11 mm on average against 10, ${80 + WORST + 1} mm at worst against 80)`]);
  });
  it("is the migrated one when the sensors judge the re-import worse", () => {
    expect(choose("fail", "warn", [8, 70], [10, 80])).toEqual(["migrated", "the sensors judge the re-import worse (warn → fail)"]);
  });
});
