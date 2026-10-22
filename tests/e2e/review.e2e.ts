// e2e `review` (WP-8.2b): a scratch checkout (one library set, its lock, the feedback log; packages/tools/test/
// review-helpers.ts) and its local store with planted submissions (two clips that improve a library clip, a recipe, and
// one still being checked), its queue exported with `m3a review export`; the gallery built by Vite and its review page
// opened headless at a phone's viewport (390x844, touch) on that file. Every row's pictures are drawn by the tools on
// the page; decisions are made by touch (one by one, a batch, a toggle), kept across a reload, and exported through the
// share sheet (and as a download, the same bytes). `m3a review ingest` applies the file to the scratch store and the
// scratch copy of the clips: the right states and files change; again, no byte changes; a queued clip edited through
// the writer, then ingested: refused as stale, no byte changes. Each card plays its clip in place (WP-F.11), by touch at
// that viewport on WebGL 2: a sampled clip's, a submitted clip's and a compiled recipe's, on the gallery's stage, its
// canvas's frames changing as Playwright's clock runs and the clip's time going on by as much; one card at a time on
// one stage (one WebGL context): starting another stops the first, Stop takes it out (the page then draws no frame,
// three's own loop included), and playing decides nothing. Each card's gallery link is the gallery's own route for its
// clip (a submission's: the clip it improves), and opens it in a new tab, playing. A build bundles a queue only when
// M3A_REVIEW_QUEUE asks, and its page opens that one at load, or the batch a link names (?queue=NAME); a build that
// names no batches (M3A_REVIEW_BATCHES unset, as `npm run gallery` at a desk) carries the committed batches of library
// clips alone, the newest of each gate (G8's), and one asked for none (`none`, the review page's other builds here)
// carries none; opening a queue at load decides nothing. The contributor
// page says the hosted store isn't linked, reaches no other origin and carries no secret, and a build given a secret
// key fails; built linked to a stub project, it signs in, adds a key's SHA-256 and revokes it. Screenshots go to
// check-output/review/, never committed.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { build } from "vite";
import { serialize, type Clip } from "../../packages/core/src/index.ts";
import type { Queue, ReviewFile } from "../../packages/tools/src/intake/index.ts";
import { nodeReviewHost } from "../../packages/tools/src/node/intake.ts";
import { Registry } from "../../packages/tools/src/registry/index.ts";
import { REVIEW } from "../../packages/tools/src/tools/index.ts";
import { QUEUE_FILE } from "../../packages/tools/src/tools/review.ts";
import { checkout, libraryClip, ROOT, SET, TODAY, type Checkout } from "../../packages/tools/test/review-helpers.ts";

const SITE = join(ROOT, ".cache/review-site"), LINKED = join(ROOT, ".cache/review-site-linked"), OUT = join(ROOT, "check-output/review");
const ORIGIN = "http://localhost:4177", TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
const PAGE = "/src/review/", CONTRIBUTORS = "/src/contributors/";

type Row = { id: string; ref: string; as: string | null; note: string };
type Playing = { id: string; clip: string; time: number; dur: number; loop: boolean; backend: string; stages: number };
type State = {
  source: string; batch: string | null; batches: string[]; problem: string; error: string | null; submissions: Row[]; clips: Row[]; selected: string[]; decided: number; pictures: number;
  playing: string | null; player: Playing | null; playError: string | null; said: string;
};
type Handle = {
  ready: boolean; state(): State; drawn(): Promise<number>; commands(): string[]; export(how?: string): Promise<{ how: string; name: string; text: string }>; actions(): { tool: string | null }[];
  frame(): Promise<{ lit: number; backend: string } | null>; review(): { decisions: unknown[] } | null;
};
type Win = { __m3a: Handle; __shared?: { name: string; text: string }; __M3A_TOOLS__: { list(): { name: string }[] } };

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.describe.configure({ mode: "serial" });

let co: Checkout, q: Queue;
const reg = new Registry(REVIEW), review = (args: object) => reg.call("review", args, { host: co.host });
/** Walk_Loop with its head turned `deg` more at every key: an improvement's motion. */
const walk = (deg: number): Clip => ((c) => ({ ...c, keys: c.keys.map((k) => ({ ...k, head: (k as unknown as { head: number[] }).head.map((v, i) => (i === 0 ? v + deg : v)) })) }) as Clip)(libraryClip(`${SET}/Walk_Loop`));

