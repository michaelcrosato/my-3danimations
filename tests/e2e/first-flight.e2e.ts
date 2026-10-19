// e2e `first-flight` (WP-4.6, graduated from apps/lab/hello, D119): a game's first flight on the packages' public
// entries alone. The game (./first-flight/game.ts: idle, walk and run by speed, a jump and an attack with its hit, no
// DOM) is built by Vite into a page (./first-flight/page.ts, the library files its moves need bundled as a game's
// build bundles them) and opened headless on WebGL 2. Its console handle drives a scripted session (idle, walk, run,
// stop, jump, attack): the page's hashes equal Node's for the same script (the same game on the same character), the
// attack's hit fires and the HUD counts it, the sensors read what it played with no fail finding, and its screenshots
// and a contact sheet of what it played go to check-output/first-flight/ (CI's T2 artifact). The same session in Node on
// G4's six skeletons and the held-out rig of G4's latest run plays with no fail finding and lands its hit
// (check-output/first-flight/set.json): G4's standing T2 check (PLAN.md §9.3).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import { VERSION, type Rest } from "@m3a/core";
import { defaultSets, directory, openLibrary } from "@m3a/library/node";
import { checks, raster } from "@m3a/sensors";
import { writePng } from "@m3a/sensors/node";
import { bind } from "@m3a/three";
import { character, loadGlb, variant } from "@m3a/three/test-characters";
import { heldout, rigOf } from "../../tools/sweep/sweep.ts";
import { DEFAULT_CLIPS, Game, MOVES, prepare, type Input, type Move, type MoveName } from "./first-flight/game.ts";

const ROOT = join(import.meta.dirname, "../.."), PAGE = join(import.meta.dirname, "first-flight"), SITE = join(ROOT, ".cache/first-flight-site");
const OUT = join(ROOT, "check-output/first-flight"), ORIGIN = "http://localhost:4175";
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
/** G4's skeletons (PLAN.md §9.3): four generated, two real CC0 rigs from different sources; the held-out rig of the
 *  gate's latest run joins them. */
const G4_RIGS = ["gen-0", "gen-1", "gen-2", "gen-3", "quaternius-mannequin-m", "kaykit-knight"];
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

/** The library files the moves need, by set, then file name (each set's manifest and catalog, and the clips). */
function bundled(): Record<string, Record<string, string>> {
  const src = directory(defaultSets()), out: Record<string, Record<string, string>> = {};
  for (const id of Object.values(DEFAULT_CLIPS)) {
    const [set, name] = id.split("/") as [string, string];
    const files = (out[set] ??= { "_set.json": src.read(set, "_set.json"), "catalog.tsv": src.read(set, "catalog.tsv") });
    files[`${name}.json`] = src.read(set, `${name}.json`);
  }
  return out;
}

test.use({ launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await build({
    configFile: false,
    root: PAGE,
    base: "./",
    define: { __FIRST_FLIGHT__: JSON.stringify(JSON.stringify({ seed: SEED, files: bundled() })) },
    build: { outDir: SITE, emptyOutDir: true, target: "es2023", chunkSizeWarningLimit: 4096, reportCompressedSize: false },
    logLevel: "error",
  });
});
test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname)), file = join(SITE, path === "/" ? "index.html" : path);
    if (!file.startsWith(SITE) || !existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
});

/** The game's moves on a bound body, each clip from the library (@m3a/library's CC0 default pack) on its own rest. */
function movesOn(body: Rest): Record<MoveName, Move> {
  const lib = openLibrary(), moves = {} as Record<MoveName, Move>;
  for (const m of MOVES) {
    const { clip, rest } = lib.clip(DEFAULT_CLIPS[m]);
    moves[m] = prepare(clip, rest, body, m === "attack");
  }
  return moves;
}

/** The same session in Node: the game on the same character, its hash after each part. */
async function nodeSession(): Promise<string[]> {
  const bound = bind((await loadGlb(character(variant(SEED)).glb, { textures: false })).scene), game = new Game(bound.core, movesOn(bound.core.rest)), out: string[] = [];
  for (const s of SCRIPT) {
    for (let i = 0; i < s.n; i++) game.step(1 / 60, s.input);
    out.push(game.hash());
  }
  return out;
}

type Root = { forward: number; right: number; yaw: number };
type Handle = { ready: boolean; error?: string; backend: string; hash(): string; state(): { mode: string; hits: number }; step(n: number, input?: Input): { name: string }[]; points(): { points: number[]; root: Root } };

