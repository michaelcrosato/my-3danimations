// Tests for the doctrine checks: each check has a passing and a failing fixture, built in a temporary folder.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED, checkBanned, checkPin } from "./banned.ts";
import { checkBinaries } from "./binaries.ts";
import { checkBoundaries, publicApi, specifiers } from "./boundaries.ts";
import { checkBudgets } from "./budgets.ts";
import { makeCtx, type Ctx } from "./context.ts";
import { checkDecisions, entryIds } from "./decisions.ts";
import { checkLocal } from "./local.ts";
import { checkPins, sha256File } from "./pins.ts";
import { checkFrozen } from "./frozen.ts";

/** A context over a fresh folder holding `files` (path -> text or bytes); `main` is the decisions log on main. */
function fixture(files: Record<string, string | Uint8Array>, main: Record<string, string> = {}): Ctx {
  const root = mkdtempSync(join(tmpdir(), "m3a-doctrine-"));
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), content);
  }
  const ctx = makeCtx(root);
  return { ...ctx, atMain: (p) => main[p] ?? null };
}

describe("binaries", () => {
  it("passes text and fails a picture or a file with a zero byte", () => {
    expect(checkBinaries(fixture({ "a.ts": "// x\n" }))).toEqual([]);
    const found = checkBinaries(fixture({ "rig.glb": "glTF", "data.dat": new Uint8Array([1, 0, 2]) }));
    expect(found.map((f) => f.message.split(" ")[0])).toEqual(["data.dat", "rig.glb"]);
  });
  it("lets an approved binary through", () => {
    expect(checkBinaries(fixture({ "logo.png": "x" }), { "logo.png": "D99" })).toEqual([]);
  });
  it("counts a .gltf as binary unless approved by its exact path", () => {
    const gltf = '{"buffers":[{"uri":"data:application/octet-stream;base64,AAAA"}]}';
    expect(checkBinaries(fixture({ "rigs/hero.gltf": gltf }))).toHaveLength(1);
    expect(checkBinaries(fixture({ "spec/vectors/tier1b/rig.gltf": gltf }))).toEqual([]);
  });
});

describe("budgets", () => {
  it("passes within budget and fails each kind over it", () => {
    expect(checkBudgets(fixture({ "docs/PROGRESS.md": "a\nb\n" })).findings).toEqual([]);
    const long = Array.from({ length: 41 }, (_, i) => `line ${i}`).join("\n");
    const row = "Walk_Loop\t1.2\tloop\t1.4\t" + "very long tag ".repeat(20);
    const r = checkBudgets(fixture({ "docs/PROGRESS.md": long, "spec/LEGEND.md": "word ".repeat(900), "library/sets/X/catalog.tsv": `ok\t1\n${row}\n`, "packages/tools/MANUAL.md": "w ".repeat(8100) }));
    expect(r.findings.map((f) => f.message.split(" ")[0])).toEqual(["packages/tools/MANUAL.md", "spec/LEGEND.md", "library/sets/X/catalog.tsv", "docs/PROGRESS.md"]);
    expect(r.findings[2]!.message).toMatch(/row 2/);
  });
  it("reports a file not written yet as pending", () => {
    expect(checkBudgets(fixture({})).lines[0]).toMatch(/pending/);
  });
});