/** Serves `site` at ORIGIN (a directory's index.html for a path ending in /), and a stub at /stub/ when given one, to
 *  a page, or to every page of a context (a tab the page opens too). */
async function serve(page: Page | BrowserContext, site: string, stub?: (path: string, method: string, body: string, headers: Record<string, string>) => { status: number; json?: unknown; html?: string }) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url()), path = normalize(decodeURIComponent(url.pathname));
    if (stub && path.startsWith("/stub/")) {
      const r = stub(`${path.slice(5)}${url.search}`, route.request().method(), route.request().postData() ?? "", route.request().headers());
      return route.fulfill({ status: r.status, contentType: r.html ? "text/html" : "application/json", body: r.html ?? (r.json === undefined ? "" : JSON.stringify(r.json)) });
    }
    const file = join(site, path.endsWith("/") ? `${path}index.html` : path);
    if (!file.startsWith(site) || !existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  });
}

/** Opens a page and waits for its handle; fails with the page's console when it reports an error. */
async function visit(page: Page, path: string): Promise<string[]> {
  const log: string[] = [];
  page.on("console", (m) => log.push(m.text()));
  page.on("pageerror", (e) => log.push(String(e)));
  await page.goto(`${ORIGIN}${path}`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready, undefined, { timeout: 60_000 });
  return log;
}

const state = (page: Page) => page.evaluate(() => (window as unknown as Win).__m3a.state());
const card = (page: Page, id: string) => page.locator(`article.card[data-id="${id}"]`);
/** The scratch checkout's files a review may change: the lock, the docs, the set's files and the store's records. */
const files = () => Object.fromEntries(["library/sets.lock.json", ...["FEEDBACK-LOG.md", "REVIEW-PROPOSALS.md"].filter((f) => existsSync(join(co.cwd, "docs", f))).map((f) => `docs/${f}`), ...readdirSync(join(co.cwd, "library/sets", SET)).map((f) => `library/sets/${SET}/${f}`), ...readdirSync(join(co.cwd, ".cache/intake")).filter((f) => f.endsWith(".json")).map((f) => `.cache/intake/${f}`)].map((f) => [f, co.file(f)]));

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  co = checkout();
  const checker = co.store("checker"), sent = [
    await co.store("contributor", "alice").submit({ kind: "clip", text: serialize(walk(2)), improves: `${SET}/Walk_Loop` }),
    await co.store("contributor", "alice").submit({ kind: "clip", text: serialize({ ...walk(0), desc: "walks, kept as it is" }), improves: `${SET}/Walk_Loop` }),
    await co.store("contributor", "bob").submit({ kind: "recipe", text: readFileSync(join(ROOT, "spec/recipes/Idle_Look_Left.json"), "utf8") }),
    await co.store("contributor", "carol").submit({ kind: "clip", text: serialize(walk(4)) }),
  ];
  for (const [i, s] of sent.entries()) {
    await checker.advance(s.id, "checking");
    if (i < 3) await checker.advance(s.id, "awaiting review", { report: { gates: "pass", checked: i } });
  }
  expect((await review({ do: "export" })).status).toBe("ok");
  q = JSON.parse(co.file(QUEUE_FILE)) as Queue;
  expect([q.submissions.length, q.clips.length, q.submissions.map((s) => s.contributor)]).toEqual([3, 20, expect.arrayContaining(["alice", "alice", "bob"])]);
  // built asking for no batch: the page opens nothing at load, and these tests open the scratch queue's file
  process.env.M3A_REVIEW_BATCHES = "none";
  try {
    await build({ configFile: join(ROOT, "apps/gallery/vite.config.ts"), build: { outDir: SITE, emptyOutDir: true }, logLevel: "error" });
  } finally {
    delete process.env.M3A_REVIEW_BATCHES;
  }
});
test.afterAll(() => co?.rm());

