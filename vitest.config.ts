// Vitest config for T1 (`npm test`): unit, conformance and tool tests. Browser suites run under Playwright (T2). The
// tests are CPU-bound and the main thread only gathers their results, so every core runs a file (Vitest's default
// leaves one idle, and T1's 90 s budget is wall-clock). A worker runs its files on one module graph, not a fresh one
// each (isolate: false, D125): importing the packages again for every file was a third of T1's wall time (128 s to
// 87 s here; CI's T1 had reached 126 s of its 135 s mark). A file that mocks a module imports what it tests afresh
// (vi.resetModules), and a test that sets process state puts it back.
import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".cache/vite",
  test: {
    include: ["packages/*/test/**/*.test.ts", "tools/**/*.test.ts", "spec/**/*.test.ts", "bench/**/*.test.ts", "apps/gallery/**/*.test.ts"],
    exclude: ["**/node_modules/**", ".cache/**", "**/dist/**", "bench/starters/**", "bench/graders/*/known-good/**"],
    maxWorkers: availableParallelism(),
    isolate: false,
  },
});
