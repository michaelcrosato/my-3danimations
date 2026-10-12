// Hostile input (WP-5.2): a small file can't ask for hours of work or gigabytes (a file's frames and joint transforms
// are budgeted, skeletons walked without recursion), a field of the wrong shape is named instead of tripped over, and
// whatever bytes come in, the readers let nothing out but an IoError: every glTF, VRMA, ASF and BVH case the review
// found, and random corruptions of real files.
import { bind, playable, type AnimClip } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { decodeVrma, IoError, LIMITS, packGlb, parseBvh, parseGlb, parseGltf, readAsf, readCmu, readGltf, readGltfPosed, readVrma, writeVrma } from "../src/index.ts";
import { tier1bRigGlb, tier1bText } from "../../../spec/conformance/runner/vectors.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";

/** The IoError a call throws: its code and message. */
function refusal(f: () => unknown): { code: string; message: string } {
  try {
    f();
  } catch (err) {
    expect(err, String(err)).toBeInstanceOf(IoError);
    return { code: (err as IoError).code, message: (err as IoError).message };
  }
  throw new Error("expected a refusal");
}
/** A call's time in seconds. */
function timed(f: () => unknown): number {
  const t0 = performance.now();
  try {
    f();
  } catch {
    // refused: the time is what's measured
  }
  return (performance.now() - t0) / 1000;
}
/** A .gltf with an embedded buffer of float32 values. */
function gltfOf(json: Record<string, unknown>, floats: number[]): string {
  const b = Buffer.from(Float32Array.from(floats).buffer);
  return JSON.stringify({ ...json, buffers: [{ byteLength: b.length, uri: `data:application/octet-stream;base64,${b.toString("base64")}` }] });
}
/** One animation of `seconds`, turning node 0: its times, rotations, accessors and views. */
function longTrack(seconds: number) {
  return {
    floats: [0, seconds, 0, 0, 0, 1, 0, 0, 0, 1],
    json: {
      animations: [{ name: "Long", channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }], samplers: [{ input: 0, output: 1 }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" }, { bufferView: 1, componentType: 5126, count: 2, type: "VEC4" }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 32 }],
    },
  };
}
/** The tiny rig with its JSON edited and, optionally, its buffer. */
function editedRig(edit: (j: Record<string, unknown> & Record<string, never[]>) => void, bin?: (b: Uint8Array) => void): Uint8Array {
  const { json, bin: b } = parseGlb(tier1bRigGlb()), j = structuredClone(json) as Parameters<typeof edit>[0], raw = b!.raw().slice();
  edit(j);
  bin?.(raw);
  return packGlb(j, raw);
}

describe("a file's work is budgeted", () => {
  it("refuses a glTF whose clip lasts hours at once, without sampling it", () => {
    // the Wave_Loop's time accessor rewritten to end at 33,333 s
    const glb = editedRig(() => {}, (raw) => {
      const { json } = parseGlb(tier1bRigGlb()), an = json.animations!.find((a) => a.name === "Wave_Loop")!, acc = json.accessors![an.samplers[0]!.input]!;
      const at = json.bufferViews![acc.bufferView!]!.byteOffset! + (acc.byteOffset ?? 0) + (acc.count - 1) * 4;
      new DataView(raw.buffer).setFloat32(at, 33_333, true);
    });
    let r: ReturnType<typeof refusal> | undefined;
    expect(timed(() => (r = refusal(() => readGltf(parseGlb(glb)))))).toBeLessThan(2);
    expect(r).toMatchObject({ code: "E_LIMIT", message: expect.stringMatching(/Wave_Loop" lasts 33333 s.*over the limit of 262144 for one file/) });
  });
  it("walks a 99,000-node chain without recursion, and refuses posing it for 1,000 s", () => {
    const nodes = Array.from({ length: 99_000 }, (_, i) => ({ name: `n${i}`, ...(i < 98_999 ? { children: [i + 1] } : {}) }));
    const long = longTrack(1000), short = longTrack(1);
    let r: ReturnType<typeof refusal> | undefined;
    expect(timed(() => (r = refusal(() => readGltfPosed(parseGltf(gltfOf({ nodes, ...long.json }, long.floats))))))).toBeLessThan(3);
    expect(r).toMatchObject({ code: "E_LIMIT", message: expect.stringMatching(/30001 frames of 99000 nodes/) });
    // a second's animation is within budget: the chain matches no bone map
    expect(refusal(() => readGltfPosed(parseGltf(gltfOf({ nodes, ...short.json }, short.floats))))).toMatchObject({ code: "E_RIG" });
  });
  it("reads a 30,000-bone ASF chain in moments, each bone after its parent", () => {
    const N = 30_000, bones = Array.from({ length: N }, (_, i) => `begin\nname b${i}\ndirection 0 1 0\nlength 1\naxis 0 0 0 XYZ\ndof rx ry rz\nend`).join("\n");
    const text = `:units\nlength 0.45\n:root\norientation 0 0 0\n:bonedata\n${bones}\n:hierarchy\nbegin\nroot b0\n${Array.from({ length: N - 1 }, (_, i) => `b${i} b${i + 1}`).join("\n")}\nend\n`;
    let order: string[] = [];
    expect(timed(() => (order = readAsf(text).order))).toBeLessThan(3);
    expect([order.length, order[0], order[N - 1]]).toEqual([N, "b0", `b${N - 1}`]);
  });
  it("refuses a BVH whose frames times joints pass the budget from its header, before reading a value", () => {
    const joints = Array.from({ length: 999 }, (_, i) => `JOINT j${i} { OFFSET 0 1 0 CHANNELS 3 Zrotation Xrotation Yrotation`).join("\n");
    const text = `HIERARCHY\nROOT Hips\n{\nOFFSET 0 0 0\nCHANNELS 3 Zrotation Xrotation Yrotation\n${joints}\n${"}\n".repeat(1000)}MOTION\nFrames: 20000\nFrame Time: 0.033\n`;
    expect(refusal(() => parseBvh(text))).toMatchObject({ code: "E_LIMIT", message: expect.stringMatching(/20000 frames of 1000 joints/) });
    expect(refusal(() => parseBvh(text.replace("Frames: 20000", "Frames: 300000")))).toMatchObject({ code: "E_LIMIT" });
    expect(LIMITS.work).toBe(1 << 24);
  });
});

describe("a field of the wrong shape is named", () => {
  const doc = (j: Record<string, unknown>) => () => readGltf(parseGltf(JSON.stringify({ asset: { version: "2.0" }, ...j })));
  it("names each part of a glTF that isn't what glTF says it is", () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ nodes: { a: 1 } }, /^nodes isn't a list/],
      [{ nodes: [{ children: 3 }] }, /nodes\[0\]\.children isn't a list of node indices/],
      [{ nodes: [null] }, /nodes\[0\] isn't an object/],
      [{ animations: [{ samplers: [] }] }, /animations\[0\]\.channels isn't a list/],
      [{ animations: [{ channels: [{ sampler: 0 }], samplers: [] }] }, /animations\[0\]\.channels\[0\]\.target isn't an object/],
      [{ materials: [null] }, /materials\[0\] isn't an object/],
      [{ meshes: [{}] }, /meshes\[0\]\.primitives isn't a list/],
      [{ accessors: [{ componentType: 5126, count: -1, type: "VEC3" }] }, /accessors\[0\]\.count isn't a count/],
      [{ skins: [{ joints: [0.5] }] }, /skins\[0\]\.joints isn't a list of node indices/],
      [{ nodes: [{ rotation: [0, 0, 1] }] }, /nodes\[0\]\.rotation isn't 4 numbers/],
    ];
    for (const [j, msg] of cases) expect(refusal(doc(j)), JSON.stringify(j)).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(msg) });
  });
  it("refuses a file that needs an extension to read its buffers, naming it", () => {
    expect(refusal(() => readGltf(parseGlb(editedRig((j) => Object.assign(j, { extensionsRequired: ["EXT_meshopt_compression"] })))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/requires EXT_meshopt_compression, which isn't read/) });
  });
  it("names an accessor of the wrong type for what reads it", () => {
    const glb = editedRig((j) => {
      const an = (j.animations as unknown as { samplers: { output: number }[] }[])[1]!;
      (j.accessors as unknown as { type: string }[])[an.samplers[0]!.output]!.type = "VEC3";
    });
    expect(refusal(() => readGltf(parseGlb(glb)))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/is a VEC3; it is read as a VEC4/) });
    expect(refusal(() => readGltfPosed(parseGlb(glb)))).toMatchObject({ code: "E_FORMAT" });
  });
  it("reads an ASF bone called constructor, and names the file a bad number is in", () => {
    const asf = tier1bText("cmu/09.asf");
    expect(readAsf(asf.replace(/\blthumb\b/g, "constructor")).bones["constructor"]!.len).toBeGreaterThan(0);
    expect(refusal(() => readAsf(asf.replace(/length 0\.45/, "length many"), "09.asf"))).toMatchObject({ message: expect.stringMatching(/^09\.asf: line \d+: the length unit/) });
    expect(refusal(() => readCmu(asf.replace(/\blthumb\b/g, "__proto__"), () => tier1bText("cmu/09_02.amc"), []))).toMatchObject({ code: "E_RIG", message: expect.stringMatching(/lacks bones: lthumb/) });
  });
});

describe("only an IoError comes out", () => {
  const b = bind(rigSkeleton()), c = libraryClips().find((x) => x.clip.id === "QUATERNIUS_3D2DGE/Walk_Loop")!, vrma = writeVrma(playable(c.clip as AnimClip, c.rest) as AnimClip, b);
  it("names a VRMA whose humanoid, samplers or channels aren't there", () => {
    const edit = (f: (j: Record<string, unknown> & { animations: { channels?: unknown; samplers: unknown[] }[]; extensions: { VRMC_vrm_animation: { humanoid: { humanBones: Record<string, unknown> } } } }) => void) => {
      const { json, bin } = parseGlb(vrma), j = structuredClone(json) as Parameters<typeof f>[0];
      f(j);
      return packGlb(j, bin!.raw());
    };
    expect(refusal(() => readVrma(edit((j) => (j.extensions.VRMC_vrm_animation.humanoid.humanBones.hips = null))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/humanoid bone hips names node null/) });
    expect(refusal(() => decodeVrma(edit((j) => (j.animations[0]!.samplers = j.animations[0]!.samplers.slice(0, 1)))))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/names sampler \d+, which the animation doesn't have/) });
    expect(refusal(() => decodeVrma(edit((j) => delete j.animations[0]!.channels)))).toMatchObject({ code: "E_FORMAT", message: expect.stringMatching(/animations\[0\]\.channels isn't a list/) });
  });
  it("gives an IoError or a reading for every corruption of a real .glb, .vrma and .asf", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const outcomes = { read: 0, refused: 0 };
    const tryIt = (f: () => unknown) => {
      try {
        f();
        outcomes.read++;
      } catch (err) {
        expect(err, String(err)).toBeInstanceOf(IoError);
        outcomes.refused++;
      }
    };
    const glb = tier1bRigGlb(), asf = tier1bText("cmu/09.asf");
    for (let k = 0; k < 150; k++) {
      for (const [src, read] of [[glb, (x: Uint8Array) => readGltf(parseGlb(x))], [vrma, (x: Uint8Array) => readVrma(x)], [vrma, (x: Uint8Array) => decodeVrma(x)]] as const) {
        const x = src.slice();
        for (let n = 1 + Math.floor(rnd() * 4); n > 0; n--) x[Math.floor(rnd() * x.length)] = Math.floor(rnd() * 256);
        tryIt(() => read(x));
      }
      const chars = asf.split("");
      for (let n = 1 + Math.floor(rnd() * 4); n > 0; n--) chars[Math.floor(rnd() * chars.length)] = String.fromCharCode(32 + Math.floor(rnd() * 90));
      tryIt(() => readAsf(chars.join("")));
    }
    expect(outcomes.read + outcomes.refused).toBe(600);
    expect(outcomes.refused).toBeGreaterThan(20);
  });
  it("still reads a clean file: a VRMA written here is the loop its extras say", () => {
    expect(readVrma(vrma).clips["QUATERNIUS_3D2DGE/Walk_Loop"]!.loop).toBe(true);
  });
});
