// A glTF character's skeleton for core's bind (WP-7.2b, I1): tier 1b's skinless rig reads as the conformance skeleton
// exactly; its Rigify rig (a skin, its root rotated and scaled) binds by name at its hip height, its soles' end bones
// (D49) included; every generated test character reads as generated, an armature's 0.01 scale and each bone's rest
// frame included, the leaves no vertex is weighted to left out (a VRM, 1.0 or 0.x, keeps them, as do weights it can't
// read, which it says, but not another required extension); the biggest skin a mesh uses is read (a bigger one no mesh
// uses passed over), a bone's parent the nearest joint above it; a joint no vertex is weighted to is kept only above
// one of the skin's own, through joints (not a helper node, nor from another skin's joint), one only another skin's
// mesh moves kept, a vertex weighted to nothing counting its first joint (three's loader's), every joint kept when no
// mesh is skinned; where a joint's mesh ends, exactly (half its weight or more, summed to 1, a vertex weighted to
// nothing its first joint's, in every mesh a skin naming it skins, farthest across the ground, down to the lowest, the
// skinned mesh node's own transform ignored), or why it read none; signed and unsigned bytes and shorts read,
// normalized or not, a sparse accessor refused; the real CC0 rigs, when fetched, map each limb to its own bones,
// KayKit's IK and roll controls left out; names are unique; no bones, a joint past the nodes, or a bone whose rest head
// the node transforms overflow, refused.
import { bind, math, recognize } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { IoError, meshEnds, packGlb, parseGlb, parseGltf, skeletonOfGltf } from "../src/index.ts";
import { accessor } from "../src/gltf/read.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { tier1bText } from "../../../spec/conformance/runner/vectors.ts";
import { rigBytes } from "../../../tools/fixtures/fixtures.ts";
import { character } from "../../three/test-characters/characters.ts";
import { TEST_SEEDS, variant } from "../../three/test-characters/variants.ts";

const gltf = (json: object) => parseGltf(JSON.stringify({ asset: { version: "2.0" }, ...json }));
/** A mesh for skinned(): its vertices, each weighted [w0, w1] to joints [J0, J1] of the skin that skins it. */
interface Part {
  P: number[][];
  W: number[][];
  J?: [number, number];
}
/** A small skinned glTF: C alone in a skin of one, and A (1 m up) and B (2 m up, a helper node between) in a skin of two
 *  that a mesh node moved 1 m along x skins (a move glTF says to ignore): four vertices `P`, each weighted `W` [to B, to
 *  A] (by default the last's weights summing to 0.6). Each of `more` is a mesh more (mesh 1, 2, ...), for `extra`'s
 *  nodes to skin, its joints [1, 0] of its skin unless it says. */
