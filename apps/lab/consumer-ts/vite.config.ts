// Vite config for the TypeScript consumer lab (PLAN.md WP-10.1): serves or builds apps/lab/consumer-ts. The page opens
// the library through @m3a/library's main entry, which reads any source of files; at build time this config reads the
// files the duel needs (each set's manifest and catalog, and the clips the graph and recipe name) with
// @m3a/library/node and hands them to the page as `__DUEL_LIBRARY__`, as a game's build would. The build stamp's
// commit (`__COMMIT__`) comes from Vercel or GitHub Actions, else git (tools/run/stamp.ts), as every page's does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";
import { defaultSets, directory } from "@m3a/library/node";
import { buildCommit } from "../../../tools/run/stamp.ts";
import { libraryIds } from "./src/clips.ts";

const HERE = import.meta.dirname, ROOT = join(HERE, "../../..");
const data = (file: string) => JSON.parse(readFileSync(join(HERE, "data", file), "utf8"));

/** The library files the duel reads, by set, then file name. */
function bundled(): Record<string, Record<string, string>> {
  const src = directory(defaultSets()), out: Record<string, Record<string, string>> = {};
  for (const id of libraryIds({ graph: data("duel.graph.json"), recipes: [data("slash.recipe.json")] })) {
    const [set, name] = id.split("/") as [string, string];
    const files = (out[set] ??= { "_set.json": src.read(set, "_set.json"), "catalog.tsv": src.read(set, "catalog.tsv") });
    files[`${name}.json`] = src.read(set, `${name}.json`);
  }
  return out;
}

export default defineConfig({
  root: HERE,
  base: "./",
  define: { __DUEL_LIBRARY__: JSON.stringify(JSON.stringify(bundled())), __COMMIT__: JSON.stringify(buildCommit(ROOT)) },
  server: { fs: { allow: [ROOT] } },
  build: { outDir: "dist", emptyOutDir: true, target: "es2023", chunkSizeWarningLimit: 4096, reportCompressedSize: false },
  logLevel: "warn",
});
