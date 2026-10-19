// e2e `consumer-ts` (PLAN.md WP-10.1): the TypeScript consumer lab built by Vite and opened headless on WebGL 2. Its
// console handle runs the scripted session (data/session.sim.json), posing both fighters after every step as the view
// does. Node plays the same session on the same characters, posed or never posed (my-3dge's two update paths: the sim
// never depends on posing), and gives what the page played step by step: every event, hit, place and hp, and the
// hashes, which see a change to any fighter's place, hp or Animator. The hero's hit event fires and lands on the dummy,
// which flinches; m3a's own `sim.simulate` predicts the hero's states and events, and its root, step by step, is where
// the game put the hero (to a micron), so the hero goes by root motion; nothing is NaN. The page's own frame loop, run
// by requestAnimationFrame on a held clock with W down, takes floor(T × 60 / 1000) steps over T ms of frames and lands
// on Node's hash for that many walking steps; in Node the frame clock does so however frames fall. On that clock a J
// press in a frame that owes no step (the first after a resume) slashes at the next step, Node's hash again, and after
// a frame of several steps the view draws each fighter between its last two places by alpha. docs/MIGRATING.md
// names each of my-3dge's animator WPs (3.4–3.7) and library WPs (8.1–8.10) as replaced, wrapped or kept. Screenshots
// go to check-output/consumer-ts/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import { math } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { bind, type ThreeBound } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { sim } from "@m3a/tools";
import { createClock } from "../../apps/lab/consumer-ts/src/clock.ts";
import { duelClips } from "../../apps/lab/consumer-ts/src/clips.ts";
import { Duel, intents, play, RULES, SETUP, type DuelEvent, type Intent, type Played } from "../../apps/lab/consumer-ts/src/game.ts";

const ROOT = join(import.meta.dirname, "../.."), LAB = join(ROOT, "apps/lab/consumer-ts"), SITE = join(ROOT, ".cache/consumer-ts-site");
const OUT = join(ROOT, "check-output/consumer-ts"), ORIGIN = "http://localhost:4176", DEG = Math.PI / 180;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const read = (file: string) => JSON.parse(readFileSync(join(LAB, "data", file), "utf8"));
const graph = read("duel.graph.json"), script = read("session.sim.json"), text = { graph, recipes: [read("slash.recipe.json")] };
/** After the session, a few steps driven one call each, as an agent at the console would. */
const AFTER: { n: number; intent: Intent }[] = [{ n: 30, intent: { speed: 1 } }, { n: 1, intent: { speed: 0, attack: true } }, { n: 40, intent: { speed: 0 } }];
type Handle = {
  ready: boolean;
  error?: string;
  hash(): string;
  session(): Played;
  step(n: number, intent: Intent): { name: string }[];
  state(): ReturnType<Duel["state"]>;
  drawn(): Record<string, { x: number; z: number; heading: number }>;
  pause(on: boolean): void;
};

test.use({ launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await build({ configFile: join(LAB, "vite.config.ts"), build: { outDir: SITE, emptyOutDir: true }, logLevel: "error" });
});
test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname)), file = join(SITE, path === "/" ? "index.html" : path);
    if (!file.startsWith(SITE) || !existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
});

/** The duel in Node on the page's characters and clips (the library read from disk rather than bundled). */
async function nodeDuel(): Promise<{ duel: Duel; clips: ReturnType<typeof duelClips>; hero: ThreeBound }> {
  const clips = duelClips(openLibrary(), text), body = async (seed: number) => bind((await loadGlb(character(variant(seed)).glb, { textures: false })).scene);
  const hero = await body(SETUP.hero), dummy = await body(SETUP.dummy);
  return { duel: new Duel({ hero: hero.core, dummy: dummy.core }, graph, clips, SETUP.gap), clips, hero };
}
const after = (duel: Duel) => AFTER.map((a) => {
  for (let i = 0; i < a.n; i++) duel.step(i === 0 ? a.intent : { ...a.intent, attack: false });
  return duel.hash();
});
/** Opens the page (paused, on WebGL 2) and waits for its handle; fails with the page's log if it didn't start. */
async function open(page: Page): Promise<void> {
  const log: string[] = [];
  page.on("console", (m) => log.push(m.text()));
  page.on("pageerror", (e) => log.push(String(e)));
  await page.goto(`${ORIGIN}/?renderer=webgl2&paused=1`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready !== undefined, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.error), log.join("\n")).toBeUndefined();
}

