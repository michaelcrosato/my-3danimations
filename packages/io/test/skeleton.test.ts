// A glTF character's skeleton for core's bind (WP-7.2b, I1): tier 1b's skinless rig reads as the conformance skeleton
// exactly; its Rigify rig (a skin, its root rotated and scaled) binds by name at its hip height; every generated test
// character reads as generated, an armature's 0.01 scale and each bone's rest frame included, the leaves no vertex is
// weighted to left out (a VRM keeps them, as do weights it can't read); the real CC0 rigs, when fetched, map each limb
// to its own bones, KayKit's IK and roll controls left out; names are unique; no bones, or a joint past the nodes, refused.
import { bind, math, recognize } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { IoError, packGlb, parseGlb, parseGltf, skeletonOfGltf } from "../src/index.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { tier1bText } from "../../../spec/conformance/runner/vectors.ts";
import { rigBytes } from "../../../tools/fixtures/fixtures.ts";
import { character } from "../../three/test-characters/characters.ts";
import { TEST_SEEDS, variant } from "../../three/test-characters/variants.ts";

const gltf = (json: object) => parseGltf(JSON.stringify({ asset: { version: "2.0" }, ...json }));

describe("skeletonOfGltf", () => {
  it("reads tier 1b's skinless rig as the conformance skeleton, bit for bit, every node a bone at rest unturned", () => {
    const s = skeletonOfGltf(parseGltf(tier1bText("rig.gltf")));
    expect(s.skeleton).toEqual(rigSkeleton());
    expect([s.nodes, new Set(Object.values(s.restWorld).map(String))]).toEqual([[...Array(34).keys()], new Set(["0,0,0,1"])]);
  });
  it("reads the Rigify rig's skin under its turned and scaled root, and binds it by name at its hip height", () => {
    const s = skeletonOfGltf(parseGltf(tier1bText("rigify.gltf"))), rec = recognize(s.skeleton);
    expect([s.skeleton.bones.length, rec.table, rec.confidence, rec.missing, rec.unmapped]).toEqual([31, "rigify", 1, [], ["root"]]);
    expect(s.skeleton.bones[1]).toMatchObject({ name: "DEF-hips", parent: "root" });
    expect(s.skeleton.bones[1]!.head![1]).toBeCloseTo(0.95, 12);
    expect(bind(s.skeleton, { recognition: rec, restWorld: s.restWorld }).rest.H0).toBe(930);
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
  it("keeps every joint of a VRM (its humanoid names them) and of a mesh whose weights it can't read", () => {
    const { glb, bones } = character(variant(4)), doc = parseGlb(glb), repack = (extra: object) => skeletonOfGltf(parseGlb(packGlb({ ...doc.json, ...extra }, doc.bin!.raw())));
    expect(skeletonOfGltf(doc).skeleton.bones.length).toBeLessThan(bones.length);
    expect(repack({ extensions: { VRMC_vrm: { specVersion: "1.0" } } }).skeleton.bones.length).toBe(bones.length);
    expect(repack({ extensionsRequired: ["EXT_meshopt_compression"] }).skeleton.bones.length).toBe(bones.length);
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
      expect([s.skeleton.bones.length, rec.missing, b.frame.kind]).toEqual([n, [], "T"]);
      expect(rec.bones).toMatchObject(want);
      expect(s.skeleton.bones.filter((x) => /IK|^control-|slot/.test(x.name))).toEqual([]);
    });
  }
});
