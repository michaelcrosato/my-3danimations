// Vite config for the first-flight demo (WP-4.6): `npm run hello` serves it, `npm run hello -- build` writes
// apps/lab/hello/dist, and the preview site (`npm run site`, what vercel.json builds once O3 links the project) builds
// it into /labs/hello/. The build stamp's commit comes from Vercel or GitHub Actions, else git (tools/run/stamp.ts).
import { join } from "node:path";
import { defineConfig } from "vite";
import { buildCommit } from "../../../tools/run/stamp.ts";

const ROOT = join(import.meta.dirname, "../../..");

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  define: { __COMMIT__: JSON.stringify(buildCommit(ROOT)) },
  server: { fs: { allow: [ROOT] } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2023", chunkSizeWarningLimit: 4096, reportCompressedSize: false },
  logLevel: "warn",
});
