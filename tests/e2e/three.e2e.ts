// e2e `three` (WP-4.1): the pinned three.js runs the scene an agent writes first: a skinned character loaded from glTF
// (built in code, written by GLTFExporter, read back by GLTFLoader), a clip playing, a crossfade to another, through
// WebGPURenderer. On the forced WebGL 2 backend (how captures run) the frame is drawn, not blank, and moves; on the
// WebGPU backend (SwiftShader's Vulkan, where the browser has an adapter) the renderer starts and draws without an
// error. M3A_THREE_DIR serves another release instead (CI runs the other candidate that way, docs/THREE.md): its WebGL 2
// result is checked, its WebGPU result reported. Frames are read back from a render target (headless WebGPU canvases
// read blank).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { expect, test } from "@playwright/test";

const ROOT = join(import.meta.dirname, "../..");
const ORIGIN = "http://localhost:4173"; // a secure context: WebGPU exists only there, and three.webgpu.js needs it to load
const DIR = process.env.M3A_THREE_DIR ? normalize(process.env.M3A_THREE_DIR) : join(ROOT, "node_modules/three");
const VERSION = (JSON.parse(readFileSync(join(DIR, "package.json"), "utf8")) as { version: string }).version;
const PIN = (JSON.parse(readFileSync(join(ROOT, "packages/three/package.json"), "utf8")) as { peerDependencies: Record<string, string> }).peerDependencies.three;
const PINNED = VERSION === PIN && !process.env.M3A_THREE_DIR;

test.use({ launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-vulkan=swiftshader", "--use-webgpu-adapter=swiftshader", "--disable-gpu-sandbox"] } });

const PAGE = `<!doctype html><title>three ${VERSION}</title><style>body{margin:0}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/webgpu":"/three/build/three.webgpu.js","three/tsl":"/three/build/three.tsl.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three/webgpu";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// A three-bone arm: a skinned cylinder, its bones up the y axis, and two clips (a bend and a twist).
function character() {
  const geometry = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 12, 15).translate(0, 0.75, 0);
  const indices = [], weights = [], y = geometry.attributes.position;
  for (let i = 0; i < y.count; i++) {
    const at = Math.min(y.getY(i) / 0.5, 2.999), b = Math.floor(at), w = at - b;
    indices.push(b, Math.min(b + 1, 2), 0, 0);
    weights.push(1 - w, w, 0, 0);
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const bones = [0, 0.5, 0.5].map((h, i) => Object.assign(new THREE.Bone(), { name: "b" + i }));
  bones.forEach((b, i) => { b.position.y = i ? 0.5 : 0; if (i) bones[i - 1].add(b); });
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0xd0603a }));
  mesh.name = "arm";
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  const q = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180).toArray();
  const track = (bone, axis, degs) => new THREE.QuaternionKeyframeTrack(bone + ".quaternion", [0, 0.5, 1], degs.flatMap((d) => q(axis, d)));
  const z = new THREE.Vector3(0, 0, 1), x = new THREE.Vector3(1, 0, 0);
  const clips = [
    new THREE.AnimationClip("bend", 1, [track("b1", z, [0, 60, 0]), track("b2", z, [0, 45, 0])]),
    new THREE.AnimationClip("swing", 1, [track("b1", x, [-50, 50, -50]), track("b2", x, [0, -40, 0])]),
  ];
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, clips };
}

// Counts the pixels of a render target that are not background, and sums them (so two frames compare).
async function readback(renderer, target) {
  const d = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height), bg = [d[0], d[1], d[2]];
  let lit = 0, sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 24) lit++;
    sum = (sum * 31 + d[i] + 2 * d[i + 1] + 3 * d[i + 2]) % 1000000007;
  }
  return { lit, sum };
}

// On a failure the WebGPU device's loss is waited for (2 s at most) and reported with the adapter it ran on, so a
// browser that drops the GPU connection (a mapAsync cancelled with "no longer exists") says why in the log.
window.run = async (forceWebGL) => {
  const adapter = navigator.gpu && (await navigator.gpu.requestAdapter());
  const out = { adapter: !!adapter, adapterInfo: adapter ? \`\${adapter.info.vendor}/\${adapter.info.architecture}\${adapter.info.isFallbackAdapter ? " (fallback)" : ""}\` : null, backend: null, frames: [], error: null, lost: null, warnings: [] };
  const warn = console.warn;
  console.warn = (...a) => { out.warnings.push(a.join(" ").slice(0, 160)); warn(...a); };
  let renderer;
  try {
    const built = character();
    const glb = await new GLTFExporter().parseAsync(built.scene, { binary: true, animations: built.clips });
    const gltf = await new GLTFLoader().parseAsync(glb, "");
    renderer = new THREE.WebGPURenderer({ antialias: false, forceWebGL });
    renderer.setSize(160, 160, false);
    await renderer.init();
    const target = new THREE.RenderTarget(160, 160);
    out.backend = renderer.backend.isWebGPUBackend ? "webgpu" : renderer.backend.isWebGLBackend ? "webgl2" : "other";
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x203040);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2), gltf.scene);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 0.8, 4);
    camera.lookAt(0, 0.7, 0);
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const [bend, swing] = ["bend", "swing"].map((n) => mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, n)));
    bend.play();
    for (let f = 0; f < 24; f++) {
      if (f === 8) bend.crossFadeTo(swing.play(), 0.25, false);
      mixer.update(1 / 30);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      if (f % 8 === 7) out.frames.push(await readback(renderer, target));
    }
    out.weights = [bend.getEffectiveWeight(), swing.getEffectiveWeight()];
    renderer.dispose();
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
    const lost = renderer && renderer.backend && renderer.backend.device && renderer.backend.device.lost;
    if (lost) out.lost = await Promise.race([lost.then((i) => \`\${i.reason}: \${i.message}\`.slice(0, 300)), new Promise((r) => setTimeout(() => r("not lost after 2 s"), 2000))]);
  }
  console.warn = warn;
  return out;
};
window.ready = true;
</script>`;

test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname));
    if (path === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
    const file = join(DIR, path.slice("/three/".length));
    if (!/^\/three\/(build|examples\/jsm)\/[\w/.-]+\.js$/.test(path) || !existsSync(file)) return route.fulfill({ status: 404, body: "not served" });
    return route.fulfill({ contentType: "text/javascript", body: readFileSync(file, "utf8") });
  });
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true || null, null, { timeout: 15_000 }).catch(() => {
    throw new Error(`the page never loaded three ${VERSION}: ${errors.join("; ") || "no error reported"}`);
  });
});
const errors: string[] = [];

