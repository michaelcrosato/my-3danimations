// Binding (WP-4.3): every test character binds with no hand mapping (the 20 generated, a held-out seed, and the real
// rigs once fetched), its bone lengths measured as generated; a deliberately renamed rig binds through topology with
// its confidence stated; a character placed anywhere binds the same; a missing bone fails with a report that says how
// to patch it, and the patch binds it; the report reads in 20 lines or fewer.
import { Group, type Bone } from "three";
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

describe("binding the real CC0 rigs", () => {
  for (const id of ["quaternius-mannequin-m", "kaykit-knight"]) {
    it(`binds ${id} with no hand mapping`, async (ctx) => {
      const bytes = rigBytes(id);
      if (!bytes) return ctx.skip(`${id} isn't fetched: npm run fixtures -- fetch`);
      const b = bind((await loadGlb(bytes, { textures: false })).scene);
      expect(b.report.missing).toEqual([]);
      expect(b.report.text.split("\n").length).toBeLessThanOrEqual(20);
      console.log(`${id}:\n${b.report.text}`);
    });
  }
});