test("consumer-ts: the scripted session headless on WebGL 2 plays as Node, step by step, lands its hit, goes by root motion, no NaN", async ({ page }) => {
  // the page posing two fighters every step on SwiftShader, then Node playing it twice and sim.simulate posing it: about 25 s here
  test.setTimeout(180_000);
  await open(page);
  const web = await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.session());
  await page.waitForTimeout(100);
  expect((await page.screenshot({ path: join(OUT, "01-session.png") })).byteLength).toBeGreaterThan(5000);
  const webAfter: string[] = [];
  for (const a of AFTER) webAfter.push(await page.evaluate(([n, intent]) => {
    const h = (window as unknown as { __m3a: Handle }).__m3a;
    h.step(n, intent);
    return h.hash();
  }, [a.n, a.intent] as const));
  await page.screenshot({ path: join(OUT, "02-after.png") });
  await expect(page.locator("#hud")).toContainText(`hits ${web.hits.length + 1}`);

  // what the page played: the hit, its landing, the flinch, every number finite
  expect(web.finite).toBe(true);
  expect(web.events.filter((e) => e.fighter === "hero" && e.name === "hit")).toHaveLength(1);
  expect(web.hits).toEqual([{ step: web.events.find((e) => e.name === "hit")!.step, from: "hero", to: "dummy", hp: 100 - RULES.damage }]);
  expect(web.events.some((e) => e.fighter === "dummy" && e.name === "enter" && e.state === "flinch" && e.step === web.hits[0]!.step + 1)).toBe(true);
  expect(web.places.at(-1)!.dummy!.hp).toBe(100 - RULES.damage);

  // Node: the same session, never posed and posed every step, plays what the page played: every event and hit, each
  // fighter's place and hp after every step, the travel and the hashes, to the bit; so do the steps after it
  const n = await nodeDuel(), bare = play(n.duel, intents(script));
  expect(web.places).toHaveLength(intents(script).length);
  expect(web).toEqual(bare);
  expect(after(n.duel)).toEqual(webAfter);
  const posed = await nodeDuel();
  expect(play(posed.duel, intents(script), { view: (d) => d.fighters.every((f) => f.animator.pose().points.every(Number.isFinite)) })).toEqual(bare);
  // the hash sees what later steps read: a fighter's place, heading and hp, and its Animator, each by its last bit
  const d = posed.duel, f = d.get("dummy"), seen = [d.hash()];
  for (const poke of [() => (f.x += 1e-12), () => (f.z += 1e-12), () => (f.heading += 1e-12), () => (f.hp -= 1), () => f.animator.set("speed", 0.5)]) {
    poke();
    seen.push(d.hash());
  }
  expect(new Set(seen).size, "a hash that a poke left alone").toBe(seen.length);

  // m3a's sim.simulate, on the hero's graph and body with the same script, predicts what the game played for the hero:
  // its states and events, and its root after every step (forward and right mm, yaw degrees) is where the game put
  // the hero (x = −right, z = forward, heading = yaw, SI), to a micron and a microradian
  const run = sim.simulate({ graph, script, body: n.hero.core, clips: n.clips }), mine = bare.events.filter((e) => e.fighter === "hero");
  expect(run.trace.states.filter((s) => s.from !== null).map((s) => [s.step, s.layer, s.state])).toEqual(mine.filter((e) => e.name === "enter").map((e) => [e.step, e.layer, e.state]));
  expect(run.trace.events.map((e) => [e.step, e.name])).toEqual(mine.filter((e) => e.name !== "enter").map((e) => [e.step, e.name]));
  expect(run.root).toHaveLength(bare.places.length);
  const off = run.root.map((r, i) => {
    const h = bare.places[i]!.hero!;
    return { step: i, m: Math.max(Math.abs(h.x + r.right / 1000), Math.abs(h.z - r.forward / 1000)), rad: Math.abs(h.heading - r.yaw * DEG) };
  });
  const worst = off.reduce((a, b) => (b.m > a.m ? b : a)), turned = off.reduce((a, b) => (b.rad > a.rad ? b : a)), end = run.root.at(-1)!;
  expect(worst.m, `the hero ${worst.m} m off sim.simulate's root at step ${worst.step}`).toBeLessThan(1e-6);
  expect(turned.rad, `the hero's heading ${turned.rad} rad off at step ${turned.step}`).toBeLessThan(1e-6);
  expect(bare.travel).toBeCloseTo(Math.hypot(end.forward, end.right) / 1000, 6);
  expect(bare.travel).toBeGreaterThan(SETUP.gap - RULES.reach);
  writeFileSync(join(OUT, "session.json"), JSON.stringify({ about: "the consumer lab's scripted session as the page played it (WP-10.1)", ...web, after: webAfter, simulate: { states: run.trace.states, hits: run.trace.hits, path: run.path, sensors: run.sensors, heroOff: { m: worst.m, rad: turned.rad } } }, null, 1));
});

