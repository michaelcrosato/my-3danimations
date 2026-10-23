// Test characters (WP-4.2): skinned humanoids generated in code from a seed and written as glTF binaries in memory.
// They vary where real rigs vary: proportions (chibi, heroic, bulky, child, tall and thin), rest pose (T, A, relaxed),
// bone names (VRM, Mixamo, UE5, Rigify) with each family's frames and units, twist bones, and optional bones left out.
// The body is a tube per bone, skinned to it and blended into the next at the joint: enough to see a pose.
import { math } from "@m3a/core";

/** The proportions. */
export type Build = "chibi" | "heroic" | "bulky" | "child" | "tall";
/** The rest pose: arms level, 40° down, or 70° down. */
export type RestPose = "T" | "A" | "relaxed";
/** The bone names, and with them the family's habits: Mixamo's centimetres under a 0.01 scale, UE5's root bone, bone
 * frames along the bone (Blender's, Mixamo's, UE5's) or the world's (VRM 1.0's normalized humanoid). */
export type Naming = "vrm" | "mixamo" | "ue5" | "rigify";

/** A test character. */
export interface CharacterSpec {
  id: string;
  seed: number;
  build: Build;
  rest: RestPose;
  naming: Naming;
  /** Twist bones on the upper arms, forearms and thighs (Rigify's in the chain, the others' as leaves). */
  twist: boolean;
  /** Optional humanoid bones left out: any of upperChest, chest, neck, shoulders, toes. */
  drop: string[];
}

type V = [number, number, number];
/** A generated bone: its name, parent, the humanoid bone it plays (if any), and its rest head in metres (+y up, facing
 * +z, the character's left on +x). */
export interface GenBone {
  name: string;
  parent: string | null;
  humanoid: string | null;
  head: V;
}

/** Each build's lengths in metres and its tube thickness. */
const BUILDS: Record<Build, { ankle: number; shin: number; thigh: number; pelvis: number; torso: number; neck: number; head: number; shoulders: number; hips: number; upper: number; fore: number; hand: number; foot: number; thick: number }> = {
  heroic: { ankle: 0.08, shin: 0.44, thigh: 0.45, pelvis: 0.08, torso: 0.5, neck: 0.1, head: 0.23, shoulders: 0.46, hips: 0.2, upper: 0.31, fore: 0.27, hand: 0.19, foot: 0.26, thick: 1 },
  chibi: { ankle: 0.05, shin: 0.16, thigh: 0.16, pelvis: 0.05, torso: 0.22, neck: 0.03, head: 0.36, shoulders: 0.26, hips: 0.14, upper: 0.12, fore: 0.11, hand: 0.08, foot: 0.14, thick: 1.1 },
  bulky: { ankle: 0.08, shin: 0.42, thigh: 0.44, pelvis: 0.09, torso: 0.52, neck: 0.08, head: 0.24, shoulders: 0.58, hips: 0.26, upper: 0.32, fore: 0.28, hand: 0.2, foot: 0.28, thick: 1.6 },
  child: { ankle: 0.06, shin: 0.28, thigh: 0.29, pelvis: 0.06, torso: 0.33, neck: 0.06, head: 0.21, shoulders: 0.28, hips: 0.15, upper: 0.19, fore: 0.17, hand: 0.12, foot: 0.17, thick: 0.9 },
  tall: { ankle: 0.09, shin: 0.52, thigh: 0.53, pelvis: 0.08, torso: 0.56, neck: 0.12, head: 0.23, shoulders: 0.42, hips: 0.18, upper: 0.36, fore: 0.32, hand: 0.2, foot: 0.29, thick: 0.7 },
};
const ARM_DROP: Record<RestPose, number> = { T: 0, A: 40, relaxed: 70 };

/** An sRGB colour (0 to 255) as glTF's linear vertex colour. */
const linear = (c: readonly number[]) => c.map((v) => ((v / 255 + 0.055) / 1.055) ** 2.4);
/** The body's paint: the sensors' mannequin's (raster/mannequin.ts COLORS: left blue, the middle and right amber, the
 *  nose), and the torso's and head's back half a darker amber, so which way the body faces reads at a glance. */
const PAINT = { body: linear([232, 170, 58]), left: linear([74, 140, 214]), back: linear([120, 78, 22]), nose: linear([160, 52, 40]) };