test("review: a review made by touch at a phone viewport changes the right states and files, twice is no change, a changed clip is stale", async ({ page }) => {
  test.setTimeout(240_000);
  // the share sheet, stubbed: a file shared lands in window.__shared (and window.__share = false says it can't share)
  await page.addInitScript({ content: "Object.assign(navigator, { canShare: (d) => window.__share !== false && !!(d.files && d.files.length), share: async (d) => { window.__shared = { name: d.files[0].name, text: await d.files[0].text() }; } });" });
  await serve(page, SITE);
  const log = await visit(page, PAGE), queueFile = join(co.cwd, QUEUE_FILE);
  await page.setInputFiles("#file", queueFile);
  await page.waitForFunction(() => (window as unknown as Win).__m3a.state().source === "queue.json");
  expect(await page.evaluate(() => (window as unknown as Win).__m3a.drawn()), log.join("\n")).toBe(23);
  const s0 = await state(page);
  expect([s0.error, s0.submissions.length, s0.clips.length, s0.pictures]).toEqual([null, 3, 20, 25]); // 3 sheets, 2 diffs, 20 sheets (G8's batch)
  const captions = await page.locator("figcaption").allTextContents();
  expect(captions.filter((c) => c.startsWith("preview sheet: sheet "))).toHaveLength(23);
  expect(captions.filter((c) => c.startsWith(`against ${SET}/Walk_Loop: diff `))).toHaveLength(2);
  expect(await page.evaluate(() => { // the first sheet is drawn: many pixels unlike its corner
    const c = document.querySelector("canvas")!, d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++;
    return n;
  })).toBeGreaterThan(1000);
  await expect(card(page, q.submissions.find((x) => x.diff)!.id).locator(".diff")).toContainText(`improves ${SET}/Walk_Loop`);
  await expect(card(page, q.submissions.find((x) => x.kind === "recipe")!.id).locator(".nums")).toContainText("unmeasured");
  for (const a of await page.evaluate(() => (window as unknown as Win).__m3a.actions())) if (a.tool) expect(await page.evaluate(() => (window as unknown as Win).__M3A_TOOLS__.list().map((t) => t.name))).toContain(a.tool);

  // decisions by touch: one at a time, a batch for each section, a toggle
  const [sub, other, rec] = [q.submissions.find((x) => x.diff && x.diff.max > 0)!, q.submissions.find((x) => x.diff?.max === 0)!, q.submissions.find((x) => x.kind === "recipe")!], flagged = q.clips[3]!;
  await card(page, sub.id).locator('[data-as="adopt"]').tap();
  await card(page, sub.id).locator("textarea").fill("foot contact: the head turn reads better");
  await card(page, other.id).locator('[data-as="reject"]').tap();
  await card(page, other.id).locator("textarea").fill("no change to the motion");
  await card(page, rec.id).locator("[data-select]").tap();
  await page.locator('[data-batch-note="submission"]').fill("a recipe: WP-9.1 compiles it");
  await page.locator('[data-batch="archive"]').tap();
  await page.locator('[data-all="clip"]').tap();
  await card(page, flagged.id).locator("[data-select]").tap();
  expect((await state(page)).selected).toHaveLength(19);
  await page.locator('[data-batch-note="clip"]').fill("clean");
  await page.locator('[data-batch="approve"]').tap();
  await card(page, flagged.id).locator('[data-as="flag"]').tap();
  await card(page, flagged.id).locator("textarea").fill("threshold: its jitter passes but reads");
  await card(page, q.clips[7]!.id).locator('[data-as="approve"]').tap(); // a second tap clears it
  expect((await state(page)).clips[7]!.as).toBeNull();
  await card(page, q.clips[7]!.id).locator('[data-as="approve"]').tap();
  const s1 = await state(page), by = (id: string) => [...s1.submissions, ...s1.clips].find((r) => r.id === id)!;
  expect([s1.decided, s1.selected, by(sub.id).as, by(other.id).as, by(rec.id).as, by(flagged.id).as, by(q.clips[0]!.id)]).toEqual([23, [], "adopt", "reject", "archive", "flag", { id: q.clips[0]!.id, ref: q.clips[0]!.ref, as: "approve", note: "clean" }]);

  // exported through the share sheet, and as a download: the same bytes
  await page.locator("#export").tap();
  await page.waitForFunction(() => (window as unknown as Win).__m3a.state().said !== "");
  expect((await state(page)).said).toMatch(/^review-\d{4}-\d{2}-\d{2}\.json shared: 23 decisions; apply it with m3a review ingest /);
  const shared = (await page.evaluate(() => (window as unknown as Win).__shared))!, got = JSON.parse(shared.text) as ReviewFile;
  await page.evaluate(() => ((window as unknown as { __share: boolean }).__share = false));
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export").tap()]);
  expect(readFileSync((await download.path())!, "utf8")).toBe(shared.text);
  expect([got.schema, shared.name, got.decisions.length]).toEqual(["m3a.review/1", `review-${got.date}.json`, 23]);
  for (const d of got.decisions) expect(d.hash).toBe([...q.submissions, ...q.clips].find((r) => r.id === d.id)!.hash);
  const commands = await page.evaluate(() => (window as unknown as Win).__m3a.commands());
  expect(commands).toContain(`m3a review approve ${q.clips.filter((c) => c.id !== flagged.id).map((c) => c.ref).join(",")} --note clean`);
  expect(commands).toContain(`m3a review flag ${flagged.ref} --note 'threshold: its jitter passes but reads'`);
  await page.screenshot({ path: join(OUT, "review-phone.png"), fullPage: true });

  // kept on the page: a reload and the same queue opened again bring them back (after the export: Chromium drops the
  // touch emulation on a reload)
  await page.reload();
  await page.waitForFunction(() => (window as unknown as Win).__m3a?.ready);
  await page.setInputFiles("#file", queueFile);
  await page.waitForFunction(() => (window as unknown as Win).__m3a.state().source === "queue.json");
  const s2 = await state(page);
  expect([...s2.submissions, ...s2.clips]).toEqual([...s1.submissions, ...s1.clips]);

  // ingested: the right states and files change
  writeFileSync(join(co.cwd, "review.json"), shared.text);
  const catalog = co.file(`library/sets/${SET}/catalog.tsv`), lock0 = co.file("library/sets.lock.json"), r1 = await review({ do: "ingest", on: "review.json" });
  expect(r1.verdict).toMatch(/^review ingest: 23 decisions, 23 applied, 0 already, 0 stale, 0 refused; \d+ notes in docs\/FEEDBACK-LOG\.md \(F\d+\), 2 proposals in docs\/REVIEW-PROPOSALS\.md$/);
  const owner = co.store("owner"), now = async (id: string) => (await owner.get(id))!;
  expect([(await now(sub.id)).state, (await now(sub.id)).decision, (await now(other.id)).state, (await now(rec.id)).state]).toEqual(["adopted", { as: "adopt", hash: sub.hash, note: "foot contact: the head turn reads better", by: "owner", date: got.date }, "rejected", "archived"]);
  const clip = (id: string) => (JSON.parse(co.file(`library/sets/${id}.json`)) as Clip).review;
  expect([clip(q.clips[0]!.id), clip(flagged.id)]).toEqual([{ state: "approved", by: "owner", date: got.date, motion: q.clips[0]!.hash, note: "clean" }, { state: "flagged", by: "owner", date: got.date, motion: flagged.hash, note: "threshold: its jitter passes but reads" }]);
  expect([co.file(`library/sets/${SET}/catalog.tsv`) === catalog, co.file("library/sets.lock.json") === lock0]).toEqual([true, false]);
  expect(co.file("docs/FEEDBACK-LOG.md")).toContain(`\`${sub.ref}\` adopted: the head turn reads better`);
  expect(co.file("docs/REVIEW-PROPOSALS.md")).toContain(`threshold · \`${flagged.ref}\`: its jitter passes but reads`);

  // again: nothing changes
  const before = files(), r2 = await review({ do: "ingest", on: "review.json" });
  expect([r2.verdict, files()]).toEqual(["review ingest: 23 decisions, 0 applied, 23 already, 0 stale, 0 refused", before]);

  // a queued clip edited (through the writer), then the review ingested: refused as stale, nothing written
  const host = nodeReviewHost(co.cwd, { today: () => TODAY }), edited = JSON.parse(co.file(`library/sets/${q.clips[0]!.id}.json`)) as Clip;
  host.writeClips(SET, [{ ...edited, keys: walk(5).keys.slice(0, 2).map((k, i) => ({ ...k, t: i * 0.1 })), dur: 0.2 } as Clip]);
  const changed = files(), r3 = await review({ do: "ingest", on: "review.json" }), o = (r3.data as { outcomes: { id: string; outcome: string; why?: string }[] }).outcomes;
  expect([r3.status, r3.verdict, files()]).toEqual(["findings", "review ingest: 23 decisions, 0 applied, 22 already, 1 stale, 0 refused", changed]);
  expect(o.find((x) => x.outcome === "stale")).toEqual({ id: q.clips[0]!.id, as: "approve", outcome: "stale", why: expect.stringMatching(/'s motion changed since it was queued \(made on [0-9a-f]{12}, it is [0-9a-f]{12} now\)/) });
  expect(log.filter((l) => /error/i.test(l))).toEqual([]);
});

/** How many pixels differ (by more than 30 in their summed channels) between two screenshots of the same element. */
const changed = (page: Page, a: Buffer, b: Buffer) =>
  page.evaluate(async ([x, y]) => {
    const px = async (b64: string) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()), c = new OffscreenCanvas(img.width, img.height), g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height).data;
    };
    const [p, q] = [await px(x!), await px(y!)];
    let n = 0;
    for (let i = 0; i < Math.min(p.length, q.length); i += 4) if (Math.abs(p[i]! - q[i]!) + Math.abs(p[i + 1]! - q[i + 1]!) + Math.abs(p[i + 2]! - q[i + 2]!) > 30) n++;
    return n;
  }, [a.toString("base64"), b.toString("base64")]);

