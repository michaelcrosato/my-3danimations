// A glTF character's skeleton as core binds it (PLAN.md WP-7.2b, D93: characters bind through core, not three.js's
// loader). The bones are the joints of its skin with the most (a skinned mesh's skeleton, as three's bind takes it),
// kept to those some vertex is weighted to and every joint above one, so a rig's IK and roll controls, which move
// nothing, don't mislead recognition (three's bind leaves them out the same way); a VRM keeps every joint, its humanoid
// naming them; weights that can't be read (a compressed mesh) keep them all. Without a skin, every node is a bone
// (tier 1b's rig.gltf). Each has its parent (the nearest ancestor that is a bone), its rest head and its rest
// orientation in the scene's space (every node above it applied: an armature's rotation and scale too), in the file's
// metres, +y up. Names are the file's own (three.js would sanitize them); a bone with none, or one another bone took
// first, is named for its node. Untrusted input: hierarchy() refuses cycles, missing children and too many nodes.
import type { SkeletonIn } from "@m3a/core";
import { IoError } from "../bytes.ts";
import type { GltfDoc } from "./container.ts";
import { accessor, hierarchy, mat, mul, restOf } from "./read.ts";

/** A glTF character's skeleton: the bones core binds, each bone's rest orientation in the scene's space ([x, y, z, w],
 *  by bone name, as core's bind takes `restWorld`), and the node each bone is (`nodes[k]` for `skeleton.bones[k]`). */
export interface GltfSkeleton {
  skeleton: SkeletonIn;
  restWorld: Record<string, [number, number, number, number]>;
  nodes: number[];
}

/** A glTF document's skeleton: its biggest skin's joints (those that deform, and above), or every node without a skin.
 *  Fails with E_RIG when it has no bones, E_FORMAT when a skin names a node that isn't there. */
export function skeletonOfGltf(doc: GltfDoc): GltfSkeleton {
  const file = doc.bin?.file, nodes = doc.json.nodes ?? [], { parent, order } = hierarchy(nodes, file);
  const skin = (doc.json.skins ?? []).reduce<number[] | null>((best, s) => (!best || s.joints.length > best.length ? s.joints : best), null);
  for (const j of skin ?? []) if (j >= nodes.length) throw new IoError("E_FORMAT", `a skin names joint ${j}, which doesn't exist`, { file });
  const vrm = doc.json.extensions?.VRMC_vrm !== undefined || doc.json.extensions?.VRM !== undefined, keep = skin && !vrm ? deforming(doc, parent) : null;
  const picked = skin ? [...new Set(skin)].filter((j) => !keep || keep.has(j)) : nodes.map((_, i) => i);
  if (!picked.length) throw new IoError("E_RIG", "no bones: a character's skeleton is its skin's joints, or its nodes", { file });
  // each node's world matrix, parents first
  const world = new Array<number[]>(nodes.length);
  for (const i of order) {
    const r = restOf(nodes[i]!), local = nodes[i]!.matrix ?? mat(r.t, r.r, r.s);
    world[i] = parent[i]! < 0 ? local : mul(world[parent[i]!]!, local);
  }
  const used = new Set<string>(), name = new Map<number, string>();
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
    const w = restOf({ matrix: world[i]! }), q = w.r, l = Math.hypot(q[0]!, q[1]!, q[2]!, q[3]!) || 1;
    restWorld[name.get(i)!] = [q[0]! / l, q[1]! / l, q[2]! / l, q[3]! / l];
    return { name: name.get(i)!, parent: above(i), head: [w.t[0]!, w.t[1]!, w.t[2]!] as [number, number, number] };
  });
  return { skeleton: { bones, up: [0, 1, 0] }, restWorld, nodes: picked };
}

/** The joints some vertex of a skinned mesh is weighted to, and every joint above one; null when nothing is, or when the
 *  weights can't be read (a mesh compressed, or broken: the skeleton doesn't need it). */
function deforming(doc: GltfDoc, parent: readonly number[]): Set<number> | null {
  const G = doc.json, joint = new Set((G.skins ?? []).flatMap((s) => s.joints)), used = new Set<number>();
  if (G.extensionsRequired?.length) return null;
  try {
    for (const n of G.nodes ?? []) {
      const joints = n.skin === undefined ? undefined : G.skins?.[n.skin]?.joints, mesh = n.mesh === undefined ? undefined : G.meshes?.[n.mesh];
      if (!joints || !mesh) continue;
      for (const p of mesh.primitives) {
        if (p.attributes.JOINTS_0 === undefined || p.attributes.WEIGHTS_0 === undefined) continue;
        const js = accessor(G, doc.bin, p.attributes.JOINTS_0, "VEC4") as number[][], ws = accessor(G, doc.bin, p.attributes.WEIGHTS_0, "VEC4") as number[][];
        js.forEach((row, v) => row.forEach((j, k) => {
          const at = joints[j];
          if (at !== undefined && (ws[v]?.[k] ?? 0) > 0) used.add(at);
        }));
      }
    }
  } catch (err) {
    if (err instanceof IoError) return null;
    throw err;
  }
  const keep = new Set<number>();
  for (const j of used) for (let p = j; p >= 0 && joint.has(p) && !keep.has(p); p = parent[p]!) keep.add(p);
  return keep.size ? keep : null;
}
