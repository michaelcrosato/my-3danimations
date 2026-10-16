// A glTF character's skeleton for core's bind (WP-7.2b, I1): tier 1b's skinless rig reads as the conformance skeleton
// exactly; its Rigify rig (a skin, its root rotated and scaled) binds by name at its hip height, its soles' end bones
// (D49) included; every generated test character reads as generated, an armature's 0.01 scale and each bone's rest
// frame included, the leaves no vertex is weighted to left out (a VRM, 1.0 or 0.x, keeps them, as do weights it can't
// read, which it says, but not another required extension); the biggest skin is read, a bone's parent the nearest
// joint above it; a joint no vertex is weighted to is kept only above one of the skin's own, through joints (not a
// helper node, nor from another skin's joint); where a joint's mesh ends, exactly (half its weight or more, summed to
// 1, farthest across the ground, down to the lowest, the skinned mesh node's own transform ignored); the real CC0
// rigs, when fetched, map each limb to its own bones, KayKit's IK and roll controls left out; names are unique; no
// bones, or a joint past the nodes, refused.
import { bind, math, recognize } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { IoError, meshEnds, packGlb, parseGlb, parseGltf, skeletonOfGltf } from "../src/index.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { tier1bText } from "../../../spec/conformance/runner/vectors.ts";
import { rigBytes } from "../../../tools/fixtures/fixtures.ts";
import { character } from "../../three/test-characters/characters.ts";
import { TEST_SEEDS, variant } from "../../three/test-characters/variants.ts";

const gltf = (json: object) => parseGltf(JSON.stringify({ asset: { version: "2.0" }, ...json }));
/** A small skinned glTF: C alone in a skin of one, and A (1 m up) and B (2 m up, a helper node between) in a skin of two
 *  that a mesh node moved 1 m along x skins (a move glTF says to ignore): four vertices, each weighted [to B, to A] (by
 *  default the last's weights summing to 0.6). */
function skinned(extra: object = {}, W = [[1, 0], [0.6, 0.4], [0.4, 0.6], [0.4, 0.2]]) {
  const P = [[0, 0, 0.3], [0, -0.5, 0.1], [0, -1, 2], [0, 0, 0.5]];
  const bin = new Uint8Array(128), f = new Float32Array(bin.buffer), view = (byteOffset: number, byteLength: number) => ({ buffer: 0, byteOffset, byteLength });
  P.forEach((p, v) => f.set(p, v * 3));
  W.forEach((w, v) => {
    bin.set([1, 0, 0, 0], 48 + v * 4);
    f.set([...w, 0, 0], 16 + v * 4);
  });
  return parseGlb(packGlb({
    asset: { version: "2.0" }, skins: [{ joints: [3] }, { joints: [0, 2] }], meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    nodes: [{ name: "A", translation: [0, 1, 0], children: [1] }, { name: "helper", translation: [0, 0.5, 0], children: [2] }, { name: "B", translation: [0, 0.5, 0] }, { name: "C" }, { name: "Body", mesh: 0, skin: 1, translation: [1, 0, 0] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: "VEC3" }, { bufferView: 1, componentType: 5121, count: 4, type: "VEC4" }, { bufferView: 2, componentType: 5126, count: 4, type: "VEC4" }],
    bufferViews: [view(0, 48), view(48, 16), view(64, 64)], buffers: [{ byteLength: 128 }], ...extra,
  }, bin));
}

