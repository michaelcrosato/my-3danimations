// Untrusted input (WP-5.2): every reader refuses a malformed file with a clear error that names its cause and, for
// binary input, the offset: glTF containers, accessors and rigs; ASF/AMC skeletons, takes and picks; BVH hierarchies,
// frame times and frames, and a skeleton (a .bvh's or a glTF's nodes) no bone map knows, in words for both; VRM
// animations. None of them throws anything but an IoError.
import { describe, expect, it } from "vitest";
import { decodeVrma, gltfToGlb, IoError, packGlb, parseBvh, parseGlb, parseGltf, readAmc, readAsf, readBvh, readCmu, readGltf, readGltfPosed, rigBvh } from "../src/index.ts";
import { tier1bRigGlb, tier1bText } from "../../../spec/conformance/runner/vectors.ts";
import { tinyBvh } from "./fixtures.ts";

/** The IoError a call throws: its code, message and offset. */
function refusal(f: () => unknown): { code: string; message: string; offset: number | undefined } {
  try {
    f();
  } catch (err) {
    expect(err).toBeInstanceOf(IoError);
    const e = err as IoError;
    return { code: e.code, message: e.message, offset: e.offset };
  }
  throw new Error("expected a refusal");
}
/** The tiny rig's .glb with its JSON edited. */
function editedRig(edit: (j: Record<string, unknown> & { nodes: { name: string; children?: number[] }[]; accessors: { count: number; componentType: number }[]; animations: { samplers: { interpolation: string }[] }[]; bufferViews: { byteLength: number; byteOffset: number }[] }) => void): Uint8Array {
  const { json, bin } = parseGlb(tier1bRigGlb());
  const j = structuredClone(json) as Parameters<typeof edit>[0];
  edit(j);
  return packGlb(j, bin!.raw());
}

describe("glTF, refused clearly", () => {
  it("names a container that isn't a .glb, or whose lengths run past its end", () => {
    const glb = tier1bRigGlb();
    expect(refusal(() => parseGlb(new TextEncoder().encode("not a glb file at all..")))).toMatchObject({ code: "E_FORMAT", offset: 0, message: expect.stringMatching(/first 4 bytes aren't 'glTF'/) });
    expect(refusal(() => parseGlb(glb.slice(0, 10)))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/shorter than its 12-byte header/) });
    const v1 = glb.slice();
    new DataView(v1.buffer).setUint32(4, 1, true);
    expect(refusal(() => parseGlb(v1))).toMatchObject({ code: "E_FORMAT", offset: 4, message: expect.stringMatching(/version 1/) });
    expect(refusal(() => parseGlb(glb.slice(0, glb.length - 40)))).toMatchObject({ code: "E_BOUNDS", offset: 8 });
    const long = glb.slice();
    new DataView(long.buffer).setUint32(12, 10_000_000, true);
    expect(refusal(() => parseGlb(long))).toMatchObject({ code: "E_BOUNDS", offset: 20, message: expect.stringMatching(/the JSON chunk of 10000000 byte\(s\) runs past the end/) });
    const badJson = glb.slice();
    badJson[20] = 0x7b + 1;
    expect(refusal(() => parseGlb(badJson))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/its JSON doesn't parse/) });
  });
  it("refuses an external buffer, bad base64 and a buffer shorter than it says", () => {
    expect(refusal(() => parseGltf(JSON.stringify({ buffers: [{ byteLength: 4, uri: "https://example.com/rig.bin" }] })))).toMatchObject({ code: "E_MISSING", message: expect.stringMatching(/a reader never fetches/) });
    expect(refusal(() => parseGltf(JSON.stringify({ buffers: [{ byteLength: 4, uri: "data:application/octet-stream;base64,@@@" }] })))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/its embedded buffer isn't base64/) });
    expect(refusal(() => parseGltf(JSON.stringify({ buffers: [{ byteLength: 400, uri: "data:application/octet-stream;base64,AAAA" }] })))).toMatchObject({ code: "E_BOUNDS", message: expect.stringMatching(/holds 3 bytes; byteLength says 400/) });
    expect(refusal(() => gltfToGlb("[1, 2]"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/isn't an object/) });
  });
  it("bounds-checks every accessor, caps its size, and names a rig it doesn't know or bones it lacks", () => {
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => (j.bufferViews[3]!.byteOffset = 1_000_000)))))).toMatchObject({ code: "E_BOUNDS", message: expect.stringMatching(/accessor \d+ of \d+ byte\(s\) runs past the end/) });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => (j.accessors[0]!.count = 2 ** 30)))))).toMatchObject({ code: "E_LIMIT" });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => (j.accessors[0]!.componentType = 5130)))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/componentType 5130 isn't read/) });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => j.nodes.forEach((n) => (n.name = n.name.replace("spine_01", "torso")))))))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/isn't one the importer knows/) });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => j.nodes.forEach((n) => (n.name = n.name.replace("calf_l", "shin_l")))))))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/lacks bones the unreal map needs: calf_l$/) });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => (j.animations[1]!.samplers[0]!.interpolation = "CUBICSPLINE")))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/CUBICSPLINE/) });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => (j.nodes[0]!.children = [99])))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/node 0 lists child 99, which doesn't exist/) });
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => (j.nodes[1]!.children = [...(j.nodes[1]!.children ?? []), 0])))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/parents form a cycle/) });
  });
});

