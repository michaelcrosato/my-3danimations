// The compile cache the Node processes a test starts share (tools/run/compile-cache.ts): a process started after
// cacheChildren() compiles through .cache/node-compile/, and a cache the environment names already is kept.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cacheChildren, COMPILE_CACHE } from "./compile-cache.ts";

/** The compile cache a Node process started now uses (its Node version's directory under it), or "none". */
const used = () => spawnSync(process.execPath, ["-p", "require('node:module').getCompileCacheDir() ?? 'none'"], { encoding: "utf8" }).stdout.trim();

describe("the compile cache a test's processes share", () => {
  const was = process.env.NODE_COMPILE_CACHE;
  afterEach(() => {
    if (was === undefined) delete process.env.NODE_COMPILE_CACHE;
    else process.env.NODE_COMPILE_CACHE = was;
  });
  it("puts each Node process a test starts on .cache/node-compile/", () => {
    delete process.env.NODE_COMPILE_CACHE;
    expect(used()).toBe("none");
    expect(cacheChildren()).toBe(COMPILE_CACHE);
    expect(dirname(used())).toBe(COMPILE_CACHE);
  });
  it("keeps a cache the environment names", () => {
    const own = mkdtempSync(join(tmpdir(), "m3a-compile-cache-"));
    try {
      process.env.NODE_COMPILE_CACHE = own;
      expect(cacheChildren()).toBe(own);
      expect(dirname(used())).toBe(own);
    } finally {
      rmSync(own, { recursive: true, force: true });
    }
  });
});
