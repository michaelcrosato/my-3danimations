// glTF animations on a character's own nodes (PLAN.md WP-7.2b, D93): a clip played on the character bound through core,
// sampled as the VRMA writer samples it (`sampleNodes`), each bone's node turned, and the roots' and the hips' moved,
// relative to its own parent in the file as that parent stands then, so a node between two bones (a helper, an
// armature with its turn and scale) keeps its rest. D49's end bones have no node and ride on their parents.
// `addAnimation` adds the animation to the character's document, its accessors appended to the buffer, packed as .glb;
// `skeletonDoc` makes a document of a bound skeleton's own bones, for a character with no file. `glbGap` reads a written
// file back through io (`posedOf`; a compressed mesh no bar, since it reads only the nodes and the animation added),
// places each node as a viewer does (every node's matrix, its scale uneven too) and measures how far each bone's node
// lands from where the Animator put the bone.
import { math, VERSION, type AnimClip, type Bound } from "@m3a/core";
import { IoError } from "../bytes.ts";
import { extrasOf, restNodes, sampleNodes, worldAt, type VrmaExtras, type VrmaTrack } from "../vrma/vrma.ts";
import { packGlb, parseGlb, type GltfDoc, type GltfJson } from "./container.ts";
import { posedOf } from "./posed.ts";
import { hierarchy, restOf } from "./read.ts";

const { quat, PORTABLE } = math;
type V3 = [number, number, number];
type Q = [number, number, number, number];
const q = (a: ArrayLike<number>): Q => [a[0]!, a[1]!, a[2]!, a[3]!];
const qmul = (a: ArrayLike<number>, b: ArrayLike<number>): Q => q(quat.multiply([0, 0, 0, 1], q(a), q(b)));
const conj = (a: ArrayLike<number>): Q => [-a[0]!, -a[1]!, -a[2]!, a[3]!];
const rotate = (a: ArrayLike<number>, v: ArrayLike<number>): V3 => {
  const r = quat.rotate([0, 0, 0], q(a), [v[0]!, v[1]!, v[2]!]);
  return [r[0]!, r[1]!, r[2]!];
};
const each = (a: ArrayLike<number>, b: ArrayLike<number>, f: (x: number, y: number) => number): V3 => [f(a[0]!, b[0]!), f(a[1]!, b[1]!), f(a[2]!, b[2]!)];

/** A glTF animation: its name, its sample times, each track (a node's rotation or translation at every time), and the
 *  clip's extras (its license among them). */
export interface GltfAnim {
  name: string;
  times: Float32Array;
  tracks: VrmaTrack[];
  extras: VrmaExtras;
}

/** Each node's world scale at rest (scale isn't animated), by node. */
function scales(doc: GltfDoc): V3[] {
  const all = doc.json.nodes ?? [], { parent, order } = hierarchy(all, doc.bin?.file), S: V3[] = [];
  for (const i of order) S[i] = each(parent[i]! < 0 ? [1, 1, 1] : S[parent[i]!]!, restOf(all[i]!).s, (a, b) => a * b);
  return S;
}

/**
 * A clip played on bound skeleton `b` as an animation of a character's document `doc`: `nodes` names each bone's node
 * (skeletonOfGltf's), and a bone with none (an end bone) rides on its parent. Each bone's node is turned relative to its
 * parent in the file as that parent stands (a bone's node as played, any other node at rest, its scale kept); the
 * roots' and the hips' nodes are moved too. E_FORMAT when a bone names a node that isn't there, or one another took.
 */
