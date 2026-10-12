// Vite config for the first-flight demo (WP-4.6): `npm run hello` serves it, `npm run hello -- build` writes
// apps/lab/hello/dist (what vercel.json deploys once O3 links the project). The build stamp's commit comes from Vercel
// or GitHub Actions, else git.
import { execSync } from "node:child_process";
import { join } from "node:path";
import { defineConfig } from "vite";

const ROOT = join(import.meta.dirname, "../../..");
function commit(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  define: { __COMMIT__: JSON.stringify(commit()) },
  server: { fs: { allow: [ROOT] } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2023", chunkSizeWarningLimit: 4096, reportCompressedSize: false },
  logLevel: "warn",
});
