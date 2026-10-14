// Conformance tier 1b (spec/conformance/tiers.md): the readers. @m3a/io reads the tiny rig's .glb, the Rigify rig's
// and CMU take 09_02 into the captured body points and rest of tier 1a bit for bit, as my-3d2dge's anim-import.mjs and
// asf-amc.mjs did: every value of every frame (as float32), the root's travel, each clip's length, loop and take, the
// rest measured from them, the loop's log line, and the Rigify rig's mannequin look from its skinned mesh.
import { skeleton } from "@m3a/core";
import { gltfToGlb, parseGlb, readCmu, readGltf, type Capture } from "@m3a/io";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firstDiff, loadTier1a, sha256, tier1bRigGlb, tier1bText, VECTORS } from "./runner/vectors.ts";

/** Every number in two JSON-like values the same, -0 and 0 told apart; the first path that differs, or null. */
function deepDiff(a: unknown, b: unknown, path = ""): string | null {
  if (typeof a === "number" && typeof b === "number") return Object.is(a, b) ? null : `${path}: ${a} vs ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: ${a.length} vs ${b.length} items`;
    for (let i = 0; i < a.length; i++) {
      const d = deepDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${path}: keys ${ka.join(",")} vs ${kb.join(",")}`;
    for (const k of ka) {
      const d = deepDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
}

/** A clip's capture against the oracle's: frames, travel, length, loop and take, bit for bit. */
function sameCapture(got: Capture, want: ReturnType<typeof loadTier1a>["clips"][string]["capture"]): void {
  expect([got.n, got.dur, got.loop, got.fps, got.take]).toEqual([want.n, want.dur, want.loop, want.fps, want.take]);
  expect(firstDiff(got.data, want.data.flat()), "every body point of every frame").toBeNull();
  if (want.move === null) expect(got.move).toBeNull();
  else expect(firstDiff(got.move!, want.move), "the root's travel").toBeNull();
}

describe("tier 1b: the readers", () => {
  it("the tiny rig's .glb, packed from rig.gltf, is the file the oracle read", () => {
    const want = loadTier1a("rig").glbSha256;
    expect(sha256(tier1bRigGlb())).toBe(want);
    // @m3a/io packs it the same way
    expect(sha256(gltfToGlb(readFileSync(join(VECTORS, "tier1b/rig.gltf"), "utf8")))).toBe(want);
  });
  it("reads the tiny rig's clips and rest bit for bit like anim-import.mjs", () => {
    const v = loadTier1a("rig"), lib = readGltf(parseGlb(tier1bRigGlb()), { fps: 30 });
    expect(lib.rig).toBe("unreal");
    expect(Object.keys(lib.clips)).toEqual(Object.keys(v.clips));
    for (const [name, c] of Object.entries(v.clips)) sameCapture(lib.clips[name]!, c.capture);
    expect(deepDiff(skeleton.measure(lib.clips, v.restClip), v.rest)).toBeNull();
  });
  it("reads the Rigify rig bit for bit like anim-import.mjs: its skinned mesh, every accessor form, STEP and scale tracks, a turned and scaled root, and the look", () => {
    const v = JSON.parse(readFileSync(join(VECTORS, "tier1b/rigify-expected.json"), "utf8")) as { glbSha256: string; rig: string; rest: unknown; body: unknown; clips: Record<string, { capture: ReturnType<typeof loadTier1a>["clips"][string]["capture"] }> };
    const glb = gltfToGlb(readFileSync(join(VECTORS, "tier1b/rigify.gltf"), "utf8"));
    expect(sha256(glb)).toBe(v.glbSha256);
    const lib = readGltf(parseGlb(glb), { fps: 30 });
    expect([lib.rig, lib.warnings]).toEqual([v.rig, []]);
    expect(Object.keys(lib.clips)).toEqual(Object.keys(v.clips));
    for (const [name, c] of Object.entries(v.clips)) sameCapture(lib.clips[name]!, c.capture);
    expect(deepDiff(lib.body, v.body), "the mannequin's look").toBeNull();
    expect(deepDiff(skeleton.measure(lib.clips, "A_TPose"), v.rest)).toBeNull();
  });
  it("reads CMU take 09_02's picks and rest bit for bit like asf-amc.mjs", () => {
    const v = loadTier1a("cmu-09_02"), cat = JSON.parse(tier1bText("cmu/catalog.json")) as { $pick: Record<string, [string, number, number]> } & Record<string, [string, string]>;
    const picks = Object.entries(cat.$pick).map(([name, [take, from, to]]) => ({ name, take, from, to, fps: 120, loop: (cat[name]?.[0] ?? "").split(" ").includes("loop") }));
    const lib = readCmu(tier1bText("cmu/09.asf"), (take) => tier1bText(`cmu/${take}.amc`), picks, 30);
    expect(Object.keys(lib.clips)).toEqual(Object.keys(v.clips));
    for (const [name, c] of Object.entries(v.clips)) sameCapture(lib.clips[name]!, c.capture);
    expect(deepDiff(skeleton.measure(lib.clips, v.restClip), v.rest)).toBeNull();
    expect(lib.log).toEqual(v.log);
  });
});
