// e2e `gallery` (WP-8.1): the gallery built by Vite and opened headless on WebGL 2 at a phone's viewport (390x844,
// touch). Every set and every clip opens by link through the in-page router (`__m3a.open`, the bulk, so it stays within
// T2's budget), every example recipe compiles and plays and every example graph runs its script in 3D, entering the
// states graph.sim's trace lists and ending where its root went. A sample opens by real URL: one clip of each set, each
// with a view, a character, a moment and a rate of its own, and the recipes, graphs, search and fetched rigs: each
// frame drawn (the character's pixels read back from WebGL), the camera at the link's view (the sensors' angles), the
// build stamp shown, the panel's replies there (metrics with its findings, the sheet drawn at the view, the clip's
// describe and show, search's rows), the console handles there. The pose at a link's moment hashes as Node's, and a
// frame-stepped pose's link reopens it bit for bit; a frame either way, the scrub, play (twice as far at rate 2, on
// Playwright's clock) and pause move it; two opens not awaited in turn leave the stage on the second; a tap opens a
// panel and a finding's moment. Nothing can be done only in the gallery: every tool its actions list names is in the
// registry, on the page and in Node, a per-clip call names the tier opt-in, and the page's tools reply as Node's.
// Screenshots go to check-output/gallery/, never committed.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { build } from "vite";
import { Animator, playable, VERSION } from "../../packages/core/src/index.ts";
import { TIERS } from "../../packages/library/src/index.ts";
import { raster } from "../../packages/sensors/src/index.ts";
import { openLibrary } from "../../packages/library/src/node.ts";
import { poseHash } from "../../packages/three/src/capture/index.ts";
import { attach, bind } from "../../packages/three/src/index.ts";
import { character, loadGlb, variant } from "../../packages/three/test-characters/index.ts";
import { tools } from "../../packages/tools/src/index.ts";
import { nodeHost } from "../../packages/tools/src/node.ts";

const ROOT = join(import.meta.dirname, "../.."), SITE = join(ROOT, ".cache/gallery-site"), OUT = join(ROOT, "check-output/gallery"), ORIGIN = "http://localhost:4176";
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".glb": "model/gltf-binary" };
const VIEWS = ["three-quarter", "front", "side", "back", "top", "orbit"], PANELS = ["metrics", "sheet", "clip"];
const RIGS = ["quaternius-mannequin-m", "kaykit-knight"].filter((r) => existsSync(join(ROOT, `.cache/fixtures/${r}.glb`)));
const lib = openLibrary({ tiers: TIERS, warn: () => {} }), SETS = lib.sets();
const names = (dir: string) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json") && !f.endsWith(".trace.json")).map((f) => f.slice(0, -5)).sort();

type State = {
  route: Record<string, unknown>; link: string; error: string | null; problems: string[]; paused: boolean; backend: string;
  playing: { kind: string; id: string; dur: number; loop: boolean; frame: number; time: number; label: string; root: { forward: number; right: number; yaw: number } } | null;
  character: { id: string; bones: number } | null; panel: { name: string; replies: { tool: string; status: string; verdict: string }[] };
  camera: { view: string; azimuth: number; elevation: number };
};
type Reply = { tool: string; status: string; verdict: string; data: Record<string, unknown> | null };
type Handle = {
  ready: boolean; error?: string; stamp: string; state(): State; open(to: string | Record<string, unknown>): Promise<State>; play(): void; pause(): void; step(n?: number): State; seek(t: number): State;
  hash(): string; frame(): Promise<{ lit: number; backend: string }>; entered(): { t: number; layer: string; state: string; from: string | null }[] | null; replies(): Reply[]; actions(): { action: string; tool: string | null; call: string }[];
  tools: { list(): { name: string }[]; call(name: string, args?: object): Promise<unknown> };
};
type Win = { __m3a: Handle; __M3A_TOOLS__: Handle["tools"] };

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await build({ configFile: join(ROOT, "apps/gallery/vite.config.ts"), build: { outDir: SITE, emptyOutDir: true }, logLevel: "error" });
});
test.beforeEach(async ({ page }) => {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname)), file = join(SITE, path === "/" ? "index.html" : path);
    if (!file.startsWith(SITE) || !existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
});

