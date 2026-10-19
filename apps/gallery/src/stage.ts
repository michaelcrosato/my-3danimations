// The gallery's 3D stage (PLAN.md WP-8.1; docs/THREE.md): WebGPURenderer (WebGL 2 where WebGPU is missing, or with
// ?renderer=webgl2), a floor with a grid, two lights, and a character by id (gen-<seed> built in code, or a fetched rig)
// bound through @m3a/three. The character stands in a carrier that the root's pose places and turns; the camera follows
// it at one of the sensors' named views (raster.VIEWS: the same azimuth and elevation as the contact sheets) or, in
// orbit, wherever a finger or the mouse turns it. `readback` draws a frame into a render target with the character and
// without it and counts the pixels it changed, so a check can tell a drawn character from a blank frame.
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Box3, Color, DirectionalLight, GridHelper, Group, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, RenderTarget, Scene, Vector3, WebGPURenderer, type Material, type Object3D } from "three/webgpu";
import { bind, type ThreeBound } from "@m3a/three";
import { loadGlb } from "@m3a/three/test-characters";
import { characterBytes } from "./host.ts";
import type { View } from "./route.ts";

/** Each fixed view's azimuth (0 in front, 90 at the body's right) and elevation, degrees: the raster's (raster.VIEWS). */
const ANGLES: Record<Exclude<View, "orbit">, [number, number]> = { front: [0, 0], side: [90, 0], back: [180, 0], top: [180, 90], "three-quarter": [45, 20] };
const DEG = Math.PI / 180, BACKGROUND = 0xf4f2ec;

/** Where the root stands: forward and right in mm, the heading in degrees (turn + toward the right). */
export interface RootPose {
  forward: number;
  right: number;
  yaw: number;
}
/** A frame read back: its size, the pixels the character changed, and the backend that drew it. */
export interface Readback {
  width: number;
  height: number;
  lit: number;
  backend: string;
}

/** Frees what a character's meshes hold (r182 has no Object3D.dispose: docs/THREE.md). */
function dispose(o: Object3D): void {
  o.traverse((x) => {
    const m = x as Mesh;
    m.geometry?.dispose();
    for (const mat of ([] as Material[]).concat(m.material ?? [])) {
      for (const v of Object.values(mat)) if (v && typeof v === "object" && (v as { isTexture?: boolean }).isTexture) (v as { dispose(): void }).dispose();
      mat.dispose();
    }
  });
}

/** The stage: renderer, scene, camera and the character in its carrier. */
export class Stage {
  readonly renderer: WebGPURenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(35, 1, 0.05, 400);
  readonly carrier = new Group();
  readonly controls: OrbitControls;
  bound: ThreeBound | null = null;
  char: string | null = null;
  view: View = "three-quarter";
  /** The character's height at rest (scene units). */
  #height = 1.8;
  #axes = { f: new Vector3(0, 0, 1), r: new Vector3(-1, 0, 0), u: new Vector3(0, 1, 0), turn: -1 };
  /** The characters asked for so far, so only the latest is put on the stage. */
  #asked = 0;

  private constructor(renderer: WebGPURenderer) {
    this.renderer = renderer;
    this.scene.background = new Color(BACKGROUND);
    const sun = new DirectionalLight(0xffffff, 2.2), floor = new Mesh(new PlaneGeometry(400, 400), new MeshStandardMaterial({ color: 0xe4e0d6 }));
    sun.position.set(3, 6, 4);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(new HemisphereLight(0xffffff, 0x8a8478, 1.3), sun, floor, new GridHelper(400, 400, 0xb8b2a6, 0xd0cbc0), this.carrier);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enabled = false;
  }

  /** A stage drawing into a new canvas in `parent`; WebGL 2 forced when `webgl2`. */
  static async create(parent: HTMLElement, webgl2: boolean): Promise<Stage> {
    const renderer = new WebGPURenderer({ antialias: true, forceWebGL: webgl2 });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    parent.prepend(renderer.domElement);
    await renderer.init();
    const s = new Stage(renderer);
    new ResizeObserver(() => s.resize()).observe(parent);
    s.resize();
    return s;
  }

