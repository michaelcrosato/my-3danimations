// `npm run pack [-- --check] [--example <file>] [--publishable]` (PLAN.md WP-7.4): every @m3a package built (ES modules
// with their declarations) and packed, the library's opt-in packs beside its CC0 default (D10), and the single file
// m3a.js, into .cache/pack/ (./build.ts, ./single.ts). --check also proves them, failing on any of: the default library
// pack holds a set that isn't cc0, or an opt-in pack another tier's; the m3a bin isn't dist/node.js with its shebang;
// the version rule fails (`node tools/version.ts --check`), a pack isn't at the version, or lacks CHANGELOG.md; a staged
// package.json drops "private" (or, with --publishable, keeps it or lacks provenance); m3a.js lacks the credits block or
// a license text of its tiers; `npm run license -- check tools/bundle/manifest.json` fails; a clip m3a.js carries
// neither passes the sensors (WP-3.3) nor carries its WP-5.8 baseline (library/baselines/qa.json), or the sensors read
// it differently there; a scratch project outside the repository that installs the tarballs can't run the manual's
// complete example (./example.ts: its section's files, ts blocks and m3a calls, or --example's), `npx m3a help`,
// `npx m3a version`, or `m3a mcp` answering tools/list with every tool (./mcp.ts: a bin that can't start or never
// answers fails the step, the report still printed), or its openLibrary({ tiers }) doesn't find the installed opt-in
// packs; the headless example (the manual's ```ts m3a.js block, else ./standin.ts) fails on the packages or on m3a.js,
// or prints otherwise on the two. The manual's complete example binds a three.js character and writes a PNG through
// Node, which m3a.js leaves out (./single.ts), so m3a.js runs the headless one. Nothing is published (O2).
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TOOLS } from "../../packages/tools/src/index.ts";
import { checkVerdicts } from "../qa/library.ts";
import { qa, type LibraryClip } from "../qa/qa.ts";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { check as versionCheck } from "../version.ts";
import { build, OUT, REPOSITORY, type Packed } from "./build.ts";
import { completeExample, forSingle, headlessOf, SECTION, type Example } from "./example.ts";
import { mcpTools } from "./mcp.ts";
import { buildSingle, bundleData, readManifest } from "./single.ts";

const FLAGS = [
  { name: "check", help: "also prove the packs: a scratch install runs the manual's complete example and the m3a bin, the headless example runs there and on m3a.js, the sensors, tiers, version and licenses hold" },
  { name: "example", takesValue: true, help: "a manual (.md) whose complete example (and ```ts m3a.js block) to run instead of packages/tools/MANUAL.md's, or a program (.ts) to run as the complete example (tools/bundle/standin.ts)" },
  { name: "publishable", help: "stage each package.json ready for O2: \"private\" dropped, publishConfig with provenance, the repository (nothing is published)" },
];
/** The headless example m3a.js runs when the manual marks none. */
const STANDIN = join(import.meta.dirname, "standin.ts");

