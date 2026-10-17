// The packaging's cheap parts (WP-7.4), in T1: the bundle's manifest (a CC0 game manifest whose clips the library has),
// the tier filter that keeps cc-by and cmu sets out of the default library pack, the published package.json (exports
// to dist/, the m3a bin at dist/node.js with its shebang, "private" kept), the subset m3a.js carries and the library it
// opens, and the complete example's extractor and its rewrite for m3a.js. The end-to-end `npm run pack -- --check`
// (a build, npm pack, a scratch install, m3a.js run) is slow, and runs in the gate, not here.
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkGame } from "../../packages/library/src/index.ts";
import { directory, licenseText } from "../../packages/library/src/node.ts";
import { ROOT } from "../run/cli.ts";
import { jsSpecifiers, PACKAGES, packSets, publishedExports, publishedManifest, tiersOf } from "./build.ts";
import { exampleOf, forSingle, importsOf, MARKER } from "./example.ts";
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
    }
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
  it(`is the manual's first \`\`\`${MARKER} block, and a manual without one fails naming the marker`, () => {
    expect(exampleOf("# m\n```ts\nnot it\n```\n\n```ts example\nconst a = 1;\n```\n```ts example\nnor this\n```\n")).toBe("const a = 1;\n");
    expect(() => exampleOf("# m\n```ts\nconst a = 1;\n```\n")).toThrow(/no complete example: mark it with a fence opening ```ts example/);
    const manual = readFileSync(join(ROOT, "packages/tools/MANUAL.md"), "utf8");
    if (manual.includes("```ts example")) expect(exampleOf(manual).length).toBeGreaterThan(0);
    else expect(() => exampleOf(manual)).toThrow(/packages\/tools\/MANUAL\.md has no complete example/);
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
