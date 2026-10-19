// The TypeScript consumer lab's page (PLAN.md WP-10.1): two generated humanoids duel on three.js r182's WebGPURenderer
// (WebGL 2 with ?renderer=webgl2), the sim (game.ts) stepped at a fixed 60 Hz by the frame clock (clock.ts) as my-3dge's
// loop steps its sim; then the view poses each fighter (presentation, never hashed) and places it between its last
// two places by the clock's alpha (after a frame of several steps, the one before the last and the last). W or ↑
// walks, Shift jogs, J slashes (a press waits for the next step); ?paused=1 starts paused. The stamp names core's
// version and the build's commit, as every page's does.
// `window.__m3a` drives it headless: ready, state(), hash(), step(n, intent), session() (the scripted session, from
// the start), drawn() (where the view put each fighter), pause(on) (resuming starts the frame clock afresh: the paused
// time is never owed).
import { Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGPURenderer } from "three/webgpu";
import { VERSION } from "@m3a/core";
import { Library, type LibrarySource } from "@m3a/library";
import { attach, bind, type Attached, type ThreeBound } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import graphText from "../data/duel.graph.json?raw";
import recipeText from "../data/slash.recipe.json?raw";
import scriptText from "../data/session.sim.json?raw";
import { createClock } from "./clock.ts";
import { duelClips } from "./clips.ts";
import { Duel, intents, play, SETUP, type DuelEvent, type Intent } from "./game.ts";

declare const __DUEL_LIBRARY__: string;
declare const __COMMIT__: string;
const $ = (id: string) => document.getElementById(id)!;
const q = new URLSearchParams(location.search);

/** The library as the build bundled it: a source of files for @m3a/library's Library. */
function bundledLibrary(): Library {
  const files = JSON.parse(__DUEL_LIBRARY__) as Record<string, Record<string, string>>;
  const source: LibrarySource = {
    sets: () => Object.keys(files),
    files: (set) => Object.keys(files[set] ?? {}),
    read: (set, file) => {
      const text = files[set]?.[file];
      if (text === undefined) throw new Error(`consumer-ts: the build bundled no ${set}/${file}; vite.config.ts bundles what the graph and recipe name`);
      return text;
    },
  };
  return new Library(source);
}

