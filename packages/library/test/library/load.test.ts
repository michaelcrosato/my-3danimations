// The library loader (WP-5.1): every migrated set loads with its content id and every clip file as locked; a tampered
// file fails with its clip named; a game that hasn't opted in sees only the CC0 sets, and a clip in another tier is
// refused with how to opt in; a deprecated id resolves with a warning naming its successor.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Library, LibraryError, TIERS, type LibraryLock, type LibrarySource } from "../../src/index.ts";
import { directory, lockLibrary, openLibrary, sha256 } from "../../src/node.ts";

const DIR = join(import.meta.dirname, "../../../../library/sets");
const LOCK = JSON.parse(readFileSync(join(DIR, "../sets.lock.json"), "utf8")) as LibraryLock;
/** The real library with one file's text replaced. */
const tampered = (set: string, file: string, edit: (text: string) => string): LibrarySource => {
  const d = directory(DIR);
  return { ...d, read: (s, f) => (s === set && f === file ? edit(d.read(s, f)) : d.read(s, f)) };
};

describe("the library loader", () => {
  it("loads every migrated set, its content id and every clip file as the lock says, and the lock is the library's", () => {
    const lib = openLibrary({ dir: DIR, tiers: TIERS });
    expect(() => lib.verify()).not.toThrow();
    expect(lib.sets().map((s) => s.set)).toEqual(Object.keys(LOCK.sets).sort());
    expect(lib.sets().reduce((a, s) => a + s.clips, 0)).toBe(Object.values(LOCK.sets).reduce((a, s) => a + Object.keys(s.files).length, 0));
    // the committed lock is what the files give now: a clip changed without relocking fails here
    expect(lockLibrary(DIR, LOCK)).toEqual(LOCK);
    const { clip, rest, set, tier } = lib.clip("QUATERNIUS_3D2DGE/Walk_Loop");
    expect([clip.id, set, tier, rest.H0]).toEqual(["QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE", "cc0", 916.7]);
  });
  it("fails a tampered file with its clip named, and a set whose files don't give its content id", () => {
    const lib = new Library(tampered("MESH2MOTION", "Walk_Female.json", (t) => t.replace('"dur":', '"dur": ')), { sha256, lock: LOCK });
    let err: LibraryError | undefined;
    try {
      lib.clip("MESH2MOTION/Idle_A");
    } catch (e) {
      err = e as LibraryError;
    }
    expect(err).toBeInstanceOf(LibraryError);
    expect([err!.code, err!.clip]).toEqual(["E_TAMPERED", "MESH2MOTION/Walk_Female"]);
    expect(err!.message).toMatch(/MESH2MOTION\/Walk_Female changed/);
    // without the lock the content id still catches it, naming the set
    expect(() => new Library(tampered("MESH2MOTION", "Walk_Female.json", (t) => `${t} `), { sha256 }).clip("MESH2MOTION/Idle_A")).toThrow(/MESH2MOTION's clip files give content id/);
    // a set left alone still loads
    expect(new Library(tampered("MESH2MOTION", "Walk_Female.json", (t) => `${t} `), { sha256, lock: LOCK }).clip("QUATERNIUS_3D2DGE/Idle_Loop").clip.id).toBe("QUATERNIUS_3D2DGE/Idle_Loop");
  });
  it("shows a game that hasn't opted in only the CC0 sets, and refuses another tier's clip with how to opt in", () => {
    const lib = openLibrary({ dir: DIR });
    expect(lib.sets().map((s) => [s.set, s.tier])).toEqual([["MESH2MOTION", "cc0"], ["QUATERNIUS_3D2DGE", "cc0"], ["QUATERNIUS_SHARDFALL", "cc0"]]);
    expect(lib.catalog().every((r) => !r.id.startsWith("CMU_") && !r.id.startsWith("STYLE100"))).toBe(true);
    expect(lib.catalog().length).toBe(366);
    expect(() => lib.clip("CMU_CURATED/Walk_Loop")).toThrow(/a cmu set, and this game sees only cc0: opt in with \{ tiers: \["cc0", "cmu"\] \}/);
    expect(() => lib.catalog("STYLE100")).toThrow(LibraryError);
    const all = openLibrary({ dir: DIR, tiers: ["cc0", "cc-by", "cmu"] });
    expect(all.clip("CMU_CURATED/Walk_Loop").tier).toBe("cmu");
    expect(all.catalog("STYLE100")[0]!.id.startsWith("STYLE100/")).toBe(true);
    expect(() => openLibrary({ dir: DIR, tiers: ["cc1" as never] })).toThrow(/no tier "cc1"/);
  });
  it("resolves a deprecated id to its successor with a warning, and names what it can't find", () => {
    const warned: string[] = [], lib = new Library(directory(DIR), { sha256, lock: { ...LOCK, aliases: { "QUATERNIUS/Walk": "QUATERNIUS_3D2DGE/Walk_Loop" } }, warn: (m) => warned.push(m) });
    expect(lib.clip("QUATERNIUS/Walk").clip.id).toBe("QUATERNIUS_3D2DGE/Walk_Loop");
    expect(warned).toEqual(['library: "QUATERNIUS/Walk" is deprecated; use "QUATERNIUS_3D2DGE/Walk_Loop"']);
    expect(() => lib.clip("MESH2MOTION/Nope")).toThrow(/no clip "MESH2MOTION\/Nope"; MESH2MOTION has 176 clips/);
    expect(() => lib.clip("NOPE/Walk")).toThrow(/no set "NOPE"/);
    expect(() => lib.clip("Walk_Loop")).toThrow(/isn't a clip id/);
  });
  it("reads catalog rows as their fields", () => {
    const row = openLibrary({ dir: DIR }).catalog("QUATERNIUS_3D2DGE").find((r) => r.id === "QUATERNIUS_3D2DGE/Walk_Loop")!;
    expect(row).toMatchObject({ dur: 1.333, loop: true, tags: ["walk"], src: "UAL1" });
  });
});
