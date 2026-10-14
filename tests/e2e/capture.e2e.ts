// e2e `capture` (WP-4.5): a bound character played by an Animator, drawn headless in Chromium through WebGPURenderer
// on its WebGL 2 backend, each frame read back and checked not blank; the proof hash of the bone transforms at every
// frame equals Node's for the same play; each rig's frames written as a sheet (check-output/capture/, CI's artifact).
// G4's six skeletons, a toeless test character and the held-out rig of G4's latest run (real rigs once fetched); a blank
// frame and a renderer other than the one asked for fail loudly with their reason. The page runs the packages' own
// TypeScript, served with its types stripped.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join, normalize } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Animator, type Clip } from "../../packages/core/src/index.ts";
import { raster } from "../../packages/sensors/src/index.ts";
import { writePng } from "../../packages/sensors/src/node.ts";
import { attach, bind } from "../../packages/three/src/index.ts";
import { poseHash } from "../../packages/three/src/capture/hash.ts";
import { character, loadGlb, variant } from "../../packages/three/test-characters/index.ts";
import { libraryClips } from "../../tools/qa/qa.ts";
import { heldout } from "../../tools/sweep/sweep.ts";

const ROOT = join(import.meta.dirname, "../.."), ORIGIN = "http://localhost:4174", THREE = join(ROOT, "node_modules/three");
const IMPORTS = { three: "/three/build/three.module.js", "three/webgpu": "/three/build/three.webgpu.js", "three/tsl": "/three/build/three.tsl.js", "three/addons/": "/three/examples/jsm/", "@m3a/core": "/packages/core/src/index.ts", "@m3a/three": "/packages/three/src/index.ts", "@m3a/three/capture": "/packages/three/src/capture/index.ts" };
const PAGE = `<!doctype html><title>capture</title><script type="importmap">${JSON.stringify({ imports: IMPORTS })}</script><script type="module">window.ready = true;</script>`;
const walk = libraryClips().find((c) => c.clip.id === "QUATERNIUS_3D2DGE/Walk_Loop")!.clip as Clip;
const FRAMES = 8, EVERY = 0.1;

test.use({ launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-unsafe-webgpu", "--enable-features=Vulkan"] } });
test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname));
    if (path === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
    if (/^\/three\/(build|examples\/jsm)\/[\w/.-]+\.js$/.test(path)) return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(THREE, path.slice(7)), "utf8") });
    if (/^\/packages\/(core|three)\/(src|test-characters)\/[\w/.-]+\.ts$/.test(path)) return route.fulfill({ contentType: "text/javascript", body: stripTypeScriptTypes(readFileSync(join(ROOT, path), "utf8")) });
    const fixture = /^\/fixtures\/([\w-]+)\.glb$/.exec(path);
    if (fixture && existsSync(join(ROOT, ".cache/fixtures", `${fixture[1]}.glb`))) return route.fulfill({ contentType: "model/gltf-binary", body: readFileSync(join(ROOT, ".cache/fixtures", `${fixture[1]}.glb`)) });
    return route.fulfill({ status: 404, body: "not served" });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
});

