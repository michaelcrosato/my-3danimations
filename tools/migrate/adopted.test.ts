// What the library's writers keep over a clip's source (WP-9.1, tools/migrate/adopted.ts): an adoption holds only while
// the owner's approval is on the clip's motion as it is, and is the adopt bot's for the submission it names; a review
// is carried over a rewrite while its motion hash matches, and dropped otherwise; a re-imported set's record takes an
// adopted clip as the next import writes it (its choice kept as adopted beside its source's measures, the mean and the
// manifest's importer line as the import gives them); and the migration keeps an adopted clip only on the rest its set
// recorded, refusing when a later pin's source measures that rest otherwise (with the pinned sources in .cache/src:
// npm run pins -- fetch).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseClip, serialize, type Clip, type Rest } from "@m3a/core";
import { motionHash } from "../../packages/tools/src/intake/hash.ts";
import { importerLine, meanFit, withAdoption, type ClipChoice } from "../import/import.ts";
import { ROOT } from "../run/cli.ts";
import { adoptedWhy, adoptionOf, carryReview, restOn, sameRest } from "./adopted.ts";
import { migrate, readSource } from "./migrate.ts";
import { SETS } from "./sets.ts";

const SET = join(ROOT, "library/sets/MESH2MOTION"), read = (f: string) => readFileSync(join(SET, f), "utf8");
const walk = parseClip(readFileSync(join(ROOT, "library/sets/QUATERNIUS_3D2DGE/Walk_Loop.json"), "utf8"));
const adopted = (c: Clip, motion = motionHash(c)): Clip => ({ ...c, provenance: { ...c.provenance, intake: { by: "a test", submission: `s-0123456789abcdef@${"ab".repeat(32)}` } } as Clip["provenance"], review: { state: "approved", by: "owner", date: "2026-10-19", motion, note: "adopted from s-0123456789abcdef@abababababab: reads well" } });

describe("an adoption", () => {
  it("holds while the owner's approval is on the clip's motion as it is", () => {
    expect(adoptionOf(adopted(walk))).toEqual({ submission: `s-0123456789abcdef@${"ab".repeat(32)}`, by: "owner", date: "2026-10-19", motion: motionHash(walk) });
    expect(adoptedWhy(adoptionOf(adopted(walk))!)).toBe(`adopted from the intake queue (s-0123456789abcdef@abababababab) by the owner (owner) on 2026-10-19: kept over its source's version while that approval holds for its motion (${motionHash(walk).slice(0, 12)})`);
    const moved = { ...walk, keys: walk.keys.map((k, i) => (i === 1 ? { ...k, head: (k as unknown as { head: number[] }).head.map((v, j) => (j ? v : v + 5)) } : k)) } as Clip;
    expect([adoptionOf(walk), adoptionOf({ ...adopted(walk), review: { ...adopted(walk).review!, state: "flagged" } }), adoptionOf(adopted(moved, motionHash(walk)))]).toEqual([null, null, null]);
    // an approval written by hand on its motion, not the adopt bot's for that submission, is no adoption
    const { note: _, ...bare } = adopted(walk).review!;
    expect([adoptionOf({ ...adopted(walk), review: bare }), adoptionOf({ ...adopted(walk), review: { ...bare, note: "adopted from s-ffffffffffffffff@abababababab" } }), adoptionOf({ ...adopted(walk), review: { ...bare, note: "adopted from s-0123456789abcdef@abababababab" } })?.by]).toEqual([null, null, "owner"]);
  });
});

describe("a review over a rewrite", () => {
  it("is carried while its motion hash matches the rewritten clip's, else dropped", () => {
    const review = { state: "approved" as const, by: "owner", date: "2026-10-19", motion: motionHash(walk) };
    expect(carryReview(walk, { ...walk, review }).review).toEqual(review);
    expect(carryReview({ ...walk, review }, { ...walk, review: { ...review, motion: "0".repeat(64) } }).review).toBeUndefined();
    expect(carryReview(walk, null).review).toBeUndefined();
  });
});

