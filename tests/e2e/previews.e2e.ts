// e2e `previews` (WP-8.3): the preview site built as Vercel builds a branch (vercel.json's buildCommand, run by a shell
// with Vercel's environment and a fake VERCEL_GIT_COMMIT_SHA) and its outputDirectory served to headless Chromium as
// Vercel serves it (a directory's index.html; trailingSlash adds the slash to a directory's path). Every page the site
// holds (the gallery, the review queue's and contributor pages, the labs index, each lab) shows core's version and that
// commit in its build stamp, loading with no failed request; the labs index lists every lab in apps/lab/ with its date
// and question as its README states them and links each lab's page and the gallery, every link resolving; no fetched
// rig (.glb) ships. The review page (WP-F.11) carries no queue the build's environment asked for (M3A_REVIEW_QUEUE)
// and no batch it named (M3A_REVIEW_BATCHES, one holding submissions): it carries the committed batches of library
// clips alone (the newest bench/results/gates/<gate>/queue*.json of each gate, holding no submission; an older export
// superseded), opens the newest at load, saying which and deciding nothing, and the one a link names; no submission of
// the batches left out reaches any file of the site, and the site's reply names them. A build asked to bundle a batch
// holding a submission fails, naming it, and so does one whose batch carries any key or value a library clip's row
// hasn't (a submission's text in a row, nested, or in a field's value), or a row that is no library clip: the build's
// check (apps/gallery/src/review/batches.ts) in a test tier. Run it by file name in a worktree
// (`npm run e2e -- previews.e2e`).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import { build } from "vite";
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
/** The committed review batches (bench/results/gates/<gate>/queue*.json): name, date and submissions, read here. */
const GATES = join(ROOT, "bench/results/gates");
const BATCHES = readdirSync(GATES, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => readdirSync(join(GATES, d.name)).filter((f) => /^queue.*\.json$/.test(f)).map((f) => {
  const q = JSON.parse(readFileSync(join(GATES, d.name, f), "utf8")) as { date: string; submissions: { id: string; hash: string }[]; clips: { id: string }[] };
  return { gate: d.name, name: `${d.name}/${f.slice(0, -5)}`, file: `${d.name}/${f}`, date: q.date, submissions: q.submissions, clips: q.clips.length };
}));
/** Newest first: the latest date, then the greatest name. */
const byNewest = <T extends { name: string; date: string }>(xs: T[]) => [...xs].sort((a, b) => (a.date === b.date ? (a.name < b.name ? 1 : -1) : a.date < b.date ? 1 : -1));
/** Each gate's newest batch, and the batches it supersedes (by the newest's name). */
const TOPS = [...new Set(BATCHES.map((b) => b.gate))].map((g) => byNewest(BATCHES.filter((b) => b.gate === g))[0]!);
const SUPERSEDED = BATCHES.filter((b) => !TOPS.includes(b)).map((b) => ({ ...b, by: TOPS.find((t) => t.gate === b.gate)!.name }));
/** Carried: each gate's newest holding no submission; left out: those holding submissions, and the superseded. */
const CARRIED = TOPS.filter((b) => !b.submissions.length), LEFT = BATCHES.filter((b) => !CARRIED.includes(b));
const NEWEST = byNewest(CARRIED)[0]!;
const WITH_SUBMISSIONS = "bench/results/gates/G9-run-2/queue.json";

let server: Server, ORIGIN = "", built = "";

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  // a Vite build for the gallery, the labs index and each lab (consumer-ts)
  test.setTimeout(300_000);
  // M3A_REVIEW_QUEUE and M3A_REVIEW_BATCHES set as a local shell might have them: the site must drop the one and
  // replace the other (it names a batch holding submissions), so no submission's text ships
  const env: NodeJS.ProcessEnv = { ...process.env, VERCEL: "1", CI: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_SHA: SHA, M3A_REVIEW_QUEUE: "1", M3A_REVIEW_BATCHES: WITH_SUBMISSIONS };
  delete env.GITHUB_SHA;
  const r = spawnSync(VERCEL.buildCommand, { shell: true, cwd: ROOT, env, encoding: "utf8" });
  expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
  built = r.stdout;
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
});

