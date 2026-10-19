// e2e `consumer-ts` (PLAN.md WP-10.1): the TypeScript consumer lab built by Vite and opened headless on WebGL 2. Its
// console handle runs the scripted session (data/session.sim.json), posing both fighters after every step as the view
// does: the page's hashes equal Node's for the same session on the same characters, posed or never posed (my-3dge's two
// update paths: the sim's hash never depends on posing), the hero's hit event fires and lands on the dummy, which
// flinches, root motion carries the hero to it, and nothing is NaN. In Node, m3a's own `sim.simulate` predicts the
// hero's states, events and path, and the frame clock steps floor(T × 60 / 1000) however frames fall. docs/MIGRATING.md
// names each of my-3dge's animator WPs (3.4–3.7) and library WPs (8.1–8.10) as replaced, wrapped or kept. Screenshots
// go to check-output/consumer-ts/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import { math } from "@m3a/core";
import { openLibrary } from "@m3a/library/node";
import { bind, type ThreeBound } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { sim } from "@m3a/tools";
import { createClock } from "../../apps/lab/consumer-ts/src/clock.ts";
import { duelClips } from "../../apps/lab/consumer-ts/src/clips.ts";
import { Duel, intents, play, RULES, SETUP, type Intent, type Played } from "../../apps/lab/consumer-ts/src/game.ts";

const ROOT = join(import.meta.dirname, "../.."), LAB = join(ROOT, "apps/lab/consumer-ts"), SITE = join(ROOT, ".cache/consumer-ts-site");
const OUT = join(ROOT, "check-output/consumer-ts"), ORIGIN = "http://localhost:4176";
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const read = (file: string) => JSON.parse(readFileSync(join(LAB, "data", file), "utf8"));
const graph = read("duel.graph.json"), script = read("session.sim.json"), text = { graph, recipes: [read("slash.recipe.json")] };
/** After the session, a few steps driven one call each, as an agent at the console would. */
const AFTER: { n: number; intent: Intent }[] = [{ n: 30, intent: { speed: 1 } }, { n: 1, intent: { speed: 0, attack: true } }, { n: 40, intent: { speed: 0 } }];
type Handle = { ready: boolean; error?: string; hash(): string; session(): Played; step(n: number, intent: Intent): { name: string }[]; state(): ReturnType<Duel["state"]> };

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

test("consumer-ts: the scripted session headless on WebGL 2 gives Node's hashes, lands its hit, moves by root motion, no NaN", async ({ page }) => {
  // the page posing two fighters every step on SwiftShader, then Node playing it twice: about 20 s here
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on("console", (m) => log.push(m.text()));
  page.on("pageerror", (e) => log.push(String(e)));
  await page.goto(`${ORIGIN}/?renderer=webgl2&paused=1`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready !== undefined, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.error), log.join("\n")).toBeUndefined();
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

  // what the page played: the hit, its landing, the flinch, the hero's travel, every number finite
  expect(web.finite).toBe(true);
  expect(web.events.filter((e) => e.fighter === "hero" && e.name === "hit")).toHaveLength(1);
  expect(web.hits).toEqual([{ step: web.events.find((e) => e.name === "hit")!.step, from: "hero", to: "dummy", hp: 100 - RULES.damage }]);
  expect(web.events.some((e) => e.fighter === "dummy" && e.name === "enter" && e.state === "flinch" && e.step === web.hits[0]!.step + 1)).toBe(true);
  expect(web.travel).toBeGreaterThan(3);
  expect(web.travel).toBeLessThan(SETUP.gap - 0.5);

  // Node: the same session, never posed and posed every step, gives the page's hashes; so do the steps after it
  const n = await nodeDuel(), bare = play(n.duel, intents(script)), root = { ...n.duel.get("hero").animator.root };
  expect(bare.hashes).toEqual(web.hashes);
  expect(after(n.duel)).toEqual(webAfter);
  const posed = await nodeDuel();
  expect(play(posed.duel, intents(script), { view: (d) => d.fighters.every((f) => f.animator.pose().points.every(Number.isFinite)) })).toEqual({ ...bare, finite: true });

  // m3a's sim.simulate, on the hero's graph and body with the same script, predicts what the game played for the hero
  const run = sim.simulate({ graph, script, body: n.hero.core, clips: n.clips, poses: false }), mine = bare.events.filter((e) => e.fighter === "hero");
  expect(run.trace.states.filter((s) => s.from !== null).map((s) => [s.step, s.layer, s.state])).toEqual(mine.filter((e) => e.name === "enter").map((e) => [e.step, e.layer, e.state]));
  expect(run.trace.events.map((e) => [e.step, e.name])).toEqual(mine.filter((e) => e.name !== "enter").map((e) => [e.step, e.name]));
  const end = run.path.at(-1)!;
  expect([end.forward, end.right, end.yaw]).toEqual([root.forward, root.right, root.yaw].map((v) => Math.round(v * 10) / 10));
  writeFileSync(join(OUT, "session.json"), JSON.stringify({ about: "the consumer lab's scripted session as the page played it (WP-10.1)", ...web, after: webAfter, simulate: { states: run.trace.states, hits: run.trace.hits, path: run.path } }, null, 1));
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
