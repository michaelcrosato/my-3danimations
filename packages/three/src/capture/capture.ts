// Headless capture (PLAN.md WP-4.5): a bound character played by an Animator and drawn in the browser through
// WebGPURenderer on its WebGL 2 backend (forced: captures don't depend on a GPU), each frame read back from a render
// target, checked not blank, with the proof hash of its bone transforms. A blank frame, or a renderer that isn't the one
// asked for, throws a CaptureError saying why. Browser-only: Node reads the frames and writes the sheet.
import type { Object3D } from "three";
import { Box3, Color, DirectionalLight, HemisphereLight, PerspectiveCamera, RenderTarget, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import type { Animator } from "@m3a/core";
import type { ThreeBound } from "../bind/index.ts";
import { attach } from "../play/index.ts";
import { poseHash } from "./hash.ts";

/** Why a capture refused: a blank frame, or another renderer than the one asked for. */
export class CaptureError extends Error {
  readonly code: "E_BLANK" | "E_RENDERER";
  constructor(code: "E_BLANK" | "E_RENDERER", message: string) {
    super(message);
    this.name = "CaptureError";
    this.code = code;
  }
}
/** How to capture: frames, the step between them, the image size, the backend required, and the camera's turn. */
export interface CaptureOptions {
  frames?: number;
  /** Seconds between frames (1/10). */
  every?: number;
  width?: number;
  height?: number;
  /** The backend the frames must come from ("webgl2", forced; "webgpu" asks for WebGPU and takes nothing else). */
  backend?: "webgl2" | "webgpu";
  /** The camera's heading around the character, degrees (30: a three-quarter view). */
  yaw?: number;
  /** Look this way instead of at the character (to prove a blank frame is caught). */
  lookAway?: boolean;
}
/** A capture: each frame's pixels (RGBA, rows top first), its time and its pose hash, and the backend that drew it. */
export interface Capture {
  backend: string;
  width: number;
  height: number;
  frames: { t: number; rgba: Uint8Array; hash: string; lit: number }[];
}

/** Captures `animator` (made with `bound.core`) playing on the bound character. */
export async function capture(animator: Animator, bound: ThreeBound, opts: CaptureOptions = {}): Promise<Capture> {
  const width = opts.width ?? 160, height = opts.height ?? 200, want = opts.backend ?? "webgl2";
  const renderer = new WebGPURenderer({ antialias: false, forceWebGL: want === "webgl2" });
  renderer.setSize(width, height, false);
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "webgpu" : (renderer.backend as { isWebGLBackend?: boolean }).isWebGLBackend ? "webgl2" : "other";
  if (backend !== want) {
    renderer.dispose();
    throw new CaptureError("E_RENDERER", `capture: asked for ${want}, the renderer fell back to ${backend}: frames from another renderer aren't this capture's`);
  }
  const scene = new Scene(), root: Object3D = bound.root;
  scene.background = new Color(0xf4f2ec);
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(new HemisphereLight(0xffffff, 0x8a8478, 1.4), sun, root);
  // the camera frames the character at rest, from a three-quarter view, a little above
  const box = new Box3().setFromObject(root), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  const camera = new PerspectiveCamera(35, width / height, 0.01, 100), yaw = ((opts.yaw ?? 30) * Math.PI) / 180, far = (Math.max(size.y, size.x * 1.2) / 2 / Math.tan((35 * Math.PI) / 360)) * 1.6;
  camera.position.set(centre.x + far * Math.sin(yaw), centre.y + size.y * 0.15, centre.z + far * Math.cos(yaw));
  camera.lookAt(opts.lookAway ? camera.position.clone().add(new Vector3(Math.sin(yaw), 0, Math.cos(yaw))) : centre);
  const target = new RenderTarget(width, height), att = attach(animator, bound), frames: Capture["frames"] = [];
  const n = opts.frames ?? 8, every = opts.every ?? 0.1;
  for (let i = 0; i < n; i++) {
    if (i) att.update(every, { lod: 1 });
    else att.apply({ lod: 1 });
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const raw = (await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)) as Uint8Array, rgba = new Uint8Array(width * height * 4);
    // rows bottom first in WebGL: flipped, so row 0 is the top
    for (let y = 0; y < height; y++) rgba.set(raw.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
    // the background as drawn (its colour managed into the output's space) is the top-left pixel's
    let lit = 0;
    for (let p = 0; p < rgba.length; p += 4) if (Math.abs(rgba[p]! - rgba[0]!) + Math.abs(rgba[p + 1]! - rgba[1]!) + Math.abs(rgba[p + 2]! - rgba[2]!) > 30) lit++;
    if (lit < 0.005 * width * height) {
      renderer.dispose();
      throw new CaptureError("E_BLANK", `capture: frame ${i} (t ${animator.time.toFixed(2)} s) is blank: ${lit} of ${width * height} pixels differ from the background; the character is off camera or didn't draw`);
    }
    frames.push({ t: animator.time, rgba, hash: poseHash(bound.bones), lit });
  }
  target.dispose();
  renderer.dispose();
  return { backend, width, height, frames };
}