test("previews: the review page opens the newest committed batch of library clips at load, or the one a link names; no submission ships", async ({ page }) => {
  test.setTimeout(120_000);
  type S = { source: string; batch: string | null; batches: string[]; problem: string; error: string | null; submissions: unknown[]; clips: { as: string | null }[]; decided: number };
  // G8's newest batch is carried; its older export (superseded) and G9's (holding submissions) are left out: the site's
  // reply names each, and why
  // and the owner's next batch (reviews/, each export there superseding the last) is the newest: the page opens it
  expect([CARRIED.map((b) => b.name), NEWEST.name, SUPERSEDED.map((b) => `${b.name} by ${b.by}`)]).toEqual([expect.arrayContaining(["G8-run-1/queue-0.56.0", "reviews/queue-0.64.0"]), "reviews/queue-0.64.0", expect.arrayContaining(["G8-run-1/queue by G8-run-1/queue-0.56.0"])]);
  expect(LEFT.map((b) => b.name)).toEqual(expect.arrayContaining(["G8-run-1/queue", "G9-run-1/queue", "G9-run-2/queue"]));
  const said = built.split("\n").find((l) => /^\s+ok\s+review batches /.test(l))!;
  expect(said, built).toContain(`${CARRIED.length} of library clips alone carried (${CARRIED.map((b) => b.file).sort().join(", ")}); ${LEFT.length} left out (`);
  for (const b of LEFT.filter((x) => x.submissions.length && TOPS.includes(x))) expect(said).toContain(`${b.file} (${b.submissions.length} submission${b.submissions.length === 1 ? "" : "s"})`);
  for (const b of SUPERSEDED) expect(said).toContain(`${b.file} (superseded by ${b.by})`);
  expect(built).toMatch(new RegExp(`site: PASS, .*, ${CARRIED.length} review batch(es)? of library clips \\(${LEFT.length} left out\\)`));

  // at load, the newest, the page saying which; the link naming another opens it
  const open = async (link: string) => {
    await page.goto(`${ORIGIN}/src/review/${link}`);
    await page.waitForFunction(() => (window as unknown as { __m3a?: { ready?: boolean; state(): S } }).__m3a?.ready && (window as unknown as { __m3a: { state(): S } }).__m3a.state().source !== "", undefined, { timeout: 60_000 });
    return page.evaluate(() => (window as unknown as { __m3a: { state(): S } }).__m3a.state());
  };
  const s = await open("");
  expect([s.batch, s.source, s.error, s.problem, s.submissions.length, s.clips.length, [...s.batches].sort()]).toEqual([NEWEST.name, `batch ${NEWEST.name}`, null, "", 0, 20, CARRIED.map((b) => b.name).sort()]);
  // opened at load, nothing decided: no row's verdict, no decision in the review it would export
  const decisions = await page.evaluate(() => (window as unknown as { __m3a: { review(): { decisions: unknown[] } | null } }).__m3a.review()!.decisions.length);
  expect([s.decided, s.clips.filter((r) => r.as !== null).length, decisions]).toEqual([0, 0, 0]);
  await expect(page.locator("#source")).toContainText(`batch ${NEWEST.name} (bench/results/gates/${NEWEST.file}, the newest of ${CARRIED.length} this page carries): the local store's queue of ${NEWEST.date}, 0 submissions and 20 sampled clips`);
  await expect(page.locator("#file")).toBeAttached(); // the file picker is still there
  for (const b of CARRIED) {
    const x = await open(`?queue=${b.name}`);
    expect([x.batch, x.problem, x.clips.length], b.name).toEqual([b.name, "", b.clips]);
  }
  // a batch left out isn't there (superseded, or holding submissions): the link names it, the newest opens and the
  // page says so
  for (const b of LEFT) {
    const left = await open(`?queue=${b.name}`);
    expect([left.batch, left.problem], b.name).toEqual([NEWEST.name, expect.stringContaining(`?queue=${b.name} is no batch this page carries`)]);
  }

  // no submission of a batch left out reaches any file of the site: not its id, not its content hash
  const text = files(SITE).filter((f) => /\.(js|html|json|css)$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  const leaked = LEFT.flatMap((b) => b.submissions).filter((x) => text.includes(x.id) || text.includes(x.hash));
  expect([LEFT.flatMap((b) => b.submissions).length > 0, leaked]).toEqual([true, []]);
});

test("previews: a build asked to bundle a batch holding a submission, or anything but library clips' rows, fails, naming it", async () => {
  test.setTimeout(120_000);
  // each build is refused as the Vite config loads, before it writes: the directory stays absent (emptied first, so
  // nothing an earlier run left can pass or fail this one)
  const refused = join(ROOT, ".cache/previews-site-refused"), scratch = join(ROOT, ".cache/previews-batches");
  rmSync(refused, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const refuse = async (paths: string, why: RegExp) => {
    process.env.M3A_REVIEW_BATCHES = paths;
    try {
      await expect(build({ configFile: join(ROOT, "apps/gallery/vite.config.ts"), build: { outDir: refused, emptyOutDir: true }, logLevel: "silent" }), paths).rejects.toThrow(why);
    } finally {
      delete process.env.M3A_REVIEW_BATCHES;
    }
    expect(existsSync(refused), paths).toBe(false);
  };
  try {
    await refuse(`bench/results/gates/${NEWEST.file},${WITH_SUBMISSIONS}`, /^review batch G9-run-2\/queue \(bench\/results\/gates\/G9-run-2\/queue\.json\) can't go into a page: it holds 10 submissions/);
    // G8's newest batch with one thing a library clip's row hasn't: a submission's text in a row, nested in its numbers,
    // in its review or in a field's value; a row naming a submission, or a clip not in the library; the queue's own
    // fields' values too
    type Q = { store: unknown; clips: (Record<string, unknown> & { numbers: Record<string, unknown> })[] };
    const q = JSON.parse(readFileSync(join(GATES, NEWEST.file), "utf8")) as Q, id = String(q.clips[1]!.id), at = (s: string) => s.replace(/[/.()]/g, "\\$&");
    const cases: [string, (x: Q) => unknown, string][] = [
      ["row-text", (x) => (x.clips[1]!.text = "a contributor's text"), `row ${id}: it has keys a sampled clip's row hasn't: text`],
      ["nested-text", (x) => (x.clips[1]!.numbers.text = "NESTED_LEAK"), `row ${id}: its numbers have keys a sampled clip's row hasn't: text`],
      ["review-text", (x) => (x.clips[1]!.review = { state: "approved", by: "owner", date: "2026-10-22", motion: x.clips[1]!.hash, text: "REVIEW_LEAK" }), `row ${id}: its review has keys a sampled clip's row hasn't: text`],
      ["ref-value", (x) => (x.clips[1]!.ref = "REF_LEAK"), `row ${id}: its ref isn't its id@ and its hash's first 12 digits`],
      ["verdict-value", (x) => (x.clips[1]!.numbers.verdict = "VERDICT_LEAK"), `row ${id}: its numbers' verdict isn't one of pass, warn, fail`],
      ["store-value", (x) => (x.store = "STORE_LEAK"), "its store isn't local or supabase"],
      ["submission-row", (x) => (x.clips[1]!.id = "s-0123456789abcdef"), "a row isn't a library clip's: "],
      ["no-clip", (x) => Object.assign(x.clips[1]!, { id: "QUATERNIUS_3D2DGE/No_Such_Clip", ref: `QUATERNIUS_3D2DGE/No_Such_Clip@${String(x.clips[1]!.hash).slice(0, 12)}` }), "row QUATERNIUS_3D2DGE/No_Such_Clip is no clip in the library"],
    ];
    for (const [name, edit, why] of cases) {
      const x = structuredClone(q);
      edit(x);
      writeFileSync(join(scratch, `${name}.json`), JSON.stringify(x));
      await refuse(`bench/results/gates/${NEWEST.file},.cache/previews-batches/${name}.json`, new RegExp(`^review batch \\.cache/previews-batches/${name} \\(\\.cache/previews-batches/${name}\\.json\\) can't go into a page: ${at(why)}`));
    }
  } finally {
    // nothing left behind, a build that wasn't refused included (it would hold that batch's text)
    for (const dir of [scratch, refused]) rmSync(dir, { recursive: true, force: true });
  }
});
