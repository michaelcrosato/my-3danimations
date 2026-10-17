// The packaging's cheap parts (WP-7.4), in T1: the bundle's manifest (a CC0 game manifest whose clips the library has),
// the tier filter that keeps cc-by and cmu sets out of the default library pack, the published package.json (exports
// to dist/, the m3a bin at dist/node.js with its shebang, CHANGELOG.md, three's types an optional peer, "private" kept
// unless made publishable), the subset m3a.js carries and the library it opens, the manual's complete example as the
// extractor reads it, the headless example's marker, its rewrite for m3a.js, and how the check's `m3a mcp` step fails
// (a bin missing, unable to start, exiting, writing what isn't JSON-RPC, never answering: each a failure, not a crash
// or a hang; fake bins, the timeout on fake timers). The end-to-end
// `npm run pack -- --check` (a build, npm pack, a scratch install, m3a.js run) is slow, and runs in the gate (G7), not
// here.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame } from "../../packages/library/src/index.ts";
import { directory, licenseText } from "../../packages/library/src/node.ts";
import { ROOT } from "../run/cli.ts";
import { jsSpecifiers, PACKAGES, packSets, publishable, publishedExports, publishedManifest, REPOSITORY, tiersOf } from "./build.ts";
import { completeExample, forSingle, HEADLESS, headlessOf, importsOf, SECTION } from "./example.ts";
import { MCP_TIMEOUT_MS, mcpTools } from "./mcp.ts";
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
      expect([p, src.private, out.private, src.types, (src.files as string[])[0]]).toEqual([p, true, true, "./dist/index.d.ts", "dist"]);
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
  it("makes a staged copy publishable only when asked (O2): no \"private\", provenance, the repository it is built from", () => {
    const out = publishable(publishedManifest(pkgOf("core")), "packages/core");
    expect([out.private, out.publishConfig, out.repository]).toEqual([undefined, { access: "public", provenance: true }, { type: "git", url: REPOSITORY, directory: "packages/core" }]);
    expect(pkgOf("core").private).toBe(true);
  });
  it("runs the m3a bin from dist/node.js, the published ./node entry, with its shebang kept", () => {
    const tools = pkgOf("tools");
    expect(tools.bin).toEqual({ m3a: "./dist/node.js" });
    expect((publishedManifest(tools).exports as Record<string, { default: string }>)["./node"]!.default).toBe("./dist/node.js");
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
  it("gives every entry's names once: VERSION core's, PACKAGE m3a.js's own", async () => {
    const names = await namesOf(), all = [...OWN, ...Object.values(names).flat()];
    expect(Object.keys(names)).toEqual([...ENTRIES]);
    expect(new Set(all).size).toBe(all.length);
    expect(names["@m3a/core"]).toContain("VERSION");
    expect(["Animator", "metrics", "readGltf", "Library", "tools"].every((n) => all.includes(n))).toBe(true);
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
  it(`takes the headless example m3a.js runs from the manual's first \`\`\`${HEADLESS} block, if it has one`, () => {
    expect([headlessOf(manual), headlessOf(manual.replace("ts m3a.js", "ts"))]).toEqual(["const h = 1;\n", null]);
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
