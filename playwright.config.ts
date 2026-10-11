// Playwright config for T2 (`npm run e2e`): browser checks of the adapters on the preinstalled Chromium.
// CHROMIUM_PATH (set by the SessionStart hook) wins; otherwise Playwright finds build 1194 under
// PLAYWRIGHT_BROWSERS_PATH. Never run `playwright install` in the container.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "check-output/e2e",
  reporter: [["line"]],
  workers: 2,
  use: {
    headless: true,
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
});