async function main(): Promise<void> {
  const graph = JSON.parse(graphText), clips = duelClips(bundledLibrary(), { graph, recipes: [JSON.parse(recipeText)] }), script = JSON.parse(scriptText);
  const body = async (seed: number) => bind((await loadGlb(character(variant(seed)).glb)).scene);
  const bodies: Record<"hero" | "dummy", ThreeBound> = { hero: await body(SETUP.hero), dummy: await body(SETUP.dummy) };
  let duel!: Duel, views: { id: string; att: Attached; from: [number, number, number] }[] = [];
  const fresh = () => {
    duel = new Duel({ hero: bodies.hero.core, dummy: bodies.dummy.core }, graph, clips, SETUP.gap);
    views = duel.fighters.map((f) => ({ id: f.id, att: attach(f.animator, bodies[f.id as "hero" | "dummy"]), from: [f.x, f.z, f.heading] }));
  };
  fresh();

  // the scene: a floor, two lights, the fighters, a camera from the side on the point between them
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: q.get("renderer") === "webgl2" });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  document.body.prepend(renderer.domElement);
  await renderer.init();
  const scene = new Scene(), camera = new PerspectiveCamera(40, 1, 0.05, 200), sun = new DirectionalLight(0xffffff, 2.2);
  scene.background = new Color(0xf4f2ec);
  sun.position.set(4, 6, 2);
  const floor = new Mesh(new PlaneGeometry(60, 60), new MeshStandardMaterial({ color: 0xe4e0d6 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(new HemisphereLight(0xffffff, 0x8a8478, 1.3), sun, floor, new GridHelper(60, 60, 0xb8b2a6, 0xd0cbc0), bodies.hero.root, bodies.dummy.root);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  // the view: each fighter posed and placed between its last two places (alpha), the HUD; false on a number not finite
  let flash = 0, shown = 0;
  const view = (alpha = 1): boolean => {
    let finite = true;
    for (const v of views) {
      const f = duel.get(v.id), lerp = (a: number, b: number) => a + (b - a) * alpha;
      v.att.apply();
      finite &&= v.att.pose.points.every(Number.isFinite);
      v.att.bound.root.position.set(lerp(v.from[0], f.x), 0, lerp(v.from[1], f.z));
      v.att.bound.root.rotation.y = -lerp(v.from[2], f.heading);
    }
    const mid = (bodies.hero.root.position.z + bodies.dummy.root.position.z) / 2;
    camera.position.set(6, 2, mid);
    camera.lookAt(0, 0.9, mid);
    if (duel.hits.length > shown) {
      flash = 0.3;
      $("hit").className = "on";
    }
    shown = duel.hits.length;
    const s = duel.state(), dummy = s.fighters.find((f) => f.id === "dummy")!;
    $("hud").textContent = `step ${s.steps} · hits ${s.hits.length} · dummy hp ${dummy.hp} · ${s.fighters.map((f) => `${f.id} ${f.states.join(" ")}`).join(" · ")}`;
    return finite;
  };
  const keep = () => {
    for (const v of views) v.from = [duel.get(v.id).x, duel.get(v.id).z, duel.get(v.id).heading];
  };
  const advance = (intent: Intent, n: number): DuelEvent[] => {
    const events: DuelEvent[] = [];
    // as my-3dge's frame: an edge (the press) goes to the first step only, held input repeats; each place is kept
    // before every step, so after a frame of several steps the view lerps from the one before the last
    for (let i = 0; i < n; i++) {
      keep();
      events.push(...duel.step(i === 0 ? intent : { ...intent, attack: false }));
    }
    return events;
  };

  // input, the frame loop and the console handle
  const keys = new Set<string>();
  let paused = q.get("paused") === "1", wasAttack = false, pressed = false, last = 0;
  addEventListener("keydown", (e) => keys.add(e.code));
  addEventListener("keyup", (e) => keys.delete(e.code));
  // the keys as a frame reads them; a J press (an edge) waits for a step to take it, so one in a frame that owes no
  // step (the first after a resume, or most frames on a display faster than 60 Hz) still slashes
  const live = (): Intent => {
    const k = (...c: string[]) => c.some((x) => keys.has(x)), attack = k("KeyJ");
    pressed ||= attack && !wasAttack;
    wasAttack = attack;
    return { speed: k("KeyW", "ArrowUp") ? (k("ShiftLeft", "ShiftRight") ? 3.5 : 1) : 0, ...(pressed ? { attack: true } : {}) };
  };
  let clock = createClock();
  const frame = (now: number) => {
    const f = clock.advance(now), dt = (now - (last || now)) / 1000;
    last = now;
    if (!paused) {
      const intent = live();
      if (f.steps > 0) {
        advance(intent, f.steps);
        pressed = false;
      }
    }
    view(paused ? 1 : f.alpha);
    if (flash > 0 && (flash -= dt) <= 0) $("hit").className = "";
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  $("stamp").textContent = `m3a ${VERSION} · ${__COMMIT__} · three r182 · fixed 60 Hz`;
  (window as unknown as { __m3a: unknown }).__m3a = {
    ready: true,
    version: VERSION,
    state: () => duel.state(),
    hash: () => duel.hash(),
    /** n fixed steps under one intent (the press on the first), paused from then; the events they passed. */
    step(n = 1, intent: Intent = { speed: 0 }) {
      paused = true;
      const events = advance(intent, n);
      view();
      return events;
    },
    /** The scripted session (data/session.sim.json) from a fresh duel, posed after every step as the view poses. */
    session() {
      paused = true;
      fresh();
      const played = play(duel, intents(script), { view: () => view() });
      keep();
      return played;
    },
    /** Where the view last drew each fighter (by id): x and z (m) and heading (radians), between its last two places. */
    drawn() {
      return Object.fromEntries(views.map((v) => [v.id, { x: v.att.bound.root.position.x, z: v.att.bound.root.position.z, heading: -v.att.bound.root.rotation.y }]));
    },
    /** Pauses the frame loop, or resumes it on a fresh frame clock: its first frame sets the origin, so T ms on owe
     *  floor(T × 60 / 1000) steps whatever came before. */
    pause(on = true) {
      if (paused && !on) clock = createClock();
      paused = on;
    },
  };
  view();
  requestAnimationFrame(frame);
}

main().catch((err: Error) => {
  $("hud").textContent = `error: ${err.message}`;
  (window as unknown as { __m3a: unknown }).__m3a = { ready: false, error: err.message };
  throw err;
});
