// Lineage (WP-9.3): every library clip resolves down to its sources, the copies by `orig` to the clips they copy; every
// composed clip resolves (the 20 example recipes in spec/recipes and the library's actions, compiled, and as written)
// to the library clips and procedural parts its steps read, at the content the lock holds; what can't resolve is named
// (a missing clip, a loop, an input changed since); and deprecation keeps the clip: its id resolves, marked, through
// the lock's aliases as the loader reads them, and is never given to another clip.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { actions as A, recipe as R, serialize, type Clip } from "@m3a/core";
import { describe, expect, it } from "vitest";
import { checkIds, clipIds, deprecate, Lineage, PROCEDURAL, successorOf } from "../../src/lineage/index.ts";
import { Library, TIERS, type LibraryLock } from "../../src/index.ts";
import { directory, openLibrary } from "../../src/node.ts";

const ROOT = join(import.meta.dirname, "../../../.."), DIR = join(ROOT, "library/sets");
const LOCK = JSON.parse(readFileSync(join(ROOT, "library/sets.lock.json"), "utf8")) as LibraryLock, FILES = clipIds(LOCK);
const lib = openLibrary({ dir: DIR, tiers: TIERS, warn: () => {} }), resolve = lib.resolver(), graph = Lineage.ofLibrary(lib, LOCK.aliases);
const json = (dir: string) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), "utf8")) as unknown);
const RECIPES = json("spec/recipes") as R.Recipe[], ACTIONS = json("library/actions") as (A.Action | A.PairedAction)[];
/** The clips a recipe's steps read (a paired action's every role's). */
const reads = (r: R.Recipe | A.PairedAction) => ("roles" in r ? Object.values(r.roles).flatMap((x) => x.steps) : r.steps).filter((s) => s.op === "clip").map((s) => s.id as string);
/** A source the library holds or a procedural part: what every lineage must come down to. */
const isSource = (id: string) => PROCEDURAL.test(id) || (FILES.has(id) && !graph.node(id)!.from.length);

/** The composed clips: each example recipe and each library action compiled on the library, a paired one per role. */
const composed: Clip[] = [...RECIPES.map((r) => R.compile(r, resolve).clip), ...ACTIONS.flatMap((a) => (A.isPaired(a) ? Object.values(A.compilePaired(a, resolve).roles).map((x) => x.compiled.clip) : [A.compileAction(a, resolve).clip]))];

