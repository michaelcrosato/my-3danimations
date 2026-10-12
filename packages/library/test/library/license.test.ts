// License compliance (WP-5.7): every set passes, with its open questions listed; a fixture for each failure fails
// with its reason (a source without an SPDX id, a license that doesn't fit its tier, a text not kept, a credited set
// without its credit, a clip from a tier the game didn't opt into, an unknown clip, local content in a shipped game);
// a game is credited only for the credited sets it uses, and the block says so.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkGame, checkSets, creditsBlock, type LibrarySource } from "../../src/index.ts";
import { directory, licenseText } from "../../src/node.ts";

const DIR = join(import.meta.dirname, "../../../../library/sets"), LIB = DIR, real = directory(DIR), text = licenseText(DIR);
const SETS = readdirSync(DIR).sort();

/** A small library in memory: each set's manifest fields and its clip names. */
function fake(sets: Record<string, { tier: string; credit?: string; sources: Record<string, { license?: string; audit?: string }>; clips: string[] }>): LibrarySource {
  return {
    sets: () => Object.keys(sets),
    files: (s) => ["_set.json", "catalog.tsv", ...sets[s]!.clips.map((c) => `${c}.json`)],
    read: (s, f) => {
      if (f !== "_set.json") throw new Error(`fake library: ${s}/${f} isn't read`);
      const { clips: _clips, ...m } = sets[s]!;
      return JSON.stringify({ set: s, title: `${s} title`, ...m });
    },
  };
}
const kept = (id: string) => (["CC0-1.0", "CC-BY-4.0", "LicenseRef-CMU-Mocap"].includes(id) ? "the text" : null);

describe("license compliance", () => {
  it("passes every set, lists the open questions, and credits the CC BY and CMU sets", () => {
    const r = checkSets(real, SETS, text);
    expect(r.findings.filter((f) => f.level === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
    // Mesh2Motion's per-asset audit closed in WP-5.3 (D63): no question is open
    expect(r.findings).toEqual([]);
    // every CMU and 100STYLE set is credited, with its license and every clip it holds
    const count = (s: string) => readdirSync(join(LIB, s)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).length;
    expect(r.credits.map((c) => [c.set, c.licenses, c.clips])).toEqual(SETS.filter((s) => s === "CMU_CURATED" || s.startsWith("STYLE100")).map((s) => [s, [s === "CMU_CURATED" ? "LicenseRef-CMU-Mocap" : "CC-BY-4.0"], count(s)]));
    expect(r.block).toMatch(/^Motion credits:\n- CMU motion capture, curated \(LicenseRef-CMU-Mocap\): CMU Graphics Lab/);
  });
  it("fails each set fixture with its reason", () => {
    const lib = fake({
      NOID: { tier: "cc0", sources: { a: {} }, clips: ["x"] },
      BADID: { tier: "cc0", sources: { a: { license: "CC0 1.0" } }, clips: ["x"] },
      MISFIT: { tier: "cc0", sources: { a: { license: "CC-BY-4.0" } }, clips: ["x"] },
      SHARE: { tier: "cc-by", credit: "someone", sources: { a: { license: "CC-BY-SA-4.0" } }, clips: ["x"] },
      UNKEPT: { tier: "cc0", sources: { a: { license: "MIT" } }, clips: ["x"] },
      UNCREDITED: { tier: "cc-by", sources: { a: { license: "CC-BY-4.0" } }, clips: ["x"] },
      NOSOURCE: { tier: "cc0", sources: {}, clips: ["x"] },
    });
    const by = (set: string) => checkSets(lib, [set], kept).findings.filter((f) => f.level === "fail").map((f) => f.message);
    expect(by("NOID")).toEqual(["no SPDX license id (license)"]);
    expect(by("BADID")).toEqual(['"CC0 1.0" isn\'t an SPDX id (or a LicenseRef-)', "CC0 1.0's text isn't kept in library/LICENSES/CC0 1.0.txt"]);
    expect(by("MISFIT")).toEqual(["CC-BY-4.0 doesn't fit the cc0 tier (D10): move the set, or the source"]);
    expect(by("SHARE")).toEqual(["CC-BY-SA-4.0 doesn't fit the cc-by tier (D10): move the set, or the source", "CC-BY-SA-4.0's text isn't kept in library/LICENSES/CC-BY-SA-4.0.txt"]);
    expect(by("UNKEPT")).toEqual(["MIT doesn't fit the cc0 tier (D10): move the set, or the source", "MIT's text isn't kept in library/LICENSES/MIT.txt"]);
    expect(by("UNCREDITED")).toEqual(["a cc-by set must say how to credit it (credit)"]);
    expect(by("NOSOURCE")).toEqual(["no sources, so no license"]);
    expect(checkSets(lib, ["NOPE"], kept).findings[0]!.message).toMatch(/^no set "NOPE" in the library/);
  });
  it("checks a game: its clips from the tiers it opted into, no local content shipped, credits for what it uses", () => {
    const lib = fake({
      FREE: { tier: "cc0", sources: { a: { license: "CC0-1.0" } }, clips: ["walk", "run"] },
      STYLE: { tier: "cc-by", credit: "Style by someone, CC BY 4.0.", sources: { a: { license: "CC-BY-4.0" } }, clips: ["strut", "sway"] },
      MINE: { tier: "local", sources: { a: { license: "LicenseRef-Mine" } }, clips: ["dance"] },
    });
    const fails = (g: Parameters<typeof checkGame>[1]) => checkGame(lib, g, (id) => (id === "LicenseRef-Mine" ? "mine" : kept(id))).findings.filter((f) => f.level === "fail").map((f) => `${f.where}: ${f.message}`);
    // the default pack: CC0 alone, nothing to credit
    const free = checkGame(lib, { clips: ["FREE/walk"] }, kept);
    expect([free.ok, free.credits, free.block]).toEqual([true, [], "Motion: CC0 clips from the m3a library; no credit is owed."]);
    expect(fails({ clips: ["STYLE/strut"] })).toEqual(["STYLE/strut: STYLE is a cc-by set and this game opts into cc0: opt in, or use a clip from those tiers"]);
    expect(fails({ clips: ["FREE/fly"] })).toEqual(['FREE/fly: no clip "FREE/fly" in the library']);
    expect(fails({ tiers: ["cc0", "local"], clips: ["MINE/dance"] })).toEqual([
      "MINE: local content never ships (D10): drop it, or mark the manifest ships: false for a game that stays on this machine",
      "tiers: a shipped game opts into local: local content never ships (D10)",
    ]);
    expect(fails({ tiers: ["cc0", "local"], clips: ["MINE/dance"], ships: false })).toEqual([]);
    expect(fails({ tiers: ["cc0", "gold" as never] })).toEqual(['tiers: no tier "gold"; the tiers are cc0, cc-by, cmu, local']);
    // credited only for the credited sets it uses, by how many of their clips
    const styled = checkGame(lib, { tiers: ["cc0", "cc-by"], clips: ["FREE/walk", "STYLE/strut"] }, kept);
    expect(styled.credits.map((c) => [c.set, c.clips])).toEqual([["STYLE", 1]]);
    expect(styled.block).toBe("Motion credits:\n- STYLE title (CC-BY-4.0): Style by someone, CC BY 4.0.");
    // listing no clips uses every set of its tiers
    expect(checkGame(lib, { tiers: ["cc0", "cc-by"] }, kept).credits.map((c) => [c.set, c.clips])).toEqual([["STYLE", 2]]);
    expect(creditsBlock([])).toMatch(/no credit is owed/);
  });
});
