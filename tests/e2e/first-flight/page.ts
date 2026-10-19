// The first-flight page (tests/e2e/first-flight.e2e.ts): the game (./game.ts) on a generated test character, drawn by
// three's WebGPURenderer on its WebGL 2 backend, through the packages' public entries alone (@m3a/core, @m3a/library,
// @m3a/three, @m3a/three/test-characters). The library files its moves need come in the build (`__FIRST_FLIGHT__`, as a
// game's build bundles them) and open through @m3a/library's Library. The page never steps on its own: `window.__m3a`
// drives it in fixed steps (step(n, input), hash(), state(), points()) and names the backend drawing, and every
// animation frame draws where the game has the character, the hits counted in the HUD.
import { Box3, Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import { VERSION, type AnimatorEvent } from "@m3a/core";
import { Library } from "@m3a/library";
import { attach, bind } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { DEFAULT_CLIPS, Game, MOVES, prepare, type Input, type Move, type MoveName } from "./game.ts";

declare const __FIRST_FLIGHT__: string;
const $ = (id: string) => document.getElementById(id)!;
const STEP = 1 / 60;

async function main(): Promise<void> {
  const { seed, files } = JSON.parse(__FIRST_FLIGHT__) as { seed: number; files: Record<string, Record<string, string>> };
  const library = new Library({
    sets: () => Object.keys(files),
    files: (set) => Object.keys(files[set] ?? {}),
    read: (set, file) => {
      const text = files[set]?.[file];
      if (text === undefined) throw new Error(`first-flight: the build bundled no ${set}/${file}`);
      return text;
    },
  });
  const bound = bind((await loadGlb(character(variant(seed)).glb)).scene), moves = {} as Record<MoveName, Move>;
  for (const m of MOVES) {
    const { clip, rest } = library.clip(DEFAULT_CLIPS[m]);
    moves[m] = prepare(clip, rest, bound.core.rest, m === "attack");
  }
  const game = new Game(bound.core, moves), att = attach(game.animator, bound);

  // the scene: the character on a floor, lit from above, the camera following it from three-quarters
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: true });
  document.body.prepend(renderer.domElement);
  await renderer.init();
  const scene = new Scene(), camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 200), sun = new DirectionalLight(0xffffff, 2.2);
  scene.background = new Color(0xf4f2ec);
  sun.position.set(3, 6, 4);
  const floor = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: 0xe4e0d6 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(new HemisphereLight(0xffffff, 0x8a8478, 1.3), sun, floor, new GridHelper(200, 200, 0xb8b2a6, 0xd0cbc0), bound.root);
  renderer.setSize(innerWidth, innerHeight, false);
  const size = new Box3().setFromObject(bound.root).getSize(new Vector3());
  $("stamp").textContent = `m3a ${VERSION} · gen-${seed}`;

  // a frame: the pose written to the bones, the character placed where the game has it, the camera after it
  const draw = () => {
    att.apply();
    bound.root.position.set(-game.x / 1000, game.z / 1000, game.y / 1000);
    bound.root.rotation.y = (-game.heading * Math.PI) / 180;
    const at = bound.root.position, a = Math.PI / 6 - bound.root.rotation.y, d = Math.max(2.5, size.y * 2.6);
    camera.position.set(at.x + Math.sin(a) * d, size.y * 0.7, at.z + Math.cos(a) * d);
    camera.lookAt(at.x, size.y * 0.5, at.z);
    const s = game.state();
    $("mode").textContent = s.mode;
    $("hits").textContent = `hits ${s.hits}`;
    renderer.render(scene, camera);
    requestAnimationFrame(draw);
  };

  // the console handle: the game in fixed steps of 1/60 s
  const b = renderer.backend as { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
  (window as unknown as { __m3a: unknown }).__m3a = {
    ready: true,
    version: VERSION,
    /** The backend drawing ("webgl2" here: forceWebGL, as captures run). */
    backend: b.isWebGPUBackend ? "webgpu" : b.isWebGLBackend ? "webgl2" : "other",
    state: () => game.state(),
    hash: () => game.hash(),
    step(n = 1, input: Input = { x: 0, y: 0 }) {
      const events: AnimatorEvent[] = [];
      for (let i = 0; i < n; i++) events.push(...game.step(STEP, input));
      att.apply();
      return events.map((e) => ({ name: e.name, clip: e.clip, at: e.at }));
    },
    /** The pose's body points as the game places them (mm; turned, lifted) and where its root stands, for the sensors. */
    points: () => game.placed(att.pose.points),
  };
  requestAnimationFrame(draw);
}

main().catch((err: Error) => {
  $("mode").textContent = `error: ${err.message}`;
  (window as unknown as { __m3a: unknown }).__m3a = { ready: false, error: err.message };
  throw err;
});
