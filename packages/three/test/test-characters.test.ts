// Test characters (WP-4.2): the 20 generated variants load in three.js (GLTFLoader, in Node) and are recognized
// (WP-1.4), each with its confidence reported; they vary as WP-4.2 says (builds, rest poses, namings, twist bones,
// left-out bones); a seed gives the same bytes every run, and a seed outside the set another character; their generator
// entry (generate.ts, which @m3a/tools and m3a.js import) and every file it reaches import nothing but @m3a/core and
// each other, never three (D119); the real CC0 rigs, once fetched (`npm run fixtures -- fetch`), load and are
// recognized too.
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { Matrix4 } from "three";
import { describe, expect, it } from "vitest";
import { recognize, skeleton } from "@m3a/core";
import { specifiers } from "../../../tools/doctrine/boundaries.ts";
import { rigBytes } from "../../../tools/fixtures/fixtures.ts";
import { character, loadGlb, skeletonIn, TEST_SEEDS, variant } from "../test-characters/index.ts";

const TABLE = { vrm: "vrm", mixamo: "mixamo", ue5: "unreal5", rigify: "rigify" } as const;

/** Loads a seed's character and reads it as recognize does, with how far three's skeleton is from the generated one. */
async function read(seed: number) {
  const spec = variant(seed), { glb, bones } = character(spec), loaded = await loadGlb(glb);
  const mesh = loaded.skinned[0]!, sk = skeletonIn(mesh), rec = recognize(sk);
  const heads = Math.max(...bones.map((g, i) => Math.hypot(...g.head.map((v, j) => v - sk.bones[i]!.head![j]!))));
  // at rest each bone's world matrix times its inverse bind matrix is the identity: the skin sits where it was written
  const bind = Math.max(...mesh.skeleton.bones.map((b, i) => Math.max(...new Matrix4().multiplyMatrices(b.matrixWorld, mesh.skeleton.boneInverses[i]!).elements.map((e, k) => Math.abs(e - (k % 5 === 0 ? 1 : 0))))));
  return { spec, glb, bones, loaded, sk, rec, heads, bind, frame: skeleton.restFrame(sk, rec) };
}

describe("the generated test characters", () => {
  it("are 20 that load in three.js and are recognized, each with its confidence", async () => {
    const lines: string[] = [];
    for (const seed of TEST_SEEDS) {
      const r = await read(seed), s = r.spec;
      expect([r.loaded.skinned.length, r.sk.bones.length], s.id).toEqual([1, r.bones.length]);
      expect(r.heads, `${s.id}: three's bones where they were generated`).toBeLessThan(1e-6);
      expect(r.bind, `${s.id}: bound at rest`).toBeLessThan(1e-5);
      expect([r.rec.method, r.rec.table, r.rec.missing], s.id).toEqual(["table", TABLE[s.naming], []]);
      expect(r.rec.confidence, s.id).toBeGreaterThanOrEqual(0.9);
      expect(r.frame.kind, `${s.id}: rest pose`).toBe(s.rest);
      lines.push(`${s.id} ${s.build}/${s.rest}/${s.naming}${s.twist ? "+twist" : ""}${s.drop.length ? `-${s.drop.join("-")}` : ""} ${r.rec.confidence}`);
    }
    console.log(`test characters: ${lines.length} recognized: ${lines.join("; ")}`);
    expect(lines).toHaveLength(20);
  });
  it("vary in proportions, rest pose, bone names, twist bones and left-out bones", () => {
    expect(TEST_SEEDS, "seeds 0 to 19, as the manual's Fit says").toEqual(Array.from({ length: 20 }, (_, i) => i));
    const specs = TEST_SEEDS.map(variant), set = (f: (s: (typeof specs)[number]) => string) => new Set(specs.map(f));
    expect([set((s) => s.build).size, set((s) => s.rest).size, set((s) => s.naming).size]).toEqual([5, 3, 4]);
    expect(set((s) => `${s.naming} ${s.twist}`).size, "each naming with and without twist bones").toBe(8);
    expect(set((s) => `${s.build} ${s.naming}`).size, "every build with every naming, as the manual's Fit says").toBe(20);
    expect(new Set(specs.flatMap((s) => s.drop))).toEqual(new Set(["upperChest", "toes", "shoulders", "neck", "chest"]));
    // the builds differ in height and head size: a chibi is a third head, a tall one an eighth
    const tall = (seed: number) => {
      const b = character(variant(seed)).bones, head = b.find((x) => x.humanoid === "head")!;
      return head.head[1];
    };
    expect(tall(0)).toBeLessThan(tall(4) / 1.5);
  });
  it("are the same bytes for a seed every run; a seed outside the set is another character", async () => {
    expect(character(variant(7)).glb).toEqual(character(variant(7)).glb);
    expect(character(variant(7)).glb).not.toEqual(character(variant(27)).glb);
    const held = await read(1000);
    expect([held.rec.missing, held.rec.confidence >= 0.9, held.bind < 1e-5]).toEqual([[], true, true]);
  });
  it("are built without three by their generator entry (D119): it and every file it reaches import only @m3a/core and each other", () => {
    // the entry the exports map names, then each relative import, as the doctrine's boundaries check reads one
    const dir = join(import.meta.dirname, "../test-characters"), pkg = JSON.parse(readFileSync(join(dir, "../package.json"), "utf8")) as { exports: Record<string, string> };
    const seen: string[] = [], outside: string[] = [];
    const reach = (file: string): void => {
      if (seen.includes(file)) return;
      seen.push(file);
      for (const s of specifiers(readFileSync(file, "utf8"))) {
        if (s.startsWith("./") || s.startsWith("../")) reach(join(dirname(file), s));
        else if (s !== "@m3a/core") outside.push(`${relative(dir, file)} imports ${s}`);
      }
    };
    reach(join(dir, "..", pkg.exports["./test-characters/generate"]!));
    expect([seen.map((f) => relative(dir, f)).sort(), outside]).toEqual([["characters.ts", "generate.ts", "variants.ts"], []]);
  });
});

describe("the real CC0 rigs", () => {
  for (const id of ["quaternius-mannequin-m", "quaternius-mannequin-f", "kaykit-knight"]) {
    it(`${id} loads in three.js and is recognized`, async (ctx) => {
      const bytes = rigBytes(id);
      if (!bytes) return ctx.skip(`${id} isn't fetched: npm run fixtures -- fetch`);
      const loaded = await loadGlb(bytes, { textures: false }), rec = recognize(skeletonIn(loaded.skinned[0]!));
      expect(loaded.skinned.length).toBeGreaterThan(0);
      expect(rec.missing).toEqual([]);
      console.log(`${id}: ${loaded.skinned[0]!.skeleton.bones.length} bones, ${loaded.animations.length} clips, by ${rec.method}${rec.table ? ` (${rec.table})` : ""}, confidence ${rec.confidence}`);
      expect(rec.confidence).toBeGreaterThanOrEqual(0.8);
    });
  }
});
