// A glTF skeletal animation library read as captured body points (PLAN.md WP-5.2; carried from my-3d2dge
// tools/anim-import.mjs:122-229, readLibrary, bit for bit: conformance tier 1b). Each clip is sampled at a fixed rate
// (linear in-betweens, rotations slerped), forward kinematics run on the rig, and the 36 body points taken in the rig's
// own frame (forward from the heel toward the toes, right toward the right hip, up; millimetres, the root on the
// ground). A recognized rig maps each point to a bone, a bone's far end (`tip`, from its skinned vertices or its child)
// or a point 12 cm in front of it (`fwd`). The skinned mesh, when there is one, also gives the mannequin's look: each
// segment's radii and where a joint-ring material sits. Arithmetic follows the original's order, with core's portable
// math, so every engine reads the same bits. Beyond the original: a node's `matrix` is read as its transform, a skin
// without inverse bind matrices has identity ones (as the spec says), and a file's clips together are held to a budget
// of frames and joint transforms, so a small hostile file can't ask for hours of work.
import { format, math } from "@m3a/core";
import { Bytes, IoError, LIMITS, spend } from "../bytes.ts";
import { plainOnly, type GltfDoc, type GltfJson, type GltfNode } from "./container.ts";

const { PORTABLE } = math;
const MM = 1000;
type V3 = number[];
type M4 = number[];

/** A clip captured as body points: frames of the 36 points (f, r, z mm) and the root's travel (f, r mm) when it moves;
 *  a loop cut from a take also says how far its hips travelled over the cycle (`stride`, mm). */
export type Capture = format.Capture & { stride?: number };
/** Where a point sits on its bone: its origin, its far end, or 12 cm in front of it. */
type Where = "tip" | "fwd" | undefined;
/** A rig the readers recognize: the bone that names it, its root, and the bone behind each body point. */
interface RigMap {
  test: string;
  root: string;
  map: (side: "L" | "R") => Record<string, string | [string, Where]>;
  core: Record<"pelvis" | "spine1" | "spine2" | "chest" | "neck" | "head", string>;
  segs: (side: "L" | "R") => [string, string, string][];
  coreSegs: [string, string, string][];
}

/** The rigs a glTF library may use: Rigify's deform bones (Quaternius' Library 1) and Unreal's names (Library 2, Mesh2Motion). */
export const RIGS: Readonly<Record<string, RigMap>> = {
  rigify: {
    test: "DEF-hips",
    root: "root",
    map: (s) => ({
      clav: "DEF-shoulder." + s, sh: "DEF-upper_arm." + s, elbow: "DEF-forearm." + s, wrist: "DEF-hand." + s, index: "DEF-f_index.01." + s, knuck: "DEF-f_middle.01." + s,
      pinky: "DEF-f_pinky.01." + s, fist: "DEF-f_middle.02." + s, hip: "DEF-thigh." + s, knee: "DEF-shin." + s, ankle: "DEF-foot." + s, ball: "DEF-toe." + s, toe: ["DEF-toe." + s, "tip"],
    }),
    core: { pelvis: "DEF-hips", spine1: "DEF-spine.001", spine2: "DEF-spine.002", chest: "DEF-spine.003", neck: "DEF-neck", head: "DEF-head" },
    segs: (s) => [["clav" + s, "sh" + s, "DEF-shoulder." + s], ["sh" + s, "elbow" + s, "DEF-upper_arm." + s], ["elbow" + s, "wrist" + s, "DEF-forearm." + s],
      ["wrist" + s, "knuck" + s, "DEF-hand." + s], ["hip" + s, "knee" + s, "DEF-thigh." + s], ["knee" + s, "ankle" + s, "DEF-shin." + s], ["ankle" + s, "ball" + s, "DEF-foot." + s], ["ball" + s, "toe" + s, "DEF-toe." + s]],
    coreSegs: [["pelvis", "spine1", "DEF-hips"], ["spine1", "spine2", "DEF-spine.001"], ["spine2", "chest", "DEF-spine.002"], ["chest", "neck", "DEF-spine.003"], ["neck", "head", "DEF-neck"], ["head", "headTop", "DEF-head"]],
  },
  unreal: {
    test: "spine_01",
    root: "root",
    map: (s) => {
      const x = s.toLowerCase();
      return { clav: "clavicle_" + x, sh: "upperarm_" + x, elbow: "lowerarm_" + x, wrist: "hand_" + x, index: "index_01_" + x, knuck: "middle_01_" + x,
        pinky: "pinky_01_" + x, fist: "middle_02_" + x, hip: "thigh_" + x, knee: "calf_" + x, ankle: "foot_" + x, ball: "ball_" + x, toe: "ball_leaf_" + x };
    },
    core: { pelvis: "pelvis", spine1: "spine_01", spine2: "spine_02", chest: "spine_03", neck: "neck_01", head: "Head" },
    segs: () => [],
    coreSegs: [],
  },
};