/** Opens a link on WebGL 2 and waits for the handle; fails with the page's console when it reports an error. */
async function visit(page: Page, link: string): Promise<State> {
  const log: string[] = [];
  page.on("console", (m) => log.push(m.text()));
  page.on("pageerror", (e) => log.push(String(e)));
  await page.goto(`${ORIGIN}/${link}${link.includes("?") ? "&" : "?"}renderer=webgl2`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready !== undefined, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as Win).__m3a.error), log.join("\n")).toBeUndefined();
  const s = await page.evaluate(() => (window as unknown as Win).__m3a.state());
  expect([s.error, s.problems], `${link}: ${log.join("\n")}`).toEqual([null, []]);
  return s;
}

/** The bones' hash Node gives for clip `id` at time t on gen-<seed>, posed as the page's clip player poses it. */
async function nodeHash(id: string, seed: number, t: number): Promise<string> {
  const bound = bind((await loadGlb(character(variant(seed)).glb, { textures: false })).scene), { clip, rest } = lib.clip(id);
  const a = new Animator(bound.core).layer("base", { clip: playable(clip, rest), time: 0 });
  a.layer("base", { time: t });
  attach(a, bound).apply();
  return poseHash(bound.bones);
}

test("gallery: every set and every clip opens through the router; every recipe compiles and plays; every graph runs as graph.sim runs it", async ({ page }) => {
  // 11 sets, 1,398 clips, 20 recipes and 2 graphs in one page: about 60 s here
  test.setTimeout(420_000);
  await visit(page, "");
  // every set, of every tier, its catalog listed and its first clip playing
  for (const s of SETS) {
    const got = await page.evaluate(async (set) => {
      const st = await (window as unknown as Win).__m3a.open({ set, clip: null, recipe: null, graph: null, panel: "browse" });
      return { st, sets: document.querySelectorAll("#panel [data-set]").length, rows: document.querySelectorAll("#panel [data-clip]").length, tier: document.querySelector("#panel h3 .tier")?.textContent };
    }, s.set);
    expect([got.st.error, got.st.playing?.id, got.sets, got.rows, got.tier], s.set).toEqual([null, lib.catalog(s.set)[0]!.id, SETS.length, s.clips, s.tier]);
  }
  expect(new Set(SETS.map((s) => s.tier))).toEqual(new Set(["cc0", "cc-by", "cmu"]));
  // every clip, a set's in one call: it plays, as long as its catalog says
  let opened = 0;
  for (const s of SETS) {
    const rows = lib.catalog(s.set), got = await page.evaluate(async (ids) => {
      const out: { playing?: string; dur?: number; error: string | null }[] = [];
      for (const id of ids) {
        const st = await (window as unknown as Win).__m3a.open({ clip: id });
        out.push({ playing: st.playing?.id, dur: st.playing?.dur, error: st.error });
      }
      return out;
    }, rows.map((r) => r.id));
    expect(got).toEqual(rows.map((r) => ({ playing: r.id, dur: r.dur, error: null })));
    opened += got.length;
  }
  expect(opened).toBe(lib.catalog().length);
  // every example recipe compiled by recipe.compile and played
  for (const name of names("spec/recipes")) {
    const s = await page.evaluate(async (recipe) => (window as unknown as Win).__m3a.open({ recipe, clip: null, graph: null, panel: "recipes" }), name);
    expect([s.error, s.playing?.id, s.panel.replies.map((r) => [r.tool, r.status])], name).toEqual([null, `RECIPES/${name}`, [["recipe.compile", "ok"]]]);
  }
  // every example graph validated and simulated by the tools, and stepped through the same script on the stage: the
  // states it enters are the trace's
  for (const name of names("spec/graphs")) {
    const s = await page.evaluate(async (graph) => (window as unknown as Win).__m3a.open({ graph, clip: null, recipe: null, panel: "graphs" }), name);
    expect([s.error, s.playing?.kind, s.panel.replies.map((r) => r.tool)], name).toEqual([null, "graph", ["graph.validate", "graph.sim"]]);
    const run = await page.evaluate(async (dur) => {
      const h = (window as unknown as Win).__m3a;
      h.seek(dur);
      return { entered: h.entered()!, traced: Array.from(document.querySelectorAll("#panel [data-t]"), (b) => b.textContent), frame: await h.frame(), root: h.state().playing!.root, went: h.replies().find((r) => r.tool === "graph.sim")!.data!.went };
    }, s.playing!.dur);
    expect(run.traced.length, name).toBeGreaterThan(2);
    expect(run.traced, name).toEqual(run.entered.filter((e) => e.from !== null).slice(0, 20).map((e) => `${e.t.toFixed(3)} s ${e.layer}: ${e.state}`));
    // the stage's root ends where graph.sim's went (the same stepper, body and clips; to the mm graph.sim gives)
    expect({ forward: Math.round(run.root.forward), right: Math.round(run.root.right), yaw: Math.round(run.root.yaw) }, name).toEqual(run.went);
    expect(run.frame.lit, name).toBeGreaterThan(100);
    await page.screenshot({ path: join(OUT, `graph-${name}.png`) });
  }
});

