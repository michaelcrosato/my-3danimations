// The opt-in packs (D10, WP-7.4): the default pack holds the CC0 sets alone; a game that installs `@m3a/library-cc-by`
// beside it and opts in to cc-by sees that pack's sets, verified against the pack's own lock, and its license text; one
// that opts in to a tier whose pack isn't installed is told the install that brings it. Laid out as npm installs them,
// in a temporary node_modules whose sets link to the repository's.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { LibraryLock } from "../../src/index.ts";
import { installedPacks, licenseText, openLibrary, withPacks } from "../../src/node.ts";

const LIB = join(import.meta.dirname, "../../../../library"), LOCK = JSON.parse(readFileSync(join(LIB, "sets.lock.json"), "utf8")) as LibraryLock;
const base = mkdtempSync(join(tmpdir(), "m3a-packs-")), mods = join(base, "node_modules/@m3a");
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** A package as npm installs it: its package.json, its sets linked to the repository's, their lock and license texts. */
function installed(name: string, sets: string[], licenses: string[]): string {
  const dir = join(mods, name);
  mkdirSync(join(dir, "sets"), { recursive: true });
  mkdirSync(join(dir, "LICENSES"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `@m3a/${name}`, version: "0.0.0" }));
  for (const s of sets) symlinkSync(join(LIB, "sets", s), join(dir, "sets", s));
  writeFileSync(join(dir, "sets.lock.json"), JSON.stringify({ sets: Object.fromEntries(sets.map((s) => [s, LOCK.sets[s]])), aliases: {} }));
  for (const l of licenses) writeFileSync(join(dir, "LICENSES", `${l}.txt`), readFileSync(join(LIB, "LICENSES", `${l}.txt`)));
  return join(dir, "sets");
}
const dir = installed("library", ["QUATERNIUS_3D2DGE"], ["CC0-1.0"]), cc = installed("library-cc-by", ["STYLE100_IDLE"], ["CC-BY-4.0"]);
// the library's Node entry as the default pack installs it: packs are found from there
const from = join(mods, "library/dist/node.js");

describe("the opt-in packs", () => {
  it("finds an installed pack beside the library, and none from the repository", () => {
    expect(installedPacks(from)).toEqual({ "cc-by": cc });
    expect(installedPacks()).toEqual({});
  });
  it("shows the pack's sets to a game that opts in, verified against the pack's lock, and only then", () => {
    const packs = installedPacks(from), all = openLibrary({ dir, packs, tiers: ["cc0", "cc-by"] });
    expect(all.sets().map((s) => [s.set, s.tier])).toEqual([["QUATERNIUS_3D2DGE", "cc0"], ["STYLE100_IDLE", "cc-by"]]);
    expect(() => all.verify()).not.toThrow();
    const id = all.catalog("STYLE100_IDLE")[0]!.id;
    expect(all.clip(id).tier).toBe("cc-by");
    expect(openLibrary({ dir, packs }).sets().map((s) => s.set)).toEqual(["QUATERNIUS_3D2DGE"]);
    expect(withPacks(dir, [cc]).sets().sort()).toEqual(["QUATERNIUS_3D2DGE", "STYLE100_IDLE"]);
    // a pack's file that isn't what its lock says is named
    const lock = { sets: { ...LOCK.sets, STYLE100_IDLE: { ...LOCK.sets.STYLE100_IDLE!, files: { ...LOCK.sets.STYLE100_IDLE!.files, [`${id.split("/")[1]}.json`]: "0".repeat(64) } } } };
    expect(() => openLibrary({ dir, packs, tiers: ["cc0", "cc-by"], lock }).clip(id)).toThrow(/STYLE100_IDLE doesn't match its lock/);
  });
  it("keeps each pack's license text, and names the install for a tier no installed set holds", () => {
    expect(licenseText(dir, [cc])("CC-BY-4.0")).toMatch(/Attribution 4\.0/);
    expect(licenseText(dir, [])("CC-BY-4.0")).toBeNull();
    const said: string[] = [];
    openLibrary({ dir, packs: installedPacks(from), tiers: ["cc0", "cc-by", "cmu"], warn: (m) => said.push(m) });
    expect(said).toEqual(["library: no cmu set is installed: the cmu sets ship apart from the CC0 default pack (D10); npm install @m3a/library-cmu"]);
    // the repository's library holds every tier: nothing to install
    said.length = 0;
    openLibrary({ dir: join(LIB, "sets"), packs: {}, tiers: ["cc0", "cc-by", "cmu"], warn: (m) => said.push(m) });
    expect(said).toEqual([]);
  });
});