/** Each body point's bone and where on it, for a rig (POINTS order). */
function bonesFor(rig: string): [string, string, Where][] {
  const R = RIGS[rig]!, c = R.core;
  return format.POINTS.map((p): [string, string, Where] => {
    if (p in c) return [p, c[p as keyof typeof c], undefined];
    if (p === "headTop") return [p, c.head, "tip"];
    if (p === "faceF") return [p, c.head, "fwd"];
    if (p === "chestF") return [p, c.chest, "fwd"];
    if (p === "pelvisF") return [p, c.pelvis, "fwd"];
    const s = p.slice(-1) as "L" | "R", b = R.map(s)[p.slice(0, -1)]!;
    return Array.isArray(b) ? [p, b[0], b[1]] : [p, b, undefined];
  });
}

/* ---- column-major 4x4 matrices, quaternions [x, y, z, w] (the original's order of operations) ---- */
const mat = (t: number[] = [0, 0, 0], q: number[] = [0, 0, 0, 1], s: number[] = [1, 1, 1]): M4 => {
  const [x, y, z, w] = q as [number, number, number, number], xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [(1 - 2 * (yy + zz)) * s[0]!, 2 * (xy + wz) * s[0]!, 2 * (xz - wy) * s[0]!, 0, 2 * (xy - wz) * s[1]!, (1 - 2 * (xx + zz)) * s[1]!, 2 * (yz + wx) * s[1]!, 0,
    2 * (xz + wy) * s[2]!, 2 * (yz - wx) * s[2]!, (1 - 2 * (xx + yy)) * s[2]!, 0, t[0]!, t[1]!, t[2]!, 1];
};
const mul = (a: M4, b: M4): M4 => {
  const o = new Array<number>(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
  return o;
};
const xf = (m: M4, p: number[]): V3 => [m[0]! * p[0]! + m[4]! * p[1]! + m[8]! * p[2]! + m[12]!, m[1]! * p[0]! + m[5]! * p[1]! + m[9]! * p[2]! + m[13]!, m[2]! * p[0]! + m[6]! * p[1]! + m[10]! * p[2]! + m[14]!];
/** Spherical in-between of two quaternions, the shorter way (nearly equal ones in-betweened linearly), as the original. */
export const slerp = (a: number[], b: number[], t: number): number[] => {
  let d = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!, s = 1;
  if (d < 0) {
    d = -d;
    s = -1;
  }
  if (d > 0.9995) {
    const o = a.map((v, i) => v + (b[i]! * s - v) * t), l = PORTABLE.hypot(...o);
    return o.map((v) => v / l);
  }
  const th = PORTABLE.acos(d), k0 = PORTABLE.sin((1 - t) * th) / PORTABLE.sin(th), k1 = (PORTABLE.sin(t * th) / PORTABLE.sin(th)) * s;
  return a.map((v, i) => v * k0 + b[i]! * k1);
};
const pct = (arr: number[], p: number): number => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};

const SIZE: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES: Readonly<Record<number, number>> = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 };

