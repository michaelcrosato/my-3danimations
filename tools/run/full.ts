// `npm run test:full -- <file or filter>...`: tests that need the whole library or the pinned sources (M3A_FULL=1,
// D74), run alone, as a gate step names them; the same vitest T1 and T2 run, with M3A_FULL set.
import { spawnSync } from "node:child_process";
import { bin } from "./cli.ts";

const r = spawnSync(bin("vitest"), ["run", ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, M3A_FULL: "1" } });
process.exit(r.status ?? 1);
