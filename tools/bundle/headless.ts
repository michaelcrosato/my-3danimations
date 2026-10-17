// Headless stand-ins (WP-7.4) for what m3a.js leaves out, so that it runs the manual's complete example as written:
// `npm run pack -- --check` serves the example's imports of @m3a/three's `bind` and `attach`, @m3a/three/test-characters'
// `loadGlb` and @m3a/sensors/node's `writePng` from this file, on the installed packages and on m3a.js alike (./example.ts,
// `headlessForm`). `loadGlb` reads the character's skeleton from its glTF nodes (@m3a/io), `bind` binds it with core's
// solver as three's binding does, `attach` steps and poses the Animator as three's player does and hands back the root's
// travel, and `writePng` keeps a fingerprint of the image instead of a file. Each records what it saw, every pose
// bit for bit, so `headlessReport()`, printed at the end, tells the two runs apart if they differ in any bit. `record`
// is that record, which ./recorded.ts also keeps of @m3a/three's own player, so the real run is held to it too. No clock.
import { bind as bindBody, recognize, type Animator, type AnimatorPose, type Bound, type PoseOptions, type StepResult } from "@m3a/core";
import { meshEnds, parseGlb, skeletonOfGltf, type GltfDoc, type GltfSkeleton } from "@m3a/io";
import type { Image } from "@m3a/sensors";

/** Folds bytes into a 32-bit FNV-1a fingerprint. */
function fnv(bytes: Uint8Array, h = 0x811c9dc5): number {
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h;
}
const f64 = (xs: readonly number[] | Float64Array) => new Uint8Array(Float64Array.from(xs).buffer);

/** A record of what players saw (`attached`, `updated`) and images written (`wrote`), as `report()` prints it: the
 *  updates run, the events they fired, every pose's fingerprint (`poses`: its joints' points and its bones' local
 *  rotations by name; `points`: its joints' points alone), the travel summed, the images, each Animator's hash. */
export function record(): { attached(animator: Animator): void; updated(r: StepResult, pose: AnimatorPose, travel: { x: number; y: number; z: number }): void; wrote(file: string, img: Image): void; report(): string } {
  const seen = { updates: 0, events: [] as string[], poses: 0x811c9dc5, points: 0x811c9dc5, travel: [0, 0, 0], images: [] as string[], animators: [] as Animator[] };
  return {
    attached: (animator) => void seen.animators.push(animator),
    updated(r, pose, travel) {
      const quats = Object.keys(pose.local).sort().flatMap((b) => pose.local[b]!);
      if (![...pose.points, ...quats].every(Number.isFinite)) throw new Error(`a pose isn't finite at update ${seen.updates}`);
      seen.poses = fnv(f64(quats), fnv(f64(pose.points), seen.poses));
      seen.points = fnv(f64(pose.points), seen.points);
      seen.updates++;
      seen.travel = seen.travel.map((x, i) => x + [travel.x, travel.y, travel.z][i]!);
      for (const e of r.events) seen.events.push(`${seen.updates}:${e.layer}:${e.name}`);
    },
    wrote: (file, img) => void seen.images.push(`${file} ${img.width}x${img.height} ${fnv(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength)).toString(16)}`),
    report() {
      const { animators, poses, points, ...rest } = seen;
      return JSON.stringify({ ...rest, poses: poses.toString(16), points: points.toString(16), hashes: animators.map((a) => a.hash()) });
    },
  };
}
/** What the stand-ins saw. */
const seen = record();

/** A position root motion moves (three's `Vector3.add`). */
interface Position {
  x: number;
  y: number;
  z: number;
  add(v: { x: number; y: number; z: number }): Position;
}

/** A character read headless: its glTF document and skeleton. */
type Scene = GltfSkeleton & { doc: GltfDoc };

/** @m3a/three/test-characters' loadGlb, headless: the character's glTF document and its skeleton (its skin's deforming
 *  joints and their rest orientations, read from its nodes by @m3a/io) as its `scene`. */
export async function loadGlb(bytes: Uint8Array, _opts?: unknown): Promise<{ scene: Scene }> {
  const doc = parseGlb(bytes);
  return { scene: { doc, ...skeletonOfGltf(doc) } };
}

/** @m3a/three's bind, headless: the skeleton recognized and bound with core's solver as three's bind does it, each
 *  foot's last bone with no child ending on the sole where its mesh does (D49, @m3a/io's meshEnds), and a root whose
 *  position root motion moves. A mapping patch is refused: it would bind otherwise than three's bind, unseen. */
export function bind(scene: Scene, opts?: { mapping?: unknown }): { core: Bound; root: { position: Position } } {
  if (opts?.mapping !== undefined) throw new Error("tools/bundle/headless.ts stands in for bind(scene) alone: a mapping patch needs @m3a/three");
  const sk = scene.skeleton, rec = recognize(sk), bones = [...sk.bones], restWorld = { ...scene.restWorld };
  const lasts = ["left", "right"].map((s) => rec.bones[`${s}Toes`] ?? rec.bones[`${s}Foot`]).filter((b): b is string => !!b && !sk.bones.some((x) => x.parent === b));
  const { ends } = meshEnds(scene.doc, lasts.map((b) => scene.nodes[sk.bones.findIndex((x) => x.name === b)]!));
  lasts.forEach((b, i) => {
    if (!ends[i]) return;
    bones.push({ name: `${b}_end`, parent: b, head: ends[i] });
    restWorld[`${b}_end`] = [0, 0, 0, 1];
  });
  const position: Position = { x: 0, y: 0, z: 0, add: (v) => ((position.x += v.x), (position.y += v.y), (position.z += v.z), position) };
  return { core: bindBody({ ...sk, bones }, { recognition: rec, restWorld }), root: { position } };
}

/** @m3a/three's attach, headless: `update(dt)` steps the Animator, poses it (every pose recorded) and sets `travel`,
 *  the step's root move along the way the character faces, in metres (three's, with the root unturned and unscaled). */
export function attach(animator: Animator, bound: { core: Bound }): { readonly travel: { x: number; y: number; z: number }; update(dt: number, opts?: PoseOptions): StepResult } {
  if (animator.bound !== bound.core) throw new Error("attach: the Animator poses another skeleton; make it with new Animator(bound.core)");
  const { forward: F, right: R } = bound.core.frame, k = bound.core.scale, travel = { x: 0, y: 0, z: 0 };
  let pose: AnimatorPose | undefined;
  seen.attached(animator);
  return {
    travel,
    update(dt, opts) {
      const was = animator.root, r = animator.step(dt), now = animator.root, fw = (now.forward - was.forward) * k, rt = (now.right - was.right) * k;
      [travel.x, travel.y, travel.z] = [F[0] * fw + R[0] * rt, F[1] * fw + R[1] * rt, F[2] * fw + R[2] * rt];
      pose = animator.pose(pose, opts);
      seen.updated(r, pose, travel);
      return r;
    },
  };
}

/** @m3a/sensors/node's writePng, headless: the image's size and its pixels' fingerprint kept, no file written (a PNG
 *  needs node:zlib); returns the pixels' size in bytes. */
export function writePng(file: string, img: Image): number {
  seen.wrote(file, img);
  return img.data.byteLength;
}

/** What the stand-ins saw, as one line of JSON: the run's outcome, each Animator's hash, every pose's fingerprint. */
export function headlessReport(): string {
  return seen.report();
}
