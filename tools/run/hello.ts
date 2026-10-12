// `npm run hello [-- build | preview]` (WP-4.6): the first-flight demo (apps/lab/hello) served by Vite with live
// reload, built into apps/lab/hello/dist (what vercel.json deploys), or that build served.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "./cli.ts";

const mode = process.argv[2] ?? "dev", config = join(ROOT, "apps/lab/hello/vite.config.ts");
const args = mode === "build" ? ["build", "--config", config] : mode === "preview" ? ["preview", "--config", config] : ["--config", config];
if (!["dev", "build", "preview"].includes(mode)) {
  console.error(`hello: "${mode}" isn't a mode: npm run hello [-- build | preview]`);
  process.exit(2);
}
process.exit(spawnSync(join(ROOT, "node_modules/.bin/vite"), args, { stdio: "inherit", cwd: ROOT }).status ?? 1);
