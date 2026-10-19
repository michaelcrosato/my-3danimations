// e2e `hello` (WP-4.6): the first-flight demo built by Vite and opened headless on WebGL 2. Its console handle drives
// a scripted session (idle, walk, run, stop, jump, attack): the page's hashes equal Node's for the same script (the same
// game.ts on the same character), the attack's hit fires and shows, the sensors run on every frame it played, and its
// screenshots and a contact sheet of what it played go to check-output/hello/ (CI's T2 artifact: the G4 demo link while
// O3's previews are paused, D85). Deep links pick the character, a clip, a moment and a view. The same session in Node on G4's six
// skeletons (and its held-out rig, once recorded) plays with no fail finding (check-output/hello/set.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import { checks, raster } from "../../packages/sensors/src/index.ts";
import { writePng } from "../../packages/sensors/src/node.ts";
import { bind } from "../../packages/three/src/index.ts";
import { character, loadGlb, variant } from "../../packages/three/test-characters/index.ts";
import { DEFAULT_CLIPS, Hello, MOVES, prepare, type Input, type Move, type MoveName } from "../../apps/lab/hello/src/game.ts";
import { libraryClips } from "../../tools/qa/qa.ts";
import { heldout, rigOf } from "../../tools/sweep/sweep.ts";

const ROOT = join(import.meta.dirname, "../.."), SITE = join(ROOT, ".cache/hello-site"), OUT = join(ROOT, "check-output/hello"), ORIGIN = "http://localhost:4175";
const SEED = 1;
/** The session: steps of 1/60 s under an input, a press lasting one step. */
const SCRIPT: { name: string; n: number; input: Input }[] = [
  { name: "idle", n: 60, input: { x: 0, y: 0 } },
  { name: "walk", n: 120, input: { x: 0, y: 1 } },
  { name: "run", n: 120, input: { x: 0.7, y: 0.7, run: true } },
  { name: "stop", n: 90, input: { x: 0, y: 0 } },
  { name: "jump", n: 1, input: { x: 0, y: 0, jump: true } },
  { name: "air", n: 260, input: { x: 0, y: 0 } },
  { name: "attack", n: 1, input: { x: 0, y: 0, attack: true } },
  { name: "strike", n: 110, input: { x: 0, y: 0 } },
];
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

test.use({ launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await build({ configFile: join(ROOT, "apps/lab/hello/vite.config.ts"), build: { outDir: SITE, emptyOutDir: true }, logLevel: "error" });
});
test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname)), file = join(SITE, path === "/" ? "index.html" : path);
    if (!file.startsWith(SITE) || !existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
});

/** The same session in Node: the game on the same character, its hash after each part. */
async function nodeSession(): Promise<string[]> {
  const bound = bind((await loadGlb(character(variant(SEED)).glb, { textures: false })).scene), lib = libraryClips();
  const moves = {} as Record<MoveName, Move>;
  for (const m of MOVES) {
    const c = lib.find((x) => x.clip.id === DEFAULT_CLIPS[m])!;
    moves[m] = prepare(c.clip, c.rest, bound.core.rest, m === "attack");
  }
  const game = new Hello(bound.core, moves), out: string[] = [];
  for (const s of SCRIPT) {
    for (let i = 0; i < s.n; i++) game.step(1 / 60, s.input);
    out.push(game.hash());
  }
  return out;
}

type Handle = { ready: boolean; error?: string; hash(): string; state(): { mode: string; hits: number; layers: { clip: string; time: number }[] }; step(n: number, input?: Input): { name: string }[]; points(): { points: number[]; root: { forward: number; right: number; yaw: number } } };

