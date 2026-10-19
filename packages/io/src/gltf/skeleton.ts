// A glTF character's skeleton as core binds it (PLAN.md WP-7.2b, D93: characters bind through core, not three.js's
// loader). The bones are the joints of the biggest skin a mesh node uses (a skinned mesh's skeleton, as three's bind
// takes it; with none, the biggest skin), kept to those some vertex is weighted to and every joint above one, so a
// rig's IK and roll controls, which move nothing, don't mislead recognition (three's bind leaves them out the same
// way); a VRM keeps every joint, its humanoid naming them; weights that can't be read (a compressed mesh) keep them
// all, and say why. Without a skin, every node is a bone (tier 1b's rig.gltf). Each has its parent (the nearest
// ancestor that is a bone, through any helper node between; three's bind makes such a bone a root), its rest head and
// its rest orientation in the scene's space (every node above it applied: an armature's rotation and scale too), in
// the file's metres, +y up. Names are the file's own (three.js would sanitize them); a bone with none, or one another
// bone took first, is named for its node. `meshEnds` reads where a joint's part of the skinned mesh ends, on the sole:
// the end bone D49 gives a foot with no child, as three's bind reads it (skinned by the joints alone: the skinned mesh
// node's own transform is ignored, as glTF says and as three's bind matrix cancels it), or why it read none. Lengths
// use core's portable hypot (V8's bits in every engine). Untrusted input: hierarchy() refuses cycles, missing children
// and too many nodes; a bone whose rest head the node transforms overflow is refused; every accessor read is checked
// against the buffer.
import { math, type SkeletonIn } from "@m3a/core";
import { IoError } from "../bytes.ts";
import type { GltfDoc, GltfJson, GltfNode } from "./container.ts";
import { accessor, hierarchy, mat, mul, restOf, xf } from "./read.ts";

const { PORTABLE } = math;

/** A glTF character's skeleton: the bones core binds, each bone's rest orientation in the scene's space ([x, y, z, w],
 *  by bone name, as core's bind takes `restWorld`), the node each bone is (`nodes[k]` for `skeleton.bones[k]`), and why
 *  the skinned meshes' weights went unread, so that every joint was kept: the compression the file requires (e.g.
 *  EXT_meshopt_compression; `meshEnds` then reads no end either), or "unreadable" (some mesh's broken, maybe one that
 *  skins no foot); null otherwise. */
export interface GltfSkeleton {
  skeleton: SkeletonIn;
  restWorld: Record<string, [number, number, number, number]>;
  nodes: number[];
  unread: string | null;
}

/** Each node's world matrix at rest, parents first. */
function worlds(nodes: readonly GltfNode[], parent: readonly number[], order: readonly number[]): number[][] {
  const world = new Array<number[]>(nodes.length);
  for (const i of order) {
    const r = restOf(nodes[i]!), local = nodes[i]!.matrix ?? mat(r.t, r.r, r.s);
    world[i] = parent[i]! < 0 ? local : mul(world[parent[i]!]!, local);
  }
  return world;
}

/** The compression the file's meshes require (meshopt or Draco), so that their weights and positions can't be read;
 *  else undefined. */
const compressed = (G: GltfJson): string | undefined => G.extensionsRequired?.find((e) => /^(EXT|KHR)_meshopt_compression$|^KHR_draco_mesh_compression$/.test(e));

/** The joints of the skin with the most of them (the first, on a tie), of those `skins` whose index `ok` passes. */
const biggest = (skins: GltfJson["skins"], ok: (k: number) => boolean): number[] | null =>
  (skins ?? []).reduce<number[] | null>((best, s, k) => (ok(k) && (!best || s.joints.length > best.length) ? s.joints : best), null);

/** A glTF document's skeleton: the joints (those that deform, and above) of the biggest skin a mesh node uses (as three's
 *  bind takes the skinned mesh with the most bones), else of the biggest skin, or every node without a skin. Fails with
 *  E_RIG when it has no bones or a bone's rest head isn't finite (the node transforms down to it overflow), E_FORMAT
 *  when a skin names a node that isn't there. */
