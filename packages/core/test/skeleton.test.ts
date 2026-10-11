// Tests for the skeleton profile (WP-1.4): recognition is exact on a fixture for every mapping table (namespaces and
// case stripped); the topology fallback maps renamed skeletons (long clavicles, no neck, twist bones, no head-top leaf)
// and reports its confidence; measure reproduces tier
// 1a's rests bit for bit; restPoints places the tiny rig's body points where the importer did.
import { describe, expect, it } from "vitest";
import { HUMANOID_BONES, HUMANOID_PARENT, measure, patchMapping, recognize, REQUIRED_BONES, restFrame, restPoints, TABLES, type Capture, type SkeletonIn } from "./all.ts";
import { firstDiff, loadTier1a, VECTORS } from "../../../spec/conformance/runner/vectors.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type V = [number, number, number];
/** A humanoid at rest in glTF's frame (metres, y up, facing +z, its left at +x), every VRM bone. */
const REST: Record<string, V> = (() => {
  const r: Record<string, V> = { hips: [0, 0.95, 0], spine: [0, 1.05, 0], chest: [0, 1.17, 0], upperChest: [0, 1.29, 0], neck: [0, 1.45, 0], head: [0, 1.55, 0], jaw: [0, 1.55, 0.05] };
  for (const [s, x] of [["left", 1], ["right", -1]] as const) {
    const at = (v: V): V => [v[0] * x, v[1], v[2]];
    Object.assign(r, {
      [`${s}Eye`]: at([0.03, 1.62, 0.08]), [`${s}Shoulder`]: at([0.03, 1.41, 0]), [`${s}UpperArm`]: at([0.18, 1.41, 0]), [`${s}LowerArm`]: at([0.46, 1.41, 0]), [`${s}Hand`]: at([0.71, 1.41, 0]),
      [`${s}UpperLeg`]: at([0.1, 0.93, 0]), [`${s}LowerLeg`]: at([0.1, 0.49, 0]), [`${s}Foot`]: at([0.1, 0.06, 0]), [`${s}Toes`]: at([0.1, 0, 0.13]),
      [`${s}ThumbMetacarpal`]: at([0.74, 1.41, 0.04]), [`${s}ThumbProximal`]: at([0.77, 1.41, 0.05]), [`${s}ThumbDistal`]: at([0.8, 1.41, 0.06]),
    });
    ["Index", "Middle", "Ring", "Little"].forEach((f, i) => ["Proximal", "Intermediate", "Distal"].forEach((j, k) => (r[`${s}${f}${j}`] = at([0.8 + 0.035 * k, 1.41, 0.03 - 0.02 * i]))));
  }
  return r;
})();

/** A skeleton named by `names` (humanoid bone -> source name), parents as the humanoid's nearest present ancestor. */
function skeleton(names: Record<string, string>, extraLeaves = true): SkeletonIn {
  const bones = Object.entries(names).map(([b, name]) => {
    let p = HUMANOID_PARENT[b] ?? null;
    while (p && !names[p]) p = HUMANOID_PARENT[p] ?? null;
    return { name, parent: p ? names[p]! : null, head: REST[b]! };
  });
  if (extraLeaves && names.head) bones.push({ name: "HeadTop_End", parent: names.head, head: [0, 1.75, 0] });
  return { bones };
}

/** A table's own names for the humanoid bones, decorated as exports do (namespaces, case). */
function tableNames(t: (typeof TABLES)[number], decorate: (n: string, i: number) => string): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(t.bones).forEach(([b, names], i) => (out[b] = decorate(names[0]!, i)));
  return out;
}

const DECORATIONS: [string, (n: string, i: number) => string][] = [
  ["as is", (n) => n],
  ["upper case", (n) => n.toUpperCase()],
  ["namespaced", (n, i) => (i % 2 ? `mixamorig:${n}` : `Armature|${n.toLowerCase()}`)],
  ["as three.js's loader sanitizes them", (n, i) => (i % 2 ? `mixamorig${n}` : `mixamorig1${n}`)],
];

