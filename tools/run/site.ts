// `node tools/run/site.ts [--out <dir>]` (WP-8.3; vercel.json's buildCommand): the preview site, written locally the
// way Vercel builds every branch: the gallery at the root, the labs index at /labs/ and every lab with a page
// (apps/lab/<name>/index.html) at /labs/<name>/, each built by its own Vite config (Vite's defaults for a lab without
// one, given `__COMMIT__`), so every page can carry its build stamp (core's version; the commit from
// VERCEL_GIT_COMMIT_SHA, else GITHUB_SHA, else git: tools/run/stamp.ts). M3A_REVIEW_QUEUE is dropped before the builds:
// the preview site never bundles a review queue (a queue holds submissions' text). It writes a marker (.m3a-site)
// first, so it rebuilds into a directory an earlier run of its own left behind, a failed one included. The directory defaults to vercel.json's outputDirectory. The rigs fetched into .cache/fixtures/ are left
// out of the gallery, as on Vercel, where there are none: they are fetched by hash, never committed or shipped (D9),
// and the build fails if a .glb reaches the site.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { build, type InlineConfig, type Plugin } from "vite";
import { finish, parseArgs, ROOT, usage, type Parsed, type Step } from "./cli.ts";
import { buildCommit } from "./stamp.ts";

const FLAGS = [{ name: "out", takesValue: true, help: "the directory to write (default: vercel.json's outputDirectory)" }];
const LABS = join(ROOT, "apps/lab"), LIBRARY = "\0virtual:m3a-library", RIGS = /^export const RIGS = \{.*\};$/m;

/** Lists no rig in the gallery's library module, so no .glb from .cache/fixtures/ is bundled. */
function noRigs(): Plugin {
  return {
    name: "m3a-site-no-rigs",
    enforce: "post",
    transform(code, id) {
      if (id !== LIBRARY) return undefined;
      if (!RIGS.test(code)) throw new Error("site: the gallery's library module has no one-line `export const RIGS = {...};` to empty; update tools/run/site.ts to keep the rigs out");
      return code.replace(RIGS, "export const RIGS = {};");
    },
  };
}

/** Every file under `dir`, recursively. */
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
}

let parsed: Parsed;
try {
  parsed = parseArgs(process.argv.slice(2), FLAGS);
  if (parsed.positionals.length) throw new Error(`"${parsed.positionals[0]}" isn't an argument: node tools/run/site.ts [--out <dir>]`);
} catch (err) {
  usage("site", err, FLAGS);
}
const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { outputDirectory: string };
/** A path as the reply shows it: from the repository's root when inside it. */
const show = (p: string) => (relative(ROOT, p).startsWith("..") ? p : relative(ROOT, p) || ".");
const out = resolve(ROOT, String(parsed.flags.out ?? vercel.outputDirectory)), rel = show(out);
// the gallery's build empties the directory: refuse one holding anything but a site this tool wrote (its marker)
const MARK = ".m3a-site";
if (existsSync(out) && readdirSync(out).length && !existsSync(join(out, MARK)) && !existsSync(join(out, "labs/index.html"))) {
  usage("site", new Error(`${rel} holds files that aren't a site this tool wrote; name a new directory with --out`), FLAGS);
}
// the preview site never bundles a review queue, whatever the environment asks of the gallery's own builds
delete process.env.M3A_REVIEW_QUEUE;

const labs = readdirSync(LABS).filter((n) => n !== "index" && existsSync(join(LABS, n, "index.html"))).sort();
const pages: { name: string; outDir: string; config: InlineConfig }[] = [
  { name: "gallery", outDir: out, config: { configFile: join(ROOT, "apps/gallery/vite.config.ts"), plugins: [noRigs()] } },
  { name: "labs index", outDir: join(out, "labs"), config: { configFile: join(LABS, "index/vite.config.ts") } },
  ...labs.map((n) => {
    const config = join(LABS, n, "vite.config.ts");
    return { name: `lab ${n}`, outDir: join(out, "labs", n), config: existsSync(config) ? { configFile: config } : { configFile: false as const, root: join(LABS, n), base: "./", define: { __COMMIT__: JSON.stringify(buildCommit(ROOT)) } } };
  }),
];

const t0 = performance.now(), steps: Step[] = [];
for (const p of pages) {
  const t = performance.now();
  try {
    await build({ ...p.config, build: { outDir: p.outDir, emptyOutDir: true }, logLevel: "warn" });
    if (p.outDir === out) writeFileSync(join(out, MARK), "written by tools/run/site.ts\n");
    steps.push({ name: p.name, ok: true, ms: performance.now() - t, summary: show(p.outDir) });
  } catch (err) {
    steps.push({ name: p.name, ok: false, ms: performance.now() - t, detail: String(err instanceof Error ? err.message : err).split("\n") });
    break;
  }
}
const built = steps.every((s) => s.ok), all = built ? files(out) : [], rigs = all.filter((f) => f.endsWith(".glb")).map((f) => relative(out, f));
if (rigs.length) steps.push({ name: "no fetched rigs", ok: false, ms: 0, detail: rigs });
const mb = all.reduce((n, f) => n + statSync(f).size, 0) / 1e6;
const stamp = built ? (/<div id="stamp">([^<]*)</.exec(readFileSync(join(out, "labs/index.html"), "utf8"))?.[1] ?? "none") : "";
const ok = built && !rigs.length;
finish(
  {
    tool: "site",
    ok,
    verdict: ok
      ? `site: PASS, ${pages.length} pages (the gallery, the labs index, ${labs.length} lab${labs.length === 1 ? "" : "s"}) in ${rel}/, ${all.length} files, ${mb.toFixed(1)} MB, stamp "${stamp}", no fetched rigs`
      : `site: FAIL at ${steps.find((s) => !s.ok)?.name}`,
    steps,
    warnings: [],
    next: ok ? `node_modules/.bin/vite preview --outDir ${rel} serves it (the labs at /labs/); npm run e2e -- previews.e2e checks it` : "fix the failing page's build and rerun",
    ms: performance.now() - t0,
  },
  parsed,
);
