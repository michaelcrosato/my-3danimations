// Vite config for the gallery (PLAN.md WP-8.1): `npm run gallery` serves it, `npm run gallery -- build` writes
// apps/gallery/dist, `npm run gallery -- preview` serves that build. Its plugin bundles the library as text: every set's
// manifest, catalog and file names and the lock in the page (`virtual:m3a-library`), each set's clip files in a chunk
// of its own (`virtual:m3a-set/<SET>`) loaded when one of its clips is first opened, and the real CC0 rigs that
// `npm run fixtures -- fetch` put in .cache/fixtures/ (none when they aren't there). The build stamp's commit comes from
// Vercel or GitHub Actions, else git. Three pages: the gallery (index.html), the review queue (src/review/) and the
// contributor page (src/contributors/), WP-8.2b's. The review page bundles a queue only when asked: M3A_REVIEW_QUEUE=1
// bundles the check-output/review/queue.json `m3a review export` wrote, any other value names the file (a queue holds
// submissions' text, so no build carries one by accident: the preview site never does). A build given a secret intake
// key fails (the contributor page's keys.ts).
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { buildCommit } from "../../tools/run/stamp.ts";
import { secretKey } from "./src/contributors/keys.ts";

const ROOT = join(import.meta.dirname, "../.."), SETS = join(ROOT, "library/sets"), RIGS = join(ROOT, ".cache/fixtures");
const LIBRARY = "virtual:m3a-library", SET = "virtual:m3a-set/";

/** The queue the review page bundles (its JSON text), or null: none unless M3A_REVIEW_QUEUE asks for one. */
function reviewQueue(): string | null {
  const asked = process.env.M3A_REVIEW_QUEUE;
  if (!asked) return null;
  const file = asked === "1" ? join(ROOT, "check-output/review/queue.json") : resolve(ROOT, asked);
  if (!existsSync(file)) throw new Error(`M3A_REVIEW_QUEUE: no queue at ${file}: run m3a review export first, or leave M3A_REVIEW_QUEUE unset`);
  return readFileSync(file, "utf8");
}


/** Fails the build given a secret intake key: Vite inlines VITE_M3A_INTAKE_KEY into the contributor page's bundle,
 *  so the page refusing it at run time would be too late (keys.ts). */
function noSecret(): Plugin {
  return {
    name: "m3a-no-secret",
    configResolved(config) {
      if (secretKey(String(config.env.VITE_M3A_INTAKE_KEY ?? ""))) throw new Error("VITE_M3A_INTAKE_KEY is a secret key (sb_secret_..., or a service_role JWT): build with the project's publishable key; a secret never goes into a page");
    },
  };
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
  define: { __COMMIT__: JSON.stringify(buildCommit(ROOT)), __REVIEW_QUEUE__: JSON.stringify(reviewQueue()) },
  plugins: [noSecret(), library()],
  // the fixtures may be a link to another checkout's cache
  server: { fs: { allow: [ROOT, ...(existsSync(RIGS) ? [realpathSync(RIGS)] : [])] } },
  build: {
    outDir: "dist", emptyOutDir: true, target: "es2023", chunkSizeWarningLimit: 8192, reportCompressedSize: false,
    rollupOptions: { input: Object.fromEntries(["index.html", "src/review/index.html", "src/contributors/index.html"].map((p) => [p.split("/").at(-2) ?? "gallery", join(import.meta.dirname, p)])) },
  },
  logLevel: "warn",
});