describe("skeletonOfGltf", () => {
  it("reads tier 1b's skinless rig as the conformance skeleton, bit for bit, every node a bone at rest unturned", () => {
    const s = skeletonOfGltf(parseGltf(tier1bText("rig.gltf")));
    expect(s.skeleton).toEqual(rigSkeleton());
    expect([s.nodes, new Set(Object.values(s.restWorld).map(String))]).toEqual([[...Array(34).keys()], new Set(["0,0,0,1"])]);
  });
  it("reads the Rigify rig's skin under its turned and scaled root, and binds it by name at its hip height, soles and all", () => {
    const doc = parseGltf(tier1bText("rigify.gltf")), s = skeletonOfGltf(doc), rec = recognize(s.skeleton);
    expect([s.skeleton.bones.length, rec.table, rec.confidence, rec.missing, rec.unmapped]).toEqual([31, "rigify", 1, [], ["root"]]);
    expect(s.skeleton.bones[1]).toMatchObject({ name: "DEF-hips", parent: "root" });
    expect(s.skeleton.bones[1]!.head![1]).toBeCloseTo(0.95, 12);
    // from the bones alone the ground is under the toes' heads; the end bones on the soles put it where three's bind does
    const toes = ["DEF-toe.L", "DEF-toe.R"], ends = meshEnds(doc, toes.map((t) => s.nodes[s.skeleton.bones.findIndex((b) => b.name === t)]!));
    const soles = { ...s.skeleton, bones: [...s.skeleton.bones, ...toes.map((t, k) => ({ name: `${t}_end`, parent: t, head: ends[k]! }))] };
    expect([bind(s.skeleton, { recognition: rec, restWorld: s.restWorld }).rest.H0, bind(soles, { recognition: rec, restWorld: s.restWorld }).rest.H0]).toEqual([930, 930.35]);
  });
  it("reads the biggest skin's joints, each bone's parent the nearest joint above it (a helper node between left out)", () => {
    const s = skeletonOfGltf(skinned());
    expect([s.skeleton.bones, s.nodes, s.unread]).toEqual([[{ name: "A", parent: null, head: [0, 1, 0] }, { name: "B", parent: "A", head: [0, 2, 0] }], [0, 2], null]);
  });
  it("keeps a joint no vertex is weighted to only above one of its skin's own, through joints, as three's bind climbs", () => {
    // every vertex B's: A, above B through the helper node, stays out
    const onlyB = [[1, 0], [1, 0], [1, 0], [1, 0]], B = { name: "B", parent: null, head: [0, 2, 0] };
    expect(skeletonOfGltf(skinned({}, onlyB)).skeleton.bones).toEqual([B]);
    // D (a joint of the small skin, under A) moves a hat; A stays out still: three's bind climbs from its own skeleton's
    const nodes = [{ name: "A", translation: [0, 1, 0], children: [1, 5] }, { name: "helper", translation: [0, 0.5, 0], children: [2] }, { name: "B", translation: [0, 0.5, 0] }, { name: "C" }, { name: "Body", mesh: 0, skin: 0 }, { name: "D" }, { name: "Hat", mesh: 0, skin: 1 }];
    expect(skeletonOfGltf(skinned({ skins: [{ joints: [0, 2] }, { joints: [3, 5] }], nodes }, onlyB)).skeleton.bones).toEqual([B]);
    // weights it can't read (an accessor past its buffer): every joint kept, and why
    const broken = skeletonOfGltf(skinned({ accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: "VEC3" }, { bufferView: 1, componentType: 5121, count: 4, type: "VEC4" }, { bufferView: 2, componentType: 5126, count: 40, type: "VEC4" }] }, onlyB));
    expect([broken.nodes, broken.unread]).toEqual([[0, 2], "unreadable"]);
  });
  it("reads where a joint's mesh ends: of its vertices weighted half or more, the farthest across the ground, down to the lowest", () => {
    // B's vertices: the first (2 m up, 0.3 out), the second (1.1 m up) and the last (its weights summed to 1: 2/3 to B,
    // 5/3 m up, 0.5 out, the farthest); the third, 0.4 to B, is A's; the mesh node's 1 m along x ignored, as three's
    // bind matrix cancels it
    const [b, a, c] = meshEnds(skinned(), [2, 0, 3]);
    for (const [got, want] of [[b, [0, 1.1, 0.5]], [a, [0, 0.4, 2]]] as const) for (let k = 0; k < 3; k++) expect(got![k]).toBeCloseTo(want[k], 6);
    expect([c, meshEnds(skinned({ extensionsRequired: ["KHR_draco_mesh_compression"] }), [2, 0])]).toEqual([null, [null, null]]);
  });
  it("reads every generated character as generated: names, parents, heads, rest frames; unweighted leaves left out", () => {
    for (const seed of TEST_SEEDS) {
      const spec = variant(seed), { glb, bones } = character(spec), s = skeletonOfGltf(parseGlb(glb)), rec = recognize(s.skeleton);
      const kept = new Set(s.skeleton.bones.map((b) => b.name)), left = bones.filter((b) => !kept.has(b.name));
      // left out: only leaves that play no humanoid bone (twist leaves, which the body's tubes don't weight)
      expect(left.filter((b) => b.humanoid || bones.some((c) => c.parent === b.name)), spec.id).toEqual([]);
      for (const b of s.skeleton.bones) {
        const g = bones.find((x) => x.name === b.name)!, child = bones.find((c) => c.parent === b.name && c.humanoid);
        expect(b.parent, `${spec.id} ${b.name}`).toBe(g.parent);
        for (let k = 0; k < 3; k++) expect(b.head![k]).toBeCloseTo(g.head[k]!, 12);
        // each bone's +y runs along it to its humanoid child (Blender's, Mixamo's and UE5's frames; VRM's are the world's)
        if (!child) continue;
        const d = child.head.map((v, k) => v - g.head[k]!), l = Math.hypot(...d), y = math.quat.rotate([0, 0, 0], s.restWorld[b.name]!, [0, 1, 0]);
        const want = spec.naming === "vrm" ? [0, 1, 0] : d.map((v) => v / l);
        for (let k = 0; k < 3; k++) expect(y[k]!, `${spec.id} ${b.name}`).toBeCloseTo(want[k]!, 9);
      }
      for (const b of bones.filter((x) => x.humanoid)) expect(rec.bones[b.humanoid!], `${spec.id} ${b.humanoid}`).toBe(b.name);
    }
  });
  it("keeps every joint of a VRM, 1.0 or 0.x (its humanoid names them), and of a mesh whose weights it can't read, saying why", () => {
    const { glb, bones } = character(variant(4)), doc = parseGlb(glb), repack = (extra: object) => skeletonOfGltf(parseGlb(packGlb({ ...doc.json, ...extra }, doc.bin!.raw())));
    const kept = (extra: object) => [repack(extra).skeleton.bones.length, repack(extra).unread];
    expect(skeletonOfGltf(doc).skeleton.bones.length).toBeLessThan(bones.length);
    expect([kept({ extensions: { VRMC_vrm: { specVersion: "1.0" } } }), kept({ extensions: { VRM: {} } })]).toEqual([[bones.length, null], [bones.length, null]]);
    expect(kept({ extensionsRequired: ["EXT_meshopt_compression"] })).toEqual([bones.length, "EXT_meshopt_compression"]);
    expect(kept({ extensionsRequired: ["KHR_materials_variants"] })[0]).toBeLessThan(bones.length);
  });
  it("names a bone with no name, or a name taken, for its node; refuses no bones and a joint past the nodes", () => {
    const s = skeletonOfGltf(gltf({ nodes: [{ name: "a", children: [1, 2] }, { name: "a" }, { translation: [0, 2, 0] }] }));
    expect(s.skeleton.bones).toEqual([{ name: "a", parent: null, head: [0, 0, 0] }, { name: "a_node1", parent: "a", head: [0, 0, 0] }, { name: "node2", parent: "a", head: [0, 2, 0] }]);
    const refusal = (f: () => unknown): unknown => {
      try {
        return f();
      } catch (err) {
        return err instanceof IoError ? [err.code, err.message] : err;
      }
    };
    expect(refusal(() => skeletonOfGltf(gltf({ nodes: [] })))).toEqual(["E_RIG", "no bones: a character's skeleton is its skin's joints, or its nodes"]);
    expect(refusal(() => skeletonOfGltf(gltf({ nodes: [{ name: "a" }], skins: [{ joints: [0, 3] }] })))).toEqual(["E_FORMAT", "a skin names joint 3, which doesn't exist"]);
  });
});