test("hello: the console handle drives a session headless; its hashes are Node's, its hit shows, the sensors read it", async ({ page }) => {
  // 860 steps driven one call a part, 6 screenshots on SwiftShader, the session again in Node and the sensors over it:
  // about 20 s here, over Playwright's default 30 s on CI's two cores
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on("console", (m) => log.push(m.text()));
  page.on("pageerror", (e) => log.push(String(e)));
  await page.goto(`${ORIGIN}/?renderer=webgl2&t=0&char=gen-${SEED}`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean; error?: string } }).__m3a?.ready !== undefined, undefined, { timeout: 60_000 });
  const err = await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.error);
  expect(err, log.join("\n")).toBeUndefined();
  const hashes: string[] = [], events: string[] = [], frames: number[][] = [], roots: { forward: number; right: number; yaw: number }[] = [];
  for (const s of SCRIPT) {
    const got = await page.evaluate(([n, input]) => {
      const h = (window as unknown as { __m3a: Handle }).__m3a, ev: string[] = [], pts: number[][] = [], rt: { forward: number; right: number; yaw: number }[] = [];
      for (let i = 0; i < n; i++) {
        ev.push(...h.step(1, input).map((e) => e.name));
        const p = h.points();
        pts.push(p.points);
        rt.push(p.root);
      }
      return { hash: h.hash(), ev, pts, rt };
    }, [s.n, s.input] as const);
    hashes.push(got.hash);
    events.push(...got.ev);
    frames.push(...got.pts);
    roots.push(...got.rt);
    if (s.n > 1) {
      await page.waitForTimeout(50);
      const shot = await page.screenshot({ path: join(OUT, `${String(hashes.length).padStart(2, "0")}-${s.name}.png`) });
      expect(shot.byteLength).toBeGreaterThan(5000);
    }
  }
  // the hit fired, and the HUD counts it
  expect(events).toContain("hit");
  const state = await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.state());
  expect(state.hits).toBeGreaterThanOrEqual(1);
  await expect(page.locator("#hits")).toHaveText(`hits ${state.hits}`);
  await expect(page.locator("#stamp")).toContainText("m3a ");
  // the same script in Node gives the same hashes, part by part
  expect(hashes).toEqual(await nodeSession());
  // the sensors on what it played (each frame's points on the character's rest, the root's path)
  const bound = bind((await loadGlb(character(variant(SEED)).glb, { textures: false })).scene);
  const m = checks.motionOfFrames(frames, bound.core.rest, { root: roots, parts: true, id: "hello session" }), report = checks.measure(m);
  writeFileSync(join(OUT, "sensors.json"), JSON.stringify({ about: "the sensors on the e2e session the demo played", values: report.values, findings: report.findings, verdict: report.verdict }, null, 1));
  const fails = report.findings.filter((f) => f.level === "fail");
  expect(fails, report.text).toEqual([]);
  // a contact sheet of what it played: a frame every half second, three-quarter view
  const shots = frames.filter((_, i) => i % 30 === 0).map((f, i) => raster.render(f, { view: "three-quarter", width: 160, height: 200, label: `${(i * 0.5).toFixed(1)} s` }));
  const rows = Array.from({ length: Math.ceil(shots.length / 8) }, (_, r) => raster.join(shots.slice(r * 8, r * 8 + 8)));
  const sheetImg = raster.join(rows, { down: true });
  raster.assertNotBlank(sheetImg, "the session's contact sheet");
  writePng(join(OUT, "sheet.png"), sheetImg);
});

/** G4's skeletons (PLAN.md §9.3): four generated, two real CC0 rigs from different sources, and the held-out rig of the
 *  gate's latest run once one is recorded. */
const G4_RIGS = ["gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight"];

test("hello: the idle, walk, run, jump and attack set plays on G4's skeletons with the sensors green (no fail finding)", async () => {
  // the same scripted session in Node on each skeleton: what it played read by the sensors, and the hit fired
  test.setTimeout(600_000);
  const rigs: [string, string | undefined][] = G4_RIGS.map((r) => [r, undefined]);
  try {
    const h = heldout("G4");
    rigs.push(...h.rigs.map((r): [string, string] => [r, h.manifest]));
  } catch {
    // no held-out run yet: the six alone
  }
  const lib = libraryClips(), out: { rig: string; verdict: string; hits: number; fails: string[]; warns: string[] }[] = [];
  for (const [rig, manifest] of rigs) {
    const bound = await rigOf(rig, manifest), moves = {} as Record<MoveName, Move>;
    for (const m of MOVES) {
      const c = lib.find((x) => x.clip.id === DEFAULT_CLIPS[m])!;
      moves[m] = prepare(c.clip, c.rest, bound.core.rest, m === "attack");
    }
    const game = new Hello(bound.core, moves), frames: number[][] = [], roots: { forward: number; right: number; yaw: number }[] = [];
    let hits = 0;
    for (const s of SCRIPT) for (let i = 0; i < s.n; i++) {
      hits += game.step(1 / 60, s.input).filter((e) => e.name === "hit").length;
      const p = game.placed(game.animator.pose().points);
      frames.push(p.points);
      roots.push(p.root);
    }
    const report = checks.measure(checks.motionOfFrames(frames, bound.core.rest, { root: roots, parts: true, id: `hello set on ${rig}` }));
    out.push({ rig, verdict: report.verdict, hits, fails: report.findings.filter((f) => f.level === "fail").map((f) => f.message), warns: report.findings.filter((f) => f.level === "warn").map((f) => f.message) });
  }
  writeFileSync(join(OUT, "set.json"), JSON.stringify({ about: "the demo's scripted session on G4's skeletons, read by the sensors (PLAN.md §9.3)", rigs: out }, null, 1));
  for (const o of out) {
    expect(o.hits, o.rig).toBeGreaterThanOrEqual(1);
    expect(o.fails, o.rig).toEqual([]);
  }
});

test("hello: deep links pick the character, the clip, the moment and the view", async ({ page }) => {
  await page.goto(`${ORIGIN}/?renderer=webgl2&char=gen-7&clip=QUATERNIUS_3D2DGE/Sword_Attack&t=0.6&view=side`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready !== undefined, undefined, { timeout: 60_000 });
  const a = await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.state());
  expect(a.layers[0]!.clip).toBe("QUATERNIUS_3D2DGE/Sword_Attack");
  expect(a.layers[0]!.time).toBeCloseTo(0.6, 3);
  // paused at that moment
  const h0 = await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.hash());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.hash())).toBe(h0);
  await expect(page.locator("#mode")).toHaveText("QUATERNIUS_3D2DGE/Sword_Attack");
  await expect(page.locator("#stamp")).toContainText("char=gen-7");
  await page.screenshot({ path: join(OUT, "deep-link.png") });
});