test("consumer-ts: the page's own frame loop on a held clock takes floor(T × 60 / 1000) steps over T ms of frames, Node's steps", async ({ page }) => {
  // the page's requestAnimationFrame loop rendering 2 s of frames on SwiftShader: about 10 s here
  test.setTimeout(180_000);
  // Playwright's clock: real time flows while the page loads; then the test holds it and runs the frames itself
  await page.clock.install();
  await open(page);
  // held twice: the first hold from a flowing clock can leave the next frame due past the clock's now; a few frames
  // then put the loop's frames on the clock's 16 ms grid
  for (const ms of [1000, 2000]) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + ms);
  await page.clock.runFor(50);
  // W down: the loop reads a walk every frame; resumed on a fresh frame clock, whose first frame is the origin, with a
  // recorder on requestAnimationFrame beside it, so the test knows each frame's time
  await page.keyboard.down("KeyW");
  await page.evaluate(() => {
    const w = window as unknown as { __m3a: Handle; frames: number[] };
    w.frames = [];
    const rec = (t: number) => {
      w.frames.push(t);
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
    w.__m3a.pause(false);
  });
  const T = 2000;
  await page.clock.runFor(T);
  const ran = await page.evaluate(() => {
    const w = window as unknown as { __m3a: Handle; frames: number[] };
    w.__m3a.pause(true);
    return { frames: w.frames, steps: w.__m3a.state().steps, hash: w.__m3a.hash(), hero: w.__m3a.state().fighters.find((f) => f.id === "hero")! };
  });
  await page.keyboard.up("KeyW");
  await page.screenshot({ path: join(OUT, "03-frames.png") });
  const first = ran.frames[0]!, last = ran.frames.at(-1)!, due = Math.floor(((last - first) * 60) / 1000);
  // every frame of the T ms ran, 16 ms apart, and the loop took exactly the steps they owe
  expect(last - first, ran.frames.join(" ")).toBeGreaterThan(T - 40);
  expect(ran.frames.slice(1).every((t, i) => Math.abs(t - ran.frames[i]! - 16) < 1e-6), ran.frames.join(" ")).toBe(true);
  expect(ran.steps).toBe(due);
  expect(ran.hero.speed).toBe(1);
  await expect(page.locator("#hud")).toContainText(`step ${due} `);
  // Node: that many walking steps from a fresh duel give the page's hash
  const n = await nodeDuel();
  for (let i = 0; i < due; i++) n.duel.step({ speed: 1 });
  expect(ran.hash).toBe(n.duel.hash());
});

