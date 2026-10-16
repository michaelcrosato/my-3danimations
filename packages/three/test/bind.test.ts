// Binding (WP-4.3): every test character binds with no hand mapping (the 20 generated, a held-out seed, and the real
// rigs once fetched), its bone lengths measured as generated; a deliberately renamed rig binds through topology with
// its confidence stated; a character placed anywhere binds the same; a missing bone fails with a report that says how
// to patch it, and the patch binds it; control bones that deform nothing are left out; the real rigs map each limb to
// its own bones; the report reads in 20 lines or fewer. The soles are read from every mesh that skins the feet: rigs
// whose feet one mesh skins bind exactly as before, and KayKit's knight (its feet in its leg meshes) stands on them. A
// patch names a bone as three does or as the file does (the tools' patch, H1), and one it lacks either way as given.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Bone, Group, Matrix4, Vector3, type SkinnedMesh } from "three";
import { describe, expect, it } from "vitest";
import { Animator, parseClip, playable, type Rest } from "@m3a/core";
import { rigBytes, type Manifest } from "../../../tools/fixtures/fixtures.ts";
import { attach, bind } from "../src/index.ts";
import { character, loadGlb, TEST_SEEDS, variant } from "../test-characters/index.ts";

/** One library clip and its rest, as tools/qa's libraryClips gives it, read alone rather than with the whole library. */
const libraryClip = (set: string, name: string) => {
  const dir = join(import.meta.dirname, "../../../library/sets", set), clip = parseClip(readFileSync(join(dir, `${name}.json`), "utf8"));
  return { set, clip, rest: (JSON.parse(readFileSync(join(dir, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> }).sources[clip.restSrc]!.rest };
};
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
  it("takes a patch naming bones as the file does (the tools' patch) as it takes three's names: Rigify's DEF-forearm.L is three's DEF-forearmL (H1)", async () => {
    const { scene } = (await load(3)).loaded; // gen-3 is named as Rigify names bones
    const arms = (up: string, low: string) => bind(scene, { mapping: { bones: { leftUpperArm: up, leftLowerArm: low } } }).core.bones;
    expect(arms("DEF-forearm.L", "DEF-upper_arm.L")).toEqual({ ...arms("DEF-forearmL", "DEF-upper_armL"), leftUpperArm: "DEF-forearmL", leftLowerArm: "DEF-upper_armL" });
    expect(() => arms("DEF forearm.L", "DEF-upper_arm.L")).toThrow(/the skeleton has no bone "DEF forearm\.L"/);
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

describe("the soles, read from every mesh that skins the feet", () => {
  /** Each bound rest's hash (the rest, its points, the bones' heads, the origin) as bind read it from the mesh with the
   *  most bones alone (at 382b153): rigs whose feet that mesh skins must bind exactly as they did. */
  const BEFORE: Record<string, string> = {
    "gen-0": "b6cf1c46301e8923", "gen-1": "d7435556d9cdcc9b", "gen-2": "c6d242e3909742ca", "gen-3": "5fb5d0417f8df5ef", "gen-4": "af94dbbbf5931f8c", "gen-5": "b549627571cc0d61", "gen-6": "52d162fe7fecc12f",
    "gen-7": "23787977ce6c3b76", "gen-8": "6c4587e1e220070f", "gen-9": "3630d5f7dfb7393b", "gen-10": "157ee7b082174b7d", "gen-11": "275998876679307d", "gen-12": "2219508dc165e654", "gen-13": "085b1a01948364fa",
    "gen-14": "ae0f1e7dfa7f0954", "gen-15": "ace4b899256ff368", "gen-16": "9c75782c2cbade43", "gen-17": "3bc9e2b96844e606", "gen-18": "4543f69daddd813c", "gen-19": "cb4439d1a2d7c7e1", "gen-1000": "bf62ddbe26ea1a4f",
    "quaternius-mannequin-m": "ab4fc8d0fc43a263", "quaternius-mannequin-f": "1bdd6e287ae6ec22", "orangejuice-male-base": "250341337437fbc4",
  };
  const HELDOUT = JSON.parse(readFileSync(join(import.meta.dirname, "../../../bench/results/heldout/G4/run-1/rig.json"), "utf8")) as Manifest;
  const hash = (c: ReturnType<typeof bind>["core"]) => createHash("sha256").update(JSON.stringify([c.rest, [...c.restPts], c.order, c.origin])).digest("hex").slice(0, 16);
  it("binds the generated characters, the mannequins (two meshes each) and G4's first held-out rig exactly as before", async () => {
    const got: Record<string, string> = {}, want: Record<string, string> = {};
    for (const [id, h] of Object.entries(BEFORE)) {
      const gen = /^gen-(\d+)$/.exec(id), bytes = gen ? character(variant(Number(gen[1]))).glb : rigBytes(id, id === "orangejuice-male-base" ? HELDOUT : undefined);
      // a real rig not fetched is left out (npm run fixtures -- fetch); the generated ones always bind
      if (!bytes) continue;
      got[id] = hash(bind((await loadGlb(bytes, { textures: false })).scene).core);
      want[id] = h;
    }
    expect(Object.keys(got).length).toBeGreaterThanOrEqual(21);
    expect(got).toEqual(want);
  });
  it("stands KayKit's knight on its soles at idle: its feet are in its leg meshes, not its arm's (the most bones)", async (ctx) => {
    const bytes = rigBytes("kaykit-knight");
    if (!bytes) return ctx.skip("kaykit-knight isn't fetched: npm run fixtures -- fetch");
    const loaded = await loadGlb(bytes, { textures: false }), b = bind(loaded.scene);
    expect(b.mesh!.name).toBe("Knight_ArmLeft");
    // the ground under the rest hips is the boots' soles (y = 0 in the model), not the toes' joints 26 mm above them
    expect(Math.abs(b.core.origin[1]) * 1000).toBeLessThan(1);
    // played as a game plays it: the boots' lowest vertex (half or more on a foot or toe bone) within 5 mm of the floor
    const c = libraryClip("QUATERNIUS_3D2DGE", "Idle_Loop"), player = attach(new Animator(b.core).layer("base", { clip: playable(c.clip, c.rest) }), b);
    const feet = new Set(["leftFoot", "rightFoot", "leftToes", "rightToes"].map((h) => b.humanoid[h]!)), boots: [SkinnedMesh, number][] = [];
    for (const m of loaded.skinned) {
      const idx = m.geometry.getAttribute("skinIndex"), w = m.geometry.getAttribute("skinWeight");
      for (let k = 0; k < idx.count; k++) {
        let on = 0;
        for (let j = 0; j < idx.itemSize; j++) if (feet.has(m.skeleton.bones[idx.getComponent(k, j)]!)) on += w.getComponent(k, j);
        if (on >= 0.5) boots.push([m, k]);
      }
    }
    const v = new Vector3();
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < c.clip.dur; t += 1 / 30) {
      player.update(1 / 30);
      loaded.scene.updateMatrixWorld(true);
      let low = Infinity;
      for (const [m, k] of boots) low = Math.min(low, m.applyBoneTransform(k, v.fromBufferAttribute(m.geometry.getAttribute("position"), k)).applyMatrix4(m.matrixWorld).y * 1000);
      [lo, hi] = [Math.min(lo, low), Math.max(hi, low)];
    }
    expect([lo > -5, hi < 5], `the boots' lowest point at idle: ${lo.toFixed(1)} to ${hi.toFixed(1)} mm`).toEqual([true, true]);
  });
});
