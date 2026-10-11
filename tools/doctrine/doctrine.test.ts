// Tests for the doctrine checks: each check has a passing and a failing fixture, built in a temporary folder.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBanned } from "./banned.ts";
import { checkBinaries } from "./binaries.ts";
import { checkBoundaries, specifiers } from "./boundaries.ts";
import { checkBudgets } from "./budgets.ts";
import { makeCtx, type Ctx } from "./context.ts";
import { checkDecisions, entryIds } from "./decisions.ts";
import { checkLocal } from "./local.ts";
import { checkPins, sha256File } from "./pins.ts";

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
  });
  it("passes the allowed graph", () => {
    const ctx = fixture({
      "packages/core/src/index.ts": 'export * from "./a.ts";',
      "packages/sensors/src/index.ts": 'import { VERSION } from "@m3a/core";',
      "packages/sensors/src/node.ts": 'import { readFileSync } from "node:fs";',
      "packages/tools/src/intake/store.ts": 'import { createClient } from "@supabase/supabase-js";',
      "apps/gallery/main.ts": 'import { PACKAGE } from "@m3a/core"; import { x } from "@m3a/io/node";',
      "apps/lab/2026-10-11-q/main.ts": 'import { inner } from "../../../packages/core/src/inner.ts";',
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
    });
    const msgs = checkBoundaries(ctx).findings.map((f) => f.message);
    expect(msgs).toHaveLength(8);
    expect(msgs.filter((m) => m.startsWith("packages/core/"))).toHaveLength(3);
    expect(msgs.some((m) => m.includes("node entry"))).toBe(true);
    expect(msgs.some((m) => m.includes("IntakeStore"))).toBe(true);
    expect(msgs.some((m) => m.includes("public entries"))).toBe(true);
    expect(msgs.some((m) => m.includes("nothing imports from apps/"))).toBe(true);
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
