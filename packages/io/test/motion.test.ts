// F.13 (D133): a clip's own motion bounds its fit. Under a fixed 30 mm limit, a loop that sways less than that kept
// only its two ends, one pose, a statue; fitted within half of how far it strays from the in-between of its ends (a
// loop's reach) it keeps the sway, also when it leans as it sways, a clip that reaches twice the limit or more is
// fitted exactly as before, and a still one stays two keys.
import { describe, expect, it } from "vitest";
import { format, type Rest } from "@m3a/core";
import { importSet, readBvh, type Catalog } from "../src/index.ts";
import { clipTol, fitLimit, MOTION_TOL, offLine, reach } from "../src/import.ts";
import { tinyBvh } from "./fixtures.ts";

/** The tiny rig standing for two seconds, its upper body swaying `deg` to one side from the spine, back, as far to the
 *  other and back (a loop whose ends meet), at 30 frames a second: 1° moves its hands 15.8 mm, 6° 94.6 mm; leaning
 *  `lean` degrees further over the two seconds as it sways (its ends apart). */
const sway = (deg: number, lean = 0) =>
  readBvh(
    () =>
      tinyBvh(61, 1 / 30, () => 0, (f, v) => {
        v[6] = lean * (f / 60) + deg * Math.sin((2 * Math.PI * f) / 60);
      }),
    ["Sway"],
    30,
  );
const cat: Catalog = { Sway: ["idle loop", "standing, swaying side to side"] };
/** The set a sway imports into, motion-bounded (the default) or at the fixed limit. */
const imported = (deg: number, motion?: false, opts: { lean?: number; tol?: number; tags?: string } = {}) =>
  importSet([{ id: "TINY", file: "tiny.bvh", ...sway(deg, opts.lean) }], opts.tags ? { Sway: [opts.tags, cat.Sway![1] as string] } : cat, { name: "TINY", credit: "the tiny rig", ...(motion === false ? { motion } : {}), ...(opts.tol ? { tol: opts.tol } : {}) });
/** The farthest a body point of the imported clip gets from the capture's (mm), over the points named. */
function missed(out: ReturnType<typeof imported>, cap: format.Capture, names: readonly string[]): number {
  const c = out.set.clips.Sway!, rest = out.set.sources.TINY!.rest as Rest, k = format.P * 3, X = new Float32Array(k), Y = new Float32Array(k);
  let far = 0;
  for (let f = 0; f < cap.n; f++) {
    format.capSample(cap, f / cap.fps, X);
    format.pose(rest, c as never, f / cap.fps, Y);
    for (const i of names.map((n) => format.POINTS.indexOf(n) * 3)) far = Math.max(far, Math.hypot(X[i]! - Y[i]!, X[i + 1]! - Y[i + 1]!, X[i + 2]! - Y[i + 2]!));
  }
  return far;
}
/** How far an imported clip moves as decoded: the farthest any body point gets from where it starts (mm). */
function decodedReach(out: ReturnType<typeof imported>): number {
  const c = out.set.clips.Sway!, rest = out.set.sources.TINY!.rest as Rest, k = format.P * 3, X0 = format.pose(rest, c as never, 0, new Float32Array(k)), X = new Float32Array(k);
  let far = 0;
  for (let f = 0; f <= 60; f++) far = Math.max(far, format.error(format.pose(rest, c as never, f / 30, X), X0));
  return far;
}
/** Whether every key of a clip is one pose (its time aside). */
const frozen = (keys: readonly unknown[]) => keys.every((k) => JSON.stringify({ ...(k as object), t: 0 }) === JSON.stringify({ ...(keys[0] as object), t: 0 }));