export function skeletonOfGltf(doc: GltfDoc): GltfSkeleton {
  const file = doc.bin?.file, nodes = doc.json.nodes ?? [], { parent, order } = hierarchy(nodes, file);
  const skinning = new Set(nodes.flatMap((n) => (n.mesh !== undefined && n.skin !== undefined ? [n.skin] : [])));
  const skin = biggest(doc.json.skins, (k) => skinning.has(k)) ?? biggest(doc.json.skins, () => true);
  for (const j of skin ?? []) if (j >= nodes.length) throw new IoError("E_FORMAT", `a skin names joint ${j}, which doesn't exist`, { file });
  const vrm = doc.json.extensions?.VRMC_vrm !== undefined || doc.json.extensions?.VRM !== undefined, keep = skin && !vrm ? deforming(doc, parent, skin) : null;
  const moving = keep instanceof Set ? keep : null, picked = skin ? [...new Set(skin)].filter((j) => !moving || moving.has(j)) : nodes.map((_, i) => i);
  const unread = skin ? (compressed(doc.json) ?? (keep === "unreadable" ? keep : null)) : null;
  if (!picked.length) throw new IoError("E_RIG", "no bones: a character's skeleton is its skin's joints, or its nodes", { file });
  const world = worlds(nodes, parent, order), used = new Set<string>(), name = new Map<number, string>();
  for (const i of picked) {
    let n = nodes[i]!.name || `node${i}`;
    while (used.has(n)) n = `${n}_node${i}`;
    used.add(n);
    name.set(i, n);
  }
  const above = (i: number): string | null => {
    for (let p = parent[i]!; p >= 0; p = parent[p]!) if (name.has(p)) return name.get(p)!;
    return null;
  };
  const restWorld: GltfSkeleton["restWorld"] = {};
  const bones = picked.map((i) => {
    const w = restOf({ matrix: world[i]! }), q = w.r, l = PORTABLE.hypot(q[0]!, q[1]!, q[2]!, q[3]!) || 1;
    restWorld[name.get(i)!] = [q[0]! / l, q[1]! / l, q[2]! / l, q[3]! / l];
    return { name: name.get(i)!, parent: above(i), head: [w.t[0]!, w.t[1]!, w.t[2]!] as [number, number, number] };
  });
  // each node's own transform is finite (container.ts checks), but their product down the hierarchy can overflow
  const bad = bones.find((b) => !b.head.every(Number.isFinite));
  if (bad) throw new IoError("E_RIG", `bone ${bad.name}'s rest head isn't finite: the node transforms down to it overflow`, { file });
  return { skeleton: { bones, up: [0, 1, 0] }, restWorld, nodes: picked, unread };
}

/** Of `skin`'s joints, those some vertex of a skinned mesh (of any skin) is weighted to, and every joint above one (as
 *  three's bind climbs: from its own skeleton's bones, through any skin's joints); a vertex weighted to nothing counts
 *  its first joint, as three's loader gives it all its weight. Null when none is (every joint is then kept),
 *  "unreadable" when the weights can't be read (a mesh compressed, or broken: the skeleton doesn't need them). */
function deforming(doc: GltfDoc, parent: readonly number[], skin: readonly number[]): Set<number> | "unreadable" | null {
  const G = doc.json, joint = new Set((G.skins ?? []).flatMap((s) => s.joints)), used = new Set<number>();
  if (compressed(G)) return "unreadable";
  try {
    for (const n of G.nodes ?? []) {
      const joints = n.skin === undefined ? undefined : G.skins?.[n.skin]?.joints, mesh = n.mesh === undefined ? undefined : G.meshes?.[n.mesh];
      if (!joints || !mesh) continue;
      for (const p of mesh.primitives) {
        if (p.attributes.JOINTS_0 === undefined || p.attributes.WEIGHTS_0 === undefined) continue;
        const js = accessor(G, doc.bin, p.attributes.JOINTS_0, "VEC4") as number[][], ws = accessor(G, doc.bin, p.attributes.WEIGHTS_0, "VEC4") as number[][];
        js.forEach((row, v) => {
          const w = ws[v] ?? [], none = Math.abs(w[0] ?? 0) + Math.abs(w[1] ?? 0) + Math.abs(w[2] ?? 0) + Math.abs(w[3] ?? 0) === 0;
          row.forEach((j, k) => {
            const at = joints[j];
            if (at !== undefined && (none ? k === 0 : (w[k] ?? 0) > 0)) used.add(at);
          });
        });
      }
    }
  } catch (err) {
    if (err instanceof IoError) return "unreadable";
    throw err;
  }
  const keep = new Set<number>();
  for (const j of skin) if (used.has(j)) for (let p = j; p >= 0 && joint.has(p) && !keep.has(p); p = parent[p]!) keep.add(p);
  return keep.size ? keep : null;
}

