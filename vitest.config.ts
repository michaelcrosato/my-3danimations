// Vitest config for T1 (`npm test`): unit, conformance and tool tests. Browser suites run under Playwright (T2). The
// tests are CPU-bound and the main thread only gathers their results, so every core runs a file (Vitest's default
// leaves one idle, and T1's 90 s budget is wall-clock).
import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".cache/vite",
  test: {
    include: ["packages/*/test/**/*.test.ts", "tools/**/*.test.ts", "spec/**/*.test.ts", "bench/**/*.test.ts"],
    exclude: ["**/node_modules/**", ".cache/**", "**/dist/**", "bench/starters/**", "bench/graders/*/known-good/**"],
    maxWorkers: availableParallelism(),
  },
});
