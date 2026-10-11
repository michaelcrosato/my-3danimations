// Fixtures by hash (WP-4.2): a rig in a manifest of its own fetches and verifies by its SHA-256, its license file read
// and checked; a wrong hash or a license that doesn't say CC0 keeps nothing; a check reads the cache alone; the
// committed manifest lists real CC0 rigs from two authors, each with an https source, a hash and a license file. Runs
// on file:// URLs, so it needs no network.
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkRigs, fetchRigs, lintManifest, MANIFEST, type Manifest, type Rig } from "./fixtures.ts";

const dir = mkdtempSync(join(tmpdir(), "m3a-fixtures-")), src = join(dir, "src");
const file = (name: string, text: string) => {
  const p = join(dir, name);
  writeFileSync(p, text);
  return { url: `file://${p}`, sha256: createHash("sha256").update(text).digest("hex") };
};
const glb = file("rig.glb", "glTF... a rig's bytes"), cc0 = file("LICENSE.txt", "License: CC0 1.0 Universal\nhttps://creativecommons.org/publicdomain/zero/1.0/"), other = file("OTHER.txt", "All rights reserved.");
const rig = (over: Partial<Rig> = {}): Rig => ({ id: "held-out", author: "Someone", source: "a pack, by hash", url: glb.url, sha256: glb.sha256, license: "CC0 1.0", licenseUrl: cc0.url, ...over });

describe("fixtures by hash", () => {
  it("fetches a rig listed in a manifest of its own and verifies it by its SHA-256 and its license", () => {
    const m: Manifest = { rigs: [rig()] }, cache = join(src, "a");
    expect(checkRigs(m, cache)[0]).toMatchObject({ ok: false, how: "missing" });
    expect(fetchRigs(m, cache)).toEqual([{ id: "held-out", ok: true, how: "fetched" }]);
    expect(fetchRigs(m, cache)).toEqual([{ id: "held-out", ok: true, how: "cached" }]);
    expect(checkRigs(m, cache)).toEqual([{ id: "held-out", ok: true, how: "cached" }]);
    const record = JSON.parse(readFileSync(join(cache, "fetched.json"), "utf8"));
    expect(record["held-out"]).toMatchObject({ url: glb.url, sha256: glb.sha256, license: "CC0 1.0", licenseUrl: cc0.url, author: "Someone", source: "a pack, by hash" });
  });
  it("keeps nothing when the hash or the license file is wrong, saying which", () => {
    const cache = join(src, "b");
    const [hash] = fetchRigs({ rigs: [rig({ sha256: "0".repeat(64) })] }, cache);
    expect(hash).toMatchObject({ ok: false, how: "failed", why: `its SHA-256 is ${glb.sha256}, the manifest says ${"0".repeat(64)}: not kept` });
    const [lic] = fetchRigs({ rigs: [rig({ licenseUrl: other.url })] }, cache);
    expect(lic).toMatchObject({ ok: false, how: "failed", why: expect.stringMatching(/doesn't say CC0 1\.0: not kept$/) });
    expect(existsSync(join(cache, "held-out.glb"))).toBe(false);
  });
  it("lists real CC0 rigs from at least two authors, each with an https source, a hash and a license file", () => {
    const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
    expect(lintManifest(m)).toEqual([]);
    expect(m.rigs.every((r) => r.url.startsWith("https://") && r.licenseUrl.startsWith("https://"))).toBe(true);
    expect(new Set(m.rigs.map((r) => r.author)).size).toBeGreaterThanOrEqual(2);
    expect(lintManifest({ rigs: [rig({ sha256: "abc", license: "MIT", url: "http://x" })] })).toEqual([
      "held-out: sha256 must be 64 hex digits",
      'held-out: license "MIT" isn\'t one a fetch can check (CC0 1.0)',
      "held-out: url must be https (or file:// in a test)",
    ]);
  });
});
