// Tests for the conformance runner: the vectors match their manifest, every tier loads with its expected shape, and
// tier 1b's glTF packs to the very .glb the oracle read (its SHA-256 is recorded in tier 1a).
import { describe, expect, it } from "vitest";
import { firstDiff, loadTier1a, loadTier2, loadTier3, sha256, tier1bRigGlb, tier1bText, tier2Sets, verifyManifest } from "./vectors.ts";

describe("the conformance vectors", () => {
  it("match their manifest", () => {
    expect(verifyManifest()).toEqual([]);
  });
  it("tier 1a holds captures of 36 body points and the oracle's fits", () => {
    for (const name of ["rig", "cmu-09_02"] as const) {
      const v = loadTier1a(name);
      expect(v.points).toHaveLength(36);
      const fitted = Object.values(v.clips).filter((c) => c.fit);
      expect(fitted.length).toBeGreaterThanOrEqual(2);
      for (const c of Object.values(v.clips)) {
        expect(c.capture.data).toHaveLength(c.capture.n);
        for (const row of c.capture.data) expect(row).toHaveLength(108);
      }
    }
    expect(Object.keys(loadTier1a("rig").clips)).toEqual(["A_TPose", "Wave_Loop", "Step_RM"]);
    expect(loadTier1a("cmu-09_02").log).toContain("Run_Loop: a 0.75 s cycle at 0.20-0.95 s of 09_02 (its seam is off by 33 mm)");
  });
  it("tier 1b packs to the .glb the oracle read", () => {
    expect(sha256(tier1bRigGlb())).toBe(loadTier1a("rig").glbSha256);
    expect(tier1bText("cmu/09.asf")).toMatch(/:bonedata/);
  });
  it("tier 2 covers the 325 curated clips at every key", () => {
    const sets = tier2Sets();
    expect(sets).toEqual(["CMU", "MESH2MOTION", "QUATERNIUS"]);
    let clips = 0;
    for (const s of sets) {
      const v = loadTier2(s);
      for (const c of Object.values(v.clips)) {
        clips++;
        expect(v.bodies[c.restSrc]).toBeDefined();
        expect(c.between).toHaveLength(3);
        for (const k of [...c.keys, ...c.between]) expect(k.at).toHaveLength(108);
        expect(c.mirrorTwiceSame && c.parseTextSame).toBe(true);
      }
    }
    expect(clips).toBe(325);
  });
  it("tier 3 holds at least six bodies of different proportions", () => {
    const bodies = Object.values(loadTier3().bodies);
    expect(bodies.length).toBeGreaterThanOrEqual(6);
    const shapes = new Set(bodies.map((b) => JSON.stringify([b.rest.H0, b.rest.up, b.rest.thigh, b.rest.clav, b.rest.spine])));
    expect(shapes.size).toBe(bodies.length);
  });
});

describe("comparisons", () => {
  it("bit for bit tells -0 from 0; a tolerance does not", () => {
    expect(firstDiff([1, -0], [1, 0])).toEqual({ index: 1, ours: -0, want: 0 });
    expect(firstDiff([1, -0], [1, 0], 0.001)).toBeNull();
    expect(firstDiff([1.0004], [1], 0.001)).toBeNull();
    expect(firstDiff([1.002], [1], 0.001)?.index).toBe(0);
  });
});
