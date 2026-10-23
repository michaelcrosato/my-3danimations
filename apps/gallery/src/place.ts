// Where the stage puts the character (WP-F.14): its carrier moved to where the root stands, as @m3a/three's attach moves
// a character (`travel`), and turned only by what its bones don't carry. A pose carries its clip's own turn, and attach
// writes it turned by the Animator's `turn` beyond that (an earlier clip, a stepped loop's earlier cycles), so a carrier
// turned by the root's whole heading showed a clip's turn twice; the player says what is left (its `turn`: a clip posed
// by time alone, a loop's earlier cycles). Pure, so the playback test (playback.test.ts) places a character as the
// stage does.
import { Quaternion, Vector3, type Object3D } from "three";
import type { ThreeBound } from "@m3a/three";
import type { RootPose } from "./stage.ts";

const f = new Vector3(), r = new Vector3(), u = new Vector3();

/** Moves `carrier` (the bound character's parent) to where `root` stands: forward and right (mm) along the way the
 *  character faces at rest, in the root's parent's space; and turns it `turn` degrees toward its right about its up axis
 *  (0: not turned). */
export function placeCarrier(carrier: Object3D, b: ThreeBound, root: RootPose, turn = 0): void {
  const k = b.core.scale, F = b.core.frame.forward, R = b.core.frame.right, U = b.core.frame.up;
  f.set(F[0], F[1], F[2]).normalize();
  r.set(R[0], R[1], R[2]).normalize();
  u.set(U[0], U[1], U[2]).normalize();
  carrier.position.copy(f).multiplyScalar(root.forward * k).addScaledVector(r, root.right * k).multiply(b.root.scale).applyQuaternion(b.root.quaternion);
  if (!turn) carrier.quaternion.identity();
  else carrier.quaternion.copy(TURN.setFromAxisAngle(u, (r.clone().cross(f).dot(u) > 0 ? -1 : 1) * turn * (Math.PI / 180)));
}
const TURN = new Quaternion();