type Got = { backend: string; width: number; height: number; frames: { t: number; hash: string; lit: number; rgba: string }[] } | { error: string; code?: string };
/** Captures a rig in the page: a generated one ("gen-<seed>") or a fetched real one. */
async function shoot(page: Page, rig: string, opts: Record<string, unknown> = {}): Promise<Got> {
  return page.evaluate(
    async ([rig, clip, opts]) => {
      try {
        // through the page's import map (variables, so the test's own type check doesn't resolve them)
        const urls = ["/packages/three/test-characters/index.ts", "@m3a/three", "@m3a/three/capture", "@m3a/core"];
        const [tc, m3a, cap, core] = await Promise.all(urls.map((u) => import(u)));
        const bytes = rig.startsWith("gen-") ? tc.character(tc.variant(Number(rig.slice(4)))).glb : new Uint8Array(await (await fetch(`/fixtures/${rig}.glb`)).arrayBuffer());
        const b = m3a.bind((await tc.loadGlb(bytes)).scene), a = new core.Animator(b.core).layer("base", { clip });
        const c = await cap.capture(a, b, opts);
        const b64 = (u: Uint8Array) => {
          let s = "";
          for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
          return btoa(s);
        };
        return { backend: c.backend, width: c.width, height: c.height, frames: c.frames.map((f: { t: number; hash: string; lit: number; rgba: Uint8Array }) => ({ t: f.t, hash: f.hash, lit: f.lit, rgba: b64(f.rgba) })) };
      } catch (err) {
        return { error: String((err as Error).message), code: (err as { code?: string }).code };
      }
    },
    [rig, walk, { frames: FRAMES, every: EVERY, ...opts }] as const,
  ) as Promise<Got>;
}
/** The same play in Node: each frame's proof hash. */
async function nodeHashes(rig: string): Promise<string[]> {
  const bytes = rig.startsWith("gen-") ? character(variant(Number(rig.slice(4)))).glb : new Uint8Array(readFileSync(join(ROOT, ".cache/fixtures", `${rig}.glb`)));
  const b = bind((await loadGlb(bytes, { textures: false })).scene), att = attach(new Animator(b.core).layer("base", { clip: walk }), b), out: string[] = [];
  for (let i = 0; i < FRAMES; i++) {
    if (i) att.update(EVERY, { lod: 1 });
    else att.apply({ lod: 1 });
    out.push(poseHash(b.bones));
  }
  return out;
}

/** G4's skeletons (PLAN.md §9.3) and a toeless test character, then the held-out rig of the gate's latest run. */
const RIGS = ["gen-0", "gen-1", "gen-2", "gen-3", "gen-7", "quaternius-mannequin-m", "kaykit-knight"];
try {
  RIGS.push(...heldout("G4").rigs);
} catch {
  // no held-out run recorded yet
}
for (const rig of RIGS) {
  test(`capture ${rig}: frames drawn on WebGL 2, not blank, the pose hashes Node's, written as a sheet`, async ({ page }) => {
    test.skip(!rig.startsWith("gen-") && !existsSync(join(ROOT, ".cache/fixtures", `${rig}.glb`)), `${rig} isn't fetched: npm run fixtures -- fetch`);
    const got = await shoot(page, rig);
    if ("error" in got) throw new Error(got.error);
    expect(got.backend).toBe("webgl2");
    expect(got.frames).toHaveLength(FRAMES);
    expect(got.frames.map((f) => f.hash), "the bones' transforms, bit for bit as in Node").toEqual(await nodeHashes(rig));
    // the sheet: the frames side by side
    const imgs = got.frames.map((f) => ({ width: got.width, height: got.height, data: new Uint8ClampedArray(Buffer.from(f.rgba, "base64")) }));
    const sheet = raster.join(imgs, { gap: 2 });
    raster.assertNotBlank(sheet, `${rig}'s sheet`, [imgs[0]!.data[0]!, imgs[0]!.data[1]!, imgs[0]!.data[2]!]);
    for (const f of got.frames) expect(f.lit / (got.width * got.height), "the character covers part of each frame, not all of it").toBeLessThan(0.6);
    mkdirSync(join(ROOT, "check-output/capture"), { recursive: true });
    const bytes = writePng(join(ROOT, "check-output/capture", `${rig}.png`), sheet);
    console.log(`capture ${rig}: ${got.frames.length} frames ${got.width} × ${got.height} on ${got.backend}, lit ${got.frames.map((f) => f.lit).join("/")}, hashes match Node's; sheet ${sheet.width} × ${sheet.height} (${bytes} bytes)`);
  });
}

test("capture fails loudly on a blank frame, and on a renderer other than the one asked for", async ({ page }) => {
  const blank = await shoot(page, "gen-2", { lookAway: true });
  expect(blank).toMatchObject({ code: "E_BLANK", error: expect.stringMatching(/^capture: frame 0 \(t 0\.00 s\) is blank: \d+ of 32000 pixels differ from the background/) });
  // WebGPU asked for where the browser has no adapter: WebGPURenderer falls back to WebGL 2, and the capture refuses it
  const ctx = await page.evaluate(async () => !!(navigator.gpu && (await navigator.gpu.requestAdapter())));
  if (ctx) {
    await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined }));
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
  }
  const fell = await shoot(page, "gen-2", { backend: "webgpu" });
  expect(fell).toMatchObject({ code: "E_RENDERER", error: "capture: asked for webgpu, the renderer fell back to webgl2: frames from another renderer aren't this capture's" });
});
