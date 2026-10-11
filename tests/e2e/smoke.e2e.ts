// e2e smoke suite: headless Chromium opens a page and runs script in it, with WebGL 2 (SwiftShader) for the adapters.
import { expect, test } from "@playwright/test";

test("headless Chromium opens a page", async ({ page }) => {
  await page.setContent("<!doctype html><title>m3a smoke</title><p id=v>ok</p>");
  await expect(page).toHaveTitle("m3a smoke");
  expect(await page.locator("#v").textContent()).toBe("ok");
  const webgl2 = await page.evaluate(() => document.createElement("canvas").getContext("webgl2") !== null);
  expect(webgl2, "WebGL 2 is how the adapters are checked (D8); launch with --use-angle=swiftshader").toBe(true);
});