/** Where each joint's part of the skinned mesh ends (`ends`, in the joints' order; null for a joint no vertex is
 *  weighted to), and why the meshes went unread (`unread`: the compression the file requires, or what broke the read;
 *  null when they were read), so that no end bone was found. */
export interface MeshEnds {
  ends: ([number, number, number] | null)[];
  unread: string | null;
}

/**
 * Where each joint's part of the skinned mesh ends (D49: a foot that ends with no child gets an end bone there, on the
 * sole), as three's bind reads it: of the vertices weighted half or more to the joint, in every mesh a skin naming it
 * skins, at rest (skinned by their joints, the weights summed to 1; the skinned mesh node's own transform ignored, as
 * glTF says and three's bind matrix cancels it), the one farthest from the joint's head across the ground (+y up),
 * brought down to the lowest of them; in the scene's space, metres. When a mesh that skins one of them can't be read
 * (compressed, or an accessor io doesn't read or that is broken), no joint has an end and `unread` says why: the end
 * is a refinement, never a reason to refuse the character.
 */
export function meshEnds(doc: GltfDoc, joints: readonly number[]): MeshEnds {
  const G = doc.json, bin = doc.bin, nodes = G.nodes ?? [], { parent, order } = hierarchy(nodes, bin?.file), world = worlds(nodes, parent, order);
  const best = joints.map(() => ({ at: null as number[] | null, far: -1, low: Infinity })), packed = compressed(G);
  const none = (unread: string): MeshEnds => ({ ends: joints.map(() => null), unread });
  try {
    for (const n of nodes) {
      const skin = n.skin === undefined ? undefined : G.skins?.[n.skin], mesh = n.mesh === undefined ? undefined : G.meshes?.[n.mesh];
      const which = skin ? joints.map((j) => skin.joints.indexOf(j)) : [];
      if (!skin || !mesh || which.every((i) => i < 0)) continue;
      if (packed) return none(packed);
      const ibm = skin.inverseBindMatrices === undefined ? null : (accessor(G, bin, skin.inverseBindMatrices, "MAT4") as number[][]);
      const jm = skin.joints.map((j, k) => {
        if (!world[j]) throw new IoError("E_FORMAT", `a skin names joint ${j}, which doesn't exist`);
        return ibm?.[k] ? mul(world[j]!, ibm[k]!) : world[j]!;
      });
      for (const p of mesh.primitives) {
        const a = p.attributes;
        if (a.POSITION === undefined || a.JOINTS_0 === undefined || a.WEIGHTS_0 === undefined) continue;
        const P = accessor(G, bin, a.POSITION, "VEC3") as number[][], J = accessor(G, bin, a.JOINTS_0, "VEC4") as number[][], W = accessor(G, bin, a.WEIGHTS_0, "VEC4") as number[][];
        P.forEach((pos, v) => {
          const js = J[v], w0 = W[v];
          if (!js || !w0) return;
          // three sums a vertex's weights to 1 (all zero: the first joint's alone)
          const sum = Math.abs(w0[0]!) + Math.abs(w0[1]!) + Math.abs(w0[2]!) + Math.abs(w0[3]!), w = sum ? w0.map((x) => x / sum) : [1, 0, 0, 0];
          let at: number[] | null = null;
          which.forEach((i, b) => {
            let mine = 0;
            for (let c = 0; c < 4 && i >= 0; c++) if (js[c] === i) mine += w[c]!;
            if (mine < 0.5) return;
            if (!at) {
              at = [0, 0, 0];
              for (let c = 0; c < 4; c++) {
                if (w[c] === 0) continue;
                const M = jm[js[c]!];
                if (!M) throw new IoError("E_FORMAT", `vertex ${v} names joint ${js[c]}, which the skin doesn't list`);
                const q = xf(M, pos);
                for (let k = 0; k < 3; k++) at[k]! += q[k]! * w[c]!;
              }
            }
            const e = best[b]!, h = world[joints[b]!]!, flat = PORTABLE.hypot(at[0]! - h[12]!, at[2]! - h[14]!);
            if (flat > e.far) [e.far, e.at] = [flat, at];
            e.low = Math.min(e.low, at[1]!);
          });
        });
      }
    }
  } catch (err) {
    // the file's name dropped: the caller reports it for that file
    if (err instanceof IoError) return none(err.file ? err.message.slice(err.file.length + 2) : err.message);
    throw err;
  }
  return { ends: best.map((e) => (e.at ? [e.at[0]!, e.low, e.at[2]!] : null)), unread: null };
}