type Run = { adapter: boolean; adapterInfo: string | null; backend: string | null; lost: string | null; frames: { lit: number; sum: number }[]; error: string | null; warnings: string[]; weights?: number[] };
const run = (page: import("@playwright/test").Page, forceWebGL: boolean) => page.evaluate((f) => (window as unknown as { run: (f: boolean) => Promise<Run> }).run(f), forceWebGL);

test(`three ${VERSION}: a skinned glTF plays and crossfades on the forced WebGL 2 backend`, async ({ page }) => {
  const r = await run(page, true);
  console.log(`three ${VERSION} webgl2: ${JSON.stringify({ backend: r.backend, error: r.error, lit: r.frames.map((f) => f.lit), weights: r.weights, warnings: r.warnings.length })}`);
  expect(r.error).toBeNull();
  expect(r.backend).toBe("webgl2");
  expect(r.frames).toHaveLength(3);
  for (const f of r.frames) expect(f.lit, "the character is drawn (the frame is not blank)").toBeGreaterThan(200);
  expect(new Set(r.frames.map((f) => f.sum)).size, "the character moves between frames").toBe(3);
  expect(r.weights, "the crossfade ends on the second clip").toEqual([0, 1]);
  expect(r.warnings, "three prints no warning").toEqual([]);
  expect(errors).toEqual([]);
});

test(`three ${VERSION}: WebGPURenderer starts on the WebGPU backend and draws`, async ({ page }) => {
  const r = await run(page, false);
  console.log(`three ${VERSION} webgpu: ${JSON.stringify({ adapter: r.adapterInfo, backend: r.backend, error: r.error, lost: r.lost, lit: r.frames.map((f) => f.lit), weights: r.weights, warnings: r.warnings.length })}`);
  test.info().annotations.push({ type: "webgpu", description: `three ${VERSION} on ${r.adapterInfo ?? "no adapter"}: ${r.error ? `fails: ${r.error}${r.lost ? ` (device lost: ${r.lost})` : ""}` : `${r.backend}, lit ${r.frames.map((f) => f.lit).join("/")}`}` });
  if (!PINNED) return; // the other candidate's WebGPU result is reported, not asserted (docs/THREE.md)
  test.skip(!r.adapter, "this browser has no WebGPU adapter: WebGPURenderer falls back to WebGL 2, checked above");
  expect(errors).toEqual([]);
  expect(r.error, `on ${r.adapterInfo}, device lost: ${r.lost ?? "no"}`).toBeNull();
  expect(r.backend).toBe("webgpu");
  expect(r.frames).toHaveLength(3);
  for (const f of r.frames) expect(f.lit, "the character is drawn (the frame is not blank)").toBeGreaterThan(200);
  expect(new Set(r.frames.map((f) => f.sum)).size, "the character moves between frames").toBe(3);
  expect(r.weights).toEqual([0, 1]);
});