describe("skeletonOfGltf on the real CC0 rigs", () => {
  // the mannequin's mesh is compressed (its weights unread: all 65 joints kept); 20 of the knight's 41 joints deform
  // nothing (IK targets, pole and roll controls, hand slots), which recognition by shape would take for limbs
  const WANT: Record<string, [number, Record<string, string>]> = {
    "quaternius-mannequin-m": [65, { hips: "pelvis", spine: "spine_01", head: "Head", leftShoulder: "clavicle_l", leftUpperArm: "upperarm_l", leftLowerArm: "lowerarm_l", leftHand: "hand_l", rightUpperLeg: "thigh_r", rightLowerLeg: "calf_r", rightFoot: "foot_r", rightToes: "ball_r" }],
    "kaykit-knight": [21, { hips: "hips", spine: "spine", chest: "chest", head: "head", leftUpperArm: "upperarm.l", leftLowerArm: "lowerarm.l", leftHand: "wrist.l", rightUpperLeg: "upperleg.r", rightLowerLeg: "lowerleg.r", rightFoot: "foot.r", rightToes: "toes.r" }],
  };
  for (const [id, [n, want]] of Object.entries(WANT)) {
    it(`reads ${id}'s ${n} bones so that each limb maps to its own, its rest T`, (ctx) => {
      const bytes = rigBytes(id);
      if (!bytes) return ctx.skip(`${id} isn't fetched: npm run fixtures -- fetch`);
      const s = skeletonOfGltf(parseGlb(bytes)), rec = recognize(s.skeleton), b = bind(s.skeleton, { recognition: rec, restWorld: s.restWorld });
      expect([s.skeleton.bones.length, rec.missing, b.frame.kind, s.unread]).toEqual([n, [], "T", id === "kaykit-knight" ? null : "EXT_meshopt_compression"]);
      expect(rec.bones).toMatchObject(want);
      expect(s.skeleton.bones.filter((x) => /IK|^control-|slot/.test(x.name))).toEqual([]);
    });
  }
});
