// e2e `animator-parity` (WP-2.6, WP-6.4): the Animator's scripted run gives the same state hash after every step, the
// same events and the same exact-mode joints, bit for bit, in Node and in headless Chromium, with presentation poses
// skipped or taken at alternating detail; and so do the two example graphs' scripted runs (spec/graphs, D73), with the
// same states taken at the same steps. The page runs core's own TypeScript sources, served here with their types stripped
// (node:module's stripTypeScriptTypes), so it runs the very code Node runs.
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join, normalize } from "node:path";
import { expect, test } from "@playwright/test";
import * as core from "../../packages/core/src/index.ts";
import { scriptData } from "../../packages/core/test/animator-data.ts";
import { runScript, type ScriptRun } from "../../packages/core/test/animator-script.ts";
import { graphData } from "../../packages/core/test/graph-data.ts";
import { runGraph, type GraphRun } from "../../packages/core/test/graph-script.ts";

const ROOT = join(import.meta.dirname, "../..");
const ORIGIN = "http://m3a.test";

/** Serves core's sources and tests to the page, their types stripped. */
async function serve(page: import("@playwright/test").Page): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = normalize(decodeURIComponent(new URL(route.request().url()).pathname));
    if (path === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>animator parity</title>" });
    if (!/^\/(packages\/core\/(src|test)\/)[\w/-]+\.ts$/.test(path)) return route.fulfill({ status: 404, body: "not served" });
    return route.fulfill({ contentType: "text/javascript", body: stripTypeScriptTypes(readFileSync(join(ROOT, path), "utf8")) });
  });
  await page.goto(`${ORIGIN}/`);
}

test("the Animator gives the same hashes, events and exact poses in Node and headless Chromium", async ({ page }) => {
  await serve(page);
  const data = scriptData();
  const node = runScript(core, data);
  const browser = await page.evaluate(async (d) => {
    const coreUrl = "/packages/core/src/index.ts", scriptUrl = "/packages/core/test/animator-script.ts";
    const c = await import(coreUrl), s = await import(scriptUrl);
    return { none: s.runScript(c, d), lod: s.runScript(c, d, { poses: "lod" }), every: s.runScript(c, d, { poses: "every" }), engine: navigator.userAgent };
  }, data) as { none: ScriptRun; lod: ScriptRun; every: ScriptRun; engine: string };
  expect(browser.engine).toContain("Chrome");
  expect(node.hashes.length).toBe(480);
  for (const [how, run] of Object.entries({ none: browser.none, lod: browser.lod, every: browser.every })) {
    expect(run.hashes, `Chromium, poses ${how}: state hashes`).toEqual(node.hashes);
    expect(run.events, `Chromium, poses ${how}: events`).toEqual(node.events);
    expect(run.exact, `Chromium, poses ${how}: exact joints`).toEqual(node.exact);
  }
  console.log(`animator-parity: ${node.hashes.length} step hashes, ${node.events.length} events, ${Object.keys(node.exact).length} exact poses; last hash ${node.hashes.at(-1)} in Node and Chromium`);
});

test("the example graphs run the same in Node and headless Chromium: states, hashes, events and exact poses", async ({ page }) => {
  await serve(page);
  const data = graphData(), node = { locomotion: runGraph(core, data, "locomotion"), combo: runGraph(core, data, "combo") };
  const browser = await page.evaluate(async (d) => {
    const coreUrl = "/packages/core/src/index.ts", scriptUrl = "/packages/core/test/graph-script.ts";
    const c = await import(coreUrl), s = await import(scriptUrl);
    return { locomotion: s.runGraph(c, d, "locomotion", { poses: "every" }), combo: s.runGraph(c, d, "combo", { restoreAt: 300 }), engine: navigator.userAgent };
  }, data) as { locomotion: GraphRun; combo: GraphRun; engine: string };
  expect(browser.engine).toContain("Chrome");
  for (const w of ["locomotion", "combo"] as const) {
    expect(node[w].hashes.length).toBe(600);
    expect(browser[w].states, `${w}: states`).toEqual(node[w].states);
    expect(browser[w].hashes, `${w}: state hashes`).toEqual(node[w].hashes);
    expect(browser[w].events, `${w}: events`).toEqual(node[w].events);
    expect(browser[w].exact, `${w}: exact joints`).toEqual(node[w].exact);
  }
  console.log(`graph-parity: locomotion ${node.locomotion.states.length} state changes, combo ${node.combo.states.length}; last hashes ${node.locomotion.hashes.at(-1)} ${node.combo.hashes.at(-1)} in Node and Chromium`);
});