describe("a re-imported set's record", () => {
  it("takes an adopted clip as the import writes it: kept as adopted, its source's measures beside it, the mean and the importer line", () => {
    const text = read("_import.json"), was = JSON.parse(text) as { mean: number; clips: Record<string, ClipChoice> }, a = adoptionOf(adopted(walk))!;
    const fits = Object.keys(was.clips).map((s) => (parseClip(read(`${s}.json`)).quality.fit as number[])[0]!);
    expect(JSON.parse(read("_set.json")).content.importer).toBe(importerLine(8));
    const r = withAdoption(text, "Jump_2", a, fits), now = JSON.parse(r.record) as typeof was;
    expect([now.clips.Jump_2, now.mean, r.importer]).toEqual([{ ...was.clips.Jump_2, kept: "adopted", why: adoptedWhy(a) }, was.mean, importerLine(7)]);
    expect(withAdoption(text, "Jump_2", a, fits.map((f, i) => (i ? f : f + fits.length))).record).toMatch(new RegExp(`\\n "mean": ${Number((meanFit(fits) + 1).toFixed(1))},\\n`));
    expect(() => withAdoption(text, "Not_A_Clip", a, fits)).toThrow(/Not_A_Clip has no choice in its set's _import.json/);
    // a loop whose record names a contact reading (D129) is adopted with its own contacts: the record names none after
    const named = JSON.stringify({ ...was, clips: { ...was.clips, Jump_2: { ...was.clips.Jump_2, contacts: "planted-quarter" } } });
    expect((JSON.parse(withAdoption(named, "Jump_2", a, fits).record) as typeof was).clips.Jump_2).toEqual({ ...was.clips.Jump_2, kept: "adopted", why: adoptedWhy(a) });
  });
});

describe("a migrated set's adopted clip", () => {
  const SET = "QUATERNIUS_3D2DGE", spec = SETS.find((x) => x.set === SET)!, dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  it.skipIf(!existsSync(join(ROOT, ".cache/src/my-3d2dge", spec.from.file)))("is kept on the rest its set recorded; a later pin that measures that rest otherwise is refused, not played on another body", () => {
    // the set on disk with Walk_Loop adopted, as the bot leaves it
    const disk = mkdtempSync(join(tmpdir(), "m3a-migrate-adopted-")), dir = join(disk, SET);
    dirs.push(disk);
    mkdirSync(dir);
    for (const f of ["_set.json", "_baseline.json"]) cpSync(join(ROOT, "library/sets", SET, f), join(dir, f));
    writeFileSync(join(dir, "Walk_Loop.json"), serialize(adopted(walk)));
    const run = (root: string) => migrate(root, { sets: [SET], disk: { dir: disk, sets: [SET] } }), same = run(ROOT);
    expect([same.report.sets[0]!.errors, same.report.sets[0]!.adopted.map((a) => a.id), same.files.get(`${SET}/Walk_Loop.json`)]).toEqual([[], [`${SET}/Walk_Loop`], serialize(adopted(walk))]);
    // a later pin of the source: its UAL1 rest measured otherwise (a longer shin), the clip's motion hash unchanged
    const root = mkdtempSync(join(tmpdir(), "m3a-migrate-pin-")), data = readSource(ROOT, spec) as unknown as { sources: Record<string, { rest: Rest }> };
    dirs.push(root);
    data.sources.UAL1!.rest.shin += 40;
    mkdirSync(join(root, ".cache/src/my-3d2dge/src/mocap/sets"), { recursive: true });
    writeFileSync(join(root, ".cache/src/my-3d2dge", spec.from.file), `window.MOCAP = { quaternius: ${JSON.stringify(data)} };\n`);
    symlinkSync(join(ROOT, "spec"), join(root, "spec"));
    expect(sameRest(data.sources.UAL1!.rest, restOn(dir, "UAL1")!)).toBe(false);
    const moved = run(root);
    expect([moved.report.sets[0]!.errors, moved.report.sets[0]!.adopted]).toEqual([["Walk_Loop: adopted on UAL1's rest as its set had it, which its source now measures otherwise: the owner adopts it again on the new rest"], []]);
  }, 30_000);
});
