// Fixtures by hash (WP-4.2): a rig in a manifest of its own fetches and verifies by its SHA-256, its license file read
// and checked (against its pinned SHA-256 too, where the manifest gives one); a wrong hash or a license that doesn't say
// CC0 keeps nothing; a check reads the cache alone; the
// committed manifest lists real CC0 rigs from two authors, each with an https source, a hash and a license file. Runs
// on file:// URLs, so it needs no network.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkRigs, fetchRigs, freshHeldout, heldoutStep, lintManifest, MANIFEST, usedSeeds, type Manifest, type Rig } from "./fixtures.ts";

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
  it("keeps a license file only with the SHA-256 a manifest pins, and checks it in the cache too (D57)", () => {
    const cache = join(src, "c"), pinned = createHash("sha256").update(readFileSync(join(dir, "LICENSE.txt"))).digest("hex");
    const [bad] = fetchRigs({ rigs: [rig({ licenseSha256: "1".repeat(64) })] }, cache);
    expect(bad).toMatchObject({ ok: false, how: "failed", why: `its license file (${cc0.url}) has SHA-256 ${pinned}, the manifest says ${"1".repeat(64)}: not kept` });
    expect(fetchRigs({ rigs: [rig({ licenseSha256: pinned })] }, cache)).toEqual([{ id: "held-out", ok: true, how: "fetched" }]);
    expect(checkRigs({ rigs: [rig({ licenseSha256: "1".repeat(64) })] }, cache)[0]).toMatchObject({ ok: false, why: expect.stringMatching(/^its license file has SHA-256/) });
    expect(lintManifest({ rigs: [rig({ licenseSha256: "abc" })] })).toEqual(["held-out: licenseSha256 must be 64 hex digits"]);
  });
  it("takes a gate's latest held-out run only unused, its license pinned and its rig cached (D57)", () => {
    const base = join(dir, "results"), cache = join(src, "d"), at = join(base, "heldout", "G4", "run-1"), pinned = createHash("sha256").update(readFileSync(join(dir, "LICENSE.txt"))).digest("hex");
    expect(freshHeldout("G4", base, cache).problems).toEqual([expect.stringMatching(/^no held-out run for G4/)]);
    mkdirSync(join(at, "B1"), { recursive: true });
    writeFileSync(join(at, "rig.json"), JSON.stringify({ rigs: [rig()] }));
    writeFileSync(join(at, "B1", "brief.md"), "# a variant");
    expect(freshHeldout("G4", base, cache).problems).toEqual([
      "held-out: its license file's SHA-256 isn't pinned (licenseSha256)",
      "held-out: not in the cache: npm run fixtures -- fetch",
      "run-1/B1 has no character.json",
    ]);
    writeFileSync(join(at, "rig.json"), JSON.stringify({ rigs: [rig({ licenseSha256: pinned })] }));
    writeFileSync(join(at, "B1", "character.json"), JSON.stringify({ seed: 401 }));
    fetchRigs({ rigs: [rig({ licenseSha256: pinned })] }, cache);
    expect(freshHeldout("G4", base, cache, [])).toMatchObject({ run: "run-1", problems: [], rigs: ["held-out"], seeds: [{ brief: "B1", seed: 401, used: false }] });
    expect(heldoutStep(freshHeldout("G4", base, cache, [])).summary).toMatch(/^run-1 is fresh: no gate run used it; its rigs pinned and cached \(held-out\); seeds B1 401, none of the \d+ used/);
    mkdirSync(join(base, "gates", "G4-run-1"), { recursive: true });
    expect(freshHeldout("G4", base, cache).problems).toEqual([expect.stringMatching(/^run-1 was used by a gate run already .* run-2$/)]);
    // another gate's variants may use seeds alone, none WP-4.2's, a test's or another run's
    const g6 = join(base, "heldout", "G6", "run-1"), tests = join(dir, "tests");
    mkdirSync(tests, { recursive: true });
    writeFileSync(join(tests, "grade.test.ts"), "for (const c of [{ seed: 1 }, { seed: 37 }]) grade(c);");
    for (const [b, seed] of [["B2", 7], ["B3", 37], ["B5", 401], ["B6", 512]] as const) {
      mkdirSync(join(g6, b), { recursive: true });
      writeFileSync(join(g6, b, "brief.md"), "# a variant");
      writeFileSync(join(g6, b, "character.json"), JSON.stringify({ seed }));
    }
    expect(freshHeldout("G6", base, cache, [tests]).problems).toEqual([
      "run-1/B2: seed 7 is WP-4.2's, a test's or another run's: a variant takes a character none used (PLAN.md §7)",
      "run-1/B3: seed 37 is WP-4.2's, a test's or another run's: a variant takes a character none used (PLAN.md §7)",
      "run-1/B5: seed 401 is WP-4.2's, a test's or another run's: a variant takes a character none used (PLAN.md §7)",
    ]);
    expect([...usedSeeds(base, undefined, [tests])].filter((x) => x > 19).sort((a, b) => a - b)).toEqual([37, 401, 512]);
    // a run of seeds alone, as G6's, says so, each variant's seed checked against the used ones (WP-4.2's 20, a test's
    // 37 and G4's run's 401) (D91)
    writeFileSync(join(g6, "B2", "character.json"), JSON.stringify({ seed: 722 }));
    writeFileSync(join(g6, "B3", "character.json"), JSON.stringify({ seed: 808 }));
    rmSync(join(g6, "B5"), { recursive: true });
    const h = freshHeldout("G6", base, cache, [tests]);
    expect(h).toEqual({ run: "run-1", problems: [], rigs: null, seeds: [{ brief: "B2", seed: 722, used: false }, { brief: "B3", seed: 808, used: false }, { brief: "B6", seed: 512, used: false }], used: 22 });
    expect(heldoutStep(h)).toEqual({
      summary: "run-1 is fresh: no gate run used it; no rig: seeds only; seeds B2 722, B3 808, B6 512, none of the 22 used (WP-4.2's, the tests', other runs')",
      detail: ["B2: seed 722, not among the 22 used", "B3: seed 808, not among the 22 used", "B6: seed 512, not among the 22 used"],
    });
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