export function gltfAnimOf(clip: AnimClip, b: Bound, doc: GltfDoc, nodes: Readonly<Record<string, number>>, opts: { fps?: number } = {}): GltfAnim {
  const s = sampleNodes(clip, b, opts), all = doc.json.nodes ?? [], file = doc.bin?.file, { parent, order } = hierarchy(all, file), rest = all.map(restOf), S = scales(doc);
  const bone = new Map<number, number>();
  b.order.forEach((o, k) => {
    const n = nodes[o.name];
    if (n === undefined) return;
    if (!Number.isInteger(n) || n < 0 || n >= all.length || bone.has(n)) throw new IoError("E_FORMAT", `bone ${o.name} names node ${n}, which ${bone.has(n) ? "another bone took" : "isn't there"}`, { file });
    bone.set(n, k);
  });
  const len = s.times.length, rot = new Map<number, Float32Array>(), pos = new Map<number, Float32Array>(), R: Q[] = [], P: V3[] = [];
  for (const [n, k] of bone) {
    rot.set(n, new Float32Array(len * 4));
    if (s.pos.has(k)) pos.set(n, new Float32Array(len * 3));
  }
  for (let i = 0; i < len; i++) {
    const w = worldAt(s, i);
    for (const j of order) {
      const up = parent[j]!, pr: Q = up < 0 ? [0, 0, 0, 1] : R[up]!, pp: V3 = up < 0 ? [0, 0, 0] : P[up]!, ps: V3 = up < 0 ? [1, 1, 1] : S[up]!, k = bone.get(j);
      if (k === undefined) {
        [R[j], P[j]] = [qmul(pr, rest[j]!.r), each(pp, rotate(pr, each(ps, rest[j]!.t, (a, x) => a * x)), (a, x) => a + x)];
        continue;
      }
      [R[j], P[j]] = [w.r[k]!, w.p[k]!];
      rot.get(j)!.set(qmul(conj(pr), R[j]!), i * 4);
      pos.get(j)?.set(each(rotate(conj(pr), each(P[j]!, pp, (a, x) => a - x)), ps, (a, x) => a / x), i * 3);
    }
  }
  const tracks = [...bone.keys()].sort((x, y) => x - y).flatMap((n): VrmaTrack[] => [{ node: n, path: "rotation", values: rot.get(n)! }, ...(pos.has(n) ? [{ node: n, path: "translation" as const, values: pos.get(n)! }] : [])]);
  return { name: clip.id ?? "clip", times: s.times, tracks, extras: extrasOf(clip).extras };
}

/** `doc` with `anim` added as its last animation (its times and tracks appended to the buffer, LINEAR), as a .glb. */
export function addAnimation(doc: GltfDoc, anim: GltfAnim): Uint8Array {
  const json = structuredClone(doc.json) as GltfJson, old = doc.bin?.raw() ?? new Uint8Array(0), accessors: unknown[] = [...(json.accessors ?? [])], views: unknown[] = [...(json.bufferViews ?? [])];
  const chunks: [number, Float32Array][] = [];
  let at = old.length + ((4 - (old.length % 4)) % 4);
  const put = (values: Float32Array, type: string, minmax = false): number => {
    views.push({ buffer: 0, byteOffset: at, byteLength: values.byteLength });
    accessors.push({ bufferView: views.length - 1, componentType: 5126, count: anim.times.length, type, ...(minmax ? { min: [values[0] ?? 0], max: [values[values.length - 1] ?? 0] } : {}) });
    chunks.push([at, values]);
    at += values.byteLength;
    return accessors.length - 1;
  };
  const input = put(anim.times, "SCALAR", true), samplers: unknown[] = [], channels: unknown[] = [];
  for (const t of anim.tracks) {
    if (t.values.length !== anim.times.length * (t.path === "rotation" ? 4 : 3)) throw new IoError("E_FORMAT", `node ${t.node}'s ${t.path} track has ${t.values.length} values for ${anim.times.length} times`);
    samplers.push({ input, output: put(t.values, t.path === "rotation" ? "VEC4" : "VEC3"), interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: t.node, path: t.path } });
  }
  const bin = new Uint8Array(at);
  bin.set(old);
  for (const [o, v] of chunks) bin.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), o);
  // the BIN chunk is buffer 0: its uri (a .gltf's data: uri) dropped, its length the new one
  const [first, ...others] = json.buffers ?? [], { uri: _uri, ...kept } = first ?? { byteLength: 0 };
  Object.assign(json, { buffers: [{ ...kept, byteLength: at }, ...others], accessors, bufferViews: views, animations: [...(json.animations ?? []), { name: anim.name, channels, samplers, extras: anim.extras }] });
  return packGlb(json, bin);
}