test("gallery: a sample opens by real URL at a phone viewport, drawn, stamped, with its metrics and its console handles", async ({ page }) => {
  test.setTimeout(300_000);
  const chars = ["gen-0", "gen-3", "gen-7", "gen-12", ...RIGS];
  const sample = SETS.map((s, i) => {
    const rows = lib.catalog(s.set), r = rows[Math.floor(rows.length / 2)]!;
    return { link: `?clip=${r.id}&view=${VIEWS[i % VIEWS.length]}&char=${chars[i % chars.length]}&t=${Math.round(r.dur * 500) / 1000}&rate=0.5&panel=${PANELS[i % PANELS.length]}`, id: r.id };
  });
  const more = ["?recipe=Jab_Left&view=side", "?graph=Locomotion&t=4.6&panel=graphs", "?graph=Sword_Combo&view=front", "?set=STYLE100_IDLE", "?q=drinks+a+potion", ...RIGS.map((r) => `?char=${r}&clip=QUATERNIUS_3D2DGE/Walk_Loop&panel=metrics`)];
  for (const [i, x] of [...sample, ...more.map((link) => ({ link, id: null }))].entries()) {
    const s = await visit(page, x.link), want = new URLSearchParams(x.link);
    if (x.id) expect([s.playing?.id, s.route.view, s.route.char, s.route.rate, s.paused, s.playing?.time], x.link).toEqual([x.id, want.get("view"), want.get("char"), 0.5, true, Number(want.get("t"))]);
    for (const k of ["recipe", "graph", "set", "q"]) if (want.has(k)) expect(s.route[k], x.link).toBe(want.get(k));
    // the stage's camera at the link's view, at the sensors' angles for it (orbit starts at three-quarter; top's azimuth
    // is the camera's up, not where it stands)
    const view = want.get("view") ?? "three-quarter", angles = raster.VIEWS[view === "orbit" ? "three-quarter" : (view as raster.ViewName)];
    expect([s.camera.view, s.camera.elevation], x.link).toEqual([view, angles.pitch]);
    if (angles.pitch < 89) expect(s.camera.azimuth, x.link).toBe(angles.yaw);
    // the panel's replies: the sheet drawn at the link's view, the clip's describe and show, search's rows
    const replies = await page.evaluate(() => (window as unknown as Win).__m3a.replies()), told = replies.map((r) => [r.tool, r.status, r.verdict.split(":")[0]]);
    if (s.route.panel === "sheet") {
      expect([told, replies[0]?.data?.view], x.link).toEqual([[["sheet", "ok", `sheet ${x.id}`]], view === "orbit" ? "three-quarter" : view]);
      const picture = await page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>("#panel canvas.picture"), d = c?.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let inked = 0;
        for (let p = 0; d && p < d.length; p += 4) if (Math.abs(d[p]! - d[0]!) + Math.abs(d[p + 1]! - d[1]!) + Math.abs(d[p + 2]! - d[2]!) > 30) inked++;
        return { size: c ? [c.width, c.height] : null, inked };
      });
      expect([picture.size, picture.inked > 2000], x.link).toEqual([[replies[0]!.data!.width, replies[0]!.data!.height], true]);
    }
    if (s.route.panel === "clip") expect(told, x.link).toEqual([["describe", "ok", `describe ${x.id}`], ["show", "ok", `show ${x.id}`]]);
    if (want.has("q")) {
      expect(told, x.link).toEqual([["search", "ok", `search "${want.get("q")}"`]]);
      expect(await page.locator("#panel #results [data-clip]").count(), x.link).toBeGreaterThan(0);
    }
    // the browse panel links the review queue, the contributor page and the labs index (the site serves it)
    if (s.route.panel === "browse") expect(await page.locator("#panel a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), x.link).toEqual(["./src/review/", "./src/contributors/", "./labs/"]);
    // the link the page writes for what it shows opens the same route
    expect(new URLSearchParams(s.link).get("renderer"), x.link).toBe("webgl2");
    expect((await page.evaluate((l) => (window as unknown as Win).__m3a.open(l), s.link)).route, x.link).toEqual(s.route);
    // the frame is drawn: the character changes pixels on WebGL 2
    const f = await page.evaluate(() => (window as unknown as Win).__m3a.frame());
    expect([f.backend, f.lit > 150], x.link).toEqual(["webgl2", true]);
    // the stamp: the version and the commit, on every view
    await expect(page.locator("#stamp")).toHaveText(new RegExp(`^m3a ${VERSION.replace(/\./g, "\\.")} · [0-9a-f]{7,}$`));
    await expect(page.locator("#stamp")).toBeInViewport();
    // the console handles
    expect(await page.evaluate(() => [typeof (window as unknown as Win).__m3a.open, (window as unknown as Win).__M3A_TOOLS__.list().length]), x.link).toEqual(["function", tools.list().length]);
    await page.screenshot({ path: join(OUT, `${String(i).padStart(2, "0")}-${(x.id ?? x.link).replace(/[^\w]+/g, "_").slice(0, 60)}.png`) });
    // the metrics panel, for what a clip link plays
    if (x.id) {
      if (want.get("panel") !== "metrics") await page.evaluate(() => (window as unknown as Win).__m3a.open({ panel: "metrics" }));
      await expect(page.locator("#panel .reply[data-tool=metrics] .verdict")).toHaveText(new RegExp(`^metrics ${x.id}: (PASS|WARN|FAIL)`));
      const verdict = await page.locator("#panel .reply[data-tool=metrics] .verdict").textContent();
      if (!/PASS/.test(verdict!)) expect(await page.locator("#panel [data-t]").count(), x.link).toBeGreaterThan(0);
    }
  }
});

