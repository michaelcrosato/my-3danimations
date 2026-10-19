// e2e `single` (WP-7.4, F5.3): m3a.js, the single file, in Chromium. It is built as `npm run pack` builds it
// (tools/bundle/single.ts), served from an origin of the test's own and imported as an ES module by a page, as an agent
// that can't install packages would load it; m3a calls through its own runCli then reply in the browser as the same
// file replies on Node, byte for byte (a search over the CC0 clips it carries among them), and `version` as the
// packages reply. `npm run pack -- --check` proves the file on Node alone.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { runCli, tools } from "../../packages/tools/src/index.ts";
import { nodeHost } from "../../packages/tools/src/node.ts";
import { buildSingle } from "../../tools/bundle/single.ts";
import type { SingleCli } from "../../tools/bundle/example.ts";

const ROOT = join(import.meta.dirname, "../..");
/** The calls made on each side: the version, and a search the carried library answers. */
const CALLS = [["version", "--json"], ["search", "walk", "--json"]];

/** One m3a call through a runCli: its exit code, what it printed and the report.json it wrote. */
async function call(m3a: SingleCli, argv: string[]): Promise<{ code: number; text: string; report: string }> {
  let text = "", report = "";
  const code = await m3a.runCli(m3a.tools, argv, { print: (t) => void (text += t), write: (_p, t) => void (report = t), host: m3a.host });
  return { code, text, report };
}

test("m3a.js loads in Chromium as an ES module, and its m3a calls reply there as on Node", async ({ page }) => {
  const out = mkdtempSync(join(tmpdir(), "m3a-e2e-single-"));
  try {
    const { file } = await buildSingle(out), code = readFileSync(file, "utf8"), errors: string[] = [];
    writeFileSync(join(out, "package.json"), '{ "type": "module" }\n'); // Node reads m3a.js as the ES module it is, as in a game's folder
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://m3a.test/**", (r) => r.fulfill(new URL(r.request().url()).pathname === "/m3a.js" ? { body: code, contentType: "text/javascript" } : { body: "<!doctype html><title>m3a.js</title>", contentType: "text/html" }));
    await page.goto("http://m3a.test/");
    await page.addScriptTag({ type: "module", content: 'import * as m3a from "/m3a.js"; window.__M3A_SINGLE__ = m3a;' });
    await page.waitForFunction(() => "__M3A_SINGLE__" in window);
    const inBrowser = await page.evaluate(async (calls) => {
      const m3a = (window as unknown as { __M3A_SINGLE__: SingleCli }).__M3A_SINGLE__, said = [];
      for (const argv of calls) {
        let text = "", report = "";
        const code = await m3a.runCli(m3a.tools, argv, { print: (t) => void (text += t), write: (_p, t) => void (report = t), host: m3a.host });
        said.push({ code, text, report });
      }
      return said;
    }, CALLS);
    const onNode = (await import(pathToFileURL(file).href)) as SingleCli, node: Awaited<ReturnType<typeof call>>[] = [];
    for (const argv of CALLS) node.push(await call(onNode, argv));
    expect(errors).toEqual([]);
    expect(inBrowser).toEqual(node);
    expect(inBrowser.map((r) => r.code)).toEqual([0, 0]);
    expect(inBrowser[1]!.text).toMatch(/^search "walk": \d+ of \d+ clips \(tiers cc0\)\n/);
    expect(inBrowser[0]).toEqual(await call({ runCli, tools, host: nodeHost(ROOT) }, CALLS[0]!));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
