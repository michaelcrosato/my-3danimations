// The readers and writers (WP-5.2): BVH read as shardfall's reader reads it (the bone map, the units, the facing, the
// rest that stands straightest, a take of other proportions rigged on its own); a glTF rig read by its bone map the
// way the exact reader reads it, a node's matrix as its transform and an unknown chunk skipped; a clip written as a
// VRM animation and read back byte for byte, its loop, events, contacts and facts in extras, every humanoid bone where
// the Animator put it, root motion and all; and a catalog import whose fits are tier 1a's, bit for bit, with its
// skips, each CMU subject's record and the ledger's stretches, and a smaller set picked from it.
import { Animator, bind, format, math, playable, solver, type AnimClip } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bvhPoints, bvhPose, decodeVrma, encodeVrma, importSet, IoError, packGlb, parseBvh, parseGlb, parseGltf, picksOf, readBvh, readCmu, readGltf, readGltfPosed, readVrma, rigBvh, subset, writeVrma, type Capture, type Catalog, type Vrma } from "../src/index.ts";
import { loadTier1a, tier1bRigGlb, tier1bText, VECTORS } from "../../../spec/conformance/runner/vectors.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { libraryClips } from "../../../tools/qa/qa.ts";
import { sidewaysLegs, TINY, tinyBvh } from "./fixtures.ts";