/** The family's name for each humanoid bone, and its twist bones'. */
function names(naming: Naming): { bone: (h: string) => string; twist: (h: string) => string } {
  const side = (h: string) => (h.startsWith("left") ? 0 : h.startsWith("right") ? 1 : -1);
  const part = (h: string) => h.replace(/^(left|right)/, "");
  switch (naming) {
    case "vrm":
      return { bone: (h) => h, twist: (h) => `${h}Twist` };
    case "mixamo": {
      const mid: Record<string, string> = { hips: "Hips", spine: "Spine", chest: "Spine1", upperChest: "Spine2", neck: "Neck", head: "Head" };
      const parts: Record<string, string> = { Shoulder: "Shoulder", UpperArm: "Arm", LowerArm: "ForeArm", Hand: "Hand", UpperLeg: "UpLeg", LowerLeg: "Leg", Foot: "Foot", Toes: "ToeBase" };
      const n = (h: string) => `mixamorig:${side(h) < 0 ? mid[h] : ["Left", "Right"][side(h)]! + parts[part(h)]}`;
      return { bone: n, twist: (h) => `${n(h)}Roll` };
    }
    case "ue5": {
      const mid: Record<string, string> = { hips: "pelvis", spine: "spine_01", chest: "spine_03", upperChest: "spine_05", neck: "neck_01", head: "head" };
      const parts: Record<string, string> = { Shoulder: "clavicle", UpperArm: "upperarm", LowerArm: "lowerarm", Hand: "hand", UpperLeg: "thigh", LowerLeg: "calf", Foot: "foot", Toes: "ball" };
      const n = (h: string) => (side(h) < 0 ? mid[h]! : `${parts[part(h)]}_${"lr"[side(h)]}`);
      return { bone: n, twist: (h) => n(h).replace(/_(l|r)$/, "_twist_01_$1") };
    }
    case "rigify": {
      const mid: Record<string, string> = { hips: "DEF-spine", spine: "DEF-spine.001", chest: "DEF-spine.002", upperChest: "DEF-spine.003", neck: "DEF-spine.004", head: "DEF-spine.006" };
      const parts: Record<string, string> = { Shoulder: "shoulder", UpperArm: "upper_arm", LowerArm: "forearm", Hand: "hand", UpperLeg: "thigh", LowerLeg: "shin", Foot: "foot", Toes: "toe" };
      const n = (h: string) => (side(h) < 0 ? mid[h]! : `DEF-${parts[part(h)]}.${"LR"[side(h)]}`);
      return { bone: n, twist: (h) => `${n(h)}.001` };
    }
  }
}

