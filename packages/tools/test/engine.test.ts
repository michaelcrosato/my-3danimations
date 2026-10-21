// The m3a bin's Node check (WP-F.1, D121): a Node without import.meta.main is refused on stderr with exit 1 when the
// bin is the process's entry (it did nothing before, an MCP client seeing a closed connection); one below the engines
// that has it runs with a warning; an imported module runs nothing and says nothing; the entry is found by real path,
// through a link as node_modules/.bin/m3a is one; ENGINE is package.json's engines; and the bin itself, on the Node
// running the tests, prints its version with nothing on stderr.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { ENGINE, engineCheck, isEntry } from "../src/node/engine.ts";
import { ROOT } from "./helpers/surfaces.ts";

const BIN = join(ROOT, "packages/tools/src/node.ts");

describe("engineCheck", () => {
  it("refuses a Node without import.meta.main when the bin is the entry, saying which Node it needs", () => {
    const c = engineCheck("20.20.0", undefined, true);
    expect(c.run).toBe(false);
    expect(c.exitCode).toBe(1);
    expect(c.message).toMatch(/^m3a: Node 20\.20\.0 can't run m3a: it needs Node 24\.2 or later \(package\.json engines\)/);
    expect(c.message).toMatch(/\nnext: put Node 24\.2 or later first on PATH/);
  });

  it("runs nothing and says nothing when the module is imported, on any Node", () => {
    expect(engineCheck("20.20.0", undefined, false)).toEqual({ run: false });
    expect(engineCheck("24.21.0", false, false)).toEqual({ run: false });
    expect(engineCheck("22.22.0", false, true)).toEqual({ run: false });
  });

  it("runs on Node 24.2 and later with nothing to say", () => {
    for (const v of ["24.2.0", "24.21.0", "25.0.0", "30.1.2"]) expect(engineCheck(v, true, true)).toEqual({ run: true });
  });

  it("runs below the engines with a warning when import.meta.main is there (22.18 to 24.1)", () => {
    for (const v of ["22.22.0", "24.1.0", "23.11.1"]) {
      const c = engineCheck(v, true, true);
      expect(c.run).toBe(true);
      expect(c.exitCode).toBeUndefined();
      expect(c.message).toBe(`m3a: warning: Node ${v} is older than the Node 24.2 or later m3a is built and tested for (package.json engines)\n`);
    }
  });

  it("states the engines both package.json files give", () => {
    for (const file of ["package.json", "packages/tools/package.json"]) {
      const engines = (JSON.parse(readFileSync(join(ROOT, file), "utf8")) as { engines: { node: string } }).engines.node;
      expect(engines, file).toBe(`>=${ENGINE.major}.${ENGINE.minor}`);
    }
  });
});

describe("isEntry", () => {
  it("reads the entry by real path, through a link, and is false for another file or none", () => {
    const dir = mkdtempSync(join(tmpdir(), "m3a-engine-"));
    try {
      const link = join(dir, "m3a");
      symlinkSync(BIN, link);
      const url = pathToFileURL(BIN).href;
      expect(isEntry(url, BIN)).toBe(true);
      expect(isEntry(url, link)).toBe(true);
      expect(isEntry(url, join(ROOT, "package.json"))).toBe(false);
      expect(isEntry(url, join(dir, "missing"))).toBe(false);
      expect(isEntry(url, undefined)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the bin", () => {
  it("runs on this Node with nothing on stderr", () => {
    const r = spawnSync(process.execPath, [BIN, "version"], { cwd: ROOT, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toMatch(/^m3a \d+\.\d+\.\d+, clip format 2\.0\n/);
  });
});