test("consumer-ts: on a held clock a J press in a frame that owes no step still slashes, and after a frame of several steps the view draws between the last two places", async ({ page }) => {
  // the page's requestAnimationFrame loop rendering 1.5 s of frames on SwiftShader: about 10 s here
  test.setTimeout(180_000);
  await page.clock.install();
  await open(page);
  for (const ms of [1000, 2000]) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + ms);
  await page.clock.runFor(50);
  // resumed on a fresh frame clock, a recorder beside it; W and J go down before its first frame, the origin, which
  // owes no step: the press lands in that frame and must wait for the next one's step
  await page.evaluate(() => {
    const w = window as unknown as { __m3a: Handle; frames: number[] };
    w.frames = [];
    const rec = (t: number) => {
      w.frames.push(t);
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
    w.__m3a.pause(false);
  });
  await page.keyboard.down("KeyW");
  await page.keyboard.down("KeyJ");
  await page.clock.runFor(1500);
  // then one frame 70 ms on, owing several steps; the clock held, no frame runs after it until the view is read
  await page.clock.fastForward(70);
  const ran = await page.evaluate(() => {
    const w = window as unknown as { __m3a: Handle; frames: number[] }, out = { frames: w.frames, steps: w.__m3a.state().steps, hash: w.__m3a.hash(), drawn: w.__m3a.drawn() };
    w.__m3a.pause(true);
    return out;
  });
  await page.keyboard.up("KeyJ");
  await page.keyboard.up("KeyW");
  // each frame's steps and alpha, as the page's frame clock took them from the same times
  const clock = createClock(), owed = ran.frames.map((t) => clock.advance(t)), end = owed.at(-1)!, due = owed.reduce((s, f) => s + f.steps, 0);
  expect([owed[0]!.steps, ran.steps], ran.frames.join(" ")).toEqual([0, due]);
  expect(end.steps, ran.frames.slice(-3).join(" ")).toBeGreaterThanOrEqual(2);
  // Node: the press on the first step, then walking, gives the page's hash; the hero slashed from that step
  const n = await nodeDuel(), places: Record<string, [number, number, number]>[] = [], events: DuelEvent[] = [];
  for (let i = 0; i < due; i++) {
    events.push(...n.duel.step(i === 0 ? { speed: 1, attack: true } : { speed: 1 }));
    places.push(Object.fromEntries(n.duel.fighters.map((f) => [f.id, [f.x, f.z, f.heading] as [number, number, number]])));
  }
  expect(events.find((e) => e.fighter === "hero" && e.state === "slash")?.step).toBe(0);
  expect(ran.hash).toBe(n.duel.hash());
  // the view drew each fighter between its place before the frame's last step and its last, by the frame's alpha,
  // not from where the frame began (the hero walked between the two, so they differ)
  const before = places.at(-2)!, now = places.at(-1)!, began = places.at(-1 - end.steps)!, lerp = (a: number, b: number) => a + (b - a) * end.alpha;
  for (const id of ["dummy", "hero"]) expect(ran.drawn[id], id).toEqual({ x: lerp(before[id]![0], now[id]![0]), z: lerp(before[id]![1], now[id]![1]), heading: lerp(before[id]![2], now[id]![2]) });
  expect(lerp(began.hero![1], now.hero![1])).not.toBe(ran.drawn.hero!.z);
});

test("consumer-ts: the frame clock gives floor(T × 60 / 1000) steps however frames fall, at most 6 a frame", () => {
  const clock = createClock(), r = new math.Rng(7);
  let now = 1000, steps = 0;
  clock.advance(now);
  for (let i = 0; i < 2000; i++) {
    now += 4 + r.next() * 30;
    const f = clock.advance(now);
    steps += f.steps;
    expect(f.alpha).toBeGreaterThanOrEqual(0);
    expect(f.alpha).toBeLessThan(1);
  }
  expect(steps).toBe(Math.floor(((now - 1000) * 60) / 1000));
  const stall = clock.advance(now + 1000);
  expect([stall.steps, stall.dropped]).toEqual([6, 54]);
});

/** my-3dge's planned animator WPs (its PLAN.md WP-3.4 to 3.7, ADR-0009) and Phase 8 (WP-8.1 to 8.10, ADR-0010). */
const MY3DGE_WPS = ["3.4", "3.5", "3.6", "3.7", ...Array.from({ length: 10 }, (_, i) => `8.${i + 1}`)];

test("consumer-ts: docs/MIGRATING.md marks each of my-3dge's WPs 3.4–3.7 and 8.1–8.10 replaced, wrapped or kept", () => {
  const rows = readFileSync(join(ROOT, "docs/MIGRATING.md"), "utf8").split("\n").filter((l) => l.startsWith("| WP-"));
  for (const id of MY3DGE_WPS) {
    const row = rows.filter((l) => l.startsWith(`| WP-${id} `));
    expect(row, `WP-${id}: one row`).toHaveLength(1);
    const words = [...row[0]!.matchAll(/\*\*(replaced|wrapped|kept)\*\*/g)].map((m) => m[1]);
    expect(words, `WP-${id}: one of replaced, wrapped or kept`).toHaveLength(1);
  }
});
