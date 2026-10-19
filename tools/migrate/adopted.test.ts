// What the library's writers keep over a clip's source (WP-9.1, tools/migrate/adopted.ts): an adoption holds only while
// the owner's approval is on the clip's motion as it is, and is the adopt bot's for the submission it names; a review is carried over a rewrite while its motion hash
// matches, and dropped otherwise; and a re-imported set's record takes an adopted clip as the next import writes it
// (its choice kept as adopted beside its source's measures, the mean and the manifest's importer line as the import
// gives them).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, type Clip } from "@m3a/core";
import { motionHash } from "../../packages/tools/src/intake/hash.ts";
import { importerLine, meanFit, withAdoption, type ClipChoice } from "../import/import.ts";
import { ROOT } from "../run/cli.ts";
import { adoptedWhy, adoptionOf, carryReview } from "./adopted.ts";

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
  });
});
