// `npm run pack [-- --check] [--example <file>]` (PLAN.md WP-7.4): every @m3a package built (ES modules with their
// declarations) and packed, the library's opt-in packs beside its CC0 default (D10), and the single file m3a.js, into
// .cache/pack/ (./build.ts, ./single.ts). --check also proves them, failing on any of: the default library pack holds a
// set that isn't cc0, or an opt-in pack another tier's; the m3a bin isn't dist/node.js with its shebang; m3a.js lacks
// the credits block or a license text of its tiers; `npm run license -- check tools/bundle/manifest.json` fails; a clip
// m3a.js carries neither passes the sensors (WP-3.3) nor carries its WP-5.8 baseline (library/baselines/qa.json), or
// the sensors read it differently there; a scratch project outside the repository that installs the tarballs can't run
// the manual's complete example (./example.ts: the ```ts example block, or --example's file), `npx m3a help`,
// `npx m3a version`, or `m3a mcp` answering tools/list with every tool, or its openLibrary({ tiers }) doesn't find the
// installed opt-in packs; m3a.js can't run the same example, or prints anything else. Nothing is published (O2).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TOOLS } from "../../packages/tools/src/index.ts";
import { checkVerdicts } from "../qa/library.ts";
import { qa, type LibraryClip } from "../qa/qa.ts";
import { finish, fmtMs, parseArgs, ROOT, usage, type Report, type Step } from "../run/cli.ts";
import { build, OUT, type Packed } from "./build.ts";
import { exampleOf, forSingle } from "./example.ts";
import { buildSingle, bundleData, readManifest } from "./single.ts";

const FLAGS = [
  { name: "check", help: "also prove the packs: a scratch install runs the manual's example and the m3a bin, m3a.js runs it too, the sensors, tiers and licenses hold" },
  { name: "example", takesValue: true, help: "run this file as the complete example instead of MANUAL.md's ```ts example block (tools/bundle/standin.ts)" },
];

/** Runs a command, returning its exit status and output; the scratch projects' commands run outside the repository. */
function run(cmd: string, args: readonly string[], cwd: string, input?: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, input, encoding: "utf8", timeout: 300_000, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? String(r.error) : ""}` };
}

/** `m3a mcp` in `cwd` asked to initialize and list its tools: the tool names it answers with. */
async function mcpTools(cwd: string): Promise<string[]> {
  const child = spawn(join(cwd, "node_modules/.bin/m3a"), ["mcp"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  let buf = "", err = "";
  child.stderr.on("data", (d) => (err += String(d)));
  const listed = new Promise<string[]>((ok, fail) => {
    child.stdout.on("data", (d) => {
      const lines = (buf + String(d)).split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        let m: { id?: number; result?: { tools?: { name: string }[] } };
        try {
          m = JSON.parse(line) as typeof m;
        } catch {
          return fail(new Error(`m3a mcp wrote a line that isn't JSON-RPC: ${line}`));
        }
        if (m.id === 2) return m.result?.tools ? ok(m.result.tools.map((t) => t.name)) : fail(new Error(`tools/list answered ${line}`));
      }
    });
    child.on("exit", (code) => fail(new Error(`m3a mcp exited (${code}) before answering tools/list${err ? `: ${err.trim()}` : ""}`)));
  });
  const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "m3a-pack", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  try {
    return await listed;
  } finally {
    child.stdin.end();
    child.kill();
  }
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
  const t0 = performance.now(), steps: Step[] = [], check = Boolean(parsed.flags.check), state: { packs?: Record<string, Packed>; single?: Awaited<ReturnType<typeof buildSingle>>; example?: string; scratch?: string; printed?: string } = {};
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
  await step("build and pack", () => {
    state.packs = build(OUT);
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
    await step("example source", () => {
      const file = parsed.flags.example;
      state.example = typeof file === "string" ? readFileSync(resolve(file), "utf8") : exampleOf(readFileSync(join(ROOT, "packages/tools/MANUAL.md"), "utf8"));
      return typeof file === "string" ? `${file} (--example)` : "MANUAL.md's ```ts example block";
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
      writeFileSync(join(state.scratch!, "example.ts"), state.example!);
      const r = run(process.execPath, ["example.ts"], state.scratch!);
      if (!r.ok) throw new Error(`node example.ts failed in ${state.scratch}:\n${r.out}`);
      state.printed = r.out;
      return r.out.trim().split("\n").pop()?.slice(0, 100) ?? "ran, printing nothing";
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
    await step("example on m3a.js", () => {
      const dir = mkdtempSync(join(tmpdir(), "m3a-single-"));
      try {
        cpSync(state.single!.file, join(dir, "m3a.js"));
        writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
        writeFileSync(join(dir, "example.ts"), forSingle(state.example!, state.single!.exports));
        const r = run(process.execPath, ["example.ts"], dir);
        if (!r.ok) throw new Error(`node example.ts on m3a.js failed:\n${r.out}`);
        if (state.printed !== undefined && r.out !== state.printed) throw new Error(`it prints otherwise than on the packages:\n${r.out}\n-- on the packages:\n${state.printed}`);
        return `the same output${state.printed === undefined ? "" : " as on the packages"}`;
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
    next: ok ? (check ? "nothing is published (O2): the tarballs and m3a.js are in .cache/pack/" : "npm run pack -- --check proves them") : `fix the failing steps${state.scratch && !ok ? ` (the scratch project is kept: ${state.scratch})` : ""}`,
  };
  finish(report, parsed);
}
