// Tests for the vector tools: the deterministic JSON writer keeps -0 and round-trips numbers, and the rig builder's
// .glb packing agrees with the conformance runner's.
import { describe, expect, it } from "vitest";
import { packGlb, sha256 } from "../../spec/conformance/runner/vectors.ts";
import { num, stringify } from "./json.ts";
import { glb, rigGltf } from "./rig.ts";

describe("the vectors' JSON", () => {
  it("writes the shortest round-trip number and keeps -0", () => {
    expect(num(-0)).toBe("-0");
    expect(num(0.1 + 0.2)).toBe("0.30000000000000004");
    expect(Object.is(JSON.parse(stringify([-0]))[0], -0)).toBe(true);
    expect(() => num(NaN)).toThrow(/finite/);
  });
  it("puts primitive arrays on one line and is stable", () => {
    const v = { a: [1, 2], b: { c: [[1], [2]] } };
    expect(stringify(v)).toBe(stringify(JSON.parse(stringify(v))));
    expect(stringify(v)).toContain('"a": [1,2]');
  });
});

describe("the tiny rig", () => {
  it("packs to the same bytes as the runner's packer", () => {
    const g = rigGltf();
    expect(sha256(glb(g))).toBe(sha256(packGlb(g.json, g.bin)));
  });
  it("rescales segments but keeps the feet on the floor", () => {
    const pelvisY = (p: object) => ((rigGltf(p).json.nodes as { name: string; translation: number[] }[]).find((n) => n.name === "pelvis")!.translation[1]);
    expect(pelvisY({})).toBe(0.95);
    expect(pelvisY({ legs: 2 })).toBeCloseTo(0.06 + 1.78, 12);
  });
});
