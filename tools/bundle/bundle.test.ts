// The packaging's cheap parts (WP-7.4), in T1: the bundle's manifest (a CC0 game manifest whose clips the library has,
// every clip the manual's complete example names among them), the tier filter that keeps cc-by and cmu sets out of the
// default library pack, the workspace's package.json files (every path one names is a file the workspace has, so a
// fresh install links the m3a bin) and the published ones (exports, types and the m3a bin pointed at dist/, the bin
// with its shebang, CHANGELOG.md, three's types an optional peer, the library's license naming its clips', "private"
// kept unless made publishable), the subset m3a.js carries, the library it opens and its runCli running m3a calls on
// the example's files given as text, the manual's complete example as the extractor reads it, its recorded form (the
// program on @m3a/three, its player recorded), its headless form and the stand-ins it imports (binding and playing as
// @m3a/three does, bit for bit, the two records equal), its rewrite for m3a.js, its sh lines read as sh reads them, and
// how the check's `m3a mcp` step fails (a bin missing, unable to start, exiting, writing what isn't JSON-RPC, never
// answering: each a failure, not a crash or a hang; fake bins, the timeout on fake timers). The end-to-end `npm run pack
// -- --check` (a build, npm pack, a scratch install, m3a.js run) is slow, and runs in the gate (G7), not here.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Animator, playable } from "../../packages/core/src/index.ts";
import { checkGame } from "../../packages/library/src/index.ts";
import { directory, licenseText, openLibrary } from "../../packages/library/src/node.ts";
import * as threeApi from "../../packages/three/src/index.ts";
import { character, loadGlb, variant } from "../../packages/three/test-characters/index.ts";
import { runCli, tools } from "../../packages/tools/src/index.ts";
import { ROOT } from "../run/cli.ts";
import { BENCH_WORDS, jsSpecifiers, PACKAGES, packedChangelog, packSets, publishable, publishedExports, publishedManifest, REPOSITORY, stagedManifest, tiersOf, withDataLicenses } from "./build.ts";
import { argvOf, callsOnSingle, completeExample, forSingle, HEADLESS, headlessForm, importsOf, PLAYED, RECORDED, recordedForm, sameRun, SECTION, STANDINS } from "./example.ts";
import * as headless from "./headless.ts";
import { MCP_TIMEOUT_MS, mcpTools } from "./mcp.ts";
import * as recorded from "./recorded.ts";
import { bundled } from "./runtime.ts";
import { bundleData, ENTRIES, namesOf, OWN, readManifest } from "./single.ts";

const pkgOf = (p: string) => JSON.parse(readFileSync(join(ROOT, "packages", p, "package.json"), "utf8")) as Record<string, unknown>;
const SETS = join(ROOT, "library/sets");

describe("the bundle's manifest", () => {
  it("is a game manifest of CC0 clips the library has, and passes the license check", () => {
    const m = readManifest();
    expect(Object.keys(m).every((k) => ["game", "tiers", "clips", "ships"].includes(k))).toBe(true);
    expect(m.tiers).toEqual(["cc0"]);
    expect(m.clips!.length).toBeGreaterThan(20);
    expect(new Set(m.clips).size).toBe(m.clips!.length);
    const tiers = tiersOf();
    expect(m.clips!.filter((id) => tiers[id.split("/")[0]!] !== "cc0")).toEqual([]);
    expect(checkGame(directory(SETS), m, licenseText(SETS, []))).toMatchObject({ ok: true, findings: [] });
  });
  it("carries every library clip the manual's complete example names, so m3a.js runs it", () => {
    const ex = completeExample(readFileSync(join(ROOT, "packages/tools/MANUAL.md"), "utf8")), tiers = tiersOf();
    const named = [...new Set([...Object.values(ex.files), ex.program].flatMap((t) => [...t.matchAll(/"([A-Z][A-Z0-9_]*\/\w+)"/g)].map((m) => m[1]!)))].filter((id) => tiers[id.split("/")[0]!]);
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((id) => !readManifest().clips!.includes(id))).toEqual([]);
  });
});