describe("boundaries", () => {
  it("reads every kind of import", () => {
    expect(specifiers(`import a from "x";\nimport type { B } from 'y';\nexport * from "./z.ts";\nimport "w";\nawait import("v");\n// import "comment";`)).toEqual(["x", "y", "./z.ts", "w", "v"]);
    // a word in a string isn't an import: "the import's fit ... my-3d2dge's"
    expect(specifiers(`const why = "the import's recorded fit, my-3d2dge's limits";\nimport "w";`)).toEqual(["w"]);
  });
  it("passes the allowed graph", () => {
    const ctx = fixture({
      "packages/core/src/index.ts": '/** The a module. */\nexport * as a from "./a.ts";',
      "packages/sensors/src/index.ts": 'import { VERSION } from "@m3a/core";',
      "packages/sensors/src/node.ts": 'import { readFileSync } from "node:fs";',
      "packages/tools/src/intake/store.ts": 'import { createClient } from "@supabase/supabase-js";',
      "apps/gallery/main.ts": 'import { PACKAGE } from "@m3a/core"; import { x } from "@m3a/io/node";',
      "apps/lab/2026-10-11-q/main.ts": 'import { inner } from "../../../packages/core/src/inner.ts";',
      // (the specifier built in two parts, so this file's own scan doesn't read it as an import)
      "tests/e2e/hello.e2e.ts": 'import { Hello } from "../../' + 'apps/lab/hello/src/game.ts";',
    });
    const r = checkBoundaries(ctx);
    expect(r.findings).toEqual([]);
    expect(r.reachPasts).toHaveLength(1);
  });
  it("fails each broken rule", () => {
    const ctx = fixture({
      "packages/core/src/a.ts": 'import { x } from "@m3a/io"; import fs from "node:fs"; import { y } from "../../io/src/y.ts";',
      "packages/sensors/src/index.ts": 'import fs from "node:fs"; import * as THREE from "three";',
      "packages/tools/src/cli.ts": 'import { createClient } from "@supabase/supabase-js";',
      "apps/gallery/main.ts": 'import { inner } from "@m3a/core/src/inner.ts";',
      "tools/x.ts": 'import { g } from "../apps/gallery/main.ts";',
      "tests/e2e/other.e2e.ts": 'import { Hello } from "../../' + 'apps/lab/hello/src/game.ts";',
    });
    const msgs = checkBoundaries(ctx).findings.map((f) => f.message);
    expect(msgs).toHaveLength(9);
    expect(msgs.filter((m) => m.startsWith("packages/core/"))).toHaveLength(3);
    expect(msgs.some((m) => m.includes("node entry"))).toBe(true);
    expect(msgs.some((m) => m.includes("IntakeStore"))).toBe(true);
    expect(msgs.some((m) => m.includes("public entries"))).toBe(true);
    expect(msgs.some((m) => m.includes("nothing imports from apps/"))).toBe(true);
  });
});

describe("the public API", () => {
  it("counts each export, and finds a bare export * and an export with no doc comment", () => {
    const text = '/** v */\nexport { VERSION } from "./v.ts";\n/**\n * many\n */\nexport type {\n  A,\n  B as C,\n} from "./a.ts";\n// not a doc\nexport const X = 1;\nexport * from "./z.ts";\n/** ns */\nexport * as ns from "./n.ts";\n/** f */\nexport function f() {}';
    expect(publicApi(text)).toEqual({ names: ["VERSION", "A", "C", "X", "ns", "f"], undocumented: ["X"], bare: ['export * from "./z.ts";'] });
  });
  it("fails a package entry over its limit, with a bare export * or an undocumented export", () => {
    const many = Array.from({ length: 41 }, (_, i) => `/** n${i} */\nexport const n${i} = ${i};`).join("\n");
    const msgs = checkBoundaries(fixture({ "packages/core/src/index.ts": many, "packages/io/src/index.ts": 'export * from "./a.ts";\nexport const Y = 1;' })).findings.map((f) => f.message);
    expect(msgs).toHaveLength(3);
    expect(msgs.some((m) => m.includes("41 names, more than 40"))).toBe(true);
    expect(msgs.some((m) => m.includes("as a namespace"))).toBe(true);
    expect(msgs.some((m) => m.includes("no doc comment above the export of Y"))).toBe(true);
  });
});

describe("banned APIs", () => {
  it("passes clean code and fails a banned call, where it is banned", () => {
    const bans = [{ pattern: /\bTHREE\.Geometry\b/, where: ["packages/"], use: "use BufferGeometry" }];
    expect(checkBanned(fixture({ "packages/three/src/a.ts": "new BufferGeometry()" }), bans)).toEqual([]);
    const ctx = fixture({ "packages/three/src/a.ts": "// ok\nnew THREE.Geometry()", "apps/lab/b.ts": "new THREE.Geometry()" });
    expect(checkBanned(ctx, bans).map((f) => f.message)).toEqual(["packages/three/src/a.ts:2 uses \\bTHREE\\.Geometry\\b: use BufferGeometry"]);
  });
});

