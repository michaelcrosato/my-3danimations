// The Rigify test rig (tier 1b's second glTF input, WP-5.2): Rigify's deform bones (Quaternius' Library 1 names), each
// bone's +y along it, under a root turned 20° about the vertical and scaled to centimetres (as an FBX conversion
// leaves a rig), with a skinned mesh: rings of vertices round every segment (positions interleaved with normals in one
// strided buffer view, joints as bytes or shorts, weights as normalized bytes, some split between two bones) and a
// "Joint" material's rings at the elbows and knees. Its clips use LINEAR and STEP keys, a scale track and root motion.
// It covers what the tiny Unreal rig doesn't: the Rigify map, tips from the mesh, the mannequin's look, and every
// accessor form the reader takes. Built in code, never committed as a binary (D9).
import type { Gltf } from "./rig.ts";

type V = [number, number, number];
type Q = [number, number, number, number];

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: V): V => scale(a, 1 / Math.hypot(...a));
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A rotation matrix (columns x, y, z) as a quaternion. */
function quatOf(x: V, y: V, z: V): Q {
  const t = x[0] + y[1] + z[2];
  if (t > 0) {
    const k = 0.5 / Math.sqrt(t + 1);
    return [(y[2] - z[1]) * k, (z[0] - x[2]) * k, (x[1] - y[0]) * k, 0.25 / k];
  }
  if (x[0] > y[1] && x[0] > z[2]) {
    const k = 2 * Math.sqrt(1 + x[0] - y[1] - z[2]);
    return [0.25 * k, (y[0] + x[1]) / k, (z[0] + x[2]) / k, (y[2] - z[1]) / k];
  }
  if (y[1] > z[2]) {
    const k = 2 * Math.sqrt(1 + y[1] - x[0] - z[2]);
    return [(y[0] + x[1]) / k, 0.25 * k, (z[1] + y[2]) / k, (z[0] - x[2]) / k];
  }
  const k = 2 * Math.sqrt(1 + z[2] - x[0] - y[1]);
  return [(z[0] + x[2]) / k, (z[1] + y[2]) / k, 0.25 * k, (x[1] - y[0]) / k];
}
const qmul = (a: Q, b: Q): Q => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const conj = (a: Q): Q => [-a[0], -a[1], -a[2], a[3]];
const rotate = (q: Q, v: V): V => {
  const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), conj(q));
  return [p[0], p[1], p[2]];
};
const axisAngle = (axis: V, deg: number): Q => {
  const a = (deg * Math.PI) / 360, s = Math.sin(a), u = unit(axis);
  return [u[0] * s, u[1] * s, u[2] * s, Math.cos(a)];
};