const P = (pts: number[][], n: string) => pts[format.IDX[n]!]!;
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
/** A capture's point at frame f (mm). */
const at = (c: Capture, f: number, n: string) => [0, 1, 2].map((k) => c.data[(f * format.P + format.IDX[n]!) * 3 + k]!);
const JOINTS = ["pelvis", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR", "shL", "elbowL", "wristL", "shR", "elbowR", "wristR", "neck", "head"];

describe("BVH", () => {
  it("reads shardfall's tiny MotionBuilder skeleton as its reader does: centimetres, facing +z, the elbow's bend", () => {
    const r = rigBvh(parseBvh(TINY));
    expect([r.map, r.scale, r.restFrame]).toEqual(["motionbuilder", 0.01, null]);
    expect(r.facing.fwd).toEqual([0, 0, 1]);
    expect(r.facing.right.map((x) => x + 0)).toEqual([-1, 0, 0]);
    const rest = bvhPoints(r, bvhPose(r.bvh, 0)), bent = bvhPoints(r, bvhPose(r.bvh, 1));
    expect(P(rest, "pelvis")[1]).toBeCloseTo(0.95, 9);
    expect(dist(P(rest, "shL"), P(rest, "elbowL"))).toBeCloseTo(0.28, 9);
    expect(P(rest, "toeL")[2]).toBeCloseTo(0.2, 9);
    const fore = P(bent, "wristL").map((x, i) => x - P(bent, "elbowL")[i]!);
    expect(Math.abs(fore[0]!)).toBeLessThan(1e-9);
    expect(Math.abs(fore[2]!)).toBeCloseTo(0.25, 9);
  });
  it("finds joints whatever their namespace or case, and takes the units it's given", () => {
    const named = rigBvh(parseBvh(TINY.replace(/(ROOT|JOINT) (\w+)/g, "$1 mixamorig:$2")));
    expect(named.map).toBe("motionbuilder");
    expect(rigBvh(parseBvh(TINY), { units: 0.02 }).scale).toBe(0.02);
  });
  it("stands the rest in the straightest frame when the zero pose doesn't stand", () => {
    // the legs laid along x at rest; frame 6 alone turns both thighs 90° down about z (LeftUpLeg is joint 14, RightUpLeg 18)
    const text = sidewaysLegs(tinyBvh(12, 1 / 30, () => 0, (f, v) => {
      if (f === 6) v[6 + 3 * 13] = v[6 + 3 * 17] = -90;
    }));
    const r = rigBvh(parseBvh(text));
    expect(r.restFrame).toBe(6);
    expect(r.stands).toBeGreaterThan(0.9);
    expect(r.scale).toBe(0.01);
  });
  it("cuts a take into a clip facing forward from the origin, and stands the rest on the take's floor", () => {
    const lib = readBvh(() => tinyBvh(31, 1 / 30, (f) => 3 * f), [{ name: "Bend", take: "t", from: 0.2, to: 0.8 }], 30);
    // a second take of the same joints in millimetres is rigged on its own: its units read from its own legs
    const big = readBvh((t) => (t === "a" ? tinyBvh(4, 1 / 30) : tinyBvh(4, 1 / 30).replace(/OFFSET (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g, (_, x, y, z) => `OFFSET ${10 * x} ${10 * y} ${10 * z}`).replace(/^0 95 /gm, "0 950 ")), ["a", "b"], 30);
    expect(at(big.clips.b!, 0, "pelvis")[2]).toBeCloseTo(at(big.clips.a!, 0, "pelvis")[2]!, 3);
    expect(lib.rig).toBe("bvh:motionbuilder");
    const c = lib.clips.Bend!, rest = lib.clips._rest!;
    expect([c.n, c.dur, c.take]).toEqual([19, 0.6, "t 0.20-0.80"]);
    expect(at(c, 0, "pelvis").map((x) => Math.round(x))).toEqual([0, 0, 950]);
    // the lowest foot point on the floor the takes stand on
    expect(Math.min(at(rest, 0, "toeL")[2]!, at(rest, 0, "ballL")[2]!)).toBeCloseTo(0, 0);
  });
});

describe("a stretch found in a long take (100STYLE's way)", () => {
  // 15 s at 30 fps, facing +z (the figure's left is +x): 3 s walking in, 4 s sidestepping left, 4 s sidestepping right,
  // 4 s walking out; the elbow bends once a second all along, so every stretch holds cycles
  const bend = (f: number) => 45 + 45 * Math.sin((2 * Math.PI * f) / 30);
  const side = tinyBvh(450, 1 / 30, bend, (f, v) => {
    const t = f / 30;
    v[0] = t < 3 ? 0 : t < 7 ? 40 * (t - 3) : t < 11 ? 160 - 40 * (t - 7) : 0;
    v[2] = t < 3 ? 40 * t : t < 11 ? 120 : 120 + 40 * (t - 11);
  });
  // 12 s: walking forward 4 s, standing 4 s, walking on 4 s
  const pause = tinyBvh(360, 1 / 30, bend, (f, v) => {
    const t = f / 30;
    v[2] = t < 4 ? 40 * t : t < 8 ? 160 : 160 + 40 * (t - 8);
  });
  const cut = (text: string, find: "left" | "right" | "still" | "back") => readBvh(() => text, [{ name: "C", take: "t", loop: true, minCycle: 0.8, find }], 30, { lenient: true });
  const span = (c: Capture) => c.take!.split(" ")[1]!.split("-").map(Number) as [number, number];
  it("cuts a loop going a way from the pass that goes that way, facing forward", () => {
    for (const [way, a, b] of [["left", 3, 7], ["right", 7, 11]] as const) {
      const lib = cut(side, way), c = lib.clips.C!, [from, to] = span(c);
      expect([from >= a, to <= b, c.loop], `${way}: ${c.take}`).toEqual([true, true, true]);
      expect(lib.log.some((l) => l.startsWith(`C: 1 passes of t going ${way}`))).toBe(true);
      // facing forward: the pelvis's own forward point ahead of it, whichever way the clip went
      expect(at(c, 0, "pelvisF")[0]! - at(c, 0, "pelvis")[0]!).toBeGreaterThan(50);
    }
  });
  it("finds where the hips stay put, and leaves out a pick that has no pass its way, saying why", () => {
    const [from, to] = span(cut(pause, "still").clips.C!);
    expect([from >= 4, to <= 8], `${from}-${to}`).toEqual([true, true]);
    const none = cut(side, "back");
    expect([none.clips.C, none.log.find((l) => l.startsWith("left out C"))]).toEqual([undefined, expect.stringMatching(/t has no straight stretch going back/)]);
    expect(() => readBvh(() => side, [{ name: "C", take: "t", loop: true, find: "back" }], 30)).toThrow(/no straight stretch going back/);
  });
});

describe("glTF on any rig", () => {
  it("reads the tiny rig by its bone map with the joints where the exact reader puts them", () => {
    const doc = parseGlb(tier1bRigGlb()), exact = readGltf(doc).clips.Wave_Loop!, posed = readGltfPosed(doc, { fps: 30 });
    expect(posed.rig).toBe("gltf:unreal");
    const c = posed.clips.Wave_Loop!;
    expect(c.n).toBe(exact.n);
    let worst = 0;
    for (let f = 0; f < c.n; f++) for (const a of JOINTS) for (const b of JOINTS) worst = Math.max(worst, Math.abs(dist(at(c, f, a), at(c, f, b)) - dist(at(exact, f, a), at(exact, f, b))));
    expect(worst).toBeLessThan(0.01);
  });
  it("reads a skin without inverse bind matrices as having identity ones, as the spec says", () => {
    const j = JSON.parse(readFileSync(join(VECTORS, "tier1b/rigify.gltf"), "utf8")) as { skins: { inverseBindMatrices?: number }[] };
    delete j.skins[0]!.inverseBindMatrices;
    const lib = readGltf(parseGltf(JSON.stringify(j)));
    expect([lib.rig, lib.body !== null, Object.keys(lib.clips)]).toEqual(["rigify", true, ["A_TPose", "Wave_Loop", "Walk_RM"]]);
  });
  it("reads a node's matrix as its transform, and skips a chunk of a type it doesn't know", () => {
    const { json, bin } = parseGlb(tier1bRigGlb()), j = structuredClone(json) as { nodes: { name: string; translation?: number[]; matrix?: number[] }[] };
    const spine = j.nodes.find((n) => n.name === "spine_01")!, [x, y, z] = spine.translation!;
    delete spine.translation;
    spine.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x!, y!, z!, 1];
    const want = readGltf(parseGlb(tier1bRigGlb())).clips.Wave_Loop!, got = readGltf(parseGlb(packGlb(j, bin!.raw()))).clips.Wave_Loop!;
    expect(Array.from(got.data)).toEqual(Array.from(want.data));
    // a chunk of type "XTRA" between the JSON and the buffer
    const glb = tier1bRigGlb(), dv = new DataView(glb.buffer, glb.byteOffset), jsonEnd = 20 + dv.getUint32(12, true), extra = new Uint8Array(16);
    new DataView(extra.buffer).setUint32(0, 8, true);
    new DataView(extra.buffer).setUint32(4, 0x41525458, true);
    const withChunk = new Uint8Array(glb.length + 16);
    withChunk.set(glb.subarray(0, jsonEnd));
    withChunk.set(extra, jsonEnd);
    withChunk.set(glb.subarray(jsonEnd), jsonEnd + 16);
    new DataView(withChunk.buffer).setUint32(8, withChunk.length, true);
    expect(Array.from(readGltf(parseGlb(withChunk)).clips.Wave_Loop!.data)).toEqual(Array.from(want.data));
  });
});

describe("VRM animations", () => {
  const b = bind(rigSkeleton()), lib = libraryClips();
  const clipOf = (id: string): AnimClip => {
    const c = lib.find((x) => x.clip.id === id)!;
    return { ...playable(c.clip as AnimClip, c.rest), events: [{ t: 0.4, name: "step" }], facts: { speed: 1.2 } } as AnimClip;
  };
  it("writes a clip, reads it back and writes it again byte for byte, its loop, events, contacts and facts in extras", () => {
    const clip = clipOf("QUATERNIUS_3D2DGE/Walk_Loop"), bytes = writeVrma(clip, b), v = decodeVrma(bytes);
    expect(encodeVrma(v)).toEqual(bytes);
    expect(v.extras).toEqual({ id: clip.id, loop: true, dur: clip.dur, events: [{ t: 0.4, name: "step" }], contacts: clip.contacts, facts: { speed: 1.2 } });
    // where three's bake puts them: the animation's extras
    expect((parseGlb(bytes).json.animations![0] as { extras?: unknown }).extras).toEqual(v.extras);
    expect(Object.keys(v.humanBones)).toEqual(expect.arrayContaining(["hips", "spine", "head", "leftUpperArm", "rightLowerLeg", "leftFoot"]));
    expect(v.times.length).toBe(Math.ceil(clip.dur * 30) + 1);
    // what a VRM player plays: the humanoid bones' rotations and the hips' place, nothing else
    expect(v.tracks.filter((t) => t.path === "rotation").map((t) => t.node).sort((x, y) => x - y)).toEqual(Object.values(v.humanBones).sort((x, y) => x - y));
    expect(v.tracks.filter((t) => t.path === "translation").map((t) => t.node)).toEqual([v.humanBones.hips]);
    // a file's JSON names the extension, and its bones' nodes
    const json = parseGlb(bytes).json;
    expect(json.extensionsUsed).toEqual(["VRMC_vrm_animation"]);
    expect((json.extensions!.VRMC_vrm_animation as { specVersion: string }).specVersion).toBe("1.0");
  });
  it("puts every humanoid bone where the Animator does, the root's travel carried by the hips", () => {
    // a knockback: it travels, so the root's motion has to reach a player through the hips
    const clip = clipOf("QUATERNIUS_3D2DGE/Hit_Knockback"), v = decodeVrma(writeVrma(clip, b)), n = v.times.length - 1, h = clip.dur / n;
    const a = new Animator(b, { step: h }).layer("clip", { clip });
    let worst = 0, hips: number[] = [];
    for (let i = 0; i <= n; i++) {
      const p = a.pose(), W = worldOf(v, i), o = b.origin, tr = solver.dirToSkeleton(b, [p.root.forward * b.scale, p.root.right * b.scale, 0]);
      for (const k of Object.values(v.humanBones)) {
        const j = (p.joints as Record<string, number[]>)[v.nodes[k]!.name]!;
        worst = Math.max(worst, Math.hypot(...[0, 1, 2].map((q) => o[q]! + tr[q]! + (j[q]! - o[q]!) - W[k]!.p[q]!)));
      }
      if (i === n) hips = W[v.humanBones.hips!]!.p;
      if (i < n) a.step(h);
    }
    expect(worst).toBeLessThan(1e-5);
    expect(Math.hypot(hips[0]!, hips[2]!)).toBeGreaterThan(1);
    // read back as a clip, it travels as far
    const read = readVrma(writeVrma(clip, b)), c = read.clips[clip.id]!;
    expect(read.rig).toBe("gltf:vrm");
    expect(c.move).not.toBeNull();
  });
});

/** Every node's world rotation and place at sample i of a decoded VRMA: its tracks where it has them, else its rest. */
function worldOf(v: Vrma, i: number): { r: number[]; p: number[] }[] {
  const W: { r: number[]; p: number[] }[] = [];
  v.nodes.forEach((nd, k) => {
    const rt = v.tracks.find((t) => t.node === k && t.path === "rotation"), tt = v.tracks.find((t) => t.node === k && t.path === "translation");
    const r = rt ? Array.from(rt.values.subarray(i * 4, i * 4 + 4)) : nd.rotation, t = tt ? Array.from(tt.values.subarray(i * 3, i * 3 + 3)) : nd.translation;
    if (nd.parent < 0) W[k] = { r: [...r], p: [...t] };
    else {
      const P = W[nd.parent]!, d = math.quat.rotate([0, 0, 0], P.r as never, t as never);
      W[k] = { r: Array.from(math.quat.multiply([0, 0, 0, 1], P.r as never, r as never)), p: P.p.map((x, q) => x + d[q]!) };
    }
  });
  return W;
}

describe("catalog-driven import", () => {
  it("fits the tiny rig's clips as tier 1a's oracle fitted them, bit for bit, and records what it skipped", () => {
    const v = loadTier1a("rig"), cat = JSON.parse(tier1bText("rig-catalog.json")) as Catalog, lib = readGltf(parseGlb(tier1bRigGlb()));
    const out = importSet([{ id: "RIG", file: "rig.glb", ...lib, rest: v.restClip }], { ...cat, $skip: { Step_RM: "a test of the skip" } }, { name: "RIG", credit: "the tiny rig" });
    expect(out.report.skipped).toEqual([{ name: "Step_RM", why: "a test of the skip" }]);
    for (const r of out.report.clips) {
      const want = v.clips[r.name]!.fit!;
      expect([Object.is(r.max, want.max), Object.is(r.mean, want.mean)], r.name).toEqual([true, true]);
      expect(out.set.clips[r.name]!.keys).toEqual(want.clip.keys);
      expect(out.set.fit[r.name]).toEqual([Math.round(want.mean), Math.round(want.max)]);
    }
    expect(out.report.clips.map((r) => r.name)).toEqual(["A_TPose", "Wave_Loop"]);
    expect(out.set.sources.RIG!.rig).toBe("unreal");
  });
  it("takes CMU's picks from the catalog and fits them as tier 1a did, each clip's take on record", () => {
    const v = loadTier1a("cmu-09_02"), cat = JSON.parse(tier1bText("cmu/catalog.json")) as Catalog;
    const lib = readCmu(tier1bText("cmu/09.asf"), (t) => tier1bText(`cmu/${t}.amc`), picksOf(cat, 120), 30);
    const out = importSet([{ id: "CMU_09", file: "09.asf", about: "run", ...lib }], cat, { name: "CMU", credit: "CMU" });
    for (const r of out.report.clips) expect([Object.is(r.max, v.clips[r.name]!.fit!.max), out.set.clips[r.name]!.take], r.name).toEqual([true, v.clips[r.name]!.capture.take]);
    // the catalog's CMU record, one a subject
    expect(out.report.warnings).toEqual([]);
    expect(out.set.sources.CMU_09).toMatchObject({ label: `${cat.$sources!.CMU!.label}, subject 09 (run)`.replace("subject 09", "subject 9"), url: "http://mocap.cs.cmu.edu/search.php?subjectnumber=9", rig: "cmu" });
  });
  it("plays a pick that names only its take over the stretch the ledger says it moves, at the take's rate", () => {
    const cat: Catalog = { $pick: { Whole: ["09_02"], Part: ["09_02", 0.2, 0.6] }, Whole: ["run loop", "a run"] };
    expect(picksOf(cat, 30, { "09_02": { active: "0.1-1.0", fps: "120" } })).toEqual([{ name: "Whole", take: "09_02", from: 0.1, to: 1, fps: 120, loop: true }, { name: "Part", take: "09_02", from: 0.2, to: 0.6, fps: 120, loop: false }]);
    expect(picksOf(cat, 30)[0]).toEqual({ name: "Whole", take: "09_02", fps: 30, loop: true });
  });
  it("picks a smaller set from bigger ones, with the records of the libraries its clips came from", () => {
    const v = loadTier1a("rig"), cat = JSON.parse(tier1bText("rig-catalog.json")) as Catalog, lib = readGltf(parseGlb(tier1bRigGlb()));
    const rig = importSet([{ id: "RIG", file: "rig.glb", ...lib, rest: v.restClip }], cat, { name: "RIG", credit: "the tiny rig" }).set;
    const cmuCat = JSON.parse(tier1bText("cmu/catalog.json")) as Catalog, cmuLib = readCmu(tier1bText("cmu/09.asf"), (t) => tier1bText(`cmu/${t}.amc`), picksOf(cmuCat, 120), 30);
    const cmu = importSet([{ id: "CMU_09", file: "09.asf", ...cmuLib }], cmuCat, { name: "CMU", credit: "CMU" }).set, cmuClip = Object.keys(cmu.clips)[0]!;
    const hero = subset([rig, cmu], ["Wave_Loop", `CMU:${cmuClip}`], { name: "HERO", title: "Hero" });
    expect([hero.set, hero.title, hero.from, Object.keys(hero.clips), Object.keys(hero.sources)]).toEqual(["HERO", "Hero", ["RIG", "CMU"], ["Wave_Loop", cmuClip], ["RIG", "CMU_09"]]);
    expect([hero.credit, hero.fps, hero.fit.Wave_Loop]).toEqual(["the tiny rig", 30, rig.fit.Wave_Loop]);
    expect(() => subset([rig], ["Nope"], { name: "X" })).toThrow(IoError);
    expect(() => subset([rig, rig], ["Wave_Loop"], { name: "X" })).toThrow(/pick one as SET:Wave_Loop/);
  });
});