describe("recognize: by name", () => {
  for (const t of TABLES) {
    for (const [how, decorate] of DECORATIONS) {
      it(`${t.name}, ${how}: every bone of the table, exactly`, () => {
        const names = tableNames(t, decorate);
        const rec = recognize(skeleton(names));
        expect(rec.method).toBe("table");
        expect(rec.table).toBe(t.name);
        expect(rec.bones).toEqual(names);
        expect(rec.missing).toEqual([]);
        expect(rec.confidence).toBe(1);
      });
    }
  }
  it("names the missing required bones and lets an agent patch them in", () => {
    const names = tableNames(TABLES.find((t) => t.name === "mixamo")!, (n) => n);
    const s = skeleton(names);
    s.bones.find((b) => b.name === "LeftForeArm")!.name = "LeftElbowTwist";
    s.bones.find((b) => b.parent === "LeftForeArm")!.parent = "LeftElbowTwist";
    const rec = recognize(s, { table: "mixamo" });
    expect(rec.missing).toEqual(["leftLowerArm"]);
    expect(rec.issues[0]).toMatch(/leftLowerArm/);
    const fixed = patchMapping(s, rec, { leftLowerArm: "LeftElbowTwist" });
    expect(fixed.missing).toEqual([]);
    expect(JSON.parse(JSON.stringify(fixed))).toEqual(fixed);
    expect(() => patchMapping(s, rec, { leftElbow: "x" })).toThrow(/not a VRM 1.0 humanoid bone/);
    // left to itself, recognize falls back to topology and finds the renamed bone
    expect(recognize(s).bones.leftLowerArm).toBe("LeftElbowTwist");
  });
});