test("play: each card plays its clip in place by touch, one card at a time on one stage; its gallery link opens the clip there", async ({ page, context }) => {
  test.setTimeout(240_000);
  await serve(context, SITE);
  // Playwright's clock: real time flows until the motion check holds it and runs the frames itself
  await page.clock.install();
  const log = await visit(page, `${PAGE}?renderer=webgl2`);
  await page.setInputFiles("#file", join(co.cwd, QUEUE_FILE));
  await page.waitForFunction(() => (window as unknown as Win).__m3a.state().source === "queue.json");
  expect(await page.evaluate(() => (window as unknown as Win).__m3a.drawn())).toBe(23);
  const lib = q.clips.find((c) => /Walk|Run/.test(c.id)) ?? q.clips[0]!, sub = q.submissions.find((x) => x.diff && x.diff.max > 0)!, rec = q.submissions.find((x) => x.kind === "recipe")!;
  const stageIn = (id: string) => card(page, id).locator(".stage canvas"), playOf = (id: string) => card(page, id).locator("[data-play]");
  const playing = (id: string) => page.waitForFunction((x) => (window as unknown as Win).__m3a.state().player?.id === x, id, { timeout: 60_000 });

  // a sampled clip plays in its card, on WebGL 2, the character drawn
  await playOf(lib.id).tap();
  await playing(lib.id);
  await expect(playOf(lib.id)).toHaveText("Stop");
  await expect(playOf(lib.id)).toHaveAttribute("aria-pressed", "true");
  expect([await stageIn(lib.id).count(), await page.locator(".stage canvas").count(), await page.locator("#queue canvas.picture").count()]).toEqual([1, 1, 25]);
  const first = (await state(page)).player!, f = (await page.evaluate(() => (window as unknown as Win).__m3a.frame()))!;
  expect([first.clip, first.backend, first.stages, first.loop, f.backend, f.lit > 150]).toEqual([lib.id, "webgl2", 1, expect.any(Boolean), "webgl2", true]);

  // it moves: the canvas's frames change as the clock runs, and the clip's time goes on by as much (a loop wrapping);
  // held, then run a frame at a time until the loop's next frame comes: a hold from a flowing clock can leave it due
  // past the clock's now (as the gallery's e2e found); from then on the loop runs on the held clock alone
  const time = async () => (await state(page)).player!.time;
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  const held = await time();
  let steps = 0;
  while ((await time()) === held && steps < 400) {
    await page.clock.runFor(16);
    steps++;
  }
  await page.clock.runFor(50);
  const [shotA, tA] = [await stageIn(lib.id).screenshot(), await time()];
  await page.clock.runFor(400);
  const [shotB, tB] = [await stageIn(lib.id).screenshot(), await time()];
  await page.clock.resume();
  const went = (((tB - tA) % first.dur) + first.dur) % first.dur;
  expect(Math.abs(went - (0.4 % first.dur)), `${tA} → ${tB} of ${first.dur} s, its next frame ${steps} frames after the hold`).toBeLessThan(0.05);
  expect(await changed(page, shotA, shotB)).toBeGreaterThan(200);
  await page.screenshot({ path: join(OUT, "review-playing.png") });

  // another card plays: the first stops, the same one stage moves (one WebGL context); a submitted clip, then a recipe
  for (const [r, clip] of [[sub, `${SET}/Walk_Loop`], [rec, null]] as const) {
    await playOf(r.id).tap();
    await playing(r.id);
    const s = await state(page);
    expect([s.player!.stages, s.playError, await page.locator(".stage canvas").count(), await stageIn(r.id).count(), await stageIn(lib.id).count(), await playOf(lib.id).textContent()]).toEqual([1, null, 1, 1, 0, "Play"]);
    if (clip) expect(s.player!.clip).toBe(clip);
  }
  // a second tap stops it: no stage in any card; and playing decided nothing
  // (every requestAnimationFrame counted from here on the held clock: the card's loop and three's own call it each frame)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await page.evaluate(() => {
    const w = window as unknown as { __rafs: number }, raf = window.requestAnimationFrame.bind(window);
    w.__rafs = 0;
    window.requestAnimationFrame = (cb) => (w.__rafs++, raf(cb));
  });
  const rafs = async (ms: number) => {
    await page.evaluate(() => ((window as unknown as { __rafs: number }).__rafs = 0));
    await page.clock.runFor(ms);
    return page.evaluate(() => (window as unknown as { __rafs: number }).__rafs);
  };
  const whilePlaying = await rafs(1000);
  await playOf(rec.id).tap();
  const s1 = await state(page);
  expect([s1.playing, s1.player, await page.locator(".stage").count(), await playOf(rec.id).getAttribute("aria-pressed"), s1.decided, await page.evaluate(() => (window as unknown as Win).__m3a.review()!.decisions.length)]).toEqual([null, null, 0, "false", 0, 0]);
  // stopped, the page draws no frame: not the card's loop, not three's (r182 runs one from init until dispose)
  expect([whilePlaying > 0, await rafs(1000)], `requestAnimationFrame calls: ${whilePlaying} in 1 s playing`).toEqual([true, 0]);
  await page.clock.resume();
  // and plays again when asked, on the same stage, moving: its loops started again
  await playOf(lib.id).tap();
  await playing(lib.id);
  expect([(await state(page)).player!.stages, await stageIn(lib.id).count()]).toEqual([1, 1]);
  const [again, t0] = [await stageIn(lib.id).screenshot(), await time()];
  await page.waitForFunction((t) => Math.abs((window as unknown as Win).__m3a.state().player!.time - t) > 0.3, t0, { timeout: 30_000 });
  expect(await changed(page, again, await stageIn(lib.id).screenshot())).toBeGreaterThan(200);
  await playOf(lib.id).tap();

  // each card's gallery link is the gallery's route for its clip (a submission's: the clip it improves; a recipe has none)
  const link = (id: string) => card(page, id).locator("a[data-gallery]");
  expect([await link(rec.id).count(), await link(lib.id).getAttribute("target")]).toEqual([0, "_blank"]);
  for (const [id, clip] of [[lib.id, lib.id], [sub.id, `${SET}/Walk_Loop`]]) {
    const href = await link(id!).evaluate((a) => (a as HTMLAnchorElement).href), url = new URL(href);
    expect([url.origin + url.pathname, url.search]).toEqual([`${ORIGIN}/`, `?clip=${encodeURIComponent(clip!)}&renderer=webgl2`]);
  }
  // opened by touch, in a new tab: the gallery plays that clip, and its own link for what it shows is the card's
  const [tab] = await Promise.all([context.waitForEvent("page"), link(lib.id).tap()]);
  await tab.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready, undefined, { timeout: 60_000 });
  const g = await tab.evaluate(() => (window as unknown as { __m3a: { state(): { route: { clip: string }; link: string; error: string | null; paused: boolean; playing: { id: string } | null } } }).__m3a.state());
  expect([g.error, g.route.clip, g.playing?.id, g.paused, g.link]).toEqual([null, lib.id, lib.id, false, new URL(await link(lib.id).evaluate((a) => (a as HTMLAnchorElement).href)).search]);
  await tab.close();
  expect(log.filter((l) => /error/i.test(l))).toEqual([]);
});

