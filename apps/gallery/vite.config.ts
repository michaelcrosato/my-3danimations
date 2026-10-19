// Vite config for the gallery (PLAN.md WP-8.1): `npm run gallery` serves it, `npm run gallery -- build` writes
// apps/gallery/dist, `npm run gallery -- preview` serves that build. Its plugin bundles the library as text: every set's
// manifest, catalog and file names and the lock in the page (`virtual:m3a-library`), each set's clip files in a chunk
// of its own (`virtual:m3a-set/<SET>`) loaded when one of its clips is first opened, and the real CC0 rigs that
// `npm run fixtures -- fetch` put in .cache/fixtures/ (none when they aren't there). The build stamp's commit comes from
// Vercel or GitHub Actions, else git. Three pages: the gallery (index.html), the review queue (src/review/) and the
// contributor page (src/contributors/), WP-8.2b's.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

const ROOT = join(import.meta.dirname, "../.."), SETS = join(ROOT, "library/sets"), RIGS = join(ROOT, ".cache/fixtures");
const LIBRARY = "virtual:m3a-library", SET = "virtual:m3a-set/";

function commit(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

/** The library's sets as modules: the index (manifests, catalogs, file names, the lock, the rigs) and one per set. */
function library(): Plugin {
  const sets = () => readdirSync(SETS).filter((s) => existsSync(join(SETS, s, "_set.json"))).sort();
  const read = (set: string, file: string) => readFileSync(join(SETS, set, file), "utf8");
  return {
    name: "m3a-library",
    resolveId: (id) => (id === LIBRARY || id.startsWith(SET) ? `\0${id}` : undefined),
    load(id) {
      if (id === `\0${LIBRARY}`) {
        const index = Object.fromEntries(sets().map((s) => [s, { manifest: read(s, "_set.json"), catalog: read(s, "catalog.tsv"), files: readdirSync(join(SETS, s)).sort() }]));
        const loaders = sets().map((s) => `${JSON.stringify(s)}: () => import(${JSON.stringify(SET + s)}).then((m) => m.default)`);
        const rigs = existsSync(RIGS) ? readdirSync(RIGS).filter((f) => f.endsWith(".glb")).sort() : [];
        const urls = rigs.map((f) => `${JSON.stringify(f.slice(0, -4))}: () => import(${JSON.stringify(`${join(RIGS, f)}?url`)}).then((m) => m.default)`);
        return [
          `export const SETS = ${JSON.stringify(index)};`,
          `export const LOCK = ${JSON.stringify(readFileSync(join(ROOT, "library/sets.lock.json"), "utf8"))};`,
          `export const LOADERS = {${loaders.join(",")}};`,
          `export const RIGS = {${urls.join(",")}};`,
        ].join("\n");
      }
      if (id.startsWith(`\0${SET}`)) {
        const set = id.slice(SET.length + 1), files = readdirSync(join(SETS, set)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
        return `export default ${JSON.stringify(Object.fromEntries(files.map((f) => [f, read(set, f)])))};`;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  define: { __COMMIT__: JSON.stringify(commit()) },
  plugins: [library()],
  // the fixtures may be a link to another checkout's cache
  server: { fs: { allow: [ROOT, ...(existsSync(RIGS) ? [realpathSync(RIGS)] : [])] } },
  build: {
    outDir: "dist", emptyOutDir: true, target: "es2023", chunkSizeWarningLimit: 8192, reportCompressedSize: false,
    rollupOptions: { input: Object.fromEntries(["index.html", "src/review/index.html", "src/contributors/index.html"].map((p) => [p.split("/").at(-2) ?? "gallery", join(import.meta.dirname, p)])) },
  },
  logLevel: "warn",
});