/** The skeleton of a test character: bones parent first, heads in metres. */
export function skeletonOf(spec: CharacterSpec): GenBone[] {
  const rng = new math.Rng(math.derive(spec.seed, spec.id));
  const b = { ...BUILDS[spec.build] };
  for (const k of Object.keys(b) as (keyof typeof b)[]) if (k !== "thick") b[k] *= rng.range(0.96, 1.04);
  const has = (h: string) => !spec.drop.some((d) => h === d || (d === "shoulders" && /Shoulder$/.test(h)) || (d === "toes" && /Toes$/.test(h)));
  const n = names(spec.naming);
  const out: GenBone[] = [];
  const at = new Map<string, string>(); // humanoid bone -> generated name
  const add = (name: string, parent: string | null, humanoid: string | null, head: V) => {
    out.push({ name, parent, humanoid, head });
    if (humanoid) at.set(humanoid, name);
    return name;
  };
  /** The nearest present humanoid ancestor's bone name. */
  const up = (...hs: string[]) => at.get(hs.find((h) => at.has(h))!) ?? null;
  const knee = b.ankle + b.shin, hipJ = knee + b.thigh, hipsY = hipJ + b.pelvis, neckY = hipsY + b.torso;
  let root: string | null = null;
  if (spec.naming === "ue5") root = add("root", null, null, [0, 0, 0]);
  add(n.bone("hips"), root, "hips", [0, hipsY, 0]);
  add(n.bone("spine"), up("hips"), "spine", [0, hipsY + 0.12 * b.torso, 0.005]);
  if (spec.naming === "ue5") add("spine_02", up("spine"), null, [0, hipsY + 0.25 * b.torso, 0.01]);
  if (has("chest")) add(n.bone("chest"), up("spine"), "chest", [0, hipsY + 0.4 * b.torso, 0.01]);
  if (spec.naming === "ue5" && has("upperChest")) add("spine_04", up("chest", "spine"), null, [0, hipsY + 0.55 * b.torso, 0.005]);
  if (has("upperChest")) add(n.bone("upperChest"), spec.naming === "ue5" && has("chest") ? "spine_04" : up("chest", "spine"), "upperChest", [0, hipsY + 0.7 * b.torso, 0]);
  const top = up("upperChest", "chest", "spine")!;
  if (has("neck")) add(n.bone("neck"), top, "neck", [0, neckY, -0.01]);
  if (spec.naming === "rigify" && has("neck")) add("DEF-spine.005", up("neck"), null, [0, neckY + 0.5 * b.neck, -0.005]);
  add(n.bone("head"), spec.naming === "rigify" && has("neck") ? "DEF-spine.005" : up("neck", "upperChest", "chest", "spine"), "head", [0, neckY + b.neck, 0]);
  const drop = (ARM_DROP[spec.rest] * Math.PI) / 180;
  for (const [s, x] of [["left", 1], ["right", -1]] as const) {
    const shoulderY = neckY - 0.04;
    if (has(`${s}Shoulder`)) add(n.bone(`${s}Shoulder`), top, `${s}Shoulder`, [x * 0.03, shoulderY, 0.01]);
    const d: V = [x * Math.cos(drop), -Math.sin(drop), 0];
    const p = (o: V, l: number): V => [o[0] + d[0] * l, o[1] + d[1] * l, o[2] + d[2] * l];
    const sh: V = [x * b.shoulders * 0.5, shoulderY - 0.02, 0];
    const elbow = p(sh, b.upper), wrist = p(elbow, b.fore);
    const ua = add(n.bone(`${s}UpperArm`), up(`${s}Shoulder`) ?? top, `${s}UpperArm`, sh);
    let foreParent = ua;
    if (spec.twist) {
      const t = add(n.twist(`${s}UpperArm`), ua, null, p(sh, b.upper / 2));
      if (spec.naming === "rigify") foreParent = t;
    }
    const la = add(n.bone(`${s}LowerArm`), foreParent, `${s}LowerArm`, elbow);
    let handParent = la;
    if (spec.twist) {
      const t = add(n.twist(`${s}LowerArm`), la, null, p(elbow, b.fore / 2));
      if (spec.naming === "rigify") handParent = t;
    }
    add(n.bone(`${s}Hand`), handParent, `${s}Hand`, wrist);
    const hx = x * b.hips * 0.5;
    const ul = add(n.bone(`${s}UpperLeg`), up("hips"), `${s}UpperLeg`, [hx, hipJ, 0]);
    let shinParent = ul;
    if (spec.twist) {
      const t = add(n.twist(`${s}UpperLeg`), ul, null, [hx, hipJ - b.thigh / 2, 0.005]);
      if (spec.naming === "rigify") shinParent = t;
    }
    const ll = add(n.bone(`${s}LowerLeg`), shinParent, `${s}LowerLeg`, [hx, knee, 0.012]);
    const ft = add(n.bone(`${s}Foot`), ll, `${s}Foot`, [hx, b.ankle, -0.01]);
    if (has(`${s}Toes`)) add(n.bone(`${s}Toes`), ft, `${s}Toes`, [hx, 0.02, 0.55 * b.foot]);
  }
  return out;
}