describe("ASF/AMC, refused clearly", () => {
  const asf = tier1bText("cmu/09.asf"), amc = tier1bText("cmu/09_02.amc");
  it("names the line of a bone that lacks a field, a value that isn't a number, a hierarchy naming no bone", () => {
    expect(refusal(() => readAsf(asf.replace(/(name lowerback[\s\S]*?)length [\d.]+/, "$1")))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line \d+: a bone without its length/) });
    expect(refusal(() => readAsf(asf.replace(/length 0\.45/, "length many")))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/the length unit isn't a number \("many"\)/) });
    expect(refusal(() => readAsf(asf.replace(/root lhipjoint/, "root lhipjoint ghost")))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/names bone "ghost", which :bonedata doesn't define/) });
  });
  it("names a take's stray line and its non-numbers, a skeleton missing bones, and a pick with no frames", () => {
    expect(refusal(() => readAmc("root 0 0 0\n1\nroot 1 2 3\n"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line 1: a bone's values before the first frame number/) });
    expect(refusal(() => readAmc("1\nroot 1 two 3\n"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line 2: root's values aren't all numbers/) });
    expect(refusal(() => readCmu(asf.replace(/name lthumb/, "name lpollex").replace(/lthumb/g, "lpollex"), () => amc, []))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/lacks bones: lthumb/) });
    expect(refusal(() => readCmu(asf, () => amc, [{ name: "Late", take: "09_02", from: 50, fps: 120 }]))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^Late: 09_02 has no frames from 50 s/) });
  });
});

describe("BVH, refused clearly", () => {
  it("names the line of an unexpected word, a channel it can't read, an offset outside a joint, a bad value", () => {
    expect(refusal(() => parseBvh(""))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/no joints: not a BVH file/) });
    expect(refusal(() => parseBvh("HIERARCHY\nROOT Hips\n{\n OFFSET 0 0 0\n CHANNELS 1 Wrotation\n}\n"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line 5: channel "wrotation" isn't read/) });
    expect(refusal(() => parseBvh("HIERARCHY\nOFFSET 0 0 0\n"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line 2: OFFSET outside a joint/) });
    expect(refusal(() => parseBvh("HIERARCHY\nROOT Hips\n{\n OFFSET 0 0 0\n}\nWHATEVER\n"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line 6: unexpected "WHATEVER"/) });
    expect(refusal(() => parseBvh("HIERARCHY\nROOT Hips\n{\n OFFSET 0 0 0\n CHANNELS 1 Xrotation\n}\n"))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/no MOTION section/) });
    expect(refusal(() => parseBvh(`${tinyBvh(1).trimEnd()} oops\n`))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/a frame value isn't a number \("oops"\)/) });
    expect(refusal(() => parseBvh(tinyBvh(0)))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/no frames/) });
  });
  it("refuses a Frame Time that isn't above 0 and at most 1 s, naming it, where a take would read at a rate it hasn't", () => {
    const bad = (ft: string) => ({ code: "E_FORMAT", message: expect.stringMatching(new RegExp(`^line \\d+: Frame Time ${ft} s: a frame time is above 0 and at most 1 s$`)) });
    for (const [ft, shown] of [[0, "0"], [-0.5, "-0\\.5"], [1e6, "1000000"]] as const) expect(refusal(() => parseBvh(tinyBvh(2, ft)))).toMatchObject(bad(shown));
    expect(refusal(() => parseBvh(tinyBvh(2, NaN)))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^line \d+: the frame time isn't a number \("NaN"\)$/) });
    // 26 frames 1e6 s apart, refused rather than read at 120 fps as 0.2 s; 1 s a frame is read
    expect(refusal(() => readBvh(() => tinyBvh(26, 1e6), ["t"]))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/^t\.bvh: line \d+: Frame Time 1000000 s/) });
    expect(readBvh(() => tinyBvh(26, 1), ["t"]).clips.t!.dur).toBe(25);
  });
  it("names a skeleton no bone map knows, with its joints, and the joints a map lacks", () => {
    expect(refusal(() => rigBvh(parseBvh(tinyBvh().replace(/LeftUpLeg/g, "LeftThigh"))))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/^its joint names match none of the bone maps the reader knows \(.*\); its joints: Hips, Spine/) });
    // the same words for a glTF's nodes, read on any rig (no BVH named)
    const glb = editedRig((j) => j.nodes.forEach((n) => (n.name = n.name.replace("spine_01", "torso"))));
    expect(refusal(() => readGltfPosed(parseGlb(glb)))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/^its joint names match none of the bone maps the reader knows \([^)]*VRM's humanoid bones\); its joints: root, pelvis, torso/) });
    expect(refusal(() => rigBvh(parseBvh(tinyBvh().replace(/RightHand/g, "RightPaw"))))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/the motionbuilder map needs joints the file lacks: RightHand/) });
    expect(refusal(() => readBvh((t) => (t === "a" ? tinyBvh() : tinyBvh().replace(/LeftToeBase/g, "LeftToe")), ["a", "b"]))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/its joints differ from the library's first take's/) });
  });
});

describe("VRMA, refused clearly", () => {
  it("names a glTF that isn't a VRM animation", () => {
    expect(refusal(() => decodeVrma(tier1bRigGlb()))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/not a VRM animation/) });
  });
});
