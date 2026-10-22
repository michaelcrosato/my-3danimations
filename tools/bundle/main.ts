// `npm run pack [-- --check] [--example <file>] [--publishable]` (PLAN.md WP-7.4): every @m3a package built (ES modules
// with their declarations) and packed, the library's opt-in packs beside its CC0 default (D10), and the single file
// m3a.js, into .cache/pack/ (./build.ts, ./single.ts). --check also proves them, failing on any of: the default library
// pack holds a set that isn't cc0, or an opt-in pack another tier's; the m3a bin isn't dist/node.js with its shebang;
// the tools' pack lacks m3a's skill (skills/m3a/SKILL.md, the repository's, D119);
// the version rule fails (`node tools/version.ts --check`), a pack isn't at the version, or lacks CHANGELOG.md; a packed
// text file names the benchmark's graders, known-goods or held-out runs (D107); a staged
// package.json drops "private" (or, with --publishable, keeps it or lacks provenance); m3a.js lacks the credits block or
// a license text of its tiers; `npm run license -- check tools/bundle/manifest.json` fails; a clip m3a.js carries
// neither passes the sensors (WP-3.3) nor carries its WP-5.8 baseline (library/baselines/qa.json), or the sensors read
// it differently there; a scratch project outside the repository that installs the tarballs can't run the manual's
// complete example (./example.ts: its section's files, ts blocks and m3a calls, or --example's), `npx m3a help`,
// `npx m3a version`, or `m3a mcp` answering tools/list with every tool (./mcp.ts: a bin that can't start or never
// answers fails the step, the report still printed), or its openLibrary({ tiers }) doesn't find the installed opt-in
// packs; the complete example's headless form fails on the packages or on m3a.js, prints otherwise on the two, or plays
// otherwise than the example did on @m3a/three; or its m3a calls don't exit 0 on m3a.js too. That form is the same
// program, its imports of three.js's binding (bind, attach, loadGlb) and Node's PNG writer, which m3a.js leaves out by
// design (./single.ts), served by ./headless.ts, which binds and plays as @m3a/three does; it prints what those saw,
// every pose's fingerprint and each Animator's hash. On the packages the example runs with @m3a/three's player recorded
// the same way (./recorded.ts), which the headless form's record must equal; on m3a.js its m3a calls run through
// m3a.js's own runCli, the example's files given as text (./example.ts `callsOnSingle`). Nothing is published (O2).
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
import { BENCH_WORDS, build, OUT, REPOSITORY, TOOLS_FILES, type Packed } from "./build.ts";
import { callsOnSingle, completeExample, forSingle, headlessForm, PLAYED, RECORDED, recordedForm, sameRun, SECTION, STANDINS, type Example, type SingleCli } from "./example.ts";
import { mcpTools } from "./mcp.ts";
import { buildSingle, bundleData, readManifest } from "./single.ts";

const FLAGS = [
  { name: "check", help: "also prove the packs: a scratch install runs the manual's complete example and the m3a bin, its headless form runs there and on m3a.js, the sensors, tiers, version and licenses hold" },
  { name: "example", takesValue: true, help: "a manual (.md) whose complete example to run instead of packages/tools/MANUAL.md's, or a program (.ts) to run as the complete example" },
  { name: "publishable", help: "stage each package.json ready to publish: \"private\" dropped, publishConfig with provenance, the repository (nothing is published)" },
];
/** The stand-ins for what m3a.js leaves out, which the complete example's headless form imports. */
const HEADLESS_TS = readFileSync(join(import.meta.dirname, "headless.ts"), "utf8");
/** @m3a/three with its player recorded, which the complete example's recorded form imports. */
const RECORDED_TS = readFileSync(join(import.meta.dirname, "recorded.ts"), "utf8");

/** Runs a command, returning its exit status, its output and its stdout's last line; the scratch projects' commands
 *  run outside the repository. */