test("bundled: a build carries a queue only when M3A_REVIEW_QUEUE asks, and the page opens that one at load, or the batch a link names", async ({ page }) => {
  test.setTimeout(120_000);
  await serve(page, SITE);
  await visit(page, PAGE);
  const s0 = await state(page);
  expect([s0.source, s0.batch, s0.batches]).toEqual(["", null, []]); // built asking for no batch, and no queue: none in it
  // a build naming no batches (as `npm run gallery` at a desk): the committed ones of library clips alone, the newest of
  // each gate (G8-run-1's queue-0.56.0; its queue.json superseded, G9's holding submissions)
  const bundled = join(ROOT, ".cache/review-site-bundled"), G8 = "bench/results/gates/G8-run-1", NEWEST = "G8-run-1/queue-0.56.0";
  process.env.M3A_REVIEW_QUEUE = join(co.cwd, QUEUE_FILE);
  delete process.env.M3A_REVIEW_BATCHES;
  try {
    await build({ configFile: join(ROOT, "apps/gallery/vite.config.ts"), build: { outDir: bundled, emptyOutDir: true }, logLevel: "error" });
  } finally {
    delete process.env.M3A_REVIEW_QUEUE;
  }
  await page.unrouteAll();
  await serve(page, bundled);
  await visit(page, PAGE);
  await page.waitForFunction(() => (window as unknown as Win).__m3a.state().source !== "");
  const s = await state(page);
  expect([s.source, s.batch, s.batches, s.error, s.submissions.length, s.clips.length]).toEqual(["bundled at build time", null, [NEWEST], null, 3, 20]);
  // a link naming a batch opens it, the page saying which; one naming none here opens the newest and says so; opening
  // one at load decides nothing
  for (const [asked, problem] of [[NEWEST, ""], ["G8-run-1/queue", "?queue=G8-run-1/queue is no batch this page carries"], ["G9-run-2/queue", "?queue=G9-run-2/queue is no batch this page carries"]]) {
    await visit(page, `${PAGE}?queue=${asked}`);
    const b = await state(page), decisions = await page.evaluate(() => (window as unknown as Win).__m3a.review()!.decisions.length);
    expect([b.batch, b.source, b.submissions.length, b.clips.length, b.problem.slice(0, problem!.length)]).toEqual([NEWEST, `batch ${NEWEST}`, 0, 20, problem]);
    expect([b.decided, b.clips.filter((r) => r.as !== null).length, decisions], asked).toEqual([0, 0, 0]);
    await expect(page.locator("#source")).toContainText(`batch ${NEWEST} (${G8}/queue-0.56.0.json, the newest of 1 this page carries)`);
    await expect(page.locator(`#batches [data-queue="${NEWEST}"]`)).toHaveAttribute("aria-current", "true");
  }
});

