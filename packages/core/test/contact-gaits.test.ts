// Contacts on 100STYLE's runs and backward gaits (WP-2.5's test, WP-5.3's sets): on every looping run, backward walk
// and backward run, a planted foot slides at most 10 mm per contact. The library's locomotion loops are split over
// contact.test.ts, this file, contact-sidesteps.test.ts and contact-siderun.test.ts, so they run side by side.
import { describe, expect, it } from "vitest";
import { library, locomotionSlides, SAMPLE } from "./contact-data.ts";

describe("planted feet don't slide", () => {
  it("on every locomotion loop (every third in T1) of 100STYLE's runs, backward walks and backward runs: at most 10 mm per contact (unplanted, they slide up to tens of mm)", () => {
    const { clips, worst, at, worstFree } = locomotionSlides(library((set) => ["STYLE100_RUN", "STYLE100_BACK", "STYLE100_BACKRUN"].includes(set)), 1);
    expect(clips).toBeGreaterThan(250 / SAMPLE);
    expect(worst, at).toBeLessThanOrEqual(10);
    expect(worstFree).toBeGreaterThan(30);
  }, 90_000);
});
