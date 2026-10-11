// Predicates (WP-3.3): each form parses and holds where the motion does what it says; each fails where it doesn't,
// with a repair that names the times and the change; text that doesn't parse names the forms that would.
import { describe, expect, it } from "vitest";
import { measureFacts, type Key } from "@m3a/core";
import { checks, predicates } from "../src/index.ts";
import { testClip } from "./raster-pose.ts";

const { clip: walk, R } = testClip("Walk_Loop");
// where the walk's feet stand, as the metrics measure it
const contacts = checks.motionOf(walk, R).contacts, L = contacts.footL![0]!;
const one = (text: string, clip: Parameters<typeof predicates.check>[1] = walk) => predicates.check(text, clip, R)[0]!;

describe("parsing", () => {
  it("reads every form, one a line or ;-separated, and skips comments", () => {
    const p = predicates.parse("footL planted 0.33–0.60 s, slide < 10 mm; footR free 0.2-0.4 s\n# a comment\nhit within 1 frame of strike\npelvis below 50% 0.4–0.55 s\nheadTop above 1500 mm at 0.5 s\njitter < 5 mm\nno pop");
    expect(p.map((x) => x.kind)).toEqual(["planted", "free", "within", "height", "height", "compare", "none"]);
    expect(p[0]).toMatchObject({ end: "footL", t0: 0.33, t1: 0.6, slide: 10 });
    expect(p[3]).toMatchObject({ point: "pelvis", above: false, value: 50, unit: "%", t0: 0.4, t1: 0.55 });
    expect(p[4]).toMatchObject({ t0: 0.5, t1: 0.5 });
    expect(p[2]).toMatchObject({ event: "hit", of: "strike", tol: 1, unit: "frame" });
  });
  it("names what it can't read and the forms that would", () => {
    expect(() => predicates.parse("tail planted 0.1–0.2 s")).toThrow(/"tail" isn't an end/);
    expect(() => predicates.parse("nose below 50%")).toThrow(/isn't a body point/);
    expect(() => predicates.parse("wobble < 3")).toThrow(/isn't a metric/);
    expect(() => predicates.parse("the feet look fine")).toThrow(/Write one of: "footL planted/);
    expect(() => predicates.parse("slide < 3 furlongs")).toThrow(/"furlongs" isn't a unit slide is measured in \(mm, cm, m\)/);
    for (const back of ["footL planted 0.6–0.3 s", "footR free 0.6-0.3 s", "pelvis below 50% 0.6–0.3 s"]) expect(() => predicates.parse(back), back).toThrow(/runs backwards/);
  });
  it("reads a value in its metric's unit, or one that converts to it", () => {
    const [a, b, c, d, e] = predicates.parse("speed < 500 mm/s; skate < 30 mm/s; pop < 3 m/s; slide < 2 cm; twistFlip < 90");
    expect([a, b, c, d, e].map((p) => p!.kind === "compare" && [p.value, p.unit])).toEqual([[0.5, "m/s"], [3, "cm/s"], [3000, "mm/s"], [20, "mm"], [90, "°"]]);
  });
});

describe("checking, and repairs that say what to change", () => {
  it("planted: where the foot stands on the floor, not where the clip's labels say", () => {
    // labelled planted the whole second, lifted 300 mm at 0.3–0.6 s
    const { clip: idle } = testClip("Idle_Loop"), key = (t: number, up: number): Key => ({ ...structuredClone(idle.keys[0]!), t, hips: [idle.keys[0]!.hips[0]!, idle.keys[0]!.hips[1]!, idle.keys[0]!.hips[2]! + up] });
    const lifted = { ...idle, id: "lifted", loop: false, dur: 1, contacts: { by: "labelled" as const, footL: [[0, 1]] as [number, number][] }, keys: [key(0, 0), key(0.25, 0), key(0.3, 35), key(0.6, 35), key(0.65, 0), key(1, 0)] };
    const o = one("footL planted 0.3–0.6 s, slide < 10 mm", lifted);
    expect([o.ok, o.repair]).toEqual([false, expect.stringMatching(/^footL is not planted at 0\.30–0\.60 s \(it is 3\d\d mm up\): lower it to the floor there/)]);
  });
  it("planted and free: hold inside a contact, fail outside it naming the contact's times", () => {
    expect(one(`footL planted ${(L[0] + 0.05).toFixed(2)}–${(L[1] - 0.05).toFixed(2)} s`).ok).toBe(true);
    const out = one(`footL planted ${(L[0] + 0.05).toFixed(2)}–${(L[1] + 0.1).toFixed(2)} s`);
    expect(out.ok).toBe(false);
    // just after it lifts, the foot is still low, but swinging forward
    expect(out.repair).toBe("footL is not planted at 0.82–0.92 s (it is on the floor but moves as fast as a swing): hold it still there, or expect it planted 0.00–0.82 s");
    expect(one(`footL planted ${(L[0] + 0.05).toFixed(2)}–${(L[1] + 0.3).toFixed(2)} s`).repair).toMatch(/^footL is not planted at 0\.82–1\.12 s \(it is \d+ mm up\): lower it to the floor there/);
    expect(one(`footR free ${(L[0] + 0.05).toFixed(2)}–${(L[0] + 0.15).toFixed(2)} s`).ok).toBe(contacts.footR!.every(([a, b]) => b < L[0] + 0.05 || a > L[0] + 0.15));
    const both = one(`footL free ${(L[0] + 0.05).toFixed(2)}–${(L[0] + 0.15).toFixed(2)} s`);
    expect([both.ok, both.repair]).toEqual([false, expect.stringMatching(/footL is planted at .* s: lift it off the floor there/)]);
  });
  it("planted with a slide bound: measures the contact's slide and says how to fix it", () => {
    const span = `${(L[0] + 0.05).toFixed(2)}–${(L[1] - 0.05).toFixed(2)} s`;
    expect(one(`footL planted ${span}, slide < 1000 mm`).ok).toBe(true);
    const tight = one(`footL planted ${span}, slide < 0.5 mm`);
    expect(tight.repair).toMatch(/slides \d+ mm over .*\(want under 0\.5\): hold it still while planted \(fix: bake foot locks\)/);
  });
  it("within: an event on the strike holds; a late one says where to move it", () => {
    const { clip: punch } = testClip("Punch_Jab"), strike = measureFacts(punch, R).strike![0]!;
    expect(one("hit within 1 frame of strike", { ...punch, events: [{ t: strike, name: "hit" }] }).ok).toBe(true);
    const late = one("hit within 1 frame of strike", { ...punch, events: [{ t: strike + 0.1, name: "hit" }] });
    expect(late.repair).toBe(`move "hit" to ${strike.toFixed(2)} s: it is 3.0 frames after the strike`);
    expect(one("hit within 1 frame of strike", punch).repair).toBe('add an event "hit" at the strike');
  });
  it("height: a point above or below a level, in mm or % of hip height, at a time or over an interval", () => {
    expect(one("pelvis above 50%").ok).toBe(true);
    const low = one("pelvis below 50% 0.2–0.4 s");
    expect(low.repair).toMatch(/^pelvis is up at \d+% of hip height at 0\.2\d–0\.40 s \(want below 50%\): lower it there$/);
    expect(one("headTop above 100 mm at 0.5 s").ok).toBe(true);
  });
  it("compare and none: any metric, speed and travel; a failure carries the metric's repair", () => {
    expect(one("seam < 1 mm").ok).toBe(true);
    expect(one("speed > 0.5 m/s").ok).toBe(true);
    expect(one("travel > 0.5").ok).toBe(true);
    const flip = one("twistFlip < 90");
    expect(flip.repair).toMatch(/^twistFlip is \d+\.\d\d ° \(want < 90 °\): unwrap the twists \(fix: repair twist flips\)$/);
    // the walk goes about 1.08 m/s: under 5 km/h and 2 m/s, not under 500 mm/s
    expect(["speed < 2 m/s", "speed < 5 km/h", "speed < 500 mm/s"].map((t) => one(t).ok)).toEqual([true, true, false]);
    expect(one("speed < 500 mm/s").repair).toMatch(/^speed is 1\.\d\d m\/s \(want < 0\.5 m\/s\)/);
    // the walk's seam is 0: not under 0, but at most 0
    expect([one("seam < 0 mm").ok, one("seam <= 0 mm").ok]).toEqual([false, true]);
    expect(one("no nan").ok).toBe(true);
    const ev = one("no events", { ...walk, events: [{ t: 0.9, name: "b" }, { t: 0.3, name: "a" }] });
    expect([ev.ok, ev.repair]).toEqual([false, expect.stringContaining("comes before the event listed above it")]);
  });
});
