// `npm run gallery [-- build | preview]` (WP-8.1): the gallery (apps/gallery) served by Vite with live reload, built
// into apps/gallery/dist, or that build served.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "./cli.ts";

const mode = process.argv[2] ?? "dev", config = join(ROOT, "apps/gallery/vite.config.ts");
if (!["dev", "build", "preview"].includes(mode)) {
  console.error(`gallery: "${mode}" isn't a mode: npm run gallery [-- build | preview]`);
  process.exit(2);
}
const args = mode === "dev" ? ["--config", config] : [mode, "--config", config];
process.exit(spawnSync(join(ROOT, "node_modules/.bin/vite"), args, { stdio: "inherit", cwd: ROOT }).status ?? 1);