describe("the three.js bans and pin (WP-4.1)", () => {
  it("finds each WebGL-era API that breaks under WebGPURenderer, naming its replacement", () => {
    const uses = ["new THREE.ShaderMaterial({})", "new RawShaderMaterial()", "material.onBeforeCompile = (s) => s", "const composer = new EffectComposer(renderer)", "import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'", "new WebGLRenderer()", "gl_FragColor = vec4(1.0);", "await renderer.renderAsync(scene, camera)", "import { RenderPipeline } from 'three/webgpu'"];
    const ctx = fixture(Object.fromEntries(uses.map((u, i) => [`apps/lab/hello/u${i}.ts`, u])));
    const found = checkBanned(ctx, BANNED);
    for (let i = 0; i < uses.length; i++) expect(found.some((f) => f.message.startsWith(`apps/lab/hello/u${i}.ts:1 uses `)), uses[i]).toBe(true);
    expect(checkBanned(fixture({ "apps/lab/hello/ok.ts": "import { WebGPURenderer, MeshStandardNodeMaterial, PostProcessing } from 'three/webgpu';\nnew WebGPURenderer({ forceWebGL: true });\nawait renderer.init();" }), BANNED)).toEqual([]);
    // docs/ may name them (docs/THREE.md lists them)
    expect(checkBanned(fixture({ "docs/THREE.md": "`ShaderMaterial` is banned" }), BANNED)).toEqual([]);
  });
  it("holds packages/three to the pin, in its package.json and in the lockfile", () => {
    const pkg = (v: string) => JSON.stringify({ name: "@m3a/three", peerDependencies: { three: v }, devDependencies: { three: v } });
    const lock = (v: string) => JSON.stringify({ packages: { "node_modules/three": { version: v } } });
    expect(checkPin(fixture({ "packages/three/package.json": pkg("0.182.0"), "package-lock.json": lock("0.182.0") }), { three: "0.182.0" })).toEqual([]);
    expect(checkPin(fixture({ "packages/three/package.json": pkg("0.186.1"), "package-lock.json": lock("0.186.1") }), { three: "0.182.0" }).map((f) => f.message)).toEqual([
      "packages/three/package.json peerDependencies declares three@0.186.1, the pin is 0.182.0 (tools/doctrine/banned-three.json, docs/THREE.md)",
      "packages/three/package.json devDependencies declares three@0.186.1, the pin is 0.182.0 (tools/doctrine/banned-three.json, docs/THREE.md)",
      "package-lock.json installs three@0.186.1, the pin is 0.182.0: run npm install",
    ]);
  });
});

describe("pins", () => {
  const pkg = (deps: Record<string, string>) => JSON.stringify({ version: "0.1.0", devDependencies: deps });
  const lock = (deps: Record<string, string>) => JSON.stringify({ packages: Object.fromEntries(Object.entries(deps).map(([n, v]) => [`node_modules/${n}`, { version: v }])) });
  it("passes exact pins that the lockfile installs", () => {
    expect(checkPins(fixture({ "package.json": pkg({ vitest: "4.1.11" }), "package-lock.json": lock({ vitest: "4.1.11" }) })).findings).toEqual([]);
  });
  it("fails a range, a lockfile mismatch, a short SHA and a frozen fixture that changed", () => {
    const pins = { repos: { a: { url: "https://github.com/x/a", sha: "abc123" } }, frozen: [{ path: "spec/vectors/frozen/core.json", sha256: "0".repeat(64), from: "x" }] };
    const ctx = fixture({ "package.json": pkg({ vitest: "^4.1.11", eslint: "10.12.0" }), "package-lock.json": lock({ vitest: "4.1.11", eslint: "10.0.0" }), "tools/pins.json": JSON.stringify(pins), "spec/vectors/frozen/core.json": "{}" });
    const msgs = checkPins(ctx).findings.map((f) => f.message);
    expect(msgs).toHaveLength(5);
    expect(msgs[0]).toMatch(/not an exact version/);
    expect(msgs.some((m) => m.includes("installs eslint@10.0.0"))).toBe(true);
    expect(msgs.some((m) => m.includes("full 40-hex"))).toBe(true);
    expect(msgs.some((m) => m.includes("frozen fixture"))).toBe(true);
  });
  it("verifies a frozen fixture's checksum", () => {
    const probe = fixture({ "f.json": "{}" });
    const sha256 = sha256File(join(probe.root, "f.json"));
    const pins = { repos: {}, frozen: [{ path: "spec/f.json", sha256, from: "x" }] };
    const ctx = fixture({ "package.json": pkg({}), "spec/f.json": "{}", "tools/pins.json": JSON.stringify(pins) });
    expect(checkPins(ctx).findings).toEqual([]);
  });
});