describe("lineage", () => {
  it("resolves every library clip to its sources, each copy by orig to the clip it copies", () => {
    const copies = graph.ids().filter((id) => graph.node(id)!.from.length);
    expect(graph.size).toBe(FILES.size);
    for (const id of graph.ids()) {
      const r = graph.resolve(id);
      expect([r.ok, r.problems], id).toEqual([true, []]);
      expect(r.sources.every(isSource), id).toBe(true);
    }
    // the orig chains (Mesh2Motion's re-exports of Quaternius): each comes down to the clip it names
    expect(copies.length).toBe(84);
    for (const id of copies) expect(graph.resolve(id).sources).toContain(successorOf(LOCK, graph.node(id)!.from[0]!.id).id);
    console.log(`lineage: ${graph.size} library clips resolve, ${copies.length} of them copies by orig`);
  });

  it(`resolves every composed clip: ${RECIPES.length} example recipes and ${ACTIONS.length} library actions, compiled and as written`, () => {
    const g = Lineage.ofLibrary(lib, LOCK.aliases), plan = new Lineage({ aliases: LOCK.aliases });
    expect(composed.length).toBe(RECIPES.length + ACTIONS.length + 1);
    for (const c of composed) g.addClip(c, R.sha256(serialize(c)));
    for (const c of composed) {
      const r = g.resolve(c.id), inputs = (c.provenance as { recipe?: { inputs: Record<string, string> } }).recipe!.inputs;
      expect([r.ok, r.problems], c.id).toEqual([true, []]);
      expect(r.sources.length, c.id).toBeGreaterThan(0);
      expect(r.sources.every(isSource), c.id).toBe(true);
      // each input as the lock holds it: the content id the clip was made from is its file's
      for (const [id, content] of Object.entries(inputs)) if (!PROCEDURAL.test(id)) expect(content, `${c.id} ← ${id}`).toBe(FILES.get(id));
    }
    // as written, before compiling: a recipe comes down to the clips its steps read, their own lineage included
    for (const r of [...RECIPES, ...ACTIONS]) plan.addRecipe(r);
    for (const c of graph.ids().map((id) => resolve(id)!.clip)) plan.addClip(c);
    for (const r of [...RECIPES, ...ACTIONS]) {
      const res = plan.resolve(r.id), compiled = composed.filter((c) => c.id === r.id || c.id.startsWith(`${r.id}_`)).flatMap((c) => g.resolve(c.id).sources);
      expect([res.ok, res.problems], r.id).toEqual([true, []]);
      expect(res.through, r.id).toEqual(expect.arrayContaining(reads(r).filter((id) => !PROCEDURAL.test(id))));
      // a compiled clip reads no clip its recipe doesn't name
      expect(res.sources, r.id).toEqual(expect.arrayContaining(compiled));
    }
    expect(g.derived("STYLE100/Neutral_Walk")).toEqual(expect.arrayContaining(["RECIPES/Proud_Walk_Lean", "RECIPES/Walk_Into_Run"]));
    console.log(`lineage: ${composed.length} composed clips resolve to ${new Set(composed.flatMap((c) => g.resolve(c.id).sources)).size} sources`);
  });

  it("names what can't resolve: a clip it doesn't hold, a loop, an input changed since it was made from it", () => {
    const g = new Lineage(), clip = (id: string, orig?: string, inputs?: Record<string, string>) => ({ id, provenance: { src: "X", method: orig ? "composed" : "keyed", producer: { tool: "t", version: "1" }, license: "CC0-1.0", ai: "composite", ...(orig ? { orig } : {}), ...(inputs ? { recipe: { sha256: "", inputs } } : {}) } }) as Pick<Clip, "id" | "provenance">;
    g.addClip(clip("S/Base"), "aaa");
    g.addClip(clip("S/Made", "S/Base", { "S/Base": "bbb", "S/Gone": "ccc" }));
    g.addClip(clip("S/Loop_A", "S/Loop_B"));
    g.addClip(clip("S/Loop_B", "S/Loop_A"));
    const made = g.resolve("S/Made");
    expect(made.ok).toBe(false);
    expect(made.sources).toEqual(["S/Base"]);
    expect(made.problems.map((p) => [p.code, p.id])).toEqual([["stale", "S/Base"], ["missing", "S/Gone"]]);
    expect(made.problems[0]!.message).toMatch(/S\/Made was made from S\/Base at content bbb…, and it is aaa… now: make S\/Made again/);
    expect(g.resolve("S/Loop_A")).toMatchObject({ ok: false, problems: [{ code: "cycle", message: "S/Loop_A is made from itself: S/Loop_A ← S/Loop_B ← S/Loop_A" }] });
    expect(g.resolve("S/Nothing")).toMatchObject({ ok: false, problems: [{ code: "missing" }] });
    expect(g.byContent("aaa")).toEqual(["S/Base"]);
    expect(() => g.addClip(clip("S/Base"))).toThrow(/is in the graph already/);
  });

  it("deprecates without deleting: the clip stays, its id resolves through the alias, marked, and is never given again", () => {
    // Mesh2Motion's jab is its re-export of Quaternius' (its orig): deprecated for the clip it copies
    const old = "MESH2MOTION/Punch_Jab", successor = "QUATERNIUS_SHARDFALL/Punch_Jab", next = deprecate(LOCK, old, successor);
    // an alias added, nothing removed
    expect(next.aliases).toEqual({ ...LOCK.aliases, [old]: successor });
    expect(next.sets).toEqual(LOCK.sets);
    expect(checkIds(next, LOCK)).toEqual([]);
    // the loader resolves the old id to its successor and says so; the old clip's file is there to read
    const warnings: string[] = [], loader = new Library(directory(DIR), { tiers: TIERS, lock: next, warn: (m) => warnings.push(m) });
    expect(loader.clip(old).clip.id).toBe(successor);
    expect(warnings).toEqual([`library: "${old}" is deprecated; use "${successor}"`]);
    // a composed clip made from it still resolves, through the clip kept, marked; with the clip gone, through its
    // successor
    const jab = composed.find((c) => c.id === "ACTIONS/Jab_And_Flinch_Attacker")!, kept = Lineage.ofLibrary(lib, next.aliases);
    kept.addClip(jab);
    expect(kept.resolve(jab.id)).toMatchObject({ ok: true, sources: [successor], through: [jab.id, old, successor], problems: [{ code: "deprecated", id: old, message: `${jab.id} is made from ${old}, deprecated for ${successor}` }] });
    const gone = new Lineage({ aliases: next.aliases });
    for (const id of graph.ids().filter((x) => x !== old)) gone.addClip(resolve(id)!.clip);
    gone.addClip(jab);
    expect(gone.resolve(jab.id)).toMatchObject({ ok: true, sources: [successor], through: [jab.id, successor], problems: [{ code: "deprecated", id: old, message: `${jab.id} is made from ${old}, deprecated for ${successor}; its clip is gone, so ${successor}'s lineage stands in` }] });
    // each way an id can go wrong from one lock to the next
    const [set, file] = [old.split("/")[0]!, `${old.split("/")[1]}.json`], without = (l: LibraryLock): LibraryLock => ({ ...l, sets: { ...l.sets, [set]: { ...l.sets[set]!, files: Object.fromEntries(Object.entries(l.sets[set]!.files).filter(([f]) => f !== file)) } } });
    const codes = (l: LibraryLock, prev = next) => checkIds(l, prev).map((p) => [p.code, p.id]);
    expect(codes(without(next))).toEqual([["deleted", old]]);
    expect(codes(without(LOCK), LOCK)).toEqual([["dropped", old]]);
    expect(codes({ ...next, sets: { ...next.sets, [set]: { ...next.sets[set]!, files: { ...next.sets[set]!.files, [file]: "0".repeat(64) } } } })).toEqual([["reused", old]]);
    expect(codes({ ...next, aliases: { ...next.aliases, "MESH2MOTION/Nowhere": "MESH2MOTION/Nothing" } })).toEqual([["dangling", "MESH2MOTION/Nowhere"]]);
    expect(codes({ ...next, aliases: { ...next.aliases, [successor]: old } }).map(([c]) => c)).toEqual(["cycle", "cycle"]);
    // and what deprecate refuses
    expect(() => deprecate(next, old, successor)).toThrow(/deprecated already/);
    expect(() => deprecate(LOCK, "MESH2MOTION/Nothing", successor)).toThrow(/has no clip MESH2MOTION\/Nothing/);
    expect(() => deprecate(LOCK, old, old)).toThrow(/can't succeed itself/);
    expect(() => deprecate(next, successor, old)).toThrow(/isn't a clip that stands \(it is deprecated for/);
  });
});
