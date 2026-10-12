// The first-flight demo's page (PLAN.md WP-4.6): a generated test character played by the game (game.ts) and drawn
// by three's WebGPURenderer (WebGL 2 where WebGPU is missing, or with ?renderer=webgl2). Keyboard and touch drive it;
// deep links pick the character (?char=gen-<seed>), a clip to play alone (?clip=SET/Name), a moment (?t=, seconds:
// paused there) and a view (?view=front|side|back|top|three-quarter). `window.__m3a` drives it from a console or a
// headless browser: state(), play(), step(n), hash(), points().
// Lab (2026-10-12): it reaches past @m3a/three's entry for the test characters, which are test fixtures, not API.
import { Box3, Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import { VERSION, type AnimatorEvent } from "@m3a/core";
import { attach, bind } from "@m3a/three";
import { character, loadGlb, variant } from "../../../../packages/three/test-characters/index.ts";
import { DEFAULT_CLIPS, Hello, MOVES, prepare, type Input, type Move, type MoveName } from "./game.ts";
import { loadClip } from "./library.ts";

declare const __COMMIT__: string;
const $ = (id: string) => document.getElementById(id)!;
const q = new URLSearchParams(location.search), STEP = 1 / 60;
const VIEWS: Record<string, [number, number]> = { "three-quarter": [30, 0.15], front: [0, 0.1], side: [90, 0.1], back: [180, 0.1], top: [0, 3] };

async function main(): Promise<void> {
  const seed = Number(/^gen-(-?\d+)$/.exec(q.get("char") ?? "gen-1")?.[1] ?? 1);
  const bound = bind((await loadGlb(character(variant(seed)).glb)).scene), body = bound.core.rest;
  const moves = {} as Record<MoveName, Move>;
  await Promise.all(MOVES.map(async (m) => {
    const { clip, rest } = await loadClip(DEFAULT_CLIPS[m]);
    moves[m] = prepare(clip, rest, body, m === "attack");
  }));
  const game = new Hello(bound.core, moves), att = attach(game.animator, bound);
  const only = q.get("clip");
  if (only) {
    const { clip, rest } = await loadClip(only);
    game.view(prepare(clip, rest, body), Number(q.get("t") ?? 0));
  }
  let paused = q.has("t");
  if (paused && !only) for (let i = 0; i < Math.round(Number(q.get("t")) / STEP); i++) game.step(STEP, { x: 0, y: 0 });

  // the scene: the character on a floor, lit from above, the camera following it
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: q.get("renderer") === "webgl2" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  document.body.prepend(renderer.domElement);
  await renderer.init();
  const scene = new Scene(), camera = new PerspectiveCamera(40, 1, 0.05, 200);
  scene.background = new Color(0xf4f2ec);
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 4);
  const floor = new Mesh(new PlaneGeometry(200, 200), new MeshStandardMaterial({ color: 0xe4e0d6 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(new HemisphereLight(0xffffff, 0x8a8478, 1.3), sun, floor, new GridHelper(200, 200, 0xb8b2a6, 0xd0cbc0), bound.root);
  const size = new Box3().setFromObject(bound.root).getSize(new Vector3()), [yaw, lift] = VIEWS[q.get("view") ?? "three-quarter"] ?? VIEWS["three-quarter"]!;
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  // input: the keyboard, and a touch stick with buttons on phones
  const keys = new Set<string>(), touch = { x: 0, y: 0, run: false, jump: false, attack: false };
  addEventListener("keydown", (e) => keys.add(e.code));
  addEventListener("keyup", (e) => keys.delete(e.code));
  const stick = $("stick"), knob = $("knob");
  stick.addEventListener("pointermove", (e) => {
    if (!e.buttons && e.pointerType === "mouse") return;
    const r = stick.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.max(1, Math.hypot(dx, dy));
    [touch.x, touch.y] = [dx / l, -dy / l];
    knob.style.transform = `translate(${(dx / l) * 40}px, ${(dy / l) * 40}px)`;
  });
  const release = () => {
    [touch.x, touch.y] = [0, 0];
    knob.style.transform = "";
  };
  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointerleave", release);
  const hold = (id: string, k: "jump" | "attack") => {
    $(id).addEventListener("pointerdown", () => (touch[k] = true));
    $(id).addEventListener("pointerup", () => (touch[k] = false));
  };
  hold("b-jump", "jump");
  hold("b-attack", "attack");
  $("b-run").addEventListener("click", () => (touch.run = !touch.run));
  const live = (): Input => {
    const k = (...c: string[]) => c.some((x) => keys.has(x));
    return {
      x: clampUnit((k("KeyD", "ArrowRight") ? 1 : 0) - (k("KeyA", "ArrowLeft") ? 1 : 0) + touch.x),
      y: clampUnit((k("KeyW", "ArrowUp") ? 1 : 0) - (k("KeyS", "ArrowDown") ? 1 : 0) + touch.y),
      run: k("ShiftLeft", "ShiftRight") || touch.run,
      jump: k("Space") || touch.jump,
      attack: k("KeyJ", "KeyK") || touch.attack,
    };
  };

  // the HUD, the hit flash and the build stamp
  let flash = 0;
  const shown = (events: AnimatorEvent[]) => {
    if (events.some((e) => e.name === "hit")) {
      $("hit").classList.add("on");
      flash = 0.15;
    }
  };
  $("stamp").textContent = `m3a ${VERSION} · ${__COMMIT__} · ${location.search ? location.search.slice(1) : `char=gen-${seed}`}`;
  const hud = () => {
    const s = game.state();
    $("mode").textContent = game.viewing ?? s.mode;
    $("speed").textContent = `${s.speed.toFixed(2)} m/s`;
    $("hits").textContent = `hits ${s.hits}`;
    $("clip").textContent = s.layers.map((l) => `${l.clip?.split("/")[1]} ${l.weight < 1 ? `(${l.weight.toFixed(2)})` : ""}`).join(" + ");
  };

  // a frame: the game's fixed steps for the time passed, the pose written to the bones, the character placed, drawn
  const place = () => {
    att.apply();
    bound.root.position.set(-game.x / 1000, game.z / 1000, game.y / 1000);
    bound.root.rotation.y = (-game.heading * Math.PI) / 180;
    const at = bound.root.position, a = (yaw * Math.PI) / 180 - bound.root.rotation.y, d = Math.max(2.5, size.y * 2.6);
    camera.position.set(at.x + Math.sin(a) * d * (lift > 1 ? 0.01 : 1), size.y * (0.55 + lift), at.z + Math.cos(a) * d * (lift > 1 ? 0.01 : 1));
    camera.lookAt(at.x, size.y * 0.5, at.z);
  };
  let carry = 0, last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused) {
      carry += dt;
      while (carry >= STEP) {
        carry -= STEP;
        shown(game.step(STEP, live()));
      }
    }
    if (flash > 0 && (flash -= dt) <= 0) $("hit").classList.remove("on");
    place();
    hud();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };

  // the console handle: drives the game in fixed steps, paused from the first call
  (window as unknown as { __m3a: unknown }).__m3a = {
    ready: true,
    version: VERSION,
    state: () => game.state(),
    hash: () => game.hash(),
    play(name: MoveName) {
      if (!(MOVES as readonly string[]).includes(name)) throw new Error(`__m3a.play: no move "${name}"; moves: ${MOVES.join(", ")}`);
      game.play(name);
    },
    step(n = 1, input: Input = { x: 0, y: 0 }) {
      paused = true;
      const events: AnimatorEvent[] = [];
      for (let i = 0; i < n; i++) events.push(...game.step(STEP, input));
      shown(events);
      place();
      return events.map((e) => ({ name: e.name, clip: e.clip, at: e.at }));
    },
    /** The pose's body points as the game places them (mm; turned, lifted) and where its root stands, for the sensors. */
    points: () => game.placed(att.pose.points),
    pause: (on = true) => void (paused = on),
  };
  place();
  hud();
  requestAnimationFrame(frame);
}

const clampUnit = (x: number) => Math.max(-1, Math.min(1, x));
main().catch((err: Error) => {
  $("mode").textContent = `error: ${err.message}`;
  (window as unknown as { __m3a: unknown }).__m3a = { ready: false, error: err.message };
  throw err;
});
