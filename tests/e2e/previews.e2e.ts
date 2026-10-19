// e2e `previews` (WP-8.3): the preview site built as Vercel builds a branch (vercel.json's buildCommand, run by a shell
// with Vercel's environment and a fake VERCEL_GIT_COMMIT_SHA) and its outputDirectory served to headless Chromium as
// Vercel serves it (a directory's index.html; trailingSlash adds the slash to a directory's path). Every page the site
// holds (the gallery, the review queue's and contributor pages, the labs index, each lab) shows core's version and that
// commit in its build stamp, loading with no failed request; the review page carries no queue, though the build's
// environment asked for one (M3A_REVIEW_QUEUE); the labs index lists every lab in apps/lab/ with its date and question
// as its README states them and links each lab's page and the gallery, every link resolving; no fetched rig (.glb)
// ships. Run it by file name in a worktree (`npm run e2e -- previews.e2e`).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { VERSION } from "../../packages/core/src/index.ts";

const ROOT = join(import.meta.dirname, "../..");
const VERCEL = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { buildCommand: string; outputDirectory: string; trailingSlash?: boolean };
const SITE = join(ROOT, VERCEL.outputDirectory), SHA = `5ca1ab1e${"0".repeat(32)}`, STAMP = `m3a ${VERSION} · ${SHA.slice(0, 7)}`;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
/** Every lab but the index, as its README states it, and whether it has a page. */
const LABS = readdirSync(join(ROOT, "apps/lab"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "index")
  .map(({ name }) => {
    const text = readFileSync(join(ROOT, "apps/lab", name, "README.md"), "utf8");
    return { name, date: /\*\*Lab, (\d{4}-\d{2}-\d{2})\*\*/.exec(text)?.[1], question: /\*\*The question:\*\*\s*([^?]+\?)/.exec(text)?.[1]?.replace(/\s+/g, " "), page: existsSync(join(ROOT, "apps/lab", name, "index.html")) };
  });
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));

let server: Server, ORIGIN = "";

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  // a Vite build for the gallery, the labs index and each lab (consumer-ts, hello)
  test.setTimeout(300_000);
  // M3A_REVIEW_QUEUE set as a local shell might have it: the site must drop it (no queue, no submissions' text ships)
  const env: NodeJS.ProcessEnv = { ...process.env, VERCEL: "1", CI: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: SHA, M3A_REVIEW_QUEUE: "1" };
  delete env.GITHUB_SHA;
  const r = spawnSync(VERCEL.buildCommand, { shell: true, cwd: ROOT, env, encoding: "utf8" });
  expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
  // served over HTTP as Vercel serves it: a directory's index.html, and with trailingSlash a 308 to its path with a slash
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://site"), path = normalize(decodeURIComponent(url.pathname)), file = join(SITE, path);
    const dir = file.startsWith(SITE) && existsSync(file) && statSync(file).isDirectory();
    if (dir && !path.endsWith("/") && VERCEL.trailingSlash) return void res.writeHead(308, { location: `${path}/${url.search}` }).end();
    const target = dir ? join(file, "index.html") : file;
    if (!target.startsWith(SITE) || !existsSync(target) || statSync(target).isDirectory()) return void res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" }).end(readFileSync(target));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  ORIGIN = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
});

test("previews: the labs index lists every lab with its date and question, and links each lab's page and the gallery", async ({ page }) => {
  await page.goto(`${ORIGIN}/labs`);
  expect(page.url(), "trailingSlash puts /labs at /labs/, where the relative links resolve").toBe(`${ORIGIN}/labs/`);
  await expect(page.locator("#stamp")).toHaveText(STAMP);
  expect(LABS.length).toBeGreaterThan(0);
  for (const lab of LABS) {
    expect([lab.name, lab.date, lab.question].every(Boolean), `apps/lab/${lab.name}/README.md: a date and a question`).toBe(true);
    await expect(page.locator(`#lab-${lab.name}`)).toContainText(`${lab.date}`);
    await expect(page.locator(`#lab-${lab.name}`)).toContainText(lab.question!);
  }
  const links = await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(links.sort()).toEqual([`${ORIGIN}/`, ...LABS.filter((l) => l.page).map((l) => `${ORIGIN}/labs/${l.name}/`)].sort());
});

test("previews: every page resolves with no failed request and shows the branch's commit in its stamp; no rig ships", async ({ page }) => {
  // the gallery and each lab opened on SwiftShader: about 15 s here
  test.setTimeout(180_000);
  await page.goto(`${ORIGIN}/labs/`);
  // every page the site holds (each index.html), the review queue's and the contributor page among them
  const pages = files(SITE).filter((f) => f.endsWith("index.html")).map((f) => `${ORIGIN}/${f.slice(SITE.length + 1).replace(/index\.html$/, "")}`);
  const links = [...new Set([`${ORIGIN}/labs/`, ...(await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href))), ...pages])].sort();
  expect(pages.length, pages.join(" ")).toBeGreaterThanOrEqual(5);
  const failed: string[] = [];
  page.on("response", (r) => void (r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`)));
  // a request cut off by the next visit isn't a failure; a 4xx or 5xx is
  page.on("requestfailed", (r) => void (r.failure()?.errorText !== "net::ERR_ABORTED" && failed.push(`${r.failure()?.errorText} ${r.url()}`)));
  for (const link of links) {
    const res = await page.goto(link);
    expect(res?.status(), link).toBe(200);
    await expect(page.locator("#stamp"), link).toContainText(STAMP, { timeout: 60_000 });
    await page.waitForLoadState("networkidle");
  }
  expect(failed).toEqual([]);
  expect(files(SITE).filter((f) => f.endsWith(".glb"))).toEqual([]);
  // the review page opens with no queue bundled: the site dropped M3A_REVIEW_QUEUE
  await page.goto(`${ORIGIN}/src/review/`);
  await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean } }).__m3a?.ready, undefined, { timeout: 60_000 });
  expect(await page.evaluate(() => (window as unknown as { __m3a: { state(): { source: string } } }).__m3a.state().source)).toBe("");
});
