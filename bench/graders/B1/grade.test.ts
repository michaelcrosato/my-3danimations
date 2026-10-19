// B1's grader (WP-4.7's Done-when): it passes the known-good solution and fails each planted bad one, with the check it
// broke, on the default character (gen-1, of WP-4.2's set) and, in T2's full step (M3A_FULL=1, D74), on a generator
// seed outside it (gen-37) and on G4's first held-out rig (it stands 1 m below its origin and faces +X); T2 passes the
// known-good on gen-41 and the Quaternius mannequins (meshopt-compressed) too. Both starters load every real rig on
// hand as the grader reads it (meshopt-compressed, textured, off the floor). KayKit's knight loads but isn't graded: the
// package floats it 55 mm (bind reads its soles from its arm mesh; its legs are meshes of their own). Read from its
// legs, it stands on its soles but still fails: its boots are 430 mm (106% of its hips' height), the toe 205 mm past the
// ball, and the jog's swinging toe, curled straight down as the clip's is, rides the floor (both feet off it in 0% of
// running frames; 10% needed); a toe read shorter passes, its boots' fronts 124 mm under the floor walking. The planted
// solutions are the known-good one edited: never running, skating (moving at the asked speed with walk and run at
// their own rate), a bone gone NaN, no sheet; T1 grades the first, T2's full step all of them (D119).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bind } from "@m3a/three";
import { loadGlb } from "@m3a/three/test-characters";
import { CACHE, rigBytes, type Manifest } from "../../../tools/fixtures/fixtures.ts";
import { prepareWorkspace, type CharacterSpec } from "../../runner/workspace.ts";
import { cacheChildren } from "../../../tools/run/compile-cache.ts";
import { gradeB1, type Grade } from "./grade.ts";

