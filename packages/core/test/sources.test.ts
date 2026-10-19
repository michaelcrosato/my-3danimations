// The motion-source socket in core (WP-9.2): the request's checks, the procedural and recipe sources through
// `sourceClip` (the intent's match, the seed's pick among equals, the same clip for the same seed), the record the
// socket writes into a clip's provenance, the license each clip claims, the warnings (missed constraints, a changed
// version of the terms, a claim that isn't the terms, a length off), both terms recorded when a clip was served under
// others than its source states, and a source's failures as SourceErrors (a name or terms no record can hold).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClip, procedural as PR, recipe as R, serialize, validate, VERSION, type Clip, type Rest } from "../src/index.ts";
import { checkRequest, proceduralSource, recipeSource, SourceError, sourceClip, words, type MotionSource, type SourceRequest } from "../src/sources/index.ts";

const ROOT = join(import.meta.dirname, "../../.."), LIB = join(ROOT, "library/sets");
const manifest = (set: string) => JSON.parse(readFileSync(join(LIB, set, "_set.json"), "utf8")) as { sources: Record<string, { rest: Rest }> };
const REST = manifest("MESH2MOTION").sources.M2M_QUATERNIUS!.rest, MOVES = (JSON.parse(readFileSync(join(ROOT, "library/moves.json"), "utf8")) as { moves: PR.Move[] }).moves;
const ask = (intent: string, more: Partial<SourceRequest> = {}): SourceRequest => ({ intent, skeleton: { rest: REST, restSrc: "M2M_QUATERNIUS" }, duration: 1, seed: 0, ...more });
const proc = proceduralSource({ moves: MOVES });
/** The library's clips by id, read from their files, as a recipe's resolver (content id: the file's SHA-256). */
const resolve: R.Resolver = (id) => {
  const [set, slug] = id.split("/") as [string, string];
  try {
    const text = readFileSync(join(LIB, set, `${slug}.json`), "utf8"), clip = parseClip(text);
    return { clip, rest: manifest(set).sources[clip.restSrc]!.rest, contentId: R.sha256(text) };
  } catch {
    return undefined;
  }
};
const recipes = ["Jab_Left", "Eased_Nod", "Proud_Walk_Lean"].map((n) => JSON.parse(readFileSync(join(ROOT, "spec/recipes", `${n}.json`), "utf8")) as R.Recipe);
const provenance = (c: Clip) => c.provenance as Clip["provenance"] & { source?: Record<string, unknown> };

describe("a request", () => {
  it("is checked field by field, each problem saying what it should be", () => {
    expect(checkRequest(ask("a walk"))).toEqual([]);
    expect(checkRequest(null)).toHaveLength(1);
    const bad = checkRequest({ intent: " ", skeleton: {}, duration: 0, seed: -1, constraints: [{ kind: "pose", t: 2, pose: { hips: [0, 0] } }, { kind: "root", t: 0.5, forward: "x" }, { kind: "spin" }] });
    for (const s of ["intent is", "duration is", "seed is", "skeleton is", "constraints[0].t", "constraints[0].pose has no body", "constraints[0].pose.hips is 3 numbers", "constraints[1]: forward", "constraints[2] is"]) expect(bad.some((b) => b.includes(s)), s).toBe(true);
    expect(checkRequest(ask("x", { constraints: [{ kind: "pose", t: 0, pose: { root: [0, 0] } as never }] })).some((b) => b.includes("give the root as a root constraint"))).toBe(true);
  });
  it("is refused before a source runs (E_REQUEST)", async () => {
    let ran = false;
    const spy: MotionSource = { name: "spy", terms: { license: "CC0-1.0", version: "1" }, generate: () => ((ran = true), { clip: {} as Clip, rest: REST }) };
    await expect(sourceClip(spy, ask("a walk", { seed: 1.5 }))).rejects.toMatchObject({ code: "E_REQUEST" });
    expect(ran).toBe(false);
  });
});