describe("the decisions log", () => {
  const log = (...ids: number[]) => "# Decisions\n\n```\n## D<n> · template\n```\n" + ids.map((i) => `\n## D${i} · 2026-10-11 · call ${i}\n`).join("");
  it("ignores the template in a code fence", () => {
    expect(entryIds(log(1, 2))).toEqual(["D1", "D2"]);
  });
  it("passes an appended log and fails a removed or duplicated entry", () => {
    expect(checkDecisions(fixture({ "docs/DECISIONS.md": log(1, 2, 3) }, { "docs/DECISIONS.md": log(1, 2) })).findings).toEqual([]);
    const gone = checkDecisions(fixture({ "docs/DECISIONS.md": log(1, 3) }, { "docs/DECISIONS.md": log(1, 2) })).findings;
    expect(gone.map((f) => f.message)).toEqual([expect.stringMatching(/lost D2/)]);
    expect(checkDecisions(fixture({ "docs/DECISIONS.md": log(1, 1) })).findings[0]!.message).toMatch(/D1 twice/);
  });
});

describe("the local lane", () => {
  it("passes the README alone and fails a committed clip or a shipped set that points at it", () => {
    expect(checkLocal(fixture({ "library/local/README.md": "x", "library/sets/A/_set.json": '{"tier":"cc0"}' }))).toEqual([]);
    const msgs = checkLocal(fixture({ "library/local/X/Walk.json": "{}", "library/sets/A/_set.json": '{"tier":"local"}', "library/sets/B/catalog.tsv": "see library/local/X" })).map((f) => f.message);
    expect(msgs).toHaveLength(3);
  });
});

describe("the frozen spec", () => {
  it("passes an untouched frozen file and fails a changed or missing one", () => {
    const probe = fixture({ "MOTION.md": "spec" });
    const sha = sha256File(join(probe.root, "MOTION.md"));
    const frozen = (files: Record<string, string>) => JSON.stringify({ about: "", version: "2.0-rc", decision: "D1", files });
    expect(checkFrozen(fixture({ "spec/MOTION.md": "spec", "spec/frozen.json": frozen({ "spec/MOTION.md": sha }) })).findings).toEqual([]);
    expect(checkFrozen(fixture({ "spec/MOTION.md": "spec, edited", "spec/frozen.json": frozen({ "spec/MOTION.md": sha }) })).findings[0]!.message).toMatch(/changed, but spec 2.0-rc is frozen/);
    expect(checkFrozen(fixture({ "spec/frozen.json": frozen({ "spec/MOTION.md": sha }) })).findings[0]!.message).toMatch(/missing/);
  });
  it("fails a frozen spec whose record is gone, a schema not recorded, and a decision not logged", () => {
    const probe = fixture({ "MOTION.md": "spec" });
    const sha = sha256File(join(probe.root, "MOTION.md"));
    const frozen = (decision: string) => JSON.stringify({ about: "", version: "2.0-rc", decision, files: { "spec/MOTION.md": sha } });
    const log = "# Decisions\n\n## D1 · 2026-10-11 · Frozen\n";
    expect(checkFrozen(fixture({ "spec/MOTION.md": "spec" })).findings[0]!.message).toMatch(/spec\/frozen.json is missing/);
    expect(checkFrozen(fixture({ "spec/MOTION.md": "spec", "spec/frozen.json": frozen("D1"), "docs/DECISIONS.md": log })).findings).toEqual([]);
    expect(checkFrozen(fixture({ "spec/MOTION.md": "spec", "spec/schemas/new.schema.json": "{}", "spec/frozen.json": frozen("D1"), "docs/DECISIONS.md": log })).findings[0]!.message).toMatch(/new.schema.json is part of the frozen spec but not recorded/);
    expect(checkFrozen(fixture({ "spec/MOTION.md": "spec", "spec/frozen.json": frozen("D9"), "docs/DECISIONS.md": log })).findings[0]!.message).toMatch(/D9, which docs\/DECISIONS.md doesn't log/);
  });
});