test("gallery: the console handle steps, scrubs, plays and hashes as Node; opens race; a tap opens a panel and a finding; nothing is done only in the gallery", async ({ page }) => {
  test.setTimeout(180_000);
  // Playwright's clock: real time flows until the rate check holds it and steps the frames itself
  await page.clock.install();
  const id = "QUATERNIUS_3D2DGE/Sword_Attack", walk = "QUATERNIUS_3D2DGE/Walk_Loop";
  await visit(page, `?clip=${id}&char=gen-7&t=0.6&view=side`);
  const h = <T>(f: string) => page.evaluate(`(() => { const h = window.__m3a; return ${f}; })()`) as Promise<T>;
  // two opens not awaited in turn (the first's set, CMU's 2.8 MB, still loading when the second shows): the stage plays
  // what the route and the link say, on the character they name, and the first resolves with the second's state
  const raced = await page.evaluate(async (w) => {
    const h = (window as unknown as Win).__m3a, first = h.open({ clip: "CMU_CURATED/Angry_Quarrel" }), second = h.open({ clip: w, char: "gen-3", t: 0.5 });
    const [a, b] = await Promise.all([first, second]);
    return { a, b, now: h.state(), hash: h.hash() };
  }, walk);
  expect([raced.now.playing?.id, raced.now.route.clip, new URLSearchParams(raced.now.link).get("clip"), raced.now.character?.id, raced.now.playing?.time]).toEqual([walk, walk, walk, "gen-3", 0.5]);
  expect(raced.a).toEqual(raced.b);
  expect(raced.hash).toBe(await nodeHash(walk, 3, 0.5));
  await h(`h.open("?clip=${id}&char=gen-7&t=0.6&view=side&renderer=webgl2")`);
  // the pose at the link's moment is Node's, bit for bit; a frame forward, two back and the scrub move it
  expect(await h<string>("h.hash()")).toBe(await nodeHash(id, 7, 0.6));
  const frame = (await h<State>("h.state()")).playing!.frame, stepped = await h<State>("h.step(1)");
  expect(stepped.playing!.time).toBeCloseTo(0.6 + frame, 6);
  // the moment a frame step shows is the link's, to the bit: Node's pose there, and the link reopens it
  const shown = await h<string>("h.hash()");
  expect(shown).toBe(await nodeHash(id, 7, stepped.playing!.time));
  await page.evaluate((l) => (window as unknown as Win).__m3a.open(l), stepped.link);
  expect(await h<string>("h.hash()"), stepped.link).toBe(shown);
  expect(new URLSearchParams(stepped.link).get("t")).toBe(String(stepped.playing!.time));
  expect((await h<State>("h.step(-2)")).playing!.time).toBeCloseTo(0.6 - frame, 6);
  expect((await h<State>("h.seek(0.25)")).playing!.time).toBeCloseTo(0.25, 6);
  expect(await h<string>("h.hash()")).toBe(await nodeHash(id, 7, 0.25));
  expect((await h<State>("h.state()")).link).toContain("t=0.25");
  // play moves it on at the route's rate: with the clock held, 0.32 s of frames stepped at rate 1, then at rate 2,
  // move it 0.32 s, then twice as far
  const time = async () => (await h<State>("h.state()")).playing!.time;
  const played = async (rate: number) => {
    await h(`h.open({ rate: ${rate} })`);
    // held while playing, then run a frame at a time until the frame loop's next frame comes, as the review page's e2e
    // holds it: a hold from a flowing clock can leave that frame due past the clock's now (holding twice didn't always
    // catch it up: in CI rate 1 once moved 0 s); from then on the loop runs on the held clock alone
    await h("h.play()");
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    const held = await time();
    let steps = 0;
    while ((await time()) === held && steps < 400) {
      await page.clock.runFor(16);
      steps++;
    }
    await h("h.seek(0.1)");
    // (a few frames paused first, so the frame loop's last frame is the clock's now)
    await page.clock.runFor(50);
    await h("h.play()");
    await page.clock.runFor(320);
    await h("h.pause()");
    await page.clock.resume();
    return { moved: Math.round(((await time()) - 0.1) * 1e6) / 1e6, steps };
  };
  const [once, twice] = [await played(1), await played(2)];
  expect([Math.abs(once.moved - 0.32) < 0.04, Math.abs(twice.moved / once.moved - 2) < 0.15], `rate 1: ${once.moved} s, rate 2: ${twice.moved} s (each loop's next frame ${once.steps} and ${twice.steps} frames after its hold)`).toEqual([true, true]);
  // pause holds it and writes the moment into the link
  const held = await h<State>("h.state()");
  expect([held.paused, held.route.rate, new URLSearchParams(held.link).get("t")]).toEqual([true, 2, String(held.playing!.time)]);
  // touch: tapping the Metrics tab opens the panel; tapping a finding goes to its moment
  await h("h.open({ clip: 'QUATERNIUS_3D2DGE/Walk_Loop', t: 0 })");
  await page.locator("#tabs [data-panel=metrics]").tap();
  await expect(page.locator("#panel .reply[data-tool=metrics] .verdict")).toHaveText(/^metrics QUATERNIUS_3D2DGE\/Walk_Loop: (WARN|FAIL)/);
  const finding = page.locator("#panel [data-t]").first(), t0 = Number(await finding.getAttribute("data-t"));
  await finding.tap();
  expect((await h<State>("h.state()")).playing!.time).toBeCloseTo(t0, 6);
  await page.screenshot({ path: join(OUT, "finding.png") });
  // the page's tools reply as Node's (a CC0 clip, as the Node host's default tiers see it)
  const args = { clip: "QUATERNIUS_3D2DGE/Walk_Loop" };
  const viaPage = await page.evaluate((a) => (window as unknown as Win).__M3A_TOOLS__.call("metrics", a), args);
  expect(viaPage).toEqual(await tools.call("metrics", args, { host: nodeHost(ROOT) }));
  // nothing only in the gallery: each action names a tool in the registry, here and in Node, or a command; a call on a
  // clip says what the CLI needs for a cc-by or cmu clip, which the gallery opens at every tier
  const actions = await h<{ action: string; tool: string | null; call: string }[]>("h.actions()"), listed = await page.evaluate(() => (window as unknown as Win).__M3A_TOOLS__.list().map((t) => t.name));
  expect(actions.length).toBeGreaterThan(10);
  for (const a of actions) {
    expect(a.call.length, a.action).toBeGreaterThan(5);
    if (/<(the state's )?SET\/Name>/.test(a.call)) expect(a.call, a.action).toContain('add its tier to "tiers" in game.json');
    if (a.tool === null) continue;
    expect(listed, a.action).toContain(a.tool);
    expect(tools.get(a.tool), a.action).toBeDefined();
  }
  expect(listed).toEqual(tools.list().map((t) => t.name));
});
