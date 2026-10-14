// Playing an Animator on a three.js character (PLAN.md WP-4.4): each frame steps the Animator, poses it and writes the
// pose to the bones (crossfades, masked and additive layers are the Animator's); the root's motion is handed to the
// game (`root`, and `moved` since the last update), which moves the character as it likes: by `travel`, `moved` turned
// into the scene along the way the character faces (read from its bones: not every model faces glTF's +Z).
import { Vector3 } from "three";
import type { Animator, AnimatorPose, PoseOptions, StepResult } from "@m3a/core";
import type { ThreeBound } from "../bind/index.ts";
import { writer } from "./write.ts";

/** Where the root stands, or how far it moved: forward and right in mm, the heading in degrees. */
export interface RootPose {
  forward: number;
  right: number;
  yaw: number;
}
/** An Animator attached to a character. */
export interface Attached {
  readonly animator: Animator;
  readonly bound: ThreeBound;
  /** The last pose written. */
  readonly pose: AnimatorPose;
  /** Where the root stands (mm, degrees), and how far it moved in the last update. */
  readonly root: RootPose;
  readonly moved: RootPose;
  /**
   * The last update's move in the space of the root's parent (metres): `moved`'s forward and right along the way the
   * character faces, read from its bones (not every model faces glTF's +Z), turned and scaled as the root is. Move the
   * character by it, `bound.root.position.add(player.travel)`, and its planted feet stay put.
   */
  readonly travel: Vector3;
  /** Steps the Animator by `dt` seconds, poses it and writes the pose to the bones; returns what the step fired. */
  update(dt: number, opts?: PoseOptions): StepResult;
  /** Poses the Animator as it stands and writes the pose (no step). */
  apply(opts?: PoseOptions): void;
}

/** Attaches `animator` (made with `bound.core`) to the bound character. */
export function attach(animator: Animator, bound: ThreeBound): Attached {
  if (animator.bound !== bound.core) throw new Error("attach: the Animator poses another skeleton; make it with new Animator(bound.core)");
  const w = writer(bound);
  let pose: AnimatorPose | undefined;
  const root: RootPose = { forward: 0, right: 0, yaw: 0 }, moved: RootPose = { forward: 0, right: 0, yaw: 0 }, travel = new Vector3();
  const { forward: F, right: R } = bound.core.frame, k = bound.core.scale, o = bound.root;
  const apply = (opts?: PoseOptions) => {
    pose = animator.pose(pose, opts);
    w.write(pose);
  };
  return {
    animator,
    bound,
    get pose() {
      if (!pose) apply();
      return pose!;
    },
    root,
    moved,
    travel,
    update(dt, opts) {
      const was = animator.root, r = animator.step(dt), now = animator.root;
      moved.forward = now.forward - was.forward;
      moved.right = now.right - was.right;
      moved.yaw = now.yaw - was.yaw;
      root.forward = now.forward;
      root.right = now.right;
      root.yaw = now.yaw;
      const fw = moved.forward * k, rt = moved.right * k;
      travel.set(F[0] * fw + R[0] * rt, F[1] * fw + R[1] * rt, F[2] * fw + R[2] * rt).multiply(o.scale).applyQuaternion(o.quaternion);
      apply(opts);
      return r;
    },
    apply,
  };
}