/** Each bone's tip: the head of the child it runs into (a humanoid one first), or a leaf's length the way it points. */
function tips(bones: GenBone[], spec: CharacterSpec): V[] {
  const b = BUILDS[spec.build];
  return bones.map((bone) => {
    const kids = bones.filter((c) => c.parent === bone.name), next = kids.find((c) => c.humanoid) ?? kids[0];
    if (next) return next.head;
    const h = bone.humanoid ?? "", parent = bones.find((p) => p.name === bone.parent);
    const along = (l: number): V => {
      const d = parent ? norm(sub(bone.head, parent.head)) : ([0, 1, 0] as V);
      return [bone.head[0] + d[0] * l, bone.head[1] + d[1] * l, bone.head[2] + d[2] * l];
    };
    if (h === "head") return [bone.head[0], bone.head[1] + b.head, bone.head[2]];
    if (/Hand$/.test(h)) return along(b.hand);
    if (/Toes$/.test(h)) return [bone.head[0], bone.head[1], bone.head[2] + 0.25 * b.foot];
    if (/Foot$/.test(h)) return [bone.head[0], 0.02, bone.head[2] + 0.75 * b.foot];
    return along(0.08);
  });
}

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A rotation as its three basis columns (x, y, z axes in world). */
type Basis = [V, V, V];
const IDENTITY: Basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** A bone frame with +y along `d` and +z as near forward (+z) as it can be, or up when the bone points forward. */
function along(d: V): Basis {
  const y = norm(d), ref: V = Math.abs(y[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
  const x = norm(cross(y, ref)), z = cross(x, y);
  return [x, y, z];
}
const tmul = (r: Basis, v: V): V => [dot(r[0], v), dot(r[1], v), dot(r[2], v)]; // rᵀ v
const rel = (p: Basis, c: Basis): Basis => [tmul(p, c[0]), tmul(p, c[1]), tmul(p, c[2])]; // pᵀ c
function quat(r: Basis): [number, number, number, number] {
  const [m00, m10, m20] = r[0], [m01, m11, m21] = r[1], [m02, m12, m22] = r[2];
  const tr = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const l = Math.hypot(...q);
  return q.map((v) => v / l) as [number, number, number, number];
}

/** A test character as a glTF binary (GLB), with its skeleton. */
export function character(spec: CharacterSpec): { glb: Uint8Array; bones: GenBone[] } {
  const bones = skeletonOf(spec), tip = tips(bones, spec), b = BUILDS[spec.build];
  const scale = spec.naming === "mixamo" ? 0.01 : 1; // Mixamo's centimetres under the armature's 0.01
  const frames: Basis[] = bones.map((bone, i) => (spec.naming === "vrm" ? IDENTITY : along(sub(tip[i]!, bone.head))));
  const index = new Map(bones.map((bone, i) => [bone.name, i]));
  // the body: a tube per bone, head to tip; the far ring blends half into the bone the tube runs into
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], joints: number[] = [], weights: number[] = [], tris: number[] = [];
  const SIDES = 8;
  // a tube from a to z on bone i (its far ring half into bone `next`), each vertex coloured by `paint(out)`
  const tube = (i: number, a: V, z: V, r: number, next: number, paint: (out: V) => readonly number[]) => {
    const f = along(norm(sub(z, a))), base = pos.length / 3;
    for (const [ring, at] of [[0, a], [1, z]] as const) {
      for (let k = 0; k < SIDES; k++) {
        const ang = (2 * Math.PI * k) / SIDES, c = Math.cos(ang), s = Math.sin(ang);
        const out: V = [f[0][0] * c + f[2][0] * s, f[0][1] * c + f[2][1] * s, f[0][2] * c + f[2][2] * s];
        pos.push(at[0] + out[0] * r, at[1] + out[1] * r, at[2] + out[2] * r);
        nrm.push(...out);
        col.push(...paint(out));
        const blend = ring === 1 && next >= 0;
        joints.push(i, blend ? next : 0, 0, 0);
        weights.push(blend ? 0.5 : 1, blend ? 0.5 : 0, 0, 0);
      }
    }
    for (let k = 0; k < SIDES; k++) {
      const k2 = (k + 1) % SIDES;
      tris.push(base + k, base + k2, base + SIDES + k, base + k2, base + SIDES + k2, base + SIDES + k);
    }
  };
  bones.forEach((bone, i) => {
    // the body hangs on the chain: no tube for the root or a twist leaf (its limb's tube covers it)
    if (bone.name === "root" || (!bone.humanoid && !bones.some((c) => c.parent === bone.name))) return;
    const h = bone.humanoid ?? "";
    const r = b.thick * (h === "head" ? b.head * 0.42 : /^(hips|spine|chest|upperChest)$/.test(h) || /^spine_0/.test(bone.name) ? 0.11 : /UpperLeg$/.test(h) ? 0.065 : /LowerLeg$/.test(h) ? 0.05 : /Foot|Toes/.test(h) ? 0.04 : /Hand/.test(h) ? 0.035 : /neck/.test(h) ? 0.045 : 0.04);
    const next = bones.findIndex((c) => c.parent === bone.name && (c.humanoid || bones.some((g) => g.parent === c.name)));
    // the sensors' mannequin's colours (left blue, the middle and right amber), the torso's and head's back half darker
    const middle = !h.startsWith("left") && !h.startsWith("right");
    tube(i, bone.head, tip[i]!, r, next, (out) => (h.startsWith("left") ? PAINT.left : middle && out[2] < -0.05 ? PAINT.back : PAINT.body));
    // the nose: out from the face along the body's forward (+z), so facing reads in every view
    if (h === "head") {
      const at = tip[i]!, mid: V = [(bone.head[0] + at[0]) / 2, (bone.head[1] + at[1]) / 2, (bone.head[2] + at[2]) / 2], face: V = [mid[0], mid[1], mid[2] + r * 0.9];
      tube(i, face, [face[0], face[1], face[2] + r * 0.6], r * 0.25, -1, () => PAINT.nose);
    }
  });
  // nodes: the armature, the bones under it, the mesh beside it
  const nodes: Record<string, unknown>[] = [];
  const armature = 0;
  nodes.push({ name: "Armature", children: [] as number[], ...(scale !== 1 ? { scale: [scale, scale, scale] } : {}) });
  bones.forEach((bone, i) => {
    const pi = bone.parent === null ? -1 : index.get(bone.parent)!;
    const pf = pi < 0 ? IDENTITY : frames[pi]!, ph: V = pi < 0 ? [0, 0, 0] : bones[pi]!.head;
    const t = tmul(pf, sub(bone.head, ph)).map((v) => v / scale), q = quat(rel(pf, frames[i]!));
    const node: Record<string, unknown> = { name: bone.name, translation: t };
    if (Math.abs(q[3]) < 1 - 1e-12) node.rotation = q;
    nodes.push(node);
    const parentNode = pi < 0 ? armature : pi + 1;
    ((nodes[parentNode]!.children as number[] | undefined) ?? (nodes[parentNode]!.children = [] as number[]) as number[]).push(i + 1);
  });
  const meshNode = nodes.length;
  nodes.push({ name: "Body", mesh: 0, skin: 0 });
  // inverse bind matrices: the inverse of each bone's world matrix, column-major
  const ibm: number[] = [];
  bones.forEach((bone, i) => {
    const f = frames[i]!, s = 1 / scale, p = bone.head;
    // inverse of T(p) R S(scale) is S(1/scale) Rᵀ T(-p): rows of Rᵀ are R's columns
    const tr = tmul(f, p).map((v) => -v * s);
    ibm.push(f[0][0] * s, f[1][0] * s, f[2][0] * s, 0, f[0][1] * s, f[1][1] * s, f[2][1] * s, 0, f[0][2] * s, f[1][2] * s, f[2][2] * s, 0, tr[0]!, tr[1]!, tr[2]!, 1);
  });
  // the binary buffer and its views
  const chunks: Uint8Array[] = [], views: Record<string, unknown>[] = [], accessors: Record<string, unknown>[] = [];
  let offset = 0;
  const put = (data: ArrayBufferView, extra: Record<string, unknown>, target?: number) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    chunks.push(bytes);
    const pad = (4 - (bytes.byteLength % 4)) % 4;
    if (pad) chunks.push(new Uint8Array(pad));
    offset += bytes.byteLength + pad;
    accessors.push({ bufferView: views.length - 1, ...extra });
    return accessors.length - 1;
  };
  const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, j) => j % 3 === k))), max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, j) => j % 3 === k)));
  const POSITION = put(new Float32Array(pos), { componentType: 5126, count: pos.length / 3, type: "VEC3", min, max }, 34962);
  const NORMAL = put(new Float32Array(nrm), { componentType: 5126, count: nrm.length / 3, type: "VEC3" }, 34962);
  const COLOR_0 = put(new Float32Array(col), { componentType: 5126, count: col.length / 3, type: "VEC3" }, 34962);
  const JOINTS_0 = put(new Uint16Array(joints), { componentType: 5123, count: joints.length / 4, type: "VEC4" }, 34962);
  const WEIGHTS_0 = put(new Float32Array(weights), { componentType: 5126, count: weights.length / 4, type: "VEC4" }, 34962);
  const indices = put(new Uint16Array(tris), { componentType: 5123, count: tris.length, type: "SCALAR" }, 34963);
  const inverseBindMatrices = put(new Float32Array(ibm), { componentType: 5126, count: bones.length, type: "MAT4" });
  const json = {
    asset: { version: "2.0", generator: `m3a test-characters ${spec.id}` },
    scene: 0,
    scenes: [{ name: spec.id, nodes: [armature, meshNode] }],
    nodes,
    meshes: [{ name: "Body", primitives: [{ attributes: { POSITION, NORMAL, COLOR_0, JOINTS_0, WEIGHTS_0 }, indices, material: 0 }] }],
    materials: [{ name: "Skin", pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    skins: [{ name: spec.id, joints: bones.map((_, i) => i + 1), inverseBindMatrices, skeleton: 1 }],
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors,
    extras: { m3a: { spec, humanoid: Object.fromEntries(bones.filter((x) => x.humanoid).map((x) => [x.humanoid, x.name])) } },
  };
  return { glb: glb(json, chunks, offset), bones };
}

/** Packs glTF JSON and its binary chunks as a GLB. */
function glb(json: unknown, chunks: Uint8Array[], binLength: number): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(text.byteLength / 4) * 4;
  const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.byteLength, 20 + jsonLength);
  let at = 20 + jsonLength;
  dv.setUint32(at, binLength, true);
  dv.setUint32(at + 4, 0x004e4942, true);
  at += 8;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
