// Playwright config for T2 (`npm run e2e`): browser checks of the adapters on the preinstalled Chromium.
// CHROMIUM_PATH (set by the SessionStart hook) wins; otherwise Playwright finds build 1194 under
// PLAYWRIGHT_BROWSERS_PATH. Never run `playwright install` in the container.
// Four workers, a suite each, on CI's and the container's 4 CPUs (D126): with two, the suites kept about three CPUs
// busy and gallery, the longest, started tenth of eleven (162 to 177 s here); with four the step is CPU-bound (124 to
// 137 s), every test within its timeout. Three measured the same; more suites at once only share the four CPUs.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "check-output/e2e",
  reporter: [["line"]],
  workers: 4,
  use: {
    headless: true,
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
