// Writing a solved pose to three.js bones without allocating (PLAN.md WP-4.4): each bone's local rotation as the
// solver gives it (a bone whose parent isn't in the skeleton turned into its parent node's space), and the hips' place
// in its parent's space. Everything it needs is made once per bound character.
import type { Bone, Object3D } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Solved } from "@m3a/core";
import type { ThreeBound } from "../bind/index.ts";

/** A writer for one bound character: `write(solved)` sets its bones. */
export interface Writer {
  write(s: Pick<Solved, "local" | "hips">): void;
}

/** The writer for a bound character. */
export function writer(b: ThreeBound): Writer {
  const bones = b.bones, names = bones.map((x) => x.name), inBound = new Set<Object3D>(bones);
  const hips = b.humanoid.hips!, root = b.root;
  // a bone whose parent isn't a bound bone: its solved rotation is in the root's space; turned into its parent's
  const outer = bones.map((x) => {
    if (x.parent && inBound.has(x.parent)) return null;
    const m = new Matrix4().copy(root.matrixWorld).invert().multiply(x.parent ? x.parent.matrixWorld : root.matrixWorld), q = new Quaternion();
    m.decompose(new Vector3(), q, new Vector3());
    return q.invert();
  });
  const inv = new Matrix4(), rootInv = new Matrix4(), v = new Vector3(), parent = hips.parent as Object3D | null;
  return {
    write(s) {
      for (let i = 0; i < bones.length; i++) {
        const q = s.local[names[i]!];
        if (!q) continue;
        const bone = bones[i]! as Bone;
        bone.quaternion.set(q[0], q[1], q[2], q[3]);
        const o = outer[i];
        if (o) bone.quaternion.premultiply(o);
      }
      // the hips' place, from the root's space into its parent's (its parent posed first)
      if (parent) {
        parent.updateWorldMatrix(true, false);
        rootInv.copy(root.matrixWorld).invert();
        inv.multiplyMatrices(rootInv, parent.matrixWorld).invert();
        hips.position.copy(v.set(s.hips[0], s.hips[1], s.hips[2]).applyMatrix4(inv));
      } else hips.position.set(s.hips[0], s.hips[1], s.hips[2]);
    },
  };
}