function run(cmd: string, args: readonly string[], cwd: string, input?: string): { ok: boolean; out: string; last: string } {
  const r = spawnSync(cmd, args, { cwd, input, encoding: "utf8", timeout: 300_000, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? String(r.error) : ""}`, last: (r.stdout ?? "").trimEnd().split("\n").pop() ?? "" };
}

/** Writes what the example reads into a project: its named json files, and character.glb (a generated test character,
 *  what the manual says a game has). */
function gameFiles(dir: string, ex: Example & { glb: Uint8Array }): void {
  for (const [f, text] of Object.entries(ex.files)) writeFileSync(join(dir, f), text);
  writeFileSync(join(dir, "character.glb"), ex.glb);
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
  const t0 = performance.now(), steps: Step[] = [], check = Boolean(parsed.flags.check), state: { packs?: Record<string, Packed>; single?: Awaited<ReturnType<typeof buildSingle>>; example?: Example & { where: string; glb: Uint8Array }; scratch?: string; printed?: string; played?: string } = {};
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
    await step("skill", () => {
      // an installed @m3a/tools gives an agent the skill beside the manual, the repository's as it is
      const p = packs().tools!, f = "skills/m3a/SKILL.md", from = join(ROOT, TOOLS_FILES["skills/m3a"]!, "SKILL.md");
      if (!p.files.includes(f)) throw new Error(`the @m3a/tools tarball lacks ${f}: an installed package would give an agent the manual but no skill`);
      if (readFileSync(join(p.stage, f), "utf8") !== readFileSync(from, "utf8")) throw new Error(`${f} in the tarball differs from the repository's ${relative(ROOT, from)}`);
      return `@m3a/tools ships ${f}, the repository's`;
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
    await step("no benchmark text", () => {
      // a fresh agent reads the installed packages: none may name the benchmark's graders, known-goods or held-out runs
      const bad: string[] = [];
      for (const [k, p] of Object.entries(packs()))
        for (const f of p.files.filter((x) => /\.(md|js|ts|json|txt)$/.test(x) || !x.includes(".")))
          if (BENCH_WORDS.test(readFileSync(join(p.stage, f), "utf8"))) bad.push(`${k}/${f} names ${BENCH_WORDS.exec(readFileSync(join(p.stage, f), "utf8"))![0]}`);
      if (bad.length) throw new Error(bad.join("\n"));
      return "no packed text file names the benchmark's graders, known-goods or held-out runs (the changelog as packedChangelog ships it)";
    }, ["packs"]);
    await step("private", () => {
      const bad: string[] = [];
      for (const [k, p] of Object.entries(packs())) {
        const pkg = JSON.parse(readFileSync(join(p.stage, "package.json"), "utf8")) as { private?: boolean; publishConfig?: { provenance?: boolean }; repository?: { url?: string } };
        if (!ready && pkg.private !== true) bad.push(`${k} drops "private": the workspace's packs stay private, publish.yml stages them with --publishable`);
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
    await step("examples", async () => {
      // --example: a manual read as packages/tools/MANUAL.md is, or a program run alone as the complete example; with
      // it, what the manual says a game has beside the example's own files: a character (a generated test character)
      const file = typeof parsed.flags.example === "string" ? resolve(parsed.flags.example) : null, program = file !== null && !file.endsWith(".md");
      const md = file !== null && !program ? file : join(ROOT, "packages/tools/MANUAL.md"), shown = (f: string) => (relative(ROOT, f).startsWith("..") ? f : relative(ROOT, f));
      const ex = program ? { files: {}, program: readFileSync(file, "utf8"), sh: [], blocks: 1 } : completeExample(readFileSync(md, "utf8"), shown(md));
      const { character, variant } = await import("../../packages/three/test-characters/index.ts");
      state.example = { ...ex, where: program ? shown(file) : `${shown(md)}'s "${SECTION}" section`, glb: character(variant(1)).glb };
      return `the complete example: ${state.example.where}${program ? " (--example)" : ""}`;
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
    await step("example on the packages", () => {
      // the program as written, @m3a/three's player recorded (./recorded.ts), which the headless form is held to
      const ex = state.example!, dir = state.scratch!;
      gameFiles(dir, ex);
      writeFileSync(join(dir, STANDINS), HEADLESS_TS);
      writeFileSync(join(dir, RECORDED), RECORDED_TS);
      writeFileSync(join(dir, "example.ts"), recordedForm(ex.program));
      const r = run(process.execPath, ["example.ts"], dir);
      if (!r.ok) throw new Error(`node example.ts failed in ${dir}:\n${r.out}`);
      if (!r.last.startsWith("{")) throw new Error(`node example.ts printed no record of @m3a/three's players last (./recorded.ts), but: ${r.last}`);
      state.played = r.last;
      for (const line of ex.sh) {
        const c = run("sh", ["-c", line.replace(/^(npx\s+)?m3a\s/, "npx --no m3a ")], dir);
        if (!c.ok) throw new Error(`${line} failed in ${dir}:\n${c.out}`);
      }
      const hashes = (JSON.parse(r.last) as { hashes: string[] }).hashes;
      return `${ex.blocks} ts block${ex.blocks === 1 ? "" : "s"} as one program, with ${[...Object.keys(ex.files), "character.glb"].join(", ")} (Animator ${hashes.join(", ") || "none attached"}); ${ex.sh.length} m3a call${ex.sh.length === 1 ? "" : "s"}, each exiting 0`;
    }, ["scratch", "example"]);
    await step("headless example on the packages", () => {
      const ex = state.example!, dir = state.scratch!;
      gameFiles(dir, ex);
      writeFileSync(join(dir, STANDINS), HEADLESS_TS);
      writeFileSync(join(dir, "headless-example.ts"), headlessForm(ex.program));
      const r = run(process.execPath, ["headless-example.ts"], dir);
      if (!r.ok) throw new Error(`node headless-example.ts (${ex.where}, headless) failed in ${dir}:\n${r.out}`);
      state.printed = r.out;
      const differ = state.played === undefined ? [] : sameRun(state.played, r.last);
      if (differ.length) throw new Error(`it plays otherwise than the example on @m3a/three:\n${differ.join("\n")}`);
      return `${state.played === undefined ? "ran" : `plays as on @m3a/three, bit for bit (${PLAYED.join(", ")})`}: ${r.last.slice(0, 100)}`;
    }, ["scratch", "example"]);
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
    await step("headless example on m3a.js", async () => {
      const ex = state.example!, dir = mkdtempSync(join(tmpdir(), "m3a-single-"));
      try {
        cpSync(state.single!.file, join(dir, "m3a.js"));
        writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
        gameFiles(dir, ex);
        writeFileSync(join(dir, STANDINS), forSingle(HEADLESS_TS, state.single!.exports));
        writeFileSync(join(dir, "headless-example.ts"), forSingle(headlessForm(ex.program), state.single!.exports));
        const r = run(process.execPath, ["headless-example.ts"], dir);
        if (!r.ok) throw new Error(`node headless-example.ts (${ex.where}, headless) on m3a.js failed:\n${r.out}`);
        if (state.printed !== undefined && r.out !== state.printed) throw new Error(`it prints otherwise than on the packages:\n${r.out}\n-- on the packages:\n${state.printed}`);
        // its m3a calls on m3a.js itself: its runCli, the example's files given as text (m3a.js reads no files)
        const m3a = (await import(pathToFileURL(state.single!.file).href)) as SingleCli, said = await callsOnSingle(m3a, ex.sh, { ...ex.files, "character.glb": ex.glb });
        return `${ex.where}, headless: ${state.printed === undefined ? "ran" : "the same output as on the packages, bit for bit"}; ${said.length} m3a call${said.length === 1 ? "" : "s"} through m3a.js's runCli, each exiting 0`;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, ["single", "example"]);
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
    next: ok ? (check ? "nothing is published here (publish.yml publishes, D130): the tarballs and m3a.js are in .cache/pack/" : "npm run pack -- --check proves them") : `fix the failing steps${state.scratch && !ok ? ` (the scratch project is kept: ${state.scratch})` : ""}`,
  };
  finish(report, parsed);
}
