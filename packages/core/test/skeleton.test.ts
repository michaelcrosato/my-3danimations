// Tests for the skeleton profile (WP-1.4): recognition is exact on a fixture for every mapping table (namespaces and
// case stripped); the topology fallback maps renamed skeletons (long clavicles, no neck, twist bones, no head-top leaf)
// and reports its confidence; every skeleton these tests use, and a few with a name used twice or chains as long as each
// other, is recognized, patched and framed as before, to the hash (K6), chains of thousands of bones and bones with
// 130,000 children are walked without recursion or spreading, and parents in a loop refused, by shape or by name; measure
// reproduces tier 1a's rests bit for bit; restPoints places the tiny rig's body points where the importer did.
import { describe, expect, it } from "vitest";
import { HUMANOID_BONES, HUMANOID_PARENT, measure, patchMapping, recognize, REQUIRED_BONES, restFrame, restPoints, TABLES, type Capture, type SkeletonIn } from "./all.ts";
import { firstDiff, loadTier1a, loadTier3, VECTORS } from "../../../spec/conformance/runner/vectors.ts";
import { rigSkeleton } from "../../../spec/conformance/runner/skeleton.ts";
import { IDX } from "../src/format/body.ts";
import { createHash } from "node:crypto";
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
  // K6: the topology fallback walks the tree without recursion. These hashes were taken before that change, on the
  // skeletons these tests and solve's main cases recognize (not solve's arms-down or restWorld ones, nor the animator's
  // rig scaled 1.2 times) and on a few with a name used twice or chains as long as each other (`repeated`), and on each
  // again with every bone renamed (its shape alone to go on)
  it("gives every skeleton the tests use the recognition, patch and rest frame it gave before, to the hash", () => {
    type Bone = { name: string; parent: string | null; head: V };
    type Case = [SkeletonIn, { table?: string }?];
    const mixamo = TABLES.find((t) => t.name === "mixamo")!, vrm = TABLES.find((t) => t.name === "vrm")!;
    const elbow = skeleton(tableNames(mixamo, (n) => n));
    elbow.bones.find((b) => b.name === "LeftForeArm")!.name = "LeftElbowTwist";
    elbow.bones.find((b) => b.parent === "LeftForeArm")!.parent = "LeftElbowTwist";
    const gltf = JSON.parse(readFileSync(join(VECTORS, "tier1b/rig.gltf"), "utf8")) as { nodes: { name: string; translation: number[]; children?: number[] }[] };
    const parent: Record<number, number> = {};
    gltf.nodes.forEach((n, i) => n.children?.forEach((c) => (parent[c] = i)));
    const world = (i: number): V => (parent[i] === undefined ? (gltf.nodes[i]!.translation as V) : (world(parent[i]!).map((x, j) => x + gltf.nodes[i]!.translation[j]!) as V));
    const tiny = (name: (i: number) => string): SkeletonIn => ({ bones: gltf.nodes.map((n, i) => ({ name: name(i), parent: parent[i] === undefined ? null : name(parent[i]!), head: world(i) })) });
    const place = (b: Bone[], name: string, head: V) => (b.find((x) => x.name === name)!.head = head);
    const insert = (b: Bone[], before: string, bone: Bone, child?: string) => (b.splice(b.findIndex((x) => x.name === before), 0, bone), child && (b.find((x) => x.name === child)!.parent = bone.name));
    const EDITS: ((b: Bone[]) => unknown)[] = [
      () => {},
      (b) => (place(b, "leftUpperArm", [0.25, 1.41, 0]), place(b, "rightUpperArm", [-0.25, 1.41, 0])),
      (b) => (b.splice(b.findIndex((x) => x.name === "neck"), 1), (b.find((x) => x.name === "head")!.parent = "upperChest")),
      (b) => insert(b, "leftHand", { name: "leftForeArmTwist", parent: "leftLowerArm", head: [0.585, 1.41, 0] }),
      (b) => insert(b, "head", { name: "neck2", parent: "neck", head: [0, 1.5, 0] }, "head"),
      (b) => insert(b, "leftLowerLeg", { name: "leftThighTwist", parent: "leftUpperLeg", head: [0.1, 0.71, 0] }, "leftLowerLeg"),
      (b) => insert(b, "leftLowerArm", { name: "leftArmTwist", parent: "leftUpperArm", head: [0.32, 1.41, 0] }, "leftLowerArm"),
    ];
    const rig = (edit: (b: Bone[]) => unknown): SkeletonIn => {
      const bones = skeleton(Object.fromEntries(BODY.map((b) => [b, b])), false).bones as Bone[];
      edit(bones);
      const to = new Map(bones.map((b, i) => [b.name, `n${(i * 7) % 97}`]));
      return { bones: bones.map((b) => ({ name: to.get(b.name)!, parent: b.parent ? to.get(b.parent)! : null, head: b.head })) };
    };
    // a name used twice, and chains as long as each other, where the walks' order shows (found by an A/B fuzz): a stray
    // root bone named as the chest, listed before or after the real one, over hips two bones below a root (a name's
    // level is its first bone's); a cape as deep as the upper body off the chest (of equal chains the spine takes the
    // first listed), alone or with a leaf on the left toes, listed first, named as the chest (the left leg's longest
    // chain then runs through the chest's children, sorting a copy of them, not the list the spine reads)
    const stray = (last: boolean) => (b: Bone[]) => {
      b.find((x) => x.name === "hips")!.parent = "r2";
      b.unshift({ name: "r1", parent: null, head: [0, 0, 0] }, { name: "r2", parent: "r1", head: [0, 0.5, 0] });
      b.splice(last ? b.length : 0, 0, { name: "chest", parent: null, head: [0, 0, -0.3] });
    };
    const cape = (toe: boolean) => (b: Bone[]) => {
      b.push(...Array.from({ length: 5 }, (_, i): Bone => ({ name: `cape${i}`, parent: i ? `cape${i - 1}` : "chest", head: [0, 1.15 - 0.15 * i, -0.15] })));
      if (toe) b.unshift({ name: "chest", parent: "leftToes", head: [0.1, 0, 0.2] });
    };
    const tilted = (drop: number) => {
      const names = tableNames(vrm, (n) => n), sk = skeleton(names), a = (drop * Math.PI) / 180;
      for (const [s, x] of [["left", 1], ["right", -1]] as const) sk.bones.find((b) => b.name === names[`${s}LowerArm`])!.head = [REST[`${s}UpperArm`]![0] + x * 0.28 * Math.cos(a), REST[`${s}UpperArm`]![1] - 0.28 * Math.sin(a), 0];
      return sk;
    };
    const conf = rigSkeleton(), drop = new Set(["neck_01", "clavicle_l", "clavicle_r", "ball_l", "ball_r", "ball_leaf_l", "ball_leaf_r", ...["index_01", "middle_01", "middle_02", "pinky_01"].flatMap((f) => [`${f}_l`, `${f}_r`])]);
    const parentOf = new Map(conf.bones.map((x) => [x.name, x.parent])), up = (n: string | null | undefined): string | null => (n && drop.has(n) ? up(parentOf.get(n)) : (n ?? null));
    const twist = rigSkeleton(), ua = twist.bones.find((x) => x.name === "upperarm_l")!, la = twist.bones.find((x) => x.name === "lowerarm_l")!;
    twist.bones.push({ name: "upperarm_twist_01_l", parent: "upperarm_l", head: [(ua.head![0] + la.head![0]) / 2, ua.head![1], ua.head![2]] });
    const ue = TABLES.find((t) => t.name === "unreal4")!, rename = new Map<string, string>();
    for (const [h, names] of Object.entries(ue.bones)) for (const n of names) if (conf.bones.some((x) => x.name === n) && mixamo.bones[h]) rename.set(n, `mixamorig:${mixamo.bones[h]![0]}`);
    const GROUPS: Record<string, Case[]> = {
      tables: TABLES.flatMap((t) => DECORATIONS.map(([, d]): Case => [skeleton(tableNames(t, d))])),
      renamed: [
        [elbow, { table: "mixamo" }], [elbow], [skeleton(Object.fromEntries(Object.keys(tableNames(mixamo, (n) => n)).map((b, i) => [b, `bone_${(i * 37) % 101}`])))],
        [tiny((i) => `n${i}`)], [tiny((i) => gltf.nodes[i]!.name)], ...EDITS.map((e): Case => [rig(e)]), [{ bones: [{ name: "a" }, { name: "b", parent: "a" }] }],
      ],
      rest: [[skeleton(tableNames(vrm, (n) => n))], [tilted(45)], [tilted(80)], [skeleton(Object.fromEntries(HUMANOID_BONES.filter((b) => REST[b] && b !== "chest" && b !== "upperChest").map((b) => [b, tableNames(vrm, (n) => n)[b] ?? b])))]],
      conformance: [
        ...Object.values(loadTier3().bodies).filter((b) => b.proportions).map((b): Case => [rigSkeleton(b.proportions)]),
        [{ ...conf, bones: conf.bones.filter((x) => !drop.has(x.name)).map((x) => ({ ...x, parent: up(x.parent) })) }], [twist],
        [{ ...conf, bones: conf.bones.map((x) => ({ ...x, name: rename.get(x.name) ?? x.name, parent: x.parent ? (rename.get(x.parent) ?? x.parent) : null })) }],
      ],
      repeated: [stray(false), stray(true), cape(false), cape(true)].map((e): Case => [rig(e)]),
    };
    /** Every bone renamed by its place, so that only the skeleton's shape is left to go on. */
    const shapeOnly = (sk: SkeletonIn): SkeletonIn => {
      const to = new Map(sk.bones.map((b, i) => [b.name, `s${i}`]));
      return { ...sk, bones: sk.bones.map((b) => ({ ...b, name: to.get(b.name)!, parent: b.parent ? to.get(b.parent)! : b.parent })) };
    };
    // JSON with -0, NaN and the infinities kept apart from 0 and null
    const exact = (_: string, v: unknown) => (typeof v === "number" && (Object.is(v, -0) || !Number.isFinite(v)) ? (Object.is(v, -0) ? "-0" : String(v)) : v);
    const hash = (cases: Case[]) => {
      const h = createHash("sha256");
      for (const [sk, opts] of cases) {
        let out: unknown;
        try {
          const rec = recognize(sk, opts);
          out = [rec, patchMapping(sk, rec, { leftToes: null, ...(rec.bones.hips ? { hips: rec.bones.hips } : {}) }), restFrame(sk, rec)];
        } catch (e) {
          out = String(e);
        }
        h.update(JSON.stringify(out, exact) + "\n");
      }
      return `${cases.length} ${h.digest("hex").slice(0, 16)}`;
    };
    const got = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, cases]) => [[g, hash(cases)], [`${g}, by shape`, hash(cases.map(([sk, o]): Case => [shapeOnly(sk), o]))]]));
    expect(got).toEqual({
      tables: "32 7b256335089e5ecd",
      "tables, by shape": "32 ad11d60f2d8aaa20",
      renamed: "13 c4518a12a8822e3e",
      "renamed, by shape": "13 7db9d7b0722916aa",
      rest: "4 3508de8d197be18a",
      "rest, by shape": "4 649f106df22d05df",
      conformance: "10 f84a7e152612c495",
      "conformance, by shape": "10 2ec50498d49c2eb5",
      repeated: "4 070b1f3487ccb4d8",
      "repeated, by shape": "4 e8256ec92c6a4ad7",
    });
  });
  it("maps a humanoid 5,000 and 20,000 bones down a chain, one with a 5,000- or 130,000-bone chain off a toe, and one with 130,000 leaves on a thigh (K6: no RangeError)", () => {
    const plain = renamedRig();
    // the body's bones named so that no table knows them, with a chain hung above the hips or below the left toes
    const body = () => skeleton(Object.fromEntries(BODY.map((b) => [b, `x_${b}`])), false).bones as { name: string; parent: string | null; head: V }[];
    const chain = (n: number, parent: string | null, head: (i: number) => V) => Array.from({ length: n }, (_, i) => ({ name: `c${i}`, parent: i ? `c${i - 1}` : parent, head: head(i) }));
    // behind the body, the hips n levels down (20,000 passes the hips' level walk too, which took about 10,000 to
    // overflow); then on along the floor from the toes, 5,000 bones past the foot
    const under = (n: number) => {
      const b = body();
      b.find((x) => x.name === "x_hips")!.parent = `c${n - 1}`;
      return [...chain(n, null, (i) => [0, 0.95, -0.5 - 0.001 * (n - i)]), ...b];
    };
    // and past the about 125,000 arguments one call takes: 130,000 bones down from the toes, or 130,000 leaves on the
    // left thigh (daaf91c ran out of stack on both; spreading a branch's bones into Math.min and Math.max would too)
    const toes = (n: number) => [...body(), ...chain(n, "x_leftToes", (i) => [0.1, 0, 0.13 + 0.001 * (i + 1)])];
    const thigh = [...body(), ...Array.from({ length: 130000 }, (_, i) => ({ name: `l${i}`, parent: "x_leftUpperLeg", head: REST.leftUpperLeg! }))];
    for (const bones of [under(5000), under(20000), toes(5000), toes(130000), thigh]) {
      const rec = recognize({ bones });
      expect([rec.method, rec.missing, rec.confidence]).toEqual(["topology", [], plain.rec.confidence]);
      expect(Object.fromEntries(Object.entries(rec.bones).map(([h, n]) => [h, n.slice(2)]))).toEqual(plain.got);
    }
    // about 2 s alone (1 s the 130,000-bone toe chain, 0.6 s the thigh's leaves); a loaded T1 run took it past Vitest's
    // default 5 s
  }, 30_000);
  it("recognizes a root with 130,000 children as before, listed before or after them (K6: no RangeError)", () => {
    // no walk spreads a bone's children into one call's arguments, which about 125,000 overflow; daaf91c never took a
    // root's depth, so it answered (under a parent, as on the thigh above, its depth spread them and ran out of stack)
    const leaves = Array.from({ length: 130000 }, (_, i) => ({ name: `l${i}`, parent: "n", head: [i * 1e-4, 0, 0] as V }));
    const root = { name: "n", parent: null, head: [0, 0, 0] as V };
    const missing = [...REQUIRED_BONES], issues = [`required bones not found: ${missing.join(", ")}; add them to "bones" by hand`];
    for (const bones of [[root, ...leaves], [...leaves, root]]) {
      expect(recognize({ bones })).toEqual({ method: "table", table: "vrm", confidence: 0, bones: {}, missing, unmapped: bones.map((b) => b.name), issues });
    }
    // about 0.7 to 1.2 s alone; the same headroom as the chain test's
  }, 30_000);
  it("refuses parents in a loop, by shape or by name, with a RangeError that names a bone in it, rather than running out of stack or hanging (K6)", () => {
    const at: V = [0, 1, 0];
    expect(() => recognize({ bones: [{ name: "a", parent: "b", head: at }, { name: "b", parent: "a", head: at }] })).toThrow(new RangeError(`the skeleton's parents loop through "a"`));
    expect(() => recognize({ bones: [{ name: "r", head: at }, { name: "a", parent: "a", head: at }] })).toThrow(new RangeError(`the skeleton's parents loop through "a"`));
    // bones a table knows by name: finish's walk up the parents, which hung on them, throws the same
    expect(() => recognize({ bones: [{ name: "Hips", parent: "Spine", head: at }, { name: "Spine", parent: "Hips", head: at }] })).toThrow(new RangeError(`the skeleton's parents loop through "Hips"`));
    expect(() => recognize({ bones: [{ name: "Hips", parent: "Hips" }, { name: "Spine", parent: "Hips" }] })).toThrow(new RangeError(`the skeleton's parents loop through "Hips"`));
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
  it("puts a spine with no chest bones' chest points a third and two thirds along it, as a full spine's are", () => {
    // with the chest at the spine's tip (the neck), the chest's whole turn fell on a segment of no length and a body
    // lying flat put its head through the floor (WP-6.6's verifier: B3's get-up on every character without a chest)
    const vrm = TABLES.find((t) => t.name === "vrm")!, names = Object.fromEntries(HUMANOID_BONES.filter((b) => REST[b] && b !== "chest" && b !== "upperChest").map((b) => [b, tableNames(vrm, (n) => n)[b] ?? b]));
    const sk = skeleton(names), rec = recognize(sk), X = restPoints(sk, rec, restFrame(sk, rec)), up = (n: string) => X[IDX[n]! * 3 + 2]!;
    const span = up("neck") - up("spine1");
    expect([(up("spine2") - up("spine1")) / span, (up("chest") - up("spine1")) / span].map((x) => Math.round(x * 1000) / 1000)).toEqual([0.333, 0.667]);
  });
  it("covers VRM 1.0's 55 bones and 15 required", () => {
    expect(HUMANOID_BONES).toHaveLength(55);
    expect(REQUIRED_BONES).toHaveLength(15);
  });
});