/** An accessor's values (a number, or a row per element), each read checked against the buffer; `want` its type. */
export function accessor(json: GltfJson, bin: Bytes | null, i: number, want?: string): (number | number[])[] {
  const file = bin?.file, a = json.accessors?.[i];
  if (!a) throw new IoError("E_FORMAT", `no accessor ${i}`, { file });
  if (want && a.type !== want) throw new IoError("E_FORMAT", `accessor ${i} is a ${a.type}; it is read as a ${want}`, { file });
  if (a.bufferView === undefined) throw new IoError("E_FORMAT", `accessor ${i} has no bufferView (sparse accessors aren't read)`, { file });
  const bv = json.bufferViews?.[a.bufferView], n = SIZE[a.type], bytes = BYTES[a.componentType];
  if (!bv) throw new IoError("E_FORMAT", `accessor ${i}'s bufferView ${a.bufferView} doesn't exist`, { file });
  if (bv.buffer !== 0 || !bin) throw new IoError("E_MISSING", `accessor ${i} reads buffer ${bv.buffer}, which the file doesn't hold`, { file });
  if (!n) throw new IoError("E_FORMAT", `accessor ${i}'s type "${a.type}" isn't read`, { file });
  if (!bytes) throw new IoError("E_FORMAT", `accessor ${i}'s componentType ${a.componentType} isn't read (float, uint8, uint16, uint32)`, { file });
  if (!Number.isInteger(a.count) || a.count < 0 || a.count * n > LIMITS.values) throw new IoError("E_LIMIT", `accessor ${i} holds ${a.count} × ${n} values, over the limit`, { file });
  const read = a.componentType === 5126 ? (o: number) => bin.f32(o) : a.componentType === 5125 ? (o: number) => bin.u32(o) : a.componentType === 5123 ? (o: number) => bin.u16(o) : (o: number) => bin.u8(o);
  const norm = a.normalized ? ({ 5123: 65535, 5121: 255 } as Record<number, number>)[a.componentType] || 1 : 1;
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * bytes, out = new Array<number | number[]>(a.count);
  if (a.count > 0) bin.check(base, (a.count - 1) * stride + n * bytes, `accessor ${i}`);
  for (let k = 0; k < a.count; k++) {
    const row = new Array<number>(n);
    for (let c = 0; c < n; c++) row[c] = read(base + k * stride + c * bytes) / norm;
    out[k] = n === 1 ? row[0]! : row;
  }
  return out;
}

/** What a library holds, without reading its clips: the rig it uses (or null), its clips and its bones. */
export function describeGltf(doc: GltfDoc): { rig: string | null; clips: string[]; bones: string[] } {
  const nodes = doc.json.nodes ?? [], byName = names(doc.json);
  return { rig: Object.keys(RIGS).find((r) => byName.has(RIGS[r]!.test)) ?? null, clips: (doc.json.animations ?? []).map((a) => a.name ?? ""), bones: nodes.map((n) => n.name ?? "") };
}

/** The mannequin's look: its height, each segment's radii (mm, thirds along it) and its joint rings. */
export interface Look {
  height: number;
  segs: { a: string; b: string; r: number[] }[];
  bands: { a: string; b: string; t0: number; t1: number; r: number }[];
}
/** A library read: its rig, every clip as body points, the mannequin's look (Rigify meshes), and what it warned about. */
export interface GltfLibrary {
  rig: string;
  clips: Record<string, Capture>;
  body: Look | null;
  warnings: string[];
}

/** The time segment [j, j + 1] a track samples at `time`: the last key at or before it, at most the next-to-last. */
export function segment(T: readonly number[], time: number): number {
  let lo = 0, hi = T.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (T[mid]! <= time) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, Math.min(T.length - 2, lo - 1));
}

