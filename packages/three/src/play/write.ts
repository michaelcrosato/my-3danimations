// Writing a solved pose to three.js bones without allocating (PLAN.md WP-4.4): each bone's local rotation as the
// solver gives it (a bone whose parent isn't in the skeleton turned into its parent node's space), and the hips' place
// in its parent's space, the whole pose turned about the up axis by the root's turn the pose doesn't carry (an Animator
// pose's `turn`, F.14). Everything it needs is made once per bound character.
import type { Bone, Object3D } from "three";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { Solved } from "@m3a/core";
import type { ThreeBound } from "../bind/index.ts";

/** A writer for one bound character: `write(solved, turn)` sets its bones, the pose turned by `turn` degrees (+ toward
 *  the character's right) about its up axis. */
export interface Writer {
  write(s: Pick<Solved, "local" | "hips">, turn?: number): void;
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
  // the turn: about the body's up axis in the root's space, toward its right (the stage's sign: right of forward)
  const { forward: F, right: R, up: U } = b.core.frame, up = new Vector3(U[0], U[1], U[2]).normalize();
  const sign = new Vector3().crossVectors(new Vector3(F[0], F[1], F[2]), new Vector3(R[0], R[1], R[2])).dot(up) < 0 ? -1 : 1, T = new Quaternion();
  let made = 0;
  return {
    write(s, turn = 0) {
      // made again only when the turn changes, and skipped at 0 (the usual case): the hot path allocates nothing
      if (turn !== made) T.setFromAxisAngle(up, (sign * (made = turn) * Math.PI) / 180);
      for (let i = 0; i < bones.length; i++) {
        const q = s.local[names[i]!];
        if (!q) continue;
        const bone = bones[i]! as Bone;
        bone.quaternion.set(q[0], q[1], q[2], q[3]);
        // a bone the skeleton has no parent for holds its rotation in the root's space: turned there, then into its parent's
        const o = outer[i];
        if (o) (turn ? bone.quaternion.premultiply(T) : bone.quaternion).premultiply(o);
      }
      // the hips' place, from the root's space into its parent's (its parent posed first)
      if (parent) {
        parent.updateWorldMatrix(true, false);
        rootInv.copy(root.matrixWorld).invert();
        inv.multiplyMatrices(rootInv, parent.matrixWorld).invert();
        v.set(s.hips[0], s.hips[1], s.hips[2]);
        hips.position.copy((turn ? v.applyQuaternion(T) : v).applyMatrix4(inv));
      } else {
        v.set(s.hips[0], s.hips[1], s.hips[2]);
        hips.position.copy(turn ? v.applyQuaternion(T) : v);
      }
    },
  };
}
