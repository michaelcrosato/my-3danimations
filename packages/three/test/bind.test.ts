// Binding (WP-4.3): every test character binds with no hand mapping (the 20 generated, a held-out seed, and the real
// rigs once fetched), its bone lengths measured as generated; a deliberately renamed rig binds through topology with
// its confidence stated; a character placed anywhere binds the same; a missing bone fails with a report that says how
// to patch it, and the patch binds it; control bones that deform nothing are left out; the real rigs map each limb to
// its own bones; the report reads in 20 lines or fewer.
import { Bone, Group, Matrix4 } from "three";
import { describe, expect, it } from "vitest";
import { rigBytes } from "../../../tools/fixtures/fixtures.ts";
import { bind } from "../src/index.ts";
import { character, loadGlb, TEST_SEEDS, variant } from "../test-characters/index.ts";

const load = async (seed: number) => {
  const spec = variant(seed), { glb, bones } = character(spec);
  return { spec, bones, loaded: await loadGlb(glb) };
};
/** A generated bone chain's length in mm, from a humanoid bone's head to the next's. */
const length = (bones: ReturnType<typeof character>["bones"], a: string, b: string) => {
  const p = bones.find((x) => x.humanoid === a)!.head, q = bones.find((x) => x.humanoid === b)!.head;
  return Math.round(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 1000);
};

describe("binding the test characters", () => {
  it("binds every generated character with no hand mapping, its lengths as generated and its rest as written", async () => {
    for (const seed of [...TEST_SEEDS, 1000]) {
      const { spec, bones, loaded } = await load(seed), b = bind(loaded.scene);
      expect([b.report.missing, b.report.method, b.report.rest.kind], spec.id).toEqual([[], "table", spec.rest]);
      expect(b.report.lengths.leftUpperArm, `${spec.id} upper arm`).toBe(length(bones, "leftUpperArm", "leftLowerArm"));
      expect(b.report.lengths.rightLowerLeg, `${spec.id} shin`).toBe(length(bones, "rightLowerLeg", "rightFoot"));
      expect(b.humanoid.hips!.isBone).toBe(true);
      expect(b.core.bones.leftHand).toBe(b.humanoid.leftHand!.name);
      expect(b.report.text.split("\n").length).toBeLessThanOrEqual(20);
    }
  });
  it("binds a deliberately renamed rig through topology, stating its confidence", async () => {
    const { bones, loaded } = await load(1);
    loaded.skinned[0]!.skeleton.bones.forEach((x: Bone, i: number) => (x.name = `node${i}`));
    const b = bind(loaded.scene);
    expect([b.report.method, b.report.missing]).toEqual(["topology", []]);
    expect(b.report.text).toMatch(/recognized by topology \(names matched no table\), confidence 0\.\d\d/);
    expect(b.report.lengths.leftLowerArm).toBe(length(bones, "leftLowerArm", "leftHand"));
  });
  it("binds a character placed anywhere the same: skeleton space is the character's own", async () => {
    const { loaded } = await load(3), at = bind(loaded.scene);
    const group = new Group();
    group.position.set(5, 2, -3);
    group.rotation.set(0, 1.2, 0.3);
    group.add(loaded.scene);
    const moved = bind(loaded.scene);
    expect([moved.report.lengths, moved.report.rest.kind]).toEqual([at.report.lengths, at.report.rest.kind]);
    expect(moved.core.restPts).toEqual(at.core.restPts);
  });
  it("fails on a missing bone with a report that says how to patch it, and binds with the patch", async () => {
    const { loaded } = await load(0), b = bind(loaded.scene), hand = b.report.patch.bones.leftHand!;
    let text = "";
    try {
      bind(loaded.scene, { mapping: { bones: { leftHand: null } } });
    } catch (err) {
      text = (err as Error).message;
    }
    expect(text).toMatch(/^bind:\nbind .*\nrest: .*\nmapped: .*\nmissing: leftHand\n/);
    expect(text).toMatch(/patch: write each missing bone's source bone into "bones"/);
    // the report's patch, written to a file and read back, with the hand filled in: binds
    const file = JSON.parse(JSON.stringify({ bones: { ...b.report.patch.bones, leftHand: hand } }));
    expect(bind(loaded.scene, { mapping: file }).report.missing).toEqual([]);
    expect(() => bind(loaded.scene, { mapping: { bones: { leftHand: "no_such_bone" } } })).toThrow(/the skeleton has no bone "no_such_bone"/);
  });
});

describe("control bones", () => {
  it("leaves out bones that deform nothing (a rig's IK and roll controls), which topology would take for limbs", async () => {
    const { bones, loaded } = await load(1), mesh = loaded.skinned[0]!, top = mesh.skeleton.bones[0]!;
    // three chains of IK controls hung off the top bone, weighted to nothing
    for (const side of ["l", "r", "c"]) {
      let parent: Bone = top;
      for (let i = 0; i < 4; i++) {
        const c = new Bone();
        c.name = `ctrl_${side}${i}`;
        c.position.set(side === "l" ? 0.2 : side === "r" ? -0.2 : 0, -0.1, 0.3);
        parent.add(c);
        mesh.skeleton.bones.push(c);
        mesh.skeleton.boneInverses.push(new Matrix4());
        parent = c;
      }
    }
    loaded.skinned[0]!.skeleton.bones.forEach((x: Bone, i: number) => (x.name = x.name.startsWith("ctrl_") ? x.name : `node${i}`));
    const b = bind(loaded.scene);
    expect(b.bones.some((x) => x.name.startsWith("ctrl_"))).toBe(false);
    expect([b.report.method, b.report.missing, b.report.lengths.leftLowerArm]).toEqual(["topology", [], length(bones, "leftLowerArm", "leftHand")]);
  });
});

describe("binding the real CC0 rigs", () => {
  const WANT: Record<string, Record<string, string>> = {
    "quaternius-mannequin-m": { hips: "pelvis", spine: "spine_01", head: "Head", leftShoulder: "clavicle_l", leftUpperArm: "upperarm_l", leftLowerArm: "lowerarm_l", leftHand: "hand_l", rightUpperLeg: "thigh_r", rightLowerLeg: "calf_r", rightFoot: "foot_r", rightToes: "ball_r" },
    "kaykit-knight": { hips: "hips", spine: "spine", chest: "chest", head: "head", leftUpperArm: "upperarml", leftLowerArm: "lowerarml", leftHand: "wristl", rightUpperLeg: "upperlegr", rightLowerLeg: "lowerlegr", rightFoot: "footr", rightToes: "toesr" },
  };
  for (const [id, want] of Object.entries(WANT)) {
    it(`binds ${id} with no hand mapping, each limb to its own bones`, async (ctx) => {
      const bytes = rigBytes(id);
      if (!bytes) return ctx.skip(`${id} isn't fetched: npm run fixtures -- fetch`);
      const b = bind((await loadGlb(bytes, { textures: false })).scene);
      expect(b.report.missing).toEqual([]);
      expect(b.core.recognition.bones).toMatchObject(want);
      expect(b.report.rest.kind).toBe("T");
      expect(b.report.text.split("\n").length).toBeLessThanOrEqual(20);
      console.log(`${id}:\n${b.report.text}`);
    });
  }
});