/** Runs a command, returning its exit status and output; the scratch projects' commands run outside the repository. */
function run(cmd: string, args: readonly string[], cwd: string, input?: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, input, encoding: "utf8", timeout: 300_000, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? String(r.error) : ""}` };
}

/** The tiers of the sets a pack's files hold (`sets/<SET>/...`), read from its staged manifests. */
function packTiers(p: Packed): Record<string, string> {
  const sets = [...new Set(p.files.filter((f) => f.startsWith("sets/")).map((f) => f.split("/")[1]!))].sort();
  return Object.fromEntries(sets.map((s) => [s, (JSON.parse(readFileSync(join(p.stage, "sets", s, "_set.json"), "utf8")) as { tier: string }).tier]));
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), FLAGS);
    if (parsed.positionals.length) throw new Error(`no positional arguments, got "${parsed.positionals.join(" ")}"`);
  } catch (err) {
    usage("pack", err, FLAGS);
  }
  const t0 = performance.now(), steps: Step[] = [], check = Boolean(parsed.flags.check), state: { packs?: Record<string, Packed>; single?: Awaited<ReturnType<typeof buildSingle>>; example?: Example; headless?: { code: string; where: string }; scratch?: string; printed?: string } = {};
  const step = async (name: string, fn: () => string | Promise<string>, needs: (keyof typeof state)[] = []) => {
    const s = performance.now(), missing = needs.filter((k) => state[k] === undefined);
    try {
      if (missing.length) throw new Error(`not run: it needs ${missing.join(", ")}, which an earlier step didn't give`);
      const summary = await fn();
      steps.push({ name, ok: true, ms: performance.now() - s, summary });
    } catch (err) {
      const lines = (err instanceof Error ? err.message : String(err)).split("\n").filter((l) => l.trim());
      steps.push({ name, ok: false, ms: performance.now() - s, summary: lines[0], detail: lines.slice(1, 30) });
    }
  };
  const ready = Boolean(parsed.flags.publishable);
  await step("build and pack", () => {
    state.packs = build(OUT, { publishable: ready });
    return Object.entries(state.packs).map(([k, p]) => `${k} ${(p.bytes / 1024).toFixed(0)} KB`).join(", ");
  });
  await step("single file", async () => {
    const r = (state.single = await buildSingle(join(OUT, "single")));
    return `m3a.js ${(r.bytes / 1024).toFixed(0)} KB: ${r.clips} CC0 clips, ${r.exports.length} exports`;
  });
  if (check) {
    const packs = () => state.packs!;
    await step("tiers", () => {
      const bad: string[] = [], said: string[] = [];
      for (const [name, want] of [["library", "cc0"], ["library-cc-by", "cc-by"], ["library-cmu", "cmu"]] as const) {
        const t = packTiers(packs()[name]!), off = Object.entries(t).filter(([, x]) => x !== want);
        if (!Object.keys(t).length) bad.push(`${name} holds no set`);
        for (const [s, x] of off) bad.push(`${name} holds ${s}, a ${x} set: it may hold ${want} sets alone (D10)`);
        said.push(`${name}: ${Object.keys(t).length} ${want} set${Object.keys(t).length === 1 ? "" : "s"}`);
      }
      if (bad.length) throw new Error(bad.join("\n"));
      return said.join("; ");
    }, ["packs"]);
    await step("bin", () => {
      const p = packs().tools!, bin = (JSON.parse(readFileSync(join(p.stage, "package.json"), "utf8")) as { bin?: Record<string, string> }).bin?.m3a;
      if (bin !== "./dist/node.js" || !p.files.includes("dist/node.js")) throw new Error(`the m3a bin is ${bin ?? "missing"}, and the tarball ${p.files.includes("dist/node.js") ? "has" : "lacks"} dist/node.js`);
      if (!readFileSync(join(p.stage, "dist/node.js"), "utf8").startsWith("#!/usr/bin/env node\n")) throw new Error("dist/node.js doesn't open with #!/usr/bin/env node");
      return "m3a → dist/node.js, with its shebang";
    }, ["packs"]);
    await step("version", () => {
      const problems = versionCheck(), v = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version;
      for (const [k, p] of Object.entries(packs())) {
        const pkg = JSON.parse(readFileSync(join(p.stage, "package.json"), "utf8")) as { version: string; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
        if (pkg.version !== v) problems.push(`${k}: version ${pkg.version}, want ${v}`);
        for (const [d, x] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies }).filter(([d]) => d.startsWith("@m3a/"))) if (x !== v) problems.push(`${k}: ${d}@${x}, want ${v}`);
        if (!p.files.includes("CHANGELOG.md")) problems.push(`${k}: the tarball lacks CHANGELOG.md`);
      }
      if (problems.length) throw new Error(problems.join("\n"));
      return `every pack at ${v}, its @m3a packages too, each with CHANGELOG.md (its ${v} section there: node tools/version.ts --check)`;
    }, ["packs"]);
    await step("private", () => {
      const bad: string[] = [];
      for (const [k, p] of Object.entries(packs())) {
        const pkg = JSON.parse(readFileSync(join(p.stage, "package.json"), "utf8")) as { private?: boolean; publishConfig?: { provenance?: boolean }; repository?: { url?: string } };
        if (!ready && pkg.private !== true) bad.push(`${k} drops "private": publishing waits for O2`);
        if (ready && (pkg.private !== undefined || pkg.publishConfig?.provenance !== true || pkg.repository?.url !== REPOSITORY)) bad.push(`${k} isn't publishable: "private" dropped, publishConfig.provenance true and the repository ${REPOSITORY} wanted`);
      }
      if (bad.length) throw new Error(bad.join("\n"));
      return ready ? "every staged package.json publishable (no \"private\", provenance, the repository); none published" : "every staged package.json keeps \"private\": true (O2)";
    }, ["packs"]);
    await step("single file's licenses", () => {
      const text = readFileSync(state.single!.file, "utf8"), data = bundleData(readManifest());
      const want = [["the credits block", data.credits], ...Object.entries(data.licenses).map(([id, t]) => [`${id}'s text`, t.trimEnd()]), ["the code's MIT license", readFileSync(join(ROOT, "LICENSE"), "utf8").trimEnd()]];
      const lacking = want.filter(([, t]) => !text.includes(t!)).map(([w]) => w);
      if (lacking.length) throw new Error(`m3a.js lacks ${lacking.join(", ")}`);
      return `the credits block, ${Object.keys(data.licenses).join(", ")} and MIT, verbatim`;
    }, ["single"]);
    await step("license check", () => {
      const r = run(process.execPath, ["tools/license/main.ts", "check", "tools/bundle/manifest.json"], ROOT);
      if (!r.ok) throw new Error(`npm run license -- check tools/bundle/manifest.json fails:\n${r.out}`);
      return r.out.split("\n")[0]!;
    });
    await step("sensors", async () => {
      const m3a = (await import(pathToFileURL(state.single!.file).href)) as { openLibrary: () => { sets(): { set: string }[]; catalog(set: string): { id: string }[]; clip(id: string): LibraryClip }; metrics: (c: unknown, r: unknown) => { verdict: string; values: unknown } };
      const lib = m3a.openLibrary(), clips: LibraryClip[] = lib.sets().flatMap((s) => lib.catalog(s.set).map((r) => ({ ...lib.clip(r.id), set: s.set })));
      const rows = qa(clips), differ = clips.filter((c, i) => JSON.stringify(m3a.metrics(c.clip, c.rest).values) !== JSON.stringify(rows[i]!.values)).map((c) => c.clip.id);
      const { problems } = checkVerdicts(clips, rows);
      if (problems.length || differ.length) throw new Error([...problems, ...differ.map((id) => `${id}: m3a.js's sensors read it differently from the packages'`)].join("\n"));
      const pass = rows.filter((r) => r.verdict === "pass").length;
      return `${clips.length} clips: ${pass} pass, ${clips.length - pass} carry their baseline; m3a.js's sensors read each as the packages' do`;
    }, ["single"]);
    await step("examples", () => {
      // --example: a manual read as packages/tools/MANUAL.md is, or a program run alone as the complete example
      const file = typeof parsed.flags.example === "string" ? resolve(parsed.flags.example) : null, program = file !== null && !file.endsWith(".md");
      const md = file !== null && !program ? file : join(ROOT, "packages/tools/MANUAL.md"), where = relative(ROOT, md).startsWith("..") ? md : relative(ROOT, md);
      const manual = readFileSync(md, "utf8"), marked = headlessOf(manual, where);
      state.headless = marked === null ? { code: readFileSync(STANDIN, "utf8"), where: "tools/bundle/standin.ts" } : { code: marked, where: `${where}'s \`\`\`ts m3a.js block` };
      state.example = program ? { files: {}, program: readFileSync(file, "utf8"), sh: [], blocks: 1 } : completeExample(manual, where);
      return `the complete example: ${program ? `${parsed.flags.example} (--example)` : `${where}'s "${SECTION}" section`}; the headless one: ${state.headless.where}`;
    });
    await step("scratch install", () => {
      // three at the release @m3a/three takes as its peer (the pin)
      const three = (JSON.parse(readFileSync(join(ROOT, "packages/three/package.json"), "utf8")) as { peerDependencies: { three: string } }).peerDependencies.three;
      const dir = (state.scratch = mkdtempSync(join(tmpdir(), "m3a-pack-"))), deps: Record<string, string> = { three };
      mkdirSync(join(dir, "packs"));
      for (const [k, p] of Object.entries(packs())) {
        cpSync(p.tarball, join(dir, "packs", basename(p.tarball)));
        deps[`@m3a/${k}`] = `file:packs/${basename(p.tarball)}`;
      }
      writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "m3a-pack-check", private: true, type: "module", dependencies: deps }, null, 2)}\n`);
      const r = run("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline", "--loglevel=error"], dir);
      if (!r.ok) throw new Error(`npm install failed in ${dir}:\n${r.out}`);
      return `${Object.keys(deps).length} packages installed in ${dir}`;
    }, ["packs"]);
    await step("example on the packages", async () => {
      // what the manual says a game has beside the example's own files: a character (a generated test character)
      const ex = state.example!, dir = state.scratch!, { character, variant } = await import("../../packages/three/test-characters/index.ts");
      writeFileSync(join(dir, "character.glb"), character(variant(1)).glb);
      for (const [f, text] of Object.entries(ex.files)) writeFileSync(join(dir, f), text);
      writeFileSync(join(dir, "example.ts"), ex.program);
      const r = run(process.execPath, ["example.ts"], dir);
      if (!r.ok) throw new Error(`node example.ts failed in ${dir}:\n${r.out}`);
      for (const line of ex.sh) {
        const c = run("sh", ["-c", line.replace(/^(npx\s+)?m3a\s/, "npx --no m3a ")], dir);
        if (!c.ok) throw new Error(`${line} failed in ${dir}:\n${c.out}`);
      }
      return `${ex.blocks} ts block${ex.blocks === 1 ? "" : "s"} as one program, with ${[...Object.keys(ex.files), "character.glb"].join(", ")}; ${ex.sh.length} m3a call${ex.sh.length === 1 ? "" : "s"}, each exiting 0`;
    }, ["scratch", "example"]);
    await step("headless example on the packages", () => {
      writeFileSync(join(state.scratch!, "headless.ts"), state.headless!.code);
      const r = run(process.execPath, ["headless.ts"], state.scratch!);
      if (!r.ok) throw new Error(`node headless.ts (${state.headless!.where}) failed in ${state.scratch}:\n${r.out}`);
      state.printed = r.out;
      return r.out.trim().split("\n").pop()?.slice(0, 100) ?? "ran, printing nothing";
    }, ["scratch", "headless"]);
    await step("npx m3a", () => {
      const help = run("npx", ["--no", "m3a", "help"], state.scratch!), version = run("npx", ["--no", "m3a", "version"], state.scratch!);
      const v = (JSON.parse(readFileSync(join(ROOT, "packages/tools/package.json"), "utf8")) as { version: string }).version;
      if (!help.ok || !help.out.includes(`${TOOLS.length} tools`)) throw new Error(`npx m3a help:\n${help.out}`);
      if (!version.ok || !version.out.startsWith(`m3a ${v}`)) throw new Error(`npx m3a version:\n${version.out}`);
      return `${help.out.split("\n")[0]!.split(";")[0]}; ${version.out.split("\n")[0]}`;
    }, ["scratch"]);
    await step("m3a mcp", async () => {
      const names = await mcpTools(state.scratch!), want = TOOLS.map((t) => t.name.replace(/\./g, "_"));
      const missing = want.filter((n) => !names.includes(n));
      if (missing.length || names.length !== want.length) throw new Error(`tools/list gave ${names.length} tools, ${want.length} expected; missing: ${missing.join(", ") || "none"}`);
      return `tools/list answers ${names.length} tools`;
    }, ["scratch"]);
    await step("opt-in packs", () => {
      writeFileSync(join(state.scratch!, "packs.ts"), 'import { openLibrary } from "@m3a/library/node";\nconst all = openLibrary({ tiers: ["cc0", "cc-by", "cmu"] });\nall.verify();\nconsole.log(JSON.stringify({ alone: [...new Set(openLibrary().sets().map((s) => s.tier))], all: [...new Set(all.sets().map((s) => s.tier))], sets: all.sets().length }));\n');
      const r = run(process.execPath, ["packs.ts"], state.scratch!);
      const got = r.ok ? (JSON.parse(r.out.trim().split("\n").pop()!) as { alone: string[]; all: string[]; sets: number }) : null;
      if (!got || got.alone.join() !== "cc0" || got.all.sort().join() !== "cc-by,cc0,cmu") throw new Error(`openLibrary with the opt-in packs installed: ${r.out}`);
      return `openLibrary() sees cc0 alone; opted in, ${got.sets} sets of cc0, cc-by and cmu, verified`;
    }, ["scratch"]);
    await step("headless example on m3a.js", () => {
      const dir = mkdtempSync(join(tmpdir(), "m3a-single-"));
      try {
        cpSync(state.single!.file, join(dir, "m3a.js"));
        writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
        for (const [f, text] of Object.entries(state.example?.files ?? {})) writeFileSync(join(dir, f), text);
        writeFileSync(join(dir, "headless.ts"), forSingle(state.headless!.code, state.single!.exports));
        const r = run(process.execPath, ["headless.ts"], dir);
        if (!r.ok) throw new Error(`node headless.ts (${state.headless!.where}) on m3a.js failed:\n${r.out}`);
        if (state.printed !== undefined && r.out !== state.printed) throw new Error(`it prints otherwise than on the packages:\n${r.out}\n-- on the packages:\n${state.printed}`);
        return `${state.headless!.where}: the same output${state.printed === undefined ? "" : " as on the packages"}`;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, ["single", "headless"]);
    if (state.scratch && steps.every((s) => s.ok)) rmSync(state.scratch, { recursive: true, force: true });
  }
  const ms = performance.now() - t0, ok = steps.every((s) => s.ok), failed = steps.filter((s) => !s.ok).map((s) => s.name);
  const report: Report = {
    tool: "pack",
    ok,
    verdict: `pack${check ? " --check" : ""}: ${ok ? "PASS" : `FAIL (${failed.join(", ")})`} in ${fmtMs(ms)}; the packs in ${OUT.slice(ROOT.length + 1)}/`,
    steps,
    warnings: [],
    ms,
    next: ok ? (check ? "nothing is published (O2): the tarballs and m3a.js are in .cache/pack/" : "npm run pack -- --check proves them") : `fix the failing steps${state.scratch && !ok ? ` (the scratch project is kept: ${state.scratch})` : ""}`,
  };
  finish(report, parsed);
}