/** A node's rest transform: its translation, rotation and scale, or its `matrix` taken apart into them. */
export function restOf(n: GltfNode): { t: number[]; r: number[]; s: number[] } {
  const m = n.matrix;
  if (!m) return { t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1] };
  const col = (c: number) => [m[c * 4]!, m[c * 4 + 1]!, m[c * 4 + 2]!], len = (v: number[]) => PORTABLE.hypot(v[0]!, v[1]!, v[2]!);
  const x = col(0), y = col(1), z = col(2), det = x[0]! * (y[1]! * z[2]! - y[2]! * z[1]!) - x[1]! * (y[0]! * z[2]! - y[2]! * z[0]!) + x[2]! * (y[0]! * z[1]! - y[1]! * z[0]!);
  const sc = [len(x) * (det < 0 ? -1 : 1), len(y), len(z)], R = [x, y, z].map((v, i) => v.map((e) => e / (sc[i]! || 1)));
  // the rotation matrix (columns R[0..2]) as a quaternion, from its largest diagonal term
  const [m00, m10, m20] = R[0]!, [m01, m11, m21] = R[1]!, [m02, m12, m22] = R[2]!, tr = m00! + m11! + m22!;
  let q: number[];
  if (tr > 0) {
    const k = 0.5 / Math.sqrt(tr + 1);
    q = [(m21! - m12!) * k, (m02! - m20!) * k, (m10! - m01!) * k, 0.25 / k];
  } else if (m00! > m11! && m00! > m22!) {
    const k = 2 * Math.sqrt(1 + m00! - m11! - m22!);
    q = [0.25 * k, (m01! + m10!) / k, (m02! + m20!) / k, (m21! - m12!) / k];
  } else if (m11! > m22!) {
    const k = 2 * Math.sqrt(1 + m11! - m00! - m22!);
    q = [(m01! + m10!) / k, 0.25 * k, (m12! + m21!) / k, (m02! - m20!) / k];
  } else {
    const k = 2 * Math.sqrt(1 + m22! - m00! - m11!);
    q = [(m02! + m20!) / k, (m12! + m21!) / k, 0.25 * k, (m10! - m01!) / k];
  }
  return { t: [m[12]!, m[13]!, m[14]!], r: q, s: sc };
}

/** Each node's parent (−1 for none) and the nodes in parent-first order; fails on a child that doesn't exist or a cycle. */
export function hierarchy(nodes: readonly GltfNode[], file?: string): { parent: number[]; order: number[] } {
  if (nodes.length > LIMITS.nodes) throw new IoError("E_LIMIT", `${nodes.length} nodes, over the limit`, { file });
  const parent = new Array<number>(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => {
    if (!Number.isInteger(c) || c < 0 || c >= nodes.length) throw new IoError("E_FORMAT", `node ${i} lists child ${c}, which doesn't exist`, { file });
    parent[c] = i;
  }));
  // each node after its parents: walk up to a placed node (or a root), then place the chain top down
  const order: number[] = [], placed = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const chain: number[] = [];
    for (let k = i; k >= 0 && !placed[k]; k = parent[k]!) {
      if (chain.length > nodes.length) throw new IoError("E_FORMAT", `node ${i}'s parents form a cycle`, { file });
      chain.push(k);
    }
    for (let c = chain.length - 1; c >= 0; c--) {
      placed[chain[c]!] = 1;
      order.push(chain[c]!);
    }
  }
  return { parent, order };
}

/** Node names to indices, matching whatever their case (Library 2 says 'Head', Mesh2Motion's copy 'head'). */
function names(json: GltfJson): { get(k: string): number | undefined; has(k: string): boolean } {
  const byName = new Map<string | undefined, number>(), lower = new Map<string, number>();
  (json.nodes ?? []).forEach((n, i) => byName.set(n.name, i));
  for (const [k, i] of byName) if (typeof k === "string" && !lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), i);
  return { get: (k) => (byName.has(k) ? byName.get(k) : lower.get(String(k).toLowerCase())), has: (k) => byName.has(k) || lower.has(String(k).toLowerCase()) };
}

/**
 * Reads a glTF library (a .glb or .gltf already parsed) as body points: every clip sampled at `fps` (30), on the rig
 * it recognizes. Fails with E_RIG when the rig isn't one it knows or lacks a bone its map needs.
 */