test("first-flight: the console handle drives a session headless on WebGL 2; its hashes are Node's, its hit fires and shows, the sensors read it", async ({ page }) => {
  // 860 steps driven one call a part, 6 screenshots on SwiftShader, the session again in Node and the sensors over it:
  // about 20 s here, over Playwright's default 30 s on CI's two cores
  test.setTimeout(180_000);
  const log: string[] = [];
  page.on("console", (m) => log.push(m.text()));
  page.on("pageerror", (e) => log.push(String(e)));
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready !== undefined, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.error), log.join("\n")).toBeUndefined();
  // the renderer runs on WebGL 2: its backend says so, and its canvas holds a WebGL 2 context
  const gl = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return { backend: (window as unknown as { __m3a: Handle }).__m3a.backend, canvas: c !== null, webgl2: c?.getContext("webgl2") instanceof WebGL2RenderingContext };
  });
  expect(gl).toEqual({ backend: "webgl2", canvas: true, webgl2: true });
  const hashes: string[] = [], events: string[] = [], frames: number[][] = [], roots: Root[] = [];
  for (const s of SCRIPT) {
    const got = await page.evaluate(([n, input]) => {
      const h = (window as unknown as { __m3a: Handle }).__m3a, ev: string[] = [], pts: number[][] = [], rt: Root[] = [];
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
  // the hit fired, and the HUD counts it; the stamp names core's version
  expect(events).toContain("hit");
  const state = await page.evaluate(() => (window as unknown as { __m3a: Handle }).__m3a.state());
  expect(state.hits).toBeGreaterThanOrEqual(1);
  await expect(page.locator("#hits")).toHaveText(`hits ${state.hits}`);
  await expect(page.locator("#stamp")).toContainText(`m3a ${VERSION}`);
  // the same script in Node gives the same hashes, part by part
  expect(hashes).toEqual(await nodeSession());
  // the sensors on what it played (each frame's points on the character's rest, the root's path)
  const bound = bind((await loadGlb(character(variant(SEED)).glb, { textures: false })).scene);
  const report = checks.measure(checks.motionOfFrames(frames, bound.core.rest, { root: roots, parts: true, id: "first-flight session" }));
  writeFileSync(join(OUT, "sensors.json"), JSON.stringify({ about: "the sensors on the e2e session the page played", values: report.values, findings: report.findings, verdict: report.verdict }, null, 1));
  expect(report.findings.filter((f) => f.level === "fail"), report.text).toEqual([]);
  // a contact sheet of what it played: a frame every half second, three-quarter view
  const shots = frames.filter((_, i) => i % 30 === 0).map((f, i) => raster.render(f, { view: "three-quarter", width: 160, height: 200, label: `${(i * 0.5).toFixed(1)} s` }));
  const rows = Array.from({ length: Math.ceil(shots.length / 8) }, (_, r) => raster.join(shots.slice(r * 8, r * 8 + 8)));
  const sheet = raster.join(rows, { down: true });
  raster.assertNotBlank(sheet, "the session's contact sheet");
  writePng(join(OUT, "sheet.png"), sheet);
});

test("first-flight: the idle, walk, run, jump and attack set plays on G4's six skeletons and the held-out rig with the sensors green (no fail finding)", async () => {
  // the same scripted session in Node on each skeleton: what it played read by the sensors, and the hit fired
  test.setTimeout(600_000);
  const h = heldout("G4");
  expect(h.rigs.length, `the held-out rig of G4's ${h.run}`).toBeGreaterThan(0);
  const rigs: [string, string | undefined][] = [...G4_RIGS.map((r): [string, undefined] => [r, undefined]), ...h.rigs.map((r): [string, string] => [r, h.manifest])];
  const out: { rig: string; verdict: string; hits: number; fails: string[]; warns: string[] }[] = [];
  for (const [rig, manifest] of rigs) {
    const bound = await rigOf(rig, manifest), game = new Game(bound.core, movesOn(bound.core.rest)), frames: number[][] = [], roots: Root[] = [];
    let hits = 0;
    for (const s of SCRIPT) for (let i = 0; i < s.n; i++) {
      hits += game.step(1 / 60, s.input).filter((e) => e.name === "hit").length;
      const p = game.placed(game.animator.pose().points);
      frames.push(p.points);
      roots.push(p.root);
    }
    const report = checks.measure(checks.motionOfFrames(frames, bound.core.rest, { root: roots, parts: true, id: `first-flight set on ${rig}` }));
    out.push({ rig, verdict: report.verdict, hits, fails: report.findings.filter((f) => f.level === "fail").map((f) => f.message), warns: report.findings.filter((f) => f.level === "warn").map((f) => f.message) });
  }
  writeFileSync(join(OUT, "set.json"), JSON.stringify({ about: `the first-flight session on G4's skeletons and the held-out rig of G4's ${h.run}, read by the sensors (PLAN.md §9.3)`, rigs: out }, null, 1));
  expect(out.map((o) => o.rig)).toEqual([...G4_RIGS, ...h.rigs]);
  for (const o of out) {
    expect(o.hits, o.rig).toBeGreaterThanOrEqual(1);
    expect(o.fails, o.rig).toEqual([]);
  }
});