describe("recognize: by topology", () => {
  it("maps a renamed Mixamo-shaped skeleton and reports its confidence", () => {
    const names = tableNames(TABLES.find((t) => t.name === "mixamo")!, (n) => n);
    const renamed = Object.fromEntries(Object.entries(names).map(([b], i) => [b, `bone_${(i * 37) % 101}`]));
    const rec = recognize(skeleton(renamed));
    expect(rec.method).toBe("topology");
    expect(rec.missing).toEqual([]);
    for (const b of [...REQUIRED_BONES, "chest", "upperChest", "neck", "leftShoulder", "rightShoulder", "leftToes", "rightToes"]) expect(rec.bones[b], b).toBe(renamed[b]);
    expect(rec.confidence).toBeGreaterThan(0.5);
    expect(rec.confidence).toBeLessThan(1);
    expect(rec.issues[0]).toMatch(/topology/);
  });
  it("maps the tiny test rig with every bone renamed", () => {
    const gltf = JSON.parse(readFileSync(join(VECTORS, "tier1b/rig.gltf"), "utf8")) as { nodes: { name: string; translation: number[]; children?: number[] }[] };
    const parent: Record<number, number> = {};
    gltf.nodes.forEach((n, i) => n.children?.forEach((c) => (parent[c] = i)));
    const world = (i: number): V => {
      const t = gltf.nodes[i]!.translation as V;
      if (parent[i] === undefined) return t;
      const p = world(parent[i]!);
      return [p[0] + t[0], p[1] + t[1], p[2] + t[2]];
    };
    const sk: SkeletonIn = { bones: gltf.nodes.map((n, i) => ({ name: `n${i}`, parent: parent[i] === undefined ? null : `n${parent[i]}`, head: world(i) })) };
    const rec = recognize(sk);
    const original = (n: string) => gltf.nodes[Number(n.slice(1))]!.name;
    const got = Object.fromEntries(Object.entries(rec.bones).map(([b, n]) => [b, original(n)]));
    expect(got).toMatchObject({ hips: "pelvis", spine: "spine_01", chest: "spine_02", upperChest: "spine_03", neck: "neck_01", head: "Head", leftUpperArm: "upperarm_l", rightHand: "hand_r", leftUpperLeg: "thigh_l", rightFoot: "foot_r", leftToes: "ball_l", leftShoulder: "clavicle_l" });
  });
  // rigs without fingers or a head-top leaf, renamed (WP-4.3's binding found these): the body's bones only, then edited
  const BODY = ["hips", "spine", "chest", "upperChest", "neck", "head", ...["left", "right"].flatMap((s) => ["Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot", "Toes"].map((p) => s + p))];
  /** A rig of those bones (edited by `edit`), every bone renamed, recognized, and read back in humanoid names. */
  const renamedRig = (edit: (bones: { name: string; parent: string | null; head: V }[]) => void = () => {}) => {
    const sk = skeleton(Object.fromEntries(BODY.map((b) => [b, b])), false), bones = sk.bones as { name: string; parent: string | null; head: V }[];
    edit(bones);
    const to = new Map(bones.map((b, i) => [b.name, `n${(i * 7) % 97}`])), back = new Map([...to].map(([a, b]) => [b, a]));
    const rec = recognize({ bones: bones.map((b) => ({ name: to.get(b.name)!, parent: b.parent ? to.get(b.parent)! : null, head: b.head })) });
    return { rec, got: Object.fromEntries(Object.entries(rec.bones).map(([h, n]) => [h, back.get(n)!])) };
  };
  const at = (bones: { name: string; head: V }[], name: string, head: V) => (bones.find((b) => b.name === name)!.head = head);
  it("takes a long clavicle reaching out to the arm for the shoulder, not the upper arm", () => {
    // the upper arm starts 0.25 m out, so the clavicle (0.22 m) is longer than the upper arm (0.21 m)
    const { got } = renamedRig((b) => {
      at(b, "leftUpperArm", [0.25, 1.41, 0]);
      at(b, "rightUpperArm", [-0.25, 1.41, 0]);
    });
    expect([got.leftShoulder, got.leftUpperArm, got.leftLowerArm, got.leftHand]).toEqual(["leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand"]);
  });
  it("finds the spine's branch when the head has no neck and nothing above it", () => {
    const { got } = renamedRig((b) => {
      b.splice(b.findIndex((x) => x.name === "neck"), 1);
      b.find((x) => x.name === "head")!.parent = "upperChest";
    });
    expect([got.upperChest, got.head, got.leftHand, got.rightHand]).toEqual(["upperChest", "head", "leftHand", "rightHand"]);
  });
  it("takes the hand, not a twist leaf halfway along the forearm", () => {
    const { got } = renamedRig((b) => b.splice(b.findIndex((x) => x.name === "leftHand"), 0, { name: "leftForeArmTwist", parent: "leftLowerArm", head: [0.585, 1.41, 0] }));
    expect(got.leftHand).toBe("leftHand");
  });
  it("ends the head at the last neck bone when nothing sits on the head", () => {
    const { got } = renamedRig((b) => {
      b.splice(b.findIndex((x) => x.name === "head"), 0, { name: "neck2", parent: "neck", head: [0, 1.5, 0] });
      b.find((x) => x.name === "head")!.parent = "neck2";
    });
    expect([got.neck, got.head]).toEqual(["neck", "head"]);
  });
  it("passes over a twist bone in the thigh, and doubts an arm with twist bones in it", () => {
    const leg = renamedRig((b) => {
      b.splice(b.findIndex((x) => x.name === "leftLowerLeg"), 0, { name: "leftThighTwist", parent: "leftUpperLeg", head: [0.1, 0.71, 0] });
      b.find((x) => x.name === "leftLowerLeg")!.parent = "leftThighTwist";
    });
    expect([leg.got.leftUpperLeg, leg.got.leftLowerLeg, leg.got.leftFoot]).toEqual(["leftUpperLeg", "leftLowerLeg", "leftFoot"]);
    expect(leg.rec.issues).toContain("the left leg has 1 bone(s) between the thigh and the shin, passed over as twist bones");
    const arm = renamedRig((b) => {
      b.splice(b.findIndex((x) => x.name === "leftLowerArm"), 0, { name: "leftArmTwist", parent: "leftUpperArm", head: [0.32, 1.41, 0] });
      b.find((x) => x.name === "leftLowerArm")!.parent = "leftArmTwist";
    });
    expect(arm.rec.issues.some((x) => /^the left arm's upper arm and forearm are short for its chain of 4 bones: twist bones in it\?/.test(x))).toBe(true);
    expect(arm.rec.confidence).toBeLessThan(0.85);
  });
  it("reports none when there are neither names nor positions to go on", () => {
    const rec = recognize({ bones: [{ name: "a" }, { name: "b", parent: "a" }] });
    expect(rec.confidence).toBe(0);
    expect(rec.missing).toHaveLength(15);
  });
});

describe("rest measurement", () => {
  it("measure reproduces tier 1a's rests bit for bit", () => {
    for (const name of ["rig", "cmu-09_02"] as const) {
      const v = loadTier1a(name);
      const clips: Record<string, Capture> = {};
      for (const [n, c] of Object.entries(v.clips)) clips[n] = { name: c.capture.name, n: c.capture.n, dur: c.capture.dur, loop: c.capture.loop, fps: c.capture.fps, data: Float32Array.from(c.capture.data.flat()), move: c.capture.move ? Float32Array.from(c.capture.move) : null };
      const R = measure(clips, v.restClip);
      expect(Object.keys(R)).toEqual(Object.keys(v.rest));
      const flat = (o: unknown): number[] => (typeof o === "number" ? [o] : Object.values(o as object).flatMap(flat));
      expect(firstDiff(flat(R), flat(v.rest)), name).toBeNull();
    }
  });
  it("finds the rest frame and the rest kind: T, A or relaxed", () => {
    const names = tableNames(TABLES.find((t) => t.name === "vrm")!, (n) => n);
    const sk = skeleton(names);
    const rec = recognize(sk);
    const f = restFrame(sk, rec);
    expect(f.forward.map((x) => Math.round(x * 1e9) / 1e9)).toEqual([0, 0, 1]);
    expect(f.right.map((x) => Math.round(x * 1e9) / 1e9)).toEqual([-1, 0, 0]);
    expect(f.kind).toBe("T");
    for (const [drop, kind] of [[45, "A"], [80, "relaxed"]] as const) {
      const a = (drop * Math.PI) / 180;
      const tilted = skeleton(names);
      for (const s of ["left", "right"]) {
        const sh = REST[`${s}UpperArm`]!;
        const x = s === "left" ? 1 : -1;
        tilted.bones.find((b) => b.name === names[`${s}LowerArm`])!.head = [sh[0] + x * 0.28 * Math.cos(a), sh[1] - 0.28 * Math.sin(a), 0];
      }
      expect(restFrame(tilted, rec).kind).toBe(kind);
    }
  });
  it("restPoints puts the tiny rig's body points where the importer captured them", () => {
    const gltf = JSON.parse(readFileSync(join(VECTORS, "tier1b/rig.gltf"), "utf8")) as { nodes: { name: string; translation: number[]; children?: number[] }[] };
    const parent: Record<number, number> = {};
    gltf.nodes.forEach((n, i) => n.children?.forEach((c) => (parent[c] = i)));
    const world = (i: number): V => {
      const t = gltf.nodes[i]!.translation as V;
      if (parent[i] === undefined) return t;
      const p = world(parent[i]!);
      return [p[0] + t[0], p[1] + t[1], p[2] + t[2]];
    };
    const sk: SkeletonIn = { bones: gltf.nodes.map((n, i) => ({ name: n.name, parent: parent[i] === undefined ? null : gltf.nodes[parent[i]!]!.name, head: world(i) })) };
    const rec = recognize(sk);
    expect(rec.table).toBe("unreal4");
    const X = restPoints(sk, rec, restFrame(sk, rec));
    const want = loadTier1a("rig").clips.A_TPose!.capture.data[0]!;
    expect(firstDiff(Array.from(X), want, 1e-3)).toBeNull();
  });
  it("covers VRM 1.0's 55 bones and 15 required", () => {
    expect(HUMANOID_BONES).toHaveLength(55);
    expect(REQUIRED_BONES).toHaveLength(15);
  });
});