describe("the procedural source", () => {
  it("makes the gait, idle or move the intent names, on the request's body, with the source's record", async () => {
    const s = await sourceClip(proc, ask("a walk"));
    expect(s.clip.id).toBe("PROCEDURAL/Walk");
    expect(s.clip.restSrc).toBe("M2M_QUATERNIUS");
    expect(s.license).toBe("CC0-1.0");
    expect(s.record).toEqual({ name: "procedural", license: "CC0-1.0", version: VERSION, seed: 0, prompt: R.sha256("a walk") });
    expect(provenance(s.clip).source).toEqual(s.record);
    expect(provenance(s.clip).method).toBe("procedural");
    expect((await sourceClip(proc, ask("running fast"))).clip.id).toBe("PROCEDURAL/Run");
    const jab = await sourceClip(proc, ask("a quick jab", { duration: 0.9 }));
    expect(jab.clip.id).toBe("PROCEDURAL/Jab");
    expect(jab.warnings.filter((w) => w.startsWith("asked for"))).toEqual([]);
  });
  it("gives the same clip for the same seed, and the seed picks among equal matches", async () => {
    const a = await sourceClip(proc, ask("an idle", { seed: 4 })), b = await sourceClip(proc, ask("an idle", { seed: 4 })), c = await sourceClip(proc, ask("an idle", { seed: 5 }));
    expect(serialize(a.clip)).toBe(serialize(b.clip));
    expect([a.clip.id, c.clip.id].sort()).toEqual(["PROCEDURAL/Breathe", "PROCEDURAL/Fidget"]);
    expect(a.warnings.some((w) => w.includes("of 2 equal matches"))).toBe(true);
  });
  it("refuses an intent it has nothing for, naming what it has (E_NO_MATCH)", async () => {
    const err = await sourceClip(proc, ask("xyzzy")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect(err).toMatchObject({ code: "E_NO_MATCH" });
    expect(String((err as Error).message)).toContain("walk, brisk, run, limp, breathe, fidget, slash");
  });
  it("measures the constraints it doesn't follow, and a length off the one asked for", async () => {
    const walk = await sourceClip(proc, ask("a walk")), { t: _t, root: _r, yaw: _y, ...first } = walk.clip.keys[0]!;
    const met = await sourceClip(proc, ask("a walk", { constraints: [{ kind: "pose", t: 0, pose: first }] }));
    expect(met.warnings.filter((w) => w.includes("missed"))).toEqual([]);
    const off = await sourceClip(proc, ask("a walk", { constraints: [{ kind: "pose", t: 0.5, pose: { ...first, armL: [0, 0, 100, 0, 0], armR: [0, 0, 100, 0, 0] } }, { kind: "root", t: 1, forward: -50, right: 0 }] }));
    expect(off.warnings.some((w) => /key pose at 0.5 s is missed by \d+ mm/.test(w))).toBe(true);
    expect(off.warnings.some((w) => /root waypoint at 1 s is missed by \d+%/.test(w))).toBe(true);
    expect(off.warnings).toContain("procedural clips keep their own poses: constraints are measured, not followed");
    expect((await sourceClip(proc, ask("a jab", { duration: 3 }))).warnings.some((w) => w.startsWith("asked for 3 s, the clip is 0.9 s"))).toBe(true);
  });
});

describe("the recipe source", () => {
  const book = recipeSource({ recipes, resolve });
  it("compiles the recipe the intent names, its clip keeping its inputs' license (terms inherit)", async () => {
    const jab = await sourceClip(book, ask("a left jab"));
    expect(jab.clip.id).toBe("RECIPES/Jab_Left");
    expect(jab.license).toBe("CC0-1.0");
    expect(jab.record.license).toBe("inherit");
    expect(provenance(jab.clip).method).toBe("composed");
    expect((jab.clip.provenance as unknown as { recipe: { sha256: string } }).recipe.sha256).toBe(R.sha256(R.canonical(recipes[0])));
    const proud = await sourceClip(book, ask("a proud walk"));
    expect(proud.license).toBe("CC-BY-4.0");
    expect(proud.warnings.filter((w) => w.startsWith("the clip claims"))).toEqual([]);
    expect(serialize((await sourceClip(book, ask("a left jab"))).clip)).toBe(serialize(jab.clip));
  });
  it("refuses an intent no recipe matches (E_NO_MATCH)", async () => {
    await expect(sourceClip(book, ask("a cartwheel"))).rejects.toMatchObject({ code: "E_NO_MATCH", message: expect.stringContaining("RECIPES/Jab_Left") });
  });
});

describe("the socket", () => {
  const made = PR.idleClip(PR.IDLES[0]!, REST, { restSrc: "M2M_QUATERNIUS" });
  it("passes a source's own error code on, and refuses a clip that doesn't validate (E_INVALID)", async () => {
    const throws: MotionSource = { name: "x", terms: { license: "CC0-1.0", version: "1" }, generate: () => { throw Object.assign(new Error("down"), { code: "E_TRANSPORT" }); } };
    await expect(sourceClip(throws, ask("a"))).rejects.toMatchObject({ code: "E_TRANSPORT", message: "x: down" });
    const invalid: MotionSource = { name: "y", terms: { license: "CC0-1.0", version: "1" }, generate: () => ({ clip: { ...made, keys: [] }, rest: REST }) };
    await expect(sourceClip(invalid, ask("a"))).rejects.toMatchObject({ code: "E_INVALID" });
  });
  it("records the terms a clip was served under, and warns when they changed or the claim isn't them", async () => {
    const vendor: MotionSource = { name: "vendor", terms: { license: "LicenseRef-Vendor", version: "2026-01" }, generate: () => ({ clip: made, rest: REST, terms: { license: "LicenseRef-Vendor", version: "2026-09" } }) };
    const s = await sourceClip(vendor, ask("an idle", { duration: 7 }));
    expect(s.record).toMatchObject({ license: "LicenseRef-Vendor", version: "2026-09", stated: { license: "LicenseRef-Vendor", version: "2026-01" } });
    expect(s.warnings.some((w) => w.includes("vendor's terms changed") && w.includes("(2026-01)") && w.includes("(2026-09)"))).toBe(true);
    expect(s.warnings.some((w) => w.startsWith("the clip claims CC0-1.0, but vendor's terms are LicenseRef-Vendor"))).toBe(true);
  });
  it("records both terms when a clip was served under others than its source states, and only then; the record validates", async () => {
    const reply = (terms?: { license: string; version: string }): MotionSource => ({ name: "vendor", terms: { license: "LicenseRef-Vendor", version: "2026-01" }, generate: () => ({ clip: made, rest: REST, ...(terms ? { terms } : {}) }) });
    const swapped = await sourceClip(reply({ license: "CC0-1.0", version: "x" }), ask("an idle"));
    expect(swapped.record).toEqual({ name: "vendor", license: "CC0-1.0", version: "x", stated: { license: "LicenseRef-Vendor", version: "2026-01" }, seed: 0, prompt: R.sha256("an idle") });
    for (const s of [swapped, await sourceClip(reply(), ask("an idle")), await sourceClip(reply({ license: "LicenseRef-Vendor", version: "2026-01" }), ask("an idle"))]) expect(validate(s.clip, { mode: "lint" }).errors).toEqual([]);
    expect((await sourceClip(reply(), ask("an idle"))).record.stated).toBeUndefined();
    expect((await sourceClip(reply({ license: "LicenseRef-Vendor", version: "2026-01" }), ask("an idle"))).record.stated).toBeUndefined();
  });
  it("refuses a source whose name or terms its record can't hold (E_SOURCE), and served terms it can't read (E_INVALID)", async () => {
    const src = (name: string, terms: unknown, served?: unknown): MotionSource => ({ name, terms: terms as MotionSource["terms"], generate: () => ({ clip: made, rest: REST, ...(served ? { terms: served as MotionSource["terms"] } : {}) }) });
    for (const bad of [src("Vendor", { license: "CC0-1.0", version: "1" }), src("../../sets/X", { license: "CC0-1.0", version: "1" }), src("vendor", { license: "", version: "1" }), src("vendor", { license: "CC0-1.0" })]) await expect(sourceClip(bad, ask("an idle"))).rejects.toMatchObject({ code: "E_SOURCE" });
    await expect(sourceClip(src("vendor", { license: "CC0-1.0", version: "1" }, { license: 7, version: "1" }), ask("an idle"))).rejects.toMatchObject({ code: "E_INVALID", message: expect.stringContaining("terms it served") });
  });
  it("matches words as a game says them", () => {
    expect(words("The hero is Walking and runs, punches")).toEqual(["hero", "walk", "run", "punch"]);
  });
});