/** The rig's glTF: the root, Rigify's deform bones, a skinned mesh and three animations, and the buffer they read. */
export function rigifyGltf(): Gltf {
  // bones in the armature (metres, y up, facing +z, the figure's left at +x): [name, parent, head, tail, ring radius]
  const B: [string, string, V, V, number][] = [
    ["DEF-hips", "root", [0, 0.95, 0], [0, 1.05, 0], 0.14],
    ["DEF-spine.001", "DEF-hips", [0, 1.05, 0], [0, 1.17, 0.01], 0.13],
    ["DEF-spine.002", "DEF-spine.001", [0, 1.17, 0.01], [0, 1.3, 0.01], 0.13],
    ["DEF-spine.003", "DEF-spine.002", [0, 1.3, 0.01], [0, 1.45, 0], 0.15],
    ["DEF-neck", "DEF-spine.003", [0, 1.45, 0], [0, 1.56, 0.01], 0.05],
    ["DEF-head", "DEF-neck", [0, 1.56, 0.01], [0, 1.76, 0.01], 0.09],
  ];
  for (const [S, x] of [["L", 1], ["R", -1]] as const) {
    B.push(
      [`DEF-shoulder.${S}`, "DEF-spine.003", [0.02 * x, 1.42, 0.02], [0.17 * x, 1.42, 0], 0.05],
      [`DEF-upper_arm.${S}`, `DEF-shoulder.${S}`, [0.17 * x, 1.42, 0], [0.45 * x, 1.41, -0.01], 0.045],
      [`DEF-forearm.${S}`, `DEF-upper_arm.${S}`, [0.45 * x, 1.41, -0.01], [0.7 * x, 1.42, 0], 0.035],
      [`DEF-hand.${S}`, `DEF-forearm.${S}`, [0.7 * x, 1.42, 0], [0.79 * x, 1.42, 0], 0.03],
      [`DEF-f_index.01.${S}`, `DEF-hand.${S}`, [0.8 * x, 1.42, 0.03], [0.84 * x, 1.42, 0.03], 0.01],
      [`DEF-f_middle.01.${S}`, `DEF-hand.${S}`, [0.8 * x, 1.42, 0], [0.845 * x, 1.42, 0], 0.01],
      [`DEF-f_middle.02.${S}`, `DEF-f_middle.01.${S}`, [0.845 * x, 1.42, 0], [0.88 * x, 1.42, 0], 0.009],
      [`DEF-f_pinky.01.${S}`, `DEF-hand.${S}`, [0.79 * x, 1.42, -0.03], [0.83 * x, 1.42, -0.03], 0.008],
      [`DEF-thigh.${S}`, "DEF-hips", [0.1 * x, 0.93, 0], [0.1 * x, 0.5, 0.01], 0.08],
      [`DEF-shin.${S}`, `DEF-thigh.${S}`, [0.1 * x, 0.5, 0.01], [0.1 * x, 0.08, 0], 0.055],
      [`DEF-foot.${S}`, `DEF-shin.${S}`, [0.1 * x, 0.08, 0], [0.1 * x, 0.02, 0.13], 0.045],
      [`DEF-toe.${S}`, `DEF-foot.${S}`, [0.1 * x, 0.02, 0.13], [0.1 * x, 0.02, 0.19], 0.035],
    );
  }
  // each bone's frame in the armature: +y along the bone, +z as near the figure's forward as it can be
  const frame = (h: V, t: V): Q => {
    const y = unit(sub(t, h)), ref: V = Math.abs(y[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1], x = unit(cross(y, ref)), z = cross(x, y);
    return quatOf(x, y, z);
  };
  const ROOT_TURN = axisAngle([0, 1, 0], 20), CM = 100;
  const names = ["root", ...B.map((b) => b[0])], rot: Q[] = [[0, 0, 0, 1], ...B.map((b) => frame(b[2], b[3]))], head: V[] = [[0, 0, 0], ...B.map((b) => b[2])];
  const parentOf = names.map((n, i) => (i === 0 ? -1 : names.indexOf(B[i - 1]![1])));
  const kids: number[][] = names.map(() => []);
  parentOf.forEach((p, i) => p >= 0 && kids[p]!.push(i));
  // node transforms: the root turned and scaled to centimetres; each bone relative to its parent, in centimetres
  const nodes: Record<string, unknown>[] = names.map((name, i) => {
    const p = parentOf[i]!, k = kids[i]!.length ? { children: kids[i] } : {};
    if (p < 0) return { name, rotation: ROOT_TURN, scale: [1 / CM, 1 / CM, 1 / CM], ...k };
    const pr = p === 0 ? ([0, 0, 0, 1] as Q) : rot[p]!, t = rotate(conj(pr), scale(sub(head[i]!, p === 0 ? [0, 0, 0] : head[p]!), CM));
    return { name, translation: t, rotation: qmul(conj(pr), rot[i]!), ...k };
  });
  // the mesh, in the world (metres): rings round every segment, and joint rings at the elbows and knees
  const world = (p: V): V => rotate(ROOT_TURN, p);
  const body: { p: V; n: V; j: [number, number]; w: [number, number] }[] = [], rings: typeof body = [];
  const ring = (into: typeof body, bi: number, t: number, r: number, count: number, split?: number) => {
    const [, , h, tl] = B[bi]!, q = rot[bi + 1]!, x = rotate(q, [1, 0, 0]), z = rotate(q, [0, 0, 1]), c = addv(h, scale(sub(tl, h), t));
    for (let k = 0; k < count; k++) {
      const a = (2 * Math.PI * k) / count, d = addv(scale(x, Math.cos(a) * r), scale(z, Math.sin(a) * r));
      into.push({ p: world(addv(c, d)), n: unit(world(d)), j: [bi + 1, split ?? 0], w: split === undefined ? [255, 0] : [200, 55] });
    }
  };
  B.forEach(([name, parent, , , r], bi) => {
    const pi = names.indexOf(parent);
    for (const t of [0.15, 0.5, 0.85]) ring(body, bi, t, r, 8, t === 0.15 && pi > 0 ? pi : undefined);
    if (name === "DEF-head") for (const t of [0.95, 1]) ring(body, bi, t, r * 0.5, 6);
    if (/DEF-(upper_arm|forearm|thigh|shin)\./.test(name)) for (const t of [0.97, 1.03]) ring(rings, bi, t, r * 1.15, 8);
  });
  // the buffer: float32 values, bytes and shorts, each view 4-byte aligned
  const bytes: number[] = [], views: unknown[] = [], accessors: Record<string, unknown>[] = [];
  const align = () => {
    while (bytes.length % 4) bytes.push(0);
  };
  const f32 = new Float32Array(1), f32b = new Uint8Array(f32.buffer);
  const pushF = (v: number) => {
    f32[0] = v;
    bytes.push(...f32b);
  };
  const view = (from: number, extra: Record<string, unknown> = {}) => {
    views.push({ buffer: 0, byteOffset: from, byteLength: bytes.length - from, ...extra });
    return views.length - 1;
  };
  const floats = (values: number[], type: string, count: number) => {
    align();
    const from = bytes.length;
    values.forEach(pushF);
    accessors.push({ bufferView: view(from), componentType: 5126, count, type });
    return accessors.length - 1;
  };
  const prim = (vs: typeof body, material: number, short: boolean) => {
    align();
    // positions and normals interleaved: one view, a 24-byte stride
    const from = bytes.length;
    for (const v of vs) [...v.p, ...v.n].forEach(pushF);
    const pv = view(from, { byteStride: 24 });
    const pos = accessors.push({ bufferView: pv, byteOffset: 0, componentType: 5126, count: vs.length, type: "VEC3", min: [-1, 0, -1], max: [1, 2, 1] }) - 1;
    const nrm = accessors.push({ bufferView: pv, byteOffset: 12, componentType: 5126, count: vs.length, type: "VEC3" }) - 1;
    const jf = bytes.length;
    for (const v of vs) for (const j of [v.j[0], v.j[1], 0, 0]) bytes.push(...(short ? [j & 255, j >> 8] : [j]));
    const jo = accessors.push({ bufferView: view(jf), componentType: short ? 5123 : 5121, count: vs.length, type: "VEC4" }) - 1;
    align();
    const wf = bytes.length;
    for (const v of vs) bytes.push(v.w[0], v.w[1], 0, 0);
    const wo = accessors.push({ bufferView: view(wf), componentType: 5121, normalized: true, count: vs.length, type: "VEC4" }) - 1;
    return { attributes: { POSITION: pos, NORMAL: nrm, JOINTS_0: jo, WEIGHTS_0: wo }, material };
  };
  const primitives = [prim(body, 0, false), prim(rings, 1, true)];
  // inverse bind matrices: each bone's world bind matrix (the root's turn and scale, then the bone's frame) inverted
  const bindWorld = names.map((_, i) => {
    if (i === 0) return { q: ROOT_TURN, t: [0, 0, 0] as V, s: 1 / CM };
    return { q: qmul(ROOT_TURN, rot[i]!), t: world(head[i]!), s: 1 };
  });
  const ibm: number[] = [];
  for (const { q, t, s } of bindWorld) {
    const inv = conj(q), cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => scale(rotate(inv, e as V), 1 / s)), tr = scale(rotate(inv, t), -1 / s);
    ibm.push(...cols[0]!, 0, ...cols[1]!, 0, ...cols[2]!, 0, ...tr, 1);
  }
  const ibmAcc = floats(ibm, "MAT4", names.length);
  // the clips: a T-pose, a wave (LINEAR and STEP rotations, a scale track, the hips' bounce) and a step forward
  const anims: unknown[] = [];
  const idx = (n: string) => names.indexOf(n);
  const anim = (name: string, tracks: [string, string, number[], number[][], string?][]) => {
    const channels: unknown[] = [], samplers: unknown[] = [];
    for (const [node, path, times, values, interpolation] of tracks) {
      const input = floats(times, "SCALAR", times.length), output = floats(values.flat(), path === "rotation" ? "VEC4" : "VEC3", values.length);
      samplers.push({ input, output, interpolation: interpolation ?? "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node: idx(node), path } });
    }
    anims.push({ name, channels, samplers });
  };
  const local = (bone: string, axis: V, deg: number) => qmul((nodes[idx(bone)]!.rotation as Q) ?? [0, 0, 0, 1], axisAngle(axis, deg));
  const hipsT = nodes[idx("DEF-hips")]!.translation as V;
  anim("A_TPose", [["DEF-hips", "rotation", [0], [local("DEF-hips", [1, 0, 0], 0)]]]);
  const T = [0, 0.2, 0.4];
  anim("Wave_Loop", [
    ["DEF-upper_arm.R", "rotation", T, [0, -50, 0].map((d) => local("DEF-upper_arm.R", [0, 0, 1], d))],
    ["DEF-forearm.R", "rotation", T, [0, 60, 0].map((d) => local("DEF-forearm.R", [1, 0, 0], d))],
    ["DEF-spine.003", "rotation", T, [0, 12, 0].map((d) => local("DEF-spine.003", [0, 0, 1], d)), "STEP"],
    ["DEF-head", "scale", T, [[1, 1, 1], [1.1, 1.1, 1.1], [1, 1, 1]]],
    ["DEF-hips", "translation", T, [0, -3, 0].map((d) => [hipsT[0], hipsT[1] + d, hipsT[2]])],
  ]);
  anim("Walk_RM", [
    ["root", "translation", [0, 0.5], [[0, 0, 0], rotate(ROOT_TURN, [0, 0, 0.5])]],
    ["DEF-thigh.L", "rotation", [0, 0.25, 0.5], [0, -25, 0].map((d) => local("DEF-thigh.L", [1, 0, 0], d))],
    ["DEF-shin.L", "rotation", [0, 0.25, 0.5], [0, 40, 0].map((d) => local("DEF-shin.L", [1, 0, 0], d))],
  ]);
  align();
  const meshNode = names.length;
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, meshNode] }],
    nodes: [...nodes, { name: "Body", mesh: 0, skin: 0 }],
    meshes: [{ name: "Body", primitives }],
    materials: [{ name: "Skin" }, { name: "Joint_Rings" }],
    skins: [{ joints: names.map((_, i) => i), inverseBindMatrices: ibmAcc, skeleton: 0 }],
    animations: anims,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bytes.length }],
  };
  return { json, bin: Uint8Array.from(bytes) };
}