test("contributors: unlinked, it says so, reaches no other origin and carries no secret; linked to a stub, a key is added and revoked", async ({ page }) => {
  test.setTimeout(120_000);
  const asked: string[] = [];
  page.on("request", (r) => asked.push(r.url()));
  await serve(page, SITE);
  await visit(page, CONTRIBUTORS);
  await expect(page.locator("#state")).toContainText("The hosted intake store isn't linked yet (O8)");
  await expect(page.locator("#state")).toContainText("intake.localStore");
  expect([await page.locator("#sign-in").count(), asked.filter((u) => !u.startsWith(ORIGIN))]).toEqual([0, []]);
  await page.screenshot({ path: join(OUT, "contributors-phone.png"), fullPage: true });
  // no secret anywhere in the built site: no secret key, no JWT, no value of a secret in this environment
  const secrets = Object.entries(process.env).filter(([k, v]) => /SECRET|SERVICE_ROLE|TOKEN|PASSWORD|_KEY$/.test(k) && (v ?? "").length >= 12).map(([, v]) => v!);
  const text = readdirSync(SITE, { recursive: true }).map(String).filter((f) => /\.(js|html)$/.test(f)).map((f) => readFileSync(join(SITE, f), "utf8")).join("\n");
  expect([/sb_secret_\w+/.exec(text)?.[0], /eyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]+/.exec(text)?.[0], secrets.filter((v) => text.includes(v)).length]).toEqual([undefined, undefined, 0]);

  // a build given a secret key fails, before any page could carry it: Supabase's sb_secret_ keys and service_role JWTs
  const jwt = (role: string) => ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "sig"].join(".");
  for (const key of ["sb_secret_PROBEVALUE0123456789", jwt("service_role")]) {
    process.env.VITE_M3A_INTAKE_KEY = key;
    try {
      await expect(build({ configFile: join(ROOT, "apps/gallery/vite.config.ts"), build: { outDir: join(ROOT, ".cache/review-site-secret"), emptyOutDir: true }, logLevel: "silent" })).rejects.toThrow(/VITE_M3A_INTAKE_KEY is a secret key/);
    } finally {
      delete process.env.VITE_M3A_INTAKE_KEY;
    }
  }

  // built linked: sign in (the stub's GitHub sign-in sends a token back in the link, as Supabase Auth's redirect does), add a key's SHA-256, revoke it
  process.env.VITE_M3A_INTAKE_URL = `${ORIGIN}/stub`;
  process.env.VITE_M3A_INTAKE_KEY = "sb_publishable_stub";
  try {
    await build({ configFile: join(ROOT, "apps/gallery/vite.config.ts"), build: { outDir: LINKED, emptyOutDir: true, rollupOptions: { input: join(ROOT, "apps/gallery/src/contributors/index.html") } }, logLevel: "error" });
  } finally {
    delete process.env.VITE_M3A_INTAKE_URL;
    delete process.env.VITE_M3A_INTAKE_KEY;
  }
  const keys: { hash: string; label: string; created_at: string; revoked_at: string | null; uid: string }[] = [], hash = createHash("sha256").update("a test key").digest("hex");
  await page.unrouteAll();
  await serve(page, LINKED, (path, method, body, headers) => {
    if (!path.startsWith("/auth/v1/authorize") && (headers.apikey !== "sb_publishable_stub" || headers.authorization !== "Bearer stub-token")) return { status: 401, json: { message: "no session" } };
    if (path.startsWith("/auth/v1/authorize?provider=github&redirect_to=")) return { status: 200, html: `<script>location.replace(${JSON.stringify(`${decodeURIComponent(path.split("redirect_to=")[1]!)}#access_token=stub-token&token_type=bearer`)})</script>` };
    if (path === "/auth/v1/user") return { status: 200, json: { id: "u-alice", user_metadata: { user_name: "alice" } } };
    if (path.startsWith("/rest/v1/contributor_keys") && method === "GET") return { status: 200, json: keys.map(({ uid: _, ...k }) => k) };
    if (method === "POST") keys.push({ ...(JSON.parse(body) as { hash: string; label: string; uid: string }), created_at: "2026-10-19T10:00:00Z", revoked_at: null });
    else if (method === "PATCH") keys.find((k) => path.includes(`hash=eq.${k.hash}`))!.revoked_at = (JSON.parse(body) as { revoked_at: string }).revoked_at;
    else return { status: 404 };
    return { status: method === "POST" ? 201 : 204 };
  });
  await visit(page, CONTRIBUTORS);
  await expect(page.locator("#state")).toContainText("is linked");
  await page.locator("#sign-in").tap();
  await expect(page.locator("#session")).toContainText("Signed in as alice");
  expect(new URL(page.url()).hash).toBe(""); // the token is out of the link at once
  await page.locator('input[name="hash"]').fill(hash);
  await page.locator('input[name="label"]').fill("the test agent");
  await page.locator('#add button[type="submit"]').tap();
  await expect(page.locator(`[data-key="${hash}"]`)).toContainText("the test agent");
  expect(keys.map((k) => [k.uid, k.hash])).toEqual([["u-alice", hash]]);
  await page.locator(`[data-revoke="${hash}"]`).tap();
  await expect(page.locator(`[data-key="${hash}"]`)).toContainText("revoked");
  expect([keys[0]!.revoked_at === null, await page.locator("[data-revoke]").count()]).toEqual([false, 0]);
});