describe("a clip's own motion bounds its fit (F.13)", () => {
  it("measures a capture's reach: the farthest any body point gets from the first frame's", () => {
    const k = format.P * 3, data = new Float32Array(3 * k), at = format.POINTS.indexOf("headTop") * 3;
    data[k + at + 2] = 12;
    data[2 * k + at] = -9;
    expect([reach({ n: 3, data }), reach({ n: 1, data }), reach(sway(0).clips.Sway!)]).toEqual([12, 0, 0]);
    expect([reach(sway(1).clips.Sway!), reach(sway(6).clips.Sway!)].map((r) => Math.round(r * 10) / 10)).toEqual([15.8, 94.6]);
  });
  it("measures how far a capture strays from the in-between of its ends: a loop's reach, a steady lean's next to nothing", () => {
    const k = format.P * 3, data = new Float32Array(3 * k), at = format.POINTS.indexOf("headTop") * 3;
    data[k + at] = -10;
    data[2 * k + at] = 10;
    // away and back past where it started: 15 mm off the in-between, 10 mm from the first frame at most
    expect([offLine({ n: 3, data }), reach({ n: 3, data }), offLine({ n: 2, data })]).toEqual([15, 10, 0]);
    expect(offLine(sway(1).clips.Sway!)).toBe(reach(sway(1).clips.Sway!));
    const lean = sway(0, 3).clips.Sway!;
    expect([Math.round(reach(lean) * 10) / 10, offLine(lean) < 1]).toEqual([47.3, true]);
    expect(Math.round(offLine(sway(1, 3).clips.Sway!) * 10) / 10).toBe(15.8);
  });
  it("fits within half the reach, never under 3 mm nor over the set's limit", () => {
    expect(MOTION_TOL).toEqual({ ratio: 0.5, floor: 3 });
    expect([0, 4, 6, 20, 40, 59, 60, 61, 1000].map((r) => clipTol(30, r))).toEqual([3, 3, 3, 10, 20, 29.5, 30, 30, 30]);
    expect(clipTol(10, 15)).toBe(7.5);
    expect(clipTol(30, 20, { ratio: 0.25, floor: 8 })).toBe(8);
    // of how far it strays from the in-between of its ends, or of its reach where that is less; the set's limit for a
    // clip that reaches twice it
    const k = format.P * 3, data = new Float32Array(3 * k), at = format.POINTS.indexOf("headTop") * 3;
    data[k + at] = -10;
    data[2 * k + at] = 10;
    expect([fitLimit({ n: 3, data }, 30), fitLimit(sway(1).clips.Sway!, 30), fitLimit(sway(1, 3).clips.Sway!, 30), fitLimit(sway(0, 3).clips.Sway!, 30), fitLimit(sway(6).clips.Sway!, 30)].map((r) => Math.round(r * 10) / 10)).toEqual([5, 7.9, 7.9, 3, 30]);
  });
  it("keeps a 16 mm sway that the fixed 30 mm froze into one pose", () => {
    const fixed = imported(1, false), own = imported(1), r = own.report.clips[0]!;
    // before: the two ends of the loop, one pose, missing the sway by all of it
    expect([fixed.set.clips.Sway!.keys.length, frozen(fixed.set.clips.Sway!.keys), decodedReach(fixed), fixed.report.clips[0]!.tol]).toEqual([2, true, 0, 30]);
    expect(fixed.report.clips[0]!.max).toBeGreaterThan(15);
    // now: a few keys within half its reach, swaying as far as the capture does
    expect([r.tol, r.keys > 2 && r.keys < 8, frozen(own.set.clips.Sway!.keys)]).toEqual([reach(sway(1).clips.Sway!) / 2, true, false]);
    expect(decodedReach(own)).toBeGreaterThan(0.75 * 15.8);
    expect(decodedReach(own)).toBeLessThan(1.5 * 15.8);
    expect(r.max).toBeLessThan(fixed.report.clips[0]!.max / 2);
  });
  it("keeps the sway of a clip that leans as it sways, which a limit from its reach alone took for the lean's in-between", () => {
    const cap = sway(1, 3).clips.Sway!, byReach = imported(1, false, { lean: 3, tol: clipTol(30, reach(cap)), tags: "idle once" }), own = imported(1, undefined, { lean: 3, tags: "idle once" });
    const fists = ["fistL", "fistR"];
    // from the reach (47 mm): its two ends, the lean without the sway, the fists missing it by all of it
    expect([Math.round(byReach.report.clips[0]!.tol * 10) / 10, byReach.set.clips.Sway!.keys.length, Math.round(missed(byReach, cap, fists) * 10) / 10]).toEqual([23.7, 2, 15.8]);
    // from how far it strays (16 mm): a few keys, the fists within the limit of the capture's (core's encoder may yet
    // bend a nearly straight elbow a few degrees in a key, D135)
    expect([own.report.clips[0]!.tol, own.set.clips.Sway!.keys.length > 2]).toEqual([offLine(cap) / 2, true]);
    expect(missed(own, cap, fists)).toBeLessThan(offLine(cap) / 2);
    // a steady lean keeps its two keys
    expect(imported(0, undefined, { lean: 3, tags: "idle once" }).set.clips.Sway!.keys.length).toBe(2);
  });
  it("fits a clip that reaches twice the limit or more exactly as before, and leaves a still one two keys", () => {
    const big = [imported(6), imported(6, false)];
    expect(JSON.stringify(big[0]!.set)).toBe(JSON.stringify(big[1]!.set));
    expect(big.map((o) => [o.report.clips[0]!.tol, o.report.clips[0]!.keys])).toEqual([[30, big[1]!.report.clips[0]!.keys], [30, big[1]!.report.clips[0]!.keys]]);
    const still = imported(0);
    expect([still.set.clips.Sway!.keys.length, frozen(still.set.clips.Sway!.keys), still.report.clips[0]!.tol]).toEqual([2, true, 3]);
    expect(JSON.stringify(still.set)).toBe(JSON.stringify(imported(0, false).set));
  });
});
