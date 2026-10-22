// F.13 (D133): a clip's own motion bounds its fit. Under a fixed 30 mm limit, a loop that sways less than that kept
// only its two ends, one pose, a statue; fitted within half its reach it keeps the sway, a clip that reaches twice the
// limit or more is fitted exactly as before, and a still one stays two keys.
import { describe, expect, it } from "vitest";
import { format, type Rest } from "@m3a/core";
import { importSet, readBvh, type Catalog } from "../src/index.ts";
import { clipTol, MOTION_TOL, reach } from "../src/import.ts";
import { tinyBvh } from "./fixtures.ts";

/** The tiny rig standing for two seconds, its upper body swaying `deg` to one side from the spine, back, as far to the
 *  other and back (a loop whose ends meet), at 30 frames a second: 1° moves its hands 15.8 mm, 6° 94.6 mm. */
const sway = (deg: number) =>
  readBvh(
    () =>
      tinyBvh(61, 1 / 30, () => 0, (f, v) => {
        v[6] = deg * Math.sin((2 * Math.PI * f) / 60);
      }),
    ["Sway"],
    30,
  );
const cat: Catalog = { Sway: ["idle loop", "standing, swaying side to side"] };
/** The set a sway imports into, motion-bounded (the default) or at the fixed limit. */
const imported = (deg: number, motion?: false) => importSet([{ id: "TINY", file: "tiny.bvh", ...sway(deg) }], cat, { name: "TINY", credit: "the tiny rig", ...(motion === false ? { motion } : {}) });
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
  it("fits within half the reach, never under 3 mm nor over the set's limit", () => {
    expect(MOTION_TOL).toEqual({ ratio: 0.5, floor: 3 });
    expect([0, 4, 6, 20, 40, 59, 60, 61, 1000].map((r) => clipTol(30, r))).toEqual([3, 3, 3, 10, 20, 29.5, 30, 30, 30]);
    expect(clipTol(10, 15)).toBe(7.5);
    expect(clipTol(30, 20, { ratio: 0.25, floor: 8 })).toBe(8);
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
  it("fits a clip that reaches twice the limit or more exactly as before, and leaves a still one two keys", () => {
    const big = [imported(6), imported(6, false)];
    expect(JSON.stringify(big[0]!.set)).toBe(JSON.stringify(big[1]!.set));
    expect(big.map((o) => [o.report.clips[0]!.tol, o.report.clips[0]!.keys])).toEqual([[30, big[1]!.report.clips[0]!.keys], [30, big[1]!.report.clips[0]!.keys]]);
    const still = imported(0);
    expect([still.set.clips.Sway!.keys.length, frozen(still.set.clips.Sway!.keys), still.report.clips[0]!.tol]).toEqual([2, true, 3]);
    expect(JSON.stringify(still.set)).toBe(JSON.stringify(imported(0, false).set));
  });
});
