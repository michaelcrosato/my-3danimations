// The tiny test rig (tier 1b's glTF input): an Unreal-style humanoid (metres, y up, facing +z) with three clips, a
// T-pose, a wave and a root-motion step. Ported from shardfall's `rig_glb()` (crates/pav_tools/tests/mocap.rs:43-160
// at the pinned commit), which my-3d2dge's importer read to write shardfall's rig_expected.json. Built in code, never
// committed as a binary (D9): `rigGltf()` gives the glTF JSON and its buffer, `glb()` packs them as a .glb.

/** Segment scales for tier 3's bodies of other proportions; 1 everywhere is the rig as shardfall builds it. */
export interface Proportions {
  all?: number;
  legs?: number;
  arms?: number;
  torso?: number;
  head?: number;
  shoulders?: number;
  hips?: number;
}

/** A glTF document as plain JSON plus its binary buffer. */
export interface Gltf {
  json: Record<string, unknown>;
  bin: Uint8Array;
}

/** The rig's glTF: nodes, three animations, and the float32 buffer they read. `p` rescales its segments (tier 3). */
export function rigGltf(p: Proportions = {}): Gltf {
  const all = p.all ?? 1;
  const [legs, arms, torso, headS, sh, hips] = [p.legs, p.arms, p.torso, p.head, p.shoulders, p.hips].map((k) => (k ?? 1) * all) as [number, number, number, number, number, number];
  const v = (t: number[], k: number) => t.map((x) => x * k);
  // the pelvis rises with the legs, so the feet stay on the floor (the ankle sits 0.06 m up, the leg is 0.87 m)
  const pelvisY = 0.06 * all + 0.89 * legs;
  const names: string[] = [];
  const trans: number[][] = [];
  const kids: number[][] = [];
  const node = (name: string, t: number[], parent?: number): number => {
    names.push(name);
    trans.push(t);
    kids.push([]);
    const i = names.length - 1;
    if (parent !== undefined) kids[parent]!.push(i);
    return i;
  };
  const root = node("root", [0, 0, 0]);
  const pelvis = node("pelvis", [0, pelvisY, 0], root);
  const s1 = node("spine_01", v([0, 0.1, 0], torso), pelvis);
  const s2 = node("spine_02", v([0, 0.12, 0], torso), s1);
  const s3 = node("spine_03", v([0, 0.12, 0], torso), s2);
  const neck = node("neck_01", v([0, 0.16, 0], torso), s3);
  const head = node("Head", v([0, 0.1, 0], headS), neck);
  node("head_leaf", v([0, 0.18, 0], headS), head);
  for (const [s, x] of [["l", 1], ["r", -1]] as const) {
    const clav = node(`clavicle_${s}`, [0.03 * x * sh, 0.12 * torso, 0], s3);
    const up = node(`upperarm_${s}`, [0.15 * x * sh, 0, 0], clav);
    const lo = node(`lowerarm_${s}`, v([0.28 * x, 0, 0], arms), up);
    const hand = node(`hand_${s}`, v([0.25 * x, 0, 0], arms), lo);
    node(`index_01_${s}`, v([0.09 * x, 0, 0.03], arms), hand);
    const m1 = node(`middle_01_${s}`, v([0.09 * x, 0, 0], arms), hand);
    node(`middle_02_${s}`, v([0.045 * x, 0, 0], arms), m1);
    node(`pinky_01_${s}`, v([0.08 * x, 0, -0.03], arms), hand);
    const th = node(`thigh_${s}`, [0.1 * x * hips, -0.02 * legs, 0], pelvis);
    const calf = node(`calf_${s}`, v([0, -0.44, 0], legs), th);
    const foot = node(`foot_${s}`, v([0, -0.43, 0], legs), calf);
    const ball = node(`ball_${s}`, v([0, -0.06, 0.13], all), foot);
    node(`ball_leaf_${s}`, v([0, 0, 0.06], all), ball);
  }
  const index = (n: string) => names.indexOf(n);
  const quat = (axis: number[], deg: number): number[] => {
    const a = (deg * (Math.PI / 180)) / 2;
    return [axis[0]! * Math.sin(a), axis[1]! * Math.sin(a), axis[2]! * Math.sin(a), Math.cos(a)];
  };
  const bytes: number[] = [];
  const f32 = new Float32Array(1);
  const u8 = new Uint8Array(f32.buffer);
  const accessors: unknown[] = [];
  const views: unknown[] = [];
  const add = (values: number[], type: string, count: number): number => {
    const off = bytes.length;
    for (const v of values) {
      f32[0] = v;
      bytes.push(u8[0]!, u8[1]!, u8[2]!, u8[3]!);
    }
    views.push({ buffer: 0, byteOffset: off, byteLength: bytes.length - off });
    accessors.push({ bufferView: views.length - 1, componentType: 5126, count, type });
    return accessors.length - 1;
  };
  const anims: unknown[] = [];
  const anim = (name: string, tracks: [string, string, number[], number[][]][]) => {
    const channels: unknown[] = [];
    const samplers: unknown[] = [];
    for (const [target, path, times, values] of tracks) {
      const t = add(times, "SCALAR", times.length);
      const v = add(values.flat(), path === "rotation" ? "VEC4" : "VEC3", values.length);
      samplers.push({ input: t, output: v, interpolation: "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node: index(target), path } });
    }
    anims.push({ name, channels, samplers });
  };
  anim("A_TPose", [["pelvis", "rotation", [0], [[0, 0, 0, 1]]]]);
  const times = [0, 0.25, 0.5, 0.75, 1];
  const turn = (axis: number[], d: number[]) => d.map((x) => quat(axis, x));
  anim("Wave_Loop", [
    ["upperarm_r", "rotation", times, turn([0, 0, 1], [0, -60, -100, -60, 0])],
    ["lowerarm_r", "rotation", times, turn([0, 1, 0], [0, 40, 80, 40, 0])],
    ["spine_02", "rotation", times, turn([0, 1, 0], [0, 10, 20, 10, 0])],
    ["pelvis", "translation", times, [0, -0.03, 0, -0.03, 0].map((d) => [0, pelvisY + d, 0])],
    ["thigh_l", "rotation", times, turn([1, 0, 0], [0, -20, -35, -20, 0])],
    ["calf_l", "rotation", times, turn([1, 0, 0], [0, 30, 60, 30, 0])],
  ]);
  anim("Step_RM", [["root", "translation", [0, 1], [[0, 0, 0], [0, 0, 0.6]]]]);
  const nodes = names.map((name, i) => (kids[i]!.length ? { name, translation: trans[i], children: kids[i] } : { name, translation: trans[i] }));
  const json = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [root] }], nodes, animations: anims, accessors, bufferViews: views, buffers: [{ byteLength: bytes.length }] };
  return { json, bin: Uint8Array.from(bytes) };
}

/** Pack a glTF document and its buffer as a binary glTF (.glb), padding JSON with spaces and the buffer with zeros. */
export function glb({ json, bin }: Gltf): Uint8Array {
  let js = new TextEncoder().encode(JSON.stringify(json));
  if (js.length % 4) js = Uint8Array.from([...js, ...new Array(4 - (js.length % 4)).fill(0x20)]);
  const pad = bin.length % 4 ? 4 - (bin.length % 4) : 0;
  const total = 12 + 8 + js.length + 8 + bin.length + pad;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(js, 20);
  dv.setUint32(20 + js.length, bin.length + pad, true);
  dv.setUint32(24 + js.length, 0x004e4942, true);
  out.set(bin, 28 + js.length);
  return out;
}