export function readGltf(doc: GltfDoc, opts: { fps?: number } = {}): GltfLibrary {
  const FPS = opts.fps ?? 30, G = doc.json, bin = doc.bin, file = bin?.file, warnings: string[] = [];
  plainOnly(G, file);
  const nodes = G.nodes ?? [], { parent, order } = hierarchy(nodes, file), byName = names(G);
  const rig = Object.keys(RIGS).find((r) => byName.has(RIGS[r]!.test));
  if (!rig) throw new IoError("E_RIG", "the rig isn't one the importer knows (Rigify's DEF- bones or Unreal's names)", { file });
  const BONES = bonesFor(rig), missing = [...new Set(BONES.filter((b) => !byName.has(b[1])).map((b) => b[1]))];
  if (missing.length) throw new IoError("E_RIG", `it lacks bones the ${rig} map needs: ${missing.join(", ")}`, { file });
  const rest = nodes.map(restOf);
  const world = (trs: { t: number[]; r: number[]; s: number[] }[]): M4[] => {
    const W = new Array<M4>(nodes.length);
    for (const i of order) {
      const L = mat(trs[i]!.t, trs[i]!.r, trs[i]!.s);
      W[i] = parent[i]! >= 0 ? mul(W[parent[i]!]!, L) : L;
    }
    return W;
  };

  // the bind pose's mesh, each vertex in the frame of the bone that moves it most: the look and the tips' lengths
  const skin = (G.skins ?? [])[0], joints = skin ? skin.joints : [];
  const ibm = skin && skin.inverseBindMatrices !== undefined ? (accessor(G, bin, skin.inverseBindMatrices, "MAT4") as number[][]) : joints.map(() => mat());
  const meshNode = nodes.findIndex((n) => n.mesh !== undefined && n.skin !== undefined), mesh = skin && meshNode >= 0 ? G.meshes?.[nodes[meshNode]!.mesh!] ?? { primitives: [] } : { primitives: [] };
  if (!skin || meshNode < 0) warnings.push("no skinned mesh: the body is measured from the bones alone");
  const boneVerts = new Map<number, V3[]>(), bandVerts = new Map<number, V3[]>();
  let matJoint = -1;
  (G.materials ?? []).forEach((m, i) => {
    if (/joint/i.test(m.name ?? "")) matJoint = i;
  });
  let top = 0;
  for (const prim of mesh.primitives) {
    const at = prim.attributes, need = ["POSITION", "JOINTS_0", "WEIGHTS_0"].filter((k) => at[k] === undefined);
    if (need.length) throw new IoError("E_FORMAT", `a skinned primitive lacks ${need.join(", ")}`, { file });
    const Pp = accessor(G, bin, at.POSITION!, "VEC3") as number[][], JN = accessor(G, bin, at.JOINTS_0!, "VEC4") as number[][], W = accessor(G, bin, at.WEIGHTS_0!, "VEC4") as number[][], band = prim.material === matJoint;
    if (JN.length < Pp.length || W.length < Pp.length) throw new IoError("E_FORMAT", `a skinned primitive has ${Pp.length} positions, ${JN.length} joint sets and ${W.length} weight sets`, { file });
    for (let v = 0; v < Pp.length; v++) {
      top = Math.max(top, Pp[v]![1]!);
      let best = 0;
      for (let k = 1; k < 4; k++) if (W[v]![k]! > W[v]![best]!) best = k;
      const ji = JN[v]![best]!, node = joints[ji], m = ibm[ji];
      if (node === undefined || !m) throw new IoError("E_FORMAT", `vertex ${v} names joint ${ji}, which the skin doesn't list`, { file });
      const local = xf(m, Pp[v]!), into = band ? bandVerts : boneVerts;
      if (!into.has(node)) into.set(node, []);
      into.get(node)!.push(local);
    }
  }
  const bindW = world(rest);
  const verts = (i: number) => (boneVerts.get(i) || []).concat(bandVerts.get(i) || []);
  const boneLen = (name: string): number => {
    const i = byName.get(name)!, kids = nodes[i]!.children || [];
    if (kids.length) {
      const a = xf(bindW[i]!, [0, 0, 0]), b = xf(bindW[kids[0]!]!, [0, 0, 0]);
      return PORTABLE.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
    }
    return pct(verts(i).map((v) => v[1]!), 0.98);
  };
  const TIP: Record<string, number> = {};
  for (const b of BONES) if (b[2] === "tip") TIP[b[1]] = pct(verts(byName.get(b[1])!).map((v) => v[1]!), 0.98) || boneLen(b[1]);
  // the rig's own frame, from the rest pose: up = +y, forward from the heel toward the toes, right toward the R side
  const map = RIGS[rig]!.map, FWD: Record<string, number[]> = {};
  const pos = (W: M4[], name: string, where?: Where): V3 => {
    const i = byName.get(name)!;
    return where === "tip" ? xf(W[i]!, [0, TIP[name]!, 0]) : where === "fwd" ? xf(W[i]!, FWD[name]!) : xf(W[i]!, [0, 0, 0]);
  };
  const toeOf = (W: M4[]): V3 => {
    const t = map("L").toe!;
    return Array.isArray(t) ? pos(W, t[0], "tip") : pos(W, t);
  };
  const fwd0 = (() => {
    const a = pos(bindW, map("L").ankle as string), b = toeOf(bindW), v = [b[0]! - a[0]!, 0, b[2]! - a[2]!], l = PORTABLE.hypot(...v);
    return v.map((x) => x / l);
  })();
  const RIGHT = [-(fwd0[1]! * 0 - fwd0[2]! * 1), -(fwd0[2]! * 0 - fwd0[0]! * 0), -(fwd0[0]! * 1 - fwd0[1]! * 0)];
  {
    const l = pos(bindW, map("L").hip as string), r = pos(bindW, map("R").hip as string), d = (r[0]! - l[0]!) * RIGHT[0]! + (r[2]! - l[2]!) * RIGHT[2]!;
    if (d < 0) RIGHT.forEach((v, i) => (RIGHT[i] = -v));
  }
  // `fwd` points: the rest pose's forward direction written in each bone's own frame (the transpose of its rotation)
  for (const b of BONES) {
    if (b[2] !== "fwd") continue;
    const m = bindW[byName.get(b[1])!]!, n = [0, 1, 2].map((c) => PORTABLE.hypot(m[c * 4]!, m[c * 4 + 1]!, m[c * 4 + 2]!));
    FWD[b[1]] = [0, 1, 2].map((c) => ((m[c * 4]! * fwd0[0]! + m[c * 4 + 1]! * fwd0[1]! + m[c * 4 + 2]! * fwd0[2]!) / (n[c]! * n[c]!)) * 0.12);
  }
  const toLocal = (p: V3, o: V3): V3 => {
    const d = [p[0]! - o[0]!, p[1]!, p[2]! - o[2]!];
    return [d[0]! * fwd0[0]! + d[2]! * fwd0[2]!, d[0]! * RIGHT[0]! + d[2]! * RIGHT[2]!, d[1]!];
  };

  // the look of the mannequin: per-segment radii and where the joint-ring material sits (Rigify meshes)
  let body: Look | null = null;
  if (RIGS[rig]!.coreSegs.length && top > 0) {
    body = { height: Math.round(top * MM), segs: [], bands: [] };
    const SEGS = [...RIGS[rig]!.coreSegs, ...(["L", "R"] as const).flatMap(RIGS[rig]!.segs)];
    for (const [a, b, bone] of SEGS) {
      const i = byName.get(bone)!, vs = verts(i), L = boneLen(bone) || 1, bins: number[][] = [[], [], []];
      for (const v of vs) bins[v[1]! / L < 0.33 ? 0 : v[1]! / L < 0.67 ? 1 : 2]!.push(PORTABLE.hypot(v[0]!, v[2]!));
      body.segs.push({ a, b, r: bins.map((x) => Math.round(pct(x, 0.8) * MM)) });
      const bv = bandVerts.get(i);
      if (!bv || bv.length < 12) continue;
      const NB = 24, bb: V3[][] = Array.from({ length: NB }, () => []), min = Math.max(4, bv.length * 0.02);
      for (const v of bv) bb[Math.max(0, Math.min(NB - 1, Math.floor(((v[1]! / L + 0.2) / 1.4) * NB)))]!.push(v);
      for (let k = 0; k < NB; ) {
        if (bb[k]!.length < min) {
          k++;
          continue;
        }
        let e = k;
        const run: V3[] = [];
        while (e < NB && bb[e]!.length >= min) run.push(...bb[e++]!);
        body.bands.push({ a, b, t0: +pct(run.map((v) => v[1]! / L), 0.03).toFixed(2), t1: +pct(run.map((v) => v[1]! / L), 0.97).toFixed(2), r: Math.round(pct(run.map((v) => PORTABLE.hypot(v[0]!, v[2]!)), 0.85) * MM) });
        k = e;
      }
    }
  }

  // every clip, sampled and turned into body points
  const clips: Record<string, Capture> = {}, rootNode = byName.get(RIGS[rig]!.root) ?? order[0]!, P = format.P;
  let frames = 0;
  for (const an of G.animations ?? []) {
    const name = an.name ?? "", tracks = an.channels.map((c) => {
      const s = an.samplers[c.sampler];
      if (!s) throw new IoError("E_FORMAT", `clip "${name}" names sampler ${c.sampler}, which it doesn't have`, { file });
      if (s.interpolation === "CUBICSPLINE") throw new IoError("E_FORMAT", `clip "${name}" uses CUBICSPLINE in-betweens, which aren't read (bake it LINEAR)`, { file });
      if (c.target.node !== undefined && (!Number.isInteger(c.target.node) || c.target.node < 0 || c.target.node >= nodes.length)) throw new IoError("E_FORMAT", `clip "${name}" targets node ${c.target.node}, which doesn't exist`, { file });
      const want = c.target.path === "rotation" ? "VEC4" : c.target.path === "translation" || c.target.path === "scale" ? "VEC3" : undefined;
      const t = accessor(G, bin, s.input, "SCALAR") as number[], v = accessor(G, bin, s.output, want) as number[][];
      if (!t.length || v.length < t.length) throw new IoError("E_FORMAT", `clip "${name}": a track has ${t.length} times and ${v.length} values`, { file });
      return { node: c.target.node, path: c.target.path, t, v, interp: s.interpolation };
    });
    if (!tracks.length) throw new IoError("E_FORMAT", `clip "${name}" has no tracks`, { file });
    let dur = -Infinity;
    for (const k of tracks) dur = Math.max(dur, k.t[k.t.length - 1]!);
    const n = Math.max(1, Math.round(dur * FPS) + 1);
    frames += n;
    spend(frames, LIMITS.frames, `clip "${name}" lasts ${dur} s, so the clips come to ${frames} frames at ${FPS} fps`, file);
    spend(frames * nodes.length, LIMITS.work, `${frames} frames of ${nodes.length} nodes`, file);
    const data = new Float32Array(n * P * 3), move = new Float32Array(n * 2);
    let moved = false;
    for (let f = 0; f < n; f++) {
      const time = Math.min(dur, f / FPS), trs = rest.map((r) => ({ t: r.t, r: r.r, s: r.s }));
      for (const k of tracks) {
        const T = k.t, j = segment(T, time);
        const u = T.length < 2 || k.interp === "STEP" ? 0 : Math.max(0, Math.min(1, (time - T[j]!) / (T[j + 1]! - T[j]! || 1)));
        const a = k.v[j]!, b = k.v[Math.min(j + 1, k.v.length - 1)]!;
        const val = k.path === "rotation" ? slerp(a, b, u) : a.map((x, i) => x + (b[i]! - x) * u);
        const key = k.path === "translation" ? "t" : k.path === "rotation" ? "r" : k.path === "scale" ? "s" : null;
        if (key && k.node !== undefined) trs[k.node] = { ...trs[k.node]!, [key]: val };
      }
      const W = world(trs), root = xf(W[rootNode]!, [0, 0, 0]), rl = toLocal(root, [0, 0, 0]);
      move[f * 2] = rl[0]! * MM;
      move[f * 2 + 1] = rl[1]! * MM;
      if (Math.abs(rl[0]!) + Math.abs(rl[1]!) > 0.01) moved = true;
      BONES.forEach(([, bone, where], i) => {
        const p = toLocal(pos(W, bone, where), root);
        data[(f * P + i) * 3] = p[0]! * MM;
        data[(f * P + i) * 3 + 1] = p[1]! * MM;
        data[(f * P + i) * 3 + 2] = p[2]! * MM;
      });
    }
    clips[name] = { name, n, dur, loop: /_Loop$/.test(name) || /(^|_)Idle$/.test(name), fps: FPS, data, move: moved ? move : null };
  }
  return { rig, clips, body, warnings };
}