describe("the changelog a pack ships", () => {
  // D107: the packs carried the repository's whole changelog, whose Repo lines describe the briefs' graders and
  // known-good solutions; a fresh agent grepping node_modules read it
  const text = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8"), packed = packedChangelog(text);
  it("keeps every release heading and the parts a consumer reads, without the Repo sections or a benchmark line", () => {
    expect(packed.match(/^## /gm)?.length).toBe(text.match(/^## /gm)?.length);
    expect(packed).not.toMatch(/^### Repo$/m);
    expect(BENCH_WORDS.test(packed)).toBe(false);
    expect(packed).toContain("### Core");
  });
  it("drops a bullet whole, its continuation lines too, and a section it leaves empty", () => {
    const t = "## 1.0.0 · 2026-01-01\n\n### Tools\n- a tool\n  that wraps\n- B1's known-good\n  moves\n\n### Repo\n- CI\n\n### Spec\n- a grader, shown\n";
    expect(packedChangelog(t)).toBe("## 1.0.0 · 2026-01-01\n\n### Tools\n- a tool\n  that wraps\n\n");
  });
});

describe("the library's packs", () => {
  it("keeps cc-by and cmu sets out of the default pack, each opt-in pack its tier's alone, and local sets out of all", () => {
    expect(packSets({ A: "cc0", B: "local", C: "cc-by", D: "cmu", E: "cc0" })).toEqual({ library: ["A", "E"], "library-cc-by": ["C"], "library-cmu": ["D"] });
    const tiers = tiersOf(), packs = packSets(tiers);
    expect(packs.library!.length).toBeGreaterThan(0);
    for (const [pack, tier] of [["library", "cc0"], ["library-cc-by", "cc-by"], ["library-cmu", "cmu"]]) expect(packs[pack!]!.filter((s) => tiers[s] !== tier)).toEqual([]);
    expect(Object.values(packs).flat().sort()).toEqual(Object.keys(tiers).filter((s) => tiers[s] !== "local").sort());
  });
});

describe("the published package.json", () => {
  it("points every export at dist/ with its declarations, and keeps the package private until O2", () => {
    expect(publishedExports({ ".": "./src/index.ts", "./node": "./src/node.ts", "./test-characters": "./test-characters/index.ts" })).toEqual({
      ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
      "./node": { types: "./dist/node.d.ts", default: "./dist/node.js" },
      "./test-characters": { types: "./dist/test-characters/index.d.ts", default: "./dist/test-characters/index.js" },
    });
    for (const p of PACKAGES) {
      const src = pkgOf(p), out = publishedManifest(src);
      expect([p, src.private, out.private, src.types, out.types, (src.files as string[])[0]]).toEqual([p, true, true, "./src/index.ts", "./dist/index.d.ts", "dist"]);
      expect(Object.keys(out)).not.toContain("devDependencies");
      expect(Object.keys(out.exports as object)).toEqual(Object.keys(src.exports as object));
      expect([p, out.files]).toEqual([p, [...(src.files as string[]), "CHANGELOG.md"]]);
      expect([p, out.version]).toEqual([p, pkgOf("core").version]);
    }
  });
  it("names three's types an optional peer of @m3a/three, at the version its declarations were written against", () => {
    const three = pkgOf("three"), out = publishedManifest(three), types = (three.devDependencies as Record<string, string>)["@types/three"];
    expect([out.peerDependencies, out.peerDependenciesMeta]).toEqual([{ three: (three.peerDependencies as Record<string, string>).three, "@types/three": types }, { "@types/three": { optional: true } }]);
    expect(Object.keys(publishedManifest(pkgOf("core")))).not.toContain("peerDependenciesMeta");
  });
  it("declares the library's clips' licenses beside the code's: the default pack ships CC0 data", () => {
    expect(withDataLicenses("MIT", ["CC0-1.0"])).toBe("MIT AND CC0-1.0");
    expect(withDataLicenses("MIT", ["MIT", "CC-BY-4.0"])).toBe("MIT AND CC-BY-4.0");
    expect([stagedManifest("library", packSets(tiersOf()).library!).license, stagedManifest("core", []).license]).toEqual(["MIT AND CC0-1.0", "MIT"]);
  });
  it("makes a staged copy publishable only when asked (O2): no \"private\", provenance, the repository it is built from", () => {
    const out = publishable(publishedManifest(pkgOf("core")), "packages/core");
    expect([out.private, out.publishConfig, out.repository]).toEqual([undefined, { access: "public", provenance: true }, { type: "git", url: REPOSITORY, directory: "packages/core" }]);
    expect(pkgOf("core").private).toBe(true);
  });
  it("names only files the workspace has, in every workspace package.json: a fresh install links the m3a bin", () => {
    // a path to what only npm run pack builds (dist/) links no bin after `npm ci`, and `npx m3a` then asks the registry
    for (const p of PACKAGES) {
      const src = pkgOf(p), paths = [...Object.values(src.exports as Record<string, string>), src.types as string, ...Object.values((src.bin ?? {}) as Record<string, string>)];
      expect([p, paths.filter((f) => !existsSync(join(ROOT, "packages", p, f)))]).toEqual([p, []]);
    }
    const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8")) as { packages: Record<string, { bin?: Record<string, string> }> };
    expect(lock.packages["packages/tools"]!.bin).toEqual({ m3a: "src/node.ts" });
  });
  it("runs the workspace's m3a bin from src/node.ts and the published one from dist/node.js, the ./node entry, its shebang kept", () => {
    const tools = pkgOf("tools"), out = publishedManifest(tools);
    expect([tools.bin, out.bin]).toEqual([{ m3a: "./src/node.ts" }, { m3a: "./dist/node.js" }]);
    expect((out.exports as Record<string, { default: string }>)["./node"]!.default).toBe("./dist/node.js");
    expect(stripTypeScriptTypes(readFileSync(join(ROOT, "packages/tools/src/node.ts"), "utf8"), { mode: "strip" }).startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(jsSpecifiers(`import { a } from "./x.ts";\nexport * from "../y/z.ts";\nawait import("./w.ts");\nimport "./v.ts";\nimport t from "three";`)).toBe(`import { a } from "./x.js";\nexport * from "../y/z.js";\nawait import("./w.js");\nimport "./v.js";\nimport t from "three";`);
  });
});

describe("the subset m3a.js carries", () => {
  const data = bundleData(readManifest());
  it("holds the manifest's clips with their catalog rows, a lock over them, CC0's text and the credits block", () => {
    const ids = Object.entries(data.sets).flatMap(([s, f]) => Object.keys(f).filter((x) => !x.startsWith("_") && x.endsWith(".json")).map((x) => `${s}/${x.slice(0, -5)}`));
    expect(ids.sort()).toEqual([...readManifest().clips!].sort());
    for (const [s, files] of Object.entries(data.sets)) expect(files["catalog.tsv"]!.trim().split("\n").map((l) => l.split("\t")[0]).sort()).toEqual(ids.filter((id) => id.startsWith(`${s}/`)));
    expect(Object.keys(data.licenses)).toEqual(["CC0-1.0"]);
    expect(data.credits).toBe("Motion: CC0 clips from the m3a library; no credit is owed.");
    expect(() => bundleData({ tiers: ["cc0", "cc-by"], clips: [] })).toThrow(/carries CC0 clips alone/);
    expect(() => bundleData({ tiers: ["cc0"], clips: ["STYLE100_IDLE/x"] })).toThrow(/fails the license check/);
  });
  it("opens as the packages' library does, verified, with the tools' host; another tier warns", async () => {
    const said: string[] = [], { openLibrary, host } = bundled(data);
    const lib = openLibrary({ tiers: ["cc0", "cc-by"], warn: (m) => said.push(m) });
    expect(() => lib.verify()).not.toThrow();
    expect(lib.clip("QUATERNIUS_3D2DGE/Punch_Jab").tier).toBe("cc0");
    expect(said).toEqual(["m3a.js carries CC0 clips alone (tools/bundle/manifest.json), no cc-by set: the packages carry them (npm install @m3a/library @m3a/library-cc-by)"]);
    expect(host.library!().library.search("jab").rows[0]!.id).toBe("QUATERNIUS_3D2DGE/Punch_Jab");
    // what opening it warned goes to every call it serves, not the first alone
    expect([host.library!(["cc0", "cc-by"]).warnings, host.library!(["cc0", "cc-by"]).warnings, host.library!().warnings]).toEqual([said, said, []]);
  });
  it("runs m3a calls through its runCli as the bin does, the files given as text, each call's writes kept for the next", async () => {
    const { host } = bundled(data), m3a = { runCli, tools, host };
    const files = { "jab.json": '{ "format": "2.0", "id": "KNIGHT/Jab", "steps": [{ "op": "clip", "id": "QUATERNIUS_3D2DGE/Punch_Jab", "as": "jab" }] }', "g.json": '{ "format": "2.0", "id": "GRAPHS/Jab", "start": "jab", "states": { "jab": { "clip": "KNIGHT/Jab" } }, "transitions": [] }' };
    // its host alone reads no files: a tool given a path answers E_HOST
    expect((await tools.call("recipe.compile", { recipe: "jab.json" }, { host })).error).toMatchObject({ code: "E_HOST", message: expect.stringMatching(/reads no files \(jab\.json\); pass the text instead/) });
    const said = await callsOnSingle(m3a, ["npx m3a recipe.compile jab.json      # writes check-output/recipe.compile/Jab.clip.json", "m3a graph.validate ./g.json --clips check-output/recipe.compile/Jab.clip.json"], files);
    expect(said.map((l) => l.split(":")[0])).toEqual(["recipe.compile jab.json", "graph.validate ./g.json"]);
    await expect(callsOnSingle(m3a, ["m3a graph.validate g.json"], files)).rejects.toThrow(/^m3a graph\.validate g\.json exits 1 on m3a\.js:\n[^]*G-E009 states\.jab: clip KNIGHT\/Jab is not among the clips given/);
    await expect(callsOnSingle(m3a, ["m3a recipe.compile nope.json"], files)).rejects.toThrow(/^m3a recipe\.compile nope\.json exits 1 on m3a\.js:\n[^]*no file nope\.json: the example has none, and no call before this one wrote it/);
  });
  it("gives every entry's names once: VERSION core's, PACKAGE m3a.js's own", async () => {
    const names = await namesOf(), all = [...OWN, ...Object.values(names).flat()];
    expect(Object.keys(names)).toEqual([...ENTRIES]);
    expect(new Set(all).size).toBe(all.length);
    expect(names["@m3a/core"]).toContain("VERSION");
    expect(["Animator", "metrics", "readGltf", "Library", "tools"].every((n) => all.includes(n))).toBe(true);
    // the stand-ins the complete example's headless form imports run on it too
    expect(() => forSingle(readFileSync(join(import.meta.dirname, "headless.ts"), "utf8"), all)).not.toThrow();
  });
});

describe("the complete example", () => {
  const manual = [
    "# m", "", "## Find", "```ts", "not it", "```", "",
    `${SECTION}: walk, attack, react`, "", "```json slash.json", '{ "id": "A/B" }', "```", "",
    "```ts", 'import { Animator, playable } from "@m3a/core";', 'import { readFileSync } from "node:fs";', "const a = new Animator(1);", "```", "",
    "```json", '{ "unnamed": true }', "```",
    "```ts", 'import { playable, recipe } from "@m3a/core";', 'import * as THREE from "three";', "const b = playable(a);", "```", "",
    "```ts norun", "skipped();", "```",
    "```sh", "npx m3a recipe.compile slash.json      # writes check-output/", "m3a graph.sim k.json \\", "  --script s.json", "```", "",
    "## Next", "```ts m3a.js", "const h = 1;", "```", "```ts", "after();", "```", "",
  ].join("\n");
  it(`is the manual's "${SECTION}" section: its named json files, its ts blocks as one program, its m3a calls`, () => {
    expect(completeExample(manual)).toEqual({
      files: { "slash.json": '{ "id": "A/B" }\n' },
      program: ['import { Animator, playable, recipe } from "@m3a/core";', 'import { readFileSync } from "node:fs";', 'import * as THREE from "three";', "const a = new Animator(1);\n", "const b = playable(a);\n"].join("\n"),
      sh: ["npx m3a recipe.compile slash.json      # writes check-output/", "m3a graph.sim k.json    --script s.json"],
      blocks: 2,
    });
  });
  it("fails naming the heading when the manual has no such section or no ts block in it, and refuses what can't run there", () => {
    const none = /has no complete example: a section headed "## A complete example\.\.\." with a ```ts block in it/;
    expect(() => completeExample("# m\n## Find\n```ts\nconst a = 1;\n```\n")).toThrow(none);
    expect(() => completeExample(`# m\n${SECTION}\n\`\`\`json a.json\n{}\n\`\`\`\n`)).toThrow(none);
    expect(() => completeExample(`${SECTION}\n\`\`\`ts\nx;\n\`\`\`\n\`\`\`sh\nrm -rf /\n\`\`\`\n`)).toThrow(/:5: "rm -rf \/" in the complete example isn't an m3a call/);
    expect(() => completeExample(`${SECTION}\n\`\`\`ts\nx;\n\`\`\`\n\`\`\`json ../a.json\n{}\n\`\`\`\n`)).toThrow(/:5: "\.\.\/a\.json" isn't a file name/);
    expect(() => completeExample(`${SECTION}\n\`\`\`ts\nx;\n`)).toThrow(/MANUAL\.md:2: a fenced block left open/);
    const today = readFileSync(join(ROOT, "packages/tools/MANUAL.md"), "utf8");
    if (today.split("\n").some((l) => l.startsWith(SECTION))) expect(completeExample(today).blocks).toBeGreaterThan(0);
    else expect(() => completeExample(today)).toThrow(none);
  });
  it("runs headless as the same program, three.js's binding and Node's PNG writer taken from the stand-ins, what they saw printed", () => {
    const code = 'import { Animator } from "@m3a/core";\nimport { attach, bind } from "@m3a/three";\nimport { readFileSync } from "node:fs";\nimport { loadGlb } from "@m3a/three/test-characters";\nconst a = 1;\nimport { writePng } from "@m3a/sensors/node";\nwritePng("x.png", a);\n';
    expect(headlessForm(code)).toBe(['import { Animator } from "@m3a/core";', `import { attach, bind, loadGlb, writePng, headlessReport } from "${STANDINS}";`, 'import { readFileSync } from "node:fs";', "const a = 1;", 'writePng("x.png", a);\n', "console.log(headlessReport());\n"].join("\n"));
    // the stand-ins, what they saw, and that record (which ./recorded.ts keeps of three's own player)
    expect(Object.keys(headless).sort()).toEqual([...Object.values(HEADLESS).flat(), "headlessReport", "record"].sort());
    expect(() => headlessForm('import { bind, bake } from "@m3a/three";\nimport * as T from "@m3a/three/test-characters";\n')).toThrow(/can't run headless: it imports bake from "@m3a\/three" \(tools\/bundle\/headless\.ts stands in for bind and attach alone\); the namespace from "@m3a\/three\/test-characters"/);
  });
  it("runs on the packages as written, @m3a/three's names from ./recorded.ts, what its players saw printed", () => {
    const code = 'import { attach, bind } from "@m3a/three";\nimport { loadGlb } from "@m3a/three/test-characters";\nconst t = await import("@m3a/three");\nbind(1);\n';
    expect(recordedForm(code)).toBe([`import { attach, bind, recordedReport } from "${RECORDED}";`, 'import { loadGlb } from "@m3a/three/test-characters";', `const t = await import("${RECORDED}");`, "bind(1);\n", "console.log(recordedReport());\n"].join("\n"));
    // every name @m3a/three gives, attach its own recorded
    expect(Object.keys(recorded).sort()).toEqual([...Object.keys(threeApi), "recordedReport"].sort());
    expect(recorded.attach).not.toBe(threeApi.attach);
  });
  it("binds and plays headless as @m3a/three does: the same Animator, every step, bit for bit, and the same travel", async () => {
    const glb = character(variant(1)).glb, library = openLibrary(), { clip, rest } = library.clip("QUATERNIUS_3D2DGE/Walk_Loop");
    const three = threeApi.bind((await loadGlb(glb, { textures: false })).scene), alone = headless.bind((await headless.loadGlb(glb)).scene);
    const a = new Animator(three.core).layer("base", { clip: playable(clip, rest) }), b = new Animator(alone.core).layer("base", { clip: playable(clip, rest) });
    const pa = recorded.attach(a, three), pb = headless.attach(b, alone);
    expect([pa.animator, pa.bound, typeof pa.apply]).toEqual([a, three, "function"]); // three's own player
    for (let i = 0; i < 20; i++) {
      pa.update(1 / 60);
      pb.update(1 / 60);
      expect([i, b.hash(), pb.travel.x, pb.travel.y, pb.travel.z]).toEqual([i, a.hash(), pa.travel.x, pa.travel.y, pa.travel.z]);
    }
    expect(JSON.parse(headless.headlessReport())).toMatchObject({ updates: 20, hashes: [a.hash()] });
    // the record of three's player is the stand-ins' record, bit for bit: what pack --check holds the example's runs to
    const real = recorded.recordedReport();
    expect([JSON.parse(real), sameRun(real, headless.headlessReport())]).toMatchObject([{ updates: 20, hashes: [a.hash()] }, []]);
    expect(PLAYED.every((k) => k in JSON.parse(real))).toBe(true);
    const off = JSON.stringify({ ...JSON.parse(real), hashes: ["0"], images: ["x.png 1x1 0"] });
    expect(sameRun(real, off)).toEqual([`hashes: ${JSON.stringify([a.hash()])} on @m3a/three, ["0"] headless`]);
    const scene = (await headless.loadGlb(glb)).scene;
    expect(() => headless.bind(scene, { mapping: { bones: {} } })).toThrow(/stands in for bind\(scene\) alone/);
  });
  it("reads an m3a call's words as sh does, and refuses what only a shell makes something of, naming the line", () => {
    const line = `npx m3a graph.sim k.json --mapping='{"bones": {"hips": "x"}}' --note="a \\"b\\" \\c" x\\ y #  a comment`;
    const words = argvOf(line);
    expect(words).toEqual(["graph.sim", "k.json", '--mapping={"bones": {"hips": "x"}}', '--note=a "b" \\c', "x y"]);
    const sh = spawnSync("sh", ["-c", `printf '%s\\0' ${line.replace(/^npx m3a /, "")}`], { encoding: "utf8" });
    expect(sh.stdout.split("\0").slice(0, -1)).toEqual(words);
    expect(argvOf("m3a search jab")).toEqual(["search", "jab"]);
    for (const [bad, what] of [["m3a search jab > out.txt", '">"'], ['m3a search "$HOME"', '"\\$"'], ["m3a lint *.json", '"\\*"'], ["m3a search a; rm x", '";"']]) {
      expect(() => argvOf(bad!)).toThrow(new RegExp(`^"${bad!.replace(/[.*$;]/g, "\\$&")}" can't run on m3a\\.js: ${what} needs a shell`));
    }
    expect(() => argvOf("m3a search 'open")).toThrow(/^"m3a search 'open" can't run on m3a\.js: a ' quote is left open$/);
    expect(() => argvOf("node x.js")).toThrow(/"node x\.js" isn't an m3a call/);
  });
  it("runs on m3a.js with its @m3a imports from ./m3a.js, and refuses what m3a.js leaves out, naming it", () => {
    const code = `import { Animator, type Clip } from "@m3a/core";\nimport type { Tier } from "@m3a/library";\nimport { openLibrary } from "@m3a/library/node";\nimport { writeFileSync } from "node:fs";\nconst t = await import("@m3a/tools");\n`;
    expect(importsOf(code).map((i) => [i.from, i.names])).toEqual([["@m3a/core", ["Animator"]], ["@m3a/library/node", ["openLibrary"]], ["node:fs", ["writeFileSync"]], ["@m3a/tools", ["*"]]]);
    expect(forSingle(code, ["Animator", "openLibrary"])).toBe(code.replace(/"@m3a\/[\w/]+"/g, '"./m3a.js"'));
    expect(() => forSingle(`import { bind } from "@m3a/three";\nimport * as THREE from "three";\n`, [])).toThrow(/imports "@m3a\/three" \(m3a\.js leaves it out.*; "three"/);
    expect(() => forSingle(`import { writePng } from "@m3a/sensors/node";\n`, [])).toThrow(/"@m3a\/sensors\/node"/);
    expect(() => forSingle(`import { Animator, Nope } from "@m3a/core";\n`, ["Animator"])).toThrow(/Nope from "@m3a\/core" \(m3a\.js doesn't export it\)/);
  });
});

describe("the check's m3a mcp step", () => {
  /** A scratch project whose node_modules/.bin/m3a is `script` (a shell script; not executable when `exec` is false). */
  const project = (script: string | null, exec = true) => {
    const dir = mkdtempSync(join(tmpdir(), "m3a-mcp-")), bin = join(dir, "node_modules/.bin/m3a");
    mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
    if (script !== null) writeFileSync(bin, `#!/bin/sh\n${script}\n`);
    if (script !== null && exec) chmodSync(bin, 0o755);
    return { dir, rm: () => rmSync(dir, { recursive: true, force: true }) };
  };
  const answer = '{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"search"},{"name":"recipe_compile"}]}}';
  it("gives the names tools/list answers with", async () => {
    const { dir, rm } = project(`read a; read b; read c; echo '{"jsonrpc":"2.0","id":1,"result":{}}'; echo '${answer}'`);
    try {
      expect(await mcpTools(dir)).toEqual(["search", "recipe_compile"]);
    } finally {
      rm();
    }
  });
  it("fails, naming why, when the bin is missing, can't start, exits first or writes what isn't JSON-RPC: never a crash", async () => {
    for (const [script, exec, why] of [
      [null, true, /m3a mcp could not start: .*node_modules\/\.bin\/m3a isn't there, or leads to no file/], // a "bin" naming a file the tarball lacks: npm links none
      ["exit 0", false, /m3a mcp could not start: spawn .* EACCES/],
      ["echo no such file >&2; exit 3", true, /m3a mcp exited \(3\) before answering tools\/list: no such file/],
      ["echo hello; cat >/dev/null", true, /m3a mcp wrote a line that isn't JSON-RPC: hello/],
    ] as const) {
      const { dir, rm } = project(script, exec);
      try {
        await expect(mcpTools(dir)).rejects.toThrow(why);
      } finally {
        rm();
      }
    }
  });
  it(`stops a server that never answers after ${MCP_TIMEOUT_MS / 1000} s, failing (on fake timers: no test waits on the clock)`, async () => {
    const { dir, rm } = project("exec cat >/dev/null");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const listed = mcpTools(dir);
      vi.advanceTimersByTime(MCP_TIMEOUT_MS);
      await expect(listed).rejects.toThrow(`m3a mcp didn't answer tools/list within ${MCP_TIMEOUT_MS / 1000} s`);
    } finally {
      vi.useRealTimers();
      rm();
    }
  });
});
