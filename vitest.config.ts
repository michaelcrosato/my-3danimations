// Vitest config for T1 (`npm test`): unit, conformance and tool tests. Browser suites run under Playwright (T2).
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".cache/vite",
  test: {
    include: ["packages/*/test/**/*.test.ts", "tools/**/*.test.ts", "spec/**/*.test.ts", "bench/**/*.test.ts"],
    exclude: ["**/node_modules/**", ".cache/**", "**/dist/**", "bench/starters/**", "bench/graders/*/known-good/**"],
  },
});