function skinned(extra: object = {}, W = [[1, 0], [0.6, 0.4], [0.4, 0.6], [0.4, 0.2]], P = [[0, 0, 0.3], [0, -0.5, 0.1], [0, -1, 2], [0, 0, 0.5]], more: Part[] = []) {
  const parts: Part[] = [{ P, W }, ...more], size = parts.reduce((n, m) => n + m.P.length * 32, 0), bin = new Uint8Array(size), f = new Float32Array(bin.buffer);
  const accessors: object[] = [], bufferViews: object[] = [];
  let at = 0;
  const view = (byteLength: number, componentType: number, count: number, type: string) => {
    accessors.push({ bufferView: bufferViews.length, componentType, count, type });
    bufferViews.push({ buffer: 0, byteOffset: at, byteLength });
    at += byteLength;
  };
  for (const m of parts) {
    const n = m.P.length, [j0, j1] = m.J ?? [1, 0];
    m.P.forEach((p, v) => f.set(p, at / 4 + v * 3));
    view(12 * n, 5126, n, "VEC3");
    m.W.forEach((_, v) => bin.set([j0, j1, 0, 0], at + v * 4));
    view(4 * n, 5121, n, "VEC4");
    m.W.forEach((w, v) => f.set([...w, 0, 0], at / 4 + v * 4));
    view(16 * n, 5126, n, "VEC4");
  }
  return parseGlb(packGlb({
    asset: { version: "2.0" }, skins: [{ joints: [3] }, { joints: [0, 2] }], meshes: parts.map((_, k) => ({ primitives: [{ attributes: { POSITION: 3 * k, JOINTS_0: 3 * k + 1, WEIGHTS_0: 3 * k + 2 } }] })),
    nodes: [{ name: "A", translation: [0, 1, 0], children: [1] }, { name: "helper", translation: [0, 0.5, 0], children: [2] }, { name: "B", translation: [0, 0.5, 0] }, { name: "C" }, { name: "Body", mesh: 0, skin: 1, translation: [1, 0, 0] }],
    accessors, bufferViews, buffers: [{ byteLength: size }], ...extra,
  }, bin));
}
/** skinned()'s nodes, with a shoe (mesh 1) that skin 2, B's alone, skins. */
const SHOE = { skins: [{ joints: [3] }, { joints: [0, 2] }, { joints: [2] }], nodes: [{ name: "A", translation: [0, 1, 0], children: [1] }, { name: "helper", translation: [0, 0.5, 0], children: [2] }, { name: "B", translation: [0, 0.5, 0] }, { name: "C" }, { name: "Body", mesh: 0, skin: 1 }, { name: "Shoe", mesh: 1, skin: 2 }] };

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
    const toes = ["DEF-toe.L", "DEF-toe.R"], { ends } = meshEnds(doc, toes.map((t) => s.nodes[s.skeleton.bones.findIndex((b) => b.name === t)]!));
    const soles = { ...s.skeleton, bones: [...s.skeleton.bones, ...toes.map((t, k) => ({ name: `${t}_end`, parent: t, head: ends[k]! }))] };
    expect([bind(s.skeleton, { recognition: rec, restWorld: s.restWorld }).rest.H0, bind(soles, { recognition: rec, restWorld: s.restWorld }).rest.H0]).toEqual([930, 930.35]);
  });
  it("reads the joints of the biggest skin a mesh uses, each bone's parent the nearest joint above it (a helper node between left out)", () => {
    const s = skeletonOfGltf(skinned()), AB = [{ name: "A", parent: null, head: [0, 1, 0] }, { name: "B", parent: "A", head: [0, 2, 0] }];
    expect([s.skeleton.bones, s.nodes, s.unread]).toEqual([AB, [0, 2], null]);
    // a bigger skin (C, D, E) no mesh uses (D, meshless, names it) is passed over, as three's bind takes the skinned
    // mesh with the most bones
    const nodes = [...SHOE.nodes.slice(0, 5), { name: "D", skin: 2 }, { name: "E" }];
    expect(skeletonOfGltf(skinned({ skins: [{ joints: [3] }, { joints: [0, 2] }, { joints: [3, 5, 6] }], nodes })).skeleton.bones).toEqual(AB);
  });
  it("keeps a joint no vertex is weighted to only above one of its skin's own, through joints, as three's bind climbs", () => {
    // every vertex B's: A, above B through the helper node, stays out
    const onlyB = [[1, 0], [1, 0], [1, 0], [1, 0]], B = { name: "B", parent: null, head: [0, 2, 0] };
    expect(skeletonOfGltf(skinned({}, onlyB)).skeleton.bones).toEqual([B]);
    // D (a joint of the small skin, under A) moves a hat; A stays out still: three's bind climbs from its own skeleton's
    const nodes = [{ name: "A", translation: [0, 1, 0], children: [1, 5] }, { name: "helper", translation: [0, 0.5, 0], children: [2] }, { name: "B", translation: [0, 0.5, 0] }, { name: "C" }, { name: "Body", mesh: 0, skin: 0 }, { name: "D" }, { name: "Hat", mesh: 0, skin: 1 }];
    expect(skeletonOfGltf(skinned({ skins: [{ joints: [0, 2] }, { joints: [3, 5] }], nodes }, onlyB)).skeleton.bones).toEqual([B]);
    // weights it can't read (an accessor past its buffer): every joint kept, and why
    const doc = skinned({}, onlyB);
    doc.json.accessors![2]!.count = 40;
    expect([skeletonOfGltf(doc).nodes, skeletonOfGltf(doc).unread]).toEqual([[0, 2], "unreadable"]);
  });
  it("keeps a joint only another skin's mesh moves, a vertex weighted to nothing its first joint's, and every joint when no mesh is skinned", () => {
    const A = { name: "A", parent: null, head: [0, 1, 0] }, B = { name: "B", parent: "A", head: [0, 2, 0] }, onlyA = [[0, 1], [0, 1], [0, 1], [0, 1]];
    // the body moves A alone; B is the shoe's, a smaller skin's (three's bind counts a bone any skinned mesh moves)
    expect(skeletonOfGltf(skinned(SHOE, onlyA, undefined, [{ P: [[0, -1.5, 3]], W: [[1, 0]], J: [0, 0] }])).skeleton.bones).toEqual([A, B]);
    // weighted to nothing: three's loader gives the vertex's first joint (B) its whole weight
    expect(skeletonOfGltf(skinned({}, [[0, 0], [0, 0], [0, 0], [0, 0]])).skeleton.bones).toEqual([{ ...B, parent: null }]);
    // a skin no mesh node uses: nothing tells the controls from the bones, so every joint is kept
    expect(skeletonOfGltf(skinned({ nodes: [...SHOE.nodes.slice(0, 4), { name: "Body", mesh: 0 }] }, onlyA)).skeleton.bones).toEqual([A, B]);
  });
  it("reads where a joint's mesh ends: of its vertices weighted half or more, the farthest across the ground, down to the lowest", () => {
    // B's vertices: the first (2 m up, 0.3 out), the second (1.1 m up) and the last (its weights summed to 1: 2/3 to B,
    // 5/3 m up, 0.5 out, the farthest); the third, 0.4 to B, is A's; the mesh node's 1 m along x ignored, as three's
    // bind matrix cancels it
    const near = (got: (number[] | null)[], want: number[][]) => want.forEach((w, j) => w.forEach((x, k) => expect(got[j]![k], `${j} ${k}`).toBeCloseTo(x, 6)));
    const { ends: [b, a, c], unread } = meshEnds(skinned(), [2, 0, 3]);
    near([b!, a!], [[0, 1.1, 0.5], [0, 0.4, 2]]);
    expect([c, unread]).toEqual([null, null]);
    // exactly half to B counts (0.9 out, the farthest), 0.55 too (0.7 out), 0.45 not (1.2 out: A's); the lowest, B's alone
    const half = skinned({}, [[0.5, 0.5], [0.55, 0.45], [1, 0], [0.45, 0.55]], [[0, 0, 0.9], [0, 0, 0.7], [0, -1, 0.3], [0, 0, 1.2]]);
    near(meshEnds(half, [2, 0]).ends, [[0, 1, 0.9], [0, 1.45, 1.2]]);
    // B's foot in a shoe a smaller skin skins (3 m out, 0.5 m up) is read with the body's: every mesh that skins B
    near(meshEnds(skinned(SHOE, undefined, undefined, [{ P: [[0, -1.5, 3]], W: [[1, 0]], J: [0, 0] }]), [2]).ends, [[0, 0.5, 3]]);
    // every vertex weighted to nothing: its first joint's (B's) alone, as three's loader gives it; A has none
    const zero = meshEnds(skinned({}, [[0, 0], [0, 0], [0, 0], [0, 0]]), [2, 0]).ends;
    near([zero[0]!], [[0, 1, 2]]);
    expect(zero[1]).toBeNull();
  });
  it("reads no end, and says why, from a mesh it can't read: compressed, a position past its buffer, sparse", () => {
    const past = skinned(), sparse = skinned();
    past.json.accessors![0]!.count = 40;
    Object.assign(sparse.json.accessors![0]!, { sparse: { count: 1, indices: { bufferView: 1, componentType: 5121 }, values: { bufferView: 0 } } });
    expect([meshEnds(skinned({ extensionsRequired: ["KHR_draco_mesh_compression"] }), [2, 0]), meshEnds(past, [2]), meshEnds(sparse, [2])]).toEqual([
      { ends: [null, null], unread: "KHR_draco_mesh_compression" },
      { ends: [null], unread: "accessor 0 of 480 byte(s) runs past the end (128 bytes) (at byte 0)" },
      { ends: [null], unread: "accessor 0 is sparse, which isn't read" },
    ]);
    // compressed, but no mesh skins the joint: nothing to read, nothing unread
    expect(meshEnds(skinned({ extensionsRequired: ["KHR_draco_mesh_compression"] }), [3])).toEqual({ ends: [null], unread: null });
  });
  it("reads signed and unsigned bytes and shorts, normalized (signed ones clamped at -1) or not", () => {
    const bin = new Uint8Array(32), dv = new DataView(bin.buffer);
    [-128, -127, -1, 0, 127, 255].forEach((x, k) => dv.setInt8(k, x));
    [-32768, -32767, -2, 1, 32767, 65535].forEach((x, k) => dv.setInt16(8 + 2 * k, x, true));
    const doc = parseGlb(packGlb({ asset: { version: "2.0" }, bufferViews: [{ buffer: 0, byteLength: 6 }, { buffer: 0, byteOffset: 8, byteLength: 12 }], buffers: [{ byteLength: 32 }],
      accessors: [5120, 5121, 5122, 5123].flatMap((componentType) => [false, true].map((normalized) => ({ bufferView: componentType < 5122 ? 0 : 1, componentType, normalized, count: 6, type: "SCALAR" }))) }, bin));
    const got = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => accessor(doc.json, doc.bin, i, "SCALAR"));
    expect(got.filter((_, i) => i % 2 === 0)).toEqual([[-128, -127, -1, 0, 127, -1], [128, 129, 255, 0, 127, 255], [-32768, -32767, -2, 1, 32767, -1], [32768, 32769, 65534, 1, 32767, 65535]]);
    expect(got.filter((_, i) => i % 2 === 1)).toEqual([[-1, -1, -1 / 127, 0, 1, -1 / 127], [128 / 255, 129 / 255, 1, 0, 127 / 255, 1], [-1, -1, -2 / 32767, 1 / 32767, 1, -1 / 32767], [32768 / 65535, 32769 / 65535, 65534 / 65535, 1 / 65535, 32767 / 65535, 1]]);
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
  it("names a bone with no name, or a name taken, for its node; refuses no bones, a joint past the nodes and a head the transforms overflow", () => {
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
    // each node's transform finite, their product not: Hips is 1e200 up, Spine (1e400 times its 1 m) past a double
    const big = [1e200, 1e200, 1e200], over = [{ name: "Root", scale: big, children: [1] }, { name: "Hips", scale: big, translation: [0, 1, 0], children: [2] }, { name: "Spine", translation: [0, 1, 0] }];
    expect(refusal(() => skeletonOfGltf(gltf({ nodes: over })))).toEqual(["E_RIG", "bone Spine's rest head isn't finite: the node transforms down to it overflow"]);
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