  /** The backend drawing ("webgpu" or "webgl2"). */
  get backend(): string {
    const b = this.renderer.backend as { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
    return b.isWebGPUBackend ? "webgpu" : b.isWebGLBackend ? "webgl2" : "other";
  }

  /** Fits the drawing to its element. */
  resize(): void {
    const el = this.renderer.domElement.parentElement!, w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Puts character `id` on the stage (the one there already stays), bound; throws naming the ids when there is none.
   *  Null when a newer call came while this one loaded: that one puts its character there. */
  async setCharacter(id: string): Promise<ThreeBound | null> {
    const mine = ++this.#asked;
    if (this.bound && this.char === id) return this.bound;
    const bytes = await characterBytes(id);
    if (mine !== this.#asked) return null;
    if (!bytes) throw new Error(`no character "${id}": gen-<seed> (any whole number), or a rig npm run fixtures -- fetch put in .cache/fixtures/`);
    const loaded = (await loadGlb(bytes)).scene;
    if (mine !== this.#asked) {
      dispose(loaded);
      return null;
    }
    const bound = bind(loaded);
    if (this.bound) {
      this.carrier.remove(this.bound.root);
      dispose(this.bound.root);
    }
    this.carrier.add(bound.root);
    [this.bound, this.char] = [bound, id];
    const { forward: f, right: r, up: u } = bound.core.frame, v = (x: readonly number[]) => new Vector3(x[0], x[1], x[2]).normalize();
    this.#axes = { f: v(f), r: v(r), u: v(u), turn: new Vector3().crossVectors(v(f), v(r)).dot(v(u)) < 0 ? -1 : 1 };
    this.place({ forward: 0, right: 0, yaw: 0 });
    this.#height = Math.max(0.2, new Box3().setFromObject(bound.root).getSize(new Vector3()).dot(this.#axes.u));
    this.setView(this.view);
    return bound;
  }

  /** Places the carrier where the root stands, as @m3a/three's attach moves a character (`travel`), turned by its
   *  heading about the up axis. */
  place(root: RootPose): void {
    const b = this.bound;
    if (!b) return;
    const k = b.core.scale, { f, r, u, turn } = this.#axes;
    this.carrier.position.copy(f).multiplyScalar(root.forward * k).addScaledVector(r, root.right * k).multiply(b.root.scale).applyQuaternion(b.root.quaternion);
    this.carrier.quaternion.setFromAxisAngle(u, turn * root.yaw * DEG);
  }

  /** The point the camera looks at: the character's middle, where it stands now. */
  #target(): Vector3 {
    return this.carrier.position.clone().addScaledVector(this.#axes.u, this.#height * 0.62);
  }

  /** Sets the camera's view; orbit starts from the three-quarter view and hands the camera to the pointer. */
  setView(view: View): void {
    this.view = view;
    // the camera sees 1.6 heights, aimed a little above the middle, so the body stands clear of the controls over it
    const [yaw, pitch] = ANGLES[view === "orbit" ? "three-quarter" : view], { f, r, u } = this.#axes, d = (this.#height * 0.8) / Math.tan(17.5 * DEG);
    const dir = f.clone().multiplyScalar(Math.cos(yaw * DEG)).addScaledVector(r, Math.sin(yaw * DEG)).multiplyScalar(Math.cos(pitch * DEG)).addScaledVector(u, Math.sin(pitch * DEG));
    const at = this.#target();
    this.camera.up.copy(view === "top" ? f : u);
    this.camera.position.copy(at).addScaledVector(dir, d);
    this.camera.lookAt(at);
    this.controls.enabled = view === "orbit";
    this.controls.target.copy(at);
    if (view === "orbit") this.controls.update();
  }

  /** The view and where the camera looks from, measured from the camera itself: the azimuth (0 in front, 90 at the
   *  body's right, 0 to 360) and the elevation, degrees to 0.1 (a fixed view's are the sensors' raster.VIEWS). */
  look(): { view: View; azimuth: number; elevation: number } {
    const d = this.camera.position.clone().sub(this.controls.target).normalize(), { f, r, u } = this.#axes, r1 = (x: number) => Math.round(x * 10) / 10 + 0;
    return { view: this.view, azimuth: (r1(Math.atan2(d.dot(r), d.dot(f)) / DEG) + 360) % 360, elevation: r1(Math.asin(Math.min(1, Math.max(-1, d.dot(u)))) / DEG) };
  }

  /** Draws a frame, the camera following the character. */
  render(): void {
    const at = this.#target();
    if (this.view === "orbit") {
      this.camera.position.add(at.clone().sub(this.controls.target));
      this.controls.target.copy(at);
      this.controls.update();
    } else this.setView(this.view);
    this.renderer.render(this.scene, this.camera);
  }

  /** Draws the frame into a render target `width` × `height` twice, without the character and with it, and reads both
   *  back: `lit` counts the pixels the character changed (by more than 30 in their summed channels). */
  async readback(width = 160, height = 200): Promise<Readback> {
    const target = new RenderTarget(width, height), aspect = this.camera.aspect, shots: Uint8Array[] = [];
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    for (const on of [false, true]) {
      this.carrier.visible = on;
      this.renderer.setRenderTarget(target);
      this.render();
      this.renderer.setRenderTarget(null);
      shots.push(((await this.renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)) as Uint8Array).slice());
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    target.dispose();
    const [a, b] = shots as [Uint8Array, Uint8Array];
    let lit = 0;
    for (let p = 0; p < a.length; p += 4) if (Math.abs(a[p]! - b[p]!) + Math.abs(a[p + 1]! - b[p + 1]!) + Math.abs(a[p + 2]! - b[p + 2]!) > 30) lit++;
    return { width, height, lit, backend: this.backend };
  }
}