/** A document of bound skeleton `b`'s own bones at rest, each a node named as the bone (a character with no file, the
 *  tiny rig), and each bone's node. */
export function skeletonDoc(b: Bound): { doc: GltfDoc; nodes: Record<string, number> } {
  const at = restNodes(b), kids = at.map(() => [] as number[]);
  at.forEach((nd, i) => nd.parent >= 0 && kids[nd.parent]!.push(i));
  const json: GltfJson = {
    asset: { version: "2.0", generator: `@m3a/io ${VERSION}` } as GltfJson["asset"],
    scene: 0,
    scenes: [{ nodes: at.flatMap((nd, i) => (nd.parent < 0 ? [i] : [])) }],
    nodes: at.map((nd, i) => ({ name: nd.name, translation: nd.translation, rotation: nd.rotation, ...(kids[i]!.length ? { children: kids[i] } : {}) })),
  };
  return { doc: { json, bin: null }, nodes: Object.fromEntries(at.map((nd, i) => [nd.name, i])) };
}

/** 3x3 matrices, row by row: a product, and one applied to a vector. */
const mat = (a: readonly number[], b: readonly number[]): number[] => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!));
const apply = (m: readonly number[], v: readonly number[]): V3 => [0, 1, 2].map((r) => m[r * 3]! * v[0]! + m[r * 3 + 1]! * v[1]! + m[r * 3 + 2]! * v[2]!) as V3;

/**
 * How far (mm) the bones' nodes of a .glb that `addAnimation` wrote land from where the Animator puts the bones, read
 * back through io (`posedOf` on its last animation) and placed as a glTF viewer places them, each node's matrix (its
 * turn and its scale, uneven too) applied to its children: the most at any sample. A node between two bones that
 * scales unevenly shears its children as they turn, which no animation of turns can follow, so it reads back off. The
 * extensions a file requires (a mesh's compression, meshopt's or Draco's) are no bar: it reads only the nodes and that
 * animation, whose accessors are plain. E_FORMAT or E_LIMIT (from the reader) for a file it can't read back.
 */
export function glbGap(bytes: Uint8Array, clip: AnimClip, b: Bound, nodes: Readonly<Record<string, number>>, opts: { fps?: number } = {}): number {
  const s = sampleNodes(clip, b, opts), doc = parseGlb(bytes), n = s.times.length - 1, all = doc.json.nodes ?? [];
  delete doc.json.extensionsRequired;
  const back = posedOf(doc, (doc.json.animations ?? []).length - 1, n / clip.dur, String), node = back.names.map(Number), at = new Map(node.map((x, k) => [x, k])), scale = node.map((x) => restOf(all[x]!).s);
  let worst = 0;
  for (let i = 0; i <= n; i++) {
    const w = worldAt(s, i), L: number[][] = [], P: V3[] = [];
    // parents come first: each node's matrix its turn times its scale, its place its parent's matrix on its translation
    back.poses!.at(i).forEach(([r, t], k) => {
      const m = r.map((x, e) => x * scale[k]![e % 3]!), up = back.parent[k];
      [L[k], P[k]] = up === null || up === undefined ? [m, [t[0]!, t[1]!, t[2]!]] : [mat(L[up]!, m), each(P[up]!, apply(L[up]!, t), (a, x) => a + x)];
    });
    b.order.forEach((o, k) => {
      const j = at.get(nodes[o.name] ?? -1);
      if (j !== undefined) worst = Math.max(worst, PORTABLE.hypot(P[j]![0] - w.p[k]![0], P[j]![1] - w.p[k]![1], P[j]![2] - w.p[k]![2]));
    });
  }
  return worst / b.scale;
}