const ROOT = join(import.meta.dirname, "../../.."), GOOD = join(import.meta.dirname, "known-good/src"), FULL = process.env.M3A_FULL === "1";
const good = { player: readFileSync(join(GOOD, "player.ts"), "utf8"), sheet: readFileSync(join(GOOD, "sheet.ts"), "utf8") };
/** The real rigs on hand, by id, with their manifests: WP-4.2's and G4's first held-out one. */
const RIGS: Record<string, string> = { "quaternius-mannequin-m": "tools/fixtures/rigs.json", "quaternius-mannequin-f": "tools/fixtures/rigs.json", "kaykit-knight": "tools/fixtures/rigs.json", "orangejuice-male-base": "bench/results/heldout/G4/run-1/rig.json" };
const rig = (id: string): CharacterSpec => ({ manifest: join(ROOT, RIGS[id]!), rig: id });
/** The known-good solution with edits (each `[from, to]`), every one of which must take. */
const planted = (edits: [string, string][], file: "player" | "sheet" = "player") => {
  for (const [from] of edits) if (!good[file].includes(from)) throw new Error(`the planted edit's text isn't in the known-good ${file}: ${from}`);
  return { ...good, [file]: edits.reduce((text, [from, to]) => text.replace(from, to), good[file]) };
};
const BAD: Record<string, { files: typeof good; fails: string }> = {
  "never runs": { files: planted([["RUN_FROM = 2.2", "RUN_FROM = 99"]]), fails: "plays run at" },
  // walk and run at their own rate, the character moved at the speed asked: the feet slide by the difference
  skates: {
    files: planted([["character.position.add(player.travel);", "character.position.add(player.travel.clone().setLength(speed * dt));"], ["Math.min(2, Math.max(0.5, (speed * 1000) / moves[m].speed))", "1"]]),
    fails: "a foot stands still at",
  },
  "a bone gone NaN": { files: planted([["player.update(dt);", "player.update(dt);\n      if (animator.time > 5) bound.bones[0]!.position.x = Number.NaN;"]]), fails: "finite" },
  "no sheet": { files: planted([['writePng("sheet.png", raster.join(sheets, { down: true }));', "void writePng;"]], "sheet"), fails: "a sheet is produced" },
};
/** Grades a solution in a workspace inside the repository (the packages resolve to their sources). */
async function grade(name: string, files: typeof good, character: CharacterSpec): Promise<Grade> {
  const dir = join(ROOT, ".cache/bench/test-ws", `${name.replace(/\W+/g, "-")}-${"seed" in character ? character.seed : character.rig}`);
  await prepareWorkspace(dir, { starter: join(ROOT, "bench/starters/B1"), character, files: { "src/player.ts": files.player, "src/sheet.ts": files.sheet } });
  return gradeB1(dir);
}
// each grade's `npm run sheet` compiles through one cache (tools/run/compile-cache.ts)
cacheChildren();
const text = (g: Grade) => g.checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`).join("\n");
const who = (c: CharacterSpec) => ("seed" in c ? `gen-${c.seed}` : c.rig);

describe("B1's grader", () => {
  it("asks a character speeds in proportion to its hip height: the known-good passes on a chibi (D56)", async () => {
    // generator seed 935, hips 0.44 m up: asked 1.2 and 3.5 m/s, the walk travelled 0.84 m/s at twice its own rate
    // and the running foot never stood still (G4's first held-out draw)
    const g = await grade("good", good, { seed: 935 });
    expect(g.pass, text(g)).toBe(true);
    expect(g.checks.find((c) => c.name.startsWith("plays walk at"))!.name).toBe("plays walk at 0.53 m/s");
  }, 120_000);
  it("has both starters load every real rig on hand as the grader reads it: meshopt-compressed, textured, off the floor", async () => {
    // G4's starters read none of the mannequins (meshopt) nor the knight (its texture: Node has no image decoder). The
    // grader's reading of each rig (its bytes checked against its manifest first) is the same for both starters: read once
    const ours = new Map<string, ReturnType<typeof bind>["core"]>();
    for (const starter of ["B1", "B1-discovery"]) {
      const { loadCharacter } = (await import(join(ROOT, "bench/starters", starter, "src/character.ts"))) as { loadCharacter(path: string): Promise<Parameters<typeof bind>[0]> };
      for (const [id, manifest] of Object.entries(RIGS)) {
        if (!ours.has(id)) {
          const bytes = rigBytes(id, JSON.parse(readFileSync(join(ROOT, manifest), "utf8")) as Manifest);
          if (!bytes) throw new Error(`${id} isn't fetched: npm run fixtures -- fetch --manifest ${manifest}`);
          ours.set(id, bind((await loadGlb(bytes, { textures: false })).scene).core);
        }
        const theirs = bind(await loadCharacter(join(CACHE, `${id}.glb`))).core, our = ours.get(id)!;
        expect([theirs.rest.H0, [...theirs.restPts]], `${starter} on ${id}`).toEqual([our.rest.H0, [...our.restPts]]);
      }
    }
  }, 60_000);
  for (const character of (FULL ? [{ seed: 41 }, rig("quaternius-mannequin-m"), rig("quaternius-mannequin-f")] : []) as CharacterSpec[]) {
    it(`passes the known-good solution on ${who(character)}`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
    }, 180_000);
  }
  for (const character of (FULL ? [{ seed: 1 }, { seed: 37 }, rig("orangejuice-male-base")] : [{ seed: 1 }]) as CharacterSpec[]) {
    it(`passes the known-good solution on ${who(character)}`, async () => {
      const g = await grade("good", good, character);
      expect(g.pass, text(g)).toBe(true);
    }, 180_000);
    it(`fails each planted bad solution on ${who(character)}, naming the check it broke`, async () => {
      // T1 grades the first planted one; T2 (M3A_FULL=1) all of them (D74, D119: T1's margin)
      for (const [name, bad] of Object.entries(BAD).filter((_, i) => FULL || i === 0)) {
        const g = await grade(name, bad.files, character);
        expect(g.pass, `${name}\n${text(g)}`).toBe(false);
        expect(g.checks.filter((c) => !c.ok).some((c) => c.name.startsWith(bad.fails)), `${name}\n${text(g)}`).toBe(true);
      }
    }, 600_000);
  }
});
