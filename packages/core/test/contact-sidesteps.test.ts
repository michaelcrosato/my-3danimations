// Contacts on 100STYLE's sidesteps (WP-2.5's test, WP-5.3's set): on every looping sidestep, each way, a planted foot
// slides at most 10 mm per contact. One of the files the library's locomotion loops are split over (contact-data.ts).
import { describe, expect, it } from "vitest";
import { library, locomotionSlides, SAMPLE } from "./contact-data.ts";

describe("planted feet don't slide", () => {
  it("on every locomotion loop (every third in T1) of 100STYLE's sidesteps: at most 10 mm per contact (unplanted, they slide up to tens of mm)", () => {
    const { clips, worst, at, worstFree } = locomotionSlides(library((set) => set === "STYLE100_SIDE"), 1);
    expect(clips).toBeGreaterThan(150 / SAMPLE);
    expect(worst, at).toBeLessThanOrEqual(10);
    expect(worstFree).toBeGreaterThan(30);
  }, 90_000);
});
